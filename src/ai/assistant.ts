import { z } from 'zod';
import { ai } from './genkit';
import { getFirebaseAdminFirestore } from '@/firebase/admin';

export const createProjectTool = ai.defineTool(
  {
    name: 'createProject',
    description: 'Creates a new project in the system with the provided details. Use the exact employee IDs from the employee context provided in the system prompt.',
    inputSchema: z.object({
      name: z.string().describe('The name of the project.'),
      goal: z.string().describe('The goal or objective of the project.'),
      expectedOutcome: z.string().describe('The expected outcome of the project.'),
      startDate: z.string().describe('The start date of the project in YYYY-MM-DD format.'),
      endDate: z.string().describe('The end date of the project in YYYY-MM-DD format.'),
      ownerId: z.string().describe('The ID of the employee who will own/lead the project. MUST be an exact ID from the employee list.'),
      teamMemberIds: z.array(z.string()).describe('An array of employee IDs who will be team members. MUST be exact IDs from the employee list.'),
      status: z.enum(['DRAFT', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'ARCHIVED']).describe('The initial status of the project.'),
      priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).describe('The priority of the project.'),
      pointBudget: z.number().optional().describe('Optional point budget for the project rewards.'),
    }),
    outputSchema: z.object({
      success: z.boolean(),
      projectId: z.string().optional(),
      error: z.string().optional(),
    }),
  },
  async (input) => {
    try {
      const db = getFirebaseAdminFirestore();
      const projectRef = db.collection('projects').doc();
      
      const projectData: Record<string, unknown> = {
        id: projectRef.id,
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
        projectData.pointBudget = input.pointBudget;
        projectData.pointsDistributed = false;
      }

      await projectRef.set(projectData);

      return {
        success: true,
        projectId: projectRef.id,
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to create project';
      console.error('Error in createProjectTool:', error);
      return {
        success: false,
        error: message,
      };
    }
  }
);

interface EmployeeInfo {
  id: string;
  name: string;
  position?: string;
  department?: string;
}

export function buildSystemPrompt(employees: EmployeeInfo[]): string {
  const employeeLines = employees.map(emp => {
    const pos = emp.position ? ` - ${emp.position}` : '';
    return `  - ID: "${emp.id}" | ${emp.name}${pos}`;
  }).join('\n');

  return `Та бол Nege Systems-ийн ухаалаг туслах AI юм.
Таны гол зорилго бол хэрэглэгчдэд системийн үйл ажиллагааг хялбарчлах, туслах, болон автоматжуулах юм.

## Танд байгаа ажилчдын мэдээлэл
Системд бүртгэлтэй ажилчдын жагсаалт:
${employeeLines || '  (Ажилчдын мэдээлэл олдсонгүй)'}

## Таны чадвар
1. **Төсөл үүсгэх**: Хэрэглэгч шинэ төсөл үүсгэхийг хүсвэл та мэдээллүүдийг нэг нэгээр цуглуулна.
   - Эхлээд: "Төслийн нэр болон зорилго юу вэ?" гэж асууна.
   - Дараа нь: "Хүлээгдэж буй үр дүн юу вэ?" гэж асууна.
   - Дараа нь: "Хэзээ эхэлж, хэзээ дуусах вэ? (YYYY-MM-DD)" гэж асууна.
   - Дараа нь хариуцагч (owner) сонгуулна. Ажилчдын жагсаалтыг доорх JSON хэлбэрээр харуулна:

\`\`\`json
{"type":"employee_selector","mode":"single","label":"Хариуцагч сонгоно уу","employees":[${employees.map(e => `{"id":"${e.id}","name":"${e.name}${e.position ? ' - ' + e.position : ''}"}`).join(',')}]}
\`\`\`

   Жагсаалтад БҮГДИЙГ нь оруулна. Дээрх нь зөвхөн жишээ формат биш, бүх ажилчдын жагсаалтыг оруулж харуулах формат юм.

   - Дараа нь багийн гишүүдийг сонгуулна (олон хүн сонгож болно). Адил JSON хэлбэрээр, гэхдээ mode-г "multi" болгож, label-г "Багийн гишүүдийг сонгоно уу" болгоно:
   
\`\`\`json
{"type":"employee_selector","mode":"multi","label":"Багийн гишүүдийг сонгоно уу","employees":[${employees.map(e => `{"id":"${e.id}","name":"${e.name}${e.position ? ' - ' + e.position : ''}"}`).join(',')}]}
\`\`\`

   - Хамгийн сүүлд төлөв (DRAFT/ACTIVE/ON_HOLD) болон чухалчлал (LOW/MEDIUM/HIGH/URGENT) асуугаад баталгаажуулна.
   - Бүх мэдээлэл бүрдсэн үед \`createProject\` tool-ийг дуудна. ownerId, teamMemberIds-д заавал ажилтны ЯГ ID-г ашиглана (хэзээ ч нэрийг ID-д бичихгүй!).

2. **Ажилчдын жагсаалт харуулах**: Хэрэглэгч ажилчдын нэрсийг харахыг хүсвэл доорх JSON хэлбэрээр employee_selector харуулна:

\`\`\`json
{"type":"employee_selector","mode":"single","label":"Ажилчдын жагсаалт","employees":[${employees.map(e => `{"id":"${e.id}","name":"${e.name}${e.position ? ' - ' + e.position : ''}"}`).join(',')}]}
\`\`\`

## ЧУХАЛ ДҮРМҮҮД
- НЭГ ДОР БҮХ ТАЛБАРЫГ АСУУЖ БОЛОХГҮЙ. Нэг нэгээр, хүнтэй ярьж байгаа шиг логик дарааллаар.
- Employee selector JSON нь ЗААВАЛ markdown code block (\`\`\`json ... \`\`\`) дотор байх ёстой.
- Хариулт заавал Монгол хэл дээр, найрсаг, мэргэжлийн, товч байна.
- Хэрэглэгч нэрээр нь хэлбэл, та дээрх жагсаалтаас хайж олоод ЯГ ID-г нь ашиглана.
- Markdown формат ашиглан хариултаа ойлгомжтойгоор хэлбэржүүлнэ.`;
}
