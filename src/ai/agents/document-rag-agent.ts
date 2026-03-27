/**
 * document-rag-agent.ts
 * ──────────────────────
 * Ажилтны байршуулсан баримтуудын агуулгаас vector similarity хайлт хийдэг agent.
 * Cosine similarity-г in-memory тооцоолно (Firestore vector search шаардлагагүй).
 */

import { z } from 'zod';
import { ai } from '../genkit';
import { getFirebaseAdminFirestore } from '@/lib/firebase-admin';

// ─── Cosine similarity ───────────────────────────────────────────────────────

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  const dot = a.reduce((sum, ai, i) => sum + ai * b[i], 0);
  const magA = Math.sqrt(a.reduce((sum, ai) => sum + ai * ai, 0));
  const magB = Math.sqrt(b.reduce((sum, bi) => sum + bi * bi, 0));
  return magA && magB ? dot / (magA * magB) : 0;
}

// ─── Output schema ───────────────────────────────────────────────────────────

const searchResultSchema = z.object({
  text: z.string(),
  sourceTitle: z.string(),
  documentType: z.string(),
  chunkIndex: z.number(),
  score: z.number(),
});

const searchOutputSchema = z.object({
  found: z.boolean(),
  results: z.array(searchResultSchema),
  employeeId: z.string(),
  query: z.string(),
});

// ─── Factory ─────────────────────────────────────────────────────────────────

export function createDocumentRagAgentTools(companyId: string) {
  const db = getFirebaseAdminFirestore;

  const searchEmployeeDocuments = ai.defineTool(
    {
      name: 'searchEmployeeDocuments',
      description:
        'Ажилтны байршуулсан PDF/Word/зурган баримтуудын агуулгаас хайна. ' +
        '"Батын гэрээний нөхцөл юу вэ?", "CV-д ямар ур чадвар бичсэн байна?" гэх мэт асуултад ашиглана.',
      inputSchema: z.object({
        employeeId: z.string().describe('Хэний баримтаас хайх — ажилтны Firestore ID'),
        query: z.string().describe('Хайх агуулга (Монгол эсвэл Англи)'),
        limit: z
          .number()
          .min(1)
          .max(10)
          .optional()
          .describe('Хамгийн их хэдэн үр дүн буцаах (default 5, max 10)'),
      }),
      outputSchema: searchOutputSchema,
    },
    async ({ employeeId, query, limit = 5 }) => {
      const clampedLimit = Math.min(limit, 10);

      try {
        // 1. Query embed хийх
        const embedResults = await ai.embed({
          embedder: 'googleai/text-embedding-004',
          content: query,
        });
        const queryVec: number[] = embedResults[0].embedding;

        // 2. Firestore-оос тухайн ажилтны chunk-ууд авах (max 200)
        const snap = await db()
          .collection(`companies/${companyId}/documentChunks`)
          .where('employeeId', '==', employeeId)
          .limit(200)
          .get();

        if (snap.empty) {
          return { found: false, results: [], employeeId, query };
        }

        // 3. Cosine similarity тооцоолох
        const scored = snap.docs.map((doc) => {
          const data = doc.data();
          const chunkVec: number[] = data.embedding || [];
          const score = cosineSimilarity(queryVec, chunkVec);
          return {
            text: (data.text as string) || '',
            sourceTitle: (data.sourceTitle as string) || '',
            documentType: (data.documentType as string) || '',
            chunkIndex: (data.chunkIndex as number) ?? 0,
            score,
          };
        });

        // 4. Шүүж, эрэмбэлж, top-limit авах
        const filtered = scored
          .filter((r) => r.score > 0.5)
          .sort((a, b) => b.score - a.score)
          .slice(0, clampedLimit);

        return {
          found: filtered.length > 0,
          results: filtered,
          employeeId,
          query,
        };
      } catch (err) {
        console.error('[document-rag-agent] searchEmployeeDocuments failed:', err);
        // Graceful — хоосон үр дүн буцаана, AI өөр эх сурвалжаас хариулна
        return { found: false, results: [], employeeId, query };
      }
    }
  );

  return [searchEmployeeDocuments] as const;
}
