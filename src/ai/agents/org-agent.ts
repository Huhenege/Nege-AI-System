import { z } from 'zod';
import { ai } from '../genkit';
import { getFirebaseAdminFirestore } from '@/lib/firebase-admin';
import type { Department, Position } from '@/types/index';

// ─── Schemas ────────────────────────────────────────────────────────────────

const departmentItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  color: z.string().optional(),
});

const listDepartmentsOutputSchema = z.object({
  departments: z.array(departmentItemSchema),
  total: z.number(),
});

const positionItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  departmentId: z.string(),
  reportsToId: z.string().optional(),
  isActive: z.boolean().optional(),
  filled: z.number(),
  description: z.string().optional(),
});

const listPositionsOutputSchema = z.object({
  positions: z.array(positionItemSchema),
  total: z.number(),
});

// ─── Factory ────────────────────────────────────────────────────────────────

/**
 * Байгууллагын бүтцийн (алба, байрлал) агентийн tool-уудыг бүтээнэ.
 */
export function createOrgAgentTools(companyId: string) {
  const db = getFirebaseAdminFirestore;

  // 1. listDepartments
  const listDepartments = ai.defineTool(
    {
      name: 'listDepartments',
      description: 'Байгууллагын бүх алба (department) жагсаана.',
      inputSchema: z.object({}),
      outputSchema: listDepartmentsOutputSchema,
    },
    async () => {
      const snap = await db()
        .collection(`companies/${companyId}/departments`)
        .get();

      const departments: z.infer<typeof departmentItemSchema>[] = [];
      snap.forEach((doc) => {
        const d = doc.data() as Department;
        departments.push({
          id: doc.id,
          name: d.name,
          color: d.color,
        });
      });

      return { departments, total: departments.length };
    }
  );

  // 2. listPositions
  const listPositions = ai.defineTool(
    {
      name: 'listPositions',
      description:
        'Байрлалуудыг жагсаана. departmentId өгвөл зөвхөн тэр албаны байрлалуудыг буцаана.',
      inputSchema: z.object({
        departmentId: z
          .string()
          .optional()
          .describe('Алба (department) ID-аар шүүх (заавал биш)'),
      }),
      outputSchema: listPositionsOutputSchema,
    },
    async ({ departmentId }) => {
      let query = db()
        .collection(`companies/${companyId}/positions`)
        .limit(200);

      // Firestore query builder — conditionally filter
      const snap = departmentId
        ? await db()
            .collection(`companies/${companyId}/positions`)
            .where('departmentId', '==', departmentId)
            .limit(200)
            .get()
        : await query.get();

      const positions: z.infer<typeof positionItemSchema>[] = [];
      snap.forEach((doc) => {
        const p = doc.data() as Position;
        positions.push({
          id: doc.id,
          title: p.title,
          departmentId: p.departmentId,
          reportsToId: p.reportsToId,
          isActive: p.isActive,
          filled: p.filled ?? 0,
          description: p.description,
        });
      });

      return { positions, total: positions.length };
    }
  );

  return [listDepartments, listPositions] as const;
}
