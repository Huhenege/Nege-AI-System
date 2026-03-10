import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdminFirestore } from '@/lib/firebase-admin';
import { requireSuperAdmin } from '../lib/auth-guard';

/**
 * GET /api/super-admin/billing
 * Platform-wide billing overview: revenue, recent invoices, stats.
 */
export async function GET(request: NextRequest) {
  const authResult = await requireSuperAdmin(request);
  if (authResult instanceof NextResponse) return authResult;

  const db = getFirebaseAdminFirestore();

  // Get all invoices by iterating companies (avoids collection group index requirement)
  const companiesSnap = await db.collection('companies').get();
  const allInvoiceDocs: FirebaseFirestore.QueryDocumentSnapshot[] = [];

  for (const companyDoc of companiesSnap.docs) {
    const invSnap = await db
      .collection(`companies/${companyDoc.id}/invoices`)
      .orderBy('createdAt', 'desc')
      .limit(20)
      .get();
    allInvoiceDocs.push(...invSnap.docs);
  }

  // Sort all invoices by createdAt desc
  allInvoiceDocs.sort((a, b) => {
    const aTime = a.data().createdAt?.toDate?.()?.getTime() ?? 0;
    const bTime = b.data().createdAt?.toDate?.()?.getTime() ?? 0;
    return bTime - aTime;
  });

  let totalRevenue = 0;
  let pendingAmount = 0;
  let paidCount = 0;
  let pendingCount = 0;

  const recentInvoices = allInvoiceDocs.map((doc) => {
    const data = doc.data();
    const companyPath = doc.ref.parent.parent?.id || 'unknown';

    if (data.status === 'paid') {
      totalRevenue += data.amount || 0;
      paidCount++;
    } else {
      pendingAmount += data.amount || 0;
      pendingCount++;
    }

    return {
      id: doc.id,
      companyId: companyPath,
      invoiceNo: data.invoiceNo,
      plan: data.plan,
      amount: data.amount,
      currency: data.currency || 'MNT',
      status: data.status,
      billingCycle: data.billingCycle,
      manuallyPaid: data.manuallyPaid || false,
      createdAt: data.createdAt?.toDate?.()?.toISOString() ?? data.createdAt,
      paidAt: data.paidAt?.toDate?.()?.toISOString() ?? data.paidAt ?? null,
    };
  });

  // Enrich with company names (already loaded)
  const companyNames: Record<string, string> = {};
  for (const cd of companiesSnap.docs) {
    companyNames[cd.id] = cd.data()?.name || cd.id;
  }

  const enrichedInvoices = recentInvoices.map((inv) => ({
    ...inv,
    companyName: companyNames[inv.companyId] || inv.companyId,
  }));

  // Monthly revenue (current month)
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthlyRevenue = allInvoiceDocs.reduce((sum, doc) => {
    const data = doc.data();
    if (data.status !== 'paid') return sum;
    const paidDate = data.paidAt?.toDate?.() ?? (data.paidAt ? new Date(data.paidAt) : null);
    if (paidDate && paidDate >= monthStart) return sum + (data.amount || 0);
    return sum;
  }, 0);

  return NextResponse.json({
    stats: {
      totalRevenue,
      monthlyRevenue,
      pendingAmount,
      paidCount,
      pendingCount,
    },
    invoices: enrichedInvoices,
  });
}
