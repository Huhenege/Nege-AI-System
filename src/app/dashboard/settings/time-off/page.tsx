
'use client';

import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { ReferenceTable, type ReferenceItem } from "@/components/ui/reference-table";
import { useCollection, useFirebase, useMemoFirebase, useFetchDoc, setDocumentNonBlocking, tenantCollection, tenantDoc } from "@/firebase";
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
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
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save } from 'lucide-react';
import { AddWorkScheduleDialog } from './add-work-schedule-dialog';
import { Badge } from '@/components/ui/badge';
import { format, differenceInMinutes, parse } from 'date-fns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// --- Type Definitions ---

type WorkScheduleItem = ReferenceItem & {
    name: string;
    category: string;
    workingDays: string[];
    isActive: boolean;
    startTime?: string;
    endTime?: string;
};

type TimeOffRequestTypeItem = ReferenceItem & {
    name: string;
    paid: boolean;
}

type TimeConfig = {
    periodType?: 'CALENDAR_MONTH' | 'SHIFTED_MONTH';
    periodStartDay?: number;
    periodShiftEndDay?: number;
    nightShiftStartTime?: string;
    nightShiftEndTime?: string;
    compensatoryOffPeriod?: 'quarterly' | 'yearly';
}

type TimeOffRequestConfig = {
    requestDeadlineDays: number;
}

type VacationConfig = {
    maxSplits: number;
}

// --- Zod Schemas ---

const timeConfigSchema = z.object({
    periodType: z.enum(['CALENDAR_MONTH', 'SHIFTED_MONTH']),
    periodStartDay: z.coerce.number().min(1).max(31).optional(),
    periodShiftEndDay: z.coerce.number().min(1).max(31).optional(),
    nightShiftStartTime: z.string().regex(/^(?:2[0-3]|[01]?[0-9]):[0-5][0-9]$/, 'Цагийн формат буруу (HH:MM)'),
    nightShiftEndTime: z.string().regex(/^(?:2[0-3]|[01]?[0-9]):[0-5][0-9]$/, 'Цагийн формат буруу (HH:MM)'),
    compensatoryOffPeriod: z.enum(['quarterly', 'yearly']),
}).refine((data) => {
    if (data.periodType === 'SHIFTED_MONTH') {
        return !!data.periodStartDay && !!data.periodShiftEndDay;
    }
    return true;
}, {
    message: "Эхлэх болон дуусах өдрийг заавал оруулах шаардлагатай.",
    path: ["periodStartDay"],
});

type TimeConfigFormValues = z.infer<typeof timeConfigSchema>;

const timeOffRequestConfigSchema = z.object({
    requestDeadlineDays: z.coerce.number().min(0, "Хоног 0-ээс бага байж болохгүй."),
});

type TimeOffRequestConfigFormValues = z.infer<typeof timeOffRequestConfigSchema>;


// --- Components ---

function TimeConfigForm({ initialData }: { initialData: Partial<TimeConfigFormValues> }) {
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const configRef = useMemoFirebase(({ firestore, companyPath }) => (firestore ? tenantDoc(firestore, companyPath, 'company', 'timeConfig') : null), []);

    const form = useForm<TimeConfigFormValues>({
        resolver: zodResolver(timeConfigSchema),
        defaultValues: {
            periodType: initialData.periodType || 'CALENDAR_MONTH',
            periodStartDay: initialData.periodStartDay || 26,
            periodShiftEndDay: initialData.periodShiftEndDay || 25,
            nightShiftStartTime: initialData.nightShiftStartTime || '22:00',
            nightShiftEndTime: initialData.nightShiftEndTime || '06:00',
            compensatoryOffPeriod: initialData.compensatoryOffPeriod || 'quarterly',
        },
    });

    const onSubmit = (data: TimeConfigFormValues) => {
        if (!configRef) return;
        setDocumentNonBlocking(configRef, data, { merge: true });
        toast({ title: 'Амжилттай хадгаллаа' });
    }

    const periodType = form.watch('periodType');

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
                <Card className="shadow-premium border-slate-200/60">
                    <CardHeader>
                        <CardTitle>Цагийн ерөнхий тохиргоо</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div>
                            <h3 className="text-base font-medium">Цагийн тайлангийн үе</h3>
                            <p className="text-sm text-muted-foreground mb-4">
                                Цалин бодох эсвэл цагийн тайлан гаргах үеийг тохируулна уу. 'Календарийн сар' нь тухайн сарын 1-нээс эхэлж сарын сүүлийн өдөр дуусна. 'Тодорхой өдрөөр' нь өмнөх сарын X-нээс тухайн сарын Y-нд дуусах хугацааг тохируулна.
                            </p>
                            <FormField control={form.control} name="periodType" render={({ field }) => (
                                <FormItem><FormLabel>Үеийн төрөл</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                        <SelectContent>
                                            <SelectItem value="CALENDAR_MONTH">Календарийн сар (1-нээс сарын сүүлч)</SelectItem>
                                            <SelectItem value="SHIFTED_MONTH">Тодорхой өдрөөр</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <FormMessage /></FormItem>
                            )} />
                            {periodType === 'SHIFTED_MONTH' && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                                    <FormField control={form.control} name="periodStartDay" render={({ field }) => (
                                        <FormItem><FormLabel>Эхлэх өдөр</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                                    )} />
                                    <FormField control={form.control} name="periodShiftEndDay" render={({ field }) => (
                                        <FormItem><FormLabel>Дуусах өдөр</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                                    )} />
                                </div>
                            )}
                        </div>
                        <div>
                            <h3 className="text-base font-medium">Шөнийн цаг</h3>
                            <p className="text-sm text-muted-foreground mb-4">Энд тохируулсан цагийн хооронд ажилласан тохиолдолд шөнийн цагийн нэмэгдэл тооцно.</p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <FormField control={form.control} name="nightShiftStartTime" render={({ field }) => (
                                    <FormItem><FormLabel>Эхлэх цаг</FormLabel><FormControl><Input type="time" {...field} /></FormControl><FormMessage /></FormItem>
                                )} />
                                <FormField control={form.control} name="nightShiftEndTime" render={({ field }) => (
                                    <FormItem><FormLabel>Дуусах цаг</FormLabel><FormControl><Input type="time" {...field} /></FormControl><FormMessage /></FormItem>
                                )} />
                            </div>
                        </div>
                        <div>
                            <h3 className="text-base font-medium">Нөхөн амралтын бодлого</h3>
                            <p className="text-sm text-muted-foreground mb-4">Ажиллах ёстой цагаас хэтрүүлэн ажилласан цагийг сонгосон улирал эсвэл жилийн хугацаанд багтаан тооцож, нөхөн амраана.</p>
                            <FormField control={form.control} name="compensatoryOffPeriod" render={({ field }) => (
                                <FormItem><FormLabel>Нөхөн амралт бодох үе</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                        <SelectContent>
                                            <SelectItem value="quarterly">Улирал бүр</SelectItem>
                                            <SelectItem value="yearly">Жил бүр</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <FormMessage /></FormItem>
                            )} />
                        </div>
                    </CardContent>
                    <CardFooter>
                        <Button type="submit" disabled={form.formState.isSubmitting}>
                            {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Хадгалах
                        </Button>
                    </CardFooter>
                </Card>
            </form>
        </Form>
    )
}

function TimeOffRequestConfigForm({ initialData }: { initialData: Partial<TimeOffRequestConfigFormValues> }) {
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const configRef = useMemoFirebase(({ firestore, companyPath }) => (firestore ? tenantDoc(firestore, companyPath, 'company', 'timeOffRequestConfig') : null), []);

    const form = useForm<TimeOffRequestConfigFormValues>({
        resolver: zodResolver(timeOffRequestConfigSchema),
        defaultValues: {
            requestDeadlineDays: initialData.requestDeadlineDays || 0,
        },
    });

    React.useEffect(() => {
        form.reset({
            requestDeadlineDays: initialData.requestDeadlineDays || 0,
        });
    }, [initialData, form]);

    const onSubmit = (data: TimeOffRequestConfigFormValues) => {
        if (!configRef) return;
        setDocumentNonBlocking(configRef, data, { merge: true });
        toast({ title: 'Амжилттай хадгаллаа' });
    }

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
                <Card className="shadow-premium border-slate-200/60">
                    <CardHeader>
                        <CardTitle>Чөлөөний хүсэлтийн тохиргоо</CardTitle>
                        <CardDescription>Чөлөө авахтай холбоотой ерөнхий дүрмүүдийг энд тохируулна уу.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <FormField
                            control={form.control}
                            name="requestDeadlineDays"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Хүсэлт гаргах эцсийн хугацаа (хоногоор)</FormLabel>
                                    <FormControl>
                                        <Input type="number" placeholder="Жишээ нь: 3" {...field} />
                                    </FormControl>
                                    <FormDescription>
                                        Ажилтан чөлөө авах өдрөөс дор хаяж хэдэн хоногийн өмнө хүсэлтээ илгээх ёстойг заана.
                                    </FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </CardContent>
                    <CardFooter>
                        <Button type="submit" disabled={form.formState.isSubmitting}>
                            {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Хадгалах
                        </Button>
                    </CardFooter>
                </Card>
            </form>
        </Form>
    )
}

export default function TimeAndAttendanceSettingsPage() {
    const timeOffRequestTypesQuery = useMemoFirebase(({ firestore, companyPath }) => firestore ? tenantCollection(firestore, companyPath, 'timeOffRequestTypes') : null, []);
    const { data: timeOffRequestTypes, isLoading: loadingTimeOffRequestTypes } = useCollection<TimeOffRequestTypeItem>(timeOffRequestTypesQuery);

    const workSchedulesQuery = useMemoFirebase(({ firestore, companyPath }) => firestore ? tenantCollection(firestore, companyPath, 'workSchedules') : null, []);
    const { data: workSchedules, isLoading: loadingWorkSchedules } = useCollection<WorkScheduleItem>(workSchedulesQuery);

    const timeConfigRef = useMemoFirebase(({ firestore, companyPath }) => (firestore ? tenantDoc(firestore, companyPath, 'company', 'timeConfig') : null), []);
    const { data: timeConfig, isLoading: loadingTimeConfig } = useFetchDoc<TimeConfig>(timeConfigRef as any);

    const timeOffConfigRef = useMemoFirebase(({ firestore, companyPath }) => (firestore ? tenantDoc(firestore, companyPath, 'company', 'timeOffRequestConfig') : null), []);
    const { data: timeOffConfigData, isLoading: loadingTimeOffConfig } = useFetchDoc<TimeOffRequestConfig>(timeOffConfigRef as any);

    const vacationConfigRef = useMemoFirebase(({ firestore, companyPath }) => (firestore ? tenantDoc(firestore, companyPath, 'company', 'vacationConfig') : null), []);
    const { data: vacationConfigData, isLoading: loadingVacationConfig } = useFetchDoc<VacationConfig>(vacationConfigRef as any);

    const workScheduleColumns = [
        { key: 'name', header: 'Нэр' },
        { key: 'category', header: 'Ангилал' },
        {
            key: 'schedule',
            header: 'Цагийн хуваарь',
            render: (_: any, item: WorkScheduleItem) => {
                if (item.category === 'fixed' || item.category === 'shift') {
                    return `${item.startTime} - ${item.endTime}`;
                }
                return '-';
            }
        },
        {
            key: 'workingDays',
            header: 'Ажлын өдөр',
            render: (_: any, item: WorkScheduleItem) => (
                <div className="flex flex-wrap gap-1">
                    {item.workingDays?.map(day => <Badge key={day} variant="secondary" className="font-normal">{day.substring(0, 2)}</Badge>)}
                </div>
            )
        },
        {
            key: 'isActive',
            header: 'Төлөв',
            render: (_: any, item: WorkScheduleItem) => (
                <Badge variant={item.isActive ? 'default' : 'destructive'}>{item.isActive ? 'Идэвхтэй' : 'Идэвхгүй'}</Badge>
            )
        },
    ];

    const timeOffRequestTypeColumns = [
        { key: 'name', header: 'Нэр' },
        {
            key: 'paid',
            header: 'Төлбөр',
            render: (_: any, item: TimeOffRequestTypeItem) => (
                <Badge variant={item.paid ? 'secondary' : 'outline'}>{item.paid ? 'Цалинтай' : 'Цалингүй'}</Badge>
            )
        },
    ];

    const isLoading = loadingTimeOffConfig || loadingTimeConfig || loadingVacationConfig;

    return (
        <div className="space-y-8 ">
            <div className="space-y-1">
                <h2 className="text-2xl font-bold tracking-tight text-slate-800">Цаг бүртгэлийн тохиргоо</h2>
                <p className="text-sm text-muted-foreground max-w-2xl">
                    Чөлөө, цаг бүртгэл болон ээлжийн амралттай холбоотой ерөнхий дүрмүүдийг эндээс тохируулна.
                </p>
            </div>
            <div className="space-y-8">
                <Card className="shadow-premium border-slate-200/60">
                    <CardHeader>
                        <CardTitle>Ажлын цагийн хуваарь</CardTitle>
                        <CardDescription>Байгууллагын нийтлэг ажлын цагийн төрлүүдийг үүсгэж удирдах.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ReferenceTable
                            collectionName="workSchedules"
                            columns={workScheduleColumns}
                            itemData={workSchedules}
                            isLoading={loadingWorkSchedules}
                            dialogTitle="Ажлын цагийн хуваарь"
                            dialogComponent={AddWorkScheduleDialog}
                        />
                    </CardContent>
                </Card>

                {isLoading ? <Skeleton className="h-96 w-full" /> : <TimeOffRequestConfigForm initialData={timeOffConfigData || {}} />}

                {isLoading ? <Skeleton className="h-64 w-full" /> : <VacationConfigForm initialData={vacationConfigData || {}} />}

                {isLoading ? <Skeleton className="h-96 w-full" /> : <TimeConfigForm initialData={timeConfig || {}} />}

                <Card className="shadow-premium border-slate-200/60">
                    <CardHeader>
                        <CardTitle>Ирцийн хүсэлтийн төрөл</CardTitle>
                        <CardDescription>Ээлжийн амралт, ар гэрийн гачигдал зэрэг хүсэлтийн төрлийг удирдах.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ReferenceTable
                            collectionName="timeOffRequestTypes"
                            columns={timeOffRequestTypeColumns}
                            itemData={timeOffRequestTypes}
                            isLoading={loadingTimeOffRequestTypes}
                            dialogTitle="Хүсэлтийн төрөл"
                        />
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

const vacationConfigSchema = z.object({
    maxSplits: z.coerce.number().min(1, "Хамгийн багадаа 1 байх ёстой.").max(10, "Хэт олон хуваах боломжгүй."),
});

type VacationConfigFormValues = z.infer<typeof vacationConfigSchema>;

function VacationConfigForm({ initialData }: { initialData: Partial<VacationConfigFormValues> }) {
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const configRef = useMemoFirebase(({ firestore, companyPath }) => (firestore ? tenantDoc(firestore, companyPath, 'company', 'vacationConfig') : null), []);

    const form = useForm<VacationConfigFormValues>({
        resolver: zodResolver(vacationConfigSchema),
        defaultValues: {
            maxSplits: initialData.maxSplits || 1,
        },
    });

    React.useEffect(() => {
        form.reset({
            maxSplits: initialData.maxSplits || 1,
        });
    }, [initialData, form]);

    const onSubmit = (data: VacationConfigFormValues) => {
        if (!configRef) return;
        setDocumentNonBlocking(configRef, data, { merge: true });
        toast({ title: 'Амжилттай хадгаллаа' });
    }

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
                <Card className="shadow-premium border-slate-200/60">
                    <CardHeader>
                        <CardTitle>Ээлжийн амралтын тохиргоо</CardTitle>
                        <CardDescription>Ээлжийн амралтыг хэд хувааж авах боломжтойг энд тохируулна уу.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <FormField
                            control={form.control}
                            name="maxSplits"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Амралтыг хувааж авах дээд хязгаар</FormLabel>
                                    <FormControl>
                                        <Input type="number" placeholder="Жишээ нь: 2" {...field} />
                                    </FormControl>
                                    <FormDescription>
                                        Ажилтан жилийн ээлжийн амралтаа нийт хэдэн удаа хувааж авах боломжтойг заана.
                                    </FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </CardContent>
                    <CardFooter>
                        <Button type="submit" disabled={form.formState.isSubmitting}>
                            {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Хадгалах
                        </Button>
                    </CardFooter>
                </Card>
            </form>
        </Form>
    )
}
