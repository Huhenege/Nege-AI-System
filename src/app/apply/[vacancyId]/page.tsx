'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { cn } from '@/lib/utils';
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, CheckCircle, Briefcase, Building2, MapPin, Upload, Calendar as CalendarIcon } from 'lucide-react';
import { Vacancy, RecruitmentStage } from '@/types/recruitment';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { format, differenceInDays } from 'date-fns';
import { mn } from 'date-fns/locale';

const DEFAULT_STAGES: RecruitmentStage[] = [
    { id: 'screening', title: 'Анкет шүүлт', type: 'SCREENING', order: 0 },
    { id: 'first-interview', title: 'Анхан шатны ярилцлага', type: 'INTERVIEW', order: 1 },
    { id: 'tech-task', title: 'Даалгавар', type: 'CHALLENGE', order: 2 },
    { id: 'final-interview', title: 'Эцсийн ярилцлага', type: 'INTERVIEW', order: 3 },
    { id: 'offer', title: 'Санал тавих', type: 'OFFER', order: 4 },
];

const applicationSchema = z.object({
    firstName: z.string().min(2, 'Нэрээ оруулна уу'),
    lastName: z.string().min(2, 'Овгоо оруулна уу'),
    email: z.string().email('Имэйл хаягаа зөв оруулна уу'),
    phone: z.string().min(8, 'Утасны дугаараа оруулна уу'),
    resumeUrl: z.string().optional(), // In real app, this would be file upload handling
    coverLetter: z.string().optional(),
});

type ApplicationFormValues = z.infer<typeof applicationSchema>;

export default function PublicApplicationPage() {
    const params = useParams();
    const vacancyId = params?.vacancyId as string;
    const { toast } = useToast();
    const [isLoadingData, setIsLoadingData] = useState(true);
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [vacancy, setVacancy] = useState<Vacancy | null>(null);
    const [companyId, setCompanyId] = useState<string | null>(null);
    const [globalStages, setGlobalStages] = useState<RecruitmentStage[]>(DEFAULT_STAGES);

    useEffect(() => {
        const fetchData = async () => {
            if (!vacancyId) return;
            setIsLoadingData(true);
            try {
                const res = await fetch(`/api/vacancies/${vacancyId}`);
                if (res.ok) {
                    const data = await res.json();
                    if (data.vacancy) setVacancy(data.vacancy as Vacancy);
                    if (data.stages) setGlobalStages(data.stages);
                    if (data.companyId) setCompanyId(data.companyId);
                }
            } catch (error) {
                console.error("Error fetching application data:", error);
            } finally {
                setIsLoadingData(false);
            }
        };
        fetchData();
    }, [vacancyId]);

    const form = useForm<ApplicationFormValues>({
        resolver: zodResolver(applicationSchema),
        defaultValues: {
            firstName: '',
            lastName: '',
            email: '',
            phone: '',
            resumeUrl: '',
            coverLetter: '',
        },
    });

    const onSubmit = async (data: ApplicationFormValues) => {
        if (!vacancy) return;
        setIsSubmitting(true);

        try {
            const res = await fetch(`/api/vacancies/${vacancyId}/apply`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    firstName: data.firstName,
                    lastName: data.lastName,
                    email: data.email,
                    phone: data.phone,
                    resumeUrl: data.resumeUrl,
                    coverLetter: data.coverLetter,
                    companyId,
                }),
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Application failed');
            }

            setIsSubmitted(true);
        } catch (error) {
            console.error(error);
            toast({
                title: 'Алдаа гарлаа',
                description: 'Сүлжээний алдаа.',
                variant: 'destructive',
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isLoadingData) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
            </div>
        );
    }

    if (!vacancy && !isLoadingData) {
        return (
            <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
                <div className="text-center space-y-4">
                    <h1 className="text-2xl font-bold text-slate-900">Ажлын байр олдсонгүй</h1>
                    <p className="text-slate-600">Таны хайсан зар хаагдсан эсвэл устагсан байх магадлалтай.</p>
                    <Link href="/">
                        <Button variant="outline">Нүүр хуудас руу буцах</Button>
                    </Link>
                </div>
            </div>
        );
    }

    if (isSubmitted) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
                <Card className="w-full max-w-md text-center py-10 px-4 shadow-lg border-emerald-100">
                    <CardContent className="flex flex-col items-center space-y-4">
                        <div className="h-16 w-16 bg-emerald-100 rounded-full flex items-center justify-center mb-4">
                            <CheckCircle className="h-8 w-8 text-emerald-600" />
                        </div>
                        <h2 className="text-2xl font-bold text-slate-900">Амжилттай илгээгдлээ!</h2>
                        <p className="text-slate-600">
                            Бид таны анкелийг хүлээн авлаа. Таньтай удахгүй холбогдох болно.
                        </p>
                        <Button onClick={() => window.location.reload()} variant="outline" className="mt-6">
                            Дахин илгээх
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl mx-auto space-y-8">
                {/* Job Header */}
                <div className="bg-white rounded-2xl shadow-sm p-8 border">
                    <div className="flex items-start justify-between">
                        <div>
                            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">{vacancy?.title}</h1>
                            <div className="mt-4 flex flex-wrap gap-4 text-sm text-slate-500">
                                <div className="flex items-center gap-1.5">
                                    <Building2 className="h-4 w-4" />
                                    <span>HR Company</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <Briefcase className="h-4 w-4" />
                                    <span>Бүтэн цаг</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <MapPin className="h-4 w-4" />
                                    <span>Улаанбаатар</span>
                                </div>
                            </div>
                        </div>
                        <Building2 className="h-12 w-12 text-slate-200" />
                    </div>

                    {/* Description Rendering */}
                    <div className="mt-8">
                        {vacancy?.description ? (
                            <div className="prose prose-slate max-w-none prose-headings:text-slate-900 prose-p:text-slate-600 prose-li:text-slate-600 prose-img:rounded-xl">
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                    {vacancy.description}
                                </ReactMarkdown>
                            </div>
                        ) : (
                            <div className="py-12 text-center bg-slate-50 rounded-xl border border-dashed">
                                <p className="text-slate-400 italic">Дэлгэрэнгүй мэдээлэл оруулаагүй байна.</p>
                            </div>
                        )}

                        {vacancy?.requirements && vacancy.requirements.length > 0 && (
                            <div className="mt-10 pt-8 border-t">
                                <h3 className="text-xl font-bold text-slate-900 mb-4">Тавигдах шаардлага</h3>
                                <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {vacancy.requirements.map((req: string, i: number) => (
                                        <li key={i} className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 border border-slate-100/50">
                                            <div className="h-5 w-5 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shrink-0 mt-0.5">
                                                <CheckCircle className="h-3 w-3" />
                                            </div>
                                            <span className="text-slate-600 text-sm">{req}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                </div>

                {/* Deadline Alert if close */}
                {vacancy?.deadline && (
                    <div className={cn(
                        "p-4 rounded-xl border flex items-center justify-between",
                        differenceInDays(new Date(vacancy.deadline), new Date()) <= 3
                            ? "bg-red-50 border-red-100 text-red-700"
                            : "bg-blue-50 border-blue-100 text-blue-700"
                    )}>
                        <div className="flex items-center gap-3 text-sm font-medium">
                            <CalendarIcon className="h-4 w-4" />
                            <span>Материал хүлээн авах эцсийн хугацаа: {format(new Date(vacancy.deadline), 'yyyy-MM-dd')}</span>
                        </div>
                        <Badge variant="outline" className="bg-white/50">
                            {differenceInDays(new Date(vacancy.deadline), new Date())} хоног үлдлээ
                        </Badge>
                    </div>
                )}

                {/* Application Form */}
                <Card className="shadow-lg border-blue-100">
                    <CardHeader className="bg-blue-50/50 border-b border-blue-100 p-6">
                        <CardTitle className="text-xl text-blue-900">Анкет бөглөх</CardTitle>
                        <CardDescription>
                            Та доорх форм-г бөглөн материалаа илгээнэ үү.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="p-8">
                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <FormField
                                        control={form.control}
                                        name="lastName"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Овог *</FormLabel>
                                                <FormControl>
                                                    <Input placeholder="Bold" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="firstName"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Нэр *</FormLabel>
                                                <FormControl>
                                                    <Input placeholder="Bat" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <FormField
                                        control={form.control}
                                        name="email"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Имэйл хаяг *</FormLabel>
                                                <FormControl>
                                                    <Input placeholder="example@gmail.com" type="email" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="phone"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Утасны дугаар *</FormLabel>
                                                <FormControl>
                                                    <Input placeholder="99119911" type="tel" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>

                                <FormField
                                    control={form.control}
                                    name="resumeUrl"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>CV / Resume холбоос</FormLabel>
                                            <FormControl>
                                                <div className="flex gap-2">
                                                    <Input placeholder="https://drive.google.com/file/..." {...field} />
                                                </div>
                                            </FormControl>
                                            <p className="text-xs text-muted-foreground">URL холбоос оруулна уу (Drive, LinkedIn etc)</p>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="coverLetter"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Нэмэлт мэдээлэл / Cover Letter</FormLabel>
                                            <FormControl>
                                                <Textarea
                                                    placeholder="Та өөрийнхөө тухай болон яагаад энэ ажлын байранд тохирох тухайгаа бичнэ үү..."
                                                    className="min-h-[120px]"
                                                    {...field}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <div className="pt-4 border-t">
                                    <Button type="submit" size="lg" className="w-full md:w-auto min-w-[200px]" disabled={isSubmitting}>
                                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                        Материал илгээх
                                    </Button>
                                </div>
                            </form>
                        </Form>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
