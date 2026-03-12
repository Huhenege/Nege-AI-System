// src/app/dashboard/business-plan/components/create-objective-dialog.tsx
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
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { Employee } from '@/types';
import {
    Objective,
    ObjectiveFormValues,
    objectiveSchema,
    okrObjectiveSchema,
    StrategicTheme,
    StrategyFramework,
    QUARTERS,
    QUARTER_LABELS,
    OKR_STATUSES,
    OKR_STATUS_LABELS,
    THEME_LABEL,
    OBJECTIVE_LABEL,
    getCurrentQuarter,
} from '../types';

interface CreateObjectiveDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSubmit: (values: ObjectiveFormValues) => void;
    editingObjective?: Objective | null;
    themes: StrategicTheme[];
    employees: Employee[];
    defaultThemeId?: string;
    framework?: StrategyFramework;
}

export function CreateObjectiveDialog({
    open, onOpenChange, onSubmit, editingObjective, themes, employees, defaultThemeId, framework = 'okr',
}: CreateObjectiveDialogProps) {
    const currentYear = new Date().getFullYear();

    const showQuarter = framework === 'okr';

    const form = useForm<ObjectiveFormValues>({
        resolver: zodResolver(showQuarter ? okrObjectiveSchema : objectiveSchema),
        defaultValues: {
            themeId: defaultThemeId || '',
            title: '',
            description: '',
            quarter: getCurrentQuarter(),
            year: currentYear,
            ownerId: '',
            ownerName: '',
            status: 'not_started',
        },
    });

    useEffect(() => {
        if (editingObjective) {
            form.reset({
                themeId: editingObjective.themeId,
                title: editingObjective.title,
                description: editingObjective.description,
                quarter: editingObjective.quarter,
                year: editingObjective.year,
                ownerId: editingObjective.ownerId,
                ownerName: editingObjective.ownerName,
                status: editingObjective.status,
            });
        } else {
            form.reset({
                themeId: defaultThemeId || '',
                title: '',
                description: '',
                quarter: getCurrentQuarter(),
                year: currentYear,
                ownerId: '',
                ownerName: '',
                status: 'not_started',
            });
        }
    }, [editingObjective, open, form, currentYear, defaultThemeId]);

    const handleOwnerChange = (empId: string) => {
        const emp = employees.find(e => e.id === empId);
        if (emp) {
            form.setValue('ownerId', empId);
            form.setValue('ownerName', `${emp.lastName?.charAt(0) || ''}. ${emp.firstName}`);
        }
    };

    const handleSubmit = (values: ObjectiveFormValues) => {
        onSubmit(values);
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>
                        {editingObjective ? `${OBJECTIVE_LABEL[framework]} засах` : `Шинэ ${OBJECTIVE_LABEL[framework]}`}
                    </DialogTitle>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="themeId"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>{THEME_LABEL[framework]}</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Чиглэл сонгох" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {themes.map(t => (
                                                <SelectItem key={t.id} value={t.id}>
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: t.color }} />
                                                        {t.title}
                                                    </div>
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
                                    <FormLabel>{OBJECTIVE_LABEL[framework]}</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Борлуулалтыг 30%-аар нэмэгдүүлэх" {...field} />
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
                                        <Textarea placeholder="Зорилгын дэлгэрэнгүй..." rows={2} {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div className={cn('grid gap-4', showQuarter ? 'grid-cols-3' : 'grid-cols-2')}>
                            {showQuarter && (
                                <FormField
                                    control={form.control}
                                    name="quarter"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Улирал</FormLabel>
                                            <Select onValueChange={field.onChange} value={field.value}>
                                                <FormControl>
                                                    <SelectTrigger>
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    {QUARTERS.map(q => (
                                                        <SelectItem key={q} value={q}>{q}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            )}

                            <FormField
                                control={form.control}
                                name="year"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Жил</FormLabel>
                                        <FormControl>
                                            <Input type="number" {...field} />
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
                                {editingObjective ? 'Хадгалах' : 'Үүсгэх'}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
