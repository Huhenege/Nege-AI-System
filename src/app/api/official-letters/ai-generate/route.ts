import { NextRequest, NextResponse } from 'next/server';
import { requireTenantAuth } from '@/lib/api/auth-middleware';

/**
 * POST /api/official-letters/ai-generate
 * Генки AI-аар албан бичгийн агуулга үүсгэнэ
 */
export async function POST(request: NextRequest) {
    const authResult = await requireTenantAuth(request, { rateLimit: 'ai', module: 'official_letters' });
    if ('response' in authResult && authResult.response) return authResult.response;

    const { orgName, addresseeOrg, addresseeName, subject, contentHint } = await request.json();

    if (!subject) {
        return NextResponse.json({ error: 'subject шаардлагатай' }, { status: 400 });
    }

    try {
        const { getGenerativeModel } = await import('@/lib/ai/genkit-server' as any).catch(() => ({ getGenerativeModel: null }));

        // Genkit/Gemini байхгүй бол fallback template
        const prompt = `Монгол хэл дээр мэргэжлийн албан бичгийн агуулга бич.

Байгууллага: ${orgName || 'Байгууллага'}
Хүлээн авагч байгууллага: ${addresseeOrg || ''}
Хүлээн авагч: ${addresseeName || ''}
Гарчиг: ${subject}
${contentHint ? `Нэмэлт мэдээлэл: ${contentHint}` : ''}

Дүрэм:
- Монгол албан бичгийн стандарт хэлбэр баримтал
- 2-4 параграф, тус бүр 2-4 өгүүлбэр
- Энгийн, тодорхой, мэргэжлийн хэлбэр
- Зөвхөн агуулгыг бич (гарчиг, мэнд зэрэг хэрэггүй)`;

        if (getGenerativeModel) {
            const model = getGenerativeModel();
            const result = await model.generateContent(prompt);
            const text = result.response.text();
            return NextResponse.json({ content: text.trim() });
        }

        // Fallback
        const fallback = `Дээрх ${subject}-тай холбогдуулан дараах мэдээллийг хүргэж байна.\n\nТухайн асуудлыг нарийвчлан судалж үзсэн бөгөөд холбогдох хууль, журмын дагуу шийдвэрлэх шаардлагатай гэж үзлээ.\n\nИймд энэ талаар таны байгууллагаас холбогдох арга хэмжээ авахыг хүсэж байна.\n\nХамтын ажиллагаанд талархаж байна.`;
        return NextResponse.json({ content: fallback });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
