import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// Tasks table - main scraping tasks
export const tasks = sqliteTable('tasks', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  uuid: text('uuid').notNull().unique(),
  requestId: text('request_id').notNull(),

  // Scenario and input
  action: text('action').notNull(),
  inputData: text('input_data').notNull(), // JSON

  // Execution status
  status: text('status', {
    enum: ['pending', 'running', 'completed', 'failed', 'cancelled'],
  }).notNull().default('pending'),
  priority: integer('priority').notNull().default(5),

  // Results
  resultData: text('result_data'), // JSON
  errorMessage: text('error_message'),
  errorStack: text('error_stack'),

  // Retry logic
  attemptCount: integer('attempt_count').notNull().default(0),
  maxAttempts: integer('max_attempts').notNull().default(3),
  nextRetryAt: text('next_retry_at'),

  // Callback
  callbackUrl: text('callback_url'),
  callbackSentAt: text('callback_sent_at'),
  callbackStatus: text('callback_status', {
    enum: ['pending', 'sent', 'failed'],
  }),

  // Timestamps
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  startedAt: text('started_at'),
  completedAt: text('completed_at'),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
});

// Logs table - structured logs for each operation
export const logs = sqliteTable('logs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  taskId: integer('task_id').references(() => tasks.id, { onDelete: 'cascade' }),
  requestId: text('request_id').notNull(),

  // Log content
  level: text('level', {
    enum: ['trace', 'debug', 'info', 'warn', 'error', 'fatal'],
  }).notNull(),
  message: text('message').notNull(),
  context: text('context'), // JSON metadata
  source: text('source').notNull(),

  // Timestamp
  timestamp: text('timestamp').notNull().default(sql`(datetime('now'))`),
});

// Scenario configurations
export const scenarioConfigs = sqliteTable('scenario_configs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  action: text('action').notNull().unique(),
  name: text('name').notNull(),
  description: text('description'),

  // Configuration
  config: text('config').notNull(), // JSON
  isEnabled: integer('is_enabled', { mode: 'boolean' }).notNull().default(true),

  // Rate limiting
  maxConcurrent: integer('max_concurrent').notNull().default(2),
  cooldownSeconds: integer('cooldown_seconds').notNull().default(60),

  // Timestamps
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
});

// Alerts sent
export const alerts = sqliteTable('alerts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  taskId: integer('task_id').references(() => tasks.id, { onDelete: 'set null' }),

  // Content
  alertType: text('alert_type', {
    enum: ['error', 'warning', 'info'],
  }).notNull(),
  title: text('title').notNull(),
  message: text('message').notNull(),
  context: text('context'), // JSON

  // Sending
  webhookUrl: text('webhook_url').notNull(),
  httpStatus: integer('http_status'),
  responseBody: text('response_body'),
  sentAt: text('sent_at'),

  // Status
  status: text('status', {
    enum: ['pending', 'sent', 'failed'],
  }).notNull().default('pending'),
  retryCount: integer('retry_count').notNull().default(0),

  // Timestamp
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
});

// Browser sessions for persistent contexts
export const browserSessions = sqliteTable('browser_sessions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  sessionId: text('session_id').notNull().unique(),

  // Configuration
  userAgent: text('user_agent').notNull(),
  viewportWidth: integer('viewport_width').notNull(),
  viewportHeight: integer('viewport_height').notNull(),
  locale: text('locale').notNull().default('it-IT'),
  timezone: text('timezone').notNull().default('Europe/Rome'),

  // Storage path
  storagePath: text('storage_path'),

  // State
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(false),
  lastUsedAt: text('last_used_at'),

  // Timestamps
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  expiresAt: text('expires_at'),
});

// Metrics snapshots for Prometheus
export const metricsSnapshots = sqliteTable('metrics_snapshots', {
  id: integer('id').primaryKey({ autoIncrement: true }),

  // Counters
  tasksTotal: integer('tasks_total').notNull().default(0),
  tasksPending: integer('tasks_pending').notNull().default(0),
  tasksRunning: integer('tasks_running').notNull().default(0),
  tasksCompleted: integer('tasks_completed').notNull().default(0),
  tasksFailed: integer('tasks_failed').notNull().default(0),

  // Performance
  avgDurationMs: integer('avg_duration_ms'),
  p95DurationMs: integer('p95_duration_ms'),

  // Timestamp
  capturedAt: text('captured_at').notNull().default(sql`(datetime('now'))`),
});

// Type exports
export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;
export type Log = typeof logs.$inferSelect;
export type NewLog = typeof logs.$inferInsert;
export type ScenarioConfig = typeof scenarioConfigs.$inferSelect;
export type Alert = typeof alerts.$inferSelect;
export type BrowserSession = typeof browserSessions.$inferSelect;
