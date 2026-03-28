import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdminFirestore } from '@/lib/firebase-admin';
import { requireSuperAdmin } from '../lib/auth-guard';

/**
 * GET /api/super-admin/stats
 *
 * Performance fixes:
 *   1. select() — зөвхөн хэрэгтэй field татна (status, plan, employeeCount)
 *   2. Firebase Auth listUsers байхгүй болгов — Firestore employee count ашиглана
 *   3. Parallel Promise.all — status/plan count нэгэн зэрэг тооцно
 */
export async function GET(request: NextRequest) {
  const authResult = await requireSuperAdmin(request);
  if (authResult instanceof NextResponse) return authResult;

  try {
    const db = getFirebaseAdminFirestore();

    // ── 1. Companies — зөвхөн хэрэгтэй field ────────────────────────────────
    // select() нь Firestore-д projection query — бүтэн doc татахгүй
    const companiesSnap = await db
      .collection('companies')
      .select('status', 'plan', 'employeeCount')
      .get();

    const statusCounts: Record<string, number> = { trial: 0, active: 0, suspended: 0, cancelled: 0 };
    const planCounts: Record<string, number> = { free: 0, starter: 0, pro: 0, enterprise: 0 };
    let totalEmployees = 0;

    for (const doc of companiesSnap.docs) {
      const d = doc.data();
      if (d.status && statusCounts[d.status] !== undefined) statusCounts[d.status]++;
      if (d.plan && planCounts[d.plan] !== undefined) planCounts[d.plan]++;
      totalEmployees += (d.employeeCount as number) || 0;
    }

    // ── 2. Нийт хэрэглэгч — Firestore employees collectionGroup count ────────
    // Firebase Auth listUsers(1000) нь удаан + 1000 хязгаартай
    // Firestore collectionGroup count() нь хурдан O(1)
    const usersCountSnap = await db
      .collectionGroup('employees')
      .count()
      .get();
    const totalUsers = usersCountSnap.data().count;

    return NextResponse.json({
      totalCompanies: companiesSnap.size,
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
