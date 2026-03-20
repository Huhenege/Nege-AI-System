import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdminFirestore } from '@/lib/firebase-admin';
import { requireTenantAuth } from '@/lib/api/auth-middleware';

/**
 * Normalize registration number for comparison (trim, collapse spaces).
 */
function normalizeRegistrationNumber(value: string): string {
  return (value || '').trim().replace(/\s+/g, '');
}

/**
 * Variants for matching (өмнө зайтай хадгалсан өгөгдөлтэй таарна).
 */
function getRegistrationNumberVariants(normalized: string): string[] {
  const variants = [normalized];
  if (normalized.length >= 10 && /^[А-Яа-яЁёҮүӨө]{2}\d{8}$/.test(normalized)) {
    const withSpace = normalized.slice(0, 2) + ' ' + normalized.slice(2);
    if (!variants.includes(withSpace)) variants.push(withSpace);
  }
  return variants;
}

/** Firestore "index required" алдаанаас индекс үүсгэх URL татах; байхгүй бол консолын indexes хуудас */
function extractIndexUrl(error: unknown): string | null {
  const msg = error instanceof Error ? error.message : String(error);
  const match = msg.match(/https:\/\/[^\s)'"]+/);
  if (match) return match[0];
  const needsIndex = /index|RESOURCE_EXHAUSTED|create_composite|FAILED_PRECONDITION/i.test(msg);
  if (needsIndex) {
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.FIREBASE_ADMIN_PROJECT_ID;
    if (projectId) {
      return `https://console.firebase.google.com/project/${projectId}/firestore/indexes`;
    }
  }
  return null;
}

export async function POST(request: NextRequest) {
  const authResult = await requireTenantAuth(request);
  if (authResult.response) return authResult.response;
  const { companyId } = authResult.auth;

  try {
    const body = await request.json();
    const { registrationNumber, currentEmployeeId } = body;

    if (typeof registrationNumber !== 'string' || typeof currentEmployeeId !== 'string') {
      return NextResponse.json(
        { error: 'registrationNumber болон currentEmployeeId шаардлагатай.' },
        { status: 400 }
      );
    }

    const normalized = normalizeRegistrationNumber(registrationNumber);
    if (!normalized) {
      return NextResponse.json({ duplicate: false });
    }

    let db;
    try {
      db = getFirebaseAdminFirestore();
    } catch (adminError) {
      const msg = adminError instanceof Error ? adminError.message : String(adminError);
      if (/Firebase Admin env not configured|FIREBASE_ADMIN/i.test(msg)) {
        return NextResponse.json({ duplicate: false, skipped: true });
      }
      throw adminError;
    }

    const variants = getRegistrationNumberVariants(normalized);
    const empSnap = await db.collection(`companies/${companyId}/employees`).get();

    for (const empDoc of empSnap.docs) {
      if (empDoc.id === currentEmployeeId) continue;
      const qDoc = await db.doc(`companies/${companyId}/employees/${empDoc.id}/questionnaire/data`).get();
      const savedRegNo = normalizeRegistrationNumber(String(qDoc.data()?.registrationNumber || ''));
      if (!savedRegNo) continue;

      if (variants.includes(savedRegNo)) {
        return NextResponse.json({
          duplicate: true,
          message: 'Энэ регистрийн дугаар өөр ажилтанд бүртгэгдсэн байна.',
          existingEmployeeId: empDoc.id,
        });
      }
    }

    return NextResponse.json({ duplicate: false });
  } catch (error) {
    const indexUrl = extractIndexUrl(error);
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[check-registration-number]', msg, error);

    if (indexUrl) {
      return NextResponse.json(
        {
          error: 'РД шалгалт ажиллахын тулд Firestore индекс үүсгэх шаардлагатай.',
          indexUrl,
        },
        { status: 503 }
      );
    }

    const isDev = process.env.NODE_ENV === 'development';
    return NextResponse.json(
      {
        error: 'Регистрийн дугаар шалгахад алдаа гарлаа.',
        ...(isDev && { detail: msg }),
      },
      { status: 500 }
    );
  }
}
