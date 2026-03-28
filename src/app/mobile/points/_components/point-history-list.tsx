'use client';

import { useMemo, useEffect } from 'react';
import { useUser, useFirestore, useCollection, tenantCollection, useTenantWrite, useFetchCollection } from '@/firebase';
import { query, where, orderBy, limit } from 'firebase/firestore';
import { PointTransaction } from '@/types/points';
import { format } from 'date-fns';
import { ArrowDownLeft, Gift, ShoppingBag, History } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

export function PointHistoryList() {
    const { user } = useUser();
    const { firestore, companyPath, tCollection } = useTenantWrite();

    const q = useMemo(() =>
        (user && firestore && companyPath)
            ? query(tenantCollection(firestore, companyPath, 'point_transactions'), where('userId', '==', user.uid), orderBy('createdAt', 'desc'), limit(50))
            : null
        , [user?.uid, firestore, companyPath]);

    const { data: transactions, isLoading, error } = useCollection<PointTransaction>(q);

    // Ажилтны нэрийг харуулахад
    const empQuery = useMemo(() =>
        (firestore && companyPath) ? tCollection('employees') : null
        , [firestore, companyPath, tCollection]);
    const { data: employees } = useFetchCollection<{ id: string; firstName?: string; lastName?: string }>(empQuery);
    const empMap = useMemo(() => {
        const m = new Map<string, string>();
        (employees || []).forEach(e =>
            m.set(e.id, [e.firstName, e.lastName].filter(Boolean).join(' ').trim() || e.id)
        );
        return m;
    }, [employees]);

    useEffect(() => {
        if (error) {
            console.error("History Error:", error);
        }
    }, [error]);

    if (error) {
        if (error.code === 'failed-precondition' || error.message.includes('index')) {
            return (
                <div className="p-4 bg-orange-50 rounded-xl border border-orange-100 text-center">
                    <p className="text-xs text-orange-600 font-semibold mb-1">Системийн тохиргоо шаардлагатай</p>
                    <p className="text-[10px] text-orange-500">Firestore Index үүсгэх хэрэгтэй (Developer console-оо шалгана уу)</p>
                </div>
            );
        }
        return <div className="p-4 text-xs text-red-400 text-center">Алдаа гарлаа: {error.message}</div>;
    }

    if (isLoading) {
        return (
            <div className="space-y-3 px-1">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full rounded-2xl" />)}
            </div>
        );
    }

    if (!transactions || transactions.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-10 text-center opacity-50">
                <History className="w-10 h-10 mb-2 text-slate-300" />
                <p className="text-sm font-medium text-slate-500">Гүйлгээний түүх одоогоор алга</p>
                <p className="text-xs text-slate-400 mt-1">Таны хийсэн гүйлгээнүүд энд харагдана</p>
            </div>
        )
    }

    return (
        <div className="space-y-3 px-1">
            {transactions.map((tx) => {
                const isPositive = tx.amount > 0;
                const dateLabel = (tx.createdAt && (tx.createdAt as any).toDate)
                    ? format((tx.createdAt as any).toDate(), 'yyyy-MM-dd HH:mm')
                    : 'Боловсруулж байна...';

                return (
                    <div key={tx.id} className="flex items-center justify-between bg-white p-3 rounded-2xl border border-slate-100 shadow-sm">
                        <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${tx.type === 'RECEIVED' ? 'bg-green-100 text-green-600' :
                                    tx.type === 'GIVEN' ? 'bg-orange-100 text-orange-600' :
                                        tx.type === 'REDEEMED' ? 'bg-indigo-100 text-indigo-600' :
                                            'bg-slate-100 text-slate-600'
                                }`}>
                                {tx.type === 'RECEIVED' && <ArrowDownLeft className="w-5 h-5" />}
                                {tx.type === 'GIVEN' && <Gift className="w-5 h-5" />}
                                {tx.type === 'REDEEMED' && <ShoppingBag className="w-5 h-5" />}
                                {!['RECEIVED', 'GIVEN', 'REDEEMED'].includes(tx.type) && <History className="w-5 h-5" />}
                            </div>
                            <div>
                                <div className="font-semibold text-slate-700 text-sm">
                                    {tx.type === 'RECEIVED' && tx.fromUserId
                                        ? `${empMap.get(tx.fromUserId) || 'Хэн нэгэн'}-аас талархал`
                                        : tx.type === 'RECEIVED' && tx.projectId
                                        ? tx.description || 'Төслийн оноо'
                                        : tx.type === 'RECEIVED'
                                        ? 'Оноо хүлээн авсан'
                                        : tx.type === 'GIVEN' && tx.toUserIds?.length
                                        ? (() => {
                                            const names = tx.toUserIds!.map(id => empMap.get(id) || id).join(', ');
                                            return tx.toUserIds!.length === 1 ? `${names}-д талархал` : `${names} нарт талархал`;
                                          })()
                                        : tx.type === 'GIVEN'
                                        ? 'Оноо бэлэглэсэн'
                                        : tx.type === 'REDEEMED'
                                        ? (tx.description || 'Худалдан авалт')
                                        : tsLabel(tx.type)}
                                </div>
                                <div className="text-[10px] text-slate-400">
                                    {dateLabel}
                                </div>
                            </div>
                        </div>
                        <div className={`font-semibold text-sm ${isPositive ? 'text-green-600' : 'text-slate-900'}`}>
                            {isPositive ? '+' : ''}{tx.amount}
                        </div>
                    </div>
                )
            })}
        </div>
    );
}

function tsLabel(type: string) {
    if (type === 'ADJUSTMENT') return 'Системийн засвар';
    if (type === 'PENALTY') return 'Торгууль';
    return type;
}
