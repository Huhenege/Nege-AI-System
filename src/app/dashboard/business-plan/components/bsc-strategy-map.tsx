// src/app/dashboard/business-plan/components/bsc-strategy-map.tsx
'use client';

import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Map } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
    BusinessPlan,
    StrategicTheme,
    Objective,
    KeyResult,
    BSC_PERSPECTIVE_LABELS,
    BSC_PERSPECTIVE_TYPES,
    BscPerspectiveType,
    OKR_STATUS_COLORS,
    OKR_STATUS_LABELS,
    computeObjectiveProgress,
} from '../types';

interface BscStrategyMapProps {
    activePlan?: BusinessPlan;
    themes: StrategicTheme[];
    objectives: Objective[];
    keyResults: KeyResult[];
    isLoading: boolean;
}

export function BscStrategyMap({
    activePlan, themes, objectives, keyResults, isLoading,
}: BscStrategyMapProps) {

    const perspectiveOrder: BscPerspectiveType[] = [
        'financial', 'customer', 'internal_process', 'learning_growth',
    ];

    const sortedPerspectives = useMemo(() => {
        return perspectiveOrder
            .map(pType => themes.find(t => t.perspectiveType === pType))
            .filter(Boolean) as StrategicTheme[];
    }, [themes]);

    const objectivesWithProgress = useMemo(() => {
        return objectives.map(obj => {
            const objKrs = keyResults.filter(kr => kr.objectiveId === obj.id);
            const progress = computeObjectiveProgress(objKrs);
            return { ...obj, progress };
        });
    }, [objectives, keyResults]);

    if (!activePlan) {
        return (
            <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                    <Map className="h-12 w-12 text-muted-foreground/50 mb-4" />
                    <h3 className="text-lg font-semibold mb-2">Идэвхтэй төлөвлөгөө байхгүй</h3>
                    <p className="text-sm text-muted-foreground">Эхлээд бизнес төлөвлөгөө үүсгэнэ үү.</p>
                </CardContent>
            </Card>
        );
    }

    if (isLoading) {
        return <div className="space-y-4">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>;
    }

    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-semibold">Стратегийн газрын зураг</h3>
                <p className="text-sm text-muted-foreground">
                    {activePlan.title} — 4 хэмжигдэхүүнээр стратегийн зорилгууд
                </p>
            </div>

            <div className="space-y-1">
                {sortedPerspectives.map((persp, idx) => {
                    const perspObjs = objectivesWithProgress.filter(o => o.themeId === persp.id);
                    const perspLabel = persp.perspectiveType
                        ? BSC_PERSPECTIVE_LABELS[persp.perspectiveType]
                        : persp.title;

                    return (
                        <div key={persp.id} className="relative">
                            {/* Perspective row */}
                            <div
                                className="flex items-stretch gap-4 rounded-lg border p-4"
                                style={{ borderLeftWidth: '4px', borderLeftColor: persp.color }}
                            >
                                {/* Label */}
                                <div className="w-40 flex-shrink-0 flex flex-col justify-center">
                                    <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: persp.color }}>
                                        {perspLabel}
                                    </p>
                                    <p className="text-[10px] text-muted-foreground">{persp.weight}% жин</p>
                                </div>

                                {/* Objectives */}
                                <div className="flex-1 flex gap-3 flex-wrap min-h-[60px] items-center">
                                    {perspObjs.length === 0 ? (
                                        <span className="text-xs text-muted-foreground italic">
                                            Зорилго нэмэгдээгүй
                                        </span>
                                    ) : (
                                        perspObjs.map(obj => (
                                            <div
                                                key={obj.id}
                                                className="bg-background border rounded-lg p-3 min-w-[160px] max-w-[220px] shadow-sm"
                                            >
                                                <p className="text-xs font-medium mb-1.5 line-clamp-2">{obj.title}</p>
                                                <div className="flex items-center gap-2">
                                                    <Progress value={obj.progress} className="h-1 flex-1" />
                                                    <span className="text-[10px] font-medium">{obj.progress}%</span>
                                                </div>
                                                <div className="mt-1">
                                                    <Badge className={cn('text-[9px] px-1 py-0', OKR_STATUS_COLORS[obj.status])}>
                                                        {OKR_STATUS_LABELS[obj.status]}
                                                    </Badge>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>

                            {/* Arrow between perspectives */}
                            {idx < sortedPerspectives.length - 1 && (
                                <div className="flex justify-center py-0.5">
                                    <div className="w-px h-4 bg-border" />
                                    <svg className="absolute" width="12" height="8" style={{ marginTop: '-2px' }}>
                                        <polygon points="6,8 0,0 12,0" fill="currentColor" className="text-border" />
                                    </svg>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Legend */}
            <Card>
                <CardContent className="pt-4">
                    <p className="text-xs text-muted-foreground mb-2 font-medium">Тайлбар</p>
                    <div className="flex gap-4 flex-wrap text-xs">
                        {perspectiveOrder.map(pType => (
                            <div key={pType} className="flex items-center gap-1.5">
                                <div
                                    className="w-3 h-3 rounded-sm"
                                    style={{ backgroundColor: themes.find(t => t.perspectiveType === pType)?.color || '#ccc' }}
                                />
                                <span>{BSC_PERSPECTIVE_LABELS[pType]}</span>
                            </div>
                        ))}
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-2">
                        Доороос дээш шалтгаан-үр дагаврын каскад: Суралцахуй → Дотоод процесс → Хэрэглэгч → Санхүүгийн
                    </p>
                </CardContent>
            </Card>
        </div>
    );
}
