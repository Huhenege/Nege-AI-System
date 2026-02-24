// src/app/dashboard/training/components/training-plans.tsx
'use client';

import React, { useState, useMemo } from 'react';
import { doc } from 'firebase/firestore';
import { useFirebase, updateDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AddActionButton } from '@/components/ui/add-action-button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EmptyState } from '@/components/patterns/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle,
    DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Search, ClipboardList, Users, Trash2, Pencil, Send } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
    TrainingPlan,
    TrainingCourse,
    PLAN_STATUSES,
    PLAN_STATUS_LABELS,
    PLAN_TRIGGER_LABELS,
    PLAN_TYPE_LABELS,
    PLAN_FORMAT_LABELS,
    ASSESSMENT_METHOD_LABELS,
    PlanStatus,
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
    skills?: SkillItem[];
    isLoading: boolean;
    onCreatePlan: (values: import('../types').CreatePlanFormValues, courseName: string) => void;
}

export function TrainingPlans({
    plans,
    courses,
    employees,
    departments = [],
    positionLevels = [],
    positions = [],
    skills = [],
    isLoading,
    onCreatePlan,
}: TrainingPlansProps) {
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [createOpen, setCreateOpen] = useState(false);
    const [editingPlan, setEditingPlan] = useState<TrainingPlan | null>(null);

    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
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
            return matchesSearch && matchesStatus;
        });
    }, [plans, searchQuery, statusFilter]);

    const handleStatusChange = (planId: string, newStatus: PlanStatus) => {
        if (!firestore) return;
        const updates: Record<string, unknown> = { status: newStatus };
        if (newStatus === 'in_progress') {
            updates.startedAt = new Date().toISOString();
        }
        if (newStatus === 'completed' || newStatus === 'cancelled') {
            updates.completedAt = new Date().toISOString();
        }
        updateDocumentNonBlocking(doc(firestore, 'training_plans', planId), updates);
        toast({ title: 'Төлөв шинэчлэгдлээ' });
    };

    const handlePublishPlan = (plan: TrainingPlan) => {
        if (!firestore) return;
        updateDocumentNonBlocking(doc(firestore, 'training_plans', plan.id), {
            status: 'published' as PlanStatus,
            completedAt: new Date().toISOString(),
        });
        toast({ title: 'Сургалт зарлагдлаа', description: plan.courseName });
    };

    const openDeleteDialog = (plan: TrainingPlan) => {
        setPlanToDelete(plan);
        setDeleteDialogOpen(true);
    };

    const handleDeletePlan = () => {
        if (!firestore || !planToDelete) return;
        deleteDocumentNonBlocking(doc(firestore, 'training_plans', planToDelete.id));
        toast({ title: 'Сургалтын төлөвлөгөөг сутгалаа', description: planToDelete.courseName });
        setDeleteDialogOpen(false);
        setPlanToDelete(null);
    };

    const openEditDialog = (plan: TrainingPlan) => {
        setEditingPlan(plan);
        setCreateOpen(true);
    };

    const handleUpdatePlan = (planId: string, values: import('../types').CreatePlanFormValues, courseName: string) => {
        if (!firestore) return;
        const participantNames = values.participantIds.map(empId => {
            const emp = employees.find(e => e.id === empId);
            return emp ? `${emp.lastName?.charAt(0) || ''}. ${emp.firstName}` : '';
        });
        const updates: Record<string, unknown> = {
            courseId: values.courseId,
            courseName,
            scheduledQuarter: values.scheduledQuarter,
            participantIds: values.participantIds,
            participantNames,
            trigger: values.trigger,
        };
        if (values.budget != null && values.budget > 0) updates.budget = values.budget;
        if (values.notes != null) updates.notes = values.notes;
        if (values.purpose != null) updates.purpose = values.purpose;
        if (values.targetAudience != null) updates.targetAudience = values.targetAudience;
        if (values.planType != null) updates.planType = values.planType;
        if (values.owner != null) updates.owner = values.owner;
        if (values.format != null) updates.format = values.format;
        if (values.locationOrLink != null) updates.locationOrLink = values.locationOrLink;
        if (values.assessmentMethod != null) updates.assessmentMethod = values.assessmentMethod;
        if (values.providerType != null) updates.providerType = values.providerType;
        updateDocumentNonBlocking(doc(firestore, 'training_plans', planId), updates);
        toast({ title: 'Төлөвлөгөө шинэчлэгдлээ', description: courseName });
        setEditingPlan(null);
        setCreateOpen(false);
    };

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
                <div className="flex flex-1 w-full gap-3">
                    <div className="flex-1 relative">
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
                                <TableHead>Сургалтын нэр</TableHead>
                                <TableHead>Зорилго</TableHead>
                                <TableHead className="min-w-[140px]">Хамаарах ур чадвар</TableHead>
                                <TableHead>Хэнд</TableHead>
                                <TableHead>Төрөл</TableHead>
                                <TableHead>Түвшин</TableHead>
                                <TableHead>Хугацаа</TableHead>
                                <TableHead>Хариуцсан эзэн</TableHead>
                                <TableHead>Формат</TableHead>
                                <TableHead>Байршил/линк</TableHead>
                                <TableHead>Төлөв</TableHead>
                                <TableHead>Үнэлгээний арга</TableHead>
                                <TableHead className="min-w-[100px]">Тайлбар</TableHead>
                                <TableHead className="w-[120px]"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredPlans.map((plan, index) => (
                                <TableRow key={plan.id} className="hover:bg-muted/30">
                                    <TableCell className="text-center text-muted-foreground font-medium">{index + 1}</TableCell>
                                    <TableCell>
                                        <p className="font-medium text-sm whitespace-nowrap">{plan.courseName}</p>
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
                                    <TableCell>
                                        <div className="flex items-center gap-1">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-muted-foreground"
                                                title="Засах"
                                                onClick={() => openEditDialog(plan)}
                                            >
                                                <Pencil className="h-3.5 w-3.5" />
                                            </Button>
                                            {(plan.status === 'scheduled' || plan.status === 'assigned' || plan.status === 'in_progress' || plan.status === 'overdue') && (
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-emerald-600"
                                                    title="Сургалт зарлах"
                                                    onClick={() => handlePublishPlan(plan)}
                                                >
                                                    <Send className="h-3.5 w-3.5" />
                                                </Button>
                                            )}
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                                title="Сутгах"
                                                onClick={() => openDeleteDialog(plan)}
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            )}

            <CreatePlanDialog
                open={createOpen}
                onOpenChange={(open) => {
                    setCreateOpen(open);
                    if (!open) setEditingPlan(null);
                }}
                onSubmit={onCreatePlan}
                onUpdate={handleUpdatePlan}
                editingPlan={editingPlan}
                employees={employees}
                courses={courses}
                departments={departments}
                positionLevels={positionLevels}
                positions={positions}
            />

            <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <DialogContent className="sm:max-w-[400px]">
                    <DialogHeader>
                        <DialogTitle>Сургалтын төлөвлөгөөг сутгах</DialogTitle>
                        <DialogDescription>
                            {`"${planToDelete?.courseName}" төлөвлөгөөг бүрмөсөн устгах уу? Энэ үйлдлийг буцааж болохгүй.`}
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Болих</Button>
                        <Button variant="destructive" onClick={handleDeletePlan}>Сутгах</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
