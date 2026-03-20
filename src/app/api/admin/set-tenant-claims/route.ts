import { NextResponse } from 'next/server';
import { getFirebaseAdminAuth, getFirebaseAdminFirestore } from '@/lib/firebase-admin';
import type { TenantClaims, TenantRole } from '@/types/company';
import { requireAuth } from '@/lib/api/auth-middleware';

type Body = {
  targetUid?: string;
  role?: TenantRole;
  companyId?: string;
  positionId?: string;
};

const ADMIN_ROLES: TenantRole[] = ['super_admin', 'company_super_admin', 'admin'];
const VALID_ROLES: TenantRole[] = ['super_admin', 'company_super_admin', 'admin', 'manager', 'employee'];

export async function POST(request: Request) {
  try {
    const result = await requireAuth(request);
    if (result.response) return result.response;
    const caller = result.auth;

    if (!ADMIN_ROLES.includes(caller.role as TenantRole)) {
      return NextResponse.json({ error: 'Forbidden: admin or super_admin required' }, { status: 403 });
    }

    const body = (await request.json()) as Body;
    const targetUid = typeof body?.targetUid === 'string' ? body.targetUid.trim() : '';
    const role = body?.role;
    const companyId = body?.companyId;
    const positionId = body?.positionId;

    if (!targetUid || !role) {
      return NextResponse.json({ error: 'Missing required fields: targetUid, role' }, { status: 400 });
    }

    if (!VALID_ROLES.includes(role)) {
      return NextResponse.json({ error: `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}` }, { status: 400 });
    }

    const isSuperAdmin = caller.role === 'super_admin';
    const isCompanySuperAdmin = caller.role === 'company_super_admin';

    if (role === 'super_admin' && !isSuperAdmin) {
      return NextResponse.json({ error: 'Only super_admin can grant super_admin role' }, { status: 403 });
    }

    if (role === 'company_super_admin' && !isSuperAdmin && !isCompanySuperAdmin) {
      return NextResponse.json({ error: 'Only super_admin or company_super_admin can grant company_super_admin role' }, { status: 403 });
    }

    if (role !== 'super_admin' && !companyId) {
      return NextResponse.json({ error: 'companyId is required for non-super_admin roles' }, { status: 400 });
    }

    // Cross-tenant protection: non-super_admin can only set claims within their own company
    if (!isSuperAdmin && companyId && companyId !== caller.companyId) {
      return NextResponse.json({ error: 'Forbidden: cannot modify users outside your company' }, { status: 403 });
    }

    // Verify target user is actually an employee of the target company
    if (companyId) {
      const db = getFirebaseAdminFirestore();
      const empDoc = await db.doc(`companies/${companyId}/employees/${targetUid}`).get();
      if (!empDoc.exists) {
        return NextResponse.json({ error: 'Target user is not an employee of the specified company' }, { status: 404 });
      }
    }

    const adminAuth = getFirebaseAdminAuth();
    const claims: TenantClaims = { role };
    if (companyId) {
      claims.companyId = companyId;
    }
    if (positionId) {
      claims.positionId = positionId;
    }

    await adminAuth.setCustomUserClaims(targetUid, claims);

    return NextResponse.json({ success: true, claims });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
