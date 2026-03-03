import { z } from 'zod';

// Encrypted trigger request schema (action and data are encrypted)
export const encryptedTriggerRequestSchema = z.object({
  action: z.string().min(1), // Encrypted base64 string
  data: z.string().min(1),   // Encrypted base64 string (JSON object)
  priority: z.number().int().min(1).max(10).optional(),
  callbackUrl: z.string().url().optional(),
});

export type EncryptedTriggerRequest = z.infer<typeof encryptedTriggerRequestSchema>;

// Decrypted trigger request schema (after decryption)
export const triggerRequestSchema = z.object({
  action: z.string().min(1).max(100),
  data: z.record(z.unknown()).default({}),
  priority: z.number().int().min(1).max(10).optional(),
  callbackUrl: z.string().url().optional(),
});

export type TriggerRequest = z.infer<typeof triggerRequestSchema>;

// Trigger response
export interface TriggerResponse {
  taskId: string;
  status: 'pending';
  message: string;
}

// Health response
export interface HealthResponse {
  status: 'ok' | 'degraded' | 'error';
  timestamp: string;
  uptime: number;
  version: string;
  checks: {
    database: boolean;
    browserPool: number;
    pendingTasks: number;
    runningTasks: number;
  };
}

// Task status response
export interface TaskStatusResponse {
  taskId: string;
  requestId: string;
  action: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  inputData: Record<string, unknown>;
  resultData: Record<string, unknown> | null;
  error: {
    message: string;
    stack?: string;
  } | null;
  attemptCount: number;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

// Callback payload sent to external endpoint
export interface CallbackPayload {
  taskId: string;
  requestId: string;
  action: string;
  status: 'completed' | 'failed';
  inputData: Record<string, unknown>;
  resultData: Record<string, unknown> | null;
  error: {
    message: string;
    code?: string;
  } | null;
  executionMs: number;
  timestamp: string;
}

// Alert payload
export interface AlertPayload {
  type: 'error' | 'warning' | 'info';
  taskId?: string;
  action?: string;
  title: string;
  message: string;
  context?: Record<string, unknown>;
  timestamp: string;
}

// Admin list query params
export const adminListQuerySchema = z.object({
  page: z.string().transform(Number).default('1'),
  limit: z.string().transform(Number).default('20'),
  status: z.enum(['pending', 'running', 'completed', 'failed', 'cancelled']).optional(),
  action: z.string().optional(),
  from: z.string().optional(), // ISO date
  to: z.string().optional(), // ISO date
});

export type AdminListQuery = z.infer<typeof adminListQuerySchema>;

// Admin stats response
export interface AdminStatsResponse {
  tasks: {
    total: number;
    pending: number;
    running: number;
    completed: number;
    failed: number;
  };
  performance: {
    avgDurationMs: number | null;
    successRate: number;
  };
  recent: {
    last24h: number;
    lastHour: number;
  };
}

// Scenario documentation for GET /api/scenarios
export interface ScenarioDocumentation {
  action: string;
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  exampleInput?: Record<string, unknown>;
  limits: {
    maxConcurrent?: number;
    cooldownSeconds?: number;
    timeout?: number;
    retries?: number;
  };
}

export interface ScenariosResponse {
  scenarios: ScenarioDocumentation[];
  count: number;
}

// Encrypted callback wrapper sent to external endpoint
export interface EncryptedCallbackPayload {
  data: string; // Base64 encrypted JSON containing CallbackPayload
}
