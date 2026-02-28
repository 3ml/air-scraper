import { taskQueue, type QueuedTask } from './TaskQueue.js';
import { db } from '../db/client.js';
import { tasks } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { scenarioRegistry } from '../scenarios/index.js';
import { callbackService } from '../services/CallbackService.js';
import { alertService } from '../services/AlertService.js';
import { incrementActionCounter } from '../observability/metrics.js';
import { env } from '../config/env.js';
import logger from '../observability/logger.js';
import { DelayManager } from '../scraper/humanizer/DelayManager.js';

/**
 * TaskWorker - Processes tasks from the queue
 */
export class TaskWorker {
  private static instance: TaskWorker;
  private isRunning = false;
  private activeWorkers = 0;
  private maxConcurrent: number;

  private constructor() {
    this.maxConcurrent = env.MAX_CONCURRENT_TASKS;
  }

  static getInstance(): TaskWorker {
    if (!TaskWorker.instance) {
      TaskWorker.instance = new TaskWorker();
    }
    return TaskWorker.instance;
  }

  /**
   * Start the worker
   */
  start(): void {
    if (this.isRunning) return;

    this.isRunning = true;
    logger.info({ maxConcurrent: this.maxConcurrent }, 'TaskWorker started');

    // Start processing loop
    this.processLoop();

    // Listen for new tasks
    taskQueue.on('taskAdded', () => {
      if (this.activeWorkers < this.maxConcurrent) {
        this.processNext();
      }
    });
  }

  /**
   * Stop the worker
   */
  stop(): void {
    this.isRunning = false;
    logger.info('TaskWorker stopped');
  }

  /**
   * Main processing loop
   */
  private async processLoop(): Promise<void> {
    while (this.isRunning) {
      if (this.activeWorkers < this.maxConcurrent) {
        await this.processNext();
      }
      await this.sleep(500); // Check every 500ms
    }
  }

  /**
   * Process the next task in the queue
   */
  private async processNext(): Promise<void> {
    const queuedTask = taskQueue.dequeue();
    if (!queuedTask) return;

    this.activeWorkers++;

    try {
      await this.processTask(queuedTask);
    } catch (error) {
      logger.error({ taskUuid: queuedTask.uuid, error }, 'Unexpected error processing task');
    } finally {
      this.activeWorkers--;
    }
  }

  /**
   * Process a single task
   */
  private async processTask(queuedTask: QueuedTask): Promise<void> {
    const taskLogger = logger.child({
      taskUuid: queuedTask.uuid,
      action: queuedTask.action,
    });

    taskLogger.info('Processing task');

    // Get full task from database
    const task = await db.query.tasks.findFirst({
      where: (t, { eq }) => eq(t.uuid, queuedTask.uuid),
    });

    if (!task) {
      taskLogger.error('Task not found in database');
      taskQueue.markFailed(queuedTask.uuid);
      return;
    }

    // Check if task was cancelled
    if (task.status === 'cancelled') {
      taskLogger.info('Task was cancelled, skipping');
      taskQueue.markComplete(queuedTask.uuid);
      return;
    }

    // Update task status to running
    await db
      .update(tasks)
      .set({
        status: 'running',
        startedAt: new Date().toISOString(),
        attemptCount: task.attemptCount + 1,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(tasks.uuid, queuedTask.uuid));

    // Get scenario
    const scenario = scenarioRegistry.get(queuedTask.action);
    if (!scenario) {
      taskLogger.error('Scenario not found');
      await this.failTask(queuedTask.uuid, 'Scenario not found', task.attemptCount + 1, task.maxAttempts);
      return;
    }

    // Execute scenario
    try {
      const result = await scenario.execute({
        taskId: queuedTask.uuid,
        requestId: task.requestId,
        inputData: JSON.parse(task.inputData),
      });

      if (result.success) {
        // Task completed successfully
        await db
          .update(tasks)
          .set({
            status: 'completed',
            resultData: JSON.stringify(result.data),
            completedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          })
          .where(eq(tasks.uuid, queuedTask.uuid));

        taskQueue.markComplete(queuedTask.uuid);
        incrementActionCounter(queuedTask.action, true);
        taskLogger.info({ executionMs: result.executionMs }, 'Task completed successfully');

        // Send callback
        await callbackService.sendCallback(queuedTask.uuid);
      } else {
        // Task failed
        await this.failTask(
          queuedTask.uuid,
          result.error || 'Unknown error',
          task.attemptCount + 1,
          task.maxAttempts
        );
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await this.failTask(queuedTask.uuid, errorMessage, task.attemptCount + 1, task.maxAttempts);
    }
  }

  /**
   * Handle task failure (with retry logic)
   */
  private async failTask(
    taskUuid: string,
    errorMessage: string,
    attemptCount: number,
    maxAttempts: number
  ): Promise<void> {
    const task = await db.query.tasks.findFirst({
      where: (t, { eq }) => eq(t.uuid, taskUuid),
    });

    if (!task) return;

    const taskLogger = logger.child({ taskUuid, action: task.action });

    if (attemptCount < maxAttempts) {
      // Retry with exponential backoff
      const retryDelay = DelayManager.exponentialBackoff(attemptCount);
      const nextRetryAt = new Date(Date.now() + retryDelay).toISOString();

      await db
        .update(tasks)
        .set({
          status: 'pending',
          errorMessage,
          nextRetryAt,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(tasks.uuid, taskUuid));

      // Requeue with lower priority
      taskQueue.requeue({
        uuid: taskUuid,
        action: task.action,
        priority: Math.min(10, task.priority + 1),
      });

      taskLogger.warn(
        { attemptCount, maxAttempts, nextRetryAt },
        'Task failed, scheduling retry'
      );
    } else {
      // Final failure
      await db
        .update(tasks)
        .set({
          status: 'failed',
          errorMessage,
          completedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
        .where(eq(tasks.uuid, taskUuid));

      taskQueue.markFailed(taskUuid);
      incrementActionCounter(task.action, false);

      // Send alert
      await alertService.sendTaskFailureAlert(taskUuid, task.action, errorMessage);

      // Send callback with failure
      await callbackService.sendCallback(taskUuid);

      taskLogger.error({ attemptCount, errorMessage }, 'Task failed permanently');
    }
  }

  /**
   * Get worker status
   */
  getStatus(): {
    isRunning: boolean;
    activeWorkers: number;
    maxConcurrent: number;
    queueSize: number;
  } {
    return {
      isRunning: this.isRunning,
      activeWorkers: this.activeWorkers,
      maxConcurrent: this.maxConcurrent,
      queueSize: taskQueue.size,
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export const taskWorker = TaskWorker.getInstance();

export default TaskWorker;
