import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdminAuth, getFirebaseAdminFirestore } from '@/lib/firebase-admin';
import type { TenantClaims } from '@/types/company';
import { checkRateLimit } from '@/lib/api/rate-limiter';

function getBearerToken(req: Request): string | null {
  const header = req.headers.get('authorization') || req.headers.get('Authorization') || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1] || null;
}

/**
 * POST /api/auth/ensure-claims
 *
 * For existing users who don't yet have custom claims (pre-SaaS migration).
 * Looks up the user's employee doc to find their companyId and role,
 * then sets custom claims accordingly.
 *
 * If no companyId is found, tries to find/create a default company
 * from the legacy company/profile doc.
 */
export async function POST(request: NextRequest) {
  try {
    const token = getBearerToken(request);
    if (!token) {
      return NextResponse.json({ error: 'Missing token' }, { status: 401 });
    }

    const adminAuth = getFirebaseAdminAuth();
    const db = getFirebaseAdminFirestore();

    let decoded: { uid: string; email?: string };
    try {
      decoded = (await adminAuth.verifyIdToken(token)) as { uid: string; email?: string };
    } catch {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const rateLimited = checkRateLimit(decoded.uid, '/api/auth/ensure-claims', 'auth');
    if (rateLimited) return rateLimited;

    const existingUser = await adminAuth.getUser(decoded.uid);
    const existingClaims = existingUser.customClaims as TenantClaims | undefined;

    // super_admin has no companyId — never overwrite
    if (existingClaims?.role === 'super_admin') {
      return NextResponse.json({
        status: 'already_set',
        claims: existingClaims,
      });
    }

    if (existingClaims?.companyId && existingClaims?.role) {
      return NextResponse.json({
        status: 'already_set',
        claims: existingClaims,
      });
    }

    // Check top-level employees doc for legacy data
    const empSnap = await db.doc(`employees/${decoded.uid}`).get();
    const empData = empSnap.exists ? (empSnap.data() as { role?: string; companyId?: string }) : null;

    const companyId = empData?.companyId || null;
    let role: 'admin' | 'employee' = empData?.role === 'admin' ? 'admin' : 'employee';

    // If employee doc doesn't say admin, check if the user owns the company
    if (companyId && role !== 'admin') {
      const companyDoc = await db.doc(`companies/${companyId}`).get();
      if (companyDoc.exists && companyDoc.data()?.ownerId === decoded.uid) {
        role = 'admin';
      }
    }

    // If no companyId found, the user has no company association.
    // They need to register a new company via /signup first.
    if (!companyId) {
      // Check if the user owns a company (by ownerId)
      const ownedSnap = await db.collection('companies')
        .where('ownerId', '==', decoded.uid)
        .limit(1)
        .get();

      if (!ownedSnap.empty) {
        const ownedCompanyId = ownedSnap.docs[0].id;
        const claims: TenantClaims = { role: 'admin', companyId: ownedCompanyId };
        await adminAuth.setCustomUserClaims(decoded.uid, claims);

        // Also update the employee doc
        if (empSnap.exists) {
          await db.doc(`employees/${decoded.uid}`).update({ companyId: ownedCompanyId });
        }

        return NextResponse.json({ status: 'claims_set', claims, companyId: ownedCompanyId });
      }

      // Also check if the user exists in any company's employees subcollection
      const companyEmployeeSnap = await db.collectionGroup('employees')
        .where('id', '==', decoded.uid)
        .limit(1)
        .get();

      if (!companyEmployeeSnap.empty) {
        const empPath = companyEmployeeSnap.docs[0].ref.path;
        // Path: companies/{companyId}/employees/{uid}
        const parts = empPath.split('/');
        const foundCompanyId = parts[1];
        const foundRole = (companyEmployeeSnap.docs[0].data().role as string) === 'admin' ? 'admin' : 'employee';

        const claims: TenantClaims = { role: foundRole as 'admin' | 'employee', companyId: foundCompanyId };
        await adminAuth.setCustomUserClaims(decoded.uid, claims);

        return NextResponse.json({ status: 'claims_set', claims, companyId: foundCompanyId });
      }

      return NextResponse.json({
        error: 'No company association found. Please register a company first.',
      }, { status: 404 });
    }

    const claims: TenantClaims = {
      role: role as 'admin' | 'employee',
      companyId,
    };

    await adminAuth.setCustomUserClaims(decoded.uid, claims);

    return NextResponse.json({
      status: 'claims_set',
      claims,
      companyId,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Internal Server Error';
    console.error('[ensure-claims] Error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
