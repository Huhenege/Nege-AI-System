import { NextRequest, NextResponse } from 'next/server';
import { ai } from '@/ai/genkit';
import { googleAI } from '@genkit-ai/google-genai';
import {
  IMPLEMENTATION_CHECKLIST_STEPS,
  IMPLEMENTATION_STEPS_CONTEXT,
} from '@/data/implementation-checklist-steps';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const question: string = typeof body?.question === 'string' ? body.question.trim() : '';
    const stepId: string | undefined = typeof body?.stepId === 'string' ? body.stepId : undefined;

    if (!question) {
      return NextResponse.json(
        { error: 'Асуулт оруулна уу.' },
        { status: 400 }
      );
    }

    const stepContext = stepId
      ? IMPLEMENTATION_CHECKLIST_STEPS.find((s) => s.id === stepId)
      : null;

    const systemContext = [
      'Та Nege Systems системийн нэвтрүүлэлтийн зөвлөх. Хэрэглэгчийн асуултанд богино, алхам алхмаар монгол хэл дээр зөвлөмж өг.',
      'Нэвтрүүлэлтийн дараалал (алхам → хуудас):',
      IMPLEMENTATION_STEPS_CONTEXT,
    ].join('\n');

    const stepHint = stepContext
      ? `\n\nОдоогийн сонгосон алхам: "${stepContext.label}" (${stepContext.href}). Хариултаа энэ алхамд чиглүүл.`
      : '';

    const fullPrompt = `${systemContext}${stepHint}\n\nХэрэглэгчийн асуулт: ${question}\n\nЗөвлөмж (монгол хэлээр, товч, алхам алхмаар):`;

    const { text } = await ai.generate({
      model: googleAI.model('gemini-2.5-flash'),
      prompt: fullPrompt,
      config: { temperature: 0.4 },
    });

    const answer = text?.trim() ?? '';

    return NextResponse.json({ answer });
  } catch (err) {
    console.error('implementation-guide-ai API error:', err);
    const message = err instanceof Error ? err.message : 'Зөвлөгөө авахад алдаа гарлаа';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
