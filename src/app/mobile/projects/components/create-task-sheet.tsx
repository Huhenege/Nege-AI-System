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
import { Calendar } from '@/components/ui/calendar';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
    useFirebase,
    addDocumentNonBlocking,
    useTenantWrite,
} from '@/firebase';
import { Timestamp } from 'firebase/firestore';
import { Loader2, CalendarIcon, Users, ChevronRight, Circle, Clock, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useEmployeeProfile } from '@/hooks/use-employee-profile';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Employee } from '@/types';
import { TaskStatus, Priority } from '@/types/project';
import { useMobileContainer } from '../../hooks/use-mobile-container';

const taskSchema = z.object({
    title: z.string().min(1, 'Таскын нэр оруулна уу'),
    dueDate: z.date({ required_error: 'Дуусах огноо сонгоно уу' }),
    assigneeIds: z.array(z.string()).default([]),
    status: z.enum(['TODO', 'IN_PROGRESS', 'DONE']),
    priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']),
});

type TaskFormValues = z.infer<typeof taskSchema>;

interface CreateTaskSheetProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    projectId: string;
    teamMembers: Employee[];
}

export function CreateTaskSheet({ open, onOpenChange, projectId, teamMembers }: CreateTaskSheetProps) {
    const { firestore, user } = useFirebase();
    const { tCollection } = useTenantWrite();
    const { employeeProfile } = useEmployeeProfile();
    const { toast } = useToast();
    const container = useMobileContainer();
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [showAssigneePicker, setShowAssigneePicker] = React.useState(false);

    const form = useForm<TaskFormValues>({
        resolver: zodResolver(taskSchema),
        defaultValues: {
            title: '',
            assigneeIds: [],
            status: 'TODO',
            priority: 'MEDIUM',
        },
    });

    const watchedAssignees = form.watch('assigneeIds');
    const watchedStatus = form.watch('status');
    const watchedPriority = form.watch('priority');

    const toggleAssignee = (employeeId: string) => {
        const current = form.getValues('assigneeIds') || [];
        if (current.includes(employeeId)) {
            form.setValue('assigneeIds', current.filter(id => id !== employeeId));
        } else {
            form.setValue('assigneeIds', [...current, employeeId]);
        }
    };

    const onSubmit = async (values: TaskFormValues) => {
        if (!firestore || !projectId) return;

        setIsSubmitting(true);
        try {
            const taskData = {
                projectId,
                title: values.title,
                dueDate: format(values.dueDate, 'yyyy-MM-dd'),
                ownerId: employeeProfile?.id || null,
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
                description: 'Шинэ таск үүсгэгдлээ',
            });

            form.reset({
                title: '',
                assigneeIds: [],
                status: 'TODO',
                priority: 'MEDIUM',
            });
            onOpenChange(false);
        } catch (error) {
            console.error('Error creating task:', error);
            toast({
                title: 'Алдаа',
                description: 'Таск үүсгэхэд алдаа гарлаа',
                variant: 'destructive',
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const selectedAssignees = teamMembers.filter(m => watchedAssignees?.includes(m.id!));

    const statusOptions = [
        { value: 'TODO', label: 'Хийх', icon: Circle, color: 'text-slate-400' },
        { value: 'IN_PROGRESS', label: 'Гүйцэтгэж байна', icon: Clock, color: 'text-amber-500' },
        { value: 'DONE', label: 'Дууссан', icon: CheckCircle, color: 'text-emerald-500' },
    ];

    const priorityOptions = [
        { value: 'LOW', label: 'Бага', color: 'bg-slate-100 text-slate-600' },
        { value: 'MEDIUM', label: 'Дунд', color: 'bg-blue-100 text-blue-600' },
        { value: 'HIGH', label: 'Өндөр', color: 'bg-orange-100 text-orange-600' },
        { value: 'URGENT', label: 'Яаралтай', color: 'bg-red-100 text-red-600' },
    ];

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent 
                side="bottom" 
                className="h-[85vh] rounded-t-3xl px-0 !left-1/2 !right-auto !-translate-x-1/2 w-full max-w-md"
                hideCloseButton
            >
                <SheetHeader className="px-5 pb-4 border-b border-slate-100">
                    <SheetTitle className="text-lg">Шинэ таск нэмэх</SheetTitle>
                </SheetHeader>

                <ScrollArea className="h-[calc(85vh-140px)]">
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="px-5 py-4 space-y-5">
                            {/* Title */}
                            <FormField
                                control={form.control}
                                name="title"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-sm font-semibold text-slate-700">Таскын нэр *</FormLabel>
                                        <FormControl>
                                            <Input 
                                                placeholder="Юу хийх вэ?" 
                                                className="h-11 rounded-xl border-slate-200"
                                                {...field} 
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            {/* Due Date */}
                            <FormField
                                control={form.control}
                                name="dueDate"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-sm font-semibold text-slate-700">Дуусах огноо *</FormLabel>
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
                                                        {field.value ? format(field.value, 'yyyy.MM.dd') : 'Огноо сонгох'}
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

                            {/* Assignees */}
                            <FormField
                                control={form.control}
                                name="assigneeIds"
                                render={() => (
                                    <FormItem>
                                        <FormLabel className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                                            <Users className="h-4 w-4" />
                                            Гүйцэтгэгчид
                                        </FormLabel>
                                        
                                        <button
                                            type="button"
                                            onClick={() => setShowAssigneePicker(!showAssigneePicker)}
                                            className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-white"
                                        >
                                            <div className="flex items-center gap-2">
                                                {selectedAssignees.length > 0 ? (
                                                    <>
                                                        <div className="flex -space-x-2">
                                                            {selectedAssignees.slice(0, 3).map((m) => (
                                                                <Avatar key={m.id} className="h-7 w-7 ring-2 ring-white">
                                                                    <AvatarImage src={m.photoURL} />
                                                                    <AvatarFallback className="text-[10px] bg-indigo-100 text-indigo-600">
                                                                        {m.firstName?.[0]}
                                                                    </AvatarFallback>
                                                                </Avatar>
                                                            ))}
                                                        </div>
                                                        <span className="text-sm text-slate-600">
                                                            {selectedAssignees.length} хүн
                                                        </span>
                                                    </>
                                                ) : (
                                                    <span className="text-sm text-slate-400">Хүн сонгоогүй</span>
                                                )}
                                            </div>
                                            <ChevronRight className={cn(
                                                "h-4 w-4 text-slate-400 transition-transform",
                                                showAssigneePicker && "rotate-90"
                                            )} />
                                        </button>

                                        {showAssigneePicker && (
                                            <div className="border rounded-xl p-3 max-h-40 overflow-y-auto space-y-1 bg-slate-50 animate-in slide-in-from-top-2">
                                                {teamMembers.filter(m => m.id).map((member) => {
                                                    const isSelected = watchedAssignees?.includes(member.id!);
                                                    const isSelf = member.id === employeeProfile?.id;
                                                    return (
                                                        <div
                                                            key={member.id}
                                                            className={cn(
                                                                "flex items-center gap-3 p-2 rounded-lg transition-colors",
                                                                isSelected ? "bg-indigo-50" : "hover:bg-white"
                                                            )}
                                                        >
                                                            <Checkbox
                                                                id={`assignee-${member.id}`}
                                                                checked={isSelected}
                                                                onCheckedChange={() => toggleAssignee(member.id!)}
                                                            />
                                                            <Avatar className="h-6 w-6">
                                                                <AvatarImage src={member.photoURL} />
                                                                <AvatarFallback className="text-[9px]">{member.firstName?.[0]}</AvatarFallback>
                                                            </Avatar>
                                                            <label
                                                                htmlFor={`assignee-${member.id}`}
                                                                className="flex-1 text-sm cursor-pointer"
                                                            >
                                                                {member.firstName} {member.lastName}
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

                            {/* Status */}
                            <FormField
                                control={form.control}
                                name="status"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-sm font-semibold text-slate-700">Төлөв</FormLabel>
                                        <div className="flex gap-2">
                                            {statusOptions.map((opt) => {
                                                const Icon = opt.icon;
                                                const isSelected = field.value === opt.value;
                                                return (
                                                    <button
                                                        key={opt.value}
                                                        type="button"
                                                        onClick={() => field.onChange(opt.value)}
                                                        className={cn(
                                                            "flex-1 flex items-center justify-center gap-1.5 p-2.5 rounded-xl border transition-all text-sm",
                                                            isSelected 
                                                                ? "border-indigo-200 bg-indigo-50 text-indigo-700" 
                                                                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                                                        )}
                                                    >
                                                        <Icon className={cn("h-4 w-4", opt.color)} />
                                                        <span className="text-xs font-medium">{opt.label}</span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </FormItem>
                                )}
                            />

                            {/* Priority */}
                            <FormField
                                control={form.control}
                                name="priority"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-sm font-semibold text-slate-700">Чухалчлал</FormLabel>
                                        <div className="flex gap-2">
                                            {priorityOptions.map((opt) => {
                                                const isSelected = field.value === opt.value;
                                                return (
                                                    <button
                                                        key={opt.value}
                                                        type="button"
                                                        onClick={() => field.onChange(opt.value)}
                                                        className={cn(
                                                            "flex-1 p-2.5 rounded-xl border transition-all text-xs font-medium",
                                                            isSelected 
                                                                ? cn("border-transparent", opt.color)
                                                                : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                                                        )}
                                                    >
                                                        {opt.label}
                                                    </button>
                                                );
                                            })}
                                        </div>
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
                            Нэмэх
                        </Button>
                    </div>
                </div>
            </SheetContent>
        </Sheet>
    );
}
