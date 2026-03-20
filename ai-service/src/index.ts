import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { ai } from './genkit.js';
import { buildSystemPrompt, createProjectTool, type EmployeeInfo } from './assistant.js';
import { getFirestore } from './firebase-admin.js';

const app = express();
const PORT = parseInt(process.env.PORT || '4000', 10);

const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`Origin ${origin} not allowed`));
    }
  },
  credentials: true,
}));

app.use(express.json({ limit: '1mb' }));

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'nege-ai-service', timestamp: new Date().toISOString() });
});

// POST /chat - AI chat endpoint
app.post('/chat', async (req, res) => {
  try {
    const { messages, employees } = req.body;

    if (!messages || !Array.isArray(messages)) {
      res.status(400).json({ error: 'messages array is required' });
      return;
    }

    const empList: EmployeeInfo[] = Array.isArray(employees) ? employees : [];
    const systemPrompt = buildSystemPrompt(empList);

    console.log(`[/chat] ${messages.length} messages, ${empList.length} employees`);

    const result = await ai.generate({
      system: systemPrompt,
      messages,
      tools: [createProjectTool],
      maxTurns: 3,
    });

    const text = result.text || '';
    console.log(`[/chat] Response length: ${text.length}`);

    res.json({ text });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[/chat] Error:', msg);
    res.status(500).json({ error: msg });
  }
});

// GET /employees - Fetch employee list from Firestore (tenant-scoped)
app.get('/employees', async (req, res) => {
  try {
    const companyId = req.query.companyId as string;
    if (!companyId) {
      res.status(400).json({ error: 'companyId query parameter is required' });
      return;
    }

    const db = getFirestore();
    const basePath = `companies/${companyId}`;

    const [empSnap, posSnap] = await Promise.all([
      db.collection(`${basePath}/employees`).get(),
      db.collection(`${basePath}/positions`).get(),
    ]);

    const posMap = new Map<string, string>();
    posSnap.docs.forEach(doc => {
      const d = doc.data();
      posMap.set(doc.id, d.title || d.name || '');
    });

    const employees = empSnap.docs.map(doc => {
      const d = doc.data();
      const first = d.firstName || '';
      const last = d.lastName || '';
      const name = `${last} ${first}`.trim() || d.email || 'Нэргүй';
      return {
        id: doc.id,
        name,
        position: d.positionId ? posMap.get(d.positionId) : undefined,
      };
    });

    console.log(`[/employees] Returning ${employees.length} employees for company ${companyId}`);
    res.json({ employees });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to fetch employees';
    console.error('[/employees] Error:', msg);
    res.status(500).json({ employees: [], error: msg });
  }
});

app.listen(PORT, () => {
  console.log(`\n🤖 Nege AI Service running at http://localhost:${PORT}`);
  console.log(`   POST /chat       - AI чат`);
  console.log(`   GET  /employees  - Ажилчдын жагсаалт`);
  console.log(`   GET  /health     - Health check\n`);
});
