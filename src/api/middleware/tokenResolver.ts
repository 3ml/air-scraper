import { timingSafeEqual } from 'node:crypto';
import { env } from '../../config/env.js';

export interface TokenContext {
  isMaster: boolean;
  /** Token name; 'master' for the master token. Persisted on tasks for ownership checks. */
  name: string;
  /** Allowed scenario actions ('screenshot' is a pseudo-scope). Empty for master (full access). */
  scenarios: string[];
}

function safeEqual(a: string, b: string): boolean {
  const bufferA = Buffer.from(a, 'utf8');
  const bufferB = Buffer.from(b, 'utf8');
  return bufferA.length === bufferB.length && timingSafeEqual(bufferA, bufferB);
}

export function resolveToken(token: string): TokenContext | null {
  if (safeEqual(token, env.AUTH_TOKEN)) {
    return { isMaster: true, name: 'master', scenarios: [] };
  }

  for (const scopedToken of env.SCOPED_TOKENS) {
    if (safeEqual(token, scopedToken.token)) {
      return { isMaster: false, name: scopedToken.name, scenarios: scopedToken.scenarios };
    }
  }

  return null;
}

export function canAccessScenario(ctx: TokenContext, action: string): boolean {
  return ctx.isMaster || ctx.scenarios.includes(action);
}
