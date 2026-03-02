import { env } from '../config/env.js';
import { db } from '../db/client.js';
import { alerts } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import logger from '../observability/logger.js';
import type { AlertPayload } from '../types/api.types.js';

const MAX_RETRIES = 3;

export class AlertService {
  private static instance: AlertService;

  static getInstance(): AlertService {
    if (!AlertService.instance) {
      AlertService.instance = new AlertService();
    }
    return AlertService.instance;
  }

  async sendAlert(payload: Omit<AlertPayload, 'timestamp'>): Promise<boolean> {
    const fullPayload: AlertPayload = {
      ...payload,
      timestamp: new Date().toISOString(),
    };

    // Store alert in database
    const [alertRecord] = await db
      .insert(alerts)
      .values({
        taskId: payload.taskId ? parseInt(payload.taskId) : null,
        alertType: payload.type,
        title: payload.title,
        message: payload.message,
        context: payload.context ? JSON.stringify(payload.context) : null,
        webhookUrl: env.ALERT_WEBHOOK_URL,
        status: 'pending',
      })
      .returning();

    let lastError: Error | null = null;
    let httpStatus: number | null = null;
    let responseBody: string | null = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const response = await fetch(env.ALERT_WEBHOOK_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-scraper-secret': env.SCRAPER_SECRET,
          },
          body: JSON.stringify(fullPayload),
        });

        httpStatus = response.status;
        responseBody = await response.text();

        if (response.ok) {
          await db
            .update(alerts)
            .set({
              status: 'sent',
              httpStatus,
              responseBody,
              sentAt: new Date().toISOString(),
            })
            .where(eq(alerts.id, alertRecord.id));

          logger.info({ alertId: alertRecord.id, type: payload.type }, 'Alert sent successfully');
          return true;
        }

        lastError = new Error(`HTTP ${response.status}: ${responseBody}`);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        logger.warn(
          { alertId: alertRecord.id, attempt, error: lastError.message },
          'Alert request failed'
        );
      }

      // Wait before retry with exponential backoff
      if (attempt < MAX_RETRIES) {
        await this.sleep(Math.pow(2, attempt) * 1000);
      }
    }

    // All retries failed
    await db
      .update(alerts)
      .set({
        status: 'failed',
        httpStatus,
        responseBody,
        retryCount: MAX_RETRIES,
      })
      .where(eq(alerts.id, alertRecord.id));

    logger.error(
      { alertId: alertRecord.id, error: lastError?.message },
      'Alert failed after all retries'
    );
    return false;
  }

  async sendTaskFailureAlert(
    taskUuid: string,
    action: string,
    errorMessage: string
  ): Promise<boolean> {
    return this.sendAlert({
      type: 'error',
      taskId: taskUuid,
      action,
      title: 'Task Failed',
      message: `Task ${action} failed: ${errorMessage}`,
      context: {
        taskId: taskUuid,
        action,
      },
    });
  }

  async sendSystemAlert(title: string, message: string): Promise<boolean> {
    return this.sendAlert({
      type: 'warning',
      title,
      message,
    });
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export const alertService = AlertService.getInstance();
