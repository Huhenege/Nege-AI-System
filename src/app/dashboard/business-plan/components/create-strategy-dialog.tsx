// src/app/dashboard/business-plan/components/create-strategy-dialog.tsx
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
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Employee } from '@/types';
import {
    Strategy,
    StrategyFormValues,
    strategySchema,
    StrategyType,
    Objective,
    OKR_STATUSES,
    OKR_STATUS_LABELS,
} from '../types';

interface CreateStrategyDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSubmit: (values: StrategyFormValues) => void;
    editingStrategy?: Strategy | null;
    objectives: Objective[];
    employees: Employee[];
    type: StrategyType;
    defaultParentId?: string;
}

const TYPE_LABELS: Record<StrategyType, { title: string; noun: string; parentLabel: string }> = {
    ogsm_strategy: {
        title: 'Стратеги',
        noun: 'стратеги',
        parentLabel: 'Зорилт (Goal)',
    },
    bsc_initiative: {
        title: 'Санаачилга',
        noun: 'санаачилга',
        parentLabel: 'Стратегийн зорилго',
    },
};

export function CreateStrategyDialog({
    open, onOpenChange, onSubmit, editingStrategy, objectives, employees, type, defaultParentId,
}: CreateStrategyDialogProps) {
    const labels = TYPE_LABELS[type];

    const form = useForm<StrategyFormValues>({
        resolver: zodResolver(strategySchema),
        defaultValues: {
            parentId: defaultParentId || '',
            type,
            title: '',
            description: '',
            ownerId: '',
            ownerName: '',
            status: 'not_started',
            startDate: '',
            endDate: '',
            budget: undefined,
        },
    });

    useEffect(() => {
        if (editingStrategy) {
            form.reset({
                parentId: editingStrategy.parentId,
                type: editingStrategy.type,
                title: editingStrategy.title,
                description: editingStrategy.description,
                ownerId: editingStrategy.ownerId,
                ownerName: editingStrategy.ownerName,
                status: editingStrategy.status,
                startDate: editingStrategy.startDate,
                endDate: editingStrategy.endDate,
                budget: editingStrategy.budget,
            });
        } else {
            form.reset({
                parentId: defaultParentId || '',
                type,
                title: '',
                description: '',
                ownerId: '',
                ownerName: '',
                status: 'not_started',
                startDate: '',
                endDate: '',
                budget: undefined,
            });
        }
    }, [editingStrategy, open, form, type, defaultParentId]);

    const handleSubmit = (values: StrategyFormValues) => {
        const emp = employees.find(e => e.id === values.ownerId);
        if (emp) {
            values.ownerName = `${emp.lastName?.charAt(0) || ''}. ${emp.firstName}`;
        }
        onSubmit({ ...values, type });
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>
                        {editingStrategy ? `${labels.title} засах` : `Шинэ ${labels.noun}`}
                    </DialogTitle>
                    <DialogDescription>
                        {type === 'ogsm_strategy'
                            ? 'Зорилтыг хэрэгжүүлэх стратеги, арга хэмжээ'
                            : 'Стратегийн зорилгыг хэрэгжүүлэх санаачилга, төсөл'}
                    </DialogDescription>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="parentId"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>{labels.parentLabel}</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Сонгох..." />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {objectives.map(o => (
                                                <SelectItem key={o.id} value={o.id}>
                                                    {o.title}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
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
                                        <Input placeholder={`${labels.title}ийн нэр...`} {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="description"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Тайлбар</FormLabel>
                                    <FormControl>
                                        <Textarea rows={2} {...field} />
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

                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="ownerId"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Хариуцагч</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Сонгох..." />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {employees.map(e => (
                                                    <SelectItem key={e.id} value={e.id}>
                                                        {e.lastName?.charAt(0)}. {e.firstName}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

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
                                                {OKR_STATUSES.map(s => (
                                                    <SelectItem key={s} value={s}>
                                                        {OKR_STATUS_LABELS[s]}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        {type === 'bsc_initiative' && (
                            <FormField
                                control={form.control}
                                name="budget"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Төсөв (₮)</FormLabel>
                                        <FormControl>
                                            <Input type="number" placeholder="0" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        )}

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                                Болих
                            </Button>
                            <Button type="submit">
                                {editingStrategy ? 'Хадгалах' : 'Үүсгэх'}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
