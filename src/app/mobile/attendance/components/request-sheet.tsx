'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { Calendar as CalendarIcon, Loader2 } from 'lucide-react';
import { useFirebase, useCollection, useMemoFirebase, addDocumentNonBlocking, tenantCollection } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { DateRange } from 'react-day-picker';
import type { ReferenceItem, Employee, Position } from '@/types/attendance';
import { useMobileContainer } from '../../hooks/use-mobile-container';

// Schemas
const timeOffRequestSchema = z.object({
    type: z.string().min(1, "Хүсэлтийн төрлийг сонгоно уу."),
    dateRange: z.object({
        from: z.date({ required_error: 'Эхлэх огноог сонгоно уу.' }),
        to: z.date({ required_error: 'Дуусах огноог сонгоно уу.' }),
    }),
    reason: z.string().min(1, 'Шалтгаан хоосон байж болохгүй.'),
    approverId: z.string().min(1, 'Хүсэлт илгээх хүнээ сонгоно уу.'),
});

const attendanceRequestSchema = z.object({
    type: z.enum(['OVERTIME', 'LATE_ARRIVAL', 'REMOTE_WORK', 'CORRECTION'], { required_error: "Хүсэлтийн төрлийг сонгоно уу." }),
    dateRange: z.object({
        from: z.date({ required_error: 'Эхлэх огноог сонгоно уу.' }),
        to: z.date().optional(),
    }),
    startTime: z.string().optional(),
    endTime: z.string().optional(),
    hours: z.coerce.number().optional(),
    reason: z.string().min(1, "Шалтгаан хоосон байж болохгүй."),
    approverId: z.string().min(1, 'Хүсэлт илгээх хүнээ сонгоно уу.'),
}).refine(data => {
    if (data.type === 'OVERTIME') {
        return !!data.startTime && !!data.endTime;
    }
    return true;
}, { message: "Илүү цагийн эхлэх, дуусах цагийг оруулна уу.", path: ["startTime"] });

type TimeOffRequestFormValues = z.infer<typeof timeOffRequestSchema>;
type AttendanceRequestFormValues = z.infer<typeof attendanceRequestSchema>;

interface RequestSheetProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    employeeId: string | undefined;
    disabledDates: (Date | { before: Date })[];
}

export function RequestSheet({ open, onOpenChange, employeeId, disabledDates }: RequestSheetProps) {
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const container = useMobileContainer();
    const [requestType, setRequestType] = React.useState<'time-off' | 'attendance'>('time-off');

    const timeOffCollectionRef = useMemoFirebase(({ companyPath }) => (
        firestore && employeeId ? tenantCollection(firestore, companyPath, `employees/${employeeId}/timeOffRequests`) : null
    ), [firestore, employeeId]);
    
    const attendanceCollectionRef = useMemoFirebase(({ companyPath }) => (
        firestore && employeeId ? tenantCollection(firestore, companyPath, `employees/${employeeId}/attendanceRequests`) : null
    ), [firestore, employeeId]);

    const requestTypesQuery = useMemoFirebase(({ companyPath }) => (
        firestore ? tenantCollection(firestore, companyPath, 'timeOffRequestTypes') : null
    ), [firestore]);
    
    const positionsQuery = useMemoFirebase(({ companyPath }) => (
        firestore ? query(tenantCollection(firestore, companyPath, 'positions'), where('canApproveAttendance', '==', true)) : null
    ), [firestore]);
    
    const employeesQuery = useMemoFirebase(({ companyPath }) => (
        firestore ? tenantCollection(firestore, companyPath, 'employees') : null
    ), [firestore]);

    const { data: requestTypes, isLoading: isLoadingTypes } = useCollection<ReferenceItem>(requestTypesQuery);
    const { data: approverPositions, isLoading: isLoadingPositions } = useCollection<Position>(positionsQuery);
    const { data: employees, isLoading: isLoadingEmployees } = useCollection<Employee>(employeesQuery);

    const approvers = React.useMemo(() => {
        if (!approverPositions || !employees) return [];
        const approverPositionIds = new Set(approverPositions.map(p => p.id));
        return employees.filter(emp => emp.positionId && approverPositionIds.has(emp.positionId));
    }, [approverPositions, employees]);

    const timeOffForm = useForm<TimeOffRequestFormValues>({ resolver: zodResolver(timeOffRequestSchema) });
    const attendanceForm = useForm<AttendanceRequestFormValues>({ resolver: zodResolver(attendanceRequestSchema) });

    const { isSubmitting: isSubmittingTimeOff } = timeOffForm.formState;
    const { isSubmitting: isSubmittingAttendance } = attendanceForm.formState;
    const isSubmitting = isSubmittingTimeOff || isSubmittingAttendance;

    const onTimeOffSubmit = async (values: TimeOffRequestFormValues) => {
        if (!timeOffCollectionRef || !employeeId) return;
        const approver = approvers.find(a => a.id === values.approverId);
        await addDocumentNonBlocking(timeOffCollectionRef, {
            employeeId,
            type: values.type,
            startDate: values.dateRange.from.toISOString(),
            endDate: values.dateRange.to.toISOString(),
            reason: values.reason,
            approverId: values.approverId,
            approverName: approver ? `${approver.firstName} ${approver.lastName}` : '',
            status: 'Хүлээгдэж буй',
            createdAt: new Date().toISOString(),
        });
        toast({ title: 'Чөлөөний хүсэлт амжилттай илгээгдлээ' });
        onOpenChange(false);
        timeOffForm.reset();
    };

    const onAttendanceSubmit = async (values: AttendanceRequestFormValues) => {
        if (!attendanceCollectionRef || !employeeId) return;
        const approver = approvers.find(a => a.id === values.approverId);
        await addDocumentNonBlocking(attendanceCollectionRef, {
            employeeId,
            ...values,
            startDate: values.dateRange.from.toISOString(),
            endDate: values.dateRange.to?.toISOString() || values.dateRange.from.toISOString(),
            approverId: values.approverId,
            approverName: approver ? `${approver.firstName} ${approver.lastName}` : '',
            status: 'Хүлээгдэж буй',
            createdAt: new Date().toISOString(),
        });
        toast({ title: 'Ирцийн хүсэлт амжилттай илгээгдлээ' });
        onOpenChange(false);
        attendanceForm.reset();
    };

    const attendanceRequestType = attendanceForm.watch('type');
    const isLoading = isLoadingTypes || isLoadingPositions || isLoadingEmployees;

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent
                side="bottom"
                container={container}
                className={cn(
                    // Use dvh so the sheet fits even with mobile browser bars/keyboard.
                    "rounded-t-[20px] h-[92dvh] max-h-[92dvh] w-full overflow-hidden p-0"
                )}
            >
                <div className="flex h-full flex-col px-6 pt-6 pb-[calc(env(safe-area-inset-bottom)+24px)]">
                    <SheetHeader className="mb-4 text-left shrink-0">
                        <SheetTitle>Шинэ хүсэлт</SheetTitle>
                    </SheetHeader>

                    <Tabs
                        value={requestType}
                        onValueChange={(value) => setRequestType(value as 'time-off' | 'attendance')}
                        className="w-full flex-1 min-h-0 flex flex-col"
                    >
                        <TabsList className="grid w-full grid-cols-2 mb-4 shrink-0">
                            <TabsTrigger value="time-off">Чөлөө</TabsTrigger>
                            <TabsTrigger value="attendance">Ирц</TabsTrigger>
                        </TabsList>

                        <div className="flex-1 min-h-0 overflow-y-auto">
                    
                    <TabsContent value="time-off" className="mt-0">
                        <Form {...timeOffForm}>
                            <form onSubmit={timeOffForm.handleSubmit(onTimeOffSubmit)} className="space-y-4">
                                <FormField control={timeOffForm.control} name="type" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Хүсэлтийн төрөл</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl>
                                                <SelectTrigger disabled={isLoadingTypes} className="h-12">
                                                    <SelectValue placeholder={isLoadingTypes ? "Ачааллаж байна..." : "Төрөл сонгоно уу..."} />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {requestTypes?.map(type => (
                                                    <SelectItem key={type.id} value={type.name}>{type.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                
                                <FormField control={timeOffForm.control} name="dateRange" render={({ field }) => (
                                    <FormItem className="flex flex-col">
                                        <FormLabel>Хугацаа</FormLabel>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <FormControl>
                                                    <Button 
                                                        variant="outline" 
                                                        className={cn(
                                                            "pl-3 text-left font-normal w-full h-12", 
                                                            !field.value?.from && "text-muted-foreground"
                                                        )}
                                                    >
                                                        {field.value?.from ? (
                                                            field.value.to ? (
                                                                <>{format(field.value.from, "yyyy/MM/dd")} - {format(field.value.to, "yyyy/MM/dd")}</>
                                                            ) : (
                                                                format(field.value.from, "yyyy/MM/dd")
                                                            )
                                                        ) : (
                                                            <span>Огноо сонгох</span>
                                                        )}
                                                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                                    </Button>
                                                </FormControl>
                                            </PopoverTrigger>
                                            <PopoverContent
                                                container={container}
                                                className="w-auto p-0 touch-manipulation"
                                                align="start"
                                                side="top"
                                                sideOffset={8}
                                                onOpenAutoFocus={(e) => e.preventDefault()}
                                            >
                                                <Calendar 
                                                    mode="range" 
                                                    defaultMonth={field.value?.from} 
                                                    selected={{ from: field.value?.from, to: field.value?.to }} 
                                                    onSelect={field.onChange} 
                                                    numberOfMonths={1} 
                                                    disabled={disabledDates}
                                                    className="touch-manipulation"
                                                />
                                            </PopoverContent>
                                        </Popover>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                
                                <FormField control={timeOffForm.control} name="reason" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Шалтгаан</FormLabel>
                                        <FormControl>
                                            <Textarea className="min-h-[100px]" placeholder="Тайлбар бичих..." {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                
                                <FormField control={timeOffForm.control} name="approverId" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Хүсэлт илгээх</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl>
                                                <SelectTrigger disabled={isLoading} className="h-12">
                                                    <SelectValue placeholder={isLoading ? "Ачааллаж байна..." : "Батлах ажилтан..."} />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {approvers?.map(approver => (
                                                    <SelectItem key={approver.id} value={approver.id}>
                                                        {approver.firstName} {approver.lastName}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                
                                <div className="pt-4 flex gap-3 pb-2">
                                    <Button type="button" variant="outline" className="flex-1 h-12" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
                                        Цуцлах
                                    </Button>
                                    <Button type="submit" disabled={isSubmitting} className="bg-primary flex-1 h-12">
                                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                        Илгээх
                                    </Button>
                                </div>
                            </form>
                        </Form>
                    </TabsContent>
                    
                    <TabsContent value="attendance" className="mt-0">
                        <Form {...attendanceForm}>
                            <form onSubmit={attendanceForm.handleSubmit(onAttendanceSubmit)} className="space-y-4">
                                <FormField control={attendanceForm.control} name="type" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Төрөл</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl>
                                                <SelectTrigger className="h-12">
                                                    <SelectValue placeholder="Сонгох..." />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="OVERTIME">Илүү цаг</SelectItem>
                                                <SelectItem value="LATE_ARRIVAL">Хоцролт</SelectItem>
                                                <SelectItem value="REMOTE_WORK">Гадуур ажиллах</SelectItem>
                                                <SelectItem value="CORRECTION">Ирц засах</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                
                                <FormField control={attendanceForm.control} name="dateRange" render={({ field }) => (
                                    <FormItem className="flex flex-col">
                                        <FormLabel>Хугацаа</FormLabel>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <FormControl>
                                                    <Button 
                                                        variant="outline" 
                                                        className={cn(
                                                            "pl-3 text-left font-normal w-full h-12", 
                                                            !field.value?.from && "text-muted-foreground"
                                                        )}
                                                    >
                                                        {field.value?.from ? (
                                                            field.value.to ? (
                                                                <>{format(field.value.from, "yyyy/MM/dd")} - {format(field.value.to, "yyyy/MM/dd")}</>
                                                            ) : (
                                                                format(field.value.from, "yyyy/MM/dd")
                                                            )
                                                        ) : (
                                                            <span>Огноо сонгох</span>
                                                        )}
                                                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                                    </Button>
                                                </FormControl>
                                            </PopoverTrigger>
                                            <PopoverContent
                                                container={container}
                                                className="w-auto p-0 touch-manipulation"
                                                align="start"
                                                side="top"
                                                sideOffset={8}
                                                onOpenAutoFocus={(e) => e.preventDefault()}
                                            >
                                                <Calendar 
                                                    mode="range" 
                                                    defaultMonth={field.value?.from} 
                                                    selected={field.value?.from ? { from: field.value.from, to: field.value.to } : undefined} 
                                                    onSelect={(range) => field.onChange(range as DateRange)} 
                                                    numberOfMonths={1}
                                                    className="touch-manipulation"
                                                />
                                            </PopoverContent>
                                        </Popover>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                
                                {(attendanceRequestType === 'OVERTIME' || attendanceRequestType === 'CORRECTION') && (
                                    <div className="grid grid-cols-2 gap-4">
                                        <FormField control={attendanceForm.control} name="startTime" render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Эхлэх цаг</FormLabel>
                                                <FormControl>
                                                    <Input type="time" className="h-12" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )} />
                                        <FormField control={attendanceForm.control} name="endTime" render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Дуусах цаг</FormLabel>
                                                <FormControl>
                                                    <Input type="time" className="h-12" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )} />
                                    </div>
                                )}
                                
                                <FormField control={attendanceForm.control} name="reason" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Тайлбар</FormLabel>
                                        <FormControl>
                                            <Textarea className="min-h-[100px]" placeholder="Тайлбар бичих..." {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                
                                <FormField control={attendanceForm.control} name="approverId" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Хүсэлт илгээх</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl>
                                                <SelectTrigger disabled={isLoading} className="h-12">
                                                    <SelectValue placeholder={isLoading ? "Ачааллаж байна..." : "Батлах ажилтан..."} />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {approvers?.map(approver => (
                                                    <SelectItem key={approver.id} value={approver.id}>
                                                        {approver.firstName} {approver.lastName}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                
                                <div className="pt-4 flex gap-3 pb-2">
                                    <Button type="button" variant="outline" className="flex-1 h-12" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
                                        Цуцлах
                                    </Button>
                                    <Button type="submit" disabled={isSubmitting} className="bg-primary flex-1 h-12">
                                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                        Илгээх
                                    </Button>
                                </div>
                            </form>
                        </Form>
                    </TabsContent>
                        </div>
                    </Tabs>
                </div>
            </SheetContent>
        </Sheet>
    );
}
