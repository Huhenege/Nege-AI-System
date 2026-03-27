'use client';

import * as React from 'react';
import { format, eachDayOfInterval, startOfYear, endOfYear, getMonth, getDay } from 'date-fns';
import { PageHeader } from '@/components/patterns/page-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';

import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { CalendarDays, ListChecks } from 'lucide-react';

import {
  CalendarStatsDashboard,
  CalendarLegend,
  YearCalendarView,
  DayTypeDialog,
  CalendarTypeSelector,
  CalendarEventsList,
} from './components';

import {
  WorkCalendar,
  CalendarDay,
  CalendarStats,
  DayType,
  MonthlyStats,
  QuarterlyStats,
} from './types';

// ─── Constants ────────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  '1-р сар', '2-р сар', '3-р сар', '4-р сар', '5-р сар', '6-р сар',
  '7-р сар', '8-р сар', '9-р сар', '10-р сар', '11-р сар', '12-р сар',
];
const QUARTER_NAMES = ['I улирал', 'II улирал', 'III улирал', 'IV улирал'];

// ─── API helper ───────────────────────────────────────────────────────────────

async function calendarApi(
  idToken: string,
  body: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const res = await fetch('/api/calendar', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Calendar API алдаа');
  return data as Record<string, unknown>;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CalendarPage() {
  const auth = useAuth();
  const { toast } = useToast();

  const [selectedYear, setSelectedYear] = React.useState(() => new Date().getFullYear());
  const [selectedDate, setSelectedDate] = React.useState<Date | null>(null);
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [workCalendar, setWorkCalendar] = React.useState<WorkCalendar | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);

  // ── Get fresh ID token ──────────────────────────────────────────────────
  const getToken = React.useCallback(async () => {
    const user = auth.currentUser;
    if (!user) throw new Error('Нэвтрээгүй байна.');
    return user.getIdToken();
  }, [auth]);

  // ── Load / init calendar for selectedYear ───────────────────────────────
  React.useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      try {
        const token = await getToken();
        const data = await calendarApi(token, { action: 'init', year: selectedYear });
        if (!cancelled) {
          setWorkCalendar(data.calendar as WorkCalendar);
          if (data.created) {
            toast({
              title: `${selectedYear} оны календар үүсгэгдлээ`,
              description: 'Ажлын календар амжилттай үүсгэгдлээ.',
            });
          }
        }
      } catch (err) {
        if (!cancelled) {
          toast({
            title: 'Алдаа гарлаа',
            description: err instanceof Error ? err.message : 'Календар ачаалахад алдаа гарлаа.',
            variant: 'destructive',
          });
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [selectedYear, getToken, toast]);

  // ── Recurring holidays memo ─────────────────────────────────────────────
  const recurringHolidays = React.useMemo(() => {
    const holidays = new Map<string, CalendarDay>();
    if (workCalendar?.days) {
      Object.values(workCalendar.days).forEach((day) => {
        if (day.isRecurring && (day.dayType === 'public_holiday' || day.dayType === 'company_holiday')) {
          const [, monthStr, dayStr] = day.date.split('-');
          holidays.set(`${monthStr}-${dayStr}`, day);
        }
      });
    }
    return holidays;
  }, [workCalendar?.days]);

  // ── Stats ───────────────────────────────────────────────────────────────
  const stats = React.useMemo((): CalendarStats | null => {
    if (!workCalendar) return null;

    const yearStart = startOfYear(new Date(selectedYear, 0, 1));
    const yearEnd = endOfYear(new Date(selectedYear, 0, 1));
    const allDays = eachDayOfInterval({ start: yearStart, end: yearEnd });

    const workingHoursPerDay = workCalendar.workingTimeRules?.standardWorkingHoursPerDay || 8;
    const halfDayHours = workCalendar.workingTimeRules?.halfDayHours || 4;

    let workingDays = 0, weekendDays = 0, publicHolidaysCount = 0,
      companyHolidays = 0, specialWorkingDays = 0, halfDays = 0, totalWorkingHours = 0;

    const monthly: MonthlyStats[] = MONTH_NAMES.map((name, i) => ({
      month: i + 1, monthName: name, totalDays: 0, workingDays: 0,
      weekendDays: 0, publicHolidays: 0, companyHolidays: 0,
      specialWorkingDays: 0, halfDays: 0, totalWorkingHours: 0,
    }));

    allDays.forEach((date) => {
      const dateStr = format(date, 'yyyy-MM-dd');
      const monthDay = format(date, 'MM-dd');
      const dayOfWeek = getDay(date);
      const monthIndex = getMonth(date);
      const dayData = workCalendar.days?.[dateStr];

      let dayType: DayType;
      if (dayData?.dayType) {
        dayType = dayData.dayType;
      } else if (recurringHolidays.has(monthDay)) {
        dayType = recurringHolidays.get(monthDay)!.dayType;
      } else if (workCalendar.weekendDays.includes(dayOfWeek)) {
        dayType = 'weekend';
      } else {
        dayType = 'working';
      }

      monthly[monthIndex].totalDays++;

      switch (dayType) {
        case 'working':
          workingDays++;
          monthly[monthIndex].workingDays++;
          { const h = dayData?.workingHours ?? workingHoursPerDay;
            totalWorkingHours += h;
            monthly[monthIndex].totalWorkingHours += h; }
          break;
        case 'weekend':
          weekendDays++;
          monthly[monthIndex].weekendDays++;
          break;
        case 'public_holiday':
          publicHolidaysCount++;
          monthly[monthIndex].publicHolidays++;
          break;
        case 'company_holiday':
          companyHolidays++;
          monthly[monthIndex].companyHolidays++;
          break;
        case 'special_working':
          specialWorkingDays++;
          workingDays++;
          monthly[monthIndex].specialWorkingDays++;
          monthly[monthIndex].workingDays++;
          { const h = dayData?.workingHours ?? workingHoursPerDay;
            totalWorkingHours += h;
            monthly[monthIndex].totalWorkingHours += h; }
          break;
        case 'half_day':
          halfDays++;
          workingDays++;
          monthly[monthIndex].halfDays++;
          monthly[monthIndex].workingDays++;
          { const h = dayData?.workingHours ?? halfDayHours;
            totalWorkingHours += h;
            monthly[monthIndex].totalWorkingHours += h; }
          break;
      }
    });

    const quarterly: QuarterlyStats[] = QUARTER_NAMES.map((name, i) => {
      const q = monthly.slice(i * 3, i * 3 + 3);
      return {
        quarter: i + 1, quarterName: name,
        totalDays: q.reduce((s, m) => s + m.totalDays, 0),
        workingDays: q.reduce((s, m) => s + m.workingDays, 0),
        weekendDays: q.reduce((s, m) => s + m.weekendDays, 0),
        publicHolidays: q.reduce((s, m) => s + m.publicHolidays, 0),
        companyHolidays: q.reduce((s, m) => s + m.companyHolidays, 0),
        totalWorkingHours: q.reduce((s, m) => s + m.totalWorkingHours, 0),
      };
    });

    return {
      totalDays: allDays.length, workingDays, weekendDays,
      publicHolidays: publicHolidaysCount, companyHolidays,
      specialWorkingDays, halfDays, totalWorkingHours,
      monthly, quarterly,
      firstHalf: {
        workingDays: monthly.slice(0, 6).reduce((s, m) => s + m.workingDays, 0),
        totalWorkingHours: monthly.slice(0, 6).reduce((s, m) => s + m.totalWorkingHours, 0),
      },
      secondHalf: {
        workingDays: monthly.slice(6).reduce((s, m) => s + m.workingDays, 0),
        totalWorkingHours: monthly.slice(6).reduce((s, m) => s + m.totalWorkingHours, 0),
      },
    };
  }, [workCalendar, selectedYear, recurringHolidays]);

  // ── Day click ───────────────────────────────────────────────────────────
  const handleDayClick = (date: Date) => {
    setSelectedDate(date);
    setIsDialogOpen(true);
  };

  // ── Save day ────────────────────────────────────────────────────────────
  const handleDaySave = async (date: Date, data: Partial<CalendarDay>) => {
    if (!workCalendar) return;
    const dateStr = format(date, 'yyyy-MM-dd');

    const dayPayload: CalendarDay = {
      date: dateStr,
      dayType: data.dayType || 'working',
      ...(data.holidayName !== undefined && { holidayName: data.holidayName }),
      ...(data.holidayType !== undefined && { holidayType: data.holidayType }),
      ...(data.workingHours !== undefined && { workingHours: data.workingHours }),
      ...(data.isPaid !== undefined && { isPaid: data.isPaid }),
      ...(data.isRecurring !== undefined && { isRecurring: data.isRecurring }),
      ...(data.legalReference !== undefined && { legalReference: data.legalReference }),
      ...(data.note !== undefined && { note: data.note }),
    };

    // Optimistic update — update local state immediately
    setWorkCalendar(prev => prev ? {
      ...prev,
      days: { ...prev.days, [dateStr]: dayPayload },
      updatedAt: new Date().toISOString(),
    } : null);

    setIsSaving(true);
    try {
      const token = await getToken();
      await calendarApi(token, {
        action: 'upsert_day',
        year: selectedYear,
        day: dayPayload,
      });
      toast({
        title: 'Амжилттай хадгалагдлаа',
        description: `${format(date, 'yyyy-MM-dd')} өдрийн тохиргоо шинэчлэгдлээ.`,
      });
    } catch (err) {
      // Rollback optimistic update
      setWorkCalendar(prev => {
        if (!prev) return null;
        const newDays = { ...prev.days };
        delete newDays[dateStr];
        return { ...prev, days: newDays };
      });
      toast({
        title: 'Алдаа гарлаа',
        description: err instanceof Error ? err.message : 'Өдрийн тохиргоог хадгалахад алдаа гарлаа.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // ── Delete day ──────────────────────────────────────────────────────────
  const handleDayDelete = async (date: Date) => {
    if (!workCalendar) return;
    const dateStr = format(date, 'yyyy-MM-dd');
    const previousDayData = workCalendar.days?.[dateStr];

    // Optimistic update
    setWorkCalendar(prev => {
      if (!prev) return null;
      const newDays = { ...prev.days };
      delete newDays[dateStr];
      return { ...prev, days: newDays, updatedAt: new Date().toISOString() };
    });

    setIsSaving(true);
    try {
      const token = await getToken();
      await calendarApi(token, {
        action: 'delete_day',
        year: selectedYear,
        date: dateStr,
      });
      toast({
        title: 'Амжилттай устгагдлаа',
        description: `${format(date, 'yyyy-MM-dd')} өдрийн тохиргоо устгагдлаа.`,
      });
    } catch (err) {
      // Rollback
      if (previousDayData) {
        setWorkCalendar(prev => prev
          ? { ...prev, days: { ...prev.days, [dateStr]: previousDayData } }
          : null
        );
      }
      toast({
        title: 'Алдаа гарлаа',
        description: err instanceof Error ? err.message : 'Устгахад алдаа гарлаа.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // ── Move day ────────────────────────────────────────────────────────────
  const handleDayMove = async (fromDate: Date, toDate: Date, data: Partial<CalendarDay>) => {
    if (!workCalendar) return;
    const fromDateStr = format(fromDate, 'yyyy-MM-dd');
    const toDateStr = format(toDate, 'yyyy-MM-dd');
    const previousFromData = workCalendar.days?.[fromDateStr];
    const previousToData = workCalendar.days?.[toDateStr];

    const newDayData: CalendarDay = {
      date: toDateStr,
      dayType: data.dayType || 'working',
      ...(data.holidayName !== undefined && { holidayName: data.holidayName }),
      ...(data.holidayType !== undefined && { holidayType: data.holidayType }),
      ...(data.workingHours !== undefined && { workingHours: data.workingHours }),
      ...(data.isPaid !== undefined && { isPaid: data.isPaid }),
      ...(data.isRecurring !== undefined && { isRecurring: data.isRecurring }),
      ...(data.legalReference !== undefined && { legalReference: data.legalReference }),
      ...(data.note !== undefined && { note: data.note }),
    };

    // Optimistic update
    setWorkCalendar(prev => {
      if (!prev) return null;
      const newDays = { ...prev.days };
      delete newDays[fromDateStr];
      newDays[toDateStr] = newDayData;
      return { ...prev, days: newDays, updatedAt: new Date().toISOString() };
    });

    setIsSaving(true);
    try {
      const token = await getToken();
      await calendarApi(token, {
        action: 'move_day',
        year: selectedYear,
        fromDate: fromDateStr,
        toDate: toDateStr,
        day: newDayData,
      });
      toast({
        title: 'Амжилттай шилжүүлэгдлээ',
        description: `${format(fromDate, 'MM-dd')} → ${format(toDate, 'MM-dd')} руу шилжүүлэгдлээ.`,
      });
    } catch (err) {
      // Rollback
      setWorkCalendar(prev => {
        if (!prev) return null;
        const newDays = { ...prev.days };
        delete newDays[toDateStr];
        if (previousFromData) newDays[fromDateStr] = previousFromData;
        if (previousToData) newDays[toDateStr] = previousToData;
        return { ...prev, days: newDays };
      });
      toast({
        title: 'Алдаа гарлаа',
        description: err instanceof Error ? err.message : 'Шилжүүлэхэд алдаа гарлаа.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // ── Add event ──────────────────────────────────────────────────────────
  const handleAddEvent = async (date: string, event: { id: string; title: string; type: string; description?: string; isRecurring?: boolean }) => {
    if (!workCalendar) return;
    setWorkCalendar(prev => {
      if (!prev) return null;
      const day = prev.days?.[date] || { date, dayType: 'working' as const };
      const events = [...(day.events || []), event as any];
      return { ...prev, days: { ...prev.days, [date]: { ...day, events } } };
    });
    try {
      const token = await getToken();
      await calendarApi(token, { action: 'add_event', year: selectedYear, date, event });
      toast({ title: 'Үйл явдал нэмэгдлээ', description: event.title });
    } catch (err) {
      setWorkCalendar(prev => {
        if (!prev) return null;
        const day = prev.days?.[date];
        if (!day) return prev;
        const events = (day.events || []).filter((e: any) => e.id !== event.id);
        return { ...prev, days: { ...prev.days, [date]: { ...day, events } } };
      });
      toast({ title: 'Алдаа', description: err instanceof Error ? err.message : 'Нэмэхэд алдаа гарлаа.', variant: 'destructive' });
      throw err;
    }
  };

  // ── Remove event ────────────────────────────────────────────────────────
  const handleRemoveEvent = async (date: string, eventId: string) => {
    if (!workCalendar) return;
    const prevEvents = workCalendar.days?.[date]?.events || [];
    setWorkCalendar(prev => {
      if (!prev) return null;
      const day = prev.days?.[date];
      if (!day) return prev;
      const events = (day.events || []).filter((e: any) => e.id !== eventId);
      return { ...prev, days: { ...prev.days, [date]: { ...day, events } } };
    });
    try {
      const token = await getToken();
      await calendarApi(token, { action: 'remove_event', year: selectedYear, date, eventId });
      toast({ title: 'Үйл явдал устгагдлаа' });
    } catch (err) {
      setWorkCalendar(prev => {
        if (!prev) return null;
        const day = prev.days?.[date] || { date, dayType: 'working' as const };
        return { ...prev, days: { ...prev.days, [date]: { ...day, events: prevEvents } } };
      });
      toast({ title: 'Алдаа', description: err instanceof Error ? err.message : 'Устгахад алдаа гарлаа.', variant: 'destructive' });
    }
  };

  // ── Update event ──────────────────────────────────────────────────────
  const handleUpdateEvent = async (date: string, event: { id: string; title: string; type: string; description?: string; isRecurring?: boolean }) => {
    if (!workCalendar) return;
    const prevEvents = workCalendar.days?.[date]?.events || [];
    setWorkCalendar(prev => {
      if (!prev) return null;
      const day = prev.days?.[date];
      if (!day) return prev;
      const events = (day.events || []).map((e: any) => e.id === event.id ? event : e);
      return { ...prev, days: { ...prev.days, [date]: { ...day, events } } };
    });
    try {
      const token = await getToken();
      await calendarApi(token, { action: 'update_event', year: selectedYear, date, event });
      toast({ title: 'Үйл явдал шинэчлэгдлээ', description: event.title });
    } catch (err) {
      setWorkCalendar(prev => {
        if (!prev) return null;
        const day = prev.days?.[date] || { date, dayType: 'working' as const };
        return { ...prev, days: { ...prev.days, [date]: { ...day, events: prevEvents } } };
      });
      toast({ title: 'Алдаа', description: err instanceof Error ? err.message : 'Шинэчлэхэд алдаа гарлаа.', variant: 'destructive' });
    }
  };

  // ── Selected day data — always read from latest workCalendar state ───────
  // (Fix: derive from workCalendar.days directly, not from a stale memo)
  const selectedDayData = React.useMemo(() => {
    if (!selectedDate || !workCalendar) return undefined;
    return workCalendar.days?.[format(selectedDate, 'yyyy-MM-dd')];
  }, [selectedDate, workCalendar]);

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full w-full py-6 px-page">
      <div className="shrink-0 pb-6">
        <PageHeader
          title="Нэгдсэн календар"
          description="Ажлын хуваарь, баярын өдрүүд, нэгтгэл статистик"
          showBackButton={true}
          hideBreadcrumbs={true}
          backButtonPlacement="inline"
          backBehavior="history"
          fallbackBackHref="/dashboard"
        />
      </div>

      <Tabs defaultValue="calendar" className="flex-1 flex flex-col min-h-0">
        <TabsList className="shrink-0 mb-4 w-fit">
          <TabsTrigger value="calendar" className="gap-1.5">
            <CalendarDays className="h-4 w-4" />
            Нэгдсэн календар
          </TabsTrigger>
          <TabsTrigger value="events" className="gap-1.5">
            <ListChecks className="h-4 w-4" />
            Үйл явдал
          </TabsTrigger>
        </TabsList>

        {/* ── Нэгдсэн календар таб ──────────────────────────────────────── */}
        <TabsContent value="calendar" className="flex-1 overflow-auto space-y-6 pb-page mt-0">
          <CalendarTypeSelector
            calendar={workCalendar}
            selectedYear={selectedYear}
            onYearChange={setSelectedYear}
            isLoading={isLoading}
          />

          {(workCalendar || isLoading) && (
            <CalendarStatsDashboard
              stats={stats}
              isLoading={isLoading}
              year={selectedYear}
            />
          )}

          {workCalendar && (
            <Card>
              <CardHeader className="py-3">
                <CardTitle className="text-sm font-medium">Тэмдэглэгээ</CardTitle>
              </CardHeader>
              <CardContent className="pt-0 pb-4">
                <CalendarLegend />
              </CardContent>
            </Card>
          )}

          {workCalendar && (
            <YearCalendarView
              year={selectedYear}
              calendar={workCalendar}
              onDayClick={handleDayClick}
              selectedDate={selectedDate}
            />
          )}

          {isLoading && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {Array.from({ length: 12 }).map((_, i) => (
                <Card key={i}>
                  <CardContent className="p-4">
                    <Skeleton className="h-4 w-20 mx-auto mb-4" />
                    <div className="space-y-2">
                      {Array.from({ length: 6 }).map((_, j) => (
                        <Skeleton key={j} className="h-6 w-full" />
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── Үйл явдал таб ─────────────────────────────────────────────── */}
        <TabsContent value="events" className="flex-1 overflow-auto pb-page mt-0">
          <CalendarEventsList
            calendar={workCalendar}
            isLoading={isLoading}
            selectedYear={selectedYear}
            onAddEvent={handleAddEvent}
            onRemoveEvent={handleRemoveEvent}
            onUpdateEvent={handleUpdateEvent}
          />
        </TabsContent>
      </Tabs>

      {/* Өдрийн тохиргооны диалог */}
      <DayTypeDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        date={selectedDate}
        key={selectedDate
          ? `${format(selectedDate, 'yyyy-MM-dd')}-${workCalendar?.days?.[format(selectedDate, 'yyyy-MM-dd')]?.events?.length ?? 0}`
          : 'none'}
        dayData={selectedDayData}
        onSave={handleDaySave}
        onDelete={handleDayDelete}
        onMove={handleDayMove}
        defaultWorkingHours={workCalendar?.workingTimeRules?.standardWorkingHoursPerDay ?? 8}
        halfDayHours={workCalendar?.workingTimeRules?.halfDayHours ?? 4}
      />
    </div>
  );
}
