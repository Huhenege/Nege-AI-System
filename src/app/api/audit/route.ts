import { NextRequest, NextResponse } from 'next/server';
import { requireTenantAuth } from '@/lib/api/auth-middleware';
import { getFirebaseAdminFirestore } from '@/lib/firebase-admin';

/**
 * GET /api/audit?limit=50&resource=employee
 * Fetch audit log entries for the current tenant.
 * Admin-only.
 */
export async function GET(request: NextRequest) {
  const authResult = await requireTenantAuth(request, { rateLimit: 'standard' });
  if (authResult.response) return authResult.response;
  const { companyId, role } = authResult.auth;

  if (role !== 'company_super_admin' && role !== 'admin' && role !== 'super_admin') {
    return NextResponse.json({ error: 'Admin required' }, { status: 403 });
  }

  const url = new URL(request.url);
  const pageLimit = Math.min(Number(url.searchParams.get('limit')) || 50, 200);
  const resource = url.searchParams.get('resource');

  const db = getFirebaseAdminFirestore();
  let q = db
    .collection(`companies/${companyId}/audit_logs`)
    .orderBy('createdAt', 'desc')
    .limit(pageLimit);

  if (resource) {
    q = q.where('resource', '==', resource);
  }

  const snap = await q.get();
  const logs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

  return NextResponse.json({ logs });
}
