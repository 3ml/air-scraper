import { z } from 'zod';
import { config } from 'dotenv';

config();

const scopedTokenSchema = z.object({
  token: z.string().min(16, 'Scoped token must be at least 16 characters'),
  name: z.string().min(1),
  scenarios: z.array(z.string().min(1)).min(1),
});

export type ScopedToken = z.infer<typeof scopedTokenSchema>;

const envSchema = z.object({
  // Server
  PORT: z.string().default('3000').transform(Number),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  HOST: z.string().default('0.0.0.0'),

  // Authentication
  AUTH_TOKEN: z.string().min(1),
  SCRAPER_SECRET: z.string().min(1),
  // Scoped tokens: JSON array of tokens limited to specific scenarios.
  // The pseudo-scope "screenshot" grants access to POST /api/screenshot.
  SCOPED_TOKENS: z
    .string()
    .default('[]')
    .transform((v, ctx) => {
      try {
        return JSON.parse(v) as unknown;
      } catch {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'SCOPED_TOKENS must be valid JSON' });
        return z.NEVER;
      }
    })
    .pipe(z.array(scopedTokenSchema)),

  // Encryption (AES-256-GCM)
  ENCRYPTION_SECRET: z.string().min(16),

  // Database
  DATABASE_PATH: z.string().default('./data/scraper.db'),

  // Callback endpoints
  CALLBACK_URL: z.string().url(),
  ALERT_WEBHOOK_URL: z.string().url(),

  // Proxy configuration
  PROXY_ENABLED: z.string().default('false').transform((v) => v === 'true'),
  PROXY_POOL_CONFIG: z.string().default('./data/proxies.json'),

  // Browser settings
  BROWSER_HEADLESS: z.string().default('true').transform((v) => v === 'true'),
  BROWSER_POOL_SIZE: z.string().default('3').transform(Number),
  CONTEXT_STORAGE_PATH: z.string().default('./data/contexts'),

  // Performance
  MAX_CONCURRENT_TASKS: z.string().default('5').transform(Number),
  TASK_TIMEOUT_MS: z.string().default('300000').transform(Number),

  // Logging
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
  LOG_FILE: z.string().optional(),

  // Telegram alerts (optional). When unset, sendTelegramMessage() no-ops with a warning.
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  TELEGRAM_ALERTS_CHAT_ID: z.string().optional(),
  TELEGRAM_ALERTS_CHAT_MESSAGE_THREAD_ID: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:');
  console.error(parsed.error.format());
  process.exit(1);
}

// Integrity checks for scoped tokens (fail fast, same as schema validation above)
{
  const scopedTokens = parsed.data.SCOPED_TOKENS;
  const errors: string[] = [];

  const tokenValues = scopedTokens.map((t) => t.token);
  if (new Set(tokenValues).size !== tokenValues.length) {
    errors.push('SCOPED_TOKENS contains duplicate token values');
  }

  const names = scopedTokens.map((t) => t.name);
  if (new Set(names).size !== names.length) {
    errors.push('SCOPED_TOKENS contains duplicate names');
  }

  if (names.includes('master')) {
    errors.push("SCOPED_TOKENS cannot use the reserved name 'master'");
  }

  if (tokenValues.includes(parsed.data.AUTH_TOKEN)) {
    errors.push('SCOPED_TOKENS cannot contain a token equal to AUTH_TOKEN');
  }

  if (errors.length > 0) {
    console.error('Invalid environment variables:');
    errors.forEach((e) => console.error(`- ${e}`));
    process.exit(1);
  }
}

export const env = parsed.data;

export type Env = z.infer<typeof envSchema>;
