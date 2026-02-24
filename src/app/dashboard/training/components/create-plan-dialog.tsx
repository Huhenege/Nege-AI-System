// src/app/dashboard/training/components/create-plan-dialog.tsx
'use client';

import React, { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle,
    DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, X, Users, Calendar, Wallet } from 'lucide-react';
import {
    createPlanSchema,
    CreatePlanFormValues,
    TrainingCourse,
    TrainingPlan,
    PLAN_TRIGGERS,
    PLAN_TRIGGER_LABELS,
    PLAN_TYPES,
    PLAN_TYPE_LABELS,
    PLAN_FORMATS,
    PLAN_FORMAT_LABELS,
    ASSESSMENT_METHODS,
    ASSESSMENT_METHOD_LABELS,
} from '../types';
import { Employee } from '@/types';

interface CreatePlanDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSubmit: (values: CreatePlanFormValues, courseName: string) => void;
    onUpdate?: (planId: string, values: CreatePlanFormValues, courseName: string) => void;
    editingPlan?: TrainingPlan | null;
    employees: Employee[];
    courses: TrainingCourse[];
}

export function CreatePlanDialog({
    open,
    onOpenChange,
    onSubmit,
    onUpdate,
    editingPlan,
    employees,
    courses,
}: CreatePlanDialogProps) {
    const [employeeSearch, setEmployeeSearch] = useState('');

    const form = useForm<CreatePlanFormValues>({
        resolver: zodResolver(createPlanSchema),
        defaultValues: {
            courseId: '',
            scheduledAt: undefined,
            budget: undefined,
            participantIds: [],
            trigger: 'manual',
            notes: '',
            purpose: '',
            targetAudience: '',
            planType: undefined,
            owner: '',
            format: undefined,
            locationOrLink: '',
            assessmentMethod: undefined,
        },
    });

    React.useEffect(() => {
        if (open) {
            if (editingPlan) {
                const scheduledAt = editingPlan.scheduledAt ?? editingPlan.dueDate ?? editingPlan.assignedAt;
                form.reset({
                    courseId: editingPlan.courseId,
                    scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined,
                    budget: editingPlan.budget,
                    participantIds: editingPlan.participantIds ?? (editingPlan.employeeId ? [editingPlan.employeeId] : []),
                    trigger: editingPlan.trigger,
                    notes: editingPlan.notes ?? '',
                    purpose: editingPlan.purpose ?? '',
                    targetAudience: editingPlan.targetAudience ?? '',
                    planType: editingPlan.planType ?? undefined,
                    owner: editingPlan.owner ?? '',
                    format: editingPlan.format ?? undefined,
                    locationOrLink: editingPlan.locationOrLink ?? '',
                    assessmentMethod: editingPlan.assessmentMethod ?? undefined,
                });
            } else {
                form.reset({
                    courseId: '',
                    scheduledAt: undefined,
                    budget: undefined,
                    participantIds: [],
                    trigger: 'manual',
                    notes: '',
                    purpose: '',
                    targetAudience: '',
                    planType: undefined,
                    owner: '',
                    format: undefined,
                    locationOrLink: '',
                    assessmentMethod: undefined,
                });
            }
            setEmployeeSearch('');
        }
    }, [open, editingPlan, form]);

    const selectedIds = form.watch('participantIds');

    const filteredEmployees = useMemo(() => {
        if (!employeeSearch.trim()) return employees;
        const q = employeeSearch.toLowerCase();
        return employees.filter(emp =>
            emp.firstName?.toLowerCase().includes(q) ||
            emp.lastName?.toLowerCase().includes(q) ||
            emp.jobTitle?.toLowerCase().includes(q)
        );
    }, [employees, employeeSearch]);

    const activeCourses = useMemo(() => {
        const active = courses.filter(c => c.status === 'active');
        if (editingPlan) {
            const hasEditing = active.some(c => c.id === editingPlan.courseId);
            if (!hasEditing) {
                const current = courses.find(c => c.id === editingPlan.courseId);
                if (current) return [current, ...active];
            }
        }
        return active;
    }, [courses, editingPlan]);

    const toggleEmployee = (empId: string) => {
        const current = form.getValues('participantIds');
        if (current.includes(empId)) {
            form.setValue('participantIds', current.filter(id => id !== empId), { shouldValidate: true });
        } else {
            form.setValue('participantIds', [...current, empId], { shouldValidate: true });
        }
    };

    const toggleAll = () => {
        const visibleIds = filteredEmployees.map(e => e.id);
        const allSelected = visibleIds.every(id => selectedIds.includes(id));
        if (allSelected) {
            form.setValue('participantIds', selectedIds.filter(id => !visibleIds.includes(id)), { shouldValidate: true });
        } else {
            const merged = new Set([...selectedIds, ...visibleIds]);
            form.setValue('participantIds', Array.from(merged), { shouldValidate: true });
        }
    };

    const handleSubmit = (values: CreatePlanFormValues) => {
        const course = courses.find(c => c.id === values.courseId);
        if (!course) return;
        if (editingPlan && onUpdate) {
            onUpdate(editingPlan.id, values, course.title);
        } else {
            onSubmit(values, course.title);
        }
        onOpenChange(false);
    };

    const isEditMode = Boolean(editingPlan);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[560px] max-h-[90vh] flex flex-col p-0 overflow-hidden">
                <DialogHeader className="px-6 pt-6 pb-2">
                    <DialogTitle>{isEditMode ? 'Сургалтын төлөвлөгөө засах' : 'Сургалтын төлөвлөгөө үүсгэх'}</DialogTitle>
                    <DialogDescription>
                        {isEditMode
                            ? 'Төлөвлөгөөний мэдээллийг засна уу.'
                            : 'Сангаас сургалт сонгоод, хэзээ явуулах, төсөв, хэн суухыг тодорхойлж нэгдсэн төлөвлөгөө үүсгэнэ.'}
                    </DialogDescription>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(handleSubmit)} className="flex flex-col flex-1 overflow-hidden">
                        <div className="overflow-y-auto px-6 py-4 space-y-4 flex-1">
                            {/* Course from catalog */}
                            <FormField control={form.control} name="courseId" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Сургалт (сангаас) *</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl>
                                            <SelectTrigger><SelectValue placeholder="Сургалт сонгох" /></SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {activeCourses.map(course => (
                                                <SelectItem key={course.id} value={course.id}>
                                                    {course.title} ({course.duration} цаг)
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )} />

                            {/* When */}
                            <FormField control={form.control} name="scheduledAt" render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="flex items-center gap-2">
                                        <Calendar className="h-4 w-4" />
                                        Хэзээ явуулах *
                                    </FormLabel>
                                    <FormControl>
                                        <Input
                                            type="date"
                                            value={field.value ? new Date(field.value).toISOString().split('T')[0] : ''}
                                            onChange={(e) => field.onChange(e.target.value ? new Date(e.target.value) : undefined)}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />

                            {/* Budget */}
                            <FormField control={form.control} name="budget" render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="flex items-center gap-2">
                                        <Wallet className="h-4 w-4" />
                                        Төсөв (₮)
                                    </FormLabel>
                                    <FormControl>
                                        <Input
                                            type="number"
                                            min={0}
                                            placeholder="Заавал биш"
                                            value={field.value ?? ''}
                                            onChange={e => field.onChange(e.target.value === '' ? undefined : Number(e.target.value))}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />

                            {/* Зорилго */}
                            <FormField control={form.control} name="purpose" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Зорилго</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Жишээ: Харилцааг сайжруулах" {...field} value={field.value ?? ''} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />

                            {/* Хэнд (зорилтот аудитори) */}
                            <FormField control={form.control} name="targetAudience" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Хэнд</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Жишээ: Борлуулалтын баг, Үйлдвэр" {...field} value={field.value ?? ''} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />

                            {/* Төрөл */}
                            <FormField control={form.control} name="planType" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Төрөл</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value ?? ''}>
                                        <FormControl>
                                            <SelectTrigger><SelectValue placeholder="Сонгох" /></SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {PLAN_TYPES.map(t => (
                                                <SelectItem key={t} value={t}>{PLAN_TYPE_LABELS[t]}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )} />

                            {/* Хариуцсан эзэн */}
                            <FormField control={form.control} name="owner" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Хариуцсан эзэн</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Жишээ: HR / L&D, HSE manager" {...field} value={field.value ?? ''} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />

                            {/* Формат */}
                            <FormField control={form.control} name="format" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Формат</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value ?? ''}>
                                        <FormControl>
                                            <SelectTrigger><SelectValue placeholder="Сонгох" /></SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {PLAN_FORMATS.map(f => (
                                                <SelectItem key={f} value={f}>{PLAN_FORMAT_LABELS[f]}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )} />

                            {/* Байршил/линк */}
                            <FormField control={form.control} name="locationOrLink" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Байршил / холбоос</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Жишээ: Drive link, SOP" {...field} value={field.value ?? ''} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />

                            {/* Үнэлгээний арга */}
                            <FormField control={form.control} name="assessmentMethod" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Үнэлгээний арга</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value ?? ''}>
                                        <FormControl>
                                            <SelectTrigger><SelectValue placeholder="Сонгох" /></SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {ASSESSMENT_METHODS.map(m => (
                                                <SelectItem key={m} value={m}>{ASSESSMENT_METHOD_LABELS[m]}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )} />

                            {/* Participants */}
                            <FormField control={form.control} name="participantIds" render={() => (
                                <FormItem>
                                    <FormLabel className="flex items-center gap-2">
                                        <Users className="h-4 w-4" />
                                        Хэн суух (оролцогчид) *
                                        {selectedIds.length > 0 && (
                                            <Badge variant="secondary" className="text-xs">
                                                {selectedIds.length} сонгогдсон
                                            </Badge>
                                        )}
                                    </FormLabel>

                                    {selectedIds.length > 0 && (
                                        <div className="flex flex-wrap gap-1.5 pb-1">
                                            {selectedIds.map(id => {
                                                const emp = employees.find(e => e.id === id);
                                                if (!emp) return null;
                                                return (
                                                    <Badge
                                                        key={id}
                                                        variant="default"
                                                        className="text-xs cursor-pointer gap-1 pr-1"
                                                        onClick={() => toggleEmployee(id)}
                                                    >
                                                        {emp.lastName?.charAt(0)}. {emp.firstName}
                                                        <X className="h-3 w-3" />
                                                    </Badge>
                                                );
                                            })}
                                        </div>
                                    )}

                                    <div className="relative">
                                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                                        <Input
                                            placeholder="Ажилтан хайх..."
                                            className="pl-8 h-9 text-sm"
                                            value={employeeSearch}
                                            onChange={(e) => setEmployeeSearch(e.target.value)}
                                        />
                                    </div>

                                    <ScrollArea className="h-[140px] rounded-lg border">
                                        <div className="p-1">
                                            <label className="flex items-center gap-2.5 px-2 py-1.5 rounded hover:bg-muted/50 cursor-pointer border-b mb-1">
                                                <Checkbox
                                                    checked={
                                                        filteredEmployees.length > 0 &&
                                                        filteredEmployees.every(e => selectedIds.includes(e.id))
                                                    }
                                                    onCheckedChange={toggleAll}
                                                />
                                                <span className="text-xs font-medium text-muted-foreground">
                                                    Бүгдийг сонгох ({filteredEmployees.length})
                                                </span>
                                            </label>

                                            {filteredEmployees.map(emp => (
                                                <label
                                                    key={emp.id}
                                                    className="flex items-center gap-2.5 px-2 py-1.5 rounded hover:bg-muted/50 cursor-pointer"
                                                >
                                                    <Checkbox
                                                        checked={selectedIds.includes(emp.id)}
                                                        onCheckedChange={() => toggleEmployee(emp.id)}
                                                    />
                                                    <div className="flex-1 min-w-0">
                                                        <span className="text-sm">
                                                            {emp.lastName?.charAt(0)}. {emp.firstName}
                                                        </span>
                                                        <span className="text-xs text-muted-foreground ml-2">
                                                            {emp.jobTitle}
                                                        </span>
                                                    </div>
                                                </label>
                                            ))}

                                            {filteredEmployees.length === 0 && (
                                                <p className="text-xs text-muted-foreground text-center py-4">
                                                    Илэрц олдсонгүй
                                                </p>
                                            )}
                                        </div>
                                    </ScrollArea>
                                    <FormMessage />
                                </FormItem>
                            )} />

                            {/* Trigger */}
                            <FormField control={form.control} name="trigger" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Шалтгаан</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {PLAN_TRIGGERS.map(t => (
                                                <SelectItem key={t} value={t}>{PLAN_TRIGGER_LABELS[t]}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )} />

                            {/* Notes */}
                            <FormField control={form.control} name="notes" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Тэмдэглэл</FormLabel>
                                    <FormControl>
                                        <Textarea placeholder="Нэмэлт мэдээлэл..." rows={2} {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                        </div>

                        <DialogFooter className="px-6 py-4 border-t">
                            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                                Болих
                            </Button>
                            <Button type="submit">
                                {isEditMode ? 'Хадгалах' : 'Төлөвлөгөө үүсгэх'}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
