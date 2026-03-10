import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdminFirestore } from '@/lib/firebase-admin';
import { requireSuperAdmin } from '../lib/auth-guard';
import { PLAN_DEFINITIONS, type PlanDefinition } from '@/types/company';

const PRICING_DOC_PATH = 'platform/pricing_plans';

/**
 * GET /api/super-admin/pricing
 * Returns current pricing plans. Falls back to hardcoded PLAN_DEFINITIONS if none saved.
 */
export async function GET(request: NextRequest) {
  const authResult = await requireSuperAdmin(request);
  if (authResult instanceof NextResponse) return authResult;

  const db = getFirebaseAdminFirestore();
  const doc = await db.doc(PRICING_DOC_PATH).get();

  if (doc.exists) {
    const data = doc.data();
    return NextResponse.json({
      plans: data?.plans ?? [],
      updatedAt: data?.updatedAt?.toDate?.()?.toISOString() ?? null,
      updatedBy: data?.updatedBy ?? null,
    });
  }

  return NextResponse.json({
    plans: PLAN_DEFINITIONS,
    updatedAt: null,
    updatedBy: null,
  });
}

/**
 * PUT /api/super-admin/pricing
 * Save updated pricing plans.
 */
export async function PUT(request: NextRequest) {
  const authResult = await requireSuperAdmin(request);
  if (authResult instanceof NextResponse) return authResult;

  let body: { plans: PlanDefinition[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!Array.isArray(body.plans) || body.plans.length === 0) {
    return NextResponse.json({ error: 'plans array is required' }, { status: 400 });
  }

  for (const plan of body.plans) {
    if (!plan.id || !plan.name || plan.price == null || !plan.limits || !Array.isArray(plan.modules)) {
      return NextResponse.json(
        { error: `Invalid plan definition: ${plan.id || 'unknown'}` },
        { status: 400 }
      );
    }
  }

  const db = getFirebaseAdminFirestore();
  const { FieldValue } = await import('firebase-admin/firestore');

  await db.doc(PRICING_DOC_PATH).set({
    plans: body.plans,
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: authResult.uid,
  });

  return NextResponse.json({ success: true });
}
