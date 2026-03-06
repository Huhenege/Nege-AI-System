import { NextRequest, NextResponse } from 'next/server';
import { ai } from '@/ai/genkit';
import { buildSystemPrompt, createProjectTool } from '@/ai/assistant';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { messages, employees } = body;

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: 'Messages array is required' }, { status: 400 });
    }

    const systemPrompt = buildSystemPrompt(Array.isArray(employees) ? employees : []);

    console.log('[AI Chat] Generating response, messages:', messages.length, 'employees:', (employees || []).length);

    const result = await ai.generate({
      system: systemPrompt,
      messages,
      tools: [createProjectTool],
      maxTurns: 3,
    });

    const text = result.text || '';

    console.log('[AI Chat] Response generated, length:', text.length);

    return NextResponse.json({ text });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'An error occurred';
    const stack = error instanceof Error ? error.stack : '';
    console.error('[AI Chat] Error:', message);
    console.error('[AI Chat] Stack:', stack);
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
