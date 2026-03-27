/**
 * POST /api/documents/vectorize
 * ──────────────────────────────
 * Байршуулсан баримтыг векторжуулж Firestore-д хадгална.
 * Body: { documentId: string, employeeId: string, companyId?: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { requireTenantAuth } from '@/lib/api/auth-middleware';
import { getFirebaseAdminFirestore } from '@/lib/firebase-admin';
import { extractTextFromUrl } from '@/lib/document-extractor';
import { chunkText } from '@/lib/document-chunker';
import { ai } from '@/ai/genkit';

export async function POST(request: NextRequest) {
  // 1. Auth шалгах
  const authResult = await requireTenantAuth(request);
  if (authResult.error) return authResult.response;

  const authCtx = authResult.auth!;
  const authCompanyId = authCtx.companyId;

  // 2. Body уншах
  let body: { documentId?: string; employeeId?: string; companyId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { documentId, employeeId } = body;
  const companyId = body.companyId || authCompanyId;

  if (!documentId || !employeeId) {
    return NextResponse.json(
      { error: 'documentId болон employeeId шаардлагатай' },
      { status: 400 }
    );
  }

  const db = getFirebaseAdminFirestore();

  try {
    // 3. Firestore-оос document авах
    const docRef = db
      .collection(`companies/${companyId}/documents`)
      .doc(documentId);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      return NextResponse.json(
        { error: `Баримт (${documentId}) олдсонгүй` },
        { status: 404 }
      );
    }

    const docData = docSnap.data()!;
    const url: string = docData.url;
    const sourceTitle: string = docData.title || 'Нэргүй баримт';
    const documentType: string = docData.documentType || '';

    if (!url) {
      return NextResponse.json(
        { error: 'Баримтын URL байхгүй байна' },
        { status: 400 }
      );
    }

    // 4. Текст гаргах
    const { text, method } = await extractTextFromUrl(url);

    if (!text) {
      return NextResponse.json(
        { success: true, skipped: true, reason: `Текст гаргаж чадсангүй (method: ${method})` }
      );
    }

    // 5. Chunk хуваах
    const chunks = chunkText(text);

    if (chunks.length === 0) {
      return NextResponse.json({ success: true, skipped: true, reason: 'Хоосон текст' });
    }

    // 6 & 7. Chunk бүрт embedding үүсгэж Firestore-д хадгалах (sequential)
    const chunksCollection = db.collection(`companies/${companyId}/documentChunks`);
    const now = FieldValue.serverTimestamp();

    for (const chunk of chunks) {
      const embedResults = await ai.embed({
        embedder: 'googleai/text-embedding-004',
        content: chunk.text,
      });

      const embedding: number[] = embedResults[0].embedding;

      await chunksCollection.add({
        documentId,
        employeeId,
        chunkIndex: chunk.index,
        text: chunk.text,
        embedding,
        sourceTitle,
        documentType,
        createdAt: now,
      });
    }

    // 8. Document-д vectorized тэмдэглэх
    await docRef.update({
      vectorized: true,
      vectorizedAt: FieldValue.serverTimestamp(),
    });

    // 9. Амжилт буцаах
    return NextResponse.json({ success: true, chunksCreated: chunks.length });
  } catch (err) {
    console.error('[vectorize] Error:', err);
    const message = err instanceof Error ? err.message : 'Алдаа гарлаа';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
