# Air Scraper - Piano di Implementazione

## Overview
Microservizio Node.js standalone per web scraping stealth con Playwright, trigger via API HTTP, database SQLite, e pannello admin.

---

## Stack Tecnologico

| Componente | Tecnologia |
|------------|------------|
| Runtime | Node.js 20+ (ESM) |
| Framework API | Fastify 5 |
| Scraping | Playwright + playwright-extra + stealth plugin |
| Database | SQLite + Drizzle ORM |
| Logging | Pino (JSON structured) |
| Dashboard | Vite + React + Tailwind + DaisyUI |
| Deploy | VPS Linux + PM2 + Caddy |

---

## Quick Start (Sviluppo Locale)

```bash
# 1. Installa dipendenze
npm install
cd dashboard && npm install && cd ..

# 2. Installa browser Playwright
npx playwright install chromium

# 3. Crea file .env
cp .env.example .env

# 4. Avvia server di sviluppo
npm run dev

# 5. In un altro terminale, avvia dashboard
cd dashboard && npm run dev
```

Server API: http://localhost:3000
Dashboard: http://localhost:3001

---

## API Endpoints

### POST /api/trigger
```bash
curl -X POST http://localhost:3000/api/trigger \
  -H "Content-Type: application/json" \
  -H "x-auth-token: dev-token-change-in-production" \
  -d '{"action": "test", "data": {"url": "https://example.com"}}'
```

Response:
```json
{
  "taskId": "uuid",
  "status": "pending",
  "message": "Task queued for action: test"
}
```

### GET /health
```json
{
  "status": "ok",
  "uptime": 3600,
  "version": "1.0.0",
  "checks": {
    "database": true,
    "browserPool": 3,
    "pendingTasks": 5,
    "runningTasks": 2
  }
}
```

### GET /metrics
Formato Prometheus per monitoring.

### Admin API
- `GET /admin/tasks` - Lista task con filtri
- `GET /admin/tasks/:id` - Dettaglio task con log
- `GET /admin/logs` - Log con filtri e paginazione
- `GET /admin/stats` - Statistiche aggregate
- `POST /admin/tasks/:id/cancel` - Cancella task pendente

---

## Creare un Nuovo Scenario

1. Crea file in `src/scenarios/implementations/`:

```typescript
// src/scenarios/implementations/mio-scenario.scenario.ts
import { BaseScenario, ScenarioConfig, ScenarioContext } from '../BaseScenario.js';
import type { ScraperEngine } from '../../scraper/ScraperEngine.js';

interface MioInput {
  url: string;
  username: string;
  password: string;
}

interface MioOutput {
  success: boolean;
  data: any;
}

export class MioScenario extends BaseScenario<MioInput, MioOutput> {
  readonly config: ScenarioConfig = {
    action: 'mio_scenario',
    name: 'Il Mio Scenario',
    description: 'Descrizione dello scenario',
    maxConcurrent: 2,
    timeout: 120000,
    retries: 3,
  };

  protected async run(
    engine: ScraperEngine,
    input: MioInput,
    context: ScenarioContext
  ): Promise<MioOutput> {
    // 1. Naviga alla URL
    await engine.navigate(input.url);
    await engine.delay();

    // 2. Compila form login
    await engine.type('#username', input.username);
    await engine.type('#password', input.password);
    await engine.click('#login-button');

    // 3. Attendi caricamento
    await engine.waitForNavigation();

    // 4. Estrai dati
    const data = await engine.evaluate(() => {
      // Logica di estrazione
      return document.querySelector('.data')?.textContent;
    });

    return {
      success: true,
      data,
    };
  }

  protected getWarmupUrl(input: MioInput): string {
    return new URL(input.url).origin;
  }
}
```

2. Registra in `src/scenarios/index.ts`:

```typescript
import { MioScenario } from './implementations/mio-scenario.scenario.js';
scenarioRegistry.register(MioScenario);
```

3. Trigger via API:

```bash
curl -X POST http://localhost:3000/api/trigger \
  -H "Content-Type: application/json" \
  -H "x-auth-token: <token>" \
  -d '{
    "action": "mio_scenario",
    "data": {
      "url": "https://example.com/login",
      "username": "user",
      "password": "pass"
    }
  }'
```

---

## Callback di Fine Elaborazione

Al termine di ogni task (successo o fallimento), viene inviato un POST criptato a `CALLBACK_URL`:

**Request Body (criptato con AES-256-GCM):**
```json
{
  "data": "BASE64_ENCRYPTED_PAYLOAD"
}
```

**Headers:**
- `x-scraper-secret: <SCRAPER_SECRET>`
- `x-request-id: <REQUEST_ID>`

**Payload decriptato:**
```json
{
  "taskId": "uuid",
  "requestId": "req-xxx",
  "action": "scenario_name",
  "status": "completed | failed",
  "inputData": { "...dati originali..." },
  "resultData": { "...dati estratti..." },
  "error": { "message": "..." } | null,
  "executionMs": 12345,
  "timestamp": "2025-02-28T10:30:00Z"
}
```

Per decriptare usare `ENCRYPTION_SECRET` condiviso. Vedi README.md per esempi.

---

## Configurazione Proxy

Modifica `data/proxies.json`:

```json
{
  "proxies": [
    {
      "host": "proxy1.example.com",
      "port": 8080,
      "username": "user",
      "password": "pass",
      "protocol": "http"
    }
  ],
  "config": {
    "rotationStrategy": "least-used",
    "maxFailures": 3
  }
}
```

---

## Deploy Produzione

### Con Docker

```bash
cd docker
docker-compose up -d
```

### Su VPS con PM2

```bash
# Build
npm run build
cd dashboard && npm run build && cd ..

# Start
pm2 start ecosystem.config.js --env production

# Caddy reverse proxy
# /etc/caddy/Caddyfile
scraper.tuodominio.com {
    reverse_proxy localhost:3000
}

admin.tuodominio.com {
    root * /opt/air-scraper/dashboard/dist
    file_server
    try_files {path} /index.html
}
```

---

## Environment Variables

```bash
# Server
PORT=3000
NODE_ENV=production

# Auth
AUTH_TOKEN=<64-char-token>           # Token per API trigger
SCRAPER_SECRET=<secret>               # Secret per callback

# Database
DATABASE_PATH=/var/lib/air-scraper/data.db

# Endpoints esterni
CALLBACK_URL=https://app.airelite.it/api/scraper/callback
ALERT_WEBHOOK_URL=https://app.airelite.it/api/scraper/alert

# Browser
BROWSER_HEADLESS=true
BROWSER_POOL_SIZE=3

# Performance
MAX_CONCURRENT_TASKS=5
TASK_TIMEOUT_MS=300000
```

---

## Struttura File Implementati

```
air-scraper/
├── src/
│   ├── index.ts                    # Entry point
│   ├── config/env.ts               # Validazione env con Zod
│   ├── api/
│   │   ├── server.ts               # Fastify setup
│   │   ├── routes/
│   │   │   ├── trigger.ts          # POST /api/trigger
│   │   │   ├── health.ts           # GET /health
│   │   │   ├── metrics.ts          # GET /metrics
│   │   │   └── admin.ts            # Admin API
│   │   └── middleware/
│   │       ├── auth.ts             # Token auth
│   │       └── requestId.ts        # Correlation ID
│   ├── db/
│   │   ├── schema.ts               # Drizzle ORM schema
│   │   └── client.ts               # SQLite connection
│   ├── scraper/
│   │   ├── ScraperEngine.ts        # Orchestrazione principale
│   │   ├── browser/
│   │   │   ├── BrowserManager.ts   # Pool browser
│   │   │   └── StealthConfig.ts    # Stealth setup
│   │   ├── humanizer/
│   │   │   ├── MouseSimulator.ts   # Curve Bezier
│   │   │   ├── TypingSimulator.ts  # Gaussian delays
│   │   │   ├── ScrollSimulator.ts  # Scroll naturale
│   │   │   └── DelayManager.ts     # Random delays
│   │   ├── evasion/
│   │   │   ├── UserAgentRotator.ts # 50+ UA
│   │   │   └── ViewportManager.ts  # Risoluzioni reali
│   │   └── consent/
│   │       └── CookieConsentHandler.ts
│   ├── scenarios/
│   │   ├── BaseScenario.ts         # Classe astratta
│   │   ├── registry.ts             # Registrazione scenari
│   │   └── implementations/
│   │       └── test.scenario.ts    # Scenario di test
│   ├── queue/
│   │   ├── TaskQueue.ts            # Coda priorità
│   │   └── TaskWorker.ts           # Worker processing
│   ├── services/
│   │   ├── CallbackService.ts      # POST risultati
│   │   └── AlertService.ts         # Alert errori
│   └── observability/
│       ├── logger.ts               # Pino JSON
│       └── metrics.ts              # Prometheus
├── dashboard/                       # React + Vite + DaisyUI
│   └── src/pages/
│       ├── Dashboard.tsx
│       ├── Tasks.tsx
│       └── Logs.tsx
├── data/
│   ├── user-agents.json            # 50+ UA reali
│   ├── viewports.json              # Risoluzioni comuni
│   └── proxies.json                # Config proxy
├── docker/
│   ├── Dockerfile
│   └── docker-compose.yml
├── package.json
├── tsconfig.json
├── drizzle.config.ts
└── ecosystem.config.js             # PM2
```

---

## Features Implementate

- [x] API trigger con autenticazione token
- [x] Task queue con priorità
- [x] Worker con retry automatico (exponential backoff)
- [x] Browser pool con Playwright stealth
- [x] Simulazione comportamento umano (mouse Bezier, typing gaussiano)
- [x] Rotazione User-Agent (50+ UA reali)
- [x] Viewport realistici
- [x] Cookie consent handling automatico
- [x] Callback a endpoint esterno
- [x] Alert su errori
- [x] Logging JSON strutturato (Pino)
- [x] Metriche Prometheus
- [x] Dashboard admin React
- [x] Docker support
- [x] PM2 config per produzione
