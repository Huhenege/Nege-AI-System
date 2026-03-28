'use client';

import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useCollection, useFirestore, useMemoFirebase, tenantCollection, useFetchCollection, useFetchDoc } from '@/firebase';
import { collection, doc, query, orderBy, limit, where } from 'firebase/firestore';
import { CoreValue, PointsConfig, RecognitionPost } from '@/types/points';
import {
    BarChart, Activity, Award, Target, Users, History,
    Wallet, FolderKanban, ShieldCheck, Banknote, TrendingUp,
    Coins, CalendarDays, ArrowUpRight, ArrowDownRight, CircleDollarSign
} from 'lucide-react';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { VerticalTabMenu } from '@/components/ui/vertical-tab-menu';
import { RewardManager } from './_components/reward-manager';
import { PointConfigManager } from './_components/point-config-manager';
import { BudgetRequestManager } from './_components/budget-request-manager';
import { RedemptionManager } from './_components/redemption-manager';
import { Leaderboard } from './_components/leaderboard';
import { formatDistanceToNow } from 'date-fns';
import { mn } from 'date-fns/locale';
import { PageHeader } from '@/components/patterns/page-layout';
import { ActionIconButton } from '@/components/ui/action-icon-button';
import { Settings as SettingsIcon } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';

interface PointTx {
    id?: string;
    userId: string;
    amount: number;
    type: string;
    refId?: string;
    projectId?: string;
    description?: string;
    fromUserId?: string;
    toUserIds?: string[];
    amountPerPerson?: number;
    valueId?: string;
    createdAt?: { toDate?: () => Date } | string;
}

export default function PointAdminPage() {
    const firestore = useFirestore();
    const [activeTab, setActiveTab] = useState('overview');

    // Queries
    const valuesQuery = useMemoFirebase(({ firestore, companyPath }) =>
        firestore ? query(tenantCollection(firestore, companyPath, 'values'), where('isActive', '==', true)) : null
        , [firestore]);
    const recognitionQuery = useMemoFirebase(({ firestore, companyPath }) =>
        firestore ? query(tenantCollection(firestore, companyPath, 'recognition_posts'), orderBy('createdAt', 'desc'), limit(50)) : null
        , [firestore]);
    const transactionsQuery = useMemoFirebase(({ firestore, companyPath }) =>
        firestore ? query(tenantCollection(firestore, companyPath, 'point_transactions'), orderBy('createdAt', 'desc'), limit(500)) : null
        , [firestore]);
    const employeesQuery = useMemoFirebase(({ firestore, companyPath }) => firestore ? tenantCollection(firestore, companyPath, 'employees') : null, [firestore]);
    const positionsQuery = useMemoFirebase(({ firestore, companyPath }) =>
        firestore ? query(tenantCollection(firestore, companyPath, 'positions'), where('hasPointBudget', '==', true)) : null
        , [firestore]);

    // Config — tenant-scoped (companyPath = "companies/{id}", тиймээс бүтэн замыг нэг string-д дамжуулна)
    const configRef = useMemoFirebase(({ firestore, companyPath }) =>
        firestore ? doc(firestore, `${companyPath}/points_config/main`) : null
        , [firestore]);
    const { data: pointsConfig } = useFetchDoc<PointsConfig>(configRef);

    // Data
    const { data: values } = useFetchCollection<CoreValue>(valuesQuery);
    const { data: recognitionPosts } = useCollection<RecognitionPost & { id?: string }>(recognitionQuery);
    const { data: transactions } = useCollection<PointTx>(transactionsQuery);
    const { data: employees } = useFetchCollection<{ id: string; firstName?: string; lastName?: string }>(employeesQuery);
    const { data: budgetPositions } = useFetchCollection<{ id: string; yearlyPointBudget?: number; remainingPointBudget?: number }>(positionsQuery);

    const employeeCount = employees?.length || 0;

    const empMap = useMemo(() => {
        const m = new Map<string, string>();
        (employees || []).forEach(e => m.set(e.id, [e.firstName, e.lastName].filter(Boolean).join(' ').trim() || e.id));
        return m;
    }, [employees]);

    // Budget calculations
    const budgetData = useMemo(() => {
        const config = pointsConfig;
        const monthlyBase = config?.monthlyAllowanceBase ?? 1000;
        const projectBudget = config?.projectPointsBudget ?? 0;
        const managerBudget = config?.managerBudgetTotal ?? 0;
        const pointMNT = config?.pointToMNT ?? 100;
        const configYear = config?.year ?? new Date().getFullYear();

        const yearlyAllowance = monthlyBase * employeeCount * 12;
        const yearlyTotal = yearlyAllowance + projectBudget + managerBudget;

        // Position budget usage
        const totalPositionBudget = (budgetPositions || []).reduce((sum, p) => sum + (p.yearlyPointBudget || 0), 0);
        const totalPositionRemaining = (budgetPositions || []).reduce((sum, p) => sum + (p.remainingPointBudget ?? p.yearlyPointBudget ?? 0), 0);
        const positionBudgetUsed = totalPositionBudget - totalPositionRemaining;

        return {
            configYear,
            monthlyBase,
            projectBudget,
            managerBudget,
            pointMNT,
            yearlyAllowance,
            yearlyTotal,
            yearlyTotalMNT: yearlyTotal * pointMNT,
            totalPositionBudget,
            totalPositionRemaining,
            positionBudgetUsed,
            positionCount: budgetPositions?.length || 0,
        };
    }, [pointsConfig, employeeCount, budgetPositions]);

    // Transaction stats
    const stats = useMemo(() => {
        const now = new Date();
        const thisYear = now.getFullYear();
        const last30 = new Date(now);
        last30.setDate(last30.getDate() - 30);
        const yearStart = new Date(thisYear, 0, 1);

        const txList = transactions || [];
        const posts = recognitionPosts || [];

        const getDate = (created: any): Date | null => {
            if (!created) return null;
            return typeof created === 'object' && 'toDate' in created
                ? (created as { toDate: () => Date }).toDate()
                : new Date(created as string);
        };

        // Points given in last 30 days
        const givenLast30 = txList
            .filter(t => t.type === 'GIVEN' && (() => { const d = getDate(t.createdAt); return d && d >= last30; })())
            .reduce((s, t) => s + Math.abs(Number(t.amount)), 0);

        // Points given this year (all types except GIVEN which is negative)
        const receivedThisYear = txList
            .filter(t => t.type === 'RECEIVED' && (() => { const d = getDate(t.createdAt); return d && d >= yearStart; })())
            .reduce((s, t) => s + Math.abs(Number(t.amount)), 0);

        // Project points distributed this year
        const projectPointsUsed = txList
            .filter(t => t.type === 'RECEIVED' && t.projectId && (() => { const d = getDate(t.createdAt); return d && d >= yearStart; })())
            .reduce((s, t) => s + Math.abs(Number(t.amount)), 0);

        // Recognition points given this year (from personal allowances)
        const recognitionPointsUsed = txList
            .filter(t => t.type === 'GIVEN' && !t.projectId && (() => { const d = getDate(t.createdAt); return d && d >= yearStart; })())
            .reduce((s, t) => s + Math.abs(Number(t.amount)), 0);

        // Redeemed this year
        const redeemedThisYear = txList
            .filter(t => t.type === 'REDEEMED' && (() => { const d = getDate(t.createdAt); return d && d >= yearStart; })())
            .reduce((s, t) => s + Math.abs(Number(t.amount)), 0);

        // Active users
        const activeUserIds = new Set<string>();
        txList.forEach(t => {
            const dt = getDate(t.createdAt);
            if (dt && dt >= last30) activeUserIds.add(t.userId);
        });

        // Value counts
        const valueCounts: Record<string, number> = {};
        posts.forEach(p => {
            const id = (p as { valueId?: string }).valueId || '';
            valueCounts[id] = (valueCounts[id] || 0) + 1;
        });
        const topValueId = Object.keys(valueCounts).sort((a, b) => valueCounts[b] - valueCounts[a])[0];

        const totalGivenAll = txList.filter(t => t.type === 'GIVEN').reduce((s, t) => s + Math.abs(Number(t.amount)), 0);

        return {
            totalGiven: totalGivenAll,
            givenLast30,
            receivedThisYear,
            projectPointsUsed,
            recognitionPointsUsed,
            redeemedThisYear,
            activeCount: activeUserIds.size,
            topValueId,
            topValueCount: topValueId ? valueCounts[topValueId] : 0
        };
    }, [transactions, recognitionPosts]);

    const topValueTitle = useMemo(() => {
        if (!stats.topValueId || !values) return '—';
        const v = values.find(x => x.id === stats.topValueId);
        return v?.title || '—';
    }, [stats.topValueId, values]);

    // Utilization percentages
    const allowanceUtilPct = budgetData.yearlyAllowance > 0 ? Math.min(100, (stats.recognitionPointsUsed / budgetData.yearlyAllowance) * 100) : 0;
    const projectUtilPct = budgetData.projectBudget > 0 ? Math.min(100, (stats.projectPointsUsed / budgetData.projectBudget) * 100) : 0;
    const managerUtilPct = budgetData.totalPositionBudget > 0 ? Math.min(100, (budgetData.positionBudgetUsed / budgetData.totalPositionBudget) * 100) : 0;
    const overallUtilPct = budgetData.yearlyTotal > 0 ? Math.min(100, ((stats.recognitionPointsUsed + stats.projectPointsUsed + budgetData.positionBudgetUsed) / budgetData.yearlyTotal) * 100) : 0;

    return (
        <div className="w-full py-6 px-page space-y-6">
            <PageHeader
                title="Пойнт Модул"
                description="Байгууллагын урамшуулал, онооны нэгдсэн систем."
                showBackButton={true}
                hideBreadcrumbs={true}
                backButtonPlacement="inline"
                backBehavior="history"
                fallbackBackHref="/dashboard"
                actions={
                    <ActionIconButton
                        label="Тохиргоо"
                        description="Пойнтын тохиргоо"
                        onClick={() => setActiveTab('settings')}
                        icon={<SettingsIcon className="h-4 w-4" />}
                        variant="outline"
                        className="bg-white hover:bg-slate-50 border-slate-200"
                    />
                }
            />

            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                <VerticalTabMenu
                    orientation="horizontal"
                    items={[
                        { value: 'overview', label: 'Ерөнхий мэдээлэл' },
                        { value: 'leaderboard', label: 'Рейтинг' },
                        { value: 'rewards', label: 'Дэлгүүр удирдах' },
                        { value: 'requests', label: 'Захиалгууд' },
                        { value: 'budget-requests', label: 'Төсвийн хүсэлтүүд' },
                        { value: 'settings', label: 'Тохиргоо' },
                    ]}
                />

                <TabsContent value="overview" className="space-y-6 animate-in fade-in slide-in-from-bottom-2">

                    {/* ===== BUDGET OVERVIEW SECTION ===== */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2">
                            <Wallet className="w-5 h-5 text-primary" />
                            <h2 className="text-lg font-semibold">{budgetData.configYear} оны пойнт төсөв</h2>
                        </div>

                        {/* Top Budget Summary Cards */}
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                            {/* Total Budget */}
                            <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-white">
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <CardTitle className="text-sm font-medium text-primary/80">Нийт жилийн төсөв</CardTitle>
                                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                                        <Wallet className="h-4 w-4 text-primary" />
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold text-primary">{budgetData.yearlyTotal.toLocaleString('mn-MN')}</div>
                                    <p className="text-xs text-primary/60 mt-0.5">
                                        {budgetData.yearlyTotalMNT.toLocaleString()}₮ мөнгөн дүнгээр
                                    </p>
                                    <div className="mt-2">
                                        <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                                            <span>Ашигласан</span>
                                            <span>{overallUtilPct.toFixed(1)}%</span>
                                        </div>
                                        <Progress value={overallUtilPct} className="h-1.5" />
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Monthly Allowance Budget */}
                            <Card>
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <CardTitle className="text-sm font-medium">Бэлэглэлийн оноо</CardTitle>
                                    <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center">
                                        <Users className="h-4 w-4 text-blue-500" />
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-semibold">{budgetData.yearlyAllowance.toLocaleString('mn-MN')}</div>
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                        {budgetData.monthlyBase.toLocaleString()} × {employeeCount} хүн × 12 сар
                                    </p>
                                    <div className="mt-2">
                                        <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                                            <span>Зарцуулсан: {stats.recognitionPointsUsed.toLocaleString()}</span>
                                            <span>{allowanceUtilPct.toFixed(1)}%</span>
                                        </div>
                                        <Progress value={allowanceUtilPct} className="h-1.5 [&>div]:bg-blue-500" />
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Project Points Budget */}
                            <Card>
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <CardTitle className="text-sm font-medium">Төслийн оноо</CardTitle>
                                    <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center">
                                        <FolderKanban className="h-4 w-4 text-emerald-500" />
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-semibold">{budgetData.projectBudget.toLocaleString('mn-MN')}</div>
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                        Төсөл гүйцэтгэлд олгох жилийн оноо
                                    </p>
                                    <div className="mt-2">
                                        <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                                            <span>Хуваарилсан: {stats.projectPointsUsed.toLocaleString()}</span>
                                            <span>{projectUtilPct.toFixed(1)}%</span>
                                        </div>
                                        <Progress value={projectUtilPct} className="h-1.5 [&>div]:bg-emerald-500" />
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Manager Budget */}
                            <Card>
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <CardTitle className="text-sm font-medium">Удирдлагын төсөв</CardTitle>
                                    <div className="w-8 h-8 rounded-full bg-amber-50 flex items-center justify-center">
                                        <ShieldCheck className="h-4 w-4 text-amber-500" />
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-semibold">{budgetData.managerBudget.toLocaleString('mn-MN')}</div>
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                        {budgetData.positionCount} позицод хуваарилсан
                                    </p>
                                    <div className="mt-2">
                                        <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                                            <span>Зарцуулсан: {budgetData.positionBudgetUsed.toLocaleString()}</span>
                                            <span>{managerUtilPct.toFixed(1)}%</span>
                                        </div>
                                        <Progress value={managerUtilPct} className="h-1.5 [&>div]:bg-amber-500" />
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Financial Summary Bar */}
                        <Card className="bg-gradient-to-r from-slate-50 to-white">
                            <CardContent className="py-4">
                                <div className="flex flex-wrap items-center justify-between gap-4">
                                    <div className="flex items-center gap-6">
                                        <div className="flex items-center gap-2">
                                            <CircleDollarSign className="w-4 h-4 text-purple-500" />
                                            <div>
                                                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Нэгж онооны үнэ</p>
                                                <p className="text-sm font-bold">1 оноо = {budgetData.pointMNT.toLocaleString()}₮</p>
                                            </div>
                                        </div>
                                        <Separator orientation="vertical" className="h-8" />
                                        <div>
                                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Сарын бэлэглэх</p>
                                            <p className="text-sm font-bold">{budgetData.monthlyBase.toLocaleString()} оноо/хүн</p>
                                        </div>
                                        <Separator orientation="vertical" className="h-8" />
                                        <div>
                                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Нийт ажилчид</p>
                                            <p className="text-sm font-bold">{employeeCount} хүн</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 bg-purple-50 px-4 py-2 rounded-xl border border-purple-100">
                                        <Banknote className="w-4 h-4 text-purple-600" />
                                        <div>
                                            <p className="text-[10px] text-purple-600 uppercase tracking-wider font-medium">Нийт мөнгөн дүн</p>
                                            <p className="text-base font-bold text-purple-700">{budgetData.yearlyTotalMNT.toLocaleString()}₮</p>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* ===== ACTIVITY KPI SECTION ===== */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2">
                            <TrendingUp className="w-5 h-5 text-primary" />
                            <h2 className="text-lg font-semibold">Идэвхийн мэдээлэл</h2>
                        </div>

                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                            <Card>
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <CardTitle className="text-sm font-medium">Нийт олгосон оноо</CardTitle>
                                    <Activity className="h-4 w-4 text-muted-foreground" />
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-semibold">{stats.totalGiven.toLocaleString('mn-MN')}</div>
                                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                                        <ArrowUpRight className="w-3 h-3 text-emerald-500" />
                                        Сүүлийн 30 хоногт: {stats.givenLast30.toLocaleString('mn-MN')} оноо
                                    </p>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <CardTitle className="text-sm font-medium">Идэвхтэй ажилтнууд</CardTitle>
                                    <Users className="h-4 w-4 text-muted-foreground" />
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-semibold">{stats.activeCount}</div>
                                    <p className="text-xs text-muted-foreground">сүүлийн 30 хоногт оноо өгсөн/хүлээн авсан</p>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <CardTitle className="text-sm font-medium">Түгээмэл үнэт зүйл</CardTitle>
                                    <Award className="h-4 w-4 text-muted-foreground" />
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-semibold truncate" title={topValueTitle}>{topValueTitle}</div>
                                    <p className="text-xs text-muted-foreground">{stats.topValueCount} удаа сонгогдсон</p>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <CardTitle className="text-sm font-medium">Зарцуулсан оноо</CardTitle>
                                    <ArrowDownRight className="h-4 w-4 text-rose-500" />
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-semibold">{stats.redeemedThisYear.toLocaleString('mn-MN')}</div>
                                    <p className="text-xs text-muted-foreground">
                                        энэ жил дэлгүүрээс зарцуулсан ({(stats.redeemedThisYear * budgetData.pointMNT).toLocaleString()}₮)
                                    </p>
                                </CardContent>
                            </Card>
                        </div>
                    </div>

                    {/* ===== CHARTS & TRANSACTIONS ===== */}
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                        <Card className="col-span-4">
                            <CardHeader>
                                <CardTitle>Үнэт зүйлсийн идэвх</CardTitle>
                                <CardDescription>Сүүлийн талархлуудын хуваарилалт</CardDescription>
                            </CardHeader>
                            <CardContent className="pl-2">
                                {values && values.length > 0 ? (
                                    <div className="h-[200px] space-y-3 overflow-y-auto">
                                        {(recognitionPosts || []).length > 0 ? values.map((v) => {
                                            const cnt = (recognitionPosts || []).filter((p: { valueId?: string }) => p.valueId === v.id).length;
                                            const maxCnt = Math.max(1, ...values.map(vv => (recognitionPosts || []).filter((p: { valueId?: string }) => p.valueId === vv.id).length));
                                            const pct = maxCnt ? (cnt / maxCnt) * 100 : 0;
                                            return (
                                                <div key={v.id} className="flex items-center gap-3">
                                                    <span className="text-xs font-medium text-muted-foreground w-24 shrink-0 truncate" title={v.title}>{v.title}</span>
                                                    <div className="flex-1 h-6 rounded bg-muted overflow-hidden" title={`${v.title}: ${cnt}`}>
                                                        <div className="h-full rounded bg-primary/80 transition-all" style={{ width: `${pct}%`, minWidth: cnt ? 4 : 0 }} />
                                                    </div>
                                                    <span className="text-xs text-muted-foreground w-8 shrink-0">{cnt}</span>
                                                </div>
                                            );
                                        }) : (
                                            <div className="flex items-center justify-center h-full text-muted-foreground/70 text-sm">Талархал оруулахад үнэт зүйлсийн идэвх энд харагдана.</div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="h-[200px] flex items-center justify-center border border-dashed rounded-md bg-muted/10">
                                        <BarChart className="w-10 h-10 text-muted-foreground/30" />
                                        <span className="ml-2 text-muted-foreground/50">Үнэт зүйлс тохируулаад талархал өгч эхлэнэ</span>
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        <Card className="col-span-3">
                            <CardHeader>
                                <CardTitle>Сүүлийн гүйлгээнүүд</CardTitle>
                                <CardDescription>Пойнтын бүх гүйлгээ: талархал, төслийн хуваарилалт, худалдан авалт</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    {(transactions || []).slice(0, 10).map((tx, idx) => {
                                        const userName = empMap.get(tx.userId) || tx.userId;
                                        const created = tx.createdAt;
                                        const when = created
                                            ? (typeof created === 'object' && 'toDate' in created ? formatDistanceToNow(created.toDate!(), { addSuffix: true, locale: mn }) : formatDistanceToNow(new Date(created as string), { addSuffix: true, locale: mn }))
                                            : '—';
                                        const amt = Number(tx.amount);
                                        const isPositive = amt > 0;
                                        let label = '';
                                        if (tx.type === 'RECEIVED' && tx.projectId) {
                                            label = tx.description || 'Төслийн оноо хүлээн авсан';
                                        } else if (tx.type === 'RECEIVED' && tx.fromUserId) {
                                            const fromName = empMap.get(tx.fromUserId) || tx.fromUserId;
                                            label = `${fromName}-аас талархал`;
                                        } else if (tx.type === 'GIVEN') {
                                            if (tx.toUserIds && tx.toUserIds.length > 0) {
                                                const names = tx.toUserIds
                                                    .map(id => empMap.get(id) || id)
                                                    .join(', ');
                                                label = tx.toUserIds.length === 1
                                                    ? `${names}-д талархал`
                                                    : `${names} нарт талархал`;
                                            } else {
                                                label = 'Талархал өгсөн';
                                            }
                                        } else if (tx.type === 'REDEEMED') {
                                            label = tx.description || 'Худалдан авалт';
                                        } else if (tx.type === 'ADJUSTMENT' || tx.type === 'PENALTY') {
                                            label = tx.description || tx.type;
                                        } else {
                                            label = tx.description || tx.type;
                                        }
                                        return (
                                            <div key={tx.id || `tx-${idx}`} className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-semibold text-muted-foreground">
                                                    {userName.charAt(0) || '?'}
                                                </div>
                                                <div className="flex-1 min-w-0 space-y-1">
                                                    <p className="text-sm font-medium leading-none truncate">{userName}</p>
                                                    <p className="text-xs text-muted-foreground truncate" title={label}>
                                                        {label}
                                                        <span className={isPositive ? 'text-emerald-600 dark:text-emerald-400 ml-1' : 'text-rose-600 dark:text-rose-400 ml-1'}>
                                                            {isPositive ? '+' : ''}{amt} оноо
                                                        </span>
                                                    </p>
                                                </div>
                                                <div className="text-[10px] text-muted-foreground shrink-0">{when}</div>
                                            </div>
                                        );
                                    })}
                                    {(!transactions || transactions.length === 0) && (
                                        <div className="text-center py-6 text-muted-foreground text-sm">Одоогоор гүйлгээ байхгүй.</div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                <TabsContent value="leaderboard" className="animate-in fade-in slide-in-from-bottom-2">
                    <Leaderboard />
                </TabsContent>

                <TabsContent value="rewards" className="animate-in fade-in slide-in-from-bottom-2">
                    <RewardManager />
                </TabsContent>

                <TabsContent value="requests" className="animate-in fade-in slide-in-from-bottom-2">
                    <RedemptionManager />
                </TabsContent>

                <TabsContent value="budget-requests" className="animate-in fade-in slide-in-from-bottom-2">
                    <BudgetRequestManager />
                </TabsContent>

                <TabsContent value="settings" className="animate-in fade-in slide-in-from-bottom-2">
                    <PointConfigManager />
                </TabsContent>
            </Tabs>
        </div>
    );
}
