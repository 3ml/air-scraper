import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import { env } from '../config/env.js';
import logger from '../observability/logger.js';
import { requestIdMiddleware } from './middleware/requestId.js';
import { healthRoutes } from './routes/health.js';
import { metricsRoutes } from './routes/metrics.js';
import { triggerRoutes } from './routes/trigger.js';
import { adminRoutes } from './routes/admin.js';

export async function createServer() {
  const fastify = Fastify({
    logger: false, // We use our own Pino logger
    trustProxy: true,
  });

  // Security middlewares
  await fastify.register(cors, {
    origin: env.NODE_ENV === 'production' ? false : true,
    credentials: true,
  });

  await fastify.register(helmet, {
    contentSecurityPolicy: false, // Disable for API
  });

  // Request ID middleware
  fastify.addHook('onRequest', requestIdMiddleware);

  // Request logging
  fastify.addHook('onRequest', async (request) => {
    logger.info(
      {
        method: request.method,
        url: request.url,
        requestId: request.requestId,
      },
      'Incoming request'
    );
  });

  fastify.addHook('onResponse', async (request, reply) => {
    logger.info(
      {
        method: request.method,
        url: request.url,
        statusCode: reply.statusCode,
        requestId: request.requestId,
        responseTime: reply.elapsedTime,
      },
      'Request completed'
    );
  });

  // Error handler
  fastify.setErrorHandler(async (error, request, reply) => {
    const err = error as Error & { statusCode?: number };
    logger.error(
      {
        error: err.message,
        stack: err.stack,
        requestId: request.requestId,
      },
      'Request error'
    );

    const statusCode = err.statusCode || 500;
    reply.code(statusCode).send({
      error: err.name || 'Internal Server Error',
      message: err.message,
      statusCode,
    });
  });

  // Register routes
  await fastify.register(healthRoutes);
  await fastify.register(metricsRoutes);
  await fastify.register(triggerRoutes);
  await fastify.register(adminRoutes);

  // Root endpoint
  fastify.get('/', async () => {
    return {
      name: 'Air Scraper',
      version: '1.0.0',
      status: 'running',
    };
  });

  return fastify;
}

export async function startServer() {
  const server = await createServer();

  try {
    const address = await server.listen({
      port: env.PORT,
      host: env.HOST,
    });

    logger.info({ address, env: env.NODE_ENV }, 'Server started');
    return server;
  } catch (error) {
    logger.fatal({ error }, 'Failed to start server');
    process.exit(1);
  }
}
