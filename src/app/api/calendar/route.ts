import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdminAuth, getFirebaseAdminFirestore } from '@/lib/firebase-admin';
import { checkRateLimit } from '@/lib/api/rate-limiter';
import { FieldValue } from 'firebase-admin/firestore';
import { z } from 'zod';

// ─── Schemas ──────────────────────────────────────────────────────────────────

const CalendarEventSchema = z.object({
  id: z.string(),
  title: z.string().min(1).max(200),
  type: z.enum(['meeting', 'deadline', 'birthday', 'anniversary', 'training', 'other']),
  description: z.string().max(500).optional(),
  isRecurring: z.boolean().optional(),
});

const CalendarDaySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dayType: z.enum(['working', 'weekend', 'public_holiday', 'company_holiday', 'special_working', 'half_day']),
  isHoliday: z.boolean().optional(),
  holidayName: z.string().max(200).optional(),
  holidayType: z.enum(['public', 'company']).optional(),
  workingHours: z.number().min(0).max(24).optional(),
  isPaid: z.boolean().optional(),
  note: z.string().max(500).optional(),
  isRecurring: z.boolean().optional(),
  legalReference: z.string().max(300).optional(),
  events: z.array(CalendarEventSchema).optional(),
});

const BodySchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('init'),
    year: z.number().int().min(2020).max(2050),
  }),
  z.object({
    action: z.literal('upsert_day'),
    year: z.number().int().min(2020).max(2050),
    day: CalendarDaySchema,
  }),
  z.object({
    action: z.literal('delete_day'),
    year: z.number().int().min(2020).max(2050),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  }),
  z.object({
    action: z.literal('move_day'),
    year: z.number().int().min(2020).max(2050),
    fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    toDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    day: CalendarDaySchema,
  }),
  z.object({
    action: z.literal('add_event'),
    year: z.number().int().min(2020).max(2050),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    event: CalendarEventSchema,
  }),
  z.object({
    action: z.literal('remove_event'),
    year: z.number().int().min(2020).max(2050),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    eventId: z.string(),
  }),
  z.object({
    action: z.literal('update_event'),
    year: z.number().int().min(2020).max(2050),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    event: CalendarEventSchema,
  }),
]);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getBearerToken(req: Request): string | null {
  const header = req.headers.get('authorization') || req.headers.get('Authorization') || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1] || null;
}

function calendarDocId(year: number) {
  return `calendar_${year}`;
}

function defaultCalendarData(year: number, companyId: string) {
  return {
    id: calendarDocId(year),
    name: `Ажлын календар ${year}`,
    description: 'Даваа-Баасан ажлын, Бямба-Ням амралтын стандарт хуваарь',
    year,
    country: 'Монгол',
    region: 'Улаанбаатар',
    timeZone: 'Asia/Ulaanbaatar',
    status: 'active',
    isDefault: true,
    workingTimeRules: {
      standardWorkingHoursPerDay: 8,
      workingHoursPerWeek: 40,
      breakTimeMinutes: 60,
      isShiftBased: false,
      overtimeEligible: true,
      halfDayHours: 4,
    },
    weekendDays: [0, 6],
    days: {},
    companyId,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    version: 1,
  };
}

// ─── Route ────────────────────────────────────────────────────────────────────

/**
 * POST /api/calendar
 *
 * All calendar write operations go through the Admin SDK to avoid the
 * Firestore client SDK token-propagation race condition.
 *
 * Actions:
 *  - init        → get or create the calendar doc for a given year
 *  - upsert_day  → create/update a single day entry
 *  - delete_day  → remove a day entry (field delete)
 *  - move_day    → atomically move a day entry to another date
 */
export async function POST(request: NextRequest) {
  // ── Auth ─────────────────────────────────────────────────────────────────
  const token = getBearerToken(request);
  if (!token) {
    return NextResponse.json({ error: 'Missing Authorization bearer token' }, { status: 401 });
  }

  const adminAuth = getFirebaseAdminAuth();
  const db = getFirebaseAdminFirestore();

  let decoded: { uid: string; companyId?: string; role?: string };
  try {
    decoded = (await adminAuth.verifyIdToken(token)) as {
      uid: string;
      companyId?: string;
      role?: string;
    };
  } catch {
    return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
  }

  // ── Rate limit ────────────────────────────────────────────────────────────
  const rateLimited = await checkRateLimit(decoded.uid, '/api/calendar', {
    limit: 60,
    windowSeconds: 60,
  });
  if (rateLimited) return rateLimited;

  // ── Resolve companyId ─────────────────────────────────────────────────────
  let companyId = decoded.companyId;
  if (!companyId) {
    const ownedSnap = await db
      .collection('companies')
      .where('ownerId', '==', decoded.uid)
      .limit(1)
      .get();
    if (!ownedSnap.empty) companyId = ownedSnap.docs[0].id;
  }
  if (!companyId) {
    return NextResponse.json({ error: 'Байгууллага олдсонгүй.' }, { status: 404 });
  }

  // ── Permission check (must be company admin or super_admin) ───────────────
  const allowedRoles = ['company_super_admin', 'admin', 'super_admin'];
  const isAdmin = decoded.role && allowedRoles.includes(decoded.role);
  if (!isAdmin) {
    const empSnap = await db.doc(`companies/${companyId}/employees/${decoded.uid}`).get();
    if (!empSnap.exists || !allowedRoles.includes(empSnap.data()?.role || '')) {
      return NextResponse.json({ error: 'Зөвшөөрөл байхгүй.' }, { status: 403 });
    }
  }

  // ── Parse body ────────────────────────────────────────────────────────────
  let body: z.infer<typeof BodySchema>;
  try {
    const raw = await request.json();
    body = BodySchema.parse(raw);
  } catch (err) {
    const message =
      err instanceof z.ZodError
        ? err.errors.map((e) => e.message).join('; ')
        : 'Хүсэлтийн өгөгдөл буруу байна.';
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const calendarRef = db.doc(
    `companies/${companyId}/workCalendars/${calendarDocId(body.year)}`
  );

  // ── Handle actions ────────────────────────────────────────────────────────

  if (body.action === 'init') {
    const snap = await calendarRef.get();
    if (snap.exists) {
      return NextResponse.json({ calendar: { id: snap.id, ...snap.data() } });
    }
    const newCalendar = defaultCalendarData(body.year, companyId);
    await calendarRef.set(newCalendar);
    const created = await calendarRef.get();
    return NextResponse.json({ calendar: { id: created.id, ...created.data() }, created: true });
  }

  if (body.action === 'upsert_day') {
    const { day } = body;
    // Strip undefined fields so Firestore doesn't choke
    const cleanDay = Object.fromEntries(
      Object.entries(day).filter(([, v]) => v !== undefined)
    );

    await calendarRef.update({
      [`days.${day.date}`]: cleanDay,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ success: true, date: day.date });
  }

  if (body.action === 'delete_day') {
    const { FieldValue: FV } = await import('firebase-admin/firestore');
    await calendarRef.update({
      [`days.${body.date}`]: FV.delete(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    return NextResponse.json({ success: true, date: body.date });
  }

  if (body.action === 'move_day') {
    const { day, fromDate, toDate } = body;
    const cleanDay = Object.fromEntries(
      Object.entries({ ...day, date: toDate }).filter(([, v]) => v !== undefined)
    );
    const { FieldValue: FV } = await import('firebase-admin/firestore');
    await calendarRef.update({
      [`days.${fromDate}`]: FV.delete(),
      [`days.${toDate}`]: cleanDay,
      updatedAt: FieldValue.serverTimestamp(),
    });
    return NextResponse.json({ success: true, fromDate, toDate });
  }

  if (body.action === 'add_event') {
    const { date, event } = body;
    await calendarRef.update({
      [`days.${date}.events`]: FieldValue.arrayUnion(event),
      updatedAt: FieldValue.serverTimestamp(),
    });
    return NextResponse.json({ success: true, date, eventId: event.id });
  }

  if (body.action === 'remove_event') {
    const { date, eventId } = body;
    const snap = await calendarRef.get();
    const days = snap.data()?.days || {};
    const dayData = days[date];
    if (dayData?.events) {
      const filtered = dayData.events.filter((e: any) => e.id !== eventId);
      await calendarRef.update({
        [`days.${date}.events`]: filtered,
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
    return NextResponse.json({ success: true, date, eventId });
  }

  if (body.action === 'update_event') {
    const { date, event } = body;
    const snap = await calendarRef.get();
    const days = snap.data()?.days || {};
    const dayData = days[date];
    if (dayData?.events) {
      const updated = dayData.events.map((e: any) => e.id === event.id ? event : e);
      await calendarRef.update({
        [`days.${date}.events`]: updated,
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
    return NextResponse.json({ success: true, date, eventId: event.id });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}

/**
 * GET /api/calendar?year=2026
 * Fetch calendar for a given year (read-only, any company member).
 */
export async function GET(request: NextRequest) {
  const token = getBearerToken(request);
  if (!token) {
    return NextResponse.json({ error: 'Missing Authorization bearer token' }, { status: 401 });
  }

  const adminAuth = getFirebaseAdminAuth();
  const db = getFirebaseAdminFirestore();

  let decoded: { uid: string; companyId?: string; role?: string };
  try {
    decoded = (await adminAuth.verifyIdToken(token)) as {
      uid: string;
      companyId?: string;
      role?: string;
    };
  } catch {
    return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
  }

  const rateLimited = await checkRateLimit(decoded.uid, '/api/calendar/get', {
    limit: 120,
    windowSeconds: 60,
  });
  if (rateLimited) return rateLimited;

  let companyId = decoded.companyId;
  if (!companyId) {
    const ownedSnap = await db
      .collection('companies')
      .where('ownerId', '==', decoded.uid)
      .limit(1)
      .get();
    if (!ownedSnap.empty) companyId = ownedSnap.docs[0].id;
  }
  if (!companyId) {
    return NextResponse.json({ error: 'Байгууллага олдсонгүй.' }, { status: 404 });
  }

  const yearParam = request.nextUrl.searchParams.get('year');
  const year = yearParam ? parseInt(yearParam, 10) : new Date().getFullYear();
  if (isNaN(year) || year < 2020 || year > 2050) {
    return NextResponse.json({ error: 'Он буруу байна.' }, { status: 400 });
  }

  const snap = await db
    .doc(`companies/${companyId}/workCalendars/${calendarDocId(year)}`)
    .get();

  if (!snap.exists) {
    return NextResponse.json({ calendar: null });
  }

  return NextResponse.json({ calendar: { id: snap.id, ...snap.data() } });
}
