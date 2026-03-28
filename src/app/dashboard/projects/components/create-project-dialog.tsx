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
    addDocumentNonBlocking,
    tenantCollection,
    useTenantWrite,
} from '@/firebase';
import { Timestamp } from 'firebase/firestore';
import { Loader2, CalendarIcon, Users, Star, Tag, AlertTriangle, Sparkles } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { mn } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Employee, isActiveStatus } from '@/types';
import { ProjectStatus, Priority, ProjectGroup } from '@/types/project';
import { useTenant } from '@/contexts/tenant-context';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

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
    pointBudget: z.coerce.number().min(0, 'Оноо 0-ээс бага байж болохгүй.').optional(),
    groupIds: z.array(z.string()).optional(),
}).refine((data) => data.endDate >= data.startDate, {
    message: 'Дуусах огноо эхлэх огноогоос өмнө байж болохгүй.',
    path: ['endDate'],
});

type ProjectFormValues = z.infer<typeof projectSchema>;

interface CreateProjectDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    groups?: ProjectGroup[];
    currentProjectCount?: number;
}

export function CreateProjectDialog({ open, onOpenChange, groups = [], currentProjectCount = 0 }: CreateProjectDialogProps) {
    const { firestore } = useFirebase();
    const { tCollection } = useTenantWrite();
    const { toast } = useToast();
    const { company, isWithinLimit } = useTenant();
    const [isSubmitting, setIsSubmitting] = React.useState(false);

    const limitReached = !isWithinLimit('maxProjects', currentProjectCount);
    const maxProjects = company?.limits?.maxProjects ?? 0;

    // Fetch employees for owner selection
    const employeesQuery = useMemoFirebase(
        ({ firestore, companyPath }) => firestore ? tenantCollection(firestore, companyPath, 'employees') : null,
        [firestore]
    );
    const { data: employees } = useFetchCollection<Employee>(employeesQuery);

    const activeEmployees = React.useMemo(() => {
        return (employees || []).filter(e => !isSystemUser(e as any) && isActiveStatus(e.status));
    }, [employees]);

    const form = useForm<ProjectFormValues>({
        resolver: zodResolver(projectSchema),
        defaultValues: {
            name: '',
            goal: '',
            expectedOutcome: '',
            status: 'DRAFT',
            priority: 'MEDIUM',
            ownerId: '',
            teamMemberIds: [],
            groupIds: [],
        },
    });

    const watchedTeamMembers = form.watch('teamMemberIds');
    const watchedGroupIds = form.watch('groupIds');

    const toggleTeamMember = (employeeId: string) => {
        const current = form.getValues('teamMemberIds') || [];
        if (current.includes(employeeId)) {
            form.setValue('teamMemberIds', current.filter(id => id !== employeeId), { shouldValidate: true });
        } else {
            form.setValue('teamMemberIds', [...current, employeeId], { shouldValidate: true });
        }
    };

    const toggleGroup = (groupId: string) => {
        const current = form.getValues('groupIds') || [];
        if (current.includes(groupId)) {
            form.setValue('groupIds', current.filter(id => id !== groupId), { shouldValidate: true });
        } else {
            form.setValue('groupIds', [...current, groupId], { shouldValidate: true });
        }
    };

    const onSubmit = async (values: ProjectFormValues) => {
        if (!firestore) return;

        setIsSubmitting(true);
        try {
            const projectData: Record<string, any> = {
                name: values.name,
                goal: values.goal,
                expectedOutcome: values.expectedOutcome,
                startDate: format(values.startDate, 'yyyy-MM-dd'),
                endDate: format(values.endDate, 'yyyy-MM-dd'),
                ownerId: values.ownerId,
                teamMemberIds: values.teamMemberIds,
                status: values.status as ProjectStatus,
                priority: values.priority as Priority,
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now(),
                createdBy: values.ownerId, // TODO: Use current user ID
            };

            if (values.pointBudget && values.pointBudget > 0) {
                projectData.pointBudget = values.pointBudget;
                projectData.pointsDistributed = false;
            }

            if (values.groupIds && values.groupIds.length > 0) {
                projectData.groupIds = values.groupIds;
            }

            await addDocumentNonBlocking(tCollection('projects'), projectData);

            toast({
                title: 'Амжилттай',
                description: 'Шинэ төсөл үүсгэгдлээ.',
            });

            form.reset();
            onOpenChange(false);
        } catch (error) {
            console.error('Error creating project:', error);
            toast({
                title: 'Алдаа',
                description: 'Төсөл үүсгэхэд алдаа гарлаа.',
                variant: 'destructive',
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px] max-h-[90vh] flex flex-col p-0 overflow-hidden">
                <DialogHeader className="px-6 pt-6 pb-0 shrink-0">
                    <DialogTitle>Шинэ төсөл үүсгэх</DialogTitle>
                    <DialogDescription>
                        Төслийн мэдээллийг оруулна уу.
                    </DialogDescription>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col min-h-0 flex-1">
                        <div className="overflow-y-auto overflow-x-hidden max-h-[55vh]">
                            <div className="space-y-4 px-6 py-4">
                        {limitReached && (
                            <Alert variant="destructive">
                                <AlertTriangle className="h-4 w-4" />
                                <AlertTitle>Төслийн хязгаар хэтэрсэн</AlertTitle>
                                <AlertDescription>
                                    Таны багцад хамгийн ихдээ {maxProjects} төсөл үүсгэх боломжтой (одоо: {currentProjectCount}).
                                    <a href="/dashboard/billing" className="ml-1 inline-flex items-center gap-1 font-medium underline underline-offset-2">
                                        <Sparkles className="h-3 w-3" />Багц сунгах
                                    </a>
                                </AlertDescription>
                            </Alert>
                        )}
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
                                            {activeEmployees.map((employee) => (
                                                employee.id ? (
                                                    <SelectItem key={employee.id} value={employee.id}>
                                                        {employee.firstName} {employee.lastName}
                                                    </SelectItem>
                                                ) : null
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
                                                        id={`team-${employee.id}`}
                                                        checked={watchedTeamMembers?.includes(employee.id!)}
                                                        onCheckedChange={() => toggleTeamMember(employee.id!)}
                                                    />
                                                    <label
                                                        htmlFor={`team-${employee.id}`}
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

                        {/* Group Selection */}
                        {groups.length > 0 && (
                            <FormField
                                control={form.control}
                                name="groupIds"
                                render={() => (
                                    <FormItem>
                                        <FormLabel className="flex items-center gap-2">
                                            <Tag className="h-4 w-4" />
                                            Бүлэг
                                        </FormLabel>
                                        <FormDescription>
                                            Төслийг олон бүлэгт зэрэг хамааруулж болно
                                        </FormDescription>
                                        <ScrollArea className="h-[120px] rounded-md border p-3">
                                            <div className="space-y-2">
                                                {groups.map((g) => (
                                                    <div
                                                        key={g.id}
                                                        className="flex items-center space-x-3 rounded-md p-2 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                                                    >
                                                        <Checkbox
                                                            id={`group-${g.id}`}
                                                            checked={watchedGroupIds?.includes(g.id)}
                                                            onCheckedChange={() => toggleGroup(g.id)}
                                                        />
                                                        <label
                                                            htmlFor={`group-${g.id}`}
                                                            className="flex items-center gap-2 flex-1 text-sm font-medium cursor-pointer"
                                                        >
                                                            <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: g.color || '#94a3b8' }} />
                                                            {g.name}
                                                        </label>
                                                    </div>
                                                ))}
                                            </div>
                                        </ScrollArea>
                                        {watchedGroupIds && watchedGroupIds.length > 0 && (
                                            <p className="text-xs text-muted-foreground mt-1">
                                                {watchedGroupIds.length} бүлэг сонгогдсон
                                            </p>
                                        )}
                                    </FormItem>
                                )}
                            />
                        )}

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
                                            {...field}
                                            value={field.value ?? ''}
                                        />
                                    </FormControl>
                                    <FormDescription>
                                        Хугацаандаа дуусвал бүрэн оноо, хоцорсон өдөр тутам 1%-аар хасагдана. 100+ хоног хоцорвол 0 оноо.
                                    </FormDescription>
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
                            </div>
                        </div>

                        <DialogFooter className="px-6 py-4 border-t shrink-0">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => onOpenChange(false)}
                            >
                                Болих
                            </Button>
                            <Button type="submit" disabled={isSubmitting || limitReached}>
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
