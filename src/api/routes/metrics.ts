import { FastifyInstance } from 'fastify';
import { getMetrics, formatPrometheusMetrics } from '../../observability/metrics.js';

export async function metricsRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get('/metrics', async (_request, reply) => {
    try {
      const metrics = await getMetrics();
      const prometheusFormat = formatPrometheusMetrics(metrics);

      reply
        .header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
        .send(prometheusFormat);
    } catch (error) {
      reply.code(500).send('Error collecting metrics');
    }
  });

  // JSON format for dashboard
  fastify.get('/metrics/json', async (_request, reply) => {
    try {
      const metrics = await getMetrics();
      reply.send(metrics);
    } catch (error) {
      reply.code(500).send({ error: 'Error collecting metrics' });
    }
  });
}
