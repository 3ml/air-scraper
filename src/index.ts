import { startServer } from './api/server.js';
import { initializeDatabase } from './db/client.js';
import { taskWorker } from './queue/TaskWorker.js';
import { browserManager } from './scraper/browser/BrowserManager.js';
import logger from './observability/logger.js';

// Import scenarios to register them
import './scenarios/index.js';

async function main(): Promise<void> {
  logger.info('Starting Air Scraper...');

  try {
    // Initialize database
    logger.info('Initializing database...');
    initializeDatabase();

    // Start API server
    logger.info('Starting API server...');
    await startServer();

    // Start task worker
    logger.info('Starting task worker...');
    taskWorker.start();

    // Setup graceful shutdown
    setupGracefulShutdown();

    logger.info('Air Scraper started successfully');

    // Signal PM2 that we're ready (for zero-downtime reload)
    if (process.send) {
      process.send('ready');
    }
  } catch (error) {
    logger.fatal({ error }, 'Failed to start Air Scraper');
    process.exit(1);
  }
}

function setupGracefulShutdown(): void {
  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Received shutdown signal');

    try {
      // Stop accepting new tasks
      taskWorker.stop();

      // Close browser pool
      await browserManager.shutdown();

      logger.info('Graceful shutdown complete');
      process.exit(0);
    } catch (error) {
      logger.error({ error }, 'Error during shutdown');
      process.exit(1);
    }
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  // Handle uncaught errors
  process.on('uncaughtException', (error) => {
    logger.fatal({ error: error.message, stack: error.stack }, 'Uncaught exception');
    process.exit(1);
  });

  process.on('unhandledRejection', (reason) => {
    logger.fatal({ reason }, 'Unhandled rejection');
    process.exit(1);
  });
}

// Run
main();
