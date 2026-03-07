'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useFirebase, useCollection, useMemoFirebase, tenantCollection } from '@/firebase';
import { useEmployeeProfile } from '@/hooks/use-employee-profile';
import { collection, query, where } from 'firebase/firestore';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    ChevronLeft,
    FolderKanban,
    Users,
    CheckCircle2,
    Clock,
    AlertCircle,
    ChevronRight,
    Target,
    ListTodo,
    Plus,
    GraduationCap,
} from 'lucide-react';
import { format, parseISO, isPast, differenceInDays } from 'date-fns';
import { cn } from '@/lib/utils';
import { Project, PROJECT_STATUS_LABELS } from '@/types/project';
import { Employee } from '@/types';
import { ProjectsGantt } from './components';

export default function MobileProjectsPage() {
    const router = useRouter();
    const { firestore } = useFirebase();
    const { employeeProfile } = useEmployeeProfile();
    const [view, setView] = React.useState<'list' | 'calendar'>('list');

    // Fetch projects where user is a team member
    // Note: array-contains with orderBy requires composite index, so we sort client-side
    const projectsQuery = useMemoFirebase(
        ({ companyPath }) => employeeProfile?.id && firestore
            ? query(
                tenantCollection(firestore, companyPath, 'projects'),
                where('teamMemberIds', 'array-contains', employeeProfile.id)
            )
            : null,
        [firestore, employeeProfile?.id]
    );
    const { data: rawProjects, isLoading: isProjectsLoading, error: projectsError } = useCollection<Project>(projectsQuery);
    
    // Sort projects by updatedAt client-side
    const projects = React.useMemo(() => {
        if (!rawProjects) return null;
        return [...rawProjects].sort((a, b) => {
            const dateA = a.updatedAt?.toDate?.() || new Date(0);
            const dateB = b.updatedAt?.toDate?.() || new Date(0);
            return dateB.getTime() - dateA.getTime();
        });
    }, [rawProjects]);

    // Fetch all employees for display
    const employeesQuery = useMemoFirebase(
        ({ companyPath }) => firestore ? tenantCollection(firestore, companyPath, 'employees') : null,
        [firestore]
    );
    const { data: employees } = useCollection<Employee>(employeesQuery);
    const employeeMap = React.useMemo(() => {
        const map = new Map<string, Employee>();
        employees?.forEach(e => e.id && map.set(e.id, e));
        return map;
    }, [employees]);

    // Stats
    const stats = React.useMemo(() => {
        if (!projects) return { total: 0, active: 0, completed: 0, onboarding: 0 };
        return {
            total: projects.length,
            active: projects.filter(p => ['ACTIVE', 'IN_PROGRESS', 'DRAFT', 'PLANNING'].includes(p.status)).length,
            completed: projects.filter(p => p.status === 'COMPLETED').length,
            onboarding: projects.filter(p => p.type === 'onboarding').length,
        };
    }, [projects]);

    const getStatusStyle = (status: string) => {
        const styles: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
            DRAFT: { bg: 'bg-slate-100', text: 'text-slate-600', icon: <Clock className="w-3 h-3" /> },
            PLANNING: { bg: 'bg-slate-100', text: 'text-slate-600', icon: <Clock className="w-3 h-3" /> },
            ACTIVE: { bg: 'bg-emerald-100', text: 'text-emerald-700', icon: <Target className="w-3 h-3" /> },
            IN_PROGRESS: { bg: 'bg-emerald-100', text: 'text-emerald-700', icon: <Target className="w-3 h-3" /> },
            ON_HOLD: { bg: 'bg-amber-100', text: 'text-amber-700', icon: <AlertCircle className="w-3 h-3" /> },
            COMPLETED: { bg: 'bg-blue-100', text: 'text-blue-700', icon: <CheckCircle2 className="w-3 h-3" /> },
            ARCHIVED: { bg: 'bg-zinc-100', text: 'text-zinc-500', icon: <CheckCircle2 className="w-3 h-3" /> },
            CANCELLED: { bg: 'bg-zinc-100', text: 'text-zinc-500', icon: <CheckCircle2 className="w-3 h-3" /> },
        };
        return styles[status] || styles.DRAFT;
    };

    return (
        <div className="min-h-screen bg-slate-50/50">
            {/* Header */}
            <header className="sticky top-0 z-50 border-b border-slate-200/60 bg-white/75 backdrop-blur-xl shadow-[0_1px_3px_rgba(0,0,0,0.04)] supports-[backdrop-filter]:bg-white/60">
                <div className="px-5 pb-3 pt-[calc(env(safe-area-inset-top)+14px)]">
                    <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3 min-w-0">
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => router.back()}
                                className="rounded-2xl bg-white/70 hover:bg-white text-slate-600 ring-1 ring-slate-200/70 h-10 w-10 transition-colors shrink-0"
                            >
                                <ChevronLeft className="h-5 w-5" />
                            </Button>
                            <div className="min-w-0">
                                <h1 className="text-[18px] font-semibold tracking-tight text-slate-900 leading-tight truncate">
                                    Миний төслүүд
                                </h1>
                                <p className="mt-1 text-[12px] font-medium text-slate-500 truncate">
                                    {stats.total} төсөл
                                    <span className="mx-1.5 text-slate-300">•</span>
                                    {stats.active} идэвхтэй
                                    <span className="mx-1.5 text-slate-300">•</span>
                                    {stats.completed} дууссан
                                </p>
                            </div>
                        </div>

                        <Button
                            onClick={() => router.push('/mobile/projects/create')}
                            className="h-10 w-10 rounded-2xl bg-primary hover:bg-primary/90 text-primary-foreground ring-1 ring-primary/20 shadow-sm"
                            size="icon"
                        >
                            <Plus className="h-5 w-5" />
                        </Button>
                    </div>
                </div>
            </header>

            <main className="px-5 pt-5 pb-6 space-y-4 animate-in fade-in slide-in-from-bottom-3">
                <Tabs value={view} onValueChange={(v) => setView(v as any)} className="w-full">
                    <TabsList className="w-full">
                        <TabsTrigger value="list" className="flex-1 data-[state=active]:scale-100">
                            Жагсаалт
                        </TabsTrigger>
                        <TabsTrigger value="calendar" className="flex-1 data-[state=active]:scale-100">
                            Календарь
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="list" className="mt-4">
                        <div className="space-y-4">
                            {isProjectsLoading ? (
                                <>
                                    {[1, 2, 3].map(i => (
                                        <Skeleton key={i} className="h-36 w-full rounded-2xl" />
                                    ))}
                                </>
                            ) : !projects || projects.length === 0 ? (
                                <Card className="rounded-2xl border-2 border-dashed border-slate-200 bg-white/50">
                                    <CardContent className="py-12 text-center">
                                        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                            <FolderKanban className="w-8 h-8 text-slate-300" />
                                        </div>
                                        <h3 className="text-sm font-semibold text-slate-600 mb-1">Төсөл байхгүй</h3>
                                        <p className="text-xs text-slate-400">Та одоогоор ямар нэг төсөлд оролцоогүй байна</p>
                                    </CardContent>
                                </Card>
                            ) : projectsError ? (
                                <Card className="rounded-2xl border border-rose-200 bg-rose-50">
                                    <CardContent className="py-10 text-center">
                                        <div className="w-14 h-14 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-3">
                                            <AlertCircle className="w-7 h-7 text-rose-500" />
                                        </div>
                                        <h3 className="text-sm font-semibold text-rose-700 mb-1">Алдаа гарлаа</h3>
                                        <p className="text-xs text-rose-600/80">Төслийн мэдээлэл татаж чадсангүй. Дахин оролдоно уу.</p>
                                    </CardContent>
                                </Card>
                            ) : (
                                projects.map((project) => {
                                    const owner = employeeMap.get(project.ownerId);
                                    const statusStyle = getStatusStyle(project.status);
                                    const daysLeft = differenceInDays(parseISO(project.endDate), new Date());
                                    const isOverdue = isPast(parseISO(project.endDate)) && !['COMPLETED', 'ARCHIVED', 'CANCELLED'].includes(project.status);

                                    return (
                                        <Link key={project.id} href={`/mobile/projects/${project.id}`} className="block">
                                            <Card className="rounded-2xl border-0 shadow-sm bg-white hover:shadow-md transition-all active:scale-[0.985]">
                                                <CardContent className="p-5">
                                                    <div className="flex items-start justify-between mb-3">
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-2 mb-1">
                                                                <h3 className="text-base font-semibold text-slate-900 truncate">
                                                                    {project.name}
                                                                </h3>
                                                                {project.type === 'onboarding' && (
                                                                    <Badge className="shrink-0 text-[8px] px-1.5 py-0 h-4 bg-violet-100 text-violet-700 border-0">
                                                                        <GraduationCap className="w-2.5 h-2.5 mr-0.5" />
                                                                        Onboard
                                                                    </Badge>
                                                                )}
                                                            </div>
                                                            <p className="text-xs text-slate-400 line-clamp-1">
                                                                {project.goal}
                                                            </p>
                                                        </div>
                                                        <Badge className={cn(
                                                            "ml-2 shrink-0 text-[10px] font-semibold border-0",
                                                            statusStyle.bg,
                                                            statusStyle.text
                                                        )}>
                                                            {statusStyle.icon}
                                                            <span className="ml-1">{PROJECT_STATUS_LABELS[project.status] || project.status}</span>
                                                        </Badge>
                                                    </div>

                                                    <div className="flex items-center justify-between mb-3">
                                                        <div className="flex items-center gap-1.5 text-xs text-slate-500">
                                                            <Clock className="w-3.5 h-3.5" />
                                                            <span>Хаагдах: {format(parseISO(project.endDate), 'yyyy.MM.dd')}</span>
                                                            {isOverdue ? (
                                                                <Badge variant="destructive" className="ml-1 text-[9px] px-1.5 py-0 h-4">
                                                                    Хугацаа хэтэрсэн
                                                                </Badge>
                                                            ) : daysLeft <= 7 && daysLeft >= 0 && !['COMPLETED', 'ARCHIVED'].includes(project.status) ? (
                                                                <Badge className="ml-1 text-[9px] px-1.5 py-0 h-4 bg-amber-100 text-amber-700 border-0">
                                                                    {daysLeft} хоног үлдсэн
                                                                </Badge>
                                                            ) : null}
                                                        </div>

                                                        <div className="flex items-center">
                                                            <div className="flex -space-x-2">
                                                                {project.teamMemberIds?.slice(0, 3).map((memberId) => {
                                                                    const member = employeeMap.get(memberId);
                                                                    return (
                                                                        <Avatar key={memberId} className="h-6 w-6 ring-2 ring-white">
                                                                            <AvatarImage src={member?.photoURL} />
                                                                            <AvatarFallback className="text-[8px] bg-slate-100">
                                                                                {member?.firstName?.[0]}
                                                                            </AvatarFallback>
                                                                        </Avatar>
                                                                    );
                                                                })}
                                                                {project.teamMemberIds && project.teamMemberIds.length > 3 && (
                                                                    <div className="h-6 w-6 rounded-full bg-slate-100 ring-2 ring-white flex items-center justify-center">
                                                                        <span className="text-[9px] font-semibold text-slate-500">
                                                                            +{project.teamMemberIds.length - 3}
                                                                        </span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center justify-between pt-3 border-t border-slate-50">
                                                        <div className="flex items-center gap-2">
                                                            <Avatar className="h-5 w-5">
                                                                <AvatarImage src={owner?.photoURL} />
                                                                <AvatarFallback className="text-[8px]">{owner?.firstName?.[0]}</AvatarFallback>
                                                            </Avatar>
                                                            <span className="text-[11px] text-slate-500">
                                                                {owner?.firstName} {owner?.lastName?.[0]}.
                                                            </span>
                                                        </div>
                                                        <ChevronRight className="w-4 h-4 text-slate-300" />
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        </Link>
                                    );
                                })
                            )}
                        </div>
                    </TabsContent>

                    <TabsContent value="calendar" className="mt-4">
                        {isProjectsLoading ? (
                            <Skeleton className="h-[260px] w-full rounded-2xl" />
                        ) : !projects || projects.length === 0 ? (
                            <Card className="rounded-2xl border-2 border-dashed border-slate-200 bg-white/50">
                                <CardContent className="py-12 text-center">
                                    <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <FolderKanban className="w-8 h-8 text-slate-300" />
                                    </div>
                                    <h3 className="text-sm font-semibold text-slate-600 mb-1">Төсөл байхгүй</h3>
                                    <p className="text-xs text-slate-400">Gantt chart харагдуулах төсөл алга байна</p>
                                </CardContent>
                            </Card>
                        ) : (
                            <ProjectsGantt projects={projects} />
                        )}
                    </TabsContent>
                </Tabs>
            </main>

        </div>
    );
}
