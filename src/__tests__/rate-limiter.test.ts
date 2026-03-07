import { describe, it, expect } from 'vitest';
import { checkRateLimit, getCallerIdentifier } from '@/lib/api/rate-limiter';

describe('checkRateLimit', () => {
  it('allows requests within the limit', () => {
    const result = checkRateLimit('user-rl-1', '/api/test', { limit: 5, windowSeconds: 60 });
    expect(result).toBeNull();
  });

  it('blocks requests over the limit', () => {
    const uid = 'user-rl-block-' + Date.now();
    const route = '/api/rate-test-block';
    for (let i = 0; i < 3; i++) {
      checkRateLimit(uid, route, { limit: 3, windowSeconds: 60 });
    }
    const blocked = checkRateLimit(uid, route, { limit: 3, windowSeconds: 60 });
    expect(blocked).not.toBeNull();
    expect(blocked?.status).toBe(429);
  });

  it('separates limits by route', () => {
    const uid = 'user-rl-sep-' + Date.now();
    for (let i = 0; i < 3; i++) {
      checkRateLimit(uid, '/api/a', { limit: 3, windowSeconds: 60 });
    }
    const routeB = checkRateLimit(uid, '/api/b', { limit: 3, windowSeconds: 60 });
    expect(routeB).toBeNull();
  });

  it('uses preset configs', () => {
    const uid = 'user-rl-preset-' + Date.now();
    const result = checkRateLimit(uid, '/api/preset-test', 'standard');
    expect(result).toBeNull();
  });
});

describe('getCallerIdentifier', () => {
  it('prefers uid when provided', () => {
    const req = new Request('http://localhost/api/test');
    expect(getCallerIdentifier(req, 'uid-123')).toBe('uid-123');
  });

  it('falls back to x-forwarded-for', () => {
    const req = new Request('http://localhost/api/test', {
      headers: { 'x-forwarded-for': '1.2.3.4, 5.6.7.8' },
    });
    expect(getCallerIdentifier(req)).toBe('1.2.3.4');
  });

  it('returns anonymous as last resort', () => {
    const req = new Request('http://localhost/api/test');
    expect(getCallerIdentifier(req)).toBe('anonymous');
  });
});
