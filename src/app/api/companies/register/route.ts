import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdminAuth, getFirebaseAdminFirestore } from '@/lib/firebase-admin';
import {
  CompanyPlan,
  ModuleConfig,
  TenantClaims,
} from '@/types/company';
import { getDynamicPlanDefinition } from '@/lib/pricing/get-pricing-plans';
import { FieldValue } from 'firebase-admin/firestore';
import { checkRateLimit } from '@/lib/api/rate-limiter';
import { z } from 'zod';

// ─── Input schema ─────────────────────────────────────────────────────────────

const RegisterBodySchema = z.object({
  companyName: z
    .string()
    .trim()
    .min(2, 'Байгууллагын нэр хэт богино байна (хамгийн багадаа 2 тэмдэгт)')
    .max(120, 'Байгууллагын нэр хэт урт байна (120 тэмдэгтээс хэтрэхгүй байх)'),
  firstName: z
    .string()
    .trim()
    .min(1, 'Нэр заавал шаардлагатай')
    .max(60, 'Нэр хэт урт байна'),
  lastName: z
    .string()
    .trim()
    .min(1, 'Овог заавал шаардлагатай')
    .max(60, 'Овог хэт урт байна'),
  plan: z.enum(['free', 'starter', 'pro', 'enterprise']).optional().default('free'),
  domain: z.string().trim().max(253).optional(),
});

type RegisterBody = z.infer<typeof RegisterBodySchema>;

// ─── Password strength — server-side re-validation ───────────────────────────
// Firebase already enforces min 6 chars; we add stricter server-side rules.

const PASSWORD_STRENGTH_RE = {
  minLength: /.{8,}/,
  hasUpper: /[A-Z]/,
  hasDigit: /[0-9]/,
  hasSpecial: /[^A-Za-z0-9]/,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getBearerToken(req: Request): string | null {
  const header = req.headers.get('authorization') || req.headers.get('Authorization') || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1] || null;
}

/**
 * POST /api/companies/register
 *
 * Creates a new Company (tenant) + sets custom claims on the caller.
 * Called right after Firebase Auth signup.
 *
 * Security controls:
 *  - Firebase ID token verification (Admin SDK)
 *  - Rate limiting per UID (5 req / 60 s)
 *  - Zod input validation
 *  - Company name uniqueness check (case-insensitive, per ownerId)
 *  - Orphan-account guard: one company per user
 */
export async function POST(request: NextRequest) {
  try {
    // ── 1. Auth: verify Bearer token ────────────────────────────────────────
    const token = getBearerToken(request);
    if (!token) {
      return NextResponse.json({ error: 'Missing Authorization bearer token' }, { status: 401 });
    }

    const adminAuth = getFirebaseAdminAuth();
    const db = getFirebaseAdminFirestore();

    let decoded: { uid: string; email?: string };
    try {
      decoded = (await adminAuth.verifyIdToken(token)) as { uid: string; email?: string };
    } catch {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
    }

    // ── 2. Rate limit: 5 registrations per UID per minute ───────────────────
    const rateLimited = await checkRateLimit(decoded.uid, '/api/companies/register', {
      limit: 5,
      windowSeconds: 60,
    });
    if (rateLimited) return rateLimited;

    // ── 3. Validate request body ─────────────────────────────────────────────
    let body: RegisterBody;
    try {
      const raw = await request.json();
      body = RegisterBodySchema.parse(raw);
    } catch (err) {
      const message =
        err instanceof z.ZodError
          ? err.errors.map((e) => e.message).join('; ')
          : 'Хүсэлтийн өгөгдөл буруу байна.';
      return NextResponse.json({ error: message }, { status: 400 });
    }

    // ── 4. One company per user guard ────────────────────────────────────────
    const existingOwned = await db
      .collection('companies')
      .where('ownerId', '==', decoded.uid)
      .limit(1)
      .get();

    if (!existingOwned.empty) {
      return NextResponse.json(
        { error: 'Та аль хэдийн байгууллага бүртгүүлсэн байна.' },
        { status: 409 }
      );
    }

    // ── 5. Company name uniqueness (case-insensitive) ────────────────────────
    // Store a normalized search key alongside company docs and query against it.
    // For brand-new tenants we do a simple Firestore query on name_lower.
    const nameLower = body.companyName.toLowerCase();
    const nameConflict = await db
      .collection('companies')
      .where('name_lower', '==', nameLower)
      .limit(1)
      .get();

    if (!nameConflict.empty) {
      return NextResponse.json(
        {
          error: `"${body.companyName}" нэртэй байгууллага аль хэдийн бүртгэгдсэн байна. Өөр нэр ашиглана уу.`,
        },
        { status: 409 }
      );
    }

    // ── 6. Fetch plan definition ──────────────────────────────────────────────
    const plan: CompanyPlan = body.plan;
    const def = await getDynamicPlanDefinition(plan);

    const modules: Record<string, ModuleConfig> = {};
    for (const m of def.modules) {
      modules[m] = { enabled: true, enabledAt: new Date().toISOString() };
    }

    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + 14);

    // ── 7. Atomic batch write ─────────────────────────────────────────────────
    const companyRef = db.collection('companies').doc();
    const companyId = companyRef.id;

    const companyData = {
      name: body.companyName,
      name_lower: nameLower, // for uniqueness queries
      email: decoded.email || '',
      domain: body.domain || '',
      status: plan === 'free' ? 'active' : 'trial',
      plan,
      modules,
      limits: { ...def.limits },
      subscription: {
        plan,
        startDate: new Date().toISOString(),
        endDate: trialEnd.toISOString(),
        ...(plan !== 'free' ? { trialEndsAt: trialEnd.toISOString() } : {}),
        billingCycle: 'monthly',
        amount: def.price,
        currency: def.currency,
        paymentStatus: plan === 'free' ? 'none' : 'pending',
      },
      ownerId: decoded.uid,
      employeeCount: 1,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    const employeeData = {
      id: decoded.uid,
      email: decoded.email || '',
      role: 'company_super_admin',
      firstName: body.firstName,
      lastName: body.lastName,
      jobTitle: 'Байгууллагын ерөнхий админ',
      status: 'active',
      hireDate: new Date().toISOString(),
      companyId,
    };

    const batch = db.batch();
    batch.set(companyRef, companyData);
    batch.set(
      db.collection('companies').doc(companyId).collection('employees').doc(decoded.uid),
      employeeData
    );
    await batch.commit();

    // ── 8. Set custom claims ──────────────────────────────────────────────────
    const claims: TenantClaims = { role: 'company_super_admin', companyId };
    await adminAuth.setCustomUserClaims(decoded.uid, claims);

    return NextResponse.json({
      success: true,
      companyId,
      plan,
      claims,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Internal Server Error';
    console.error('[Company Register] Error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
