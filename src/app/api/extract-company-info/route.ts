import { NextRequest, NextResponse } from 'next/server';
import {
  extractCompanyInfoFromImage,
  extractCompanyInfoFromText,
} from '@/ai/company-ocr';
import { requireAuth } from '@/lib/api/auth-middleware';

export async function POST(request: NextRequest) {
  const authResult = await requireAuth(request, { rateLimit: 'ai' });
  if (authResult.response) return authResult.response;

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'Файл байхгүй байна' },
        { status: 400 }
      );
    }

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'Файл хэт том байна (10MB-с бага байх ёстой)' },
        { status: 400 }
      );
    }

    let extractedInfo: Record<string, string> = {};

    if (file.type.startsWith('image/')) {
      const arrayBuffer = await file.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString('base64');
      const mimeType = file.type;
      const dataUrl = `data:${mimeType};base64,${base64}`;
      extractedInfo = await extractCompanyInfoFromImage(
        dataUrl,
        mimeType
      ) as Record<string, string>;
    } else if (file.type === 'application/pdf') {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        
        // Dynamic import pdf-parse (v1 simple API)
        // Use /lib/pdf-parse to avoid test file loading issues in Next.js
        const pdfParse = (await import('pdf-parse/lib/pdf-parse')).default;
        const pdfData = await pdfParse(buffer);
        const text = (pdfData?.text ?? '').trim();
        
        if (!text) {
          return NextResponse.json(
            {
              error:
                'Энэ PDF нь скан (зураг) байна, текст олдсонгүй. Байгууллагын гэрчилгээний хуудсыг PNG эсвэл JPG зураг хэлбэрээр оруулбал AI талбаруудыг зөв бөглөнө.',
            },
            { status: 400 }
          );
        }
        
        extractedInfo = (await extractCompanyInfoFromText(text)) as Record<string, string>;
      } catch (pdfErr) {
        console.error('PDF processing error:', pdfErr);
        const msg = pdfErr instanceof Error ? pdfErr.message : String(pdfErr);
        return NextResponse.json(
          {
            error: `PDF боловсруулахад алдаа: ${msg}`,
          },
          { status: 500 }
        );
      }
    } else if (file.type.startsWith('text/')) {
      const arrayBuffer = await file.arrayBuffer();
      const text = new TextDecoder().decode(arrayBuffer);
      if (!text.trim()) {
        return NextResponse.json(
          { error: 'Текст файл хоосон байна' },
          { status: 400 }
        );
      }
      extractedInfo = await extractCompanyInfoFromText(
        text
      ) as Record<string, string>;
    } else {
      return NextResponse.json(
        {
          error:
            'Дэмжигдээгүй файл төрөл. Зураг, PDF эсвэл текст файл оруулна уу.',
        },
        { status: 400 }
      );
    }

    const cleanData = Object.fromEntries(
      Object.entries(extractedInfo).filter(
        ([_, value]) =>
          value != null && value !== '' && typeof value === 'string'
      )
    ) as Record<string, string>;

    return NextResponse.json({
      success: true,
      data: cleanData,
      message: 'Компанийн мэдээлэл амжилттай задлагдлаа',
    });
  } catch (err) {
    console.error('extract-company-info API error:', err);
    const message =
      err instanceof Error ? err.message : 'Мэдээлэл задлахад алдаа гарлаа';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
