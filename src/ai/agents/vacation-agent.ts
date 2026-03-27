/**
 * vacation-agent.ts
 * ─────────────────
 * Чөлөө/Амралт агент — leave balance, requests, approval tools.
 */

import { z } from 'zod';
import { ai } from '../genkit';
import { getFirebaseAdminFirestore } from '@/lib/firebase-admin';

// ─── Output schemas ────────────────────────────────────────────────────────

const leaveBalanceSchema = z.object({
  annualBalance: z.number(),
  usedDays: z.number(),
  remainingDays: z.number(),
  pendingDays: z.number(),
});

const leaveRequestSchema = z.object({
  id: z.string(),
  employeeId: z.string(),
  type: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  days: z.number(),
  status: z.string(),
  reason: z.string().optional(),
});

const listLeaveRequestsOutputSchema = z.object({
  requests: z.array(leaveRequestSchema),
  total: z.number(),
});

const approveLeaveOutputSchema = z.object({
  success: z.boolean(),
  error: z.string().optional(),
});

// ─── Factory ────────────────────────────────────────────────────────────────

export function createVacationAgentTools(companyId: string, userId?: string) {
  const db = getFirebaseAdminFirestore;

  // 1. getLeaveBalance
  const getLeaveBalance = ai.defineTool(
    {
      name: 'getLeaveBalance',
      description: 'Ажилтны чөлөөний үлдэгдэл авна. Жилийн чөлөо, зарцуулсан өдөр, үлдэгдэл, хүлээгдэж буй хүсэлтийн өдрүүдийг буцаана.',
      inputSchema: z.object({
        employeeId: z.string().describe('Ажилтны Firestore document ID'),
      }),
      outputSchema: leaveBalanceSchema,
    },
    async ({ employeeId }) => {
      const defaultBalance = { annualBalance: 0, usedDays: 0, remainingDays: 0, pendingDays: 0 };

      try {
        // 1st: sub-collection дотор хайх
        const subColSnap = await db()
          .collection(`companies/${companyId}/employees/${employeeId}/leaveBalances`)
          .limit(1)
          .get();

        if (!subColSnap.empty) {
          const data = subColSnap.docs[0].data();
          return {
            annualBalance: data['annualBalance'] ?? 0,
            usedDays: data['usedDays'] ?? 0,
            remainingDays: data['remainingDays'] ?? 0,
            pendingDays: data['pendingDays'] ?? 0,
          };
        }

        // 2nd: companies/{companyId}/leaveBalances-с employeeId-аар шүүх
        const colSnap = await db()
          .collection(`companies/${companyId}/leaveBalances`)
          .where('employeeId', '==', employeeId)
          .limit(1)
          .get();

        if (!colSnap.empty) {
          const data = colSnap.docs[0].data();
          return {
            annualBalance: data['annualBalance'] ?? 0,
            usedDays: data['usedDays'] ?? 0,
            remainingDays: data['remainingDays'] ?? 0,
            pendingDays: data['pendingDays'] ?? 0,
          };
        }

        return defaultBalance;
      } catch {
        return defaultBalance;
      }
    }
  );

  // 2. listLeaveRequests
  const listLeaveRequests = ai.defineTool(
    {
      name: 'listLeaveRequests',
      description: 'Чөлөөний хүсэлтүүдийг харна. Ажилтан болон статусаар шүүж болно.',
      inputSchema: z.object({
        employeeId: z.string().optional().describe('Тухайн ажилтны хүсэлтүүдийг харах (заавал биш)'),
        status: z
          .enum(['pending', 'approved', 'rejected'])
          .optional()
          .describe('Хүсэлтийн статусаар шүүх (заавал биш)'),
      }),
      outputSchema: listLeaveRequestsOutputSchema,
    },
    async ({ employeeId, status }) => {
      try {
        let query = db()
          .collection(`companies/${companyId}/leaveRequests`)
          .limit(50) as FirebaseFirestore.Query;

        if (employeeId) {
          query = query.where('employeeId', '==', employeeId);
        }
        if (status) {
          query = query.where('status', '==', status);
        }

        const snap = await query.get();
        const requests: z.infer<typeof leaveRequestSchema>[] = [];

        snap.forEach((doc) => {
          const d = doc.data();
          requests.push({
            id: doc.id,
            employeeId: d['employeeId'] ?? '',
            type: d['type'] ?? '',
            startDate: d['startDate'] ?? '',
            endDate: d['endDate'] ?? '',
            days: d['days'] ?? 0,
            status: d['status'] ?? '',
            reason: d['reason'],
          });
        });

        return { requests, total: requests.length };
      } catch {
        return { requests: [], total: 0 };
      }
    }
  );

  // 3. approveLeaveRequest
  const approveLeaveRequest = ai.defineTool(
    {
      name: 'approveLeaveRequest',
      description: 'Чөлөөний хүсэлтийг зөвшөөрнө. ⚠️ Хэрэглэгчийн баталгаажуулалт шаардлагатай.',
      inputSchema: z.object({
        requestId: z.string().describe('Чөлөөний хүсэлтийн Firestore document ID'),
      }),
      outputSchema: approveLeaveOutputSchema,
    },
    async ({ requestId }) => {
      try {
        await db()
          .collection(`companies/${companyId}/leaveRequests`)
          .doc(requestId)
          .update({
            status: 'approved',
            approvedAt: new Date(),
            approvedBy: userId ?? 'system',
          });

        return { success: true };
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Зөвшөөрөхөд алдаа гарлаа';
        return { success: false, error: msg };
      }
    }
  );

  return [getLeaveBalance, listLeaveRequests, approveLeaveRequest] as const;
}
