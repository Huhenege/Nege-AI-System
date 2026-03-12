// src/app/dashboard/business-plan/components/create-plan-dialog.tsx
'use client';

import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
    Form, FormField, FormItem, FormLabel, FormControl, FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Target, BarChart3, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
    BusinessPlan,
    BusinessPlanFormValues,
    businessPlanSchema,
    PLAN_STATUSES,
    PLAN_STATUS_LABELS,
    FRAMEWORKS,
    FRAMEWORK_LABELS,
    FRAMEWORK_DESCRIPTIONS,
    StrategyFramework,
} from '../types';

const FRAMEWORK_ICONS: Record<StrategyFramework, React.ReactNode> = {
    okr: <Target className="h-4 w-4" />,
    ogsm: <Layers className="h-4 w-4" />,
    bsc: <BarChart3 className="h-4 w-4" />,
};

interface CreatePlanDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSubmit: (values: BusinessPlanFormValues) => void;
    editingPlan?: BusinessPlan | null;
    existingYears: number[];
}

export function CreatePlanDialog({ open, onOpenChange, onSubmit, editingPlan, existingYears }: CreatePlanDialogProps) {
    const currentYear = new Date().getFullYear();

    const form = useForm<BusinessPlanFormValues>({
        resolver: zodResolver(businessPlanSchema),
        defaultValues: {
            title: `${currentYear} оны бизнес төлөвлөгөө`,
            fiscalYear: currentYear,
            framework: 'okr',
            status: 'draft',
            startDate: `${currentYear}-01-01`,
            endDate: `${currentYear}-12-31`,
        },
    });

    useEffect(() => {
        if (editingPlan) {
            form.reset({
                title: editingPlan.title,
                fiscalYear: editingPlan.fiscalYear,
                framework: editingPlan.framework || 'okr',
                status: editingPlan.status,
                startDate: editingPlan.startDate,
                endDate: editingPlan.endDate,
            });
        } else {
            form.reset({
                title: `${currentYear} оны бизнес төлөвлөгөө`,
                fiscalYear: currentYear,
                framework: 'okr',
                status: 'draft',
                startDate: `${currentYear}-01-01`,
                endDate: `${currentYear}-12-31`,
            });
        }
    }, [editingPlan, open, form, currentYear]);

    const fiscalYear = form.watch('fiscalYear');
    useEffect(() => {
        if (!editingPlan && fiscalYear) {
            form.setValue('title', `${fiscalYear} оны бизнес төлөвлөгөө`);
            form.setValue('startDate', `${fiscalYear}-01-01`);
            form.setValue('endDate', `${fiscalYear}-12-31`);
        }
    }, [fiscalYear, editingPlan, form]);

    const handleSubmit = (values: BusinessPlanFormValues) => {
        if (!editingPlan && existingYears.includes(values.fiscalYear)) {
            form.setError('fiscalYear', { message: `${values.fiscalYear} оны төлөвлөгөө аль хэдийн үүсгэсэн байна` });
            return;
        }
        onSubmit(values);
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>
                        {editingPlan ? 'Төлөвлөгөө засах' : 'Шинэ бизнес төлөвлөгөө'}
                    </DialogTitle>
                    <DialogDescription>
                        Байгууллагын жилийн нэг бизнес төлөвлөгөө. Алсын хараа, эрхэм зорилго, үнэт зүйлс нь компанийн бүртгэлээс автоматаар авна.
                    </DialogDescription>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                        {/* Framework selector */}
                        <FormField
                            control={form.control}
                            name="framework"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Стратегийн Framework</FormLabel>
                                    <FormControl>
                                        <RadioGroup
                                            value={field.value}
                                            onValueChange={field.onChange}
                                            className="grid gap-2"
                                        >
                                            {FRAMEWORKS.map(fw => (
                                                <Label
                                                    key={fw}
                                                    htmlFor={`fw-${fw}`}
                                                    className={cn(
                                                        'flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors',
                                                        field.value === fw
                                                            ? 'border-primary bg-primary/5 ring-1 ring-primary'
                                                            : 'border-border hover:bg-muted/50'
                                                    )}
                                                >
                                                    <RadioGroupItem value={fw} id={`fw-${fw}`} className="mt-0.5" />
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            {FRAMEWORK_ICONS[fw]}
                                                            <span className="text-sm font-medium">{FRAMEWORK_LABELS[fw]}</span>
                                                        </div>
                                                        <p className="text-xs text-muted-foreground mt-0.5">
                                                            {FRAMEWORK_DESCRIPTIONS[fw]}
                                                        </p>
                                                    </div>
                                                </Label>
                                            ))}
                                        </RadioGroup>
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="fiscalYear"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Санхүүгийн жил</FormLabel>
                                    <FormControl>
                                        <Input type="number" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="title"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Нэр</FormLabel>
                                    <FormControl>
                                        <Input {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="startDate"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Эхлэх огноо</FormLabel>
                                        <FormControl>
                                            <Input type="date" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="endDate"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Дуусах огноо</FormLabel>
                                        <FormControl>
                                            <Input type="date" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <FormField
                            control={form.control}
                            name="status"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Төлөв</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {PLAN_STATUSES.map(s => (
                                                <SelectItem key={s} value={s}>
                                                    {PLAN_STATUS_LABELS[s]}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                                Болих
                            </Button>
                            <Button type="submit">
                                {editingPlan ? 'Хадгалах' : 'Үүсгэх'}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
