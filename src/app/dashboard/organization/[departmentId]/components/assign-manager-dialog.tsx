'use client';

import React, { useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Search, Crown, Loader2, Check, Briefcase } from 'lucide-react';
import { useFirebase, useCollection, updateDocumentNonBlocking, useMemoFirebase, tenantCollection, useTenantWrite } from '@/firebase';
import { query, where } from 'firebase/firestore';
import { Position, Department, PositionLevel } from '@/app/dashboard/organization/types';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface AssignManagerDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    department: Department;
}

export const AssignManagerDialog = ({ open, onOpenChange, department }: AssignManagerDialogProps) => {
    const { firestore } = useFirebase();
    const { tDoc } = useTenantWrite();
    const { toast } = useToast();
    const [searchTerm, setSearchTerm] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [selectedPositionId, setSelectedPositionId] = useState<string | null>(department.managerPositionId || null);

    // 1. Fetch positions for THIS department
    const positionsQuery = useMemoFirebase(({ firestore, companyPath }) => {
        if (!firestore || !department?.id) return null;
        return query(tenantCollection(firestore, companyPath, 'positions'), where('departmentId', '==', department.id));
    }, [firestore, department?.id]);

    const levelsQuery = useMemoFirebase(({ firestore, companyPath }) => (firestore ? tenantCollection(firestore, companyPath, 'positionLevels') : null), [firestore]);

    const { data: positions, isLoading } = useCollection<Position>(positionsQuery);
    const { data: levels } = useCollection<PositionLevel>(levelsQuery);

    const levelMap = levels?.reduce((acc, l) => { acc[l.id] = l.name; return acc; }, {} as Record<string, string>) || {};

    const filteredPositions = positions?.filter(pos => {
        const title = pos.title.toLowerCase();
        const search = searchTerm.toLowerCase();
        return title.includes(search);
    }) || [];

    const handleAssign = async () => {
        if (!firestore || !selectedPositionId) return;

        setIsSubmitting(true);
        try {
            const docRef = tDoc('departments', department.id);
            await updateDocumentNonBlocking(docRef, {
                managerPositionId: selectedPositionId
            });

            toast({
                title: 'Амжилттай тохирууллаа',
                description: 'Нэгжийн толгой албан тушаал шинэчлэгдлээ.',
            });
            onOpenChange(false);
        } catch (error) {
            console.error("Error assigning manager position:", error);
            toast({
                title: 'Алдаа гарлаа',
                description: 'Албан тушаал тохируулахад алдаа гарлаа.',
                variant: 'destructive',
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[450px] p-0 overflow-hidden gap-0">
                <DialogHeader className="p-6 pb-2">
                    <DialogTitle className="flex items-center gap-2">
                        <Crown className="w-5 h-5 text-amber-500" />
                        Толгой албан тушаал тохируулах
                    </DialogTitle>
                    <DialogDescription>
                        {department.name} нэгжийг удирдах, хамгийн дээд шатны албан тушаалыг сонгоно уу.
                    </DialogDescription>
                </DialogHeader>

                <div className="px-6 py-4 border-b border-border/50">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Албан тушаалын нэрээр хайх..."
                            className="pl-9 bg-muted/30"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                <ScrollArea className="h-[350px] px-6">
                    <div className="py-2 space-y-1">
                        {isLoading ? (
                            <div className="flex flex-col gap-2 py-4">
                                {[1, 2, 3].map(i => (
                                    <div key={i} className="flex items-center gap-3 p-3">
                                        <div className="w-10 h-10 rounded-lg bg-muted animate-pulse" />
                                        <div className="space-y-2 flex-1">
                                            <div className="h-3 w-1/2 bg-muted animate-pulse rounded" />
                                            <div className="h-2 w-1/3 bg-muted animate-pulse rounded" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : filteredPositions.length > 0 ? (
                            filteredPositions.map(pos => (
                                <div
                                    key={pos.id}
                                    onClick={() => setSelectedPositionId(pos.id)}
                                    className={cn(
                                        "flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all border border-transparent",
                                        selectedPositionId === pos.id
                                            ? "bg-primary/5 border-primary/20 shadow-sm"
                                            : "hover:bg-muted/50"
                                    )}
                                >
                                    <div className={cn(
                                        "w-10 h-10 rounded-lg flex items-center justify-center border transition-colors",
                                        selectedPositionId === pos.id ? "bg-primary/10 border-primary/30 text-primary" : "bg-muted/50 border-border/50 text-muted-foreground"
                                    )}>
                                        <Briefcase className="w-5 h-5" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-semibold text-sm truncate leading-none">
                                            {pos.title}
                                        </p>
                                        <div className="flex items-center gap-2 mt-1.5">
                                            <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 font-medium opacity-70">
                                                {levelMap[pos.levelId || ''] || 'Түвшин -'}
                                            </Badge>
                                            <span className="text-[10px] text-muted-foreground font-medium">
                                                • {pos.filled || 0} ажилтантай
                                            </span>
                                        </div>
                                    </div>
                                    {selectedPositionId === pos.id && (
                                        <div className="h-6 w-6 rounded-full bg-primary flex items-center justify-center text-primary-foreground animate-in zoom-in-50 duration-200">
                                            <Check className="h-3.5 w-3.5 stroke-[3]" />
                                        </div>
                                    )}
                                </div>
                            ))
                        ) : (
                            <div className="py-12 text-center text-muted-foreground">
                                <Search className="h-8 w-8 mx-auto mb-2 opacity-20" />
                                <p className="text-sm">Албан тушаал олдсонгүй</p>
                            </div>
                        )}
                    </div>
                </ScrollArea>

                <DialogFooter className="p-6 bg-muted/20 border-t border-border/50">
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
                        Цуцлах
                    </Button>
                    <Button
                        onClick={handleAssign}
                        disabled={!selectedPositionId || isSubmitting}
                        className="px-8 shadow-lg shadow-primary/20"
                    >
                        {isSubmitting ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                            <Crown className="h-4 w-4 mr-2" />
                        )}
                        Тохируулах
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
