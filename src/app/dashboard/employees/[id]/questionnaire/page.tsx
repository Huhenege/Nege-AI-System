'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/patterns/page-layout';
import {
    ArrowLeft,
    Calendar as CalendarIcon,
    Camera,
    Save,
    Loader2,
    Phone,
    Mail,
    PlusCircle,
    Trash2,
    Facebook,
    Instagram,
    User,
    GraduationCap,
    Languages,
    Award,
    Users,
    Briefcase,
    CheckCircle2,
    FileText,
    ChevronRight,
    Info,
    Sparkles,
    Upload,
    Lock,
    Unlock
} from 'lucide-react';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { VerticalTabMenu } from '@/components/ui/vertical-tab-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { useCollection, useDoc, useFirebase, useMemoFirebase, setDocumentNonBlocking, addDocumentNonBlocking, updateDocumentNonBlocking, tenantCollection, tenantDoc } from '@/firebase';
import { collection, doc, setDoc, updateDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { ToastAction } from '@/components/ui/toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

import {
    FullQuestionnaireValues,
    generalInfoSchema,
    contactInfoSchema,
    educationHistorySchema,
    languageSkillsSchema,
    professionalTrainingSchema,
    familyInfoSchema,
    workExperienceHistorySchema,
} from '@/types/questionnaire';
import { Employee, ReferenceItem } from '@/types';
import { INSURANCE_TYPES } from '@/data/insurance-types';
import { CVUploadDialog } from './cv-upload-dialog';

const calculateCompletionPercentage = (data: Partial<FullQuestionnaireValues>): number => {
    if (!data) return 0;

    const fields = [
        'lastName', 'firstName', 'registrationNumber', 'birthDate', 'gender',
        'personalPhone', 'personalEmail', 'homeAddress',
    ];

    const arrayFields = [
        { name: 'emergencyContacts', notApplicableKey: null },
        { name: 'education', notApplicableKey: 'educationNotApplicable' },
        { name: 'languages', notApplicableKey: 'languagesNotApplicable' },
        { name: 'trainings', notApplicableKey: 'trainingsNotApplicable' },
        { name: 'familyMembers', notApplicableKey: 'familyMembersNotApplicable' },
        { name: 'experiences', notApplicableKey: 'experienceNotApplicable' },
    ];

    const totalFields = fields.length + arrayFields.length;
    let filledFields = 0;

    fields.forEach(field => {
        const value = data[field as keyof typeof data];
        if (value !== null && value !== undefined && value !== '') {
            filledFields++;
        }
    });

    arrayFields.forEach(fieldInfo => {
        const notApplicable = fieldInfo.notApplicableKey ? data[fieldInfo.notApplicableKey as keyof typeof data] : false;
        if (notApplicable) {
            filledFields++;
        } else {
            const arrayData = data[fieldInfo.name as keyof typeof data] as unknown[] | undefined;
            if (Array.isArray(arrayData) && arrayData.length > 0) {
                filledFields++;
            }
        }
    });

    return totalFields > 0 ? (filledFields / totalFields) * 100 : 0;
};

const transformDates = (data: any) => {
    if (!data) return data;
    const transformedData = { ...data };
    const dateFields = ['birthDate', 'disabilityDate'];
    const arrayDateFields = ['entryDate', 'gradDate', 'startDate', 'endDate'];

    for (const field of dateFields) {
        if (transformedData[field] && typeof transformedData[field] === 'object' && 'seconds' in transformedData[field]) {
            transformedData[field] = transformedData[field].toDate();
        }
    }

    ['education', 'trainings', 'experiences'].forEach(arrayKey => {
        if (transformedData[arrayKey]) {
            transformedData[arrayKey] = transformedData[arrayKey].map((item: any) => {
                const newItem = { ...item };
                for (const field of arrayDateFields) {
                    if (newItem[field] && typeof newItem[field] === 'object' && 'seconds' in newItem[field]) {
                        newItem[field] = newItem[field].toDate();
                    }
                }
                return newItem;
            });
        }
    });

    // Family members: handle Firestore Timestamp -> Date
    if (Array.isArray(transformedData.familyMembers)) {
        transformedData.familyMembers = transformedData.familyMembers.map((m: any) => {
            const mm = { ...m };
            if (mm.birthDate && typeof mm.birthDate === 'object' && 'seconds' in mm.birthDate) {
                mm.birthDate = mm.birthDate.toDate();
            }
            return mm;
        });
    }

    return transformedData;
}

// Tab configuration
const TABS = [
    { id: 'general', label: 'Ерөнхий', icon: User },
    { id: 'contact', label: 'Холбоо барих', icon: Phone },
    { id: 'education', label: 'Боловсрол', icon: GraduationCap },
    { id: 'language', label: 'Хэл', icon: Languages },
    { id: 'training', label: 'Мэргэшил', icon: Award },
    { id: 'family', label: 'Гэр бүл', icon: Users },
    { id: 'experience', label: 'Туршлага', icon: Briefcase },
];

function normalizeRegistrationNumber(value: string): string {
    return (value || '').trim().replace(/\s+/g, '');
}

/** РД шалгалт индекс шаардлагатай үед indexUrl-тэй алдаа */
export class RegNoIndexError extends Error {
    constructor(message: string, public indexUrl: string) {
        super(message);
        this.name = 'RegNoIndexError';
    }
}

async function checkRegistrationNumberDuplicate(
    registrationNumber: string,
    currentEmployeeId: string
): Promise<{ duplicate: boolean; existingEmployeeId?: string }> {
    const normalized = normalizeRegistrationNumber(registrationNumber);
    if (!normalized) return { duplicate: false };
    const res = await fetch('/api/check-registration-number', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ registrationNumber: normalized, currentEmployeeId }),
    });
    let json: { error?: string; duplicate?: boolean; detail?: string; indexUrl?: string; existingEmployeeId?: string } = {};
    try {
        json = await res.json();
    } catch {
        // Response body empty or invalid JSON
    }
    if (!res.ok) {
        const errMsg = json.detail || json.error || 'Регистрийн дугаар шалгахад алдаа гарлаа.';
        if (res.status === 503 && json.indexUrl) {
            throw new RegNoIndexError(errMsg, json.indexUrl);
        }
        throw new Error(errMsg);
    }
    return {
        duplicate: !!json.duplicate,
        existingEmployeeId: json.existingEmployeeId,
    };
}

function normalizeIdCardNumber(value: string): string {
    return (value || '').trim().replace(/\s+/g, '');
}

async function checkIdCardNumberDuplicate(
    idCardNumber: string,
    currentEmployeeId: string
): Promise<{ duplicate: boolean; existingEmployeeId?: string }> {
    const normalized = normalizeIdCardNumber(idCardNumber);
    if (!normalized) return { duplicate: false };
    const res = await fetch('/api/check-id-card-number', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idCardNumber: normalized, currentEmployeeId }),
    });
    let json: { error?: string; duplicate?: boolean; detail?: string; indexUrl?: string; existingEmployeeId?: string } = {};
    try {
        json = await res.json();
    } catch {}
    if (!res.ok) {
        const errMsg = json.detail || json.error || 'ТТД шалгахад алдаа гарлаа.';
        if (res.status === 503 && json.indexUrl) {
            throw new RegNoIndexError(errMsg, json.indexUrl);
        }
        throw new Error(errMsg);
    }
    return {
        duplicate: !!json.duplicate,
        existingEmployeeId: json.existingEmployeeId,
    };
}

interface FormSectionProps<T extends z.ZodType<any, any>> {
    docRef: any;
    employeeDocRef: any;
    defaultValues: z.infer<T> | undefined;
    schema: T;
    /** Optional: runs before save. Return error string or { error, indexUrl? } or { error, existingEmployeeId? } to abort, null to proceed. May mutate data. */
    beforeSubmit?: (data: z.infer<T>) => Promise<string | { error: string; indexUrl?: string; existingEmployeeId?: string } | null>;
    children: (form: any, isSubmitting: boolean) => React.ReactNode;
}

function FormSection<T extends z.ZodType<any, any>>({ docRef, employeeDocRef, defaultValues, schema, beforeSubmit, children }: FormSectionProps<T>) {
    const { toast } = useToast();
    const form = useForm<z.infer<T>>({
        resolver: zodResolver(schema),
        defaultValues,
    });

    React.useEffect(() => {
        if (defaultValues) {
            form.reset(defaultValues);
        }
    }, [defaultValues, form]);

    const { isSubmitting } = form.formState;

    const onSubmit = async (data: z.infer<T>) => {
        if (!docRef || !employeeDocRef) return;
        const merged = { ...defaultValues, ...data };
        const currentData = Object.fromEntries(
            Object.entries(merged).filter(([, v]) => v !== undefined)
        ) as Record<string, unknown>;

        if (beforeSubmit) {
            const err = await beforeSubmit(currentData as z.infer<T>);
            if (err) {
                if (typeof err === 'object' && err?.indexUrl) {
                    toast({
                        variant: 'destructive',
                        title: 'Индекс шаардлагатай',
                        description: err.error,
                        action: (
                            <ToastAction asChild altText="Индекс үүсгэх">
                                <a href={err.indexUrl} target="_blank" rel="noopener noreferrer" className="font-medium">
                                    Индекс үүсгэх
                                </a>
                            </ToastAction>
                        ),
                    });
                } else if (typeof err === 'object' && err?.existingEmployeeId) {
                    toast({
                        variant: 'destructive',
                        title: 'Алдаа',
                        description: err.error,
                        action: (
                            <ToastAction asChild altText="Тэр ажилтан руу очих">
                                <Link href={`/dashboard/employees/${err.existingEmployeeId}`} className="font-medium">
                                    Тэр ажилтан руу очих
                                </Link>
                            </ToastAction>
                        ),
                    });
                } else {
                    toast({ variant: 'destructive', title: 'Алдаа', description: typeof err === 'string' ? err : err?.error });
                }
                return;
            }
        }

        setDocumentNonBlocking(docRef, currentData, { merge: true });
        const newCompletion = calculateCompletionPercentage(currentData);
        updateDocumentNonBlocking(employeeDocRef, { questionnaireCompletion: newCompletion });
        toast({ title: 'Амжилттай хадгаллаа' });
    };

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                {children(form, isSubmitting)}
            </form>
        </Form>
    );
}

// Reusable form field wrapper
const FieldGroup = ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={cn("bg-white rounded-xl border p-5", className)}>{children}</div>
);

const SectionTitle = ({ children, icon: Icon }: { children: React.ReactNode; icon?: any }) => (
    <div className="flex items-center gap-2 mb-4 pb-3 border-b">
        {Icon && <Icon className="w-4 h-4 text-primary" />}
        <h3 className="text-sm font-semibold text-slate-800">{children}</h3>
    </div>
);

const SaveButton = ({ isSubmitting }: { isSubmitting: boolean }) => (
    <div className="flex justify-end pt-4">
        <Button type="submit" disabled={isSubmitting} className="gap-2">
            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Хадгалах
        </Button>
    </div>
);

// Form Components
function GeneralInfoForm({ form, isSubmitting, references, employeeId }: { form: any, isSubmitting: boolean, references: any; employeeId: string }) {
    const hasDisability = form.watch("hasDisability");
    const hasDriversLicense = form.watch("hasDriversLicense");
    const driverLicenseCategoryItems = ["A", "B", "C", "D", "E", "M"];
    const [isCheckingRegNo, setIsCheckingRegNo] = React.useState(false);
    const [isCheckingTtd, setIsCheckingTtd] = React.useState(false);
    const { toast } = useToast();

    const [existingEmployeeIdForLink, setExistingEmployeeIdForLink] = React.useState<string | null>(null);
    const [existingEmployeeIdForTtdLink, setExistingEmployeeIdForTtdLink] = React.useState<string | null>(null);

    const handleRegistrationNumberBlur = React.useCallback(async () => {
        const value = form.getValues('registrationNumber');
        if (!value || !employeeId) {
            setExistingEmployeeIdForLink(null);
            return;
        }
        setIsCheckingRegNo(true);
        form.clearErrors('registrationNumber');
        setExistingEmployeeIdForLink(null);
        try {
            const result = await checkRegistrationNumberDuplicate(value, employeeId);
            if (result.duplicate) {
                form.setError('registrationNumber', { message: 'Энэ регистрийн дугаар өөр ажилтанд бүртгэгдсэн байна.' });
                if (result.existingEmployeeId) setExistingEmployeeIdForLink(result.existingEmployeeId);
            }
        } catch {
            // Network error – allow save, API will re-check on submit
        } finally {
            setIsCheckingRegNo(false);
        }
    }, [form, employeeId]);

    const handleIdCardNumberBlur = React.useCallback(async () => {
        const value = form.getValues('idCardNumber');
        if (!value || !employeeId) {
            setExistingEmployeeIdForTtdLink(null);
            return;
        }
        setIsCheckingTtd(true);
        form.clearErrors('idCardNumber');
        setExistingEmployeeIdForTtdLink(null);
        try {
            const result = await checkIdCardNumberDuplicate(value, employeeId);
            if (result.duplicate) {
                form.setError('idCardNumber', { message: 'Энэ ТТД өөр ажилтанд бүртгэгдсэн байна.' });
                if (result.existingEmployeeId) setExistingEmployeeIdForTtdLink(result.existingEmployeeId);
            }
        } catch {
            // Network error – allow save, API will re-check on submit
        } finally {
            setIsCheckingTtd(false);
        }
    }, [form, employeeId]);

    return (
        <>
            <FieldGroup>
                <SectionTitle icon={User}>Хувийн мэдээлэл</SectionTitle>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <FormField control={form.control} name="lastName" render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-xs text-slate-500">Овог</FormLabel>
                            <FormControl><Input placeholder="Овог" {...field} value={field.value || ''} className="h-10" /></FormControl>
                            <FormMessage />
                        </FormItem>
                    )} />
                    <FormField control={form.control} name="firstName" render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-xs text-slate-500">Нэр</FormLabel>
                            <FormControl><Input placeholder="Нэр" {...field} value={field.value || ''} className="h-10" /></FormControl>
                            <FormMessage />
                        </FormItem>
                    )} />
                    <FormField control={form.control} name="registrationNumber" render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-xs text-slate-500">Регистрийн дугаар</FormLabel>
                            <FormControl>
                                <div className="relative">
                                    <Input
                                        placeholder="АА00112233"
                                        {...field}
                                        value={field.value || ''}
                                        className="h-10 font-mono pr-10"
                                        onBlur={() => { field.onBlur(); handleRegistrationNumberBlur(); }}
                                    />
                                    {isCheckingRegNo && (
                                        <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                                    )}
                                </div>
                            </FormControl>
                            <FormMessage />
                            {existingEmployeeIdForLink && (
                                <div className="mt-2">
                                    <Button variant="outline" size="sm" className="h-8 text-xs" asChild>
                                        <Link href={`/dashboard/employees/${existingEmployeeIdForLink}`}>
                                            Бүртгэгдсэн ажилтан руу очих
                                        </Link>
                                    </Button>
                                </div>
                            )}
                        </FormItem>
                    )} />
                    <FormField control={form.control} name="citizenshipCountryId" render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-xs text-slate-500">Иргэншил</FormLabel>
                            <Select
                                value={field.value || '__none__'}
                                onValueChange={(val) => field.onChange(val === '__none__' ? undefined : val)}
                            >
                                <FormControl>
                                    <SelectTrigger className="h-10">
                                        <SelectValue placeholder="Сонгох" />
                                    </SelectTrigger>
                                </FormControl>
                                <SelectContent className="max-h-[320px]">
                                    <SelectItem value="__none__">Сонгоогүй</SelectItem>
                                    {[...(references?.countries || [])]
                                        .sort((a: ReferenceItem, b: ReferenceItem) => (a.id || '').localeCompare(b.id || ''))
                                        .map((item: ReferenceItem) => (
                                        <SelectItem key={item.id} value={item.id}>
                                            <span className="font-mono text-blue-600 mr-2">{item.id}</span>
                                            <span className="text-sm">{item.name}</span>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <p className="text-[11px] text-muted-foreground mt-1">
                                Иргэншил нь кодтойгоор сонгогдоно (жишээ: 001 - Монгол).
                            </p>
                            <FormMessage />
                        </FormItem>
                    )} />
                    <FormField control={form.control} name="birthDate" render={({ field }) => (
                        <FormItem className="flex flex-col">
                            <FormLabel className="text-xs text-slate-500">Төрсөн огноо</FormLabel>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <FormControl>
                                        <Button variant="outline" className={cn("h-10 w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                                            {field.value ? format(new Date(field.value), "yyyy-MM-dd") : <span>Огноо сонгох</span>}
                                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                        </Button>
                                    </FormControl>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar mode="single" captionLayout="dropdown" fromYear={1960} toYear={new Date().getFullYear()} selected={field.value} onSelect={field.onChange} disabled={(date) => date > new Date()} initialFocus />
                                </PopoverContent>
                            </Popover>
                            <FormMessage />
                        </FormItem>
                    )} />
                    <FormField control={form.control} name="gender" render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-xs text-slate-500">Хүйс</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl><SelectTrigger className="h-10"><SelectValue placeholder="Сонгох" /></SelectTrigger></FormControl>
                                <SelectContent>
                                    <SelectItem value="male">Эрэгтэй</SelectItem>
                                    <SelectItem value="female">Эмэгтэй</SelectItem>
                                </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                    )} />
                    <FormField control={form.control} name="idCardNumber" render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-xs text-slate-500">ТТД (Татвар төлөгчийн дугаар)</FormLabel>
                            <FormControl>
                                <div className="relative">
                                    <Input
                                        placeholder="Татвар төлөгчийн дугаар"
                                        {...field}
                                        value={field.value || ''}
                                        className="h-10 font-mono pr-10"
                                        onBlur={() => { field.onBlur(); handleIdCardNumberBlur(); }}
                                    />
                                    {isCheckingTtd && (
                                        <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                                    )}
                                </div>
                            </FormControl>
                            <FormMessage />
                            {existingEmployeeIdForTtdLink && (
                                <div className="mt-2">
                                    <Button variant="outline" size="sm" className="h-8 text-xs" asChild>
                                        <Link href={`/dashboard/employees/${existingEmployeeIdForTtdLink}`}>
                                            Бүртгэгдсэн ажилтан руу очих
                                        </Link>
                                    </Button>
                                </div>
                            )}
                        </FormItem>
                    )} />
                </div>
            </FieldGroup>

            {/* Insurance Type */}
            <FieldGroup>
                <SectionTitle icon={Info}>НДШТ даатгуулагчийн төрөл</SectionTitle>
                <FormField control={form.control} name="insuranceTypeCode" render={({ field }) => (
                    <FormItem>
                        <FormLabel className="text-xs text-slate-500">Даатгуулагчийн төрөл сонгох</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || ''}>
                            <FormControl>
                                <SelectTrigger className="h-10">
                                    <SelectValue placeholder="НДШТ төрөл сонгоно уу" />
                                </SelectTrigger>
                            </FormControl>
                            <SelectContent className="max-h-[300px]">
                                {INSURANCE_TYPES.map((type) => (
                                    <SelectItem key={type.code} value={type.code}>
                                        <span className="font-mono text-blue-600 mr-2">{type.code}</span>
                                        <span className="text-sm">{type.name}</span>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {field.value && (
                            <p className="text-xs text-muted-foreground mt-1">
                                {INSURANCE_TYPES.find(t => t.code === field.value)?.name}
                            </p>
                        )}
                        <FormMessage />
                    </FormItem>
                )} />
            </FieldGroup>

            {/* Disability */}
            <FieldGroup>
                <FormField control={form.control} name="hasDisability" render={({ field }) => (
                    <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                        <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                        <FormLabel className="font-medium">Хөгжлийн бэрхшээлтэй эсэх</FormLabel>
                    </FormItem>
                )} />
                {hasDisability && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pl-6 animate-in slide-in-from-top-2">
                        <FormField control={form.control} name="disabilityPercentage" render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-xs text-slate-500">Хөдөлмөрийн чадвар алдалтын хувь (%)</FormLabel>
                                <FormControl><Input type="number" placeholder="%" {...field} value={field.value || ''} className="h-10" /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                        <FormField control={form.control} name="disabilityDate" render={({ field }) => (
                            <FormItem className="flex flex-col">
                                <FormLabel className="text-xs text-slate-500">Огноо</FormLabel>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <FormControl>
                                            <Button variant="outline" className={cn("h-10 w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                                                {field.value ? format(new Date(field.value), "yyyy-MM-dd") : <span>Огноо</span>}
                                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                            </Button>
                                        </FormControl>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0" align="start">
                                        <Calendar mode="single" captionLayout="dropdown" fromYear={1980} toYear={new Date().getFullYear()} selected={field.value} onSelect={field.onChange} initialFocus />
                                    </PopoverContent>
                                </Popover>
                                <FormMessage />
                            </FormItem>
                        )} />
                    </div>
                )}
            </FieldGroup>

            {/* Driver's License */}
            <FieldGroup>
                <FormField control={form.control} name="hasDriversLicense" render={({ field }) => (
                    <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                        <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                        <FormLabel className="font-medium">Жолооны үнэмлэхтэй эсэх</FormLabel>
                    </FormItem>
                )} />
                {hasDriversLicense && (
                    <div className="mt-4 pl-6 animate-in slide-in-from-top-2">
                        <FormLabel className="text-xs text-slate-500 mb-3 block">Ангилал</FormLabel>
                        <div className="flex flex-wrap gap-2">
                            {driverLicenseCategoryItems.map((item) => (
                                <FormField key={item} control={form.control} name="driverLicenseCategories" render={({ field }) => (
                                    <label className={cn(
                                        "flex items-center gap-2 px-4 py-2 rounded-lg border cursor-pointer transition-all",
                                        field.value?.includes(item) ? "bg-primary/10 border-primary text-primary" : "hover:bg-slate-50"
                                    )}>
                                        <Checkbox
                                            checked={field.value?.includes(item)}
                                            onCheckedChange={(checked) => {
                                                if (checked) {
                                                    form.setValue("driverLicenseCategories", [...(field.value || []), item]);
                                                } else {
                                                    form.setValue("driverLicenseCategories", field.value?.filter((v: string) => v !== item));
                                                }
                                            }}
                                            className="hidden"
                                        />
                                        <span className="text-sm font-medium">{item}</span>
                                    </label>
                                )} />
                            ))}
                        </div>
                    </div>
                )}
            </FieldGroup>

            <SaveButton isSubmitting={isSubmitting} />
        </>
    );
}

function ContactInfoForm({ form, isSubmitting, references }: { form: any, isSubmitting: boolean, references: any }) {
    const { fields, append, remove } = useFieldArray({ control: form.control, name: "emergencyContacts" });

    return (
        <>
            <FieldGroup>
                <SectionTitle icon={Phone}>Холбоо барих мэдээлэл</SectionTitle>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField control={form.control} name="workPhone" render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-xs text-slate-500">Албан утас</FormLabel>
                            <FormControl>
                                <div className="relative">
                                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                    <Input placeholder="8811****" {...field} value={field.value || ''} className="h-10 pl-10" />
                                </div>
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )} />
                    <FormField control={form.control} name="personalPhone" render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-xs text-slate-500">Хувийн утас</FormLabel>
                            <FormControl>
                                <div className="relative">
                                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                    <Input placeholder="9911****" {...field} value={field.value || ''} className="h-10 pl-10" />
                                </div>
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )} />
                    <FormField control={form.control} name="workEmail" render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-xs text-slate-500">Албан и-мэйл</FormLabel>
                            <FormControl>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                    <Input type="email" placeholder="name@company.com" {...field} value={field.value || ''} className="h-10 pl-10" />
                                </div>
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )} />
                    <FormField control={form.control} name="personalEmail" render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-xs text-slate-500">Хувийн и-мэйл</FormLabel>
                            <FormControl>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                    <Input type="email" placeholder="personal@email.com" {...field} value={field.value || ''} className="h-10 pl-10" />
                                </div>
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )} />
                    <FormField control={form.control} name="homeAddress" render={({ field }) => (
                        <FormItem className="md:col-span-2">
                            <FormLabel className="text-xs text-slate-500">Гэрийн хаяг</FormLabel>
                            <FormControl><Textarea placeholder="Хаяг..." {...field} value={field.value || ''} className="resize-none" rows={2} /></FormControl>
                            <FormMessage />
                        </FormItem>
                    )} />
                    <FormField control={form.control} name="temporaryAddress" render={({ field }) => (
                        <FormItem className="md:col-span-2">
                            <FormLabel className="text-xs text-slate-500">Түр хаяг</FormLabel>
                            <FormControl><Textarea placeholder="Түр оршин суугаа хаяг..." {...field} value={field.value || ''} className="resize-none" rows={2} /></FormControl>
                            <FormMessage />
                        </FormItem>
                    )} />
                </div>
            </FieldGroup>

            <FieldGroup>
                <SectionTitle>Сошиал медиа</SectionTitle>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField control={form.control} name="facebook" render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-xs text-slate-500">Facebook</FormLabel>
                            <FormControl>
                                <div className="relative">
                                    <Facebook className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                    <Input placeholder="facebook.com/username" {...field} value={field.value || ''} className="h-10 pl-10" />
                                </div>
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )} />
                    <FormField control={form.control} name="instagram" render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-xs text-slate-500">Instagram</FormLabel>
                            <FormControl>
                                <div className="relative">
                                    <Instagram className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                    <Input placeholder="instagram.com/username" {...field} value={field.value || ''} className="h-10 pl-10" />
                                </div>
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )} />
                </div>
            </FieldGroup>

            <FieldGroup>
                <SectionTitle icon={Users}>Яаралтай үед холбоо барих</SectionTitle>
                <div className="space-y-3">
                    {fields.map((field, index) => (
                        <div key={field.id} className="p-4 rounded-lg bg-slate-50 border border-slate-100 relative group">
                            <Button type="button" variant="ghost" size="icon" className="absolute top-2 right-2 h-8 w-8 opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500" onClick={() => remove(index)}>
                                <Trash2 className="h-4 w-4" />
                            </Button>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                <FormField control={form.control} name={`emergencyContacts.${index}.fullName`} render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-xs text-slate-500">Нэр</FormLabel>
                                        <FormControl><Input placeholder="Овог нэр" {...field} value={field.value || ''} className="h-9" /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                <FormField control={form.control} name={`emergencyContacts.${index}.relationship`} render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-xs text-slate-500">Хэн болох</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl><SelectTrigger className="h-9"><SelectValue placeholder="Сонгох" /></SelectTrigger></FormControl>
                                            <SelectContent>{references.emergencyRelationships?.map((item: ReferenceItem) => <SelectItem key={item.id} value={item.name}>{item.name}</SelectItem>)}</SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                <FormField control={form.control} name={`emergencyContacts.${index}.phone`} render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-xs text-slate-500">Утас</FormLabel>
                                        <FormControl><Input placeholder="9911****" {...field} value={field.value || ''} className="h-9" /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                            </div>
                        </div>
                    ))}
                    <Button type="button" variant="outline" size="sm" onClick={() => append({ fullName: '', relationship: '', phone: '' })} className="gap-2">
                        <PlusCircle className="h-4 w-4" /> Нэмэх
                    </Button>
                </div>
            </FieldGroup>

            <SaveButton isSubmitting={isSubmitting} />
        </>
    );
}

function EducationForm({ form, isSubmitting, references }: { form: any, isSubmitting: boolean, references: any }) {
    const { fields, append, remove } = useFieldArray({ control: form.control, name: "education" });
    const { firestore } = useFirebase();
    const [isAddSchoolOpen, setIsAddSchoolOpen] = React.useState(false);
    const [newSchoolName, setNewSchoolName] = React.useState('');
    const [isAddDegreeOpen, setIsAddDegreeOpen] = React.useState(false);
    const [newDegreeName, setNewDegreeName] = React.useState('');
    const [currentFieldIndex, setCurrentFieldIndex] = React.useState<number | null>(null);

    const schoolsCollection = useMemoFirebase(({ firestore, companyPath }) => firestore ? tenantCollection(firestore, companyPath, 'questionnaireSchools') : null, []);
    const degreesCollection = useMemoFirebase(({ firestore, companyPath }) => firestore ? tenantCollection(firestore, companyPath, 'questionnaireDegrees') : null, []);
    const notApplicable = form.watch("educationNotApplicable");

    const handleAddSchool = async () => {
        if (!schoolsCollection || !newSchoolName.trim() || currentFieldIndex === null) return;
        try {
            await addDocumentNonBlocking(schoolsCollection, { name: newSchoolName.trim() });
            form.setValue(`education.${currentFieldIndex}.school`, newSchoolName.trim());
        } finally {
            setNewSchoolName('');
            setIsAddSchoolOpen(false);
            setCurrentFieldIndex(null);
        }
    };

    const handleAddDegree = async () => {
        if (!degreesCollection || !newDegreeName.trim() || currentFieldIndex === null) return;
        try {
            await addDocumentNonBlocking(degreesCollection, { name: newDegreeName.trim() });
            form.setValue(`education.${currentFieldIndex}.degree`, newDegreeName.trim());
        } finally {
            setNewDegreeName('');
            setIsAddDegreeOpen(false);
            setCurrentFieldIndex(null);
        }
    };

    return (
        <>
            <Dialog open={isAddSchoolOpen} onOpenChange={setIsAddSchoolOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Шинэ сургууль</DialogTitle>
                        <DialogDescription>Жагсаалтад байхгүй сургуулийн нэрийг нэмнэ үү.</DialogDescription>
                    </DialogHeader>
                    <Input placeholder="Сургуулийн нэр" value={newSchoolName} onChange={(e) => setNewSchoolName(e.target.value)} />
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsAddSchoolOpen(false)}>Цуцлах</Button>
                        <Button onClick={handleAddSchool}>Хадгалах</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isAddDegreeOpen} onOpenChange={setIsAddDegreeOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Шинэ мэргэжил</DialogTitle>
                        <DialogDescription>Жагсаалтад байхгүй мэргэжлийн нэрийг нэмнэ үү.</DialogDescription>
                    </DialogHeader>
                    <Input placeholder="Мэргэжлийн нэр" value={newDegreeName} onChange={(e) => setNewDegreeName(e.target.value)} />
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsAddDegreeOpen(false)}>Цуцлах</Button>
                        <Button onClick={handleAddDegree}>Хадгалах</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <FieldGroup>
                <FormField control={form.control} name="educationNotApplicable" render={({ field }) => (
                    <FormItem className="flex flex-row items-center space-x-3 space-y-0 p-3 rounded-lg bg-slate-50 border">
                        <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                        <FormLabel className="text-sm">Боловсролын мэдээлэл байхгүй</FormLabel>
                    </FormItem>
                )} />
            </FieldGroup>

            <fieldset disabled={notApplicable} className="space-y-4">
                {fields.map((field, index) => (
                    <FieldGroup key={field.id} className="relative group">
                        <Button type="button" variant="ghost" size="icon" className="absolute top-3 right-3 h-8 w-8 opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500" onClick={() => remove(index)}>
                            <Trash2 className="h-4 w-4" />
                        </Button>
                        <div className="text-xs font-medium text-slate-400 mb-4">Боловсрол #{index + 1}</div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField control={form.control} name={`education.${index}.country`} render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-xs text-slate-500">Улс</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl><SelectTrigger className="h-10"><SelectValue placeholder="Сонгох" /></SelectTrigger></FormControl>
                                        <SelectContent>{references.countries?.map((item: ReferenceItem) => <SelectItem key={item.id} value={item.name}>{item.name}</SelectItem>)}</SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            <FormField control={form.control} name={`education.${index}.school`} render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-xs text-slate-500">Сургууль</FormLabel>
                                    <Select onValueChange={(value) => { if (value === '__add_new__') { setCurrentFieldIndex(index); setIsAddSchoolOpen(true); } else { field.onChange(value) } }} value={field.value}>
                                        <FormControl><SelectTrigger className="h-10"><SelectValue placeholder="Сонгох" /></SelectTrigger></FormControl>
                                        <SelectContent>
                                            {references.schools?.map((item: ReferenceItem, i: number) => <SelectItem key={`${item.id}-${i}`} value={item.name}>{item.name}</SelectItem>)}
                                            <SelectItem value="__add_new__" className="text-primary font-medium">+ Шинээр нэмэх</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            <FormField control={form.control} name={`education.${index}.entryDate`} render={({ field }) => (
                                <FormItem className="flex flex-col">
                                    <FormLabel className="text-xs text-slate-500">Элссэн</FormLabel>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <FormControl>
                                                <Button variant="outline" className={cn("h-10 w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                                                    {field.value ? format(new Date(field.value), "yyyy-MM-dd") : <span>Огноо</span>}
                                                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                                </Button>
                                            </FormControl>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0" align="start">
                                            <Calendar mode="single" captionLayout="dropdown" fromYear={1980} toYear={new Date().getFullYear()} selected={field.value} onSelect={field.onChange} initialFocus />
                                        </PopoverContent>
                                    </Popover>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            <FormField control={form.control} name={`education.${index}.gradDate`} render={({ field }) => (
                                <FormItem className="flex flex-col">
                                    <FormLabel className="text-xs text-slate-500">Төгссөн</FormLabel>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <FormControl>
                                                <Button variant="outline" disabled={form.watch(`education.${index}.isCurrent`)} className={cn("h-10 w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                                                    {field.value ? format(new Date(field.value), "yyyy-MM-dd") : <span>Огноо</span>}
                                                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                                </Button>
                                            </FormControl>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0" align="start">
                                            <Calendar mode="single" captionLayout="dropdown" fromYear={1980} toYear={new Date().getFullYear()} selected={field.value} onSelect={field.onChange} initialFocus />
                                        </PopoverContent>
                                    </Popover>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            <FormField control={form.control} name={`education.${index}.degree`} render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-xs text-slate-500">Мэргэжил</FormLabel>
                                    <Select onValueChange={(value) => { if (value === '__add_new__') { setCurrentFieldIndex(index); setIsAddDegreeOpen(true); } else { field.onChange(value) } }} value={field.value}>
                                        <FormControl><SelectTrigger className="h-10"><SelectValue placeholder="Сонгох" /></SelectTrigger></FormControl>
                                        <SelectContent>
                                            {references.degrees?.map((item: ReferenceItem) => <SelectItem key={item.id} value={item.name}>{item.name}</SelectItem>)}
                                            <SelectItem value="__add_new__" className="text-primary font-medium">+ Шинээр нэмэх</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            <FormField control={form.control} name={`education.${index}.academicRank`} render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-xs text-slate-500">Зэрэг</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl><SelectTrigger className="h-10"><SelectValue placeholder="Сонгох" /></SelectTrigger></FormControl>
                                        <SelectContent>{references.academicRanks?.map((item: ReferenceItem) => <SelectItem key={item.id} value={item.name}>{item.name}</SelectItem>)}</SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            <FormField control={form.control} name={`education.${index}.diplomaNumber`} render={({ field }) => (
                                <FormItem className="md:col-span-2">
                                    <FormLabel className="text-xs text-slate-500">Дипломын дугаар</FormLabel>
                                    <FormControl><Input placeholder="Дугаар" {...field} value={field.value || ''} className="h-10" /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                        </div>
                        <FormField control={form.control} name={`education.${index}.isCurrent`} render={({ field }) => (
                            <FormItem className="flex flex-row items-center space-x-2 space-y-0 mt-3">
                                <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                                <FormLabel className="text-sm text-slate-600">Одоо сурч байгаа</FormLabel>
                            </FormItem>
                        )} />
                    </FieldGroup>
                ))}
                <Button type="button" variant="outline" onClick={() => append({ country: '', school: '', degree: '', diplomaNumber: '', academicRank: '', entryDate: null, gradDate: null, isCurrent: false })} className="gap-2">
                    <PlusCircle className="h-4 w-4" /> Боловсрол нэмэх
                </Button>
            </fieldset>

            <SaveButton isSubmitting={isSubmitting} />
        </>
    );
}

function LanguageForm({ form, isSubmitting, references }: { form: any, isSubmitting: boolean, references: any }) {
    const { fields, append, remove } = useFieldArray({ control: form.control, name: "languages" });
    const proficiencyLevels = ['Анхан', 'Дунд', 'Ахисан', 'Мэргэжлийн'];
    const notApplicable = form.watch("languagesNotApplicable");

    return (
        <>
            <FieldGroup>
                <FormField control={form.control} name="languagesNotApplicable" render={({ field }) => (
                    <FormItem className="flex flex-row items-center space-x-3 space-y-0 p-3 rounded-lg bg-slate-50 border">
                        <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                        <FormLabel className="text-sm">Гадаад хэлний мэдлэг байхгүй</FormLabel>
                    </FormItem>
                )} />
            </FieldGroup>

            <fieldset disabled={notApplicable} className="space-y-4">
                {fields.map((field, index) => (
                    <FieldGroup key={field.id} className="relative group">
                        <Button type="button" variant="ghost" size="icon" className="absolute top-3 right-3 h-8 w-8 opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500" onClick={() => remove(index)}>
                            <Trash2 className="h-4 w-4" />
                        </Button>
                        <FormField control={form.control} name={`languages.${index}.language`} render={({ field }) => (
                            <FormItem className="mb-4">
                                <FormLabel className="text-xs text-slate-500">Хэл</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl><SelectTrigger className="h-10"><SelectValue placeholder="Сонгох" /></SelectTrigger></FormControl>
                                    <SelectContent>{references.languages?.map((lang: ReferenceItem) => <SelectItem key={lang.id} value={lang.name}>{lang.name}</SelectItem>)}</SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )} />
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            {['listening', 'reading', 'speaking', 'writing'].map((skill) => (
                                <FormField key={skill} control={form.control} name={`languages.${index}.${skill}`} render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-xs text-slate-500">{skill === 'listening' ? 'Сонсох' : skill === 'reading' ? 'Унших' : skill === 'speaking' ? 'Ярих' : 'Бичих'}</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl><SelectTrigger className="h-9"><SelectValue placeholder="Түвшин" /></SelectTrigger></FormControl>
                                            <SelectContent>{proficiencyLevels.map(level => <SelectItem key={level} value={level}>{level}</SelectItem>)}</SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                            ))}
                        </div>
                        <FormField control={form.control} name={`languages.${index}.testScore`} render={({ field }) => (
                            <FormItem className="mt-3">
                                <FormLabel className="text-xs text-slate-500">Шалгалтын оноо (TOEFL, IELTS гэх мэт)</FormLabel>
                                <FormControl><Input placeholder="Оноо" {...field} value={field.value || ''} className="h-10" /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                    </FieldGroup>
                ))}
                <Button type="button" variant="outline" onClick={() => append({ language: '', listening: '', reading: '', speaking: '', writing: '', testScore: '' })} className="gap-2">
                    <PlusCircle className="h-4 w-4" /> Хэл нэмэх
                </Button>
            </fieldset>

            <SaveButton isSubmitting={isSubmitting} />
        </>
    );
}

function TrainingForm({ form, isSubmitting }: { form: any, isSubmitting: boolean }) {
    const { fields, append, remove } = useFieldArray({ control: form.control, name: "trainings" });
    const notApplicable = form.watch("trainingsNotApplicable");

    return (
        <>
            <FieldGroup>
                <FormField control={form.control} name="trainingsNotApplicable" render={({ field }) => (
                    <FormItem className="flex flex-row items-center space-x-3 space-y-0 p-3 rounded-lg bg-slate-50 border">
                        <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                        <FormLabel className="text-sm">Мэргэшлийн сургалтын мэдээлэл байхгүй</FormLabel>
                    </FormItem>
                )} />
            </FieldGroup>

            <fieldset disabled={notApplicable} className="space-y-4">
                {fields.map((field, index) => (
                    <FieldGroup key={field.id} className="relative group">
                        <Button type="button" variant="ghost" size="icon" className="absolute top-3 right-3 h-8 w-8 opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500" onClick={() => remove(index)}>
                            <Trash2 className="h-4 w-4" />
                        </Button>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField control={form.control} name={`trainings.${index}.name`} render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-xs text-slate-500">Сургалтын нэр</FormLabel>
                                    <FormControl><Input placeholder="Нэр" {...field} value={field.value || ''} className="h-10" /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            <FormField control={form.control} name={`trainings.${index}.organization`} render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-xs text-slate-500">Байгууллага</FormLabel>
                                    <FormControl><Input placeholder="Байгууллага" {...field} value={field.value || ''} className="h-10" /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            <FormField control={form.control} name={`trainings.${index}.startDate`} render={({ field }) => (
                                <FormItem className="flex flex-col">
                                    <FormLabel className="text-xs text-slate-500">Эхэлсэн</FormLabel>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <FormControl>
                                                <Button variant="outline" className={cn("h-10 w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                                                    {field.value ? format(new Date(field.value), "yyyy-MM-dd") : <span>Огноо</span>}
                                                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                                </Button>
                                            </FormControl>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0" align="start">
                                            <Calendar mode="single" captionLayout="dropdown" fromYear={1980} toYear={new Date().getFullYear()} selected={field.value} onSelect={field.onChange} initialFocus />
                                        </PopoverContent>
                                    </Popover>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            <FormField control={form.control} name={`trainings.${index}.endDate`} render={({ field }) => (
                                <FormItem className="flex flex-col">
                                    <FormLabel className="text-xs text-slate-500">Дууссан</FormLabel>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <FormControl>
                                                <Button variant="outline" className={cn("h-10 w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                                                    {field.value ? format(new Date(field.value), "yyyy-MM-dd") : <span>Огноо</span>}
                                                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                                </Button>
                                            </FormControl>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0" align="start">
                                            <Calendar mode="single" captionLayout="dropdown" fromYear={1980} toYear={new Date().getFullYear()} selected={field.value} onSelect={field.onChange} initialFocus />
                                        </PopoverContent>
                                    </Popover>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            <FormField control={form.control} name={`trainings.${index}.certificateNumber`} render={({ field }) => (
                                <FormItem className="md:col-span-2">
                                    <FormLabel className="text-xs text-slate-500">Сертификатын дугаар</FormLabel>
                                    <FormControl><Input placeholder="Дугаар" {...field} value={field.value || ''} className="h-10" /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                        </div>
                    </FieldGroup>
                ))}
                <Button type="button" variant="outline" onClick={() => append({ name: '', organization: '', startDate: null, endDate: null, certificateNumber: '' })} className="gap-2">
                    <PlusCircle className="h-4 w-4" /> Сургалт нэмэх
                </Button>
            </fieldset>

            <SaveButton isSubmitting={isSubmitting} />
        </>
    );
}

function FamilyInfoForm({ form, isSubmitting, references }: { form: any, isSubmitting: boolean, references: any }) {
    const { fields, append, remove } = useFieldArray({ control: form.control, name: "familyMembers" });
    const notApplicable = form.watch("familyMembersNotApplicable");

    return (
        <>
            <FieldGroup>
                <FormField control={form.control} name="familyMembersNotApplicable" render={({ field }) => (
                    <FormItem className="flex flex-row items-center space-x-3 space-y-0 p-3 rounded-lg bg-slate-50 border">
                        <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                        <FormLabel className="text-sm">Гэр бүлийн мэдээлэл байхгүй</FormLabel>
                    </FormItem>
                )} />
            </FieldGroup>

            <FieldGroup>
                <SectionTitle icon={Users}>Гэрлэлтийн байдал</SectionTitle>
                <FormField
                    control={form.control}
                    name="maritalStatus"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-xs text-slate-500">Гэрлэсэн эсэх (заавал биш)</FormLabel>
                            <Select
                                value={field.value || '__none__'}
                                onValueChange={(val) => field.onChange(val === '__none__' ? undefined : val)}
                            >
                                <FormControl>
                                    <SelectTrigger className="h-10">
                                        <SelectValue placeholder="Сонгох" />
                                    </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    <SelectItem value="__none__">Сонгоогүй</SelectItem>
                                    <SelectItem value="Гэрлээгүй">Гэрлээгүй</SelectItem>
                                    <SelectItem value="Гэрлэсэн">Гэрлэсэн</SelectItem>
                                    <SelectItem value="Салсан">Салсан</SelectItem>
                                    <SelectItem value="Бэлэвсэн">Бэлэвсэн</SelectItem>
                                </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                    )}
                />
            </FieldGroup>

            <fieldset disabled={notApplicable} className="space-y-4">
                {fields.map((field, index) => (
                    <FieldGroup key={field.id} className="relative group">
                        <Button type="button" variant="ghost" size="icon" className="absolute top-3 right-3 h-8 w-8 opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500" onClick={() => remove(index)}>
                            <Trash2 className="h-4 w-4" />
                        </Button>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField control={form.control} name={`familyMembers.${index}.relationship`} render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-xs text-slate-500">Хэн болох</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl><SelectTrigger className="h-10"><SelectValue placeholder="Сонгох" /></SelectTrigger></FormControl>
                                        <SelectContent>{references.familyRelationships?.map((opt: ReferenceItem) => <SelectItem key={opt.id} value={opt.name}>{opt.name}</SelectItem>)}</SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            <FormField control={form.control} name={`familyMembers.${index}.lastName`} render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-xs text-slate-500">Овог</FormLabel>
                                    <FormControl><Input placeholder="Овог" {...field} value={field.value || ''} className="h-10" /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            <FormField control={form.control} name={`familyMembers.${index}.firstName`} render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-xs text-slate-500">Нэр</FormLabel>
                                    <FormControl><Input placeholder="Нэр" {...field} value={field.value || ''} className="h-10" /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            <FormField control={form.control} name={`familyMembers.${index}.birthDate`} render={({ field }) => (
                                <FormItem className="flex flex-col">
                                    <FormLabel className="text-xs text-slate-500">Төрсөн огноо (заавал биш)</FormLabel>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <FormControl>
                                                <Button
                                                    variant="outline"
                                                    className={cn("h-10 w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}
                                                >
                                                    {field.value ? format(new Date(field.value), "yyyy-MM-dd") : <span>Огноо сонгох</span>}
                                                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                                </Button>
                                            </FormControl>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0" align="start">
                                            <Calendar
                                                mode="single"
                                                captionLayout="dropdown"
                                                fromYear={1930}
                                                toYear={new Date().getFullYear()}
                                                selected={field.value || undefined}
                                                onSelect={field.onChange}
                                                disabled={(d) => d > new Date()}
                                                initialFocus
                                            />
                                        </PopoverContent>
                                    </Popover>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            <FormField control={form.control} name={`familyMembers.${index}.phone`} render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-xs text-slate-500">Утас</FormLabel>
                                    <FormControl><Input placeholder="Утас" {...field} value={field.value || ''} className="h-10" /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                        </div>
                    </FieldGroup>
                ))}
                <Button type="button" variant="outline" onClick={() => append({ relationship: '', lastName: '', firstName: '', birthDate: null, phone: '' })} className="gap-2">
                    <PlusCircle className="h-4 w-4" /> Гишүүн нэмэх
                </Button>
            </fieldset>

            <SaveButton isSubmitting={isSubmitting} />
        </>
    );
}

function WorkExperienceForm({ form, isSubmitting, references }: { form: any, isSubmitting: boolean, references: any }) {
    const { fields, append, remove } = useFieldArray({ control: form.control, name: "experiences" });
    const notApplicable = form.watch("experienceNotApplicable");

    return (
        <>
            <FieldGroup>
                <FormField control={form.control} name="experienceNotApplicable" render={({ field }) => (
                    <FormItem className="flex flex-row items-center space-x-3 space-y-0 p-3 rounded-lg bg-slate-50 border">
                        <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                        <FormLabel className="text-sm">Ажлын туршлагын мэдээлэл байхгүй</FormLabel>
                    </FormItem>
                )} />
            </FieldGroup>

            <fieldset disabled={notApplicable} className="space-y-4">
                {fields.map((field, index) => (
                    <FieldGroup key={field.id} className="relative group">
                        <Button type="button" variant="ghost" size="icon" className="absolute top-3 right-3 h-8 w-8 opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500" onClick={() => remove(index)}>
                            <Trash2 className="h-4 w-4" />
                        </Button>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField control={form.control} name={`experiences.${index}.company`} render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-xs text-slate-500">Компани</FormLabel>
                                    <FormControl><Input placeholder="Компани" {...field} value={field.value || ''} className="h-10" /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            <FormField control={form.control} name={`experiences.${index}.position`} render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-xs text-slate-500">Албан тушаал</FormLabel>
                                    <FormControl><Input placeholder="Албан тушаал" {...field} value={field.value || ''} className="h-10" /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            <FormField control={form.control} name={`experiences.${index}.startDate`} render={({ field }) => (
                                <FormItem className="flex flex-col">
                                    <FormLabel className="text-xs text-slate-500">Эхэлсэн</FormLabel>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <FormControl>
                                                <Button variant="outline" className={cn("h-10 w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                                                    {field.value ? format(new Date(field.value), "yyyy-MM-dd") : <span>Огноо</span>}
                                                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                                </Button>
                                            </FormControl>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0" align="start">
                                            <Calendar mode="single" captionLayout="dropdown" fromYear={1980} toYear={new Date().getFullYear()} selected={field.value} onSelect={field.onChange} initialFocus />
                                        </PopoverContent>
                                    </Popover>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            <FormField control={form.control} name={`experiences.${index}.endDate`} render={({ field }) => (
                                <FormItem className="flex flex-col">
                                    <FormLabel className="text-xs text-slate-500">Дууссан</FormLabel>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <FormControl>
                                                <Button variant="outline" className={cn("h-10 w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                                                    {field.value ? format(new Date(field.value), "yyyy-MM-dd") : <span>Огноо</span>}
                                                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                                </Button>
                                            </FormControl>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0" align="start">
                                            <Calendar mode="single" captionLayout="dropdown" fromYear={1980} toYear={new Date().getFullYear()} selected={field.value} onSelect={field.onChange} initialFocus />
                                        </PopoverContent>
                                    </Popover>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            <FormField control={form.control} name={`experiences.${index}.description`} render={({ field }) => (
                                <FormItem className="md:col-span-2">
                                    <FormLabel className="text-xs text-slate-500">Тодорхойлолт</FormLabel>
                                    <FormControl><Textarea placeholder="Гүйцэтгэсэн үүрэг..." {...field} value={field.value || ''} className="resize-none" rows={3} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                        </div>
                    </FieldGroup>
                ))}
                <Button type="button" variant="outline" onClick={() => append({ company: '', position: '', startDate: null, endDate: null, description: '' })} className="gap-2">
                    <PlusCircle className="h-4 w-4" /> Туршлага нэмэх
                </Button>
            </fieldset>

            <SaveButton isSubmitting={isSubmitting} />
        </>
    );
}

export default function QuestionnairePage() {
    const { id } = useParams();
    const employeeId = Array.isArray(id) ? id[0] : id;
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const [activeTab, setActiveTab] = React.useState('general');
    const [isCVDialogOpen, setIsCVDialogOpen] = React.useState(false);

    const employeeDocRef = useMemoFirebase(({ firestore, companyPath }) => (firestore && employeeId ? tenantDoc(firestore, companyPath, 'employees', employeeId) : null), [employeeId]);
    const questionnaireDocRef = useMemoFirebase(({ firestore, companyPath }) => (firestore && employeeId ? tenantDoc(firestore, companyPath, `employees/${employeeId}/questionnaire`, 'data') : null), [employeeId]);

    const { data: employeeData, isLoading: isLoadingEmployee } = useDoc<Employee>(employeeDocRef);
    const { data: questionnaireData, isLoading: isLoadingQuestionnaire } = useDoc<FullQuestionnaireValues>(questionnaireDocRef);
    const [isTogglingLock, setIsTogglingLock] = React.useState(false);
    const isLocked = !!employeeData?.questionnaireLocked;

    // References
    const { data: countries } = useCollection<ReferenceItem>(useMemoFirebase(({ firestore, companyPath }) => firestore ? tenantCollection(firestore, companyPath, 'questionnaireCountries') : null, []));
    const { data: schools } = useCollection<ReferenceItem>(useMemoFirebase(({ firestore, companyPath }) => firestore ? tenantCollection(firestore, companyPath, 'questionnaireSchools') : null, []));
    const { data: degrees } = useCollection<ReferenceItem>(useMemoFirebase(({ firestore, companyPath }) => firestore ? tenantCollection(firestore, companyPath, 'questionnaireDegrees') : null, []));
    const { data: academicRanks } = useCollection<ReferenceItem>(useMemoFirebase(({ firestore, companyPath }) => firestore ? tenantCollection(firestore, companyPath, 'questionnaireAcademicRanks') : null, []));
    const { data: languages } = useCollection<ReferenceItem>(useMemoFirebase(({ firestore, companyPath }) => firestore ? tenantCollection(firestore, companyPath, 'questionnaireLanguages') : null, []));
    const { data: familyRelationships } = useCollection<ReferenceItem>(useMemoFirebase(({ firestore, companyPath }) => firestore ? tenantCollection(firestore, companyPath, 'questionnaireFamilyRelationships') : null, []));
    const { data: emergencyRelationships } = useCollection<ReferenceItem>(useMemoFirebase(({ firestore, companyPath }) => firestore ? tenantCollection(firestore, companyPath, 'questionnaireEmergencyRelationships') : null, []));

    const defaultValues = React.useMemo(() => {
        const baseValues: Partial<FullQuestionnaireValues> = {
            lastName: '', firstName: '', registrationNumber: '', birthDate: null, gender: '', idCardNumber: '', insuranceTypeCode: '',
            hasDisability: false, disabilityPercentage: '', disabilityDate: null, hasDriversLicense: false, driverLicenseCategories: [],
            workPhone: '', personalPhone: '', workEmail: '', personalEmail: '', homeAddress: '', temporaryAddress: '', facebook: '', instagram: '',
            emergencyContacts: [], education: [], educationNotApplicable: false,
            languages: [], languagesNotApplicable: false, trainings: [], trainingsNotApplicable: false,
            familyMembers: [], familyMembersNotApplicable: false, maritalStatus: undefined, experiences: [], experienceNotApplicable: false
        };
        const employeeInfo = { ...employeeData, workEmail: employeeData?.email, personalPhone: employeeData?.phoneNumber };
        return transformDates({ ...baseValues, ...employeeInfo, ...questionnaireData });
    }, [employeeData, questionnaireData]);

    const references = { countries, schools, degrees, academicRanks, languages, familyRelationships, emergencyRelationships };
    const isLoading = isLoadingEmployee || isLoadingQuestionnaire;
    const completionPercent = Math.round(employeeData?.questionnaireCompletion || 0);
    const fullName = employeeData ? `${employeeData.lastName || ''} ${employeeData.firstName || ''}`.trim() : '';

    const handleToggleQuestionnaireLock = React.useCallback(async () => {
        if (!employeeDocRef) return;
        if (isTogglingLock) return;
        setIsTogglingLock(true);
        try {
            await updateDocumentNonBlocking(employeeDocRef, {
                questionnaireLocked: !isLocked,
            });
            toast({
                title: !isLocked ? 'Анкет түгжигдлээ' : 'Анкетийн түгжээ нээгдлээ',
                description: !isLocked
                    ? 'Ажилтан өөрийн анкетийг засах боломжгүй боллоо.'
                    : 'Ажилтан өөрийн анкетийг засах боломжтой боллоо.',
            });
        } catch (e) {
            toast({
                variant: 'destructive',
                title: 'Алдаа',
                description: 'Түгжээний төлөв өөрчлөхөд алдаа гарлаа',
            });
        } finally {
            setIsTogglingLock(false);
        }
    }, [employeeDocRef, isTogglingLock, isLocked, toast]);

    // Handle CV data extraction
    const handleCVDataExtracted = React.useCallback(async (cvData: any) => {
        if (!questionnaireDocRef || !employeeDocRef) return;

        try {
            // Transform dates from string to Date objects
            const transformedData: any = { ...cvData };
            
            if (cvData.birthDate) {
                transformedData.birthDate = new Date(cvData.birthDate);
            }
            
            // Transform education dates
            if (cvData.education?.length) {
                transformedData.education = cvData.education.map((edu: any) => ({
                    ...edu,
                    entryDate: edu.entryDate ? new Date(edu.entryDate) : null,
                    gradDate: edu.gradDate ? new Date(edu.gradDate) : null,
                    isCurrent: edu.isCurrent ?? false,
                }));
            }
            
            // Transform training dates
            if (cvData.trainings?.length) {
                transformedData.trainings = cvData.trainings.map((t: any) => ({
                    ...t,
                    startDate: t.startDate ? new Date(t.startDate) : null,
                    endDate: t.endDate ? new Date(t.endDate) : null,
                }));
            }
            
            // Transform experience dates, preserve isCurrent
            if (cvData.experiences?.length) {
                transformedData.experiences = cvData.experiences.map((exp: any) => ({
                    ...exp,
                    startDate: exp.startDate ? new Date(exp.startDate) : null,
                    endDate: exp.endDate ? new Date(exp.endDate) : null,
                    isCurrent: exp.isCurrent ?? false,
                }));
            }
            
            // Validate maritalStatus to match schema enum
            if (cvData.maritalStatus) {
                const validStatuses = ['Гэрлээгүй', 'Гэрлэсэн', 'Салсан', 'Бэлэвсэн'];
                if (validStatuses.includes(cvData.maritalStatus)) {
                    transformedData.maritalStatus = cvData.maritalStatus;
                } else {
                    delete transformedData.maritalStatus;
                }
            }

            // Merge with existing data (don't overwrite existing values with empty ones)
            const currentData = questionnaireData || {};
            const mergedData: any = { ...currentData };
            
            for (const [key, value] of Object.entries(transformedData)) {
                if (value !== undefined && value !== null && value !== '') {
                    // For arrays, always set from CV (overwrite empty or replace)
                    if (Array.isArray(value) && value.length > 0) {
                        const currentArray = mergedData[key] || [];
                        if (currentArray.length === 0) {
                            mergedData[key] = value;
                        }
                        // If current array has data, we don't overwrite
                    } else {
                        // For non-arrays, set if current is empty/falsy
                        if (!mergedData[key]) {
                            mergedData[key] = value;
                        }
                    }
                }
            }

            // Strip undefined values — Firestore rejects them
            const cleanedData = Object.fromEntries(
                Object.entries(mergedData).filter(([, v]) => v !== undefined)
            );

            // РД давхардлыг шалгах (CV-ээс хадгалахын өмнө)
            const regNo = cleanedData.registrationNumber as string | undefined;
            if (regNo && employeeId) {
                const normalized = normalizeRegistrationNumber(regNo);
                cleanedData.registrationNumber = normalized;
                const duplicate = await checkRegistrationNumberDuplicate(normalized, employeeId);
                if (duplicate) {
                    toast({
                        variant: 'destructive',
                        title: 'Регистрийн дугаар давхардсан',
                        description: 'Энэ регистрийн дугаар өөр ажилтанд бүртгэгдсэн байна. CV-ийн мэдээллийг засаад дахин оролдоно уу.',
                    });
                    return;
                }
            }

            // Use blocking setDoc/updateDoc to guarantee write completes before proceeding
            await setDoc(questionnaireDocRef, cleanedData, { merge: true });
            
            // Update completion percentage
            const newCompletion = calculateCompletionPercentage(cleanedData);
            await updateDoc(employeeDocRef, { questionnaireCompletion: newCompletion });

            toast({
                title: 'Амжилттай!',
                description: 'CV-ийн мэдээлэл анкетэд амжилттай хадгалагдлаа.',
            });

            // Refresh the page to show updated data (write is confirmed at this point)
            window.location.reload();
        } catch (error) {
            console.error('Error saving CV data:', error);
            toast({
                variant: 'destructive',
                title: 'Алдаа',
                description: 'Мэдээлэл хадгалахад алдаа гарлаа. Дахин оролдоно уу.',
            });
        }
    }, [questionnaireDocRef, employeeDocRef, questionnaireData, toast, employeeId]);

    if (isLoading) {
        return (
            <div className="flex flex-col h-full bg-slate-50/50">
                <div className="bg-white border-b p-6">
                    <div className="flex items-center gap-4">
                        <Skeleton className="h-10 w-10 rounded-full" />
                        <div className="space-y-2">
                            <Skeleton className="h-5 w-40" />
                            <Skeleton className="h-4 w-24" />
                        </div>
                    </div>
                </div>
                <div className="p-6">
                    <Skeleton className="h-[400px] w-full rounded-xl" />
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-slate-50/50">
            {/* Header */}
            <div className="bg-white border-b sticky top-0 z-30">
                <div className="px-6 md:px-8">
                    <div className="py-4">
                        <PageHeader
                            title={fullName || 'Ажилтан'}
                            description={employeeData?.jobTitle || 'Албан тушаал'}
                            showBackButton
                            hideBreadcrumbs
                            backButtonPlacement="inline"
                            backBehavior="history"
                            fallbackBackHref={`/dashboard/employees/${employeeId}`}
                            actions={
                                <div className="flex items-center gap-3">
                                    <Badge variant="outline" className="shrink-0 text-[10px]">Анкет</Badge>

                                    <TooltipProvider>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="icon"
                                                    className={cn(
                                                        "h-9 w-9",
                                                        isLocked ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100" : ""
                                                    )}
                                                    onClick={handleToggleQuestionnaireLock}
                                                    disabled={isTogglingLock}
                                                    aria-label={isLocked ? 'Анкетийн түгжээ нээх' : 'Анкет түгжих'}
                                                >
                                                    {isLocked ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                                                </Button>
                                            </TooltipTrigger>
                                            <TooltipContent>
                                                <div className="space-y-1">
                                                    <p className="text-xs font-semibold">
                                                        {isLocked ? 'Түгжигдсэн (зөвхөн админ засна)' : 'Нээлттэй (ажилтан засаж болно)'}
                                                    </p>
                                                    <p className="text-xs opacity-80">
                                                        {isLocked ? 'Дарж түгжээ нээнэ' : 'Дарж анкетийг түгжинэ'}
                                                    </p>
                                                </div>
                                            </TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>

                                    <Button
                                        onClick={() => setIsCVDialogOpen(true)}
                                        className="h-9 bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 shadow-lg shadow-violet-500/25"
                                    >
                                        <Sparkles className="h-4 w-4 mr-2" />
                                        <span className="hidden sm:inline">AI CV Уншигч</span>
                                        <span className="sm:hidden">AI</span>
                                    </Button>

                                    <div className="text-right hidden sm:block">
                                        <p className="text-xs text-muted-foreground">Гүйцэтгэл</p>
                                        <p className={cn(
                                            "text-sm font-semibold",
                                            completionPercent >= 90 ? "text-emerald-600" :
                                            completionPercent >= 50 ? "text-amber-600" : "text-rose-600"
                                        )}>{completionPercent}%</p>
                                    </div>
                                    <div className="h-10 w-10 relative">
                                        <svg className="h-10 w-10 -rotate-90" viewBox="0 0 36 36">
                                            <circle cx="18" cy="18" r="15" fill="none" stroke="#e2e8f0" strokeWidth="3" />
                                            <circle
                                                cx="18" cy="18" r="15" fill="none"
                                                stroke={completionPercent >= 90 ? "#10b981" : completionPercent >= 50 ? "#f59e0b" : "#ef4444"}
                                                strokeWidth="3"
                                                strokeDasharray={`${completionPercent * 0.94} 100`}
                                                strokeLinecap="round"
                                            />
                                        </svg>
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <FileText className="h-4 w-4 text-slate-400" />
                                        </div>
                                    </div>
                                </div>
                            }
                        />
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto">
                <div className="p-6 md:p-8">
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                        {/* Tab Navigation */}
                        <div className="bg-white rounded-xl border mb-6 p-1.5 overflow-x-auto no-scrollbar">
                            <VerticalTabMenu
                                orientation="horizontal"
                                className="flex-wrap gap-2"
                                triggerClassName="text-sm"
                                items={TABS.map((tab) => ({ value: tab.id, label: tab.label }))}
                            />
                        </div>

                        <TabsContent value="general" className="mt-0">
                            <FormSection
                                docRef={questionnaireDocRef}
                                employeeDocRef={employeeDocRef}
                                defaultValues={defaultValues}
                                schema={generalInfoSchema}
                                beforeSubmit={async (data) => {
                                    const d = data as any;
                                    const regNo = d.registrationNumber;
                                    const ttd = d.idCardNumber;
                                    if (regNo) {
                                        const normalized = normalizeRegistrationNumber(regNo);
                                        d.registrationNumber = normalized;
                                        try {
                                            const result = await checkRegistrationNumberDuplicate(normalized, employeeId ?? '');
                                            if (result.duplicate) {
                                                return {
                                                    error: 'Энэ регистрийн дугаар өөр ажилтанд бүртгэгдсэн байна.',
                                                    existingEmployeeId: result.existingEmployeeId,
                                                };
                                            }
                                        } catch (e) {
                                            if (e instanceof RegNoIndexError) return { error: e.message, indexUrl: e.indexUrl };
                                            return (e instanceof Error ? e.message : 'Регистрийн дугаар шалгахад алдаа гарлаа. Дахин оролдоно уу.');
                                        }
                                    }
                                    if (ttd) {
                                        const normalizedTtd = normalizeIdCardNumber(ttd);
                                        d.idCardNumber = normalizedTtd;
                                        try {
                                            const resultTtd = await checkIdCardNumberDuplicate(normalizedTtd, employeeId ?? '');
                                            if (resultTtd.duplicate) {
                                                return {
                                                    error: 'Энэ ТТД өөр ажилтанд бүртгэгдсэн байна.',
                                                    existingEmployeeId: resultTtd.existingEmployeeId,
                                                };
                                            }
                                        } catch (e) {
                                            if (e instanceof RegNoIndexError) return { error: e.message, indexUrl: e.indexUrl };
                                            return (e instanceof Error ? e.message : 'ТТД шалгахад алдаа гарлаа. Дахин оролдоно уу.');
                                        }
                                    }
                                    return null;
                                }}
                            >
                                {(form, isSubmitting) => <GeneralInfoForm form={form} isSubmitting={isSubmitting} references={references} employeeId={employeeId ?? ''} />}
                            </FormSection>
                        </TabsContent>
                        <TabsContent value="contact" className="mt-0">
                            <FormSection docRef={questionnaireDocRef} employeeDocRef={employeeDocRef} defaultValues={defaultValues} schema={contactInfoSchema}>
                                {(form, isSubmitting) => <ContactInfoForm form={form} isSubmitting={isSubmitting} references={references} />}
                            </FormSection>
                        </TabsContent>
                        <TabsContent value="education" className="mt-0">
                            <FormSection docRef={questionnaireDocRef} employeeDocRef={employeeDocRef} defaultValues={defaultValues} schema={educationHistorySchema}>
                                {(form, isSubmitting) => <EducationForm form={form} isSubmitting={isSubmitting} references={references} />}
                            </FormSection>
                        </TabsContent>
                        <TabsContent value="language" className="mt-0">
                            <FormSection docRef={questionnaireDocRef} employeeDocRef={employeeDocRef} defaultValues={defaultValues} schema={languageSkillsSchema}>
                                {(form, isSubmitting) => <LanguageForm form={form} isSubmitting={isSubmitting} references={references} />}
                            </FormSection>
                        </TabsContent>
                        <TabsContent value="training" className="mt-0">
                            <FormSection docRef={questionnaireDocRef} employeeDocRef={employeeDocRef} defaultValues={defaultValues} schema={professionalTrainingSchema}>
                                {(form, isSubmitting) => <TrainingForm form={form} isSubmitting={isSubmitting} />}
                            </FormSection>
                        </TabsContent>
                        <TabsContent value="family" className="mt-0">
                            <FormSection docRef={questionnaireDocRef} employeeDocRef={employeeDocRef} defaultValues={defaultValues} schema={familyInfoSchema}>
                                {(form, isSubmitting) => <FamilyInfoForm form={form} isSubmitting={isSubmitting} references={references} />}
                            </FormSection>
                        </TabsContent>
                        <TabsContent value="experience" className="mt-0">
                            <FormSection docRef={questionnaireDocRef} employeeDocRef={employeeDocRef} defaultValues={defaultValues} schema={workExperienceHistorySchema}>
                                {(form, isSubmitting) => <WorkExperienceForm form={form} isSubmitting={isSubmitting} references={references} />}
                            </FormSection>
                        </TabsContent>
                    </Tabs>
                </div>
            </div>

            {/* AI CV Upload Dialog */}
            <CVUploadDialog
                open={isCVDialogOpen}
                onOpenChange={setIsCVDialogOpen}
                onDataExtracted={handleCVDataExtracted}
                references={references}
            />
        </div>
    );
}
