// src/app/dashboard/business-plan/components/rewards-tab.tsx
'use client';

import React, { useState, useMemo } from 'react';
import { useFirebase, addDocumentNonBlocking, updateDocumentNonBlocking, useTenantWrite } from '@/firebase';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { Plus, Pencil, Gift, TrendingUp, DollarSign } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Employee } from '@/types';
import {
    BusinessPlan,
    PerformanceReview,
    PerformanceScore,
    Reward,
    RewardFormValues,
    REWARD_TYPE_LABELS,
    REWARD_STATUS_LABELS,
    REWARD_STATUS_COLORS,
    RATING_COLORS,
    Rating,
    RewardStatus,
} from '../types';
import { CreateRewardDialog } from './create-reward-dialog';

interface RewardsTabProps {
    activePlan?: BusinessPlan;
    reviews: PerformanceReview[];
    scores: PerformanceScore[];
    rewards: Reward[];
    employees: Employee[];
    isLoading: boolean;
}

export function RewardsTab({
    activePlan, reviews, scores, rewards, employees, isLoading,
}: RewardsTabProps) {
    const { firestore, user } = useFirebase();
    const { tDoc, tCollection } = useTenantWrite();
    const { toast } = useToast();
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingReward, setEditingReward] = useState<Reward | null>(null);
    const [statusFilter, setStatusFilter] = useState<RewardStatus | 'all'>('all');

    const filteredRewards = useMemo(() =>
        statusFilter === 'all' ? rewards : rewards.filter(r => r.status === statusFilter),
        [rewards, statusFilter]
    );

    // Stats
    const stats = useMemo(() => {
        const bonusTotal = rewards
            .filter(r => (r.type === 'bonus' || r.type === 'both') && r.status !== 'rejected')
            .reduce((s, r) => s + (r.bonusAmount || 0), 0);
        const promotionCount = rewards.filter(r => (r.type === 'promotion' || r.type === 'both') && r.status !== 'rejected').length;
        return { bonusTotal, promotionCount, total: rewards.length };
    }, [rewards]);

    const handleCreate = (values: RewardFormValues) => {
        if (!firestore || !user || !activePlan) return;
        const emp = employees.find(e => e.id === values.employeeId);
        const latestReview = reviews[0];
        const data: Omit<Reward, 'id'> = {
            reviewId: latestReview?.id || '',
            planId: activePlan.id,
            employeeId: values.employeeId,
            employeeName: emp ? `${emp.lastName?.charAt(0) || ''}. ${emp.firstName}` : '',
            type: values.type,
            bonusType: values.bonusType,
            bonusAmount: values.bonusAmount,
            promotionTo: values.promotionTo,
            promotionToTitle: '',
            reason: values.reason,
            status: values.status,
            proposedBy: user.uid,
            proposedByName: 'Админ',
            createdAt: new Date().toISOString(),
        };
        addDocumentNonBlocking(tCollection('bp_rewards'), data);
        toast({ title: 'Урамшуулал бүртгэгдлээ', description: data.employeeName });
    };

    const handleUpdate = (values: RewardFormValues) => {
        if (!firestore || !editingReward) return;
        updateDocumentNonBlocking(tDoc('bp_rewards', editingReward.id), values);
        toast({ title: 'Урамшуулал шинэчлэгдлээ' });
        setEditingReward(null);
    };

    if (!activePlan) {
        return (
            <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                    <Gift className="h-12 w-12 text-muted-foreground/50 mb-4" />
                    <h3 className="text-lg font-semibold mb-2">Идэвхтэй төлөвлөгөө байхгүй</h3>
                    <p className="text-sm text-muted-foreground">Эхлээд бизнес төлөвлөгөө үүсгэнэ үү.</p>
                </CardContent>
            </Card>
        );
    }

    if (isLoading) {
        return <div className="space-y-4">{[...Array(2)].map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)}</div>;
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-semibold">Урамшуулал & Дэвшүүлэлт</h3>
                    <p className="text-sm text-muted-foreground">Гүйцэтгэлд суурилсан шагнал, дэвшүүлэлт</p>
                </div>
                <Button onClick={() => { setEditingReward(null); setIsDialogOpen(true); }} className="gap-2">
                    <Plus className="h-4 w-4" />Шинэ урамшуулал
                </Button>
            </div>

            {/* Summary cards */}
            <div className="grid gap-4 md:grid-cols-3">
                <Card>
                    <CardContent className="pt-5 flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-emerald-100">
                            <Gift className="h-5 w-5 text-emerald-600" />
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground">Нийт</p>
                            <p className="text-xl font-bold">{stats.total}</p>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-5 flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-blue-100">
                            <DollarSign className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground">Урамшууллын дүн</p>
                            <p className="text-xl font-bold">{stats.bonusTotal.toLocaleString()}</p>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-5 flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-purple-100">
                            <TrendingUp className="h-5 w-5 text-purple-600" />
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground">Дэвшүүлэлт</p>
                            <p className="text-xl font-bold">{stats.promotionCount}</p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Filter */}
            <div className="flex gap-2 flex-wrap">
                <Button variant={statusFilter === 'all' ? 'default' : 'outline'} size="sm" onClick={() => setStatusFilter('all')}>
                    Бүгд ({rewards.length})
                </Button>
                {(['proposed', 'approved', 'applied', 'rejected'] as RewardStatus[]).map(s => (
                    <Button
                        key={s}
                        variant={statusFilter === s ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setStatusFilter(s)}
                    >
                        {REWARD_STATUS_LABELS[s]} ({rewards.filter(r => r.status === s).length})
                    </Button>
                ))}
            </div>

            {/* Reward list */}
            {filteredRewards.length === 0 ? (
                <Card className="border-dashed">
                    <CardContent className="text-center py-12">
                        <p className="text-muted-foreground text-sm">Урамшуулал байхгүй</p>
                    </CardContent>
                </Card>
            ) : (
                <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                        <thead className="bg-muted/50">
                            <tr>
                                <th className="text-left p-3 font-medium">Ажилтан</th>
                                <th className="text-left p-3 font-medium">Төрөл</th>
                                <th className="text-left p-3 font-medium">Дүн</th>
                                <th className="text-left p-3 font-medium">Шалтгаан</th>
                                <th className="text-center p-3 font-medium">Төлөв</th>
                                <th className="p-3 w-10"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredRewards.map(reward => {
                                const empScore = scores.find(s => s.employeeId === reward.employeeId);
                                return (
                                    <tr key={reward.id} className="border-t group">
                                        <td className="p-3">
                                            <div>
                                                <p className="font-medium">{reward.employeeName}</p>
                                                {empScore && (
                                                    <Badge className={cn('text-[10px] mt-0.5', RATING_COLORS[empScore.rating])}>
                                                        {empScore.rating} ({empScore.overallScore})
                                                    </Badge>
                                                )}
                                            </div>
                                        </td>
                                        <td className="p-3">{REWARD_TYPE_LABELS[reward.type]}</td>
                                        <td className="p-3">
                                            {reward.bonusAmount ? (
                                                <span>
                                                    {reward.bonusAmount}{reward.bonusType === 'percentage' ? '%' : '₮'}
                                                </span>
                                            ) : '—'}
                                        </td>
                                        <td className="p-3">
                                            <span className="text-muted-foreground truncate block max-w-[200px]">
                                                {reward.reason}
                                            </span>
                                        </td>
                                        <td className="p-3 text-center">
                                            <Badge className={cn('text-xs', REWARD_STATUS_COLORS[reward.status])}>
                                                {REWARD_STATUS_LABELS[reward.status]}
                                            </Badge>
                                        </td>
                                        <td className="p-3">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                                                onClick={() => { setEditingReward(reward); setIsDialogOpen(true); }}
                                            >
                                                <Pencil className="h-3 w-3" />
                                            </Button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            <CreateRewardDialog
                open={isDialogOpen}
                onOpenChange={setIsDialogOpen}
                onSubmit={editingReward ? handleUpdate : handleCreate}
                editingReward={editingReward}
                employees={employees}
            />
        </div>
    );
}
