import { z } from 'zod';
import { ai } from '../genkit';
import { getFirebaseAdminFirestore } from '@/lib/firebase-admin';

// ─── Output schemas ────────────────────────────────────────────────────────

const vacancySummarySchema = z.object({
  id: z.string(),
  title: z.string(),
  departmentId: z.string().optional(),
  status: z.string(),
  type: z.string().optional(),
  deadline: z.string().optional(),
  createdAt: z.string().optional(),
});

const listVacanciesOutputSchema = z.array(vacancySummarySchema);

const getVacancyOutputSchema = z.object({
  success: z.boolean(),
  vacancy: vacancySummarySchema
    .extend({
      description: z.string().optional(),
      requirements: z.string().optional(),
      salary: z.string().optional(),
      location: z.string().optional(),
      applicationCount: z.number(),
    })
    .optional(),
  error: z.string().optional(),
});

const applicationSummarySchema = z.object({
  id: z.string(),
  vacancyId: z.string(),
  candidateId: z.string(),
  currentStageId: z.string().optional(),
  status: z.string(),
  appliedAt: z.string().optional(),
});

const listApplicationsOutputSchema = z.array(applicationSummarySchema);

const getCandidateOutputSchema = z.object({
  success: z.boolean(),
  candidate: z
    .object({
      id: z.string(),
      firstName: z.string(),
      lastName: z.string(),
      email: z.string().optional(),
      phone: z.string().optional(),
      source: z.string().optional(),
      tags: z.array(z.string()).optional(),
      notes: z.string().optional(),
    })
    .optional(),
  error: z.string().optional(),
});

const updateApplicationStatusOutputSchema = z.object({
  success: z.boolean(),
  error: z.string().optional(),
});

// ─── Helper ─────────────────────────────────────────────────────────────────

function toDateString(val: unknown): string | undefined {
  if (!val) return undefined;
  if (val instanceof Date) return val.toISOString();
  if (typeof val === 'object' && 'toDate' in (val as object)) {
    return (val as { toDate: () => Date }).toDate().toISOString();
  }
  return String(val);
}

// ─── Factory ────────────────────────────────────────────────────────────────

/**
 * Сонгон шалгаруулалт агентийн tool-уудыг бүтээж буцаана.
 */
export function createRecruitmentAgentTools(companyId: string, userId: string) {
  const db = getFirebaseAdminFirestore;

  // 1. listVacancies
  const listVacancies = ai.defineTool(
    {
      name: 'listVacancies',
      description:
        'Ажлын байрнуудын жагсаалтыг харуулна. Статусаар шүүж болно. Өгөгдөөгүй бол OPEN ажлын байрнуудыг харуулна.',
      inputSchema: z.object({
        status: z
          .enum(['DRAFT', 'OPEN', 'CLOSED', 'PAUSED'])
          .optional()
          .describe('Ажлын байрны статус — заавал биш, өгөгдөөгүй бол OPEN'),
      }),
      outputSchema: listVacanciesOutputSchema,
    },
    async ({ status }) => {
      const filterStatus = status ?? 'OPEN';
      const colRef = db().collection(`companies/${companyId}/vacancies`);
      const snap = await colRef
        .where('status', '==', filterStatus)
        .limit(50)
        .get();

      if (snap.empty) return [];

      return snap.docs.map((doc) => {
        const d = doc.data();
        return {
          id: doc.id,
          title: d.title ?? '',
          departmentId: d.departmentId,
          status: d.status ?? filterStatus,
          type: d.type,
          deadline: toDateString(d.deadline),
          createdAt: toDateString(d.createdAt),
        };
      });
    }
  );

  // 2. getVacancy
  const getVacancy = ai.defineTool(
    {
      name: 'getVacancy',
      description:
        'Нэг ажлын байрны бүрэн мэдээлэл болон тухайн vacancy-д хэдэн өргөдөл ирснийг харуулна.',
      inputSchema: z.object({
        vacancyId: z.string().describe('Ажлын байрны Firestore document ID'),
      }),
      outputSchema: getVacancyOutputSchema,
    },
    async ({ vacancyId }) => {
      try {
        const doc = await db()
          .collection(`companies/${companyId}/vacancies`)
          .doc(vacancyId)
          .get();

        if (!doc.exists) {
          return { success: false, error: `Ажлын байр (${vacancyId}) олдсонгүй.` };
        }

        const d = doc.data()!;

        // Application тоолох
        const appSnap = await db()
          .collection(`companies/${companyId}/jobApplications`)
          .where('vacancyId', '==', vacancyId)
          .get();

        return {
          success: true,
          vacancy: {
            id: doc.id,
            title: d.title ?? '',
            departmentId: d.departmentId,
            status: d.status ?? '',
            type: d.type,
            deadline: toDateString(d.deadline),
            createdAt: toDateString(d.createdAt),
            description: d.description,
            requirements: d.requirements,
            salary: d.salary,
            location: d.location,
            applicationCount: appSnap.size,
          },
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Алдаа гарлаа';
        return { success: false, error: msg };
      }
    }
  );

  // 3. listApplications
  const listApplications = ai.defineTool(
    {
      name: 'listApplications',
      description:
        'Өргөдлүүдийн жагсаалтыг харуулна. vacancyId эсвэл статусаар шүүж болно.',
      inputSchema: z.object({
        vacancyId: z
          .string()
          .optional()
          .describe('Ажлын байрны ID-аар шүүх (заавал биш)'),
        status: z
          .enum(['ACTIVE', 'REJECTED', 'WITHDRAWN', 'HIRED'])
          .optional()
          .describe('Өргөдлийн статусаар шүүх (заавал биш)'),
        limit: z
          .number()
          .min(1)
          .max(50)
          .optional()
          .describe('Буцаах дээд тоо (default: 20, max: 50)'),
      }),
      outputSchema: listApplicationsOutputSchema,
    },
    async ({ vacancyId, status, limit }) => {
      const maxLimit = Math.min(limit ?? 20, 50);
      let query = db()
        .collection(`companies/${companyId}/jobApplications`)
        .limit(maxLimit) as FirebaseFirestore.Query;

      if (vacancyId) {
        query = query.where('vacancyId', '==', vacancyId);
      }
      if (status) {
        query = query.where('status', '==', status);
      }

      const snap = await query.get();
      if (snap.empty) return [];

      return snap.docs.map((doc) => {
        const d = doc.data();
        return {
          id: doc.id,
          vacancyId: d.vacancyId ?? '',
          candidateId: d.candidateId ?? '',
          currentStageId: d.currentStageId,
          status: d.status ?? '',
          appliedAt: toDateString(d.appliedAt),
        };
      });
    }
  );

  // 4. getCandidate
  const getCandidate = ai.defineTool(
    {
      name: 'getCandidate',
      description: 'Нэр дэвшигчийн дэлгэрэнгүй мэдээллийг candidateId-аар авна.',
      inputSchema: z.object({
        candidateId: z.string().describe('Нэр дэвшигчийн Firestore document ID'),
      }),
      outputSchema: getCandidateOutputSchema,
    },
    async ({ candidateId }) => {
      try {
        const doc = await db()
          .collection(`companies/${companyId}/candidates`)
          .doc(candidateId)
          .get();

        if (!doc.exists) {
          return { success: false, error: `Нэр дэвшигч (${candidateId}) олдсонгүй.` };
        }

        const d = doc.data()!;
        return {
          success: true,
          candidate: {
            id: doc.id,
            firstName: d.firstName ?? '',
            lastName: d.lastName ?? '',
            email: d.email,
            phone: d.phone,
            source: d.source,
            tags: d.tags,
            notes: d.notes,
          },
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Алдаа гарлаа';
        return { success: false, error: msg };
      }
    }
  );

  // 5. updateApplicationStatus
  const updateApplicationStatus = ai.defineTool(
    {
      name: 'updateApplicationStatus',
      description:
        'Өргөдлийн төлөвийг өөрчлөнө. REJECTED үед rejectionReason заавал байна. Баталгаажуулалтын дараа л дуудна.',
      inputSchema: z.object({
        applicationId: z.string().describe('Өргөдлийн Firestore document ID'),
        status: z
          .enum(['ACTIVE', 'REJECTED', 'HIRED'])
          .describe('Шинэ статус'),
        rejectionReason: z
          .string()
          .optional()
          .describe('Татгалзсан шалтгаан (REJECTED үед заавал)'),
      }),
      outputSchema: updateApplicationStatusOutputSchema,
    },
    async ({ applicationId, status, rejectionReason }) => {
      try {
        const appRef = db()
          .collection(`companies/${companyId}/jobApplications`)
          .doc(applicationId);

        const appSnap = await appRef.get();
        if (!appSnap.exists) {
          return { success: false, error: `Өргөдөл (${applicationId}) олдсонгүй.` };
        }

        const updateData: Record<string, unknown> = {
          status,
          updatedAt: new Date(),
          updatedBy: userId,
        };

        if (status === 'REJECTED' && rejectionReason) {
          updateData['rejectionReason'] = rejectionReason;
        }

        if (status === 'HIRED') {
          updateData['hiredAt'] = new Date();
        }

        await appRef.update(updateData);

        return { success: true };
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Статус өөрчлөхөд алдаа гарлаа';
        return { success: false, error: msg };
      }
    }
  );

  return [
    listVacancies,
    getVacancy,
    listApplications,
    getCandidate,
    updateApplicationStatus,
  ] as const;
}
