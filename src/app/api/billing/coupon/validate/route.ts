import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdminAuth, getFirebaseAdminFirestore } from '@/lib/firebase-admin';
import type { TenantClaims, CompanyPlan, Coupon, CouponValidationResult } from '@/types/company';
import { getDynamicPlanDefinition } from '@/lib/pricing/get-pricing-plans';

/**
 * GET /api/billing/coupon/validate?code=NEGE50&plan=pro&billingCycle=monthly
 *
 * Coupon код шалгаж, хөнгөлтийн дүн тооцоолно.
 * Auth: Bearer token шаардлагатай (company admin)
 */
export async function GET(request: NextRequest) {
    try {
        const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
        if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const adminAuth = getFirebaseAdminAuth();
        const decoded = await adminAuth.verifyIdToken(token);
        const user = await adminAuth.getUser(decoded.uid);
        const claims = user.customClaims as TenantClaims | undefined;

        if (!claims?.companyId) return NextResponse.json({ error: 'No company' }, { status: 400 });

        const { searchParams } = new URL(request.url);
        const code = searchParams.get('code')?.trim().toUpperCase();
        const plan = searchParams.get('plan') as CompanyPlan | null;
        const billingCycle = (searchParams.get('billingCycle') || 'monthly') as 'monthly' | 'yearly';

        if (!code || !plan) {
            return NextResponse.json({ error: 'code болон plan шаардлагатай' }, { status: 400 });
        }

        const db = getFirebaseAdminFirestore();

        // ── 1. Coupon татах ──
        const couponSnap = await db.doc(`platform/config/coupons/${code}`).get();
        if (!couponSnap.exists) {
            return NextResponse.json({ valid: false, error: 'Хөнгөлтийн код олдсонгүй' });
        }

        const coupon = couponSnap.data() as Coupon;
        const now = new Date();

        // ── 2. Шалгалтууд ──
        if (!coupon.isActive) {
            return NextResponse.json({ valid: false, error: 'Энэ код идэвхгүй байна' });
        }

        if (coupon.validFrom && new Date(coupon.validFrom) > now) {
            return NextResponse.json({ valid: false, error: 'Энэ код эхлэх хугацаа болоогүй байна' });
        }

        if (coupon.validUntil && new Date(coupon.validUntil) < now) {
            return NextResponse.json({ valid: false, error: 'Хөнгөлтийн кодны хугацаа дууссан байна' });
        }

        if (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses) {
            return NextResponse.json({ valid: false, error: 'Хөнгөлтийн код дуусгавар болсон байна' });
        }

        if (coupon.applicablePlans !== null && !coupon.applicablePlans.includes(plan)) {
            return NextResponse.json({ valid: false, error: `Энэ код зөвхөн ${coupon.applicablePlans.join(', ')} багцад хамаарна` });
        }

        // ── 3. Нэг компани давтан ашиглаагүй эсэх ──
        const usageSnap = await db.doc(`companies/${claims.companyId}/coupon_usage/${code}`).get();
        if (usageSnap.exists) {
            return NextResponse.json({ valid: false, error: 'Та энэ кодыг аль хэдийн ашигласан байна' });
        }

        // ── 4. Үнэ тооцоолол ──
        const planDef = await getDynamicPlanDefinition(plan);
        const baseAmount = billingCycle === 'yearly' ? planDef.price * 10 : planDef.price;

        let discountAmount = 0;
        if (coupon.type === 'percent') {
            discountAmount = Math.round(baseAmount * (coupon.value / 100));
        } else {
            discountAmount = Math.min(coupon.value, baseAmount);
        }
        const finalAmount = Math.max(0, baseAmount - discountAmount);

        const result: CouponValidationResult = {
            valid: true,
            code,
            type: coupon.type,
            value: coupon.value,
            discountAmount,
            originalAmount: baseAmount,
            finalAmount,
            description: coupon.description,
        };

        return NextResponse.json(result);

    } catch (e: unknown) {
        console.error('[billing/coupon/validate]', e);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
