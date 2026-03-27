'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { CheckCircle2, Circle, Clock, Loader2, Info, CheckCircle, FileText, UserCircle2, ExternalLink, FolderKanban } from 'lucide-react';
import { useCollection, useMemoFirebase, updateDocumentNonBlocking, tenantCollection, useTenantWrite } from '@/firebase';
import { query, where, getDocs, Timestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Employee } from '../data';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { VerticalTabMenu } from '@/components/ui/vertical-tab-menu';
import Link from 'next/link';
import { Project, Task, TaskStatus, PROJECT_STATUS_LABELS, PROJECT_STATUS_COLORS } from '@/types/project';

// Stage order for display
const STAGE_ORDER = ['pre-onboarding', 'orientation', 'integration', 'productivity'];
const STAGE_LABELS: Record<string, string> = {
    'pre-onboarding': 'Урьдчилсан бэлтгэл',
    'orientation': 'Дасан зохицох',
    'integration': 'Ажлын үүрэгт уусах',
    'productivity': 'Тогтворжилт',
};

interface ProjectWithTasks extends Project {
    tasks: Task[];
    taskStats: { total: number; completed: number };
    progress: number;
}

export function OnboardingTabContent({ employeeId, employee }: { employeeId: string; employee: Employee }) {
    const { firestore, tDoc, tCollection } = useTenantWrite();
    const { toast } = useToast();

    // Fetch onboarding projects for this employee
    const projectsQuery = useMemoFirebase(({ firestore, companyPath }) =>
        firestore && employeeId
            ? query(
                tenantCollection(firestore, companyPath, 'projects'),
                where('type', '==', 'onboarding'),
                where('onboardingEmployeeId', '==', employeeId)
            )
            : null
        , [employeeId]);
    const { data: projects, isLoading: isLoadingProjects } = useCollection<Project>(projectsQuery as any);

    const [projectsWithTasks, setProjectsWithTasks] = useState<ProjectWithTasks[]>([]);
    const [isLoadingTasks, setIsLoadingTasks] = useState(false);
    const [isTogglingTask, setIsTogglingTask] = useState<string | null>(null);

    // Fetch tasks for all projects
    useEffect(() => {
        let cancelled = false;

        async function fetchTasks() {
            if (!firestore || !projects || projects.length === 0) {
                if (!cancelled) setProjectsWithTasks([]);
                return;
            }

            if (!cancelled) setIsLoadingTasks(true);
            try {
                const withTasks: ProjectWithTasks[] = [];

                for (const project of projects) {
                    if (cancelled) return;
                    const tasksSnap = await getDocs(tCollection('projects', project.id, 'tasks'));
                    const tasks = tasksSnap.docs.map(d => ({ ...d.data(), id: d.id } as Task));
                    const completed = tasks.filter(t => t.status === 'DONE').length;
                    const total = tasks.length;

                    withTasks.push({
                        ...project,
                        tasks,
                        taskStats: { total, completed },
                        progress: total > 0 ? Math.round((completed / total) * 100) : 0,
                    });
                }

                // Sort by stageOrder
                withTasks.sort((a, b) => (a.stageOrder || 0) - (b.stageOrder || 0));
                if (!cancelled) setProjectsWithTasks(withTasks);
            } catch (e) {
                console.error('Failed to fetch tasks:', e);
            } finally {
                if (!cancelled) setIsLoadingTasks(false);
            }
        }

        fetchTasks();
        return () => { cancelled = true; };
    }, [firestore, projects]);

    // Calculate overall progress
    const overallProgress = useMemo(() => {
        if (projectsWithTasks.length === 0) return 0;
        const totalTasks = projectsWithTasks.reduce((sum, p) => sum + p.taskStats.total, 0);
        const completedTasks = projectsWithTasks.reduce((sum, p) => sum + p.taskStats.completed, 0);
        return totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
    }, [projectsWithTasks]);

    const totalTaskStats = useMemo(() => {
        return {
            total: projectsWithTasks.reduce((sum, p) => sum + p.taskStats.total, 0),
            completed: projectsWithTasks.reduce((sum, p) => sum + p.taskStats.completed, 0),
        };
    }, [projectsWithTasks]);

    // Toggle task status
    const toggleTask = async (projectId: string, task: Task) => {
        if (!firestore || isTogglingTask) return;

        setIsTogglingTask(task.id);
        try {
            const newStatus: TaskStatus = task.status === 'DONE' ? 'TODO' : 'DONE';
            const taskRef = tDoc('projects', projectId, 'tasks', task.id);

            await updateDocumentNonBlocking(taskRef, {
                status: newStatus,
                completedAt: newStatus === 'DONE' ? Timestamp.now() : null,
                updatedAt: Timestamp.now(),
            });

            // Update local state
            setProjectsWithTasks(prev => prev.map(p => {
                if (p.id !== projectId) return p;
                const newTasks = p.tasks.map(t =>
                    t.id === task.id ? { ...t, status: newStatus, completedAt: newStatus === 'DONE' ? Timestamp.now() : undefined } : t
                );
                const completed = newTasks.filter(t => t.status === 'DONE').length;
                const total = newTasks.length;
                return {
                    ...p,
                    tasks: newTasks,
                    taskStats: { total, completed },
                    progress: total > 0 ? Math.round((completed / total) * 100) : 0,
                };
            }));

            // Check if all tasks are done - update employee lifecycle
            const allProjectsProgress = projectsWithTasks.map(p => {
                if (p.id === projectId) {
                    const newCompleted = task.status === 'DONE'
                        ? p.taskStats.completed - 1
                        : p.taskStats.completed + 1;
                    return newCompleted === p.taskStats.total ? 100 : 0;
                }
                return p.progress === 100 ? 100 : 0;
            });

            if (allProjectsProgress.every(p => p === 100)) {
                // All onboarding complete
                // Only update lifecycleStage; the active sub-status (туршилт/үндсэн)
                // was already set by the appointment document and should not be overwritten.
                await updateDocumentNonBlocking(tDoc('employees', employeeId), {
                    lifecycleStage: 'development',
                });
                toast({ title: 'Onboarding дууслаа!', description: 'Ажилтан development шатанд шилжлээ.' });
            }
        } catch (e) {
            console.error('Failed to toggle task:', e);
            toast({ title: 'Алдаа гарлаа', variant: 'destructive' });
        } finally {
            setIsTogglingTask(null);
        }
    };

    if (isLoadingProjects || isLoadingTasks) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
            </div>
        );
    }

    if (!projects || projects.length === 0) {
        return (
            <Card className="border-none shadow-sm bg-white rounded-[2.5rem] overflow-hidden">
                <CardContent className="p-12 text-center space-y-6">
                    <div className="h-20 w-20 bg-indigo-50 rounded-full flex items-center justify-center mx-auto text-indigo-500">
                        <UserCircle2 className="h-10 w-10" />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-slate-800 mb-2">Onboarding төсөл олдсонгүй</h3>
                        <p className="text-slate-500 text-sm max-w-sm mx-auto">
                            Энэ ажилтны хувьд onboarding төсөл үүсээгүй байна. Ажилтан томилохдоо onboarding идэвхжүүлсэн эсэхийг шалгана уу.
                        </p>
                    </div>
                    <Button asChild variant="outline" className="rounded-2xl">
                        <Link href="/dashboard/onboarding/settings">
                            Onboarding тохиргоо
                        </Link>
                    </Button>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Progress Overview Card */}
            <Card className="border-none shadow-md bg-white rounded-[2.5rem] overflow-hidden">
                <CardHeader className="p-8 border-b border-slate-50">
                    <div className="flex items-center justify-between gap-4">
                        <div>
                            <div className="flex items-center gap-3">
                                <CardTitle className="text-xl font-black text-slate-800">Onboarding явц</CardTitle>
                                <Badge variant="secondary" className="text-[10px]">
                                    {totalTaskStats.completed}/{totalTaskStats.total} таск
                                </Badge>
                            </div>
                            <CardDescription className="text-slate-400">
                                Төслийн системээр удирдагдаж байна
                            </CardDescription>
                        </div>
                        <div className="text-right">
                            <p className="text-2xl font-black text-indigo-600 leading-none">{overallProgress}%</p>
                            <p className="text-[10px] font-bold text-slate-300 uppercase mt-1">Нийт явц</p>
                        </div>
                    </div>
                    <div className="mt-6">
                        <Progress value={overallProgress} className="h-2 bg-slate-100" />
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="grid grid-cols-1 lg:grid-cols-10 divide-y lg:divide-y-0 lg:divide-x divide-slate-50">
                        {/* Stages Sidebar */}
                        <div className="lg:col-span-3 p-6 space-y-4 bg-slate-50/30">
                            <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 px-2 text-center lg:text-left">
                                Үе шатууд ({projectsWithTasks.length} төсөл)
                            </h4>
                            <div className="space-y-1">
                                {projectsWithTasks.map((project, idx) => (
                                    <div
                                        key={project.id}
                                        className={cn(
                                            "flex items-start gap-3 p-3 rounded-2xl transition-all",
                                            project.progress === 100 ? "bg-emerald-50 text-emerald-700" : "text-slate-600"
                                        )}
                                    >
                                        <div className="mt-0.5 shrink-0">
                                            {project.progress === 100 ? (
                                                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                                            ) : project.status === 'ACTIVE' ? (
                                                <div className="h-5 w-5 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
                                            ) : (
                                                <Circle className="h-5 w-5 text-slate-300" />
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-bold leading-tight break-words">
                                                {idx + 1}. {STAGE_LABELS[project.onboardingStageId || ''] || project.name}
                                            </p>
                                            <p className="text-[10px] opacity-70 mt-1">
                                                {project.taskStats.completed}/{project.taskStats.total} таск ({project.progress}%)
                                            </p>
                                            <Link
                                                href={`/dashboard/projects/${project.id}`}
                                                className="inline-flex items-center gap-1 text-[9px] text-indigo-600 hover:underline mt-1"
                                            >
                                                <FolderKanban className="h-3 w-3" />
                                                Төсөл харах
                                            </Link>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Tasks Flow */}
                        <div className="lg:col-span-7">
                            <Tabs defaultValue={projectsWithTasks[0]?.id} className="w-full">
                                <div className="px-6 py-4 border-b border-slate-50 overflow-x-auto scrollbar-hide">
                                    <VerticalTabMenu
                                        orientation="horizontal"
                                        className="flex-nowrap gap-2"
                                        triggerClassName="text-sm"
                                        items={projectsWithTasks.map((project) => ({
                                            value: project.id,
                                            label: STAGE_LABELS[project.onboardingStageId || ''] || project.name.split(' - ').pop(),
                                        }))}
                                    />
                                </div>

                                {projectsWithTasks.map(project => (
                                    <TabsContent key={project.id} value={project.id} className="p-6 focus-visible:outline-none">
                                        {/* Project Info */}
                                        <div className="mb-4 p-4 rounded-2xl bg-slate-50 border border-slate-100">
                                            <div className="flex items-start justify-between gap-4">
                                                <div>
                                                    <h4 className="text-sm font-bold text-slate-800">{project.name}</h4>
                                                    <p className="text-xs text-slate-500 mt-1">{project.goal}</p>
                                                </div>
                                                <Badge className={cn("shrink-0", PROJECT_STATUS_COLORS[project.status])}>
                                                    {PROJECT_STATUS_LABELS[project.status]}
                                                </Badge>
                                            </div>
                                            <div className="flex items-center gap-4 mt-3 text-[10px] text-slate-400">
                                                <span>Дуусах: {project.endDate}</span>
                                                <Button asChild variant="ghost" size="sm" className="h-6 text-[10px] text-indigo-600">
                                                    <Link href={`/dashboard/projects/${project.id}`}>
                                                        <ExternalLink className="h-3 w-3 mr-1" />
                                                        Төсөлд очих
                                                    </Link>
                                                </Button>
                                            </div>
                                        </div>

                                        {/* Tasks Grid */}
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {project.tasks.map(task => {
                                                const isCompleted = task.status === 'DONE';
                                                const isToggling = isTogglingTask === task.id;

                                                return (
                                                    <div
                                                        key={task.id}
                                                        onClick={() => !isToggling && toggleTask(project.id, task)}
                                                        className={cn(
                                                            "group flex items-start gap-4 p-5 rounded-3xl border transition-all cursor-pointer",
                                                            isCompleted
                                                                ? "bg-emerald-50 border-emerald-100 shadow-sm shadow-emerald-100/20"
                                                                : "bg-white border-slate-100 hover:border-indigo-200 hover:shadow-md hover:shadow-indigo-100/10"
                                                        )}
                                                    >
                                                        <div className={cn(
                                                            "h-6 w-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 transition-all",
                                                            isToggling && "animate-pulse",
                                                            isCompleted
                                                                ? "bg-emerald-500 text-white"
                                                                : "border-2 border-slate-100 bg-slate-50 group-hover:border-indigo-500 group-hover:bg-white"
                                                        )}>
                                                            {isToggling ? (
                                                                <Loader2 className="h-3 w-3 animate-spin" />
                                                            ) : isCompleted ? (
                                                                <CheckCircle className="h-4 w-4" />
                                                            ) : null}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <h5 className={cn(
                                                                "text-sm font-bold transition-all",
                                                                isCompleted ? "text-emerald-800 line-through opacity-60" : "text-slate-700"
                                                            )}>
                                                                {task.title}
                                                            </h5>

                                                            {isCompleted && task.completedAt && (
                                                                <div className="mt-3 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-emerald-100/50 text-[9px] font-bold text-emerald-600">
                                                                    <Clock className="h-3 w-3" />
                                                                    {task.completedAt.toDate?.().toLocaleDateString?.() || 'Дууссан'}
                                                                </div>
                                                            )}

                                                            {!isCompleted && (
                                                                <div className="flex flex-wrap gap-2 mt-3">
                                                                    {task.dueDate && (
                                                                        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-slate-50 text-[10px] font-bold text-slate-500 border border-slate-100">
                                                                            <Clock className="h-3 w-3" />
                                                                            {task.dueDate}
                                                                        </div>
                                                                    )}
                                                                    {task.policyId && (
                                                                        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-indigo-50 text-[10px] font-bold text-indigo-700 border border-indigo-100">
                                                                            <FileText className="h-3 w-3" />
                                                                            Журам
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </TabsContent>
                                ))}
                            </Tabs>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
