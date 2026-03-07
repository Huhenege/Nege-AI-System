'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { collection, deleteDoc, doc, getDoc, query, Timestamp, where } from 'firebase/firestore';
import { useCollection, useFirebase, updateDocumentNonBlocking, addDocumentNonBlocking, deleteDocumentNonBlocking, useTenantWrite } from '@/firebase';
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
import { Skeleton } from '@/components/ui/skeleton';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Send, Trash2, Save, Users, Tag, CalendarDays, ClipboardCheck, BarChart3, Plus, ChevronDown, ChevronRight, Check, X, Clock, ShieldCheck, Circle, Pencil, FileText, Loader2, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
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
import type { Survey } from '@/app/dashboard/survey/types';
import { SURVEY_STATUS_LABELS } from '@/app/dashboard/survey/types';
import { SYSTEM_TEMPLATES, TRAINING_SATISFACTION_TEMPLATE_TITLE } from '@/app/dashboard/survey/data/system-templates';

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
    const { tDoc, tCollection } = useTenantWrite();

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
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [statusConfirmOpen, setStatusConfirmOpen] = useState(false);
    const [pendingStatus, setPendingStatus] = useState<string | null>(null);
    const [creatingSurveyId, setCreatingSurveyId] = useState<string | null>(null);
    const publishCardRef = useRef<HTMLDivElement>(null);

    const coursesQuery = useMemo(() => (firestore ? collection(firestore, 'training_courses') : null), [firestore]);
    const employeesQuery = useMemo(() => (firestore ? collection(firestore, 'employees') : null), [firestore]);
    const categoriesQuery = useMemo(() => (firestore ? collection(firestore, 'training_categories') : null), [firestore]);
    const linkedSurveysQuery = useMemo(
        () => (firestore && planId ? query(collection(firestore, 'surveys'), where('trainingPlanId', '==', planId)) : null),
        [firestore, planId]
    );

    const { data: courses } = useCollection<TrainingCourse>(coursesQuery);
    const { data: employees } = useCollection<Employee>(employeesQuery);
    const { data: categories } = useCollection<TrainingCategory>(categoriesQuery);
    const { data: linkedSurveys } = useCollection<Survey>(linkedSurveysQuery);

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
                const data = { ...(snap.data() as TrainingPlan), id: snap.id };
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

    // Явагдаж буй төлөвт оролцогч байхад ирц бүртгэх нэг самбар (session) байхгүй бол нэгийг үүсгэнэ
    const participantCount = (form?.participantIds ?? []).length;
    useEffect(() => {
        if (form?.status !== 'in_progress' || !plan || participantCount === 0 || sessions.length > 0) return;
        const defaultDate = plan.startedAt
            ? new Date(plan.startedAt).toISOString().slice(0, 10)
            : new Date().toISOString().slice(0, 10);
        setSessions([{ date: defaultDate, attendance: {} }]);
        setExpandedSession(0);
    }, [form?.status, participantCount, plan?.startedAt, plan?.id]);

    const years = useMemo(() => {
        const y = new Date().getFullYear();
        return [y - 1, y, y + 1, y + 2];
    }, []);

    // Дууссан сургалтын үнэлгээнд зөвхөн стандарт "Сургалтын сэтгэл ханамжийн судалгаа" загварыг ашиглана
    const trainingEvaluationTemplate = useMemo(() => {
        const idx = SYSTEM_TEMPLATES.findIndex((t) => t.title === TRAINING_SATISFACTION_TEMPLATE_TITLE);
        if (idx < 0) return null;
        const t = SYSTEM_TEMPLATES[idx];
        return { ...t, id: `system-${idx}`, questions: t.questions || [] };
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

            const cleanUpdates = Object.fromEntries(Object.entries(updates).filter(([, v]) => v !== undefined));
            await updateDocumentNonBlocking(tDoc('training_plans', planId), cleanUpdates);
            toast({ title: 'Төлөвлөгөө шинэчлэгдлээ' });
        } finally {
            setSaving(false);
        }
    };

    const handlePublish = async () => {
        if (!firestore || !user || !plan || !publishStartDate) return;
        const endDate = publishEndDate || publishStartDate;
        if (publishEndDate && publishEndDate < publishStartDate) {
            toast({ title: 'Огноо буруу байна', description: 'Дуусах огноо эхлэх огнооноос хойно байна.', variant: 'destructive' });
            return;
        }
        const quarter = form?.scheduledQuarter || plan?.scheduledQuarter;
        if (quarter) {
            const range = quarterToDateRange(quarter);
            if (publishStartDate < range.start || publishStartDate > range.end) {
                toast({ title: 'Огноо төлөвлөсөн улиралд орохгүй байна', description: `Эхлэх огноо ${range.start} - ${range.end} хооронд байх ёстой (${quarter}).`, variant: 'destructive' });
                return;
            }
            if (publishEndDate && (publishEndDate < range.start || publishEndDate > range.end)) {
                toast({ title: 'Огноо төлөвлөсөн улиралд орохгүй байна', description: `Дуусах огноо ${range.start} - ${range.end} хооронд байх ёстой (${quarter}).`, variant: 'destructive' });
                return;
            }
        }
        setPublishing(true);
        try {
            const pIds = form?.participantIds ?? plan.participantIds ?? (plan.employeeId ? [plan.employeeId] : []);
            const projectData: Record<string, unknown> = {
                name: `Сургалт: ${plan.courseName}`,
                goal: (form?.purpose || plan.purpose || `${plan.courseName} сургалтыг зохион байгуулах`),
                expectedOutcome: (form?.notes || plan.notes || `${pIds.length} оролцогчийг сургалтанд хамруулах`),
                startDate: publishStartDate,
                endDate,
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

            const docRef = await addDocumentNonBlocking(tCollection('projects'), projectData);
            const projectId = typeof docRef === 'object' && docRef && 'id' in docRef ? (docRef as { id: string }).id : '';

            await updateDocumentNonBlocking(tDoc('training_plans', plan.id), {
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
        setDeleting(true);
        try {
            await deleteDocumentNonBlocking(tDoc('training_plans', plan.id));
            setDeleteDialogOpen(false);
            toast({ title: 'Төлөвлөгөө устгагдлаа' });
            router.push('/dashboard/training');
        } finally {
            setDeleting(false);
        }
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
            await updateDocumentNonBlocking(tDoc('training_plans', planId), { sessions });
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

    const formatSessionDate = (dateStr: string) => {
        try {
            const d = new Date(dateStr + 'T12:00:00');
            return isNaN(d.getTime()) ? dateStr : d.toLocaleDateString('mn-MN', { year: 'numeric', month: '2-digit', day: '2-digit' });
        } catch {
            return dateStr;
        }
    };

    const handleCreateEvaluationSurvey = useCallback(
        async (template: { id: string; title: string; description: string; category: Survey['type']; questions: Array<Record<string, unknown>> }) => {
            if (!firestore || !planId || !form) return;
            const courseName = plan?.courseName ?? courses?.find((c) => c.id === form.courseId)?.title ?? 'Сургалт';
            const participantIds = form.participantIds ?? [];
            setCreatingSurveyId(template.id);
            try {
                const now = new Date().toISOString();
                const newSurvey: Omit<Survey, 'id'> = {
                    title: `Сургалтын үнэлгээ: ${courseName}`,
                    description: template.description || `${courseName} сургалтын үнэлгээний санал асуулга`,
                    type: (template.category as Survey['type']) || 'custom',
                    status: 'draft',
                    isAnonymous: false,
                    targetAudience: participantIds.length > 0 ? 'custom' : 'all',
                    targetIds: participantIds,
                    startDate: '',
                    endDate: '',
                    reminderEnabled: false,
                    questionsCount: template.questions?.length ?? 0,
                    responsesCount: 0,
                    createdBy: user?.uid ?? '',
                    createdAt: now,
                    updatedAt: now,
                    trainingPlanId: planId,
                };
                const docRef = await addDocumentNonBlocking(tCollection('surveys'), newSurvey);
                const surveyId = docRef && typeof docRef === 'object' && 'id' in docRef ? (docRef as { id: string }).id : null;
                if (surveyId && template.questions?.length) {
                    const questionsRef = tCollection('surveys', surveyId, 'questions');
                    for (const q of template.questions) {
                        const questionData: Record<string, unknown> = {};
                        for (const [key, value] of Object.entries(q)) {
                            if (value !== undefined) questionData[key] = value;
                        }
                        await addDocumentNonBlocking(questionsRef, questionData);
                    }
                }
                toast({ title: 'Үнэлгээний санал асуулга үүсгэгдлээ' });
                if (surveyId) router.push(`/dashboard/survey/${surveyId}`);
            } catch (error) {
                console.error('Failed to create evaluation survey:', error);
                toast({ title: 'Үнэлгээ үүсгэхэд алдаа гарлаа', variant: 'destructive' });
            } finally {
                setCreatingSurveyId(null);
            }
        },
        [firestore, planId, form, plan?.courseName, courses, user?.uid, router, toast]
    );

    const attendanceStatusIcon: Record<AttendanceStatus, React.ReactNode> = {
        present: <Check className="h-3.5 w-3.5 text-emerald-600" />,
        absent: <X className="h-3.5 w-3.5 text-red-500" />,
        late: <Clock className="h-3.5 w-3.5 text-amber-600" />,
        excused: <ShieldCheck className="h-3.5 w-3.5 text-sky-600" />,
    };

    if (loading || !form) {
        return (
            <div className="flex flex-col h-full overflow-hidden bg-slate-50/50">
                <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6">
                    <div className="flex justify-between items-start gap-4">
                        <div className="space-y-2">
                            <Skeleton className="h-8 w-64" />
                            <Skeleton className="h-4 w-40" />
                        </div>
                    </div>
                    <Skeleton className="h-20 w-full rounded-lg" />
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="lg:col-span-2 space-y-6">
                            <Card>
                                <CardHeader className="pb-3">
                                    <Skeleton className="h-5 w-40" />
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        {[1, 2, 3, 4].map((i) => (
                                            <Skeleton key={i} className="h-9 w-full" />
                                        ))}
                                    </div>
                                    <Separator />
                                    <div className="grid grid-cols-2 gap-4">
                                        {[1, 2, 3, 4, 5, 6].map((i) => (
                                            <Skeleton key={i} className="h-9 w-full" />
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                        <div className="space-y-6">
                            {[1, 2, 3].map((i) => (
                                <Skeleton key={i} className="h-32 rounded-lg" />
                            ))}
                        </div>
                    </div>
                </div>
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

    const processSteps: { id: string; label: string }[] = [
        { id: 'scheduled', label: 'Төлөвлөгдсөн' },
        { id: 'published', label: 'Зарлагдсан' },
        { id: 'in_progress', label: 'Явагдаж буй' },
        { id: 'completed', label: 'Дууссан' },
        { id: 'cancelled', label: 'Цуцалсан' },
    ];
    const currentStepIndex = processSteps.findIndex((s) => s.id === form.status);
    const effectiveStepIndex = currentStepIndex >= 0 ? currentStepIndex : form.status === 'overdue' ? 0 : 0;

    const getStatusChangeDescription = (from: string, to: string): string => {
        const toLabel = PLAN_STATUS_LABELS[to] ?? to;
        if (to === 'in_progress') return `Сургалтыг "Явагдаж буй" болгоно. Эхлэсэн огноо бүртгэгдэж, ирц бүртгэх боломжтой болно.`;
        if (to === 'completed') return `Сургалтыг "Дууссан" болгоно. Дуусах огноо бүртгэгдэнэ.`;
        if (to === 'published') return `Сургалтыг "Зарлагдсан" болгоно. Төсөл үүсгэх боломжтой (дээрх "Зарлах" хэсгээс).`;
        if (to === 'cancelled') return from === 'published' && plan?.projectId
            ? `Сургалтыг "Цуцалсан" болгоно. Энэ сургалтаар үүсгэсэн холбоотой төсөл устгагдана. Цуцалсан огноо бүртгэгдэнэ.`
            : `Сургалтыг "Цуцалсан" болгоно. Цуцалсан огноо бүртгэгдэнэ.`;
        if (to === 'scheduled') return `Төлөвийг "Төлөвлөгдсөн" руу буцаана. Дахин засварлаж болно.`;
        return `Төлөвийг "${toLabel}" болгоно.`;
    };

    const openStatusConfirm = (newStatus: string) => {
        if (newStatus === form.status || newStatus === (form.status === 'overdue' ? 'scheduled' : '')) return;
        // Зарлагдсан руу зөвхөн "Сургалт зарлах" (төсөл үүсгэх)-аар шилжинэ. Шууд дарж шилжихийг хориглоно.
        const isScheduledOrOverdue = form.status === 'scheduled' || form.status === 'overdue';
        if (newStatus === 'published' && isScheduledOrOverdue) {
            toast({
                title: 'Зарлагдсан төлөв рүү шууд шилжих боломжгүй',
                description: 'Эхлээд доорх "Сургалт зарлах" хэсгээс огноо тохируулаад "Зарлах & Төсөл үүсгэх" товч дарж төсөл үүсгэнэ үү. Төсөл үүсэх үед төлөв автоматаар Зарлагдсан болно.',
                variant: 'default',
            });
            publishCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            return;
        }
        // Зарлагдсан төлөвөөс зөвхөн цуцлах эсвэл явагдаж буй руу шилжихийг зөвшөөрнө. Төлөвлөгдсөн, дууссан руу буцаахыг хориглоно.
        if (form.status === 'published' && !['cancelled', 'in_progress'].includes(newStatus)) {
            toast({
                title: 'Энэ төлөв рүү шилжих боломжгүй',
                description: 'Зарлагдсан төлөвөөс төлөвлөгдсөн эсвэл дууссан руу шилжих боломжгүй. Явагдаж буй руу шилжих эсвэл цуцлах боломжтой.',
                variant: 'default',
            });
            return;
        }
        setPendingStatus(newStatus);
        setStatusConfirmOpen(true);
    };

    const handleStatusFromBar = async (newStatus: string) => {
        if (!newStatus) return;
        setStatusConfirmOpen(false);
        setPendingStatus(null);
        setField('status', newStatus);
        if (!firestore || !planId || !form) return;
        setSaving(true);
        try {
            // Зарлагдсан төлөвөөс цуцлах үед холбоотой төслийг устгана.
            if (newStatus === 'cancelled' && form.status === 'published' && plan?.projectId) {
                await deleteDoc(tDoc('projects', plan.projectId));
            }
            const course = courses.find((c) => c.id === form.courseId);
            const updates: Record<string, unknown> = {
                status: newStatus,
                courseId: form.courseId,
                courseName: course?.title ?? plan?.courseName ?? '',
                scheduledQuarter: form.scheduledQuarter,
                participantIds: form.participantIds ?? [],
                participantNames: (form.participantIds ?? []).map((empId) => {
                    const emp = employees.find((e) => e.id === empId);
                    return emp ? `${emp.lastName?.charAt(0) || ''}. ${emp.firstName}` : '';
                }),
                categoryIds: form.categoryIds ?? [],
                trigger: form.trigger,
                sessions,
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
            if (newStatus === 'in_progress') updates.startedAt = new Date().toISOString();
            if (['completed', 'cancelled', 'published'].includes(newStatus)) updates.completedAt = new Date().toISOString();
            if (newStatus === 'cancelled' && form.status === 'published') updates.projectId = null;
            const cleanUpdates = Object.fromEntries(Object.entries(updates).filter(([, v]) => v !== undefined));
            await updateDocumentNonBlocking(tDoc('training_plans', planId), cleanUpdates);
            setPlan((p) => (p ? { ...p, status: newStatus as TrainingPlan['status'], projectId: newStatus === 'cancelled' ? undefined : p.projectId } : p));
            toast({ title: 'Төлөв шинэчлэгдлээ', description: PLAN_STATUS_LABELS[newStatus] ?? newStatus });
        } finally {
            setSaving(false);
        }
    };

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
                        <Button variant="destructive" size="sm" onClick={() => setDeleteDialogOpen(true)} disabled={deleting}>
                            <Trash2 className="h-4 w-4 mr-1.5" />
                            Устгах
                        </Button>
                    </div>
                </div>

                {/* Устгах баталгаажуулах dialog */}
                <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Төлөвлөгөөг устгах уу?</AlertDialogTitle>
                            <AlertDialogDescription>
                                &quot;{plan?.courseName}&quot; сургалтын төлөвлөгөөг бүрмөсөн устгана. Энэ үйлдлийг буцааж болохгүй.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel disabled={deleting}>Цуцлах</AlertDialogCancel>
                            <AlertDialogAction variant="destructive" onClick={handleDelete} disabled={deleting}>
                                {deleting ? 'Устгаж байна...' : 'Устгах'}
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>

                {/* Төлөв шилжүүлэх баталгаажуулалт */}
                <AlertDialog open={statusConfirmOpen} onOpenChange={(open) => { if (!open) { setStatusConfirmOpen(false); setPendingStatus(null); } }}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Төлөвийг шилжүүлэх уу?</AlertDialogTitle>
                            <AlertDialogDescription>
                                {pendingStatus ? (
                                    <>
                                        <span className="font-medium text-foreground">{PLAN_STATUS_LABELS[pendingStatus] ?? pendingStatus}</span>
                                        {' '}болгоно.
                                        <span className="mt-2 block text-muted-foreground">{getStatusChangeDescription(form.status, pendingStatus)}</span>
                                    </>
                                ) : (
                                    <span />
                                )}
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Цуцлах</AlertDialogCancel>
                            <AlertDialogAction
                                onClick={() => {
                                    const toApply = pendingStatus;
                                    if (toApply) handleStatusFromBar(toApply);
                                }}
                                disabled={saving}
                            >
                                {saving ? 'Хадгалж байна...' : 'Баталгаажуулах'}
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>

                {/* ── Layout: ажилтаны дэлгэрэнгүй хуудастай ижил — зүүн 1/4 карт, баруун 3/4 үйлдэл ── */}
                <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
                    {/* ─── Зүүн багана (xl:col-span-1): Сургалтын мэдээлэл карт — ажилтаны карттай ижил хэмжээ ─── */}
                    <div className="xl:col-span-1 space-y-4">
                        <Card className="shadow-sm">
                            <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
                                <CardTitle className="text-base">Сургалтын мэдээлэл</CardTitle>
                                <Button variant="outline" size="sm" onClick={() => setEditDialogOpen(true)}>
                                    <Pencil className="h-4 w-4 mr-1.5" />
                                    Засах
                                </Button>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3 text-sm">
                                    <div><dt className="text-xs font-medium text-muted-foreground">Сургалт</dt><dd className="mt-0.5">{courses.find((c) => c.id === form.courseId)?.title ?? plan?.courseName ?? '—'}</dd></div>
                                    <div><dt className="text-xs font-medium text-muted-foreground">Хугацаа (улирал)</dt><dd className="mt-0.5">{form.scheduledQuarter ? `${quarter} ${year}` : '—'}</dd></div>
                                    <div><dt className="text-xs font-medium text-muted-foreground">Шалтгаан</dt><dd className="mt-0.5">{PLAN_TRIGGER_LABELS[form.trigger as keyof typeof PLAN_TRIGGER_LABELS] ?? form.trigger}</dd></div>
                                    <div><dt className="text-xs font-medium text-muted-foreground">Төсөв (₮)</dt><dd className="mt-0.5">{form.budget != null && form.budget > 0 ? form.budget.toLocaleString('mn-MN') : '—'}</dd></div>
                                    <div><dt className="text-xs font-medium text-muted-foreground">Зорилго</dt><dd className="mt-0.5">{form.purpose || '—'}</dd></div>
                                    <div><dt className="text-xs font-medium text-muted-foreground">Төрөл</dt><dd className="mt-0.5">{form.planType ? PLAN_TYPE_LABELS[form.planType as keyof typeof PLAN_TYPE_LABELS] : '—'}</dd></div>
                                    <div><dt className="text-xs font-medium text-muted-foreground">Хэлбэр</dt><dd className="mt-0.5">{form.format ? PLAN_FORMAT_LABELS[form.format as keyof typeof PLAN_FORMAT_LABELS] : '—'}</dd></div>
                                    <div><dt className="text-xs font-medium text-muted-foreground">Сурагт авах байдал</dt><dd className="mt-0.5">{form.providerType ? PLAN_PROVIDER_LABELS[form.providerType as keyof typeof PLAN_PROVIDER_LABELS] : '—'}</dd></div>
                                    <div><dt className="text-xs font-medium text-muted-foreground">Хариуцсан эзэн</dt><dd className="mt-0.5">{form.owner || '—'}</dd></div>
                                    <div><dt className="text-xs font-medium text-muted-foreground">Үнэлгээний арга</dt><dd className="mt-0.5">{form.assessmentMethod ? ASSESSMENT_METHOD_LABELS[form.assessmentMethod as keyof typeof ASSESSMENT_METHOD_LABELS] : '—'}</dd></div>
                                    <div className="sm:col-span-2"><dt className="text-xs font-medium text-muted-foreground">Байршил / холбоос</dt><dd className="mt-0.5">{form.locationOrLink || '—'}</dd></div>
                                    <div className="sm:col-span-2"><dt className="text-xs font-medium text-muted-foreground">Тайлбар</dt><dd className="mt-0.5 whitespace-pre-wrap">{form.notes || '—'}</dd></div>
                                </dl>
                                <Separator />
                                <div>
                                    <p className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1.5"><Tag className="h-3.5 w-3.5" /> Ангилал</p>
                                    <div className="flex flex-wrap gap-1">
                                        {(form.categoryIds ?? []).length === 0 ? <span className="text-sm text-muted-foreground">—</span> : (form.categoryIds ?? []).map((id) => (
                                            <Badge key={id} variant="outline" className="text-xs">{categories.find((c) => c.id === id)?.name ?? id}</Badge>
                                        ))}
                                    </div>
                                </div>
                                <div>
                                    <p className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1.5"><Users className="h-3.5 w-3.5" /> Оролцогчид ({(form.participantIds ?? []).length})</p>
                                    <div className="flex flex-wrap gap-1">
                                        {(form.participantIds ?? []).length === 0 ? <span className="text-sm text-muted-foreground">Оролцогч сонгоогүй</span> : (form.participantIds ?? []).map((id) => {
                                            const emp = employees.find((e) => e.id === id);
                                            return <Badge key={id} variant="outline" className="text-xs">{emp ? `${emp.lastName?.charAt(0)}. ${emp.firstName}` : id}</Badge>;
                                        })}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Түүх — төлөвийн түүх, огноо, төлөвөөс хамаарах үйлдлүүд */}
                        <Card className="shadow-sm">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-base flex items-center gap-2"><ClipboardCheck className="h-4 w-4 text-blue-600" /> Түүх</CardTitle>
                            </CardHeader>
                            <CardContent className="text-sm space-y-2">
                                <div className="flex justify-between items-center"><span className="text-muted-foreground">Төлөв</span><Badge className={statusColor[form.status]}>{PLAN_STATUS_LABELS[form.status]}</Badge></div>
                                {plan?.createdAt && <div className="flex justify-between"><span className="text-muted-foreground">Үүсгэсэн</span><span className="text-xs">{new Date(plan.createdAt).toLocaleDateString('mn-MN')}</span></div>}
                                {plan?.startedAt && <div className="flex justify-between"><span className="text-muted-foreground">Эхэлсэн</span><span className="text-xs">{new Date(plan.startedAt).toLocaleDateString('mn-MN')}</span></div>}
                                {plan?.completedAt && (form.status === 'published' || form.status === 'completed') && <div className="flex justify-between"><span className="text-muted-foreground">{form.status === 'published' ? 'Зарлагдсан' : 'Дууссан'}</span><span className="text-xs">{new Date(plan.completedAt).toLocaleDateString('mn-MN')}</span></div>}
                                {plan?.completedAt && form.status === 'cancelled' && <div className="flex justify-between"><span className="text-muted-foreground">Цуцалсан</span><span className="text-xs">{new Date(plan.completedAt).toLocaleDateString('mn-MN')}</span></div>}
                                {form.status === 'cancelled' && (
                                    <div className="pt-2">
                                        <Button variant="destructive" size="sm" className="w-full" onClick={() => setDeleteDialogOpen(true)} disabled={deleting}>
                                            <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                                            Сургалтыг устгах
                                        </Button>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    {/* ─── Баруун багана (xl:col-span-3): Төлөв + төлөвөөс хамаарах үйлдэл/контент — урт зай ─── */}
                    <div className="xl:col-span-3 space-y-6">
                        {/* Сургалтын төлөв (процесс бар) */}
                        <Card className="overflow-hidden">
                            <CardContent className="p-4">
                                <p className="text-xs font-medium text-muted-foreground mb-3">Сургалтын төлөв</p>
                                <p className="text-xs text-muted-foreground mb-3">Шат дээр дарж төлөв солино. Солиход автоматаар хадгалагдана.</p>
                                <div className="flex flex-wrap items-center gap-1 sm:gap-0">
                                    {processSteps.map((step, idx) => {
                                        const isActive = form.status === step.id || (form.status === 'overdue' && step.id === 'scheduled');
                                        const isPast = effectiveStepIndex > idx;
                                        return (
                                            <React.Fragment key={step.id}>
                                                {idx > 0 && (
                                                    <div className={cn('hidden sm:block w-8 lg:w-12 h-0.5 shrink-0', effectiveStepIndex >= idx ? 'bg-primary' : 'bg-muted')} />
                                                )}
                                                <button
                                                    type="button"
                                                    onClick={() => { if (step.id === form.status) return; openStatusConfirm(step.id); }}
                                                    disabled={saving}
                                                    className={cn(
                                                        'flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium transition-all min-w-0',
                                                        'hover:ring-2 hover:ring-offset-2 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50',
                                                        isActive && statusColor[step.id] && `${statusColor[step.id]} ring-2 ring-offset-2 ring-current`,
                                                        isActive && !statusColor[step.id] && 'bg-primary text-primary-foreground ring-2 ring-offset-2 ring-primary',
                                                        !isActive && isPast && 'bg-muted text-muted-foreground hover:bg-muted/80',
                                                        !isActive && !isPast && 'bg-muted/60 text-muted-foreground hover:bg-muted'
                                                    )}
                                                >
                                                    <span className={cn('flex h-5 w-5 items-center justify-center rounded-full shrink-0', isActive ? 'bg-white/20' : 'bg-background/60')}>
                                                        {isPast && !isActive ? <Check className="h-3 w-3" /> : <Circle className={cn('h-2.5 w-2.5', isActive && 'fill-current')} />}
                                                    </span>
                                                    <span className="truncate">{step.label}</span>
                                                </button>
                                            </React.Fragment>
                                        );
                                    })}
                                </div>
                            </CardContent>
                        </Card>

                        {/* Төлөв бүрт харгалзах контент */}
                        {(form.status === 'scheduled' || form.status === 'overdue') && (
                            <>
                                <Card ref={publishCardRef}>
                                    <CardHeader className="pb-3">
                                        <CardTitle className="text-base flex items-center gap-2"><CalendarDays className="h-4 w-4 text-emerald-600" /> Сургалт зарлах</CardTitle>
                                        <CardDescription>
                                            Төлөвлөсөн улирлын ({form.scheduledQuarter || plan?.scheduledQuarter || '—'}) хугацаанд огноо сонгоод төсөл үүсгэнэ
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-3">
                                        {(() => {
                                            const quarter = form?.scheduledQuarter || plan?.scheduledQuarter;
                                            const quarterRange = quarter ? quarterToDateRange(quarter) : null;
                                            return (
                                                <>
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-medium text-muted-foreground">Эхлэх огноо</label>
                                            <Input
                                                type="date"
                                                className="h-9"
                                                value={publishStartDate}
                                                onChange={(e) => {
                                                    const v = e.target.value;
                                                    setPublishStartDate(v);
                                                    setPublishEndDate(v);
                                                }}
                                                min={quarterRange?.start}
                                                max={quarterRange?.end}
                                                title={quarterRange ? `${quarterRange.start} - ${quarterRange.end}` : undefined}
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-medium text-muted-foreground">Дуусах огноо (заавал биш)</label>
                                            <Input
                                                type="date"
                                                className="h-9"
                                                value={publishEndDate}
                                                onChange={(e) => setPublishEndDate(e.target.value)}
                                                min={quarterRange?.start}
                                                max={quarterRange?.end}
                                                title={quarterRange ? `${quarterRange.start} - ${quarterRange.end}` : undefined}
                                            />
                                            <p className="text-[11px] text-muted-foreground">Нэг өдрийн сургалт бол дуусах огноо оруулахгүй орхино. Оруулаагүй бол эхлэх огноо нь дуусах огноо болно.</p>
                                        </div>
                                        {quarterRange && (publishStartDate < quarterRange.start || publishStartDate > quarterRange.end || (publishEndDate && (publishEndDate < quarterRange.start || publishEndDate > quarterRange.end))) && (
                                            <p className="text-xs text-destructive">Огноо төлөвлөсөн улирлын ({quarter}) хугацаанд ({quarterRange.start} – {quarterRange.end}) байх ёстой.</p>
                                        )}
                                        {publishStartDate && publishEndDate && publishEndDate < publishStartDate && <p className="text-xs text-destructive">Дуусах огноо эхлэх огнооноос хойно байх ёстой.</p>}
                                        <Button
                                            className="w-full"
                                            onClick={handlePublish}
                                            disabled={Boolean(
                                                publishing ||
                                                !publishStartDate ||
                                                (publishEndDate && publishEndDate < publishStartDate) ||
                                                (!!quarterRange && (publishStartDate < quarterRange.start || publishStartDate > quarterRange.end || (publishEndDate && (publishEndDate < quarterRange.start || publishEndDate > quarterRange.end))))
                                            )}
                                        >
                                            <Send className="h-4 w-4 mr-2" />{publishing ? 'Зарлаж байна...' : 'Зарлах & Төсөл үүсгэх'}
                                        </Button>
                                                </>
                                            );
                                        })()}
                                        <Button variant="outline" className="w-full text-muted-foreground" onClick={() => openStatusConfirm('cancelled')} disabled={saving}>
                                            <X className="h-4 w-4 mr-2" />
                                            Цуцлах
                                        </Button>
                                    </CardContent>
                                </Card>
                            </>
                        )}

                        {(form.status === 'in_progress') && (
                            <>
                                {/* Явагдаж буй шатанд зөвхөн ирц бүртгэнэ, зарлахгүй */}
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
                                    Оролцогчдын ирцийг сургалт дээр бүртгэнэ
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                {/* in_progress үед ирц бүртгэнэ */}
                                <>
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

                                        {/* Ирцийн жагсаалт — нэг сургалтын ирц */}
                                        {(form.participantIds ?? []).length === 0 ? (
                                            <p className="text-xs text-muted-foreground py-2 px-2 rounded-lg bg-amber-50/80 border border-amber-200/60">
                                                Эхлээд зүүн талаас оролцогчдыг сонгоно уу.
                                            </p>
                                        ) : (sessions.length === 0 ? (
                                            <p className="text-xs text-muted-foreground text-center py-2">
                                                Ирц бүртгэх бол доорх &quot;Ирц хадгалах&quot; дарснаар бүртгэгдэнэ.
                                            </p>
                                        ) : (
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
                                                                <span className="text-xs font-medium">{formatSessionDate(session.date)}</span>
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
                                                                <div className="flex justify-end border-t px-2 py-1.5">
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
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                        ))}

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
                            </CardContent>
                        </Card>
                            </>
                        )}

                        {(form.status === 'published') && (
                            <Card>
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-base flex items-center gap-2">Зарлагдсан төлөв</CardTitle>
                                    <CardDescription className="text-xs">Холбоотой төслийг үзэх эсвэл сургалтыг цуцлах. Цуцлах үед төсөл дагаж устгагдана.</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-2">
                                    {plan?.projectId && (
                                        <Button variant="outline" size="sm" className="w-full" onClick={() => router.push(`/dashboard/projects/${plan.projectId}`)}>
                                            Төсөл үзэх →
                                        </Button>
                                    )}
                                    <Button variant="outline" size="sm" className="w-full text-muted-foreground" onClick={() => openStatusConfirm('cancelled')} disabled={saving}>
                                        <X className="h-3.5 w-3.5 mr-1.5" />
                                        Цуцлах
                                    </Button>
                                    <p className="text-[11px] text-muted-foreground">Цуцлах үед холбоотой төсөл устгагдана.</p>
                                </CardContent>
                            </Card>
                        )}

                        {(form.status === 'completed') && (
                            <>
                                {attendanceSummary && (
                                    <Card>
                                        <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Users className="h-4 w-4 text-amber-600" /> Ирцийн дүн</CardTitle></CardHeader>
                                        <CardContent>
                                            <div className="flex justify-between text-sm"><span className="text-muted-foreground">Нийт ирц</span><span className="font-medium">{attendanceSummary.rate}%</span></div>
                                            <div className="h-2 bg-slate-200 rounded-full overflow-hidden mt-1"><div className="h-full bg-emerald-500 rounded-full" style={{ width: `${attendanceSummary.rate}%` }} /></div>
                                        </CardContent>
                                    </Card>
                                )}
                                <Card>
                                    <CardHeader className="pb-3">
                                        <CardTitle className="text-base flex items-center gap-2"><BarChart3 className="h-4 w-4 text-violet-600" /> Үнэлгээ</CardTitle>
                                        <CardDescription className="text-xs">Сургалтын сэтгэл ханамжийн стандарт судалгаагаар оролцогчдоос үнэлгээ авна. &quot;Үнэлгээ авах&quot; дарж санал асуулга үүсгэнэ.</CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        {linkedSurveys && linkedSurveys.length > 0 && (
                                            <div className="space-y-2">
                                                <p className="text-xs font-medium text-muted-foreground">Энэ сургалтад холбогдсон санал асуулга</p>
                                                <ul className="space-y-1.5">
                                                    {linkedSurveys.map((s) => (
                                                        <li key={s.id} className="flex items-center justify-between gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm">
                                                            <span className="truncate">{s.title}</span>
                                                            <div className="flex shrink-0 gap-1">
                                                                <Badge variant="secondary" className="text-xs">{SURVEY_STATUS_LABELS[s.status]}</Badge>
                                                                <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => router.push(`/dashboard/survey/${s.id}`)}>
                                                                    <ExternalLink className="h-3.5 w-3.5" />
                                                                </Button>
                                                                <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => router.push(`/dashboard/survey/${s.id}/results`)}>
                                                                    Хариулт
                                                                </Button>
                                                            </div>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                        {trainingEvaluationTemplate && (
                                            <div className="rounded-lg border bg-muted/20 p-3 space-y-3">
                                                <div className="flex items-start gap-2">
                                                    <FileText className="h-4 w-4 shrink-0 text-violet-600 mt-0.5" />
                                                    <div className="min-w-0">
                                                        <p className="text-sm font-medium">{trainingEvaluationTemplate.title}</p>
                                                        <p className="text-xs text-muted-foreground mt-0.5">{trainingEvaluationTemplate.description}</p>
                                                        <p className="text-xs text-muted-foreground mt-1">{trainingEvaluationTemplate.questions?.length ?? 0} асуулт</p>
                                                    </div>
                                                </div>
                                                <Button
                                                    className="w-full"
                                                    disabled={creatingSurveyId !== null}
                                                    onClick={() => handleCreateEvaluationSurvey(trainingEvaluationTemplate as Parameters<typeof handleCreateEvaluationSurvey>[0])}
                                                >
                                                    {creatingSurveyId ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                                                    Үнэлгээ авах
                                                </Button>
                                            </div>
                                        )}
                                        {!trainingEvaluationTemplate && (
                                            <p className="text-xs text-muted-foreground py-2 text-center">Сургалтын үнэлгээний загвар олдсонгүй.</p>
                                        )}
                                    </CardContent>
                                </Card>
                            </>
                        )}

                        {(form.status === 'cancelled') && (
                            <Card>
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-base flex items-center gap-2">Цуцалсан төлөв</CardTitle>
                                    <CardDescription className="text-xs">Сургалтыг дахин төлөвлөх эсвэл бүрмөсөн устгана.</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-2">
                                    <Button variant="outline" size="sm" className="w-full" onClick={() => openStatusConfirm('scheduled')} disabled={saving}>
                                        <CalendarDays className="h-3.5 w-3.5 mr-1.5" />
                                        Дахин төлөвлөх
                                    </Button>
                                    <p className="text-[11px] text-muted-foreground">Төлөвлөгдсөн төлөв рүү шилжүүлнэ. Дараа нь дахин зарлаж болно.</p>
                                </CardContent>
                            </Card>
                        )}
                    </div>
                </div>

                {/* Засах dialog — мэдээлэл засах ── */}
                <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
                    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>Сургалтын мэдээлэл засах</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-muted-foreground">Сургалт</label>
                                    <Select value={form.courseId} onValueChange={(v) => setField('courseId', v)}>
                                        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                                        <SelectContent>{courses.map((c) => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}</SelectContent>
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
                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-muted-foreground">Төсөв (₮)</label>
                                    <Input type="number" className="h-9" placeholder="0" min={0} value={form.budget ?? ''} onChange={(e) => setField('budget', e.target.value ? Number(e.target.value) : undefined)} />
                                </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-1.5"><label className="text-xs font-medium text-muted-foreground">Зорилго</label><Input className="h-9" value={form.purpose ?? ''} onChange={(e) => setField('purpose', e.target.value)} /></div>
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
                                <div className="space-y-1.5"><label className="text-xs font-medium text-muted-foreground">Хариуцсан эзэн</label><Input className="h-9" value={form.owner ?? ''} onChange={(e) => setField('owner', e.target.value)} /></div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-muted-foreground">Үнэлгээний арга</label>
                                    <Select value={form.assessmentMethod || ''} onValueChange={(v) => setField('assessmentMethod', v)}>
                                        <SelectTrigger className="h-9"><SelectValue placeholder="Сонгох" /></SelectTrigger>
                                        <SelectContent>{ASSESSMENT_METHODS.map((m) => <SelectItem key={m} value={m}>{ASSESSMENT_METHOD_LABELS[m]}</SelectItem>)}</SelectContent>
                                    </Select>
                                </div>
                                <div className="sm:col-span-2 space-y-1.5"><label className="text-xs font-medium text-muted-foreground">Байршил / холбоос</label><Input className="h-9" value={form.locationOrLink ?? ''} onChange={(e) => setField('locationOrLink', e.target.value)} /></div>
                                <div className="sm:col-span-2 space-y-1.5"><label className="text-xs font-medium text-muted-foreground">Тайлбар</label><Textarea rows={2} value={form.notes ?? ''} onChange={(e) => setField('notes', e.target.value)} /></div>
                            </div>
                            <Separator />
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-muted-foreground">Ангилал</label>
                                <ScrollArea className="h-24 rounded-lg border p-2">
                                    <div className="space-y-1">
                                        {categories.map((cat) => (
                                            <label key={cat.id} className="flex items-center gap-2 cursor-pointer">
                                                <Checkbox checked={(form.categoryIds ?? []).includes(cat.id)} onCheckedChange={() => toggleArrayValue('categoryIds', cat.id)} />
                                                <span className="text-sm">{cat.name}</span>
                                            </label>
                                        ))}
                                    </div>
                                </ScrollArea>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-muted-foreground">Оролцогчид</label>
                                <ScrollArea className="h-32 rounded-lg border p-2">
                                    <div className="space-y-1">
                                        {employees.map((emp) => (
                                            <label key={emp.id} className="flex items-center gap-2 cursor-pointer">
                                                <Checkbox checked={(form.participantIds ?? []).includes(emp.id)} onCheckedChange={() => toggleArrayValue('participantIds', emp.id)} />
                                                <span className="text-sm">{emp.lastName?.charAt(0)}. {emp.firstName}</span>
                                            </label>
                                        ))}
                                    </div>
                                </ScrollArea>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Цуцлах</Button>
                            <Button onClick={async () => { await handleSave(); setEditDialogOpen(false); }} disabled={saving}>{saving ? 'Хадгалж байна...' : 'Хадгалах'}</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </div>
    );
}

