import { describe, it, expect } from 'vitest';

// env.ts validates process.env at import time, so required vars must be set
// before the dynamic import below (dotenv does not override existing values).
process.env.AUTH_TOKEN = 'master-token-1234567890';
process.env.SCRAPER_SECRET = 'test-scraper-secret';
process.env.ENCRYPTION_SECRET = 'test-encryption-secret-16+';
process.env.CALLBACK_URL = 'https://example.com/callback';
process.env.ALERT_WEBHOOK_URL = 'https://example.com/alert';
process.env.SCOPED_TOKENS = JSON.stringify([
  { token: 'tok_vikey_1234567890', name: 'backend-vikey', scenarios: ['vikey'] },
  {
    token: 'tok_pdf_abcdefghij',
    name: 'pdf-service',
    scenarios: ['html_to_pdf', 'screenshot'],
  },
]);

const { resolveToken, canAccessScenario } = await import('./tokenResolver.js');

describe('resolveToken', () => {
  it('resolves the master token', () => {
    const ctx = resolveToken('master-token-1234567890');
    expect(ctx).toEqual({ isMaster: true, name: 'master', scenarios: [] });
  });

  it('resolves a scoped token with its scenarios', () => {
    const ctx = resolveToken('tok_vikey_1234567890');
    expect(ctx).toEqual({ isMaster: false, name: 'backend-vikey', scenarios: ['vikey'] });
  });

  it('returns null for an unknown token', () => {
    expect(resolveToken('tok_unknown_1234567890')).toBeNull();
  });

  it('returns null for a token with different length (timing-safe path)', () => {
    expect(resolveToken('short')).toBeNull();
    expect(resolveToken('')).toBeNull();
  });
});

describe('canAccessScenario', () => {
  it('master can access any scenario', () => {
    const master = resolveToken('master-token-1234567890')!;
    expect(canAccessScenario(master, 'vikey')).toBe(true);
    expect(canAccessScenario(master, 'anything-else')).toBe(true);
    expect(canAccessScenario(master, 'screenshot')).toBe(true);
  });

  it('scoped token can access only its scenarios', () => {
    const scoped = resolveToken('tok_vikey_1234567890')!;
    expect(canAccessScenario(scoped, 'vikey')).toBe(true);
    expect(canAccessScenario(scoped, 'html_to_pdf')).toBe(false);
    expect(canAccessScenario(scoped, 'screenshot')).toBe(false);
  });

  it('scoped token with screenshot pseudo-scope can access it', () => {
    const scoped = resolveToken('tok_pdf_abcdefghij')!;
    expect(canAccessScenario(scoped, 'screenshot')).toBe(true);
    expect(canAccessScenario(scoped, 'html_to_pdf')).toBe(true);
    expect(canAccessScenario(scoped, 'vikey')).toBe(false);
  });
});
