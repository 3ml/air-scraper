import { FastifyRequest, FastifyReply } from 'fastify';
import { v4 as uuidv4 } from 'uuid';

declare module 'fastify' {
  interface FastifyRequest {
    requestId: string;
  }
}

export async function requestIdMiddleware(
  request: FastifyRequest,
  _reply: FastifyReply
): Promise<void> {
  // Use provided request ID or generate new one
  const providedId = request.headers['x-request-id'];
  request.requestId = typeof providedId === 'string' ? providedId : uuidv4();
}
