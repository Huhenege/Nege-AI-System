import { NextRequest, NextResponse } from 'next/server';
import { extractNDSHFromImage, extractNDSHFromText, NDSHParsedData } from '@/ai/ndsh-parser';
import { requireAuth } from '@/lib/api/auth-middleware';

export const maxDuration = 120;

export async function POST(request: NextRequest) {
  const authResult = await requireAuth(request);
  if (authResult.response) return authResult.response;

  const startTime = Date.now();
  
  try {
    const body = await request.json();
    const { imageDataUrl, mimeType, textContent } = body;

    console.log(`[NDSH Parser] Starting NDSH parsing - Type: ${mimeType || 'text'}`);

    let result: NDSHParsedData;

    if (textContent) {
      console.log('[NDSH Parser] Processing text content...');
      result = await extractNDSHFromText(textContent);
    } else if (imageDataUrl && mimeType) {
      console.log(`[NDSH Parser] Processing image/PDF - MIME: ${mimeType}`);
      
      if (!imageDataUrl.startsWith('data:')) {
        return NextResponse.json(
          { error: 'Invalid data URL format' },
          { status: 400 }
        );
      }
      
      result = await extractNDSHFromImage(imageDataUrl, mimeType);
    } else {
      return NextResponse.json(
        { error: 'Either imageDataUrl+mimeType or textContent is required' },
        { status: 400 }
      );
    }

    const duration = Date.now() - startTime;
    const paymentCount = result?.payments?.length || 0;
    console.log(`[NDSH Parser] Completed in ${duration}ms - Found ${paymentCount} payment records`);

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[NDSH Parser] Error after ${duration}ms:`, error);
    
    let errorMessage = 'НДШ лавлагаа задлахад алдаа гарлаа';
    
    if (error instanceof Error) {
      errorMessage = error.message;
      
      if (error.message.includes('API key')) {
        errorMessage = 'AI тохиргоо буруу байна. Админд хандана уу.';
      } else if (error.message.includes('quota') || error.message.includes('rate limit')) {
        errorMessage = 'AI хязгаарлалтад хүрлээ. Түр хүлээгээд дахин оролдоно уу.';
      } else if (error.message.includes('timeout') || error.message.includes('DEADLINE')) {
        errorMessage = 'AI хариу удаж байна. Дахин оролдоно уу.';
      }
    }
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
