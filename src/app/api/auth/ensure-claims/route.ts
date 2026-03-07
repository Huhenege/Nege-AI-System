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

    let companyId = empData?.companyId || null;
    const role = empData?.role === 'admin' ? 'admin' : 'employee';

    // If no companyId on employee, look for existing companies or create from legacy profile
    if (!companyId) {
      // Check if any company already exists
      const companiesSnap = await db.collection('companies').limit(1).get();

      if (!companiesSnap.empty) {
        companyId = companiesSnap.docs[0].id;
      } else {
        // Create a default company from legacy company/profile
        const profileSnap = await db.doc('company/profile').get();
        const profileData = profileSnap.exists
          ? (profileSnap.data() as { name?: string })
          : null;

        const companyRef = db.collection('companies').doc();
        companyId = companyRef.id;

        await companyRef.set({
          name: profileData?.name || 'My Company',
          email: decoded.email || '',
          status: 'active',
          plan: 'free',
          modules: {
            company: { enabled: true },
            organization: { enabled: true },
            employees: { enabled: true },
            projects: { enabled: true },
          },
          limits: {
            maxEmployees: 9999,
            maxProjects: 9999,
            maxDepartments: 999,
            maxStorageMB: 51200,
            aiQueriesPerMonth: 9999,
          },
          subscription: {
            plan: 'free',
            startDate: new Date().toISOString(),
            endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
            billingCycle: 'monthly',
            amount: 0,
            currency: 'MNT',
            paymentStatus: 'none',
          },
          ownerId: decoded.uid,
          employeeCount: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }

      // Update employee doc with companyId
      if (empSnap.exists) {
        await db.doc(`employees/${decoded.uid}`).update({ companyId });
      }
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
