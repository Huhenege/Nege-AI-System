'use client';

import { useAuth, useDoc, useFirestore, useUser, useTenantWrite } from '@/firebase';
import { DocumentReference } from 'firebase/firestore';
import { UserPointProfile } from '@/types/points';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Gift, Send, TrendingUp } from 'lucide-react';
import { useMemo } from 'react';

export function MyPointStats() {
    const { user } = useUser();
    const firestore = useFirestore();
    const { tDoc } = useTenantWrite();

    // Real-time listener for the user's point profile
    const profileRef = useMemo(() =>
        (user && firestore)
            ? tDoc('employees', user.uid, 'point_profile', 'main') as DocumentReference<UserPointProfile>
            : null,
        [user, firestore, tDoc]);

    const { data: profile } = useDoc<UserPointProfile>(profileRef);

    const balance = profile?.balance || 0;
    const allowance = profile?.monthlyAllowance || 0;
    const totalGiven = profile?.totalGiven || 0;

    // Assuming a standard allowance of 100 for visual progress, this should be dynamic in real app
    const allowanceMax = 100;

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {/* 1. Wallet Balance (Spendable) */}
            <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                        <Gift className="w-4 h-4 text-primary" /> Миний хэтэвч
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-3xl font-semibold text-primary">{balance} <span className="text-sm font-normal text-muted-foreground">оноо</span></div>
                    <p className="text-xs text-muted-foreground mt-1">Шагнал авахад зарцуулах боломжтой</p>
                </CardContent>
            </Card>

            {/* 2. Monthly Allowance (Givable) */}
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                        <Send className="w-4 h-4 text-green-500" /> Сар бүрийн эрх
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex justify-between items-end mb-2">
                        <div className="text-2xl font-semibold">{allowance}</div>
                        <div className="text-xs text-muted-foreground">сар бүр шинэчлэгдэнэ</div>
                    </div>
                    <Progress value={(allowance / allowanceMax) * 100} className="h-2" />
                    <p className="text-xs text-muted-foreground mt-2">Бусдад бэлэглэх боломжтой үлдэгдэл</p>
                </CardContent>
            </Card>

            {/* 3. Impact Stat */}
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-blue-500" /> Миний оролцоо
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-semibold">{totalGiven}</div>
                    <p className="text-xs text-muted-foreground mt-1">Хамт олондоо бэлэглэсэн нийт оноо</p>
                </CardContent>
            </Card>
        </div>
    );
}
