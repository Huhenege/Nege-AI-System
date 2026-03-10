import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdminFirestore } from '@/lib/firebase-admin';
import { requireSuperAdmin } from '../../../lib/auth-guard';
import { getDynamicPlanDefinition } from '@/lib/pricing/get-pricing-plans';
import type { CompanyPlan, SaaSModule, ModuleConfig } from '@/types/company';

type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/super-admin/company/{id}/billing
 * Returns subscription info + invoice history for a company.
 */
export async function GET(request: NextRequest, { params }: Params) {
  const authResult = await requireSuperAdmin(request);
  if (authResult instanceof NextResponse) return authResult;

  const { id } = await params;
  const db = getFirebaseAdminFirestore();

  const companySnap = await db.collection('companies').doc(id).get();
  if (!companySnap.exists) {
    return NextResponse.json({ error: 'Company not found' }, { status: 404 });
  }

  const company = companySnap.data()!;

  const invoicesSnap = await db
    .collection(`companies/${id}/invoices`)
    .orderBy('createdAt', 'desc')
    .limit(50)
    .get();

  const invoices = invoicesSnap.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
    createdAt: doc.data().createdAt?.toDate?.()?.toISOString() ?? doc.data().createdAt,
    paidAt: doc.data().paidAt?.toDate?.()?.toISOString() ?? doc.data().paidAt ?? null,
  }));

  return NextResponse.json({
    subscription: company.subscription || null,
    plan: company.plan,
    status: company.status,
    invoices,
  });
}

/**
 * POST /api/super-admin/company/{id}/billing
 * Admin billing actions: change plan, mark invoice paid, extend subscription, etc.
 */
export async function POST(request: NextRequest, { params }: Params) {
  const authResult = await requireSuperAdmin(request);
  if (authResult instanceof NextResponse) return authResult;

  const { id } = await params;
  const body = await request.json();
  const db = getFirebaseAdminFirestore();
  const companyRef = db.collection('companies').doc(id);

  const snap = await companyRef.get();
  if (!snap.exists) {
    return NextResponse.json({ error: 'Company not found' }, { status: 404 });
  }

  const { action } = body as { action: string };

  switch (action) {
    // Manually change plan with full subscription reset
    case 'change_plan': {
      const { plan, months } = body as { plan: CompanyPlan; months: number };
      const planDef = await getDynamicPlanDefinition(plan);
      const now = new Date();
      const endDate = new Date(now);
      endDate.setMonth(endDate.getMonth() + (months || 1));

      const modules: Partial<Record<SaaSModule, ModuleConfig>> = {};
      for (const m of planDef.modules) {
        modules[m] = { enabled: true, enabledAt: now.toISOString() };
      }

      await companyRef.update({
        plan,
        status: plan === 'free' ? 'active' : 'active',
        modules,
        limits: { ...planDef.limits },
        'subscription.plan': plan,
        'subscription.startDate': now.toISOString(),
        'subscription.endDate': endDate.toISOString(),
        'subscription.billingCycle': months >= 12 ? 'yearly' : 'monthly',
        'subscription.amount': months >= 12 ? planDef.price * 10 : planDef.price,
        'subscription.paymentStatus': plan === 'free' ? 'none' : 'paid',
        'subscription.lastPaymentDate': now.toISOString(),
        'subscription.nextPaymentDate': endDate.toISOString(),
        updatedAt: now,
      });

      return NextResponse.json({ status: 'ok', message: `Plan changed to ${plan} for ${months} month(s)` });
    }

    // Manually mark an invoice as paid
    case 'mark_paid': {
      const { invoiceNo } = body as { invoiceNo: string };
      const invoiceRef = db.doc(`companies/${id}/invoices/${invoiceNo}`);
      const invoiceSnap = await invoiceRef.get();

      if (!invoiceSnap.exists) {
        return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
      }

      const invoiceData = invoiceSnap.data()!;
      if (invoiceData.status === 'paid') {
        return NextResponse.json({ status: 'already_paid' });
      }

      const now = new Date();
      await invoiceRef.update({
        status: 'paid',
        paidAt: now,
        manuallyPaid: true,
        manuallyPaidAt: now,
      });

      // Also activate the subscription
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
        'subscription.paymentStatus': 'paid',
        'subscription.lastPaymentDate': now.toISOString(),
        'subscription.nextPaymentDate': endDate.toISOString(),
        updatedAt: now,
      });

      return NextResponse.json({ status: 'ok', message: 'Invoice marked as paid, subscription activated' });
    }

    // Extend current subscription by N months
    case 'extend': {
      const { months } = body as { months: number };
      const companyData = snap.data()!;
      const currentEnd = companyData.subscription?.endDate
        ? new Date(companyData.subscription.endDate)
        : new Date();

      const newEnd = new Date(currentEnd);
      newEnd.setMonth(newEnd.getMonth() + (months || 1));

      await companyRef.update({
        'subscription.endDate': newEnd.toISOString(),
        'subscription.nextPaymentDate': newEnd.toISOString(),
        status: 'active',
        updatedAt: new Date(),
      });

      return NextResponse.json({ status: 'ok', message: `Subscription extended by ${months} month(s)` });
    }

    // Set trial end date
    case 'set_trial': {
      const { days } = body as { days: number };
      const trialEnd = new Date();
      trialEnd.setDate(trialEnd.getDate() + (days || 14));

      await companyRef.update({
        status: 'trial',
        'subscription.trialEndsAt': trialEnd.toISOString(),
        'subscription.endDate': trialEnd.toISOString(),
        updatedAt: new Date(),
      });

      return NextResponse.json({ status: 'ok', message: `Trial set for ${days} days` });
    }

    default:
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  }
}
