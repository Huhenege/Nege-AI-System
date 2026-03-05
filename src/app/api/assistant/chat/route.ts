import { NextRequest, NextResponse } from 'next/server';
import { ai } from '@/ai/genkit';
import { systemPrompt, createProjectTool, listEmployeesTool } from '@/ai/assistant';

export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: 'Messages array is required' }, { status: 400 });
    }

    const { text, message } = await ai.generate({
      system: systemPrompt,
      messages: messages,
      tools: [createProjectTool, listEmployeesTool],
      maxTurns: 5, // Allow the agent to call tools and respond (increased to 5 for fetching employees then creating project)
    });

    return NextResponse.json({ 
      text,
      message, 
    });
  } catch (error: any) {
    console.error('Error in assistant chat API:', error);
    return NextResponse.json(
      { error: error.message || 'An error occurred processing your request' },
      { status: 500 }
    );
  }
}
