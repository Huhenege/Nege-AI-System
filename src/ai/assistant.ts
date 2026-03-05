import { z } from 'zod';
import { ai } from './genkit';
import { getFirebaseAdminFirestore } from '@/firebase/admin';

export const createProjectTool = ai.defineTool(
  {
    name: 'createProject',
    description: 'Creates a new project in the system with the provided details.',
    inputSchema: z.object({
      name: z.string().describe('The name of the project.'),
      goal: z.string().describe('The goal or objective of the project.'),
      expectedOutcome: z.string().describe('The expected outcome of the project.'),
      startDate: z.string().describe('The start date of the project in YYYY-MM-DD format.'),
      endDate: z.string().describe('The end date of the project in YYYY-MM-DD format.'),
      ownerId: z.string().describe('The ID of the employee who will own/lead the project.'),
      teamMemberIds: z.array(z.string()).describe('An array of employee IDs who will be team members.'),
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
      
      const projectData: any = {
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
    } catch (error: any) {
      console.error('Error in createProjectTool:', error);
      return {
        success: false,
        error: error.message || 'Failed to create project',
      };
    }
  }
);

export const listEmployeesTool = ai.defineTool(
  {
    name: 'listEmployees',
    description: 'Fetches a list of active employees in the system, returning their IDs, names, and positions. Use this when the user needs to select an owner or team members.',
    inputSchema: z.object({}),
    outputSchema: z.object({
      employees: z.array(
        z.object({
          id: z.string(),
          name: z.string(),
          position: z.string().optional(),
          department: z.string().optional()
        })
      ),
      success: z.boolean(),
      error: z.string().optional()
    }),
  },
  async () => {
    try {
      const db = getFirebaseAdminFirestore();
      
      // Fetch employees
      const employeesSnap = await db.collection('employees').get();
      
      // We might need position and department names, let's fetch them
      const positionsSnap = await db.collection('positions').get();
      const departmentsSnap = await db.collection('departments').get();
      
      const positionMap = new Map();
      positionsSnap.docs.forEach(doc => positionMap.set(doc.id, doc.data().title || doc.data().name));
      
      const departmentMap = new Map();
      departmentsSnap.docs.forEach(doc => departmentMap.set(doc.id, doc.data().name));
      
      const employees = employeesSnap.docs.map(doc => {
        const data = doc.data();
        const firstName = data.firstName || '';
        const lastName = data.lastName || '';
        const fullName = `${lastName} ${firstName}`.trim() || data.email || 'Нэргүй ажилтан';
        
        return {
          id: doc.id,
          name: fullName,
          position: data.positionId ? positionMap.get(data.positionId) : undefined,
          department: data.departmentId ? departmentMap.get(data.departmentId) : undefined,
        };
      });
      
      return {
        success: true,
        employees
      };
    } catch (error: any) {
      console.error('Error fetching employees:', error);
      return {
        success: false,
        employees: [],
        error: error.message || 'Failed to fetch employees'
      };
    }
  }
);

export const systemPrompt = `
Та бол Nege Systems-ийн ухаалаг туслах AI юм. 
Таны гол зорилго бол хэрэглэгчдэд системийн үйл ажиллагааг хялбарчлах, туслах, болон автоматжуулах явдал юм.

Та дараах үйлдлүүдийг хийж чадна:
1. **Төсөл үүсгэх**: Хэрэглэгч шинэ төсөл үүсгэхийг хүсвэл та төсөлд шаардлагатай мэдээллүүдийг цуглуулна. Ингэхдээ **НЭГ ДОР БҮХ ТАЛБАРЫГ АСУУЖ БОЛОХГҮЙ**. Яг л хүнтэй харилцаж байгаа мэт НЭГ НЭГЭЭР нь, эсвэл хоёр хоёроор нь логик дарааллаар асууна.
   - Жишээ нь: Эхлээд зөвхөн "Төслийн нэр болон зорилго юу вэ?" гэж асууна. 
   - Түүнийг хариулсны дараа "Ойлголоо. Хэзээ эхэлж, хэзээ дуусах вэ? (Он-Сар-Өдөр форматаар хэлнэ үү)" гэх мэтээр үргэлжлүүлнэ.
   - Дараа нь хариуцагч болон багийн гишүүдийг асууна (хэрэгтэй бол listEmployees ашиглаж нэрсийг нь санал болгоно).
   - Хамгийн сүүлд төлөв болон чухалчлалыг баталгаажуулаад, бүх мэдээлэл бүрдсэн үед \`createProject\` tool-ийг дуудна.
2. **Ажилчдын жагсаалт харах болон Сонгох**: Хэрэглэгч ажилчдын нэрсийг харахыг хүсвэл, эсвэл хариуцагч/багийн гишүүдийг сонгуулах шаардлагатай бол \`listEmployees\` багажийг ашиглан ажилчдыг дуудна. Дараа нь хэрэглэгчид **зөвхөн доорх JSON форматыг яг энэ чигээр нь** буцаана (Өөр текст бичиж болно, гэхдээ JSON хэсгийг markdown code block дотор заавал оруулаарай):

\`\`\`json
{
  "type": "employee_selector",
  "employees": [
    {"id": "тухайн_ажилтны_id", "name": "Ажилтны Нэр - Албан тушаал"}
  ]
}
\`\`\`

\`listEmployees\`-ээс ирсэн бүх ажилчдын мэдээллийг энэ JSON дотор жагсааж бичнэ. Хэрэглэгч энэ жагсаалтаас дарж сонгоход танд "Бат-Эрдэнэ" гэх мэтээр нэр нь ирэх бөгөөд та цаанаа **тэр хүнийг listEmployees-ийн үр дүнгээс хайж олж, яг ID-г нь ашиглаж** \`createProject\` рүү (ownerId, teamMemberIds) дамжуулах ёстой. ХЭЗЭЭ Ч хүний нэрийг ID-ийн оронд явуулж болохгүй! Зөвхөн ID-г нь явуулна.

Таны хариулт үргэлж монгол хэл дээр, мэргэжлийн, найрсаг, товч бөгөөд тодорхой байх ёстой. Мөн хэрэглэгчтэй чатлаж байхдаа markdown формат ашиглан текстээ ойлгомжтойгоор хэлбэржүүлнэ.
`;
