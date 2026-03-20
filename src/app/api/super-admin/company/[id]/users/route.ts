import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdminFirestore, getFirebaseAdminAuth } from '@/lib/firebase-admin';
import { requireSuperAdmin } from '../../../lib/auth-guard';
import type { TenantRole, TenantClaims } from '@/types/company';

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const authResult = await requireSuperAdmin(request);
  if (authResult instanceof NextResponse) return authResult;

  const { id: companyId } = await params;
  const db = getFirebaseAdminFirestore();
  const adminAuth = getFirebaseAdminAuth();

  const employeesSnap = await db.collection(`companies/${companyId}/employees`).get();

  const users = await Promise.all(
    employeesSnap.docs.map(async (doc) => {
      const data = doc.data();
      let authUser: { email?: string; disabled?: boolean; claims?: Record<string, unknown> } = {};

      try {
        const u = await adminAuth.getUser(doc.id);
        authUser = {
          email: u.email,
          disabled: u.disabled,
          claims: (u.customClaims || {}) as Record<string, unknown>,
        };
      } catch {
        // User might not exist in Auth
      }

      return {
        uid: doc.id,
        firstName: data.firstName || '',
        lastName: data.lastName || '',
        email: authUser.email || data.email || '',
        role: (authUser.claims?.role as string) || data.role || 'employee',
        status: data.status || 'unknown',
        disabled: authUser.disabled || false,
        jobTitle: data.jobTitle || '',
      };
    })
  );

  return NextResponse.json({ users });
}

export async function POST(request: NextRequest, { params }: Params) {
  const authResult = await requireSuperAdmin(request);
  if (authResult instanceof NextResponse) return authResult;

  const { id: companyId } = await params;
  const body = await request.json();
  const { targetUid, role, disabled } = body as {
    targetUid: string;
    role?: TenantRole;
    disabled?: boolean;
  };

  if (!targetUid) {
    return NextResponse.json({ error: 'targetUid is required' }, { status: 400 });
  }

  const adminAuth = getFirebaseAdminAuth();

  if (role) {
    const validRoles: TenantRole[] = ['super_admin', 'company_super_admin', 'admin', 'manager', 'employee'];
    if (!validRoles.includes(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    }

    const claims: TenantClaims = { role };
    if (role !== 'super_admin') {
      claims.companyId = companyId;
    }
    await adminAuth.setCustomUserClaims(targetUid, claims);
  }

  if (disabled !== undefined) {
    await adminAuth.updateUser(targetUid, { disabled });
  }

  return NextResponse.json({ success: true });
}
