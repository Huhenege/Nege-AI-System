// src/app/dashboard/widgets/dashboard-widget-card.tsx
'use client';

import React from 'react';
import Link from 'next/link';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { EyeOff, GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';
import { WidgetId, getWidgetConfig } from './catalog';

export interface WidgetData {
    // Projects widget
    activeProjectsCount?: number;
    overdueTasksCount?: number;
    
    // Employees widget
    employeesCount?: number;
    permanentCount?: number;
    probationCount?: number;
    maleCount?: number;
    femaleCount?: number;
    averageAge?: number;

    // Structure widget
    departmentsCount?: number;
    positionsCount?: number;
    
    // Attendance widget
    presentCount?: number;
    onLeaveCount?: number;
    
    // Vacation widget
    vacationCount?: number;
    
    // Posts widget
    postsCount?: number;
    
    // Recruitment widget
    recruitmentOpenVacancies?: number;
    recruitmentTotalCandidates?: number;
    recruitmentActiveCandidates?: number;
    recruitmentHiredCount?: number;
    recruitmentInterviewCount?: number;

    // Employment Relations widget
    erDocumentsCount?: number;
    erPendingCount?: number;
    erTemplatesCount?: number;

    // Training widget
    trainingCoursesCount?: number;
    trainingActivePlansCount?: number;
    trainingCompletionRate?: number;

    // Meetings widget
    meetingsTodayCount?: number;
    meetingRoomsCount?: number;
    nextMeetingTime?: string;

    // Skills widget
    skillsInventoryCount?: number;
    skillsAssessedCount?: number;
    skillGapPercentage?: number;

    // Business Plan widget
    bpPlanProgress?: number;
    bpOkrCount?: number;
    bpKpiGreenCount?: number;
}

interface DashboardWidgetCardProps {
    id: WidgetId;
    data: WidgetData;
    isLoading?: boolean;
    onHide?: (id: WidgetId) => void;
    isDragging?: boolean;
}

export function DashboardWidgetCard({ 
    id, 
    data, 
    isLoading = false,
    onHide,
    isDragging = false
}: DashboardWidgetCardProps) {
    const config = getWidgetConfig(id);
    
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
    } = useSortable({ id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    if (!config) return null;

    const Icon = config.icon;
    const isCompact = config.size === 'compact';

    const renderContent = () => {
        if (isLoading) {
            return <Skeleton className="h-20 w-full bg-slate-700" />;
        }

        switch (id) {
            case 'projects':
                return (
                    <div className="space-y-3">
                        <div className="flex items-center justify-between pb-2 border-b border-slate-700">
                            <div>
                                <div className="text-2xl sm:text-3xl font-semibold text-white">{data.activeProjectsCount ?? 0}</div>
                                <div className="text-[10px] text-slate-400 font-medium uppercase tracking-wide">Идэвхтэй төсөл</div>
                            </div>
                            <div className="h-10 w-px bg-slate-700" />
                        </div>
                        <div>
                            <div className="text-xl sm:text-2xl font-semibold text-amber-400">{data.overdueTasksCount ?? 0}</div>
                            <div className="text-[10px] text-slate-400 font-medium uppercase tracking-wide">Хугацаа хэтэрсэн таск</div>
                        </div>
                    </div>
                );

            case 'employees': {
                const total = data.employeesCount ?? 0;
                const permanent = data.permanentCount ?? 0;
                const probation = data.probationCount ?? 0;
                const male = data.maleCount ?? 0;
                const female = data.femaleCount ?? 0;
                const avgAge = data.averageAge ?? 0;
                const permPct = total > 0 ? Math.round((permanent / total) * 100) : 0;
                const probPct = total > 0 ? Math.round((probation / total) * 100) : 0;
                const genderTotal = male + female;
                const malePct = genderTotal > 0 ? Math.round((male / genderTotal) * 100) : 0;
                const femalePct = genderTotal > 0 ? 100 - malePct : 0;
                return (
                    <div className="space-y-2.5">
                        {/* Total + Average Age */}
                        <div className="flex items-end justify-between">
                            <div className="flex items-end gap-2">
                                <div className="text-3xl sm:text-4xl font-semibold text-white leading-none">{total}</div>
                                <div className="text-[10px] text-slate-400 font-medium uppercase tracking-wide pb-0.5">Нийт</div>
                            </div>
                            {avgAge > 0 && (
                                <div className="flex items-end gap-1 pb-0.5">
                                    <div className="text-lg sm:text-xl font-semibold text-cyan-400 leading-none">{avgAge}</div>
                                    <div className="text-[9px] text-slate-400 font-medium uppercase tracking-wide">Дундаж нас</div>
                                </div>
                            )}
                        </div>

                        {/* Permanent / Probation — graphical donut-style bar */}
                        <div className="flex items-center gap-3">
                            {/* Mini stacked bar */}
                            <div className="flex-1 space-y-1">
                                <div className="flex h-2 rounded-full overflow-hidden bg-slate-700/50">
                                    {permanent > 0 && <div className="bg-emerald-400 transition-all" style={{ width: `${permPct}%` }} />}
                                    {probation > 0 && <div className="bg-amber-400 transition-all" style={{ width: `${probPct}%` }} />}
                                </div>
                                <div className="flex justify-between text-[9px] text-slate-500">
                                    <span className="flex items-center gap-1">
                                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                        Үндсэн {permanent}
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400" />
                                        Туршилт {probation}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Gender ratio */}
                        {genderTotal > 0 && (
                            <div className="pt-1.5 border-t border-slate-700/60">
                                <div className="flex items-center gap-2 mb-1">
                                    <div className="flex h-2 flex-1 rounded-full overflow-hidden bg-slate-700/50">
                                        {male > 0 && <div className="bg-blue-400 transition-all" style={{ width: `${malePct}%` }} />}
                                        {female > 0 && <div className="bg-pink-400 transition-all" style={{ width: `${femalePct}%` }} />}
                                    </div>
                                </div>
                                <div className="flex justify-between text-[9px] text-slate-500">
                                    <span className="flex items-center gap-1">
                                        <svg viewBox="0 0 24 24" className="w-3 h-3 text-blue-400" fill="currentColor"><circle cx="12" cy="7" r="4"/><path d="M5.5 21a6.5 6.5 0 0 1 13 0"/></svg>
                                        {malePct}% ({male})
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <svg viewBox="0 0 24 24" className="w-3 h-3 text-pink-400" fill="currentColor"><circle cx="12" cy="7" r="4"/><path d="M5.5 21a6.5 6.5 0 0 1 13 0"/></svg>
                                        {femalePct}% ({female})
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>
                );
            }

            case 'structure':
                return (
                    <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <div className="text-2xl font-semibold text-indigo-400">{data.departmentsCount ?? 0}</div>
                                <div className="text-[10px] text-slate-400 font-medium uppercase tracking-wide">Нэгж</div>
                            </div>
                            <div>
                                <div className="text-2xl font-semibold text-purple-400">{data.positionsCount ?? 0}</div>
                                <div className="text-[10px] text-slate-400 font-medium uppercase tracking-wide">Ажлын байр</div>
                            </div>
                        </div>
                    </div>
                );

            case 'attendance':
                return (
                    <div className="flex items-end gap-6">
                        <div>
                            <div className="text-2xl sm:text-3xl font-semibold text-white">{data.presentCount ?? 0}</div>
                            <div className="text-[10px] text-emerald-400 font-semibold uppercase tracking-wide">Ажил дээрээ</div>
                        </div>
                        <div className="h-12 w-px bg-slate-700" />
                        <div>
                            <div className="text-2xl sm:text-3xl font-semibold text-white">{data.onLeaveCount ?? 0}</div>
                            <div className="text-[10px] text-blue-400 font-semibold uppercase tracking-wide">Чөлөөтэй</div>
                        </div>
                    </div>
                );

            case 'vacation':
                return (
                    <div>
                        <div className="text-3xl sm:text-4xl font-semibold text-amber-500 mb-1">{data.vacationCount ?? 0}</div>
                        <div className="text-xs text-slate-400 font-medium">ажилтан амарч байна</div>
                    </div>
                );

            case 'posts':
                return (
                    <div>
                        <div className="text-3xl sm:text-4xl font-semibold text-white mb-1">{data.postsCount ?? 0}</div>
                        <div className="text-xs text-slate-400 font-medium">нийтлэл</div>
                    </div>
                );

            case 'recruitment': {
                const openVac = data.recruitmentOpenVacancies ?? 0;
                const totalCand = data.recruitmentTotalCandidates ?? 0;
                const activeCand = data.recruitmentActiveCandidates ?? 0;
                const hiredCnt = data.recruitmentHiredCount ?? 0;
                return (
                    <div className="relative z-10 space-y-2.5">
                        <div className="flex items-end justify-between">
                            <div>
                                <div className="text-3xl sm:text-4xl font-semibold text-white leading-none">{openVac}</div>
                                <div className="text-[10px] text-blue-400 font-semibold uppercase tracking-wide">Нээлттэй зар</div>
                            </div>
                            <div className="h-10 w-px bg-slate-700" />
                            <div className="text-right">
                                <div className="text-3xl sm:text-4xl font-semibold text-white leading-none">{totalCand}</div>
                                <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide">Нийт горилогч</div>
                            </div>
                        </div>
                        <div className="pt-1.5 border-t border-slate-700/60">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5">
                                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400" />
                                    <span className="text-[10px] text-slate-400">Идэвхтэй</span>
                                    <span className="text-sm font-semibold text-amber-400">{activeCand}</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                    <span className="text-[10px] text-slate-400">Авсан</span>
                                    <span className="text-sm font-semibold text-emerald-400">{hiredCnt}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            }

            case 'points':
                return (
                    <div className="relative z-10">
                        <div className="flex items-baseline gap-2 mb-1">
                            <div className="text-2xl sm:text-3xl font-semibold text-white">Points</div>
                        </div>
                        <div className="text-xs text-slate-400 font-medium">Recognition System</div>
                    </div>
                );

            case 'er':
                return (
                    <div className="relative z-10 space-y-2">
                        <div className="text-[10px] text-slate-400 font-medium uppercase tracking-wide mb-2">
                            Хөдөлмөрийн харилцаа
                        </div>
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="text-2xl font-semibold text-white">{data.erDocumentsCount ?? 0}</div>
                                <div className="text-[10px] text-slate-400">Нийт баримт</div>
                            </div>
                            <div className="h-8 w-px bg-slate-700" />
                            <div>
                                <div className="text-2xl font-semibold text-amber-400">{data.erPendingCount ?? 0}</div>
                                <div className="text-[10px] text-slate-400">Хүлээгдэж буй</div>
                            </div>
                            <div className="h-8 w-px bg-slate-700" />
                            <div>
                                <div className="text-2xl font-semibold text-blue-400">{data.erTemplatesCount ?? 0}</div>
                                <div className="text-[10px] text-slate-400">Загвар</div>
                            </div>
                        </div>
                    </div>
                );

            case 'training':
                return (
                    <div className="relative z-10 space-y-2">
                        <div className="text-[10px] text-slate-400 font-medium uppercase tracking-wide mb-2">
                            Сургалт хөгжил
                        </div>
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="text-2xl font-semibold text-white">{data.trainingCoursesCount ?? 0}</div>
                                <div className="text-[10px] text-slate-400">Сургалт</div>
                            </div>
                            <div className="h-8 w-px bg-slate-700" />
                            <div>
                                <div className="text-2xl font-semibold text-teal-400">{data.trainingActivePlansCount ?? 0}</div>
                                <div className="text-[10px] text-slate-400">Идэвхтэй</div>
                            </div>
                            <div className="h-8 w-px bg-slate-700" />
                            <div>
                                <div className="text-2xl font-semibold text-cyan-400">{data.trainingCompletionRate ?? 0}%</div>
                                <div className="text-[10px] text-slate-400">Дуусгалт</div>
                            </div>
                        </div>
                    </div>
                );

            case 'meetings':
                return (
                    <div className="relative z-10 space-y-2">
                        <div className="text-[10px] text-slate-400 font-medium uppercase tracking-wide mb-2">
                            Хурлын өрөө
                        </div>
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="text-2xl font-semibold text-white">{data.meetingsTodayCount ?? 0}</div>
                                <div className="text-[10px] text-slate-400">Өнөөдрийн хурал</div>
                            </div>
                            <div className="h-8 w-px bg-slate-700" />
                            <div>
                                <div className="text-2xl font-semibold text-orange-400">{data.meetingRoomsCount ?? 0}</div>
                                <div className="text-[10px] text-slate-400">Өрөө</div>
                            </div>
                        </div>
                        {data.nextMeetingTime && (
                            <div className="pt-1 border-t border-slate-700/60">
                                <div className="text-[10px] text-slate-500">Дараагийн: <span className="text-orange-400 font-semibold">{data.nextMeetingTime}</span></div>
                            </div>
                        )}
                    </div>
                );

            case 'skills':
                return (
                    <div className="relative z-10 space-y-2">
                        <div className="text-[10px] text-slate-400 font-medium uppercase tracking-wide mb-2">
                            Ур чадвар
                        </div>
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="text-2xl font-semibold text-white">{data.skillsInventoryCount ?? 0}</div>
                                <div className="text-[10px] text-slate-400">Ур чадвар</div>
                            </div>
                            <div className="h-8 w-px bg-slate-700" />
                            <div>
                                <div className="text-2xl font-semibold text-indigo-400">{data.skillsAssessedCount ?? 0}</div>
                                <div className="text-[10px] text-slate-400">Үнэлэгдсэн</div>
                            </div>
                            <div className="h-8 w-px bg-slate-700" />
                            <div>
                                <div className="text-2xl font-semibold text-amber-400">{data.skillGapPercentage ?? 0}%</div>
                                <div className="text-[10px] text-slate-400">Зөрүү</div>
                            </div>
                        </div>
                    </div>
                );

            case 'business-plan':
                return (
                    <div className="relative z-10 space-y-2">
                        <div className="text-[10px] text-slate-400 font-medium uppercase tracking-wide mb-2">
                            Бизнес төлөвлөгөө
                        </div>
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="text-2xl font-semibold text-white">{data.bpPlanProgress ?? 0}%</div>
                                <div className="text-[10px] text-slate-400">Прогресс</div>
                            </div>
                            <div className="h-8 w-px bg-slate-700" />
                            <div>
                                <div className="text-2xl font-semibold text-emerald-400">{data.bpOkrCount ?? 0}</div>
                                <div className="text-[10px] text-slate-400">OKR</div>
                            </div>
                            <div className="h-8 w-px bg-slate-700" />
                            <div>
                                <div className="text-2xl font-semibold text-lime-400">{data.bpKpiGreenCount ?? 0}</div>
                                <div className="text-[10px] text-slate-400">KPI ✓</div>
                            </div>
                        </div>
                    </div>
                );

            default:
                return null;
        }
    };

    // Get gradient colors for decorative backgrounds
    const getGradientClasses = () => {
        switch (id) {
            case 'projects':
                return 'bg-gradient-to-br from-violet-500/10 to-purple-500/10';
            case 'employees':
                return 'bg-gradient-to-br from-emerald-500/10 to-teal-500/10';
            case 'recruitment':
                return 'bg-blue-500/10';
            case 'points':
                return 'bg-gradient-to-br from-yellow-500/20 to-orange-500/20';
            case 'er':
                return 'bg-gradient-to-br from-blue-500/10 to-indigo-500/10';
            case 'training':
                return 'bg-gradient-to-br from-teal-500/10 to-cyan-500/10';
            case 'meetings':
                return 'bg-gradient-to-br from-orange-500/10 to-amber-500/10';
            case 'skills':
                return 'bg-gradient-to-br from-indigo-500/10 to-violet-500/10';
            case 'business-plan':
                return 'bg-gradient-to-br from-emerald-500/10 to-lime-500/10';
            default:
                return '';
        }
    };

    const cardContent = (
        <Card 
            ref={setNodeRef}
            style={style}
            className={cn(
                "h-full flex-none bg-slate-900 dark:bg-slate-800 border-slate-700 transition-all duration-300 group overflow-hidden",
                "hover:bg-slate-800 dark:hover:bg-slate-700 hover:shadow-xl hover:scale-[1.02]",
                // Keep all widgets the same width for consistent UX
                "w-[240px] sm:w-[280px] lg:w-[320px]",
                isDragging && "opacity-50 scale-105 shadow-2xl z-50"
            )}
        >
            <CardContent className="p-3 sm:p-5 h-full flex flex-col justify-between relative overflow-hidden">
                {/* Decorative gradient background for some widgets */}
                {getGradientClasses() && (
                    <div className={cn(
                        "absolute -right-6 -bottom-6 w-28 h-28 rounded-full blur-3xl transition-all",
                        getGradientClasses(),
                        "group-hover:opacity-150"
                    )} />
                )}

                {/* Header with title, icon, and actions */}
                <div className="flex items-center justify-between mb-3 sm:mb-4 relative z-10">
                    <div className="flex items-center gap-2">
                        {/* Drag handle */}
                        <button
                            {...attributes}
                            {...listeners}
                            className="cursor-grab active:cursor-grabbing -ml-1 rounded hover:bg-slate-700/50 transition-all overflow-hidden w-0 p-0 opacity-0 group-hover:w-6 group-hover:p-1 group-hover:opacity-100"
                            aria-label="Чирэх"
                        >
                            <GripVertical className="h-4 w-4 text-slate-500" />
                        </button>
                        <div className="text-[10px] sm:text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                            {config.label}
                        </div>
                    </div>
                    <div className="flex items-center gap-1">
                        {onHide && (
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-slate-700/50"
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    onHide(id);
                                }}
                                aria-label="Нуух"
                            >
                                <EyeOff className="h-3.5 w-3.5 text-slate-400" />
                            </Button>
                        )}
                        {/* Top-right icon */}
                        <Icon
                            className={cn(
                                "h-5 w-5 text-slate-500 group-hover:scale-110 transition-transform",
                                id === 'projects' && "text-violet-400",
                                id === 'employees' && "text-emerald-400",
                                id === 'points' && "text-yellow-500",
                                id === 'recruitment' && "text-blue-400",
                                id === 'er' && "text-blue-500",
                                id === 'training' && "text-teal-400",
                                id === 'meetings' && "text-orange-400",
                                id === 'skills' && "text-indigo-400",
                                id === 'business-plan' && "text-emerald-400"
                            )}
                        />
                    </div>
                </div>

                {/* Widget content */}
                {renderContent()}
            </CardContent>
        </Card>
    );

    // Wrap with Link if href is provided
    if (config.href) {
        return (
            <Link href={config.href} className="flex-shrink-0">
                {cardContent}
            </Link>
        );
    }

    return <div className="flex-shrink-0">{cardContent}</div>;
}
