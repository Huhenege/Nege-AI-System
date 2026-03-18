'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useFetchCollection, useFirebase, useTenantWrite } from '@/firebase';
import { collection, query, orderBy, Timestamp, deleteDoc, addDoc } from 'firebase/firestore';
import { ERTemplate, ERDocumentType } from '../types';
import { Button } from '@/components/ui/button';
import { AddActionButton } from '@/components/ui/add-action-button';
import { ActionIconButton } from '@/components/ui/action-icon-button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, FileCode, Pencil, Trash2, Copy, Settings, ShieldCheck } from 'lucide-react';
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
} from '@/components/ui/alert-dialog';
import Link from 'next/link';
import { ensureSystemTemplates } from '../seed';

interface TemplatesTabProps {
    docTypes: ERDocumentType[];
}

export function TemplatesTab({ docTypes }: TemplatesTabProps) {
    const { firestore } = useFirebase();
    const { tDoc, tCollection } = useTenantWrite();
    const { toast } = useToast();
    const [searchQuery, setSearchQuery] = useState('');
    const [typeFilter, setTypeFilter] = useState<string>('all');

    // Ensure system templates exist on first render (idempotent — skips if already created)
    const didInitRef = useRef(false);
    useEffect(() => {
        if (didInitRef.current || !firestore) return;
        didInitRef.current = true;
        ensureSystemTemplates().catch(e => console.warn('System template init:', e));
    }, [firestore]);

    const templatesQuery = React.useMemo(() =>
        firestore ? query(collection(firestore, 'er_templates'), orderBy('updatedAt', 'desc')) : null
        , [firestore]);

    const { data: templates, isLoading, refetch } = useFetchCollection<ERTemplate>(templatesQuery);

    const docTypeMap = React.useMemo(() => {
        return docTypes.reduce((acc, type) => ({ ...acc, [type.id]: type.name }), {} as Record<string, string>);
    }, [docTypes]);

    const filteredTemplates = React.useMemo(() => {
        if (!templates) return [];
        return templates.filter(tpl => {
            const matchesSearch = tpl.name.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesType = typeFilter === 'all' || tpl.documentTypeId === typeFilter;
            return matchesSearch && matchesType;
        });
    }, [templates, searchQuery, typeFilter]);

    const handleDelete = async (id: string) => {
        if (!firestore) return;
        try {
            await deleteDoc(tDoc('er_templates', id));
            toast({ title: "Амжилттай", description: "Загвар устгагдлаа" });
            refetch();
        } catch (error) {
            console.error(error);
            toast({ title: "Алдаа", description: "Загвар устгахад алдаа гарлаа", variant: "destructive" });
        }
    };

    const handleDuplicate = async (template: ERTemplate) => {
        if (!firestore) return;
        try {
            const newDoc = {
                ...template,
                id: undefined,
                name: `${template.name} (Copy)`,
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now()
            };
            delete (newDoc as any).id;

            await addDoc(tCollection('er_templates'), newDoc);
            toast({ title: "Амжилттай", description: "Загвар хувилагдлаа" });
            refetch();
        } catch (error) {
            console.error(error);
            toast({ title: "Алдаа", description: "Хувилахад алдаа гарлаа", variant: "destructive" });
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                <div className="flex flex-1 gap-4 w-full">
                    <div className="relative flex-1 max-w-sm">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Загвар хайх..."
                            className="pl-9 bg-white shadow-sm"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <Select value={typeFilter} onValueChange={setTypeFilter}>
                        <SelectTrigger className="w-[200px] bg-white shadow-sm">
                            <SelectValue placeholder="Төрөл сонгох" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Бүх төрөл</SelectItem>
                            {docTypes.map(type => (
                                <SelectItem key={type.id} value={type.id}>{type.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="flex gap-2">
                    <ActionIconButton
                        label="Тохиргоо"
                        description="Процессын тохиргоо"
                        href="/dashboard/employment-relations/settings"
                        icon={<Settings className="h-4 w-4" />}
                        variant="outline"
                        className="bg-white hover:bg-slate-50 shadow-sm text-slate-600"
                    />
                    <AddActionButton
                        label="Шинэ загвар"
                        description="Шинэ загвар үүсгэх"
                        href="/dashboard/employment-relations/templates/create"
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {isLoading ? (
                    Array.from({ length: 6 }).map((_, i) => (
                        <Card key={i} className="animate-pulse h-[200px] bg-white/50 border-none shadow-sm" />
                    ))
                ) : filteredTemplates.length === 0 ? (
                    <div className="col-span-full py-20 text-center text-muted-foreground border-2 border-dashed rounded-3xl">
                        <FileCode className="h-12 w-12 mx-auto mb-4 opacity-20" />
                        <p className="font-medium">Загвар олдсонгүй</p>
                    </div>
                ) : (
                    filteredTemplates.map((template) => (
                        <Card key={template.id} className="group hover:shadow-lg transition-all border-none shadow-sm bg-white overflow-hidden relative">
                            {/* Status Indicator */}
                            <div className={`absolute top-0 left-0 w-1 h-full ${template.isSystem ? 'bg-blue-500' : template.isActive ? 'bg-emerald-500' : 'bg-slate-300'}`} />

                            <CardHeader className="pb-3">
                                <div className="flex justify-between items-start gap-4">
                                    <div className={`p-2.5 rounded-xl ${template.isSystem ? 'bg-blue-50 text-blue-600' : 'bg-blue-50 text-blue-600'}`}>
                                        {template.isSystem ? <ShieldCheck className="h-5 w-5" /> : <FileCode className="h-5 w-5" />}
                                    </div>
                                    <div className="flex gap-1.5">
                                        {template.isSystem && (
                                            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100">
                                                Системийн
                                            </Badge>
                                        )}
                                        <Badge variant={template.isActive ? "default" : "secondary"} className={template.isActive ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200" : ""}>
                                            {template.isActive ? "Идэвхтэй" : "Идэвхгүй"}
                                        </Badge>
                                    </div>
                                </div>
                                <CardTitle className="mt-4 line-clamp-1 text-lg">{template.name}</CardTitle>
                                <CardDescription className="line-clamp-1">
                                    {docTypeMap[template.documentTypeId] || 'Тодорхойгүй төрөл'}
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-6 font-mono">
                                    <span>v{template.version || 1}</span>
                                    <span>•</span>
                                    <span>{template.updatedAt?.toDate().toLocaleDateString()}</span>
                                </div>

                                <div className="flex items-center gap-2 pt-4 border-t">
                                    <Button variant="ghost" size="sm" asChild className="h-8 w-8 p-0 rounded-lg hover:bg-blue-50 hover:text-blue-600">
                                        <Link href={`/dashboard/employment-relations/templates/${template.id}`}>
                                            <Pencil className="h-4 w-4" />
                                        </Link>
                                    </Button>
                                    {!template.isSystem && (
                                        <Button variant="ghost" size="sm" onClick={() => handleDuplicate(template)} className="h-8 w-8 p-0 rounded-lg hover:bg-purple-50 hover:text-purple-600">
                                            <Copy className="h-4 w-4" />
                                        </Button>
                                    )}

                                    <div className="flex-1" />

                                    {!template.isSystem && (
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-lg hover:bg-red-50 hover:text-red-600">
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>Устгахдаа итгэлтэй байна уу?</AlertDialogTitle>
                                                    <AlertDialogDescription>
                                                        Энэ үйлдлийг буцаах боломжгүй бөгөөд загвар бүрмөсөн устах болно.
                                                    </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>Болих</AlertDialogCancel>
                                                    <AlertDialogAction onClick={() => handleDelete(template.id)} className="bg-red-600 hover:bg-red-700">
                                                        Устгах
                                                    </AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    ))
                )}
            </div>

        </div>
    );
}
