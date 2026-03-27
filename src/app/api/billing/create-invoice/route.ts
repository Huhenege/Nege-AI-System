import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdminAuth, getFirebaseAdminFirestore } from '@/lib/firebase-admin';
import { createInvoice } from '@/lib/billing/qpay-client';
import { getDynamicPlanDefinitions } from '@/lib/pricing/get-pricing-plans';
import type { TenantClaims, CompanyPlan } from '@/types/company';
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

    const { plan, billingCycle } = (await request.json()) as {
      plan: CompanyPlan;
      billingCycle?: 'monthly' | 'yearly';
    };

    const dynamicPlans = await getDynamicPlanDefinitions();
    const planDef = dynamicPlans.find((p) => p.id === plan);
    if (!planDef || plan === 'free') {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
    }

    const cycle = billingCycle || 'monthly';
    const amount = cycle === 'yearly' ? planDef.price * 10 : planDef.price;
    const invoiceNo = `NEGE-${claims.companyId}-${Date.now()}`;

    const invoice = await createInvoice({
      senderInvoiceNo: invoiceNo,
      receiverCode: claims.companyId,
      description: `Nege Systems - ${planDef.nameMN} багц (${cycle === 'yearly' ? 'жилийн' : 'сарын'})`,
      amount,
    });

    // Save invoice record
    const db = getFirebaseAdminFirestore();
    await db.collection(`companies/${claims.companyId}/invoices`).doc(invoiceNo).set({
      invoiceNo,
      qpayInvoiceId: invoice.invoice_id,
      plan,
      billingCycle: cycle,
      amount,
      currency: 'MNT',
      status: 'pending',
      createdAt: new Date(),
      createdBy: decoded.uid,
    });

    audit(claims.companyId, { uid: decoded.uid, role: claims.role }, {
      action: 'create',
      resource: 'billing',
      resourceId: invoiceNo,
      description: `${planDef.nameMN} багц нэхэмжлэл үүсгэсэн (${amount.toLocaleString()}₮)`,
      metadata: { plan, billingCycle: cycle, amount },
    });

    return NextResponse.json({
      invoiceNo,
      qrImage: invoice.qr_image,
      qrText: invoice.qr_text,
      shortUrl: invoice.qPay_shortUrl,
      urls: invoice.urls,
      amount,
    });
  } catch (e: unknown) {
    console.error('[billing/create-invoice]', e);
    const message = e instanceof Error ? e.message : 'Internal error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
