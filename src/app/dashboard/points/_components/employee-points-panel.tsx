'use client';

import { useState, useMemo } from 'react';
import { useFetchCollection, useCollection, useTenantWrite } from '@/firebase';
import { isSystemUser } from '@/lib/employee-utils';
import { query, orderBy, where, limit, collectionGroup } from 'firebase/firestore';
import { UserPointProfile, PointTransaction, PointsConfig } from '@/types/points';
import { Employee } from '@/types/index';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import {
    Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet';
import {
    Loader2, Search, Gift, ShoppingBag, ArrowDownLeft,
    History, Star, Users, TrendingUp,
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { mn } from 'date-fns/locale';

// ─── Types ────────────────────────────────────────────────────────────────────

interface EmployeeWithPoints {
    id: string;
    firstName?: string;
    lastName?: string;
    jobTitle?: string;
    status?: string;
    balance: number;
    totalEarned: number;
    totalGiven: number;
    monthlyAllowance: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getDate(created: any): Date | null {
    if (!created) return null;
    try {
        return typeof created === 'object' && 'toDate' in created
            ? created.toDate()
            : new Date(created as string);
    } catch { return null; }
}

function Avatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' | 'lg' }) {
    const sz = {
        sm: 'w-7 h-7 text-[10px]',
        md: 'w-9 h-9 text-sm',
        lg: 'w-14 h-14 text-xl',
    }[size];
    return (
        <div className={`${sz} rounded-full bg-primary/10 flex items-center justify-center font-semibold text-primary shrink-0`}>
            {name.charAt(0).toUpperCase()}
        </div>
    );
}

// ─── Detail Sheet ─────────────────────────────────────────────────────────────

function EmployeeDetailSheet({
    emp,
    open,
    onClose,
    empMap,
    monthlyAllowanceBase,
}: {
    emp: EmployeeWithPoints | null;
    open: boolean;
    onClose: () => void;
    empMap: Map<string, string>;
    monthlyAllowanceBase: number;
}) {
    const { firestore, companyPath, tCollection } = useTenantWrite();

    const txQuery = useMemo(() =>
        (firestore && companyPath && emp)
            ? query(
                tCollection('point_transactions'),
                where('userId', '==', emp.id),
                orderBy('createdAt', 'desc'),
                limit(40)
            )
            : null
        , [firestore, companyPath, emp?.id, tCollection]);

    const { data: txList, isLoading: txLoading } = useCollection<PointTransaction>(txQuery);

    const fullName = emp ? [emp.firstName, emp.lastName].filter(Boolean).join(' ') || emp.id : '';
    const allowancePct = monthlyAllowanceBase > 0 && emp
        ? Math.min(100, (emp.monthlyAllowance / monthlyAllowanceBase) * 100)
        : 0;

    // Сарын breakdown (сүүлийн 6 сар)
    const monthlyBreakdown = useMemo(() => {
        const map = new Map<string, { received: number; given: number; redeemed: number }>();
        (txList || []).forEach(tx => {
            const d = getDate(tx.createdAt);
            if (!d) return;
            const key = format(d, 'yyyy/MM');
            if (!map.has(key)) map.set(key, { received: 0, given: 0, redeemed: 0 });
            const row = map.get(key)!;
            const abs = Math.abs(Number(tx.amount));
            if (tx.type === 'RECEIVED') row.received += abs;
            else if (tx.type === 'GIVEN') row.given += abs;
            else if (tx.type === 'REDEEMED') row.redeemed += abs;
        });
        return Array.from(map.entries())
            .sort(([a], [b]) => b.localeCompare(a))
            .slice(0, 6);
    }, [txList]);

    if (!emp) return null;

    return (
        <Sheet open={open} onOpenChange={v => !v && onClose()}>
            <SheetContent className="w-full sm:max-w-lg overflow-y-auto space-y-5 pb-10">
                {/* Header */}
                <SheetHeader>
                    <div className="flex items-center gap-3 pt-2">
                        <Avatar name={fullName || '?'} size="lg" />
                        <div>
                            <SheetTitle className="text-lg leading-tight">{fullName}</SheetTitle>
                            <SheetDescription>{emp.jobTitle || '—'}</SheetDescription>
                        </div>
                    </div>
                </SheetHeader>

                {/* Stats grid */}
                <div className="grid grid-cols-2 gap-3">
                    <div className="bg-primary/5 rounded-xl p-3 border border-primary/10">
                        <p className="text-[10px] text-primary/70 uppercase tracking-wider font-medium mb-0.5">Үлдэгдэл</p>
                        <p className="text-2xl font-bold text-primary leading-none">{emp.balance.toLocaleString()}</p>
                        <p className="text-[10px] text-primary/50 mt-0.5">оноо</p>
                    </div>
                    <div className="bg-emerald-50 rounded-xl p-3 border border-emerald-100">
                        <p className="text-[10px] text-emerald-600 uppercase tracking-wider font-medium mb-0.5">Нийт авсан</p>
                        <p className="text-2xl font-bold text-emerald-700 leading-none">{emp.totalEarned.toLocaleString()}</p>
                        <p className="text-[10px] text-emerald-500 mt-0.5">оноо</p>
                    </div>
                    <div className="bg-blue-50 rounded-xl p-3 border border-blue-100">
                        <p className="text-[10px] text-blue-600 uppercase tracking-wider font-medium mb-0.5">Нийт бэлэглэсэн</p>
                        <p className="text-2xl font-bold text-blue-700 leading-none">{emp.totalGiven.toLocaleString()}</p>
                        <p className="text-[10px] text-blue-500 mt-0.5">оноо</p>
                    </div>
                    <div className="bg-amber-50 rounded-xl p-3 border border-amber-100">
                        <p className="text-[10px] text-amber-600 uppercase tracking-wider font-medium mb-0.5">Сарын эрх</p>
                        <p className="text-2xl font-bold text-amber-700 leading-none">{emp.monthlyAllowance.toLocaleString()}</p>
                        <Progress value={allowancePct} className="h-1 mt-1.5 [&>div]:bg-amber-400" />
                    </div>
                </div>

                {/* Monthly breakdown */}
                {monthlyBreakdown.length > 0 && (
                    <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Сарын хураангуй</p>
                        <div className="space-y-1.5">
                            {monthlyBreakdown.map(([month, data]) => (
                                <div key={month} className="flex items-center gap-3 text-xs bg-slate-50 rounded-lg px-3 py-2 border">
                                    <span className="font-medium text-slate-500 w-16 shrink-0">{month}</span>
                                    <div className="flex gap-3 flex-wrap">
                                        {data.received > 0 && <span className="text-emerald-600 font-medium">+{data.received.toLocaleString()}</span>}
                                        {data.given > 0 && <span className="text-blue-500">−{data.given.toLocaleString()} өгсөн</span>}
                                        {data.redeemed > 0 && <span className="text-rose-500">−{data.redeemed.toLocaleString()} зарцуулсан</span>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Transaction history */}
                <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Гүйлгээний түүх</p>
                    {txLoading ? (
                        <div className="flex justify-center py-8">
                            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                        </div>
                    ) : !txList || txList.length === 0 ? (
                        <p className="text-sm text-center text-muted-foreground py-8">Гүйлгээ байхгүй</p>
                    ) : (
                        <div className="space-y-1">
                            {txList.map((tx, i) => {
                                const d = getDate(tx.createdAt);
                                const when = d ? formatDistanceToNow(d, { addSuffix: true, locale: mn }) : '—';
                                const amt = Number(tx.amount);
                                const isPos = amt > 0;

                                let label = '';
                                let icon = <History className="w-3.5 h-3.5" />;
                                let bg = 'bg-slate-100 text-slate-500';

                                if (tx.type === 'RECEIVED' && (tx as any).fromUserId) {
                                    const from = empMap.get((tx as any).fromUserId) || (tx as any).fromUserId;
                                    label = `${from}-аас талархал`;
                                    icon = <ArrowDownLeft className="w-3.5 h-3.5" />;
                                    bg = 'bg-emerald-100 text-emerald-600';
                                } else if (tx.type === 'RECEIVED' && (tx as any).projectId) {
                                    label = tx.description || 'Төслийн оноо';
                                    icon = <Star className="w-3.5 h-3.5" />;
                                    bg = 'bg-emerald-100 text-emerald-600';
                                } else if (tx.type === 'RECEIVED') {
                                    label = 'Оноо хүлээн авсан';
                                    icon = <ArrowDownLeft className="w-3.5 h-3.5" />;
                                    bg = 'bg-emerald-100 text-emerald-600';
                                } else if (tx.type === 'GIVEN') {
                                    const toIds = (tx as any).toUserIds as string[] | undefined;
                                    if (toIds?.length) {
                                        const names = toIds.map(id => empMap.get(id) || id).join(', ');
                                        label = toIds.length === 1 ? `${names}-д талархал` : `${names} нарт`;
                                    } else {
                                        label = 'Талархал өгсөн';
                                    }
                                    icon = <Gift className="w-3.5 h-3.5" />;
                                    bg = 'bg-blue-100 text-blue-500';
                                } else if (tx.type === 'REDEEMED') {
                                    label = tx.description || 'Худалдан авалт';
                                    icon = <ShoppingBag className="w-3.5 h-3.5" />;
                                    bg = 'bg-rose-100 text-rose-500';
                                } else {
                                    label = tx.description || tx.type;
                                }

                                return (
                                    <div key={tx.id || i} className="flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-slate-50 transition-colors">
                                        <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${bg}`}>
                                            {icon}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm truncate">{label}</p>
                                            <p className="text-[10px] text-muted-foreground">{when}</p>
                                        </div>
                                        <span className={`text-sm font-semibold shrink-0 ${isPos ? 'text-emerald-600' : 'text-slate-600'}`}>
                                            {isPos ? '+' : ''}{amt.toLocaleString()}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </SheetContent>
        </Sheet>
    );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function EmployeePointsPanel() {
    const { firestore, companyPath, tCollection } = useTenantWrite();
    const [search, setSearch] = useState('');
    const [selected, setSelected] = useState<EmployeeWithPoints | null>(null);

    // Ажилтнууд
    const empQuery = useMemo(() =>
        (firestore && companyPath) ? tCollection('employees') : null
        , [firestore, companyPath, tCollection]);
    const { data: employees, isLoading: empLoading } =
        useFetchCollection<Employee>(empQuery);

    // Point profiles — collectionGroup
    const profilesQuery = useMemo(() =>
        firestore ? query(collectionGroup(firestore, 'point_profile')) : null
        , [firestore]);
    const { data: profiles, isLoading: profLoading } =
        useFetchCollection<UserPointProfile & { id: string }>(profilesQuery);

    // Config
    const configQuery = useMemo(() =>
        (firestore && companyPath) ? tCollection('points_config') : null
        , [firestore, companyPath, tCollection]);
    const { data: configs } =
        useFetchCollection<PointsConfig & { id: string }>(configQuery);
    const monthlyAllowanceBase = configs?.[0]?.monthlyAllowanceBase ?? 1000;

    // Profile map — userId → profile
    const profileMap = useMemo(() => {
        const m = new Map<string, UserPointProfile>();
        (profiles || []).forEach(p => {
            if (p.userId) m.set(p.userId, p);
        });
        return m;
    }, [profiles]);

    // Employee name map
    const empMap = useMemo(() => {
        const m = new Map<string, string>();
        (employees || []).forEach(e =>
            m.set(e.id, [e.firstName, e.lastName].filter(Boolean).join(' ').trim() || e.id)
        );
        return m;
    }, [employees]);

    // Merge: employee + point profile (super_admin хасна)
    const merged = useMemo((): EmployeeWithPoints[] => {
        return (employees || []).filter(e => !isSystemUser(e as any)).map(e => {
            const p = profileMap.get(e.id);
            return {
                id: e.id,
                firstName: e.firstName,
                lastName: e.lastName,
                jobTitle: e.jobTitle,
                status: e.status,
                balance: p?.balance || 0,
                totalEarned: p?.totalEarned || 0,
                totalGiven: p?.totalGiven || 0,
                monthlyAllowance: p?.monthlyAllowance || 0,
            };
        });
    }, [employees, profileMap]);

    // Хайлт
    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return merged;
        return merged.filter(e => {
            const name = [e.firstName, e.lastName].join(' ').toLowerCase();
            return name.includes(q) || (e.jobTitle || '').toLowerCase().includes(q);
        });
    }, [merged, search]);

    // Эрэмбэлэлт — balance-аар буурах
    const sorted = useMemo(() =>
        [...filtered].sort((a, b) => b.balance - a.balance)
        , [filtered]);

    const isLoading = empLoading || profLoading;
    const maxBalance = sorted[0]?.balance || 1;

    // Summary
    const totalBalance = merged.reduce((s, e) => s + e.balance, 0);
    const activeCount = merged.filter(e => e.totalEarned > 0).length;
    const zeroCount = merged.filter(e => e.balance === 0).length;

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <>
            <div className="space-y-5">
                {/* Summary */}
                <div className="grid grid-cols-3 gap-3">
                    <Card>
                        <CardContent className="pt-4 pb-3 px-4">
                            <div className="flex items-center gap-2 mb-1">
                                <Users className="w-4 h-4 text-slate-400" />
                                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Нийт ажилтан</p>
                            </div>
                            <p className="text-2xl font-bold">{merged.length}</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="pt-4 pb-3 px-4">
                            <div className="flex items-center gap-2 mb-1">
                                <TrendingUp className="w-4 h-4 text-emerald-500" />
                                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Идэвхтэй</p>
                            </div>
                            <p className="text-2xl font-bold text-emerald-600">{activeCount}</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="pt-4 pb-3 px-4">
                            <div className="flex items-center gap-2 mb-1">
                                <Star className="w-4 h-4 text-primary" />
                                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Нийт үлдэгдэл</p>
                            </div>
                            <p className="text-2xl font-bold text-primary">{totalBalance.toLocaleString()}</p>
                        </CardContent>
                    </Card>
                </div>

                {/* Search */}
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                        placeholder="Нэр, албан тушаалаар хайх..."
                        className="pl-9"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>

                {/* List */}
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base">Ажилтан бүрийн оноо</CardTitle>
                        <CardDescription>
                            {sorted.length} ажилтан · {zeroCount > 0 && `${zeroCount} нь оноогүй`}
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="px-3 pb-3 space-y-1">
                        {sorted.length === 0 ? (
                            <p className="text-sm text-center text-muted-foreground py-8">Хайлтын үр дүн олдсонгүй.</p>
                        ) : sorted.map((emp, idx) => {
                            const fullName = [emp.firstName, emp.lastName].filter(Boolean).join(' ') || emp.id;
                            const pct = maxBalance > 0 ? (emp.balance / maxBalance) * 100 : 0;
                            const isActive = emp.totalEarned > 0;

                            return (
                                <button
                                    key={emp.id}
                                    onClick={() => setSelected(emp)}
                                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-50 active:bg-slate-100 transition-colors text-left group"
                                >
                                    {/* Rank */}
                                    <span className="text-xs text-muted-foreground w-5 shrink-0 text-right">{idx + 1}</span>

                                    {/* Avatar */}
                                    <Avatar name={fullName} size="sm" />

                                    {/* Info */}
                                    <div className="flex-1 min-w-0 space-y-0.5">
                                        <div className="flex items-center justify-between gap-2">
                                            <p className="text-sm font-medium truncate">{fullName}</p>
                                            <Badge
                                                variant={emp.balance > 0 ? 'default' : 'secondary'}
                                                className="text-xs shrink-0"
                                            >
                                                {emp.balance.toLocaleString()} pts
                                            </Badge>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Progress
                                                value={pct}
                                                className="h-1 flex-1 [&>div]:bg-primary/60"
                                            />
                                            {!isActive && (
                                                <span className="text-[10px] text-muted-foreground shrink-0">идэвхгүй</span>
                                            )}
                                        </div>
                                    </div>
                                </button>
                            );
                        })}
                    </CardContent>
                </Card>
            </div>

            {/* Detail sheet */}
            <EmployeeDetailSheet
                emp={selected}
                open={!!selected}
                onClose={() => setSelected(null)}
                empMap={empMap}
                monthlyAllowanceBase={monthlyAllowanceBase}
            />
        </>
    );
}
