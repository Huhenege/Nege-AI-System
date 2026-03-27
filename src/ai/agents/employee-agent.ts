import { z } from 'zod';
import { ai } from '../genkit';
import { getFirebaseAdminFirestore } from '@/lib/firebase-admin';
import type { Employee, EmployeeStatus } from '@/types/index';

// ─── Output schemas ────────────────────────────────────────────────────────

const employeeSummarySchema = z.object({
  id: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  jobTitle: z.string().optional(),
  departmentId: z.string().optional(),
  positionId: z.string().optional(),
  status: z.string(),
  email: z.string(),
  hireDate: z.string().optional(),
  lifecycleStage: z.string().optional(),
});

const searchEmployeesOutputSchema = z.object({
  employees: z.array(employeeSummarySchema),
  total: z.number(),
});

const getEmployeeOutputSchema = z.object({
  success: z.boolean(),
  employee: employeeSummarySchema
    .extend({
      phoneNumber: z.string().optional(),
      employeeCode: z.string().optional(),
      skills: z.array(z.string()).optional(),
      terminationDate: z.string().optional(),
    })
    .optional(),
  error: z.string().optional(),
});

const updateEmployeeOutputSchema = z.object({
  success: z.boolean(),
  error: z.string().optional(),
});

// ─── Factory ────────────────────────────────────────────────────────────────

/**
 * Ажилтан агентийн tool-уудыг бүтээж буцаана.
 * Зөвхөн read + нийцтэй талбарын update дэмжинэ.
 */
export function createEmployeeAgentTools(companyId: string) {
  const db = getFirebaseAdminFirestore;

  // 1. searchEmployees
  const searchEmployees = ai.defineTool(
    {
      name: 'searchEmployees',
      description:
        'Ажилтнуудыг хайна. query утга нь нэр эсвэл email дотор хайна. department болон status-аар шүүж болно.',
      inputSchema: z.object({
        query: z.string().describe('Хайх нэр эсвэл email'),
        department: z.string().optional().describe('Алба/departmentId-аар шүүх (заавал биш)'),
        status: z.string().optional().describe('Ажилтны статусаар шүүх, жишээ: active, on_leave (заавал биш)'),
      }),
      outputSchema: searchEmployeesOutputSchema,
    },
    async ({ query, department, status }) => {
      const colRef = db().collection(`companies/${companyId}/employees`);
      const snap = await colRef.limit(200).get();

      const q = query.toLowerCase();
      const results: z.infer<typeof employeeSummarySchema>[] = [];

      snap.forEach((doc) => {
        const e = doc.data() as Employee;
        const fullName = `${e.firstName ?? ''} ${e.lastName ?? ''}`.toLowerCase();
        const emailMatch = (e.email ?? '').toLowerCase().includes(q);
        const nameMatch = fullName.includes(q);
        if (!nameMatch && !emailMatch) return;
        if (department && e.departmentId !== department) return;
        if (status && e.status !== status) return;

        results.push({
          id: doc.id,
          firstName: e.firstName,
          lastName: e.lastName,
          jobTitle: e.jobTitle,
          departmentId: e.departmentId,
          positionId: e.positionId,
          status: e.status,
          email: e.email,
          hireDate: e.hireDate,
          lifecycleStage: e.lifecycleStage,
        });
      });

      return { employees: results, total: results.length };
    }
  );

  // 2. getEmployee
  const getEmployee = ai.defineTool(
    {
      name: 'getEmployee',
      description: 'Нэг ажилтны бүрэн мэдээллийг employeeId-аар авна.',
      inputSchema: z.object({
        employeeId: z.string().describe('Ажилтны Firestore document ID'),
      }),
      outputSchema: getEmployeeOutputSchema,
    },
    async ({ employeeId }) => {
      try {
        const doc = await db()
          .collection(`companies/${companyId}/employees`)
          .doc(employeeId)
          .get();

        if (!doc.exists) {
          return { success: false, error: `Ажилтан (${employeeId}) олдсонгүй.` };
        }

        const e = doc.data() as Employee;
        return {
          success: true,
          employee: {
            id: doc.id,
            firstName: e.firstName,
            lastName: e.lastName,
            jobTitle: e.jobTitle,
            departmentId: e.departmentId,
            positionId: e.positionId,
            status: e.status,
            email: e.email,
            hireDate: e.hireDate,
            lifecycleStage: e.lifecycleStage,
            phoneNumber: e.phoneNumber,
            employeeCode: e.employeeCode,
            skills: e.skills,
            terminationDate: e.terminationDate,
          },
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Алдаа гарлаа';
        return { success: false, error: msg };
      }
    }
  );

  // 3. updateEmployee
  const updateEmployee = ai.defineTool(
    {
      name: 'updateEmployee',
      description:
        'Ажилтны мэдээллийг шинэчлэнэ. Зөвхөн jobTitle, departmentId, positionId талбаруудыг өөрчилж болно.',
      inputSchema: z.object({
        employeeId: z.string().describe('Ажилтны Firestore document ID'),
        fields: z
          .object({
            jobTitle: z.string().optional().describe('Шинэ ажлын гарчиг'),
            departmentId: z.string().optional().describe('Шинэ albа ID'),
            positionId: z.string().optional().describe('Шинэ байрлал ID'),
          })
          .describe('Шинэчлэх талбарууд (дор хаяж нэг байх ёстой)'),
      }),
      outputSchema: updateEmployeeOutputSchema,
    },
    async ({ employeeId, fields }) => {
      try {
        const update: Record<string, string> = {};
        if (fields.jobTitle !== undefined) update['jobTitle'] = fields.jobTitle;
        if (fields.departmentId !== undefined) update['departmentId'] = fields.departmentId;
        if (fields.positionId !== undefined) update['positionId'] = fields.positionId;

        if (Object.keys(update).length === 0) {
          return { success: false, error: 'Шинэчлэх талбар заагдаагүй байна.' };
        }

        await db()
          .collection(`companies/${companyId}/employees`)
          .doc(employeeId)
          .update({ ...update, updatedAt: new Date() });

        return { success: true };
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Шинэчлэхэд алдаа гарлаа';
        return { success: false, error: msg };
      }
    }
  );

  return [searchEmployees, getEmployee, updateEmployee] as const;
}
