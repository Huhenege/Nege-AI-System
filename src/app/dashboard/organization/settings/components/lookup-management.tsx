import { query, where, getDocs, writeBatch } from 'firebase/firestore';
import { useFetchCollection, useFirebase, useMemoFirebase, addDocumentNonBlocking, deleteDocumentNonBlocking, updateDocumentNonBlocking, tenantCollection, tenantDoc, useTenantWrite } from '@/firebase';
import { getJsonAuthHeaders } from '@/lib/api/client-auth';
import { useState, useMemo, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Loader2, PlusCircle, Trash2, Pencil, Save, X, Check, Sparkles, AlertCircle, Link2, Shield } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent } from '@/components/ui/card';
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
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';

interface ColumnConfig {
    key: string;
    label: string;
    type: 'text' | 'number';
    width?: string;
    required?: boolean;
    defaultValue?: any;
}

type AIGenerationType = 'departmentTypes' | 'positionLevels' | 'employmentTypes';

// Configuration for checking references in other collections
interface ReferenceConfig {
    collection: string;      // Collection to check (e.g., 'departments', 'positions')
    field: string;           // Field in that collection that references this item (e.g., 'typeId', 'levelId')
    nameField?: string;      // Field to update with the name when editing (e.g., 'typeName')
    label: string;           // Human-readable label (e.g., 'Нэгж', 'Ажлын байр')
}

interface LookupManagementProps {
    collectionName: string;
    title: string;
    description?: string;
    columns: ColumnConfig[];
    aiGenerationType?: AIGenerationType;
    sortBy?: {
        key: string;
        direction?: 'asc' | 'desc';
    };
    referenceCheck?: ReferenceConfig;  // Configuration for preventing deletion if referenced
}

export function LookupManagement({ collectionName, title, description, columns, aiGenerationType, sortBy, referenceCheck }: LookupManagementProps) {
    const { firestore } = useFirebase();
    const { tDoc, tCollection, companyPath } = useTenantWrite();
    const { toast } = useToast();
    const [isAdding, setIsAdding] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [newItemData, setNewItemData] = useState<Record<string, any>>({});
    const [editItemData, setEditItemData] = useState<Record<string, any>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [showAIConfirmDialog, setShowAIConfirmDialog] = useState(false);
    const [generatedItems, setGeneratedItems] = useState<any[]>([]);
    const [usageCounts, setUsageCounts] = useState<Record<string, number>>({});
    const [isLoadingUsage, setIsLoadingUsage] = useState(false);

    const collectionRef = useMemoFirebase(
        ({ firestore, companyPath }) => (firestore ? tenantCollection(firestore, companyPath, collectionName) : null),
        [firestore, collectionName]
    );

    const { data: items, isLoading } = useFetchCollection<any>(collectionRef);

    // Create a stable key for items to use in dependencies
    const itemsKey = useMemo(() => items?.map(i => i.id).join(',') || '', [items]);

    // Fetch usage counts for all items when referenceCheck is configured
    const fetchUsageCounts = useCallback(async () => {
        if (!firestore || !companyPath || !referenceCheck || !items || items.length === 0) {
            setUsageCounts({});
            return;
        }
        
        setIsLoadingUsage(true);
        try {
            const counts: Record<string, number> = {};
            
            for (const item of items) {
                const q = query(
                    tenantCollection(firestore, companyPath, referenceCheck.collection),
                    where(referenceCheck.field, '==', item.id)
                );
                const snapshot = await getDocs(q);
                counts[item.id] = snapshot.size;
            }
            
            setUsageCounts(counts);
        } catch (error) {
            console.error('Error fetching usage counts:', error);
        } finally {
            setIsLoadingUsage(false);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [firestore, companyPath, referenceCheck?.collection, referenceCheck?.field, itemsKey]);

    // Fetch usage counts when items change
    useEffect(() => {
        fetchUsageCounts();
    }, [fetchUsageCounts]);

    // Sort items if sortBy is provided
    const sortedItems = items ? [...items].sort((a, b) => {
        if (!sortBy) return 0;
        const aVal = a[sortBy.key];
        const bVal = b[sortBy.key];
        
        // Handle undefined/null values
        if (aVal == null && bVal == null) return 0;
        if (aVal == null) return 1;
        if (bVal == null) return -1;
        
        // Compare values
        const comparison = typeof aVal === 'number' && typeof bVal === 'number'
            ? aVal - bVal
            : String(aVal).localeCompare(String(bVal));
        
        return sortBy.direction === 'desc' ? -comparison : comparison;
    }) : null;

    // Check if item is in use
    const isItemInUse = (itemId: string) => {
        return (usageCounts[itemId] || 0) > 0;
    };

    // AI Generation
    const handleAIGenerate = async () => {
        if (!aiGenerationType || !firestore) return;
        
        setIsGenerating(true);
        try {
            const response = await fetch('/api/generate-org-defaults', {
                method: 'POST',
                headers: await getJsonAuthHeaders(),
                body: JSON.stringify({ type: aiGenerationType }),
            });

            const result = await response.json();
            
            if (!response.ok) {
                throw new Error(result.error || 'AI үүсгэхэд алдаа гарлаа');
            }

            setGeneratedItems(result.data);
            setShowAIConfirmDialog(true);
        } catch (error) {
            console.error('AI generation error:', error);
            toast({
                title: 'Алдаа',
                description: error instanceof Error ? error.message : 'AI үүсгэхэд алдаа гарлаа',
                variant: 'destructive',
            });
        } finally {
            setIsGenerating(false);
        }
    };

    const handleConfirmAIItems = async () => {
        if (!firestore || generatedItems.length === 0) return;

        setIsSubmitting(true);
        try {
            // Add all generated items to Firebase
            for (const item of generatedItems) {
                await addDocumentNonBlocking(tCollection(collectionName), item);
            }
            
            toast({
                title: 'Амжилттай',
                description: `${generatedItems.length} бичлэг нэмэгдлээ`,
            });
            setGeneratedItems([]);
            setShowAIConfirmDialog(false);
        } catch (error) {
            console.error('Error adding AI items:', error);
            toast({
                title: 'Алдаа',
                description: 'Бичлэг нэмэхэд алдаа гарлаа',
                variant: 'destructive',
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleAddItem = async () => {
        if (!firestore) return;

        // Simple validation
        const missingRequired = columns.filter(c => c.required && !newItemData[c.key]);
        if (missingRequired.length > 0) {
            toast({ title: 'Мэдээлэл дутуу', description: `${missingRequired.map(c => c.label).join(', ')} оруулна уу.`, variant: 'destructive' });
            return;
        }

        setIsSubmitting(true);
        try {
            await addDocumentNonBlocking(tCollection(collectionName), newItemData);
            setNewItemData({});
            setIsAdding(false);
            toast({ title: 'Амжилттай нэмэгдлээ' });
        } catch (e) {
            toast({ title: 'Алдаа', variant: 'destructive' });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleUpdateItem = async (id: string) => {
        if (!firestore) return;
        setIsSubmitting(true);
        try {
            const batch = writeBatch(firestore);
            
            // Update the lookup item itself
            batch.update(tDoc(collectionName, id), editItemData);
            
            // If there's a referenceCheck config and the name field changed, update all referencing documents
            if (referenceCheck && editItemData.name && companyPath) {
                const q = query(
                    tenantCollection(firestore, companyPath, referenceCheck.collection),
                    where(referenceCheck.field, '==', id)
                );
                const snapshot = await getDocs(q);
                
                snapshot.docs.forEach((docSnap) => {
                    const updateData: Record<string, any> = {};
                    
                    // Update the name field if configured
                    if (referenceCheck.nameField) {
                        updateData[referenceCheck.nameField] = editItemData.name;
                    }
                    
                    // For departmentTypes, also update typeLevel if level changed
                    if (collectionName === 'departmentTypes' && editItemData.level !== undefined) {
                        updateData.typeLevel = editItemData.level;
                    }
                    
                    if (Object.keys(updateData).length > 0) {
                        batch.update(tenantDoc(firestore, companyPath!, referenceCheck.collection, docSnap.id), updateData);
                    }
                });
                
                if (snapshot.size > 0) {
                    toast({ 
                        title: 'Амжилттай шинэчлэгдлээ',
                        description: `${snapshot.size} ${referenceCheck.label} дахь мэдээлэл мөн шинэчлэгдлээ.`
                    });
                }
            }
            
            await batch.commit();
            
            setEditingId(null);
            setEditItemData({});
            if (!referenceCheck || usageCounts[id] === 0) {
                toast({ title: 'Амжилттай шинэчлэгдлээ' });
            }
            
            // Refresh usage counts
            fetchUsageCounts();
        } catch (e) {
            console.error('Update error:', e);
            toast({ title: 'Алдаа', variant: 'destructive' });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteItem = async (id: string, itemName?: string) => {
        if (!firestore) return;
        
        // Real-time check if item is in use (don't rely on cached state)
        if (referenceCheck && companyPath) {
            try {
                const q = query(
                    tenantCollection(firestore, companyPath, referenceCheck.collection),
                    where(referenceCheck.field, '==', id)
                );
                const snapshot = await getDocs(q);
                const currentUsageCount = snapshot.size;
                
                if (currentUsageCount > 0) {
                    toast({ 
                        title: 'Устгах боломжгүй',
                        description: `"${itemName || 'Энэ бичлэг'}" ${currentUsageCount} ${referenceCheck.label}-д ашиглагдаж байна. Эхлээд холбоосыг арилгана уу.`,
                        variant: 'destructive'
                    });
                    // Refresh usage counts
                    fetchUsageCounts();
                    return;
                }
            } catch (error) {
                console.error('Error checking usage:', error);
                toast({ 
                    title: 'Алдаа',
                    description: 'Ашиглалтыг шалгахад алдаа гарлаа',
                    variant: 'destructive'
                });
                return;
            }
        }
        
        if (!confirm('Та итгэлтэй байна уу?')) return;
        try {
            await deleteDocumentNonBlocking(tDoc(collectionName, id));
            toast({ title: 'Устгагдлаа' });
            fetchUsageCounts();
        } catch (e) {
            toast({ title: 'Алдаа', variant: 'destructive' });
        }
    };

    const startEdit = (item: any) => {
        setEditingId(item.id);
        const data: Record<string, any> = {};
        columns.forEach(col => data[col.key] = item[col.key]);
        setEditItemData(data);
    };

    return (
        <>
        <Card className="border-none shadow-none bg-transparent">
            <CardContent className="px-0 pt-0">
                {/* Tab label already provides context; show only actions here */}
                {aiGenerationType ? (
                    <div className="flex justify-end mb-4">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleAIGenerate}
                            disabled={isGenerating}
                            className="gap-2 bg-gradient-to-r from-violet-50 to-indigo-50 border-violet-200 hover:from-violet-100 hover:to-indigo-100 text-violet-700"
                        >
                            {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                            AI-р үүсгэх
                        </Button>
                    </div>
                ) : null}
                <div className="rounded-xl border bg-card text-card-foreground shadow-sm overflow-hidden">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-muted/50 hover:bg-muted/50">
                                {columns.map((col, colIndex) => (
                                    <TableHead key={`${col.key}-${colIndex}`} style={{ width: col.width }}>{col.label}</TableHead>
                                ))}
                                <TableHead className="w-[100px] text-right">Үйлдэл</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {/* Add Row */}
                            {isAdding ? (
                                <TableRow className="bg-indigo-50/30">
                                    {columns.map((col, colIndex) => (
                                        <TableCell key={`${col.key}-${colIndex}`}>
                                            <Input
                                                autoFocus={columns[0].key === col.key}
                                                type={col.type}
                                                placeholder={col.label}
                                                value={newItemData[col.key] || ''}
                                                onChange={(e) => setNewItemData(prev => ({ ...prev, [col.key]: col.type === 'number' ? (e.target.value === '' ? '' : Number(e.target.value)) : e.target.value }))}
                                                className="h-8 bg-white"
                                            />
                                        </TableCell>
                                    ))}
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-1">
                                            <Button size="sm" onClick={handleAddItem} disabled={isSubmitting} className="h-8 w-8 p-0 bg-emerald-600 hover:bg-emerald-700">
                                                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                                            </Button>
                                            <Button size="sm" variant="ghost" onClick={() => setIsAdding(false)} className="h-8 w-8 p-0">
                                                <X className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={columns.length + 1} className="p-2">
                                        <Button
                                            variant="ghost"
                                            className="w-full justify-start text-muted-foreground hover:text-primary h-8 text-sm font-medium border border-dashed border-border/50 hover:border-primary/30 hover:bg-primary/5"
                                            onClick={() => {
                                                setIsAdding(true);
                                                setNewItemData(columns.reduce((acc, col) => ({ ...acc, [col.key]: col.defaultValue ?? '' }), {}));
                                            }}
                                        >
                                            <PlusCircle className="mr-2 h-4 w-4" />
                                            Шинэ бичлэг нэмэх
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            )}

                            {isLoading && (
                                <TableRow>
                                    <TableCell colSpan={columns.length + 1} className="h-24 text-center">
                                        <div className="flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                                    </TableCell>
                                </TableRow>
                            )}

                            {sortedItems?.map(item => {
                                const inUse = isItemInUse(item.id);
                                const usageCount = usageCounts[item.id] || 0;
                                
                                return (
                                <TableRow key={item.id} className="group transition-colors">
                                    {editingId === item.id ? (
                                        <>
                                            {columns.map((col, colIndex) => (
                                                <TableCell key={`${col.key}-${colIndex}`}>
                                                    <Input
                                                        type={col.type}
                                                        value={editItemData[col.key] ?? ''}
                                                        onChange={(e) => setEditItemData(prev => ({ ...prev, [col.key]: col.type === 'number' ? (e.target.value === '' ? '' : Number(e.target.value)) : e.target.value }))}
                                                        className="h-8"
                                                    />
                                                </TableCell>
                                            ))}
                                            <TableCell className="text-right">
                                                <div className="flex justify-end gap-1">
                                                    <Button size="sm" onClick={() => handleUpdateItem(item.id)} disabled={isSubmitting} className="h-8 w-8 p-0 bg-emerald-600 hover:bg-emerald-700">
                                                        {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                                                    </Button>
                                                    <Button size="sm" variant="ghost" onClick={() => setEditingId(null)} className="h-8 w-8 p-0">
                                                        <X className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </>
                                    ) : (
                                        <>
                                            {columns.map((col, colIdx) => (
                                                <TableCell key={`${col.key}-${colIdx}`} className="font-medium">
                                                    <div className="flex items-center gap-2">
                                                        {item[col.key]}
                                                        {/* Show usage badge on first column */}
                                                        {colIdx === 0 && referenceCheck && inUse && (
                                                            <TooltipProvider>
                                                                <Tooltip>
                                                                    <TooltipTrigger asChild>
                                                                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5 bg-blue-50 text-blue-600 border-blue-200 gap-1">
                                                                            <Link2 className="h-3 w-3" />
                                                                            {usageCount}
                                                                        </Badge>
                                                                    </TooltipTrigger>
                                                                    <TooltipContent>
                                                                        <p>{usageCount} {referenceCheck.label}-д ашиглагдаж байна</p>
                                                                    </TooltipContent>
                                                                </Tooltip>
                                                            </TooltipProvider>
                                                        )}
                                                    </div>
                                                </TableCell>
                                            ))}
                                            <TableCell className="text-right">
                                                <div className="flex justify-end gap-1 opacity-10 md:opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <Button size="sm" variant="ghost" onClick={() => startEdit(item)} className="h-8 w-8 p-0 text-muted-foreground hover:text-primary">
                                                        <Pencil className="h-4 w-4" />
                                                    </Button>
                                                    {referenceCheck && inUse ? (
                                                        <TooltipProvider>
                                                            <Tooltip>
                                                                <TooltipTrigger asChild>
                                                                    <span>
                                                                        <Button 
                                                                            size="sm" 
                                                                            variant="ghost" 
                                                                            disabled 
                                                                            className="h-8 w-8 p-0 text-muted-foreground/30 cursor-not-allowed"
                                                                        >
                                                                            <Shield className="h-4 w-4" />
                                                                        </Button>
                                                                    </span>
                                                                </TooltipTrigger>
                                                                <TooltipContent side="left" className="max-w-[200px]">
                                                                    <p className="text-xs">
                                                                        {usageCount} {referenceCheck.label}-д ашиглагдаж байгаа тул устгах боломжгүй. 
                                                                        Засах боломжтой.
                                                                    </p>
                                                                </TooltipContent>
                                                            </Tooltip>
                                                        </TooltipProvider>
                                                    ) : (
                                                        <Button 
                                                            size="sm" 
                                                            variant="ghost" 
                                                            onClick={() => handleDeleteItem(item.id, item.name)} 
                                                            className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    )}
                                                </div>
                                            </TableCell>
                                        </>
                                    )}
                                </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>

        {/* AI Generation Confirmation Dialog */}
        <AlertDialog open={showAIConfirmDialog} onOpenChange={setShowAIConfirmDialog}>
            <AlertDialogContent className="max-w-2xl">
                <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-violet-600" />
                        AI-р үүсгэсэн өгөгдөл
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                        Дараах {generatedItems.length} бичлэг нэмэгдэх болно. Шалгаад баталгаажуулна уу.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                
                <div className="max-h-[300px] overflow-y-auto border rounded-lg">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-muted/50">
                                {columns.map((col, colIndex) => (
                                    <TableHead key={`${col.key}-${colIndex}`}>{col.label}</TableHead>
                                ))}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {generatedItems.map((item, idx) => (
                                <TableRow key={idx}>
                                    {columns.map((col, colIndex) => (
                                        <TableCell key={`${col.key}-${colIndex}`}>{item[col.key]}</TableCell>
                                    ))}
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>

                {items && items.length > 0 && (
                    <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm">
                        <AlertCircle className="h-4 w-4 flex-shrink-0" />
                        <span>Анхааруулга: Одоо байгаа {items.length} бичлэг хэвээр үлдэнэ. Шинээр нэмэгдэх болно.</span>
                    </div>
                )}

                <AlertDialogFooter>
                    <AlertDialogCancel disabled={isSubmitting}>Болих</AlertDialogCancel>
                    <AlertDialogAction
                        onClick={handleConfirmAIItems}
                        disabled={isSubmitting}
                        className="bg-violet-600 hover:bg-violet-700"
                    >
                        {isSubmitting ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                            <Check className="h-4 w-4 mr-2" />
                        )}
                        Нэмэх ({generatedItems.length})
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
        </>
    );
}
