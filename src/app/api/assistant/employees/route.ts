import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdminFirestore } from '@/lib/firebase-admin';
import { requireTenantAuth } from '@/lib/api/auth-middleware';

export async function GET(request: NextRequest) {
  const authResult = await requireTenantAuth(request);
  if (authResult.response) return authResult.response;
  const { companyId } = authResult.auth;

  try {
    const db = getFirebaseAdminFirestore();

    const [empSnap, posSnap] = await Promise.all([
      db.collection(`companies/${companyId}/employees`).get(),
      db.collection(`companies/${companyId}/positions`).get(),
    ]);

    const posMap = new Map<string, string>();
    posSnap.docs.forEach(doc => {
      const d = doc.data();
      posMap.set(doc.id, d.title || d.name || '');
    });

    const employees = empSnap.docs.map(doc => {
      const d = doc.data();
      const first = d.firstName || '';
      const last = d.lastName || '';
      const name = `${last} ${first}`.trim() || d.email || 'Нэргүй';
      return {
        id: doc.id,
        name,
        position: d.positionId ? posMap.get(d.positionId) : undefined,
      };
    });

    return NextResponse.json({ employees });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch employees';
    console.error('[API/Employees]', message);
    return NextResponse.json({ employees: [], error: message }, { status: 500 });
  }
}
