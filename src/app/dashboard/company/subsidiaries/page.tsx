'use client';

import * as React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageHeader } from '@/components/patterns/page-layout';
import { useFirebase, useDoc, useMemoFirebase, updateDocumentNonBlocking, tenantDoc } from '@/firebase';
import { ChevronLeft, Building2, Plus, Loader2, Pencil, Trash2, X, Check, Hash } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface Subsidiary {
    name: string;
    registrationNumber?: string;
}

interface CompanyProfile {
    subsidiaries?: Subsidiary[];
}

export default function SubsidiariesPage() {
    const { firestore } = useFirebase();
    const { toast } = useToast();
    
    const companyProfileRef = useMemoFirebase(
        ({ firestore, companyPath }) => (firestore ? tenantDoc(firestore, companyPath, 'company', 'profile') : null),
        []
    );
    
    const { data: companyProfile, isLoading } = useDoc<CompanyProfile>(companyProfileRef as any);
    
    const [newName, setNewName] = React.useState('');
    const [newRegNumber, setNewRegNumber] = React.useState('');
    const [isAdding, setIsAdding] = React.useState(false);
    const [editingIndex, setEditingIndex] = React.useState<number | null>(null);
    const [editingName, setEditingName] = React.useState('');
    const [editingRegNumber, setEditingRegNumber] = React.useState('');
    const [isSaving, setIsSaving] = React.useState(false);
    const [deleteTarget, setDeleteTarget] = React.useState<Subsidiary | null>(null);
    const [isDeleting, setIsDeleting] = React.useState(false);

    const subsidiaries: Subsidiary[] = React.useMemo(() => {
        if (!companyProfile?.subsidiaries) return [];
        // Handle both old string format and new object format
        return companyProfile.subsidiaries.map(item => {
            if (typeof item === 'string') {
                return { name: item, registrationNumber: '' };
            }
            return item as Subsidiary;
        });
    }, [companyProfile?.subsidiaries]);

    const handleAdd = async () => {
        if (!companyProfileRef || !newName.trim()) return;
        
        if (subsidiaries.some(s => s.name === newName.trim())) {
            toast({ variant: 'destructive', title: 'Аль хэдийн бүртгэгдсэн байна' });
            return;
        }
        
        setIsAdding(true);
        try {
            const newSubsidiary: Subsidiary = {
                name: newName.trim(),
                registrationNumber: newRegNumber.trim() || undefined
            };
            
            await updateDocumentNonBlocking(companyProfileRef, {
                subsidiaries: [...subsidiaries, newSubsidiary]
            });
            setNewName('');
            setNewRegNumber('');
            toast({ title: 'Охин компани нэмэгдлээ' });
        } catch (error) {
            toast({ variant: 'destructive', title: 'Алдаа гарлаа' });
        } finally {
            setIsAdding(false);
        }
    };

    const handleEdit = (index: number) => {
        setEditingIndex(index);
        setEditingName(subsidiaries[index].name);
        setEditingRegNumber(subsidiaries[index].registrationNumber || '');
    };

    const handleCancelEdit = () => {
        setEditingIndex(null);
        setEditingName('');
        setEditingRegNumber('');
    };

    const handleSaveEdit = async () => {
        if (!companyProfileRef || editingIndex === null || !editingName.trim()) return;
        
        const oldItem = subsidiaries[editingIndex];
        const newItem: Subsidiary = {
            name: editingName.trim(),
            registrationNumber: editingRegNumber.trim() || undefined
        };
        
        if (oldItem.name === newItem.name && oldItem.registrationNumber === newItem.registrationNumber) {
            handleCancelEdit();
            return;
        }
        
        // Check for duplicate name (excluding current item)
        if (subsidiaries.some((s, i) => i !== editingIndex && s.name === newItem.name)) {
            toast({ variant: 'destructive', title: 'Аль хэдийн бүртгэгдсэн байна' });
            return;
        }
        
        setIsSaving(true);
        try {
            const newSubsidiaries = [...subsidiaries];
            newSubsidiaries[editingIndex] = newItem;
            
            await updateDocumentNonBlocking(companyProfileRef, {
                subsidiaries: newSubsidiaries
            });
            toast({ title: 'Засвар хадгалагдлаа' });
            handleCancelEdit();
        } catch (error) {
            toast({ variant: 'destructive', title: 'Алдаа гарлаа' });
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!companyProfileRef || !deleteTarget) return;
        
        setIsDeleting(true);
        try {
            const newSubsidiaries = subsidiaries.filter(s => s.name !== deleteTarget.name);
            
            await updateDocumentNonBlocking(companyProfileRef, {
                subsidiaries: newSubsidiaries
            });
            toast({ title: 'Охин компани устгагдлаа' });
            setDeleteTarget(null);
        } catch (error) {
            toast({ variant: 'destructive', title: 'Алдаа гарлаа' });
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="bg-white border-b sticky top-0 z-20">
                <div className="px-6 md:px-8 py-4">
                    <PageHeader
                        title="Охин компаниуд"
                        description={`${subsidiaries.length} бүртгэлтэй`}
                        showBackButton
                        hideBreadcrumbs
                        backButtonPlacement="inline"
                        backBehavior="history"
                        fallbackBackHref="/dashboard/company"
                    />
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
                <div className="p-6 md:p-8 pb-32 max-w-2xl">
                    {isLoading ? (
                        <div className="space-y-4">
                            <Skeleton className="h-32 w-full" />
                            <Skeleton className="h-20 w-full" />
                            <Skeleton className="h-20 w-full" />
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {/* Add new */}
                            <div className="bg-white rounded-xl border p-4">
                                <h3 className="text-sm font-medium mb-4">Шинэ охин компани нэмэх</h3>
                                <div className="space-y-3">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div className="space-y-1.5">
                                            <Label className="text-xs text-muted-foreground">Компанийн нэр *</Label>
                                            <Input
                                                placeholder="Компанийн нэр"
                                                value={newName}
                                                onChange={(e) => setNewName(e.target.value)}
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label className="text-xs text-muted-foreground">Регистрийн дугаар</Label>
                                            <Input
                                                placeholder="1234567"
                                                value={newRegNumber}
                                                onChange={(e) => setNewRegNumber(e.target.value)}
                                                onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                                            />
                                        </div>
                                    </div>
                                    <Button
                                        onClick={handleAdd}
                                        disabled={isAdding || !newName.trim()}
                                        className="w-full sm:w-auto"
                                    >
                                        {isAdding ? (
                                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                        ) : (
                                            <Plus className="h-4 w-4 mr-2" />
                                        )}
                                        Нэмэх
                                    </Button>
                                </div>
                            </div>

                            {/* List */}
                            <div className="bg-white rounded-xl border">
                                <div className="p-4 border-b">
                                    <h3 className="font-medium">Бүртгэлтэй охин компаниуд</h3>
                                </div>
                                
                                {subsidiaries.length === 0 ? (
                                    <div className="p-8 text-center">
                                        <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
                                            <Building2 className="h-6 w-6 text-slate-400" />
                                        </div>
                                        <p className="text-sm text-muted-foreground">
                                            Охин компани бүртгэгдээгүй байна
                                        </p>
                                    </div>
                                ) : (
                                    <div className="divide-y">
                                        {subsidiaries.map((item, index) => (
                                            <div key={index} className="p-4">
                                                {editingIndex === index ? (
                                                    <div className="space-y-3">
                                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                            <div className="space-y-1.5">
                                                                <Label className="text-xs text-muted-foreground">Компанийн нэр</Label>
                                                                <Input
                                                                    value={editingName}
                                                                    onChange={(e) => setEditingName(e.target.value)}
                                                                    autoFocus
                                                                />
                                                            </div>
                                                            <div className="space-y-1.5">
                                                                <Label className="text-xs text-muted-foreground">Регистрийн дугаар</Label>
                                                                <Input
                                                                    value={editingRegNumber}
                                                                    onChange={(e) => setEditingRegNumber(e.target.value)}
                                                                    onKeyDown={(e) => {
                                                                        if (e.key === 'Enter') handleSaveEdit();
                                                                        if (e.key === 'Escape') handleCancelEdit();
                                                                    }}
                                                                />
                                                            </div>
                                                        </div>
                                                        <div className="flex gap-2">
                                                            <Button
                                                                size="sm"
                                                                onClick={handleSaveEdit}
                                                                disabled={isSaving || !editingName.trim()}
                                                            >
                                                                {isSaving ? (
                                                                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                                                ) : (
                                                                    <Check className="h-4 w-4 mr-2" />
                                                                )}
                                                                Хадгалах
                                                            </Button>
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                onClick={handleCancelEdit}
                                                            >
                                                                Болих
                                                            </Button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center justify-between group">
                                                        <div className="flex items-center gap-3">
                                                            <div className="h-10 w-10 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
                                                                <Building2 className="h-5 w-5 text-indigo-600" />
                                                            </div>
                                                            <div>
                                                                <p className="font-medium">{item.name}</p>
                                                                {item.registrationNumber && (
                                                                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                                                                        <Hash className="h-3 w-3" />
                                                                        {item.registrationNumber}
                                                                    </p>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <Button
                                                                size="icon"
                                                                variant="ghost"
                                                                className="h-8 w-8"
                                                                onClick={() => handleEdit(index)}
                                                            >
                                                                <Pencil className="h-4 w-4" />
                                                            </Button>
                                                            <Button
                                                                size="icon"
                                                                variant="ghost"
                                                                className="h-8 w-8 text-destructive hover:text-destructive"
                                                                onClick={() => setDeleteTarget(item)}
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Delete Confirmation Dialog */}
            <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Охин компани устгах</AlertDialogTitle>
                        <AlertDialogDescription>
                            "{deleteTarget?.name}" охин компанийг устгахдаа итгэлтэй байна уу?
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Болих</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDelete}
                            className="bg-destructive hover:bg-destructive/90"
                            disabled={isDeleting}
                        >
                            {isDeleting ? (
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            ) : null}
                            Устгах
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
