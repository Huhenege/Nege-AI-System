import { NextRequest, NextResponse } from 'next/server';
import { ai } from '@/ai/genkit';
import { googleAI } from '@genkit-ai/google-genai';
import { requireAuth } from '@/lib/api/auth-middleware';

type GenerationType = 'departmentTypes' | 'positionLevels' | 'employmentTypes';

interface GenerationConfig {
  prompt: string;
  parseResult: (text: string) => any[];
}

const GENERATION_CONFIGS: Record<GenerationType, GenerationConfig> = {
  departmentTypes: {
    prompt: `Монгол байгууллагын бүтцийн нэгжийн төрлүүдийг үүсгэ. Дунд болон том хэмжээний компанид хамаарах түгээмэл бүтцийн нэгж.
    
Return JSON array with objects: { "name": "нэр", "level": тоо }
- level нь 1-ээс эхлэнэ (дээд түвшин), 2, 3, 4 гэх мэт доошлоно
- Жишээ бүтэц: Газар (level 1) -> Хэлтэс (level 2) -> Алба (level 3) -> Тасаг (level 4)

8-10 төрөл үүсгэ. Return ONLY valid JSON array, no explanation.`,
    parseResult: (text: string) => {
      const match = text.match(/\[[\s\S]*\]/);
      if (!match) throw new Error('Invalid response format');
      return JSON.parse(match[0]);
    }
  },
  positionLevels: {
    prompt: `Монгол байгууллагын ажлын байрны зэрэглэлүүдийг үүсгэ. Дунд болон том хэмжээний компанид хамаарах түгээмэл албан тушаалын зэрэглэл.

Return JSON array with objects: { "name": "нэр", "level": тоо }
- level нь эрэмбэ заана (1 = дээд удирдлага, тоо өсөхөд доошилно)
- Жишээ: Дээд удирдлага (level 1), Дунд удирдлага (level 2), Мэргэжилтэн (level 3), Ажилтан (level 4)

10-12 зэрэглэл үүсгэ. Return ONLY valid JSON array, no explanation.`,
    parseResult: (text: string) => {
      const match = text.match(/\[[\s\S]*\]/);
      if (!match) throw new Error('Invalid response format');
      return JSON.parse(match[0]);
    }
  },
  employmentTypes: {
    prompt: `Монгол байгууллагын ажлын байрны төрлүүдийг үүсгэ (хөдөлмөрийн гэрээний төрөл).

Return JSON array with objects: { "name": "нэр" }
- Монголын хөдөлмөрийн хуулинд заасан болон түгээмэл хэрэглэгддэг төрлүүд
- Жишээ: Үндсэн, Гэрээт, Цагийн, Туршилтын, Улирлын, Түр гэх мэт

8-10 төрөл үүсгэ. Return ONLY valid JSON array, no explanation.`,
    parseResult: (text: string) => {
      const match = text.match(/\[[\s\S]*\]/);
      if (!match) throw new Error('Invalid response format');
      return JSON.parse(match[0]);
    }
  }
};

export async function POST(request: NextRequest) {
  const authResult = await requireAuth(request, { rateLimit: 'ai' });
  if (authResult.response) return authResult.response;

  try {
    const { type, context } = await request.json();

    if (!type || !GENERATION_CONFIGS[type as GenerationType]) {
      return NextResponse.json(
        { error: 'Буруу төрөл заагдсан' },
        { status: 400 }
      );
    }

    const config = GENERATION_CONFIGS[type as GenerationType];
    
    // Add context if provided (e.g., company info, existing data)
    let fullPrompt = config.prompt;
    if (context?.companyName) {
      fullPrompt = `Компанийн нэр: ${context.companyName}\n\n${fullPrompt}`;
    }
    if (context?.industry) {
      fullPrompt = `Салбар: ${context.industry}\n\n${fullPrompt}`;
    }

    const { text } = await ai.generate({
      model: googleAI.model('gemini-2.5-flash'),
      prompt: fullPrompt,
      config: { temperature: 0.3 },
    });

    if (!text?.trim()) {
      throw new Error('AI хариу хоосон байна');
    }

    const data = config.parseResult(text);

    return NextResponse.json({
      success: true,
      data,
      message: 'Амжилттай үүсгэлээ',
    });
  } catch (err) {
    console.error('generate-org-defaults API error:', err);
    const message = err instanceof Error ? err.message : 'Үүсгэхэд алдаа гарлаа';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
