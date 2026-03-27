/**
 * document-extractor.ts
 * ─────────────────────
 * Файлын URL-аас текст гаргах utility.
 * Дэмжих формат: PDF, DOCX/DOC, зураг (JPG/PNG/WEBP/GIF)
 */

import { ai } from '@/ai/genkit';

// ─── PDF ────────────────────────────────────────────────────────────────────

async function extractPdfText(buffer: Buffer): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfParse = require('pdf-parse') as (buf: Buffer) => Promise<{ text: string }>;
  const result = await pdfParse(buffer);
  return result.text || '';
}

// ─── Word ───────────────────────────────────────────────────────────────────

async function extractWordText(buffer: Buffer): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mammoth = require('mammoth') as {
    extractRawText: (input: { buffer: Buffer }) => Promise<{ value: string }>;
  };
  const result = await mammoth.extractRawText({ buffer });
  return result.value || '';
}

// ─── Image (Gemini Vision OCR) ───────────────────────────────────────────────

async function extractImageText(buffer: Buffer, mimeType: string): Promise<string> {
  const base64 = buffer.toString('base64');
  const result = await ai.generate({
    model: 'googleai/gemini-2.5-flash',
    prompt: [
      {
        media: {
          url: `data:${mimeType};base64,${base64}`,
          contentType: mimeType,
        },
      },
      {
        text: 'Энэ зурган дотор байгаа бүх текстийг уншиж, дараалуулан бичиж өг. Зөвхөн текст, нэмэлт тайлбаргүй.',
      },
    ],
  });
  return result.text || '';
}

// ─── URL fetch ───────────────────────────────────────────────────────────────

function getExtension(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    const parts = pathname.split('.');
    return parts.length > 1 ? parts[parts.length - 1].toLowerCase().split('?')[0] : '';
  } catch {
    return '';
  }
}

async function fetchBuffer(url: string): Promise<{ buffer: Buffer; mimeType: string }> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch file: ${res.status} ${res.statusText}`);
  const contentType = res.headers.get('content-type') || 'application/octet-stream';
  const mimeType = contentType.split(';')[0].trim();
  const arrayBuf = await res.arrayBuffer();
  return { buffer: Buffer.from(arrayBuf), mimeType };
}

// ─── Main export ─────────────────────────────────────────────────────────────

export async function extractTextFromUrl(
  url: string
): Promise<{ text: string; method: string }> {
  try {
    const ext = getExtension(url);

    // PDF
    if (ext === 'pdf') {
      const { buffer } = await fetchBuffer(url);
      const text = await extractPdfText(buffer);
      return { text: text.trim(), method: 'pdf-parse' };
    }

    // Word
    if (ext === 'docx' || ext === 'doc') {
      const { buffer } = await fetchBuffer(url);
      const text = await extractWordText(buffer);
      return { text: text.trim(), method: 'mammoth' };
    }

    // Image
    if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext)) {
      const { buffer, mimeType } = await fetchBuffer(url);
      const resolvedMime = mimeType !== 'application/octet-stream'
        ? mimeType
        : `image/${ext === 'jpg' ? 'jpeg' : ext}`;
      const text = await extractImageText(buffer, resolvedMime);
      return { text: text.trim(), method: 'gemini-vision' };
    }

    // Unsupported — graceful empty
    return { text: '', method: 'unsupported' };
  } catch (err) {
    console.error('[document-extractor] extractTextFromUrl failed:', err);
    return { text: '', method: 'error' };
  }
}
