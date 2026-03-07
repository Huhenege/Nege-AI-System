'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/patterns/page-layout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AddActionButton } from '@/components/ui/add-action-button';
import { ActionIconButton } from '@/components/ui/action-icon-button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { useCollection, useFirebase, useMemoFirebase, tenantCollection, useTenantWrite } from '@/firebase';
import { getDocs, query, where } from 'firebase/firestore';
import { Employee, Department } from '@/types';
import { Project, Task } from '@/types/project';
import { cn } from '@/lib/utils';
import { StartOffboardingWizardDialog } from '@/app/dashboard/offboarding/components/start-offboarding-wizard-dialog';
import {
    Settings,
    Search,
    Filter,
    ChevronRight,
    CheckCircle2,
    Clock,
    UserCircle2,
    Briefcase,
    LogOut,
    FolderKanban,
} from 'lucide-react';

const STAGE_ORDER = ['exit-initiation', 'knowledge-handover', 'formal-separation', 'exit-review'];
const STAGE_LABELS: Record<string, string> = {
    'exit-initiation': 'Мэдэгдэл',
    'knowledge-handover': 'Хүлээлцэх',
    'formal-separation': 'Тооцоо',
    'exit-review': 'Exit',
};

interface OffboardingGroup {
    groupId: string;
    employeeId: string;
    employee: Employee | null;
    projects: Project[];
    overallProgress: number;
    taskStats: { total: number; completed: number };
}

export default function OffboardingDashboardPage() {
    const { firestore } = useFirebase();
    const { tCollection } = useTenantWrite();
    const [searchTerm, setSearchTerm] = useState('');
    const [taskCounts, setTaskCounts] = useState<Record<string, { total: number; completed: number }>>({});
    const [startWizardOpen, setStartWizardOpen] = useState(false);

    const departmentsQuery = useMemoFirebase(({ firestore, companyPath }) => (firestore ? tenantCollection(firestore, companyPath, 'departments') : null), [firestore]);
    const { data: departments } = useCollection<Department>(departmentsQuery as any);

    const employeesQuery = useMemoFirebase(
        ({ firestore, companyPath }) =>
            firestore
                ? query(tenantCollection(firestore, companyPath, 'employees'), where('status', 'in', ['active', 'appointing', 'releasing', 'terminated']))
                : null,
        [firestore]
    );
    const { data: employees, isLoading: isLoadingEmployees } = useCollection<Employee>(employeesQuery as any);

    const offboardingProjectsQuery = useMemoFirebase(
        ({ firestore, companyPath }) => (firestore ? query(tenantCollection(firestore, companyPath, 'projects'), where('type', '==', 'offboarding')) : null),
        [firestore]
    );
    const { data: offboardingProjects, isLoading: isLoadingProjects } = useCollection<Project>(offboardingProjectsQuery as any);

    // Fetch tasks for all offboarding projects to calculate progress
    React.useEffect(() => {
        async function fetchTaskCounts() {
            if (!firestore || !offboardingProjects || offboardingProjects.length === 0) return;
            const counts: Record<string, { total: number; completed: number }> = {};
            for (const project of offboardingProjects) {
                try {
                    const tasksSnap = await getDocs(tCollection('projects', project.id, 'tasks'));
                    const tasks = tasksSnap.docs.map(d => d.data() as Task);
                    counts[project.id] = {
                        total: tasks.length,
                        completed: tasks.filter(t => t.status === 'DONE').length,
                    };
                } catch (e) {
                    console.error(`Failed to fetch tasks for project ${project.id}:`, e);
                    counts[project.id] = { total: 0, completed: 0 };
                }
            }
            setTaskCounts(counts);
        }
        fetchTaskCounts();
    }, [firestore, offboardingProjects]);

    const departmentMap = useMemo(() => {
        const map = new Map<string, string>();
        departments?.forEach(d => map.set(d.id, d.name));
        return map;
    }, [departments]);

    const employeeMap = useMemo(() => {
        const map = new Map<string, Employee>();
        employees?.forEach(e => map.set(e.id, e));
        return map;
    }, [employees]);

    const offboardingGroups = useMemo(() => {
        if (!offboardingProjects) return [];
        const groupMap = new Map<string, OffboardingGroup>();

        for (const project of offboardingProjects) {
            const groupId = (project as any).offboardingGroupId as string | undefined;
            const employeeId = (project as any).offboardingEmployeeId as string | undefined;
            if (!groupId || !employeeId) continue;

            if (!groupMap.has(groupId)) {
                groupMap.set(groupId, {
                    groupId,
                    employeeId,
                    employee: employeeMap.get(employeeId) || null,
                    projects: [],
                    overallProgress: 0,
                    taskStats: { total: 0, completed: 0 },
                });
            }
            groupMap.get(groupId)!.projects.push(project);
        }

        for (const group of groupMap.values()) {
            group.projects.sort((a, b) => (a.stageOrder || 0) - (b.stageOrder || 0));
            let total = 0;
            let done = 0;
            for (const p of group.projects) {
                const c = taskCounts[p.id];
                if (c) {
                    total += c.total;
                    done += c.completed;
                }
            }
            group.taskStats = { total, completed: done };
            group.overallProgress = total > 0 ? Math.round((done / total) * 100) : 0;
        }

        return Array.from(groupMap.values());
    }, [offboardingProjects, employeeMap, taskCounts]);

    const filteredGroups = useMemo(() => {
        if (!searchTerm) return offboardingGroups;
        return offboardingGroups.filter(group => {
            if (!group.employee) return false;
            const fullName = `${group.employee.firstName} ${group.employee.lastName}`.toLowerCase();
            return fullName.includes(searchTerm.toLowerCase()) ||
                (group.employee.jobTitle?.toLowerCase() || '').includes(searchTerm.toLowerCase());
        });
    }, [offboardingGroups, searchTerm]);

    if (isLoadingEmployees || isLoadingProjects) {
        return (
        <div className="w-full py-6 px-page space-y-6">
                <Skeleton className="h-20 w-full" />
                <div className="grid gap-4">
                    {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24 w-full" />)}
                </div>
            </div>
        );
    }

    return (
        <div className="w-full py-6 px-page space-y-6">
            <PageHeader
                title="Ажлаас чөлөөлөх (Offboarding)"
                description="Ажилчдын ажлаас гарах үйл явцыг хянах - Төслийн систем"
                showBackButton={true}
                hideBreadcrumbs={true}
                backButtonPlacement="inline"
                backBehavior="history"
                fallbackBackHref="/dashboard/employees"
                actions={
                    <div className="flex items-center gap-2">
                        <AddActionButton
                            label="Хөтөлбөр эхлүүлэх"
                            description="Offboarding хөтөлбөр эхлүүлэх"
                            onClick={() => setStartWizardOpen(true)}
                        />
                        <ActionIconButton
                            label="Тохиргоо"
                            description="Offboarding тохиргоо"
                            href="/dashboard/offboarding/settings"
                            icon={<Settings className="h-4 w-4" />}
                            variant="outline"
                            className="bg-white hover:bg-slate-50 border-slate-200"
                        />
                    </div>
                }
            />

            <StartOffboardingWizardDialog open={startWizardOpen} onOpenChange={setStartWizardOpen} />

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="border-none shadow-sm bg-white">
                    <CardContent className="p-4 flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-rose-100 flex items-center justify-center">
                            <LogOut className="h-5 w-5 text-rose-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-slate-900">{offboardingGroups.length}</p>
                            <p className="text-xs text-slate-500">Нийт offboarding</p>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-none shadow-sm bg-white">
                    <CardContent className="p-4 flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-amber-100 flex items-center justify-center">
                            <Clock className="h-5 w-5 text-amber-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-slate-900">{offboardingGroups.filter(g => g.overallProgress < 100).length}</p>
                            <p className="text-xs text-slate-500">Идэвхтэй</p>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-none shadow-sm bg-white">
                    <CardContent className="p-4 flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-slate-900">{offboardingGroups.filter(g => g.overallProgress === 100).length}</p>
                            <p className="text-xs text-slate-500">Дууссан</p>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-none shadow-sm bg-white">
                    <CardContent className="p-4 flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-violet-100 flex items-center justify-center">
                            <FolderKanban className="h-5 w-5 text-violet-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-slate-900">{offboardingProjects?.length || 0}</p>
                            <p className="text-xs text-slate-500">Нийт төсөл</p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                        placeholder="Ажилтан хайх..."
                        className="pl-10 bg-white border-slate-200 focus:ring-rose-500"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>
                <Button variant="outline" className="bg-white">
                    <Filter className="h-4 w-4 mr-2" /> Шүүлтүүр
                </Button>
            </div>

            <div className="grid gap-4">
                {filteredGroups.length === 0 ? (
                    <Card className="border-none shadow-sm py-12 text-center text-slate-400">
                        <UserCircle2 className="h-12 w-12 mx-auto mb-4 opacity-20" />
                        {offboardingGroups.length === 0 ? 'Offboarding хөтөлбөртэй ажилтан олдсонгүй.' : 'Хайлтад тохирсон ажилтан олдсонгүй.'}
                    </Card>
                ) : (
                    filteredGroups.map(group => {
                        const emp = group.employee;
                        if (!emp) return null;
                        return (
                            <Card key={group.groupId} className="group border-none shadow-sm hover:shadow-md transition-all overflow-hidden bg-white dark:bg-slate-900">
                                <CardContent className="p-0">
                                    <div className="flex flex-col lg:flex-row lg:items-center">
                                        <div className="p-5 flex items-center gap-4 border-b lg:border-b-0 lg:border-r lg:w-[30%] bg-rose-50/30">
                                            <Avatar className="h-12 w-12 ring-2 ring-white shadow-sm">
                                                <AvatarImage src={emp.photoURL} />
                                                <AvatarFallback className="bg-rose-100 text-rose-700 font-bold">
                                                    {emp.firstName?.charAt(0)}{emp.lastName?.charAt(0)}
                                                </AvatarFallback>
                                            </Avatar>
                                            <div className="min-w-0">
                                                <h3 className="font-bold text-slate-800 dark:text-slate-100 truncate">{emp.lastName} {emp.firstName}</h3>
                                                <p className="text-xs text-slate-500 flex items-center gap-1">
                                                    <Briefcase className="h-3 w-3" /> {emp.jobTitle || 'Албан тушаал'}
                                                </p>
                                                <p className="text-[10px] text-slate-400 font-medium uppercase mt-1">
                                                    {departmentMap.get(emp.departmentId || '') || 'Хэлтэс'}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="p-5 flex-1 space-y-4">
                                            <div className="flex justify-between items-end mb-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Нийт явц</span>
                                                    <Badge variant="secondary" className="text-[9px] px-1.5 py-0">
                                                        {group.taskStats.completed}/{group.taskStats.total} таск
                                                    </Badge>
                                                </div>
                                                <span className="text-sm font-black text-rose-600">{group.overallProgress}%</span>
                                            </div>
                                            <Progress value={group.overallProgress} className="h-2 bg-slate-100 rounded-full [&>div]:bg-rose-500" />

                                            {group.projects.some((p: any) => STAGE_ORDER.includes(((p as any).offboardingStageId as string) || '')) ? (
                                                <div className="grid grid-cols-4 gap-2">
                                                    {STAGE_ORDER.map((stageId) => {
                                                        const project = group.projects.find((p: any) => (p as any).offboardingStageId === stageId);
                                                        const counts = project ? taskCounts[project.id] : null;
                                                        const stageProgress = counts && counts.total > 0 ? Math.round((counts.completed / counts.total) * 100) : 0;
                                                        const isCompleted = stageProgress === 100;
                                                        const isActive = project?.status === 'ACTIVE';

                                                        return (
                                                            <div key={stageId} className="space-y-1.5">
                                                                <div className="flex h-1 gap-0.5 rounded-full overflow-hidden bg-slate-100">
                                                                    <div
                                                                        className={cn(
                                                                            "h-full transition-all duration-500",
                                                                            isCompleted ? "bg-emerald-500" :
                                                                                isActive ? "bg-rose-500" : "bg-slate-200"
                                                                        )}
                                                                        style={{ width: `${stageProgress}%` }}
                                                                    />
                                                                </div>
                                                                <span className={cn(
                                                                    "text-[9px] font-bold uppercase truncate block",
                                                                    isCompleted ? "text-emerald-600" :
                                                                        isActive ? "text-rose-600" : "text-slate-400"
                                                                )}>
                                                                    {STAGE_LABELS[stageId] || stageId}
                                                                </span>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            ) : (
                                                <div className="grid grid-cols-1 gap-2">
                                                    {(() => {
                                                        const project = group.projects[0];
                                                        const counts = project ? taskCounts[project.id] : null;
                                                        const progress = counts && counts.total > 0 ? Math.round((counts.completed / counts.total) * 100) : 0;
                                                        const isCompleted = progress === 100;
                                                        const isActive = project?.status === 'ACTIVE';

                                                        return (
                                                            <div className="space-y-1.5">
                                                                <div className="flex h-1 gap-0.5 rounded-full overflow-hidden bg-slate-100">
                                                                    <div
                                                                        className={cn(
                                                                            "h-full transition-all duration-500",
                                                                            isCompleted ? "bg-emerald-500" :
                                                                                isActive ? "bg-rose-500" : "bg-slate-200"
                                                                        )}
                                                                        style={{ width: `${progress}%` }}
                                                                    />
                                                                </div>
                                                                <span className={cn(
                                                                    "text-[9px] font-bold uppercase truncate block",
                                                                    isCompleted ? "text-emerald-600" :
                                                                        isActive ? "text-rose-600" : "text-slate-400"
                                                                )}>
                                                                    Нэгдсэн
                                                                </span>
                                                            </div>
                                                        );
                                                    })()}
                                                </div>
                                            )}
                                        </div>

                                        <div className="p-5 flex items-center justify-end lg:pr-8 gap-2">
                                            {group.projects.length > 0 && (
                                                <Button asChild variant="ghost" size="sm" className="rounded-full hover:bg-rose-50 group/btn">
                                                    <Link href={`/dashboard/projects/${group.projects[0].id}`}>
                                                        <span className="mr-2 text-xs font-bold text-slate-500 group-hover/btn:text-rose-600">Төсөл харах</span>
                                                        <ChevronRight className="h-4 w-4 text-slate-300 group-hover/btn:text-rose-400 transition-transform group-hover/btn:translate-x-1" />
                                                    </Link>
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })
                )}
            </div>
        </div>
    );
}

