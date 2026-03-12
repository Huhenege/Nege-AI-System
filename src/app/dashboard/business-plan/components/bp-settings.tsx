// src/app/dashboard/business-plan/components/bp-settings.tsx
'use client';

import React, { useState } from 'react';
import { useFirebase, updateDocumentNonBlocking, useTenantWrite } from '@/firebase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Target, BarChart3, Layers, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
    BusinessPlan,
    StrategyFramework,
    FRAMEWORKS,
    FRAMEWORK_LABELS,
    FRAMEWORK_DESCRIPTIONS,
    FRAMEWORK_SHORT_LABELS,
    RATINGS,
    RATING_LABELS,
    RATING_COLORS,
    OKR_STATUSES,
    OKR_STATUS_LABELS,
    OKR_STATUS_COLORS,
    RAG_STATUSES,
    RAG_STATUS_LABELS,
    RAG_STATUS_COLORS,
    PLAN_STATUSES,
    PLAN_STATUS_LABELS,
    PLAN_STATUS_COLORS,
    KPI_FREQUENCIES,
    KPI_FREQUENCY_LABELS,
    METRIC_TYPES,
    METRIC_TYPE_LABELS,
    REWARD_STATUSES,
    REWARD_STATUS_LABELS,
    REWARD_STATUS_COLORS,
    THEME_LABEL,
    OBJECTIVE_LABEL,
    KEY_RESULT_LABEL,
    getFrameworkScoreLabel,
} from '../types';

interface BpSettingsProps {
    activePlan?: BusinessPlan;
    framework?: StrategyFramework;
}

const FRAMEWORK_ICONS: Record<StrategyFramework, React.ReactNode> = {
    okr: <Target className="h-4 w-4" />,
    ogsm: <Layers className="h-4 w-4" />,
    bsc: <BarChart3 className="h-4 w-4" />,
};

export function BpSettings({ activePlan, framework = 'okr' }: BpSettingsProps) {
    const { firestore } = useFirebase();
    const { tDoc } = useTenantWrite();
    const { toast } = useToast();
    const [isSwitchDialogOpen, setIsSwitchDialogOpen] = useState(false);
    const [selectedFramework, setSelectedFramework] = useState<StrategyFramework>(framework);

    const handleSwitchFramework = () => {
        if (!firestore || !activePlan || selectedFramework === framework) return;
        updateDocumentNonBlocking(tDoc('bp_plans', activePlan.id), { framework: selectedFramework });
        toast({
            title: 'Framework солигдлоо',
            description: `${FRAMEWORK_SHORT_LABELS[selectedFramework]} руу шилжлээ. Одоо байгаа дата хэвээр хадгалагдана.`,
        });
        setIsSwitchDialogOpen(false);
    };

    const rollUpSteps = framework === 'ogsm'
        ? [
            { level: 1, label: 'Хэмжүүр (Measure)', desc: '(Одоогийн утга - Эхлэл) / (Зорилт - Эхлэл) x 100' },
            { level: 2, label: 'Стратеги (Strategy)', desc: 'Бүх Measure-уудын дундаж' },
            { level: 3, label: 'Зорилт (Goal)', desc: 'Бүх Strategy-уудын дундаж' },
            { level: 4, label: 'Зорилго (Objective)', desc: 'Бүх Goal-уудын дундаж' },
            { level: 5, label: 'Төлөвлөгөө (Plan)', desc: 'Objective-уудын жинлэсэн дундаж' },
          ]
        : framework === 'bsc'
        ? [
            { level: 1, label: 'Хэмжүүр (Measure)', desc: '(Одоогийн утга - Эхлэл) / (Зорилт - Эхлэл) x 100' },
            { level: 2, label: 'Стратегийн зорилго', desc: 'Бүх Measure-уудын дундаж' },
            { level: 3, label: 'Хэмжигдэхүүн (Perspective)', desc: 'Бүх Objective-уудын дундаж' },
            { level: 4, label: 'Төлөвлөгөө (Plan)', desc: 'Perspective-уудын жинлэсэн дундаж (жин% x прогресс)' },
          ]
        : [
            { level: 1, label: 'Гол үр дүн (Key Result)', desc: '(Одоогийн утга - Эхлэлийн утга) / (Зорилтот утга - Эхлэлийн утга) x 100' },
            { level: 2, label: 'Зорилго (Objective)', desc: 'Бүх Key Result-уудын прогрессийн дундаж' },
            { level: 3, label: 'Стратегийн чиглэл (Theme)', desc: 'Бүх Objective-уудын прогрессийн дундаж' },
            { level: 4, label: 'Төлөвлөгөө (Plan)', desc: 'Theme-уудын жинлэсэн дундаж (жин% x прогресс)' },
          ];

    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-semibold">Тохиргоо</h3>
                <p className="text-sm text-muted-foreground">
                    Бизнес төлөвлөлтийн системийн тохиргоо, үнэлгээний шкала, тайлбарууд
                </p>
            </div>

            {/* Current Framework */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                        {FRAMEWORK_ICONS[framework]}
                        Стратегийн Framework
                    </CardTitle>
                    <CardDescription>Одоогийн төлөвлөгөөнд ашиглаж буй стратегийн framework</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-primary/5 border border-primary/20 rounded-lg">
                        <div>
                            <p className="font-medium text-sm">{FRAMEWORK_LABELS[framework]}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{FRAMEWORK_DESCRIPTIONS[framework]}</p>
                        </div>
                        <Badge variant="outline" className="text-xs">{FRAMEWORK_SHORT_LABELS[framework]}</Badge>
                    </div>

                    {activePlan && (
                        <Button
                            variant="outline"
                            onClick={() => { setSelectedFramework(framework); setIsSwitchDialogOpen(true); }}
                        >
                            Framework солих
                        </Button>
                    )}
                </CardContent>
            </Card>

            {/* Rating scale */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Гүйцэтгэлийн үнэлгээний шкала</CardTitle>
                    <CardDescription>{getFrameworkScoreLabel(framework)} + KPI оноон дээр суурилсан автомат үнэлгээ</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="border rounded-lg overflow-hidden">
                        <table className="w-full text-sm">
                            <thead className="bg-muted/50">
                                <tr>
                                    <th className="text-left p-3 font-medium">Үнэлгээ</th>
                                    <th className="text-left p-3 font-medium">Тайлбар</th>
                                    <th className="text-left p-3 font-medium">Оноо</th>
                                </tr>
                            </thead>
                            <tbody>
                                {RATINGS.map(r => (
                                    <tr key={r} className="border-t">
                                        <td className="p-3">
                                            <Badge className={cn(RATING_COLORS[r])}>{r}</Badge>
                                        </td>
                                        <td className="p-3">{RATING_LABELS[r]}</td>
                                        <td className="p-3 text-muted-foreground">
                                            {r === 'A+' && '95 — 100'}
                                            {r === 'A' && '85 — 94'}
                                            {r === 'B+' && '75 — 84'}
                                            {r === 'B' && '65 — 74'}
                                            {r === 'C+' && '55 — 64'}
                                            {r === 'C' && '45 — 54'}
                                            {r === 'D' && '0 — 44'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>

            {/* Performance weights */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Гүйцэтгэлийн жингийн тооцоо</CardTitle>
                    <CardDescription>Ажилтан бүрийн нийт оноог тооцох томъёо</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="p-4 bg-muted/30 rounded-lg space-y-3">
                        <div className="font-mono text-sm">
                            <span className="text-muted-foreground">Нийт оноо = </span>
                            <span className="text-blue-600">({getFrameworkScoreLabel(framework)} x жин%)</span>
                            <span className="text-muted-foreground"> + </span>
                            <span className="text-amber-600">(KPI оноо x KPI жин%)</span>
                            <span className="text-muted-foreground"> / 100</span>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Progress roll-up logic */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Прогресс тооцоолол (Roll-up) — {FRAMEWORK_SHORT_LABELS[framework]}</CardTitle>
                    <CardDescription>Доороос дээш автоматаар нэгтгэгдэх систем</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-3 text-sm">
                        {rollUpSteps.map(step => (
                            <div key={step.level} className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg">
                                <div className="w-6 h-6 rounded bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
                                    {step.level}
                                </div>
                                <div>
                                    <p className="font-medium">{step.label}</p>
                                    <p className="text-muted-foreground text-xs">{step.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            {/* KPI RAG Status */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">KPI RAG статус</CardTitle>
                    <CardDescription>KPI хэмжүүрүүдийн автомат өнгөт ангилал</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-3">
                        {RAG_STATUSES.map(r => (
                            <div key={r} className="flex items-center gap-3">
                                <Badge className={cn(RAG_STATUS_COLORS[r], 'min-w-[100px] justify-center')}>
                                    {RAG_STATUS_LABELS[r]}
                                </Badge>
                                <span className="text-sm text-muted-foreground">
                                    {r === 'green' && 'Зорилтын 90%-аас дээш биелэлт'}
                                    {r === 'amber' && 'Зорилтын 70% — 89% биелэлт'}
                                    {r === 'red' && 'Зорилтын 70%-аас доош биелэлт'}
                                </span>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            {/* Reference info */}
            <div className="grid gap-4 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Хэмжүүрийн төрлүүд</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2">
                            {METRIC_TYPES.map(t => (
                                <div key={t} className="flex items-center gap-2 text-sm">
                                    <Badge variant="outline" className="text-xs">{t}</Badge>
                                    <span>{METRIC_TYPE_LABELS[t]}</span>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">KPI давтамж</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2">
                            {KPI_FREQUENCIES.map(f => (
                                <div key={f} className="flex items-center gap-2 text-sm">
                                    <Badge variant="outline" className="text-xs">{f}</Badge>
                                    <span>{KPI_FREQUENCY_LABELS[f]}</span>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Framework Switch Dialog */}
            <Dialog open={isSwitchDialogOpen} onOpenChange={setIsSwitchDialogOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Framework солих</DialogTitle>
                        <DialogDescription>
                            Одоо байгаа бүх дата хэвээр хадгалагдана. Зөвхөн UI харагдах байдал болон tab-ууд өөрчлөгдөнө.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-sm">
                        <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                        <span>Framework солиход таб-ууд шинэ framework-ийн бүтцэд тохируулан өөрчлөгдөнө.</span>
                    </div>

                    <RadioGroup
                        value={selectedFramework}
                        onValueChange={(v) => setSelectedFramework(v as StrategyFramework)}
                        className="space-y-2"
                    >
                        {FRAMEWORKS.map(fw => (
                            <Label
                                key={fw}
                                htmlFor={`switch-${fw}`}
                                className={cn(
                                    'flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors',
                                    selectedFramework === fw
                                        ? 'border-primary bg-primary/5 ring-1 ring-primary'
                                        : 'border-border hover:bg-muted/50',
                                    fw === framework && 'opacity-60'
                                )}
                            >
                                <RadioGroupItem value={fw} id={`switch-${fw}`} className="mt-0.5" />
                                <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                        {FRAMEWORK_ICONS[fw]}
                                        <span className="text-sm font-medium">
                                            {FRAMEWORK_LABELS[fw]}
                                            {fw === framework && ' (одоогийн)'}
                                        </span>
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-0.5">{FRAMEWORK_DESCRIPTIONS[fw]}</p>
                                </div>
                            </Label>
                        ))}
                    </RadioGroup>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsSwitchDialogOpen(false)}>
                            Болих
                        </Button>
                        <Button
                            onClick={handleSwitchFramework}
                            disabled={selectedFramework === framework}
                        >
                            {FRAMEWORK_SHORT_LABELS[selectedFramework]} руу солих
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
