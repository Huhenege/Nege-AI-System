import { isSystemUser } from '@/lib/employee-utils';
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
import {
    useFirebase,
    useMemoFirebase,
    useFetchCollection,
    updateDocumentNonBlocking,
    tenantCollection,
    useTenantWrite,
} from '@/firebase';
import { Timestamp } from 'firebase/firestore';
import { Loader2, CalendarIcon, Users } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO } from 'date-fns';
import { mn } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Employee, isActiveStatus } from '@/types';
import { Project, ProjectStatus, Priority } from '@/types/project';

const projectSchema = z.object({
    name: z.string().min(1, 'Төслийн нэр хоосон байж болохгүй.'),
    goal: z.string().min(1, 'Зорилго хоосон байж болохгүй.'),
    expectedOutcome: z.string().min(1, 'Хүлээгдэж буй үр дүн хоосон байж болохгүй.'),
    startDate: z.date({ required_error: 'Эхлэх огноо сонгоно уу.' }),
    endDate: z.date({ required_error: 'Дуусах огноо сонгоно уу.' }),
    ownerId: z.string().min(1, 'Хариуцагч сонгоно уу.'),
    teamMemberIds: z.array(z.string()).min(1, 'Багийн гишүүн сонгоно уу.'),
    status: z.enum(['DRAFT', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'ARCHIVED']),
    priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']),
}).refine((data) => data.endDate >= data.startDate, {
    message: 'Дуусах огноо эхлэх огноогоос өмнө байж болохгүй.',
    path: ['endDate'],
});

type ProjectFormValues = z.infer<typeof projectSchema>;

interface EditProjectDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    project: Project;
}

export function EditProjectDialog({ open, onOpenChange, project }: EditProjectDialogProps) {
    const { firestore } = useFirebase();
    const { tDoc } = useTenantWrite();
    const { toast } = useToast();
    const [isSubmitting, setIsSubmitting] = React.useState(false);

    // Fetch employees
    const employeesQuery = useMemoFirebase(
        ({ firestore, companyPath }) => firestore ? tenantCollection(firestore, companyPath, 'employees') : null,
        [firestore]
    );
    const { data: employees } = useFetchCollection<Employee>(employeesQuery);

    const activeEmployees = React.useMemo(() => {
        return (employees || []).filter(e => !isSystemUser(e as any) && isActiveStatus(e.status));
    }, [employees]);

    const normalizeProjectStatus = React.useCallback(
        (status: ProjectStatus): ProjectFormValues['status'] => {
            if (status === 'IN_PROGRESS') return 'ACTIVE';
            if (status === 'CANCELLED') return 'ARCHIVED';
            return status as ProjectFormValues['status'];
        },
        []
    );

    const form = useForm<ProjectFormValues>({
        resolver: zodResolver(projectSchema),
        defaultValues: {
            name: project.name,
            goal: project.goal || '',
            expectedOutcome: project.expectedOutcome || '',
            startDate: parseISO(project.startDate),
            endDate: parseISO(project.endDate),
            ownerId: project.ownerId,
            teamMemberIds: project.teamMemberIds || [],
            status: normalizeProjectStatus(project.status),
            priority: project.priority,
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

    // Reset form when project changes
    React.useEffect(() => {
        if (project && open) {
            form.reset({
                name: project.name,
                goal: project.goal || '',
                expectedOutcome: project.expectedOutcome || '',
                startDate: parseISO(project.startDate),
                endDate: parseISO(project.endDate),
                ownerId: project.ownerId,
                teamMemberIds: project.teamMemberIds || [],
                status: normalizeProjectStatus(project.status),
                priority: project.priority,
            });
        }
    }, [project, open, form, normalizeProjectStatus]);

    const onSubmit = async (values: ProjectFormValues) => {
        if (!firestore || !project.id) return;

        setIsSubmitting(true);
        try {
            const updateData = {
                name: values.name,
                goal: values.goal,
                expectedOutcome: values.expectedOutcome,
                startDate: format(values.startDate, 'yyyy-MM-dd'),
                endDate: format(values.endDate, 'yyyy-MM-dd'),
                ownerId: values.ownerId,
                teamMemberIds: values.teamMemberIds,
                status: values.status as ProjectStatus,
                priority: values.priority as Priority,
                updatedAt: Timestamp.now(),
            };

            await updateDocumentNonBlocking(
                tDoc('projects', project.id),
                updateData
            );

            toast({
                title: 'Амжилттай',
                description: 'Төсөл шинэчлэгдлээ.',
            });

            onOpenChange(false);
        } catch (error) {
            console.error('Error updating project:', error);
            toast({
                title: 'Алдаа',
                description: 'Төсөл шинэчлэхэд алдаа гарлаа.',
                variant: 'destructive',
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Төсөл засах</DialogTitle>
                    <DialogDescription>
                        Төслийн мэдээллийг засна уу.
                    </DialogDescription>
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
                                        <Textarea
                                            placeholder="Төслийн зорилго..."
                                            className="resize-none"
                                            rows={2}
                                            {...field}
                                        />
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
                                        <Textarea
                                            placeholder="Амжилтын шалгуур, хүлээгдэж буй үр дүн..."
                                            className="resize-none"
                                            rows={2}
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
                                name="startDate"
                                render={({ field }) => (
                                    <FormItem className="flex flex-col">
                                        <FormLabel>Эхлэх огноо *</FormLabel>
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
                                name="endDate"
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
                        </div>

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
                                            {activeEmployees.filter(e => e.id).map((employee) => (
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

                        {/* Team Members Selection */}
                        <FormField
                            control={form.control}
                            name="teamMemberIds"
                            render={() => (
                                <FormItem>
                                    <FormLabel className="flex items-center gap-2">
                                        <Users className="h-4 w-4" />
                                        Багийн гишүүд *
                                    </FormLabel>
                                    <FormDescription>
                                        Төсөлд оролцох ажилчдыг сонгоно уу
                                    </FormDescription>
                                    <ScrollArea className="h-[150px] rounded-md border p-3">
                                        <div className="space-y-2">
                                            {activeEmployees.filter(e => e.id).map((employee) => (
                                                <div
                                                    key={employee.id}
                                                    className="flex items-center space-x-3 rounded-md p-2 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                                                >
                                                    <Checkbox
                                                        id={`edit-team-${employee.id}`}
                                                        checked={watchedTeamMembers?.includes(employee.id!)}
                                                        onCheckedChange={() => toggleTeamMember(employee.id!)}
                                                    />
                                                    <label
                                                        htmlFor={`edit-team-${employee.id}`}
                                                        className="flex-1 text-sm font-medium cursor-pointer"
                                                    >
                                                        {employee.firstName} {employee.lastName}
                                                        {employee.jobTitle ? (
                                                            <span className="text-muted-foreground ml-2">
                                                                ({employee.jobTitle})
                                                            </span>
                                                        ) : null}
                                                    </label>
                                                </div>
                                            ))}
                                        </div>
                                    </ScrollArea>
                                    {watchedTeamMembers?.length > 0 && (
                                        <p className="text-xs text-muted-foreground mt-1">
                                            {watchedTeamMembers.length} гишүүн сонгогдсон
                                        </p>
                                    )}
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
                                                <SelectItem value="DRAFT">Ноорог</SelectItem>
                                                <SelectItem value="ACTIVE">Идэвхтэй</SelectItem>
                                                <SelectItem value="ON_HOLD">Түр зогссон</SelectItem>
                                                <SelectItem value="COMPLETED">Дууссан</SelectItem>
                                                <SelectItem value="ARCHIVED">Архивласан</SelectItem>
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
                                Хадгалах
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
