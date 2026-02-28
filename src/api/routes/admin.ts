import { FastifyInstance } from 'fastify';
import { db } from '../../db/client.js';
import { tasks, logs } from '../../db/schema.js';
import { eq, desc, sql, and, gte, lte } from 'drizzle-orm';
import { adminAuthMiddleware } from '../middleware/auth.js';
import { adminListQuerySchema } from '../../types/api.types.js';

export async function adminRoutes(fastify: FastifyInstance): Promise<void> {
  // List tasks with pagination and filters
  fastify.get(
    '/admin/tasks',
    {
      preHandler: adminAuthMiddleware,
    },
    async (request, reply) => {
      try {
        const query = adminListQuerySchema.parse(request.query);
        const { page, limit, status, action, from, to } = query;
        const offset = (page - 1) * limit;

        // Build conditions
        const conditions = [];
        if (status) conditions.push(eq(tasks.status, status));
        if (action) conditions.push(eq(tasks.action, action));
        if (from) conditions.push(gte(tasks.createdAt, from));
        if (to) conditions.push(lte(tasks.createdAt, to));

        const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

        // Get tasks with pagination
        const [taskList, countResult] = await Promise.all([
          db
            .select()
            .from(tasks)
            .where(whereClause)
            .orderBy(desc(tasks.createdAt))
            .limit(limit)
            .offset(offset),
          db.select({ count: sql<number>`count(*)` }).from(tasks).where(whereClause),
        ]);

        const total = countResult[0]?.count || 0;

        return reply.send({
          tasks: taskList.map((t) => ({
            ...t,
            inputData: JSON.parse(t.inputData),
            resultData: t.resultData ? JSON.parse(t.resultData) : null,
          })),
          pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit),
          },
        });
      } catch (error) {
        return reply.code(500).send({
          error: 'Internal Server Error',
          message: 'Failed to fetch tasks',
        });
      }
    }
  );

  // Get task details with logs
  fastify.get(
    '/admin/tasks/:taskId',
    {
      preHandler: adminAuthMiddleware,
    },
    async (request, reply) => {
      const { taskId } = request.params as { taskId: string };

      try {
        const task = await db.query.tasks.findFirst({
          where: (t, { eq }) => eq(t.uuid, taskId),
        });

        if (!task) {
          return reply.code(404).send({
            error: 'Not Found',
            message: `Task ${taskId} not found`,
          });
        }

        // Get task logs
        const taskLogs = await db
          .select()
          .from(logs)
          .where(eq(logs.taskId, task.id))
          .orderBy(desc(logs.timestamp));

        return reply.send({
          task: {
            ...task,
            inputData: JSON.parse(task.inputData),
            resultData: task.resultData ? JSON.parse(task.resultData) : null,
          },
          logs: taskLogs.map((l) => ({
            ...l,
            context: l.context ? JSON.parse(l.context) : null,
          })),
        });
      } catch (error) {
        return reply.code(500).send({
          error: 'Internal Server Error',
          message: 'Failed to fetch task details',
        });
      }
    }
  );

  // List logs with pagination and filters
  fastify.get(
    '/admin/logs',
    {
      preHandler: adminAuthMiddleware,
    },
    async (request, reply) => {
      try {
        const query = request.query as {
          page?: string;
          limit?: string;
          level?: string;
          requestId?: string;
          from?: string;
          to?: string;
        };

        const page = parseInt(query.page || '1');
        const limit = Math.min(parseInt(query.limit || '50'), 200);
        const offset = (page - 1) * limit;

        // Build conditions
        const conditions = [];
        if (query.level) conditions.push(eq(logs.level, query.level as any));
        if (query.requestId) conditions.push(eq(logs.requestId, query.requestId));
        if (query.from) conditions.push(gte(logs.timestamp, query.from));
        if (query.to) conditions.push(lte(logs.timestamp, query.to));

        const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

        const [logList, countResult] = await Promise.all([
          db
            .select()
            .from(logs)
            .where(whereClause)
            .orderBy(desc(logs.timestamp))
            .limit(limit)
            .offset(offset),
          db.select({ count: sql<number>`count(*)` }).from(logs).where(whereClause),
        ]);

        const total = countResult[0]?.count || 0;

        return reply.send({
          logs: logList.map((l) => ({
            ...l,
            context: l.context ? JSON.parse(l.context) : null,
          })),
          pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit),
          },
        });
      } catch (error) {
        return reply.code(500).send({
          error: 'Internal Server Error',
          message: 'Failed to fetch logs',
        });
      }
    }
  );

  // Get aggregated stats
  fastify.get(
    '/admin/stats',
    {
      preHandler: adminAuthMiddleware,
    },
    async (_request, reply) => {
      try {
        // Get task counts by status
        const statusCounts = await db
          .select({
            status: tasks.status,
            count: sql<number>`count(*)`,
          })
          .from(tasks)
          .groupBy(tasks.status);

        const counts = {
          total: 0,
          pending: 0,
          running: 0,
          completed: 0,
          failed: 0,
          cancelled: 0,
        };

        for (const row of statusCounts) {
          counts[row.status as keyof typeof counts] = row.count;
          counts.total += row.count;
        }

        // Calculate success rate
        const successRate =
          counts.completed + counts.failed > 0
            ? (counts.completed / (counts.completed + counts.failed)) * 100
            : 0;

        // Average duration
        const avgResult = await db
          .select({
            avg: sql<number>`avg(
              (julianday(completed_at) - julianday(started_at)) * 86400000
            )`,
          })
          .from(tasks)
          .where(eq(tasks.status, 'completed'));

        // Recent task counts
        const last24h = await db
          .select({ count: sql<number>`count(*)` })
          .from(tasks)
          .where(gte(tasks.createdAt, sql`datetime('now', '-24 hours')`));

        const lastHour = await db
          .select({ count: sql<number>`count(*)` })
          .from(tasks)
          .where(gte(tasks.createdAt, sql`datetime('now', '-1 hour')`));

        return reply.send({
          tasks: counts,
          performance: {
            avgDurationMs: avgResult[0]?.avg ? Math.round(avgResult[0].avg) : null,
            successRate: Math.round(successRate * 100) / 100,
          },
          recent: {
            last24h: last24h[0]?.count || 0,
            lastHour: lastHour[0]?.count || 0,
          },
        });
      } catch (error) {
        return reply.code(500).send({
          error: 'Internal Server Error',
          message: 'Failed to fetch stats',
        });
      }
    }
  );

  // Cancel a task
  fastify.post(
    '/admin/tasks/:taskId/cancel',
    {
      preHandler: adminAuthMiddleware,
    },
    async (request, reply) => {
      const { taskId } = request.params as { taskId: string };

      try {
        const task = await db.query.tasks.findFirst({
          where: (t, { eq }) => eq(t.uuid, taskId),
        });

        if (!task) {
          return reply.code(404).send({
            error: 'Not Found',
            message: `Task ${taskId} not found`,
          });
        }

        if (task.status !== 'pending') {
          return reply.code(400).send({
            error: 'Bad Request',
            message: `Cannot cancel task in ${task.status} status`,
          });
        }

        await db
          .update(tasks)
          .set({
            status: 'cancelled',
            updatedAt: new Date().toISOString(),
          })
          .where(eq(tasks.uuid, taskId));

        return reply.send({
          success: true,
          message: `Task ${taskId} cancelled`,
        });
      } catch (error) {
        return reply.code(500).send({
          error: 'Internal Server Error',
          message: 'Failed to cancel task',
        });
      }
    }
  );
}
