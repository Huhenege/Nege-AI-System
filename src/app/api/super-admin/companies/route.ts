import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdminFirestore } from '@/lib/firebase-admin';
import { requireSuperAdmin } from '../lib/auth-guard';

export async function GET(request: NextRequest) {
  const authResult = await requireSuperAdmin(request);
  if (authResult instanceof NextResponse) return authResult;

  try {
    const db = getFirebaseAdminFirestore();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const plan = searchParams.get('plan');

    let ref: FirebaseFirestore.Query = db.collection('companies').orderBy('createdAt', 'desc');

    if (status) ref = ref.where('status', '==', status);
    if (plan) ref = ref.where('plan', '==', plan);

    const snap = await ref.get();
    const companies = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    return NextResponse.json({ companies });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Internal error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
