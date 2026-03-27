import { z } from 'zod';
import { ai } from '../genkit';
import { getFirebaseAdminFirestore } from '@/lib/firebase-admin';

// ─── Helper ─────────────────────────────────────────────────────────────────

function toDateString(val: unknown): string | undefined {
  if (!val) return undefined;
  if (val instanceof Date) return val.toISOString();
  if (typeof val === 'object' && 'toDate' in (val as object)) {
    return (val as { toDate: () => Date }).toDate().toISOString();
  }
  return String(val);
}

function toDate(val: unknown): Date | null {
  if (!val) return null;
  if (val instanceof Date) return val;
  if (typeof val === 'object' && 'toDate' in (val as object)) {
    return (val as { toDate: () => Date }).toDate();
  }
  if (typeof val === 'string') {
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

// ─── Output schemas ────────────────────────────────────────────────────────

const headcountReportSchema = z.object({
  total: z.number(),
  byStatus: z.array(z.object({ status: z.string(), count: z.number() })),
  byDepartment: z.array(z.object({ departmentId: z.string(), count: z.number() })),
  recentHires: z.number(),
  generatedAt: z.string(),
});

const attendanceReportSchema = z.object({
  month: z.number(),
  year: z.number(),
  totalRecords: z.number(),
  presentDays: z.number(),
  absentDays: z.number(),
  lateDays: z.number(),
  avgAttendanceRate: z.number(),
  generatedAt: z.string(),
});

const recruitmentReportSchema = z.object({
  totalVacancies: z.number(),
  byStatus: z.array(z.object({ status: z.string(), count: z.number() })),
  totalApplications: z.number(),
  byApplicationStatus: z.array(z.object({ status: z.string(), count: z.number() })),
  conversionRate: z.number(),
  generatedAt: z.string(),
});

const onboardingOffboardingReportSchema = z.object({
  currentlyOnboarding: z.number(),
  currentlyOffboarding: z.number(),
  completedOnboarding30d: z.number(),
  generatedAt: z.string(),
});

// ─── Factory ────────────────────────────────────────────────────────────────

/**
 * Тайлан агентийн tool-уудыг бүтээж буцаана.
 */
export function createReportAgentTools(companyId: string) {
  const db = getFirebaseAdminFirestore;

  // 1. getHeadcountReport
  const getHeadcountReport = ai.defineTool(
    {
      name: 'getHeadcountReport',
      description:
        'Ажилтны тоо, статус болон алба тус бүрийн хүний тоо, сүүлийн 30 хоногийн шинэ ажилтны хураангуй тайлан гаргана.',
      inputSchema: z.object({}),
      outputSchema: headcountReportSchema,
    },
    async () => {
      try {
        const snap = await db()
          .collection(`companies/${companyId}/employees`)
          .get();

        const now = new Date();
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

        const statusMap = new Map<string, number>();
        const departmentMap = new Map<string, number>();
        let recentHires = 0;

        snap.forEach((doc) => {
          const e = doc.data();

          // byStatus
          const status = (e.status as string) ?? 'unknown';
          statusMap.set(status, (statusMap.get(status) ?? 0) + 1);

          // byDepartment
          if (e.departmentId) {
            const deptId = e.departmentId as string;
            departmentMap.set(deptId, (departmentMap.get(deptId) ?? 0) + 1);
          }

          // recentHires
          const hireDate = toDate(e.hireDate);
          if (hireDate && hireDate >= thirtyDaysAgo) {
            recentHires++;
          }
        });

        return {
          total: snap.size,
          byStatus: Array.from(statusMap.entries()).map(([status, count]) => ({ status, count })),
          byDepartment: Array.from(departmentMap.entries()).map(([departmentId, count]) => ({
            departmentId,
            count,
          })),
          recentHires,
          generatedAt: new Date().toISOString(),
        };
      } catch {
        return {
          total: 0,
          byStatus: [],
          byDepartment: [],
          recentHires: 0,
          generatedAt: new Date().toISOString(),
        };
      }
    }
  );

  // 2. getAttendanceReport
  const getAttendanceReport = ai.defineTool(
    {
      name: 'getAttendanceReport',
      description:
        'Сарын ирцийн тайлан гаргана. month/year өгөгдөөгүй бол одоогийн сарын тайлан.',
      inputSchema: z.object({
        month: z
          .number()
          .min(1)
          .max(12)
          .optional()
          .describe('Сар (1–12), заавал биш — өгөгдөөгүй бол одоогийн сар'),
        year: z
          .number()
          .min(2000)
          .optional()
          .describe('Жил, заавал биш — өгөгдөөгүй бол одоогийн жил'),
      }),
      outputSchema: attendanceReportSchema,
    },
    async ({ month, year }) => {
      const now = new Date();
      const targetMonth = month ?? now.getMonth() + 1;
      const targetYear = year ?? now.getFullYear();

      try {
        const snap = await db()
          .collection(`companies/${companyId}/attendance`)
          .get();

        let presentDays = 0;
        let absentDays = 0;
        let lateDays = 0;
        let totalRecords = 0;

        snap.forEach((doc) => {
          const d = doc.data();

          // date шалгах: month/year-тай таарах record-уудыг л тооцох
          const recordDate = toDate(d.date ?? d.createdAt ?? d.timestamp);
          if (recordDate) {
            const rMonth = recordDate.getMonth() + 1;
            const rYear = recordDate.getFullYear();
            if (rMonth !== targetMonth || rYear !== targetYear) return;
          } else {
            // date байхгүй бол month/year field шалгах
            const rMonth = d.month as number | undefined;
            const rYear = d.year as number | undefined;
            if (rMonth !== undefined && rYear !== undefined) {
              if (rMonth !== targetMonth || rYear !== targetYear) return;
            }
            // Хэрэв date мэдэгдэхгүй бол оролцуулна
          }

          totalRecords++;
          const status = (d.status as string)?.toLowerCase();
          if (status === 'present') presentDays++;
          else if (status === 'absent') absentDays++;
          else if (status === 'late') lateDays++;
        });

        const denominator = presentDays + absentDays;
        const avgAttendanceRate =
          denominator > 0
            ? parseFloat(((presentDays / denominator) * 100).toFixed(2))
            : 0;

        return {
          month: targetMonth,
          year: targetYear,
          totalRecords,
          presentDays,
          absentDays,
          lateDays,
          avgAttendanceRate,
          generatedAt: new Date().toISOString(),
        };
      } catch {
        return {
          month: targetMonth,
          year: targetYear,
          totalRecords: 0,
          presentDays: 0,
          absentDays: 0,
          lateDays: 0,
          avgAttendanceRate: 0,
          generatedAt: new Date().toISOString(),
        };
      }
    }
  );

  // 3. getRecruitmentReport
  const getRecruitmentReport = ai.defineTool(
    {
      name: 'getRecruitmentReport',
      description:
        'Сонгон шалгаруулалтын нийт тайлан: ажлын байр, өргөдөл, хөрвүүлэлтийн хувь.',
      inputSchema: z.object({}),
      outputSchema: recruitmentReportSchema,
    },
    async () => {
      try {
        const [vacancySnap, appSnap] = await Promise.all([
          db().collection(`companies/${companyId}/vacancies`).get(),
          db().collection(`companies/${companyId}/jobApplications`).get(),
        ]);

        // Vacancies by status
        const vacancyStatusMap = new Map<string, number>();
        vacancySnap.forEach((doc) => {
          const status = (doc.data().status as string) ?? 'UNKNOWN';
          vacancyStatusMap.set(status, (vacancyStatusMap.get(status) ?? 0) + 1);
        });

        // Applications by status
        const appStatusMap = new Map<string, number>();
        let hiredCount = 0;
        appSnap.forEach((doc) => {
          const status = (doc.data().status as string) ?? 'UNKNOWN';
          appStatusMap.set(status, (appStatusMap.get(status) ?? 0) + 1);
          if (status === 'HIRED') hiredCount++;
        });

        const totalApplications = appSnap.size;
        const conversionRate =
          totalApplications > 0
            ? parseFloat(((hiredCount / totalApplications) * 100).toFixed(2))
            : 0;

        return {
          totalVacancies: vacancySnap.size,
          byStatus: Array.from(vacancyStatusMap.entries()).map(([status, count]) => ({
            status,
            count,
          })),
          totalApplications,
          byApplicationStatus: Array.from(appStatusMap.entries()).map(([status, count]) => ({
            status,
            count,
          })),
          conversionRate,
          generatedAt: new Date().toISOString(),
        };
      } catch {
        return {
          totalVacancies: 0,
          byStatus: [],
          totalApplications: 0,
          byApplicationStatus: [],
          conversionRate: 0,
          generatedAt: new Date().toISOString(),
        };
      }
    }
  );

  // 4. getOnboardingOffboardingReport
  const getOnboardingOffboardingReport = ai.defineTool(
    {
      name: 'getOnboardingOffboardingReport',
      description:
        'Одоо чиглүүлэлт (onboarding) болон тойрох (offboarding) явцад байгаа ажилтнуудын тоо, сүүлийн 30 хоногт чиглүүлэлт дууссан тоо.',
      inputSchema: z.object({}),
      outputSchema: onboardingOffboardingReportSchema,
    },
    async () => {
      try {
        const snap = await db()
          .collection(`companies/${companyId}/employees`)
          .get();

        const now = new Date();
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

        let currentlyOnboarding = 0;
        let currentlyOffboarding = 0;
        let completedOnboarding30d = 0;

        snap.forEach((doc) => {
          const e = doc.data();
          const stage = (e.lifecycleStage as string | undefined)?.toLowerCase();
          const status = (e.status as string | undefined)?.toLowerCase();

          if (stage === 'onboarding') {
            currentlyOnboarding++;
          }

          if (stage === 'offboarding' || status === 'releasing') {
            currentlyOffboarding++;
          }

          // completedOnboarding30d: onboardingCompletedAt шалгах
          // development эсвэл retention руу шилжсэн байвал
          if (
            stage === 'development' ||
            stage === 'retention' ||
            stage === 'active'
          ) {
            const completedAt = toDate(
              e.onboardingCompletedAt ?? e.onboardingEndDate ?? null
            );
            if (completedAt && completedAt >= thirtyDaysAgo) {
              completedOnboarding30d++;
            }
          }
        });

        return {
          currentlyOnboarding,
          currentlyOffboarding,
          completedOnboarding30d,
          generatedAt: new Date().toISOString(),
        };
      } catch {
        return {
          currentlyOnboarding: 0,
          currentlyOffboarding: 0,
          completedOnboarding30d: 0,
          generatedAt: new Date().toISOString(),
        };
      }
    }
  );

  return [
    getHeadcountReport,
    getAttendanceReport,
    getRecruitmentReport,
    getOnboardingOffboardingReport,
  ] as const;
}

// Re-export toDateString for potential reuse
export { toDateString };
