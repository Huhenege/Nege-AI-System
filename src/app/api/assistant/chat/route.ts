import { NextRequest, NextResponse } from 'next/server';
import { ai } from '@/ai/genkit';
import { buildOrchestratorSystemPrompt, createOrchestratorTools } from '@/ai/orchestrator';
import { requireTenantAuth } from '@/lib/api/auth-middleware';

export async function POST(req: NextRequest) {
  const authResult = await requireTenantAuth(req, { rateLimit: 'ai' });
  if (authResult.response) return authResult.response;
  const { companyId, uid, role } = authResult.auth;

  try {
    const body = await req.json();
    const { messages, employees } = body;

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: 'Messages array is required' }, { status: 400 });
    }

    // Context window overflow хамгаалалт: сүүлийн 20 мессежийг л авна
    const MAX_MESSAGES = 20;
    const trimmedMessages = messages.length > MAX_MESSAGES
      ? messages.slice(messages.length - MAX_MESSAGES)
      : messages;

    const employeeList = Array.isArray(employees) ? employees : [];

    const systemPrompt = buildOrchestratorSystemPrompt({
      companyId,
      userId: uid,
      userRole: role,
      employees: employeeList,
    });

    const tools = createOrchestratorTools({
      companyId,
      userId: uid,
      userRole: role,
      employees: employeeList,
    });

    console.log(
      '[AI Chat] company:', companyId,
      'role:', role,
      'messages:', trimmedMessages.length, '(original:', messages.length, ')',
      'employees:', employeeList.length,
      'tools:', tools.length
    );

    const result = await ai.generate({
      system: systemPrompt,
      messages: trimmedMessages,
      tools,
      maxTurns: 5,
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
