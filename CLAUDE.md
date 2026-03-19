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
│   │   │   ├── scenarios.ts        # GET /api/scenarios
│   │   │   ├── health.ts           # GET /health
│   │   │   ├── metrics.ts          # GET /metrics (Prometheus)
│   │   │   └── admin.ts            # Admin API endpoints
│   │   └── middleware/
│   │       ├── auth.ts             # Token authentication
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
├── ecosystem.config.js             # PM2 configuration
├── .env.example
├── PIANO.md                        # Full implementation plan
└── README.md                       # Setup instructions
```

---

## API Reference

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/trigger` | POST | Trigger scenario (action + data encrypted with AES-256-GCM) |
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
- `billingData` - Billing info (nome, partitaIvaCf, passaporto, paese, codiceUnivocoSid, pec, cap, citta, provincia, indirizzo)
- `contractStatus` - Contract status text
- `contractSigned` - Boolean indicating if contract is signed
- `cityTaxStatus` - City tax status
- `guests` - Array of guest documents with:
  - `nome`, `cognome`, `sesso`, `dataNascita`, `luogoNascita`
  - `cittadinanza`, `residenza`, `indirizzoResidenza`
  - `identityDocument` - Nested object with:
    - `tipoDocumento`, `numeroDocumento`
    - `rilasciatoDa`, `dataRilascio`, `dataScadenza`

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

## Database Schema

### tasks
Main task tracking table.
- `uuid`, `requestId`, `action`, `inputData`, `status`
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
| `AUTH_TOKEN` | API authentication token | required |
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
```

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
