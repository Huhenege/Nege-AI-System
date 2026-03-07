import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { middleware } from '../../middleware';

function createFakeJwt(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const body = btoa(JSON.stringify(payload));
  return `${header}.${body}.sig`;
}

function makeRequest(path: string, sessionToken?: string): NextRequest {
  const url = new URL(path, 'http://localhost:3001');
  const req = new NextRequest(url);
  if (sessionToken) {
    req.cookies.set('__session', sessionToken);
  }
  return req;
}

describe('middleware', () => {
  it('allows public paths without auth', () => {
    const res = middleware(makeRequest('/login'));
    expect(res.status).toBe(200);
  });

  it('redirects unauthenticated users to login from /dashboard', () => {
    const res = middleware(makeRequest('/dashboard'));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('/login');
    expect(res.headers.get('location')).toContain('redirect=%2Fdashboard');
  });

  it('allows authenticated users to access /dashboard', () => {
    const token = createFakeJwt({ role: 'admin', exp: Math.floor(Date.now() / 1000) + 3600 });
    const res = middleware(makeRequest('/dashboard', token));
    expect(res.status).toBe(200);
  });

  it('blocks non-super_admin from /super-admin', () => {
    const token = createFakeJwt({ role: 'admin', exp: Math.floor(Date.now() / 1000) + 3600 });
    const res = middleware(makeRequest('/super-admin', token));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('/dashboard');
  });

  it('allows super_admin to access /super-admin', () => {
    const token = createFakeJwt({ role: 'super_admin', exp: Math.floor(Date.now() / 1000) + 3600 });
    const res = middleware(makeRequest('/super-admin', token));
    expect(res.status).toBe(200);
  });

  it('redirects logged-in users away from /login', () => {
    const token = createFakeJwt({ role: 'admin' });
    const res = middleware(makeRequest('/login', token));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('/dashboard');
  });

  it('allows API routes without auth', () => {
    const res = middleware(makeRequest('/api/assistant/chat'));
    expect(res.status).toBe(200);
  });

  it('redirects when token is expired', () => {
    const token = createFakeJwt({ role: 'admin', exp: Math.floor(Date.now() / 1000) - 100 });
    const res = middleware(makeRequest('/dashboard/employees', token));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('/login');
  });
});
