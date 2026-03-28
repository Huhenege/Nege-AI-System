import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdminAuth, getFirebaseAdminFirestore } from '@/lib/firebase-admin';
import { createInvoice } from '@/lib/billing/qpay-client';
import { getDynamicPlanDefinitions } from '@/lib/pricing/get-pricing-plans';
import type { TenantClaims, CompanyPlan, Coupon } from '@/types/company';
import { checkRateLimit, getCallerIdentifier } from '@/lib/api/rate-limiter';
import { audit } from '@/lib/audit';

export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const adminAuth = getFirebaseAdminAuth();
    const decoded = await adminAuth.verifyIdToken(token);

    const rateLimited = await checkRateLimit(decoded.uid, '/api/billing/create-invoice', 'billing');
    if (rateLimited) return rateLimited;
    const user = await adminAuth.getUser(decoded.uid);
    const claims = user.customClaims as TenantClaims | undefined;

    if (!claims?.companyId) {
      return NextResponse.json({ error: 'No company' }, { status: 400 });
    }

    if (claims.role !== 'company_super_admin' && claims.role !== 'admin' && claims.role !== 'super_admin') {
      return NextResponse.json({ error: 'Admin required' }, { status: 403 });
    }

    const { plan, billingCycle, couponCode } = (await request.json()) as {
      plan: CompanyPlan;
      billingCycle?: 'monthly' | 'yearly';
      couponCode?: string;
    };

    const dynamicPlans = await getDynamicPlanDefinitions();
    const planDef = dynamicPlans.find((p) => p.id === plan);
    if (!planDef || plan === 'free') {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
    }

    const cycle = billingCycle || 'monthly';
    const baseAmount = cycle === 'yearly' ? planDef.price * 10 : planDef.price;
    const db = getFirebaseAdminFirestore();

    // ── Coupon хөнгөлт тооцоолох ──
    let discountAmount = 0;
    let finalAmount = baseAmount;
    let appliedCoupon: Coupon | null = null;

    if (couponCode) {
      const code = couponCode.trim().toUpperCase();
      const couponSnap = await db.doc(`platform/config/coupons/${code}`).get();

      if (couponSnap.exists) {
        const coupon = couponSnap.data() as Coupon;
        const now = new Date();
        const usageSnap = await db.doc(`companies/${claims.companyId}/coupon_usage/${code}`).get();

        const isValid =
          coupon.isActive &&
          (!coupon.validFrom || new Date(coupon.validFrom) <= now) &&
          (!coupon.validUntil || new Date(coupon.validUntil) >= now) &&
          (coupon.maxUses === null || coupon.usedCount < coupon.maxUses) &&
          (coupon.applicablePlans === null || coupon.applicablePlans.includes(plan)) &&
          !usageSnap.exists;

        if (isValid) {
          appliedCoupon = coupon;
          discountAmount = coupon.type === 'percent'
            ? Math.round(baseAmount * (coupon.value / 100))
            : Math.min(coupon.value, baseAmount);
          finalAmount = Math.max(0, baseAmount - discountAmount);
        }
      }
    }

    const amount = finalAmount;
    const invoiceNo = `NEGE-${claims.companyId}-${Date.now()}`;

    const description = appliedCoupon
      ? `Nege Systems - ${planDef.nameMN} багц (${cycle === 'yearly' ? 'жилийн' : 'сарын'}) — ${appliedCoupon.code} хөнгөлт`
      : `Nege Systems - ${planDef.nameMN} багц (${cycle === 'yearly' ? 'жилийн' : 'сарын'})`;

    const invoice = await createInvoice({
      senderInvoiceNo: invoiceNo,
      receiverCode: claims.companyId,
      description,
      amount: amount || 1, // QPay-д 0 дүн дамжуулах боломжгүй
    });

    // ── Invoice хадгалах ──
    await db.collection(`companies/${claims.companyId}/invoices`).doc(invoiceNo).set({
      invoiceNo,
      qpayInvoiceId: invoice.invoice_id,
      plan,
      billingCycle: cycle,
      originalAmount: baseAmount,
      discountAmount,
      amount,
      couponCode: appliedCoupon?.code ?? null,
      currency: 'MNT',
      status: 'pending',
      createdAt: new Date(),
      createdBy: decoded.uid,
    });

    audit(claims.companyId, { uid: decoded.uid, role: claims.role }, {
      action: 'create',
      resource: 'billing',
      resourceId: invoiceNo,
      description: `${planDef.nameMN} нэхэмжлэл үүсгэсэн (${amount.toLocaleString()}₮${discountAmount > 0 ? `, хөнгөлт: ${discountAmount.toLocaleString()}₮` : ''})`,
      metadata: { plan, billingCycle: cycle, amount, discountAmount, couponCode: appliedCoupon?.code },
    });

    return NextResponse.json({
      invoiceNo,
      qrImage: invoice.qr_image,
      qrText: invoice.qr_text,
      shortUrl: invoice.qPay_shortUrl,
      urls: invoice.urls,
      amount,
      originalAmount: baseAmount,
      discountAmount,
      couponApplied: appliedCoupon ? { code: appliedCoupon.code, description: appliedCoupon.description } : null,
    });
  } catch (e: unknown) {
    console.error('[billing/create-invoice]', e);
    const message = e instanceof Error ? e.message : 'Internal error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
