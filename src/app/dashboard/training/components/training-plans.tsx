// src/app/dashboard/training/components/training-plans.tsx
'use client';

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useFirebase } from '@/firebase';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AddActionButton } from '@/components/ui/add-action-button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EmptyState } from '@/components/patterns/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, ClipboardList, Trash2 } from 'lucide-react';
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
    TrainingPlan,
    TrainingCourse,
    TrainingCategory,
    PLAN_STATUSES,
    PLAN_STATUS_LABELS,
    PLAN_TYPE_LABELS,
    PLAN_FORMAT_LABELS,
    ASSESSMENT_METHOD_LABELS,
    COURSE_TYPE_LABELS,
    SKILL_LEVEL_LABELS,
} from '../types';
import { Employee } from '@/types';
import { CreatePlanDialog } from './create-plan-dialog';

interface SkillItem {
    id: string;
    name: string;
}

interface DepartmentOption {
    id: string;
    name: string;
}

interface PositionLevelOption {
    id: string;
    name: string;
}

interface PositionOption {
    id: string;
    levelId?: string;
    departmentId?: string;
}

interface TrainingPlansProps {
    plans: TrainingPlan[];
    courses: TrainingCourse[];
    employees: Employee[];
    departments?: DepartmentOption[];
    positionLevels?: PositionLevelOption[];
    positions?: PositionOption[];
    categories?: TrainingCategory[];
    skills?: SkillItem[];
    isLoading: boolean;
    onCreatePlan: (values: import('../types').CreatePlanFormValues, courseName: string) => void;
    onDeletePlan?: (planId: string) => void;
}

export function TrainingPlans({
    plans,
    courses,
    employees,
    departments = [],
    positionLevels = [],
    positions = [],
    categories = [],
    skills = [],
    isLoading,
    onCreatePlan,
    onDeletePlan,
}: TrainingPlansProps) {
    const router = useRouter();
    useFirebase();
    const [searchQuery, setSearchQuery] = useState('');
    const [categoryFilter, setCategoryFilter] = useState<string>('all');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [createOpen, setCreateOpen] = useState(false);
    const [planToDelete, setPlanToDelete] = useState<TrainingPlan | null>(null);

    const planDate = (p: TrainingPlan) => p.scheduledAt ?? p.dueDate ?? p.assignedAt ?? '';
    const planParticipantIds = (p: TrainingPlan) => p.participantIds ?? (p.employeeId ? [p.employeeId] : []);
    const planParticipantNames = (p: TrainingPlan) => p.participantNames ?? (p.employeeName ? [p.employeeName] : []);

    const skillMap = useMemo(() => {
        const m = new Map<string, string>();
        skills.forEach(s => m.set(s.id, s.name));
        return m;
    }, [skills]);
    const courseMap = useMemo(() => {
        const m = new Map<string, TrainingCourse>();
        courses.forEach(c => m.set(c.id, c));
        return m;
    }, [courses]);
    const categoryMap = useMemo(() => {
        const m = new Map<string, string>();
        categories.forEach(c => m.set(c.id, c.name));
        return m;
    }, [categories]);
    const getCategoryNames = (plan: TrainingPlan) => {
        const ids = plan.categoryIds ?? [];
        if (ids.length === 0) return '—';
        return ids.map(id => categoryMap.get(id) ?? id).join(', ');
    };
    const getCompetency = (plan: TrainingPlan) => {
        const course = courseMap.get(plan.courseId);
        if (!course?.skillIds?.length) return '—';
        return course.skillIds.map(id => skillMap.get(id) || id).join(', ');
    };
    const getLevel = (plan: TrainingPlan) => {
        const course = courseMap.get(plan.courseId);
        return course ? SKILL_LEVEL_LABELS[course.targetLevel] : '—';
    };
    const getFormat = (plan: TrainingPlan) => {
        if (plan.format) return PLAN_FORMAT_LABELS[plan.format];
        const course = courseMap.get(plan.courseId);
        return course ? COURSE_TYPE_LABELS[course.type] : '—';
    };
    const formatScheduleQuarter = (plan: TrainingPlan) => {
        if (plan.scheduledQuarter) {
            const [y, q] = plan.scheduledQuarter.split('-');
            return q && y ? `${q} ${y}` : plan.scheduledQuarter;
        }
        const iso = planDate(plan);
        if (!iso) return '—';
        const d = new Date(iso);
        const m = d.getMonth() + 1;
        const q = m <= 3 ? 'Q1' : m <= 6 ? 'Q2' : m <= 9 ? 'Q3' : 'Q4';
        return `${q} ${d.getFullYear()}`;
    };

    const filteredPlans = useMemo(() => {
        return plans.filter(plan => {
            const q = searchQuery.toLowerCase();
            const courseMatch = plan.courseName?.toLowerCase().includes(q);
            const participantMatch = (planParticipantNames(plan)).some(n => n?.toLowerCase().includes(q));
            const purposeMatch = plan.purpose?.toLowerCase().includes(q);
            const audienceMatch = plan.targetAudience?.toLowerCase().includes(q);
            const ownerMatch = plan.owner?.toLowerCase().includes(q);
            const matchesSearch = courseMatch || participantMatch || purposeMatch || audienceMatch || ownerMatch;

            const matchesStatus = statusFilter === 'all' || plan.status === statusFilter;
            const matchesCategory = categoryFilter === 'all' || (plan.categoryIds ?? []).includes(categoryFilter);
            return matchesSearch && matchesStatus && matchesCategory;
        });
    }, [plans, searchQuery, statusFilter, categoryFilter]);

    const statusColor: Record<string, string> = {
        scheduled: 'bg-blue-100 text-blue-700',
        in_progress: 'bg-amber-100 text-amber-700',
        completed: 'bg-emerald-100 text-emerald-700',
        cancelled: 'bg-slate-100 text-slate-500',
        published: 'bg-emerald-100 text-emerald-700',
    };

    const statusCounts = useMemo(() => {
        const counts: Record<string, number> = { all: plans.length };
        PLAN_STATUSES.forEach(s => {
            counts[s] = plans.filter(p => p.status === s).length;
        });
        counts['assigned'] = plans.filter(p => p.status === 'assigned').length;
        counts['overdue'] = plans.filter(p => p.status === 'overdue').length;
        return counts;
    }, [plans]);

    return (
        <div className="space-y-4">
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                <div className="flex flex-1 w-full gap-3 flex-wrap">
                    <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                        <SelectTrigger className="w-[180px] bg-white border shadow-sm h-11 rounded-xl">
                            <SelectValue placeholder="Ангилал" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Бүх ангилал</SelectItem>
                            {categories.map(cat => (
                                <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <div className="flex-1 min-w-[200px] relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Сургалт эсвэл оролцогчоор хайх..."
                            className="pl-9 bg-white border shadow-sm h-11 rounded-xl"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="w-[200px] bg-white border shadow-sm h-11 rounded-xl">
                            <SelectValue placeholder="Бүх төлөв" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Бүх төлөв ({statusCounts.all})</SelectItem>
                            {PLAN_STATUSES.map(s => (
                                <SelectItem key={s} value={s}>
                                    {PLAN_STATUS_LABELS[s]} ({statusCounts[s] || 0})
                                </SelectItem>
                            ))}
                            {(statusCounts['assigned'] || statusCounts['overdue']) ? (
                                <>
                                    {statusCounts['assigned'] ? (
                                        <SelectItem value="assigned">{PLAN_STATUS_LABELS['assigned']} ({statusCounts['assigned']})</SelectItem>
                                    ) : null}
                                    {statusCounts['overdue'] ? (
                                        <SelectItem value="overdue">{PLAN_STATUS_LABELS['overdue']} ({statusCounts['overdue']})</SelectItem>
                                    ) : null}
                                </>
                            ) : null}
                        </SelectContent>
                    </Select>
                </div>
                <AddActionButton
                    label="Төлөвлөгөө үүсгэх"
                    description="Сургалтаар нэгдсэн төлөвлөгөө үүсгэх"
                    onClick={() => setCreateOpen(true)}
                />
            </div>

            {isLoading ? (
                <div className="space-y-3">
                    {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
                </div>
            ) : filteredPlans.length === 0 ? (
                <EmptyState
                    icon={ClipboardList}
                    title="Төлөвлөгөө олдсонгүй"
                    description={plans.length === 0
                        ? 'Сангаас сургалт сонгоод огноо, төсөв, оролцогчдыг тодорхойлж төлөвлөгөө үүсгэнэ үү.'
                        : 'Хайлтын үр дүн олдсонгүй.'}
                    action={plans.length === 0 ? {
                        label: 'Төлөвлөгөө үүсгэх',
                        onClick: () => setCreateOpen(true),
                    } : undefined}
                />
            ) : (
                <div className="rounded-xl border bg-white shadow-sm overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-10 text-center">№</TableHead>
                                <TableHead className="min-w-[120px]">Ангилал</TableHead>
                                <TableHead>Сургалтын нэр</TableHead>
                                <TableHead>Зорилго</TableHead>
                                <TableHead className="min-w-[140px]">Хамаарах ур чадвар</TableHead>
                                <TableHead>Хэнд</TableHead>
                                <TableHead>Төрөл</TableHead>
                                <TableHead>Түвшин</TableHead>
                                <TableHead>Хугацаа</TableHead>
                                <TableHead>Хариуцсан эзэн</TableHead>
                                <TableHead>Хэлбэр</TableHead>
                                <TableHead>Байршил/линк</TableHead>
                                <TableHead>Төлөв</TableHead>
                                <TableHead>Үнэлгээний арга</TableHead>
                                <TableHead className="min-w-[100px]">Тайлбар</TableHead>
                                <TableHead className="w-[80px] text-center">Үйлдэл</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredPlans.map((plan, index) => (
                                <TableRow key={plan.id} className="hover:bg-muted/30">
                                    <TableCell className="text-center text-muted-foreground font-medium">{index + 1}</TableCell>
                                    <TableCell>
                                        <span className="text-sm text-muted-foreground">{getCategoryNames(plan)}</span>
                                    </TableCell>
                                    <TableCell>
                                        <button
                                            type="button"
                                            className="font-medium text-sm whitespace-nowrap text-primary hover:underline text-left"
                                            onClick={() => router.push(`/dashboard/training/plans/${plan.id}`)}
                                        >
                                            {plan.courseName}
                                        </button>
                                    </TableCell>
                                    <TableCell>
                                        <span className="text-sm text-muted-foreground">{plan.purpose || '—'}</span>
                                    </TableCell>
                                    <TableCell>
                                        <span className="text-sm">{getCompetency(plan)}</span>
                                    </TableCell>
                                    <TableCell>
                                        <span className="text-sm">{plan.targetAudience || (planParticipantNames(plan).length ? planParticipantNames(plan).join(', ') : '—')}</span>
                                    </TableCell>
                                    <TableCell>
                                        <span className="text-sm">{plan.planType ? PLAN_TYPE_LABELS[plan.planType] : '—'}</span>
                                    </TableCell>
                                    <TableCell>
                                        <span className="text-sm">{getLevel(plan)}</span>
                                    </TableCell>
                                    <TableCell>
                                        <span className="text-sm text-muted-foreground">{formatScheduleQuarter(plan)}</span>
                                    </TableCell>
                                    <TableCell>
                                        <span className="text-sm">{plan.owner || '—'}</span>
                                    </TableCell>
                                    <TableCell>
                                        <span className="text-sm">{getFormat(plan)}</span>
                                    </TableCell>
                                    <TableCell>
                                        <span className="text-sm text-muted-foreground truncate max-w-[120px] block" title={plan.locationOrLink}>{plan.locationOrLink || '—'}</span>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="secondary" className={statusColor[plan.status ?? ''] || 'bg-slate-100 text-slate-600'}>
                                            {PLAN_STATUS_LABELS[plan.status ?? ''] ?? plan.status}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <span className="text-sm">{plan.assessmentMethod ? ASSESSMENT_METHOD_LABELS[plan.assessmentMethod] : '—'}</span>
                                    </TableCell>
                                    <TableCell>
                                        <span className="text-sm text-muted-foreground truncate max-w-[100px] block" title={plan.notes}>{plan.notes || '—'}</span>
                                    </TableCell>
                                    <TableCell className="text-center">
                                        {onDeletePlan && (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-rose-600 hover:bg-rose-50"
                                                onClick={() => setPlanToDelete(plan)}
                                                title="Устгах"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            )}

            <AlertDialog open={!!planToDelete} onOpenChange={(open) => { if (!open) setPlanToDelete(null); }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Сургалтын төлөвлөгөөг устгах уу?</AlertDialogTitle>
                        <AlertDialogDescription>
                            &quot;{planToDelete?.courseName}&quot; төлөвлөгөөг бүрмөсөн устгана. Энэ үйлдлийг буцааж болохгүй.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Цуцлах</AlertDialogCancel>
                        <AlertDialogAction
                            variant="destructive"
                            onClick={() => {
                                if (planToDelete && onDeletePlan) {
                                    onDeletePlan(planToDelete.id);
                                    setPlanToDelete(null);
                                }
                            }}
                        >
                            Устгах
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <CreatePlanDialog
                open={createOpen}
                onOpenChange={setCreateOpen}
                onSubmit={onCreatePlan}
                employees={employees}
                courses={courses}
                departments={departments}
                positionLevels={positionLevels}
                positions={positions}
                categories={categories}
            />
        </div>
    );
}
