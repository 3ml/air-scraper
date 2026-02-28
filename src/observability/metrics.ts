import { db } from '../db/client.js';
import { tasks } from '../db/schema.js';
import { eq, sql } from 'drizzle-orm';

interface Metrics {
  tasksPending: number;
  tasksRunning: number;
  tasksCompleted: number;
  tasksFailed: number;
  tasksTotal: number;
  avgDurationMs: number | null;
}

// In-memory counters for request metrics
const requestCounters = {
  total: 0,
  success: 0,
  errors: 0,
};

const actionCounters = new Map<string, { total: number; success: number; failed: number }>();

export function incrementRequestCounter(success: boolean): void {
  requestCounters.total++;
  if (success) {
    requestCounters.success++;
  } else {
    requestCounters.errors++;
  }
}

export function incrementActionCounter(action: string, success: boolean): void {
  const current = actionCounters.get(action) || { total: 0, success: 0, failed: 0 };
  current.total++;
  if (success) {
    current.success++;
  } else {
    current.failed++;
  }
  actionCounters.set(action, current);
}

export async function getMetrics(): Promise<Metrics> {
  const pending = await db
    .select({ count: sql<number>`count(*)` })
    .from(tasks)
    .where(eq(tasks.status, 'pending'));

  const running = await db
    .select({ count: sql<number>`count(*)` })
    .from(tasks)
    .where(eq(tasks.status, 'running'));

  const completed = await db
    .select({ count: sql<number>`count(*)` })
    .from(tasks)
    .where(eq(tasks.status, 'completed'));

  const failed = await db
    .select({ count: sql<number>`count(*)` })
    .from(tasks)
    .where(eq(tasks.status, 'failed'));

  const total = await db.select({ count: sql<number>`count(*)` }).from(tasks);

  // Calculate average duration for completed tasks
  const avgResult = await db
    .select({
      avg: sql<number>`avg(
        (julianday(completed_at) - julianday(started_at)) * 86400000
      )`,
    })
    .from(tasks)
    .where(eq(tasks.status, 'completed'));

  return {
    tasksPending: pending[0]?.count || 0,
    tasksRunning: running[0]?.count || 0,
    tasksCompleted: completed[0]?.count || 0,
    tasksFailed: failed[0]?.count || 0,
    tasksTotal: total[0]?.count || 0,
    avgDurationMs: avgResult[0]?.avg ? Math.round(avgResult[0].avg) : null,
  };
}

export function formatPrometheusMetrics(metrics: Metrics): string {
  const lines: string[] = [
    '# HELP scraper_tasks_total Total number of scraping tasks',
    '# TYPE scraper_tasks_total counter',
    `scraper_tasks_total ${metrics.tasksTotal}`,
    '',
    '# HELP scraper_tasks_pending Number of pending tasks',
    '# TYPE scraper_tasks_pending gauge',
    `scraper_tasks_pending ${metrics.tasksPending}`,
    '',
    '# HELP scraper_tasks_running Number of running tasks',
    '# TYPE scraper_tasks_running gauge',
    `scraper_tasks_running ${metrics.tasksRunning}`,
    '',
    '# HELP scraper_tasks_completed Total completed tasks',
    '# TYPE scraper_tasks_completed counter',
    `scraper_tasks_completed ${metrics.tasksCompleted}`,
    '',
    '# HELP scraper_tasks_failed Total failed tasks',
    '# TYPE scraper_tasks_failed counter',
    `scraper_tasks_failed ${metrics.tasksFailed}`,
    '',
    '# HELP scraper_requests_total Total HTTP requests received',
    '# TYPE scraper_requests_total counter',
    `scraper_requests_total ${requestCounters.total}`,
    '',
    '# HELP scraper_requests_success Successful HTTP requests',
    '# TYPE scraper_requests_success counter',
    `scraper_requests_success ${requestCounters.success}`,
    '',
    '# HELP scraper_requests_errors Failed HTTP requests',
    '# TYPE scraper_requests_errors counter',
    `scraper_requests_errors ${requestCounters.errors}`,
  ];

  if (metrics.avgDurationMs !== null) {
    lines.push(
      '',
      '# HELP scraper_task_duration_avg_ms Average task duration in milliseconds',
      '# TYPE scraper_task_duration_avg_ms gauge',
      `scraper_task_duration_avg_ms ${metrics.avgDurationMs}`
    );
  }

  // Add per-action metrics
  if (actionCounters.size > 0) {
    lines.push(
      '',
      '# HELP scraper_action_total Tasks per action',
      '# TYPE scraper_action_total counter'
    );
    for (const [action, counts] of actionCounters) {
      lines.push(`scraper_action_total{action="${action}",status="success"} ${counts.success}`);
      lines.push(`scraper_action_total{action="${action}",status="failed"} ${counts.failed}`);
    }
  }

  return lines.join('\n');
}
