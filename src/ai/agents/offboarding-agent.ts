import { z } from 'zod';
import { ai } from '../genkit';
import { getFirebaseAdminFirestore } from '@/lib/firebase-admin';
import type { Employee } from '@/types/index';

// ─── Schemas ────────────────────────────────────────────────────────────────

const offboardingTaskSchema = z.object({
  id: z.string(),
  title: z.string(),
  completed: z.boolean(),
  dueDate: z.string().optional(),
  assignedTo: z.string().optional(),
});

const offboardingStatusOutputSchema = z.object({
  success: z.boolean(),
  employeeId: z.string().optional(),
  employeeName: z.string().optional(),
  percentComplete: z.number().optional(),
  tasks: z.array(offboardingTaskSchema).optional(),
  terminationDate: z.string().optional(),
  lifecycleStage: z.string().optional(),
  error: z.string().optional(),
});

const offboardingEmployeeItemSchema = z.object({
  id: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  jobTitle: z.string().optional(),
  departmentId: z.string().optional(),
  terminationDate: z.string().optional(),
  percentComplete: z.number(),
});

const listOffboardingOutputSchema = z.object({
  employees: z.array(offboardingEmployeeItemSchema),
  total: z.number(),
});

// ─── Factory ────────────────────────────────────────────────────────────────

/**
 * Тойрох хуудас (offboarding) агентийн tool-уудыг бүтээнэ.
 */
export function createOffboardingAgentTools(companyId: string) {
  const db = getFirebaseAdminFirestore;

  // 1. getOffboardingStatus
  const getOffboardingStatus = ai.defineTool(
    {
      name: 'getOffboardingStatus',
      description:
        'Тодорхой ажилтны тойрох хуудасны явцын мэдээллийг авна: хичнээн % дууссан, tasks.',
      inputSchema: z.object({
        employeeId: z.string().describe('Ажилтны Firestore document ID'),
      }),
      outputSchema: offboardingStatusOutputSchema,
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

        // Offboarding tasks sub-collection
        const tasksSnap = await db()
          .collection(`companies/${companyId}/employees/${employeeId}/offboardingTasks`)
          .get();

        const tasks: z.infer<typeof offboardingTaskSchema>[] = [];
        tasksSnap.forEach((doc) => {
          const d = doc.data();
          tasks.push({
            id: doc.id,
            title: typeof d['title'] === 'string' ? d['title'] : doc.id,
            completed: d['completed'] === true,
            dueDate: typeof d['dueDate'] === 'string' ? d['dueDate'] : undefined,
            assignedTo: typeof d['assignedTo'] === 'string' ? d['assignedTo'] : undefined,
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
          terminationDate: emp.terminationDate,
          lifecycleStage: emp.lifecycleStage,
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Алдаа гарлаа';
        return { success: false, error: msg };
      }
    }
  );

  // 2. listOffboardingEmployees
  const listOffboardingEmployees = ai.defineTool(
    {
      name: 'listOffboardingEmployees',
      description:
        'Одоо тойрох хуудсанд (offboarding / releasing) байгаа бүх ажилтнуудыг жагсаана.',
      inputSchema: z.object({}),
      outputSchema: listOffboardingOutputSchema,
    },
    async () => {
      // lifecycleStage === 'offboarding' эсвэл status === 'releasing'
      const [stageSnap, statusSnap] = await Promise.all([
        db()
          .collection(`companies/${companyId}/employees`)
          .where('lifecycleStage', '==', 'offboarding')
          .limit(100)
          .get(),
        db()
          .collection(`companies/${companyId}/employees`)
          .where('status', '==', 'releasing')
          .limit(100)
          .get(),
      ]);

      const seenIds = new Set<string>();
      const employees: z.infer<typeof offboardingEmployeeItemSchema>[] = [];

      const addEmployee = (doc: FirebaseFirestore.QueryDocumentSnapshot) => {
        if (seenIds.has(doc.id)) return;
        seenIds.add(doc.id);
        const e = doc.data() as Employee;
        employees.push({
          id: doc.id,
          firstName: e.firstName,
          lastName: e.lastName,
          jobTitle: e.jobTitle,
          departmentId: e.departmentId,
          terminationDate: e.terminationDate,
          percentComplete: 0,
        });
      };

      stageSnap.forEach(addEmployee);
      statusSnap.forEach(addEmployee);

      return { employees, total: employees.length };
    }
  );

  return [getOffboardingStatus, listOffboardingEmployees] as const;
}
