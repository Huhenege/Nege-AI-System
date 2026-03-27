import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createHash } from 'crypto';
import { getFirebaseAdminFirestore } from '@/lib/firebase-admin';
import { requireTenantAuth } from '@/lib/api/auth-middleware';
import { FieldValue } from 'firebase-admin/firestore';

const BodySchema = z.object({
  verificationId: z.string().min(1),
  code: z.string().length(6),
});

function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

const MAX_ATTEMPTS = 5;

export async function POST(request: NextRequest) {
  const authResult = await requireTenantAuth(request);
  if (authResult.response) return authResult.response;

  const { auth } = authResult;

  try {
    const body = await request.json();
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Буруу хүсэлт', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { verificationId, code } = parsed.data;
    const db = getFirebaseAdminFirestore();
    const companyId = auth.companyId;

    const verRef = db
      .collection('companies')
      .doc(companyId)
      .collection('verification_codes')
      .doc(verificationId);

    const snap = await verRef.get();
    if (!snap.exists) {
      return NextResponse.json(
        { error: 'Баталгаажуулалтын код олдсонгүй' },
        { status: 404 }
      );
    }

    const data = snap.data()!;

    if (new Date(data.expiresAt) < new Date()) {
      await verRef.delete();
      return NextResponse.json(
        { error: 'Кодны хугацаа дууссан байна. Дахин илгээнэ үү.' },
        { status: 410 }
      );
    }

    if ((data.attempts || 0) >= MAX_ATTEMPTS) {
      await verRef.delete();
      return NextResponse.json(
        { error: 'Хэт олон оролдлого хийсэн. Дахин илгээнэ үү.' },
        { status: 429 }
      );
    }

    await verRef.update({ attempts: FieldValue.increment(1) });

    const codeHash = sha256(code);
    if (codeHash !== data.codeHash) {
      const remaining = MAX_ATTEMPTS - (data.attempts || 0) - 1;
      return NextResponse.json(
        { error: `Буруу код. ${remaining} оролдлого үлдлээ.` },
        { status: 400 }
      );
    }

    const employeeRef = db
      .collection('companies')
      .doc(companyId)
      .collection('employees')
      .doc(data.employeeId);

    const now = new Date().toISOString();
    const updateFields: Record<string, any> =
      data.type === 'email'
        ? { emailVerified: true, emailVerifiedAt: now }
        : { phoneVerified: true, phoneVerifiedAt: now };

    await employeeRef.update(updateFields);
    await verRef.delete();

    console.log(
      `[verify/confirm] ${data.type} verified for employee ${data.employeeId}`
    );

    return NextResponse.json({ verified: true, type: data.type });
  } catch (error: any) {
    console.error('[verify/confirm] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Серверийн алдаа' },
      { status: 500 }
    );
  }
}
