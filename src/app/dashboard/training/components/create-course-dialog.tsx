// src/app/dashboard/training/components/create-course-dialog.tsx
'use client';

import React from 'react';
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
import { X } from 'lucide-react';
import {
    trainingCourseSchema,
    TrainingCourseFormValues,
    TrainingCourse,
    TrainingCategory,
    COURSE_TYPES,
    COURSE_TYPE_LABELS,
    SKILL_LEVELS,
    SKILL_LEVEL_LABELS,
    COURSE_STATUSES,
    COURSE_STATUS_LABELS,
    PROVIDER_TYPES,
    PROVIDER_TYPE_LABELS,
} from '../types';

interface SkillItem {
    id: string;
    name: string;
    category?: string;
}

interface CreateCourseDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSubmit: (values: TrainingCourseFormValues) => void;
    editingCourse?: TrainingCourse | null;
    skills: SkillItem[];
    categories: TrainingCategory[];
}

export function CreateCourseDialog({
    open,
    onOpenChange,
    onSubmit,
    editingCourse,
    skills,
    categories,
}: CreateCourseDialogProps) {
    const isEditing = !!editingCourse;

    const form = useForm<TrainingCourseFormValues>({
        resolver: zodResolver(trainingCourseSchema),
        defaultValues: {
            title: '',
            description: '',
            skillIds: [],
            targetLevel: 'beginner',
            duration: 1,
            type: 'classroom',
            providerType: 'internal',
            providerName: '',
            status: 'draft',
        },
    });

    // Reset form when dialog opens with editing data
    React.useEffect(() => {
        if (open) {
            if (editingCourse) {
                form.reset({
                    title: editingCourse.title,
                    description: editingCourse.description,
                    skillIds: editingCourse.skillIds,
                    targetLevel: editingCourse.targetLevel,
                    duration: editingCourse.duration,
                    type: editingCourse.type,
                    providerType: editingCourse.providerType,
                    providerName: editingCourse.providerName,
                    status: editingCourse.status,
                });
            } else {
                form.reset({
                    title: '',
                    description: '',
                    skillIds: [],
                    targetLevel: 'beginner',
                    duration: 1,
                    type: 'classroom',
                    providerType: 'internal',
                    providerName: '',
                    status: 'draft',
                });
            }
        }
    }, [open, editingCourse, form]);

    const selectedSkillIds = form.watch('skillIds');

    const handleSkillToggle = (skillId: string) => {
        const current = form.getValues('skillIds');
        if (current.includes(skillId)) {
            form.setValue('skillIds', current.filter(id => id !== skillId));
        } else {
            form.setValue('skillIds', [...current, skillId]);
        }
    };

    const handleSubmit = (values: TrainingCourseFormValues) => {
        onSubmit(values);
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[560px] max-h-[90vh] flex flex-col p-0 overflow-hidden">
                <DialogHeader className="px-6 pt-6 pb-2">
                    <DialogTitle>{isEditing ? 'Сургалт засах' : 'Шинэ сургалт үүсгэх'}</DialogTitle>
                    <DialogDescription>
                        {isEditing ? 'Сургалтын мэдээллийг шинэчилнэ үү.' : 'Сургалтын дэлгэрэнгүй мэдээллийг оруулна уу.'}
                    </DialogDescription>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(handleSubmit)} className="flex flex-col flex-1 overflow-hidden">
                        <div className="overflow-y-auto px-6 py-4 space-y-4 flex-1">
                            {/* Title */}
                            <FormField control={form.control} name="title" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Сургалтын нэр *</FormLabel>
                                    <FormControl><Input placeholder="Жишээ: React Advanced" {...field} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />

                            {/* Description */}
                            <FormField control={form.control} name="description" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Агуулага *</FormLabel>
                                    <FormControl><Textarea placeholder="Сургалтын зорилго, агуулга..." rows={3} {...field} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />

                            {/* Type (Хэлбэр) */}
                            <div className="grid grid-cols-2 gap-4">
                                <FormField control={form.control} name="type" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Хэлбэр *</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl>
                                                <SelectTrigger><SelectValue /></SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {COURSE_TYPES.map(t => (
                                                    <SelectItem key={t} value={t}>{COURSE_TYPE_LABELS[t]}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                            </div>

                            {/* Row: Target Level + Duration */}
                            <div className="grid grid-cols-2 gap-4">
                                <FormField control={form.control} name="targetLevel" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Зорилтот түвшин *</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl>
                                                <SelectTrigger><SelectValue /></SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {SKILL_LEVELS.map(level => (
                                                    <SelectItem key={level} value={level}>{SKILL_LEVEL_LABELS[level]}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )} />

                                <FormField control={form.control} name="duration" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Хугацаа (цаг) *</FormLabel>
                                        <FormControl><Input type="number" step="0.5" min="0.5" {...field} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                            </div>

                            {/* Provider type + name */}
                            <div className="grid grid-cols-2 gap-4">
                                <FormField control={form.control} name="providerType" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Зохион байгуулагч *</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl>
                                                <SelectTrigger><SelectValue placeholder="Төрөл сонгох" /></SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {PROVIDER_TYPES.map(pt => (
                                                    <SelectItem key={pt} value={pt}>{PROVIDER_TYPE_LABELS[pt]}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )} />

                                <FormField control={form.control} name="providerName" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Нэр *</FormLabel>
                                        <FormControl><Input placeholder="Багш/байгууллагын нэр" {...field} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                            </div>

                            {/* Status */}
                            <FormField control={form.control} name="status" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Төлөв</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {COURSE_STATUSES.map(s => (
                                                <SelectItem key={s} value={s}>{COURSE_STATUS_LABELS[s]}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )} />

                            {/* Skills */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Холбогдох ур чадварууд</label>
                                {skills.length === 0 ? (
                                    <p className="text-xs text-muted-foreground">
                                        Ур чадварын сан хоосон байна. Тохиргоо &gt; Ур чадвар хэсгээс нэмнэ үү.
                                    </p>
                                ) : (
                                    <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-2 border rounded-lg">
                                        {skills.map(skill => {
                                            const isSelected = selectedSkillIds.includes(skill.id);
                                            return (
                                                <Badge
                                                    key={skill.id}
                                                    variant={isSelected ? 'default' : 'outline'}
                                                    className="cursor-pointer select-none transition-colors"
                                                    onClick={() => handleSkillToggle(skill.id)}
                                                >
                                                    {skill.name}
                                                    {isSelected && <X className="ml-1 h-3 w-3" />}
                                                </Badge>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>

                        <DialogFooter className="px-6 py-4 border-t">
                            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                                Болих
                            </Button>
                            <Button type="submit">
                                {isEditing ? 'Хадгалах' : 'Үүсгэх'}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
