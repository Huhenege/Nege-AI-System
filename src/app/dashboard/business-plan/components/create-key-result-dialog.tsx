// src/app/dashboard/business-plan/components/create-key-result-dialog.tsx
'use client';

import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
    Form, FormField, FormItem, FormLabel, FormControl, FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Employee } from '@/types';
import {
    KeyResult,
    KeyResultFormValues,
    keyResultSchema,
    Objective,
    StrategyFramework,
    METRIC_TYPES,
    METRIC_TYPE_LABELS,
    OKR_STATUSES,
    OKR_STATUS_LABELS,
    KEY_RESULT_LABEL,
    OBJECTIVE_LABEL,
} from '../types';

interface CreateKeyResultDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSubmit: (values: KeyResultFormValues) => void;
    editingKeyResult?: KeyResult | null;
    objectives: Objective[];
    employees: Employee[];
    defaultObjectiveId?: string;
    framework?: StrategyFramework;
}

export function CreateKeyResultDialog({
    open, onOpenChange, onSubmit, editingKeyResult, objectives, employees, defaultObjectiveId, framework = 'okr',
}: CreateKeyResultDialogProps) {
    const form = useForm<KeyResultFormValues>({
        resolver: zodResolver(keyResultSchema),
        defaultValues: {
            objectiveId: defaultObjectiveId || '',
            title: '',
            metricType: 'number',
            startValue: 0,
            currentValue: 0,
            targetValue: 0,
            unit: '',
            ownerId: '',
            ownerName: '',
            status: 'not_started',
            dueDate: '',
        },
    });

    useEffect(() => {
        if (editingKeyResult) {
            form.reset({
                objectiveId: editingKeyResult.objectiveId,
                title: editingKeyResult.title,
                metricType: editingKeyResult.metricType,
                startValue: editingKeyResult.startValue,
                currentValue: editingKeyResult.currentValue,
                targetValue: editingKeyResult.targetValue,
                unit: editingKeyResult.unit,
                ownerId: editingKeyResult.ownerId,
                ownerName: editingKeyResult.ownerName,
                status: editingKeyResult.status,
                dueDate: editingKeyResult.dueDate,
            });
        } else {
            form.reset({
                objectiveId: defaultObjectiveId || '',
                title: '',
                metricType: 'number',
                startValue: 0,
                currentValue: 0,
                targetValue: 0,
                unit: '',
                ownerId: '',
                ownerName: '',
                status: 'not_started',
                dueDate: '',
            });
        }
    }, [editingKeyResult, open, form, defaultObjectiveId]);

    const handleOwnerChange = (empId: string) => {
        const emp = employees.find(e => e.id === empId);
        if (emp) {
            form.setValue('ownerId', empId);
            form.setValue('ownerName', `${emp.lastName?.charAt(0) || ''}. ${emp.firstName}`);
        }
    };

    const handleSubmit = (values: KeyResultFormValues) => {
        onSubmit(values);
        onOpenChange(false);
    };

    const metricType = form.watch('metricType');

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>
                        {editingKeyResult ? `${KEY_RESULT_LABEL[framework]} засах` : `Шинэ ${KEY_RESULT_LABEL[framework]}`}
                    </DialogTitle>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="objectiveId"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>{OBJECTIVE_LABEL[framework]}</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Зорилго сонгох" />
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
                                    <FormLabel>{KEY_RESULT_LABEL[framework]}</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Шинэ 50 харилцагч олж авах" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="metricType"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Хэмжүүрийн төрөл</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {METRIC_TYPES.map(t => (
                                                    <SelectItem key={t} value={t}>{METRIC_TYPE_LABELS[t]}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="unit"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Нэгж</FormLabel>
                                        <FormControl>
                                            <Input placeholder={metricType === 'currency' ? '₮' : metricType === 'percentage' ? '%' : 'ш'} {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        {metricType !== 'boolean' && (
                            <div className="grid grid-cols-3 gap-4">
                                <FormField
                                    control={form.control}
                                    name="startValue"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Эхлэлийн утга</FormLabel>
                                            <FormControl>
                                                <Input type="number" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="currentValue"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Одоогийн утга</FormLabel>
                                            <FormControl>
                                                <Input type="number" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="targetValue"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Зорилтот утга</FormLabel>
                                            <FormControl>
                                                <Input type="number" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="dueDate"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Хугацаа</FormLabel>
                                        <FormControl>
                                            <Input type="date" {...field} />
                                        </FormControl>
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
                                                    <SelectItem key={s} value={s}>{OKR_STATUS_LABELS[s]}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <FormField
                            control={form.control}
                            name="ownerId"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Хариуцагч</FormLabel>
                                    <Select onValueChange={handleOwnerChange} value={field.value}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Ажилтан сонгох" />
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

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                                Болих
                            </Button>
                            <Button type="submit">
                                {editingKeyResult ? 'Хадгалах' : 'Үүсгэх'}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
