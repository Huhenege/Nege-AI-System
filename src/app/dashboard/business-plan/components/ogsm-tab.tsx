// src/app/dashboard/business-plan/components/ogsm-tab.tsx
'use client';

import React, { useState, useMemo } from 'react';
import { useFirebase, addDocumentNonBlocking, updateDocumentNonBlocking, useTenantWrite } from '@/firebase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import {
    Plus, Pencil, Layers, ChevronRight, ChevronDown, Target, Crosshair,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Employee } from '@/types';
import {
    BusinessPlan,
    StrategicTheme,
    Objective,
    ObjectiveFormValues,
    KeyResult,
    KeyResultFormValues,
    Strategy,
    StrategyFormValues,
    OKR_STATUS_LABELS,
    OKR_STATUS_COLORS,
    computeKeyResultProgress,
    computeStrategyProgress,
    computeGoalProgressFromStrategies,
} from '../types';
import { CreateObjectiveDialog } from './create-objective-dialog';
import { CreateKeyResultDialog } from './create-key-result-dialog';
import { CreateStrategyDialog } from './create-strategy-dialog';

interface OgsmTabProps {
    activePlan?: BusinessPlan;
    themes: StrategicTheme[];
    objectives: Objective[];
    keyResults: KeyResult[];
    strategies: Strategy[];
    employees: Employee[];
    isLoading: boolean;
}

export function OgsmTab({
    activePlan, themes, objectives, keyResults, strategies, employees, isLoading,
}: OgsmTabProps) {
    const { firestore } = useFirebase();
    const { tDoc, tCollection } = useTenantWrite();
    const { toast } = useToast();

    const [expandedThemeId, setExpandedThemeId] = useState<string | null>(null);
    const [expandedGoalId, setExpandedGoalId] = useState<string | null>(null);
    const [expandedStrategyId, setExpandedStrategyId] = useState<string | null>(null);

    const [isObjDialogOpen, setIsObjDialogOpen] = useState(false);
    const [isStrategyDialogOpen, setIsStrategyDialogOpen] = useState(false);
    const [isMeasureDialogOpen, setIsMeasureDialogOpen] = useState(false);
    const [editingObjective, setEditingObjective] = useState<Objective | null>(null);
    const [editingStrategy, setEditingStrategy] = useState<Strategy | null>(null);
    const [editingMeasure, setEditingMeasure] = useState<KeyResult | null>(null);
    const [defaultThemeId, setDefaultThemeId] = useState('');
    const [defaultParentId, setDefaultParentId] = useState('');
    const [defaultObjectiveId, setDefaultObjectiveId] = useState('');

    const ogsmStrategies = useMemo(
        () => strategies.filter(s => s.type === 'ogsm_strategy'),
        [strategies]
    );

    const themeDataMap = useMemo(() => {
        const map = new Map<string, {
            goals: (Objective & { strategies: (Strategy & { measures: KeyResult[] })[]; goalProgress: number })[];
            themeProgress: number;
        }>();

        themes.forEach(theme => {
            const themeGoals = objectives.filter(o => o.themeId === theme.id);
            const goals = themeGoals.map(goal => {
                const goalStrategies = ogsmStrategies.filter(s => s.parentId === goal.id);
                const strategiesWithMeasures = goalStrategies.map(strat => {
                    const measures = keyResults.filter(kr => kr.strategyId === strat.id);
                    return { ...strat, measures, progress: computeStrategyProgress(measures) };
                });
                const goalProgress = goalStrategies.length > 0
                    ? computeGoalProgressFromStrategies(strategiesWithMeasures)
                    : 0;
                return { ...goal, strategies: strategiesWithMeasures, goalProgress };
            });

            const themeProgress = goals.length > 0
                ? Math.round(goals.reduce((sum, g) => sum + g.goalProgress, 0) / goals.length)
                : 0;

            map.set(theme.id, { goals, themeProgress });
        });

        return map;
    }, [themes, objectives, ogsmStrategies, keyResults]);

    const handleCreateGoal = (values: ObjectiveFormValues) => {
        if (!firestore || !activePlan) return;
        addDocumentNonBlocking(tCollection('bp_objectives'), {
            ...values,
            planId: activePlan.id,
            progress: 0,
            createdAt: new Date().toISOString(),
        });
        toast({ title: 'Зорилт нэмэгдлээ', description: values.title });
    };

    const handleUpdateGoal = (values: ObjectiveFormValues) => {
        if (!firestore || !editingObjective) return;
        updateDocumentNonBlocking(tDoc('bp_objectives', editingObjective.id), values);
        toast({ title: 'Зорилт шинэчлэгдлээ' });
        setEditingObjective(null);
    };

    const handleCreateStrategy = (values: StrategyFormValues) => {
        if (!firestore || !activePlan) return;
        const goal = objectives.find(o => o.id === values.parentId);
        addDocumentNonBlocking(tCollection('bp_strategies'), {
            ...values,
            planId: activePlan.id,
            themeId: goal?.themeId || '',
            progress: 0,
            createdAt: new Date().toISOString(),
        });
        toast({ title: 'Стратеги нэмэгдлээ', description: values.title });
    };

    const handleUpdateStrategy = (values: StrategyFormValues) => {
        if (!firestore || !editingStrategy) return;
        updateDocumentNonBlocking(tDoc('bp_strategies', editingStrategy.id), values);
        toast({ title: 'Стратеги шинэчлэгдлээ' });
        setEditingStrategy(null);
    };

    const handleCreateMeasure = (values: KeyResultFormValues) => {
        if (!firestore || !activePlan) return;
        const obj = objectives.find(o => o.id === values.objectiveId);
        addDocumentNonBlocking(tCollection('bp_key_results'), {
            ...values,
            planId: activePlan.id,
            themeId: obj?.themeId || '',
            createdAt: new Date().toISOString(),
        });
        toast({ title: 'Хэмжүүр нэмэгдлээ', description: values.title });
    };

    const handleUpdateMeasure = (values: KeyResultFormValues) => {
        if (!firestore || !editingMeasure) return;
        updateDocumentNonBlocking(tDoc('bp_key_results', editingMeasure.id), values);
        toast({ title: 'Хэмжүүр шинэчлэгдлээ' });
        setEditingMeasure(null);
    };

    if (!activePlan) {
        return (
            <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                    <Layers className="h-12 w-12 text-muted-foreground/50 mb-4" />
                    <h3 className="text-lg font-semibold mb-2">Идэвхтэй төлөвлөгөө байхгүй</h3>
                    <p className="text-sm text-muted-foreground">Эхлээд &quot;Төлөвлөгөө&quot; табаас бизнес төлөвлөгөө үүсгэнэ үү.</p>
                </CardContent>
            </Card>
        );
    }

    if (isLoading) {
        return <div className="space-y-4">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)}</div>;
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-semibold">OGSM — Зорилго → Зорилт → Стратеги → Хэмжүүр</h3>
                    <p className="text-sm text-muted-foreground">{activePlan.title}</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => { setEditingStrategy(null); setDefaultParentId(''); setIsStrategyDialogOpen(true); }} className="gap-2">
                        <Plus className="h-4 w-4" />Стратеги
                    </Button>
                    <Button onClick={() => { setEditingObjective(null); setDefaultThemeId(''); setIsObjDialogOpen(true); }} className="gap-2">
                        <Plus className="h-4 w-4" />Зорилт
                    </Button>
                </div>
            </div>

            {themes.length === 0 ? (
                <Card className="border-dashed">
                    <CardContent className="text-center py-12">
                        <p className="text-muted-foreground text-sm">
                            Эхлээд &quot;Төлөвлөгөө&quot; табаас OGSM Objective (Зорилго) нэмнэ үү.
                        </p>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-4">
                    {themes.map(theme => {
                        const data = themeDataMap.get(theme.id);
                        const isExpanded = expandedThemeId === theme.id;
                        return (
                            <Card key={theme.id}>
                                <CardHeader
                                    className="cursor-pointer pb-3"
                                    onClick={() => setExpandedThemeId(isExpanded ? null : theme.id)}
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: theme.color }} />
                                            <div>
                                                <CardTitle className="text-base flex items-center gap-2">
                                                    <Target className="h-4 w-4 text-muted-foreground" />
                                                    {theme.title}
                                                </CardTitle>
                                                {theme.description && (
                                                    <p className="text-xs text-muted-foreground mt-0.5">{theme.description}</p>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className="text-sm font-semibold">{data?.themeProgress ?? 0}%</span>
                                            <Badge variant="outline" className="text-xs">{data?.goals.length ?? 0} зорилт</Badge>
                                        </div>
                                    </div>
                                    <Progress value={data?.themeProgress ?? 0} className="h-1.5 mt-2" />
                                </CardHeader>

                                {isExpanded && (
                                    <CardContent className="pt-0 space-y-3">
                                        {(data?.goals ?? []).map(goal => {
                                            const isGoalExpanded = expandedGoalId === goal.id;
                                            return (
                                                <div key={goal.id} className="border rounded-lg">
                                                    <div
                                                        className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/30"
                                                        onClick={() => setExpandedGoalId(isGoalExpanded ? null : goal.id)}
                                                    >
                                                        <div className="flex items-center gap-2">
                                                            {isGoalExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                                                            <Crosshair className="h-3.5 w-3.5 text-blue-500" />
                                                            <span className="text-sm font-medium">{goal.title}</span>
                                                            <Badge className={cn('text-[10px]', OKR_STATUS_COLORS[goal.status])}>
                                                                {OKR_STATUS_LABELS[goal.status]}
                                                            </Badge>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-xs font-medium">{goal.goalProgress}%</span>
                                                            <Button variant="ghost" size="icon" className="h-6 w-6"
                                                                onClick={e => { e.stopPropagation(); setEditingObjective(goal); setIsObjDialogOpen(true); }}>
                                                                <Pencil className="h-3 w-3" />
                                                            </Button>
                                                        </div>
                                                    </div>

                                                    {isGoalExpanded && (
                                                        <div className="px-3 pb-3 space-y-2 ml-6">
                                                            {goal.strategies.map(strat => {
                                                                const isStratExpanded = expandedStrategyId === strat.id;
                                                                return (
                                                                    <div key={strat.id} className="border rounded-md bg-muted/20">
                                                                        <div
                                                                            className="flex items-center justify-between p-2.5 cursor-pointer"
                                                                            onClick={() => setExpandedStrategyId(isStratExpanded ? null : strat.id)}
                                                                        >
                                                                            <div className="flex items-center gap-2">
                                                                                {isStratExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                                                                                <Layers className="h-3.5 w-3.5 text-amber-500" />
                                                                                <span className="text-sm">{strat.title}</span>
                                                                                <Badge className={cn('text-[10px]', OKR_STATUS_COLORS[strat.status])}>
                                                                                    {OKR_STATUS_LABELS[strat.status]}
                                                                                </Badge>
                                                                            </div>
                                                                            <div className="flex items-center gap-2">
                                                                                <div className="w-12"><Progress value={strat.progress} className="h-1" /></div>
                                                                                <span className="text-xs font-medium w-8 text-right">{strat.progress}%</span>
                                                                                <Button variant="ghost" size="icon" className="h-5 w-5"
                                                                                    onClick={e => { e.stopPropagation(); setEditingStrategy(strat); setIsStrategyDialogOpen(true); }}>
                                                                                    <Pencil className="h-2.5 w-2.5" />
                                                                                </Button>
                                                                            </div>
                                                                        </div>

                                                                        {isStratExpanded && (
                                                                            <div className="px-2.5 pb-2.5 space-y-1 ml-5">
                                                                                {strat.measures.map(m => {
                                                                                    const prog = computeKeyResultProgress(m);
                                                                                    return (
                                                                                        <div key={m.id} className="flex items-center justify-between p-2 bg-background rounded border group">
                                                                                            <span className="text-xs truncate flex-1">{m.title}</span>
                                                                                            <div className="flex items-center gap-2 flex-shrink-0">
                                                                                                <span className="text-[10px] text-muted-foreground">{m.currentValue}/{m.targetValue} {m.unit}</span>
                                                                                                <div className="w-10"><Progress value={prog} className="h-1" /></div>
                                                                                                <span className="text-[10px] font-medium w-7 text-right">{prog}%</span>
                                                                                                <Button variant="ghost" size="icon"
                                                                                                    className="h-5 w-5 opacity-0 group-hover:opacity-100"
                                                                                                    onClick={() => { setEditingMeasure(m); setIsMeasureDialogOpen(true); }}>
                                                                                                    <Pencil className="h-2.5 w-2.5" />
                                                                                                </Button>
                                                                                            </div>
                                                                                        </div>
                                                                                    );
                                                                                })}
                                                                                <Button variant="ghost" size="sm"
                                                                                    className="w-full text-muted-foreground hover:text-foreground gap-1 h-7 text-xs"
                                                                                    onClick={() => { setEditingMeasure(null); setDefaultObjectiveId(goal.id); setIsMeasureDialogOpen(true); }}>
                                                                                    <Plus className="h-3 w-3" />Хэмжүүр нэмэх
                                                                                </Button>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                );
                                                            })}
                                                            <Button variant="ghost" size="sm"
                                                                className="w-full text-muted-foreground hover:text-foreground gap-1 h-7 text-xs"
                                                                onClick={() => { setEditingStrategy(null); setDefaultParentId(goal.id); setIsStrategyDialogOpen(true); }}>
                                                                <Plus className="h-3 w-3" />Стратеги нэмэх
                                                            </Button>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                        <Button variant="ghost" size="sm"
                                            className="w-full text-muted-foreground hover:text-foreground gap-1.5 h-8"
                                            onClick={() => { setEditingObjective(null); setDefaultThemeId(theme.id); setIsObjDialogOpen(true); }}>
                                            <Plus className="h-3.5 w-3.5" />Зорилт нэмэх
                                        </Button>
                                    </CardContent>
                                )}
                            </Card>
                        );
                    })}
                </div>
            )}

            <CreateObjectiveDialog
                open={isObjDialogOpen}
                onOpenChange={setIsObjDialogOpen}
                onSubmit={editingObjective ? handleUpdateGoal : handleCreateGoal}
                editingObjective={editingObjective}
                themes={themes}
                employees={employees}
                defaultThemeId={defaultThemeId}
                framework="ogsm"
            />
            <CreateStrategyDialog
                open={isStrategyDialogOpen}
                onOpenChange={setIsStrategyDialogOpen}
                onSubmit={editingStrategy ? handleUpdateStrategy : handleCreateStrategy}
                editingStrategy={editingStrategy}
                objectives={objectives}
                employees={employees}
                type="ogsm_strategy"
                defaultParentId={defaultParentId}
            />
            <CreateKeyResultDialog
                open={isMeasureDialogOpen}
                onOpenChange={setIsMeasureDialogOpen}
                onSubmit={editingMeasure ? handleUpdateMeasure : handleCreateMeasure}
                editingKeyResult={editingMeasure}
                objectives={objectives}
                employees={employees}
                defaultObjectiveId={defaultObjectiveId}
                framework="ogsm"
            />
        </div>
    );
}
