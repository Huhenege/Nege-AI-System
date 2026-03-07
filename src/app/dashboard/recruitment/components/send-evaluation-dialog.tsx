'use client';

import React, { useState, useEffect } from 'react';
import { useFirebase, useTenantWrite } from '@/firebase';
import { getDocs, addDoc, query, where } from 'firebase/firestore';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Loader2, Search, Send, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import type { EvaluationRequest } from '@/types/recruitment';

interface Employee {
    id: string;
    firstName: string;
    lastName: string;
    email?: string;
    photoURL?: string;
    jobTitle?: string;
    status: string;
}

interface SendEvaluationDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    applicationId: string;
    candidateId: string;
    candidateName: string;
    vacancyTitle?: string;
    stageId: string;
    requestedByUid: string;
    requestedByName: string;
    /** Сонгон шалгаруулалтад оролцогчид (vacancy.participantIds). Дамжуулагдсан бол зөвхөн эдгээр ажилтнуудаас сонгоно. */
    participantIds?: string[];
}

export function SendEvaluationDialog({
    open, onOpenChange,
    applicationId, candidateId, candidateName, vacancyTitle,
    stageId, requestedByUid, requestedByName,
    participantIds = [],
}: SendEvaluationDialogProps) {
    const { firestore } = useFirebase();
    const { tCollection } = useTenantWrite();
    const { toast } = useToast();
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [loading, setLoading] = useState(false);
    const [sending, setSending] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [searchQuery, setSearchQuery] = useState('');
    const [alreadySent, setAlreadySent] = useState<Map<string, 'pending' | 'completed'>>(new Map());

    useEffect(() => {
        if (!open || !firestore) return;
        const fetchData = async () => {
            setLoading(true);
            try {
                const empSnap = await getDocs(tCollection('employees'));
                let emps = empSnap.docs
                    .map(d => ({ id: d.id, ...d.data() } as Employee))
                    .filter(e => e.id !== requestedByUid && e.status !== 'terminated');
                if (participantIds.length > 0) {
                    emps = emps.filter(e => participantIds.includes(e.id));
                }
                setEmployees(emps);

                const reqQuery = query(
                    tCollection('evaluation_requests'),
                    where('applicationId', '==', applicationId),
                );
                const reqSnap = await getDocs(reqQuery);
                const sent = new Map<string, 'pending' | 'completed'>();
                reqSnap.docs.forEach(d => {
                    const data = d.data();
                    if (data.status === 'pending' || data.status === 'completed') {
                        const existing = sent.get(data.assignedTo);
                        if (data.status === 'completed' || !existing) {
                            sent.set(data.assignedTo, data.status);
                        }
                    }
                });
                setAlreadySent(sent);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
        setSelectedIds(new Set());
        setSearchQuery('');
    }, [open, firestore, applicationId, stageId, requestedByUid, participantIds]);

    const toggleSelect = (id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const filtered = employees.filter(e => {
        const q = searchQuery.toLowerCase();
        if (!q) return true;
        return (
            e.firstName?.toLowerCase().includes(q) ||
            e.lastName?.toLowerCase().includes(q) ||
            e.email?.toLowerCase().includes(q) ||
            e.jobTitle?.toLowerCase().includes(q)
        );
    });

    const handleSend = async () => {
        if (!firestore || selectedIds.size === 0) return;
        setSending(true);
        try {
            const selectedEmps = Array.from(selectedIds).map(id => employees.find(e => e.id === id)).filter(Boolean);
            const promises = selectedEmps.map(emp => {
                if (!emp) return Promise.resolve();
                const reqData: Omit<EvaluationRequest, 'id'> = {
                    applicationId,
                    candidateId,
                    candidateName,
                    vacancyTitle,
                    stageId,
                    requestedBy: requestedByUid,
                    requestedByName,
                    assignedTo: emp.id,
                    assignedToName: `${emp.lastName || ''} ${emp.firstName || ''}`.trim(),
                    assignedToEmail: emp.email || '',
                    status: 'pending',
                    createdAt: new Date().toISOString(),
                };
                return addDoc(tCollection('evaluation_requests'), reqData);
            });
            await Promise.all(promises);

            const names = selectedEmps.map(e => `${e!.lastName} ${e!.firstName}`).join(', ');
            await addDoc(tCollection('application_events'), {
                applicationId,
                type: 'EVALUATION_REQUESTED',
                stageId,
                userId: requestedByUid,
                userName: requestedByName,
                title: 'Үнэлгээний хүсэлт илгээсэн',
                description: `${names} ажилтнуудад үнэлгээ илгээлээ`,
                data: { assignedToIds: Array.from(selectedIds) },
                createdAt: new Date().toISOString(),
            });

            toast({
                title: 'Үнэлгээний хүсэлт илгээгдлээ',
                description: `${selectedIds.size} ажилтанд илгээлээ.`,
            });
            onOpenChange(false);
        } catch (err: any) {
            toast({ title: 'Алдаа', description: err.message, variant: 'destructive' });
        } finally {
            setSending(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Үнэлгээ илгээх</DialogTitle>
                    <DialogDescription>
                        {participantIds.length > 0
                            ? `${candidateName} горилогчийн үнэлгээг бөглөх ажилтнуудыг сонгоно уу. Зөвхөн энэ ажлын байрны сонгон шалгаруулалтад оролцогчид харагдана.`
                            : `${candidateName} горилогчийн үнэлгээг бөглөх ажилтнуудыг сонгоно уу.`}
                    </DialogDescription>
                </DialogHeader>

                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                        placeholder="Ажилтан хайх..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="pl-9"
                    />
                </div>

                <div className="max-h-[300px] overflow-y-auto space-y-1 -mx-1 px-1">
                    {loading ? (
                        <div className="flex items-center justify-center py-10">
                            <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
                        </div>
                    ) : filtered.length === 0 ? (
                        <p className="text-sm text-slate-400 text-center py-8">
                            {participantIds.length > 0
                                ? 'Энэ ажлын байранд сонгон шалгаруулалтад оролцогч тохируулаагүй эсвэл ажилтан олдсонгүй. Ажлын байрны хуудаснаас оролцогч нэмнэ үү.'
                                : 'Ажилтан олдсонгүй'}
                        </p>
                    ) : (
                        filtered.map(emp => {
                            const isSelected = selectedIds.has(emp.id);
                            const sentStatus = alreadySent.get(emp.id);
                            const isDisabled = !!sentStatus;

                            return (
                                <div
                                    key={emp.id}
                                    onClick={() => !isDisabled && toggleSelect(emp.id)}
                                    className={cn(
                                        "flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-all border",
                                        isDisabled ? "opacity-50 cursor-not-allowed border-transparent" :
                                            isSelected ? "bg-blue-50 border-blue-200" : "border-transparent hover:bg-slate-50"
                                    )}
                                >
                                    <div className={cn(
                                        "h-5 w-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors",
                                        isDisabled
                                            ? sentStatus === 'completed' ? "bg-green-500 border-green-500" : "bg-slate-300 border-slate-300"
                                            : isSelected ? "bg-blue-600 border-blue-600" : "border-slate-300"
                                    )}>
                                        {(isSelected || isDisabled) && <Check className="h-3 w-3 text-white" />}
                                    </div>
                                    <Avatar className="h-8 w-8">
                                        <AvatarImage src={emp.photoURL} />
                                        <AvatarFallback className="text-[10px]">{emp.firstName?.[0]}</AvatarFallback>
                                    </Avatar>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-slate-900 truncate">{emp.lastName} {emp.firstName}</p>
                                        <p className="text-[11px] text-slate-400 truncate">{emp.jobTitle || emp.email}</p>
                                    </div>
                                    {sentStatus === 'pending' && <Badge variant="outline" className="text-[10px] shrink-0 border-orange-200 text-orange-600 bg-orange-50">Хүлээгдэж буй</Badge>}
                                    {sentStatus === 'completed' && <Badge variant="outline" className="text-[10px] shrink-0 border-green-200 text-green-600 bg-green-50">Бөглөсөн</Badge>}
                                </div>
                            );
                        })
                    )}
                </div>

                <div className="flex items-center justify-between pt-2 border-t">
                    <span className="text-xs text-slate-400">
                        {selectedIds.size > 0 ? `${selectedIds.size} сонгосон` : 'Ажилтан сонгоно уу'}
                    </span>
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Болих</Button>
                        <Button size="sm" onClick={handleSend} disabled={sending || selectedIds.size === 0} className="bg-blue-600 hover:bg-blue-700 gap-1.5">
                            {sending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                            Илгээх
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
