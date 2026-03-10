import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdminAuth, getFirebaseAdminFirestore } from '@/lib/firebase-admin';
import {
  CompanyPlan,
  SaaSModule,
  ModuleConfig,
  TenantClaims,
} from '@/types/company';
import { getDynamicPlanDefinition } from '@/lib/pricing/get-pricing-plans';
import { FieldValue } from 'firebase-admin/firestore';

type Body = {
  companyName?: string;
  plan?: CompanyPlan;
  domain?: string;
};

function getBearerToken(req: Request): string | null {
  const header = req.headers.get('authorization') || req.headers.get('Authorization') || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1] || null;
}

/**
 * POST /api/companies/register
 * Creates a new Company (tenant) + sets custom claims on the caller.
 * Called right after Firebase Auth signup.
 */
export async function POST(request: NextRequest) {
  try {
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

    const body = (await request.json()) as Body;
    const companyName = typeof body?.companyName === 'string' ? body.companyName.trim() : '';
    if (!companyName) {
      return NextResponse.json({ error: 'companyName is required' }, { status: 400 });
    }

    const plan: CompanyPlan = body?.plan ?? 'free';
    const def = await getDynamicPlanDefinition(plan);

    const modules: Record<string, ModuleConfig> = {};
    for (const m of def.modules) {
      modules[m] = { enabled: true, enabledAt: new Date().toISOString() };
    }

    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + 14);

    const companyRef = db.collection('companies').doc();
    const companyId = companyRef.id;

    const companyData = {
      name: companyName,
      email: decoded.email || '',
      domain: body?.domain || '',
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
      role: 'admin',
      firstName: 'Admin',
      lastName: 'User',
      jobTitle: 'Системийн Админ',
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
    // Also keep a top-level employee doc for backward compatibility during migration
    batch.set(db.collection('employees').doc(decoded.uid), { ...employeeData }, { merge: true });
    await batch.commit();

    const claims: TenantClaims = { role: 'admin', companyId };
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
