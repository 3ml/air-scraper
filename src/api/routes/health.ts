import { FastifyInstance } from 'fastify';
import { db } from '../../db/client.js';
import { tasks } from '../../db/schema.js';
import { eq, sql } from 'drizzle-orm';
import type { HealthResponse } from '../../types/api.types.js';
import buildInfo from '../../build-info.json' with { type: 'json' };

const startTime = Date.now();

export async function healthRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get('/health', async (_request, reply) => {
    try {
      // Check database connectivity
      const dbCheck = await db
        .select({ count: sql<number>`1` })
        .from(tasks)
        .limit(1)
        .then(() => true)
        .catch(() => false);

      // Get task counts
      const [pendingResult, runningResult] = await Promise.all([
        db.select({ count: sql<number>`count(*)` }).from(tasks).where(eq(tasks.status, 'pending')),
        db.select({ count: sql<number>`count(*)` }).from(tasks).where(eq(tasks.status, 'running')),
      ]);

      const pendingTasks = pendingResult[0]?.count || 0;
      const runningTasks = runningResult[0]?.count || 0;

      const response: HealthResponse = {
        status: dbCheck ? 'ok' : 'degraded',
        timestamp: new Date().toISOString(),
        uptime: Math.floor((Date.now() - startTime) / 1000),
        version: '1.0.0',
        gitCommit: buildInfo.gitCommit,
        gitBranch: buildInfo.gitBranch,
        buildTime: buildInfo.buildTime,
        checks: {
          database: dbCheck,
          browserPool: 0, // Will be updated when BrowserManager is implemented
          pendingTasks,
          runningTasks,
        },
      };

      const statusCode = response.status === 'ok' ? 200 : 503;
      reply.code(statusCode).send(response);
    } catch (error) {
      reply.code(503).send({
        status: 'error',
        timestamp: new Date().toISOString(),
        uptime: Math.floor((Date.now() - startTime) / 1000),
        version: '1.0.0',
        gitCommit: buildInfo.gitCommit,
        gitBranch: buildInfo.gitBranch,
        buildTime: buildInfo.buildTime,
        checks: {
          database: false,
          browserPool: 0,
          pendingTasks: 0,
          runningTasks: 0,
        },
      });
    }
  });
}
