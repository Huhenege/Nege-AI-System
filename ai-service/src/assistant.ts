import { z } from 'zod';
import { ai } from './genkit.js';
import { getFirestore } from './firebase-admin.js';

export const createProjectTool = ai.defineTool(
  {
    name: 'createProject',
    description: 'Creates a new project in the system. Use exact employee IDs from context.',
    inputSchema: z.object({
      name: z.string().describe('Project name'),
      goal: z.string().describe('Project goal'),
      expectedOutcome: z.string().describe('Expected outcome'),
      startDate: z.string().describe('Start date (YYYY-MM-DD)'),
      endDate: z.string().describe('End date (YYYY-MM-DD)'),
      ownerId: z.string().describe('Owner employee ID (exact)'),
      teamMemberIds: z.array(z.string()).describe('Team member IDs (exact)'),
      status: z.enum(['DRAFT', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'ARCHIVED']),
      priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']),
      pointBudget: z.number().optional(),
    }),
    outputSchema: z.object({
      success: z.boolean(),
      projectId: z.string().optional(),
      error: z.string().optional(),
    }),
  },
  async (input) => {
    try {
      const db = getFirestore();
      const ref = db.collection('projects').doc();

      const data: Record<string, unknown> = {
        id: ref.id,
        name: input.name,
        goal: input.goal,
        expectedOutcome: input.expectedOutcome,
        startDate: input.startDate,
        endDate: input.endDate,
        ownerId: input.ownerId,
        teamMemberIds: input.teamMemberIds,
        status: input.status,
        priority: input.priority,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: input.ownerId,
      };

      if (input.pointBudget && input.pointBudget > 0) {
        data.pointBudget = input.pointBudget;
        data.pointsDistributed = false;
      }

      await ref.set(data);
      return { success: true, projectId: ref.id };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to create project';
      console.error('[createProject]', msg);
      return { success: false, error: msg };
    }
  }
);

export interface EmployeeInfo {
  id: string;
  name: string;
  position?: string;
  department?: string;
}

export function buildSystemPrompt(employees: EmployeeInfo[]): string {
  const lines = employees.map(e => {
    const pos = e.position ? ` - ${e.position}` : '';
    return `  - ID: "${e.id}" | ${e.name}${pos}`;
  }).join('\n');

  const empJson = (mode: string, label: string) =>
    `{"type":"employee_selector","mode":"${mode}","label":"${label}","employees":[${employees.map(e =>
      `{"id":"${e.id}","name":"${e.name}${e.position ? ' - ' + e.position : ''}"}`
    ).join(',')}]}`;

  return `Та бол Nege Systems-ийн ухаалаг туслах AI юм.
Таны гол зорилго бол хэрэглэгчдэд системийн үйл ажиллагааг хялбарчлах, туслах, болон автоматжуулах юм.

## Танд байгаа ажилчдын мэдээлэл
Системд бүртгэлтэй ажилчдын жагсаалт:
${lines || '  (Ажилчдын мэдээлэл олдсонгүй)'}

## Таны чадвар
1. **Төсөл үүсгэх**: Хэрэглэгч шинэ төсөл үүсгэхийг хүсвэл мэдээллийг нэг нэгээр цуглуулна.
   - Эхлээд: "Төслийн нэр болон зорилго юу вэ?"
   - Дараа нь: "Хүлээгдэж буй үр дүн юу вэ?"
   - Дараа нь: "Хэзээ эхэлж, хэзээ дуусах вэ? (YYYY-MM-DD)"
   - Дараа нь хариуцагч сонгуулна:

\`\`\`json
${empJson('single', 'Хариуцагч сонгоно уу')}
\`\`\`

   - Дараа нь багийн гишүүдийг сонгуулна:

\`\`\`json
${empJson('multi', 'Багийн гишүүдийг сонгоно уу')}
\`\`\`

   - Хамгийн сүүлд төлөв (DRAFT/ACTIVE/ON_HOLD) болон чухалчлал (LOW/MEDIUM/HIGH/URGENT) асууна.
   - Бүх мэдээлэл бүрдсэн үед \`createProject\` tool дуудна.

2. **Ажилчдын жагсаалт**: Хэрэглэгч ажилчдыг харахыг хүсвэл:

\`\`\`json
${empJson('single', 'Ажилчдын жагсаалт')}
\`\`\`

## ДҮРМҮҮД
- НЭГ ДОР БҮХ ТАЛБАРЫГ АСУУЖ БОЛОХГҮЙ. Нэг нэгээр логик дарааллаар.
- Employee selector JSON заавал markdown code block дотор.
- Хариулт Монгол хэлээр, найрсаг, товч.
- ownerId, teamMemberIds-д заавал ЯГ ID ашиглана.`;
}
