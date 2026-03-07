import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdminFirestore } from '@/lib/firebase-admin';
import { checkPayment } from '@/lib/billing/qpay-client';

async function processPaymentCallback(invoiceNo: string): Promise<{ status: string; plan?: string } | { error: string; status: number }> {
  const db = getFirebaseAdminFirestore();

  const invoicesQuery = await db
    .collectionGroup('invoices')
    .where('invoiceNo', '==', invoiceNo)
    .limit(1)
    .get();

  if (invoicesQuery.empty) {
    return { error: 'Invoice not found', status: 404 };
  }

  const invoiceDoc = invoicesQuery.docs[0];
  const invoiceData = invoiceDoc.data();

  if (invoiceData.status === 'paid') {
    return { status: 'already_paid' };
  }

  const paymentResult = await checkPayment(invoiceData.qpayInvoiceId);

  if (paymentResult.count > 0 && paymentResult.paid_amount >= invoiceData.amount) {
    const payment = paymentResult.rows[0];

    await invoiceDoc.ref.update({
      status: 'paid',
      paidAt: new Date(),
      paymentId: payment.payment_id,
      transactionId: payment.transaction_id,
      paidAmount: paymentResult.paid_amount,
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

    await companyRef.update({
      status: 'active',
      plan: invoiceData.plan,
      'subscription.plan': invoiceData.plan,
      'subscription.startDate': now.toISOString(),
      'subscription.endDate': endDate.toISOString(),
      'subscription.billingCycle': invoiceData.billingCycle,
      'subscription.amount': invoiceData.amount,
      'subscription.lastPaymentDate': now.toISOString(),
      'subscription.paymentStatus': 'paid',
      updatedAt: now,
    });

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
