// src/app/dashboard/skills/components/skill-levels.tsx
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { doc } from 'firebase/firestore';
import { useFirebase, useDoc, setDocumentNonBlocking, useTenantWrite } from '@/firebase';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Save, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { SKILL_LEVEL_LABELS } from '../types';
import type { SkillLevel } from '../types';

// Level keys including "unassessed"
const LEVEL_KEYS = ['beginner', 'intermediate', 'advanced', 'expert', 'unassessed'] as const;
type LevelKey = (typeof LEVEL_KEYS)[number];

interface LevelDefinition {
    label: string;
    shortLabel: string;
    description: string;
}

type LevelDefinitions = Record<LevelKey, LevelDefinition>;

const LEVEL_VISUAL: Record<LevelKey, { color: string; badge: string; short: string }> = {
    beginner: { color: 'bg-slate-300 text-slate-700', badge: 'border-slate-300', short: 'B' },
    intermediate: { color: 'bg-blue-500 text-white', badge: 'border-blue-500', short: 'I' },
    advanced: { color: 'bg-emerald-500 text-white', badge: 'border-emerald-500', short: 'A' },
    expert: { color: 'bg-purple-500 text-white', badge: 'border-purple-500', short: 'E' },
    unassessed: { color: 'bg-slate-100 text-slate-400 border border-dashed border-slate-300', badge: 'border-slate-300 border-dashed', short: '-' },
};

const DEFAULT_DEFINITIONS: LevelDefinitions = {
    beginner: {
        label: 'Анхан шат',
        shortLabel: 'B',
        description: '',
    },
    intermediate: {
        label: 'Дунд шат',
        shortLabel: 'I',
        description: '',
    },
    advanced: {
        label: 'Ахисан шат',
        shortLabel: 'A',
        description: '',
    },
    expert: {
        label: 'Мэргэжилтэн',
        shortLabel: 'E',
        description: '',
    },
    unassessed: {
        label: 'Үнэлэгдээгүй',
        shortLabel: '-',
        description: '',
    },
};

export function SkillLevels() {
    const { firestore } = useFirebase();
    const { tDoc } = useTenantWrite();
    const { toast } = useToast();

    const configRef = useMemo(() =>
        firestore ? doc(firestore, 'skill_level_definitions', 'config') : null,
        [firestore]
    );

    const { data: savedData, isLoading } = useDoc<{ levels: LevelDefinitions }>(configRef);

    const [definitions, setDefinitions] = useState<LevelDefinitions>(DEFAULT_DEFINITIONS);
    const [hasChanges, setHasChanges] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // Load saved data
    useEffect(() => {
        if (savedData?.levels) {
            const merged = { ...DEFAULT_DEFINITIONS };
            for (const key of LEVEL_KEYS) {
                if (savedData.levels[key]) {
                    merged[key] = {
                        ...DEFAULT_DEFINITIONS[key],
                        ...savedData.levels[key],
                    };
                }
            }
            setDefinitions(merged);
            setHasChanges(false);
        }
    }, [savedData]);

    const updateField = (key: LevelKey, field: keyof LevelDefinition, value: string) => {
        setDefinitions(prev => ({
            ...prev,
            [key]: { ...prev[key], [field]: value },
        }));
        setHasChanges(true);
    };

    const handleSave = () => {
        if (!firestore) return;
        setIsSaving(true);
        setDocumentNonBlocking(tDoc('skill_level_definitions', 'config'), {
            levels: definitions,
            updatedAt: new Date().toISOString(),
        }, { merge: true });

        setTimeout(() => {
            setIsSaving(false);
            setHasChanges(false);
            toast({ title: 'Амжилттай хадгалагдлаа' });
        }, 500);
    };

    const handleReset = () => {
        if (savedData?.levels) {
            const merged = { ...DEFAULT_DEFINITIONS };
            for (const key of LEVEL_KEYS) {
                if (savedData.levels[key]) {
                    merged[key] = { ...DEFAULT_DEFINITIONS[key], ...savedData.levels[key] };
                }
            }
            setDefinitions(merged);
        } else {
            setDefinitions(DEFAULT_DEFINITIONS);
        }
        setHasChanges(false);
    };

    if (isLoading) {
        return (
            <div className="space-y-4">
                {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-40 w-full" />
                ))}
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div className="space-y-1">
                    <h2 className="text-lg font-bold tracking-tight text-slate-800">Ур чадварын түвшин</h2>
                    <p className="text-sm text-muted-foreground max-w-2xl">
                        Түвшин бүрийн нэр, товчлол, тайлбар тодорхойлолтыг тохируулна. Энэ тодорхойлолтууд нь ур чадварын матриц, зөрүү шинжилгээнд ашиглагдана.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {hasChanges && (
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-10 rounded-xl gap-2"
                            onClick={handleReset}
                        >
                            <RotateCcw className="h-4 w-4" />
                            Буцаах
                        </Button>
                    )}
                    <Button
                        size="sm"
                        className="h-10 rounded-xl gap-2 px-5"
                        onClick={handleSave}
                        disabled={!hasChanges || isSaving}
                    >
                        <Save className="h-4 w-4" />
                        {isSaving ? 'Хадгалж байна...' : 'Хадгалах'}
                    </Button>
                </div>
            </div>

            <div className="space-y-4">
                {LEVEL_KEYS.map((key) => {
                    const visual = LEVEL_VISUAL[key];
                    const def = definitions[key];

                    return (
                        <Card key={key} className="overflow-hidden">
                            <CardContent className="p-0">
                                <div className="flex flex-col md:flex-row">
                                    {/* Visual indicator */}
                                    <div className={cn(
                                        'flex flex-col items-center justify-center p-6 md:w-[140px] md:min-h-[160px] border-b md:border-b-0 md:border-r',
                                        key === 'unassessed' ? 'bg-slate-50' : 'bg-slate-50'
                                    )}>
                                        <div className={cn(
                                            'w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold mb-2',
                                            visual.color
                                        )}>
                                            {def.shortLabel || visual.short}
                                        </div>
                                        <span className="text-xs text-muted-foreground font-medium text-center">
                                            {key === 'unassessed' ? 'Үнэлэгдээгүй' : `Түвшин ${LEVEL_KEYS.indexOf(key) + 1}`}
                                        </span>
                                    </div>

                                    {/* Editable fields */}
                                    <div className="flex-1 p-5 space-y-4">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <div className="space-y-1.5">
                                                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                                                    Нэр
                                                </label>
                                                <Input
                                                    value={def.label}
                                                    onChange={e => updateField(key, 'label', e.target.value)}
                                                    placeholder="Түвшний нэр"
                                                    className="h-10 rounded-xl"
                                                />
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                                                    Товчлол
                                                </label>
                                                <Input
                                                    value={def.shortLabel}
                                                    onChange={e => updateField(key, 'shortLabel', e.target.value)}
                                                    placeholder="B, I, A, E..."
                                                    maxLength={3}
                                                    className="h-10 rounded-xl w-24"
                                                />
                                            </div>
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                                                Тайлбар тодорхойлолт
                                            </label>
                                            <Textarea
                                                value={def.description}
                                                onChange={e => updateField(key, 'description', e.target.value)}
                                                placeholder="Энэ түвшний тодорхойлолт, шалгуур үзүүлэлтүүдийг бичнэ үү..."
                                                rows={3}
                                                className="rounded-xl resize-none"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>
        </div>
    );
}
