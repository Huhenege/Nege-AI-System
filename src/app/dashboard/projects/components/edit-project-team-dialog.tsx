'use client';

import { isSystemUser } from '@/lib/employee-utils';

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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useFirebase, useMemoFirebase, useCollection, updateDocumentNonBlocking, tenantCollection, useTenantWrite } from '@/firebase';
import { Timestamp } from 'firebase/firestore';
import { Loader2, Users } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Employee, isActiveStatus } from '@/types';
import { Project } from '@/types/project';

const schema = z.object({
    ownerId: z.string().min(1, 'Хариуцагч сонгоно уу.'),
    teamMemberIds: z.array(z.string()).min(1, 'Багийн гишүүн сонгоно уу.'),
});

type FormValues = z.infer<typeof schema>;

interface EditProjectTeamDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    project: Project;
}

export function EditProjectTeamDialog({ open, onOpenChange, project }: EditProjectTeamDialogProps) {
    const { firestore } = useFirebase();
    const { tDoc } = useTenantWrite();
    const { toast } = useToast();
    const [isSubmitting, setIsSubmitting] = React.useState(false);

    const employeesQuery = useMemoFirebase(
        ({ firestore, companyPath }) => firestore ? tenantCollection(firestore, companyPath, 'employees') : null,
        [firestore]
    );
    const { data: employees } = useCollection<Employee>(employeesQuery);
    const activeEmployees = React.useMemo(() => 
        (employees || []).filter(e => !isSystemUser(e as any) && isActiveStatus(e.status)),
        [employees]
    );

    const form = useForm<FormValues>({
        resolver: zodResolver(schema),
        defaultValues: {
            ownerId: project.ownerId,
            teamMemberIds: project.teamMemberIds || [],
        },
    });

    const watchedTeamMembers = form.watch('teamMemberIds');

    const toggleTeamMember = (employeeId: string) => {
        const current = form.getValues('teamMemberIds') || [];
        if (current.includes(employeeId)) {
            form.setValue('teamMemberIds', current.filter(id => id !== employeeId), { shouldValidate: true });
        } else {
            form.setValue('teamMemberIds', [...current, employeeId], { shouldValidate: true });
        }
    };

    React.useEffect(() => {
        if (project && open) {
            form.reset({
                ownerId: project.ownerId,
                teamMemberIds: project.teamMemberIds || [],
            });
        }
    }, [project, open, form]);

    const onSubmit = async (values: FormValues) => {
        if (!firestore || !project.id) return;
        setIsSubmitting(true);
        try {
            await updateDocumentNonBlocking(tDoc('projects', project.id), {
                ownerId: values.ownerId,
                teamMemberIds: values.teamMemberIds,
                updatedAt: Timestamp.now(),
            });
            toast({ title: 'Амжилттай', description: 'Багийн гишүүд шинэчлэгдлээ.' });
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
                    <DialogTitle className="flex items-center gap-2">
                        <Users className="h-5 w-5 text-blue-600" />
                        Багийн гишүүд
                    </DialogTitle>
                    <DialogDescription>Хариуцагч болон багийн гишүүдийг тохируулна уу.</DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="ownerId"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Хариуцагч *</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Хариуцагч сонгох" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {activeEmployees.filter(e => e.id).map((emp) => (
                                                <SelectItem key={emp.id} value={emp.id}>
                                                    {emp.firstName} {emp.lastName}
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
                            name="teamMemberIds"
                            render={() => (
                                <FormItem>
                                    <FormLabel>Багийн гишүүд *</FormLabel>
                                    <FormDescription>Төсөлд оролцох ажилчдыг сонгоно уу</FormDescription>
                                    <ScrollArea className="h-[160px] rounded-md border p-3">
                                        <div className="space-y-2">
                                            {activeEmployees.filter(e => e.id).map((employee) => (
                                                <div
                                                    key={employee.id}
                                                    className="flex items-center space-x-3 rounded-md p-2 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                                                >
                                                    <Checkbox
                                                        id={`team-${employee.id}`}
                                                        checked={watchedTeamMembers?.includes(employee.id!)}
                                                        onCheckedChange={() => toggleTeamMember(employee.id!)}
                                                    />
                                                    <label htmlFor={`team-${employee.id}`} className="flex-1 text-sm cursor-pointer">
                                                        {employee.firstName} {employee.lastName}
                                                        {employee.jobTitle && (
                                                            <span className="text-muted-foreground ml-2">({employee.jobTitle})</span>
                                                        )}
                                                    </label>
                                                </div>
                                            ))}
                                        </div>
                                    </ScrollArea>
                                    {watchedTeamMembers?.length > 0 && (
                                        <p className="text-xs text-muted-foreground">{watchedTeamMembers.length} гишүүн сонгогдсон</p>
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
