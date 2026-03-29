'use client';

import React, { useRef, useState } from 'react';
import {
    Card, CardContent, CardDescription, CardHeader, CardTitle,
} from '@/components/ui/card';
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { ActionIconButton } from '@/components/ui/action-icon-button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { File, Upload, Settings, Loader2, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import {
    useCollection, useFirebase, useMemoFirebase, tenantCollection, useTenantWrite,
} from '@/firebase';
import { addDoc, Timestamp, query, orderBy } from 'firebase/firestore';
import { Employee } from '@/types';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useTenant } from '@/contexts/tenant-context';
import type { Document, DocumentCategory } from './data';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/firebase';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
    'Хөдөлмөрийн гэрээ': <File className="h-4 w-4 text-green-500" />,
    'Дотоод журам': <File className="h-4 w-4 text-blue-500" />,
    'Ажилтны гарын авлага': <File className="h-4 w-4 text-purple-500" />,
    'Маягт': <File className="h-4 w-4 text-orange-500" />,
    'Бусад': <File className="h-4 w-4 text-gray-500" />,
};

const CATEGORIES: DocumentCategory[] = [
    'Хөдөлмөрийн гэрээ',
    'Дотоод журам',
    'Ажилтны гарын авлага',
    'Маягт',
    'Бусад',
];

function formatFileSize(bytes?: number): string {
    if (!bytes || bytes === 0) return '—';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ─── Document Row ─────────────────────────────────────────────────────────────

function DocumentRow({ doc, employeeName }: { doc: Document; employeeName?: string }) {
    const Icon = CATEGORY_ICONS[doc.documentType] ?? CATEGORY_ICONS['Бусад'];

    return (
        <TableRow>
            <TableCell className="font-medium">
                <Link
                    href={`/dashboard/employee-documents/${doc.id}`}
                    className="flex items-center gap-2 hover:text-primary transition-colors hover:underline"
                >
                    {Icon}
                    <span>{doc.title}</span>
                </Link>
            </TableCell>
            <TableCell className="hidden sm:table-cell">
                <Badge variant="secondary">{doc.documentType}</Badge>
            </TableCell>
            <TableCell className="hidden md:table-cell text-muted-foreground text-sm">
                {format(new Date(doc.uploadDate), 'yyyy.MM.dd')}
            </TableCell>
            <TableCell className="hidden lg:table-cell text-muted-foreground text-sm">
                {employeeName ?? '—'}
            </TableCell>
            <TableCell className="text-right hidden md:table-cell text-muted-foreground text-sm">
                {formatFileSize(doc.fileSize)}
            </TableCell>
        </TableRow>
    );
}

// ─── Upload Dialog ────────────────────────────────────────────────────────────

interface UploadDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onUploaded: () => void;
}

function UploadDialog({ open, onOpenChange, onUploaded }: UploadDialogProps) {
    const { storage } = useFirebase();
    const { tCollection } = useTenantWrite();
    const { user } = useUser();
    const { companyId } = useTenant();
    const { toast } = useToast();

    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [category, setCategory] = useState<DocumentCategory>('Бусад');
    const [file, setFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [assignedEmployeeId, setAssignedEmployeeId] = useState<string>('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const employeesQuery = useMemoFirebase(
        ({ firestore, companyPath }) =>
            firestore ? query(tenantCollection(firestore, companyPath, 'employees'), orderBy('lastName')) : null,
        []
    );
    const { data: employees } = useCollection<Employee>(employeesQuery);

    const reset = () => {
        setTitle('');
        setDescription('');
        setCategory('Бусад');
        setFile(null);
        setAssignedEmployeeId('');
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0] ?? null;
        setFile(f);
        if (f && !title) setTitle(f.name.replace(/\.[^.]+$/, ''));
    };

    const handleUpload = async () => {
        if (!file || !storage || !title.trim() || !companyId) return;
        setIsUploading(true);
        try {
            // 1. Upload to Firebase Storage (tenant-scoped path)
            const storageRef = ref(
                storage,
                `documents/${assignedEmployeeId || companyId}/${Date.now()}_${file.name}`
            );
            await uploadBytes(storageRef, file);
            const url = await getDownloadURL(storageRef);

            // 2. Save metadata to Firestore
            await addDoc(tCollection('documents'), {
                title: title.trim(),
                description: description.trim(),
                documentType: category,
                url,
                fileSize: file.size,
                mimeType: file.type,
                uploadDate: new Date().toISOString(),
                uploadedBy: user?.uid ?? null,
                metadata: {
                    ...(assignedEmployeeId ? { employeeId: assignedEmployeeId } : {}),
                },
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now(),
            });

            toast({
                title: 'Амжилттай байршуулагдлаа',
                description: `"${title}" баримт бичиг нэмэгдлээ.`,
            });
            reset();
            onOpenChange(false);
            onUploaded();
        } catch (err) {
            toast({
                title: 'Алдаа гарлаа',
                description: err instanceof Error ? err.message : 'Байршуулахад алдаа гарлаа.',
                variant: 'destructive',
            });
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Баримт бичиг байршуулах</DialogTitle>
                </DialogHeader>

                <div className="space-y-4 py-2">
                    {/* File picker */}
                    <div className="space-y-2">
                        <Label>Файл сонгох *</Label>
                        <div
                            className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
                            onClick={() => fileInputRef.current?.click()}
                        >
                            {file ? (
                                <div className="space-y-1">
                                    <File className="h-8 w-8 mx-auto text-primary" />
                                    <p className="text-sm font-medium truncate">{file.name}</p>
                                    <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
                                    <p className="text-sm text-muted-foreground">
                                        Файлаа энд чирж оруулах эсвэл дарж сонгоно уу
                                    </p>
                                    <p className="text-xs text-muted-foreground">PDF, DOCX, PNG, JPG</p>
                                </div>
                            )}
                        </div>
                        <input
                            ref={fileInputRef}
                            type="file"
                            className="hidden"
                            accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                            onChange={handleFileChange}
                        />
                    </div>

                    {/* Title */}
                    <div className="space-y-2">
                        <Label>Нэр *</Label>
                        <Input
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="Баримтын нэр"
                        />
                    </div>

                    {/* Category */}
                    <div className="space-y-2">
                        <Label>Ангилал</Label>
                        <Select value={category} onValueChange={(v) => setCategory(v as DocumentCategory)}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {CATEGORIES.map((c) => (
                                    <SelectItem key={c} value={c}>{c}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Assigned Employee */}
                    <div className="space-y-2">
                        <Label>Холбоотой ажилтан (заавал биш)</Label>
                        <Select value={assignedEmployeeId} onValueChange={setAssignedEmployeeId}>
                            <SelectTrigger>
                                <SelectValue placeholder="Ажилтан сонгох..." />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="">— Сонгохгүй —</SelectItem>
                                {(employees ?? []).map((emp) => (
                                    <SelectItem key={emp.id} value={emp.id}>
                                        {emp.lastName} {emp.firstName}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Description */}
                    <div className="space-y-2">
                        <Label>Тайлбар (заавал биш)</Label>
                        <Input
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Баримтын товч тайлбар"
                        />
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => { reset(); onOpenChange(false); }}>
                        Болих
                    </Button>
                    <Button
                        onClick={handleUpload}
                        disabled={!file || !title.trim() || isUploading}
                    >
                        {isUploading ? (
                            <><Loader2 className="h-4 w-4 animate-spin mr-2" />Байршуулж байна...</>
                        ) : (
                            <><Upload className="h-4 w-4 mr-2" />Байршуулах</>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DocumentsPage() {
    const [isUploadOpen, setIsUploadOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [uploadKey, setUploadKey] = useState(0); // force refetch after upload

    const documentsQuery = useMemoFirebase(
        ({ firestore, companyPath }) =>
            firestore ? tenantCollection(firestore, companyPath, 'documents') : null,
        []
    );
    const { data: documents, isLoading, error } = useCollection<Document>(documentsQuery);

    const employeesQuery = useMemoFirebase(
        ({ firestore, companyPath }) =>
            firestore ? tenantCollection(firestore, companyPath, 'employees') : null,
        []
    );
    const { data: employees } = useCollection<Employee>(employeesQuery);

    const employeeMap = React.useMemo(() => {
        const map = new Map<string, string>();
        (employees ?? []).forEach(emp => {
            map.set(emp.id, `${emp.lastName} ${emp.firstName}`.trim());
        });
        return map;
    }, [employees]);

    const filtered = React.useMemo(() => {
        if (!documents) return [];
        if (!searchQuery.trim()) return documents;
        const q = searchQuery.toLowerCase();
        return documents.filter(
            (d) =>
                d.title.toLowerCase().includes(q) ||
                d.documentType.toLowerCase().includes(q) ||
                d.description?.toLowerCase().includes(q)
        );
    }, [documents, searchQuery]);

    return (
        <div className="py-8 space-y-4">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle>Баримт бичиг</CardTitle>
                        <CardDescription>
                            Хүний нөөцийн чухал баримт бичгүүдийг аюулгүй хадгалж, удирдах.
                        </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                        <ActionIconButton
                            label="Тохиргоо"
                            description="Баримтын тохиргоо"
                            href="/dashboard/employee-documents/settings"
                            icon={<Settings className="h-4 w-4" />}
                            variant="outline"
                            className="bg-white hover:bg-slate-50"
                        />
                        <Button onClick={() => setIsUploadOpen(true)}>
                            <Upload className="h-4 w-4 mr-2" />
                            Байршуулах
                        </Button>
                    </div>
                </CardHeader>

                <CardContent className="space-y-4">
                    {/* Search */}
                    <div className="relative max-w-sm">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Нэр, ангилалаар хайх..."
                            className="pl-9"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>

                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Нэр</TableHead>
                                <TableHead className="hidden sm:table-cell">Ангилал</TableHead>
                                <TableHead className="hidden md:table-cell">Огноо</TableHead>
                                <TableHead className="hidden lg:table-cell">Ажилтан</TableHead>
                                <TableHead className="text-right hidden md:table-cell">Хэмжээ</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading && Array.from({ length: 5 }).map((_, i) => (
                                <TableRow key={i}>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            <Skeleton className="h-4 w-4" />
                                            <Skeleton className="h-4 w-48" />
                                        </div>
                                    </TableCell>
                                    <TableCell className="hidden sm:table-cell"><Skeleton className="h-6 w-20" /></TableCell>
                                    <TableCell className="hidden md:table-cell"><Skeleton className="h-4 w-24" /></TableCell>
                                    <TableCell className="hidden lg:table-cell"><Skeleton className="h-4 w-24" /></TableCell>
                                    <TableCell className="text-right hidden md:table-cell"><Skeleton className="ml-auto h-4 w-16" /></TableCell>
                                </TableRow>
                            ))}

                            {error && (
                                <TableRow>
                                    <TableCell colSpan={5} className="py-8 text-center text-destructive">
                                        Алдаа гарлаа: {error.message}
                                    </TableCell>
                                </TableRow>
                            )}

                            {!isLoading && !error && filtered.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={5} className="py-12 text-center text-muted-foreground">
                                        {searchQuery ? 'Хайлтад тохирох баримт олдсонгүй' : 'Баримт бичиг байхгүй байна'}
                                    </TableCell>
                                </TableRow>
                            )}

                            {!isLoading && !error && filtered.map((doc) => (
                                <DocumentRow key={doc.id} doc={doc} employeeName={employeeMap.get(doc.metadata?.employeeId as string)} />
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <UploadDialog
                key={uploadKey}
                open={isUploadOpen}
                onOpenChange={setIsUploadOpen}
                onUploaded={() => setUploadKey((k) => k + 1)}
            />
        </div>
    );
}
