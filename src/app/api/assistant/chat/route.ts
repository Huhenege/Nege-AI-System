import { NextRequest, NextResponse } from 'next/server';
import { ai } from '@/ai/genkit';
import { buildOrchestratorSystemPrompt, createOrchestratorTools, type EmployeeInfo } from '@/ai/orchestrator';
import { requireTenantAuth } from '@/lib/api/auth-middleware';
import { getFirebaseAdminFirestore } from '@/lib/firebase-admin';

// Ажилтны жагсаалтыг server-side-аас авах (client body-оос биш)
// Токен хэмнэлт: зөвхөн id+name
async function fetchEmployeesServerSide(companyId: string): Promise<EmployeeInfo[]> {
  try {
    const db = getFirebaseAdminFirestore();
    const snap = await db
      .collection(`companies/${companyId}/employees`)
      .where('status', 'in', ['active', 'active_probation', 'active_permanent', 'active_recruitment'])
      .select('firstName', 'lastName')
      .limit(300)
      .get();

    return snap.docs.map((doc) => {
      const d = doc.data();
      const name = `${d.lastName ?? ''} ${d.firstName ?? ''}`.trim() || 'Нэргүй';
      return { id: doc.id, name };
    });
  } catch {
    return [];
  }
}

export async function POST(req: NextRequest) {
  const authResult = await requireTenantAuth(req, { rateLimit: 'ai' });
  if (authResult.response) return authResult.response;
  const { companyId, uid, role } = authResult.auth;

  try {
    const body = await req.json();
    const { messages } = body;

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: 'Messages array is required' }, { status: 400 });
    }

    // Context window overflow хамгаалалт: сүүлийн 20 мессежийг л авна
    const MAX_MESSAGES = 20;
    const trimmedMessages = messages.length > MAX_MESSAGES
      ? messages.slice(messages.length - MAX_MESSAGES)
      : messages;

    // Server-side-аас ажилтны жагсаалт авах — client body дахь employees-г үл тооно
    // Давуу тал: network payload бага, client manipulate хийж чадахгүй
    const employeeList = await fetchEmployeesServerSide(companyId);

    const ctx = {
      companyId,
      userId: uid,
      userRole: role,
      employees: employeeList,
    };

    const systemPrompt = buildOrchestratorSystemPrompt(ctx);
    const tools = createOrchestratorTools(ctx);

    console.log(
      '[AI Chat] company:', companyId,
      'role:', role,
      'messages:', trimmedMessages.length,
      'employees (server):', employeeList.length,
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
