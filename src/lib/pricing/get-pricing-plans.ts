import 'server-only';

import { getFirebaseAdminFirestore } from '@/lib/firebase-admin';
import { PLAN_DEFINITIONS, type PlanDefinition, type CompanyPlan } from '@/types/company';

const PRICING_DOC_PATH = 'platform/pricing_plans';

let cachedPlans: PlanDefinition[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 60_000; // 1 min

/** Super admin pricing save хийсний дараа cache-г flush хийнэ */
export function invalidatePricingCache() {
    cachedPlans = null;
    cacheTimestamp = 0;
}

/**
 * Fetch pricing plans from Firestore, with in-memory cache and hardcoded fallback.
 * Safe for use in any server-side context (API routes, server components).
 */
export async function getDynamicPlanDefinitions(): Promise<PlanDefinition[]> {
  const now = Date.now();
  if (cachedPlans && now - cacheTimestamp < CACHE_TTL_MS) {
    return cachedPlans;
  }

  try {
    const db = getFirebaseAdminFirestore();
    const doc = await db.doc(PRICING_DOC_PATH).get();

    if (doc.exists) {
      const data = doc.data();
      if (Array.isArray(data?.plans) && data.plans.length > 0) {
        cachedPlans = data.plans as PlanDefinition[];
        cacheTimestamp = now;
        return cachedPlans;
      }
    }
  } catch (err) {
    console.warn('[pricing] Failed to fetch dynamic plans, using defaults:', err);
  }

  return PLAN_DEFINITIONS;
}

/**
 * Get a single plan definition by ID (dynamic version).
 */
export async function getDynamicPlanDefinition(plan: CompanyPlan): Promise<PlanDefinition> {
  const plans = await getDynamicPlanDefinitions();
  return plans.find((p) => p.id === plan) ?? PLAN_DEFINITIONS[0];
}
