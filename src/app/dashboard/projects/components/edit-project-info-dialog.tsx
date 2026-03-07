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
    FormDescription,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useFirebase, updateDocumentNonBlocking, useTenantWrite } from '@/firebase';
import { Timestamp } from 'firebase/firestore';
import { Loader2, Star } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Project } from '@/types/project';

const schema = z.object({
    name: z.string().min(1, 'Төслийн нэр хоосон байж болохгүй.'),
    goal: z.string().min(1, 'Зорилго хоосон байж болохгүй.'),
    expectedOutcome: z.string().min(1, 'Хүлээгдэж буй үр дүн хоосон байж болохгүй.'),
    pointBudget: z.coerce.number().min(0, 'Оноо 0-ээс бага байж болохгүй.').optional(),
});

type FormValues = z.infer<typeof schema>;

interface EditProjectInfoDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    project: Project;
}

export function EditProjectInfoDialog({ open, onOpenChange, project }: EditProjectInfoDialogProps) {
    const { firestore } = useFirebase();
    const { tDoc } = useTenantWrite();
    const { toast } = useToast();
    const [isSubmitting, setIsSubmitting] = React.useState(false);

    const canEditPoints = project.status !== 'COMPLETED' && !project.pointsDistributed;

    const form = useForm<FormValues>({
        resolver: zodResolver(schema),
        defaultValues: {
            name: project.name,
            goal: project.goal || '',
            expectedOutcome: project.expectedOutcome || '',
            pointBudget: project.pointBudget || undefined,
        },
    });

    React.useEffect(() => {
        if (project && open) {
            form.reset({
                name: project.name,
                goal: project.goal || '',
                expectedOutcome: project.expectedOutcome || '',
                pointBudget: project.pointBudget || undefined,
            });
        }
    }, [project, open, form]);

    const onSubmit = async (values: FormValues) => {
        if (!firestore || !project.id) return;
        setIsSubmitting(true);
        try {
            const updateData: Record<string, any> = {
                name: values.name,
                goal: values.goal,
                expectedOutcome: values.expectedOutcome,
                updatedAt: Timestamp.now(),
            };

            if (canEditPoints) {
                if (values.pointBudget && values.pointBudget > 0) {
                    updateData.pointBudget = values.pointBudget;
                    if (!project.pointBudget) {
                        updateData.pointsDistributed = false;
                    }
                } else {
                    updateData.pointBudget = 0;
                }
            }

            await updateDocumentNonBlocking(tDoc('projects', project.id), updateData);
            toast({ title: 'Амжилттай', description: 'Төслийн мэдээлэл шинэчлэгдлээ.' });
            onOpenChange(false);
        } catch (error) {
            toast({ title: 'Алдаа', description: 'Шинэчлэхэд алдаа гарлаа.', variant: 'destructive' });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[480px]">
                <DialogHeader>
                    <DialogTitle>Төслийн нэр, зорилго, хүлээгдэж буй үр дүн</DialogTitle>
                    <DialogDescription>Төслийн үндсэн мэдээллийг засна уу.</DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Төслийн нэр *</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Төслийн нэр" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="goal"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Зорилго *</FormLabel>
                                    <FormControl>
                                        <Textarea placeholder="Төслийн зорилго..." className="resize-none" rows={2} {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="expectedOutcome"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Хүлээгдэж буй үр дүн *</FormLabel>
                                    <FormControl>
                                        <Textarea placeholder="Амжилтын шалгуур..." className="resize-none" rows={2} {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {/* Point Budget */}
                        <FormField
                            control={form.control}
                            name="pointBudget"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="flex items-center gap-2">
                                        <Star className="h-4 w-4" />
                                        Төслийн оноо
                                    </FormLabel>
                                    <FormControl>
                                        <Input
                                            type="number"
                                            min={0}
                                            placeholder="0"
                                            disabled={!canEditPoints}
                                            {...field}
                                            value={field.value ?? ''}
                                        />
                                    </FormControl>
                                    {!canEditPoints ? (
                                        <FormDescription>
                                            Төсөл дууссан тул оноог өөрчлөх боломжгүй.
                                        </FormDescription>
                                    ) : (
                                        <FormDescription>
                                            Хугацаандаа дуусвал бүрэн оноо, хоцорсон өдөр тутам 1%-аар хасагдана.
                                        </FormDescription>
                                    )}
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

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
