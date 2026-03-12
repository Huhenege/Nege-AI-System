'use client';

import { useState, useMemo, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useFetchCollection, useFirestore, useUser, useTenantWrite } from '@/firebase';
import { query, where, limit, orderBy, doc, getDoc } from 'firebase/firestore';
import { PointsService } from '@/lib/points/points-service';
import { Position } from '@/app/dashboard/organization/types';
import { CoreValue } from '@/types/points';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Search, Sparkles, Target } from 'lucide-react';
import { Switch } from '@/components/ui/switch';

// Form Schema
const recognitionSchema = z.object({
    recipientId: z.string().min(1, 'Ажилтнаа сонгоно уу'),
    valueId: z.string().min(1, 'Үнэт зүйлээ сонгоно уу'),
    points: z.union([z.string(), z.number()]).transform(v => typeof v === 'string' ? parseInt(v, 10) : v),
    message: z.string().min(10, 'Тайлбар дор хаяж 10 тэмдэгт байх ёстой'),
}).refine(data => {
    // We'll handle refined validation in onSubmit for more context (like remaining budget)
    return !isNaN(data.points) && data.points >= 1;
}, { message: "Хүчинтэй оноо оруулна уу", path: ["points"] });

export function GivePointsDialog({ triggerButton }: { triggerButton?: React.ReactNode }) {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const { toast } = useToast();
    const { user } = useUser();
    const firestore = useFirestore();
    const { tDoc, tCollection, companyPath } = useTenantWrite();
    const [useBudget, setUseBudget] = useState(false);
    const [myPosition, setMyPosition] = useState<Position | null>(null);

    // Load Values - use useMemo to only create query when firestore is ready
    const valuesQuery = useMemo(() => firestore ? query(tCollection('company', 'branding', 'values'), where('isActive', '==', true)) : null, [firestore, tCollection]);
    const { data: values } = useFetchCollection<CoreValue>(valuesQuery);

    // Load Employees
    const employeesQuery = useMemo(() => firestore ? query(tCollection('employees'), orderBy('firstName'), limit(50)) : null, [firestore, tCollection]);
    const { data: employees } = useFetchCollection<any>(employeesQuery);

    // Load User's Position for Budget check
    useEffect(() => {
        async function fetchPosition() {
            if (!user || !firestore) return;
            const empSnap = await getDoc(tDoc('employees', user.uid));
            if (empSnap.exists()) {
                const empData = empSnap.data();
                const posId = (empData.workInfo?.positionId) || (empData.positionId);
                if (posId) {
                    const posSnap = await getDoc(tDoc('positions', posId));
                    if (posSnap.exists()) {
                        setMyPosition({ id: posSnap.id, ...posSnap.data() } as Position);
                    }
                }
            }
        }
        fetchPosition();
    }, [user, firestore]);

    const form = useForm<z.infer<typeof recognitionSchema>>({
        resolver: zodResolver(recognitionSchema),
        defaultValues: {
            points: 10,
        }
    });

    const onSubmit = async (data: z.infer<typeof recognitionSchema>) => {
        if (!user || !firestore || !companyPath) return;
        setLoading(true);
        try {
            const amount = data.points;

            if (useBudget && myPosition) {
                const remaining = myPosition.remainingPointBudget ?? myPosition.yearlyPointBudget ?? 0;
                if (amount > remaining) {
                    toast({ title: 'Төсөв хүрэлцэхгүй', description: `Үлдэгдэл төсөв: ${remaining}`, variant: 'destructive' });
                    setLoading(false);
                    return;
                }
                if (amount < 1) {
                    toast({ title: 'Алдаа', description: 'Оноо 1-ээс бага байж болохгүй', variant: 'destructive' });
                    setLoading(false);
                    return;
                }

                await PointsService.requestBudgetPoints(
                    firestore,
                    companyPath!,
                    user.uid,
                    myPosition.id,
                    [data.recipientId],
                    amount,
                    data.valueId,
                    data.message
                );
                toast({ title: 'Хүсэлт илгээгдлээ', description: 'Төсвийн оноо ашиглах хүсэлт админ руу илгээгдлээ.' });
            } else {
                if (amount > 100) {
                    toast({ title: 'Алдаа', description: 'Хувийн оноо хамгийн ихдээ 100 байх боломжтой', variant: 'destructive' });
                    setLoading(false);
                    return;
                }
                await PointsService.sendRecognition(
                    firestore,
                    companyPath!,
                    user.uid,
                    [data.recipientId],
                    amount,
                    data.valueId,
                    data.message
                );
                toast({ title: 'Амжилттай!', description: 'Оноо болон талархал илгээгдлээ.' });
            }
            setOpen(false);
            form.reset();
        } catch (e: any) {
            toast({ title: 'Алдаа гарлаа', description: e.message || 'Оноо илгээж чадсангүй', variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    const selectedValueId = form.watch('valueId');
    const selectedValue = values?.find((v: CoreValue) => v.id === selectedValueId);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {triggerButton || <Button className="gap-2"><Sparkles className="w-4 h-4" /> Талархал илгээх</Button>}
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        Талархал илгээх <Sparkles className="w-5 h-5 text-yellow-500" />
                    </DialogTitle>
                </DialogHeader>

                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 py-2">

                    {/* 1. Select Recipient */}
                    <div className="space-y-2">
                        <Label>Хэнд илгээх вэ?</Label>
                        <Select onValueChange={(val) => form.setValue('recipientId', val)}>
                            <SelectTrigger>
                                <SelectValue placeholder="Ажилтанаа сонгоно уу..." />
                            </SelectTrigger>
                            <SelectContent>
                                {employees?.filter(e => e.id !== user?.uid).map(emp => (
                                    <SelectItem key={emp.id} value={emp.id} className="flex items-center gap-2">
                                        <div className="flex items-center gap-2">
                                            <Avatar className="w-6 h-6">
                                                <AvatarImage src={emp.photoURL} />
                                                <AvatarFallback>{emp.firstName?.[0]}</AvatarFallback>
                                            </Avatar>
                                            {emp.lastName} {emp.firstName}
                                        </div>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {form.formState.errors.recipientId && <p className="text-red-500 text-xs">{form.formState.errors.recipientId.message}</p>}
                    </div>

                    {/* Budget Toggle */}
                    {myPosition?.hasPointBudget && (
                        <div className="p-4 rounded-2xl border-2 border-primary/20 bg-primary/5 space-y-3">
                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <Label className="text-sm font-semibold flex items-center gap-2">
                                        <Target className="w-4 h-4 text-primary" />
                                        Төсвийн оноо ашиглах
                                    </Label>
                                    <p className="text-[10px] text-muted-foreground">Энэ оноо таны хувийн онооноос хасагдахгүй.</p>
                                </div>
                                <Switch
                                    checked={useBudget}
                                    onCheckedChange={setUseBudget}
                                />
                            </div>
                            {useBudget && (
                                <div className="flex items-center justify-between text-[11px] font-medium pt-2 border-t border-primary/10">
                                    <span className="text-muted-foreground italic">Үлдэгдэл төсөв:</span>
                                    <span className="text-primary font-semibold">{(myPosition.remainingPointBudget ?? myPosition.yearlyPointBudget ?? 0).toLocaleString()} <span className="text-[9px] opacity-70">ОНОО</span></span>
                                </div>
                            )}
                        </div>
                    )}

                    {/* 2. Select Value (Visual Cards) */}
                    <div className="space-y-2">
                        <Label>Ямар үнэт зүйл илэрхийлсэн бэ?</Label>
                        <div className="grid grid-cols-2 gap-2 max-h-[160px] overflow-y-auto pr-1">
                            {values?.length === 0 && <p className="text-sm text-muted-foreground col-span-2 text-center py-4">Үнэт зүйл тохируулаагүй байна.</p>}
                            {values?.map(val => (
                                <div
                                    key={val.id}
                                    onClick={() => form.setValue('valueId', val.id)}
                                    className={`
                                        cursor-pointer border rounded-lg p-3 transition-all flex items-center gap-3 relative overflow-hidden
                                        ${selectedValueId === val.id ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'hover:bg-muted/50'}
                                    `}
                                >
                                    <div className={`text-2xl ${selectedValueId === val.id ? 'scale-110' : ''} transition-transform`}>{val.emoji}</div>
                                    <div className="text-sm font-medium leading-tight">{val.title}</div>
                                    {selectedValueId === val.id && <div className="absolute right-0 top-0 w-0 h-0 border-t-[20px] border-r-[20px] border-t-transparent border-r-primary rotate-0" />}
                                </div>
                            ))}
                        </div>
                        {form.formState.errors.valueId && <p className="text-red-500 text-xs">{form.formState.errors.valueId.message}</p>}
                    </div>

                    {/* 3. Message & Points */}
                    <div className="grid grid-cols-4 gap-4">
                        <div className="col-span-3 space-y-2">
                            <Label>Яагаад энэ оноог өгч байна вэ?</Label>
                            <Textarea
                                {...form.register('message')}
                                placeholder="Түүний хийсэн үйлдэл, оруулсан хувь нэмрийг бичнэ үү..."
                                className="resize-none h-24"
                            />
                            {form.formState.errors.message && <p className="text-red-500 text-xs">{form.formState.errors.message.message}</p>}
                        </div>
                        <div className="col-span-1 space-y-2">
                            <Label>Оноо</Label>
                            {useBudget ? (
                                <Input
                                    type="number"
                                    className="h-24 text-center font-semibold text-xl"
                                    {...form.register('points', { valueAsNumber: true })}
                                />
                            ) : (
                                <Select defaultValue="10" onValueChange={v => form.setValue('points', parseInt(v))}>
                                    <SelectTrigger className="h-24 flex flex-col items-center justify-center gap-1 font-semibold text-lg bg-muted/30">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="5">5 🍬</SelectItem>
                                        <SelectItem value="10">10 ⭐</SelectItem>
                                        <SelectItem value="20">20 🔥</SelectItem>
                                        <SelectItem value="50">50 🚀</SelectItem>
                                        <SelectItem value="100">100 🏆</SelectItem>
                                    </SelectContent>
                                </Select>
                            )}
                            {form.formState.errors.points && <p className="text-red-500 text-[10px]">{form.formState.errors.points.message}</p>}
                        </div>
                    </div>

                    <DialogFooter>
                        <div className="flex-1 flex items-center text-xs text-muted-foreground">
                            Current Style: {selectedValue?.color ? <div className="w-3 h-3 rounded-full ml-2 mr-1" style={{ background: selectedValue.color }} /> : null}
                        </div>
                        <Button type="submit" disabled={loading} className="w-full sm:w-auto">
                            {loading ? 'Илгээж байна...' : 'Илгээх'}
                        </Button>
                    </DialogFooter>

                </form>
            </DialogContent>
        </Dialog>
    );
}
