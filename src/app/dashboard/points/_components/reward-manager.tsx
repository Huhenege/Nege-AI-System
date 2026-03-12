'use client';

import { useState, useMemo, useRef } from 'react';
import { useUser, useFirestore, useFetchCollection, useFirebaseApp, useTenantWrite } from '@/firebase';
import { collection, query, where, orderBy, addDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Reward } from '@/types/points';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
    Plus,
    Pencil,
    Trash2,
    Sparkles,
    ShoppingBag,
    Check,
    X,
    Loader2,
    Image as ImageIcon,
    Upload,
    RotateCcw
} from 'lucide-react';

export function RewardManager() {
    const firestore = useFirestore();
    const { tDoc, tCollection } = useTenantWrite();
    const app = useFirebaseApp();
    const { toast } = useToast();
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [editingReward, setEditingReward] = useState<Reward | null>(null);
    const [loading, setLoading] = useState(false);

    // Image state
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Fetch all rewards
    const rewardsQuery = useMemo(() =>
        firestore ? query(collection(firestore, 'rewards'), orderBy('isActive', 'desc')) : null
        , [firestore]);

    const { data: rewards, isLoading } = useFetchCollection<Reward>(rewardsQuery);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setSelectedFile(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setImagePreview(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const resetImageState = () => {
        setSelectedFile(null);
        setImagePreview(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!firestore) return;

        setLoading(true);
        const formData = new FormData(e.currentTarget);

        try {
            let finalImageUrl = editingReward?.imageUrl || null;

            // Handle Image Upload
            if (selectedFile) {
                const storage = getStorage(app);
                const storageRef = ref(storage, `rewards/${Date.now()}-${selectedFile.name}`);
                await uploadBytes(storageRef, selectedFile);
                finalImageUrl = await getDownloadURL(storageRef);
            }

            const rewardData = {
                title: formData.get('title') as string,
                description: formData.get('description') as string,
                cost: parseInt(formData.get('cost') as string),
                category: formData.get('category') as string,
                imageUrl: finalImageUrl,
                isActive: true,
                updatedAt: serverTimestamp(),
            };

            if (editingReward) {
                await updateDoc(tDoc('rewards', editingReward.id), rewardData);
                toast({ title: 'Амжилттай шинэчлэгдлээ' });
            } else {
                await addDoc(tCollection('rewards'), {
                    ...rewardData,
                    createdAt: serverTimestamp(),
                });
                toast({ title: 'Шинэ бараа нэмэгдлээ' });
            }
            setIsAddOpen(false);
            setEditingReward(null);
            resetImageState();
        } catch (error: any) {
            toast({ title: 'Алдаа гарлаа', description: error.message, variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    const toggleStatus = async (reward: Reward) => {
        if (!firestore) return;
        try {
            await updateDoc(tDoc('rewards', reward.id), {
                isActive: !reward.isActive
            });
            toast({ title: reward.isActive ? 'Идэвхгүй болголоо' : 'Идэвхжүүллээ' });
        } catch (error: any) {
            toast({ title: 'Алдаа гарлаа', description: error.message, variant: 'destructive' });
        }
    };

    const openEditForm = (reward: Reward) => {
        setEditingReward(reward);
        setImagePreview(reward.imageUrl || null);
        setIsAddOpen(true);
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-medium">Дэлгүүрийн бараа бүтээгдэхүүн</h3>
                    <p className="text-sm text-muted-foreground">Ажилчид оноогоороо авах боломжтой шагнал, урамшууллууд.</p>
                </div>
                <Dialog open={isAddOpen} onOpenChange={(val) => {
                    setIsAddOpen(val);
                    if (!val) {
                        setEditingReward(null);
                        resetImageState();
                    }
                }}>
                    <DialogTrigger asChild>
                        <Button className="gap-2">
                            <Plus className="w-4 h-4" /> Шинэ бараа нэмэх
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[500px]">
                        <DialogHeader>
                            <DialogTitle>{editingReward ? 'Бараа засах' : 'Шинэ бараа нэмэх'}</DialogTitle>
                        </DialogHeader>
                        <form onSubmit={handleSubmit} className="space-y-4 py-4">
                            {/* Image Upload Area */}
                            <div className="flex flex-col items-center gap-4 py-2">
                                <div
                                    className="w-full h-48 rounded-2xl border-2 border-dashed border-muted-foreground/20 hover:border-primary transition-colors cursor-pointer flex flex-col items-center justify-center relative overflow-hidden group bg-slate-50"
                                    onClick={() => fileInputRef.current?.click()}
                                >
                                    {imagePreview ? (
                                        <>
                                            <img src={imagePreview} className="w-full h-full object-cover" alt="Preview" />
                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                <Upload className="w-8 h-8 text-white" />
                                            </div>
                                        </>
                                    ) : (
                                        <div className="text-center space-y-2 p-4">
                                            <div className="w-12 h-12 bg-white rounded-full shadow-sm mx-auto flex items-center justify-center text-muted-foreground">
                                                <ImageIcon className="w-6 h-6" />
                                            </div>
                                            <div className="text-sm font-medium">Зураг оруулах</div>
                                            <div className="text-[10px] text-muted-foreground italic">PNG, JPG (Max 5MB)</div>
                                        </div>
                                    )}
                                </div>
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    className="hidden"
                                    accept="image/*"
                                    onChange={handleFileChange}
                                />
                                {imagePreview && (
                                    <Button type="button" variant="ghost" size="sm" className="h-7 text-[11px]" onClick={resetImageState}>
                                        <RotateCcw className="w-3 h-3 mr-1.5" /> Зураг солих
                                    </Button>
                                )}
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="title">Нэр</Label>
                                <Input id="title" name="title" defaultValue={editingReward?.title} placeholder="Жишээ: Кофены купон" required />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="cost">Оноо</Label>
                                    <Input id="cost" name="cost" type="number" defaultValue={editingReward?.cost} placeholder="500" required />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="category">Ангилал</Label>
                                    <Input id="category" name="category" defaultValue={editingReward?.category} placeholder="Food / Merchandise" required />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="description">Тайлбар</Label>
                                <Textarea id="description" name="description" defaultValue={editingReward?.description} placeholder="Барааны талаарх дэлгэрэнгүй мэдээлэл..." required />
                            </div>

                            <DialogFooter>
                                <Button type="submit" disabled={loading} className="w-full">
                                    {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                    {editingReward ? 'Шинэчлэх' : 'Хадгалах'}
                                </Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>

            {isLoading ? (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {rewards?.map((reward) => (
                        <Card key={reward.id} className={!reward.isActive ? 'opacity-60' : ''}>
                            <CardHeader className="p-0 overflow-hidden rounded-t-xl h-40 bg-muted relative border-b">
                                {reward.imageUrl ? (
                                    <img src={reward.imageUrl} className="w-full h-full object-cover" alt={reward.title} />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                        <ImageIcon className="w-12 h-12 text-muted-foreground/20" />
                                    </div>
                                )}
                                <div className="absolute top-2 right-2 flex gap-2">
                                    <Badge variant={reward.isActive ? 'default' : 'secondary'} className="backdrop-blur-md bg-white/50 text-black border-none">
                                        {reward.isActive ? 'Идэвхтэй' : 'Идэвхгүй'}
                                    </Badge>
                                </div>
                            </CardHeader>
                            <CardContent className="p-4 space-y-3">
                                <div className="flex items-start justify-between">
                                    <div className="max-w-[70%]">
                                        <h4 className="font-semibold text-lg truncate">{reward.title}</h4>
                                        <Badge variant="outline" className="text-[10px] uppercase">{reward.category}</Badge>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-xl font-semibold text-primary">{reward.cost.toLocaleString()}</div>
                                        <div className="text-[10px] text-muted-foreground uppercase font-semibold">Оноо</div>
                                    </div>
                                </div>
                                <p className="text-sm text-muted-foreground line-clamp-2 min-h-[40px]">{reward.description}</p>
                                <div className="flex items-center gap-2 pt-2 border-t">
                                    <Button variant="outline" size="sm" className="flex-1 gap-2" onClick={() => openEditForm(reward)}>
                                        <Pencil className="w-3.5 h-3.5" /> Засах
                                    </Button>
                                    <Button
                                        variant={reward.isActive ? 'secondary' : 'default'}
                                        size="sm"
                                        className="gap-2"
                                        onClick={() => toggleStatus(reward)}
                                    >
                                        {reward.isActive ? <X className="w-3.5 h-3.5" /> : <Check className="w-3.5 h-3.5" />}
                                        {reward.isActive ? 'Идэвхгүй болгох' : 'Идэвхжүүлэх'}
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))}

                    {rewards?.length === 0 && (
                        <div className="col-span-full border-2 border-dashed rounded-3xl p-12 text-center text-muted-foreground">
                            <ShoppingBag className="w-12 h-12 mx-auto mb-4 opacity-20" />
                            <p>Одоогоор бараа байхгүй байна.</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
