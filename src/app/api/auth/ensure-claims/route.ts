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
 * For users who don't yet have custom claims (e.g. after password reset or
 * first login on a new device).
 *
 * Lookup strategy:
 *   1. Return early if claims are already set and valid.
 *   2. Check if user owns a company (companies.ownerId == uid).
 *   3. Collection-group query on `employees` subcollection (requires a
 *      Firestore composite index on collectionGroup=employees, field=id ASC).
 *
 * NOTE: The previous Strategy 3 (full company scan) has been removed.
 * It was O(n) in the number of companies and prohibitively expensive at scale.
 * If the collection-group index is not yet deployed, Strategy 3's removal means
 * users without an `ownerId` match will receive a 404 until the index is live.
 * Deploy the index via `firestore.indexes.json` before rolling this out.
 */
export async function POST(request: NextRequest) {
  try {
    // ── 1. Auth ──────────────────────────────────────────────────────────────
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

    // ── 2. Rate limit: 20 req / 60 s per UID ────────────────────────────────
    const rateLimited = checkRateLimit(decoded.uid, '/api/auth/ensure-claims', 'auth');
    if (rateLimited) return rateLimited;

    // ── 3. Short-circuit: claims already present ─────────────────────────────
    const existingUser = await adminAuth.getUser(decoded.uid);
    const existingClaims = existingUser.customClaims as TenantClaims | undefined;

    if (existingClaims?.role === 'super_admin') {
      return NextResponse.json({ status: 'already_set', claims: existingClaims });
    }

    if (existingClaims?.companyId && existingClaims?.role) {
      return NextResponse.json({ status: 'already_set', claims: existingClaims });
    }

    // ── 4. Strategy 1: user owns a company ───────────────────────────────────
    const ownedSnap = await db
      .collection('companies')
      .where('ownerId', '==', decoded.uid)
      .limit(1)
      .get();

    if (!ownedSnap.empty) {
      const ownedCompanyId = ownedSnap.docs[0].id;
      const claims: TenantClaims = { role: 'company_super_admin', companyId: ownedCompanyId };
      await adminAuth.setCustomUserClaims(decoded.uid, claims);
      return NextResponse.json({ status: 'claims_set', claims, companyId: ownedCompanyId });
    }

    // ── 5. Strategy 2: collection-group query (index required) ───────────────
    // Firestore index: collectionGroup=employees, queryScope=COLLECTION_GROUP, field=id ASC
    const companyEmployeeSnap = await db
      .collectionGroup('employees')
      .where('id', '==', decoded.uid)
      .limit(1)
      .get();

    if (!companyEmployeeSnap.empty) {
      const empDoc = companyEmployeeSnap.docs[0];
      // Path shape: companies/{companyId}/employees/{uid}
      const parts = empDoc.ref.path.split('/');
      const foundCompanyId = parts[1];
      const foundEmpData = empDoc.data();

      const preservedRoles = ['company_super_admin', 'admin', 'manager'];
      const foundRole = preservedRoles.includes(foundEmpData.role)
        ? (foundEmpData.role as TenantClaims['role'])
        : 'employee';

      const claims: TenantClaims = { role: foundRole, companyId: foundCompanyId };
      if (foundEmpData.positionId) {
        claims.positionId = foundEmpData.positionId as string;
      }

      await adminAuth.setCustomUserClaims(decoded.uid, claims);
      return NextResponse.json({ status: 'claims_set', claims, companyId: foundCompanyId });
    }

    // ── 6. Not found ──────────────────────────────────────────────────────────
    return NextResponse.json(
      {
        error:
          'Энэ хэрэглэгч ямар нэг байгууллагад бүртгэгдээгүй байна. Бүртгүүлэх хэсгээс шинэ байгууллага үүсгэнэ үү.',
      },
      { status: 404 }
    );
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Internal Server Error';
    console.error('[ensure-claims] Error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
