/**
 * points-agent.ts
 * ───────────────
 * Урамшуулал оноо агент — balance, leaderboard, history tools.
 */

import { z } from 'zod';
import { ai } from '../genkit';
import { getFirebaseAdminFirestore } from '@/lib/firebase-admin';

// ─── Output schemas ────────────────────────────────────────────────────────

const pointsBalanceSchema = z.object({
  employeeId: z.string(),
  balance: z.number(),
  totalEarned: z.number(),
  totalSpent: z.number(),
});

const leaderboardEntrySchema = z.object({
  rank: z.number(),
  employeeId: z.string(),
  employeeName: z.string().optional(),
  balance: z.number(),
});

const leaderboardOutputSchema = z.object({
  entries: z.array(leaderboardEntrySchema),
  total: z.number(),
});

const pointsHistoryEntrySchema = z.object({
  id: z.string(),
  type: z.string(),
  amount: z.number(),
  reason: z.string().optional(),
  createdAt: z.string(),
  fromEmployeeId: z.string().optional(),
});

const pointsHistoryOutputSchema = z.object({
  history: z.array(pointsHistoryEntrySchema),
  total: z.number(),
});

// ─── Factory ────────────────────────────────────────────────────────────────

export function createPointsAgentTools(companyId: string) {
  const db = getFirebaseAdminFirestore;

  // 1. getPointsBalance
  const getPointsBalance = ai.defineTool(
    {
      name: 'getPointsBalance',
      description: 'Ажилтны урамшуулал оноо үлдэгдэл, нийт авсан болон зарцуулсан оноог буцаана.',
      inputSchema: z.object({
        employeeId: z.string().describe('Ажилтны Firestore document ID'),
      }),
      outputSchema: pointsBalanceSchema,
    },
    async ({ employeeId }) => {
      const defaultBalance: z.infer<typeof pointsBalanceSchema> = {
        employeeId,
        balance: 0,
        totalEarned: 0,
        totalSpent: 0,
      };

      try {
        // 1st: document ID = employeeId байж болно
        const directDoc = await db()
          .collection(`companies/${companyId}/pointBalances`)
          .doc(employeeId)
          .get();

        if (directDoc.exists) {
          const d = directDoc.data()!;
          return {
            employeeId,
            balance: d['balance'] ?? 0,
            totalEarned: d['totalEarned'] ?? 0,
            totalSpent: d['totalSpent'] ?? 0,
          };
        }

        // 2nd: employeeId field-аар шүүх
        const snap = await db()
          .collection(`companies/${companyId}/pointBalances`)
          .where('employeeId', '==', employeeId)
          .limit(1)
          .get();

        if (!snap.empty) {
          const d = snap.docs[0].data();
          return {
            employeeId,
            balance: d['balance'] ?? 0,
            totalEarned: d['totalEarned'] ?? 0,
            totalSpent: d['totalSpent'] ?? 0,
          };
        }

        return defaultBalance;
      } catch {
        return defaultBalance;
      }
    }
  );

  // 2. getPointsLeaderboard
  const getPointsLeaderboard = ai.defineTool(
    {
      name: 'getPointsLeaderboard',
      description: 'Хамгийн их оноотой ажилтнуудын жагсаалт (leaderboard). Default 10, max 20.',
      inputSchema: z.object({
        limit: z.number().min(1).max(20).optional().describe('Харуулах тооны хязгаар. Default: 10'),
      }),
      outputSchema: leaderboardOutputSchema,
    },
    async ({ limit }) => {
      const maxLimit = Math.min(limit ?? 10, 20);

      try {
        const snap = await db()
          .collection(`companies/${companyId}/pointBalances`)
          .orderBy('balance', 'desc')
          .limit(maxLimit)
          .get();

        const entries: z.infer<typeof leaderboardEntrySchema>[] = [];
        let rank = 1;

        snap.forEach((doc) => {
          const d = doc.data();
          entries.push({
            rank: rank++,
            employeeId: d['employeeId'] ?? doc.id,
            employeeName: d['employeeName'] ?? d['name'],
            balance: d['balance'] ?? 0,
          });
        });

        return { entries, total: entries.length };
      } catch {
        return { entries: [], total: 0 };
      }
    }
  );

  // 3. getPointsHistory
  const getPointsHistory = ai.defineTool(
    {
      name: 'getPointsHistory',
      description: 'Ажилтны оноо авсан/зарцуулсан түүх. Default 20 бичлэг.',
      inputSchema: z.object({
        employeeId: z.string().describe('Ажилтны Firestore document ID'),
        limit: z.number().min(1).max(100).optional().describe('Харуулах бичлэгийн тоо. Default: 20'),
      }),
      outputSchema: pointsHistoryOutputSchema,
    },
    async ({ employeeId, limit }) => {
      const maxLimit = limit ?? 20;

      try {
        const snap = await db()
          .collection(`companies/${companyId}/pointTransactions`)
          .where('employeeId', '==', employeeId)
          .orderBy('createdAt', 'desc')
          .limit(maxLimit)
          .get();

        const history: z.infer<typeof pointsHistoryEntrySchema>[] = [];

        snap.forEach((doc) => {
          const d = doc.data();
          const createdAt = d['createdAt'];
          const createdAtStr =
            createdAt && typeof createdAt.toDate === 'function'
              ? (createdAt.toDate() as Date).toISOString()
              : String(createdAt ?? '');

          history.push({
            id: doc.id,
            type: d['type'] ?? '',
            amount: d['amount'] ?? 0,
            reason: d['reason'],
            createdAt: createdAtStr,
            fromEmployeeId: d['fromEmployeeId'],
          });
        });

        return { history, total: history.length };
      } catch {
        return { history: [], total: 0 };
      }
    }
  );

  return [getPointsBalance, getPointsLeaderboard, getPointsHistory] as const;
}
