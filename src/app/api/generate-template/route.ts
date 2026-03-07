import { NextRequest, NextResponse } from 'next/server';
import { ai } from '@/ai/genkit';
import { googleAI } from '@genkit-ai/google-genai';
import { requireAuth } from '@/lib/api/auth-middleware';

interface CustomInput {
    key: string;
    label: string;
    description: string;
    required: boolean;
    type: 'text' | 'number' | 'date' | 'boolean';
    order: number;
}

interface GeneratedTemplate {
    content: string;
    customInputs: CustomInput[];
}

const TEMPLATE_PROMPT = `Та бол Монгол улсын хөдөлмөрийн хууль тогтоомж, MNS 5140-2:2021 "Баримт бичиг. Баримт бичгийн бүрдэл, тэдгээрт тавих шаардлага" стандартад нийцсэн HR баримт бичгийн загвар боловсруулагч мэргэжилтэн.

Хэрэглэгчийн өгсөн мэдээллийн дагуу албан ёсны баримт бичгийн загвар бэлтгэнэ үү.

═══════════════════════════════════════════════════════════════
MNS 5140-2:2021 СТАНДАРТЫН ШААРДЛАГА
═══════════════════════════════════════════════════════════════

ХУУДАСНЫ ФОРМАТ:
- Хэмжээ: A4 (210 × 297 мм)
- Зай (margin): Дээд/доод 30мм, Зүүн/баруун 25мм
- Үсгийн хэмжээ: 12pt (үндсэн текст), 14pt (гарчиг)
- Мөр хоорондын зай: 1.5
- Үсгийн фонт: Times New Roman эсвэл түүнтэй адил

БАРИМТ БИЧГИЙН БҮТЭЦ (дээрээс доош):
1. ТОЛГОЙ ХЭСЭГ (Header):
   - Байгууллагын нэр (төвд, том үсгээр)
   - Байгууллагын хаяг, утас, имэйл (жижиг үсгээр)
   
2. БАРИМТЫН МЭДЭЭЛЭЛ:
   - Баримтын дугаар (баруун талд)
   - Огноо (баруун талд, дугаарын доор)
   - Газар/хот нэр (зүүн талд)

3. ХҮЛЭЭН АВАГЧ (шаардлагатай бол):
   - Хэнд: [Албан тушаал, Нэр]
   
4. ГАРЧИГ/СЭДЭВ:
   - Төвд байрлуулах, том үсгээр
   - Тухайн баримтын төрлийг тодорхой илэрхийлсэн байх

5. ҮНДСЭН АГУУЛГА:
   - Оршил/үндэслэл (яагаад энэ баримт гарч байгаа)
   - Үндсэн хэсэг (шийдвэр, нөхцөл, заалтууд)
   - Дүгнэлт/хүсэлт (шаардлагатай бол)

6. ГАРЫН ҮСЭГ ХЭСЭГ:
   - Албан тушаал (зүүн талд)
   - Гарын үсэг (дунд)
   - Нэр (баруун талд)
   - Тамга/тэмдгийн байрлал

7. ХАВСРАЛТ (шаардлагатай бол):
   - "Хавсралт: [тоо] хуудас" гэж бичих

БИЧЛЭГИЙН ХЭЛБЭР:
- Ойлгомжтой, энгийн, тодорхой байх
- Албан ёсны хэл найруулга ашиглах
- Товчлол хэрэглэхгүй (эсвэл анх удаа бүтнээр бичих)
- Хүний нэр, огноо, дугаарыг үнэн зөв бичих
- Далд утга, шилжсэн утгатай үг хэрэглэхгүй

ЗААВАР:
1. HTML форматаар бичнэ (inline CSS стиль ашиглан)
2. Дээрх стандарт бүтцийг баримтлах
3. Placeholder-үүдийг {{variable_name}} форматаар бичих
4. Монгол хэл дээр бичих
5. CSS-д print-friendly стиль оруулах (@media print)

СИСТЕМИЙН PLACEHOLDER-УУД (эдгээрийг customInputs-д оруулах ШААРДЛАГАГҮЙ, автоматаар солигдоно):

БАЙГУУЛЛАГА:
- {{company.name}} - Байгууллагын нэр
- {{company.legalName}} - Хуулийн нэр
- {{company.registrationNumber}} - Регистрийн дугаар
- {{company.taxId}} - Татвар төлөгчийн дугаар (ТТД)
- {{company.address}} - Хаяг
- {{company.ceo}} - Захирлын нэр
- {{company.website}} - Вэбсайт
- {{company.email}} - Холбоо барих имэйл
- {{company.phone}} - Утасны дугаар
- {{company.industry}} - Үйл ажиллагааны чиглэл
- {{company.employeeCount}} - Ажилчдын тоо
- {{company.establishedDate}} - Байгуулагдсан огноо
- {{company.mission}} - Эрхэм зорилго
- {{company.vision}} - Алсын хараа
- {{company.introduction}} - Танилцуулга

АЖИЛТАН:
- {{employee.lastName}} - Овог
- {{employee.firstName}} - Нэр
- {{employee.fullName}} - Бүтэн нэр
- {{employee.email}} - Имэйл
- {{employee.phone}} - Утас
- {{employee.code}} - Ажилтны код
- {{employee.jobTitle}} - Албан тушаал
- {{employee.hireDate}} - Ажилд орсон огноо
- {{employee.registerNo}} - Регистрийн дугаар
- {{employee.address}} - Гэрийн хаяг
- {{employee.birthDate}} - Төрсөн огноо

АЖЛЫН БАЙР:
- {{position.title}} - Албан тушаалын нэр
- {{position.code}} - Албан тушаалын код
- {{position.purpose}} - Ажлын байрны зорилго
- {{position.levelName}} - Албан тушаалын түвшин
- {{position.employmentTypeName}} - Хөдөлмөр эрхлэлтийн төрөл
- {{position.workScheduleName}} - Ажлын цагийн хуваарь
- {{position.jobCategoryName}} - Ажлын ангилал
- {{position.reportsToName}} - Шууд удирдлага
- {{position.salary.min}} - Цалингийн доод хэмжээ
- {{position.salary.max}} - Цалингийн дээд хэмжээ
- {{position.salary.mid}} - Цалингийн дундаж
- {{position.salary.currency}} - Валют
- {{position.salary.period}} - Цалингийн давтамж
- {{position.salaryStepName}} - Цалингийн шатлал
- {{position.salaryStepValue}} - Цалингийн шатлалын дүн
- {{position.experience.totalYears}} - Шаардлагатай туршлага (жил)
- {{position.experience.educationLevel}} - Боловсролын түвшин
- {{position.experience.leadershipYears}} - Удирдах туршлага (жил)
- {{position.budget.yearlyBudget}} - Жилийн төсөв
- {{position.benefits.vacationDays}} - Амралтын өдөр (жилд)
- {{position.benefits.isRemoteAllowed}} - Зайнаас ажиллах боломж
- {{position.benefits.flexibleHours}} - Уян хатан цагийн хуваарь

АЛБАН НЭГЖ:
- {{department.name}} - Албан нэгжийн нэр
- {{department.code}} - Албан нэгжийн код
- {{department.typeName}} - Албан нэгжийн төрөл
- {{department.status}} - Төлөв
- {{department.parentName}} - Харьяалагдах албан нэгж
- {{department.vision}} - Зорилго
- {{department.description}} - Чиг үүрэг
- {{department.managerName}} - Удирдлагын нэр
- {{department.managerPositionName}} - Удирдлагын албан тушаал
- {{department.filled}} - Ажилтны тоо
- {{department.positionCount}} - Ажлын байрны тоо

СИСТЕМ:
- {{date.today}} - Өнөөдрийн огноо
- {{date.year}} - Одоогийн жил
- {{date.month}} - Одоогийн сар
- {{date.day}} - Одоогийн өдөр
- {{user.name}} - Одоогийн хэрэглэгч
- {{document.number}} - Баримтын дугаар (автомат, жнь: ГЭР-2026-0001)

ШААРДЛАГАТАЙ БОЛ ӨӨРИЙН PLACEHOLDER НЭМЖ БОЛНО (эдгээрийг customInputs-д заавал оруулна):
- Гэрээний хугацаа, цалин, нэмэлт нөхцөл гэх мэт

HTML ЗАГВАРЫН ҮНДСЭН СТИЛЬ (заавал ашиглах):
<style>
  body { font-family: 'Times New Roman', serif; font-size: 12pt; line-height: 1.5; }
  .document { max-width: 210mm; margin: 0 auto; padding: 30mm 25mm; }
  .header { text-align: center; margin-bottom: 20px; }
  .company-name { font-size: 14pt; font-weight: bold; text-transform: uppercase; }
  .company-info { font-size: 10pt; color: #666; }
  .doc-meta { display: flex; justify-content: space-between; margin: 20px 0; }
  .doc-number { text-align: right; }
  .title { text-align: center; font-size: 14pt; font-weight: bold; margin: 30px 0; text-transform: uppercase; }
  .content { text-align: justify; }
  .signature-block { margin-top: 50px; display: flex; justify-content: space-between; }
  .signature-item { text-align: center; }
  p { margin: 10px 0; text-indent: 20px; }
</style>

JSON ХАРИУ ФОРМАТААР БУЦААНА:
{
    "content": "<div class='document'>...</div>",
    "customInputs": [
        {
            "key": "variable_name",
            "label": "Утгын нэр (Монголоор)",
            "description": "Тайлбар",
            "required": true,
            "type": "text|number|date|boolean",
            "order": 0
        }
    ]
}`;

export async function POST(request: NextRequest) {
    const authResult = await requireAuth(request);
    if (authResult.response) return authResult.response;

    try {
        const { templateName, documentTypeName, additionalContext } = await request.json();

        if (!templateName) {
            return NextResponse.json(
                { error: 'Template name is required' },
                { status: 400 }
            );
        }

        const userPrompt = `
Загварын нэр: ${templateName}
${documentTypeName ? `Баримтын төрөл: ${documentTypeName}` : ''}
${additionalContext ? `Нэмэлт мэдээлэл: ${additionalContext}` : ''}

MNS 5140-2:2021 стандартын дагуу албан ёсны баримт бичгийн HTML загвар үүсгэнэ үү.
- Толгой хэсэг (байгууллагын нэр, хаяг)
- Баримтын дугаар, огноо
- Гарчиг
- Үндсэн агуулга (оршил, үндсэн хэсэг)
- Гарын үсэг хэсэг

JSON форматаар хариулна уу.`;

        const { text } = await ai.generate({
            model: googleAI.model('gemini-2.5-flash'),
            prompt: `${TEMPLATE_PROMPT}\n\n${userPrompt}`,
            config: { temperature: 0.4 },
        });

        if (!text?.trim()) {
            throw new Error('AI хариу хоосон байна');
        }

        // Parse JSON from response
        let result: GeneratedTemplate;
        try {
            // Try to extract JSON from the response
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                result = JSON.parse(jsonMatch[0]);
            } else {
                throw new Error('No JSON found in response');
            }
        } catch (parseError) {
            console.error('Failed to parse AI response:', text);
            return NextResponse.json(
                { error: 'Failed to parse AI response' },
                { status: 500 }
            );
        }

        // Validate and ensure customInputs have proper order
        if (result.customInputs) {
            result.customInputs = result.customInputs.map((input, index) => ({
                ...input,
                order: index,
                required: input.required ?? true,
                type: input.type || 'text'
            }));
        }

        return NextResponse.json({
            success: true,
            data: result
        });

    } catch (error) {
        console.error('Template generation error:', error);
        return NextResponse.json(
            { error: 'Failed to generate template' },
            { status: 500 }
        );
    }
}
