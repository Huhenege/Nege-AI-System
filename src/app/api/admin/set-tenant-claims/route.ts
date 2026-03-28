import { NextResponse } from 'next/server';
import { getFirebaseAdminAuth, getFirebaseAdminFirestore } from '@/lib/firebase-admin';
import type { TenantClaims, TenantRole } from '@/types/company';
import { requireAuth } from '@/lib/api/auth-middleware';
import { getDynamicPlanDefinition } from '@/lib/pricing/get-pricing-plans';

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

    // Token claims may be stale — if caller looks non-admin, cross-check Firestore
    let effectiveRole = caller.role as TenantRole;
    if (!ADMIN_ROLES.includes(effectiveRole) && caller.companyId) {
      const db = getFirebaseAdminFirestore();
      const callerDoc = await db.doc(`companies/${caller.companyId}/employees/${caller.uid}`).get();
      if (callerDoc.exists) {
        const fsRole = callerDoc.data()?.role as TenantRole | undefined;
        if (fsRole && ADMIN_ROLES.includes(fsRole)) {
          effectiveRole = fsRole;
        }
      }
    }

    if (!ADMIN_ROLES.includes(effectiveRole)) {
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

    const isSuperAdmin = effectiveRole === 'super_admin';
    const isCompanySuperAdmin = effectiveRole === 'company_super_admin';

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
    // + server-side employee limit check (шинэ ажилтан нэмэх үед)
    if (companyId) {
      const db = getFirebaseAdminFirestore();
      const empDoc = await db.doc(`companies/${companyId}/employees/${targetUid}`).get();
      if (!empDoc.exists) {
        return NextResponse.json({ error: 'Target user is not an employee of the specified company' }, { status: 404 });
      }

      // Шинэ ажилтан (role = employee/manager) нэмэх үед лимит шалгана
      // super_admin нь лимитгүй; company_super_admin/admin өөрчлөх үед шалгахгүй
      if (!isSuperAdmin && (role === 'employee' || role === 'manager')) {
        const companyDoc = await db.doc(`companies/${companyId}`).get();
        if (companyDoc.exists) {
          const companyData = companyDoc.data()!;
          const plan = companyData.plan ?? 'free';
          const planDef = await getDynamicPlanDefinition(plan);
          const maxEmployees = companyData.limits?.maxEmployees ?? planDef.limits.maxEmployees;

          // Одоогийн ажилтны тоог тооцно (super_admin-г хасна)
          const empSnap = await db.collection(`companies/${companyId}/employees`)
            .where('role', '!=', 'super_admin')
            .count()
            .get();
          const currentCount = empSnap.data().count;

          if (maxEmployees < 9999 && currentCount >= maxEmployees) {
            return NextResponse.json({
              error: `Ажилтны лимит хэтэрсэн байна. Одоогийн багцад ${maxEmployees} ажилтан зөвшөөрнө.`,
              code: 'EMPLOYEE_LIMIT_EXCEEDED',
              limit: maxEmployees,
              current: currentCount,
            }, { status: 403 });
          }
        }
      }
    }

    const adminAuth = getFirebaseAdminAuth();

    // Preserve existing claims, only update the fields being changed
    const targetUser = await adminAuth.getUser(targetUid);
    const existingClaims = (targetUser.customClaims || {}) as TenantClaims;

    const newClaims: TenantClaims = {
      ...existingClaims,
      role,
    };
    if (companyId) {
      newClaims.companyId = companyId;
    }
    if (positionId) {
      newClaims.positionId = positionId;
    }

    await adminAuth.setCustomUserClaims(targetUid, newClaims);

    return NextResponse.json({ success: true, claims: newClaims });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
