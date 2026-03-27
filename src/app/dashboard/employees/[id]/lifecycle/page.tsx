'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import { useDoc, useCollection, useMemoFirebase, tenantCollection, useTenantWrite } from '@/firebase';
import { arrayUnion, getDocs, query, updateDoc, where, writeBatch } from 'firebase/firestore';
import { Employee } from '@/types';
import { PageHeader } from '@/components/patterns/page-layout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import {
    ChevronLeft,
    ChevronRight,
    UserPlus,
    FileCheck,
    Rocket,
    TrendingUp,
    Heart,
    LogOut,
    Archive,
    User,
    Lock,
    UserCircle2,
    Check,
    AlertCircle,
    ArrowRight,
    Sparkles,
    RotateCcw
} from 'lucide-react';
import Link from 'next/link';
import { updateDocumentNonBlocking } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import type { Project, Task } from '@/types/project';

// Define the stages with their metadata and hex colors for the gradient
const STAGES = [
    {
        id: 'attraction',
        index: 0,
        title: 'Attraction',
        subtitle: 'Татах',
        icon: UserPlus,
        color: 'text-blue-500',
        hex: '#3B82F6',
        bg: 'bg-blue-50',
        border: 'border-blue-200',
        description: 'Байгууллагын брэнд, авьяасын сан бүрдүүлэлт'
    },
    {
        id: 'recruitment',
        index: 1,
        title: 'Recruitment',
        subtitle: 'Бүрдүүлэлт',
        icon: FileCheck,
        color: 'text-indigo-500',
        hex: '#6366F1',
        bg: 'bg-indigo-50',
        border: 'border-indigo-200',
        description: 'Сонгон шалгаруулалт, ажилд авах шийдвэр'
    },
    {
        id: 'onboarding',
        index: 2,
        title: 'Onboarding',
        subtitle: 'Чиглүүлэх',
        icon: Rocket,
        color: 'text-emerald-500',
        hex: '#10B981',
        bg: 'bg-emerald-50',
        border: 'border-emerald-200',
        description: 'Дасан зохицох хөтөлбөр, туршилтын хугацаа'
    },
    {
        id: 'development',
        index: 3,
        title: 'Development',
        subtitle: 'Хөгжүүлэлт',
        icon: TrendingUp,
        color: 'text-violet-500',
        hex: '#8B5CF6',
        bg: 'bg-violet-50',
        border: 'border-violet-200',
        description: 'Сургалт, ур чадварын үнэлгээ, карьер өсөлт'
    },
    {
        id: 'retention',
        index: 4,
        title: 'Retention',
        subtitle: 'Тогтворжилт',
        icon: Heart,
        color: 'text-rose-500',
        hex: '#F43F5E',
        bg: 'bg-rose-50',
        border: 'border-rose-200',
        description: 'Гүйцэтгэлийн үнэлгээ, шагнал урамшуулал'
    },
    {
        id: 'offboarding',
        index: 5,
        title: 'Offboarding',
        subtitle: 'Гарах',
        icon: LogOut,
        color: 'text-amber-500',
        hex: '#F59E0B',
        bg: 'bg-amber-50',
        border: 'border-amber-200',
        description: 'Ажлаас гарах үйл явц, хүлээлцэх, тооцоо'
    },
    {
        id: 'alumni',
        index: 6,
        title: 'Alumni',
        subtitle: 'Төгсөгч',
        icon: Archive,
        color: 'text-slate-500',
        hex: '#64748B',
        bg: 'bg-slate-50',
        border: 'border-slate-200',
        description: 'Төгсөгчийн холбоо, дахин ажилд авах боломж'
    }
];

export default function EmployeeLifecyclePage() {
    const { id } = useParams();
    const employeeId = Array.isArray(id) ? id[0] : id;
    const { firestore, tDoc, tCollection } = useTenantWrite();

    // State for the rotation
    const [activeIndex, setActiveIndex] = React.useState(2); // Default to Onboarding

    // Load employee data for the avatar
    const employeeRef = React.useMemo(() =>
        firestore && employeeId ? tDoc('employees', employeeId) : null,
        [firestore, employeeId, tDoc]);
    const { data: employee } = useDoc<Employee>(employeeRef as any);

    // Sync active index with employee's lifecycle stage
    React.useEffect(() => {
        if (employee?.lifecycleStage) {
            const index = STAGES.findIndex(s => s.id === employee.lifecycleStage);
            if (index !== -1) {
                setActiveIndex(index);
            }
        }
    }, [employee?.lifecycleStage]);

    const activeStage = STAGES[activeIndex];
    const { toast } = useToast();

    const lastDeparture = React.useMemo(() => {
        const history = (employee as any)?.employmentHistory as any[] | undefined;
        if (!Array.isArray(history) || history.length === 0) return null;
        const departures = history.filter((h) => h?.type === 'departure');
        if (departures.length === 0) return null;
        return departures[departures.length - 1] ?? null;
    }, [employee]);

    const onboardingProjectsQuery = useMemoFirebase(({ firestore, companyPath }) => {
        if (!firestore || !employeeId) return null;
        return query(
            tenantCollection(firestore, companyPath, 'projects'),
            where('type', '==', 'onboarding'),
            where('onboardingEmployeeId', '==', employeeId),
        );
    }, [employeeId]);
    const { data: onboardingProjects } = useCollection<Project>(onboardingProjectsQuery as any);

    const offboardingProjectsQuery = useMemoFirebase(({ firestore, companyPath }) => {
        if (!firestore || !employeeId) return null;
        return query(
            tenantCollection(firestore, companyPath, 'projects'),
            where('type', '==', 'offboarding'),
            where('offboardingEmployeeId', '==', employeeId),
        );
    }, [employeeId]);
    const { data: offboardingProjects } = useCollection<Project>(offboardingProjectsQuery as any);

    const [onboardingTaskSummary, setOnboardingTaskSummary] = React.useState<{
        total: number;
        done: number;
        startedAt: Date | null;
        firstProjectId: string | null;
    } | null>(null);

    const [offboardingTaskSummary, setOffboardingTaskSummary] = React.useState<{
        total: number;
        done: number;
        startedAt: Date | null;
        firstProjectId: string | null;
    } | null>(null);

    React.useEffect(() => {
        let cancelled = false;
        const run = async () => {
            if (!firestore) return;
            if (!onboardingProjects) {
                if (!cancelled) setOnboardingTaskSummary(null);
                return;
            }
            if (onboardingProjects.length === 0) {
                if (!cancelled) setOnboardingTaskSummary(null);
                return;
            }

            const sorted = [...onboardingProjects].sort((a, b) => (a.stageOrder || 0) - (b.stageOrder || 0));
            const startedAt = sorted
                .map((p) => (p as any)?.createdAt?.toDate?.() as Date | undefined)
                .filter(Boolean)
                .sort((a, b) => (a as Date).getTime() - (b as Date).getTime())[0] ?? null;

            let total = 0;
            let done = 0;
            for (const p of sorted) {
                const tasksSnap = await getDocs(tCollection('projects', p.id, 'tasks'));
                tasksSnap.forEach((d) => {
                    const t = d.data() as Task;
                    total += 1;
                    if (t.status === 'DONE') done += 1;
                });
            }

            if (!cancelled) {
                setOnboardingTaskSummary({
                    total,
                    done,
                    startedAt,
                    firstProjectId: sorted[0]?.id || null,
                });
            }
        };
        run();
        return () => {
            cancelled = true;
        };
    }, [firestore, onboardingProjects]);

    React.useEffect(() => {
        let cancelled = false;
        const run = async () => {
            if (!firestore) return;
            if (!offboardingProjects) {
                if (!cancelled) setOffboardingTaskSummary(null);
                return;
            }
            if (offboardingProjects.length === 0) {
                if (!cancelled) setOffboardingTaskSummary(null);
                return;
            }

            const sorted = [...offboardingProjects].sort((a, b) => (a.stageOrder || 0) - (b.stageOrder || 0));
            const startedAt = sorted
                .map((p) => (p as any)?.createdAt?.toDate?.() as Date | undefined)
                .filter(Boolean)
                .sort((a, b) => (a as Date).getTime() - (b as Date).getTime())[0] ?? null;

            let total = 0;
            let done = 0;
            for (const p of sorted) {
                const tasksSnap = await getDocs(tCollection('projects', p.id, 'tasks'));
                tasksSnap.forEach((d) => {
                    const t = d.data() as Task;
                    total += 1;
                    if (t.status === 'DONE') done += 1;
                });
            }

            if (!cancelled) {
                setOffboardingTaskSummary({
                    total,
                    done,
                    startedAt,
                    firstProjectId: sorted[0]?.id || null,
                });
            }
        };
        run();
        return () => {
            cancelled = true;
        };
    }, [firestore, offboardingProjects]);

    const deleteEmployeeProjects = React.useCallback(async (params: {
        type: 'onboarding' | 'offboarding';
        employeeField: 'onboardingEmployeeId' | 'offboardingEmployeeId';
    }) => {
        if (!firestore || !employeeId) return;

        const q = query(
            tCollection('projects'),
            where('type', '==', params.type),
            where(params.employeeField, '==', employeeId),
        );

        const projectsSnap = await getDocs(q);
        const projectDocs = projectsSnap.docs;
        if (projectDocs.length === 0) return;

        const deletes: Array<{ projectId: string; taskDocIds: string[] }> = [];
        for (const pDoc of projectDocs) {
            const projectId = pDoc.id;
            const tasksSnap = await getDocs(tCollection('projects', projectId, 'tasks'));
            deletes.push({ projectId, taskDocIds: tasksSnap.docs.map((d) => d.id) });
        }

        // Firestore batch limit is 500. Keep some buffer.
        let batch = writeBatch(firestore);
        let ops = 0;
        const commitIfNeeded = async () => {
            if (ops === 0) return;
            await batch.commit();
            batch = writeBatch(firestore);
            ops = 0;
        };

        for (const item of deletes) {
            for (const taskId of item.taskDocIds) {
                batch.delete(tDoc('projects', item.projectId, 'tasks', taskId));
                ops += 1;
                if (ops >= 450) await commitIfNeeded();
            }
            batch.delete(tDoc('projects', item.projectId));
            ops += 1;
            if (ops >= 450) await commitIfNeeded();
        }

        await commitIfNeeded();
    }, [firestore, employeeId]);

    const [isSavingStage, setIsSavingStage] = React.useState(false);

    const handleMoveToStage = async (stageId: string) => {
        if (!firestore || !employeeId) return;
        setIsSavingStage(true);
        try {
            await updateDoc(tDoc('employees', employeeId), {
                lifecycleStage: stageId
            });
            toast({
                title: 'Үе шат шинэчлэгдлээ',
                description: `Ажилтны үе шат ${STAGES.find(s => s.id === stageId)?.title} болж өөрчлөгдлөө.`
            });
        } catch (error) {
            console.error(error);
            toast({
                variant: 'destructive',
                title: 'Алдаа гарлаа',
                description: 'Үе шатыг шинэчлэхэд алдаа гарлаа. Дахин оролдоно уу.'
            });
        } finally {
            setIsSavingStage(false);
        }
    };

    const [isRehiring, setIsRehiring] = React.useState(false);

    const handleRehire = async () => {
        if (!firestore || !employeeId || !employee) return;
        setIsRehiring(true);
        try {
            // Build employment history entry
            const historyEntry = {
                type: 'rehire',
                date: new Date().toISOString(),
                previousAlumniDate: lastDeparture?.lastWorkingDate || lastDeparture?.date || null,
                previousPosition: employee.jobTitle || null,
                previousDepartmentId: employee.departmentId || null,
                offboardingReason: lastDeparture?.reason || null,
                note: `${new Date().getFullYear()} онд дахин ажилд авсан`
            };

            // 1. Reset employee to fresh state + add history log
            updateDocumentNonBlocking(tDoc('employees', employeeId), {
                status: 'active',
                lifecycleStage: 'recruitment',
                positionId: null,
                jobTitle: null,
                departmentId: null,
                // Add to employment history array
                employmentHistory: arrayUnion(historyEntry),
                rehireCount: (employee as any).rehireCount ? (employee as any).rehireCount + 1 : 1,
                lastRehireDate: new Date().toISOString()
            });

            try {
                // 2. Delete old offboarding/onboarding projects (project-based)
                await deleteEmployeeProjects({ type: 'offboarding', employeeField: 'offboardingEmployeeId' });
                await deleteEmployeeProjects({ type: 'onboarding', employeeField: 'onboardingEmployeeId' });
            } catch (e) {
                console.warn("Failed to delete lifecycle projects:", e);
            }

            toast({
                title: 'Дахин ажилд авах бэлэн',
                description: 'Ажилтны түүхэнд бичигдсэн. Одоо ажлын байр руу томилно уу.',
            });

            // Move to recruitment stage visually
            setActiveIndex(STAGES.findIndex(s => s.id === 'recruitment'));
        } catch (error) {
            console.error(error);
            toast({
                variant: 'destructive',
                title: 'Алдаа гарлаа',
                description: 'Дахин ажилд авахад алдаа гарлаа.'
            });
        } finally {
            setIsRehiring(false);
        }
    };

    // Auto-suggest retention logic
    const shouldSuggestRetention = React.useMemo(() => {
        if (employee?.lifecycleStage === 'development' && employee?.hireDate) {
            const hireDate = new Date(employee.hireDate);
            const oneYearAgo = new Date();
            oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
            return hireDate < oneYearAgo;
        }
        return false;
    }, [employee?.lifecycleStage, employee?.hireDate]);

    const onboardingProgressPct = React.useMemo(() => {
        if (!onboardingTaskSummary || onboardingTaskSummary.total === 0) return 0;
        return Math.round((onboardingTaskSummary.done / onboardingTaskSummary.total) * 100);
    }, [onboardingTaskSummary]);

    const offboardingProgressPct = React.useMemo(() => {
        if (!offboardingTaskSummary || offboardingTaskSummary.total === 0) return 0;
        return Math.round((offboardingTaskSummary.done / offboardingTaskSummary.total) * 100);
    }, [offboardingTaskSummary]);

    // --- Logic for Segmented Circle ---
    const totalStages = STAGES.length;
    const anglePerStage = 360 / totalStages; // ~51.4 degrees

    // Calculate conic gradient string
    // Each segment i goes from (i * angle) to ((i+1) * angle)
    const conicGradient = React.useMemo(() => {
        const segments = STAGES.map((stage, i) => {
            const start = i * anglePerStage;
            const end = (i + 1) * anglePerStage;
            // Use lighter version of the color for the segment background
            return `${stage.hex}20 ${start}deg ${end}deg`; // 20 is hex opacity ~12%
        });
        // Add borders between segments if needed. 
        // For distinct shapes, we can add white gaps.
        return `conic-gradient(${segments.join(', ')})`;
    }, [anglePerStage]);

    // Active Segment Highlight
    // We want the active segment to be distinctly colored (full opacity).
    // We can overlay a second gradient or just change the style.
    // Simpler: Just render the segments as a background, and active index logic highlights the icon.
    // BUT user said "7 colored shapes".
    // Let's make the background gradient permanent.

    // Rotation Logic:
    // We want the Active Segment (centered at i*angle + angle/2) to be at Bottom (180deg).
    // Segment Center = i*angle + angle/2.
    // Container Rotation R.
    // Center + R = 180.
    // R = 180 - Center.
    const segmentCenterOffset = anglePerStage / 2;
    const targetPos = 180;
    const rotation = targetPos - (activeIndex * anglePerStage + segmentCenterOffset);


    const handleNext = () => {
        setActiveIndex((prev) => (prev + 1) % totalStages);
    };

    const handlePrev = () => {
        setActiveIndex((prev) => (prev - 1 + totalStages) % totalStages);
    };

    return (
        <div className="py-6 px-4 sm:px-6 min-h-screen container mx-auto max-w-7xl space-y-8">
            <PageHeader
                title="Employee Life Cycle"
                description="Ажилтны амьдралын мөчлөгийн удирдлага"
                breadcrumbs={[
                    { label: 'Ажилтан', href: '/dashboard/employees' },
                    { label: 'Хувийн хэрэг', href: `/dashboard/employees/${employeeId}` },
                    { label: 'Life Cycle' }
                ]}
                showBackButton
                backHref={`/dashboard/employees/${employeeId}`}
            />

            <div className="flex flex-col items-center justify-center space-y-12 py-10">
                {/* Circular Navigation Component */}
                <div className="relative w-[500px] h-[500px] flex items-center justify-center select-none">

                    {/* Central Avatar with pulsing rings */}
                    <div className="absolute z-20 h-40 w-40 rounded-full border-8 border-white shadow-2xl overflow-hidden bg-slate-100 flex items-center justify-center ring-1 ring-slate-100/50">
                        <Avatar className="h-full w-full">
                            <AvatarImage src={employee?.photoURL} className="object-cover" />
                            <AvatarFallback className="text-3xl font-bold text-slate-400 bg-slate-100">
                                {employee ? `${employee.firstName?.[0]}${employee.lastName?.[0]}` : <User />}
                            </AvatarFallback>
                        </Avatar>
                    </div>

                    {/* Active Indicator Arrow (pointing down to up, or just static at bottom) */}
                    {/* Currently using rotation to center at bottom. Let's add a static indicator at bottom if needed. */}

                    {/* Rotating Container */}
                    <div
                        className="absolute w-full h-full transition-transform duration-700 ease-[cubic-bezier(0.34,1.56,0.64,1)] will-change-transform" // Bouncy spring effect
                        style={{ transform: `rotate(${rotation}deg)` }}
                    >
                        {/* Segmented Background */}
                        <div
                            className="absolute inset-[40px] rounded-full border border-slate-100 shadow-inner"
                            style={{ background: conicGradient }}
                        >
                            {/* Inner white circle to create Donut shape */}
                            <div className="absolute inset-[80px] rounded-full bg-white shadow-lg" />
                        </div>

                        {/* Stages */}
                        {STAGES.map((stage, i) => {
                            // Position calculation
                            // Conic gradient starts at 0deg (Top).
                            // Segment i center is at i*angle + angle/2 from Top.
                            // Transform rotate(0) is Right (90deg from Top).
                            // So to align Item with Segment Center:
                            // ItemAngle = (i*angle + angle/2) - 90.

                            const segmentAngle = i * anglePerStage + segmentCenterOffset;
                            const transformAngle = segmentAngle - 90;

                            return (
                                <div
                                    key={stage.id}
                                    className="absolute top-1/2 left-1/2 -ml-8 -mt-8 w-16 h-16"
                                    style={{
                                        // Rotate to point toward segment center, translate out to donut ring
                                        transform: `rotate(${transformAngle}deg) translate(175px) rotate(90deg)`
                                        // translate 175px puts it in the middle of donut (radius roughly 250px outer, 120 inner)
                                    }}
                                >
                                    <div
                                        className={cn(
                                            "w-16 h-16 rounded-full flex items-center justify-center shadow-md transition-all duration-300 transform border-4",
                                            activeIndex === i
                                                ? cn("bg-white scale-125 z-10 shadow-xl", stage.border, stage.color)
                                                : "bg-white/90 border-transparent text-slate-400 scale-90 opacity-80 hover:scale-105 hover:opacity-100"
                                        )}
                                        onClick={() => setActiveIndex(i)}
                                        style={{
                                            // Counter rotation to keep icon upright.
                                            // Container rotates R. Item rotates `transformAngle + 90`.
                                            // Total visual rotation = R + transformAngle + 90.
                                            // To zero it: -(R + transformAngle + 90).
                                            transform: `rotate(${-(rotation + transformAngle + 90)}deg)`
                                        }}
                                    >
                                        <stage.icon className={cn("h-6 w-6")} />
                                    </div>

                                    {/* Label */}
                                    <div
                                        className={cn(
                                            "absolute left-1/2 -translate-x-1/2 mt-3 whitespace-nowrap text-[10px] font-black uppercase tracking-widest transition-all duration-300 bg-white/80 px-2 py-0.5 rounded-full backdrop-blur-sm",
                                            activeIndex === i ? "opacity-100 text-slate-800 -translate-y-24" : "opacity-0 translate-y-2"
                                        )}
                                        style={{
                                            // Label stays upright near the icon
                                            top: '100%',
                                            transform: `rotate(${-(rotation + transformAngle + 90)}deg)`
                                        }}
                                    >
                                        {/* We hide label on ring, show in center card */}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Navigation Controls */}
                <div className="flex gap-4">
                    <Button
                        variant="ghost" size="icon"
                        onClick={handlePrev}
                        className="h-14 w-14 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:scale-110 transition-all"
                    >
                        <ChevronLeft className="h-8 w-8" />
                    </Button>
                    <div className="h-1 w-12 bg-slate-100 rounded-full self-center" />
                    <Button
                        variant="ghost" size="icon"
                        onClick={handleNext}
                        className="h-14 w-14 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:scale-110 transition-all"
                    >
                        <ChevronRight className="h-8 w-8" />
                    </Button>
                </div>

                {/* Active Stage Details */}
                <Card className="w-full max-w-4xl border-none shadow-2xl shadow-indigo-100/30 bg-white overflow-hidden rounded-[3rem] relative z-20">
                    {/* Top colored bar matches active stage */}
                    <div className={cn("h-3 w-full", activeStage.bg.replace('/50', '/100').replace('50', '500'))} />

                    <CardContent className="p-12 text-center space-y-8">
                        <div className="space-y-4">
                            <Badge variant="outline" className={cn("px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest bg-white border-2", activeStage.border, activeStage.color)}>
                                Stage {activeIndex + 1}
                            </Badge>

                            <h2 className={cn("text-4xl font-black tracking-tight", activeStage.color)}>
                                {activeStage.title}
                            </h2>
                            <p className="text-sm font-bold text-slate-400 uppercase tracking-[0.3em]">{activeStage.subtitle}</p>
                        </div>

                        <p className="text-slate-600 font-medium leading-loose max-w-2xl mx-auto text-lg">
                            {activeStage.description}
                        </p>

                        <div className="pt-8">
                            {activeStage.id === 'onboarding' && onboardingTaskSummary ? (
                                <div className="space-y-8 w-full max-w-2xl mx-auto">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="p-6 rounded-3xl bg-slate-50 border border-slate-100 text-left">
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Эхэлсэн огноо</p>
                                            <p className="text-lg font-black text-slate-800">
                                                {onboardingTaskSummary.startedAt ? onboardingTaskSummary.startedAt.toLocaleDateString() : 'Тодорхойгүй'}
                                            </p>
                                        </div>
                                        <div className="p-6 rounded-3xl bg-slate-50 border border-slate-100 text-left">
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Нийт явц</p>
                                            <p className="text-lg font-black text-emerald-600">{onboardingProgressPct}%</p>
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        <h4 className="text-sm font-bold text-slate-400 uppercase tracking-widest text-left ml-2">Үе шатуудын түүх</h4>
                                        <div className="space-y-2">
                                            <div className="p-4 rounded-2xl bg-white border border-slate-100 shadow-sm">
                                                <div className="flex items-center justify-between">
                                                    <div className="text-left">
                                                        <p className="font-bold text-slate-800">Нийт таск</p>
                                                        <p className="text-[10px] font-bold text-slate-400 uppercase">
                                                            {onboardingTaskSummary.done}/{onboardingTaskSummary.total} дууссан
                                                        </p>
                                                    </div>
                                                    <Badge variant="outline" className="border-emerald-200 text-emerald-700">
                                                        {onboardingProjects?.length || 0} төсөл
                                                    </Badge>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <Button asChild variant="outline" className="w-full h-12 rounded-2xl border-2 border-slate-100 hover:bg-slate-50 text-slate-600 font-bold">
                                        <Link href={`/dashboard/onboarding/${employeeId}`}>
                                            Дэлгэрэнгүй хуудас руу очих
                                            <ChevronRight className="h-4 w-4 ml-2" />
                                        </Link>
                                    </Button>
                                </div>
                            ) : activeStage.id === 'offboarding' && offboardingTaskSummary ? (
                                <div className="space-y-8 w-full max-w-2xl mx-auto">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="p-6 rounded-3xl bg-amber-50 border border-amber-100 text-left">
                                            <p className="text-[10px] font-bold text-amber-600 uppercase tracking-widest mb-1">Эхэлсэн огноо</p>
                                            <p className="text-lg font-black text-slate-800">
                                                {offboardingTaskSummary.startedAt ? offboardingTaskSummary.startedAt.toLocaleDateString() : 'Тодорхойгүй'}
                                            </p>
                                        </div>
                                        <div className="p-6 rounded-3xl bg-amber-50 border border-amber-100 text-left">
                                            <p className="text-[10px] font-bold text-amber-600 uppercase tracking-widest mb-1">Нийт явц</p>
                                            <p className="text-lg font-black text-amber-600">{offboardingProgressPct}%</p>
                                        </div>
                                    </div>

                                    {lastDeparture?.reason && (
                                        <div className="p-6 rounded-3xl bg-rose-50 border border-rose-100 text-left">
                                            <p className="text-[10px] font-bold text-rose-600 uppercase tracking-widest mb-1">Чөлөөлөлтийн шалтгаан</p>
                                            <p className="text-base font-bold text-slate-800">
                                                {lastDeparture.reason === 'release_company' && 'Компанийн санаачилгаар'}
                                                {lastDeparture.reason === 'release_employee' && 'Ажилтны санаачилгаар'}
                                                {lastDeparture.reason === 'release_temporary' && 'Түр чөлөөлөлт'}
                                            </p>
                                        </div>
                                    )}

                                    {lastDeparture?.lastWorkingDate && (
                                        <div className="p-6 rounded-3xl bg-slate-50 border border-slate-100 text-left">
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Сүүлийн ажлын өдөр</p>
                                            <p className="text-lg font-black text-slate-800">
                                                {new Date(lastDeparture.lastWorkingDate).toLocaleDateString()}
                                            </p>
                                        </div>
                                    )}

                                    <div className="space-y-3">
                                        <h4 className="text-sm font-bold text-slate-400 uppercase tracking-widest text-left ml-2">Үе шатуудын явц</h4>
                                        <div className="space-y-2">
                                            <div className="p-4 rounded-2xl bg-white border border-slate-100 shadow-sm">
                                                <div className="flex items-center justify-between">
                                                    <div className="text-left">
                                                        <p className="font-bold text-slate-800">Нийт таск</p>
                                                        <p className="text-[10px] font-bold text-slate-400 uppercase">
                                                            {offboardingTaskSummary.done}/{offboardingTaskSummary.total} дууссан
                                                        </p>
                                                    </div>
                                                    <Badge variant="outline" className="border-amber-200 text-amber-700">
                                                        {offboardingProjects?.length || 0} төсөл
                                                    </Badge>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <Button asChild variant="outline" className="w-full h-12 rounded-2xl border-2 border-amber-100 hover:bg-amber-50 text-amber-700 font-bold">
                                        <Link href={`/dashboard/offboarding/${employeeId}`}>
                                            Дэлгэрэнгүй хуудас руу очих
                                            <ChevronRight className="h-4 w-4 ml-2" />
                                        </Link>
                                    </Button>
                                </div>
                            ) : activeStage.id === 'alumni' && employee?.lifecycleStage === 'alumni' ? (
                                <div className="space-y-8 w-full max-w-2xl mx-auto">
                                    {/* Alumni Info Card */}
                                    <div className="p-8 rounded-3xl bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200 text-center">
                                        <div className="h-16 w-16 rounded-2xl bg-slate-200 text-slate-500 flex items-center justify-center mx-auto mb-4">
                                            <Archive className="h-8 w-8" />
                                        </div>
                                        <h4 className="text-xl font-black text-slate-800 mb-2">Төгсөгч ажилтан</h4>
                                        <p className="text-sm font-medium text-slate-500 leading-relaxed mb-2">
                                            Энэ ажилтан байгууллагаас гарсан бөгөөд төгсөгчийн бүртгэлд орсон байна.
                                        </p>
                                        {lastDeparture?.reason && (
                                            <Badge variant="outline" className="mt-2 border-slate-300 text-slate-600">
                                                {lastDeparture.reason === 'release_company' && 'Компанийн санаачилгаар'}
                                                {lastDeparture.reason === 'release_employee' && 'Ажилтны санаачилгаар'}
                                                {lastDeparture.reason === 'release_temporary' && 'Түр чөлөөлөлт'}
                                            </Badge>
                                        )}
                                    </div>

                                    {/* Offboarding completion info */}
                                    {lastDeparture && (
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="p-5 rounded-2xl bg-white border border-slate-100 text-left">
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Ажилаас гарсан огноо</p>
                                                <p className="text-base font-black text-slate-800">
                                                    {lastDeparture.lastWorkingDate ? new Date(lastDeparture.lastWorkingDate).toLocaleDateString() : 
                                                     lastDeparture.date ? new Date(lastDeparture.date).toLocaleDateString() : 'Тодорхойгүй'}
                                                </p>
                                            </div>
                                            <div className="p-5 rounded-2xl bg-white border border-slate-100 text-left">
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Offboarding</p>
                                                <p className="text-base font-black text-emerald-600">100% дууссан</p>
                                            </div>
                                        </div>
                                    )}

                                    {/* Rehire Section */}
                                    <div className="p-8 rounded-3xl bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 border-dashed text-center">
                                        <div className="h-14 w-14 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center mx-auto mb-4">
                                            <RotateCcw className="h-7 w-7" />
                                        </div>
                                        <h4 className="text-lg font-black text-blue-900 mb-2">Дахин ажилд авах</h4>
                                        <p className="text-sm font-medium text-blue-700 leading-relaxed mb-6">
                                            Энэ ажилтныг дахин ажилд авах боломжтой. Товч дарснаар ажилтны төлөв шинэчлэгдэж, <br />
                                            томилгоо хийх боломжтой болно.
                                        </p>
                                        <Button
                                            onClick={handleRehire}
                                            disabled={isRehiring}
                                            className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-10 py-6 h-auto font-bold text-base shadow-lg shadow-blue-200"
                                        >
                                            {isRehiring ? (
                                                <>
                                                    <span className="animate-spin mr-2">⏳</span>
                                                    Боловсруулж байна...
                                                </>
                                            ) : (
                                                <>
                                                    <UserPlus className="h-5 w-5 mr-2" />
                                                    Дахин ажилд авах
                                                </>
                                            )}
                                        </Button>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    {/* Action Button to move to this stage */}
                                    {employee?.lifecycleStage !== activeStage.id && (
                                        <div className="pt-8">
                                            <Button
                                                onClick={() => handleMoveToStage(activeStage.id)}
                                                disabled={isSavingStage}
                                                className={cn("w-full h-14 rounded-2xl font-black text-lg shadow-xl transition-all active:scale-95 gap-3 text-white border-none")}
                                                style={{ backgroundColor: activeStage.hex }}
                                            >
                                                {isSavingStage ? (
                                                    <>
                                                        <span className="animate-spin mr-1">⏳</span>
                                                        Хадгалж байна...
                                                    </>
                                                ) : (
                                                    <>
                                                        <ArrowRight className="h-6 w-6" />
                                                        Энэ шат руу шилжүүлэх
                                                    </>
                                                )}
                                            </Button>
                                            <p className="mt-4 text-xs font-bold text-slate-400 uppercase tracking-widest text-center">
                                                Одоогийн шат: {STAGES.find(s => s.id === employee?.lifecycleStage)?.title || 'Тодорхойгүй'}
                                            </p>
                                        </div>
                                    )}

                                    {/* Retention Suggestion */}
                                    {activeStage.id === 'retention' && shouldSuggestRetention && employee?.lifecycleStage === 'development' && (
                                        <div className="mt-8 p-8 rounded-[2.5rem] bg-amber-50 border-2 border-amber-200 border-dashed text-center">
                                            <div className="h-12 w-12 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center mx-auto mb-4">
                                                <Sparkles className="h-6 w-6" />
                                            </div>
                                            <h4 className="text-lg font-black text-amber-900 mb-2">Тогтворжилтын шат</h4>
                                            <p className="text-sm font-medium text-amber-700 leading-relaxed mb-6">
                                                Энэ ажилтан байгууллагад 1-ээс дээш жил ажиллаж байна. <br />
                                                Түүнийг "Тогтворжилт" шат руу шилжүүлэхийг санал болгож байна.
                                            </p>
                                            <Button
                                                onClick={() => handleMoveToStage('retention')}
                                                disabled={isSavingStage}
                                                className="bg-amber-500 hover:bg-amber-600 text-white rounded-xl px-8 font-bold"
                                            >
                                                {isSavingStage ? 'Хадгалж байна...' : 'Шилжүүлэх'}
                                            </Button>
                                        </div>
                                    )}

                                    {employee?.lifecycleStage === activeStage.id && (
                                        <div className="pt-8 flex items-center justify-center gap-3 text-emerald-500">
                                            <div className="h-10 w-10 rounded-full bg-emerald-50 flex items-center justify-center">
                                                <Check className="h-5 w-5" />
                                            </div>
                                            <span className="font-black uppercase tracking-widest text-sm">Одоогийн идэвхтэй шат</span>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
