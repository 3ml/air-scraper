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
    async (request, reply) => {
      const all = scenarioRegistry.getDocumentation();
      const ctx = request.tokenContext;
      // Scoped tokens only see the scenarios they are allowed to trigger
      const scenarios = ctx.isMaster ? all : all.filter((s) => ctx.scenarios.includes(s.action));

      const response: ScenariosResponse = {
        scenarios,
        count: scenarios.length,
      };

      return reply.send(response);
    }
  );
}
