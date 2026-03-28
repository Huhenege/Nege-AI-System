'use client';

import { useMemo } from 'react';
import { useFetchCollection, useTenantWrite } from '@/firebase';
import { isSystemUser } from '@/lib/employee-utils';
import { query, orderBy, collectionGroup } from 'firebase/firestore';
import { UserPointProfile } from '@/types/points';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Trophy, Medal, Star, TrendingUp, Coins, Gift } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

// ─── Types ────────────────────────────────────────────────────────────────────

interface EmployeeBasic {
    id: string;
    firstName?: string;
    lastName?: string;
    position?: string;
    departmentName?: string;
    avatarUrl?: string;
}

interface LeaderEntry {
    employeeId: string;
    name: string;
    position?: string;
    balance: number;
    totalEarned: number;
    totalGiven: number;
}

// ─── Rank badge ───────────────────────────────────────────────────────────────

function RankBadge({ rank }: { rank: number }) {
    if (rank === 1) return (
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-yellow-300 to-yellow-500 flex items-center justify-center shadow-md shadow-yellow-200">
            <Trophy className="w-4 h-4 text-white" />
        </div>
    );
    if (rank === 2) return (
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-slate-300 to-slate-400 flex items-center justify-center shadow-sm">
            <Medal className="w-4 h-4 text-white" />
        </div>
    );
    if (rank === 3) return (
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-sm shadow-amber-200">
            <Medal className="w-4 h-4 text-white" />
        </div>
    );
    return (
        <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-sm font-bold text-muted-foreground">
            {rank}
        </div>
    );
}

// ─── Top 3 podium card ────────────────────────────────────────────────────────

function PodiumCard({ entry, rank }: { entry: LeaderEntry; rank: 1 | 2 | 3 }) {
    const styles = {
        1: { order: 'order-2', height: 'h-24', bg: 'from-yellow-50 to-amber-50', border: 'border-yellow-200', text: 'text-yellow-700', ring: 'ring-2 ring-yellow-300' },
        2: { order: 'order-1', height: 'h-16', bg: 'from-slate-50 to-slate-100', border: 'border-slate-200', text: 'text-slate-600', ring: 'ring-1 ring-slate-300' },
        3: { order: 'order-3', height: 'h-12', bg: 'from-amber-50 to-orange-50', border: 'border-amber-200', text: 'text-amber-700', ring: 'ring-1 ring-amber-200' },
    }[rank];

    return (
        <div className={`${styles.order} flex flex-col items-center gap-2 flex-1`}>
            {/* Avatar */}
            <div className={`w-14 h-14 rounded-full bg-gradient-to-br ${rank === 1 ? 'from-yellow-100 to-yellow-200' : rank === 2 ? 'from-slate-100 to-slate-200' : 'from-amber-100 to-amber-200'} flex items-center justify-center text-lg font-bold ${styles.text} ${styles.ring}`}>
                {entry.name.charAt(0).toUpperCase()}
            </div>
            <div className="text-center">
                <p className="text-sm font-semibold text-slate-800 truncate max-w-[90px]">{entry.name}</p>
                <p className="text-xs text-muted-foreground truncate max-w-[90px]">{entry.position || '—'}</p>
            </div>
            {/* Podium block */}
            <div className={`w-full ${styles.height} rounded-t-xl bg-gradient-to-b ${styles.bg} border ${styles.border} flex flex-col items-center justify-center gap-1`}>
                <Star className={`w-4 h-4 ${styles.text} fill-current`} />
                <span className={`text-sm font-bold ${styles.text}`}>{entry.balance.toLocaleString()}</span>
                <span className="text-[10px] text-muted-foreground">pts</span>
            </div>
        </div>
    );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function Leaderboard() {
    const { firestore, companyPath, tCollection } = useTenantWrite();

    // Ажилтнуудыг татна
    const employeesQuery = useMemo(() =>
        (firestore && companyPath) ? tCollection('employees') : null
        , [firestore, companyPath, tCollection]);

    const { data: employees, isLoading: empLoading } = useFetchCollection<EmployeeBasic>(employeesQuery);

    // Оноо профайлуудыг татна — employees/{id}/point_profile/main subcollection
    // collectionGroup ашиглана
    const profilesQuery = useMemo(() =>
        firestore ? query(collectionGroup(firestore, 'point_profile')) : null
        , [firestore]);

    const { data: profiles, isLoading: profLoading } = useFetchCollection<UserPointProfile & { id: string }>(profilesQuery);

    const isLoading = empLoading || profLoading;

    // Employee map
    const empMap = useMemo(() => {
        const m = new Map<string, EmployeeBasic & { id: string }>();
        (employees || []).forEach(e => m.set(e.id, e));
        return m;
    }, [employees]);

    // Leaderboard data: balance-аар эрэмбэлэх
    const leaderboard = useMemo((): LeaderEntry[] => {
        if (!profiles) return [];
        return profiles
            .filter(p => p.userId && (p.balance > 0 || p.totalEarned > 0))
            .map(p => {
                const emp = empMap.get(p.userId);
                // super_admin нь платформын хэрэглэгч — рейтингт харагдахгүй
                if (emp && isSystemUser(emp as any)) return null;
                const name = emp
                    ? [emp.firstName, emp.lastName].filter(Boolean).join(' ').trim() || p.userId
                    : p.userId;
                return {
                    employeeId: p.userId,
                    name,
                    position: (emp as any)?.positionTitle || (emp as any)?.position || undefined,
                    balance: p.balance || 0,
                    totalEarned: p.totalEarned || 0,
                    totalGiven: p.totalGiven || 0,
                };
            })
            .filter((e): e is NonNullable<typeof e> => e !== null)
            .sort((a, b) => b.balance - a.balance);
    }, [profiles, empMap]);

    const top3 = leaderboard.slice(0, 3);
    const rest = leaderboard.slice(3);
    const maxBalance = leaderboard[0]?.balance || 1;

    // Summary stats
    const totalPointsInCirculation = useMemo(() =>
        leaderboard.reduce((s, e) => s + e.balance, 0)
        , [leaderboard]);
    const totalEverGiven = useMemo(() =>
        leaderboard.reduce((s, e) => s + e.totalGiven, 0)
        , [leaderboard]);
    const activeCount = leaderboard.filter(e => e.totalEarned > 0).length;

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    if (leaderboard.length === 0) {
        return (
            <div className="text-center py-20 bg-muted/20 border-2 border-dashed rounded-3xl">
                <Trophy className="w-12 h-12 mx-auto mb-4 opacity-10" />
                <p className="text-muted-foreground font-medium">Одоогоор оноо хуримтлуулсан ажилтан байхгүй байна.</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Ажилтнууд талархал илгээж эхлэхэд рейтинг энд харагдана.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Summary stats */}
            <div className="grid grid-cols-3 gap-3">
                <Card className="bg-gradient-to-br from-primary/5 to-white">
                    <CardContent className="pt-4 pb-3 px-4">
                        <div className="flex items-center gap-2 mb-1">
                            <Coins className="w-4 h-4 text-primary" />
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Эргэлтэд буй оноо</p>
                        </div>
                        <p className="text-2xl font-bold text-primary">{totalPointsInCirculation.toLocaleString()}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-4 pb-3 px-4">
                        <div className="flex items-center gap-2 mb-1">
                            <Gift className="w-4 h-4 text-emerald-500" />
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Нийт бэлэглэсэн</p>
                        </div>
                        <p className="text-2xl font-bold text-emerald-600">{totalEverGiven.toLocaleString()}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-4 pb-3 px-4">
                        <div className="flex items-center gap-2 mb-1">
                            <TrendingUp className="w-4 h-4 text-blue-500" />
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Идэвхтэй ажилтан</p>
                        </div>
                        <p className="text-2xl font-bold text-blue-600">{activeCount}</p>
                    </CardContent>
                </Card>
            </div>

            {/* Podium — Top 3 */}
            {top3.length >= 2 && (
                <Card className="overflow-hidden">
                    <CardHeader className="bg-gradient-to-r from-yellow-50/60 to-amber-50/30 pb-3">
                        <CardTitle className="flex items-center gap-2 text-base">
                            <Trophy className="w-4 h-4 text-yellow-500" />
                            Шилдэг 3
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6 pb-4">
                        <div className="flex items-end justify-center gap-3 px-4">
                            {top3[1] && <PodiumCard entry={top3[1]} rank={2} />}
                            {top3[0] && <PodiumCard entry={top3[0]} rank={1} />}
                            {top3[2] && <PodiumCard entry={top3[2]} rank={3} />}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Full ranking list */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-base">Бүх рейтинг</CardTitle>
                    <CardDescription>{leaderboard.length} ажилтан оноо хуримтлуулсан</CardDescription>
                </CardHeader>
                <CardContent className="px-4 pb-4 space-y-2">
                    {leaderboard.map((entry, idx) => {
                        const rank = idx + 1;
                        const pct = maxBalance > 0 ? (entry.balance / maxBalance) * 100 : 0;
                        const isTop3 = rank <= 3;

                        return (
                            <div
                                key={entry.employeeId}
                                className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${isTop3 ? 'bg-gradient-to-r from-amber-50/40 to-transparent' : 'hover:bg-slate-50'}`}
                            >
                                {/* Rank */}
                                <RankBadge rank={rank} />

                                {/* Avatar */}
                                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                                    {entry.name.charAt(0).toUpperCase()}
                                </div>

                                {/* Name + bar */}
                                <div className="flex-1 min-w-0 space-y-1">
                                    <div className="flex items-center justify-between">
                                        <p className="text-sm font-semibold truncate">{entry.name}</p>
                                        <div className="flex items-center gap-3 shrink-0 ml-2">
                                            <span className="text-xs text-muted-foreground hidden sm:block">
                                                Нийт авсан: <span className="font-medium text-slate-700">{entry.totalEarned.toLocaleString()}</span>
                                            </span>
                                            <Badge variant={isTop3 ? 'default' : 'secondary'} className="text-xs min-w-[60px] justify-center">
                                                {entry.balance.toLocaleString()} pts
                                            </Badge>
                                        </div>
                                    </div>
                                    <Progress
                                        value={pct}
                                        className={`h-1.5 ${rank === 1 ? '[&>div]:bg-yellow-400' : rank === 2 ? '[&>div]:bg-slate-400' : rank === 3 ? '[&>div]:bg-amber-500' : '[&>div]:bg-primary/50'}`}
                                    />
                                    {entry.position && (
                                        <p className="text-[10px] text-muted-foreground truncate">{entry.position}</p>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </CardContent>
            </Card>
        </div>
    );
}
