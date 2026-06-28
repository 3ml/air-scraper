# Air Scraper - Claude Development Guide

## Critical Requirements

### 1. Language
**ALL code, comments, documentation, commit messages, and variable names MUST be written in English**, regardless of the language used in prompts or requests.

### 2. Documentation Updates
**Every new implementation or development MUST update this CLAUDE.md file and README.md if needed.** This ensures the documentation stays current and serves as an accurate reference for future development.

---

## Project Overview

Standalone Node.js microservice for stealth web scraping with Playwright. Features API-triggered scenarios, SQLite database, admin dashboard, and anti-detection measures.

## Tech Stack

| Component | Technology |
|-----------|------------|
| Runtime | Node.js 20+ (ESM) |
| API Framework | Fastify 5 |
| Scraping | Playwright + playwright-extra + stealth plugin |
| Database | SQLite + Drizzle ORM |
| Logging | Pino (JSON structured) |
| Dashboard | Vite + React + Tailwind + DaisyUI |
| Deploy | VPS Linux + PM2 + Caddy |

---

## Project Structure

```
air-scraper/
├── src/
│   ├── index.ts                    # Entry point
│   ├── config/env.ts               # Environment validation (Zod)
│   ├── api/
│   │   ├── server.ts               # Fastify setup
│   │   ├── routes/
│   │   │   ├── trigger.ts          # POST /api/trigger
│   │   │   ├── screenshot.ts       # POST /api/screenshot (synchronous)
│   │   │   ├── scenarios.ts        # GET /api/scenarios
│   │   │   ├── health.ts           # GET /health
│   │   │   ├── metrics.ts          # GET /metrics (Prometheus)
│   │   │   └── admin.ts            # Admin API endpoints
│   │   └── middleware/
│   │       ├── auth.ts             # Token authentication (attaches TokenContext)
│   │       ├── tokenResolver.ts    # Master/scoped token resolution + scope checks
│   │       └── requestId.ts        # Request correlation ID
│   ├── db/
│   │   ├── schema.ts               # Drizzle ORM schema
│   │   └── client.ts               # SQLite connection
│   ├── scraper/
│   │   ├── ScraperEngine.ts        # Main orchestration class
│   │   ├── browser/
│   │   │   ├── BrowserManager.ts   # Browser pool management
│   │   │   └── StealthConfig.ts    # Stealth/anti-detection setup
│   │   ├── humanizer/
│   │   │   ├── index.ts            # Unified humanizer interface
│   │   │   ├── MouseSimulator.ts   # Bezier curve mouse movements
│   │   │   ├── TypingSimulator.ts  # Gaussian typing delays
│   │   │   ├── ScrollSimulator.ts  # Natural scroll behavior
│   │   │   └── DelayManager.ts     # Random delays
│   │   ├── evasion/
│   │   │   ├── index.ts            # Evasion exports + config
│   │   │   ├── UserAgentRotator.ts # 50+ real UA rotation
│   │   │   └── ViewportManager.ts  # Realistic viewport sizes
│   │   └── consent/
│   │       └── CookieConsentHandler.ts  # Auto cookie consent
│   ├── scenarios/
│   │   ├── BaseScenario.ts         # Abstract scenario class
│   │   ├── registry.ts             # Scenario registration
│   │   ├── index.ts                # Exports + auto-registration
│   │   └── implementations/        # Actual scenarios
│   │       ├── test.scenario.ts    # Example test scenario
│   │       ├── airelite-test.scenario.ts  # AirElite properties extraction
│   │       └── vikey.scenario.ts   # Vikey reservation data extraction
│   ├── queue/
│   │   ├── TaskQueue.ts            # Priority queue
│   │   └── TaskWorker.ts           # Worker with retry logic
│   ├── services/
│   │   ├── CallbackService.ts      # POST results to external URL
│   │   └── AlertService.ts         # Error alerts via webhook
│   ├── observability/
│   │   ├── logger.ts               # Pino JSON logging
│   │   └── metrics.ts              # Prometheus metrics
│   ├── utils/
│   │   └── encryption.ts           # AES-256-GCM encryption utility
│   └── types/
│       └── api.types.ts            # API type definitions
├── dashboard/                       # Admin UI (separate build)
│   ├── src/
│   │   ├── App.tsx
│   │   ├── pages/
│   │   │   ├── Dashboard.tsx       # Stats overview
│   │   │   ├── Tasks.tsx           # Task list + details
│   │   │   └── Logs.tsx            # Log viewer
│   │   ├── components/
│   │   │   └── Layout.tsx
│   │   └── hooks/
│   │       └── useApi.ts
│   ├── package.json
│   ├── vite.config.ts
│   └── tailwind.config.js
├── data/
│   ├── user-agents.json            # 50+ real user agents
│   ├── viewports.json              # Common viewport sizes
│   └── proxies.json                # Proxy pool config
├── docker/
│   ├── Dockerfile
│   ├── docker-compose.yml
│   └── docker-compose.dev.yml
├── package.json
├── tsconfig.json
├── drizzle.config.ts
├── ecosystem.config.cjs            # PM2 configuration (.cjs: package is "type": "module")
├── .env.example
├── PIANO.md                        # Full implementation plan
└── README.md                       # Setup instructions
```

---

## API Reference

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/trigger` | POST | Trigger scenario (action + data encrypted with AES-256-GCM) |
| `/api/screenshot` | POST | Synchronous screenshot of a URL, returns base64 image (plain JSON body) |
| `/api/tasks/:taskId` | GET | Get task status |
| `/api/scenarios` | GET | List all scenarios with JSON Schema docs (auto-generated) |
| `/health` | GET | Health check |
| `/metrics` | GET | Prometheus metrics |
| `/admin/tasks` | GET | List tasks with pagination/filters |
| `/admin/tasks/:taskId` | GET | Task details with logs |
| `/admin/logs` | GET | Log viewer with filters |
| `/admin/stats` | GET | Aggregated statistics |
| `/admin/tasks/:taskId/cancel` | POST | Cancel pending task |

**Encryption:** AES-256-GCM, key = SHA-256 of `ENCRYPTION_SECRET`, output = `base64(IV[12] + AuthTag[16] + Ciphertext)`. See [README.md](./README.md#encryption-guide-for-api-clients) for examples.

### Authentication (two-tier tokens)

All protected routes check the `x-auth-token` header via `authMiddleware`, which resolves the token with `src/api/middleware/tokenResolver.ts` (timing-safe comparison) and attaches a `TokenContext` (`{ isMaster, name, scenarios }`) to the Fastify request (module augmentation, same pattern as `requestId`).

- **Master token** (`AUTH_TOKEN`): full access. `TokenContext.name` = `master` (reserved name).
- **Scoped tokens** (`SCOPED_TOKENS` env var): JSON array `[{"token","name","scenarios"}]`. Can only trigger their listed scenarios, read only tasks they created (foreign tasks return 404 identical to not-found), and see a filtered `GET /api/scenarios`. The pseudo-scope `"screenshot"` grants `POST /api/screenshot`. `/admin/*` is master-only (`adminAuthMiddleware`, 403 `ADMIN_ONLY`).

**Important:** the trigger `action` is encrypted, so the scope check cannot live in the middleware — it runs in the `POST /api/trigger` handler after decryption (403 `SCENARIO_NOT_ALLOWED`). Task ownership is persisted in `tasks.created_by_token` (token name, `NULL` = master). Startup fails fast on invalid `SCOPED_TOKENS` (malformed JSON, duplicate tokens/names, collision with `AUTH_TOKEN`, reserved name `master`). After pulling this change run `npm run migrate` (or `ALTER TABLE tasks ADD COLUMN created_by_token text;`).

### `POST /api/screenshot` - Synchronous Screenshot

Dedicated endpoint that captures a screenshot of a URL and returns it directly (no task queue, no callback). Authenticated with the same `x-auth-token` header; body is plain JSON (not encrypted).

**Input:**
```json
{
  "url": "https://example.com",
  "fullPage": true,
  "format": "png",
  "quality": 80,
  "viewport": { "width": 1920, "height": 1080 }
}
```

- `url` (required) - Target URL
- `fullPage` (optional, default `true`) - Capture full scrollable page
- `format` (optional, default `png`) - `png` or `jpeg`
- `quality` (optional) - JPEG quality 1-100 (jpeg only)
- `viewport` (optional) - `{ width, height }` viewport size

**Output:**
```json
{
  "success": true,
  "image": "<base64-encoded image>",
  "format": "png",
  "fileSize": 123456,
  "url": "https://example.com",
  "timestamp": "2026-06-10T10:30:00.000Z"
}
```

Uses the full stealth stack (ScraperEngine + cookie consent handling). Errors return 400 (validation), 401 (auth), or 500 (capture failure).

**File:** `src/api/routes/screenshot.ts`

---

## Adding New Scenarios

**To add a specific scenario, create a file in `src/scenarios/implementations/` following the pattern of `test.scenario.ts` and register it in `src/scenarios/index.ts`.** The complete plan with all instructions is saved in `PIANO.md`.

> **⚠️ IMPORTANT:** Every scenario MUST define `inputSchema`, `outputSchema`, and `exampleInput` in its config. This documentation is exposed via `GET /api/scenarios` and auto-updates when scenarios change.

### Step 1: Create Scenario File

```typescript
// src/scenarios/implementations/my-scenario.scenario.ts
import { BaseScenario, ScenarioConfig, ScenarioContext } from '../BaseScenario.js';
import type { ScraperEngine } from '../../scraper/ScraperEngine.js';

interface MyInput {
  url: string;
  credentials?: {
    username: string;
    password: string;
  };
}

interface MyOutput {
  success: boolean;
  extractedData: any;
}

export class MyScenario extends BaseScenario<MyInput, MyOutput> {
  readonly config: ScenarioConfig = {
    action: 'my_scenario',           // Unique action identifier
    name: 'My Scenario',
    description: 'Description of what this scenario does',
    maxConcurrent: 2,
    timeout: 120000,                 // 2 minutes
    retries: 3,
    // REQUIRED: JSON Schema documentation for GET /api/scenarios
    inputSchema: {
      type: 'object',
      required: ['url'],
      properties: {
        url: { type: 'string', format: 'uri', description: 'Target URL' },
        credentials: {
          type: 'object',
          properties: {
            username: { type: 'string' },
            password: { type: 'string' },
          },
        },
      },
    },
    outputSchema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        extractedData: { type: 'string' },
      },
    },
    exampleInput: {
      url: 'https://target-site.com',
      credentials: { username: 'user', password: 'pass' },
    },
  };

  protected async run(
    engine: ScraperEngine,
    input: MyInput,
    context: ScenarioContext
  ): Promise<MyOutput> {
    // Navigate
    await engine.navigate(input.url);
    await engine.delay();

    // Interact (humanized)
    if (input.credentials) {
      await engine.type('#username', input.credentials.username);
      await engine.type('#password', input.credentials.password);
      await engine.click('#login-btn');
      await engine.waitForNavigation();
    }

    // Extract data
    const data = await engine.evaluate(() => {
      return document.querySelector('.data')?.textContent;
    });

    return {
      success: true,
      extractedData: data,
    };
  }

  // Optional: warmup URL for session preparation
  protected getWarmupUrl(input: MyInput): string | undefined {
    return new URL(input.url).origin;
  }
}
```

### Step 2: Register Scenario

```typescript
// src/scenarios/index.ts
import { MyScenario } from './implementations/my-scenario.scenario.js';
scenarioRegistry.register(MyScenario);
```

### Step 3: Trigger via API

```bash
curl -X POST http://localhost:3000/api/trigger \
  -H "Content-Type: application/json" \
  -H "x-auth-token: <token>" \
  -d '{
    "action": "my_scenario",
    "data": {
      "url": "https://target-site.com",
      "credentials": {
        "username": "user",
        "password": "pass"
      }
    }
  }'
```

---

## Available Scenarios

### `vikey` - Vikey Reservation Scraper

Extracts reservation data from Vikey (my.vikey.it) including guest information, billing data, contract status, and guest documents.

**Input:**
```json
{
  "vikeyId": "F5G84USP",
  "credentials": {
    "username": "user@example.com",
    "password": "your-password"
  }
}
```

**Output includes:**
- `telefonoOspite` - Guest phone number
- `numeroOspiti` - Number of guests
- `linguaOspite` - Guest language
- `guestFilledData` - Guest-filled data (nome, cognome, email)
- `billingData` - Billing info (nome, partitaIvaCf, passaporto, paese, codiceUnivocoSid, pec, cap, citta, provincia, indirizzo). `paese` is an **ISO 3166-1 alpha-2** country code (e.g. `IT`, `GB`, `SA`), resolved from the resv API's numeric country code (`invdata_country`) via the static `src/scenarios/implementations/vikey-country-iso.ts` map — NOT DOM-scraped (the DOM renders the country name asynchronously and the scrape raced, returning null). **Fallback:** when no billing country is present (`invdata_country` missing → `paese` would be `null`), it is derived from the **first guest's** identity document — **Residenza** (`residencecountry`) first, then **Cittadinanza** (`citizenship`) — using the per-guest numeric codes in the resv payload's `ndocs` array and the **same** `vikey-country-iso.ts` map (so the encoding stays ISO alpha-2). The numeric code is authoritative; the DOM-scraped guest name is used only to enrich alerts. If the guest's code is **missing from the static map**, `paese` stays `null` **and** a Telegram alert (`sendTelegramMessage()` — its first non-error caller) is sent naming the unmapped code/country and the reservation URL, so the map gap can be closed. `null` if absent or the code is unmapped and there is no usable guest fallback.
- `contractStatus` - Contract status text
- `contractSigned` - Boolean indicating if contract is signed
- `cityTaxStatus` - City tax status
- `guests` - Array of guest documents (the extractor waits for the expected number of cards — derived from the resv API's `ndocs` array — to render before scraping, so it no longer races and returns `[]`):
  - `nome`, `cognome`, `sesso`, `dataNascita`, `luogoNascita`
  - `cittadinanza`, `residenza`, `indirizzoResidenza`
  - `identityDocument` - Nested object with:
    - `tipoDocumento`, `numeroDocumento`
    - `rilasciatoDa`, `dataRilascio`, `dataScadenza`
- `reservationUnavailable` - Boolean. `true` when the reservation no longer exists on Vikey. In that case the scenario returns `success: false` with `error: "Reservation <id> is no longer available"` and **fails fast** instead of running its element waits to timeout. Detection keys off the `/api/v3/resv/resv` **HTTP status** (the reliable signal): a `200` carries the data; a `404` means gone → fast-fail; other statuses (304 revalidation, auth retry, redirects) are transient and ignored. **Do NOT** key off the DOM *"La prenotazione richiesta non è più disponibile."* text — it renders transiently during load even for valid reservations and caused false "not available" results. Previously this case let the waits — including an unbounded "Documenti e Burocrazia" click — run for ~5 min before failing.

**File:** `src/scenarios/implementations/vikey.scenario.ts`

### `airelite-test` - AirElite Properties Scraper

Logs into AirElite dashboard and extracts properties list with owner information.

**Input:**
```json
{
  "username": "user@example.com",
  "password": "your-password"
}
```

**Output:** List of properties with id, name, address, owner, smoobuId, vikeyId, city, province, beds, baths, sqm, status.

**File:** `src/scenarios/implementations/airelite-test.scenario.ts`

### `test` - Test Scenario

Simple test scenario to validate the scraping system.

**Input:**
```json
{
  "url": "https://example.com",
  "message": "Hello from test"
}
```

**Output:** Page title, URL, timestamp, optional message.

**File:** `src/scenarios/implementations/test.scenario.ts`

### `html_to_pdf` - HTML to PDF Generator

Renders self-contained HTML to PDF using Chromium's built-in PDF engine and uploads the result to an S3 presigned URL (Hetzner Object Storage).

**Input:**
```json
{
  "html": "<html><body><h1>Hello</h1></body></html>",
  "uploadUrl": "https://s3.eu-central-003.hetzner.com/bucket/doc.pdf?X-Amz-Algorithm=...",
  "pdfOptions": {
    "format": "A4",
    "orientation": "portrait",
    "margins": { "top": "10mm", "right": "10mm", "bottom": "10mm", "left": "10mm" }
  }
}
```

- `html` (required) - Self-contained HTML string (inline CSS, base64 images)
- `uploadUrl` (required) - S3 presigned PUT URL
- `pdfOptions` (optional) - `format` (A4/Letter/Legal), `orientation` (portrait/landscape), `margins` (CSS units)

**Output:**
- `success` - Boolean
- `fileSize` - PDF size in bytes
- `uploadedTo` - The presigned URL used
- `pageCount` - Number of pages
- `timestamp` - ISO 8601

**Notes:**
- Requires `BROWSER_HEADLESS=true` (Chromium PDF generation only works in headless mode)
- No S3 SDK needed — upload is a simple HTTP PUT to the presigned URL
- Uses `printBackground: true` so CSS background colors/images are included

**File:** `src/scenarios/implementations/html-to-pdf.scenario.ts`

---

## ScraperEngine Methods

| Method | Description |
|--------|-------------|
| `navigate(url)` | Navigate to URL with page load wait |
| `click(selector)` | Human-like click with mouse movement |
| `type(selector, text)` | Type with Gaussian delays |
| `clearAndType(selector, text)` | Clear field then type |
| `fillForm([{selector, value}])` | Fill multiple fields |
| `scroll({distance, direction})` | Gradual scroll |
| `waitFor(selector)` | Wait for element |
| `waitForNavigation()` | Wait for page navigation |
| `getText(selector)` | Extract text content |
| `getAttribute(selector, attr)` | Extract attribute |
| `evaluate(fn)` | Run function in page context |
| `screenshot(path?)` | Take screenshot |
| `delay()` | Random inter-action delay (2-8s) |
| `think()` | Thinking delay (1-4s) |

---

## Telegram Alerts — `sendTelegramMessage()`

Standalone, fire-and-forget helper that posts a **plain-text** message to the configured
Telegram group via the bot. Use it from **any scenario or service** to report errors or
events. Drop it in wherever you want a Telegram notification — it has no dependencies on the
task/queue system.

**File:** `src/services/telegram.ts`

### Signature

```typescript
import { sendTelegramMessage } from '../../services/telegram.js'; // adjust relative path to caller

function sendTelegramMessage(
  text: string,
  options?: { chatId?: string; messageThreadId?: string },
): Promise<boolean>;
```

| Param | Required | Description |
|-------|----------|-------------|
| `text` | yes | Plain-text message body (no `parse_mode`; emoji are fine). |
| `options.chatId` | no | Override the default `TELEGRAM_ALERTS_CHAT_ID`. |
| `options.messageThreadId` | no | Override the default group topic/thread `TELEGRAM_ALERTS_CHAT_MESSAGE_THREAD_ID`. |

### Behavior

- **Default target:** `TELEGRAM_ALERTS_CHAT_ID`, in topic `TELEGRAM_ALERTS_CHAT_MESSAGE_THREAD_ID`.
  Pass `options` only when you need a different chat/thread for a specific call.
- **Never throws** — safe to `await` directly inside `catch` blocks and error paths.
- Returns `true` on success; returns `false` (and logs) if the send fails or if the Telegram
  env vars are not configured (graceful no-op, never blocks the caller).
- **Single attempt** (no retry). It does not persist anything to the DB (unlike `AlertService`).
- Requires `TELEGRAM_BOT_TOKEN` + `TELEGRAM_ALERTS_CHAT_ID` to be set; see Environment Variables.

### Usage examples

```typescript
import { sendTelegramMessage } from '../../services/telegram.js';

// 1. Report an error inside a scenario run() or any service:
try {
  // ...scraping...
} catch (error) {
  await sendTelegramMessage(
    `❌ vikey ${input.vikeyId} failed: ${error instanceof Error ? error.message : String(error)}`
  );
  throw error;
}

// 2. Notify a non-error event:
await sendTelegramMessage(`✅ Reservation ${vikeyId} scraped (${guests.length} guests)`);

// 3. Override the target chat/thread for one call:
await sendTelegramMessage('Custom alert', { chatId: '-1001234567890', messageThreadId: '7' });

// 4. Fire-and-forget without blocking (ignore the result):
void sendTelegramMessage('Heads up: rate-limit nearing');
```

---

## Database Schema

### tasks
Main task tracking table.
- `uuid`, `requestId`, `createdByToken`, `action`, `inputData`, `status`
- `createdByToken`: scoped token name that created the task; `NULL` = master token (or pre-feature rows). Used for ownership checks on `GET /api/tasks/:taskId`.
- `priority`, `resultData`, `errorMessage`
- `attemptCount`, `maxAttempts`, `nextRetryAt`
- `callbackSentAt`, `callbackStatus`
- `createdAt`, `startedAt`, `completedAt`

### logs
Structured logs per task.
- `taskId`, `requestId`, `level`, `message`, `context`, `source`, `timestamp`

### alerts
Sent alerts tracking.
- `taskId`, `alertType`, `title`, `message`, `webhookUrl`, `status`

### scenario_configs
Scenario configurations (optional, for dynamic config).

### browser_sessions
Persistent browser sessions for context reuse.

---

## Callback Payload (Encrypted)

Sent to `CALLBACK_URL` on task completion. **The entire payload is encrypted with AES-256-GCM using `ENCRYPTION_SECRET`.**

**Request Body:**
```json
{
  "data": "BASE64_ENCRYPTED_PAYLOAD"
}
```

**Headers:**
- `x-scraper-secret: <SCRAPER_SECRET>` - Authentication
- `x-task-id: <TASK_UUID>` - Unique task identifier (primary)
- `x-request-id: <REQUEST_ID>` - Original request correlation ID

**Decrypted payload structure:**
```json
{
  "taskId": "uuid",
  "requestId": "req-xxx",
  "action": "scenario_name",
  "status": "completed | failed",
  "inputData": { "...original input..." },
  "resultData": { "...extracted data..." },
  "error": { "message": "...", "code": "..." } | null,
  "executionMs": 12345,
  "timestamp": "2025-02-28T10:30:00Z"
}
```

To decrypt, use the same `ENCRYPTION_SECRET` shared between client and server. See [README.md](./README.md#decrypting-callback-payload) for decryption examples.

---

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | 3000 |
| `NODE_ENV` | Environment | development |
| `AUTH_TOKEN` | Master API token (full access) | required |
| `SCOPED_TOKENS` | JSON array of scenario-scoped tokens | `[]` |
| `SCRAPER_SECRET` | Callback authentication | required |
| `ENCRYPTION_SECRET` | AES-256-GCM encryption key | required |
| `DATABASE_PATH` | SQLite file path | ./data/scraper.db |
| `CALLBACK_URL` | Callback endpoint URL | required |
| `ALERT_WEBHOOK_URL` | Alert webhook URL | required |
| `BROWSER_HEADLESS` | Run headless | true |
| `BROWSER_POOL_SIZE` | Max concurrent browsers | 3 |
| `MAX_CONCURRENT_TASKS` | Max parallel tasks | 5 |
| `TASK_TIMEOUT_MS` | Task timeout | 300000 |
| `LOG_LEVEL` | Pino log level | info |
| `PROXY_ENABLED` | Enable proxy rotation | false |
| `TELEGRAM_BOT_TOKEN` | Telegram bot token for alerts (see `sendTelegramMessage`) | optional |
| `TELEGRAM_ALERTS_CHAT_ID` | Telegram chat/group id alerts are sent to | optional |
| `TELEGRAM_ALERTS_CHAT_MESSAGE_THREAD_ID` | Topic/thread id inside the alerts group | optional |

---

## Anti-Detection Features

| Feature | Implementation |
|---------|----------------|
| Stealth Plugin | playwright-extra + puppeteer-extra-plugin-stealth |
| User-Agent | 50+ real UAs, session rotation |
| Viewport | Realistic sizes (1920x1080, 1366x768, etc.) |
| Locale | it-IT, Europe/Rome timezone |
| Mouse | Bezier curve movements |
| Typing | Gaussian delay distribution (50-150ms) |
| Scrolling | Gradual with acceleration/deceleration |
| Delays | Random 2-8s between actions |
| Consent | Auto-detect iubenda, cookiebot, OneTrust |
| Fingerprint | WebGL/Canvas noise injection |

---

## Development Commands

```bash
# Development
npm run dev              # Start with hot reload
npm run build            # Build TypeScript
npm run start            # Run built version

# Database
npm run migrate          # Push schema changes

# Dashboard
cd dashboard
npm run dev              # Dev server on :3001
npm run build            # Production build

# Testing
npm run test             # Run tests
npm run typecheck        # Type checking
npm run lint             # ESLint

# Deploy (to production VPS — see "Deploying updates" below)
npm run deploy                 # Build + reload backend on the server (current main)
npm run deploy -- --migrate    # Also run DB migrations
npm run deploy -- --dashboard  # Also rebuild the dashboard
```

### Deploying updates

`npm run deploy` ([scripts/deploy.sh](scripts/deploy.sh)) ships the current `main` to the production
server in one command:

1. **Preflight (local):** aborts unless the working tree is clean and `HEAD == origin/main` — so commit
   and push before deploying.
2. **Remote:** SSHes in, `git reset --hard origin/main`, then runs [scripts/remote-deploy.sh](scripts/remote-deploy.sh)
   (`npm ci` → `npm run build` → `pm2 startOrReload ecosystem.config.cjs` → `/health` check). The reload
   is graceful/zero-downtime (cluster mode + `wait_ready`).
3. **Verify (local):** [scripts/verify-deploy.sh](scripts/verify-deploy.sh) confirms the public
   `/health` `gitCommit` matches local `HEAD`.

- SSH target defaults to `root@77.42.80.187`; override with `DEPLOY_HOST=user@host npm run deploy`.
- Migrations and dashboard rebuilds are **opt-in** (`--migrate`, `--dashboard`).
- `.env` on the server is never touched (gitignored; `git clean` is not run).
- PM2 config lives in `ecosystem.config.cjs` (`.cjs` because the package is `"type": "module"`).
- If Playwright is upgraded, run `npx playwright install chromium` once on the server (`npm ci` does
  not refresh the browser cache).

---

## File Naming Conventions

- Scenarios: `kebab-case.scenario.ts` (e.g., `login-portal.scenario.ts`)
- Components: `PascalCase.tsx`
- Utilities: `camelCase.ts`
- Types: `*.types.ts`
- Tests: `*.test.ts`

---

## Troubleshooting

### Browser fails to launch
```bash
npx playwright install chromium --with-deps
```

### Database locked error
Ensure only one instance is running or check for zombie processes.

### Task stuck in "running"
Check logs, browser might have crashed. Restart service.

### Callback not received
Verify `CALLBACK_URL` is reachable and `SCRAPER_SECRET` matches.

---

## Production Deployment

Server IP, domain, directory, DNS, and Caddy config are documented in [README.md → Production Deployment Info](./README.md#production-deployment-info).

---

## References

- [PIANO.md](./PIANO.md) - Full implementation plan with detailed specifications
- [README.md](./README.md) - Setup, deployment, and production server details
- [Playwright Docs](https://playwright.dev/docs/intro)
- [Drizzle ORM](https://orm.drizzle.team/docs/overview)
- [Fastify](https://fastify.dev/docs/latest/)
