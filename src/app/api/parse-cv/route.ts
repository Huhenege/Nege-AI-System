import { NextRequest, NextResponse } from 'next/server';
import { extractCVFromImage, extractCVFromText, extractCVFromPDF, ParsedCVData } from '@/ai/cv-parser';
import { requireAuth } from '@/lib/api/auth-middleware';

export const maxDuration = 120;

export async function POST(request: NextRequest) {
  const authResult = await requireAuth(request);
  if (authResult.response) return authResult.response;

  const startTime = Date.now();
  
  try {
    const body = await request.json();
    const { imageDataUrl, mimeType, textContent } = body;

    console.log(`[CV Parser] Starting CV parsing - Type: ${mimeType || 'text'}`);

    let result: ParsedCVData;

    if (textContent) {
      // Text-based extraction
      console.log('[CV Parser] Processing text content...');
      result = await extractCVFromText(textContent);
    } else if (imageDataUrl && mimeType) {
      // Image/PDF-based extraction
      console.log(`[CV Parser] Processing image/PDF - MIME: ${mimeType}`);
      
      // Validate data URL
      if (!imageDataUrl.startsWith('data:')) {
        return NextResponse.json(
          { error: 'Invalid data URL format' },
          { status: 400 }
        );
      }
      
      result = await extractCVFromImage(imageDataUrl, mimeType);
    } else {
      return NextResponse.json(
        { error: 'Either imageDataUrl+mimeType or textContent is required' },
        { status: 400 }
      );
    }

    const duration = Date.now() - startTime;
    console.log(`[CV Parser] Completed in ${duration}ms`);
    
    // Count extracted fields for logging
    const fieldCount = Object.entries(result).filter(([_, v]) => {
      if (Array.isArray(v)) return v.length > 0;
      return v !== undefined && v !== null && v !== '';
    }).length;
    console.log(`[CV Parser] Extracted ${fieldCount} fields`);

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[CV Parser] Error after ${duration}ms:`, error);
    
    let errorMessage = 'CV задлахад алдаа гарлаа';
    
    if (error instanceof Error) {
      errorMessage = error.message;
      
      // Provide more helpful error messages
      if (error.message.includes('API key')) {
        errorMessage = 'AI тохиргоо буруу байна. Админд хандана уу.';
      } else if (error.message.includes('quota') || error.message.includes('rate limit')) {
        errorMessage = 'AI хязгаарлалтад хүрлээ. Түр хүлээгээд дахин оролдоно уу.';
      } else if (error.message.includes('timeout') || error.message.includes('DEADLINE')) {
        errorMessage = 'AI хариу удаж байна. Дахин оролдоно уу.';
      } else if (error.message.includes('JSON') || error.message.includes('parse')) {
        errorMessage = 'CV-ээс мэдээлэл задлахад алдаа гарлаа. Өөр форматтай CV оруулаад үзнэ үү.';
      }
    }
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
