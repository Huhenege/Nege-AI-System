// src/app/dashboard/training/components/training-dashboard.tsx
'use client';

import React from 'react';
import { StatCard, StatGrid } from '@/components/patterns/stat-card';
import { BookOpen, ClipboardList, CheckCircle2, AlertTriangle } from 'lucide-react';
import { TrainingCourse, TrainingPlan, SkillAssessment, SKILL_LEVEL_VALUE, PLAN_STATUS_LABELS } from '../types';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

interface TrainingDashboardProps {
    courses: TrainingCourse[];
    plans: TrainingPlan[];
    assessments: SkillAssessment[];
    isLoading: boolean;
}

export function TrainingDashboard({ courses, plans, assessments, isLoading }: TrainingDashboardProps) {
    const activeCourses = courses.filter(c => c.status === 'active').length;
    const activePlans = plans.filter(p => ['scheduled', 'in_progress', 'assigned'].includes(p.status ?? '')).length;
    const completedPlans = plans.filter(p => p.status === 'completed').length;
    const totalPlans = plans.filter(p => p.status !== 'cancelled').length;
    const completionRate = totalPlans > 0 ? Math.round((completedPlans / totalPlans) * 100) : 0;

    // Compute skill gaps from assessments that have requiredLevel
    const gapCount = assessments.filter(a => {
        if (!a.requiredLevel) return false;
        return SKILL_LEVEL_VALUE[a.requiredLevel] > SKILL_LEVEL_VALUE[a.currentLevel];
    }).length;

    const planDate = (p: TrainingPlan) => p.scheduledAt ?? p.dueDate ?? p.assignedAt ?? '';
    const planParticipantCount = (p: TrainingPlan) =>
        (p.participantIds?.length ?? 0) || (p.employeeId ? 1 : 0);

    // Recent plans (last 5) — by scheduled/due date
    const recentPlans = [...plans]
        .filter(p => planDate(p))
        .sort((a, b) => planDate(b).localeCompare(planDate(a)))
        .slice(0, 5);

    const statusColor: Record<string, string> = {
        scheduled: 'bg-blue-100 text-blue-700',
        in_progress: 'bg-amber-100 text-amber-700',
        completed: 'bg-emerald-100 text-emerald-700',
        cancelled: 'bg-slate-100 text-slate-500',
    };

    return (
        <div className="space-y-6">
            {/* Stat Cards */}
            <StatGrid columns={4}>
                <StatCard
                    title="Нийт сургалт"
                    value={isLoading ? '...' : activeCourses}
                    icon={BookOpen}
                    description="Идэвхтэй сургалтын тоо"
                    isLoading={isLoading}
                />
                <StatCard
                    title="Идэвхтэй төлөвлөгөө"
                    value={isLoading ? '...' : activePlans}
                    icon={ClipboardList}
                    description="Төлөвлөгдсөн болон явагдаж буй"
                    isLoading={isLoading}
                />
                <StatCard
                    title="Дуусгалтын хувь"
                    value={isLoading ? '...' : `${completionRate}%`}
                    icon={CheckCircle2}
                    description={`${completedPlans}/${totalPlans} дууссан`}
                    isLoading={isLoading}
                />
                <StatCard
                    title="Ур чадварын зөрүү"
                    value={isLoading ? '...' : gapCount}
                    icon={AlertTriangle}
                    description="Илэрсэн skill gap"
                    isLoading={isLoading}
                />
            </StatGrid>

            {/* Recent Training Plans */}
            <Card>
                <CardContent className="p-5">
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
                        Сүүлийн сургалтын төлөвлөгөөнүүд
                    </h3>
                    {isLoading ? (
                        <div className="space-y-3">
                            {[...Array(3)].map((_, i) => (
                                <Skeleton key={i} className="h-12 w-full" />
                            ))}
                        </div>
                    ) : recentPlans.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-4 text-center">
                            Сургалтын төлөвлөгөө байхгүй байна
                        </p>
                    ) : (
                        <div className="space-y-2">
                            {recentPlans.map(plan => (
                                <div
                                    key={plan.id}
                                    className="flex items-center justify-between rounded-lg border px-4 py-3 hover:bg-muted/50 transition-colors"
                                >
                                    <div className="space-y-0.5">
                                        <p className="text-sm font-medium">{plan.courseName}</p>
                                        <p className="text-xs text-muted-foreground">
                                            {new Date(planDate(plan)).toLocaleDateString('mn-MN')} · {planParticipantCount(plan)} оролцогч
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <Badge
                                            variant="secondary"
                                            className={statusColor[plan.status ?? ''] || 'bg-slate-100 text-slate-600'}
                                        >
                                            {PLAN_STATUS_LABELS[plan.status ?? ''] ?? plan.status}
                                        </Badge>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
