import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdminFirestore, getFirebaseAdminAuth } from '@/lib/firebase-admin';
import { requireSuperAdmin } from '../lib/auth-guard';

export async function GET(request: NextRequest) {
  const authResult = await requireSuperAdmin(request);
  if (authResult instanceof NextResponse) return authResult;

  try {
    const db = getFirebaseAdminFirestore();

    const companiesSnap = await db.collection('companies').get();
    const companies = companiesSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    let totalEmployees = 0;
    const statusCounts: Record<string, number> = { trial: 0, active: 0, suspended: 0, cancelled: 0 };
    const planCounts: Record<string, number> = { free: 0, starter: 0, pro: 0, enterprise: 0 };

    for (const c of companies) {
      const data = c as any;
      totalEmployees += data.employeeCount || 0;
      if (data.status && statusCounts[data.status] !== undefined) statusCounts[data.status]++;
      if (data.plan && planCounts[data.plan] !== undefined) planCounts[data.plan]++;
    }

    const { users: usersList } = await getFirebaseAdminAuth().listUsers(1);
    const totalUsersResult = await getFirebaseAdminAuth().listUsers(1000);
    const totalUsers = totalUsersResult.users.length;

    return NextResponse.json({
      totalCompanies: companies.length,
      totalEmployees,
      totalUsers,
      statusCounts,
      planCounts,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Internal error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
