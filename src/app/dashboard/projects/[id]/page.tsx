'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { PageHeader } from '@/components/patterns/page-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    Clock,
    CheckCircle2,
    Pencil,
    Trash2,
    AlertCircle,
    ListTodo,
    CircleDot,
    ArrowRight,
    FolderKanban,
    Sparkles,
    Tag,
} from 'lucide-react';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { format, isPast, parseISO } from 'date-fns';
import { mn } from 'date-fns/locale';

import { useCollection, useDoc, useFirebase, useMemoFirebase, updateDocumentNonBlocking, deleteDocumentNonBlocking, tenantCollection, tenantDoc, useTenantWrite } from '@/firebase';
import { collection, query, orderBy, Timestamp, getDocs, deleteDoc } from 'firebase/firestore';
import { AssignProjectGroupsDialog } from '../components/assign-project-groups-dialog';
import {
    Project,
    Task,
    TaskStatus,
    ProjectStatus,
    ProjectGroup,
    PROJECT_STATUS_LABELS,
    PROJECT_STATUS_COLORS,
} from '@/types/project';
import { Employee } from '@/types';
import { useToast } from '@/hooks/use-toast';

import { ActionIconButton } from '@/components/ui/action-icon-button';
import { AddActionButton } from '@/components/ui/add-action-button';
import { CreateTaskDialog } from '../components/create-task-dialog';
import { EditProjectInfoDialog } from '../components/edit-project-info-dialog';
import { EditProjectTeamDialog } from '../components/edit-project-team-dialog';
import { EditProjectScheduleDialog } from '../components/edit-project-schedule-dialog';
import { EditTaskDialog } from '../components/edit-task-dialog';
import { TasksListTable } from '../components/tasks-list-table';
import { ProjectChatSection } from '../components/project-chat-section';
import { AiGenerateTasksDialog } from '../components/ai-generate-tasks-dialog';
import { ProjectDetailDashboard } from './components/project-detail-dashboard';
import { ProjectPointsService } from '@/lib/points/project-points-service';

const STATUS_OPTIONS: { value: ProjectStatus; label: string }[] = [
    { value: 'DRAFT', label: 'Ноорог' },
    { value: 'ACTIVE', label: 'Идэвхтэй' },
    { value: 'ON_HOLD', label: 'Түр зогссон' },
    { value: 'COMPLETED', label: 'Дууссан' },
    { value: 'ARCHIVED', label: 'Архивласан' },
];

function normalizeStatusForSelect(s: ProjectStatus): string {
    if (s === 'IN_PROGRESS') return 'ACTIVE';
    if (s === 'CANCELLED') return 'ARCHIVED';
    return s;
}

function ProjectStatusSelect({
    project,
    onUpdated,
    onError,
    onPointsDistributed,
}: {
    project: Project;
    onUpdated: () => void;
    onError: () => void;
    onPointsDistributed?: (message: string) => void;
}) {
    const { firestore } = useFirebase();
    const { tDoc } = useTenantWrite();
    const [isUpdating, setIsUpdating] = useState(false);
    const selectValue = normalizeStatusForSelect(project.status);

    const handleChange = async (newValue: string) => {
        if (!firestore || newValue === selectValue) return;
        setIsUpdating(true);
        try {
            const completionDate = format(new Date(), 'yyyy-MM-dd');

            // Update the project status
            const updateData: Record<string, any> = {
                status: newValue as ProjectStatus,
                updatedAt: Timestamp.now(),
            };

            // If completing the project, record the completion date
            if (newValue === 'COMPLETED') {
                updateData.completedAt = completionDate;
            }

            await updateDocumentNonBlocking(tDoc('projects', project.id), updateData);

            // If completing and project has point budget, distribute points
            if (
                newValue === 'COMPLETED' &&
                project.pointBudget &&
                project.pointBudget > 0 &&
                !project.pointsDistributed
            ) {
                try {
                    const result = await ProjectPointsService.distributeProjectPoints(
                        firestore,
                        project.id,
                        completionDate
                    );

                    if (result.pointsPerMember > 0) {
                        const penaltyMsg = result.overdueDays > 0
                            ? ` (${result.overdueDays} хоног хоцорсон, ${result.penaltyPercent}% хасагдсан)`
                            : ' (хугацаандаа дууссан)';
                        onPointsDistributed?.(
                            `Гишүүн бүрт ${result.pointsPerMember} оноо олгогдлоо${penaltyMsg}`
                        );
                    } else {
                        onPointsDistributed?.(
                            `100+ хоног хоцорсон тул оноо олгогдсонгүй`
                        );
                    }
                } catch (pointError) {
                    console.error('Point distribution error:', pointError);
                    // Don't fail the status change because of point distribution error
                    onPointsDistributed?.('Оноо хуваарилахад алдаа гарлаа');
                }
            }

            onUpdated();
        } catch {
            onError();
        } finally {
            setIsUpdating(false);
        }
    };

    return (
        <Select value={selectValue} onValueChange={handleChange} disabled={isUpdating}>
            <SelectTrigger className={cn('w-full max-w-[180px] h-8 text-xs', PROJECT_STATUS_COLORS[project.status] || 'bg-slate-100 text-slate-700')}>
                <SelectValue />
            </SelectTrigger>
            <SelectContent>
                {STATUS_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}

export default function ProjectDetailPage() {
    const params = useParams();
    const router = useRouter();
    const projectId = params.id as string;
    const { firestore, user: currentUser } = useFirebase();
    const { tDoc, tCollection } = useTenantWrite();
    const { toast } = useToast();

    const [isCreateTaskOpen, setIsCreateTaskOpen] = useState(false);
    const [isAiGenerateTasksOpen, setIsAiGenerateTasksOpen] = useState(false);
    const [isEditInfoOpen, setIsEditInfoOpen] = useState(false);
    const [isEditTeamOpen, setIsEditTeamOpen] = useState(false);
    const [isEditScheduleOpen, setIsEditScheduleOpen] = useState(false);
    const [isAssignGroupsOpen, setIsAssignGroupsOpen] = useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [taskStatusFilter, setTaskStatusFilter] = useState<TaskStatus | 'ALL' | 'OVERDUE'>('ALL');
    const [editingTask, setEditingTask] = useState<Task | null>(null);

    // Fetch project
    const projectRef = useMemoFirebase(
        ({ firestore, companyPath }) => firestore && projectId ? tenantDoc(firestore, companyPath, 'projects', projectId) : null,
        [firestore, projectId]
    );
    const { data: project, isLoading: isLoadingProject } = useDoc<Project>(projectRef);
    const isOwner = !!project && !!currentUser && project.ownerId === currentUser.uid;

    // Fetch tasks
    const tasksQuery = useMemoFirebase(
        ({ firestore, companyPath }) => firestore && projectId
            ? query(
                collection(firestore, companyPath ? `${companyPath}/projects` : 'projects', projectId, 'tasks'),
                orderBy('createdAt', 'desc')
            )
            : null,
        [firestore, projectId]
    );
    const { data: tasks, isLoading: isLoadingTasks } = useCollection<Task>(tasksQuery);

    // Fetch employees
    const employeesQuery = useMemoFirebase(
        ({ firestore, companyPath }) => firestore ? tenantCollection(firestore, companyPath, 'employees') : null,
        [firestore]
    );
    const { data: employees } = useCollection<Employee>(employeesQuery);

    const employeeMap = useMemo(() => {
        return new Map((employees || []).map(e => [e.id, e]));
    }, [employees]);

    // Fetch project groups
    const groupsQuery = useMemoFirebase(
        ({ firestore, companyPath }) => firestore ? query(tenantCollection(firestore, companyPath, 'project_groups'), orderBy('name', 'asc')) : null,
        [firestore]
    );
    const { data: groups } = useCollection<ProjectGroup>(groupsQuery as any);

    const groupsById = useMemo(() => {
        return new Map((groups || []).map(g => [g.id, g]));
    }, [groups]);

    const projectGroups = useMemo(() => {
        if (!project?.groupIds) return [];
        return project.groupIds
            .map(id => groupsById.get(id))
            .filter((g): g is ProjectGroup => !!g);
    }, [project?.groupIds, groupsById]);

    // Get team members with details
    const teamMembers = useMemo(() => {
        if (!project?.teamMemberIds || !employees) return [];
        return project.teamMemberIds
            .map(id => employeeMap.get(id))
            .filter((e): e is Employee => !!e);
    }, [project?.teamMemberIds, employees, employeeMap]);

    // Filter tasks
    const filteredTasks = useMemo(() => {
        if (!tasks) return [];
        if (taskStatusFilter === 'ALL') return tasks;
        if (taskStatusFilter === 'OVERDUE') {
            return tasks.filter(t => t.status !== 'DONE' && isPast(parseISO(t.dueDate)));
        }
        return tasks.filter(t => t.status === taskStatusFilter);
    }, [tasks, taskStatusFilter]);

    // Calculate progress
    const progress = useMemo(() => {
        if (!tasks || tasks.length === 0) return { percentage: 0, done: 0, total: 0 };
        const done = tasks.filter(t => t.status === 'DONE').length;
        return {
            percentage: Math.round((done / tasks.length) * 100),
            done,
            total: tasks.length,
        };
    }, [tasks]);

    // Task stats
    const taskStats = useMemo(() => {
        if (!tasks) return { todo: 0, inProgress: 0, done: 0, overdue: 0 };
        const today = new Date();
        return {
            todo: tasks.filter(t => t.status === 'TODO').length,
            inProgress: tasks.filter(t => t.status === 'IN_PROGRESS').length,
            done: tasks.filter(t => t.status === 'DONE').length,
            overdue: tasks.filter(t => {
                if (t.status === 'DONE') return false;
                return isPast(parseISO(t.dueDate));
            }).length,
        };
    }, [tasks]);

    // Сонгогдсон OVERDUE таб байхгүй бол ALL руу буцаах
    useEffect(() => {
        if (taskStatusFilter === 'OVERDUE' && taskStats.overdue === 0) {
            setTaskStatusFilter('ALL');
        }
    }, [taskStatusFilter, taskStats.overdue]);

    const handleDeleteProject = async () => {
        if (!firestore || !projectId) return;

        try {
            const tasksRef = tCollection('projects', projectId, 'tasks');
            const tasksSnap = await getDocs(tasksRef);
            await Promise.all(tasksSnap.docs.map((d) => deleteDoc(d.ref)));
            await deleteDocumentNonBlocking(tDoc('projects', projectId));
            toast({
                title: 'Амжилттай',
                description: 'Төсөл устгагдлаа.',
            });
            router.push('/dashboard/projects');
        } catch (error) {
            toast({
                title: 'Алдаа',
                description: 'Төсөл устгахад алдаа гарлаа.',
                variant: 'destructive',
            });
        }
    };

    const handleTaskStatusChange = async (taskId: string, newStatus: TaskStatus) => {
        if (!firestore || !projectId) return;

        try {
            const updateData: any = {
                status: newStatus,
                updatedAt: Timestamp.now(),
            };

            if (newStatus === 'DONE') {
                updateData.completedAt = Timestamp.now();
            }

            await updateDocumentNonBlocking(
                tDoc('projects', projectId, 'tasks', taskId),
                updateData
            );
        } catch (error) {
            toast({
                title: 'Алдаа',
                description: 'Таскын төлөв өөрчлөхөд алдаа гарлаа.',
                variant: 'destructive',
            });
        }
    };

    const owner = project ? employeeMap.get(project.ownerId) : undefined;
    const isLoading = isLoadingProject || isLoadingTasks;

    if (isLoadingProject) {
        return (
            <div className="flex flex-col h-full overflow-hidden">
                <div className="flex-1 overflow-y-auto">
                    <div className="bg-gradient-to-br from-violet-500/10 via-purple-500/5 to-fuchsia-500/10 px-6 py-6">
                        <Skeleton className="h-8 w-64 mb-4" />
                        <Skeleton className="h-4 w-96 mb-8" />
                    </div>
                    <div className="px-6 py-6">
                        <div className="grid gap-4 md:grid-cols-4 mb-6">
                            {Array.from({ length: 4 }).map((_, i) => (
                                <Skeleton key={i} className="h-24 w-full rounded-xl" />
                            ))}
                        </div>
                        <Skeleton className="h-48 w-full rounded-xl" />
                    </div>
                </div>
            </div>
        );
    }

    if (!project) {
        return (
            <div className="flex flex-col h-full overflow-hidden">
                <div className="flex-1 overflow-y-auto p-6 md:p-8">
                    <div className="text-center py-16">
                        <div className="h-20 w-20 rounded-2xl bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center mx-auto mb-6">
                            <FolderKanban className="h-10 w-10 text-violet-600 dark:text-violet-400" />
                        </div>
                        <h2 className="text-2xl font-semibold mb-3">Төсөл олдсонгүй</h2>
                        <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                            Энэ төсөл устгагдсан эсвэл байхгүй байна.
                        </p>
                        <Button 
                            onClick={() => router.push('/dashboard/projects')}
                            className="bg-violet-600 hover:bg-violet-700"
                        >
                            <ArrowRight className="h-4 w-4 mr-2 rotate-180" />
                            Төслүүд рүү буцах
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full overflow-hidden">
            <div className="flex-1 overflow-y-auto">
                {/* Header Section with Gradient */}
                <div className="bg-gradient-to-br from-violet-500/10 via-purple-500/5 to-fuchsia-500/10 dark:from-violet-500/5 dark:via-purple-500/5 dark:to-fuchsia-500/5">
                    <div className="px-6 py-6">
                        <PageHeader
                            title={project.name}
                            showBackButton={true}
                            backHref="/dashboard/projects"
                            breadcrumbs={[
                                { label: 'Нүүр', href: '/dashboard' },
                                { label: 'Төслүүд', href: '/dashboard/projects' },
                                { label: project.name },
                            ]}
                            actions={
                                <ActionIconButton
                                    label="Устгах"
                                    description="Төслийг устгах"
                                    icon={<Trash2 className="h-4 w-4" />}
                                    variant="ghost"
                                    className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 bg-white/80 dark:bg-slate-900/80"
                                    onClick={() => setIsDeleteDialogOpen(true)}
                                />
                            }
                        />

                        {/* Dashboard | төслийн нэр */}
                        <div className="mt-6">
                            <ProjectDetailDashboard
                                project={project}
                                progressPercent={progress.percentage}
                                doneTasks={progress.done}
                                totalTasks={progress.total}
                            />
                        </div>
                    </div>
                </div>

                {/* Main Content */}
                <div className="px-6 py-6">
                    {/* Зорилго, Хугацаа & Төлөв, Багийн гишүүд — гурван карт нэг мөрөнд */}
                    <div className="grid md:grid-cols-3 gap-4 mb-6">
                        {/* Зорилго & Хүлээгдэж буй үр дүн */}
                        <Card className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border-0 shadow-sm group/card">
                            <CardHeader className="pb-2">
                                <div className="flex items-center justify-between">
                                    <CardTitle className="text-base font-semibold">
                                        Зорилго & Хүлээгдэж буй үр дүн
                                    </CardTitle>
                                    <TooltipProvider>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 opacity-0 group-hover/card:opacity-100 transition-opacity"
                                                    onClick={(e) => { e.preventDefault(); setIsEditInfoOpen(true); }}
                                                >
                                                    <Pencil className="h-4 w-4" />
                                                </Button>
                                            </TooltipTrigger>
                                            <TooltipContent><p>Засах</p></TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-4 pt-0">
                                <div>
                                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Зорилго</p>
                                    <p className="text-sm text-foreground">{project.goal || '-'}</p>
                                </div>
                                <div>
                                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Хүлээгдэж буй үр дүн</p>
                                    <p className="text-sm text-foreground">{project.expectedOutcome || '-'}</p>
                                </div>
                                <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
                                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">AI таск үүсгэгч</p>
                                    <p className="text-xs text-muted-foreground leading-relaxed">
                                        Google Gemini AI дээр суурилсан, OKR менежментийн мэргэжилтэн сургалтаар тохируулсан. Зорилго болон хүлээгдэж буй үр дүнд нийцсэн 5–10 гол чухал таск үүсгэнэ.
                                    </p>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Хугацаа & Статус */}
                        <Card className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border-0 shadow-sm group/card">
                            <CardHeader className="pb-2">
                                <div className="flex items-center justify-between">
                                    <CardTitle className="text-base font-semibold">
                                        Хугацаа & Төлөв
                                    </CardTitle>
                                    <TooltipProvider>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 opacity-0 group-hover/card:opacity-100 transition-opacity"
                                                    onClick={(e) => { e.preventDefault(); setIsEditScheduleOpen(true); }}
                                                >
                                                    <Pencil className="h-4 w-4" />
                                                </Button>
                                            </TooltipTrigger>
                                            <TooltipContent><p>Хугацаа засах</p></TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-4 pt-0">
                                <div>
                                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Хугацаа</p>
                                    <p className="text-sm text-foreground">
                                        {format(parseISO(project.startDate), 'yyyy.MM.dd')} – {format(parseISO(project.endDate), 'yyyy.MM.dd')}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Төлөв</p>
                                    {isOwner ? (
                                        <ProjectStatusSelect
                                            project={project}
                                            onUpdated={() => toast({ title: 'Төлөв шинэчлэгдлээ.' })}
                                            onError={() => toast({ title: 'Алдаа', variant: 'destructive' })}
                                            onPointsDistributed={(msg) => toast({ title: 'Төслийн оноо', description: msg })}
                                        />
                                    ) : (
                                        <Badge className={cn('text-xs', PROJECT_STATUS_COLORS[project.status] || 'bg-slate-100 text-slate-700')}>
                                            {PROJECT_STATUS_LABELS[project.status]}
                                        </Badge>
                                    )}
                                </div>
                                <div>
                                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Бүлэг</p>
                                    <div className="flex items-center gap-2 flex-wrap">
                                        {projectGroups.length > 0 ? (
                                            <>
                                                {projectGroups.map((g) => (
                                                    <Badge key={g.id} variant="secondary" className="text-[10px]">
                                                        <span className="h-2 w-2 rounded-full mr-1.5 shrink-0" style={{ backgroundColor: g.color || '#94a3b8' }} />
                                                        {g.name}
                                                    </Badge>
                                                ))}
                                                {isOwner && (
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-7 text-xs"
                                                        onClick={() => setIsAssignGroupsOpen(true)}
                                                    >
                                                        <Tag className="h-3 w-3 mr-1" />
                                                        Засах
                                                    </Button>
                                                )}
                                            </>
                                        ) : (
                                            isOwner ? (
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="h-8 text-xs"
                                                    onClick={() => setIsAssignGroupsOpen(true)}
                                                >
                                                    <Tag className="h-3.5 w-3.5 mr-1.5" />
                                                    Бүлэг тохируулах
                                                </Button>
                                            ) : (
                                                <span className="text-sm text-muted-foreground">—</span>
                                            )
                                        )}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Team Members */}
                        <Card className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border-0 shadow-sm group/card">
                        <CardHeader className="pb-2">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-base font-semibold">
                                    Багийн гишүүд
                                </CardTitle>
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 opacity-0 group-hover/card:opacity-100 transition-opacity"
                                                onClick={(e) => { e.preventDefault(); setIsEditTeamOpen(true); }}
                                            >
                                                <Pencil className="h-4 w-4" />
                                            </Button>
                                        </TooltipTrigger>
                                        <TooltipContent><p>Засах</p></TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            </div>
                        </CardHeader>
                        <CardContent className="pt-0">
                            <div className="flex flex-wrap gap-2">
                                {teamMembers.length > 0 ? (
                                    teamMembers.map((member) => (
                                        <div
                                            key={member.id}
                                            className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800"
                                        >
                                            <Avatar className="h-6 w-6">
                                                <AvatarImage src={member.photoURL} />
                                                <AvatarFallback className="text-xs bg-blue-100 text-blue-600">
                                                    {member.firstName?.[0]}{member.lastName?.[0]}
                                                </AvatarFallback>
                                            </Avatar>
                                            <span className="text-sm font-medium">
                                                {member.firstName} {member.lastName?.[0]}.
                                            </span>
                                        </div>
                                    ))
                                ) : (
                                    <p className="text-sm text-muted-foreground">Багийн гишүүд сонгогдоогүй байна</p>
                                )}
                            </div>
                        </CardContent>
                        </Card>
                    </div>

                    {/* Таскууд & Төсөлийн чат — нэг мөрөнд */}
                    <div className="grid lg:grid-cols-2 gap-4">
                        {/* Tasks List */}
                        <Card className="border-0 shadow-none bg-transparent">
                            <CardHeader className="pb-3 space-y-3">
                                <div className="flex items-center justify-between">
                                    <CardTitle className="text-lg font-semibold">Таскууд</CardTitle>
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm text-muted-foreground">{filteredTasks.length} таск</span>
                                        <AddActionButton
                                            label="Шинэ таск нэмэх"
                                            description="Шинэ таск үүсгэх"
                                            onClick={() => setIsCreateTaskOpen(true)}
                                        />
                                        <AddActionButton
                                            label="AI таск үүсгэх"
                                            description="AI ашиглан зорилгод нийцсэн таскууд үүсгэх"
                                            icon={<Sparkles className="h-4 w-4" />}
                                            onClick={() => setIsAiGenerateTasksOpen(true)}
                                        />
                                    </div>
                                </div>
                                <Tabs
                                    value={taskStatusFilter === 'OVERDUE' && taskStats.overdue === 0 ? 'ALL' : taskStatusFilter}
                                    onValueChange={(v) => setTaskStatusFilter(v as typeof taskStatusFilter)}
                                >
                                    <TabsList className="w-full flex-wrap h-auto gap-1 p-1.5">
                                        <TabsTrigger value="ALL" className="gap-1.5 data-[state=active]:bg-violet-600 data-[state=active]:text-white">
                                            Бүгд ({tasks?.length || 0})
                                        </TabsTrigger>
                                        <TabsTrigger value="TODO" className="gap-1.5 data-[state=active]:bg-slate-700 data-[state=active]:text-white">
                                            <ListTodo className="h-4 w-4" />
                                            Хийх ({taskStats.todo})
                                        </TabsTrigger>
                                        <TabsTrigger value="IN_PROGRESS" className="gap-1.5 data-[state=active]:bg-amber-500 data-[state=active]:text-white">
                                            <CircleDot className="h-4 w-4" />
                                            Гүйцэтгэж байна ({taskStats.inProgress})
                                        </TabsTrigger>
                                        <TabsTrigger value="DONE" className="gap-1.5 data-[state=active]:bg-green-500 data-[state=active]:text-white">
                                            <CheckCircle2 className="h-4 w-4" />
                                            Дууссан ({taskStats.done})
                                        </TabsTrigger>
                                        {taskStats.overdue > 0 && (
                                            <TabsTrigger value="OVERDUE" className="gap-1.5 data-[state=active]:bg-red-600 data-[state=active]:text-white">
                                                <AlertCircle className="h-4 w-4" />
                                                Хэтэрсэн ({taskStats.overdue})
                                            </TabsTrigger>
                                        )}
                                    </TabsList>
                                </Tabs>
                            </CardHeader>
                            <CardContent className="pt-0">
                                <TasksListTable
                                    tasks={filteredTasks}
                                    employeeMap={employeeMap}
                                    isLoading={isLoadingTasks}
                                    onStatusChange={handleTaskStatusChange}
                                    onEdit={setEditingTask}
                                    onAddTask={taskStatusFilter === 'ALL' ? () => setIsCreateTaskOpen(true) : undefined}
                                />
                            </CardContent>
                        </Card>

                        {/* Project Chat */}
                        <ProjectChatSection
                            projectId={projectId}
                            teamMembers={teamMembers}
                            employeeMap={employeeMap}
                        />
                    </div>
                </div>
            </div>

            <CreateTaskDialog
                open={isCreateTaskOpen}
                onOpenChange={setIsCreateTaskOpen}
                projectId={projectId}
                teamMemberIds={project?.teamMemberIds || []}
            />

            <AiGenerateTasksDialog
                open={isAiGenerateTasksOpen}
                onOpenChange={setIsAiGenerateTasksOpen}
                projectId={projectId}
                projectName={project.name}
                goal={project.goal || ''}
                expectedOutcome={project.expectedOutcome || ''}
                startDate={project.startDate || ''}
                endDate={project.endDate || ''}
            />

            <EditProjectInfoDialog
                open={isEditInfoOpen}
                onOpenChange={setIsEditInfoOpen}
                project={project}
            />
            <EditProjectTeamDialog
                open={isEditTeamOpen}
                onOpenChange={setIsEditTeamOpen}
                project={project}
            />
            <EditProjectScheduleDialog
                open={isEditScheduleOpen}
                onOpenChange={setIsEditScheduleOpen}
                project={project}
            />

            <AssignProjectGroupsDialog
                open={isAssignGroupsOpen}
                onOpenChange={setIsAssignGroupsOpen}
                project={project}
                groups={groups || []}
            />

            {editingTask && (
                <EditTaskDialog
                    open={!!editingTask}
                    onOpenChange={(open) => !open && setEditingTask(null)}
                    projectId={projectId}
                    task={editingTask}
                    teamMemberIds={project?.teamMemberIds || []}
                />
            )}

            <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Төсөл устгах</AlertDialogTitle>
                        <AlertDialogDescription>
                            Та &quot;{project.name}&quot; төслийг устгахдаа итгэлтэй байна уу?
                            Энэ үйлдлийг буцаах боломжгүй бөгөөд бүх таскууд устгагдана.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Болих</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDeleteProject}
                            className="bg-red-600 hover:bg-red-700"
                        >
                            Устгах
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
