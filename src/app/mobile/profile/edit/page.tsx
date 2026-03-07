'use client';

import * as React from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { ArrowLeft, Calendar as CalendarIcon, Camera, Save, X, Loader2, Phone, Mail, AlertCircle, PlusCircle, Trash2, Facebook, Instagram } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import Link from 'next/link';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { useCollection, useDoc, useFirebase, useMemoFirebase, setDocumentNonBlocking, tenantDoc, tenantCollection } from '@/firebase';
import { useEmployeeProfile } from '@/hooks/use-employee-profile';
import { collection, doc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { useMobileContainer } from '../../hooks/use-mobile-container';

import {
    FullQuestionnaireValues,
    generalInfoSchema,
    contactInfoSchema,
    educationHistorySchema,
    languageSkillsSchema,
    professionalTrainingSchema,
    familyInfoSchema,
    workExperienceHistorySchema
} from '@/types/questionnaire';
import { ReferenceItem } from '@/types';


// Helper for date transformation
const transformDates = (data: any) => {
    const dateFields = ['birthDate', 'disabilityDate'];
    const arrayDateFields = ['entryDate', 'gradDate', 'startDate', 'endDate'];

    for (const field of dateFields) {
        if (data[field] && typeof data[field] === 'object' && 'seconds' in data[field]) {
            data[field] = data[field].toDate();
        }
    }

    ['education', 'trainings', 'experiences'].forEach(arrayKey => {
        if (data[arrayKey]) {
            data[arrayKey].forEach((item: any) => {
                for (const field of arrayDateFields) {
                    if (item[field] && typeof item[field] === 'object' && 'seconds' in item[field]) {
                        item[field] = item[field].toDate();
                    }
                }
            });
        }
    });

    return data;
}

function PageSkeleton() {
    return (
        <div className="p-4">
            <header className="py-4 relative flex items-center justify-center">
                <Skeleton className="h-6 w-6 absolute left-0" />
                <Skeleton className="h-7 w-32" />
            </header>
            <div className="flex flex-col items-center gap-4 my-4">
                <Skeleton className="h-24 w-24 rounded-full" />
            </div>
            <div className="space-y-4">
                {Array.from({ length: 7 }).map((_, i) => (
                    <Skeleton key={i} className="h-14 w-full rounded-lg" />
                ))}
            </div>
        </div>
    );
}

interface FormSectionProps<T extends z.ZodType<any, any>> {
    docRef: any;
    defaultValues: z.infer<T> | undefined;
    schema: T;
    isLocked?: boolean;
    children: (form: any, isSubmitting: boolean) => React.ReactNode;
}

function FormSection<T extends z.ZodType<any, any>>({ docRef, defaultValues, schema, isLocked, children }: FormSectionProps<T>) {
    const { toast } = useToast();
    const form = useForm<z.infer<T>>({
        resolver: zodResolver(schema),
        defaultValues,
    });

    const { isSubmitting } = form.formState;

    const onSubmit = (data: z.infer<T>) => {
        if (isLocked) {
            toast({
                variant: 'destructive',
                title: 'Анкет түгжигдсэн байна',
                description: 'Одоогоор өөрчлөлт хадгалах боломжгүй. Админтай холбогдоно уу.',
            });
            return;
        }
        if (!docRef) return;
        setDocumentNonBlocking(docRef, data, { merge: true });
        toast({ title: 'Амжилттай хадгаллаа' });
    };

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <fieldset disabled={!!isLocked || isSubmitting} className={cn((!!isLocked || isSubmitting) && "opacity-70")}>
                    {children(form, isSubmitting)}
                </fieldset>
            </form>
        </Form>
    );
}

// Child Form Components
function GeneralInfoForm({ form, isSubmitting }: { form: any, isSubmitting: boolean }) {
    const container = useMobileContainer();
    const hasDisability = form.watch("hasDisability");
    const hasDriversLicense = form.watch("hasDriversLicense");
    const driverLicenseCategoryItems = ["A", "B", "C", "D", "E", "M"];

    return (
        <>
            <div className="grid grid-cols-1 gap-4">
                <FormField control={form.control} name="lastName" render={({ field }) => (<FormItem><FormLabel>Овог</FormLabel><FormControl><Input {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="firstName" render={({ field }) => (<FormItem><FormLabel>Нэр</FormLabel><FormControl><Input {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="registrationNumber" render={({ field }) => (<FormItem><FormLabel>Регистрийн дугаар</FormLabel><FormControl><Input {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="birthDate" render={({ field }) => (<FormItem className="flex flex-col"><FormLabel>Төрсөн огноо</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>{field.value ? (format(new Date(field.value), "yyyy-MM-dd")) : (<span>Огноо сонгох</span>)}<CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl></PopoverTrigger><PopoverContent container={container} className="w-auto p-0" align="start"><Calendar mode="single" captionLayout="dropdown" fromYear={1960} toYear={new Date().getFullYear()} selected={field.value} onSelect={field.onChange} disabled={(date) => date > new Date() || date < new Date("1900-01-01")} initialFocus /></PopoverContent></Popover><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="gender" render={({ field }) => (<FormItem><FormLabel>Хүйс</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Хүйс сонгох" /></SelectTrigger></FormControl><SelectContent><SelectItem value="male">Эрэгтэй</SelectItem><SelectItem value="female">Эмэгтэй</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="idCardNumber" render={({ field }) => (<FormItem><FormLabel>ТТД</FormLabel><FormControl><Input {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="hasDisability" render={({ field }) => (<FormItem className="flex flex-row items-center space-x-2"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><FormLabel>Хөгжлийн бэрхшээлтэй эсэх</FormLabel></FormItem>)} />
                {hasDisability && (
                    <>
                        <FormField control={form.control} name="disabilityPercentage" render={({ field }) => (<FormItem><FormLabel>Хөдөлмөрийн чадвар алдалтын хувь (%)</FormLabel><FormControl><Input type="number" {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name="disabilityDate" render={({ field }) => (<FormItem className="flex flex-col"><FormLabel>Хөдөлмөрийн чадвар алдсан огноо</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>{field.value ? (format(new Date(field.value), "yyyy-MM-dd")) : (<span>Огноо сонгох</span>)}<CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl></PopoverTrigger><PopoverContent container={container} className="w-auto p-0" align="start"><Calendar mode="single" captionLayout="dropdown" fromYear={1980} toYear={new Date().getFullYear()} selected={field.value} onSelect={field.onChange} disabled={(date) => date > new Date()} initialFocus /></PopoverContent></Popover><FormMessage /></FormItem>)} />
                    </>
                )}
                <FormField control={form.control} name="hasDriversLicense" render={({ field }) => (<FormItem className="flex flex-row items-center space-x-2"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><FormLabel>Жолооны үнэмлэхтэй эсэх</FormLabel></FormItem>)} />
                {hasDriversLicense && (
                    <Card className="p-4 bg-muted/50"><FormLabel>Жолооны ангилал</FormLabel><FormField control={form.control} name="driverLicenseCategories" render={() => (<FormItem className="grid grid-cols-3 gap-4 mt-4">{driverLicenseCategoryItems.map((item) => (<FormField key={item} control={form.control} name="driverLicenseCategories" render={({ field }) => { return (<FormItem key={item} className="flex flex-row items-start space-x-2"><FormControl><Checkbox checked={field.value?.includes(item)} onCheckedChange={(checked) => { return checked ? form.setValue("driverLicenseCategories", [...(field.value || []), item]) : form.setValue("driverLicenseCategories", field.value?.filter((value: string) => value !== item)) }} /></FormControl><FormLabel className="font-normal">{item}</FormLabel></FormItem>) }} />))}<FormMessage /></FormItem>)} /></Card>
                )}
            </div>
            <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Хадгалах
            </Button>
        </>
    );
}

function ContactInfoForm({ form, isSubmitting, references }: { form: any, isSubmitting: boolean, references: any }) {
    const { fields, append, remove } = useFieldArray({ control: form.control, name: "emergencyContacts" });

    return (
        <>
            <div className="space-y-4">
                <FormField control={form.control} name="workPhone" render={({ field }) => (<FormItem><FormLabel>Гар утас (Албан)</FormLabel><FormControl><div className="relative"><Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="8811****" {...field} value={field.value || ''} className="pl-10" /></div></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="personalPhone" render={({ field }) => (<FormItem><FormLabel>Гар утас (Хувийн)</FormLabel><FormControl><div className="relative"><Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="9911****" {...field} value={field.value || ''} className="pl-10" /></div></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="workEmail" render={({ field }) => (<FormItem><FormLabel>Албан ёсны и-мэйл</FormLabel><FormControl><div className="relative"><Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input type="email" placeholder="name@example.com" {...field} value={field.value || ''} className="pl-10" /></div></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="personalEmail" render={({ field }) => (<FormItem><FormLabel>Хувийн и-мэйл</FormLabel><FormControl><div className="relative"><Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input type="email" placeholder="personal@example.com" {...field} value={field.value || ''} className="pl-10" /></div></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="homeAddress" render={({ field }) => (<FormItem><FormLabel>Гэрийн хаяг (Үндсэн)</FormLabel><FormControl><Textarea {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="temporaryAddress" render={({ field }) => (<FormItem><FormLabel>Гэрийн хаяг (Түр)</FormLabel><FormControl><Textarea {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>)} />
            </div>

            <Card className="bg-muted/50"><CardHeader><CardTitle className="text-base">Сошиал медиа</CardTitle></CardHeader><CardContent className="space-y-4">
                <FormField control={form.control} name="facebook" render={({ field }) => (<FormItem><FormLabel>Facebook</FormLabel><FormControl><div className="relative"><Facebook className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input {...field} value={field.value || ''} className="pl-10" /></div></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="instagram" render={({ field }) => (<FormItem><FormLabel>Instagram</FormLabel><FormControl><div className="relative"><Instagram className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input {...field} value={field.value || ''} className="pl-10" /></div></FormControl><FormMessage /></FormItem>)} />
            </CardContent></Card>

            <Card className="bg-muted/50"><CardHeader><CardTitle className="text-base">Яаралтай үед холбоо барих</CardTitle></CardHeader><CardContent className="space-y-4">
                {fields.map((field, index) => (
                    <Card key={field.id} className="p-4 relative bg-background"><Button type="button" variant="ghost" size="icon" className="absolute top-1 right-1 h-7 w-7 text-destructive" onClick={() => remove(index)}><Trash2 className="h-4 w-4" /><span className="sr-only">Устгах</span></Button><div className="space-y-4 pt-6">
                        <FormField control={form.control} name={`emergencyContacts.${index}.fullName`} render={({ field }) => (<FormItem><FormLabel>Овог, нэр</FormLabel><FormControl><Input {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name={`emergencyContacts.${index}.relationship`} render={({ field }) => (<FormItem><FormLabel>Таны хэн болох</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Сонгох" /></SelectTrigger></FormControl><SelectContent>{references.emergencyRelationships?.map((item: ReferenceItem) => <SelectItem key={item.id} value={item.name}>{item.name}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name={`emergencyContacts.${index}.phone`} render={({ field }) => (<FormItem><FormLabel>Утас</FormLabel><FormControl><div className="relative"><Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input {...field} value={field.value || ''} className="pl-10" /></div></FormControl><FormMessage /></FormItem>)} />
                    </div></Card>
                ))}
                <Button type="button" variant="outline" size="sm" className="w-full bg-background" onClick={() => append({ fullName: '', relationship: '', phone: '' })}><PlusCircle className="mr-2 h-4 w-4" />Нэмэх</Button>
            </CardContent></Card>

            <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Хадгалах
            </Button>
        </>
    );
}

function EducationForm({ form, isSubmitting, references }: { form: any; isSubmitting: boolean, references: any }) {
    const container = useMobileContainer();
    const { fields, append, remove } = useFieldArray({
        control: form.control,
        name: "education",
    });

    return (
        <>
            <Alert><AlertCircle className="h-4 w-4" /><AlertTitle>Анхаар</AlertTitle><AlertDescription>Ерөнхий боловсролын сургуулиас эхлэн төгссөн дарааллын дагуу бичнэ үү.</AlertDescription></Alert>
            <div className="space-y-4">
                {fields.map((field, index) => (
                    <Card key={field.id} className="p-4 bg-muted/50">
                        <div className="space-y-4">
                            <div className="flex justify-end">
                                <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => remove(index)}>
                                    <Trash2 className="h-4 w-4" />
                                    <span className="sr-only">Устгах</span>
                                </Button>
                            </div>
                            <FormField control={form.control} name={`education.${index}.country`} render={({ field }) => (<FormItem><FormLabel>Хаана</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Улс сонгох" /></SelectTrigger></FormControl><SelectContent>{references.countries?.map((item: ReferenceItem) => <SelectItem key={item.id} value={item.name}>{item.name}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name={`education.${index}.school`} render={({ field }) => (<FormItem><FormLabel>Төгссөн сургууль</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Сургууль сонгох" /></SelectTrigger></FormControl><SelectContent>{references.schools?.map((item: ReferenceItem) => <SelectItem key={item.id} value={item.name}>{item.name}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name={`education.${index}.schoolCustom`} render={({ field }) => (<FormItem><FormLabel>Төгссөн сургууль /бичих/</FormLabel><FormControl><Input placeholder="Сонголтонд байхгүй бол энд бичнэ үү" {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name={`education.${index}.entryDate`} render={({ field }) => (<FormItem className="flex flex-col"><FormLabel>Элссэн огноо</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant={"outline"} className={cn("pl-3 text-left font-normal bg-background", !field.value && "text-muted-foreground")}>{field.value ? format(new Date(field.value), "yyyy-MM-dd") : <span>Огноо сонгох</span>}<CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl></PopoverTrigger><PopoverContent container={container} className="w-auto p-0" align="start"><Calendar mode="single" captionLayout="dropdown" fromYear={1980} toYear={new Date().getFullYear()} selected={field.value} onSelect={field.onChange} initialFocus /></PopoverContent></Popover><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name={`education.${index}.gradDate`} render={({ field }) => (<FormItem className="flex flex-col"><FormLabel>Төгссөн огноо</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant={"outline"} disabled={form.watch(`education.${index}.isCurrent`)} className={cn("pl-3 text-left font-normal bg-background", !field.value && "text-muted-foreground")}>{field.value ? format(new Date(field.value), "yyyy-MM-dd") : <span>Огноо сонгох</span>}<CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl></PopoverTrigger><PopoverContent container={container} className="w-auto p-0" align="start"><Calendar mode="single" captionLayout="dropdown" fromYear={1980} toYear={new Date().getFullYear()} selected={field.value} onSelect={field.onChange} initialFocus /></PopoverContent></Popover><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name={`education.${index}.isCurrent`} render={({ field }) => (<FormItem className="flex flex-row items-center space-x-2"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><FormLabel className="font-normal">Одоо сурч байгаа</FormLabel></FormItem>)} />
                            <FormField control={form.control} name={`education.${index}.degree`} render={({ field }) => (<FormItem><FormLabel>Эзэмшсэн мэргэжил</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Мэргэжил сонгох" /></SelectTrigger></FormControl><SelectContent>{references.degrees?.map((item: ReferenceItem) => <SelectItem key={item.id} value={item.name}>{item.name}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name={`education.${index}.diplomaNumber`} render={({ field }) => (<FormItem><FormLabel>Диплом, үнэмлэхний дугаар</FormLabel><FormControl><Input {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name={`education.${index}.academicRank`} render={({ field }) => (<FormItem><FormLabel>Зэрэг, цол</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Зэрэг, цол сонгох" /></SelectTrigger></FormControl><SelectContent>{references.academicRanks?.map((item: ReferenceItem) => <SelectItem key={item.id} value={item.name}>{item.name}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                        </div>
                    </Card>
                ))}
            </div>
            <Button type="button" variant="outline" size="sm" className="w-full bg-background mt-4" onClick={() => append({ country: '', school: '', schoolCustom: '', degree: '', diplomaNumber: '', academicRank: '', entryDate: null, gradDate: null, isCurrent: false })}>
                <PlusCircle className="mr-2 h-4 w-4" />
                Боловсрол нэмэх
            </Button>
            <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                    <Save className="mr-2 h-4 w-4" />
                )}
                Хадгалах
            </Button>
        </>
    );
}

function LanguageForm({ form, isSubmitting, references }: { form: any; isSubmitting: boolean, references: any }) {
    const { fields, append, remove } = useFieldArray({ control: form.control, name: "languages" });
    const proficiencyLevels = ['Анхан', 'Дунд', 'Ахисан', 'Мэргэжлийн'];

    return (
        <>
            <Alert><AlertCircle className="h-4 w-4" /><AlertTitle>Түвшин оруулах</AlertTitle><AlertDescription>*Олон улсад хүлээн зөвшөөрөгдөх түвшин тогтоох шалгалтын оноог оруулна уу.</AlertDescription></Alert>
            <div className="space-y-4">
                {fields.map((field, index) => (
                    <Card key={field.id} className="p-4 bg-muted/50">
                        <div className="space-y-4">
                            <div className="flex justify-end">
                                <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => remove(index)}>
                                    <Trash2 className="h-4 w-4" />
                                    <span className="sr-only">Устгах</span>
                                </Button>
                            </div>
                            <FormField control={form.control} name={`languages.${index}.language`} render={({ field }) => (<FormItem><FormLabel>Гадаад хэл</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Хэл сонгох" /></SelectTrigger></FormControl><SelectContent>{references.languages?.map((lang: ReferenceItem) => (<SelectItem key={lang.id} value={lang.name}>{lang.name}</SelectItem>))}</SelectContent></Select><FormMessage /></FormItem>)} />
                            <div className="grid grid-cols-2 gap-4">
                                <FormField control={form.control} name={`languages.${index}.listening`} render={({ field }) => (<FormItem><FormLabel>Сонсох</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Түвшин" /></SelectTrigger></FormControl><SelectContent>{proficiencyLevels.map(level => <SelectItem key={level} value={level}>{level}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                                <FormField control={form.control} name={`languages.${index}.reading`} render={({ field }) => (<FormItem><FormLabel>Унших</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Түвшин" /></SelectTrigger></FormControl><SelectContent>{proficiencyLevels.map(level => <SelectItem key={level} value={level}>{level}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                                <FormField control={form.control} name={`languages.${index}.speaking`} render={({ field }) => (<FormItem><FormLabel>Ярих</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Түвшин" /></SelectTrigger></FormControl><SelectContent>{proficiencyLevels.map(level => <SelectItem key={level} value={level}>{level}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                                <FormField control={form.control} name={`languages.${index}.writing`} render={({ field }) => (<FormItem><FormLabel>Бичих</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Түвшин" /></SelectTrigger></FormControl><SelectContent>{proficiencyLevels.map(level => <SelectItem key={level} value={level}>{level}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                            </div>
                            <FormField control={form.control} name={`languages.${index}.testScore`} render={({ field }) => (<FormItem><FormLabel>Шалгалтын оноо</FormLabel><FormControl><Input placeholder="TOEFL-ийн оноо..." {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>)} />
                        </div>
                    </Card>
                ))}
            </div>
            <Button type="button" variant="outline" size="sm" className="w-full bg-background mt-4" onClick={() => append({ language: '', listening: '', reading: '', speaking: '', writing: '', testScore: '' })}>
                <PlusCircle className="mr-2 h-4 w-4" />
                Хэл нэмэх
            </Button>
            <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Хадгалах
            </Button>
        </>
    );
}

function TrainingForm({ form, isSubmitting }: { form: any; isSubmitting: boolean }) {
    const container = useMobileContainer();
    const { fields, append, remove } = useFieldArray({ control: form.control, name: "trainings" });

    return (
        <>
            <Alert><AlertCircle className="h-4 w-4" /><AlertTitle>Анхаар</AlertTitle><AlertDescription>Мэргэжлээрээ болон бусад төрлөөр 1 сараас дээш хугацаагаар хамрагдаж байсан сургалт.</AlertDescription></Alert>
            <div className="space-y-4">
                {fields.map((field, index) => (
                    <Card key={field.id} className="p-4 bg-muted/50">
                        <div className="space-y-4">
                            <div className="flex justify-end">
                                <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => remove(index)}>
                                    <Trash2 className="h-4 w-4" />
                                    <span className="sr-only">Устгах</span>
                                </Button>
                            </div>
                            <FormField control={form.control} name={`trainings.${index}.name`} render={({ field }) => (<FormItem><FormLabel>Сургалтын нэр</FormLabel><FormControl><Input {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name={`trainings.${index}.organization`} render={({ field }) => (<FormItem><FormLabel>Сургалт явуулсан байгууллага</FormLabel><FormControl><Input {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>)} />
                            <div className="grid grid-cols-2 gap-4">
                                <FormField control={form.control} name={`trainings.${index}.startDate`} render={({ field }) => (<FormItem className="flex flex-col"><FormLabel>Эхэлсэн огноо</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant={"outline"} className={cn("pl-3 text-left font-normal bg-background", !field.value && "text-muted-foreground")}>{field.value ? format(new Date(field.value), "yyyy-MM-dd") : <span>Огноо сонгох</span>}<CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl></PopoverTrigger><PopoverContent container={container} className="w-auto p-0" align="start"><Calendar mode="single" captionLayout="dropdown" fromYear={1980} toYear={new Date().getFullYear()} selected={field.value} onSelect={field.onChange} initialFocus /></PopoverContent></Popover><FormMessage /></FormItem>)} />
                                <FormField control={form.control} name={`trainings.${index}.endDate`} render={({ field }) => (<FormItem className="flex flex-col"><FormLabel>Дууссан огноо</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant={"outline"} className={cn("pl-3 text-left font-normal bg-background", !field.value && "text-muted-foreground")}>{field.value ? format(new Date(field.value), "yyyy-MM-dd") : <span>Огноо сонгох</span>}<CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl></PopoverTrigger><PopoverContent container={container} className="w-auto p-0" align="start"><Calendar mode="single" captionLayout="dropdown" fromYear={1980} toYear={new Date().getFullYear()} selected={field.value} onSelect={field.onChange} initialFocus /></PopoverContent></Popover><FormMessage /></FormItem>)} />
                            </div>
                            <FormField control={form.control} name={`trainings.${index}.certificateNumber`} render={({ field }) => (<FormItem><FormLabel>Үнэмлэх, сертификатын дугаар</FormLabel><FormControl><Input {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>)} />
                        </div>
                    </Card>
                ))}
            </div>
            <Button type="button" variant="outline" size="sm" className="w-full bg-background mt-4" onClick={() => append({ name: '', organization: '', startDate: null, endDate: null, certificateNumber: '' })}>
                <PlusCircle className="mr-2 h-4 w-4" />
                Мэргэшлийн бэлтгэл нэмэх
            </Button>
            <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Хадгалах
            </Button>
        </>
    );
}

function FamilyInfoForm({ form, isSubmitting, references }: { form: any; isSubmitting: boolean, references: any }) {
    const { fields, append, remove } = useFieldArray({ control: form.control, name: "familyMembers" });

    return (
        <>
            <div className="space-y-4">
                {fields.map((field, index) => (
                    <Card key={field.id} className="relative p-4 bg-muted/50">
                        <div className="space-y-4">
                            <div className="flex justify-end">
                                <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => remove(index)}>
                                    <Trash2 className="h-4 w-4" />
                                    <span className="sr-only">Устгах</span>
                                </Button>
                            </div>
                            <FormField control={form.control} name={`familyMembers.${index}.relationship`} render={({ field }) => (<FormItem><FormLabel>Таны хэн болох</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Сонгох" /></SelectTrigger></FormControl><SelectContent>{references.familyRelationships?.map((opt: ReferenceItem) => <SelectItem key={opt.id} value={opt.name}>{opt.name}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name={`familyMembers.${index}.lastName`} render={({ field }) => (<FormItem><FormLabel>Овог</FormLabel><FormControl><Input placeholder="Овог" {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name={`familyMembers.${index}.firstName`} render={({ field }) => (<FormItem><FormLabel>Нэр</FormLabel><FormControl><Input placeholder="Нэр" {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name={`familyMembers.${index}.phone`} render={({ field }) => (<FormItem><FormLabel>Холбоо барих утас</FormLabel><FormControl><Input placeholder="Утасны дугаар" {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>)} />
                        </div>
                    </Card>
                ))}
            </div>
            <Button type="button" variant="outline" size="sm" className="w-full bg-background mt-4" onClick={() => append({ relationship: '', lastName: '', firstName: '', phone: '' })}>
                <PlusCircle className="mr-2 h-4 w-4" />
                Гэр бүлийн гишүүн нэмэх
            </Button>
            <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Хадгалах
            </Button>
        </>
    );
}

function WorkExperienceForm({ form, isSubmitting, references }: { form: any; isSubmitting: boolean, references: any }) {
    const container = useMobileContainer();
    const { fields, append, remove } = useFieldArray({ control: form.control, name: "experiences" });

    return (
        <>
            <div className="space-y-4">
                {fields.map((field, index) => (
                    <Card key={field.id} className="relative p-4 bg-muted/50">
                        <div className="space-y-4">
                            <div className="flex justify-end">
                                <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => remove(index)}>
                                    <Trash2 className="h-4 w-4" />
                                    <span className="sr-only">Устгах</span>
                                </Button>
                            </div>
                            <FormField control={form.control} name={`experiences.${index}.company`} render={({ field }) => (<FormItem><FormLabel>Компани</FormLabel><FormControl><Input placeholder="Ажиллаж байсан компани" {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name={`experiences.${index}.position`} render={({ field }) => (<FormItem><FormLabel>Ажлын байр</FormLabel><FormControl><Input placeholder="Албан тушаал" {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name={`experiences.${index}.startDate`} render={({ field }) => (<FormItem className="flex flex-col"><FormLabel>Эхэлсэн огноо</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant={"outline"} className={cn("pl-3 text-left font-normal bg-background", !field.value && "text-muted-foreground")}>{field.value ? format(new Date(field.value), "yyyy-MM-dd") : <span>Огноо сонгох</span>}<CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl></PopoverTrigger><PopoverContent container={container} className="w-auto p-0" align="start"><Calendar mode="single" captionLayout="dropdown" fromYear={1980} toYear={new Date().getFullYear()} selected={field.value} onSelect={field.onChange} initialFocus /></PopoverContent></Popover><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name={`experiences.${index}.endDate`} render={({ field }) => (<FormItem className="flex flex-col"><FormLabel>Дууссан огноо</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant={"outline"} className={cn("pl-3 text-left font-normal bg-background", !field.value && "text-muted-foreground")}>{field.value ? format(new Date(field.value), "yyyy-MM-dd") : <span>Огноо сонгох</span>}<CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl></PopoverTrigger><PopoverContent container={container} className="w-auto p-0" align="start"><Calendar mode="single" captionLayout="dropdown" fromYear={1980} toYear={new Date().getFullYear()} selected={field.value} onSelect={field.onChange} initialFocus /></PopoverContent></Popover><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name={`experiences.${index}.employmentType`} render={({ field }) => (<FormItem><FormLabel>Хөдөлмөрийн нөхцөл</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Нөхцөл сонгох" /></SelectTrigger></FormControl><SelectContent>{references.employmentTypes?.map((item: ReferenceItem) => <SelectItem key={item.id} value={item.name}>{item.name}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name={`experiences.${index}.description`} render={({ field }) => (<FormItem><FormLabel>Ажлын тодорхойлолт</FormLabel><FormControl><Textarea placeholder="Гүйцэтгэсэн үүрэг, хариуцлагын талаар товч бичнэ үү..." {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>)} />
                        </div>
                    </Card>
                ))}
            </div>
            <Button type="button" variant="outline" size="sm" className="w-full bg-background mt-4" onClick={() => append({ company: '', position: '', startDate: null, endDate: null, employmentType: '', description: '' })}>
                <PlusCircle className="mr-2 h-4 w-4" />
                Ажлын туршлага нэмэх
            </Button>
            <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Хадгалах
            </Button>
        </>
    );
}


export default function MobileProfileEditPage() {
    const { employeeProfile, isProfileLoading } = useEmployeeProfile();
    const { firestore } = useFirebase();
    const isLocked = !!employeeProfile?.questionnaireLocked;

    const questionnaireDocRef = useMemoFirebase(
        ({ companyPath }) => (firestore && employeeProfile ? tenantDoc(firestore, companyPath, `employees/${employeeProfile.id}/questionnaire`, 'data') : null),
        [firestore, employeeProfile]
    );

    const { data: questionnaireData, isLoading: isQuestionnaireLoading } = useDoc<FullQuestionnaireValues>(questionnaireDocRef);

    // Questionnaire references
    const { data: countries, isLoading: isLoadingCountries } = useCollection<ReferenceItem>(useMemoFirebase(({ companyPath }) => firestore ? tenantCollection(firestore, companyPath, 'questionnaireCountries') : null, [firestore]));
    const { data: schools, isLoading: isLoadingSchools } = useCollection<ReferenceItem>(useMemoFirebase(({ companyPath }) => firestore ? tenantCollection(firestore, companyPath, 'questionnaireSchools') : null, [firestore]));
    const { data: degrees, isLoading: isLoadingDegrees } = useCollection<ReferenceItem>(useMemoFirebase(({ companyPath }) => firestore ? tenantCollection(firestore, companyPath, 'questionnaireDegrees') : null, [firestore]));
    const { data: academicRanks, isLoading: isLoadingRanks } = useCollection<ReferenceItem>(useMemoFirebase(({ companyPath }) => firestore ? tenantCollection(firestore, companyPath, 'questionnaireAcademicRanks') : null, [firestore]));
    const { data: languages, isLoading: isLoadingLanguages } = useCollection<ReferenceItem>(useMemoFirebase(({ companyPath }) => firestore ? tenantCollection(firestore, companyPath, 'questionnaireLanguages') : null, [firestore]));
    const { data: familyRelationships, isLoading: isLoadingFamilyR } = useCollection<ReferenceItem>(useMemoFirebase(({ companyPath }) => firestore ? tenantCollection(firestore, companyPath, 'questionnaireFamilyRelationships') : null, [firestore]));
    const { data: emergencyRelationships, isLoading: isLoadingEmergencyR } = useCollection<ReferenceItem>(useMemoFirebase(({ companyPath }) => firestore ? tenantCollection(firestore, companyPath, 'questionnaireEmergencyRelationships') : null, [firestore]));
    const { data: questionnaireEmploymentTypes, isLoading: isLoadingEmpTypes } = useCollection<ReferenceItem>(useMemoFirebase(({ companyPath }) => firestore ? tenantCollection(firestore, companyPath, 'questionnaireEmploymentTypes') : null, [firestore]));

    const defaultValues = React.useMemo(() => {
        const initialData = {
            lastName: '', firstName: '', registrationNumber: '', birthDate: null, gender: '', idCardNumber: '',
            hasDisability: false, disabilityPercentage: '', disabilityDate: null, hasDriversLicense: false, driverLicenseCategories: [],
            workPhone: '', personalPhone: '', workEmail: '', personalEmail: '', homeAddress: '', temporaryAddress: '', facebook: '', instagram: '',
            emergencyContacts: [], education: [], languages: [], trainings: [], familyMembers: [], experiences: []
        };
        return transformDates({ ...initialData, ...questionnaireData });
    }, [questionnaireData]);

    const references = {
        countries, schools, degrees, academicRanks, languages, familyRelationships, emergencyRelationships,
        employmentTypes: questionnaireEmploymentTypes
    };

    const isLoading = isProfileLoading || isQuestionnaireLoading || isLoadingCountries || isLoadingSchools || isLoadingDegrees || isLoadingRanks || isLoadingLanguages || isLoadingFamilyR || isLoadingEmergencyR || isLoadingEmpTypes;

    if (isLoading) {
        return <PageSkeleton />;
    }

    return (
        <div className="p-4">
            <header className="py-4 relative flex items-center justify-center">
                <Button asChild variant="ghost" size="icon" className="absolute left-0">
                    <Link href="/mobile/user">
                        <ArrowLeft className="h-5 w-5" />
                        <span className="sr-only">Буцах</span>
                    </Link>
                </Button>
                <h1 className="text-xl font-semibold">Анкет засах</h1>
            </header>

            {isLocked && (
                <Alert className="mb-4" variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Анкет түгжигдсэн</AlertTitle>
                    <AlertDescription>
                        Таны анкетийг засах эрх түгжигдсэн байна. Зөвхөн админ засвар хийх боломжтой.
                    </AlertDescription>
                </Alert>
            )}

            <div className="flex flex-col items-center gap-4 my-4">
                <div className="relative">
                    <Avatar className="h-24 w-24">
                        <AvatarImage src={employeeProfile?.photoURL} alt="Profile picture" />
                        <AvatarFallback className="bg-muted">
                            <Camera className="h-8 w-8 text-muted-foreground" />
                        </AvatarFallback>
                    </Avatar>
                    <Button size="icon" variant="outline" className="absolute bottom-0 right-0 h-8 w-8 rounded-full">
                        <Camera className="h-4 w-4" />
                        <span className="sr-only">Зураг солих</span>
                    </Button>
                </div>
            </div>

            <Accordion type="single" collapsible className="w-full space-y-4">
                <AccordionItem value="general" className="rounded-lg border bg-card text-card-foreground shadow-sm">
                    <AccordionTrigger className="p-4 font-semibold text-base">Ерөнхий мэдээлэл</AccordionTrigger>
                    <AccordionContent className="p-4 pt-0">
                        <FormSection docRef={questionnaireDocRef} defaultValues={defaultValues} schema={generalInfoSchema} isLocked={isLocked}>
                            {(form, isSubmitting) => <GeneralInfoForm form={form} isSubmitting={isSubmitting} />}
                        </FormSection>
                    </AccordionContent>
                </AccordionItem>

                <AccordionItem value="contact" className="rounded-lg border bg-card text-card-foreground shadow-sm">
                    <AccordionTrigger className="p-4 font-semibold text-base">Холбоо барих</AccordionTrigger>
                    <AccordionContent className="p-4 pt-0">
                        <FormSection docRef={questionnaireDocRef} defaultValues={defaultValues} schema={contactInfoSchema} isLocked={isLocked}>
                            {(form, isSubmitting) => <ContactInfoForm form={form} isSubmitting={isSubmitting} references={references} />}
                        </FormSection>
                    </AccordionContent>
                </AccordionItem>

                <AccordionItem value="education" className="rounded-lg border bg-card text-card-foreground shadow-sm">
                    <AccordionTrigger className="p-4 font-semibold text-base">Боловсрол</AccordionTrigger>
                    <AccordionContent className="p-4 pt-0">
                        <FormSection docRef={questionnaireDocRef} defaultValues={defaultValues} schema={educationHistorySchema} isLocked={isLocked}>
                            {(form, isSubmitting) => <EducationForm form={form} isSubmitting={isSubmitting} references={references} />}
                        </FormSection>
                    </AccordionContent>
                </AccordionItem>

                <AccordionItem value="language" className="rounded-lg border bg-card text-card-foreground shadow-sm">
                    <AccordionTrigger className="p-4 font-semibold text-base">Гадаад хэл</AccordionTrigger>
                    <AccordionContent className="p-4 pt-0">
                        <FormSection docRef={questionnaireDocRef} defaultValues={defaultValues} schema={languageSkillsSchema} isLocked={isLocked}>
                            {(form, isSubmitting) => <LanguageForm form={form} isSubmitting={isSubmitting} references={references} />}
                        </FormSection>
                    </AccordionContent>
                </AccordionItem>

                <AccordionItem value="training" className="rounded-lg border bg-card text-card-foreground shadow-sm">
                    <AccordionTrigger className="p-4 font-semibold text-base">Мэргэшлийн бэлтгэл</AccordionTrigger>
                    <AccordionContent className="p-4 pt-0">
                        <FormSection docRef={questionnaireDocRef} defaultValues={defaultValues} schema={professionalTrainingSchema} isLocked={isLocked}>
                            {(form, isSubmitting) => <TrainingForm form={form} isSubmitting={isSubmitting} />}
                        </FormSection>
                    </AccordionContent>
                </AccordionItem>

                <AccordionItem value="family" className="rounded-lg border bg-card text-card-foreground shadow-sm">
                    <AccordionTrigger className="p-4 font-semibold text-base">Гэр бүлийн мэдээлэл</AccordionTrigger>
                    <AccordionContent className="p-4 pt-0">
                        <FormSection docRef={questionnaireDocRef} defaultValues={defaultValues} schema={familyInfoSchema} isLocked={isLocked}>
                            {(form, isSubmitting) => <FamilyInfoForm form={form} isSubmitting={isSubmitting} references={references} />}
                        </FormSection>
                    </AccordionContent>
                </AccordionItem>

                <AccordionItem value="experience" className="rounded-lg border bg-card text-card-foreground shadow-sm">
                    <AccordionTrigger className="p-4 font-semibold text-base">Ажлын туршлага</AccordionTrigger>
                    <AccordionContent className="p-4 pt-0">
                        <FormSection docRef={questionnaireDocRef} defaultValues={defaultValues} schema={workExperienceHistorySchema} isLocked={isLocked}>
                            {(form, isSubmitting) => <WorkExperienceForm form={form} isSubmitting={isSubmitting} references={references} />}
                        </FormSection>
                    </AccordionContent>
                </AccordionItem>
            </Accordion>
        </div>
    )
}
