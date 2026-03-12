'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
    SelectGroup,
    SelectLabel,
} from '@/components/ui/select';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Calendar as CalendarIcon, Loader2, Upload, File as FileIcon, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { useFirebase, addDocumentNonBlocking, useMemoFirebase, useCollection, useFetchCollection, tenantCollection } from '@/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useToast } from '@/hooks/use-toast';

const documentSchema = z.object({
    title: z.string().min(1, 'Гарчиг оруулна уу.'),
    documentType: z.string().min(1, 'Төрөл сонгоно уу.'),
});

type DocumentFormValues = z.infer<typeof documentSchema>;

interface AddEmployeeDocumentDialogProps {
    employeeId: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function AddEmployeeDocumentDialog({
    employeeId,
    open,
    onOpenChange,
}: AddEmployeeDocumentDialogProps) {
    const { firestore, storage } = useFirebase();
    const { toast } = useToast();
    const [isUploading, setIsUploading] = React.useState(false);
    const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    const docTypesQuery = useMemoFirebase(({ firestore, companyPath }) => (firestore ? tenantCollection(firestore, companyPath, 'er_document_types') : null), []);
    const { data: documentTypes, isLoading: isLoadingDocTypes } = useFetchCollection<any>(docTypesQuery);

    // Backward-compat: some admins used `/dashboard/settings/documents` which historically wrote to `documentTypes`.
    // Merge both lists by name so the dropdown always shows what was configured.
    const legacyDocTypesQuery = useMemoFirebase(({ firestore, companyPath }) => (firestore ? tenantCollection(firestore, companyPath, 'documentTypes') : null), []);
    const { data: legacyDocumentTypes, isLoading: isLoadingLegacyDocTypes } = useCollection<any>(legacyDocTypesQuery);

    const mergedDocumentTypes = React.useMemo(() => {
        const map = new Map<string, any>();
        for (const t of (documentTypes || [])) {
            const name = String(t?.name || '').trim();
            if (!name) continue;
            map.set(name, { ...t, name });
        }
        for (const t of (legacyDocumentTypes || [])) {
            const name = String(t?.name || '').trim();
            if (!name) continue;
            if (!map.has(name)) map.set(name, { ...t, name });
        }
        return Array.from(map.values());
    }, [documentTypes, legacyDocumentTypes]);

    const isLoadingData = isLoadingDocTypes || isLoadingLegacyDocTypes;

    const documentsCollectionRef = useMemoFirebase(
        ({ firestore, companyPath }) => (firestore ? tenantCollection(firestore, companyPath, 'documents') : null),
        []
    );

    const form = useForm<DocumentFormValues>({
        resolver: zodResolver(documentSchema),
        defaultValues: {
            title: '',
            documentType: '',
        },
    });

    const { isSubmitting } = form.formState;

    React.useEffect(() => {
        if (!open) {
            form.reset();
            setSelectedFile(null);
        }
    }, [open, form]);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            setSelectedFile(file);
            const fileName = file.name.split('.').slice(0, -1).join('.');
            const currentType = form.getValues('documentType');
            if (currentType) {
                form.setValue('title', `${currentType} - ${fileName}`);
            } else {
                form.setValue('title', fileName);
            }
        }
    };

    const uploadFile = async (): Promise<{ url: string, name: string } | null> => {
        if (!selectedFile || !storage) return null;
        setIsUploading(true);

        const uniqueFileName = `${Date.now()}-${selectedFile.name}`;
        const storageRef = ref(storage, `documents/${employeeId}/${uniqueFileName}`);

        try {
            await uploadBytes(storageRef, selectedFile);
            const downloadURL = await getDownloadURL(storageRef);
            return { url: downloadURL, name: selectedFile.name };
        } catch (error) {
            console.error("File upload error:", error);
            toast({
                variant: "destructive",
                title: "Файл хуулахад алдаа гарлаа",
                description: (error as Error).message,
            });
            return null;
        } finally {
            setIsUploading(false);
        }
    };

    const onSubmit = async (values: DocumentFormValues) => {
        if (!documentsCollectionRef) return;
        if (!selectedFile) {
            toast({
                variant: "destructive",
                title: "Файл сонгоогүй байна",
                description: "Баримт бичгийг байршуулахын тулд файл сонгоно уу.",
            });
            return;
        }

        const uploadedFile = await uploadFile();
        if (!uploadedFile) return;

        await addDocumentNonBlocking(documentsCollectionRef, {
            title: values.title,
            description: `Ажилтны хувийн баримт бичиг`,
            url: uploadedFile.url,
            uploadDate: new Date().toISOString(),
            documentType: values.documentType,
            metadata: {
                employeeId: employeeId,
            }
        });

        toast({
            title: 'Амжилттай хадгаллаа',
            description: 'Баримт бичиг амжилттай байршлаа.',
        });
        form.reset();
        setSelectedFile(null);
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[480px]">
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <DialogHeader>
                            <DialogTitle>Баримт бичиг нэмэх</DialogTitle>
                            <DialogDescription>
                                Ажилтны хувийн хэрэгт шинэ баримт бичиг байршуулах.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="grid gap-4 py-4">
                            <FormItem>
                                <FormLabel>Файл</FormLabel>
                                <FormControl>
                                    <Input
                                        type="file"
                                        ref={fileInputRef}
                                        onChange={handleFileChange}
                                        className="hidden"
                                    />
                                </FormControl>
                                {!selectedFile && (
                                    <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={isUploading} className="w-full h-24 border-dashed border-2 rounded-2xl flex flex-col gap-2">
                                        <Upload className="h-6 w-6 text-slate-400" />
                                        <span className="text-xs text-slate-500 font-bold uppercase tracking-widest">Файл сонгох</span>
                                    </Button>
                                )}
                                {selectedFile && (
                                    <div className="flex items-center justify-between rounded-2xl border p-4 bg-slate-50">
                                        <div className="flex items-center gap-3">
                                            <div className="h-10 w-10 rounded-xl bg-white border border-slate-100 flex items-center justify-center text-indigo-500">
                                                <FileIcon className="h-5 w-5" />
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-sm font-bold text-slate-700 truncate max-w-[200px]">{selectedFile.name}</p>
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                                            </div>
                                        </div>
                                        <Button type="button" variant="ghost" size="icon" onClick={() => setSelectedFile(null)} className="h-8 w-8 rounded-lg text-slate-400 hover:text-destructive hover:bg-destructive/10">
                                            <X className="h-4 w-4" />
                                        </Button>
                                    </div>
                                )}
                            </FormItem>

                            <FormField
                                control={form.control}
                                name="documentType"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Баримтын төрөл</FormLabel>
                                        <Select
                                            onValueChange={(val) => {
                                                field.onChange(val);
                                                const currentTitle = form.getValues('title');
                                                if (selectedFile) {
                                                    const fileName = selectedFile.name.split('.').slice(0, -1).join('.');
                                                    form.setValue('title', `${val} - ${fileName}`);
                                                } else if (!currentTitle || currentTitle === '') {
                                                    form.setValue('title', `${val} - `);
                                                }
                                            }}
                                            defaultValue={field.value}
                                        >
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Төрөл сонгоно уу..." />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {mergedDocumentTypes?.some((t: any) => t.isMandatory) && (
                                                    <SelectGroup>
                                                        <SelectLabel className="text-[10px] font-bold uppercase tracking-widest text-indigo-600 px-2 py-2 text-center md:text-left">
                                                            Заавал бүрдүүлэх (Шаардлагатай)
                                                        </SelectLabel>
                                                        {mergedDocumentTypes.filter((t: any) => t.isMandatory).map((type: any, idx: number) => (
                                                            <SelectItem key={`mandatory-${type.id}-${idx}`} value={type.name}>
                                                                {type.name}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectGroup>
                                                )}

                                                <SelectGroup>
                                                    <SelectLabel className="text-[10px] font-bold uppercase tracking-widest text-slate-400 px-2 py-2 mt-2 text-center md:text-left">
                                                        Бусад төрлүүд
                                                    </SelectLabel>
                                                    {mergedDocumentTypes?.filter((type: any) => !type.isMandatory).map((type: any, idx: number) => (
                                                        <SelectItem key={`${type.id}-${idx}`} value={type.name}>
                                                            {type.name}
                                                        </SelectItem>
                                                    ))}
                                                </SelectGroup>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="title"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Баримтын нэр</FormLabel>
                                        <FormControl>
                                            <Input placeholder="Баримтын нэрийг оруулна уу..." {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                        <DialogFooter className="gap-2 sm:gap-0">
                            <Button
                                type="button"
                                variant="ghost"
                                onClick={() => onOpenChange(false)}
                                disabled={isSubmitting || isUploading}
                                className="font-bold text-[10px] uppercase tracking-widest"
                            >
                                Цуцлах
                            </Button>
                            <Button type="submit" disabled={isSubmitting || isUploading} className="bg-indigo-600 hover:bg-indigo-700 font-bold text-[10px] uppercase tracking-widest px-8">
                                {(isSubmitting || isUploading) && (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                )}
                                Байршуулах
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
