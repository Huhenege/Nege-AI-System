import { NextRequest, NextResponse } from 'next/server';
import { ai } from '@/ai/genkit';
import { googleAI } from '@genkit-ai/google-genai';
import { requireAuth } from '@/lib/api/auth-middleware';

export interface GeneratedTask {
  title: string;
  dueDate: string; // YYYY-MM-DD
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
}

export async function POST(request: NextRequest) {
  const authResult = await requireAuth(request);
  if (authResult.response) return authResult.response;

  try {
    const { projectName, goal, expectedOutcome, startDate, endDate } = await request.json();

    if (!projectName || !goal) {
      return NextResponse.json(
        { error: 'Төслийн нэр болон зорилго заавал шаардлагатай' },
        { status: 400 }
      );
    }

    const contextInfo = [
      expectedOutcome ? `Хүлээгдэж буй үр дүн: ${expectedOutcome}` : '',
      startDate ? `Эхлэх огноо: ${startDate}` : '',
      endDate ? `Дуусах огноо: ${endDate}` : '',
    ].filter(Boolean).join('\n');

    const prompt = `Та OKR (Objectives and Key Results) менежментийн мэргэжилтэн. Зорилго болон хүлээгдэж буй үр дүнд нь чанд нийцсэн, гол чухал 5–10 таск л үүсгэнэ үү. Дэлгэрэнгүй алхмууд биш, зөвхөн үр дүнд хүрэхэд зайлшгүй шаардлагатай гол Key Result-уудыг таск хэлбэрээр илэрхийлнэ.

Төслийн нэр: ${projectName}
Зорилго: ${goal}
${contextInfo ? `\nНэмэлт мэдээлэл:\n${contextInfo}` : ''}

Дараах бүтцээр JSON хариу буцаана уу (tasks гэсэн массив):

{
  "tasks": [
    { "title": "Таскын нэр", "dueDate": "YYYY-MM-DD", "priority": "LOW|MEDIUM|HIGH|URGENT" },
    ...
  ]
}

OKR шаардлага:
- Яг 5–10 таск үүсгэ (их биш, бага биш — зөвхөн гол чухалдыг)
- Зорилго болон хүлээгдэж буй үр дүнд ШУУД нийцсэн Key Result-ууд
- dueDate нь startDate-аас endDate хооронд логик дараалалтай байх
- Бүгдийг Монгол хэлээр бичнэ
- priority: LOW, MEDIUM, HIGH, URGENT — чухалчлалд тохируулна

Return ONLY valid JSON, no explanation or markdown.`;

    const { text } = await ai.generate({
      model: googleAI.model('gemini-2.5-flash'),
      prompt,
      config: { temperature: 0.5 },
    });

    if (!text?.trim()) {
      throw new Error('AI хариу хоосон байна');
    }

    const match = text.match(/\{[\s\S]*\}/);
    if (!match) {
      throw new Error('JSON хариу боловсруулахад алдаа');
    }

    const data = JSON.parse(match[0]);
    const tasks: GeneratedTask[] = data.tasks || [];

    if (!Array.isArray(tasks) || tasks.length === 0) {
      throw new Error('Таск олдсонгүй');
    }

    return NextResponse.json({
      success: true,
      data: { tasks },
      message: `${tasks.length} таск үүсгэгдлээ`,
    });
  } catch (err) {
    console.error('generate-project-tasks API error:', err);
    const message = err instanceof Error ? err.message : 'Таск үүсгэхэд алдаа гарлаа';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
