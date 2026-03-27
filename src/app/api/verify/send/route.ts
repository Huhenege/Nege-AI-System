import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createHash, randomInt } from 'crypto';
import { getFirebaseAdminFirestore } from '@/lib/firebase-admin';
import { requireTenantAuth } from '@/lib/api/auth-middleware';
import { Resend } from 'resend';
import { FieldValue } from 'firebase-admin/firestore';

const BodySchema = z.object({
  type: z.enum(['email', 'phone']),
  target: z.string().min(1),
  employeeId: z.string().min(1),
});

function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

function generateOTP(): string {
  return String(randomInt(100000, 999999));
}

async function sendEmailOTP(to: string, code: string): Promise<void> {
  const resend = process.env.RESEND_API_KEY
    ? new Resend(process.env.RESEND_API_KEY)
    : null;

  const fromEmail =
    process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';

  if (!resend) {
    console.log(`[verify/send] EMAIL SIMULATION: OTP ${code} -> ${to}`);
    return;
  }

  const { error } = await resend.emails.send({
    from: `Баталгаажуулалт <${fromEmail}>`,
    to: [to],
    subject: 'Таны баталгаажуулах код',
    html: `
      <div style="font-family:sans-serif;max-width:400px;margin:0 auto;padding:24px">
        <h2 style="margin:0 0 16px">Баталгаажуулах код</h2>
        <p style="font-size:32px;font-weight:bold;letter-spacing:8px;text-align:center;
                  background:#f4f4f5;padding:16px;border-radius:8px;margin:16px 0">
          ${code}
        </p>
        <p style="color:#71717a;font-size:14px">
          Энэ код 5 минутын дотор хүчинтэй. Хэрэв та энэ кодыг хүсээгүй бол энэ имэйлийг үл тоомсорлоно уу.
        </p>
      </div>
    `,
  });

  if (error) {
    console.error('[verify/send] Resend error:', error);
    throw new Error((error as any)?.message || 'Имэйл илгээж чадсангүй');
  }
}

async function sendSmsOTP(to: string, code: string): Promise<void> {
  const token = process.env.MOCEAN_API_TOKEN;

  if (!token) {
    console.log(`[verify/send] SMS SIMULATION: OTP ${code} -> ${to}`);
    return;
  }

  const params = new URLSearchParams();
  params.append('mocean-from', process.env.MOCEAN_SENDER_ID || 'MOCEAN');
  params.append('mocean-to', to);
  params.append('mocean-text', `Таны баталгаажуулах код: ${code}`);
  params.append('mocean-resp-format', 'json');

  const response = await fetch('https://rest.moceanapi.com/rest/2/sms', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params,
  });

  const result = await response.json();
  const status = result.messages?.[0]?.status;
  if (status != 0 && status !== '0') {
    const msg = result.messages?.[0]?.err_msg || 'SMS илгээж чадсангүй';
    throw new Error(msg);
  }
}

export async function POST(request: NextRequest) {
  const authResult = await requireTenantAuth(request, { rateLimit: 'sms' });
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

    const { type, target, employeeId } = parsed.data;
    const db = getFirebaseAdminFirestore();
    const companyId = auth.companyId;

    const empSnap = await db
      .collection('companies')
      .doc(companyId)
      .collection('employees')
      .doc(employeeId)
      .get();

    if (!empSnap.exists) {
      return NextResponse.json(
        { error: 'Ажилтан олдсонгүй' },
        { status: 404 }
      );
    }

    const otp = generateOTP();
    const codeHash = sha256(otp);
    const targetHash = sha256(target);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    const verificationRef = db
      .collection('companies')
      .doc(companyId)
      .collection('verification_codes')
      .doc();

    await verificationRef.set({
      employeeId,
      type,
      targetHash,
      codeHash,
      expiresAt,
      createdBy: auth.uid,
      attempts: 0,
      createdAt: FieldValue.serverTimestamp(),
    });

    if (type === 'email') {
      await sendEmailOTP(target, otp);
    } else {
      await sendSmsOTP(target, otp);
    }

    console.log(`[verify/send] OTP sent via ${type} to ${target} (doc: ${verificationRef.id})`);

    return NextResponse.json({
      success: true,
      verificationId: verificationRef.id,
    });
  } catch (error: any) {
    console.error('[verify/send] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Серверийн алдаа' },
      { status: 500 }
    );
  }
}
