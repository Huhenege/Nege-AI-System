import { NextResponse } from 'next/server';
import { getFirebaseAdminAuth, getFirebaseAdminFirestore } from '@/lib/firebase-admin';
import { checkRateLimit } from '@/lib/api/rate-limiter';

type Body = {
  documentTypeId?: string;
};

type NumberingConfig = {
  includePrefix?: boolean;
  includeYear?: boolean;
  includeMonth?: boolean;
  includeDay?: boolean;
  separator?: string;
  numberPadding?: number;
  startNumber?: number;
  resetPeriod?: 'never' | 'yearly' | 'monthly' | 'daily';
};

const DEFAULT_NUMBERING_CONFIG: Required<
  Pick<
    NumberingConfig,
    | 'includePrefix'
    | 'includeYear'
    | 'includeMonth'
    | 'includeDay'
    | 'separator'
    | 'numberPadding'
    | 'startNumber'
    | 'resetPeriod'
  >
> = {
  includePrefix: true,
  includeYear: true,
  includeMonth: false,
  includeDay: false,
  separator: '-',
  numberPadding: 4,
  startNumber: 1,
  resetPeriod: 'yearly',
};

function getBearerToken(req: Request): string | null {
  const header = req.headers.get('authorization') || req.headers.get('Authorization') || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1] || null;
}

function shouldResetCounter(
  config: NumberingConfig,
  lastYear?: number,
  lastMonth?: number,
  lastDay?: number,
  now: Date = new Date()
): boolean {
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const currentDay = now.getDate();

  switch (config.resetPeriod) {
    case 'yearly':
      return lastYear !== currentYear;
    case 'monthly':
      return lastYear !== currentYear || lastMonth !== currentMonth;
    case 'daily':
      return (
        lastYear !== currentYear ||
        lastMonth !== currentMonth ||
        lastDay !== currentDay
      );
    case 'never':
    default:
      return false;
  }
}

function generateDocumentNumber(
  prefix: string,
  config: NumberingConfig,
  sequence: number,
  date: Date
): string {
  const parts: string[] = [];
  const sep = config.separator || '-';

  if (config.includePrefix && prefix) parts.push(prefix);
  if (config.includeYear) parts.push(date.getFullYear().toString());
  if (config.includeMonth)
    parts.push(String(date.getMonth() + 1).padStart(2, '0'));
  if (config.includeDay) parts.push(String(date.getDate()).padStart(2, '0'));

  const padding = config.numberPadding || 4;
  parts.push(String(sequence).padStart(padding, '0'));

  return parts.join(sep);
}

/**
 * POST /api/employment-relations/next-document-number
 *
 * Atomically allocates the next document number for a given documentTypeId.
 * Uses Firestore Admin SDK transaction on the tenant-scoped path:
 *   companies/{companyId}/er_process_document_types/{documentTypeId}
 *
 * Security: verifies ID token, resolves companyId from token claims,
 * rate-limits per user.
 */
export async function POST(request: Request) {
  try {
    // ── Auth ─────────────────────────────────────────────────────────────
    const token = getBearerToken(request);
    if (!token) {
      return NextResponse.json(
        { error: 'Missing Authorization bearer token' },
        { status: 401 }
      );
    }

    const adminAuth = getFirebaseAdminAuth();
    const adminDb = getFirebaseAdminFirestore();

    let decoded: { uid: string; companyId?: string; role?: string };
    try {
      decoded = (await adminAuth.verifyIdToken(token)) as {
        uid: string;
        companyId?: string;
        role?: string;
      };
    } catch {
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401 }
      );
    }

    // ── Rate limit ────────────────────────────────────────────────────────
    const rateLimited = await checkRateLimit(
      decoded.uid,
      '/api/employment-relations/next-document-number',
      { limit: 30, windowSeconds: 60 }
    );
    if (rateLimited) return rateLimited;

    // ── Resolve companyId (from token claims; fallback to ownerId query) ──
    let companyId = decoded.companyId;
    if (!companyId) {
      const ownedSnap = await adminDb
        .collection('companies')
        .where('ownerId', '==', decoded.uid)
        .limit(1)
        .get();
      if (!ownedSnap.empty) companyId = ownedSnap.docs[0].id;
    }
    if (!companyId) {
      return NextResponse.json(
        { error: 'Байгууллага олдсонгүй. Дахин нэвтэрнэ үү.' },
        { status: 404 }
      );
    }

    // ── Validate body ─────────────────────────────────────────────────────
    const body = (await request.json()) as Body;
    const documentTypeId =
      typeof body?.documentTypeId === 'string'
        ? body.documentTypeId.trim()
        : '';
    if (!documentTypeId) {
      return NextResponse.json(
        { error: 'Missing required field: documentTypeId' },
        { status: 400 }
      );
    }

    // ── Atomic transaction on tenant-scoped path ──────────────────────────
    const result = await adminDb.runTransaction(async (tx) => {
      // Tenant-scoped path: companies/{companyId}/er_process_document_types/{id}
      const ref = adminDb.doc(
        `companies/${companyId}/er_process_document_types/${documentTypeId}`
      );
      const snap = await tx.get(ref);

      if (!snap.exists) {
        return {
          ok: false as const,
          status: 404,
          error: 'Баримтын төрөл олдсонгүй',
        };
      }

      const data = snap.data() as Record<string, unknown>;
      const prefix =
        typeof data?.prefix === 'string'
          ? String(data.prefix).toUpperCase().trim()
          : '';
      const cfg = {
        ...DEFAULT_NUMBERING_CONFIG,
        ...(data?.numberingConfig || {}),
      } as NumberingConfig;

      if (cfg.includePrefix && !prefix) {
        return {
          ok: false as const,
          status: 400,
          error: 'Баримтын төрлийн үсгэн код (prefix) тохируулаагүй байна',
        };
      }

      const now = new Date();
      const shouldReset = shouldResetCounter(
        cfg,
        data?.lastNumberYear as number | undefined,
        data?.lastNumberMonth as number | undefined,
        data?.lastNumberDay as number | undefined,
        now
      );

      const startNumber =
        typeof cfg.startNumber === 'number' && cfg.startNumber > 0
          ? cfg.startNumber
          : 1;

      let nextNumber: number;
      if (shouldReset) {
        nextNumber = startNumber;
      } else {
        const currentNumber =
          typeof data?.currentNumber === 'number' ? data.currentNumber : 0;
        nextNumber = currentNumber + 1;
        if (nextNumber < startNumber) nextNumber = startNumber;
      }

      tx.update(ref, {
        currentNumber: nextNumber,
        lastNumberYear: now.getFullYear(),
        lastNumberMonth: now.getMonth() + 1,
        lastNumberDay: now.getDate(),
        updatedAt: now,
      });

      const documentNumber = generateDocumentNumber(prefix, cfg, nextNumber, now);
      return { ok: true as const, documentNumber, nextNumber };
    });

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status }
      );
    }

    return NextResponse.json({
      documentNumber: result.documentNumber,
      nextNumber: result.nextNumber,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Internal Server Error';
    console.error('[next-document-number]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
