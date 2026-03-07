import { describe, it, expect, beforeEach } from 'vitest';
import { decodeJwtPayload } from '@/lib/session';

function createFakeJwt(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const body = btoa(JSON.stringify(payload));
  return `${header}.${body}.fakesignature`;
}

describe('decodeJwtPayload', () => {
  it('decodes a valid JWT payload', () => {
    const token = createFakeJwt({ sub: '123', role: 'admin', companyId: 'abc' });
    const payload = decodeJwtPayload(token);
    expect(payload).toEqual({ sub: '123', role: 'admin', companyId: 'abc' });
  });

  it('returns null for invalid tokens', () => {
    expect(decodeJwtPayload('not-a-jwt')).toBeNull();
    expect(decodeJwtPayload('')).toBeNull();
    expect(decodeJwtPayload('a.b')).toBeNull();
  });

  it('returns null for malformed base64 payload', () => {
    expect(decodeJwtPayload('aaa.!!!invalid!!!.ccc')).toBeNull();
  });
});

describe('session cookies', () => {
  beforeEach(() => {
    Object.defineProperty(document, 'cookie', {
      writable: true,
      value: '',
    });
  });

  it('setSessionCookie sets __session cookie', async () => {
    const { setSessionCookie } = await import('@/lib/session');
    setSessionCookie('my-token');
    expect(document.cookie).toContain('__session=my-token');
  });

  it('clearSessionCookie removes __session cookie', async () => {
    const { setSessionCookie, clearSessionCookie } = await import('@/lib/session');
    setSessionCookie('my-token');
    clearSessionCookie();
    expect(document.cookie).toContain('max-age=0');
  });
});
