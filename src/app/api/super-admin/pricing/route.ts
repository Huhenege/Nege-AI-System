import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdminFirestore } from '@/lib/firebase-admin';
import { requireSuperAdmin } from '../lib/auth-guard';
import { PLAN_DEFINITIONS, BASE_MODULES, type PlanDefinition } from '@/types/company';
import { invalidatePricingCache } from '@/lib/pricing/get-pricing-plans';

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
    // BASE_MODULES нь бүх планд заавал байх ёстой — хасах боломжгүй
    const missingBase = BASE_MODULES.filter(m => !plan.modules.includes(m));
    if (missingBase.length > 0) {
      return NextResponse.json(
        { error: `Plan '${plan.id}' is missing required base modules: ${missingBase.join(', ')}` },
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

  // Server-side cache flush
  invalidatePricingCache();

  // ── Хуучин компаниудад limits + modules шинэчлэх ────────────────────────
  // Бүх идэвхтэй компаниудын limits-г шинэ план-д тохируулна.
  // modules-г хөндөхгүй (manual override-г хүндэтгэнэ).
  // Background-д ажиллуулна — request-г блоклохгүй.
  (async () => {
    try {
      const companiesSnap = await db.collection('companies')
        .where('status', 'in', ['active', 'trial'])
        .select('plan', 'limits')
        .get();

      const planMap = new Map(body.plans.map(p => [p.id, p]));
      const batch = db.batch();
      let count = 0;

      for (const doc of companiesSnap.docs) {
        const companyPlan = doc.data().plan;
        const newPlanDef = planMap.get(companyPlan);
        if (!newPlanDef) continue;

        batch.update(doc.ref, {
          limits: { ...newPlanDef.limits },
          updatedAt: new Date(),
        });
        count++;

        // Firestore batch 500 хязгаар
        if (count % 400 === 0) {
          await batch.commit();
        }
      }

      if (count % 400 !== 0) await batch.commit();

      console.log(`[pricing] Updated limits for ${count} companies`);
    } catch (e) {
      console.error('[pricing] Background limits update failed:', e);
    }
  })();

  return NextResponse.json({ success: true });
}
