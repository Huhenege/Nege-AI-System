'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet';
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
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
    useFirebase,
    useMemoFirebase,
    useCollection,
    addDocumentNonBlocking,
    tenantCollection,
    useTenantWrite,
} from '@/firebase';
import { Timestamp } from 'firebase/firestore';
import { Loader2, CalendarIcon, Users, ChevronRight, Star } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useEmployeeProfile } from '@/hooks/use-employee-profile';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Employee, isActiveStatus } from '@/types';
import { ProjectStatus, Priority } from '@/types/project';
import { useMobileContainer } from '../../hooks/use-mobile-container';

const projectSchema = z.object({
    name: z.string().min(1, 'Төслийн нэр оруулна уу'),
    goal: z.string().min(1, 'Зорилго оруулна уу'),
    expectedOutcome: z.string().min(1, 'Хүлээгдэж буй үр дүн оруулна уу'),
    startDate: z.date({ required_error: 'Эхлэх огноо сонгоно уу' }),
    endDate: z.date({ required_error: 'Дуусах огноо сонгоно уу' }),
    teamMemberIds: z.array(z.string()).min(1, 'Багийн гишүүн сонгоно уу'),
    pointBudget: z.coerce.number().min(0, 'Оноо 0-ээс бага байж болохгүй').optional(),
}).refine((data) => data.endDate >= data.startDate, {
    message: 'Дуусах огноо эхлэх огноогоос өмнө байж болохгүй',
    path: ['endDate'],
});

type ProjectFormValues = z.infer<typeof projectSchema>;

interface CreateProjectSheetProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function CreateProjectSheet({ open, onOpenChange }: CreateProjectSheetProps) {
    const { firestore, user } = useFirebase();
    const { tCollection } = useTenantWrite();
    const { employeeProfile } = useEmployeeProfile();
    const { toast } = useToast();
    const container = useMobileContainer();
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [showTeamPicker, setShowTeamPicker] = React.useState(false);

    // Fetch employees
    const employeesQuery = useMemoFirebase(
        ({ companyPath }) => firestore ? tenantCollection(firestore, companyPath, 'employees') : null,
        [firestore]
    );
    const { data: employees } = useCollection<Employee>(employeesQuery);

    const activeEmployees = React.useMemo(() => {
        return (employees || []).filter(e => isActiveStatus(e.status) && e.id);
    }, [employees]);

    const form = useForm<ProjectFormValues>({
        resolver: zodResolver(projectSchema),
        defaultValues: {
            name: '',
            goal: '',
            expectedOutcome: '',
            teamMemberIds: employeeProfile?.id ? [employeeProfile.id] : [],
        },
    });

    // Auto-add current user to team when profile loads
    React.useEffect(() => {
        if (employeeProfile?.id && open) {
            const current = form.getValues('teamMemberIds');
            if (!current.includes(employeeProfile.id)) {
                form.setValue('teamMemberIds', [...current, employeeProfile.id]);
            }
        }
    }, [employeeProfile?.id, open, form]);

    const watchedTeamMembers = form.watch('teamMemberIds');

    const toggleTeamMember = (employeeId: string) => {
        const current = form.getValues('teamMemberIds') || [];
        if (current.includes(employeeId)) {
            // Don't allow removing self
            if (employeeId === employeeProfile?.id) return;
            form.setValue('teamMemberIds', current.filter(id => id !== employeeId), { shouldValidate: true });
        } else {
            form.setValue('teamMemberIds', [...current, employeeId], { shouldValidate: true });
        }
    };

    const onSubmit = async (values: ProjectFormValues) => {
        if (!firestore || !employeeProfile?.id) return;

        setIsSubmitting(true);
        try {
            const projectData: Record<string, any> = {
                name: values.name,
                goal: values.goal,
                expectedOutcome: values.expectedOutcome,
                startDate: format(values.startDate, 'yyyy-MM-dd'),
                endDate: format(values.endDate, 'yyyy-MM-dd'),
                ownerId: employeeProfile.id, // Current user is owner
                teamMemberIds: values.teamMemberIds,
                status: 'DRAFT' as ProjectStatus,
                priority: 'MEDIUM' as Priority,
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now(),
                createdBy: employeeProfile.id,
            };

            if (values.pointBudget && values.pointBudget > 0) {
                projectData.pointBudget = values.pointBudget;
                projectData.pointsDistributed = false;
            }

            await addDocumentNonBlocking(tCollection('projects'), projectData);

            toast({
                title: 'Амжилттай',
                description: 'Шинэ төсөл үүсгэгдлээ',
            });

            form.reset({
                name: '',
                goal: '',
                expectedOutcome: '',
                teamMemberIds: employeeProfile?.id ? [employeeProfile.id] : [],
            });
            onOpenChange(false);
        } catch (error) {
            console.error('Error creating project:', error);
            toast({
                title: 'Алдаа',
                description: 'Төсөл үүсгэхэд алдаа гарлаа',
                variant: 'destructive',
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const selectedMembers = activeEmployees.filter(e => watchedTeamMembers?.includes(e.id!));

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent 
                side="bottom" 
                className="h-[90vh] rounded-t-3xl px-0 !left-1/2 !right-auto !-translate-x-1/2 w-full max-w-md"
                hideCloseButton
            >
                <SheetHeader className="px-5 pb-4 border-b border-slate-100">
                    <SheetTitle className="text-lg">Шинэ төсөл үүсгэх</SheetTitle>
                </SheetHeader>

                <ScrollArea className="h-[calc(90vh-140px)]">
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="px-5 py-4 space-y-5">
                            {/* Name */}
                            <FormField
                                control={form.control}
                                name="name"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-sm font-semibold text-slate-700">Төслийн нэр *</FormLabel>
                                        <FormControl>
                                            <Input 
                                                placeholder="Төслийн нэр" 
                                                className="h-11 rounded-xl border-slate-200"
                                                {...field} 
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            {/* Goal */}
                            <FormField
                                control={form.control}
                                name="goal"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-sm font-semibold text-slate-700">Зорилго *</FormLabel>
                                        <FormControl>
                                            <Textarea
                                                placeholder="Төслийн зорилго..."
                                                className="resize-none rounded-xl border-slate-200 min-h-[80px]"
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            {/* Expected Outcome */}
                            <FormField
                                control={form.control}
                                name="expectedOutcome"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-sm font-semibold text-slate-700">Хүлээгдэж буй үр дүн *</FormLabel>
                                        <FormControl>
                                            <Textarea
                                                placeholder="Амжилтын шалгуур..."
                                                className="resize-none rounded-xl border-slate-200 min-h-[80px]"
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            {/* Dates */}
                            <div className="grid grid-cols-2 gap-3">
                                <FormField
                                    control={form.control}
                                    name="startDate"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-sm font-semibold text-slate-700">Эхлэх *</FormLabel>
                                            <Popover>
                                                <PopoverTrigger asChild>
                                                    <FormControl>
                                                        <Button
                                                            variant="outline"
                                                            className={cn(
                                                                'w-full h-11 rounded-xl border-slate-200 justify-start text-left font-normal',
                                                                !field.value && 'text-muted-foreground'
                                                            )}
                                                        >
                                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                                            {field.value ? format(field.value, 'MM/dd') : 'Сонгох'}
                                                        </Button>
                                                    </FormControl>
                                                </PopoverTrigger>
                                                <PopoverContent container={container} className="w-auto p-0" align="start">
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
                                        <FormItem>
                                            <FormLabel className="text-sm font-semibold text-slate-700">Дуусах *</FormLabel>
                                            <Popover>
                                                <PopoverTrigger asChild>
                                                    <FormControl>
                                                        <Button
                                                            variant="outline"
                                                            className={cn(
                                                                'w-full h-11 rounded-xl border-slate-200 justify-start text-left font-normal',
                                                                !field.value && 'text-muted-foreground'
                                                            )}
                                                        >
                                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                                            {field.value ? format(field.value, 'MM/dd') : 'Сонгох'}
                                                        </Button>
                                                    </FormControl>
                                                </PopoverTrigger>
                                                <PopoverContent container={container} className="w-auto p-0" align="start">
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

                            {/* Point Budget */}
                            <FormField
                                control={form.control}
                                name="pointBudget"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                                            <Star className="h-4 w-4" />
                                            Төслийн оноо
                                        </FormLabel>
                                        <FormControl>
                                            <Input
                                                type="number"
                                                min={0}
                                                placeholder="0"
                                                className="h-11 rounded-xl border-slate-200"
                                                {...field}
                                                value={field.value ?? ''}
                                            />
                                        </FormControl>
                                        <p className="text-xs text-slate-500">
                                            Хугацаандаа дуусвал бүрэн оноо, хоцорсон өдөр тутам 1%-аар хасагдана.
                                        </p>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            {/* Team Members */}
                            <FormField
                                control={form.control}
                                name="teamMemberIds"
                                render={() => (
                                    <FormItem>
                                        <FormLabel className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                                            <Users className="h-4 w-4" />
                                            Багийн гишүүд *
                                        </FormLabel>
                                        
                                        {/* Selected Members Preview */}
                                        <button
                                            type="button"
                                            onClick={() => setShowTeamPicker(!showTeamPicker)}
                                            className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-white"
                                        >
                                            <div className="flex items-center gap-2">
                                                <div className="flex -space-x-2">
                                                    {selectedMembers.slice(0, 4).map((m) => (
                                                        <Avatar key={m.id} className="h-8 w-8 ring-2 ring-white">
                                                            <AvatarImage src={m.photoURL} />
                                                            <AvatarFallback className="text-xs bg-indigo-100 text-indigo-600">
                                                                {m.firstName?.[0]}
                                                            </AvatarFallback>
                                                        </Avatar>
                                                    ))}
                                                    {selectedMembers.length > 4 && (
                                                        <div className="h-8 w-8 rounded-full bg-slate-100 ring-2 ring-white flex items-center justify-center">
                                                            <span className="text-xs font-semibold text-slate-500">+{selectedMembers.length - 4}</span>
                                                        </div>
                                                    )}
                                                </div>
                                                <span className="text-sm text-slate-600">
                                                    {selectedMembers.length > 0 
                                                        ? `${selectedMembers.length} гишүүн` 
                                                        : 'Сонгоогүй'
                                                    }
                                                </span>
                                            </div>
                                            <ChevronRight className={cn(
                                                "h-4 w-4 text-slate-400 transition-transform",
                                                showTeamPicker && "rotate-90"
                                            )} />
                                        </button>

                                        {/* Team Picker */}
                                        {showTeamPicker && (
                                            <div className="border rounded-xl p-3 max-h-48 overflow-y-auto space-y-1 bg-slate-50 animate-in slide-in-from-top-2">
                                                {activeEmployees.map((employee) => {
                                                    const isSelected = watchedTeamMembers?.includes(employee.id!);
                                                    const isSelf = employee.id === employeeProfile?.id;
                                                    return (
                                                        <div
                                                            key={employee.id}
                                                            className={cn(
                                                                "flex items-center gap-3 p-2 rounded-lg transition-colors",
                                                                isSelected ? "bg-indigo-50" : "hover:bg-white"
                                                            )}
                                                        >
                                                            <Checkbox
                                                                id={`team-${employee.id}`}
                                                                checked={isSelected}
                                                                onCheckedChange={() => toggleTeamMember(employee.id!)}
                                                                disabled={isSelf}
                                                            />
                                                            <Avatar className="h-7 w-7">
                                                                <AvatarImage src={employee.photoURL} />
                                                                <AvatarFallback className="text-[10px]">{employee.firstName?.[0]}</AvatarFallback>
                                                            </Avatar>
                                                            <label
                                                                htmlFor={`team-${employee.id}`}
                                                                className={cn(
                                                                    "flex-1 text-sm cursor-pointer",
                                                                    isSelf && "text-slate-400"
                                                                )}
                                                            >
                                                                {employee.firstName} {employee.lastName}
                                                                {isSelf && <span className="text-xs text-indigo-500 ml-1">(Та)</span>}
                                                            </label>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </form>
                    </Form>
                </ScrollArea>

                {/* Footer */}
                <div className="absolute bottom-0 left-0 right-0 p-5 bg-white border-t border-slate-100">
                    <div className="flex gap-3">
                        <Button
                            type="button"
                            variant="outline"
                            className="flex-1 h-12 rounded-xl"
                            onClick={() => onOpenChange(false)}
                        >
                            Болих
                        </Button>
                        <Button 
                            className="flex-1 h-12 rounded-xl bg-indigo-600 hover:bg-indigo-700"
                            onClick={form.handleSubmit(onSubmit)}
                            disabled={isSubmitting}
                        >
                            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Үүсгэх
                        </Button>
                    </div>
                </div>
            </SheetContent>
        </Sheet>
    );
}
