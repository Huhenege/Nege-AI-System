'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
    AppDialog,
    AppDialogContent,
    AppDialogHeader,
    AppDialogTitle,
    AppDialogDescription,
    AppDialogBody,
    AppDialogFooter,
} from '@/components/patterns';
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
    FormDescription,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { useFirebase, addDocumentNonBlocking } from '@/firebase';
import { collection } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import {
    createSurveySchema,
    CreateSurveyFormValues,
    SURVEY_TYPES,
    SURVEY_TYPE_LABELS,
    Survey,
} from '../types';

interface CreateSurveyDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function CreateSurveyDialog({ open, onOpenChange }: CreateSurveyDialogProps) {
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);

    const form = useForm<CreateSurveyFormValues>({
        resolver: zodResolver(createSurveySchema),
        defaultValues: {
            title: '',
            description: '',
            type: 'satisfaction',
            isAnonymous: true,
            targetAudience: 'all',
            targetIds: [],
            startDate: '',
            endDate: '',
            reminderEnabled: false,
        },
    });

    const onSubmit = async (data: CreateSurveyFormValues) => {
        if (!firestore) return;
        setIsLoading(true);

        try {
            const now = new Date().toISOString();
            const newSurvey: Omit<Survey, 'id'> = {
                title: data.title,
                description: data.description || '',
                type: data.type,
                status: 'draft',
                isAnonymous: data.isAnonymous,
                targetAudience: data.targetAudience,
                targetIds: data.targetIds,
                startDate: data.startDate || '',
                endDate: data.endDate || '',
                reminderEnabled: data.reminderEnabled,
                questionsCount: 0,
                responsesCount: 0,
                createdBy: '',
                createdAt: now,
                updatedAt: now,
            };

            const docRef = await addDocumentNonBlocking(
                collection(firestore, 'surveys'),
                newSurvey
            );

            toast({ title: 'Санал асуулга үүсгэгдлээ' });
            form.reset();
            onOpenChange(false);

            if (docRef?.id) {
                router.push(`/dashboard/survey/${docRef.id}`);
            }
        } catch (error) {
            console.error('Failed to create survey:', error);
            toast({
                title: 'Алдаа гарлаа',
                description: 'Санал асуулга үүсгэхэд алдаа гарлаа.',
                variant: 'destructive',
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <AppDialog open={open} onOpenChange={onOpenChange}>
            <AppDialogContent size="lg">
                <AppDialogBody>
                    <AppDialogHeader className="mb-6">
                        <AppDialogTitle>Шинэ санал асуулга</AppDialogTitle>
                        <AppDialogDescription>
                            Санал асуулгын үндсэн мэдээллийг оруулна уу. Асуултуудыг дараа нь нэмэх боломжтой.
                        </AppDialogDescription>
                    </AppDialogHeader>

                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                            <FormField
                                control={form.control}
                                name="title"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Гарчиг</FormLabel>
                                        <FormControl>
                                            <Input placeholder="Жнь: 2026 оны сэтгэл ханамжийн судалгаа" {...field} />
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
                                            <Textarea
                                                placeholder="Санал асуулгын зорилго, тайлбар..."
                                                rows={3}
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <div className="grid grid-cols-2 gap-4">
                                <FormField
                                    control={form.control}
                                    name="type"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Төрөл</FormLabel>
                                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                <FormControl>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Төрөл сонгох" />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    {SURVEY_TYPES.map(type => (
                                                        <SelectItem key={type} value={type}>
                                                            {SURVEY_TYPE_LABELS[type]}
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
                                    name="isAnonymous"
                                    render={({ field }) => (
                                        <FormItem className="flex flex-col justify-end">
                                            <div className="flex items-center gap-2 h-10">
                                                <FormControl>
                                                    <Checkbox
                                                        checked={field.value}
                                                        onCheckedChange={field.onChange}
                                                    />
                                                </FormControl>
                                                <FormLabel className="!mt-0 cursor-pointer">
                                                    Нэргүй (Anonymous)
                                                </FormLabel>
                                            </div>
                                            <FormDescription className="text-xs">
                                                Хариулагчийн мэдээлэл нуугдана
                                            </FormDescription>
                                        </FormItem>
                                    )}
                                />
                            </div>

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
                        </form>
                    </Form>
                </AppDialogBody>

                <AppDialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
                        Болих
                    </Button>
                    <Button onClick={form.handleSubmit(onSubmit)} disabled={isLoading}>
                        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Үүсгэх
                    </Button>
                </AppDialogFooter>
            </AppDialogContent>
        </AppDialog>
    );
}
