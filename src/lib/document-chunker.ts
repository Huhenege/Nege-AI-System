/**
 * document-chunker.ts
 * ────────────────────
 * Урт текстийг overlap-тай chunk болгон хуваах utility.
 */

export interface TextChunk {
  text: string;
  index: number;      // chunk-ийн дугаар (0-based)
  charStart: number;  // эх текст дэх эхлэл байрлал
  charEnd: number;    // эх текст дэх төгсгөл байрлал
}

/**
 * Текстийг `chunkSize` тэмдэгт бүхий хэсгүүдэд хуваана.
 * Дараалсан chunk-ууд хооронд `overlap` тэмдэгт давхцана.
 *
 * @param text      Хувааx эх текст
 * @param chunkSize Chunk-ийн дээд хэмжээ (тэмдэгт) — default 800
 * @param overlap   Давхцах тэмдэгтийн тоо — default 150
 */
export function chunkText(
  text: string,
  chunkSize = 800,
  overlap = 150
): TextChunk[] {
  if (!text || text.trim().length === 0) return [];

  const chunks: TextChunk[] = [];
  const step = chunkSize - overlap;
  let index = 0;

  for (let start = 0; start < text.length; start += step) {
    const end = Math.min(start + chunkSize, text.length);
    const chunkText = text.slice(start, end).trim();

    if (chunkText.length > 0) {
      chunks.push({
        text: chunkText,
        index,
        charStart: start,
        charEnd: end,
      });
      index++;
    }

    // Хэрэв энэ бол сүүлийн chunk бол зогс
    if (end >= text.length) break;
  }

  return chunks;
}
