import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdminAuth } from '@/lib/firebase-admin';

/**
 * Verify the request comes from a super_admin.
 * Returns decoded uid on success, or a NextResponse error.
 */
export async function requireSuperAdmin(
  request: NextRequest
): Promise<{ uid: string } | NextResponse> {
  const header = request.headers.get('authorization') || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  const token = match?.[1];

  if (!token) {
    return NextResponse.json({ error: 'Missing Authorization bearer token' }, { status: 401 });
  }

  try {
    const adminAuth = getFirebaseAdminAuth();
    const decoded = await adminAuth.verifyIdToken(token);
    const user = await adminAuth.getUser(decoded.uid);
    const claims = user.customClaims as { role?: string } | undefined;

    if (claims?.role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden: super_admin role required' }, { status: 403 });
    }

    return { uid: decoded.uid };
  } catch (err) {
    console.error('[super-admin auth]', err);
    return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
  }
}
