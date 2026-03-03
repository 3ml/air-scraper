import { FastifyInstance } from 'fastify';
import { scenarioRegistry } from '../../scenarios/registry.js';
import { authMiddleware } from '../middleware/auth.js';
import type { ScenariosResponse } from '../../types/api.types.js';

export async function scenariosRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * GET /api/scenarios
   * Returns all available scenarios with their documentation (input/output schemas)
   */
  fastify.get(
    '/api/scenarios',
    {
      preHandler: authMiddleware,
    },
    async (_request, reply) => {
      const scenarios = scenarioRegistry.getDocumentation();

      const response: ScenariosResponse = {
        scenarios,
        count: scenarios.length,
      };

      return reply.send(response);
    }
  );
}
