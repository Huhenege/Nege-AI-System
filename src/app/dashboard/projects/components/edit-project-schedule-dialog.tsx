'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from '@/components/ui/form';
import { Calendar } from '@/components/ui/calendar';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { useFirebase, updateDocumentNonBlocking, useTenantWrite } from '@/firebase';
import { Timestamp } from 'firebase/firestore';
import { Loader2, CalendarIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO } from 'date-fns';
import { mn } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Project } from '@/types/project';

const schema = z.object({
    startDate: z.date({ required_error: 'Эхлэх огноо сонгоно уу.' }),
    endDate: z.date({ required_error: 'Дуусах огноо сонгоно уу.' }),
}).refine((data) => data.endDate >= data.startDate, {
    message: 'Дуусах огноо эхлэх огноогоос өмнө байж болохгүй.',
    path: ['endDate'],
});

type FormValues = z.infer<typeof schema>;

interface EditProjectScheduleDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    project: Project;
}

export function EditProjectScheduleDialog({ open, onOpenChange, project }: EditProjectScheduleDialogProps) {
    const { firestore } = useFirebase();
    const { tDoc } = useTenantWrite();
    const { toast } = useToast();
    const [isSubmitting, setIsSubmitting] = React.useState(false);

    const form = useForm<FormValues>({
        resolver: zodResolver(schema),
        defaultValues: {
            startDate: parseISO(project.startDate),
            endDate: parseISO(project.endDate),
        },
    });

    React.useEffect(() => {
        if (project && open) {
            form.reset({
                startDate: parseISO(project.startDate),
                endDate: parseISO(project.endDate),
            });
        }
    }, [project, open, form]);

    const onSubmit = async (values: FormValues) => {
        if (!firestore || !project.id) return;
        setIsSubmitting(true);
        try {
            await updateDocumentNonBlocking(tDoc('projects', project.id), {
                startDate: format(values.startDate, 'yyyy-MM-dd'),
                endDate: format(values.endDate, 'yyyy-MM-dd'),
                updatedAt: Timestamp.now(),
            });
            toast({ title: 'Амжилттай', description: 'Хугацаа шинэчлэгдлээ.' });
            onOpenChange(false);
        } catch (error) {
            toast({ title: 'Алдаа', description: 'Шинэчлэхэд алдаа гарлаа.', variant: 'destructive' });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[420px]">
                <DialogHeader>
                    <DialogTitle>Хугацаа</DialogTitle>
                    <DialogDescription>Төслийн эхлэх болон дуусах огноог засна уу.</DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="startDate"
                                render={({ field }) => (
                                    <FormItem className="flex flex-col">
                                        <FormLabel>Эхлэх огноо *</FormLabel>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <FormControl>
                                                    <Button
                                                        variant="outline"
                                                        className={cn('w-full pl-3 text-left font-normal', !field.value && 'text-muted-foreground')}
                                                    >
                                                        {field.value ? format(field.value, 'yyyy-MM-dd', { locale: mn }) : 'Огноо сонгох'}
                                                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                                    </Button>
                                                </FormControl>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0" align="start">
                                                <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus />
                                            </PopoverContent>
                                        </Popover>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="endDate"
                                render={({ field }) => (
                                    <FormItem className="flex flex-col">
                                        <FormLabel>Дуусах огноо *</FormLabel>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <FormControl>
                                                    <Button
                                                        variant="outline"
                                                        className={cn('w-full pl-3 text-left font-normal', !field.value && 'text-muted-foreground')}
                                                    >
                                                        {field.value ? format(field.value, 'yyyy-MM-dd', { locale: mn }) : 'Огноо сонгох'}
                                                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                                    </Button>
                                                </FormControl>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0" align="start">
                                                <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus />
                                            </PopoverContent>
                                        </Popover>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                        <DialogFooter className="pt-4">
                            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Болих</Button>
                            <Button type="submit" disabled={isSubmitting}>
                                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Хадгалах
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
