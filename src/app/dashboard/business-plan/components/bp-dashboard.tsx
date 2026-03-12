// src/app/dashboard/business-plan/components/bp-dashboard.tsx
'use client';

import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import {
    Target, TrendingUp, BarChart3, Award, ArrowDown, Layers, Rocket,
    CheckCircle2, AlertTriangle, XCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
    BusinessPlan,
    StrategicTheme,
    Objective,
    KeyResult,
    Kpi,
    PerformanceReview,
    PerformanceScore,
    Strategy,
    CompanyProfile,
    CoreValue,
    StrategyFramework,
    computeKeyResultProgress,
    computeObjectiveProgress,
    computeThemeProgress,
    computePlanProgress,
    computeRagStatus,
    computeStrategyProgress,
    getCurrentQuarter,
    PLAN_STATUS_LABELS,
    PLAN_STATUS_COLORS,
    OKR_STATUS_LABELS,
    OKR_STATUS_COLORS,
    RAG_STATUS_COLORS,
    RAG_STATUS_LABELS,
    FRAMEWORK_SHORT_LABELS,
    THEME_LABEL,
    OBJECTIVE_LABEL,
    KEY_RESULT_LABEL,
    BSC_PERSPECTIVE_LABELS,
} from '../types';

interface BpDashboardProps {
    activePlan?: BusinessPlan;
    themes: StrategicTheme[];
    objectives: Objective[];
    keyResults: KeyResult[];
    strategies?: Strategy[];
    kpis: Kpi[];
    reviews: PerformanceReview[];
    scores: PerformanceScore[];
    companyProfile?: CompanyProfile | null;
    coreValues?: CoreValue[];
    isLoading: boolean;
}

export function BpDashboard({
    activePlan,
    themes,
    objectives,
    keyResults,
    strategies = [],
    kpis,
    reviews,
    scores,
    companyProfile,
    coreValues,
    isLoading,
}: BpDashboardProps) {
    const currentQuarter = getCurrentQuarter();
    const framework: StrategyFramework = activePlan?.framework || 'okr';

    const objectivesWithProgress = useMemo(() => {
        return objectives.map(obj => {
            const objKrs = keyResults.filter(kr => kr.objectiveId === obj.id);
            const progress = computeObjectiveProgress(objKrs);
            return { ...obj, progress };
        });
    }, [objectives, keyResults]);

    const currentQObjectives = useMemo(() =>
        framework === 'okr'
            ? objectivesWithProgress.filter(o => o.quarter === currentQuarter)
            : objectivesWithProgress,
        [objectivesWithProgress, currentQuarter, framework]
    );

    const themeProgressMap = useMemo(() => {
        const map = new Map<string, number>();
        themes.forEach(t => {
            const themeObjs = objectivesWithProgress.filter(o => o.themeId === t.id);
            map.set(t.id, computeThemeProgress(themeObjs));
        });
        return map;
    }, [themes, objectivesWithProgress]);

    const planProgress = useMemo(() =>
        computePlanProgress(themes, themeProgressMap),
        [themes, themeProgressMap]
    );

    const kpiStats = useMemo(() => {
        const green = kpis.filter(k => computeRagStatus(k.current, k.target) === 'green').length;
        const amber = kpis.filter(k => computeRagStatus(k.current, k.target) === 'amber').length;
        const red = kpis.filter(k => computeRagStatus(k.current, k.target) === 'red').length;
        return { green, amber, red, total: kpis.length };
    }, [kpis]);

    const avgScore = useMemo(() => {
        if (scores.length === 0) return 0;
        const total = scores.reduce((sum, s) => sum + s.overallScore, 0);
        return Math.round(total / scores.length);
    }, [scores]);

    const strategyCount = useMemo(() => strategies.length, [strategies]);

    if (isLoading) {
        return (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {[...Array(4)].map((_, i) => (
                    <Skeleton key={i} className="h-32 rounded-xl" />
                ))}
                <Skeleton className="h-64 rounded-xl md:col-span-2 lg:col-span-4" />
            </div>
        );
    }

    if (!activePlan) {
        return (
            <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                    <BarChart3 className="h-12 w-12 text-muted-foreground/50 mb-4" />
                    <h3 className="text-lg font-semibold mb-2">Бизнес төлөвлөгөө байхгүй</h3>
                    <p className="text-sm text-muted-foreground max-w-sm">
                        &quot;Төлөвлөгөө&quot; таб руу орж шинэ бизнес төлөвлөгөө үүсгэнэ үү.
                    </p>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-6">
            {/* Plan header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold">{activePlan.title}</h2>
                    <p className="text-sm text-muted-foreground">
                        {activePlan.fiscalYear} он • {FRAMEWORK_SHORT_LABELS[framework]}
                        {framework === 'okr' && ` • ${currentQuarter}`}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">{FRAMEWORK_SHORT_LABELS[framework]}</Badge>
                    <Badge className={cn(PLAN_STATUS_COLORS[activePlan.status])}>
                        {PLAN_STATUS_LABELS[activePlan.status]}
                    </Badge>
                </div>
            </div>

            {/* Company strategy foundation */}
            {(companyProfile?.vision || companyProfile?.mission) && (
                <div className="grid gap-3 md:grid-cols-2">
                    {companyProfile.vision && (
                        <div className="p-3 bg-blue-50/50 dark:bg-blue-950/20 rounded-lg border border-blue-100 dark:border-blue-900/30">
                            <p className="text-[10px] font-semibold text-blue-500 uppercase tracking-wide mb-1">Алсын хараа</p>
                            <p className="text-xs">{companyProfile.vision}</p>
                        </div>
                    )}
                    {companyProfile.mission && (
                        <div className="p-3 bg-emerald-50/50 dark:bg-emerald-950/20 rounded-lg border border-emerald-100 dark:border-emerald-900/30">
                            <p className="text-[10px] font-semibold text-emerald-500 uppercase tracking-wide mb-1">Эрхэм зорилго</p>
                            <p className="text-xs">{companyProfile.mission}</p>
                        </div>
                    )}
                </div>
            )}

            {/* Summary cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="p-2 rounded-lg bg-emerald-100">
                                <Target className="h-5 w-5 text-emerald-600" />
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground font-medium">Төлөвлөгөө</p>
                                <p className="text-2xl font-bold">{planProgress}%</p>
                            </div>
                        </div>
                        <Progress value={planProgress} className="h-2" />
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="p-2 rounded-lg bg-blue-100">
                                <TrendingUp className="h-5 w-5 text-blue-600" />
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground font-medium">
                                    {OBJECTIVE_LABEL[framework]}
                                    {framework === 'okr' && ` (${currentQuarter})`}
                                </p>
                                <p className="text-2xl font-bold">{currentQObjectives.length}</p>
                            </div>
                        </div>
                        <p className="text-xs text-muted-foreground">
                            {currentQObjectives.filter(o => o.status === 'completed').length} биелсэн
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="p-2 rounded-lg bg-amber-100">
                                <BarChart3 className="h-5 w-5 text-amber-600" />
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground font-medium">KPI</p>
                                <p className="text-2xl font-bold">{kpiStats.total}</p>
                            </div>
                        </div>
                        <div className="flex gap-3 text-xs">
                            <span className="flex items-center gap-1">
                                <CheckCircle2 className="h-3 w-3 text-emerald-500" />{kpiStats.green}
                            </span>
                            <span className="flex items-center gap-1">
                                <AlertTriangle className="h-3 w-3 text-amber-500" />{kpiStats.amber}
                            </span>
                            <span className="flex items-center gap-1">
                                <XCircle className="h-3 w-3 text-red-500" />{kpiStats.red}
                            </span>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="p-2 rounded-lg bg-purple-100">
                                <Award className="h-5 w-5 text-purple-600" />
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground font-medium">Дундаж оноо</p>
                                <p className="text-2xl font-bold">{avgScore || '—'}</p>
                            </div>
                        </div>
                        <p className="text-xs text-muted-foreground">
                            {scores.length} ажилтан үнэлэгдсэн
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Strategy Cascade - framework-specific */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">
                        {framework === 'bsc' ? 'Perspective-ийн каскад' :
                         framework === 'ogsm' ? 'OGSM каскад' :
                         'Стратегийн каскад'}
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {themes.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-8">
                            {THEME_LABEL[framework]} нэмэгдээгүй байна
                        </p>
                    ) : (
                        <div className="space-y-4">
                            {themes.map(theme => {
                                const progress = themeProgressMap.get(theme.id) ?? 0;
                                const themeObjs = objectivesWithProgress.filter(o => o.themeId === theme.id);
                                const themeKpis = kpis.filter(k => k.themeId === theme.id);
                                const themeStrategies = strategies.filter(s => s.themeId === theme.id);
                                const perspLabel = theme.perspectiveType
                                    ? BSC_PERSPECTIVE_LABELS[theme.perspectiveType]
                                    : null;

                                return (
                                    <div key={theme.id} className="border rounded-lg p-4">
                                        <div className="flex items-center justify-between mb-3">
                                            <div className="flex items-center gap-3">
                                                <div
                                                    className="w-3 h-3 rounded-full"
                                                    style={{ backgroundColor: theme.color }}
                                                />
                                                <div>
                                                    <h4 className="font-medium text-sm">{theme.title}</h4>
                                                    <p className="text-xs text-muted-foreground">
                                                        {perspLabel && `${perspLabel} • `}
                                                        Жин: {theme.weight}% • {themeObjs.length} {OBJECTIVE_LABEL[framework].toLowerCase()}
                                                        {themeKpis.length > 0 && ` • ${themeKpis.length} KPI`}
                                                        {themeStrategies.length > 0 && ` • ${themeStrategies.length} ${framework === 'ogsm' ? 'стратеги' : 'санаачилга'}`}
                                                    </p>
                                                </div>
                                            </div>
                                            <span className="text-sm font-semibold">{progress}%</span>
                                        </div>
                                        <Progress value={progress} className="h-1.5 mb-3" />

                                        {themeObjs.length > 0 && (
                                            <div className="ml-6 space-y-2">
                                                {themeObjs.map(obj => (
                                                    <div key={obj.id} className="flex items-center justify-between text-xs">
                                                        <div className="flex items-center gap-2">
                                                            <ArrowDown className="h-3 w-3 text-muted-foreground" />
                                                            <span className="truncate max-w-[300px]">{obj.title}</span>
                                                            <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0', OKR_STATUS_COLORS[obj.status])}>
                                                                {OKR_STATUS_LABELS[obj.status]}
                                                            </Badge>
                                                        </div>
                                                        <span className="font-medium">{obj.progress}%</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* KPI RAG Detail */}
            {kpis.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">KPI хэмжүүрүүд</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                            {kpis.slice(0, 6).map(kpi => {
                                const rag = computeRagStatus(kpi.current, kpi.target);
                                const achievement = kpi.target > 0 ? Math.round((kpi.current / kpi.target) * 100) : 0;
                                return (
                                    <div key={kpi.id} className="border rounded-lg p-3">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-sm font-medium truncate">{kpi.name}</span>
                                            <Badge className={cn('text-[10px]', RAG_STATUS_COLORS[rag])}>
                                                {RAG_STATUS_LABELS[rag]}
                                            </Badge>
                                        </div>
                                        <div className="flex items-end gap-1 mb-1">
                                            <span className="text-lg font-bold">{kpi.current}</span>
                                            <span className="text-xs text-muted-foreground mb-0.5">/ {kpi.target} {kpi.unit}</span>
                                        </div>
                                        <Progress value={Math.min(achievement, 100)} className="h-1.5" />
                                    </div>
                                );
                            })}
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
