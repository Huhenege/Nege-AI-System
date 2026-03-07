import { NextRequest, NextResponse } from 'next/server';
import { ai } from '@/ai/genkit';
import { googleAI } from '@genkit-ai/google-genai';
import { requireAuth } from '@/lib/api/auth-middleware';

export async function POST(request: NextRequest) {
  const authResult = await requireAuth(request);
  if (authResult.response) return authResult.response;

  try {
    const { positionTitle, departmentName, levelName } = await request.json();

    if (!positionTitle) {
      return NextResponse.json(
        { error: 'Ажлын байрны нэр заавал шаардлагатай' },
        { status: 400 }
      );
    }

    const contextInfo = [
      departmentName ? `Нэгж/Хэлтэс: ${departmentName}` : '',
      levelName ? `Зэрэглэл: ${levelName}` : ''
    ].filter(Boolean).join('\n');

    const prompt = `Та HR системийн мэргэжилтэн. Монгол дунд болон том хэмжээний компанид "${positionTitle}" ажлын байрны тодорхойлолт (АБТ) үүсгэнэ үү.
${contextInfo ? `\nНэмэлт мэдээлэл:\n${contextInfo}` : ''}

Дараах бүтцээр JSON хариу буцаана уу:

{
  "purpose": "Ажлын байрны зорилгын 1-2 өгүүлбэр тодорхойлолт",
  "responsibilities": [
    { "title": "Чиг үүрэг 1 нэр", "description": "Дэлгэрэнгүй тодорхойлолт" },
    { "title": "Чиг үүрэг 2 нэр", "description": "Дэлгэрэнгүй тодорхойлолт" }
  ],
  "skills": [
    { "name": "Ур чадвар нэр", "level": "beginner|intermediate|advanced|expert" }
  ],
  "experience": {
    "totalYears": тоо (0-15),
    "leadershipYears": тоо (0-10),
    "educationLevel": "none|diploma|bachelor|master|doctorate",
    "professions": ["мэргэжил 1", "мэргэжил 2"]
  }
}

Шаардлага:
- 4-6 чиг үүрэг (responsibilities)
- 5-8 ур чадвар (skills), түвшин нь beginner, intermediate, advanced, expert гэсэн утгатай
- Туршлага болон боловсролын шаардлага бодитой байх
- Бүгдийг Монгол хэлээр бичнэ

Return ONLY valid JSON, no explanation or markdown.`;

    const { text } = await ai.generate({
      model: googleAI.model('gemini-2.5-flash'),
      prompt,
      config: { temperature: 0.4 },
    });

    if (!text?.trim()) {
      throw new Error('AI хариу хоосон байна');
    }

    // Parse JSON from response
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) {
      throw new Error('JSON хариу боловсруулахад алдаа');
    }

    const data = JSON.parse(match[0]);

    return NextResponse.json({
      success: true,
      data,
      message: 'АБТ амжилттай үүсгэлээ',
    });
  } catch (err) {
    console.error('generate-position-details API error:', err);
    const message = err instanceof Error ? err.message : 'АБТ үүсгэхэд алдаа гарлаа';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
