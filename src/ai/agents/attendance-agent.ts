/**
 * attendance-agent.ts
 * ───────────────────
 * Цаг бүртгэлийн агент — attendance summary & records tools.
 */

import { z } from 'zod';
import { ai } from '../genkit';
import { getFirebaseAdminFirestore } from '@/lib/firebase-admin';

// ─── Output schemas ────────────────────────────────────────────────────────

const attendanceSummarySchema = z.object({
  employeeId: z.string(),
  month: z.number(),
  year: z.number(),
  presentDays: z.number(),
  absentDays: z.number(),
  lateDays: z.number(),
  totalWorkHours: z.number(),
});

const attendanceRecordSchema = z.object({
  date: z.string(),
  checkIn: z.string().optional(),
  checkOut: z.string().optional(),
  status: z.string(),
  workHours: z.number().optional(),
});

const listAttendanceOutputSchema = z.object({
  records: z.array(attendanceRecordSchema),
  total: z.number(),
});

// ─── Helpers ────────────────────────────────────────────────────────────────

/** YYYY-MM-DD string-аас сар/жил авах */
function parseDateField(record: FirebaseFirestore.DocumentData): string {
  return (record['attendanceDate'] ?? record['date'] ?? '') as string;
}

function matchesMonth(dateStr: string, month: number, year: number): boolean {
  if (!dateStr) return false;
  const [y, m] = dateStr.split('-').map(Number);
  return y === year && m === month;
}

// ─── Factory ────────────────────────────────────────────────────────────────

export function createAttendanceAgentTools(companyId: string) {
  const db = getFirebaseAdminFirestore;

  // 1. getAttendanceSummary
  const getAttendanceSummary = ai.defineTool(
    {
      name: 'getAttendanceSummary',
      description: 'Ажилтны сарын ирцийн хураангуй. Одоогийн сарыг default ашиглана.',
      inputSchema: z.object({
        employeeId: z.string().describe('Ажилтны Firestore document ID'),
        month: z.number().min(1).max(12).optional().describe('Сар (1-12). Default: одоогийн сар'),
        year: z.number().optional().describe('Жил. Default: одоогийн жил'),
      }),
      outputSchema: attendanceSummarySchema,
    },
    async ({ employeeId, month, year }) => {
      const now = new Date();
      const targetMonth = month ?? now.getMonth() + 1;
      const targetYear = year ?? now.getFullYear();

      const defaultSummary: z.infer<typeof attendanceSummarySchema> = {
        employeeId,
        month: targetMonth,
        year: targetYear,
        presentDays: 0,
        absentDays: 0,
        lateDays: 0,
        totalWorkHours: 0,
      };

      try {
        const snap = await db()
          .collection(`companies/${companyId}/attendance`)
          .where('employeeId', '==', employeeId)
          .limit(200)
          .get();

        let presentDays = 0;
        let absentDays = 0;
        let lateDays = 0;
        let totalWorkHours = 0;

        snap.forEach((doc) => {
          const d = doc.data();
          const dateStr = parseDateField(d);
          if (!matchesMonth(dateStr, targetMonth, targetYear)) return;

          const status = (d['status'] ?? '') as string;
          if (status === 'PRESENT' || status === 'LEFT' || status === 'EARLY_DEPARTURE') {
            presentDays++;
          } else if (status === 'LATE') {
            lateDays++;
            presentDays++;
          } else if (status === 'ABSENT') {
            absentDays++;
          }

          totalWorkHours += (d['workHours'] ?? 0) as number;
        });

        return { employeeId, month: targetMonth, year: targetYear, presentDays, absentDays, lateDays, totalWorkHours };
      } catch {
        return defaultSummary;
      }
    }
  );

  // 2. listAttendanceRecords
  const listAttendanceRecords = ai.defineTool(
    {
      name: 'listAttendanceRecords',
      description: 'Ажилтны сарын ирцийн дэлгэрэнгүй бүртгэл. Max 31 бичлэг.',
      inputSchema: z.object({
        employeeId: z.string().describe('Ажилтны Firestore document ID'),
        month: z.number().min(1).max(12).optional().describe('Сар (1-12). Default: одоогийн сар'),
        year: z.number().optional().describe('Жил. Default: одоогийн жил'),
      }),
      outputSchema: listAttendanceOutputSchema,
    },
    async ({ employeeId, month, year }) => {
      const now = new Date();
      const targetMonth = month ?? now.getMonth() + 1;
      const targetYear = year ?? now.getFullYear();

      try {
        const snap = await db()
          .collection(`companies/${companyId}/attendance`)
          .where('employeeId', '==', employeeId)
          .limit(200)
          .get();

        const records: z.infer<typeof attendanceRecordSchema>[] = [];

        snap.forEach((doc) => {
          const d = doc.data();
          const dateStr = parseDateField(d);
          if (!matchesMonth(dateStr, targetMonth, targetYear)) return;
          if (records.length >= 31) return;

          records.push({
            date: dateStr,
            checkIn: d['checkInTime'] ?? d['checkIn'],
            checkOut: d['checkOutTime'] ?? d['checkOut'],
            status: d['status'] ?? '',
            workHours: d['workHours'],
          });
        });

        records.sort((a, b) => a.date.localeCompare(b.date));

        return { records, total: records.length };
      } catch {
        return { records: [], total: 0 };
      }
    }
  );

  return [getAttendanceSummary, listAttendanceRecords] as const;
}
