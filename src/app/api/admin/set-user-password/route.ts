import { NextResponse } from 'next/server';
import { getFirebaseAdminAuth, getFirebaseAdminFirestore } from '@/lib/firebase-admin';
import type { TenantRole } from '@/types/company';
import { requireAuth } from '@/lib/api/auth-middleware';

type Body = {
  uid?: string;
  newPassword?: string;
};

const ADMIN_ROLES: TenantRole[] = ['super_admin', 'company_super_admin', 'admin'];

export async function POST(request: Request) {
  try {
    const result = await requireAuth(request);
    if (result.response) return result.response;
    const caller = result.auth;

    if (!ADMIN_ROLES.includes(caller.role as TenantRole)) {
      return NextResponse.json({ error: 'Forbidden: admin or super_admin required' }, { status: 403 });
    }

    const body = (await request.json()) as Body;
    const uid = typeof body?.uid === 'string' ? body.uid.trim() : '';
    const newPassword = typeof body?.newPassword === 'string' ? body.newPassword : '';

    if (!uid || !newPassword) {
      return NextResponse.json({ error: 'Missing required fields: uid, newPassword' }, { status: 400 });
    }
    if (newPassword.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
    }

    // Cross-tenant protection: non-super_admin can only reset passwords within their own company
    if (caller.role !== 'super_admin') {
      const db = getFirebaseAdminFirestore();
      const empDoc = await db.doc(`companies/${caller.companyId}/employees/${uid}`).get();
      if (!empDoc.exists) {
        return NextResponse.json({ error: 'Target user is not an employee of your company' }, { status: 403 });
      }
    }

    const adminAuth = getFirebaseAdminAuth();
    await adminAuth.updateUser(uid, { password: newPassword });

    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

