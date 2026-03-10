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

    // Custom claims are embedded in the ID token — check there first
    // to avoid an extra getUser() round-trip that can fail if the Admin SDK
    // credentials don't have full IAM permissions.
    if (decoded.role === 'super_admin') {
      return { uid: decoded.uid };
    }

    // Fallback: fetch fresh claims via getUser() in case the token
    // was issued before the latest setCustomUserClaims call.
    try {
      const user = await adminAuth.getUser(decoded.uid);
      const claims = user.customClaims as { role?: string } | undefined;
      if (claims?.role === 'super_admin') {
        return { uid: decoded.uid };
      }
    } catch (getUserErr) {
      console.warn('[super-admin auth] getUser fallback failed:', getUserErr);
    }

    return NextResponse.json({ error: 'Forbidden: super_admin role required' }, { status: 403 });
  } catch (err) {
    console.error('[super-admin auth] verifyIdToken failed:', err);
    return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
  }
}
