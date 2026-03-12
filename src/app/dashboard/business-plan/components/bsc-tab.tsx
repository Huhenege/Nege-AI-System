// src/app/dashboard/business-plan/components/bsc-tab.tsx
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
    Plus, Pencil, BarChart3, Target, Rocket, ChevronRight, ChevronDown,
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
    BSC_PERSPECTIVE_LABELS,
    BscPerspectiveType,
    OKR_STATUS_LABELS,
    OKR_STATUS_COLORS,
    computeKeyResultProgress,
    computeObjectiveProgress,
    computeThemeProgress,
} from '../types';
import { CreateObjectiveDialog } from './create-objective-dialog';
import { CreateKeyResultDialog } from './create-key-result-dialog';
import { CreateStrategyDialog } from './create-strategy-dialog';

interface BscTabProps {
    activePlan?: BusinessPlan;
    themes: StrategicTheme[];
    objectives: Objective[];
    keyResults: KeyResult[];
    strategies: Strategy[];
    employees: Employee[];
    isLoading: boolean;
}

export function BscTab({
    activePlan, themes, objectives, keyResults, strategies, employees, isLoading,
}: BscTabProps) {
    const { firestore } = useFirebase();
    const { tDoc, tCollection } = useTenantWrite();
    const { toast } = useToast();

    const [expandedPerspective, setExpandedPerspective] = useState<string | null>(null);
    const [isObjDialogOpen, setIsObjDialogOpen] = useState(false);
    const [isMeasureDialogOpen, setIsMeasureDialogOpen] = useState(false);
    const [isInitiativeDialogOpen, setIsInitiativeDialogOpen] = useState(false);
    const [editingObjective, setEditingObjective] = useState<Objective | null>(null);
    const [editingMeasure, setEditingMeasure] = useState<KeyResult | null>(null);
    const [editingInitiative, setEditingInitiative] = useState<Strategy | null>(null);
    const [defaultThemeId, setDefaultThemeId] = useState('');
    const [defaultObjectiveId, setDefaultObjectiveId] = useState('');
    const [defaultParentId, setDefaultParentId] = useState('');

    const bscInitiatives = useMemo(
        () => strategies.filter(s => s.type === 'bsc_initiative'),
        [strategies]
    );

    const perspectiveData = useMemo(() => {
        return themes.map(perspective => {
            const perspObjs = objectives.filter(o => o.themeId === perspective.id);
            const objsWithData = perspObjs.map(obj => {
                const objKrs = keyResults.filter(kr => kr.objectiveId === obj.id);
                const objInitiatives = bscInitiatives.filter(i => i.parentId === obj.id);
                const progress = computeObjectiveProgress(objKrs);
                return { ...obj, progress, measures: objKrs, initiatives: objInitiatives };
            });
            const perspProgress = computeThemeProgress(objsWithData);
            return { ...perspective, objectives: objsWithData, progress: perspProgress };
        });
    }, [themes, objectives, keyResults, bscInitiatives]);

    const handleCreateObjective = (values: ObjectiveFormValues) => {
        if (!firestore || !activePlan) return;
        addDocumentNonBlocking(tCollection('bp_objectives'), {
            ...values, planId: activePlan.id, progress: 0, createdAt: new Date().toISOString(),
        });
        toast({ title: 'Стратегийн зорилго нэмэгдлээ', description: values.title });
    };

    const handleUpdateObjective = (values: ObjectiveFormValues) => {
        if (!firestore || !editingObjective) return;
        updateDocumentNonBlocking(tDoc('bp_objectives', editingObjective.id), values);
        toast({ title: 'Зорилго шинэчлэгдлээ' });
        setEditingObjective(null);
    };

    const handleCreateMeasure = (values: KeyResultFormValues) => {
        if (!firestore || !activePlan) return;
        const obj = objectives.find(o => o.id === values.objectiveId);
        addDocumentNonBlocking(tCollection('bp_key_results'), {
            ...values, planId: activePlan.id, themeId: obj?.themeId || '', createdAt: new Date().toISOString(),
        });
        toast({ title: 'Хэмжүүр нэмэгдлээ', description: values.title });
    };

    const handleUpdateMeasure = (values: KeyResultFormValues) => {
        if (!firestore || !editingMeasure) return;
        updateDocumentNonBlocking(tDoc('bp_key_results', editingMeasure.id), values);
        toast({ title: 'Хэмжүүр шинэчлэгдлээ' });
        setEditingMeasure(null);
    };

    const handleCreateInitiative = (values: StrategyFormValues) => {
        if (!firestore || !activePlan) return;
        const obj = objectives.find(o => o.id === values.parentId);
        addDocumentNonBlocking(tCollection('bp_strategies'), {
            ...values, planId: activePlan.id, themeId: obj?.themeId || '', progress: 0, createdAt: new Date().toISOString(),
        });
        toast({ title: 'Санаачилга нэмэгдлээ', description: values.title });
    };

    const handleUpdateInitiative = (values: StrategyFormValues) => {
        if (!firestore || !editingInitiative) return;
        updateDocumentNonBlocking(tDoc('bp_strategies', editingInitiative.id), values);
        toast({ title: 'Санаачилга шинэчлэгдлээ' });
        setEditingInitiative(null);
    };

    if (!activePlan) {
        return (
            <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                    <BarChart3 className="h-12 w-12 text-muted-foreground/50 mb-4" />
                    <h3 className="text-lg font-semibold mb-2">Идэвхтэй төлөвлөгөө байхгүй</h3>
                    <p className="text-sm text-muted-foreground">Эхлээд &quot;Төлөвлөгөө&quot; табаас бизнес төлөвлөгөө үүсгэнэ үү.</p>
                </CardContent>
            </Card>
        );
    }

    if (isLoading) {
        return <div className="space-y-4">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)}</div>;
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-semibold">Balanced Scorecard</h3>
                    <p className="text-sm text-muted-foreground">{activePlan.title} — 4 Perspective</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => { setEditingInitiative(null); setDefaultParentId(''); setIsInitiativeDialogOpen(true); }} className="gap-2">
                        <Plus className="h-4 w-4" />Санаачилга
                    </Button>
                    <Button onClick={() => { setEditingObjective(null); setDefaultThemeId(''); setIsObjDialogOpen(true); }} className="gap-2">
                        <Plus className="h-4 w-4" />Стратегийн зорилго
                    </Button>
                </div>
            </div>

            {themes.length === 0 ? (
                <Card className="border-dashed">
                    <CardContent className="text-center py-12">
                        <p className="text-muted-foreground text-sm">
                            BSC Perspective-ууд &quot;Төлөвлөгөө&quot; табаас үүсгэгдэнэ.
                        </p>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-4 md:grid-cols-2">
                    {perspectiveData.map(persp => {
                        const isExpanded = expandedPerspective === persp.id;
                        const perspLabel = persp.perspectiveType
                            ? BSC_PERSPECTIVE_LABELS[persp.perspectiveType]
                            : persp.title;

                        return (
                            <Card key={persp.id} className="overflow-hidden">
                                <CardHeader
                                    className="cursor-pointer pb-3"
                                    style={{ borderLeft: `4px solid ${persp.color}` }}
                                    onClick={() => setExpandedPerspective(isExpanded ? null : persp.id)}
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                            <div>
                                                <CardTitle className="text-sm">{persp.title}</CardTitle>
                                                {persp.perspectiveType && (
                                                    <p className="text-[10px] text-muted-foreground mt-0.5 uppercase tracking-wide">
                                                        {perspLabel}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-lg font-bold">{persp.progress}%</span>
                                            <Badge variant="outline" className="text-[10px]">{persp.weight}%</Badge>
                                        </div>
                                    </div>
                                    <Progress value={persp.progress} className="h-1.5 mt-2" />
                                </CardHeader>

                                {isExpanded && (
                                    <CardContent className="pt-0 space-y-3">
                                        {persp.objectives.length === 0 ? (
                                            <p className="text-xs text-muted-foreground text-center py-4">Стратегийн зорилго нэмэгдээгүй</p>
                                        ) : (
                                            persp.objectives.map(obj => (
                                                <div key={obj.id} className="border rounded-lg p-3 space-y-2">
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-2">
                                                            <Target className="h-3.5 w-3.5 text-blue-500" />
                                                            <span className="text-sm font-medium">{obj.title}</span>
                                                            <Badge className={cn('text-[10px]', OKR_STATUS_COLORS[obj.status])}>
                                                                {OKR_STATUS_LABELS[obj.status]}
                                                            </Badge>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-xs font-medium">{obj.progress}%</span>
                                                            <Button variant="ghost" size="icon" className="h-6 w-6"
                                                                onClick={() => { setEditingObjective(obj); setIsObjDialogOpen(true); }}>
                                                                <Pencil className="h-3 w-3" />
                                                            </Button>
                                                        </div>
                                                    </div>

                                                    {/* Measures */}
                                                    {obj.measures.length > 0 && (
                                                        <div className="ml-5 space-y-1">
                                                            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Хэмжүүрүүд</p>
                                                            {obj.measures.map(m => {
                                                                const prog = computeKeyResultProgress(m);
                                                                return (
                                                                    <div key={m.id} className="flex items-center justify-between p-2 bg-muted/30 rounded group">
                                                                        <span className="text-xs truncate flex-1">{m.title}</span>
                                                                        <div className="flex items-center gap-2 flex-shrink-0">
                                                                            <span className="text-[10px] text-muted-foreground">{m.currentValue}/{m.targetValue}</span>
                                                                            <div className="w-12"><Progress value={prog} className="h-1" /></div>
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
                                                        </div>
                                                    )}

                                                    {/* Initiatives */}
                                                    {obj.initiatives.length > 0 && (
                                                        <div className="ml-5 space-y-1">
                                                            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Санаачилгууд</p>
                                                            {obj.initiatives.map(init => (
                                                                <div key={init.id} className="flex items-center justify-between p-2 bg-purple-50/50 dark:bg-purple-950/10 rounded group">
                                                                    <div className="flex items-center gap-2">
                                                                        <Rocket className="h-3 w-3 text-purple-500" />
                                                                        <span className="text-xs">{init.title}</span>
                                                                        <Badge className={cn('text-[10px]', OKR_STATUS_COLORS[init.status])}>
                                                                            {OKR_STATUS_LABELS[init.status]}
                                                                        </Badge>
                                                                    </div>
                                                                    <Button variant="ghost" size="icon"
                                                                        className="h-5 w-5 opacity-0 group-hover:opacity-100"
                                                                        onClick={() => { setEditingInitiative(init); setIsInitiativeDialogOpen(true); }}>
                                                                        <Pencil className="h-2.5 w-2.5" />
                                                                    </Button>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}

                                                    <div className="flex gap-2 ml-5">
                                                        <Button variant="ghost" size="sm"
                                                            className="text-muted-foreground hover:text-foreground gap-1 h-6 text-[10px]"
                                                            onClick={() => { setEditingMeasure(null); setDefaultObjectiveId(obj.id); setIsMeasureDialogOpen(true); }}>
                                                            <Plus className="h-2.5 w-2.5" />Хэмжүүр
                                                        </Button>
                                                        <Button variant="ghost" size="sm"
                                                            className="text-muted-foreground hover:text-foreground gap-1 h-6 text-[10px]"
                                                            onClick={() => { setEditingInitiative(null); setDefaultParentId(obj.id); setIsInitiativeDialogOpen(true); }}>
                                                            <Plus className="h-2.5 w-2.5" />Санаачилга
                                                        </Button>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                        <Button variant="ghost" size="sm"
                                            className="w-full text-muted-foreground hover:text-foreground gap-1.5 h-8"
                                            onClick={() => { setEditingObjective(null); setDefaultThemeId(persp.id); setIsObjDialogOpen(true); }}>
                                            <Plus className="h-3.5 w-3.5" />Стратегийн зорилго нэмэх
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
                onSubmit={editingObjective ? handleUpdateObjective : handleCreateObjective}
                editingObjective={editingObjective}
                themes={themes}
                employees={employees}
                defaultThemeId={defaultThemeId}
                framework="bsc"
            />
            <CreateKeyResultDialog
                open={isMeasureDialogOpen}
                onOpenChange={setIsMeasureDialogOpen}
                onSubmit={editingMeasure ? handleUpdateMeasure : handleCreateMeasure}
                editingKeyResult={editingMeasure}
                objectives={objectives}
                employees={employees}
                defaultObjectiveId={defaultObjectiveId}
                framework="bsc"
            />
            <CreateStrategyDialog
                open={isInitiativeDialogOpen}
                onOpenChange={setIsInitiativeDialogOpen}
                onSubmit={editingInitiative ? handleUpdateInitiative : handleCreateInitiative}
                editingStrategy={editingInitiative}
                objectives={objectives}
                employees={employees}
                type="bsc_initiative"
                defaultParentId={defaultParentId}
            />
        </div>
    );
}
