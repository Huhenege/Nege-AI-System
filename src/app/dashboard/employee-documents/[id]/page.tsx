'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { PageHeader } from '@/components/patterns/page-layout';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useFirebase, useDoc, useFetchCollection, useMemoFirebase, tenantDoc, tenantCollection } from '@/firebase';
import { updateDoc, deleteDoc } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Edit, FileText, Calendar as CalendarIcon, Save, X, Loader2, Download, Trash2 } from 'lucide-react';
import type { Document } from '../data';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { useToast } from '@/hooks/use-toast';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

type FieldDefinition = {
    key: string;
    label: string;
    type: 'text' | 'number' | 'date';
};

type DocumentType = {
    id: string;
    name: string;
    fields?: FieldDefinition[];
};

const documentSchema = z.object({
    documentType: z.string().min(1, 'Төрөл сонгоно уу.'),
    metadata: z.any(),
});

type DocumentFormValues = z.infer<typeof documentSchema>;

function DocumentPageSkeleton() {
    return (
        <div className="py-8">
            <div className="mb-4 flex items-center gap-4">
                <Skeleton className="h-9 w-9" />
                <Skeleton className="h-8 w-40" />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2">
                    <Card>
                        <CardHeader>
                            <Skeleton className="h-6 w-3/4" />
                        </CardHeader>
                        <CardContent>
                            <Skeleton className="h-[70vh] w-full" />
                        </CardContent>
                    </Card>
                </div>
                <div>
                    <Card>
                        <CardHeader>
                            <Skeleton className="h-7 w-48" />
                            <Skeleton className="h-4 w-32" />
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {Array.from({ length: 4 }).map((_, i) => (
                                <div className="flex items-start gap-3" key={i}>
                                    <Skeleton className="h-5 w-5 rounded-sm" />
                                    <div className="space-y-1.5">
                                        <Skeleton className="h-4 w-24" />
                                        <Skeleton className="h-5 w-36" />
                                    </div>
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    )
}

function DocumentViewer({ document }: { document: Document }) {
    if (!document.url) {
        return (
            <div className="h-[75vh] flex flex-col items-center justify-center rounded-md border bg-muted">
                <FileText className="h-16 w-16 text-muted-foreground" />
                <p className="mt-4 text-muted-foreground">Баримт бичиг хавсаргаагүй байна.</p>
            </div>
        )
    }

    const fileExtension = document.url.split('.').pop()?.split('?')[0].toLowerCase();
    const imageExtensions = ['jpg', 'jpeg', 'png', 'gif'];
    const officeExtensions = ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'];

    if (fileExtension === 'pdf') {
        return <iframe src={document.url} className="h-[75vh] w-full rounded-md border" title={document.title} />;
    }

    if (imageExtensions.includes(fileExtension || '')) {
        return (
            <div className="relative h-[75vh] w-full">
                <Image src={document.url} alt={document.title} fill style={{ objectFit: 'contain' }} className="rounded-md border" />
            </div>
        );
    }

    if (officeExtensions.includes(fileExtension || '')) {
        const viewerUrl = `https://docs.google.com/gview?url=${encodeURIComponent(document.url)}&embedded=true`;
        return <iframe src={viewerUrl} className="h-[75vh] w-full rounded-md border" title={document.title} />;
    }

    return (
        <div className="h-[75vh] flex flex-col items-center justify-center rounded-md border bg-muted">
            <FileText className="h-16 w-16 text-muted-foreground" />
            <p className="mt-4 text-muted-foreground">Урьдчилан харах боломжгүй файл.</p>
            <Button asChild className="mt-4">
                <a href={document.url} target="_blank" rel="noopener noreferrer">
                    <Download className="mr-2 h-4 w-4" />
                    Баримт татах
                </a>
            </Button>
        </div>
    );
}

const DynamicField = ({ form, fieldDef }: { form: any, fieldDef: FieldDefinition }) => {
    const fieldName = `metadata.${fieldDef.key}`;

    if (fieldDef.type === 'date') {
        return (
            <FormField
                control={form.control}
                name={fieldName}
                render={({ field }) => (
                    <FormItem className="flex flex-col">
                        <FormLabel>{fieldDef.label}</FormLabel>
                        <Popover>
                            <PopoverTrigger asChild>
                                <FormControl>
                                    <Button
                                        variant={"outline"}
                                        className={cn(
                                            "w-full pl-3 text-left font-normal",
                                            !field.value && "text-muted-foreground"
                                        )}
                                    >
                                        {field.value ? (
                                            format(new Date(field.value), "yyyy-MM-dd")
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
                                    selected={field.value ? new Date(field.value) : undefined}
                                    onSelect={(date) => field.onChange(date?.toISOString())}
                                    initialFocus
                                />
                            </PopoverContent>
                        </Popover>
                        <FormMessage />
                    </FormItem>
                )}
            />
        );
    }

    return (
        <FormField
            control={form.control}
            name={fieldName}
            render={({ field }) => (
                <FormItem>
                    <FormLabel>{fieldDef.label}</FormLabel>
                    <FormControl>
                        <Input
                            type={fieldDef.type}
                            placeholder={fieldDef.label}
                            {...field}
                            value={field.value || ''}
                        />
                    </FormControl>
                    <FormMessage />
                </FormItem>
            )}
        />
    )
}

function DocumentDetailsCard({ documentData }: { documentData: Document }) {
    const [isEditing, setIsEditing] = React.useState(false);
    const { toast } = useToast();
    const documentRef = useMemoFirebase(({ firestore, companyPath }) => tenantDoc(firestore, companyPath, 'documents', documentData.id), [documentData.id]);
    const docTypesQuery = useMemoFirebase(({ firestore, companyPath }) => tenantCollection(firestore, companyPath, 'er_document_types'), []);
    const { data: documentTypes, isLoading: isLoadingDocTypes } = useFetchCollection<DocumentType>(docTypesQuery);

    const form = useForm<DocumentFormValues>({
        // resolver stays simple, complex validation can be added later
        defaultValues: {
            documentType: documentData.documentType || '',
            metadata: documentData.metadata || {},
        },
    });

    React.useEffect(() => {
        form.reset({
            documentType: documentData.documentType || '',
            metadata: documentData.metadata || {},
        });
    }, [documentData, form]);

    const { isSubmitting } = form.formState;

    const handleSave = async (values: DocumentFormValues) => {
        if (!documentRef) return;
        try {
            await updateDoc(documentRef, values as Record<string, unknown>);
            toast({ title: 'Амжилттай хадгаллаа' });
            setIsEditing(false);
        } catch {
            toast({ title: 'Алдаа', description: 'Хадгалахад алдаа гарлаа', variant: 'destructive' });
        }
    };

    const selectedDocTypeName = form.watch('documentType');
    const selectedDocType = documentTypes?.find(type => type.name === selectedDocTypeName);
    const uniqueFieldDefs = React.useMemo(() => {
        const list = selectedDocType?.fields || [];
        const seen = new Set<string>();
        return list.filter((f) => {
            const k = f?.key;
            if (!k) return false;
            if (seen.has(k)) return false;
            seen.add(k);
            return true;
        });
    }, [selectedDocType?.fields]);

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle>Дэлгэрэнгүй мэдээлэл</CardTitle>
                        <CardDescription>Баримт бичигтэй холбоотой нэмэлт мэдээлэл.</CardDescription>
                    </div>
                    {!isEditing && (
                        <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                            <Edit className="mr-2 h-4 w-4" />
                            Засах
                        </Button>
                    )}
                </div>
            </CardHeader>
            <CardContent className="space-y-6">
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(handleSave)} className="space-y-6">
                        <FormField
                            control={form.control}
                            name="documentType"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Баримтын төрөл</FormLabel>
                                    {isEditing ? (
                                        <Select onValueChange={field.onChange} value={field.value} disabled={isLoadingDocTypes}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Төрөл сонгох..." />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {documentTypes?.map((type) => (
                                                    <SelectItem key={type.id} value={type.name}>
                                                        {type.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    ) : (
                                        <p className="font-medium pt-2">{field.value || 'Тодорхойгүй'}</p>
                                    )}
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {isEditing && uniqueFieldDefs.length > 0 && uniqueFieldDefs.map((fieldDef, idx) => (
                            <DynamicField key={`${fieldDef.key}-${idx}`} form={form} fieldDef={fieldDef} />
                        ))}

                        {!isEditing && uniqueFieldDefs.length > 0 && (
                            <div className="space-y-4">
                                {uniqueFieldDefs.map((fieldDef, idx) => {
                                    const value = documentData.metadata?.[fieldDef.key];
                                    return (
                                        <div key={`${fieldDef.key}-${idx}`}>
                                            <p className="text-sm text-muted-foreground">{fieldDef.label}</p>
                                            <p className="font-medium">
                                                {fieldDef.type === 'date' && value ? new Date(String(value)).toLocaleDateString() : (String(value || 'Тодорхойгүй'))}
                                            </p>
                                        </div>
                                    )
                                })}
                            </div>
                        )}

                        {!isEditing && uniqueFieldDefs.length === 0 && (
                            <p className="text-sm text-muted-foreground text-center py-4">Нэмэлт талбар тохируулаагүй байна.</p>
                        )}

                        {isEditing && (
                            <div className="flex gap-2">
                                <Button type="submit" disabled={isSubmitting}>
                                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                    Хадгалах
                                </Button>
                                <Button variant="ghost" type="button" onClick={() => { setIsEditing(false); form.reset(); }}>
                                    <X className="mr-2 h-4 w-4" />
                                    Цуцлах
                                </Button>
                            </div>
                        )}
                    </form>
                </Form>
            </CardContent>
        </Card>
    );
}

export default function DocumentDetailPage() {
    const { id } = useParams();
    const router = useRouter();
    const { toast } = useToast();
    const documentId = Array.isArray(id) ? id[0] : id;

    const documentRef = useMemoFirebase(
        ({ firestore, companyPath }) => (firestore && documentId ? tenantDoc(firestore, companyPath, 'documents', documentId) : null),
        [documentId]
    );

    const { data: documentData, isLoading, error } = useDoc<Document>(documentRef as any);

    const handleDelete = async () => {
        if (!documentRef) return;
        try {
            await deleteDoc(documentRef);
            toast({ title: 'Амжилттай устгагдлаа', description: 'Баримт бичиг амжилттай устлаа.' });
            router.push('/dashboard/employee-documents');
        } catch {
            toast({ variant: 'destructive', title: 'Алдаа гарлаа', description: 'Баримт бичгийг устгахад алдаа гарлаа.' });
        }
    };

    if (isLoading) {
        return <DocumentPageSkeleton />;
    }

    if (error) {
        return (
            <div className="py-8 text-center text-destructive">
                Баримт бичиг ачаалахад алдаа гарлаа: {error.message}
            </div>
        )
    }

    if (!documentData) {
        return (
            <div className="py-8 text-center">
                <p>Баримт бичиг олдсонгүй.</p>
                <Button asChild variant="link">
                    <Link href="/dashboard/employee-documents">Жагсаалт руу буцах</Link>
                </Button>
            </div>
        )
    }

    return (
        <div className="py-8">
            <div className="mb-6">
                <PageHeader
                    title={documentData.title}
                    description={documentData.description}
                    showBackButton
                    hideBreadcrumbs
                    backButtonPlacement="inline"
                    backBehavior="history"
                    fallbackBackHref="/dashboard/employee-documents"
                    actions={
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="destructive" size="sm">
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Баримт устгах
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Та итгэлтэй байна уу?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        Энэ үйлдлийг буцаах боломжгүй. Баримт бичиг системээс бүрмөсөн устлаа.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Цуцлах</AlertDialogCancel>
                                    <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                        Устгах
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    }
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2">
                    <Card>
                        <CardHeader>
                            <CardTitle>Баримт бичиг</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <DocumentViewer document={documentData} />
                        </CardContent>
                    </Card>
                </div>
                <div>
                    <DocumentDetailsCard documentData={documentData} />
                </div>
            </div>
        </div>
    )
}
