import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api/auth-middleware';

export async function GET(request: NextRequest) {
    const authResult = await requireAuth(request);
    if (authResult.response) return authResult.response;

    const hasEnvToken = !!process.env.MOCEAN_API_TOKEN;
    return NextResponse.json({
        envConfigured: hasEnvToken,
        senderId: process.env.MOCEAN_SENDER_ID || null,
    });
}
