import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdminFirestore } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { checkPayment } from '@/lib/billing/qpay-client';
import { type SaaSModule, type ModuleConfig, type CouponUsage } from '@/types/company';
import { getDynamicPlanDefinition } from '@/lib/pricing/get-pricing-plans';

function extractCompanyId(invoiceNo: string): string | null {
  // Format: NEGE-{companyId}-{timestamp}
  const match = invoiceNo.match(/^NEGE-(.+)-(\d+)$/);
  return match ? match[1] : null;
}

async function processPaymentCallback(invoiceNo: string): Promise<{ status: string; plan?: string } | { error: string; status: number }> {
  const db = getFirebaseAdminFirestore();

  const companyId = extractCompanyId(invoiceNo);
  let invoiceDoc;

  // companyId нь invoiceNo-д encode хийгдсэн (NEGE-{companyId}-{timestamp})
  // O(n) company scan хэрэггүй — шууд замаар tatna
  if (!companyId) {
    return { error: 'Invalid invoice format', status: 400 };
  }

  const docRef = db.doc(`companies/${companyId}/invoices/${invoiceNo}`);
  const snap = await docRef.get();
  if (snap.exists) {
    invoiceDoc = snap;
  }

  if (!invoiceDoc || !invoiceDoc.exists) {
    return { error: 'Invoice not found', status: 404 };
  }

  const invoiceData = invoiceDoc.data()!;

  if (invoiceData.status === 'paid') {
    return { status: 'already_paid' };
  }

  const paymentResult = await checkPayment(invoiceData.qpayInvoiceId);

  if (paymentResult.count > 0 && Number(paymentResult.paid_amount) >= invoiceData.amount) {
    const payment = paymentResult.rows[0];

    const transactionId =
      payment.p2p_transactions?.[0]?.id ??
      payment.card_transactions?.[0]?.id ??
      payment.payment_id;

    await invoiceDoc.ref.update({
      status: 'paid',
      paidAt: new Date(),
      paymentId: payment.payment_id,
      transactionId,
      paidAmount: Number(paymentResult.paid_amount),
    });

    const companyPath = invoiceDoc.ref.parent.parent!.path;
    const companyRef = db.doc(companyPath);

    const now = new Date();
    const endDate = new Date(now);
    if (invoiceData.billingCycle === 'yearly') {
      endDate.setFullYear(endDate.getFullYear() + 1);
    } else {
      endDate.setMonth(endDate.getMonth() + 1);
    }

    const planDef = await getDynamicPlanDefinition(invoiceData.plan);
    const modules: Partial<Record<SaaSModule, ModuleConfig>> = {};
    for (const m of planDef.modules) {
      modules[m] = { enabled: true, enabledAt: now.toISOString() };
    }

    await companyRef.update({
      status: 'active',
      plan: invoiceData.plan,
      modules,
      limits: { ...planDef.limits },
      'subscription.plan': invoiceData.plan,
      'subscription.startDate': now.toISOString(),
      'subscription.endDate': endDate.toISOString(),
      'subscription.billingCycle': invoiceData.billingCycle,
      'subscription.amount': invoiceData.amount,
      'subscription.lastPaymentDate': now.toISOString(),
      'subscription.paymentStatus': 'paid',
      updatedAt: now,
    });

    // ── Coupon usage бүртгэх + usedCount++ ──
    if (invoiceData.couponCode) {
      const code = invoiceData.couponCode as string;
      const companyId = companyPath.split('/')[1];

      const usage: CouponUsage = {
        code,
        companyId,
        usedAt: now,
        invoiceNo,
        discountAmount: invoiceData.discountAmount ?? 0,
        originalAmount: invoiceData.originalAmount ?? invoiceData.amount,
        finalAmount: invoiceData.amount,
      };

      // coupon_usage бүртгэх
      await db.doc(`companies/${companyId}/coupon_usage/${code}`).set(usage);

      // usedCount++ — race condition-с хамгаалахын тулд FieldValue.increment
      await db.doc(`platform/coupons/${code}`).update({
        usedCount: FieldValue.increment(1),
      });
    }

    return { status: 'paid', plan: invoiceData.plan };
  }

  return { status: 'pending' };
}

/**
 * GET — manual payment check from frontend
 */
export async function GET(request: NextRequest) {
  try {
    const invoiceNo = new URL(request.url).searchParams.get('invoice');
    if (!invoiceNo) {
      return NextResponse.json({ error: 'Missing invoice' }, { status: 400 });
    }
    const result = await processPaymentCallback(invoiceNo);
    if ('error' in result && typeof result.status === 'number') {
      return NextResponse.json({ error: result.error }, { status: result.status as number });
    }
    return NextResponse.json(result);
  } catch (e: unknown) {
    console.error('[billing/callback GET]', e);
    const message = e instanceof Error ? e.message : 'Internal error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST — QPay webhook callback
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const invoiceNo =
      body.sender_invoice_no ||
      body.invoice_no ||
      new URL(request.url).searchParams.get('invoice');

    if (!invoiceNo) {
      return NextResponse.json({ error: 'Missing invoice' }, { status: 400 });
    }

    console.log('[billing/callback POST] QPay webhook for invoice:', invoiceNo);

    const result = await processPaymentCallback(invoiceNo);
    if ('error' in result && typeof result.status === 'number') {
      return NextResponse.json({ error: result.error }, { status: result.status as number });
    }
    return NextResponse.json(result);
  } catch (e: unknown) {
    console.error('[billing/callback POST]', e);
    const message = e instanceof Error ? e.message : 'Internal error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
