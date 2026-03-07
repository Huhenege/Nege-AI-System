import { NextResponse } from 'next/server';
import { getFirebaseAdminAuth, getFirebaseAdminFirestore } from '@/lib/firebase-admin';
import type { TenantClaims, TenantRole } from '@/types/company';

type Body = {
  targetUid?: string;
  role?: TenantRole;
  companyId?: string;
};

function getBearerToken(req: Request): string | null {
  const header = req.headers.get('authorization') || req.headers.get('Authorization') || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1] || null;
}

export async function POST(request: Request) {
  try {
    const token = getBearerToken(request);
    if (!token) {
      return NextResponse.json({ error: 'Missing Authorization bearer token' }, { status: 401 });
    }

    const adminAuth = getFirebaseAdminAuth();
    const adminDb = getFirebaseAdminFirestore();

    let decoded: { uid: string };
    try {
      decoded = (await adminAuth.verifyIdToken(token)) as { uid: string };
    } catch {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
    }

    const callerClaims = (await adminAuth.getUser(decoded.uid)).customClaims as TenantClaims | undefined;
    const callerDoc = await adminDb.doc(`employees/${decoded.uid}`).get();
    const callerRole = callerDoc.exists ? (callerDoc.data() as { role?: string })?.role : null;

    const isSuperAdmin = callerClaims?.role === 'super_admin';
    const isLegacyAdmin = callerRole === 'admin';

    if (!isSuperAdmin && !isLegacyAdmin) {
      return NextResponse.json({ error: 'Forbidden: admin or super_admin required' }, { status: 403 });
    }

    const body = (await request.json()) as Body;
    const targetUid = typeof body?.targetUid === 'string' ? body.targetUid.trim() : '';
    const role = body?.role;
    const companyId = body?.companyId;

    if (!targetUid || !role) {
      return NextResponse.json({ error: 'Missing required fields: targetUid, role' }, { status: 400 });
    }

    const validRoles: TenantRole[] = ['super_admin', 'admin', 'manager', 'employee'];
    if (!validRoles.includes(role)) {
      return NextResponse.json({ error: `Invalid role. Must be one of: ${validRoles.join(', ')}` }, { status: 400 });
    }

    if (role === 'super_admin' && !isSuperAdmin) {
      return NextResponse.json({ error: 'Only super_admin can grant super_admin role' }, { status: 403 });
    }

    if (role !== 'super_admin' && !companyId) {
      return NextResponse.json({ error: 'companyId is required for non-super_admin roles' }, { status: 400 });
    }

    const claims: TenantClaims = { role };
    if (companyId) {
      claims.companyId = companyId;
    }

    await adminAuth.setCustomUserClaims(targetUid, claims);

    return NextResponse.json({ success: true, claims });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
