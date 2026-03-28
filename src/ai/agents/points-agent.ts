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
        // Зөв зам: companies/{companyId}/employees/{employeeId}/point_profile/main
        const profileDoc = await db()
          .collection(`companies/${companyId}/employees`)
          .doc(employeeId)
          .collection('point_profile')
          .doc('main')
          .get();

        if (profileDoc.exists) {
          const d = profileDoc.data()!;
          // totalSpent = нийт REDEEMED гүйлгээг тооцдоггүй тул totalEarned - balance-аас тооцно
          const balance = d['balance'] ?? 0;
          const totalEarned = d['totalEarned'] ?? 0;
          return {
            employeeId,
            balance,
            totalEarned,
            totalSpent: Math.max(0, totalEarned - balance),
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
        // Ажилтнуудыг авч, дараа нь point_profile-г collection group query-гаар авна
        // Хялбар арга: employees-г авч profile-г нь тус тус уншина
        const employeesSnap = await db()
          .collection(`companies/${companyId}/employees`)
          .limit(100) // Ажилтны дээд хязгаар
          .get();

        const profilePromises = employeesSnap.docs.map(async (empDoc) => {
          const emp = empDoc.data();
          const profileDoc = await db()
            .collection(`companies/${companyId}/employees`)
            .doc(empDoc.id)
            .collection('point_profile')
            .doc('main')
            .get();

          const balance = profileDoc.exists ? (profileDoc.data()!['balance'] ?? 0) : 0;
          const name = [emp['firstName'], emp['lastName']].filter(Boolean).join(' ') || empDoc.id;
          return { employeeId: empDoc.id, employeeName: name, balance };
        });

        const profiles = await Promise.all(profilePromises);
        const sorted = profiles
          .sort((a, b) => b.balance - a.balance)
          .slice(0, maxLimit);

        const entries: z.infer<typeof leaderboardEntrySchema>[] = sorted.map((p, i) => ({
          rank: i + 1,
          employeeId: p.employeeId,
          employeeName: p.employeeName,
          balance: p.balance,
        }));

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
        // Зөв зам: companies/{companyId}/point_transactions (userId field-аар шүүнэ)
        const snap = await db()
          .collection(`companies/${companyId}/point_transactions`)
          .where('userId', '==', employeeId)
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
