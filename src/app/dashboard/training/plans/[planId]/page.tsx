'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { collection, doc, getDoc, Timestamp } from 'firebase/firestore';
import { useCollection, useFirebase, updateDocumentNonBlocking, addDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase';
import { PageHeader } from '@/components/patterns/page-layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { Send, Trash2, Save, Users, Tag, CalendarDays, ClipboardCheck, BarChart3, Plus, ChevronDown, ChevronRight, Check, X, Clock, ShieldCheck } from 'lucide-react';
import { Employee } from '@/types';
import {
    TrainingPlan,
    TrainingCourse,
    TrainingCategory,
    TrainingSession,
    AttendanceStatus,
    PLAN_STATUSES,
    PLAN_STATUS_LABELS,
    QUARTERS,
    QUARTER_LABELS,
    PLAN_TRIGGERS,
    PLAN_TRIGGER_LABELS,
    PLAN_TYPES,
    PLAN_TYPE_LABELS,
    PLAN_FORMATS,
    PLAN_FORMAT_LABELS,
    ASSESSMENT_METHODS,
    ASSESSMENT_METHOD_LABELS,
    PLAN_PROVIDER_TYPES,
    PLAN_PROVIDER_LABELS,
    ATTENDANCE_STATUSES,
    ATTENDANCE_STATUS_LABELS,
    ATTENDANCE_STATUS_COLORS,
} from '../../types';

type EditablePlan = {
    courseId: string;
    scheduledQuarter: string;
    participantIds: string[];
    categoryIds: string[];
    status: string;
    trigger: string;
    budget?: number;
    purpose?: string;
    planType?: string;
    owner?: string;
    format?: string;
    providerType?: string;
    locationOrLink?: string;
    assessmentMethod?: string;
    notes?: string;
};

export default function TrainingPlanDetailPage() {
    const { planId } = useParams<{ planId: string }>();
    const router = useRouter();
    const { toast } = useToast();
    const { firestore, user } = useFirebase();

    const [loading, setLoading] = useState(true);
    const [plan, setPlan] = useState<TrainingPlan | null>(null);
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState<EditablePlan | null>(null);
    const [publishing, setPublishing] = useState(false);
    const [publishStartDate, setPublishStartDate] = useState('');
    const [publishEndDate, setPublishEndDate] = useState('');

    const [sessions, setSessions] = useState<TrainingSession[]>([]);
    const [expandedSession, setExpandedSession] = useState<number | null>(null);
    const [newSessionDate, setNewSessionDate] = useState('');
    const [newSessionLabel, setNewSessionLabel] = useState('');
    const [savingAttendance, setSavingAttendance] = useState(false);

    const coursesQuery = useMemo(() => (firestore ? collection(firestore, 'training_courses') : null), [firestore]);
    const employeesQuery = useMemo(() => (firestore ? collection(firestore, 'employees') : null), [firestore]);
    const categoriesQuery = useMemo(() => (firestore ? collection(firestore, 'training_categories') : null), [firestore]);

    const { data: courses } = useCollection<TrainingCourse>(coursesQuery);
    const { data: employees } = useCollection<Employee>(employeesQuery);
    const { data: categories } = useCollection<TrainingCategory>(categoriesQuery);

    const quarterToDateRange = (quarter?: string): { start: string; end: string } => {
        const now = new Date();
        const toYmd = (d: Date) => d.toISOString().slice(0, 10);
        if (!quarter) {
            const end = new Date(now);
            end.setDate(end.getDate() + 30);
            return { start: toYmd(now), end: toYmd(end) };
        }
        const [yearStr, q] = quarter.split('-');
        const year = parseInt(yearStr) || now.getFullYear();
        const ranges: Record<string, { start: Date; end: Date }> = {
            Q1: { start: new Date(year, 0, 1), end: new Date(year, 2, 31) },
            Q2: { start: new Date(year, 3, 1), end: new Date(year, 5, 30) },
            Q3: { start: new Date(year, 6, 1), end: new Date(year, 8, 30) },
            Q4: { start: new Date(year, 9, 1), end: new Date(year, 11, 31) },
        };
        const range = ranges[q] ?? { start: now, end: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000) };
        return { start: toYmd(range.start), end: toYmd(range.end) };
    };

    useEffect(() => {
        const fetchPlan = async () => {
            if (!firestore || !planId) return;
            setLoading(true);
            try {
                const snap = await getDoc(doc(firestore, 'training_plans', planId));
                if (!snap.exists()) {
                    toast({ title: 'Төлөвлөгөө олдсонгүй', variant: 'destructive' });
                    router.push('/dashboard/training');
                    return;
                }
                const data = { id: snap.id, ...(snap.data() as TrainingPlan) };
                setPlan(data);
                setForm({
                    courseId: data.courseId,
                    scheduledQuarter: data.scheduledQuarter ?? '',
                    participantIds: data.participantIds ?? (data.employeeId ? [data.employeeId] : []),
                    categoryIds: data.categoryIds ?? [],
                    status: data.status ?? 'scheduled',
                    trigger: data.trigger ?? 'manual',
                    budget: data.budget,
                    purpose: data.purpose ?? '',
                    planType: data.planType ?? '',
                    owner: data.owner ?? '',
                    format: data.format ?? '',
                    providerType: data.providerType ?? '',
                    locationOrLink: data.locationOrLink ?? '',
                    assessmentMethod: data.assessmentMethod ?? '',
                    notes: data.notes ?? '',
                });
                setSessions(data.sessions ?? []);
                const range = quarterToDateRange(data.scheduledQuarter);
                setPublishStartDate(range.start);
                setPublishEndDate(range.end);
            } finally {
                setLoading(false);
            }
        };
        fetchPlan();
    }, [firestore, planId, router, toast]);

    const years = useMemo(() => {
        const y = new Date().getFullYear();
        return [y - 1, y, y + 1, y + 2];
    }, []);

    const setField = <K extends keyof EditablePlan>(key: K, value: EditablePlan[K]) => {
        setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
    };

    const toggleArrayValue = (key: 'participantIds' | 'categoryIds', value: string) => {
        setForm((prev) => {
            if (!prev) return prev;
            const current = prev[key] ?? [];
            const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
            return { ...prev, [key]: next };
        });
    };

    const handleSave = async () => {
        if (!firestore || !planId || !form) return;
        if (!form.courseId || !form.scheduledQuarter) {
            toast({ title: 'Шаардлагатай талбараа бөглөнө үү', variant: 'destructive' });
            return;
        }
        setSaving(true);
        try {
            const course = courses.find((c) => c.id === form.courseId);
            const participantNames = (form.participantIds ?? []).map((empId) => {
                const emp = employees.find((e) => e.id === empId);
                return emp ? `${emp.lastName?.charAt(0) || ''}. ${emp.firstName}` : '';
            });

            const updates: Record<string, unknown> = {
                courseId: form.courseId,
                courseName: course?.title ?? plan?.courseName ?? '',
                scheduledQuarter: form.scheduledQuarter,
                participantIds: form.participantIds ?? [],
                participantNames,
                categoryIds: form.categoryIds ?? [],
                status: form.status,
                trigger: form.trigger,
            };
            if (form.budget != null && form.budget > 0) updates.budget = form.budget;
            if (form.purpose) updates.purpose = form.purpose;
            if (form.planType) updates.planType = form.planType;
            if (form.owner) updates.owner = form.owner;
            if (form.format) updates.format = form.format;
            if (form.providerType) updates.providerType = form.providerType;
            if (form.locationOrLink) updates.locationOrLink = form.locationOrLink;
            if (form.assessmentMethod) updates.assessmentMethod = form.assessmentMethod;
            if (form.notes) updates.notes = form.notes;
            if (form.status === 'in_progress') updates.startedAt = new Date().toISOString();
            if (form.status === 'completed' || form.status === 'cancelled') updates.completedAt = new Date().toISOString();
            updates.sessions = sessions;

            await updateDocumentNonBlocking(doc(firestore, 'training_plans', planId), updates);
            toast({ title: 'Төлөвлөгөө шинэчлэгдлээ' });
        } finally {
            setSaving(false);
        }
    };

    const handlePublish = async () => {
        if (!firestore || !user || !plan || !publishStartDate || !publishEndDate) return;
        if (publishEndDate < publishStartDate) {
            toast({ title: 'Огноо буруу байна', description: 'Дуусах огноо эхлэх огнооноос хойно байна.', variant: 'destructive' });
            return;
        }
        setPublishing(true);
        try {
            const pIds = form?.participantIds ?? plan.participantIds ?? (plan.employeeId ? [plan.employeeId] : []);
            const projectData: Record<string, unknown> = {
                name: `Сургалт: ${plan.courseName}`,
                goal: (form?.purpose || plan.purpose || `${plan.courseName} сургалтыг зохион байгуулах`),
                expectedOutcome: (form?.notes || plan.notes || `${pIds.length} оролцогчийг сургалтанд хамруулах`),
                startDate: publishStartDate,
                endDate: publishEndDate,
                ownerId: user.uid,
                teamMemberIds: pIds,
                status: 'ACTIVE',
                priority: 'MEDIUM',
                type: 'training',
                trainingPlanId: plan.id,
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now(),
                createdBy: user.uid,
            };
            if (plan.budget != null && plan.budget > 0) projectData.pointBudget = plan.budget;

            const docRef = await addDocumentNonBlocking(collection(firestore, 'projects'), projectData);
            const projectId = typeof docRef === 'object' && docRef && 'id' in docRef ? (docRef as { id: string }).id : '';

            await updateDocumentNonBlocking(doc(firestore, 'training_plans', plan.id), {
                status: 'published',
                completedAt: new Date().toISOString(),
                ...(projectId ? { projectId } : {}),
            });

            setPlan((prev) => (prev ? { ...prev, status: 'published', projectId } : prev));
            setForm((prev) => (prev ? { ...prev, status: 'published' } : prev));
            toast({ title: 'Сургалт зарлагдлаа', description: 'Төсөл амжилттай үүслээ.' });
        } finally {
            setPublishing(false);
        }
    };

    const handleDelete = async () => {
        if (!firestore || !plan) return;
        const ok = window.confirm(`"${plan.courseName}" төлөвлөгөөг бүрмөсөн устгах уу?`);
        if (!ok) return;
        await deleteDocumentNonBlocking(doc(firestore, 'training_plans', plan.id));
        toast({ title: 'Төлөвлөгөө устгагдлаа' });
        router.push('/dashboard/training');
    };

    const addSession = () => {
        if (!newSessionDate) return;
        const exists = sessions.some((s) => s.date === newSessionDate);
        if (exists) {
            toast({ title: 'Энэ огнооны хичээл аль хэдийн бүртгэгдсэн', variant: 'destructive' });
            return;
        }
        const pIds = form?.participantIds ?? [];
        const initialAttendance: Record<string, AttendanceStatus> = {};
        pIds.forEach((id) => { initialAttendance[id] = 'present'; });
        const newSession: TrainingSession = {
            date: newSessionDate,
            label: newSessionLabel || undefined,
            attendance: initialAttendance,
        };
        const updated = [...sessions, newSession].sort((a, b) => a.date.localeCompare(b.date));
        setSessions(updated);
        setExpandedSession(updated.findIndex((s) => s.date === newSessionDate));
        setNewSessionDate('');
        setNewSessionLabel('');
    };

    const removeSession = (idx: number) => {
        setSessions((prev) => prev.filter((_, i) => i !== idx));
        setExpandedSession(null);
    };

    const setAttendance = (sessionIdx: number, empId: string, status: AttendanceStatus) => {
        setSessions((prev) =>
            prev.map((s, i) =>
                i === sessionIdx ? { ...s, attendance: { ...s.attendance, [empId]: status } } : s
            )
        );
    };

    const saveAttendance = async () => {
        if (!firestore || !planId) return;
        setSavingAttendance(true);
        try {
            await updateDocumentNonBlocking(doc(firestore, 'training_plans', planId), { sessions });
            toast({ title: 'Ирц хадгалагдлаа' });
        } finally {
            setSavingAttendance(false);
        }
    };

    const attendanceSummary = useMemo(() => {
        const pIds = form?.participantIds ?? [];
        if (pIds.length === 0 || sessions.length === 0) return null;
        const totalSlots = pIds.length * sessions.length;
        let presentCount = 0;
        let lateCount = 0;
        sessions.forEach((s) => {
            pIds.forEach((id) => {
                const st = s.attendance[id];
                if (st === 'present') presentCount++;
                if (st === 'late') lateCount++;
            });
        });
        const attendedCount = presentCount + lateCount;
        const rate = totalSlots > 0 ? Math.round((attendedCount / totalSlots) * 100) : 0;
        return { totalSlots, presentCount, lateCount, attendedCount, rate };
    }, [sessions, form?.participantIds]);

    const attendanceStatusIcon: Record<AttendanceStatus, React.ReactNode> = {
        present: <Check className="h-3.5 w-3.5 text-emerald-600" />,
        absent: <X className="h-3.5 w-3.5 text-red-500" />,
        late: <Clock className="h-3.5 w-3.5 text-amber-600" />,
        excused: <ShieldCheck className="h-3.5 w-3.5 text-sky-600" />,
    };

    if (loading || !form) {
        return (
            <div className="p-6 md:p-8">
                <Card><CardContent className="p-6">Ачаалж байна...</CardContent></Card>
            </div>
        );
    }

    const [year, quarter] = (form.scheduledQuarter || '').split('-');
    const statusColor: Record<string, string> = {
        scheduled: 'bg-blue-100 text-blue-700',
        in_progress: 'bg-amber-100 text-amber-700',
        completed: 'bg-emerald-100 text-emerald-700',
        cancelled: 'bg-slate-100 text-slate-500',
        published: 'bg-emerald-100 text-emerald-700',
        overdue: 'bg-red-100 text-red-700',
    };
    const canPublish = form.status === 'scheduled' || form.status === 'in_progress' || form.status === 'overdue';

    return (
        <div className="flex flex-col h-full overflow-hidden bg-slate-50/50">
            <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 pb-32">
                {/* ── Header: title + actions ── */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <PageHeader
                        title={plan?.courseName || 'Сургалтын төлөвлөгөө'}
                        description={`${form.scheduledQuarter ? `${quarter} ${year}` : ''} · ${(form.participantIds ?? []).length} оролцогч`}
                        showBackButton
                        hideBreadcrumbs
                        backButtonPlacement="inline"
                        backBehavior="history"
                        fallbackBackHref="/dashboard/training"
                    />
                    <div className="flex items-center gap-2 shrink-0">
                        <Badge className={`${statusColor[form.status] || 'bg-slate-100 text-slate-600'} text-xs px-3 py-1`}>
                            {PLAN_STATUS_LABELS[form.status] ?? form.status}
                        </Badge>
                        <Button variant="outline" size="sm" onClick={handleSave} disabled={saving}>
                            <Save className="h-4 w-4 mr-1.5" />
                            {saving ? 'Хадгалж байна...' : 'Хадгалах'}
                        </Button>
                        {canPublish && (
                            <Button size="sm" onClick={handlePublish} disabled={publishing || !publishStartDate || !publishEndDate}>
                                <Send className="h-4 w-4 mr-1.5" />
                                {publishing ? 'Зарлаж...' : 'Зарлах'}
                            </Button>
                        )}
                        <Button variant="destructive" size="sm" onClick={handleDelete}>
                            <Trash2 className="h-4 w-4 mr-1.5" />
                            Устгах
                        </Button>
                    </div>
                </div>

                {/* ── Two-column layout ── */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* ─── Left: 2/3 — Үндсэн мэдээлэл ─── */}
                    <div className="lg:col-span-2 space-y-6">
                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-base">Сургалтын мэдээлэл</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-medium text-muted-foreground">Сургалт</label>
                                        <Select value={form.courseId} onValueChange={(v) => setField('courseId', v)}>
                                            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                {courses.map((c) => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-medium text-muted-foreground">Төлөв</label>
                                        <Select value={form.status} onValueChange={(v) => setField('status', v)}>
                                            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                {PLAN_STATUSES.map((s) => <SelectItem key={s} value={s}>{PLAN_STATUS_LABELS[s]}</SelectItem>)}
                                                <SelectItem value="overdue">{PLAN_STATUS_LABELS.overdue}</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-medium text-muted-foreground">Хугацаа (улирал)</label>
                                        <div className="flex gap-2">
                                            <Select value={year || ''} onValueChange={(y) => setField('scheduledQuarter', quarter ? `${y}-${quarter}` : `${y}-Q1`)}>
                                                <SelectTrigger className="h-9"><SelectValue placeholder="Жил" /></SelectTrigger>
                                                <SelectContent>{years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
                                            </Select>
                                            <Select value={quarter || ''} onValueChange={(q) => setField('scheduledQuarter', year ? `${year}-${q}` : '')}>
                                                <SelectTrigger className="h-9"><SelectValue placeholder="Улирал" /></SelectTrigger>
                                                <SelectContent>{QUARTERS.map((q) => <SelectItem key={q} value={q}>{QUARTER_LABELS[q]}</SelectItem>)}</SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-medium text-muted-foreground">Шалтгаан</label>
                                        <Select value={form.trigger} onValueChange={(v) => setField('trigger', v)}>
                                            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                                            <SelectContent>{PLAN_TRIGGERS.map((t) => <SelectItem key={t} value={t}>{PLAN_TRIGGER_LABELS[t]}</SelectItem>)}</SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                <Separator />

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-medium text-muted-foreground">Зорилго</label>
                                        <Input className="h-9" value={form.purpose ?? ''} onChange={(e) => setField('purpose', e.target.value)} />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-medium text-muted-foreground">Төрөл</label>
                                        <Select value={form.planType || ''} onValueChange={(v) => setField('planType', v)}>
                                            <SelectTrigger className="h-9"><SelectValue placeholder="Сонгох" /></SelectTrigger>
                                            <SelectContent>{PLAN_TYPES.map((t) => <SelectItem key={t} value={t}>{PLAN_TYPE_LABELS[t]}</SelectItem>)}</SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-medium text-muted-foreground">Хэлбэр</label>
                                        <Select value={form.format || ''} onValueChange={(v) => setField('format', v)}>
                                            <SelectTrigger className="h-9"><SelectValue placeholder="Сонгох" /></SelectTrigger>
                                            <SelectContent>{PLAN_FORMATS.map((f) => <SelectItem key={f} value={f}>{PLAN_FORMAT_LABELS[f]}</SelectItem>)}</SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-medium text-muted-foreground">Сурагт авах байдал</label>
                                        <Select value={form.providerType || ''} onValueChange={(v) => setField('providerType', v)}>
                                            <SelectTrigger className="h-9"><SelectValue placeholder="Сонгох" /></SelectTrigger>
                                            <SelectContent>{PLAN_PROVIDER_TYPES.map((t) => <SelectItem key={t} value={t}>{PLAN_PROVIDER_LABELS[t]}</SelectItem>)}</SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-medium text-muted-foreground">Хариуцсан эзэн</label>
                                        <Input className="h-9" value={form.owner ?? ''} onChange={(e) => setField('owner', e.target.value)} />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-medium text-muted-foreground">Үнэлгээний арга</label>
                                        <Select value={form.assessmentMethod || ''} onValueChange={(v) => setField('assessmentMethod', v)}>
                                            <SelectTrigger className="h-9"><SelectValue placeholder="Сонгох" /></SelectTrigger>
                                            <SelectContent>{ASSESSMENT_METHODS.map((m) => <SelectItem key={m} value={m}>{ASSESSMENT_METHOD_LABELS[m]}</SelectItem>)}</SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-1.5 sm:col-span-2">
                                        <label className="text-xs font-medium text-muted-foreground">Байршил / холбоос</label>
                                        <Input className="h-9" value={form.locationOrLink ?? ''} onChange={(e) => setField('locationOrLink', e.target.value)} />
                                    </div>
                                    <div className="space-y-1.5 sm:col-span-2">
                                        <label className="text-xs font-medium text-muted-foreground">Тайлбар</label>
                                        <Textarea rows={2} value={form.notes ?? ''} onChange={(e) => setField('notes', e.target.value)} />
                                    </div>
                                </div>

                                <Separator />

                                {/* Ангилал */}
                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                                        <Tag className="h-3.5 w-3.5" /> Ангилал
                                        {(form.categoryIds ?? []).length > 0 && <Badge variant="secondary" className="text-[10px] ml-1">{(form.categoryIds ?? []).length}</Badge>}
                                    </label>
                                    <div className="flex flex-wrap gap-1 mb-1">
                                        {(form.categoryIds ?? []).map((id) => (
                                            <Badge key={id} variant="outline" className="text-xs">{categories.find((c) => c.id === id)?.name ?? id}</Badge>
                                        ))}
                                    </div>
                                    <ScrollArea className="h-[90px] rounded-lg border">
                                        <div className="p-1.5 space-y-0.5">
                                            {categories.map((cat) => (
                                                <label key={cat.id} className="flex items-center gap-2 px-1.5 py-1 rounded hover:bg-muted/50 cursor-pointer">
                                                    <Checkbox checked={(form.categoryIds ?? []).includes(cat.id)} onCheckedChange={() => toggleArrayValue('categoryIds', cat.id)} />
                                                    <span className="text-sm">{cat.name}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </ScrollArea>
                                </div>

                                {/* Оролцогчид */}
                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                                        <Users className="h-3.5 w-3.5" /> Оролцогчид
                                        {(form.participantIds ?? []).length > 0 && <Badge variant="secondary" className="text-[10px] ml-1">{(form.participantIds ?? []).length}</Badge>}
                                    </label>
                                    <div className="flex flex-wrap gap-1 mb-1">
                                        {(form.participantIds ?? []).map((id) => {
                                            const emp = employees.find((e) => e.id === id);
                                            return <Badge key={id} variant="outline" className="text-xs">{emp ? `${emp.lastName?.charAt(0)}. ${emp.firstName}` : id}</Badge>;
                                        })}
                                    </div>
                                    <ScrollArea className="h-[120px] rounded-lg border">
                                        <div className="p-1.5 space-y-0.5">
                                            {employees.map((emp) => (
                                                <label key={emp.id} className="flex items-center gap-2 px-1.5 py-1 rounded hover:bg-muted/50 cursor-pointer">
                                                    <Checkbox checked={(form.participantIds ?? []).includes(emp.id)} onCheckedChange={() => toggleArrayValue('participantIds', emp.id)} />
                                                    <span className="text-sm">{emp.lastName?.charAt(0)}. {emp.firstName}</span>
                                                    {emp.jobTitle && <span className="text-xs text-muted-foreground ml-1">{emp.jobTitle}</span>}
                                                </label>
                                            ))}
                                        </div>
                                    </ScrollArea>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* ─── Right: 1/3 — Явцын удирдлага ─── */}
                    <div className="space-y-6">
                        {/* Зарлах */}
                        {canPublish && (
                            <Card>
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-base flex items-center gap-2">
                                        <CalendarDays className="h-4 w-4 text-emerald-600" /> Сургалт зарлах
                                    </CardTitle>
                                    <CardDescription>Огноо тохируулаад төсөл үүсгэнэ</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-medium text-muted-foreground">Эхлэх огноо</label>
                                        <Input type="date" className="h-9" value={publishStartDate} onChange={(e) => setPublishStartDate(e.target.value)} />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-medium text-muted-foreground">Дуусах огноо</label>
                                        <Input type="date" className="h-9" value={publishEndDate} onChange={(e) => setPublishEndDate(e.target.value)} />
                                    </div>
                                    {publishStartDate && publishEndDate && publishEndDate < publishStartDate && (
                                        <p className="text-xs text-destructive">Дуусах огноо эхлэх огнооноос хойно байх ёстой.</p>
                                    )}
                                    <Button
                                        className="w-full"
                                        onClick={handlePublish}
                                        disabled={publishing || !publishStartDate || !publishEndDate || publishEndDate < publishStartDate}
                                    >
                                        <Send className="h-4 w-4 mr-2" />
                                        {publishing ? 'Зарлаж байна...' : 'Зарлах & Төсөл үүсгэх'}
                                    </Button>
                                </CardContent>
                            </Card>
                        )}

                        {/* Сургалтын статус */}
                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-base flex items-center gap-2">
                                    <ClipboardCheck className="h-4 w-4 text-blue-600" /> Сургалтын статус
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-sm space-y-2">
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Одоогийн төлөв</span>
                                        <Badge className={statusColor[form.status] || 'bg-slate-100'}>{PLAN_STATUS_LABELS[form.status] ?? form.status}</Badge>
                                    </div>
                                    {plan?.createdAt && (
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">Үүсгэсэн</span>
                                            <span className="text-xs">{new Date(plan.createdAt).toLocaleDateString('mn-MN')}</span>
                                        </div>
                                    )}
                                    {plan?.startedAt && (
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">Эхэлсэн</span>
                                            <span className="text-xs">{new Date(plan.startedAt).toLocaleDateString('mn-MN')}</span>
                                        </div>
                                    )}
                                    {plan?.completedAt && (
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">Дууссан</span>
                                            <span className="text-xs">{new Date(plan.completedAt).toLocaleDateString('mn-MN')}</span>
                                        </div>
                                    )}
                                    {plan?.projectId && (
                                        <div className="flex justify-between items-center">
                                            <span className="text-muted-foreground">Төсөл</span>
                                            <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={() => router.push(`/dashboard/projects/${plan.projectId}`)}>
                                                Төсөл үзэх →
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>

                        {/* Ирц */}
                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-base flex items-center gap-2">
                                    <Users className="h-4 w-4 text-amber-600" /> Ирц
                                    {attendanceSummary && (
                                        <Badge variant="secondary" className="text-[10px] ml-auto font-normal">
                                            {attendanceSummary.rate}%
                                        </Badge>
                                    )}
                                </CardTitle>
                                <CardDescription>
                                    {form.status === 'in_progress' || form.status === 'published'
                                        ? 'Хичээл/өдөр нэмж оролцогчдын ирцийг бүртгэнэ'
                                        : 'Сургалт "Явагдаж буй" төлөвтэй болмогц ирц бүртгэх боломжтой'}
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                {(form.status === 'in_progress' || form.status === 'published' || form.status === 'completed') ? (
                                    <>
                                        {/* Summary */}
                                        {attendanceSummary && (
                                            <div className="grid grid-cols-2 gap-2 text-xs">
                                                <div className="rounded-md bg-emerald-50 p-2 text-center">
                                                    <span className="font-semibold text-emerald-700">{attendanceSummary.presentCount}</span>
                                                    <span className="text-emerald-600 ml-1">ирсэн</span>
                                                </div>
                                                <div className="rounded-md bg-amber-50 p-2 text-center">
                                                    <span className="font-semibold text-amber-700">{attendanceSummary.lateCount}</span>
                                                    <span className="text-amber-600 ml-1">хоцорсон</span>
                                                </div>
                                                <div className="col-span-2 rounded-md bg-slate-50 p-2">
                                                    <div className="flex justify-between items-center mb-1">
                                                        <span className="text-muted-foreground">Нийт ирц</span>
                                                        <span className="font-semibold">{attendanceSummary.rate}%</span>
                                                    </div>
                                                    <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                                        <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${attendanceSummary.rate}%` }} />
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* Add session */}
                                        {form.status !== 'completed' && (
                                            <div className="space-y-2 border rounded-lg p-2.5 bg-muted/20">
                                                <p className="text-xs font-medium text-muted-foreground">Шинэ хичээл/өдөр нэмэх</p>
                                                <Input
                                                    type="date"
                                                    className="h-8 text-xs"
                                                    value={newSessionDate}
                                                    onChange={(e) => setNewSessionDate(e.target.value)}
                                                />
                                                <Input
                                                    className="h-8 text-xs"
                                                    placeholder="Нэр (заавал биш, жнь: 1-р хичээл)"
                                                    value={newSessionLabel}
                                                    onChange={(e) => setNewSessionLabel(e.target.value)}
                                                />
                                                <Button variant="outline" size="sm" className="w-full h-7 text-xs" onClick={addSession} disabled={!newSessionDate}>
                                                    <Plus className="h-3.5 w-3.5 mr-1" /> Нэмэх
                                                </Button>
                                            </div>
                                        )}

                                        {/* Session list */}
                                        {sessions.length === 0 && (
                                            <p className="text-xs text-muted-foreground text-center py-2">
                                                Хичээл бүртгэгдээгүй байна
                                            </p>
                                        )}
                                        <div className="space-y-1.5">
                                            {sessions.map((session, idx) => {
                                                const isExpanded = expandedSession === idx;
                                                const pIds = form.participantIds ?? [];
                                                const presentInSession = pIds.filter((id) => session.attendance[id] === 'present' || session.attendance[id] === 'late').length;
                                                return (
                                                    <div key={session.date} className="border rounded-lg overflow-hidden">
                                                        <button
                                                            className="flex items-center justify-between w-full px-3 py-2 text-left hover:bg-muted/50 transition-colors"
                                                            onClick={() => setExpandedSession(isExpanded ? null : idx)}
                                                        >
                                                            <div className="flex items-center gap-2">
                                                                {isExpanded ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                                                                <span className="text-xs font-medium">{session.date}</span>
                                                                {session.label && <span className="text-xs text-muted-foreground">· {session.label}</span>}
                                                            </div>
                                                            <Badge variant="outline" className="text-[10px]">
                                                                {presentInSession}/{pIds.length}
                                                            </Badge>
                                                        </button>
                                                        {isExpanded && (
                                                            <div className="border-t">
                                                                <div className="p-2 space-y-1">
                                                                    {pIds.map((empId) => {
                                                                        const emp = employees.find((e) => e.id === empId);
                                                                        const currentStatus = session.attendance[empId] ?? 'absent';
                                                                        return (
                                                                            <div key={empId} className="flex items-center justify-between px-1.5 py-1 rounded hover:bg-muted/30">
                                                                                <div className="flex items-center gap-2 min-w-0">
                                                                                    {attendanceStatusIcon[currentStatus]}
                                                                                    <span className="text-xs truncate">
                                                                                        {emp ? `${emp.lastName?.charAt(0)}. ${emp.firstName}` : empId}
                                                                                    </span>
                                                                                </div>
                                                                                <Select
                                                                                    value={currentStatus}
                                                                                    onValueChange={(v) => setAttendance(idx, empId, v as AttendanceStatus)}
                                                                                >
                                                                                    <SelectTrigger className="h-6 w-[100px] text-[10px]">
                                                                                        <SelectValue />
                                                                                    </SelectTrigger>
                                                                                    <SelectContent>
                                                                                        {ATTENDANCE_STATUSES.map((s) => (
                                                                                            <SelectItem key={s} value={s} className="text-xs">{ATTENDANCE_STATUS_LABELS[s]}</SelectItem>
                                                                                        ))}
                                                                                    </SelectContent>
                                                                                </Select>
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>
                                                                <div className="flex justify-between border-t px-2 py-1.5">
                                                                    <Button variant="ghost" size="sm" className="h-6 text-[10px] text-destructive hover:text-destructive" onClick={() => removeSession(idx)}>
                                                                        <Trash2 className="h-3 w-3 mr-1" /> Устгах
                                                                    </Button>
                                                                    <div className="flex gap-1">
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="sm"
                                                                            className="h-6 text-[10px]"
                                                                            onClick={() => {
                                                                                const updated: Record<string, AttendanceStatus> = {};
                                                                                pIds.forEach((id) => { updated[id] = 'present'; });
                                                                                setSessions((prev) => prev.map((s, i) => i === idx ? { ...s, attendance: updated } : s));
                                                                            }}
                                                                        >
                                                                            Бүгдийг ирсэн
                                                                        </Button>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        {/* Save attendance */}
                                        {sessions.length > 0 && (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="w-full"
                                                onClick={saveAttendance}
                                                disabled={savingAttendance}
                                            >
                                                <Save className="h-3.5 w-3.5 mr-1.5" />
                                                {savingAttendance ? 'Хадгалж байна...' : 'Ирц хадгалах'}
                                            </Button>
                                        )}
                                    </>
                                ) : (
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                                        <Clock className="h-4 w-4" />
                                        <span>Сургалтын төлөвийг &quot;Явагдаж буй&quot; болгосон үед ирц бүртгэнэ</span>
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Үнэлгээ */}
                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-base flex items-center gap-2">
                                    <BarChart3 className="h-4 w-4 text-violet-600" /> Үнэлгээ
                                </CardTitle>
                                <CardDescription>Тест, даалгавар, финал дүн</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <p className="text-xs text-muted-foreground">Удахгүй нэмэгдэнэ...</p>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    );
}

