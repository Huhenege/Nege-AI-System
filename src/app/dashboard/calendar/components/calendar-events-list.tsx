'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { format, parse, isBefore, isToday, startOfDay } from 'date-fns';
import { mn } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AppConfirmDialog,
  AppDialog,
  AppDialogContent,
  AppDialogHeader,
  AppDialogTitle,
  AppDialogDescription,
  AppDialogFooter,
} from '@/components/patterns';
import { AddActionButton } from '@/components/ui/add-action-button';
import {
  Calendar as CalendarIcon,
  Search,
  Filter,
  Clock,
  MapPin,
  ChevronRight,
  Star,
  Cake,
  GraduationCap,
  Users,
  Flag,
  Building2,
  Zap,
  SunMedium,
  Plus,
  Pencil,
  Trash2,
  ListChecks,
  Megaphone,
  DoorOpen,
} from 'lucide-react';

import {
  WorkCalendar,
  CalendarEvent,
  DayType,
  EventType,
  getDayTypeConfig,
  getEventTypeConfig,
  EVENT_TYPE_CONFIGS,
} from '../types';

// ── Types ────────────────────────────────────────────────────────────────────

interface FlatEvent {
  date: string;
  parsedDate: Date;
  dayType: DayType;
  holidayName?: string;
  note?: string;
  event: CalendarEvent;
}

interface CalendarEventsListProps {
  calendar: WorkCalendar | null;
  isLoading: boolean;
  selectedYear: number;
  onAddEvent: (date: string, event: CalendarEvent) => Promise<void>;
  onRemoveEvent: (date: string, eventId: string) => Promise<void>;
  onUpdateEvent: (date: string, event: CalendarEvent) => Promise<void>;
}

// ── Constants ────────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  'Бүгд', '1-р сар', '2-р сар', '3-р сар', '4-р сар', '5-р сар', '6-р сар',
  '7-р сар', '8-р сар', '9-р сар', '10-р сар', '11-р сар', '12-р сар',
];

const EVENT_TYPE_FILTERS = [
  { value: 'all', label: 'Бүгд' },
  ...EVENT_TYPE_CONFIGS.map((c) => ({ value: c.type, label: `${c.icon} ${c.label}` })),
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function getEventIcon(type: EventType) {
  switch (type) {
    case 'meeting': return <Users className="h-4 w-4" />;
    case 'deadline': return <Clock className="h-4 w-4" />;
    case 'birthday': return <Cake className="h-4 w-4" />;
    case 'anniversary': return <Star className="h-4 w-4" />;
    case 'training': return <GraduationCap className="h-4 w-4" />;
    default: return <MapPin className="h-4 w-4" />;
  }
}

// ── Component ────────────────────────────────────────────────────────────────

export function CalendarEventsList({
  calendar,
  isLoading,
  selectedYear,
  onAddEvent,
  onRemoveEvent,
  onUpdateEvent,
}: CalendarEventsListProps) {
  const router = useRouter();
  const [search, setSearch] = React.useState('');
  const [monthFilter, setMonthFilter] = React.useState('0');
  const [typeFilter, setTypeFilter] = React.useState('all');
  const [isAddOpen, setIsAddOpen] = React.useState(false);
  const [editingEvent, setEditingEvent] = React.useState<FlatEvent | null>(null);

  const handleBookRoom = React.useCallback((item: FlatEvent) => {
    const params = new URLSearchParams({
      book: '1',
      title: item.event.title,
      date: item.date,
      description: item.event.description || '',
    });
    router.push(`/dashboard/meetings?${params.toString()}`);
  }, [router]);

  const handleCreatePostFromEvent = React.useCallback((item: FlatEvent) => {
    const params = new URLSearchParams({
      draft: '1',
      title: item.event.title,
      content: item.event.description || '',
      date: format(item.parsedDate, 'yyyy.MM.dd'),
    });
    window.open(`/dashboard/posts/add?${params.toString()}`, '_blank');
  }, []);

  // ── Flatten events ─────────────────────────────────────────────────
  const allEvents = React.useMemo((): FlatEvent[] => {
    if (!calendar?.days) return [];
    const items: FlatEvent[] = [];

    Object.entries(calendar.days).forEach(([dateStr, day]) => {
      if (!day.events || day.events.length === 0) return;
      const parsedDate = parse(dateStr, 'yyyy-MM-dd', new Date());

      day.events.forEach((ev) => {
        items.push({
          date: dateStr,
          parsedDate,
          dayType: day.dayType,
          holidayName: day.holidayName,
          note: day.note,
          event: ev,
        });
      });
    });

    items.sort((a, b) => a.date.localeCompare(b.date));
    return items;
  }, [calendar?.days]);

  // ── Filter ─────────────────────────────────────────────────────────
  const filtered = React.useMemo(() => {
    let result = allEvents;

    if (monthFilter !== '0') {
      const m = parseInt(monthFilter, 10);
      result = result.filter((e) => e.parsedDate.getMonth() + 1 === m);
    }

    if (typeFilter !== 'all') {
      result = result.filter((e) => e.event.type === typeFilter);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((e) => {
        const title = e.event.title;
        const desc = e.event.description || '';
        return title.toLowerCase().includes(q) || desc.toLowerCase().includes(q);
      });
    }

    return result;
  }, [allEvents, monthFilter, typeFilter, search]);

  // ── Group by month ─────────────────────────────────────────────────
  const grouped = React.useMemo(() => {
    const groups = new Map<string, FlatEvent[]>();
    filtered.forEach((e) => {
      const key = format(e.parsedDate, 'yyyy-MM');
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(e);
    });
    return groups;
  }, [filtered]);

  // ── Loading ────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4 space-y-3">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!calendar) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <CalendarIcon className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">Календар ачаалагдаагүй байна.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* ── Header + Filters ──────────────────────────────────────── */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[180px] max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Хайх..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
            <Select value={monthFilter} onValueChange={setMonthFilter}>
              <SelectTrigger className="w-[120px] h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTH_NAMES.map((name, i) => (
                  <SelectItem key={i} value={String(i)}>{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[140px] h-9">
                <Filter className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EVENT_TYPE_FILTERS.map((f) => (
                  <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <AddActionButton
              label="Үйл явдал нэмэх"
              description="Шинэ үйл явдал бүртгэх"
              onClick={() => setIsAddOpen(true)}
              className="ml-auto"
            />
          </div>
        </CardContent>
      </Card>

      {/* ── Stats summary ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Нийт', count: allEvents.length, color: 'text-foreground' },
          { label: 'Уулзалт', count: allEvents.filter((e) => e.event.type === 'meeting').length, color: 'text-blue-600' },
          { label: 'Төрсөн өдөр', count: allEvents.filter((e) => e.event.type === 'birthday').length, color: 'text-pink-600' },
          { label: 'Сургалт', count: allEvents.filter((e) => e.event.type === 'training').length, color: 'text-green-600' },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="p-3 text-center">
              <p className={`text-xl font-bold ${s.color}`}>{s.count}</p>
              <p className="text-[11px] text-muted-foreground">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Event list ────────────────────────────────────────────── */}
      {grouped.size === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <ListChecks className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground text-sm">
              {search || typeFilter !== 'all' || monthFilter !== '0'
                ? 'Хайлтад тохирох үйл явдал олдсонгүй.'
                : `${selectedYear} онд үйл явдал бүртгэгдээгүй байна.`}
            </p>
            <AddActionButton
              label="Үйл явдал нэмэх"
              description="Шинэ үйл явдал бүртгэх"
              onClick={() => setIsAddOpen(true)}
              className="mt-4"
            />
          </CardContent>
        </Card>
      )}

      {Array.from(grouped.entries()).map(([monthKey, events]) => {
        const monthDate = parse(monthKey, 'yyyy-MM', new Date());
        const monthLabel = format(monthDate, 'yyyy оны M-р сар');

        return (
          <Card key={monthKey}>
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <CalendarIcon className="h-4 w-4 text-primary" />
                {monthLabel}
                <Badge variant="secondary" className="ml-auto text-xs font-normal">
                  {events.length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3 pt-0">
              <div className="divide-y divide-border">
                {events.map((item, idx) => (
                  <EventRow
                    key={`${item.date}-${item.event.id}-${idx}`}
                    item={item}
                    onCreatePost={() => handleCreatePostFromEvent(item)}
                    onBookRoom={() => handleBookRoom(item)}
                    onEdit={() => setEditingEvent(item)}
                    onRemove={() => onRemoveEvent(item.date, item.event.id)}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        );
      })}

      {/* ── Add event dialog ──────────────────────────────────────── */}
      <AddEventDialog
        open={isAddOpen}
        onOpenChange={setIsAddOpen}
        selectedYear={selectedYear}
        onAdd={onAddEvent}
        onBookRoom={(date, title, description) => {
          const params = new URLSearchParams({ book: '1', title, date, description });
          router.push(`/dashboard/meetings?${params.toString()}`);
        }}
      />

      {/* ── Edit event dialog ─────────────────────────────────────── */}
      <EditEventDialog
        open={!!editingEvent}
        onOpenChange={(v) => { if (!v) setEditingEvent(null); }}
        item={editingEvent}
        onUpdate={onUpdateEvent}
      />
    </div>
  );
}

// ── Event row ────────────────────────────────────────────────────────────────

function EventRow({ item, onEdit, onRemove, onCreatePost, onBookRoom }: { item: FlatEvent; onEdit: () => void; onRemove: () => void; onCreatePost: () => void; onBookRoom: () => void }) {
  const config = getEventTypeConfig(item.event.type);
  const today = isToday(item.parsedDate);
  const past = isBefore(startOfDay(item.parsedDate), startOfDay(new Date()));

  const badgeColor = {
    meeting: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    deadline: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
    birthday: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300',
    anniversary: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
    training: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
    other: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  }[item.event.type] || 'bg-gray-100 text-gray-700';

  return (
    <div className={`flex items-center gap-3 py-2.5 px-2 -mx-2 rounded-lg group ${past && !today ? 'opacity-60' : ''}`}>
      {/* Date */}
      <div className={`shrink-0 w-12 h-12 rounded-xl flex flex-col items-center justify-center ${today ? 'bg-primary text-primary-foreground' : 'bg-muted/60'}`}>
        <span className={`text-[10px] leading-none font-medium ${today ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
          {format(item.parsedDate, 'EEE', { locale: mn })}
        </span>
        <span className={`text-base font-bold leading-tight ${today ? '' : 'text-foreground'}`}>
          {format(item.parsedDate, 'd')}
        </span>
      </div>

      {/* Icon */}
      <div className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${badgeColor}`}>
        {getEventIcon(item.event.type)}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium truncate">{item.event.title}</span>
          {item.event.isRecurring && (
            <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">Давтагдах</Badge>
          )}
        </div>
        {item.event.description && (
          <p className="text-xs text-muted-foreground truncate mt-0.5">{item.event.description}</p>
        )}
      </div>

      {/* Badge + edit + delete */}
      <Badge variant="secondary" className={`shrink-0 text-[10px] font-normal ${badgeColor} border-0`}>
        {config.label}
      </Badge>
      <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-amber-600" onClick={onCreatePost} title="Мэдээлэл хүргэх">
        <Megaphone className="h-3.5 w-3.5" />
      </Button>
      <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-indigo-600" onClick={onBookRoom} title="Өрөө захиалах">
        <DoorOpen className="h-3.5 w-3.5" />
      </Button>
      <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-primary" onClick={onEdit}>
        <Pencil className="h-3.5 w-3.5" />
      </Button>
      <AppConfirmDialog
        title="Үйл явдал устгах уу?"
        description={`"${item.event.title}" үйл явдлыг устгах гэж байна.`}
        confirmLabel="Устгах"
        cancelLabel="Цуцлах"
        onConfirm={onRemove}
        trigger={
          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        }
      />
    </div>
  );
}

// ── Add event dialog ─────────────────────────────────────────────────────────

function AddEventDialog({
  open,
  onOpenChange,
  selectedYear,
  onAdd,
  onBookRoom,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  selectedYear: number;
  onAdd: (date: string, event: CalendarEvent) => Promise<void>;
  onBookRoom: (date: string, title: string, description: string) => void;
}) {
  const [title, setTitle] = React.useState('');
  const [type, setType] = React.useState<EventType>('other');
  const [description, setDescription] = React.useState('');
  const [isRecurring, setIsRecurring] = React.useState(false);
  const [date, setDate] = React.useState<Date | undefined>(undefined);
  const [datePickerOpen, setDatePickerOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [creatingPost, setCreatingPost] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setTitle('');
      setType('other');
      setDescription('');
      setIsRecurring(false);
      setDate(undefined);
      setSaving(false);
      setCreatingPost(false);
    }
  }, [open]);

  const buildEvent = (): CalendarEvent => ({
    id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    title: title.trim(),
    type,
    description: description.trim() || undefined,
    isRecurring,
  });

  const handleSave = async () => {
    if (!title.trim() || !date) return;
    setSaving(true);
    try {
      await onAdd(format(date, 'yyyy-MM-dd'), buildEvent());
      onOpenChange(false);
    } catch {
      // toast shown by parent; dialog stays open so user can retry
    } finally {
      setSaving(false);
    }
  };

  const handleCreatePostDraft = async () => {
    if (!title.trim() || !date) return;
    setCreatingPost(true);
    try {
      await onAdd(format(date, 'yyyy-MM-dd'), buildEvent());
    } catch {
      setCreatingPost(false);
      return;
    }

    const params = new URLSearchParams({
      draft: '1',
      title: title.trim(),
      content: description.trim() || '',
      date: format(date, 'yyyy.MM.dd'),
    });
    onOpenChange(false);
    setCreatingPost(false);
    window.open(`/dashboard/posts/add?${params.toString()}`, '_blank');
  };

  const handleBookRoom = async () => {
    if (!title.trim() || !date) return;
    setSaving(true);
    try {
      await onAdd(format(date, 'yyyy-MM-dd'), buildEvent());
    } catch {
      setSaving(false);
      return;
    }
    onOpenChange(false);
    setSaving(false);
    onBookRoom(format(date, 'yyyy-MM-dd'), title.trim(), description.trim());
  };

  return (
    <AppDialog open={open} onOpenChange={onOpenChange}>
      <AppDialogContent size="sm" className="sm:max-w-md p-0">
        <div className="px-6 pt-6 pb-2">
          <AppDialogHeader>
            <AppDialogTitle>Үйл явдал нэмэх</AppDialogTitle>
            <AppDialogDescription>{selectedYear} оны календарт үйл явдал нэмэх</AppDialogDescription>
          </AppDialogHeader>
        </div>

        <div className="space-y-4 px-6 py-4">
          <div className="space-y-2">
            <Label>Огноо</Label>
            <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start text-left font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? format(date, 'yyyy оны MMMM d, EEEE', { locale: mn }) : 'Огноо сонгох'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={(d) => { setDate(d); setDatePickerOpen(false); }}
                  defaultMonth={new Date(selectedYear, new Date().getMonth())}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label htmlFor="evt-title">Үйл явдлын нэр</Label>
            <Input
              id="evt-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Жишээ: Багийн уулзалт"
            />
          </div>

          <div className="space-y-2">
            <Label>Төрөл</Label>
            <Select value={type} onValueChange={(v) => setType(v as EventType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EVENT_TYPE_CONFIGS.map((c) => (
                  <SelectItem key={c.type} value={c.type}>
                    <span>{c.icon} {c.label}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="evt-desc">Тайлбар (заавал биш)</Label>
            <Input
              id="evt-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Нэмэлт тайлбар"
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="evt-recurring">Жил бүр давтагддаг</Label>
            <Switch id="evt-recurring" checked={isRecurring} onCheckedChange={setIsRecurring} />
          </div>
        </div>

        <AppDialogFooter className="flex-col sm:flex-row gap-2">
          <div className="flex gap-2 sm:mr-auto">
            <Button
              variant="outline"
              className="gap-1.5"
              onClick={handleCreatePostDraft}
              disabled={!title.trim() || !date || saving || creatingPost}
            >
              <Megaphone className="h-4 w-4" />
              {creatingPost ? 'Үүсгэж байна...' : 'Мэдээлэл хүргэх'}
            </Button>
            <Button
              variant="outline"
              className="gap-1.5"
              onClick={handleBookRoom}
              disabled={!title.trim() || !date || saving || creatingPost}
            >
              <DoorOpen className="h-4 w-4" />
              Өрөө захиалах
            </Button>
          </div>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Цуцлах</Button>
          <Button onClick={handleSave} disabled={!title.trim() || !date || saving || creatingPost}>
            {saving ? 'Хадгалж байна...' : 'Нэмэх'}
          </Button>
        </AppDialogFooter>
      </AppDialogContent>
    </AppDialog>
  );
}

// ── Edit event dialog ────────────────────────────────────────────────────────

function EditEventDialog({
  open,
  onOpenChange,
  item,
  onUpdate,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  item: FlatEvent | null;
  onUpdate: (date: string, event: CalendarEvent) => Promise<void>;
}) {
  const [title, setTitle] = React.useState('');
  const [type, setType] = React.useState<EventType>('other');
  const [description, setDescription] = React.useState('');
  const [isRecurring, setIsRecurring] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (item) {
      setTitle(item.event.title);
      setType(item.event.type);
      setDescription(item.event.description || '');
      setIsRecurring(item.event.isRecurring || false);
      setSaving(false);
    }
  }, [item]);

  const handleSave = async () => {
    if (!item || !title.trim()) return;
    setSaving(true);
    const updated: CalendarEvent = {
      id: item.event.id,
      title: title.trim(),
      type,
      description: description.trim() || undefined,
      isRecurring,
    };
    try {
      await onUpdate(item.date, updated);
      onOpenChange(false);
    } catch {
      // error handled by parent
    } finally {
      setSaving(false);
    }
  };

  if (!item) return null;

  return (
    <AppDialog open={open} onOpenChange={onOpenChange}>
      <AppDialogContent size="sm" className="sm:max-w-md p-0">
        <div className="px-6 pt-6 pb-2">
          <AppDialogHeader>
            <AppDialogTitle>Үйл явдал засах</AppDialogTitle>
            <AppDialogDescription>
              {format(item.parsedDate, 'yyyy оны MMMM d, EEEE', { locale: mn })}
            </AppDialogDescription>
          </AppDialogHeader>
        </div>

        <div className="space-y-4 px-6 py-4">
          <div className="space-y-2">
            <Label htmlFor="edit-evt-title">Үйл явдлын нэр</Label>
            <Input
              id="edit-evt-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Үйл явдлын нэр"
            />
          </div>

          <div className="space-y-2">
            <Label>Төрөл</Label>
            <Select value={type} onValueChange={(v) => setType(v as EventType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EVENT_TYPE_CONFIGS.map((c) => (
                  <SelectItem key={c.type} value={c.type}>
                    <span>{c.icon} {c.label}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-evt-desc">Тайлбар (заавал биш)</Label>
            <Input
              id="edit-evt-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Нэмэлт тайлбар"
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="edit-evt-recurring">Жил бүр давтагддаг</Label>
            <Switch id="edit-evt-recurring" checked={isRecurring} onCheckedChange={setIsRecurring} />
          </div>
        </div>

        <AppDialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Цуцлах</Button>
          <Button onClick={handleSave} disabled={!title.trim() || saving}>
            {saving ? 'Хадгалж байна...' : 'Хадгалах'}
          </Button>
        </AppDialogFooter>
      </AppDialogContent>
    </AppDialog>
  );
}
