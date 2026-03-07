import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdminFirestore } from '@/lib/firebase-admin';
import { requireAuth } from '@/lib/api/auth-middleware';

interface SmsConfig {
    token: string;
    senderId?: string;
}

/**
 * SMS тохиргоог дараах дарааллаар хайна:
 * 1. Environment variables (MOCEAN_API_TOKEN) — local + production
 * 2. Firestore recruitment_settings/default.smsConfig — UI-ээс тохируулсан бол
 */
async function getSmsConfig(): Promise<SmsConfig | null> {
    // 1. Эхлээд env variable шалгах
    const envToken = process.env.MOCEAN_API_TOKEN;
    if (envToken) {
        console.log('[API/SMS] SMS тохиргоог environment variable-аас авлаа');
        return {
            token: envToken,
            senderId: process.env.MOCEAN_SENDER_ID || undefined,
        };
    }

    // 2. Firestore-оос унших
    try {
        const firestore = getFirebaseAdminFirestore();
        const settingsSnap = await firestore.collection('recruitment_settings').doc('default').get();
        if (settingsSnap.exists) {
            const smsConfig = settingsSnap.data()?.smsConfig;
            if (smsConfig?.token) {
                console.log('[API/SMS] SMS тохиргоог Firestore-оос авлаа');
                return { token: smsConfig.token, senderId: smsConfig.senderId };
            }
        }
    } catch (adminError: any) {
        console.warn('[API/SMS] Firestore-оос уншиж чадсангүй:', adminError.message);
    }

    return null;
}

export async function POST(request: NextRequest) {
    const authResult = await requireAuth(request);
    if (authResult.response) return authResult.response;

    try {
        const body = await request.json();
        const { to, text } = body;

        if (!to || !text) {
            return NextResponse.json({ error: 'Утасны дугаар эсвэл текст дутуу байна' }, { status: 400 });
        }

        console.log(`[API/SMS] ${to} руу илгээж байна...`);

        const smsConfig = await getSmsConfig();

        if (!smsConfig) {
            console.error('[API/SMS] SMS тохиргоо олдсонгүй. .env.local файлд MOCEAN_API_TOKEN нэмнэ үү.');
            return NextResponse.json({
                error: 'SMS тохиргоо хийгдээгүй байна. MOCEAN_API_TOKEN тохируулна уу.',
            }, { status: 503 });
        }

        const { token, senderId } = smsConfig;

        // Mocean REST API — Bearer Token нэвтрэлт
        const params = new URLSearchParams();
        params.append('mocean-from', senderId || 'MOCEAN');
        params.append('mocean-to', to);
        params.append('mocean-text', text);
        params.append('mocean-resp-format', 'json');

        const response = await fetch('https://rest.moceanapi.com/rest/2/sms', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: params,
        });

        const result = await response.json();

        const msgStatus = result.messages?.[0]?.status;
        const isSuccess = msgStatus == 0 || msgStatus === '0';

        if (result.messages && isSuccess) {
            console.log('[API/SMS] Амжилттай илгээгдлээ! msgid:', result.messages[0].msgid);
            return NextResponse.json({ success: true, apiResponse: result });
        } else {
            const errorMsg = result.messages?.[0]?.err_msg || result.err_msg || 'Mocean API алдаа';
            console.error('[API/SMS] Mocean алдаа:', errorMsg, result);
            return NextResponse.json({
                error: 'SMS илгээж чадсангүй',
                details: errorMsg,
            }, { status: 400 });
        }

    } catch (error: any) {
        console.error('[API/SMS] Серверийн алдаа:', error);
        return NextResponse.json({ error: error.message || 'Серверийн дотоод алдаа' }, { status: 500 });
    }
}
