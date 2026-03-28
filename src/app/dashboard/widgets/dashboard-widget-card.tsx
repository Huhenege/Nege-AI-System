// src/app/dashboard/widgets/dashboard-widget-card.tsx
'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { EyeOff, GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';
import { WidgetId, getWidgetConfig } from './catalog';
import { WidgetContent, WIDGET_GRADIENT, WIDGET_ICON_COLOR } from './widget-content';

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

    // Survey widget
    surveyActiveCount?: number;
    surveyDraftCount?: number;
    surveyTotalResponses?: number;

    // Billing widget
    billingPlan?: string;
    billingPlanLabel?: string;
    billingStatus?: string;
    billingStatusLabel?: string;
    billingStatusColor?: string;
    billingEmployeeCount?: number;
    billingMaxEmployees?: number;
    billingNextPayment?: string;
    billingAmount?: number;
    billingCurrency?: string;

    // Points widget
    pointsRecognitionCount?: number;   // Нийт талархлын тоо
    pointsActiveUsers?: number;        // Сүүлийн 30 хоногт идэвхтэй хэрэглэгч
    pointsTotalGiven?: number;         // Нийт олгосон оноо

    // Company widget
    companyName?: string;
    companyPlan?: string;
    companyPlanLabel?: string;

    // Calendar widget
    calendarEventsToday?: number;      // Өнөөдрийн үйл явдал
    calendarEventsWeek?: number;       // 7 хоногийн үйл явдал

    // Documents widget
    documentsTotal?: number;           // Нийт баримт
    documentsExpiring?: number;        // Дуусах дөхсөн (30 хоногт)

    // Settings widget — тохиргоо дутуу байгаа зүйлсийн тоо
    settingsMissingCount?: number;
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
    isDragging = false,
}: DashboardWidgetCardProps) {
    const config = getWidgetConfig(id);
    const router = useRouter();
    
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

    // ── renderContent: widget-content.tsx руу шилжсэн ──
    // Get gradient colors for decorative backgrounds
    const cardContent = (
        <Card 
            ref={setNodeRef}
            style={style}
            onClick={config?.href ? () => router.push(config.href!) : undefined}
            className={cn(
                "h-full flex-none bg-slate-900 dark:bg-slate-800 border-slate-700 transition-all duration-300 group overflow-hidden",
                "hover:bg-slate-800 dark:hover:bg-slate-700 hover:shadow-xl hover:scale-[1.02]",
                "w-[240px] sm:w-[280px] lg:w-[320px]",
                config?.href && "cursor-pointer",
                isDragging && "opacity-50 scale-105 shadow-2xl z-50"
            )}
        >
            <CardContent className="p-3 sm:p-5 h-full flex flex-col justify-between relative overflow-hidden">
                {WIDGET_GRADIENT[id] && (
                    <div className={cn(
                        "absolute -right-6 -bottom-6 w-28 h-28 rounded-full blur-3xl transition-all",
                        WIDGET_GRADIENT[id],
                        "group-hover:opacity-150"
                    )} />
                )}

                {/* Header */}
                <div className="flex items-center justify-between mb-3 sm:mb-4 relative z-10">
                    <div className="flex items-center gap-2">
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
                        <Icon
                            className={cn(
                                "h-5 w-5 text-slate-500 group-hover:scale-110 transition-transform",
                                WIDGET_ICON_COLOR[id]
                            )}
                        />
                    </div>
                </div>

                {isLoading
                    ? <Skeleton className="h-20 w-full bg-slate-700" />
                    : <WidgetContent id={id} data={data} />
                }
            </CardContent>
        </Card>
    );

    return <div className="flex-shrink-0">{cardContent}</div>;
}
