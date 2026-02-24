'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { BookOpen, ClipboardList, CheckCircle2, AlertTriangle } from 'lucide-react';
import { TrainingCourse, TrainingPlan, SkillAssessment, SKILL_LEVEL_VALUE, PLAN_STATUS_LABELS } from '../types';

interface TrainingDashboardCardProps {
    courses: TrainingCourse[];
    plans: TrainingPlan[];
    assessments: SkillAssessment[];
    isLoading: boolean;
}

export function TrainingDashboardCard({
    courses,
    plans,
    assessments,
    isLoading,
}: TrainingDashboardCardProps) {
    const activeCourses = courses.filter(c => c.status === 'active').length;
    const activePlans = plans.filter(p => ['scheduled', 'in_progress', 'assigned'].includes(p.status ?? '')).length;
    const completedPlans = plans.filter(p => p.status === 'completed').length;
    const totalPlans = plans.filter(p => p.status !== 'cancelled').length;
    const completionRate = totalPlans > 0 ? Math.round((completedPlans / totalPlans) * 100) : 0;
    const gapCount = assessments.filter(a => {
        if (!a.requiredLevel) return false;
        return SKILL_LEVEL_VALUE[a.requiredLevel] > SKILL_LEVEL_VALUE[a.currentLevel];
    }).length;

    const planDate = (p: TrainingPlan) => p.scheduledAt ?? p.dueDate ?? p.assignedAt ?? '';
    const planParticipantCount = (p: TrainingPlan) =>
        (p.participantIds?.length ?? 0) || (p.employeeId ? 1 : 0);
    const recentPlans = [...plans]
        .filter(p => planDate(p))
        .sort((a, b) => planDate(b).localeCompare(planDate(a)))
        .slice(0, 5);

    const statusColor: Record<string, string> = {
        scheduled: 'bg-blue-500/90',
        in_progress: 'bg-amber-500/90',
        completed: 'bg-emerald-500/90',
        cancelled: 'bg-slate-500/70',
        assigned: 'bg-blue-500/90',
        overdue: 'bg-rose-500/90',
    };

    if (isLoading) {
        return (
            <Card className="bg-slate-900 dark:bg-slate-800 border-slate-700">
                <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-5">
                        <Skeleton className="h-4 w-40" />
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        {[...Array(4)].map((_, i) => (
                            <Skeleton key={i} className="h-20 rounded-xl" />
                        ))}
                    </div>
                    <Skeleton className="h-32 mt-4 rounded-xl" />
                </CardContent>
            </Card>
        );
    }

    const metrics = [
        {
            label: 'Нийт сургалт',
            value: activeCourses,
            sub: 'Идэвхтэй сургалтын тоо',
            icon: BookOpen,
            color: 'from-violet-500 to-purple-600',
        },
        {
            label: 'Идэвхтэй төлөвлөгөө',
            value: activePlans,
            sub: 'Төлөвлөгдсөн / явагдаж буй',
            icon: ClipboardList,
            color: 'from-blue-500 to-indigo-600',
        },
        {
            label: 'Дуусгалтын хувь',
            value: `${completionRate}%`,
            sub: `${completedPlans}/${totalPlans} дууссан`,
            icon: CheckCircle2,
            color: 'from-emerald-500 to-teal-600',
        },
        {
            label: 'Ур чадварын зөрүү',
            value: gapCount,
            sub: 'Илэрсэн skill gap',
            icon: AlertTriangle,
            color: 'from-amber-500 to-orange-600',
        },
    ];

    return (
        <Card className="bg-slate-900 dark:bg-slate-800 border-slate-700 overflow-hidden relative">
            <div className="absolute -right-6 -bottom-6 w-28 h-28 rounded-full blur-3xl bg-gradient-to-br from-violet-500/10 to-teal-500/10" />
            <CardContent className="p-5 sm:p-6 relative z-10">
                <div className="flex items-center justify-between mb-5">
                    <h3 className="text-[10px] sm:text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                        Dashboard | Сургалт хөгжил
                    </h3>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {metrics.map((m) => (
                        <div
                            key={m.label}
                            className="rounded-xl bg-slate-800/50 dark:bg-slate-700/30 border border-slate-700/60 p-4"
                        >
                            <div className="flex items-center gap-2 mb-2">
                                <div className={`rounded-lg p-1.5 bg-gradient-to-br ${m.color}`}>
                                    <m.icon className="h-3.5 w-3.5 text-white" />
                                </div>
                                <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wide">
                                    {m.label}
                                </p>
                            </div>
                            <p className="text-xl font-bold text-white tabular-nums">{m.value}</p>
                            <p className="text-[11px] text-slate-500 mt-0.5">{m.sub}</p>
                        </div>
                    ))}
                </div>

                {recentPlans.length > 0 && (
                    <div className="mt-4 rounded-xl bg-slate-800/50 dark:bg-slate-700/30 border border-slate-700/60 p-4">
                        <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-3">
                            Сүүлийн сургалтын төлөвлөгөөнүүд
                        </p>
                        <div className="space-y-2">
                            {recentPlans.map((plan) => (
                                <div
                                    key={plan.id}
                                    className="flex items-center justify-between rounded-lg bg-slate-700/30 px-3 py-2 border border-slate-700/60"
                                >
                                    <div>
                                        <p className="text-sm font-medium text-white">{plan.courseName}</p>
                                        <p className="text-[11px] text-slate-500">
                                            {new Date(planDate(plan)).toLocaleDateString('mn-MN')} · {planParticipantCount(plan)} оролцогч
                                        </p>
                                    </div>
                                    <span
                                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full text-white ${statusColor[plan.status ?? ''] || 'bg-slate-600'}`}
                                    >
                                        {PLAN_STATUS_LABELS[plan.status ?? ''] ?? plan.status ?? '—'}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
