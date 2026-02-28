import { z } from 'zod';
import { config } from 'dotenv';

config();

const envSchema = z.object({
  // Server
  PORT: z.string().default('3000').transform(Number),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  HOST: z.string().default('0.0.0.0'),

  // Authentication
  AUTH_TOKEN: z.string().min(1),
  SCRAPER_SECRET: z.string().min(1),

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
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:');
  console.error(parsed.error.format());
  process.exit(1);
}

export const env = parsed.data;

export type Env = z.infer<typeof envSchema>;
