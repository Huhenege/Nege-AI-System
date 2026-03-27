import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdminAuth, getFirebaseAdminFirestore } from '@/lib/firebase-admin';
import { checkRateLimit } from '@/lib/api/rate-limiter';
import { FieldValue } from 'firebase-admin/firestore';
import { z } from 'zod';

// ─── Input schema ─────────────────────────────────────────────────────────────

const SetupBodySchema = z.object({
  /** Step 1: company profile */
  company: z
    .object({
      phone: z.string().max(30).optional(),
      address: z.string().max(200).optional(),
      description: z.string().max(500).optional(),
    })
    .optional(),

  /** Step 2: first department */
  department: z
    .object({
      name: z.string().trim().min(1).max(100),
      color: z.string().max(20).optional().default('#3b82f6'),
    })
    .optional(),

  /** Step 3: first position */
  position: z
    .object({
      title: z.string().trim().min(1).max(100),
      departmentId: z.string().optional(),
    })
    .optional(),

  /** Mark setup as complete */
  markComplete: z.boolean().optional(),
});

type SetupBody = z.infer<typeof SetupBodySchema>;

function getBearerToken(req: Request): string | null {
  const header = req.headers.get('authorization') || req.headers.get('Authorization') || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1] || null;
}

/**
 * POST /api/setup
 *
 * Handles all setup wizard Firestore writes via Admin SDK.
 * This avoids the race condition where the Firestore client SDK fires
 * requests before the refreshed ID token (with custom claims) is propagated,
 * resulting in permission-denied errors right after signup.
 *
 * The Admin SDK bypasses security rules entirely — auth is enforced here
 * by verifying the ID token and checking that the user belongs to the company.
 */
export async function POST(request: NextRequest) {
  // ── Auth ─────────────────────────────────────────────────────────────────
  const token = getBearerToken(request);
  if (!token) {
    return NextResponse.json({ error: 'Missing Authorization bearer token' }, { status: 401 });
  }

  const adminAuth = getFirebaseAdminAuth();
  const db = getFirebaseAdminFirestore();

  let decoded: { uid: string; companyId?: string; role?: string };
  try {
    decoded = (await adminAuth.verifyIdToken(token)) as {
      uid: string;
      companyId?: string;
      role?: string;
    };
  } catch {
    return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
  }

  // ── Rate limit ────────────────────────────────────────────────────────────
  const rateLimited = checkRateLimit(decoded.uid, '/api/setup', {
    limit: 30,
    windowSeconds: 60,
  });
  if (rateLimited) return rateLimited;

  // ── Resolve companyId from token or Firestore ─────────────────────────────
  let companyId = decoded.companyId;

  if (!companyId) {
    // Claims not yet in token — look up by ownerId (just registered)
    const ownedSnap = await db
      .collection('companies')
      .where('ownerId', '==', decoded.uid)
      .limit(1)
      .get();
    if (!ownedSnap.empty) {
      companyId = ownedSnap.docs[0].id;
    }
  }

  if (!companyId) {
    return NextResponse.json(
      { error: 'Байгууллага олдсонгүй. Дахин нэвтэрнэ үү.' },
      { status: 404 }
    );
  }

  // ── Verify the company exists and the user is its admin ───────────────────
  const companyRef = db.collection('companies').doc(companyId);
  const companySnap = await companyRef.get();
  if (!companySnap.exists) {
    return NextResponse.json({ error: 'Байгууллага олдсонгүй.' }, { status: 404 });
  }

  const companyData = companySnap.data()!;
  const allowedRoles = ['company_super_admin', 'admin', 'super_admin'];
  const isAdmin =
    companyData.ownerId === decoded.uid ||
    (decoded.role && allowedRoles.includes(decoded.role));

  if (!isAdmin) {
    // Double-check via employee subcollection
    const empSnap = await db
      .doc(`companies/${companyId}/employees/${decoded.uid}`)
      .get();
    const empRole = empSnap.data()?.role as string | undefined;
    if (!empSnap.exists || !allowedRoles.includes(empRole || '')) {
      return NextResponse.json({ error: 'Зөвшөөрөл байхгүй.' }, { status: 403 });
    }
  }

  // ── Parse body ────────────────────────────────────────────────────────────
  let body: SetupBody;
  try {
    const raw = await request.json();
    body = SetupBodySchema.parse(raw);
  } catch (err) {
    const message =
      err instanceof z.ZodError
        ? err.errors.map((e) => e.message).join('; ')
        : 'Хүсэлтийн өгөгдөл буруу байна.';
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const result: Record<string, unknown> = { companyId };

  // ── Step 1: Save company profile ──────────────────────────────────────────
  if (body.company) {
    await db
      .doc(`companies/${companyId}/company/profile`)
      .set(
        {
          name: companyData.name || '',
          phone: body.company.phone || '',
          address: body.company.address || '',
          description: body.company.description || '',
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    result.companySaved = true;
  }

  // ── Step 2: Create department ─────────────────────────────────────────────
  if (body.department) {
    const deptRef = db.collection(`companies/${companyId}/departments`).doc();
    await deptRef.set({
      name: body.department.name,
      color: body.department.color ?? '#3b82f6',
      description: '',
      isActive: true,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    result.departmentId = deptRef.id;
  }

  // ── Step 3: Create position ───────────────────────────────────────────────
  if (body.position) {
    const posRef = db.collection(`companies/${companyId}/positions`).doc();
    await posRef.set({
      title: body.position.title,
      departmentId: body.position.departmentId || '',
      isActive: true,
      isApproved: true,
      headcount: 1,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    result.positionId = posRef.id;
  }

  // ── Mark setup complete ───────────────────────────────────────────────────
  if (body.markComplete) {
    await companyRef.update({
      setupComplete: true,
      updatedAt: FieldValue.serverTimestamp(),
    });
    result.setupComplete = true;
  }

  return NextResponse.json({ success: true, ...result });
}
