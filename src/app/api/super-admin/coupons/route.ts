import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdminFirestore } from '@/lib/firebase-admin';
import { requireSuperAdmin } from '../lib/auth-guard';
import { FieldValue } from 'firebase-admin/firestore';
import type { Coupon } from '@/types/company';

const COUPONS_PATH = 'platform/coupons';

/**
 * GET /api/super-admin/coupons — бүх coupon жагсаалт
 */
export async function GET(request: NextRequest) {
    const auth = await requireSuperAdmin(request);
    if (auth instanceof NextResponse) return auth;

    const db = getFirebaseAdminFirestore();
    const snap = await db.collection(COUPONS_PATH).orderBy('createdAt', 'desc').get();

    const coupons: Coupon[] = snap.docs.map(d => ({
        ...(d.data() as Coupon),
        code: d.id,
        createdAt: d.data().createdAt?.toDate?.()?.toISOString() ?? null,
        updatedAt: d.data().updatedAt?.toDate?.()?.toISOString() ?? null,
    }));

    return NextResponse.json({ coupons });
}

/**
 * POST /api/super-admin/coupons — шинэ coupon үүсгэх
 */
export async function POST(request: NextRequest) {
    const auth = await requireSuperAdmin(request);
    if (auth instanceof NextResponse) return auth;

    const body = await request.json() as Partial<Coupon>;
    const { code, type, value, description, maxUses, validFrom, validUntil, applicablePlans } = body;

    // Validation
    if (!code || !type || value == null || !description) {
        return NextResponse.json({ error: 'code, type, value, description шаардлагатай' }, { status: 400 });
    }
    if (!['percent', 'fixed'].includes(type)) {
        return NextResponse.json({ error: 'type нь percent эсвэл fixed байх ёстой' }, { status: 400 });
    }
    if (type === 'percent' && (value < 1 || value > 100)) {
        return NextResponse.json({ error: 'percent нь 1-100 хооронд байх ёстой' }, { status: 400 });
    }
    if (type === 'fixed' && value < 1) {
        return NextResponse.json({ error: 'fixed дүн 0-с их байх ёстой' }, { status: 400 });
    }

    const normalizedCode = code.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
    if (!normalizedCode) {
        return NextResponse.json({ error: 'Код буруу байна' }, { status: 400 });
    }

    const db = getFirebaseAdminFirestore();

    // Давхардалт шалгах
    const existing = await db.doc(`${COUPONS_PATH}/${normalizedCode}`).get();
    if (existing.exists) {
        return NextResponse.json({ error: `'${normalizedCode}' код аль хэдийн байна` }, { status: 409 });
    }

    const coupon: Omit<Coupon, 'code'> = {
        type,
        value,
        description: description.trim(),
        isActive: true,
        maxUses: maxUses ?? null,
        usedCount: 0,
        validFrom: validFrom ?? new Date().toISOString().slice(0, 10),
        validUntil: validUntil ?? null,
        applicablePlans: applicablePlans ?? null,
        createdAt: FieldValue.serverTimestamp() as any,
        createdBy: auth.uid,
    };

    await db.doc(`${COUPONS_PATH}/${normalizedCode}`).set(coupon);

    return NextResponse.json({ success: true, code: normalizedCode });
}
