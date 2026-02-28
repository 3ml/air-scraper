import { EventEmitter } from 'events';
import logger from '../observability/logger.js';

export interface QueuedTask {
  uuid: string;
  action: string;
  priority: number;
  enqueuedAt: number;
}

class TaskQueue extends EventEmitter {
  private queue: QueuedTask[] = [];
  private processing = new Set<string>();

  constructor() {
    super();
  }

  enqueue(task: Omit<QueuedTask, 'enqueuedAt'>): void {
    const queuedTask: QueuedTask = {
      ...task,
      enqueuedAt: Date.now(),
    };

    // Insert in priority order (lower priority number = higher priority)
    const insertIndex = this.queue.findIndex((t) => t.priority > task.priority);
    if (insertIndex === -1) {
      this.queue.push(queuedTask);
    } else {
      this.queue.splice(insertIndex, 0, queuedTask);
    }

    logger.debug({ taskId: task.uuid, queueSize: this.queue.length }, 'Task enqueued');
    this.emit('taskAdded', queuedTask);
  }

  dequeue(): QueuedTask | undefined {
    // Find first task not currently being processed
    const index = this.queue.findIndex((t) => !this.processing.has(t.uuid));
    if (index === -1) return undefined;

    const task = this.queue.splice(index, 1)[0];
    this.processing.add(task.uuid);

    logger.debug({ taskId: task.uuid, queueSize: this.queue.length }, 'Task dequeued');
    return task;
  }

  markComplete(uuid: string): void {
    this.processing.delete(uuid);
    logger.debug({ taskId: uuid, processing: this.processing.size }, 'Task marked complete');
  }

  markFailed(uuid: string): void {
    this.processing.delete(uuid);
    logger.debug({ taskId: uuid, processing: this.processing.size }, 'Task marked failed');
  }

  requeue(task: Omit<QueuedTask, 'enqueuedAt'>): void {
    this.processing.delete(task.uuid);
    this.enqueue(task);
    logger.debug({ taskId: task.uuid }, 'Task requeued');
  }

  remove(uuid: string): boolean {
    const index = this.queue.findIndex((t) => t.uuid === uuid);
    if (index !== -1) {
      this.queue.splice(index, 1);
      logger.debug({ taskId: uuid }, 'Task removed from queue');
      return true;
    }
    return false;
  }

  get size(): number {
    return this.queue.length;
  }

  get processingCount(): number {
    return this.processing.size;
  }

  get pendingCount(): number {
    return this.queue.length;
  }

  getStatus(): {
    queueSize: number;
    processing: number;
    tasks: QueuedTask[];
  } {
    return {
      queueSize: this.queue.length,
      processing: this.processing.size,
      tasks: [...this.queue],
    };
  }

  clear(): void {
    this.queue = [];
    this.processing.clear();
  }
}

// Singleton instance
export const taskQueue = new TaskQueue();
