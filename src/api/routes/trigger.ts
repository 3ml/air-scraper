import { FastifyInstance } from 'fastify';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../../db/client.js';
import { tasks } from '../../db/schema.js';
import {
  encryptedTriggerRequestSchema,
  triggerRequestSchema,
  type TriggerResponse,
} from '../../types/api.types.js';
import { authMiddleware } from '../middleware/auth.js';
import { createRequestLogger } from '../../observability/logger.js';
import { incrementRequestCounter } from '../../observability/metrics.js';
import { taskQueue } from '../../queue/TaskQueue.js';
import { decrypt, decryptObject } from '../../utils/encryption.js';

export async function triggerRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post(
    '/api/trigger',
    {
      preHandler: authMiddleware,
    },
    async (request, reply) => {
      const logger = createRequestLogger(request.requestId, 'trigger');

      try {
        // Validate encrypted request structure
        const encryptedResult = encryptedTriggerRequestSchema.safeParse(request.body);
        if (!encryptedResult.success) {
          incrementRequestCounter(false);
          logger.warn({ errors: encryptedResult.error.errors }, 'Invalid encrypted request body');
          return reply.code(400).send({
            error: 'Validation Error',
            message: 'Invalid request body structure',
            details: encryptedResult.error.errors,
          });
        }

        // Decrypt action and data
        let decryptedAction: string;
        let decryptedData: Record<string, unknown>;

        try {
          decryptedAction = decrypt(encryptedResult.data.action);
          decryptedData = decryptObject<Record<string, unknown>>(encryptedResult.data.data);
        } catch (decryptError) {
          incrementRequestCounter(false);
          logger.warn({ error: decryptError }, 'Failed to decrypt payload');
          return reply.code(400).send({
            error: 'Decryption Error',
            message: 'Failed to decrypt action or data. Check encryption key and format.',
          });
        }

        // Validate decrypted content
        const parseResult = triggerRequestSchema.safeParse({
          action: decryptedAction,
          data: decryptedData,
          priority: encryptedResult.data.priority,
          callbackUrl: encryptedResult.data.callbackUrl,
        });

        if (!parseResult.success) {
          incrementRequestCounter(false);
          logger.warn({ errors: parseResult.error.errors }, 'Invalid decrypted request body');
          return reply.code(400).send({
            error: 'Validation Error',
            message: 'Invalid decrypted payload',
            details: parseResult.error.errors,
          });
        }

        const { action, data, priority, callbackUrl } = parseResult.data;
        const taskUuid = uuidv4();

        logger.info({ action, taskUuid }, 'Creating new task');

        // Insert task into database
        await db.insert(tasks).values({
          uuid: taskUuid,
          requestId: request.requestId,
          action,
          inputData: JSON.stringify(data),
          priority: priority ?? 5,
          callbackUrl,
          status: 'pending',
        });

        // Add to task queue
        taskQueue.enqueue({
          uuid: taskUuid,
          action,
          priority: priority ?? 5,
        });

        incrementRequestCounter(true);

        const response: TriggerResponse = {
          taskId: taskUuid,
          status: 'pending',
          message: `Task queued for action: ${action}`,
        };

        logger.info({ taskId: taskUuid }, 'Task created successfully');
        return reply.code(202).send(response);
      } catch (error) {
        incrementRequestCounter(false);
        logger.error({ error }, 'Failed to create task');
        return reply.code(500).send({
          error: 'Internal Server Error',
          message: 'Failed to create task',
        });
      }
    }
  );

  // Get task status by ID
  fastify.get(
    '/api/tasks/:taskId',
    {
      preHandler: authMiddleware,
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

        return reply.send({
          taskId: task.uuid,
          requestId: task.requestId,
          action: task.action,
          status: task.status,
          inputData: JSON.parse(task.inputData),
          resultData: task.resultData ? JSON.parse(task.resultData) : null,
          error: task.errorMessage
            ? {
                message: task.errorMessage,
                stack: task.errorStack,
              }
            : null,
          attemptCount: task.attemptCount,
          createdAt: task.createdAt,
          startedAt: task.startedAt,
          completedAt: task.completedAt,
        });
      } catch (error) {
        return reply.code(500).send({
          error: 'Internal Server Error',
          message: 'Failed to fetch task',
        });
      }
    }
  );
}
