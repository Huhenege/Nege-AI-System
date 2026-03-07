// src/app/dashboard/business-plan/components/okr-tab.tsx
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
    Plus, Pencil, Target, ChevronRight, TrendingUp
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
    OKR_STATUS_LABELS,
    OKR_STATUS_COLORS,
    QUARTERS,
    Quarter,
    getCurrentQuarter,
    computeKeyResultProgress,
    computeObjectiveProgress,
} from '../types';
import { CreateObjectiveDialog } from './create-objective-dialog';
import { CreateKeyResultDialog } from './create-key-result-dialog';

interface OkrTabProps {
    activePlan?: BusinessPlan;
    themes: StrategicTheme[];
    objectives: Objective[];
    keyResults: KeyResult[];
    employees: Employee[];
    isLoading: boolean;
}

export function OkrTab({
    activePlan, themes, objectives, keyResults, employees, isLoading,
}: OkrTabProps) {
    const { firestore } = useFirebase();
    const { tDoc, tCollection } = useTenantWrite();
    const { toast } = useToast();
    const [selectedQuarter, setSelectedQuarter] = useState<Quarter>(getCurrentQuarter());
    const [isObjDialogOpen, setIsObjDialogOpen] = useState(false);
    const [isKrDialogOpen, setIsKrDialogOpen] = useState(false);
    const [editingObjective, setEditingObjective] = useState<Objective | null>(null);
    const [editingKeyResult, setEditingKeyResult] = useState<KeyResult | null>(null);
    const [defaultThemeId, setDefaultThemeId] = useState<string>('');
    const [defaultObjectiveId, setDefaultObjectiveId] = useState<string>('');

    // Filter by quarter
    const filteredObjectives = useMemo(() =>
        objectives.filter(o => o.quarter === selectedQuarter),
        [objectives, selectedQuarter]
    );

    // Compute progress for each objective
    const objectivesWithProgress = useMemo(() =>
        filteredObjectives.map(obj => {
            const objKrs = keyResults.filter(kr => kr.objectiveId === obj.id);
            return { ...obj, progress: computeObjectiveProgress(objKrs), krs: objKrs };
        }),
        [filteredObjectives, keyResults]
    );

    const handleCreateObjective = (values: ObjectiveFormValues) => {
        if (!firestore || !activePlan) return;
        const data = {
            ...values,
            planId: activePlan.id,
            progress: 0,
            createdAt: new Date().toISOString(),
        };
        addDocumentNonBlocking(tCollection('bp_objectives'), data);
        toast({ title: 'OKR зорилго үүсгэлээ', description: values.title });
    };

    const handleUpdateObjective = (values: ObjectiveFormValues) => {
        if (!firestore || !editingObjective) return;
        updateDocumentNonBlocking(tDoc('bp_objectives', editingObjective.id), values);
        toast({ title: 'Зорилго шинэчлэгдлээ' });
        setEditingObjective(null);
    };

    const handleCreateKeyResult = (values: KeyResultFormValues) => {
        if (!firestore || !activePlan) return;
        const obj = objectives.find(o => o.id === values.objectiveId);
        const data = {
            ...values,
            planId: activePlan.id,
            themeId: obj?.themeId || '',
            createdAt: new Date().toISOString(),
        };
        addDocumentNonBlocking(tCollection('bp_key_results'), data);
        toast({ title: 'Гол үр дүн нэмэгдлээ', description: values.title });
    };

    const handleUpdateKeyResult = (values: KeyResultFormValues) => {
        if (!firestore || !editingKeyResult) return;
        updateDocumentNonBlocking(tDoc('bp_key_results', editingKeyResult.id), values);
        toast({ title: 'Гол үр дүн шинэчлэгдлээ' });
        setEditingKeyResult(null);
    };

    if (!activePlan) {
        return (
            <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                    <Target className="h-12 w-12 text-muted-foreground/50 mb-4" />
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
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-semibold">OKR — Зорилго & Гол Үр Дүн</h3>
                    <p className="text-sm text-muted-foreground">{activePlan.title} • Улирлаар</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => { setEditingKeyResult(null); setDefaultObjectiveId(''); setIsKrDialogOpen(true); }} className="gap-2">
                        <Plus className="h-4 w-4" />Гол үр дүн
                    </Button>
                    <Button onClick={() => { setEditingObjective(null); setDefaultThemeId(''); setIsObjDialogOpen(true); }} className="gap-2">
                        <Plus className="h-4 w-4" />Зорилго
                    </Button>
                </div>
            </div>

            {/* Quarter selector */}
            <div className="flex gap-2">
                {QUARTERS.map(q => (
                    <Button
                        key={q}
                        variant={selectedQuarter === q ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setSelectedQuarter(q)}
                    >
                        {q}
                    </Button>
                ))}
            </div>

            {/* Objectives */}
            {objectivesWithProgress.length === 0 ? (
                <Card className="border-dashed">
                    <CardContent className="text-center py-12">
                        <p className="text-muted-foreground text-sm">
                            {selectedQuarter} улиралд зорилго байхгүй
                        </p>
                        <Button
                            variant="outline"
                            className="mt-3 gap-2"
                            onClick={() => { setEditingObjective(null); setIsObjDialogOpen(true); }}
                        >
                            <Plus className="h-4 w-4" />Зорилго нэмэх
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-4">
                    {objectivesWithProgress.map(obj => {
                        const theme = themes.find(t => t.id === obj.themeId);
                        return (
                            <Card key={obj.id}>
                                <CardHeader className="pb-3">
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                {theme && (
                                                    <div className="flex items-center gap-1.5">
                                                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: theme.color }} />
                                                        <span className="text-xs text-muted-foreground">{theme.title}</span>
                                                    </div>
                                                )}
                                                <Badge className={cn('text-[10px]', OKR_STATUS_COLORS[obj.status])}>
                                                    {OKR_STATUS_LABELS[obj.status]}
                                                </Badge>
                                            </div>
                                            <CardTitle className="text-base">{obj.title}</CardTitle>
                                            {obj.ownerName && (
                                                <p className="text-xs text-muted-foreground mt-1">Хариуцагч: {obj.ownerName}</p>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-lg font-bold">{obj.progress}%</span>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-7 w-7"
                                                onClick={() => { setEditingObjective(obj); setIsObjDialogOpen(true); }}
                                            >
                                                <Pencil className="h-3 w-3" />
                                            </Button>
                                        </div>
                                    </div>
                                    <Progress value={obj.progress} className="h-1.5 mt-2" />
                                </CardHeader>

                                <CardContent className="pt-0">
                                    {/* Key Results */}
                                    <div className="space-y-2">
                                        {obj.krs.map(kr => {
                                            const krProgress = computeKeyResultProgress(kr);
                                            return (
                                                <div
                                                    key={kr.id}
                                                    className="flex items-center justify-between p-3 bg-muted/30 rounded-lg group"
                                                >
                                                    <div className="flex items-center gap-2 flex-1 min-w-0">
                                                        <ChevronRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                                                        <span className="text-sm truncate">{kr.title}</span>
                                                    </div>
                                                    <div className="flex items-center gap-3 flex-shrink-0">
                                                        <div className="text-xs text-muted-foreground">
                                                            {kr.currentValue} / {kr.targetValue} {kr.unit}
                                                        </div>
                                                        <div className="w-16">
                                                            <Progress value={krProgress} className="h-1.5" />
                                                        </div>
                                                        <span className="text-xs font-medium w-10 text-right">{krProgress}%</span>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                                                            onClick={() => { setEditingKeyResult(kr); setIsKrDialogOpen(true); }}
                                                        >
                                                            <Pencil className="h-3 w-3" />
                                                        </Button>
                                                    </div>
                                                </div>
                                            );
                                        })}

                                        {/* Add KR button */}
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="w-full text-muted-foreground hover:text-foreground gap-1.5 h-8"
                                            onClick={() => {
                                                setEditingKeyResult(null);
                                                setDefaultObjectiveId(obj.id);
                                                setIsKrDialogOpen(true);
                                            }}
                                        >
                                            <Plus className="h-3.5 w-3.5" />Гол үр дүн нэмэх
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}

            {/* Dialogs */}
            <CreateObjectiveDialog
                open={isObjDialogOpen}
                onOpenChange={setIsObjDialogOpen}
                onSubmit={editingObjective ? handleUpdateObjective : handleCreateObjective}
                editingObjective={editingObjective}
                themes={themes}
                employees={employees}
                defaultThemeId={defaultThemeId}
            />
            <CreateKeyResultDialog
                open={isKrDialogOpen}
                onOpenChange={setIsKrDialogOpen}
                onSubmit={editingKeyResult ? handleUpdateKeyResult : handleCreateKeyResult}
                editingKeyResult={editingKeyResult}
                objectives={filteredObjectives}
                employees={employees}
                defaultObjectiveId={defaultObjectiveId}
            />
        </div>
    );
}
