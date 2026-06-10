import { FastifyRequest, FastifyReply } from 'fastify';
import { resolveToken, type TokenContext } from './tokenResolver.js';

declare module 'fastify' {
  interface FastifyRequest {
    tokenContext: TokenContext;
  }
}

export async function authMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const token = request.headers['x-auth-token'];

  if (!token) {
    reply.code(401).send({
      error: 'Unauthorized',
      message: 'Missing x-auth-token header',
    });
    return;
  }

  const ctx = resolveToken(String(token));

  if (!ctx) {
    reply.code(401).send({
      error: 'Unauthorized',
      message: 'Invalid authentication token',
    });
    return;
  }

  request.tokenContext = ctx;
}

// Admin routes require the master token; scoped tokens are rejected.
export async function adminAuthMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  await authMiddleware(request, reply);
  if (reply.sent) {
    return;
  }

  if (!request.tokenContext.isMaster) {
    reply.code(403).send({
      error: 'Forbidden',
      code: 'ADMIN_ONLY',
      message: 'Admin routes require the master token',
    });
  }
}
