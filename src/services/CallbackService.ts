import { env } from '../config/env.js';
import { db } from '../db/client.js';
import { tasks } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import logger from '../observability/logger.js';
import { encryptObject } from '../utils/encryption.js';
import type { CallbackPayload } from '../types/api.types.js';

const MAX_RETRIES = 3;
const RETRY_DELAYS = [1000, 5000, 15000]; // 1s, 5s, 15s

export class CallbackService {
  private static instance: CallbackService;

  static getInstance(): CallbackService {
    if (!CallbackService.instance) {
      CallbackService.instance = new CallbackService();
    }
    return CallbackService.instance;
  }

  async sendCallback(taskUuid: string): Promise<boolean> {
    const task = await db.query.tasks.findFirst({
      where: (t, { eq }) => eq(t.uuid, taskUuid),
    });

    if (!task) {
      logger.error({ taskUuid }, 'Task not found for callback');
      return false;
    }

    const callbackUrl = task.callbackUrl || env.CALLBACK_URL;
    const startTime = task.startedAt ? new Date(task.startedAt).getTime() : Date.now();
    const endTime = task.completedAt ? new Date(task.completedAt).getTime() : Date.now();

    const payload: CallbackPayload = {
      taskId: task.uuid,
      requestId: task.requestId,
      action: task.action,
      status: task.status as 'completed' | 'failed',
      inputData: JSON.parse(task.inputData),
      resultData: task.resultData ? JSON.parse(task.resultData) : null,
      error: task.errorMessage
        ? {
            message: task.errorMessage,
            code: 'TASK_FAILED',
          }
        : null,
      executionMs: endTime - startTime,
      timestamp: new Date().toISOString(),
    };

    // Encrypt entire payload
    const encryptedPayload = encryptObject(payload);

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const response = await fetch(callbackUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-scraper-secret': env.SCRAPER_SECRET,
            'x-request-id': task.requestId,
          },
          body: JSON.stringify({ data: encryptedPayload }),
        });

        if (response.ok) {
          await db
            .update(tasks)
            .set({
              callbackSentAt: new Date().toISOString(),
              callbackStatus: 'sent',
              updatedAt: new Date().toISOString(),
            })
            .where(eq(tasks.uuid, taskUuid));

          logger.info({ taskUuid, callbackUrl }, 'Callback sent successfully');
          return true;
        }

        lastError = new Error(`HTTP ${response.status}: ${await response.text()}`);
        logger.warn(
          { taskUuid, attempt, status: response.status },
          'Callback failed, retrying...'
        );
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        logger.warn({ taskUuid, attempt, error: lastError.message }, 'Callback request failed');
      }

      // Wait before retry (except on last attempt)
      if (attempt < MAX_RETRIES) {
        await this.sleep(RETRY_DELAYS[attempt]);
      }
    }

    // All retries failed
    await db
      .update(tasks)
      .set({
        callbackStatus: 'failed',
        updatedAt: new Date().toISOString(),
      })
      .where(eq(tasks.uuid, taskUuid));

    logger.error(
      { taskUuid, callbackUrl, error: lastError?.message },
      'Callback failed after all retries'
    );
    return false;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export const callbackService = CallbackService.getInstance();
