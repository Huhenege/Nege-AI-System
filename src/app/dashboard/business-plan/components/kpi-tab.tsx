// src/app/dashboard/business-plan/components/kpi-tab.tsx
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
    Plus, Pencil, BarChart3, CheckCircle2, AlertTriangle, XCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Employee, Department } from '@/types';
import {
    BusinessPlan,
    StrategicTheme,
    Objective,
    Kpi,
    KpiFormValues,
    StrategyFramework,
    computeRagStatus,
    computeKpiAchievement,
    RAG_STATUS_LABELS,
    RAG_STATUS_COLORS,
    KPI_FREQUENCY_LABELS,
    RagStatus,
    THEME_LABEL,
} from '../types';
import { CreateKpiDialog } from './create-kpi-dialog';

interface KpiTabProps {
    activePlan?: BusinessPlan;
    themes: StrategicTheme[];
    objectives: Objective[];
    kpis: Kpi[];
    employees: Employee[];
    departments: Department[];
    isLoading: boolean;
    framework?: StrategyFramework;
}

export function KpiTab({
    activePlan, themes, objectives, kpis, employees, departments, isLoading, framework = 'okr',
}: KpiTabProps) {
    const { firestore } = useFirebase();
    const { tDoc, tCollection } = useTenantWrite();
    const { toast } = useToast();
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingKpi, setEditingKpi] = useState<Kpi | null>(null);
    const [ragFilter, setRagFilter] = useState<RagStatus | 'all'>('all');

    // Add computed RAG to KPIs
    const kpisWithRag = useMemo(() =>
        kpis.map(k => ({
            ...k,
            computedRag: computeRagStatus(k.current, k.target),
            achievement: computeKpiAchievement(k.current, k.target),
        })),
        [kpis]
    );

    // Filter by RAG
    const filteredKpis = useMemo(() =>
        ragFilter === 'all' ? kpisWithRag : kpisWithRag.filter(k => k.computedRag === ragFilter),
        [kpisWithRag, ragFilter]
    );

    // Stats
    const stats = useMemo(() => ({
        green: kpisWithRag.filter(k => k.computedRag === 'green').length,
        amber: kpisWithRag.filter(k => k.computedRag === 'amber').length,
        red: kpisWithRag.filter(k => k.computedRag === 'red').length,
    }), [kpisWithRag]);

    const handleCreate = (values: KpiFormValues) => {
        if (!firestore || !activePlan) return;
        const rag = computeRagStatus(values.current, values.target);
        const data = {
            ...values,
            planId: activePlan.id,
            ragStatus: rag,
            createdAt: new Date().toISOString(),
        };
        addDocumentNonBlocking(tCollection('bp_kpis'), data);
        toast({ title: 'KPI нэмэгдлээ', description: values.name });
    };

    const handleUpdate = (values: KpiFormValues) => {
        if (!firestore || !editingKpi) return;
        const rag = computeRagStatus(values.current, values.target);
        updateDocumentNonBlocking(tDoc('bp_kpis', editingKpi.id), { ...values, ragStatus: rag });
        toast({ title: 'KPI шинэчлэгдлээ' });
        setEditingKpi(null);
    };

    if (!activePlan) {
        return (
            <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                    <BarChart3 className="h-12 w-12 text-muted-foreground/50 mb-4" />
                    <h3 className="text-lg font-semibold mb-2">Идэвхтэй төлөвлөгөө байхгүй</h3>
                    <p className="text-sm text-muted-foreground">Эхлээд бизнес төлөвлөгөө үүсгэнэ үү.</p>
                </CardContent>
            </Card>
        );
    }

    if (isLoading) {
        return <div className="space-y-4">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>;
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-semibold">KPI Хэмжүүрүүд</h3>
                    <p className="text-sm text-muted-foreground">Үйл ажиллагааны гүйцэтгэлийн хэмжүүрүүд</p>
                </div>
                <Button onClick={() => { setEditingKpi(null); setIsDialogOpen(true); }} className="gap-2">
                    <Plus className="h-4 w-4" />Шинэ KPI
                </Button>
            </div>

            {/* RAG summary + filter */}
            <div className="flex gap-3">
                <Button
                    variant={ragFilter === 'all' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setRagFilter('all')}
                >
                    Бүгд ({kpisWithRag.length})
                </Button>
                <Button
                    variant={ragFilter === 'green' ? 'default' : 'outline'}
                    size="sm"
                    className="gap-1.5"
                    onClick={() => setRagFilter('green')}
                >
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />Хэвийн ({stats.green})
                </Button>
                <Button
                    variant={ragFilter === 'amber' ? 'default' : 'outline'}
                    size="sm"
                    className="gap-1.5"
                    onClick={() => setRagFilter('amber')}
                >
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />Анхааруулга ({stats.amber})
                </Button>
                <Button
                    variant={ragFilter === 'red' ? 'default' : 'outline'}
                    size="sm"
                    className="gap-1.5"
                    onClick={() => setRagFilter('red')}
                >
                    <XCircle className="h-3.5 w-3.5 text-red-500" />Сэрэмжлүүлэг ({stats.red})
                </Button>
            </div>

            {/* KPI cards */}
            {filteredKpis.length === 0 ? (
                <Card className="border-dashed">
                    <CardContent className="text-center py-12">
                        <p className="text-muted-foreground text-sm">KPI байхгүй</p>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {filteredKpis.map(kpi => {
                        const theme = themes.find(t => t.id === kpi.themeId);
                        return (
                            <Card key={kpi.id} className="group">
                                <CardContent className="pt-5">
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                {theme && (
                                                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: theme.color }} />
                                                )}
                                                <Badge className={cn('text-[10px]', RAG_STATUS_COLORS[kpi.computedRag])}>
                                                    {RAG_STATUS_LABELS[kpi.computedRag]}
                                                </Badge>
                                                <Badge variant="outline" className="text-[10px]">
                                                    {KPI_FREQUENCY_LABELS[kpi.frequency]}
                                                </Badge>
                                            </div>
                                            <h4 className="font-medium text-sm truncate">{kpi.name}</h4>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                                            onClick={() => { setEditingKpi(kpi); setIsDialogOpen(true); }}
                                        >
                                            <Pencil className="h-3 w-3" />
                                        </Button>
                                    </div>

                                    <div className="flex items-end gap-1 mb-2">
                                        <span className="text-2xl font-bold">{kpi.current}</span>
                                        <span className="text-sm text-muted-foreground mb-0.5">/ {kpi.target} {kpi.unit}</span>
                                    </div>

                                    <Progress value={Math.min(kpi.achievement, 100)} className="h-2 mb-2" />

                                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                                        <span>{kpi.achievement}% биелэлт</span>
                                        {kpi.ownerName && <span>{kpi.ownerName}</span>}
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}

            <CreateKpiDialog
                open={isDialogOpen}
                onOpenChange={setIsDialogOpen}
                onSubmit={editingKpi ? handleUpdate : handleCreate}
                editingKpi={editingKpi}
                themes={themes}
                objectives={objectives}
                employees={employees}
                departments={departments}
            />
        </div>
    );
}
