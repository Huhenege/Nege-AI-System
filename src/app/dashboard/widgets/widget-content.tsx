// src/app/dashboard/widgets/widget-content.tsx
// Widget бүрийн content JSX-г тусдаа component болгон тусгаарлав.
// Шинэ widget нэмэхэд зөвхөн энэ файл + catalog.ts-г өөрчилнэ.
'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { WidgetId } from './catalog';
// official-letters widget-д нэмэлт data хэрэггүй — KPI-гүй link card
import { WidgetData } from './dashboard-widget-card';

// ─── Gradient map ─────────────────────────────────────────────────────────────

export const WIDGET_GRADIENT: Partial<Record<WidgetId, string>> = {
    'official-letters': 'bg-gradient-to-br from-blue-500/10 to-cyan-500/10',
    projects:       'bg-gradient-to-br from-violet-500/10 to-purple-500/10',
    employees:      'bg-gradient-to-br from-emerald-500/10 to-teal-500/10',
    recruitment:    'bg-blue-500/10',
    points:         'bg-gradient-to-br from-yellow-500/20 to-orange-500/20',
    er:             'bg-gradient-to-br from-blue-500/10 to-indigo-500/10',
    training:       'bg-gradient-to-br from-teal-500/10 to-cyan-500/10',
    meetings:       'bg-gradient-to-br from-orange-500/10 to-amber-500/10',
    skills:         'bg-gradient-to-br from-indigo-500/10 to-violet-500/10',
    'business-plan':'bg-gradient-to-br from-emerald-500/10 to-lime-500/10',
    survey:         'bg-gradient-to-br from-rose-500/10 to-pink-500/10',
    billing:        'bg-gradient-to-br from-emerald-500/10 to-cyan-500/10',
    company:        'bg-gradient-to-br from-slate-500/10 to-zinc-500/10',
    calendar:       'bg-gradient-to-br from-sky-500/10 to-blue-500/10',
    documents:      'bg-gradient-to-br from-amber-500/10 to-yellow-500/10',
    settings:       'bg-gradient-to-br from-zinc-500/10 to-slate-500/10',
};

// ─── Icon color map ───────────────────────────────────────────────────────────

export const WIDGET_ICON_COLOR: Partial<Record<WidgetId, string>> = {
    'official-letters': 'text-blue-400',
    projects:       'text-violet-400',
    employees:      'text-emerald-400',
    points:         'text-yellow-500',
    recruitment:    'text-blue-400',
    er:             'text-blue-500',
    training:       'text-teal-400',
    meetings:       'text-orange-400',
    skills:         'text-indigo-400',
    'business-plan':'text-emerald-400',
    survey:         'text-rose-400',
    billing:        'text-cyan-400',
    company:        'text-slate-400',
    calendar:       'text-sky-400',
    documents:      'text-amber-400',
    settings:       'text-zinc-400',
};

// ─── Widget content components ────────────────────────────────────────────────

interface Props { data: WidgetData }

function ProjectsContent({ data }: Props) {
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
}

function EmployeesContent({ data }: Props) {
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
            <div className="flex-1 space-y-1">
                <div className="flex h-2 rounded-full overflow-hidden bg-slate-700/50">
                    {permanent > 0 && <div className="bg-emerald-400 transition-all" style={{ width: `${permPct}%` }} />}
                    {probation > 0 && <div className="bg-amber-400 transition-all" style={{ width: `${probPct}%` }} />}
                </div>
                <div className="flex justify-between text-[9px] text-slate-500">
                    <span className="flex items-center gap-1"><span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400" />Үндсэн {permanent}</span>
                    <span className="flex items-center gap-1"><span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400" />Туршилт {probation}</span>
                </div>
            </div>
            {genderTotal > 0 && (
                <div className="pt-1.5 border-t border-slate-700/60">
                    <div className="flex h-2 flex-1 rounded-full overflow-hidden bg-slate-700/50 mb-1">
                        {male > 0 && <div className="bg-blue-400 transition-all" style={{ width: `${malePct}%` }} />}
                        {female > 0 && <div className="bg-pink-400 transition-all" style={{ width: `${femalePct}%` }} />}
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

function StructureContent({ data }: Props) {
    return (
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
    );
}

function AttendanceContent({ data }: Props) {
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
}

function VacationContent({ data }: Props) {
    return (
        <div>
            <div className="text-3xl sm:text-4xl font-semibold text-amber-500 mb-1">{data.vacationCount ?? 0}</div>
            <div className="text-xs text-slate-400 font-medium">ажилтан амарч байна</div>
        </div>
    );
}

function PostsContent({ data }: Props) {
    return (
        <div>
            <div className="text-3xl sm:text-4xl font-semibold text-white mb-1">{data.postsCount ?? 0}</div>
            <div className="text-xs text-slate-400 font-medium">нийтлэл</div>
        </div>
    );
}

function RecruitmentContent({ data }: Props) {
    const openVac = data.recruitmentOpenVacancies ?? 0;
    const totalCand = data.recruitmentTotalCandidates ?? 0;
    const activeCand = data.recruitmentActiveCandidates ?? 0;
    const hiredCnt = data.recruitmentHiredCount ?? 0;
    return (
        <div className="space-y-2.5">
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
            <div className="pt-1.5 border-t border-slate-700/60 flex items-center justify-between">
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
    );
}

function PointsContent({ data }: Props) {
    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <div>
                    <div className="text-2xl sm:text-3xl font-semibold text-white">{data.pointsRecognitionCount ?? 0}</div>
                    <div className="text-[10px] text-yellow-400 font-semibold uppercase tracking-wide">Талархал</div>
                </div>
                <div className="h-10 w-px bg-slate-700" />
                <div className="text-right">
                    <div className="text-2xl sm:text-3xl font-semibold text-orange-400">{data.pointsActiveUsers ?? 0}</div>
                    <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide">Идэвхтэй</div>
                </div>
            </div>
            {(data.pointsTotalGiven ?? 0) > 0 && (
                <div className="pt-1 border-t border-slate-700/60">
                    <div className="text-[10px] text-slate-500">
                        Нийт олгосон: <span className="text-yellow-400 font-semibold">{(data.pointsTotalGiven ?? 0).toLocaleString()} pts</span>
                    </div>
                </div>
            )}
        </div>
    );
}

function ErContent({ data }: Props) {
    return (
        <div className="space-y-2">
            <div className="text-[10px] text-slate-400 font-medium uppercase tracking-wide mb-2">Хөдөлмөрийн харилцаа</div>
            <div className="flex items-center justify-between">
                <div><div className="text-2xl font-semibold text-white">{data.erDocumentsCount ?? 0}</div><div className="text-[10px] text-slate-400">Нийт баримт</div></div>
                <div className="h-8 w-px bg-slate-700" />
                <div><div className="text-2xl font-semibold text-amber-400">{data.erPendingCount ?? 0}</div><div className="text-[10px] text-slate-400">Хүлээгдэж буй</div></div>
                <div className="h-8 w-px bg-slate-700" />
                <div><div className="text-2xl font-semibold text-blue-400">{data.erTemplatesCount ?? 0}</div><div className="text-[10px] text-slate-400">Загвар</div></div>
            </div>
        </div>
    );
}

function TrainingContent({ data }: Props) {
    return (
        <div className="space-y-2">
            <div className="text-[10px] text-slate-400 font-medium uppercase tracking-wide mb-2">Сургалт хөгжил</div>
            <div className="flex items-center justify-between">
                <div><div className="text-2xl font-semibold text-white">{data.trainingCoursesCount ?? 0}</div><div className="text-[10px] text-slate-400">Сургалт</div></div>
                <div className="h-8 w-px bg-slate-700" />
                <div><div className="text-2xl font-semibold text-teal-400">{data.trainingActivePlansCount ?? 0}</div><div className="text-[10px] text-slate-400">Идэвхтэй</div></div>
                <div className="h-8 w-px bg-slate-700" />
                <div><div className="text-2xl font-semibold text-cyan-400">{data.trainingCompletionRate ?? 0}%</div><div className="text-[10px] text-slate-400">Дуусгалт</div></div>
            </div>
        </div>
    );
}

function MeetingsContent({ data }: Props) {
    return (
        <div className="space-y-2">
            <div className="text-[10px] text-slate-400 font-medium uppercase tracking-wide mb-2">Хурлын өрөө</div>
            <div className="flex items-center justify-between">
                <div><div className="text-2xl font-semibold text-white">{data.meetingsTodayCount ?? 0}</div><div className="text-[10px] text-slate-400">Өнөөдрийн хурал</div></div>
                <div className="h-8 w-px bg-slate-700" />
                <div><div className="text-2xl font-semibold text-orange-400">{data.meetingRoomsCount ?? 0}</div><div className="text-[10px] text-slate-400">Өрөө</div></div>
            </div>
            {data.nextMeetingTime && (
                <div className="pt-1 border-t border-slate-700/60">
                    <div className="text-[10px] text-slate-500">Дараагийн: <span className="text-orange-400 font-semibold">{data.nextMeetingTime}</span></div>
                </div>
            )}
        </div>
    );
}

function SkillsContent({ data }: Props) {
    return (
        <div className="space-y-2">
            <div className="text-[10px] text-slate-400 font-medium uppercase tracking-wide mb-2">Ур чадвар</div>
            <div className="flex items-center justify-between">
                <div><div className="text-2xl font-semibold text-white">{data.skillsInventoryCount ?? 0}</div><div className="text-[10px] text-slate-400">Ур чадвар</div></div>
                <div className="h-8 w-px bg-slate-700" />
                <div><div className="text-2xl font-semibold text-indigo-400">{data.skillsAssessedCount ?? 0}</div><div className="text-[10px] text-slate-400">Үнэлэгдсэн</div></div>
                <div className="h-8 w-px bg-slate-700" />
                <div><div className="text-2xl font-semibold text-amber-400">{data.skillGapPercentage ?? 0}%</div><div className="text-[10px] text-slate-400">Зөрүү</div></div>
            </div>
        </div>
    );
}

function BusinessPlanContent({ data }: Props) {
    return (
        <div className="space-y-2">
            <div className="text-[10px] text-slate-400 font-medium uppercase tracking-wide mb-2">Бизнес төлөвлөгөө</div>
            <div className="flex items-center justify-between">
                <div><div className="text-2xl font-semibold text-white">{data.bpPlanProgress ?? 0}%</div><div className="text-[10px] text-slate-400">Прогресс</div></div>
                <div className="h-8 w-px bg-slate-700" />
                <div><div className="text-2xl font-semibold text-emerald-400">{data.bpOkrCount ?? 0}</div><div className="text-[10px] text-slate-400">OKR</div></div>
                <div className="h-8 w-px bg-slate-700" />
                <div><div className="text-2xl font-semibold text-lime-400">{data.bpKpiGreenCount ?? 0}</div><div className="text-[10px] text-slate-400">KPI ✓</div></div>
            </div>
        </div>
    );
}

function SurveyContent({ data }: Props) {
    return (
        <div className="space-y-2">
            <div className="text-[10px] text-slate-400 font-medium uppercase tracking-wide mb-2">Санал асуулга</div>
            <div className="flex items-center justify-between">
                <div><div className="text-2xl font-semibold text-white">{data.surveyActiveCount ?? 0}</div><div className="text-[10px] text-slate-400">Идэвхтэй</div></div>
                <div className="h-8 w-px bg-slate-700" />
                <div><div className="text-2xl font-semibold text-amber-400">{data.surveyDraftCount ?? 0}</div><div className="text-[10px] text-slate-400">Ноорог</div></div>
                <div className="h-8 w-px bg-slate-700" />
                <div><div className="text-2xl font-semibold text-rose-400">{data.surveyTotalResponses ?? 0}</div><div className="text-[10px] text-slate-400">Хариулт</div></div>
            </div>
        </div>
    );
}

function CompanyContent({ data }: Props) {
    return (
        <div className="space-y-1">
            <div className="text-lg sm:text-xl font-semibold text-white leading-tight truncate">{data.companyName || 'Компани'}</div>
            {data.companyPlanLabel && (
                <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-700 text-[10px] font-semibold text-slate-300">
                    {data.companyPlanLabel}
                </div>
            )}
            <div className="text-[10px] text-slate-500 pt-1">Мэдээлэл, бодлого, түүх</div>
        </div>
    );
}

function CalendarContent({ data }: Props) {
    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <div>
                    <div className="text-2xl sm:text-3xl font-semibold text-sky-400">{data.calendarEventsToday ?? 0}</div>
                    <div className="text-[10px] text-slate-400 uppercase tracking-wide">Өнөөдөр</div>
                </div>
                <div className="h-10 w-px bg-slate-700" />
                <div className="text-right">
                    <div className="text-2xl sm:text-3xl font-semibold text-white">{data.calendarEventsWeek ?? 0}</div>
                    <div className="text-[10px] text-slate-400 uppercase tracking-wide">7 хоногт</div>
                </div>
            </div>
            <div className="text-[10px] text-slate-500">Үйл явдлын хуанли</div>
        </div>
    );
}

function DocumentsContent({ data }: Props) {
    const total = data.documentsTotal ?? 0;
    const expiring = data.documentsExpiring ?? 0;
    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <div>
                    <div className="text-2xl sm:text-3xl font-semibold text-amber-400">{total}</div>
                    <div className="text-[10px] text-slate-400 uppercase tracking-wide">Нийт баримт</div>
                </div>
                {expiring > 0 && (
                    <>
                        <div className="h-10 w-px bg-slate-700" />
                        <div className="text-right">
                            <div className="text-2xl sm:text-3xl font-semibold text-rose-400">{expiring}</div>
                            <div className="text-[10px] text-rose-400 uppercase tracking-wide">Дуусах дөхсөн</div>
                        </div>
                    </>
                )}
            </div>
            <div className="text-[10px] text-slate-500">Бичиг баримтын удирдлага</div>
        </div>
    );
}

function SettingsContent({ data }: Props) {
    const missing = data.settingsMissingCount ?? 0;
    return (
        <div className="space-y-2">
            {missing > 0 ? (
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0">
                        <span className="text-amber-400 font-bold text-sm">{missing}</span>
                    </div>
                    <div>
                        <div className="text-sm font-semibold text-amber-400">Тохиргоо шаардлагатай</div>
                        <div className="text-[10px] text-slate-500">Дэлгэрэнгүйг харах</div>
                    </div>
                </div>
            ) : (
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
                        <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                    </div>
                    <div>
                        <div className="text-sm font-semibold text-emerald-400">Бүх тохиргоо бэлэн</div>
                        <div className="text-[10px] text-slate-500">Системийн тохиргоо</div>
                    </div>
                </div>
            )}
        </div>
    );
}

function BillingContent({ data }: Props) {
    const plan = data.billingPlanLabel ?? 'Үнэгүй';
    const statusLabel = data.billingStatusLabel ?? '-';
    const empCount = data.billingEmployeeCount ?? 0;
    const maxEmp = data.billingMaxEmployees ?? 0;
    const usagePct = maxEmp > 0 ? Math.min(Math.round((empCount / maxEmp) * 100), 100) : 0;
    const isNearLimit = usagePct >= 80;
    const amount = data.billingAmount ?? 0;
    return (
        <div className="space-y-2.5">
            <div className="flex items-end justify-between">
                <div>
                    <div className="text-xl sm:text-2xl font-bold text-white leading-none">{plan}</div>
                    <div className="text-[10px] text-slate-400 font-medium uppercase tracking-wide mt-0.5">Идэвхтэй багц</div>
                </div>
                <div className={cn(
                    "px-2 py-0.5 rounded-full text-[10px] font-semibold",
                    data.billingStatus === 'active' ? 'bg-emerald-500/20 text-emerald-400' :
                    data.billingStatus === 'trial'  ? 'bg-amber-500/20 text-amber-400' :
                    'bg-slate-500/20 text-slate-400'
                )}>
                    {statusLabel}
                </div>
            </div>
            <div className="space-y-1">
                <div className="flex justify-between text-[10px] text-slate-400">
                    <span>Ажилтны хязгаар</span>
                    <span className={cn(isNearLimit && "text-amber-400 font-semibold")}>
                        {empCount} / {maxEmp === 9999 ? '∞' : maxEmp}
                    </span>
                </div>
                <div className="flex h-1.5 rounded-full overflow-hidden bg-slate-700/50">
                    <div
                        className={cn("transition-all rounded-full", isNearLimit ? "bg-amber-400" : "bg-emerald-400")}
                        style={{ width: maxEmp === 9999 ? '10%' : `${usagePct}%` }}
                    />
                </div>
            </div>
            {amount > 0 && (
                <div className="pt-1 border-t border-slate-700/60 flex justify-between items-center">
                    <span className="text-[10px] text-slate-500">Сарын төлбөр</span>
                    <span className="text-sm font-semibold text-white">{amount.toLocaleString()}₮</span>
                </div>
            )}
        </div>
    );
}

// ─── Registry ─────────────────────────────────────────────────────────────────

const CONTENT_MAP: Partial<Record<WidgetId, React.ComponentType<Props>>> = {
    projects:       ProjectsContent,
    employees:      EmployeesContent,
    structure:      StructureContent,
    attendance:     AttendanceContent,
    vacation:       VacationContent,
    posts:          PostsContent,
    recruitment:    RecruitmentContent,
    points:         PointsContent,
    er:             ErContent,
    training:       TrainingContent,
    meetings:       MeetingsContent,
    skills:         SkillsContent,
    'business-plan':BusinessPlanContent,
    survey:         SurveyContent,
    company:        CompanyContent,
    calendar:       CalendarContent,
    documents:      DocumentsContent,
    settings:       SettingsContent,
    billing:        BillingContent,
    'official-letters': ({ data }: Props) => (
        <div className="space-y-1">
            <div className="text-lg font-semibold text-white leading-tight">Албан бичиг</div>
            <div className="text-[10px] text-slate-400 font-medium">Стандарт бланк үүсгэх</div>
        </div>
    ),
};

// ─── Main export ──────────────────────────────────────────────────────────────

export function WidgetContent({ id, data }: { id: WidgetId; data: WidgetData }) {
    const Component = CONTENT_MAP[id];
    if (!Component) return null;
    return <Component data={data} />;
}
