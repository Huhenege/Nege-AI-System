// src/app/dashboard/widgets/add-widget-dialog.tsx
'use client';

import React from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, RotateCcw, Sparkles, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { WidgetId, WIDGET_CATALOG, getAllWidgetIds, getWidgetsByCategory, WidgetConfig } from './catalog';
import { getPlanDefinition, type SaaSModule, type CompanyPlan } from '@/types/company';
import { usePricingPlans } from '@/hooks/use-pricing-plans';
import { useRouter } from 'next/navigation';
import { WidgetContent, WIDGET_GRADIENT, WIDGET_ICON_COLOR } from './widget-content';

interface AddWidgetDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    currentOrder: WidgetId[];
    hidden: WidgetId[];
    onAddWidget: (id: WidgetId) => void;
    isModuleEnabled?: (module: SaaSModule) => boolean;
    currentPlan?: CompanyPlan;
}

export function AddWidgetDialog({
    open,
    onOpenChange,
    currentOrder,
    hidden,
    onAddWidget,
    isModuleEnabled,
    currentPlan = 'free',
}: AddWidgetDialogProps) {
    const router = useRouter();
    const { getPlanLabel } = usePricingPlans();

    const isLocked = (w: WidgetConfig): boolean => {
        if (!isModuleEnabled || !w.module) return false;
        return !isModuleEnabled(w.module);
    };

    // Get widgets that are not currently visible (and not locked)
    const hiddenWidgets = hidden
        .map(id => WIDGET_CATALOG[id])
        .filter((w): w is WidgetConfig => !!w && !isLocked(w));

    // Get KPI widgets that haven't been added yet (and not locked)
    const availableKpiWidgets = getWidgetsByCategory('kpi')
        .filter(w => !currentOrder.includes(w.id) && !hidden.includes(w.id) && !isLocked(w));

    // Get core widgets that haven't been added yet (and not locked)
    const availableCoreWidgets = getWidgetsByCategory('core')
        .filter(w => !currentOrder.includes(w.id) && !hidden.includes(w.id) && !isLocked(w));

    // Locked widgets (modules not enabled in current plan)
    const lockedWidgets = getAllWidgetIds()
        .map(id => WIDGET_CATALOG[id])
        .filter(w => isLocked(w));

    const handleAddWidget = (id: WidgetId) => {
        onAddWidget(id);
    };

    const hasHiddenWidgets = hiddenWidgets.length > 0;
    const hasAvailableKpi = availableKpiWidgets.length > 0;
    const hasAvailableCore = availableCoreWidgets.length > 0;
    const hasLockedWidgets = lockedWidgets.length > 0;
    const hasAnyWidgets = hasHiddenWidgets || hasAvailableKpi || hasAvailableCore || hasLockedWidgets;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-4xl p-0 gap-0 overflow-hidden bg-slate-950 border-slate-800 rounded-t-3xl sm:rounded-2xl max-h-[90vh]">
                {/* Header */}
                <DialogHeader className="px-6 pt-6 pb-4 border-b border-slate-800/50 bg-slate-900/50">
                    <div className="flex items-center gap-3">
                        <div className="h-11 w-11 rounded-xl bg-primary/20 flex items-center justify-center">
                            <Plus className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                            <DialogTitle className="text-lg font-semibold text-white">
                                Widget нэмэх
                            </DialogTitle>
                            <p className="text-sm text-slate-400 mt-0.5">
                                Нэмэхийг хүссэн widget дээрээ дарна уу
                            </p>
                        </div>
                    </div>
                </DialogHeader>

                {/* Content */}
                <ScrollArea className="flex-1 max-h-[70vh]">
                    <div className="p-6 space-y-8 bg-slate-50 dark:bg-slate-950">
                        {!hasAnyWidgets && (
                            <div className="text-center py-16">
                                <div className="h-20 w-20 rounded-2xl bg-slate-800 flex items-center justify-center mx-auto mb-4">
                                    <Sparkles className="h-10 w-10 text-slate-600" />
                                </div>
                                <p className="text-slate-300 font-semibold text-lg">Бүх widget нэмэгдсэн</p>
                                <p className="text-sm text-slate-500 mt-2">Та бүх widget-уудыг dashboard-д нэмсэн байна</p>
                            </div>
                        )}

                        {/* Hidden widgets section */}
                        {hasHiddenWidgets && (
                            <div className="space-y-4">
                                <div className="flex items-center gap-2 px-1">
                                    <RotateCcw className="h-4 w-4 text-amber-400" />
                                    <h3 className="text-sm font-semibold text-slate-300">Нуугдсан widget-ууд</h3>
                                    <Badge className="bg-amber-500/20 text-amber-400 border-0 text-[10px]">
                                        {hiddenWidgets.length}
                                    </Badge>
                                </div>
                                <div className="flex flex-wrap gap-4">
                                    {hiddenWidgets.map((widget, index) => (
                                        <WidgetRealPreview
                                            key={widget.id}
                                            widget={widget}
                                            onAdd={() => handleAddWidget(widget.id)}
                                            index={index}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Available KPI widgets */}
                        {hasAvailableKpi && (
                            <div className="space-y-4">
                                <div className="flex items-center gap-2 px-1">
                                    <Sparkles className="h-4 w-4 text-emerald-400" />
                                    <h3 className="text-sm font-semibold text-slate-300">Нэмэлт KPI үзүүлэлтүүд</h3>
                                    <Badge className="bg-emerald-500/20 text-emerald-400 border-0 text-[10px]">
                                        Шинэ
                                    </Badge>
                                </div>
                                <div className="flex flex-wrap gap-4">
                                    {availableKpiWidgets.map((widget, index) => (
                                        <WidgetRealPreview
                                            key={widget.id}
                                            widget={widget}
                                            onAdd={() => handleAddWidget(widget.id)}
                                            index={index}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Available core widgets */}
                        {hasAvailableCore && (
                            <div className="space-y-4">
                                <div className="flex items-center gap-2 px-1">
                                    <Plus className="h-4 w-4 text-blue-400" />
                                    <h3 className="text-sm font-semibold text-slate-300">Үндсэн widget-ууд</h3>
                                </div>
                                <div className="flex flex-wrap gap-4">
                                    {availableCoreWidgets.map((widget, index) => (
                                        <WidgetRealPreview
                                            key={widget.id}
                                            widget={widget}
                                            onAdd={() => handleAddWidget(widget.id)}
                                            index={index}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Locked widgets - need plan upgrade */}
                        {hasLockedWidgets && (
                            <div className="space-y-4">
                                <div className="flex items-center gap-2 px-1">
                                    <Lock className="h-4 w-4 text-slate-500" />
                                    <h3 className="text-sm font-semibold text-slate-400">Багц шинэчлэх шаардлагатай</h3>
                                    <Badge className="bg-slate-500/20 text-slate-400 border-0 text-[10px]">
                                        {lockedWidgets.length}
                                    </Badge>
                                </div>
                                <div className="flex flex-wrap gap-4">
                                    {lockedWidgets.map((widget, index) => (
                                        <LockedWidgetPreview
                                            key={widget.id}
                                            widget={widget}
                                            currentPlan={currentPlan}
                                            onUpgrade={() => {
                                                onOpenChange(false);
                                                router.push('/dashboard/billing');
                                            }}
                                            index={index}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </ScrollArea>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-slate-800/50 bg-slate-900/50">
                    <Button 
                        variant="outline" 
                        onClick={() => onOpenChange(false)}
                        className="w-full bg-slate-800 border-slate-700 text-white hover:bg-slate-700"
                    >
                        Хаах
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

interface LockedWidgetPreviewProps {
    widget: WidgetConfig;
    currentPlan: CompanyPlan;
    onUpgrade: () => void;
    index: number;
}

function LockedWidgetPreview({ widget, currentPlan, onUpgrade, index }: LockedWidgetPreviewProps) {
    const Icon = widget.icon;
    const { getPlanLabel } = usePricingPlans();

    const requiredPlan = widget.module
        ? (['starter', 'pro', 'enterprise'] as const).find((p) => {
            const def = getPlanDefinition(p);
            return def.modules.includes(widget.module!);
          })
        : undefined;

    return (
        <div
            className={cn(
                "relative group cursor-pointer",
                "animate-in fade-in slide-in-from-bottom-4"
            )}
            style={{ animationDelay: `${index * 75}ms`, animationFillMode: 'backwards' }}
            onClick={onUpgrade}
        >
            <Card
                className={cn(
                    "h-[140px] bg-slate-900 dark:bg-slate-800 border-slate-700/50",
                    "transition-all duration-300 group overflow-hidden",
                    "group-hover:opacity-90 group-hover:border-slate-600",
                    widget.size === 'compact' ? "w-[200px]" : "w-[280px]"
                )}
            >
                <CardContent className="p-4 h-full flex flex-col justify-between relative overflow-hidden">
                    <div className="flex items-center justify-between relative z-10">
                        <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                            {widget.label}
                        </div>
                        <Icon className="h-5 w-5 text-slate-600" />
                    </div>

                    <div className="relative z-10 space-y-2">
                        <div className="text-sm text-slate-300 font-medium">{widget.description}</div>
                        <div className="flex items-center gap-1.5">
                            <Lock className="h-3 w-3 text-amber-500/80" />
                            <span className="text-[10px] font-semibold text-amber-500/80 uppercase tracking-wide">
                                {requiredPlan ? getPlanLabel(requiredPlan) : 'Дээд багц'} багцаас
                            </span>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <div className={cn(
                "absolute inset-0 rounded-xl",
                "bg-primary/0 group-hover:bg-primary/10",
                "flex items-center justify-center",
                "opacity-0 group-hover:opacity-100",
                "transition-all duration-300"
            )}>
                <Button
                    size="sm"
                    variant="outline"
                    className={cn(
                        "shadow-xl scale-90 group-hover:scale-100 transition-transform",
                        "bg-slate-800 border-slate-600 text-white hover:bg-slate-700"
                    )}
                >
                    <Sparkles className="h-4 w-4 mr-1.5" />
                    Багц шинэчлэх
                </Button>
            </div>
        </div>
    );
}

interface WidgetRealPreviewProps {
    widget: WidgetConfig;
    onAdd: () => void;
    index: number;
}

/**
 * Dashboard-д харагддагтай яг ижил widget preview.
 * DashboardWidgetCard-ийн markup-г ашиглаж, data-г хоосон дамжуулна.
 * Hover-д "Нэмэх" overlay гарна.
 */
function WidgetRealPreview({ widget, onAdd, index }: WidgetRealPreviewProps) {
    const Icon = widget.icon;
    const isCompact = widget.size === 'compact';

    return (
        <div
            className={cn(
                'relative group cursor-pointer',
                'animate-in fade-in slide-in-from-bottom-4',
            )}
            style={{ animationDelay: `${index * 75}ms`, animationFillMode: 'backwards' }}
            onClick={onAdd}
        >
            {/* ── Card: DashboardWidgetCard-тай яг ижил markup ── */}
            <Card
                className={cn(
                    'bg-slate-900 dark:bg-slate-800 border-slate-700',
                    'transition-all duration-300 overflow-hidden',
                    'group-hover:scale-[1.03] group-hover:shadow-2xl group-hover:border-primary/50',
                    'h-[160px]',
                    isCompact ? 'w-[200px]' : 'w-[280px]',
                )}
            >
                <CardContent className="p-3 sm:p-4 h-full flex flex-col justify-between relative overflow-hidden">
                    {/* Gradient bg */}
                    {WIDGET_GRADIENT[widget.id] && (
                        <div className={cn(
                            'absolute -right-6 -bottom-6 w-28 h-28 rounded-full blur-3xl',
                            WIDGET_GRADIENT[widget.id],
                        )} />
                    )}

                    {/* Header */}
                    <div className="flex items-center justify-between mb-3 relative z-10">
                        <div className="text-[10px] sm:text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                            {widget.label}
                        </div>
                        <Icon className={cn('h-5 w-5 text-slate-500', WIDGET_ICON_COLOR[widget.id])} />
                    </div>

                    {/* Content — яг l ижил WidgetContent, data хоосон */}
                    <div className="relative z-10">
                        <WidgetContent id={widget.id} data={{}} />
                    </div>
                </CardContent>
            </Card>

            {/* Hover overlay */}
            <div className={cn(
                'absolute inset-0 rounded-xl',
                'bg-primary/0 group-hover:bg-primary/10',
                'flex items-center justify-center',
                'opacity-0 group-hover:opacity-100',
                'transition-all duration-300',
            )}>
                <Button
                    size="sm"
                    className="shadow-xl scale-90 group-hover:scale-100 transition-transform bg-primary hover:bg-primary/90"
                >
                    <Plus className="h-4 w-4 mr-1.5" />
                    Нэмэх
                </Button>
            </div>
        </div>
    );
}
