import { describe, it, expect } from 'vitest';
import { redactInputData } from './redactInput.js';

describe('redactInputData', () => {
  it('drops the nested vikey credentials, keeps vikeyId', () => {
    const input = {
      vikeyId: 'F5G84USP',
      credentials: { username: 'user@example.com', password: 'secret123' },
    };
    expect(redactInputData(input)).toEqual({ vikeyId: 'F5G84USP' });
  });

  it('drops top-level username/password (airelite-test shape)', () => {
    const input = { username: 'admin@site.com', password: 'hunter2' };
    expect(redactInputData(input)).toEqual({});
  });

  it('matches sensitive keys case-insensitively and inside arrays', () => {
    const input = {
      url: 'https://example.com',
      list: [{ token: 'abc', keep: 1 }],
      meta: { PassWord: 'x', ok: true },
    };
    expect(redactInputData(input)).toEqual({
      url: 'https://example.com',
      list: [{ keep: 1 }],
      meta: { ok: true },
    });
  });

  it('preserves non-sensitive fields and does not mutate the original', () => {
    const input = { url: 'https://x.com', credentials: { password: 'p' } };
    const out = redactInputData(input);
    expect(out).toEqual({ url: 'https://x.com' });
    // original untouched (deep copy)
    expect(input.credentials.password).toBe('p');
  });
});
