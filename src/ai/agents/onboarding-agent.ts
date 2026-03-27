import { z } from 'zod';
import { ai } from '../genkit';
import { getFirebaseAdminFirestore } from '@/lib/firebase-admin';
import type { Employee } from '@/types/index';

// ─── Schemas ────────────────────────────────────────────────────────────────

const onboardingTaskSchema = z.object({
  id: z.string(),
  title: z.string(),
  completed: z.boolean(),
  dueDate: z.string().optional(),
});

const onboardingStatusOutputSchema = z.object({
  success: z.boolean(),
  employeeId: z.string().optional(),
  employeeName: z.string().optional(),
  percentComplete: z.number().optional(),
  tasks: z.array(onboardingTaskSchema).optional(),
  lifecycleStage: z.string().optional(),
  error: z.string().optional(),
});

const onboardingEmployeeItemSchema = z.object({
  id: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  jobTitle: z.string().optional(),
  departmentId: z.string().optional(),
  hireDate: z.string().optional(),
  percentComplete: z.number(),
});

const listOnboardingOutputSchema = z.object({
  employees: z.array(onboardingEmployeeItemSchema),
  total: z.number(),
});

// ─── Factory ────────────────────────────────────────────────────────────────

/**
 * Чиглүүлэх хөтөлбөрийн (onboarding) агентийн tool-уудыг бүтээнэ.
 */
export function createOnboardingAgentTools(companyId: string) {
  const db = getFirebaseAdminFirestore;

  // 1. getOnboardingStatus
  const getOnboardingStatus = ai.defineTool(
    {
      name: 'getOnboardingStatus',
      description:
        'Тодорхой ажилтны чиглүүлэх явцын мэдээллийг авна: хичнээн % дууссан, ямар tasks үлдсэн.',
      inputSchema: z.object({
        employeeId: z.string().describe('Ажилтны Firestore document ID'),
      }),
      outputSchema: onboardingStatusOutputSchema,
    },
    async ({ employeeId }) => {
      try {
        const empDoc = await db()
          .collection(`companies/${companyId}/employees`)
          .doc(employeeId)
          .get();

        if (!empDoc.exists) {
          return { success: false, error: `Ажилтан (${employeeId}) олдсонгүй.` };
        }

        const emp = empDoc.data() as Employee;

        // Onboarding tasks sub-collection хайх
        const tasksSnap = await db()
          .collection(`companies/${companyId}/employees/${employeeId}/onboardingTasks`)
          .get();

        const tasks: z.infer<typeof onboardingTaskSchema>[] = [];
        tasksSnap.forEach((doc) => {
          const d = doc.data();
          tasks.push({
            id: doc.id,
            title: typeof d['title'] === 'string' ? d['title'] : doc.id,
            completed: d['completed'] === true,
            dueDate: typeof d['dueDate'] === 'string' ? d['dueDate'] : undefined,
          });
        });

        const totalTasks = tasks.length;
        const completedTasks = tasks.filter((t) => t.completed).length;
        const percentComplete =
          totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

        return {
          success: true,
          employeeId,
          employeeName: `${emp.firstName} ${emp.lastName}`,
          percentComplete,
          tasks,
          lifecycleStage: emp.lifecycleStage,
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Алдаа гарлаа';
        return { success: false, error: msg };
      }
    }
  );

  // 2. listOnboardingEmployees
  const listOnboardingEmployees = ai.defineTool(
    {
      name: 'listOnboardingEmployees',
      description:
        'Одоо чиглүүлэлтэнд (onboarding) байгаа бүх ажилтнуудыг жагсаана.',
      inputSchema: z.object({}),
      outputSchema: listOnboardingOutputSchema,
    },
    async () => {
      const snap = await db()
        .collection(`companies/${companyId}/employees`)
        .where('lifecycleStage', '==', 'onboarding')
        .limit(100)
        .get();

      const employees: z.infer<typeof onboardingEmployeeItemSchema>[] = [];

      snap.forEach((doc) => {
        const e = doc.data() as Employee;
        const pct =
          typeof e.questionnaireCompletion === 'number'
            ? e.questionnaireCompletion
            : 0;
        employees.push({
          id: doc.id,
          firstName: e.firstName,
          lastName: e.lastName,
          jobTitle: e.jobTitle,
          departmentId: e.departmentId,
          hireDate: e.hireDate,
          percentComplete: pct,
        });
      });

      return { employees, total: employees.length };
    }
  );

  return [getOnboardingStatus, listOnboardingEmployees] as const;
}
