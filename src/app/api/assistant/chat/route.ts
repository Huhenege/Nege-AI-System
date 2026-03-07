import { NextRequest, NextResponse } from 'next/server';
import { ai } from '@/ai/genkit';
import { buildSystemPrompt, createProjectToolForTenant } from '@/ai/assistant';
import { requireTenantAuth } from '@/lib/api/auth-middleware';

export async function POST(req: NextRequest) {
  const authResult = await requireTenantAuth(req);
  if (authResult.response) return authResult.response;
  const { companyId } = authResult.auth;

  try {
    const body = await req.json();
    const { messages, employees } = body;

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: 'Messages array is required' }, { status: 400 });
    }

    const systemPrompt = buildSystemPrompt(Array.isArray(employees) ? employees : []);
    const projectTool = createProjectToolForTenant(companyId);

    console.log('[AI Chat] company:', companyId, 'messages:', messages.length, 'employees:', (employees || []).length);

    const result = await ai.generate({
      system: systemPrompt,
      messages,
      tools: [projectTool],
      maxTurns: 3,
    });

    const text = result.text || '';

    console.log('[AI Chat] Response generated, length:', text.length);

    return NextResponse.json({ text });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'An error occurred';
    console.error('[AI Chat] Error:', message);
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
