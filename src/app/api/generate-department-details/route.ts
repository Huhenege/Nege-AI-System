import { NextRequest, NextResponse } from 'next/server';
import { ai } from '@/ai/genkit';
import { googleAI } from '@genkit-ai/google-genai';
import { requireAuth } from '@/lib/api/auth-middleware';

const DEPARTMENT_PROMPT = `Та бол Монгол улсын байгууллагын бүтэц, зохион байгуулалтын мэргэжилтэн.

Дараах мэдээлэл дээр үндэслэн тухайн нэгжийн ЗОРИЛГО болон ЧИГ ҮҮРГИЙГ Монгол хэл дээр үүсгэнэ үү.

Шаардлага:
1. ЗОРИЛГО (vision): 2-3 өгүүлбэрээр илэрхийлсэн, урт хугацааны стратегийн чиглэл, алсын хараа.
2. ЧИГ ҮҮРЭГ (description): 4-6 үндсэн чиг үүргийг тодорхой, товч оруулах. Чиг үүрэг бүр нэг мөрөнд байх.

JSON форматаар хариулна уу:
{
  "vision": "Нэгжийн зорилго энд...",
  "description": "1. Эхний чиг үүрэг\\n2. Хоёр дахь чиг үүрэг\\n3. Гурав дахь чиг үүрэг\\n..."
}

Зөвхөн JSON хариулна уу, өөр тайлбар бичих шаардлагагүй.`;

export async function POST(request: NextRequest) {
    const authResult = await requireAuth(request);
    if (authResult.response) return authResult.response;

    try {
        const { departmentName, departmentType, parentDepartment } = await request.json();

        if (!departmentName) {
            return NextResponse.json(
                { error: 'Нэгжийн нэр шаардлагатай' },
                { status: 400 }
            );
        }

        const userPrompt = `
Нэгжийн нэр: ${departmentName}
Нэгжийн төрөл: ${departmentType || 'Тодорхойгүй'}
Харьяалагдах нэгж: ${parentDepartment || 'Үндсэн нэгж'}
`;

        const { text } = await ai.generate({
            model: googleAI.model('gemini-2.5-flash'),
            prompt: `${DEPARTMENT_PROMPT}\n\n${userPrompt}`,
            config: {
                temperature: 0.4,
            },
        });

        if (!text?.trim()) {
            return NextResponse.json(
                { error: 'AI хариу хоосон байна' },
                { status: 500 }
            );
        }

        // Parse JSON response
        const cleanedText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        
        let result;
        try {
            result = JSON.parse(cleanedText);
        } catch (parseError) {
            console.error('JSON parse error:', parseError, 'Raw text:', text);
            return NextResponse.json(
                { error: 'AI хариуг боловсруулж чадсангүй' },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            data: {
                vision: result.vision || '',
                description: result.description || ''
            }
        });

    } catch (error) {
        console.error('Department details generation error:', error);
        return NextResponse.json(
            { error: 'Серверийн алдаа гарлаа' },
            { status: 500 }
        );
    }
}
