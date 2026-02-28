import { FastifyRequest, FastifyReply } from 'fastify';
import { env } from '../../config/env.js';

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

  if (token !== env.AUTH_TOKEN) {
    reply.code(401).send({
      error: 'Unauthorized',
      message: 'Invalid authentication token',
    });
    return;
  }
}

// Optional auth for admin routes (can be enhanced with sessions/JWT later)
export async function adminAuthMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  // For now, use the same token. Can be extended with separate admin auth.
  return authMiddleware(request, reply);
}
