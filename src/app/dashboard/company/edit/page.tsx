'use client';

import * as React from 'react';
import { getAuthHeaders } from '@/lib/api/client-auth';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription,
} from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
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
import { useFirebase, useDoc, useMemoFirebase, setDocumentNonBlocking, updateDocumentNonBlocking, tenantDoc } from '@/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Loader2, Save, X, Upload, Building, ArrowLeft, Trash, Image as ImageIcon, FileText, Sparkles } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import Link from 'next/link';
import { PageHeader } from '@/components/patterns/page-layout';
import { Badge } from '@/components/ui/badge';


const companyProfileSchema = z.object({
    name: z.string().min(2, { message: 'Нэр дор хаяж 2 тэмдэгттэй байх ёстой.' }),
    logoUrl: z.string().optional(),
    certificateFrontUrl: z.string().optional(),
    certificateBackUrl: z.string().optional(),
    legalName: z.string().optional(),
    executiveOrderName: z.string().optional(),
    registrationNumber: z.string().optional(),
    taxId: z.string().optional(),
    industry: z.string().optional(),
    employeeCount: z.string().optional(),
    ceo: z.string().optional(),
    website: z.string().url({ message: 'Вэбсайтын хаяг буруу байна.' }).optional().or(z.literal('')),
    phoneNumber: z.string().optional(),
    contactEmail: z.string().email({ message: 'Имэйл хаяг буруу байна.' }).optional().or(z.literal('')),
    address: z.string().optional(),
    introduction: z.string().optional(),
    establishedDate: z.string().optional(),
    coverUrls: z.array(z.string()).max(5, { message: 'Дээд тал нь 5 зураг оруулах боломжтой.' }).optional(),
});

type CompanyProfileFormValues = z.infer<typeof companyProfileSchema>;

function FormSkeleton() {
    return (
        <div className="space-y-8">
            <Card>
                <CardHeader>
                    <Skeleton className="h-8 w-48" />
                    <Skeleton className="h-4 w-64" />
                </CardHeader>
                <CardContent className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    <div className="flex flex-col items-start gap-4">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-24 w-24 rounded-lg" />
                        <Skeleton className="h-10 w-32" />
                    </div>
                    {Array.from({ length: 8 }).map((_, i) => (
                        <div className="space-y-2" key={i}>
                            <Skeleton className="h-4 w-24" />
                            <Skeleton className="h-10 w-full" />
                        </div>
                    ))}
                </CardContent>
            </Card>
            <Card>
                <CardHeader>
                    <Skeleton className="h-8 w-56" />
                </CardHeader>
                <CardContent className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    <div className="space-y-2">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-10 w-full" />
                    </div>
                    <div className="space-y-2">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-10 w-full" />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-10 w-full" />
                    </div>
                </CardContent>
            </Card>
            <div className="flex gap-2">
                <Skeleton className="h-10 w-28" />
                <Skeleton className="h-10 w-24" />
            </div>
        </div>
    );
}

function EditCompanyForm({ initialData, docExists }: { initialData: CompanyProfileFormValues, docExists: boolean }) {
    const router = useRouter();
    const { firestore, storage } = useFirebase();
    const { toast } = useToast();

    const [logoPreview, setLogoPreview] = React.useState<string | null>(initialData.logoUrl || null);
    const [isUploading, setIsUploading] = React.useState(false);
    const [isProcessingCertificate, setIsProcessingCertificate] = React.useState(false);
    const fileInputRef = React.useRef<HTMLInputElement>(null);
    const certificateFrontInputRef = React.useRef<HTMLInputElement>(null);
    const certificateBackInputRef = React.useRef<HTMLInputElement>(null);

    const companyProfileRef = useMemoFirebase(
        ({ firestore, companyPath }) => (firestore ? tenantDoc(firestore, companyPath, 'company', 'profile') : null),
        []
    );

    const form = useForm<CompanyProfileFormValues>({
        resolver: zodResolver(companyProfileSchema),
        defaultValues: initialData,
    });

    React.useEffect(() => {
        form.reset(initialData);
        setLogoPreview(initialData.logoUrl || null);
    }, [initialData, form]);

    const { isSubmitting } = form.formState;

    const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        const storageRef = ref(storage, `company-assets/logo-${Date.now()}`);

        try {
            await uploadBytes(storageRef, file);
            const downloadURL = await getDownloadURL(storageRef);
            form.setValue('logoUrl', downloadURL);
            setLogoPreview(downloadURL);
            toast({ title: 'Лого амжилттай байршлаа.' });
        } catch (error) {
            console.error("Лого байршуулахад алдаа гарлаа: ", error);
            toast({ variant: 'destructive', title: 'Алдаа', description: 'Лого байршуулахад алдаа гарлаа.' });
        } finally {
            setIsUploading(false);
        }
    };

    const handleCertificateUpload = async (side: 'front' | 'back', event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
        if (!allowedTypes.includes(file.type)) {
            toast({ variant: 'destructive', title: 'Алдаа', description: 'Зөвхөн зураг (JPG, PNG, WebP) оруулна уу.' });
            return;
        }
        if (file.size > 10 * 1024 * 1024) {
            toast({ variant: 'destructive', title: 'Алдаа', description: 'Файл хэт том байна (10MB-с бага байх ёстой).' });
            return;
        }

        setIsProcessingCertificate(true);
        const field = side === 'front' ? 'certificateFrontUrl' : 'certificateBackUrl';
        const inputRef = side === 'front' ? certificateFrontInputRef : certificateBackInputRef;
        try {
            const storageRef = ref(storage, `company-assets/certificate-${side}-${Date.now()}`);
            await uploadBytes(storageRef, file);
            const downloadURL = await getDownloadURL(storageRef);
            form.setValue(field, downloadURL);

            const formData = new FormData();
            formData.append('file', file);
            const response = await fetch('/api/extract-company-info', { method: 'POST', headers: await getAuthHeaders(), body: formData });
            let result: { success?: boolean; data?: Record<string, string>; error?: string } = {};
            try { result = await response.json(); } catch { throw new Error('Серверийн хариуг уншихад алдаа гарлаа'); }
            if (!response.ok) throw new Error(result.error || 'Мэдээлэл задлахад алдаа гарлаа');

            const extractedData = (result.data && typeof result.data === 'object' ? result.data : {}) as Record<string, string>;
            const vals = form.getValues();

            const setIf = (key: keyof CompanyProfileFormValues, v: string | undefined) => {
                if (!v) return;
                if (side === 'front') form.setValue(key, v);
                else if (!(vals[key] as string)?.trim()) form.setValue(key, v);
            };
            setIf('name', extractedData.name);
            setIf('legalName', extractedData.legalName);
            setIf('executiveOrderName', extractedData.executiveOrderName);
            setIf('registrationNumber', extractedData.registrationNumber);
            setIf('taxId', extractedData.taxId);
            setIf('industry', extractedData.industry);
            setIf('establishedDate', extractedData.establishedDate);
            setIf('ceo', extractedData.ceo);
            setIf('address', extractedData.address);
            setIf('phoneNumber', extractedData.phoneNumber);
            setIf('contactEmail', extractedData.contactEmail);
            setIf('website', extractedData.website);
            setIf('employeeCount', extractedData.employeeCount);

            const count = Object.keys(extractedData).length;
            toast({
                title: '✅ Зураг хадгалагдаж, мэдээлэл задлагдлаа',
                description: count > 0 ? `${count} талбар AI-аар бөглөгдлөө` : 'Гэрчилгээний зураг хадгалагдлаа.',
            });
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Алдаа',
                description: error instanceof Error ? error.message : 'Гэрчилгээг боловсруулахад алдаа гарлаа.',
            });
        } finally {
            setIsProcessingCertificate(false);
            if (inputRef.current) inputRef.current.value = '';
        }
    };

    const handleSave = (values: CompanyProfileFormValues) => {
        if (!companyProfileRef) return;

        // Sanitize values to remove undefined, as Firestore doesn't support it
        const sanitizedValues = Object.fromEntries(
            Object.entries(values).filter(([_, v]) => v !== undefined)
        );

        if (docExists) {
            updateDocumentNonBlocking(companyProfileRef, sanitizedValues as any);
        } else {
            setDocumentNonBlocking(companyProfileRef, sanitizedValues as any, { merge: true });
        }

        toast({
            title: 'Амжилттай хадгаллаа',
            description: 'Компанийн мэдээлэл шинэчлэгдлээ.',
        });
        router.push('/dashboard/company');
    };

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSave)} className="space-y-8 pb-32">
                <PageHeader
                    title="Байгууллагын үндсэн мэдээлэл"
                    showBackButton
                    backHref="/dashboard/company"
                    hideBreadcrumbs
                    actions={
                        <div className="flex items-center gap-2">
                            <Button type="submit" disabled={isSubmitting || isUploading || isProcessingCertificate} size="sm">
                                {isSubmitting || isUploading || isProcessingCertificate ? (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                    <Save className="mr-2 h-4 w-4" />
                                )}
                                Хадгалах
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => router.push('/dashboard/company')} disabled={isSubmitting || isUploading || isProcessingCertificate}>
                                <X className="mr-2 h-4 w-4" />
                                Цуцлах
                            </Button>
                        </div>
                    }
                />

                <Card>
                    <CardHeader className="hidden">
                        <CardTitle>Үндсэн мэдээлэл</CardTitle>
                        <CardDescription>Компанийнхаа үндсэн мэдээллийг эндээс шинэчилнэ үү.</CardDescription>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 gap-6 md:grid-cols-2">
                        <div className="md:col-span-2 flex flex-col items-start gap-4">
                            <FormLabel>Компанийн лого</FormLabel>
                            <Avatar className="h-24 w-24 rounded-lg border">
                                <AvatarImage src={logoPreview || undefined} className="object-contain" />
                                <AvatarFallback className="rounded-lg bg-muted">
                                    <Building className="h-10 w-10 text-muted-foreground" />
                                </AvatarFallback>
                            </Avatar>
                            <input
                                type="file"
                                accept="image/*"
                                ref={fileInputRef}
                                onChange={handleLogoUpload}
                                className="hidden"
                            />
                            <Button type="button" onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
                                {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                                Лого солих
                            </Button>
                        </div>

                        <div className="md:col-span-2 space-y-4">
                            <FormLabel>Компанийн гэрчилгээ (нүүрэн тал, ар тал — оруулсан зураг хадгалагдана, AI автоматаар бөглөнө)</FormLabel>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="flex flex-col gap-3 p-4 border-2 border-dashed border-muted-foreground/25 rounded-lg bg-muted/30">
                                    <p className="text-sm font-medium text-muted-foreground">Нүүрэн тал</p>
                                    {form.watch('certificateFrontUrl') ? (
                                        <div className="relative w-full">
                                            <img
                                                src={form.watch('certificateFrontUrl')!}
                                                alt="Гэрчилгээний нүүрэн тал"
                                                className="w-full h-auto max-h-40 object-contain rounded-lg border"
                                            />
                                            <Button
                                                type="button"
                                                variant="destructive"
                                                size="icon"
                                                className="absolute top-1 right-1 h-6 w-6"
                                                onClick={() => form.setValue('certificateFrontUrl', '')}
                                            >
                                                <X className="h-3 w-3" />
                                            </Button>
                                        </div>
                                    ) : (
                                        <div className="aspect-[4/3] rounded-lg border border-dashed flex items-center justify-center bg-muted/50 text-muted-foreground text-sm">
                                            Зураг оруулах
                                        </div>
                                    )}
                                    <input
                                        type="file"
                                        accept="image/jpeg,image/jpg,image/png,image/webp"
                                        ref={certificateFrontInputRef}
                                        onChange={(e) => handleCertificateUpload('front', e)}
                                        className="hidden"
                                    />
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => certificateFrontInputRef.current?.click()}
                                        disabled={isProcessingCertificate}
                                        className="w-full"
                                    >
                                        {isProcessingCertificate ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                                        Нүүрэн тал оруулах
                                    </Button>
                                </div>
                                <div className="flex flex-col gap-3 p-4 border-2 border-dashed border-muted-foreground/25 rounded-lg bg-muted/30">
                                    <p className="text-sm font-medium text-muted-foreground">Ар тал</p>
                                    {form.watch('certificateBackUrl') ? (
                                        <div className="relative w-full">
                                            <img
                                                src={form.watch('certificateBackUrl')!}
                                                alt="Гэрчилгээний ар тал"
                                                className="w-full h-auto max-h-40 object-contain rounded-lg border"
                                            />
                                            <Button
                                                type="button"
                                                variant="destructive"
                                                size="icon"
                                                className="absolute top-1 right-1 h-6 w-6"
                                                onClick={() => form.setValue('certificateBackUrl', '')}
                                            >
                                                <X className="h-3 w-3" />
                                            </Button>
                                        </div>
                                    ) : (
                                        <div className="aspect-[4/3] rounded-lg border border-dashed flex items-center justify-center bg-muted/50 text-muted-foreground text-sm">
                                            Зураг оруулах
                                        </div>
                                    )}
                                    <input
                                        type="file"
                                        accept="image/jpeg,image/jpg,image/png,image/webp"
                                        ref={certificateBackInputRef}
                                        onChange={(e) => handleCertificateUpload('back', e)}
                                        className="hidden"
                                    />
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => certificateBackInputRef.current?.click()}
                                        disabled={isProcessingCertificate}
                                        className="w-full"
                                    >
                                        {isProcessingCertificate ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                                        Ар тал оруулах
                                    </Button>
                                </div>
                            </div>
                            <p className="text-xs text-muted-foreground flex items-center gap-2">
                                <Sparkles className="h-3.5 w-3.5" />
                                Зураг оруулах бүрт хадгалагдаж, AI талбаруудыг бөглөнө. Нүүрэн тал — бүрэн дүүргэнэ; ар тал — хоосон талбаруудыг нэмнэ.
                            </p>
                        </div>

                        <div className="md:col-span-2 space-y-4">
                            <FormLabel>Байгууллагын ковер зураг (5 зураг оруулах боломжтой)</FormLabel>
                            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                                {(form.watch('coverUrls') || []).map((url, index) => (
                                    <div key={index} className="relative aspect-video rounded-lg border overflow-hidden bg-muted group">
                                        <img src={url} alt={`Cover ${index + 1}`} className="w-full h-full object-cover" />
                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                            <Button
                                                type="button"
                                                variant="destructive"
                                                size="icon"
                                                className="h-8 w-8"
                                                onClick={() => {
                                                    const current = form.getValues('coverUrls') || [];
                                                    form.setValue('coverUrls', current.filter((_, i) => i !== index));
                                                }}
                                            >
                                                <Trash className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                                {(form.watch('coverUrls') || []).length < 5 && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const input = document.createElement('input');
                                            input.type = 'file';
                                            input.accept = 'image/*';
                                            input.multiple = true;
                                            input.onchange = async (e) => {
                                                const files = (e.target as HTMLInputElement).files;
                                                if (!files?.length) return;

                                                const currentUrls = form.getValues('coverUrls') || [];
                                                const remainingSlots = 5 - currentUrls.length;
                                                const filesToUpload = Array.from(files).slice(0, remainingSlots);

                                                if (files.length > remainingSlots) {
                                                    toast({
                                                        variant: 'destructive',
                                                        title: 'Хязгаар',
                                                        description: `Зөвхөн ${remainingSlots} зураг нэмж оруулах боломжтой.`
                                                    });
                                                }

                                                setIsUploading(true);
                                                const newUrls = [...currentUrls];

                                                try {
                                                    for (let i = 0; i < filesToUpload.length; i++) {
                                                        const file = filesToUpload[i];
                                                        const storageRef = ref(storage, `company-assets/cover-${Date.now()}-${i}`);
                                                        await uploadBytes(storageRef, file);
                                                        const downloadURL = await getDownloadURL(storageRef);
                                                        newUrls.push(downloadURL);
                                                    }
                                                    form.setValue('coverUrls', newUrls);
                                                    toast({ title: 'Зургууд амжилттай байршлаа.' });
                                                } catch (error) {
                                                    console.error("Cover upload error:", error);
                                                    toast({ variant: 'destructive', title: 'Алдаа', description: 'Зураг байршуулахад алдаа гарлаа.' });
                                                } finally {
                                                    setIsUploading(false);
                                                }
                                            };
                                            input.click();
                                        }}
                                        className="aspect-video rounded-lg border-2 border-dashed flex flex-col items-center justify-center gap-2 hover:bg-muted/50 transition-colors"
                                        disabled={isUploading}
                                    >
                                        {isUploading ? <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /> : <ImageIcon className="h-6 w-6 text-muted-foreground" />}
                                        <span className="text-xs text-muted-foreground">Зураг нэмэх</span>
                                    </button>
                                )}
                            </div>
                            <p className="text-[0.8rem] text-muted-foreground">Зургууд нь слайд хэлбэрээр харагдах болно.</p>
                        </div>

                        <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Компанийн нэр</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Хөхэнэгэ ХХК" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="legalName"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Хуулийн этгээдийн нэр</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Түмэн ресурс Хязгаарлагдмал хариуцлагатай компани" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="executiveOrderName"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Гүйцэтгэх захиалын нэр</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Ар талын нэмэлт өөрчлөлтийн агуулгаас" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="registrationNumber"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Регистрийн дугаар</FormLabel>
                                    <FormControl>
                                        <Input placeholder="1234567" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="taxId"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Хувийн хэргийн дугаар</FormLabel>
                                    <FormControl>
                                        <Input placeholder="901234567" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="industry"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Үйл ажиллагааны чиглэл</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Технологи" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="employeeCount"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Ажилтны тоо</FormLabel>
                                    <FormControl>
                                        <Input placeholder="51-100 ажилтан" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="establishedDate"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Үүсгэн байгуулагдсан огноо</FormLabel>
                                    <FormControl>
                                        <Input type="date" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="ceo"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Гүйцэтгэх захирал</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Ж. Ганбаатар" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="website"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Веб хуудас</FormLabel>
                                    <FormControl>
                                        <Input placeholder="https://hrzen.example.com" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="introduction"
                            render={({ field }) => (
                                <FormItem className="md:col-span-2">
                                    <FormLabel>Байгууллагын танилцуулга</FormLabel>
                                    <FormControl>
                                        <Textarea
                                            placeholder="Манай байгууллагын талаар товч танилцуулга..."
                                            className="min-h-[120px] resize-none"
                                            {...field}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Холбоо барих</CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 gap-6 md:grid-cols-2">
                        <FormField
                            control={form.control}
                            name="phoneNumber"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Утасны дугаар</FormLabel>
                                    <FormControl>
                                        <div className="flex items-center">
                                            <span className="h-10 px-3 flex items-center bg-muted border border-r-0 rounded-l-md text-sm text-muted-foreground font-medium">
                                                +976
                                            </span>
                                            <Input
                                                className="rounded-l-none"
                                                placeholder="7700 8800"
                                                {...field}
                                                onChange={(e) => {
                                                    // Remove prefix if user tries to paste it
                                                    let val = e.target.value;
                                                    if (val.startsWith('+976')) {
                                                        val = val.replace('+976', '').trim();
                                                    }
                                                    field.onChange(val);
                                                }}
                                            />
                                        </div>
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="contactEmail"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Ерөнхий имэйл</FormLabel>
                                    <FormControl>
                                        <Input placeholder="contact@hrzen.mn" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="address"
                            render={({ field }) => (
                                <FormItem className="md:col-span-2">
                                    <FormLabel>Хаяг</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Улаанбаатар, Сүхбаатар дүүрэг, 1-р хороо, ABC гудамж, 123" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </CardContent>
                </Card>

            </form>
        </Form>
    );
}

const defaultFormValues: CompanyProfileFormValues = {
    name: '',
    logoUrl: '',
    certificateFrontUrl: '',
    certificateBackUrl: '',
    legalName: '',
    executiveOrderName: '',
    registrationNumber: '',
    taxId: '',
    industry: '',
    employeeCount: '',
    ceo: '',
    website: '',
    phoneNumber: '',
    contactEmail: '',
    address: '',
    introduction: '',
    establishedDate: '',
    coverUrls: [],
};

export default function EditCompanyPage() {
    const { firestore } = useFirebase();

    const companyProfileRef = useMemoFirebase(
        ({ firestore, companyPath }) => (firestore ? tenantDoc(firestore, companyPath, 'company', 'profile') : null),
        []
    );

    const { data: companyProfile, isLoading: isLoadingProfile } = useDoc<CompanyProfileFormValues>(companyProfileRef as any);

    if (isLoadingProfile) {
        return (
            <div className="py-8">
                <FormSkeleton />
            </div>
        )
    }

    const initialData = {
        ...defaultFormValues,
        ...(companyProfile || {})
    };
    const docExists = !!companyProfile;

    return (
        <div className="flex flex-col h-full overflow-hidden">
            <div className="flex-1 overflow-y-auto p-6 md:p-8 pt-0 md:pt-0 scroll-smooth">
                <EditCompanyForm initialData={initialData} docExists={docExists} />
            </div>
        </div>
    );
}
