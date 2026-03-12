'use client';

import { useState, useMemo } from 'react';
import { useUser, useFetchCollection, tenantCollection, useTenantWrite } from '@/firebase';
import { query, where } from 'firebase/firestore';
import { Reward } from '@/types/points';
import { PointsService } from '@/lib/points/points-service';
import { useToast } from '@/hooks/use-toast';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ShoppingBag, Sparkles, AlertCircle } from 'lucide-react';

export function RewardsList() {
    const { user } = useUser();
    const { firestore, companyPath } = useTenantWrite();
    const { toast } = useToast();

    const [selectedReward, setSelectedReward] = useState<Reward | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Fetch active rewards
    const rewardsQuery = useMemo(() =>
        (firestore && companyPath) ? query(tenantCollection(firestore, companyPath, 'rewards'), where('isActive', '==', true)) : null
        , [firestore, companyPath]);

    const { data: rewards, isLoading } = useFetchCollection<Reward>(rewardsQuery);

    const handleRedeem = async () => {
        if (!user || !firestore || !companyPath || !selectedReward) return;

        setIsSubmitting(true);
        try {
            await PointsService.redeemReward(firestore, companyPath!, user.uid, selectedReward);
            toast({
                title: 'Амжилттай!',
                description: `${selectedReward.title} авах хүсэлт илгээгдлээ. Түүх хэсгээс шалгана уу.`,
            });
            setSelectedReward(null);
        } catch (e: any) {
            toast({
                title: 'Алдаа гарлаа',
                description: e.message || 'Худалдан авалт амжилтгүй боллоо.',
                variant: 'destructive',
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isLoading) return <div className="grid grid-cols-2 gap-3 p-1 opacity-50">Loading rewards...</div>;

    // If no data in Firestore, show placeholders for design preview or empty state
    const displayRewards = rewards?.length > 0 ? rewards : [];

    if (displayRewards.length === 0) {
        return (
            <div className="bg-white p-8 rounded-3xl border border-dashed border-slate-200 text-center">
                <ShoppingBag className="w-10 h-10 mx-auto mb-3 text-slate-300" />
                <p className="text-sm font-medium text-slate-500">Одоогоор урамшуулал байхгүй байна</p>
                <p className="text-[10px] text-slate-400 mt-1">Тун удахгүй шинэ бараанууд нэмэгдэнэ</p>
            </div>
        );
    }

    return (
        <>
            <div className="grid grid-cols-2 gap-4 px-1">
                {displayRewards.map((item) => (
                    <div
                        key={item.id}
                        onClick={() => setSelectedReward(item)}
                        className="bg-white rounded-[24px] p-4 border border-slate-100 shadow-sm transition-all active:scale-95 group relative overflow-hidden"
                    >
                        <div className="aspect-square bg-slate-50 rounded-2xl mb-3 flex items-center justify-center text-4xl relative overflow-hidden">
                            {item.imageUrl ? (
                                <img src={item.imageUrl} alt={item.title} className="w-full h-full object-cover" />
                            ) : (
                                <div className="p-4 bg-indigo-50 text-indigo-500 rounded-full">
                                    <Sparkles className="w-6 h-6" />
                                </div>
                            )}
                            <Badge className="absolute top-2 right-2 bg-black/50 backdrop-blur-md text-[10px] border-none">
                                {item.category || 'Shop'}
                            </Badge>
                        </div>

                        <div className="space-y-1">
                            <h4 className="font-semibold text-slate-800 text-sm truncate">{item.title}</h4>
                            <div className="flex items-center gap-1.5 pt-1">
                                <div className="p-1 bg-yellow-50 rounded-md">
                                    <Star className="w-3 h-3 text-yellow-600 fill-yellow-600" />
                                </div>
                                <span className="font-semibold text-indigo-600 text-sm">{item.cost.toLocaleString()}</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Confirmation Dialog */}
            <Dialog open={!!selectedReward} onOpenChange={(open) => !open && setSelectedReward(null)}>
                <DialogContent className="rounded-3xl max-w-[90%] mx-auto">
                    <DialogHeader>
                        <DialogTitle>Баталгаажуулах</DialogTitle>
                        <DialogDescription>
                            Та {selectedReward?.cost} оноогоор энэхүү урамшууллыг авахдаа итгэлтэй байна уу?
                        </DialogDescription>
                    </DialogHeader>

                    {selectedReward && (
                        <div className="bg-slate-50 p-4 rounded-2xl flex items-center gap-4 border border-slate-100">
                            <div className="w-16 h-16 bg-white rounded-xl shadow-sm flex items-center justify-center text-2xl">
                                {selectedReward.imageUrl ? <img src={selectedReward.imageUrl} className="w-full h-full object-cover rounded-xl" /> : '🎁'}
                            </div>
                            <div>
                                <h3 className="font-semibold text-slate-900">{selectedReward.title}</h3>
                                <p className="text-xs text-slate-500 line-clamp-1">{selectedReward.description}</p>
                                <p className="text-sm font-semibold text-indigo-600 mt-1">{selectedReward.cost} pts</p>
                            </div>
                        </div>
                    )}

                    <DialogFooter className="flex-row gap-3 mt-4">
                        <Button variant="ghost" className="flex-1 rounded-xl" onClick={() => setSelectedReward(null)}>Цуцлах</Button>
                        <Button
                            className="flex-1 rounded-xl bg-indigo-600 hover:bg-indigo-700"
                            disabled={isSubmitting}
                            onClick={handleRedeem}
                        >
                            {isSubmitting ? 'Боловсруулж байна...' : 'Авах'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}

function Star({ className }: { className?: string }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
    );
}
