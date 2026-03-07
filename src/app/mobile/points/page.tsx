'use client';

import { useState } from 'react';
import { useUser, useFirestore, useDoc, useTenantWrite } from '@/firebase';
import { DocumentReference } from 'firebase/firestore';
import { UserPointProfile } from '@/types/points';
import { useMemo, useEffect } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { PointsService } from '@/lib/points/points-service';
import { PointsConfig } from '@/types/points';

// Components
import { RecognitionFeed } from './_components/recognition-feed';
import { PointHistoryList } from './_components/point-history-list';
import { GivePointsDialog } from './_components/give-points-dialog';
import { RewardsList } from './_components/rewards-list';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import {
    Gift,
    ShoppingBag,
    History,
    Target,
    Trophy,
    Zap,
    Users,
    CalendarCheck,
    Briefcase,
    ChevronRight,
    Star
} from 'lucide-react';

// --- MOCK DATA FOR IDEAS ---
const WAYS_TO_EARN = [
    { title: 'Цаг баримтлал', points: '+50', icon: CalendarCheck, color: 'text-green-600', bg: 'bg-green-100', desc: 'Сар бүр хоцролтгүй ирвэл' },
    { title: 'Шинэ санаа', points: '+100', icon: Zap, color: 'text-yellow-600', bg: 'bg-yellow-100', desc: 'Innovation box-д санал өгөх' },
    { title: 'KPI Биелэлт', points: 'Auto', icon: Target, color: 'text-blue-600', bg: 'bg-blue-100', desc: 'Сарын үнэлгээ 95%+' },
    { title: 'Referral', points: '+500', icon: Users, color: 'text-purple-600', bg: 'bg-purple-100', desc: 'Ажилтан санал болгох' },
];

const REWARDS_SHOP = [
    { title: 'Coffee Voucher', cost: 500, img: '☕' },
    { title: 'Киноны тасалбар', cost: 1200, img: '🎬' },
    { title: 'Хагас өдрийн чөлөө', cost: 5000, img: '🏖️' },
    { title: 'Company Hoodie', cost: 8000, img: '👕' },
];

function PointCard({ balance, allowance, baseAllowance }: { balance: number, allowance: number, baseAllowance: number }) {
    const progress = baseAllowance > 0 ? (allowance / baseAllowance) * 100 : 0;

    return (
        <div className="relative overflow-hidden rounded-[32px] bg-gradient-to-br from-[#1a1f3c] to-[#2d3766] p-6 text-white shadow-2xl shadow-indigo-200/50">
            {/* Background Effects */}
            <div className="absolute -right-10 -top-10 h-64 w-64 rounded-full bg-indigo-500/20 blur-3xl" />
            <div className="absolute -left-10 -bottom-10 h-40 w-40 rounded-full bg-purple-500/20 blur-2xl" />

            <div className="relative z-10 flex flex-col justify-between h-48">
                <div className="flex items-start justify-between">
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <div className="p-1.5 bg-white/10 rounded-lg backdrop-blur-sm">
                                <Star className="w-5 h-5 text-yellow-400 fill-yellow-400" />
                            </div>
                            <span className="font-semibold tracking-wider text-sm opacity-90">HR GOLD MEMBER</span>
                        </div>
                    </div>
                    {/* Chip */}
                    <div className="w-12 h-9 rounded-md bg-gradient-to-tr from-yellow-200 to-yellow-500 opacity-80 shadow-inner border border-white/20" />
                </div>

                <div>
                    <p className="text-indigo-200 text-xs font-medium uppercase tracking-wider mb-1">Нийт үлдэгдэл</p>
                    <div className="flex items-baseline gap-2">
                        <h1 className="text-5xl font-semibold tracking-tighter drop-shadow-lg">{balance.toLocaleString()}</h1>
                        <span className="text-lg opacity-80 font-medium">pts</span>
                    </div>
                </div>

                <div className="mt-auto">
                    <div className="flex justify-between text-xs text-indigo-200 mb-2">
                        <span>Бэлэглэх эрх (Сар бүр)</span>
                        <span className="text-white font-semibold">{allowance.toLocaleString()} / {baseAllowance.toLocaleString()}</span>
                    </div>
                    <Progress value={progress} className="h-1.5 bg-white/10" indicatorClassName="bg-gradient-to-r from-blue-400 to-indigo-400" />
                </div>
            </div>
        </div>
    );
}

export default function MobilePointsPage() {
    const { user } = useUser();
    const firestore = useFirestore();
    const { tDoc } = useTenantWrite();
    const [activeTab, setActiveTab] = useState('feed');

    const profileRef = useMemo(() =>
        (user && firestore)
            ? tDoc('employees', user.uid, 'point_profile', 'main') as DocumentReference<UserPointProfile>
            : null,
        [user?.uid, firestore, tDoc]);

    const { data: profile } = useDoc<UserPointProfile>(profileRef);

    // Fetch system points config
    const configRef = useMemo(() =>
        firestore ? tDoc('points_config', 'main') as DocumentReference<PointsConfig> : null
        , [firestore, tDoc]);
    const { data: config } = useDoc<PointsConfig>(configRef);

    const balance = profile?.balance || 0;
    const allowance = profile?.monthlyAllowance || 0;
    const baseAllowance = config?.monthlyAllowanceBase || 1000;

    // Trigger Monthly Reset Check
    useEffect(() => {
        if (user?.uid && firestore) {
            PointsService.checkAndResetAllowance(firestore, user.uid);
        }
    }, [user?.uid, firestore]);

    return (
        <div className="flex flex-col min-h-screen bg-slate-50/50 pb-20">
            {/* Simple Header */}
            <div className="bg-white/80 backdrop-blur-xl sticky top-0 z-20 px-4 py-3 flex items-center justify-between border-b border-slate-100">
                <h1 className="text-lg font-semibold text-slate-800">HR Point</h1>
                <div className="flex gap-2">
                    <Button variant="ghost" size="icon" className="rounded-full" onClick={() => setActiveTab('history')}>
                        <History className="w-5 h-5 text-slate-500" />
                    </Button>
                </div>
            </div>

            <div className="p-4 space-y-6">
                {/* 1. The Main Point Card */}
                <PointCard balance={balance} allowance={allowance} baseAllowance={baseAllowance} />

                {/* 2. Action Grid */}
                <div className="grid grid-cols-2 gap-3">
                    <GivePointsDialog triggerButton={
                        <button className="flex flex-col items-center justify-center gap-2 bg-white p-4 rounded-2xl shadow-sm border border-slate-100 active:scale-95 transition-transform">
                            <div className="h-10 w-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600">
                                <Gift className="w-5 h-5" />
                            </div>
                            <span className="text-sm font-semibold text-slate-700">Оноо Бэлэглэх</span>
                        </button>
                    } />

                    <button
                        onClick={() => setActiveTab('shop')}
                        className="flex flex-col items-center justify-center gap-2 bg-white p-4 rounded-2xl shadow-sm border border-slate-100 active:scale-95 transition-transform"
                    >
                        <div className="h-10 w-10 rounded-full bg-orange-50 flex items-center justify-center text-orange-600">
                            <ShoppingBag className="w-5 h-5" />
                        </div>
                        <span className="text-sm font-semibold text-slate-700">Rewards Дэлгүүр</span>
                    </button>
                </div>

                {/* 3. Ways to Earn (Horizontal Scroll) */}
                <div>
                    <div className="flex items-center justify-between px-1 mb-3">
                        <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide">Оноо цуглуулах</h3>
                        <span className="text-xs text-indigo-600 font-medium cursor-pointer">Бүгд &rarr;</span>
                    </div>
                    <ScrollArea className="w-full whitespace-nowrap">
                        <div className="flex w-max space-x-3 pb-4 px-1">
                            {WAYS_TO_EARN.map((item, i) => (
                                <div key={i} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 w-40 flex flex-col gap-3 active:scale-95 transition-transform">
                                    <div className={`w-10 h-10 rounded-xl ${item.bg} ${item.color} flex items-center justify-center`}>
                                        <item.icon className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <div className="font-semibold text-slate-800 text-sm leading-tight">{item.title}</div>
                                        <div className="text-[10px] text-slate-400 truncate mt-0.5">{item.desc}</div>
                                    </div>
                                    <Badge variant="secondary" className="self-start text-[10px] px-1.5 h-5 bg-slate-100 text-slate-600 font-semibold">
                                        {item.points} pt
                                    </Badge>
                                </div>
                            ))}
                        </div>
                        <ScrollBar orientation="horizontal" />
                    </ScrollArea>
                </div>

                {/* 4. Main Content Tabs */}
                <div className="pt-2">
                    <Tabs value={activeTab} onValueChange={setActiveTab}>
                        <TabsList className="w-full bg-slate-200/50 p-1 h-12 rounded-2xl mb-6">
                            <TabsTrigger value="feed" className="flex-1 rounded-xl text-xs font-semibold data-[state=active]:bg-white data-[state=active]:shadow-sm">Сошиал</TabsTrigger>
                            <TabsTrigger value="shop" className="flex-1 rounded-xl text-xs font-semibold data-[state=active]:bg-white data-[state=active]:shadow-sm">Дэлгүүр</TabsTrigger>
                            <TabsTrigger value="history" className="flex-1 rounded-xl text-xs font-semibold data-[state=active]:bg-white data-[state=active]:shadow-sm">Түүх</TabsTrigger>
                        </TabsList>

                        <TabsContent value="feed" className="focus-visible:outline-none">
                            <RecognitionFeed />
                        </TabsContent>

                        <TabsContent value="shop" className="focus-visible:outline-none">
                            <RewardsList />
                        </TabsContent>

                        <TabsContent value="history" className="focus-visible:outline-none">
                            <PointHistoryList />
                        </TabsContent>
                    </Tabs>
                </div>
            </div>
        </div>
    );
}
