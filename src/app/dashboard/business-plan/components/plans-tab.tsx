// src/app/dashboard/business-plan/components/plans-tab.tsx
'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { useFirebase, addDocumentNonBlocking, updateDocumentNonBlocking, useTenantWrite } from '@/firebase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import {
    Plus, Pencil, AlertCircle, ExternalLink, Eye, Sparkles, Target, Compass
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Employee } from '@/types';
import {
    BusinessPlan,
    BusinessPlanFormValues,
    StrategicTheme,
    StrategicThemeFormValues,
    CompanyProfile,
    CoreValue,
    PLAN_STATUS_LABELS,
    PLAN_STATUS_COLORS,
    validateThemeWeights,
} from '../types';
import { CreatePlanDialog } from './create-plan-dialog';
import { CreateThemeDialog } from './create-theme-dialog';

interface PlansTabProps {
    plans: BusinessPlan[];
    themes: StrategicTheme[];
    employees: Employee[];
    companyProfile?: CompanyProfile | null;
    coreValues: CoreValue[];
    isLoading: boolean;
}

export function PlansTab({ plans, themes, employees, companyProfile, coreValues, isLoading }: PlansTabProps) {
    const { firestore, user } = useFirebase();
    const { tDoc, tCollection } = useTenantWrite();
    const { toast } = useToast();
    const [isPlanDialogOpen, setIsPlanDialogOpen] = useState(false);
    const [isThemeDialogOpen, setIsThemeDialogOpen] = useState(false);
    const [editingPlan, setEditingPlan] = useState<BusinessPlan | null>(null);
    const [editingTheme, setEditingTheme] = useState<StrategicTheme | null>(null);

    // Current year's plan (primary view)
    const currentYear = new Date().getFullYear();
    const currentPlan = useMemo(() =>
        plans.find(p => p.status === 'active') || plans.find(p => p.fiscalYear === currentYear) || plans[0],
        [plans, currentYear]
    );

    const existingYears = useMemo(() => plans.map(p => p.fiscalYear), [plans]);

    const planThemes = useMemo(() =>
        currentPlan ? themes.filter(t => t.planId === currentPlan.id) : [],
        [themes, currentPlan]
    );

    const totalWeight = planThemes.reduce((s, t) => s + t.weight, 0);
    const isWeightValid = planThemes.length === 0 || totalWeight === 100;

    const handleCreatePlan = (values: BusinessPlanFormValues) => {
        if (!firestore || !user) return;
        addDocumentNonBlocking(tCollection('bp_plans'), {
            ...values,
            createdAt: new Date().toISOString(),
            createdBy: user.uid,
        });
        toast({ title: 'Төлөвлөгөө үүсгэлээ', description: values.title });
    };

    const handleUpdatePlan = (values: BusinessPlanFormValues) => {
        if (!firestore || !editingPlan) return;
        updateDocumentNonBlocking(tDoc('bp_plans', editingPlan.id), values);
        toast({ title: 'Төлөвлөгөө шинэчлэгдлээ' });
        setEditingPlan(null);
    };

    const handleCreateTheme = (values: StrategicThemeFormValues) => {
        if (!firestore || !currentPlan) return;
        addDocumentNonBlocking(tCollection('bp_themes'), {
            ...values,
            planId: currentPlan.id,
            order: planThemes.length,
            createdAt: new Date().toISOString(),
        });
        toast({ title: 'Стратегийн чиглэл нэмэгдлээ', description: values.title });
    };

    const handleUpdateTheme = (values: StrategicThemeFormValues) => {
        if (!firestore || !editingTheme) return;
        updateDocumentNonBlocking(tDoc('bp_themes', editingTheme.id), values);
        toast({ title: 'Чиглэл шинэчлэгдлээ' });
        setEditingTheme(null);
    };

    if (isLoading) {
        return <div className="space-y-4">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)}</div>;
    }

    return (
        <div className="space-y-6">
            {/* ── Байгууллагын стратегийн суурь ── */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="text-base flex items-center gap-2">
                                <Compass className="h-4 w-4 text-blue-500" />
                                Байгууллагын стратегийн суурь
                            </CardTitle>
                            <CardDescription>
                                Компанийн бүртгэлээс автоматаар авсан батлагдсан стратеги
                            </CardDescription>
                        </div>
                        <Button variant="outline" size="sm" asChild className="gap-1.5">
                            <Link href="/dashboard/company">
                                <ExternalLink className="h-3.5 w-3.5" />Компани
                            </Link>
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                        {/* Vision */}
                        <div className="p-4 bg-blue-50/50 dark:bg-blue-950/20 rounded-lg border border-blue-100 dark:border-blue-900/30">
                            <div className="flex items-center gap-2 mb-2">
                                <Eye className="h-4 w-4 text-blue-500" />
                                <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wide">Алсын хараа (Vision)</p>
                            </div>
                            <p className="text-sm">
                                {companyProfile?.vision || <span className="text-muted-foreground italic">Компанийн бүртгэлд оруулаагүй байна</span>}
                            </p>
                        </div>

                        {/* Mission */}
                        <div className="p-4 bg-emerald-50/50 dark:bg-emerald-950/20 rounded-lg border border-emerald-100 dark:border-emerald-900/30">
                            <div className="flex items-center gap-2 mb-2">
                                <Target className="h-4 w-4 text-emerald-500" />
                                <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">Эрхэм зорилго (Mission)</p>
                            </div>
                            <p className="text-sm">
                                {companyProfile?.mission || <span className="text-muted-foreground italic">Компанийн бүртгэлд оруулаагүй байна</span>}
                            </p>
                        </div>
                    </div>

                    {/* Core Values */}
                    {coreValues.length > 0 && (
                        <div>
                            <div className="flex items-center gap-2 mb-3">
                                <Sparkles className="h-4 w-4 text-amber-500" />
                                <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wide">
                                    Үнэт зүйлс (Values)
                                </p>
                            </div>
                            <div className="flex gap-2 flex-wrap">
                                {coreValues.map(v => (
                                    <Badge
                                        key={v.id}
                                        variant="outline"
                                        className="text-xs py-1 px-3"
                                        style={v.color ? { borderColor: v.color, color: v.color } : undefined}
                                    >
                                        {v.emoji && <span className="mr-1">{v.emoji}</span>}
                                        {v.title}
                                    </Badge>
                                ))}
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* ── Жилийн бизнес төлөвлөгөө ── */}
            {!currentPlan ? (
                <Card className="border-dashed">
                    <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                        <p className="text-muted-foreground mb-1">Одоогоор бизнес төлөвлөгөө үүсгээгүй байна</p>
                        <p className="text-xs text-muted-foreground mb-4">Байгууллагын хэмжээнд жилд нэг бизнес төлөвлөгөө үүсгэнэ</p>
                        <Button onClick={() => { setEditingPlan(null); setIsPlanDialogOpen(true); }} className="gap-2">
                            <Plus className="h-4 w-4" />{currentYear} оны төлөвлөгөө үүсгэх
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle className="text-base">{currentPlan.title}</CardTitle>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    {currentPlan.fiscalYear} он • {currentPlan.startDate} — {currentPlan.endDate}
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                <Badge className={cn(PLAN_STATUS_COLORS[currentPlan.status])}>
                                    {PLAN_STATUS_LABELS[currentPlan.status]}
                                </Badge>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => { setEditingPlan(currentPlan); setIsPlanDialogOpen(true); }}
                                >
                                    <Pencil className="h-3.5 w-3.5" />
                                </Button>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {/* Weight warning */}
                        {planThemes.length > 0 && !isWeightValid && (
                            <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-sm">
                                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                                <span>Жингийн нийлбэр {totalWeight}% байна. 100% байх ёстой.</span>
                            </div>
                        )}

                        {/* Strategic Themes */}
                        <div>
                            <div className="flex items-center justify-between mb-3">
                                <h4 className="text-sm font-medium">Стратегийн чиглэлүүд</h4>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="gap-1.5 h-8"
                                    onClick={() => { setEditingTheme(null); setIsThemeDialogOpen(true); }}
                                >
                                    <Plus className="h-3.5 w-3.5" />Чиглэл нэмэх
                                </Button>
                            </div>

                            {planThemes.length === 0 ? (
                                <p className="text-sm text-muted-foreground text-center py-6">
                                    Стратегийн чиглэл нэмэгдээгүй
                                </p>
                            ) : (
                                <div className="space-y-2">
                                    {planThemes.map(theme => (
                                        <div
                                            key={theme.id}
                                            className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div
                                                    className="w-3 h-3 rounded-full flex-shrink-0"
                                                    style={{ backgroundColor: theme.color }}
                                                />
                                                <div>
                                                    <p className="text-sm font-medium">{theme.title}</p>
                                                    {theme.description && (
                                                        <p className="text-xs text-muted-foreground truncate max-w-[300px]">
                                                            {theme.description}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <Badge variant="outline" className="text-xs">
                                                    {theme.weight}%
                                                </Badge>
                                                {theme.ownerName && (
                                                    <span className="text-xs text-muted-foreground">
                                                        {theme.ownerName}
                                                    </span>
                                                )}
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-7 w-7"
                                                    onClick={() => { setEditingTheme(theme); setIsThemeDialogOpen(true); }}
                                                >
                                                    <Pencil className="h-3 w-3" />
                                                </Button>
                                            </div>
                                        </div>
                                    ))}

                                    {/* Weight bar */}
                                    <div className="flex h-3 rounded-full overflow-hidden bg-muted mt-2">
                                        {planThemes.map(t => (
                                            <div
                                                key={t.id}
                                                className="transition-all"
                                                style={{ width: `${t.weight}%`, backgroundColor: t.color }}
                                                title={`${t.title}: ${t.weight}%`}
                                            />
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Other years */}
                        {plans.length > 1 && (
                            <div className="pt-4 border-t">
                                <p className="text-xs font-medium text-muted-foreground mb-2">Бусад жилийн төлөвлөгөөнүүд</p>
                                <div className="flex gap-2 flex-wrap">
                                    {plans.filter(p => p.id !== currentPlan.id).map(p => (
                                        <Badge
                                            key={p.id}
                                            variant="outline"
                                            className="text-xs cursor-pointer hover:bg-muted"
                                        >
                                            {p.fiscalYear} — {PLAN_STATUS_LABELS[p.status]}
                                        </Badge>
                                    ))}
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* Dialogs */}
            <CreatePlanDialog
                open={isPlanDialogOpen}
                onOpenChange={setIsPlanDialogOpen}
                onSubmit={editingPlan ? handleUpdatePlan : handleCreatePlan}
                editingPlan={editingPlan}
                existingYears={existingYears}
            />
            <CreateThemeDialog
                open={isThemeDialogOpen}
                onOpenChange={setIsThemeDialogOpen}
                onSubmit={editingTheme ? handleUpdateTheme : handleCreateTheme}
                editingTheme={editingTheme}
                employees={employees}
            />
        </div>
    );
}
