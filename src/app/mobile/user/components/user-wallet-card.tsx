'use client';

import { useUser, useFirestore, useFetchDoc, useTenantWrite } from '@/firebase';
import { DocumentReference } from 'firebase/firestore';
import { UserPointProfile } from '@/types/points';
import { useMemo } from 'react';
import { Progress } from '@/components/ui/progress';
import { Gift, TrendingUp, Wallet, ChevronRight, Award, Star } from 'lucide-react';

export function UserWalletCard() {
    const { user } = useUser();
    const firestore = useFirestore();
    const { tDoc } = useTenantWrite();

    // Real-time listener for the user's point profile
    const profileRef = useMemo(() =>
        (user && firestore)
            ? tDoc('employees', user.uid, 'point_profile', 'main') as DocumentReference<UserPointProfile>
            : null,
        [user?.uid, firestore, tDoc]);

    const { data: profile } = useFetchDoc<UserPointProfile>(profileRef);

    const balance = profile?.balance || 0;
    const allowance = profile?.monthlyAllowance || 0;
    const allowanceMax = 100;

    return (
        <div className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-3xl p-6 shadow-xl shadow-indigo-200 mt-4 relative overflow-hidden group transition-all active:scale-[0.99] text-white">
            {/* Abstract Shapes Decor */}
            <div className="absolute right-0 top-0 w-40 h-40 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl pointer-events-none"></div>
            <div className="absolute left-0 bottom-0 w-32 h-32 bg-purple-500/30 rounded-full -ml-10 -mb-10 blur-xl pointer-events-none"></div>

            <div className="flex items-start justify-between mb-4 relative z-10">
                <div className="flex flex-col">
                    <div className="flex items-center gap-2 mb-1 opacity-90">
                        <div className="p-1.5 bg-white/20 rounded-lg backdrop-blur-sm">
                            <Star className="w-4 h-4 text-yellow-300 fill-yellow-300" />
                        </div>
                        <h2 className="text-sm font-semibold tracking-wider uppercase">HR Point</h2>
                    </div>
                    <p className="text-[10px] text-indigo-100 opacity-80">Таны урамшууллын данс</p>
                </div>

                <div className="h-8 w-8 rounded-full bg-white/10 flex items-center justify-center text-white/80 group-hover:bg-white/20 transition-colors backdrop-blur-md">
                    <ChevronRight className="w-5 h-5" />
                </div>
            </div>

            <div className="relative z-10 mt-6">
                <div className="flex items-baseline gap-2">
                    <span className="text-5xl font-semibold tracking-tight drop-shadow-sm">{balance.toLocaleString()}</span>
                    <span className="text-lg font-medium opacity-80">оноо</span>
                </div>
            </div>

            {/* Allowance Section Mini */}
            <div className="mt-6 bg-black/20 rounded-xl p-3 backdrop-blur-sm border border-white/5 relative z-10">
                <div className="flex justify-between items-center mb-2 text-xs">
                    <span className="font-medium text-indigo-100 flex items-center gap-1.5 opacity-90">
                        <Gift className="w-3.5 h-3.5" />
                        Бэлэглэх эрх
                    </span>
                    <span className="font-semibold">{allowance} / {allowanceMax}</span>
                </div>
                <Progress value={(allowance / allowanceMax) * 100} className="h-1.5 bg-white/10" indicatorClassName="bg-gradient-to-r from-yellow-300 to-orange-400" />
            </div>
        </div>
    );
}
