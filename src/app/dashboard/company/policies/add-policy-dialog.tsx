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
import {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuCheckboxItem,
    DropdownMenuSeparator,
    DropdownMenuItem
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { useToast } from '@/hooks/use-toast';
import { useFirebase, useTenantWrite } from '@/firebase';
import { addDoc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Loader2, Upload, File as FileIcon, Search, Calendar as CalendarIcon, Video } from 'lucide-react';
import { CompanyPolicy, Position } from './types';

export interface DepartmentOption {
    id: string;
    name: string;
}

const policySchema = z.object({
    title: z.string().min(1, 'Гарчиг хоосон байж болохгүй.'),
    type: z.string().min(1, 'Төрөл сонгоно уу.'),
    effectiveDate: z.string().min(1, 'Батлагдсан огноо сонгоно уу.'),
    description: z.string().optional(),
    documentUrl: z.string().optional(),
    videoUrl: z.string().optional(),
    appliesToAll: z.boolean().default(true),
    selectionType: z.enum(['departments', 'positions']).optional(),
    applicableDepartmentIds: z.array(z.string()).optional(),
    applicablePositionIds: z.array(z.string()).optional(),
});

export const POLICY_TYPES = [
    "Бодлогын баримт бичиг",
    "Журам",
    "Дүрэм",
    "Аргачлал",
    "Заавар",
    "Бусад"
];

type PolicyFormValues = z.infer<typeof policySchema>;

interface AddPolicyDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    editingPolicy?: CompanyPolicy | null;
    departments: DepartmentOption[];
    positions: Position[];
    onSuccess?: () => void;
}

export function AddPolicyDialog({
    open,
    onOpenChange,
    editingPolicy,
    departments,
    positions,
    onSuccess,
}: AddPolicyDialogProps) {
    const { firestore, storage } = useFirebase();
    const { tDoc, tCollection } = useTenantWrite();
    const { toast } = useToast();
    const isEditMode = !!editingPolicy;
    const [isUploading, setIsUploading] = React.useState(false);
    const [fileName, setFileName] = React.useState<string | null>(null);
    const [isUploadingVideo, setIsUploadingVideo] = React.useState(false);
    const [videoFileName, setVideoFileName] = React.useState<string | null>(null);
    const [deptSearch, setDeptSearch] = React.useState('');
    const [posSearch, setPosSearch] = React.useState('');

    const form = useForm<PolicyFormValues>({
        resolver: zodResolver(policySchema),
        defaultValues: {
            title: '',
            type: '',
            effectiveDate: '',
            description: '',
            documentUrl: '',
            appliesToAll: true,
            selectionType: 'departments',
            applicableDepartmentIds: [],
            applicablePositionIds: [],
            videoUrl: '',
        }
    });

    React.useEffect(() => {
        if (open) {
            setDeptSearch('');
            setPosSearch('');
            if (isEditMode && editingPolicy) {
                // Determine selectionType based on existing data
                const hasDeptIds = editingPolicy.applicableDepartmentIds && editingPolicy.applicableDepartmentIds.length > 0;
                const hasPosIds = editingPolicy.applicablePositionIds && editingPolicy.applicablePositionIds.length > 0;
                const defaultSelectionType = hasDeptIds ? 'departments' : (hasPosIds ? 'positions' : 'departments');
                
                form.reset({
                    title: editingPolicy.title,
                    type: editingPolicy.type || '',
                    effectiveDate: editingPolicy.effectiveDate || '',
                    description: editingPolicy.description || '',
                    documentUrl: editingPolicy.documentUrl || '',
                    videoUrl: editingPolicy.videoUrl || '',
                    appliesToAll: editingPolicy.appliesToAll ?? true,
                    selectionType: editingPolicy.selectionType || defaultSelectionType,
                    applicableDepartmentIds: editingPolicy.applicableDepartmentIds || [],
                    applicablePositionIds: editingPolicy.applicablePositionIds || [],
                });
                if (editingPolicy.documentUrl) {
                    try {
                        const urlParts = editingPolicy.documentUrl.split('?')[0].split('%2F');
                        setFileName(decodeURIComponent(urlParts[urlParts.length - 1]));
                    } catch (e) {
                        setFileName(editingPolicy.documentUrl.split('/').pop() || 'File');
                    }
                }

                if (editingPolicy.videoUrl) {
                    try {
                        const videoUrlParts = editingPolicy.videoUrl.split('?')[0].split('%2F');
                        setVideoFileName(decodeURIComponent(videoUrlParts[videoUrlParts.length - 1]));
                    } catch (e) {
                        setVideoFileName(editingPolicy.videoUrl.split('/').pop() || 'Video');
                    }
                }
            }
        } else {
            form.reset({
                title: '',
                type: '',
                effectiveDate: '',
                description: '',
                documentUrl: '',
                appliesToAll: true,
                selectionType: 'departments',
                applicableDepartmentIds: [],
                applicablePositionIds: [],
                videoUrl: '',
            });
            setFileName(null);
            setVideoFileName(null);
            setDeptSearch('');
            setPosSearch('');
        }
    }, [open, editingPolicy, isEditMode, form]);

    const { isSubmitting } = form.formState;

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        if (!storage) {
            toast({ variant: 'destructive', title: 'Алдаа', description: 'Storage бэлэн болоогүй байна.' });
            return;
        }

        setIsUploading(true);
        setFileName(file.name);
        const storageRef = ref(storage, `company-policies/${Date.now()}-${file.name}`);

        try {
            await uploadBytes(storageRef, file);
            const downloadURL = await getDownloadURL(storageRef);
            form.setValue('documentUrl', downloadURL, { shouldValidate: true });
            toast({ title: 'Файл амжилттай байршлаа.' });
        } catch (error) {
            toast({ variant: 'destructive', title: 'Алдаа', description: 'Файл байршуулахад алдаа гарлаа.' });
        } finally {
            setIsUploading(false);
        }
    };

    const handleVideoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        if (!storage) {
            toast({ variant: 'destructive', title: 'Алдаа', description: 'Storage бэлэн болоогүй байна.' });
            return;
        }

        setIsUploadingVideo(true);
        setVideoFileName(file.name);
        const storageRef = ref(storage, `company-policies-videos/${Date.now()}-${file.name}`);

        try {
            await uploadBytes(storageRef, file);
            const downloadURL = await getDownloadURL(storageRef);
            form.setValue('videoUrl', downloadURL, { shouldValidate: true });
            toast({ title: 'Видео амжилттай байршлаа.' });
        } catch (error) {
            toast({ variant: 'destructive', title: 'Алдаа', description: 'Видео байршуулахад алдаа гарлаа.' });
        } finally {
            setIsUploadingVideo(false);
        }
    };

    const onSubmit = async (data: PolicyFormValues) => {
        if (!firestore) return;

        const finalData = {
            ...data,
            uploadDate: new Date().toISOString(),
            applicableDepartmentIds: data.selectionType === 'departments' ? (data.applicableDepartmentIds ?? []) : [],
            applicablePositionIds: data.selectionType === 'positions' ? (data.applicablePositionIds ?? []) : [],
        };

        try {
            if (isEditMode && editingPolicy) {
                await updateDoc(tDoc('companyPolicies', editingPolicy.id), finalData);
                toast({ title: 'Амжилттай шинэчлэгдлээ' });
            } else {
                await addDoc(tCollection('companyPolicies'), finalData);
                toast({ title: 'Шинэ журам амжилттай нэмэгдлээ' });
            }
            onOpenChange(false);
            onSuccess?.();
        } catch {
            toast({ variant: 'destructive', title: 'Алдаа', description: 'Хадгалахад алдаа гарлаа.' });
        }
    };

    const appliesToAll = form.watch('appliesToAll');
    const selectionType = form.watch('selectionType') || 'departments';

    const filteredDepartments = React.useMemo(() => {
        if (!departments.length) return [];
        return departments.filter(d => d.name.toLowerCase().includes(deptSearch.toLowerCase()));
    }, [departments, deptSearch]);

    const filteredPositions = React.useMemo(() => {
        if (!positions.length) return [];
        return positions.filter(p => p.title.toLowerCase().includes(posSearch.toLowerCase()));
    }, [positions, posSearch]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg">
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <DialogHeader>
                            <DialogTitle>{isEditMode ? 'Журам засах' : 'Шинэ журам нэмэх'}</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto pr-4">
                            <FormField control={form.control} name="title" render={({ field }) => (<FormItem><FormLabel>Гарчиг</FormLabel><FormControl><Input placeholder="Жишээ нь: Дотоод журам" {...field} /></FormControl><FormMessage /></FormItem>)} />
                            <div className="grid grid-cols-2 gap-4">
                                <FormField
                                    control={form.control}
                                    name="type"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Төрөл</FormLabel>
                                            <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                                                <FormControl>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Төрөл сонгох" />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    {POLICY_TYPES.map(type => (
                                                        <SelectItem key={type} value={type}>{type}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="effectiveDate"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Батлагдсан огноо</FormLabel>
                                            <FormControl>
                                                <div className="relative">
                                                    <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                                                    <Input type="date" className="pl-9" {...field} />
                                                </div>
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                            <FormField control={form.control} name="description" render={({ field }) => (<FormItem><FormLabel>Тайлбар</FormLabel><FormControl><Textarea placeholder="Энэ журам юуны тухай болох талаар товч тайлбар..." {...field} /></FormControl><FormMessage /></FormItem>)} />
                            <FormItem>
                                <FormLabel>Баримт бичиг</FormLabel>
                                <Button type="button" variant="outline" className="w-full" onClick={() => (document.getElementById('policy-file-upload') as HTMLInputElement)?.click()} disabled={isUploading}>
                                    {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                                    Файл сонгох
                                </Button>
                                <Input id="policy-file-upload" type="file" className="hidden" onChange={handleFileUpload} />
                                {fileName && (
                                    <div className="text-sm text-muted-foreground flex items-center gap-2 mt-2">
                                        <FileIcon className="h-4 w-4" /> {fileName}
                                    </div>
                                )}
                            </FormItem>
                            <FormItem>
                                <FormLabel>Танилцуулга видео</FormLabel>
                                <Button type="button" variant="outline" className="w-full" onClick={() => (document.getElementById('policy-video-upload') as HTMLInputElement)?.click()} disabled={isUploadingVideo}>
                                    {isUploadingVideo ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Video className="mr-2 h-4 w-4" />}
                                    Видео оруулах
                                </Button>
                                <Input id="policy-video-upload" type="file" accept="video/*" className="hidden" onChange={handleVideoUpload} />
                                {videoFileName && (
                                    <div className="text-sm text-muted-foreground flex items-center gap-2 mt-2">
                                        <Video className="h-4 w-4" /> {videoFileName}
                                    </div>
                                )}
                            </FormItem>
                            <FormField control={form.control} name="appliesToAll" render={({ field }) => (<FormItem className="flex flex-row items-center justify-between rounded-lg border p-4"><div className="space-y-0.5"><FormLabel>Бүх ажилтанд хамааралтай эсэх</FormLabel></div><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>)} />
                            {!appliesToAll && (
                                <>
                                    <FormField
                                        control={form.control}
                                        name="selectionType"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Сонголтын төрөл</FormLabel>
                                                <Select onValueChange={(value) => {
                                                    field.onChange(value);
                                                    // Clear the other type's IDs when switching
                                                    if (value === 'departments') {
                                                        form.setValue('applicablePositionIds', []);
                                                    } else {
                                                        form.setValue('applicableDepartmentIds', []);
                                                    }
                                                }} value={field.value || 'departments'}>
                                                    <FormControl>
                                                        <SelectTrigger>
                                                            <SelectValue placeholder="Сонгох..." />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent>
                                                        <SelectItem value="departments">Алба нэгж</SelectItem>
                                                        <SelectItem value="positions">Ажлын байр</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    {selectionType === 'departments' && (
                                        <FormField
                                            control={form.control}
                                            name="applicableDepartmentIds"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Хамааралтай нэгжүүд</FormLabel>
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button variant="outline" className="w-full justify-start font-normal">
                                                                {field.value && field.value.length > 0 ? `${field.value.length} нэгж сонгосон` : "Нэгж сонгох..."}
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent className="w-[var(--radix-dropdown-menu-trigger-width)]" align="start">
                                                            <div className="p-2 sticky top-0 bg-popover z-10">
                                                                <div className="relative">
                                                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                                                    <Input
                                                                        placeholder="Хайх..."
                                                                        className="pl-9 h-9"
                                                                        value={deptSearch}
                                                                        onChange={(e) => setDeptSearch(e.target.value)}
                                                                        onKeyDown={(e) => e.stopPropagation()}
                                                                    />
                                                                </div>
                                                            </div>
                                                            <DropdownMenuSeparator />
                                                            <div className="max-h-[250px] overflow-y-auto pointer-events-auto">
                                                                {filteredDepartments.length === 0 ? (
                                                                    <div className="py-4 px-2 text-center text-sm text-muted-foreground">
                                                                        Нэгж олдсонгүй
                                                                    </div>
                                                                ) : (
                                                                    filteredDepartments.map(dept => (
                                                                        <DropdownMenuCheckboxItem
                                                                            key={dept.id}
                                                                            checked={!!field.value?.includes(dept.id)}
                                                                            onSelect={(e) => e.preventDefault()}
                                                                            onCheckedChange={(checked) => {
                                                                                const currentValues = field.value || [];
                                                                                const newValues = checked
                                                                                    ? [...currentValues, dept.id]
                                                                                    : currentValues.filter((id) => id !== dept.id);
                                                                                field.onChange(newValues);
                                                                            }}
                                                                        >
                                                                            {dept.name}
                                                                        </DropdownMenuCheckboxItem>
                                                                    ))
                                                                )}
                                                            </div>
                                                            <DropdownMenuSeparator />
                                                            <div className="p-1">
                                                                <DropdownMenuItem
                                                                    className="w-full justify-center text-xs h-8 text-primary hover:text-primary hover:bg-primary/10 cursor-pointer focus:bg-primary/10 focus:text-primary"
                                                                >
                                                                    Сонгож дууссан
                                                                </DropdownMenuItem>
                                                            </div>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    )}
                                    {selectionType === 'positions' && (
                                        <FormField
                                            control={form.control}
                                            name="applicablePositionIds"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Хамааралтай ажлын байр</FormLabel>
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button variant="outline" className="w-full justify-start font-normal">
                                                                {field.value && field.value.length > 0 ? `${field.value.length} ажлын байр сонгосон` : "Ажлын байр сонгох..."}
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent className="w-[var(--radix-dropdown-menu-trigger-width)]" align="start">
                                                            <div className="p-2 sticky top-0 bg-popover z-10">
                                                                <div className="relative">
                                                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                                                    <Input
                                                                        placeholder="Хайх..."
                                                                        className="pl-9 h-9"
                                                                        value={posSearch}
                                                                        onChange={(e) => setPosSearch(e.target.value)}
                                                                        onKeyDown={(e) => e.stopPropagation()}
                                                                    />
                                                                </div>
                                                            </div>
                                                            <DropdownMenuSeparator />
                                                            <div className="max-h-[250px] overflow-y-auto pointer-events-auto">
                                                                {filteredPositions.length === 0 ? (
                                                                    <div className="py-4 px-2 text-center text-sm text-muted-foreground">
                                                                        Ажлын байр олдсонгүй
                                                                    </div>
                                                                ) : (
                                                                    filteredPositions.map(pos => (
                                                                        <DropdownMenuCheckboxItem
                                                                            key={pos.id}
                                                                            checked={!!field.value?.includes(pos.id)}
                                                                            onSelect={(e) => e.preventDefault()}
                                                                            onCheckedChange={(checked) => {
                                                                                const currentValues = field.value || [];
                                                                                const newValues = checked
                                                                                    ? [...currentValues, pos.id]
                                                                                    : currentValues.filter((id) => id !== pos.id);
                                                                                field.onChange(newValues);
                                                                            }}
                                                                        >
                                                                            {pos.title}
                                                                        </DropdownMenuCheckboxItem>
                                                                    ))
                                                                )}
                                                            </div>
                                                            <DropdownMenuSeparator />
                                                            <div className="p-1">
                                                                <DropdownMenuItem
                                                                    className="w-full justify-center text-xs h-8 text-primary hover:text-primary hover:bg-primary/10 cursor-pointer focus:bg-primary/10 focus:text-primary"
                                                                >
                                                                    Сонгож дууссан
                                                                </DropdownMenuItem>
                                                            </div>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    )}
                                </>
                            )}
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Цуцлах</Button>
                            <Button type="submit" disabled={isSubmitting || isUploading || isUploadingVideo}>
                                {(isSubmitting || isUploading || isUploadingVideo) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Хадгалах
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
