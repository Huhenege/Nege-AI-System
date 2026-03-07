'use client';

import React, { useState, useMemo } from 'react';
import { PageHeader } from '@/components/patterns/page-layout';
import { Button } from '@/components/ui/button';
import { AddActionButton } from '@/components/ui/add-action-button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import {
    FolderKanban,
    Search,
    X,
    LayoutGrid,
    List,
    GanttChart,
    Tag,
    Users,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCollection, useFirebase, useMemoFirebase, tenantCollection } from '@/firebase';
import { collectionGroup, query, orderBy } from 'firebase/firestore';
import { Project, ProjectStatus, ProjectGroup } from '@/types/project';
import { Employee } from '@/types';
import { CreateProjectDialog } from './components/create-project-dialog';
import { ProjectGroupsManagerDialog } from './components/project-groups-manager-dialog';
import { AssignProjectGroupsDialog } from './components/assign-project-groups-dialog';
import { ProjectsDashboard } from './components/projects-dashboard';
import { ProjectsGanttView } from './components/projects-gantt-view';
import { ProjectsListTable } from './components/projects-list-table';

export default function ProjectsPage() {
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<ProjectStatus>('ACTIVE');
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
    const [viewMode, setViewMode] = useState<'grid' | 'list' | 'gantt'>('list');
    const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
    const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);
    const [employeeSearchQuery, setEmployeeSearchQuery] = useState('');
    const [isGroupsManagerOpen, setIsGroupsManagerOpen] = useState(false);
    const [assignGroupsProject, setAssignGroupsProject] = useState<Project | null>(null);

    const { firestore } = useFirebase();

    // Fetch projects
    const projectsQuery = useMemoFirebase(
        ({ firestore, companyPath }) => firestore 
            ? query(tenantCollection(firestore, companyPath, 'projects'), orderBy('createdAt', 'desc')) 
            : null,
        [firestore]
    );
    const { data: projects, isLoading: isLoadingProjects } = useCollection<Project>(projectsQuery);

    // Fetch project groups
    const groupsQuery = useMemoFirebase(
        ({ firestore, companyPath }) => firestore ? query(tenantCollection(firestore, companyPath, 'project_groups'), orderBy('name', 'asc')) : null,
        [firestore]
    );
    const { data: groups, isLoading: isLoadingGroups } = useCollection<ProjectGroup>(groupsQuery as any);

    const groupsById = useMemo(() => {
        return new Map((groups || []).map(g => [g.id, g]));
    }, [groups]);

    // Fetch all tasks (collectionGroup) to count per project
    const allTasksQuery = useMemoFirebase(
        () => firestore ? collectionGroup(firestore, 'tasks') : null,
        [firestore]
    );
    const { data: allTasks } = useCollection<{ projectId?: string }>(allTasksQuery);

    const taskCountByProjectId = useMemo(() => {
        const map = new Map<string, number>();
        if (!allTasks) return map;
        for (const task of allTasks) {
            const pid = task.projectId ?? (task as any).ref?.parent?.parent?.id;
            if (pid) {
                map.set(pid, (map.get(pid) ?? 0) + 1);
            }
        }
        return map;
    }, [allTasks]);

    // Fetch employees for owner display
    const employeesQuery = useMemoFirebase(
        ({ firestore, companyPath }) => firestore ? tenantCollection(firestore, companyPath, 'employees') : null,
        [firestore]
    );
    const { data: employees, isLoading: isLoadingEmployees } = useCollection<Employee>(employeesQuery);

    const employeeMap = useMemo(() => {
        return new Map((employees || []).map(e => [e.id, e]));
    }, [employees]);

    const toggleGroupFilter = (groupId: string, checked: boolean) => {
        setSelectedGroupIds((prev) => checked ? Array.from(new Set([...prev, groupId])) : prev.filter((id) => id !== groupId));
    };

    const toggleEmployeeFilter = (employeeId: string, checked: boolean) => {
        setSelectedEmployeeIds((prev) => checked ? Array.from(new Set([...prev, employeeId])) : prev.filter((id) => id !== employeeId));
    };

    // Employees who participate in at least one project (as owner or team member)
    const projectEmployees = useMemo(() => {
        if (!projects || !employees) return [];
        const idSet = new Set<string>();
        projects.forEach(p => {
            if (p.ownerId) idSet.add(p.ownerId);
            (p.teamMemberIds || []).forEach(id => idSet.add(id));
        });
        return employees
            .filter(e => idSet.has(e.id))
            .sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`));
    }, [projects, employees]);

    const filteredEmployeeList = useMemo(() => {
        if (!employeeSearchQuery) return projectEmployees;
        const q = employeeSearchQuery.toLowerCase();
        return projectEmployees.filter(e =>
            `${e.firstName} ${e.lastName}`.toLowerCase().includes(q)
        );
    }, [projectEmployees, employeeSearchQuery]);

    // Filter projects
    const filteredProjects = useMemo(() => {
        if (!projects) return [];
        
        return projects.filter(project => {
            // Group filter (multi)
            if (selectedGroupIds.length > 0) {
                const ids = project.groupIds || [];
                if (!selectedGroupIds.some((gid) => ids.includes(gid))) return false;
            }

            // Employee filter (multi) — match if employee is owner or team member
            if (selectedEmployeeIds.length > 0) {
                const allMembers = [project.ownerId, ...(project.teamMemberIds || [])];
                if (!selectedEmployeeIds.some((eid) => allMembers.includes(eid))) return false;
            }

            // Status filter
            if (project.status !== statusFilter) {
                return false;
            }
            
            // Search filter
            if (searchQuery) {
                const query = searchQuery.toLowerCase();
                const owner = employeeMap.get(project.ownerId);
                const ownerName = owner ? `${owner.firstName} ${owner.lastName}`.toLowerCase() : '';
                
                return (
                    project.name.toLowerCase().includes(query) ||
                    project.goal?.toLowerCase().includes(query) ||
                    project.expectedOutcome?.toLowerCase().includes(query) ||
                    ownerName.includes(query)
                );
            }
            
            return true;
        }).sort((a, b) => new Date(a.endDate).getTime() - new Date(b.endDate).getTime());
    }, [projects, statusFilter, searchQuery, employeeMap, selectedGroupIds, selectedEmployeeIds]);

    const isLoading = isLoadingProjects || isLoadingEmployees || isLoadingGroups;
    const hasActiveFilters = searchQuery || selectedGroupIds.length > 0 || selectedEmployeeIds.length > 0;

    // Status config with colors
    const statusConfig: Record<string, { label: string; color: string; bgColor: string }> = {
        DRAFT: { label: 'Ноорог', color: 'text-slate-600', bgColor: 'bg-slate-100' },
        ACTIVE: { label: 'Идэвхтэй', color: 'text-emerald-600', bgColor: 'bg-emerald-50' },
        ON_HOLD: { label: 'Түр зогссон', color: 'text-amber-600', bgColor: 'bg-amber-50' },
        COMPLETED: { label: 'Дууссан', color: 'text-blue-600', bgColor: 'bg-blue-50' },
        ARCHIVED: { label: 'Архивласан', color: 'text-zinc-500', bgColor: 'bg-zinc-100' },
        // Legacy statuses
        PLANNING: { label: 'Ноорог', color: 'text-slate-600', bgColor: 'bg-slate-100' },
        IN_PROGRESS: { label: 'Идэвхтэй', color: 'text-emerald-600', bgColor: 'bg-emerald-50' },
        CANCELLED: { label: 'Архивласан', color: 'text-zinc-500', bgColor: 'bg-zinc-100' },
    };

    return (
        <div className="flex flex-col h-full overflow-hidden">
            <div className="flex-1 overflow-y-auto">
                {/* Header Section with Gradient Background */}
                <div className="bg-gradient-to-br from-violet-500/10 via-purple-500/5 to-fuchsia-500/10 dark:from-violet-500/5 dark:via-purple-500/5 dark:to-fuchsia-500/5">
                    <div className="px-6 py-6">
                        <PageHeader
                            title="Төслүүд"
                            description="Төсөл болон таскуудын менежмент"
                            showBackButton={true}
                            hideBreadcrumbs={true}
                            backButtonPlacement="inline"
                            backBehavior="history"
                            fallbackBackHref="/dashboard"
                            actions={
                                <AddActionButton
                                    label="Шинэ төсөл"
                                    description="Шинэ төсөл үүсгэх"
                                    onClick={() => setIsCreateDialogOpen(true)}
                                />
                            }
                        />

                        {/* Dashboard | төсөл */}
                        <div className="mt-6">
                            <ProjectsDashboard
                                projects={projects ?? null}
                                isLoading={isLoading}
                            />
                        </div>
                    </div>
                </div>

                {/* Main Content */}
                <div className="px-6 py-6">
                    {/* Search Bar */}
                    <div className="flex flex-col sm:flex-row gap-3 mb-4">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Төсөл хайх..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-10 bg-white dark:bg-slate-900"
                            />
                            {searchQuery && (
                                <button
                                    onClick={() => setSearchQuery('')}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            )}
                        </div>

                        <div className="flex gap-2">
                            {/* Employee Filter */}
                            <Popover onOpenChange={(open) => { if (!open) setEmployeeSearchQuery(''); }}>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" className="bg-white dark:bg-slate-900">
                                        <Users className="h-4 w-4 mr-2 text-muted-foreground" />
                                        Ажилтан
                                        {selectedEmployeeIds.length > 0 && (
                                            <Badge variant="secondary" className="ml-2">
                                                {selectedEmployeeIds.length}
                                            </Badge>
                                        )}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[320px] p-3" align="end">
                                    <div className="text-sm font-semibold mb-2">Ажилтнаар шүүх</div>
                                    <div className="relative mb-2">
                                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                                        <Input
                                            placeholder="Ажилтан хайх..."
                                            value={employeeSearchQuery}
                                            onChange={(e) => setEmployeeSearchQuery(e.target.value)}
                                            className="h-8 pl-8 text-sm"
                                        />
                                    </div>
                                    <ScrollArea className="h-[220px] pr-2">
                                        <div className="space-y-1">
                                            {filteredEmployeeList.length === 0 ? (
                                                <div className="text-sm text-muted-foreground py-2">Ажилтан олдсонгүй</div>
                                            ) : (
                                                filteredEmployeeList.map((emp) => {
                                                    const checked = selectedEmployeeIds.includes(emp.id);
                                                    return (
                                                        <label key={emp.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer">
                                                            <Checkbox checked={checked} onCheckedChange={(v) => toggleEmployeeFilter(emp.id, !!v)} />
                                                            <Avatar className="h-6 w-6">
                                                                <AvatarImage src={emp.photoURL} />
                                                                <AvatarFallback className="text-[9px] bg-violet-100 text-violet-600">
                                                                    {`${emp.firstName?.[0] || ''}${emp.lastName?.[0] || ''}`}
                                                                </AvatarFallback>
                                                            </Avatar>
                                                            <span className="text-sm font-medium truncate">{emp.firstName} {emp.lastName}</span>
                                                        </label>
                                                    );
                                                })
                                            )}
                                        </div>
                                    </ScrollArea>
                                    {selectedEmployeeIds.length > 0 && (
                                        <div className="pt-2 flex justify-end">
                                            <Button variant="outline" size="sm" onClick={() => setSelectedEmployeeIds([])}>
                                                Цэвэрлэх
                                            </Button>
                                        </div>
                                    )}
                                </PopoverContent>
                            </Popover>

                            {/* Group Filter */}
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" className="bg-white dark:bg-slate-900">
                                        <Tag className="h-4 w-4 mr-2 text-muted-foreground" />
                                        Бүлэг
                                        {selectedGroupIds.length > 0 && (
                                            <Badge variant="secondary" className="ml-2">
                                                {selectedGroupIds.length}
                                            </Badge>
                                        )}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[320px] p-3" align="end">
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="text-sm font-semibold">Бүлгээр шүүх</div>
                                        <Button variant="ghost" size="sm" onClick={() => setIsGroupsManagerOpen(true)}>
                                            Бүлэг удирдах
                                        </Button>
                                    </div>
                                    <ScrollArea className="h-[220px] pr-2">
                                        <div className="space-y-2">
                                            {(groups || []).length === 0 ? (
                                                <div className="text-sm text-muted-foreground">Бүлэг алга.</div>
                                            ) : (
                                                (groups || []).map((g) => {
                                                    const checked = selectedGroupIds.includes(g.id);
                                                    return (
                                                        <label key={g.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer">
                                                            <Checkbox checked={checked} onCheckedChange={(v) => toggleGroupFilter(g.id, !!v)} />
                                                            <span className="h-3 w-3 rounded-full" style={{ backgroundColor: g.color || '#94a3b8' }} />
                                                            <span className="text-sm font-medium">{g.name}</span>
                                                        </label>
                                                    );
                                                })
                                            )}
                                        </div>
                                    </ScrollArea>
                                    {selectedGroupIds.length > 0 && (
                                        <div className="pt-2 flex justify-end">
                                            <Button variant="outline" size="sm" onClick={() => setSelectedGroupIds([])}>
                                                Цэвэрлэх
                                            </Button>
                                        </div>
                                    )}
                                </PopoverContent>
                            </Popover>

                            {/* View Mode Toggle */}
                            <div className="flex border rounded-md bg-white dark:bg-slate-900">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setViewMode('list')}
                                    className={cn(
                                        "rounded-r-none rounded-l-md",
                                        viewMode === 'list' && "bg-muted"
                                    )}
                                >
                                    <List className="h-4 w-4" />
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setViewMode('gantt')}
                                    className={cn(
                                        "rounded-none",
                                        viewMode === 'gantt' && "bg-muted"
                                    )}
                                >
                                    <GanttChart className="h-4 w-4" />
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setViewMode('grid')}
                                    className={cn(
                                        "rounded-l-none rounded-r-md",
                                        viewMode === 'grid' && "bg-muted"
                                    )}
                                >
                                    <LayoutGrid className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    </div>

                    {/* Status Tabs */}
                    <div className="mb-4">
                        <Tabs value={statusFilter} onValueChange={(value) => setStatusFilter(value as ProjectStatus)}>
                            <TabsList>
                                <TabsTrigger value="ACTIVE">Идэвхтэй</TabsTrigger>
                                <TabsTrigger value="DRAFT">Ноорог</TabsTrigger>
                                <TabsTrigger value="COMPLETED">Дууссан</TabsTrigger>
                                <TabsTrigger value="ON_HOLD">Түр зогссон</TabsTrigger>
                                <TabsTrigger value="ARCHIVED">Архивласан</TabsTrigger>
                            </TabsList>
                        </Tabs>
                    </div>

                    {/* Results Count */}
                    {!isLoading && (
                        <p className="text-sm text-muted-foreground mb-4">
                            {filteredProjects.length} төсөл олдлоо
                        </p>
                    )}

                    {/* Projects Grid/List/Gantt */}
                    {viewMode === 'gantt' ? (
                        isLoading ? (
                            <div className="space-y-2">
                                {Array.from({ length: 5 }).map((_, i) => (
                                    <Skeleton key={i} className="h-12 w-full rounded-xl" />
                                ))}
                            </div>
                        ) : (
                            <ProjectsGanttView projects={filteredProjects} />
                        )
                    ) : (
                        <ProjectsListTable
                            projects={filteredProjects}
                            employeeMap={employeeMap}
                            groupsById={groupsById}
                            taskCountByProjectId={taskCountByProjectId}
                            isLoading={isLoading}
                            variant={viewMode}
                            onEditGroups={(p) => setAssignGroupsProject(p)}
                            onClearFilters={hasActiveFilters ? () => {
                                setSearchQuery('');
                                setSelectedGroupIds([]);
                                setSelectedEmployeeIds([]);
                            } : undefined}
                            onCreateProject={!hasActiveFilters ? () => setIsCreateDialogOpen(true) : undefined}
                        />
                    )}
                </div>
            </div>

            <CreateProjectDialog
                open={isCreateDialogOpen}
                onOpenChange={setIsCreateDialogOpen}
                groups={groups || []}
            />

            <ProjectGroupsManagerDialog
                open={isGroupsManagerOpen}
                onOpenChange={setIsGroupsManagerOpen}
                groups={groups || []}
            />

            <AssignProjectGroupsDialog
                open={!!assignGroupsProject}
                onOpenChange={(open) => !open && setAssignGroupsProject(null)}
                project={assignGroupsProject}
                groups={groups || []}
            />
        </div>
    );
}
