import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdminAuth } from '@/lib/firebase-admin';
import { checkRateLimit, getCallerIdentifier, type RateLimitPreset, type RateLimitConfig } from './rate-limiter';

export interface AuthContext {
  uid: string;
  companyId: string;
  role: string;
}

export interface AuthResult {
  auth: AuthContext;
  error?: never;
  response?: never;
}

export interface AuthError {
  auth?: never;
  error: string;
  response: NextResponse;
}

function extractToken(request: NextRequest | Request): string | null {
  const header = request.headers.get('authorization') || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1] || null;
}

export interface AuthOptions {
  rateLimit?: RateLimitPreset | RateLimitConfig;
}

/**
 * Requires authentication AND a valid companyId in custom claims.
 * Use for all tenant-scoped API routes.
 */
export async function requireTenantAuth(
  request: NextRequest | Request,
  options?: AuthOptions
): Promise<AuthResult | AuthError> {
  const token = extractToken(request);
  if (!token) {
    return {
      error: 'Missing Authorization bearer token',
      response: NextResponse.json(
        { error: 'Missing Authorization bearer token' },
        { status: 401 }
      ),
    };
  }

  try {
    const adminAuth = getFirebaseAdminAuth();
    const decoded = await adminAuth.verifyIdToken(token);
    const companyId = decoded.companyId as string | undefined;
    const role = (decoded.role as string) || 'employee';

    if (!companyId) {
      return {
        error: 'No companyId in token claims',
        response: NextResponse.json(
          { error: 'Tenant context missing. Please re-login.' },
          { status: 403 }
        ),
      };
    }

    if (options?.rateLimit) {
      const route = request instanceof NextRequest ? request.nextUrl.pathname : new URL(request.url).pathname;
      const rateLimited = await checkRateLimit(decoded.uid, route, options.rateLimit);
      if (rateLimited) return { error: 'Rate limited', response: rateLimited };
    }

    return { auth: { uid: decoded.uid, companyId, role } };
  } catch (err) {
    console.error('[auth-middleware]', err);
    return {
      error: 'Invalid or expired token',
      response: NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401 }
      ),
    };
  }
}

/**
 * Requires authentication only (no companyId needed).
 * Use for routes that don't need tenant scoping (e.g., super admin, or pre-tenant setup).
 */
export async function requireAuth(
  request: NextRequest | Request,
  options?: AuthOptions
): Promise<AuthResult | AuthError> {
  const token = extractToken(request);
  if (!token) {
    return {
      error: 'Missing Authorization bearer token',
      response: NextResponse.json(
        { error: 'Missing Authorization bearer token' },
        { status: 401 }
      ),
    };
  }

  try {
    const adminAuth = getFirebaseAdminAuth();
    const decoded = await adminAuth.verifyIdToken(token);
    const companyId = (decoded.companyId as string) || '';
    const role = (decoded.role as string) || 'employee';

    if (options?.rateLimit) {
      const route = request instanceof NextRequest ? request.nextUrl.pathname : new URL(request.url).pathname;
      const rateLimited = await checkRateLimit(decoded.uid, route, options.rateLimit);
      if (rateLimited) return { error: 'Rate limited', response: rateLimited };
    }

    return { auth: { uid: decoded.uid, companyId, role } };
  } catch (err) {
    console.error('[auth-middleware]', err);
    return {
      error: 'Invalid or expired token',
      response: NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401 }
      ),
    };
  }
}
