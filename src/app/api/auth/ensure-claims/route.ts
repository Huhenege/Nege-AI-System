import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdminAuth, getFirebaseAdminFirestore } from '@/lib/firebase-admin';
import type { TenantClaims } from '@/types/company';
import { checkRateLimit } from '@/lib/api/rate-limiter';
import type { QueryDocumentSnapshot } from 'firebase-admin/firestore';

function getBearerToken(req: Request): string | null {
  const header = req.headers.get('authorization') || req.headers.get('Authorization') || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1] || null;
}

/**
 * POST /api/auth/ensure-claims
 *
 * For users who don't yet have custom claims.
 * Finds the user's tenant-scoped employee doc to determine companyId and role,
 * then sets custom claims accordingly.
 *
 * Strategy order:
 *   1. Check if user owns a company (companies.ownerId == uid)
 *   2. Collection group query on employees (requires COLLECTION_GROUP index on 'id')
 *   3. Direct doc lookup — scan companies for employee doc by uid
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

    // Strategy 1: Check if the user owns a company
    const ownedSnap = await db.collection('companies')
      .where('ownerId', '==', decoded.uid)
      .limit(1)
      .get();

    if (!ownedSnap.empty) {
      const ownedCompanyId = ownedSnap.docs[0].id;
      const claims: TenantClaims = { role: 'company_super_admin', companyId: ownedCompanyId };
      await adminAuth.setCustomUserClaims(decoded.uid, claims);
      return NextResponse.json({ status: 'claims_set', claims, companyId: ownedCompanyId });
    }

    // Strategy 2: Collection group query (requires COLLECTION_GROUP index on 'id')
    try {
      const companyEmployeeSnap = await db.collectionGroup('employees')
        .where('id', '==', decoded.uid)
        .limit(1)
        .get();

      if (!companyEmployeeSnap.empty) {
        const empDoc = companyEmployeeSnap.docs[0];
        const parts = empDoc.ref.path.split('/');
        const foundCompanyId = parts[1];
        const foundEmpData = empDoc.data();
        const preservedRoles = ['company_super_admin', 'admin', 'manager'];
        const foundRole = preservedRoles.includes(foundEmpData.role) ? foundEmpData.role : 'employee';

        const claims: TenantClaims = { role: foundRole as TenantClaims['role'], companyId: foundCompanyId };
        if (foundEmpData.positionId) {
          claims.positionId = foundEmpData.positionId as string;
        }
        await adminAuth.setCustomUserClaims(decoded.uid, claims);
        return NextResponse.json({ status: 'claims_set', claims, companyId: foundCompanyId });
      }
    } catch (cgError) {
      console.warn('[ensure-claims] collectionGroup query failed:', cgError);
    }

    // Strategy 3: Direct doc lookup — paginated scan of all companies
    try {
      let lastDoc: QueryDocumentSnapshot | undefined;
      const PAGE_SIZE = 100;

      while (true) {
        let q = db.collection('companies').orderBy('__name__').limit(PAGE_SIZE);
        if (lastDoc) q = q.startAfter(lastDoc);
        const companiesSnap = await q.get();
        if (companiesSnap.empty) break;

        for (const companyDoc of companiesSnap.docs) {
          const directEmpSnap = await db
            .doc(`companies/${companyDoc.id}/employees/${decoded.uid}`)
            .get();
          if (directEmpSnap.exists) {
            const directEmpData = directEmpSnap.data() as { role?: string; positionId?: string };
            const preservedRoles = ['company_super_admin', 'admin', 'manager'];
            const foundRole = preservedRoles.includes(directEmpData?.role || '') ? directEmpData!.role! : 'employee';

            const claims: TenantClaims = { role: foundRole as TenantClaims['role'], companyId: companyDoc.id };
            if (directEmpData?.positionId) {
              claims.positionId = directEmpData.positionId;
            }
            await adminAuth.setCustomUserClaims(decoded.uid, claims);
            return NextResponse.json({ status: 'claims_set', claims, companyId: companyDoc.id });
          }
        }

        lastDoc = companiesSnap.docs[companiesSnap.docs.length - 1];
        if (companiesSnap.size < PAGE_SIZE) break;
      }
    } catch (fallbackError) {
      console.warn('[ensure-claims] Company scan fallback failed:', fallbackError);
    }

    return NextResponse.json({
      error: 'Энэ хэрэглэгч ямар нэг байгууллагад бүртгэгдээгүй байна. Бүртгүүлэх хэсгээс шинэ байгууллага үүсгэнэ үү.',
    }, { status: 404 });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Internal Server Error';
    console.error('[ensure-claims] Error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
