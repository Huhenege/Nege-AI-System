import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdminAuth, getFirebaseAdminFirestore } from '@/lib/firebase-admin';
import { checkRateLimit, getCallerIdentifier, type RateLimitPreset, type RateLimitConfig } from './rate-limiter';
import type { SaaSModule, ModuleConfig } from '@/types/company';
import { getPlanDefinition, BASE_MODULES } from '@/types/company';

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
  /** Заасан модуль идэвхтэй эсэхийг server-side шалгана */
  module?: SaaSModule;
  /** Заасан лимитийн шалгалт: { key, currentCount } */
  limitCheck?: { key: 'maxEmployees' | 'maxProjects' | 'maxDepartments' | 'maxStorageMB'; currentCount: number };
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

    // ── Module check ─────────────────────────────────────────────────────────
    if (options?.module && role !== 'super_admin') {
      const db = getFirebaseAdminFirestore();
      const companyDoc = await db.doc(`companies/${companyId}`).get();

      if (companyDoc.exists) {
        const company = companyDoc.data()!;
        const mod = options.module;

        const isActive =
          company.status === 'active' ||
          (company.status === 'trial' && (!company.subscription?.trialEndsAt || new Date(company.subscription.trialEndsAt) > new Date()));

        if (!isActive && !BASE_MODULES.includes(mod)) {
          return {
            error: 'Module not available',
            response: NextResponse.json({ error: 'Таны багцын хугацаа дууссан байна' }, { status: 403 }),
          };
        }

        if (isActive) {
          const moduleConfig = company.modules?.[mod] as ModuleConfig | undefined;

          // Explicit disabled
          if (moduleConfig?.enabled === false) {
            return {
              error: 'Module disabled',
              response: NextResponse.json({ error: `'${mod}' модуль таны багцад идэвхгүй байна` }, { status: 403 }),
            };
          }

          // Not explicitly enabled → check plan
          if (!moduleConfig) {
            const planDef = getPlanDefinition(company.plan);
            if (!planDef.modules.includes(mod)) {
              return {
                error: 'Module not in plan',
                response: NextResponse.json({ error: `'${mod}' модуль таны багцад ороогүй байна` }, { status: 403 }),
              };
            }
          }
        }
      }
    }

    // ── Limit check ───────────────────────────────────────────────────────────
    if (options?.limitCheck && role !== 'super_admin') {
      const db = getFirebaseAdminFirestore();
      const companyDoc = await db.doc(`companies/${companyId}`).get();

      if (companyDoc.exists) {
        const company = companyDoc.data()!;
        const { key, currentCount } = options.limitCheck;
        const limit = company.limits?.[key] ?? 0;

        if (limit < 9999 && currentCount >= limit) {
          return {
            error: 'Limit exceeded',
            response: NextResponse.json({
              error: `Лимит хэтэрсэн байна. Одоогийн багцад ${limit}-аас дээш зөвшөөрөхгүй.`,
              code: 'LIMIT_EXCEEDED',
              limit,
              current: currentCount,
            }, { status: 403 }),
          };
        }
      }
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
