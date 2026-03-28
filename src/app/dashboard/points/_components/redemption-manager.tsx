'use client';

import { useState, useMemo } from 'react';
import { useFetchCollection, useTenantWrite } from '@/firebase';
import { query, orderBy, updateDoc, serverTimestamp } from 'firebase/firestore';
import { RedemptionRequest, RedemptionStatus } from '@/types/points';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle,
    DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
    CheckCircle2, XCircle, Clock, PackageCheck,
    ShoppingBag, Loader2, AlertCircle, Filter,
} from 'lucide-react';
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

// ─── Types ───────────────────────────────────────────────────────────────────

interface RedemptionWithEmployee extends RedemptionRequest {
    employeeName?: string;
}

// ─── Status helpers ───────────────────────────────────────────────────────────

const STATUS_MAP: Record<RedemptionStatus, { label: string; icon: React.ReactNode; variant: 'secondary' | 'default' | 'outline' | 'destructive'; color: string }> = {
    PENDING:   { label: 'Хүлээгдэж буй', icon: <Clock className="w-3 h-3" />,       variant: 'secondary',    color: 'border-l-blue-500' },
    APPROVED:  { label: 'Батлагдсан',    icon: <CheckCircle2 className="w-3 h-3" />, variant: 'default',      color: 'border-l-emerald-500' },
    FULFILLED: { label: 'Гүйцэтгэгдсэн', icon: <PackageCheck className="w-3 h-3" />, variant: 'default',     color: 'border-l-purple-500' },
    REJECTED:  { label: 'Татгалзсан',    icon: <XCircle className="w-3 h-3" />,      variant: 'destructive',  color: 'border-l-slate-300' },
};

// ─── Main Component ───────────────────────────────────────────────────────────

export function RedemptionManager() {
    const { firestore, companyPath, tDoc, tCollection } = useTenantWrite();
    const [statusFilter, setStatusFilter] = useState<RedemptionStatus | 'ALL'>('ALL');

    const requestsQuery = useMemo(() =>
        (firestore && companyPath)
            ? query(tCollection('redemption_requests'), orderBy('createdAt', 'desc'))
            : null
        , [firestore, companyPath, tCollection]);

    const { data: requests, isLoading } = useFetchCollection<RedemptionRequest>(requestsQuery);

    // Ажилтны нэрийг employee collection-оос татна
    const employeesQuery = useMemo(() =>
        (firestore && companyPath) ? tCollection('employees') : null
        , [firestore, companyPath, tCollection]);
    const { data: employees } = useFetchCollection<{ id: string; firstName?: string; lastName?: string }>(employeesQuery);

    const empMap = useMemo(() => {
        const m = new Map<string, string>();
        (employees || []).forEach(e =>
            m.set(e.id, [e.firstName, e.lastName].filter(Boolean).join(' ').trim() || e.id)
        );
        return m;
    }, [employees]);

    const filtered = useMemo(() => {
        if (!requests) return [];
        if (statusFilter === 'ALL') return requests;
        return requests.filter(r => r.status === statusFilter);
    }, [requests, statusFilter]);

    const counts = useMemo(() => ({
        ALL: requests?.length || 0,
        PENDING: requests?.filter(r => r.status === 'PENDING').length || 0,
        APPROVED: requests?.filter(r => r.status === 'APPROVED').length || 0,
        FULFILLED: requests?.filter(r => r.status === 'FULFILLED').length || 0,
        REJECTED: requests?.filter(r => r.status === 'REJECTED').length || 0,
    }), [requests]);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-16">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    if (!requests || requests.length === 0) {
        return (
            <div className="text-center py-20 bg-muted/20 border-2 border-dashed rounded-3xl">
                <ShoppingBag className="w-12 h-12 mx-auto mb-4 opacity-10" />
                <p className="text-muted-foreground font-medium">Одоогоор захиалга ирээгүй байна.</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Ажилтнууд дэлгүүрээс бараа захиалахад энд харагдана.</p>
            </div>
        );
    }

    return (
        <div className="space-y-5">
            {/* Header + Filter */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h3 className="text-lg font-semibold">Худалдан авалтын хүсэлтүүд</h3>
                    <p className="text-sm text-muted-foreground">Нийт {counts.ALL} захиалга — {counts.PENDING} хүлээгдэж байна</p>
                </div>

                <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-muted-foreground" />
                    <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as RedemptionStatus | 'ALL')}>
                        <SelectTrigger className="w-44 h-9">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="ALL">Бүгд ({counts.ALL})</SelectItem>
                            <SelectItem value="PENDING">Хүлээгдэж буй ({counts.PENDING})</SelectItem>
                            <SelectItem value="APPROVED">Батлагдсан ({counts.APPROVED})</SelectItem>
                            <SelectItem value="FULFILLED">Гүйцэтгэгдсэн ({counts.FULFILLED})</SelectItem>
                            <SelectItem value="REJECTED">Татгалзсан ({counts.REJECTED})</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {(['PENDING', 'APPROVED', 'FULFILLED', 'REJECTED'] as RedemptionStatus[]).map(s => (
                    <button
                        key={s}
                        onClick={() => setStatusFilter(statusFilter === s ? 'ALL' : s)}
                        className={`rounded-xl border p-3 text-left transition-colors ${statusFilter === s ? 'bg-primary/5 border-primary/30' : 'bg-white hover:bg-slate-50'}`}
                    >
                        <p className="text-xl font-bold">{counts[s]}</p>
                        <p className="text-xs text-muted-foreground">{STATUS_MAP[s].label}</p>
                    </button>
                ))}
            </div>

            {/* List */}
            {filtered.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground text-sm border-2 border-dashed rounded-2xl">
                    Энэ төлөвт захиалга байхгүй.
                </div>
            ) : (
                <div className="space-y-3">
                    {filtered.map(req => (
                        <RedemptionCard
                            key={req.id}
                            request={req}
                            employeeName={empMap.get(req.userId) || req.userId}
                            tDoc={tDoc}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

// ─── Card ─────────────────────────────────────────────────────────────────────

function RedemptionCard({
    request,
    employeeName,
    tDoc,
}: {
    request: RedemptionRequest;
    employeeName: string;
    tDoc: (...segments: string[]) => ReturnType<ReturnType<typeof useTenantWrite>['tDoc']>;
}) {
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);
    const [note, setNote] = useState(request.note || '');
    const [isActionOpen, setIsActionOpen] = useState(false);
    const [pendingStatus, setPendingStatus] = useState<RedemptionStatus | null>(null);

    const statusInfo = STATUS_MAP[request.status];
    const isPending = request.status === 'PENDING';
    const isApproved = request.status === 'APPROVED';

    const createdAt = request.createdAt
        ? (() => { try { return typeof (request.createdAt as any).toDate === 'function' ? (request.createdAt as any).toDate() : new Date(request.createdAt); } catch { return null; } })()
        : null;

    const openAction = (status: RedemptionStatus) => {
        setPendingStatus(status);
        setNote('');
        setIsActionOpen(true);
    };

    const handleConfirm = async () => {
        if (!pendingStatus) return;
        setLoading(true);
        try {
            const ref = tDoc('redemption_requests', request.id);
            await updateDoc(ref, {
                status: pendingStatus,
                note: note || null,
                updatedAt: serverTimestamp(),
            });
            toast({
                title: pendingStatus === 'REJECTED' ? 'Татгалзлаа' :
                       pendingStatus === 'APPROVED' ? 'Батлагдлаа' : 'Гүйцэтгэгдлээ',
                description: pendingStatus === 'FULFILLED'
                    ? 'Ажилтанд бараа хүргэгдсэнийг баталлаа.'
                    : undefined,
            });
            setIsActionOpen(false);
        } catch (e: any) {
            toast({ title: 'Алдаа гарлаа', description: e.message, variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    const actionLabel: Record<RedemptionStatus, string> = {
        APPROVED:  'Батлах',
        FULFILLED: 'Гүйцэтгэгдсэн болгох',
        REJECTED:  'Татгалзах',
        PENDING:   '',
    };

    return (
        <>
            <Card className={`overflow-hidden border-l-4 ${statusInfo.color} ${request.status === 'REJECTED' ? 'opacity-70' : ''}`}>
                <CardContent className="p-5">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                        {/* Left: employee + reward info */}
                        <div className="flex items-start gap-4 flex-1 min-w-0">
                            {/* Avatar */}
                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary shrink-0">
                                {employeeName.charAt(0).toUpperCase()}
                            </div>

                            <div className="min-w-0">
                                <p className="font-semibold text-sm">{employeeName}</p>
                                <p className="text-xs text-muted-foreground">
                                    {createdAt ? format(createdAt, 'yyyy.MM.dd HH:mm') : '—'}
                                </p>

                                {/* Reward snapshot */}
                                <div className="mt-3 flex items-center gap-3 bg-slate-50 rounded-xl px-3 py-2.5 border border-slate-100">
                                    <ShoppingBag className="w-4 h-4 text-slate-400 shrink-0" />
                                    <div className="min-w-0">
                                        <p className="font-medium text-sm truncate">{request.rewardSnapshot.title}</p>
                                        <p className="text-xs text-primary font-semibold">{request.rewardSnapshot.cost.toLocaleString()} оноо</p>
                                    </div>
                                </div>

                                {/* Admin note */}
                                {request.note && (
                                    <div className="mt-2 text-xs text-muted-foreground bg-muted/30 px-3 py-2 rounded-lg border border-dashed">
                                        <span className="font-semibold">Тэмдэглэл: </span>{request.note}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Right: status + actions */}
                        <div className="flex flex-col items-end gap-2 shrink-0">
                            <Badge variant={statusInfo.variant} className="gap-1">
                                {statusInfo.icon}
                                {statusInfo.label}
                            </Badge>

                            {/* PENDING → батлах эсвэл татгалзах */}
                            {isPending && (
                                <div className="flex gap-2 mt-1">
                                    <Button size="sm" className="gap-1.5 h-8" onClick={() => openAction('APPROVED')}>
                                        <CheckCircle2 className="w-3.5 h-3.5" /> Батлах
                                    </Button>
                                    <Button size="sm" variant="outline" className="gap-1.5 h-8 text-destructive hover:text-destructive" onClick={() => openAction('REJECTED')}>
                                        <XCircle className="w-3.5 h-3.5" /> Татгалзах
                                    </Button>
                                </div>
                            )}

                            {/* APPROVED → гүйцэтгэгдсэн болгох */}
                            {isApproved && (
                                <Button size="sm" variant="outline" className="gap-1.5 h-8 mt-1" onClick={() => openAction('FULFILLED')}>
                                    <PackageCheck className="w-3.5 h-3.5" /> Хүргэсэн
                                </Button>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Confirm Dialog */}
            <Dialog open={isActionOpen} onOpenChange={setIsActionOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            {pendingStatus === 'APPROVED'  && 'Захиалга батлах'}
                            {pendingStatus === 'REJECTED'  && 'Захиалга татгалзах'}
                            {pendingStatus === 'FULFILLED' && 'Хүргэлт баталгаажуулах'}
                        </DialogTitle>
                        <DialogDescription>
                            {pendingStatus === 'APPROVED'  && `"${request.rewardSnapshot.title}" захиалгыг батлах уу?`}
                            {pendingStatus === 'REJECTED'  && 'Татгалзаж буй шалтгаанаа бичнэ үү.'}
                            {pendingStatus === 'FULFILLED' && `Ажилтанд "${request.rewardSnapshot.title}" хүргэгдсэнийг баталгаажуулна уу.`}
                        </DialogDescription>
                    </DialogHeader>

                    {/* Reward preview */}
                    <div className="flex items-center gap-3 bg-slate-50 rounded-xl p-3 border">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary">
                            {employeeName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <p className="font-medium text-sm">{employeeName}</p>
                            <p className="text-xs text-muted-foreground">{request.rewardSnapshot.title} — {request.rewardSnapshot.cost.toLocaleString()} оноо</p>
                        </div>
                    </div>

                    {/* Note */}
                    <div className="space-y-2">
                        <Label>Тэмдэглэл {pendingStatus !== 'REJECTED' && <span className="text-muted-foreground text-xs">(заавал биш)</span>}</Label>
                        <Textarea
                            placeholder={
                                pendingStatus === 'REJECTED'  ? 'Жишээ: Энэ бараа дууссан байна...' :
                                pendingStatus === 'FULFILLED' ? 'Жишээ: Купон имэйлээр илгээлээ...' :
                                'Ажилтанд харагдах нэмэлт мэдээлэл...'
                            }
                            value={note}
                            onChange={e => setNote(e.target.value)}
                            rows={3}
                        />
                    </div>

                    {pendingStatus === 'REJECTED' && (
                        <div className="flex gap-2 p-3 bg-red-50 rounded-lg text-xs text-red-600 border border-red-100">
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            <span>Татгалзсан тохиолдолд ажилтны оноо буцааж олгогдохгүй. Оноог гараар тохируулах шаардлагатай.</span>
                        </div>
                    )}

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsActionOpen(false)}>Цуцлах</Button>
                        <Button
                            variant={pendingStatus === 'REJECTED' ? 'destructive' : 'default'}
                            onClick={handleConfirm}
                            disabled={loading}
                        >
                            {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                            {pendingStatus ? actionLabel[pendingStatus] : 'Баталгаажуулах'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
