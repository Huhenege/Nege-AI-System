import { NextRequest, NextResponse } from 'next/server';
import { ai } from '@/ai/genkit';
import { googleAI } from '@genkit-ai/google-genai';
import { requireAuth } from '@/lib/api/auth-middleware';

export const maxDuration = 60;

interface ReferenceDataRequest {
  category: string;
  existingItems?: string[];
}

const CATEGORY_PROMPTS: Record<string, { prompt: string; examples: string }> = {
  questionnaireCountries: {
    prompt: `Монгол хүмүүсийн боловсрол эзэмшдэг гадаад улс орнуудын жагсаалт үүсгэ.
Эхлээд Монгол улсыг, дараа нь хамгийн түгээмэл улсуудыг оруул.`,
    examples: 'Монгол, ОХУ, БНХАУ, БНСУ, Япон, АНУ, Герман, Австрали'
  },
  questionnaireSchools: {
    prompt: `Монгол улсын их, дээд сургууль, коллежуудын жагсаалт үүсгэ.
Төрийн болон хувийн их сургуулиуд, коллежуудыг оруул.
Томоохон, алдартай сургуулиудыг эхэнд байрлуул.`,
    examples: 'МУИС, ШУТИС, МУБИС, ХААИС, ЭМШУИС, Отгонтэнгэр ИС, Идэр ИС'
  },
  questionnaireDegrees: {
    prompt: `Монголд түгээмэл эзэмшдэг мэргэжлүүдийн жагсаалт үүсгэ.
Бизнес, IT, Эрүүл мэнд, Инженер, Эрх зүй, Боловсрол зэрэг салбаруудын мэргэжлүүд.`,
    examples: 'Нягтлан бодох бүртгэл, Програм хангамж, Эрх зүй, Анагаах ухаан, Барилгын инженер'
  },
  questionnaireAcademicRanks: {
    prompt: `Монголын боловсролын системд хэрэглэгддэг эрдмийн зэрэг, цолуудын жагсаалт үүсгэ.
Дээд боловсролын зэргүүдээс эхэл.`,
    examples: 'Бакалавр, Магистр, Доктор (PhD), Профессор, Дэд профессор'
  },
  questionnaireLanguages: {
    prompt: `Монголчуудын түгээмэл сурдаг гадаад хэлнүүдийн жагсаалт үүсгэ.
Хамгийн түгээмэл хэлнүүдээс эхэл.`,
    examples: 'Англи хэл, Орос хэл, Хятад хэл, Солонгос хэл, Япон хэл, Герман хэл'
  },
  questionnaireFamilyRelationships: {
    prompt: `Гэр бүлийн гишүүдийн хамаарлын жагсаалт үүсгэ (Монгол хэлээр).
Ойрын гэр бүлийн гишүүдээс эхэл.`,
    examples: 'Эхнэр, Нөхөр, Хүүхэд, Эцэг, Эх, Ах, Эгч, Дүү'
  },
  questionnaireEmergencyRelationships: {
    prompt: `Яаралтай үед холбоо барих хүмүүсийн хамаарлын жагсаалт үүсгэ (Монгол хэлээр).
Гэр бүл болон найз нөхдийг оруул.`,
    examples: 'Эхнэр, Нөхөр, Эцэг, Эх, Ах, Эгч, Найз, Хамтран ажиллагч'
  },
  questionnaireEmploymentTypes: {
    prompt: `Монголын хөдөлмөрийн харилцаанд хэрэглэгддэг ажлын нөхцлийн төрлүүдийн жагсаалт үүсгэ.
Хөдөлмөрийн гэрээний төрлүүдийг оруул.`,
    examples: 'Үндсэн ажилтан, Гэрээт ажилтан, Цагийн ажилтан, Туршилтын хугацаатай, Улирлын чанартай'
  },
  jobCategories: {
    prompt: `Монголын ажил мэргэжлийн ангиллын кодууд (ҮАМА - Үндэсний ажил мэргэжлийн ангилал).
Код болон нэрийг хамт оруул. Код нь 4 оронтой тоо байна.`,
    examples: '2411 - Нягтлан бодогч, 2512 - Програм хангамж хөгжүүлэгч, 2310 - Их сургуулийн багш'
  },
};

const SYSTEM_PROMPT = `Та Монгол улсын HR системийн лавлах сангийн мэдээлэл үүсгэх туслах юм.
Заавал Монгол хэлээр хариулна.
Зөвхөн JSON array буцаана, тайлбар бичихгүй.
Бодит, зөв мэдээлэл өгнө.`;

function parseJsonArray(raw: string): string[] {
  const trimmed = raw.trim();
  // Try to extract JSON array
  const jsonMatch = trimmed.match(/\[[\s\S]*\]/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      if (Array.isArray(parsed)) {
        // Handle both string arrays and object arrays
        return parsed.map(item => {
          if (typeof item === 'string') return item;
          if (typeof item === 'object' && item.name) return item.name;
          if (typeof item === 'object' && item.code && item.name) return `${item.code}|${item.name}`;
          return String(item);
        }).filter(Boolean);
      }
    } catch (e) {
      console.error('JSON parse error:', e);
    }
  }
  
  // Fallback: split by newlines or commas
  return trimmed
    .split(/[\n,]/)
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('[') && !s.startsWith(']'));
}

export async function POST(request: NextRequest) {
  const authResult = await requireAuth(request);
  if (authResult.response) return authResult.response;

  try {
    const body: ReferenceDataRequest = await request.json();
    const { category, existingItems = [] } = body;

    const categoryConfig = CATEGORY_PROMPTS[category];
    if (!categoryConfig) {
      return NextResponse.json(
        { error: `Unknown category: ${category}` },
        { status: 400 }
      );
    }

    const existingNote = existingItems.length > 0 
      ? `\n\nАль хэдийн байгаа утгууд (давхардуулахгүй): ${existingItems.join(', ')}`
      : '';

    const isJobCategories = category === 'jobCategories';
    const formatNote = isJobCategories
      ? '\n\nФормат: JSON array of objects with "code" and "name" fields. Example: [{"code": "2411", "name": "Нягтлан бодогч"}]'
      : '\n\nФормат: JSON array of strings. Example: ["Утга 1", "Утга 2", "Утга 3"]';

    const prompt = `${categoryConfig.prompt}

Жишээ: ${categoryConfig.examples}${existingNote}${formatNote}

20-30 утга үүсгэ.`;

    const { text } = await ai.generate({
      model: googleAI.model('gemini-2.5-flash'),
      system: SYSTEM_PROMPT,
      prompt,
      config: { temperature: 0.3 },
    });

    if (!text?.trim()) {
      throw new Error('AI returned empty response');
    }

    const items = parseJsonArray(text);

    // Filter out existing items
    const existingSet = new Set(existingItems.map(i => i.toLowerCase()));
    const newItems = items.filter(item => {
      const checkValue = item.includes('|') ? item.split('|')[1] : item;
      return !existingSet.has(checkValue.toLowerCase());
    });

    // Format response based on category
    let formattedItems: any[];
    if (isJobCategories) {
      formattedItems = newItems.map(item => {
        if (item.includes('|')) {
          const [code, name] = item.split('|');
          return { code: code.trim(), name: name.trim() };
        }
        // Try to extract code from format "1234 - Name"
        const match = item.match(/^(\d{4})\s*[-–]\s*(.+)$/);
        if (match) {
          return { code: match[1], name: match[2].trim() };
        }
        return { code: '', name: item };
      });
    } else {
      formattedItems = newItems.map(name => ({ name }));
    }

    return NextResponse.json({
      success: true,
      items: formattedItems,
      count: formattedItems.length,
    });
  } catch (error) {
    console.error('Reference data generation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate data' },
      { status: 500 }
    );
  }
}
