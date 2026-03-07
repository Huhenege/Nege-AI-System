'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
    AppDialog,
    AppDialogContent,
    AppDialogDescription,
    AppDialogFooter,
    AppDialogHeader,
    AppDialogTitle,
    AppDialogTrigger,
} from '@/components/patterns';
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Plus, Loader2 } from 'lucide-react';
import { useFirebase, addDocumentNonBlocking, useTenantWrite } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { Candidate, JobApplication, Vacancy } from '@/types/recruitment';

const SOURCE_OPTIONS = ['zangia.mn', 'linkedin', 'unegui.mn', 'Lambda', 'Nito', 'Worki', 'Бусад'] as const;

const candidateSchema = z.object({
    lastName: z.string().min(2, 'Овгоо оруулна уу'),
    firstName: z.string().min(2, 'Нэрээ оруулна уу'),
    phone: z.string().min(8, 'Утасны дугаараа оруулна уу'),
    email: z.union([z.literal(''), z.string().email('Имэйл хаяг буруу байна')]).optional(),
    linkedinUrl: z.string().optional(),
    portfolioUrl: z.string().optional(),
    source: z.string().optional(),
});

type CandidateFormValues = z.infer<typeof candidateSchema>;

export function AddCandidateDialog({
    vacancy,
    open: controlledOpen,
    onOpenChange: controlledOnOpenChange,
    onSuccess,
}: {
    vacancy?: Vacancy;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    onSuccess?: () => void;
}) {
    const [internalOpen, setInternalOpen] = useState(false);
    const open = controlledOpen ?? internalOpen;
    const setOpen = controlledOnOpenChange ?? setInternalOpen;
    const { firestore } = useFirebase();
    const { tCollection } = useTenantWrite();
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(false);

    const form = useForm<CandidateFormValues>({
        resolver: zodResolver(candidateSchema),
        defaultValues: {
            lastName: '',
            firstName: '',
            phone: '',
            email: '',
            linkedinUrl: '',
            portfolioUrl: '',
            source: '',
        },
    });

    const onSubmit = async (data: CandidateFormValues) => {
        if (!firestore) return;
        setIsLoading(true);

        try {
            const now = new Date().toISOString();

            // 1. Candidate бичлэг үүсгэх (Firestore does not accept undefined; use '' or omit)
            const linkedin = (data.linkedinUrl ?? '').trim();
            const portfolio = (data.portfolioUrl ?? '').trim();
            const sourceVal = (data.source ?? '').trim() || 'MANUAL';
            const newCandidate: Record<string, unknown> = {
                firstName: data.firstName,
                lastName: data.lastName,
                email: (data.email ?? '').trim() || '',
                phone: data.phone,
                linkedinUrl: linkedin || '',
                portfolioUrl: portfolio || '',
                source: sourceVal,
                createdAt: now,
                updatedAt: now,
            };

            const candidateRef = await addDocumentNonBlocking(tCollection('candidates'), newCandidate);

            // 2. Application бичлэг үүсгэх (employee үүсгэхгүй — зөвхөн ажилд авах үед үүснэ)
            if (vacancy && candidateRef) {
                const newApplication: Omit<JobApplication, 'id'> = {
                    vacancyId: vacancy.id,
                    candidateId: candidateRef.id,
                    currentStageId: vacancy.stages[0]?.id || 'screening',
                    status: 'ACTIVE',
                    appliedAt: now,
                    updatedAt: now,
                    candidate: { ...newCandidate, id: candidateRef.id },
                };

                await addDocumentNonBlocking(tCollection('applications'), newApplication);
            }

            toast({
                title: 'Амжилттай бүртгэгдлээ',
                description: `${data.lastName} ${data.firstName} горилогчоор бүртгэгдлээ.`,
            });
            setOpen(false);
            form.reset();
            onSuccess?.();
        } catch (error) {
            console.error(error);
            toast({
                title: 'Алдаа гарлаа',
                description: 'Хадгалж чадсангүй.',
                variant: 'destructive',
            });
        } finally {
            setIsLoading(false);
        }
    };

    if (!vacancy) return null;

    return (
        <AppDialog open={open} onOpenChange={setOpen}>
            {controlledOpen === undefined && (
                <AppDialogTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2">
                        <Plus className="h-4 w-4" />
                        Горилогч нэмэх
                    </Button>
                </AppDialogTrigger>
            )}
            <AppDialogContent size="md" className="p-0 overflow-hidden">
                <AppDialogHeader className="px-6 pt-6">
                    <AppDialogTitle>Шинэ горилогч бүртгэх</AppDialogTitle>
                    <AppDialogDescription>
                        "{vacancy.title}" ажлын байранд материал бүрдүүлэх.
                    </AppDialogDescription>
                </AppDialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 px-6 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="lastName"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Овог <span className="text-red-500">*</span></FormLabel>
                                        <FormControl>
                                            <Input {...field} placeholder="Овог" />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="firstName"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Нэр <span className="text-red-500">*</span></FormLabel>
                                        <FormControl>
                                            <Input {...field} placeholder="Нэр" />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <FormField
                            control={form.control}
                            name="email"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Имэйл</FormLabel>
                                    <FormControl>
                                        <Input type="email" {...field} placeholder="example@mail.com" />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="phone"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Утас <span className="text-red-500">*</span></FormLabel>
                                    <FormControl>
                                        <Input type="tel" {...field} placeholder="99112233" />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="linkedinUrl"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>LinkedIn</FormLabel>
                                    <FormControl>
                                        <Input {...field} placeholder="https://linkedin.com/in/..." />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="portfolioUrl"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Facebook</FormLabel>
                                    <FormControl>
                                        <Input {...field} placeholder="https://facebook.com/..." />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="source"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Эх сурвалж</FormLabel>
                                    <Select
                                        value={field.value ?? ''}
                                        onValueChange={field.onChange}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Сонгох" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {SOURCE_OPTIONS.map((opt) => (
                                                <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <AppDialogFooter className="px-0 py-0 border-t-0 bg-transparent">
                            <Button type="submit" disabled={isLoading}>
                                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Бүртгэх
                            </Button>
                        </AppDialogFooter>
                    </form>
                </Form>
            </AppDialogContent>
        </AppDialog>
    );
}
