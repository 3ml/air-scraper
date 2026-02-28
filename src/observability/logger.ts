import pino, { Logger } from 'pino';
import { env } from '../config/env.js';

// Create base logger
export const logger: Logger = pino({
  level: env.LOG_LEVEL,
  transport:
    env.NODE_ENV === 'development'
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
          },
        }
      : undefined,
  base: {
    env: env.NODE_ENV,
  },
  formatters: {
    level: (label) => ({ level: label }),
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

// Create child logger with request context
export function createRequestLogger(requestId: string, source: string): Logger {
  return logger.child({ requestId, source });
}

// Create child logger for a specific task
export function createTaskLogger(taskId: string, requestId: string): Logger {
  return logger.child({ taskId, requestId, source: 'task' });
}

export default logger;
