import { NextRequest, NextResponse } from 'next/server';
import { requireTenantAuth } from '@/lib/api/auth-middleware';
import { getFirebaseAdminFirestore } from '@/lib/firebase-admin';

/**
 * PATCH /api/notifications
 * Mark notification(s) as read.
 * Body: { ids: string[] } or { all: true }
 */
export async function PATCH(request: NextRequest) {
  const authResult = await requireTenantAuth(request, { rateLimit: 'standard' });
  if (authResult.response) return authResult.response;
  const { uid, companyId } = authResult.auth;

  const body = await request.json();
  const db = getFirebaseAdminFirestore();
  const basePath = `companies/${companyId}/employees/${uid}/notifications`;

  if (body.all) {
    const unread = await db.collection(basePath).where('read', '==', false).get();
    const batch = db.batch();
    unread.docs.forEach((doc) => batch.update(doc.ref, { read: true }));
    await batch.commit();
    return NextResponse.json({ updated: unread.size });
  }

  if (Array.isArray(body.ids) && body.ids.length > 0) {
    const batch = db.batch();
    for (const id of body.ids.slice(0, 50)) {
      batch.update(db.doc(`${basePath}/${id}`), { read: true });
    }
    await batch.commit();
    return NextResponse.json({ updated: body.ids.length });
  }

  return NextResponse.json({ error: 'Provide ids[] or all:true' }, { status: 400 });
}
