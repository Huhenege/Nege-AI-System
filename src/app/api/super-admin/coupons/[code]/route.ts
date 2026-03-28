import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdminFirestore } from '@/lib/firebase-admin';
import { requireSuperAdmin } from '../../lib/auth-guard';
import { FieldValue } from 'firebase-admin/firestore';
import type { Coupon } from '@/types/company';

type Params = { params: Promise<{ code: string }> };

/**
 * PATCH /api/super-admin/coupons/[code] — засах (isActive, maxUses, validUntil, ...)
 */
export async function PATCH(request: NextRequest, { params }: Params) {
    const auth = await requireSuperAdmin(request);
    if (auth instanceof NextResponse) return auth;

    const { code } = await params;
    const normalizedCode = code.toUpperCase();

    const db = getFirebaseAdminFirestore();
    const ref = db.doc(`platform/coupons/${normalizedCode}`);
    const snap = await ref.get();
    if (!snap.exists) {
        return NextResponse.json({ error: 'Coupon олдсонгүй' }, { status: 404 });
    }

    const body = await request.json() as Partial<Coupon>;

    // Зөвшөөрөгдсөн field-үүд л засагдана
    const allowedFields: (keyof Coupon)[] = [
        'isActive', 'maxUses', 'validUntil', 'validFrom',
        'description', 'applicablePlans', 'value', 'type',
    ];
    const updates: Record<string, any> = { updatedAt: FieldValue.serverTimestamp() };
    for (const field of allowedFields) {
        if (field in body) updates[field] = (body as any)[field];
    }

    await ref.update(updates);
    return NextResponse.json({ success: true });
}

/**
 * DELETE /api/super-admin/coupons/[code] — устгах (usedCount > 0 бол soft delete)
 */
export async function DELETE(request: NextRequest, { params }: Params) {
    const auth = await requireSuperAdmin(request);
    if (auth instanceof NextResponse) return auth;

    const { code } = await params;
    const normalizedCode = code.toUpperCase();

    const db = getFirebaseAdminFirestore();
    const ref = db.doc(`platform/coupons/${normalizedCode}`);
    const snap = await ref.get();
    if (!snap.exists) {
        return NextResponse.json({ error: 'Coupon олдсонгүй' }, { status: 404 });
    }

    const coupon = snap.data() as Coupon;

    if (coupon.usedCount > 0) {
        // Ашиглагдсан coupon-г бүрэн устгахгүй — идэвхгүй болгоно (audit trail хадгалахын тулд)
        await ref.update({ isActive: false, updatedAt: FieldValue.serverTimestamp() });
        return NextResponse.json({ success: true, action: 'deactivated', reason: 'Has usage history' });
    }

    await ref.delete();
    return NextResponse.json({ success: true, action: 'deleted' });
}
