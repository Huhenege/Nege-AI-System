'use client';

import { useState, useEffect, useMemo } from 'react';
import { useFirestore, useCollection, useMemoFirebase, tenantCollection, useTenantWrite } from '@/firebase';
import { getDoc, setDoc, serverTimestamp, query, where } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';
import {
    Coins, Save, Loader2, Sparkles, AlertCircle, Calculator,
    Users, FolderKanban, ShieldCheck, Banknote, CalendarDays,
    TrendingUp, Info
} from 'lucide-react';
import { PointsConfig } from '@/types/points';

export function PointConfigManager() {
    const firestore = useFirestore();
    const { tDoc } = useTenantWrite();
    const { toast } = useToast();
    const [config, setConfig] = useState<PointsConfig | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Form state
    const [year, setYear] = useState(new Date().getFullYear());
    const [monthlyAllowanceBase, setMonthlyAllowanceBase] = useState(1000);
    const [projectPointsBudget, setProjectPointsBudget] = useState(0);
    const [managerBudgetTotal, setManagerBudgetTotal] = useState(0);
    const [pointToMNT, setPointToMNT] = useState(100);

    // Fetch employees count for budget calculation
    const employeesQuery = useMemoFirebase(({ firestore, companyPath }) => firestore ? tenantCollection(firestore, companyPath, 'employees') : null, [firestore]);
    const { data: employees } = useCollection<{ id: string }>(employeesQuery);
    const employeeCount = employees?.length || 0;

    // Fetch positions with point budgets
    const positionsQuery = useMemoFirebase(({ firestore, companyPath }) =>
        firestore ? query(tenantCollection(firestore, companyPath, 'positions'), where('hasPointBudget', '==', true)) : null
        , [firestore]);
    const { data: budgetPositions } = useCollection<{ id: string; yearlyPointBudget?: number }>(positionsQuery);

    const totalPositionBudget = useMemo(() =>
        (budgetPositions || []).reduce((sum, p) => sum + (p.yearlyPointBudget || 0), 0)
        , [budgetPositions]);

    // Calculate totals
    const monthlyAllowanceTotal = monthlyAllowanceBase * employeeCount;
    const yearlyAllowanceTotal = monthlyAllowanceTotal * 12;
    const yearlyTotalBudget = yearlyAllowanceTotal + projectPointsBudget + managerBudgetTotal;
    const yearlyTotalMNT = yearlyTotalBudget * pointToMNT;

    useEffect(() => {
        const fetchConfig = async () => {
            if (!firestore) return;
            try {
                const configRef = tDoc('points_config', 'main');
                const snap = await getDoc(configRef);
                if (snap.exists()) {
                    const data = snap.data() as PointsConfig;
                    setConfig(data);
                    setYear(data.year || new Date().getFullYear());
                    setMonthlyAllowanceBase(data.monthlyAllowanceBase ?? 1000);
                    setProjectPointsBudget(data.projectPointsBudget ?? 0);
                    setManagerBudgetTotal(data.managerBudgetTotal ?? 0);
                    setPointToMNT(data.pointToMNT ?? 100);
                } else {
                    setConfig({
                        year: new Date().getFullYear(),
                        monthlyAllowanceBase: 1000,
                        projectPointsBudget: 0,
                        managerBudgetTotal: 0,
                        pointToMNT: 100,
                        updatedAt: null
                    });
                }
            } catch (error) {
                console.error('Error fetching config:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchConfig();
    }, [firestore]);

    const handleSave = async () => {
        if (!firestore) return;

        setSaving(true);
        try {
            const configRef = tDoc('points_config', 'main');
            const newConfig: PointsConfig = {
                year,
                monthlyAllowanceBase,
                projectPointsBudget,
                managerBudgetTotal,
                pointToMNT,
                yearlyTotalBudget,
                updatedAt: serverTimestamp()
            };
            await setDoc(configRef, newConfig);
            setConfig(newConfig);
            toast({
                title: 'Амжилттай хадгалагдлаа',
                description: `${year} оны пойнт тохиргоо шинэчлэгдлээ.`
            });
        } catch (error: any) {
            toast({
                title: 'Алдаа гарлаа',
                description: error.message,
                variant: 'destructive'
            });
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="animate-pulse h-48 bg-muted rounded-xl" />;

    return (
        <div className="space-y-6">
            {/* Header */}
            <Card className="border-2 border-primary/10 overflow-hidden relative">
                <div className="absolute top-0 right-0 p-4 opacity-5">
                    <Sparkles className="w-32 h-32" />
                </div>
                <CardHeader className="bg-gradient-to-r from-primary/5 to-transparent pb-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary">
                            <Coins className="w-5 h-5" />
                        </div>
                        <div>
                            <CardTitle className="text-xl">Пойнт системийн тохиргоо</CardTitle>
                            <CardDescription>Тухайн жилийн нийт пойнтын төсөв, оноо бүрийн мөнгөн дүн зэргийг тохируулна.</CardDescription>
                        </div>
                    </div>
                </CardHeader>
            </Card>

            <div className="grid gap-6 lg:grid-cols-3">
                {/* Left: Configuration Form */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Year Selection */}
                    <Card>
                        <CardHeader className="pb-3">
                            <div className="flex items-center gap-2">
                                <CalendarDays className="w-4 h-4 text-primary" />
                                <CardTitle className="text-base">Тохиргооны жил</CardTitle>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center gap-3">
                                <div className="relative max-w-[160px]">
                                    <Input
                                        type="number"
                                        value={year}
                                        onChange={e => setYear(parseInt(e.target.value) || new Date().getFullYear())}
                                        className="h-11 text-lg font-semibold pl-10"
                                        min={2020}
                                        max={2099}
                                    />
                                    <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                </div>
                                <span className="text-sm text-muted-foreground">он</span>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Monthly Allowance */}
                    <Card>
                        <CardHeader className="pb-3">
                            <div className="flex items-center gap-2">
                                <Users className="w-4 h-4 text-blue-500" />
                                <CardTitle className="text-base">Ажилчдын сар бүрийн бэлэглэх оноо</CardTitle>
                            </div>
                            <CardDescription className="text-xs">
                                Сар бүрийн 1-ний өдөр ажилчин бүрт энэ хэмжээний оноо олгогдоно. Зөвхөн бусдад бэлэглэх зориулалттай.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center gap-4">
                                <div className="relative max-w-[200px]">
                                    <Input
                                        type="number"
                                        value={monthlyAllowanceBase}
                                        onChange={e => setMonthlyAllowanceBase(parseInt(e.target.value) || 0)}
                                        className="h-11 text-lg font-semibold pl-10"
                                        min={0}
                                    />
                                    <Coins className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                </div>
                                <span className="text-sm text-muted-foreground">оноо / ажилтан / сар</span>
                            </div>
                            <div className="flex flex-wrap gap-3">
                                <div className="bg-blue-50 px-3 py-2 rounded-lg border border-blue-100">
                                    <p className="text-[10px] text-blue-600 font-medium uppercase tracking-wider">Нийт ажилчид</p>
                                    <p className="font-semibold text-blue-700">{employeeCount} хүн</p>
                                </div>
                                <div className="bg-blue-50 px-3 py-2 rounded-lg border border-blue-100">
                                    <p className="text-[10px] text-blue-600 font-medium uppercase tracking-wider">Сарын нийт</p>
                                    <p className="font-semibold text-blue-700">{monthlyAllowanceTotal.toLocaleString()} оноо</p>
                                </div>
                                <div className="bg-blue-50 px-3 py-2 rounded-lg border border-blue-100">
                                    <p className="text-[10px] text-blue-600 font-medium uppercase tracking-wider">Жилийн нийт</p>
                                    <p className="font-semibold text-blue-700">{yearlyAllowanceTotal.toLocaleString()} оноо</p>
                                </div>
                            </div>
                            <p className="text-xs text-muted-foreground flex items-start gap-1.5">
                                <Info className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
                                Бэлэглэлийн оноо нь хуримтлагдахгүй. Сар бүрийн 1-нд шинэ оноо олгогдож, өмнөхийг дарна.
                            </p>
                        </CardContent>
                    </Card>

                    {/* Project Points Budget */}
                    <Card>
                        <CardHeader className="pb-3">
                            <div className="flex items-center gap-2">
                                <FolderKanban className="w-4 h-4 text-emerald-500" />
                                <CardTitle className="text-base">Төсөлийн гүйцэтгэлд олгох оноо</CardTitle>
                            </div>
                            <CardDescription className="text-xs">
                                Төсөл амжилттай дуусгасан багийн гишүүдэд хуваарилах жилийн нийт оноо.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center gap-4">
                                <div className="relative max-w-[200px]">
                                    <Input
                                        type="number"
                                        value={projectPointsBudget}
                                        onChange={e => setProjectPointsBudget(parseInt(e.target.value) || 0)}
                                        className="h-11 text-lg font-semibold pl-10"
                                        min={0}
                                    />
                                    <FolderKanban className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                </div>
                                <span className="text-sm text-muted-foreground">оноо / жил</span>
                            </div>
                            <p className="text-xs text-muted-foreground flex items-start gap-1.5">
                                <Info className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                                Төсөл бүрт pointBudget тохируулж, дуусгасан үед хугацааны бонус/торгуулийн дүрмээр автомат хуваарилагдана.
                            </p>
                        </CardContent>
                    </Card>

                    {/* Manager Budget */}
                    <Card>
                        <CardHeader className="pb-3">
                            <div className="flex items-center gap-2">
                                <ShieldCheck className="w-4 h-4 text-amber-500" />
                                <CardTitle className="text-base">Удирдлагын оноо зарцуулах төсөв</CardTitle>
                            </div>
                            <CardDescription className="text-xs">
                                Оноо зарцуулах эрхтэй удирдлагуудын нийт жилийн төсөв. Позиц тус бүрт тусад нь тохируулна.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center gap-4">
                                <div className="relative max-w-[200px]">
                                    <Input
                                        type="number"
                                        value={managerBudgetTotal}
                                        onChange={e => setManagerBudgetTotal(parseInt(e.target.value) || 0)}
                                        className="h-11 text-lg font-semibold pl-10"
                                        min={0}
                                    />
                                    <ShieldCheck className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                </div>
                                <span className="text-sm text-muted-foreground">оноо / жил</span>
                            </div>
                            {budgetPositions && budgetPositions.length > 0 && (
                                <div className="bg-amber-50 px-3 py-2 rounded-lg border border-amber-100">
                                    <p className="text-[10px] text-amber-600 font-medium uppercase tracking-wider">Позицуудад тохируулсан нийт</p>
                                    <p className="font-semibold text-amber-700">{totalPositionBudget.toLocaleString()} оноо ({budgetPositions.length} позиц)</p>
                                    {totalPositionBudget > managerBudgetTotal && managerBudgetTotal > 0 && (
                                        <p className="text-[10px] text-red-600 mt-1 flex items-center gap-1">
                                            <AlertCircle className="w-3 h-3" />
                                            Позицуудын нийт төсөв нь тохируулсан удирдлагын төсвөөс {(totalPositionBudget - managerBudgetTotal).toLocaleString()} оноогоор хэтэрсэн!
                                        </p>
                                    )}
                                </div>
                            )}
                            <p className="text-xs text-muted-foreground flex items-start gap-1.5">
                                <Info className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                                Позиц бүрийн оноо зарцуулах эрхийг Байгууллагын бүтэц &rarr; Позиц тохиргоо хэсгээс тусад нь удирдана.
                            </p>
                        </CardContent>
                    </Card>

                    {/* Point to MNT */}
                    <Card>
                        <CardHeader className="pb-3">
                            <div className="flex items-center gap-2">
                                <Banknote className="w-4 h-4 text-purple-500" />
                                <CardTitle className="text-base">Нэгж онооны мөнгөн дүн</CardTitle>
                            </div>
                            <CardDescription className="text-xs">
                                1 оноо хэдэн төгрөгтэй тэнцэхийг тохируулна. Дэлгүүрийн бараа, бэлэг зэрэгт мөнгөн дүнг харуулахад ашиглана.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center gap-3">
                                <span className="text-sm font-medium whitespace-nowrap">1 оноо =</span>
                                <div className="relative max-w-[200px]">
                                    <Input
                                        type="number"
                                        value={pointToMNT}
                                        onChange={e => setPointToMNT(parseInt(e.target.value) || 0)}
                                        className="h-11 text-lg font-semibold pl-10"
                                        min={0}
                                    />
                                    <Banknote className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                </div>
                                <span className="text-sm text-muted-foreground">₮ (төгрөг)</span>
                            </div>
                            <div className="flex flex-wrap gap-3">
                                {[50, 100, 200, 500, 1000].map(v => (
                                    <button
                                        key={v}
                                        type="button"
                                        onClick={() => setPointToMNT(v)}
                                        className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${pointToMNT === v
                                            ? 'bg-purple-100 border-purple-300 text-purple-700'
                                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                                            }`}
                                    >
                                        {v.toLocaleString()}₮
                                    </button>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Save Button */}
                    <div className="flex justify-end">
                        <Button onClick={handleSave} disabled={saving} className="gap-2 h-11 px-8">
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            Тохиргоог хадгалах
                        </Button>
                    </div>
                </div>

                {/* Right: Summary Sidebar */}
                <div className="space-y-6">
                    {/* Yearly Budget Summary */}
                    <Card className="border-2 border-primary/20 sticky top-6">
                        <CardHeader className="pb-3 bg-gradient-to-b from-primary/5 to-transparent">
                            <div className="flex items-center gap-2">
                                <Calculator className="w-4 h-4 text-primary" />
                                <CardTitle className="text-base">{year} оны төсвийн тооцоолол</CardTitle>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {/* Total Budget */}
                            <div className="text-center py-4 bg-gradient-to-b from-primary/10 to-primary/5 rounded-xl border border-primary/10">
                                <p className="text-[10px] text-primary font-semibold uppercase tracking-wider mb-1">Нийт жилийн төсөв</p>
                                <p className="text-3xl font-bold text-primary">{yearlyTotalBudget.toLocaleString()}</p>
                                <p className="text-xs text-primary/60">оноо</p>
                                <Separator className="my-2 bg-primary/10" />
                                <p className="text-sm font-semibold text-primary/80">{yearlyTotalMNT.toLocaleString()}₮</p>
                                <p className="text-[10px] text-primary/50">мөнгөн дүнгээр</p>
                            </div>

                            {/* Breakdown */}
                            <div className="space-y-3">
                                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Задаргаа</h4>

                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full bg-blue-500" />
                                            <span className="text-xs">Бэлэглэлийн оноо</span>
                                        </div>
                                        <span className="text-xs font-semibold">{yearlyAllowanceTotal.toLocaleString()}</span>
                                    </div>
                                    <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
                                        <div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: yearlyTotalBudget > 0 ? `${(yearlyAllowanceTotal / yearlyTotalBudget) * 100}%` : '0%' }} />
                                    </div>
                                    <p className="text-[10px] text-muted-foreground pl-4">
                                        {monthlyAllowanceBase.toLocaleString()} × {employeeCount} ажилтан × 12 сар
                                    </p>
                                </div>

                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full bg-emerald-500" />
                                            <span className="text-xs">Төслийн оноо</span>
                                        </div>
                                        <span className="text-xs font-semibold">{projectPointsBudget.toLocaleString()}</span>
                                    </div>
                                    <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
                                        <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: yearlyTotalBudget > 0 ? `${(projectPointsBudget / yearlyTotalBudget) * 100}%` : '0%' }} />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full bg-amber-500" />
                                            <span className="text-xs">Удирдлагын төсөв</span>
                                        </div>
                                        <span className="text-xs font-semibold">{managerBudgetTotal.toLocaleString()}</span>
                                    </div>
                                    <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
                                        <div className="h-full rounded-full bg-amber-500 transition-all" style={{ width: yearlyTotalBudget > 0 ? `${(managerBudgetTotal / yearlyTotalBudget) * 100}%` : '0%' }} />
                                    </div>
                                </div>
                            </div>

                            <Separator />

                            {/* Quick Calculations */}
                            <div className="space-y-2">
                                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Мөнгөн тооцоолол</h4>
                                <div className="space-y-1.5 text-xs">
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Бэлэглэл (жилийн):</span>
                                        <span className="font-medium">{(yearlyAllowanceTotal * pointToMNT).toLocaleString()}₮</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Төслийн:</span>
                                        <span className="font-medium">{(projectPointsBudget * pointToMNT).toLocaleString()}₮</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Удирдлагын:</span>
                                        <span className="font-medium">{(managerBudgetTotal * pointToMNT).toLocaleString()}₮</span>
                                    </div>
                                    <Separator className="my-1" />
                                    <div className="flex justify-between font-semibold text-primary">
                                        <span>Нийт:</span>
                                        <span>{yearlyTotalMNT.toLocaleString()}₮</span>
                                    </div>
                                </div>
                            </div>

                            {/* System Info */}
                            <div className="bg-muted/30 p-3 rounded-lg border text-[11px] text-slate-500 space-y-1.5">
                                <p className="font-semibold text-slate-700 flex items-center gap-1.5">
                                    <TrendingUp className="w-3 h-3" /> Системийн ажиллах зарчим
                                </p>
                                <ul className="list-disc list-inside space-y-0.5">
                                    <li>Бэлэглэлийн оноо сар бүр шинэчлэгдэнэ</li>
                                    <li>Төслийн оноо гүйцэтгэлийн дүрмээр хуваарилна</li>
                                    <li>Удирдлагын оноо позицоор хязгаарлагдана</li>
                                    <li>Хүлээж авсан оноог дэлгүүрээс зарцуулна</li>
                                </ul>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
