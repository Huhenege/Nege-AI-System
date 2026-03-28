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
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import {
    useFirebase,
    useMemoFirebase,
    useCollection,
    addDocumentNonBlocking,
    tenantCollection,
    useTenantWrite,
} from '@/firebase';
import { Timestamp } from 'firebase/firestore';
import { Loader2, CalendarIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { mn } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Employee, isActiveStatus } from '@/types';
import { TaskStatus, Priority } from '@/types/project';

const taskSchema = z.object({
    title: z.string().min(1, 'Таскын нэр хоосон байж болохгүй.'),
    dueDate: z.date({ required_error: 'Дуусах огноо сонгоно уу.' }),
    ownerId: z.string().optional(),
    assigneeIds: z.array(z.string()).default([]),
    status: z.enum(['TODO', 'IN_PROGRESS', 'DONE']),
    priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']),
});

type TaskFormValues = z.infer<typeof taskSchema>;

interface CreateTaskDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    projectId: string;
    teamMemberIds: string[]; // Багийн гишүүдийн ID-ууд
}

export function CreateTaskDialog({ open, onOpenChange, projectId, teamMemberIds }: CreateTaskDialogProps) {
    const { firestore } = useFirebase();
    const { tCollection } = useTenantWrite();
    const { toast } = useToast();
    const [isSubmitting, setIsSubmitting] = React.useState(false);

    // Fetch employees
    const employeesQuery = useMemoFirebase(
        ({ firestore, companyPath }) => firestore ? tenantCollection(firestore, companyPath, 'employees') : null,
        [firestore]
    );
    const { data: employees } = useCollection<Employee>(employeesQuery);

    // Filter to only show team members of this project
    const teamMembers = React.useMemo(() => {
        if (!employees || !teamMemberIds) return [];
        return employees.filter(e => 
            e.id && !isSystemUser(e as any) &&
            isActiveStatus(e.status) && 
            teamMemberIds.includes(e.id)
        );
    }, [employees, teamMemberIds]);

    const form = useForm<TaskFormValues>({
        resolver: zodResolver(taskSchema),
        defaultValues: {
            title: '',
            status: 'TODO',
            priority: 'MEDIUM',
            ownerId: '',
            assigneeIds: [],
        },
    });

    const watchedAssignees = form.watch('assigneeIds');

    const onSubmit = async (values: TaskFormValues) => {
        if (!firestore || !projectId) return;

        setIsSubmitting(true);
        try {
            const taskData = {
                projectId,
                title: values.title,
                dueDate: format(values.dueDate, 'yyyy-MM-dd'),
                ownerId: values.ownerId || null,
                assigneeIds: values.assigneeIds,
                status: values.status as TaskStatus,
                priority: values.priority as Priority,
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now(),
            };

            await addDocumentNonBlocking(
                tCollection('projects', projectId, 'tasks'),
                taskData
            );

            toast({
                title: 'Амжилттай',
                description: 'Шинэ таск үүсгэгдлээ.',
            });

            form.reset();
            onOpenChange(false);
        } catch (error) {
            console.error('Error creating task:', error);
            toast({
                title: 'Алдаа',
                description: 'Таск үүсгэхэд алдаа гарлаа.',
                variant: 'destructive',
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const toggleAssignee = (employeeId: string) => {
        const current = form.getValues('assigneeIds');
        if (current.includes(employeeId)) {
            form.setValue('assigneeIds', current.filter(id => id !== employeeId));
        } else {
            form.setValue('assigneeIds', [...current, employeeId]);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Шинэ таск үүсгэх</DialogTitle>
                    <DialogDescription>
                        Таскын мэдээллийг оруулна уу.
                    </DialogDescription>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="title"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Таскын нэр *</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Таскын нэр" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="dueDate"
                            render={({ field }) => (
                                <FormItem className="flex flex-col">
                                    <FormLabel>Дуусах огноо *</FormLabel>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <FormControl>
                                                <Button
                                                    variant="outline"
                                                    className={cn(
                                                        'w-full pl-3 text-left font-normal',
                                                        !field.value && 'text-muted-foreground'
                                                    )}
                                                >
                                                    {field.value ? (
                                                        format(field.value, 'yyyy-MM-dd', { locale: mn })
                                                    ) : (
                                                        <span>Огноо сонгох</span>
                                                    )}
                                                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                                </Button>
                                            </FormControl>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0" align="start">
                                            <Calendar
                                                mode="single"
                                                selected={field.value}
                                                onSelect={field.onChange}
                                                initialFocus
                                            />
                                        </PopoverContent>
                                    </Popover>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="ownerId"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Эзэн (Owner)</FormLabel>
                                    <Select 
                                        onValueChange={(value) => field.onChange(value === '__none__' ? '' : value)} 
                                        value={field.value || '__none__'}
                                    >
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Эзэн сонгох (заавал биш)" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value="__none__">Сонгоогүй</SelectItem>
                                            {teamMembers.filter(e => e.id).map((employee) => (
                                                <SelectItem key={employee.id} value={employee.id}>
                                                    {employee.firstName} {employee.lastName}
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
                            name="assigneeIds"
                            render={() => (
                                <FormItem>
                                    <FormLabel>Гүйцэтгэгчид</FormLabel>
                                    <div className="border rounded-md p-3 max-h-40 overflow-y-auto space-y-2">
                                        {teamMembers.length === 0 ? (
                                            <p className="text-sm text-muted-foreground">Ажилтан байхгүй</p>
                                        ) : (
                                            teamMembers.filter(e => e.id).map((employee) => (
                                                <div
                                                    key={employee.id}
                                                    className="flex items-center space-x-2"
                                                >
                                                    <Checkbox
                                                        id={`assignee-${employee.id}`}
                                                        checked={watchedAssignees.includes(employee.id)}
                                                        onCheckedChange={() => toggleAssignee(employee.id)}
                                                    />
                                                    <label
                                                        htmlFor={`assignee-${employee.id}`}
                                                        className="text-sm cursor-pointer"
                                                    >
                                                        {employee.firstName} {employee.lastName}
                                                    </label>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="status"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Төлөв</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Төлөв сонгох" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="TODO">Хийх</SelectItem>
                                                <SelectItem value="IN_PROGRESS">Гүйцэтгэж байна</SelectItem>
                                                <SelectItem value="DONE">Дууссан</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="priority"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Чухалчлал</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Чухалчлал сонгох" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="LOW">Бага</SelectItem>
                                                <SelectItem value="MEDIUM">Дунд</SelectItem>
                                                <SelectItem value="HIGH">Өндөр</SelectItem>
                                                <SelectItem value="URGENT">Яаралтай</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <DialogFooter className="pt-4">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => onOpenChange(false)}
                            >
                                Болих
                            </Button>
                            <Button type="submit" disabled={isSubmitting}>
                                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Үүсгэх
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
