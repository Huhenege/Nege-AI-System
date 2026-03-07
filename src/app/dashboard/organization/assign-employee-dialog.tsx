

'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import {
    useFirebase,
    useMemoFirebase,
    useCollection,
    useTenantWrite,
} from '@/firebase';
import { doc, increment, writeBatch, collection, getDocs, addDoc } from 'firebase/firestore';
import { Loader2, UserPlus, UserRoundCheck, Calendar as CalendarIcon, X, Save, Sparkles } from 'lucide-react';
import type { Employee } from '../employees/data';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from '@/components/ui/form';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { add, format } from 'date-fns';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

// defining local interface to avoid import issues
interface OnboardingProgram {
    id: string;
    title: string;
    description: string;
    appliesTo?: {
        departmentIds?: string[];
        positionIds?: string[];
    }
}

import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';


import { Position as JobPosition } from './types';
import { isActiveStatus } from '@/types';

const assignmentSchema = z.object({
    assignmentDate: z.date({ required_error: 'Томилох огноог сонгоно уу.' }),
    assignmentType: z.enum(['direct', 'trial']),
    trialEndDate: z.date().optional(),
}).refine(data => {
    if (data.assignmentType === 'trial') {
        return !!data.trialEndDate;
    }
    return true;
}, { message: "Туршилтын хугацаа дуусах огноог оруулна уу.", path: ["trialEndDate"] });

type AssignmentFormValues = z.infer<typeof assignmentSchema>;


interface AssignEmployeeDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    position: JobPosition | null;
    employees: Employee[];
    selectedEmployee: Employee | null;
    onAssignmentComplete: () => void;
}

export function AssignEmployeeDialog({
    open,
    onOpenChange,
    position,
    employees,
    selectedEmployee,
    onAssignmentComplete,
}: AssignEmployeeDialogProps) {
    const { firestore } = useFirebase();
    const { tDoc, tCollection } = useTenantWrite();
    const { toast } = useToast();
    const [step, setStep] = React.useState(1);
    const [localSelectedEmployee, setLocalSelectedEmployee] = React.useState<Employee | null>(null);

    const form = useForm<AssignmentFormValues>({
        resolver: zodResolver(assignmentSchema),
        defaultValues: {
            assignmentDate: new Date(),
            assignmentType: 'direct',
        }
    });

    const { isSubmitting } = form.formState;
    const assignmentType = form.watch('assignmentType');



    React.useEffect(() => {
        if (open) {
            // If an employee is pre-selected (e.g., from drag-and-drop),
            // go directly to the assignment details step.
            if (selectedEmployee) {
                setLocalSelectedEmployee(selectedEmployee);
                setStep(2);
            } else {
                // Otherwise, start from the employee selection step.
                setStep(1);
                setLocalSelectedEmployee(null);
            }
            form.reset({
                assignmentDate: new Date(),
                assignmentType: 'direct',
                trialEndDate: undefined,
            });
        }
    }, [open, selectedEmployee, form]);

    const assignableEmployees = React.useMemo(() => {
        return employees.filter(emp => isActiveStatus(emp.status) && !emp.positionId);
    }, [employees]);


    const handleFinalAssignment = async (values: AssignmentFormValues) => {
        if (!firestore || !position || !localSelectedEmployee) return;

        try {
            const batch = writeBatch(firestore);

            // 1. Update employee's document (departmentId from position to show алба correctly)
            const employeeDocRef = tDoc('employees', localSelectedEmployee.id);
            batch.update(employeeDocRef, {
                positionId: position.id,
                jobTitle: position.title,
                departmentId: position.departmentId ?? null,
            });

            // 2. Update position's filled count
            const positionDocRef = tDoc('positions', position.id);
            batch.update(positionDocRef, {
                filled: increment(1)
            });

            // 3. Add to employment history
            const historyCollectionRef = tCollection('employees', localSelectedEmployee.id, 'employmentHistory');
            const historyDocRef = doc(historyCollectionRef);
            let historyNotes = `${position.title} албан тушаалд ${format(values.assignmentDate, 'yyyy-MM-dd')}-нд томилов.`;
            if (values.assignmentType === 'trial' && values.trialEndDate) {
                historyNotes += ` Туршилтын хугацаа ${format(values.trialEndDate, 'yyyy-MM-dd')} хүртэл.`
            }

            batch.set(historyDocRef, {
                eventType: 'Албан тушаалд томилогдсон',
                eventDate: values.assignmentDate.toISOString(),
                notes: historyNotes,
                createdAt: new Date().toISOString(),
            });



            await batch.commit();

            toast({
                title: 'Амжилттай томилогдлоо',
            });

        } catch (error) {
            console.error("Error assigning employee: ", error);
            toast({
                variant: "destructive",
                title: "Алдаа",
                description: "Ажилтан томилоход алдаа гарлаа."
            });
        } finally {
            onOpenChange(false);
            onAssignmentComplete();
        }
    };

    const handleEmployeeSelect = (employee: Employee) => {
        setLocalSelectedEmployee(employee);
        setStep(2);
    }

    const renderStepOne = () => (
        <div className="pt-4">
            <ScrollArea className="h-72">
                <div className="space-y-2 pr-4">
                    {assignableEmployees.length === 0 ? (
                        <div className="text-center py-10 text-muted-foreground">
                            Томилгоогүй, идэвхтэй ажилтан байхгүй байна.
                        </div>
                    ) : (
                        assignableEmployees.map((emp) => (
                            <Card key={emp.id} onClick={() => handleEmployeeSelect(emp)} className="cursor-pointer hover:bg-muted/80 transition-colors">
                                <CardContent className="p-3 flex items-center gap-4">
                                    <Avatar>
                                        <AvatarImage src={emp.photoURL} />
                                        <AvatarFallback>{emp.firstName.charAt(0)}{emp.lastName.charAt(0)}</AvatarFallback>
                                    </Avatar>
                                    <div>
                                        <p className="font-semibold">{emp.firstName} {emp.lastName}</p>
                                        <p className="text-xs text-muted-foreground">{emp.employeeCode}</p>
                                    </div>
                                </CardContent>
                            </Card>
                        ))
                    )}
                </div>
            </ScrollArea>
        </div>
    );

    const renderStepTwo = () => (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(handleFinalAssignment)} className="space-y-4 pt-4">
                <div className="p-3 rounded-md border bg-muted/50 flex items-center gap-3">
                    <Avatar>
                        <AvatarImage src={localSelectedEmployee?.photoURL} />
                        <AvatarFallback>{localSelectedEmployee?.firstName?.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div>
                        <p className="font-semibold">{localSelectedEmployee?.firstName} {localSelectedEmployee?.lastName}</p>
                        <p className="text-xs text-muted-foreground">Дээрх ажилтанг томилох гэж байна.</p>
                    </div>
                </div>
                <FormField
                    control={form.control}
                    name="assignmentDate"
                    render={({ field }) => (
                        <FormItem className="flex flex-col">
                            <FormLabel>Томилогдох огноо</FormLabel>
                            <Popover><PopoverTrigger asChild><FormControl><Button variant={"outline"} className={cn("pl-3 text-left font-normal w-full", !field.value && "text-muted-foreground")}>{field.value ? (format(field.value, "yyyy-MM-dd")) : (<span>Огноо сонгох</span>)}<CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl></PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus /></PopoverContent>
                            </Popover>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField control={form.control} name="assignmentType" render={({ field }) => (
                    <FormItem className="space-y-3"><FormLabel>Томилгооны төрөл</FormLabel>
                        <FormControl>
                            <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex flex-col space-y-1">
                                <FormItem className="flex items-center space-x-3 space-y-0"><FormControl><RadioGroupItem value="direct" /></FormControl><FormLabel className="font-normal">Шууд томилох</FormLabel></FormItem>
                                <FormItem className="flex items-center space-x-3 space-y-0"><FormControl><RadioGroupItem value="trial" /></FormControl><FormLabel className="font-normal">Туршилтаар томилох</FormLabel></FormItem>
                            </RadioGroup>
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )} />
                {assignmentType === 'trial' && (
                    <FormField
                        control={form.control}
                        name="trialEndDate"
                        render={({ field }) => (
                            <FormItem className="flex flex-col">
                                <FormLabel>Туршилт дуусах огноо</FormLabel>
                                <Popover><PopoverTrigger asChild><FormControl><Button variant={"outline"} className={cn("pl-3 text-left font-normal w-full", !field.value && "text-muted-foreground")}>{field.value ? (format(field.value, "yyyy-MM-dd")) : (<span>Огноо сонгох</span>)}<CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl></PopoverTrigger>
                                    <PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus /></PopoverContent>
                                </Popover>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                )}

                <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => selectedEmployee ? onOpenChange(false) : setStep(1)} disabled={isSubmitting}>
                        Болих
                    </Button>
                    <Button type="submit" variant="success" disabled={isSubmitting}>
                        {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                        Баталгаажуулах
                    </Button>
                </DialogFooter>
            </form>
        </Form>
    )

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>"{position?.title}" ажлын байранд томилгоо хийх</DialogTitle>
                    {position?.isApproved === false && (
                        <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-md text-amber-700 text-xs font-medium flex items-center gap-2">
                            <Sparkles className="h-4 w-4 shrink-0" />
                            Анхааруулга: Энэ албан тушаал батлагдаагүй бүтцэд хамаарч байна. Ийм ажлын байранд хүн томилох нь эрсдэлтэй байж болзошгүй.
                        </div>
                    )}
                    <DialogDescription className="mt-2">
                        {step === 1 && 'Томилох ажилтнаа сонгоно уу.'}
                        {step === 2 && 'Томилгооны мэдээллийг оруулна уу.'}
                    </DialogDescription>
                </DialogHeader>

                {isSubmitting && <div className="absolute inset-0 bg-background/50 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>}

                {step === 1 && renderStepOne()}
                {step === 2 && localSelectedEmployee && renderStepTwo()}

            </DialogContent>
        </Dialog>
    );
}
