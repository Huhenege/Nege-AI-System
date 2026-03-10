import { NextResponse } from 'next/server';
import { getDynamicPlanDefinitions } from '@/lib/pricing/get-pricing-plans';

/**
 * GET /api/pricing
 * Public endpoint — returns current pricing plan definitions.
 * Super-admin-configured plans from Firestore, with hardcoded fallback.
 */
export async function GET() {
  try {
    const plans = await getDynamicPlanDefinitions();
    return NextResponse.json({ plans });
  } catch (err) {
    console.error('[api/pricing]', err);
    return NextResponse.json({ error: 'Failed to load plans' }, { status: 500 });
  }
}
