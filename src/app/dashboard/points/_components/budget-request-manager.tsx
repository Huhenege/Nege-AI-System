'use client';

import { useState, useMemo, useEffect } from 'react';
import { useFetchCollection, useFirestore, tenantCollection, tenantDoc, useTenantWrite } from '@/firebase';
import { query, orderBy, where, getDoc } from 'firebase/firestore';
import { BudgetPointRequest, CoreValue } from '@/types/points';
import { Position } from '@/app/dashboard/organization/types';
import { PointsService } from '@/lib/points/points-service';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { Loader2, CheckCircle2, XCircle, Clock, Search, AlertCircle, TrendingDown, Target } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';

export function BudgetRequestManager() {
    const { firestore, companyPath } = useTenantWrite();
    const { toast } = useToast();
    const [processingId, setProcessingId] = useState<string | null>(null);

    const requestsQuery = useMemo(() =>
        (firestore && companyPath) ? query(tenantCollection(firestore, companyPath, 'budget_point_requests'), orderBy('createdAt', 'desc')) : null
        , [firestore, companyPath]);

    const { data: requests, isLoading } = useFetchCollection<BudgetPointRequest>(requestsQuery);

    if (isLoading) return <div className="text-center py-10"><Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" /></div>;

    if (!requests || requests.length === 0) {
        return (
            <div className="text-center py-20 bg-muted/20 border-2 border-dashed rounded-3xl">
                <Target className="w-12 h-12 mx-auto mb-4 opacity-10" />
                <p className="text-muted-foreground font-medium">Одоогоор төсвийн хүсэлт байхгүй байна.</p>
            </div>
        );
    }

    return (
        <div className="grid gap-6">
            {requests.map((request) => (
                <RequestCard
                    key={request.id}
                    request={request}
                    onStatusChange={() => { }} // useCollection will auto-update
                />
            ))}
        </div>
    );
}

function RequestCard({ request }: { request: BudgetPointRequest, onStatusChange: () => void }) {
    const { firestore, companyPath, tDoc } = useTenantWrite();
    const { toast } = useToast();
    const [isApproveOpen, setIsApproveOpen] = useState(false);
    const [isRejectOpen, setIsRejectOpen] = useState(false);
    const [loading, setLoading] = useState(false);

    // Adjusted amount state
    const [adjAmount, setAdjAmount] = useState(request.amount);
    const [adminNote, setAdminNote] = useState('');

    const [sender, setSender] = useState<any>(null);
    const [receivers, setReceivers] = useState<any[]>([]);
    const [position, setPosition] = useState<Position | null>(null);
    const [coreValue, setCoreValue] = useState<CoreValue | null>(null);

    useEffect(() => {
        if (!firestore || !companyPath) return;

        // Fetch Sender
        getDoc(tDoc('employees', request.fromUserId)).then(s => setSender(s.data()));

        // Fetch Position
        getDoc(tDoc('positions', request.positionId)).then(p => setPosition({ id: p.id, ...p.data() } as Position));

        // Fetch Receivers
        Promise.all(request.toUserIds.map(id => getDoc(tDoc('employees', id)))).then(snaps => {
            setReceivers(snaps.map(s => s.data()));
        });

        // Fetch Value — tenant-scoped values collection
        getDoc(tDoc('values', request.valueId)).then(v => setCoreValue(v.data() as CoreValue));
    }, [firestore, companyPath, request.fromUserId, request.positionId, request.toUserIds, request.valueId]);

    const handleApprove = async () => {
        if (!firestore || !companyPath) return;
        setLoading(true);
        try {
            await PointsService.approveBudgetRequest(firestore, companyPath, request.id, adjAmount, adminNote);
            toast({ title: 'Хүсэлт батлагдлаа', description: 'Оноо амжилттай шилжиж, сошил дээр нийтлэгдлээ.' });
            setIsApproveOpen(false);
        } catch (e: any) {
            toast({ title: 'Алдаа гарлаа', description: e.message, variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    const handleReject = async () => {
        if (!firestore || !companyPath) return;
        setLoading(true);
        try {
            await PointsService.rejectBudgetRequest(firestore, companyPath, request.id, adminNote);
            toast({ title: 'Хүсэлт цуцлагдлаа' });
            setIsRejectOpen(false);
        } catch (e: any) {
            toast({ title: 'Алдаа гарлаа', description: e.message, variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    const totalRequested = request.amount * request.toUserIds.length;
    const totalAdjusted = adjAmount * request.toUserIds.length;

    return (
        <Card className={`overflow-hidden border-l-4 ${request.status === 'PENDING' ? 'border-l-blue-500' :
                request.status === 'APPROVED' ? 'border-l-green-500' : 'border-l-slate-300 opacity-80'
            }`}>
            <CardHeader className="flex flex-row items-center justify-between pb-2 bg-muted/10">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                        <Target className="w-5 h-5" />
                    </div>
                    <div>
                        <CardTitle className="text-sm font-semibold">Онооны төсвийн хүсэлт</CardTitle>
                        <CardDescription className="text-[10px]">
                            {request.createdAt ? format(request.createdAt.toDate(), 'yyyy.MM.dd HH:mm') : '...'}
                        </CardDescription>
                    </div>
                </div>
                <Badge variant={
                    request.status === 'PENDING' ? 'secondary' :
                        request.status === 'APPROVED' ? 'default' : 'outline'
                } className="gap-1">
                    {request.status === 'PENDING' && <Clock className="w-3 h-3" />}
                    {request.status === 'APPROVED' && <CheckCircle2 className="w-3 h-3" />}
                    {request.status === 'REJECTED' && <XCircle className="w-3 h-3" />}
                    {request.status === 'PENDING' ? 'Хүлээгдэж буй' :
                        request.status === 'APPROVED' ? 'Батлагдсан' : 'Татгалзсан'}
                </Badge>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
                <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-3">
                        <div className="flex items-start gap-3">
                            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-semibold shrink-0">
                                {sender?.firstName?.[0] || '?'}
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground">Илгээгч</p>
                                <p className="font-semibold text-sm">{sender?.lastName} {sender?.firstName}</p>
                                <p className="text-[10px] text-slate-500">{position?.title}</p>
                            </div>
                        </div>

                        <div className="p-3 rounded-xl bg-orange-50 border border-orange-100 space-y-1">
                            <p className="text-[10px] text-orange-600 font-semibold uppercase tracking-wider">Ажлын байрны төсвийн үлдэгдэл</p>
                            <div className="flex items-baseline gap-2">
                                <span className="text-lg font-semibold text-orange-700">{(position?.remainingPointBudget ?? 0).toLocaleString()}</span>
                                <span className="text-xs text-orange-500">оноо үлдсэн</span>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <div>
                            <p className="text-xs text-muted-foreground mb-1">Хэн рүү:</p>
                            <div className="flex flex-wrap gap-1">
                                {receivers.map((r, i) => (
                                    <Badge key={i} variant="outline" className="bg-white">{r?.lastName} {r?.firstName}</Badge>
                                ))}
                            </div>
                        </div>
                        {coreValue && (
                            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium border"
                                style={{ borderColor: coreValue.color, color: coreValue.color, backgroundColor: `${coreValue.color}10` }}>
                                <span>{coreValue.emoji}</span> {coreValue.title}
                            </div>
                        )}
                    </div>
                </div>

                <div className="bg-slate-50 p-4 rounded-xl border italic text-sm text-slate-600">
                    "{request.message}"
                </div>

                <div className="flex items-center justify-between p-4 bg-primary/5 rounded-2xl border border-primary/10">
                    <div className="space-y-0.5">
                        <p className="text-xs text-muted-foreground italic">Нийт хуваарилах оноо:</p>
                        <p className="text-xl font-semibold text-primary">{(request.amount * request.toUserIds.length).toLocaleString()} <span className="text-xs opacity-60">ОНОО</span></p>
                    </div>
                    <div className="text-right">
                        <p className="text-xs text-muted-foreground">Хүн бүрт:</p>
                        <p className="font-semibold">{request.amount.toLocaleString()} ⭐</p>
                    </div>
                </div>

                {request.status === 'PENDING' && (
                    <div className="flex gap-2 pt-2">
                        <Dialog open={isApproveOpen} onOpenChange={setIsApproveOpen}>
                            <DialogTrigger asChild>
                                <Button className="flex-1 gap-2">
                                    <CheckCircle2 className="w-4 h-4" /> Батлах
                                </Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>Хүсэлт батлах</DialogTitle>
                                    <DialogDescription>
                                        Та тухайн хүсэлтийн оноог засаж батлах боломжтой.
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4 py-4">
                                    <div className="space-y-2">
                                        <Label>Нэг хүнд олгох оноо</Label>
                                        <Input
                                            type="number"
                                            value={adjAmount}
                                            onChange={e => setAdjAmount(parseInt(e.target.value) || 0)}
                                        />
                                        <p className="text-xs text-muted-foreground">
                                            Нийт хуваарилагдах: <span className="font-semibold">{(adjAmount * request.toUserIds.length).toLocaleString()}</span> оноо.
                                            (Үлдэгдэл: {position?.remainingPointBudget})
                                        </p>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Тайлбар (Заавал биш)</Label>
                                        <Textarea
                                            placeholder="Ажилтанд харагдах зөвлөгөө эсвэл батлах болсон шалтгаан..."
                                            value={adminNote}
                                            onChange={e => setAdminNote(e.target.value)}
                                        />
                                    </div>
                                    {totalAdjusted > (position?.remainingPointBudget || 0) && (
                                        <div className="flex gap-2 p-3 rounded-lg bg-red-50 text-red-600 text-xs border border-red-100">
                                            <AlertCircle className="w-4 h-4 shrink-0" />
                                            <p>Онооны хэмжээ позицийн төсвийн үлдэгдлээс хэтэрсэн байна!</p>
                                        </div>
                                    )}
                                </div>
                                <DialogFooter>
                                    <Button variant="outline" onClick={() => setIsApproveOpen(false)}>Цуцлах</Button>
                                    <Button onClick={handleApprove} disabled={loading || totalAdjusted > (position?.remainingPointBudget || 0)}>
                                        {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                                        Тийм, Баталгаажуулъя
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>

                        <Dialog open={isRejectOpen} onOpenChange={setIsRejectOpen}>
                            <DialogTrigger asChild>
                                <Button variant="outline" className="flex-1 gap-2 text-destructive hover:text-destructive">
                                    <XCircle className="w-4 h-4" /> Татгалзах
                                </Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>Хүсэлтээс татгалзах</DialogTitle>
                                    <DialogDescription>
                                        Татгалзаж буй шалтгаанаа бичвэл ажилтанд илүү ойлгомжтой байх болно.
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="space-y-2 py-4">
                                    <Label>Татгалзсан шалтгаан</Label>
                                    <Textarea
                                        placeholder="Жишээ нь: Төсвийн ашиглалт хэтэрсэн тул дараагийн сард..."
                                        value={adminNote}
                                        onChange={e => setAdminNote(e.target.value)}
                                    />
                                </div>
                                <DialogFooter>
                                    <Button variant="outline" onClick={() => setIsRejectOpen(false)}>Буцах</Button>
                                    <Button variant="destructive" onClick={handleReject} disabled={loading}>
                                        {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                                        Татгалзах
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    </div>
                )}

                {(request.status === 'APPROVED' || request.status === 'REJECTED') && request.adminNote && (
                    <div className="pt-4 border-t border-dashed">
                        <p className="text-[10px] uppercase font-semibold text-muted-foreground mb-1">Админы тэмдэглэл:</p>
                        <p className="text-sm text-slate-700 bg-muted/20 p-3 rounded-lg border border-dashed">
                            {request.adminNote}
                        </p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
