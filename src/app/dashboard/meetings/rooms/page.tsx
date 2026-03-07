'use client';

import React, { useState, useMemo } from 'react';
import { PageHeader } from '@/components/patterns/page-layout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { AddActionButton } from '@/components/ui/add-action-button';
import { useFirebase, useCollection, useTenantWrite } from '@/firebase';
import { collection, query, orderBy, addDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
    DoorOpen,
    Users,
    Building2,
    Pencil,
    Trash2,
    Plus,
    X,
    Monitor,
    Loader2,
} from 'lucide-react';
import type { MeetingRoom } from '@/types/meeting';
import { ROOM_COLORS, DEFAULT_AMENITIES } from '@/types/meeting';

export default function MeetingRoomsPage() {
    const { firestore } = useFirebase();
    const { tDoc, tCollection } = useTenantWrite();
    const { toast } = useToast();

    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingRoom, setEditingRoom] = useState<MeetingRoom | null>(null);
    const [deleteRoom, setDeleteRoom] = useState<MeetingRoom | null>(null);

    // Form state
    const [name, setName] = useState('');
    const [capacity, setCapacity] = useState(6);
    const [floor, setFloor] = useState('');
    const [color, setColor] = useState<string>(ROOM_COLORS[0] ?? '#6366f1');
    const [amenities, setAmenities] = useState<string[]>([]);
    const [customAmenity, setCustomAmenity] = useState('');

    const roomsQuery = useMemo(() =>
        firestore ? query(collection(firestore, 'meeting_rooms'), orderBy('name', 'asc')) : null,
        [firestore]
    );
    const { data: rooms, isLoading } = useCollection<MeetingRoom>(roomsQuery);

    const resetForm = () => {
        setName('');
        setCapacity(6);
        setFloor('');
        setColor(ROOM_COLORS[0]);
        setAmenities([]);
        setCustomAmenity('');
        setEditingRoom(null);
    };

    const openCreate = () => {
        resetForm();
        setIsDialogOpen(true);
    };

    const openEdit = (room: MeetingRoom) => {
        setEditingRoom(room);
        setName(room.name);
        setCapacity(room.capacity);
        setFloor(room.floor || '');
        setColor(room.color ?? ROOM_COLORS[0] ?? '#6366f1');
        setAmenities(room.amenities || []);
        setIsDialogOpen(true);
    };

    const handleSave = async () => {
        if (!firestore || !name.trim()) return;

        try {
            if (editingRoom) {
                await updateDoc(tDoc('meeting_rooms', editingRoom.id), {
                    name: name.trim(),
                    capacity,
                    floor: floor.trim() || null,
                    color,
                    amenities,
                });
                toast({ title: 'Өрөө шинэчлэгдлээ' });
            } else {
                await addDoc(tCollection('meeting_rooms'), {
                    name: name.trim(),
                    capacity,
                    floor: floor.trim() || null,
                    color,
                    amenities,
                    isActive: true,
                    createdAt: new Date().toISOString(),
                });
                toast({ title: 'Шинэ өрөө нэмэгдлээ' });
            }
            setIsDialogOpen(false);
            resetForm();
        } catch {
            toast({ title: 'Алдаа гарлаа', variant: 'destructive' });
        }
    };

    const handleDelete = async () => {
        if (!firestore || !deleteRoom) return;
        try {
            await deleteDoc(tDoc('meeting_rooms', deleteRoom.id));
            toast({ title: 'Өрөө устгагдлаа' });
            setDeleteRoom(null);
        } catch {
            toast({ title: 'Устгахад алдаа гарлаа', variant: 'destructive' });
        }
    };

    const toggleActive = async (room: MeetingRoom) => {
        if (!firestore) return;
        await updateDoc(tDoc('meeting_rooms', room.id), {
            isActive: !room.isActive,
        });
        toast({ title: room.isActive ? 'Өрөө идэвхгүй болголоо' : 'Өрөө идэвхжүүллээ' });
    };

    const toggleAmenity = (a: string) => {
        setAmenities(prev =>
            prev.includes(a) ? prev.filter(x => x !== a) : [...prev, a]
        );
    };

    const addCustomAmenity = () => {
        const v = customAmenity.trim();
        if (v && !amenities.includes(v)) {
            setAmenities(prev => [...prev, v]);
            setCustomAmenity('');
        }
    };

    return (
        <div className="flex flex-col h-full overflow-hidden">
            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6 pb-32">
                <PageHeader
                    title="Хурлын өрөөнүүд"
                    description="Хурлын өрөө үүсгэх, удирдах"
                    showBackButton
                    hideBreadcrumbs
                    backButtonPlacement="inline"
                    backBehavior="history"
                    fallbackBackHref="/dashboard/meetings"
                    actions={
                        <AddActionButton
                            label="Шинэ өрөө"
                            description="Хурлын өрөө нэмэх"
                            onClick={openCreate}
                        />
                    }
                />

                {isLoading ? (
                    <div className="flex items-center justify-center py-20">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                ) : !rooms?.length ? (
                    <Card className="border-dashed">
                        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                            <div className="h-14 w-14 rounded-2xl bg-orange-100 flex items-center justify-center mb-4">
                                <DoorOpen className="h-7 w-7 text-orange-600" />
                            </div>
                            <h3 className="text-lg font-semibold mb-1">Өрөө бүртгэгдээгүй</h3>
                            <p className="text-sm text-muted-foreground mb-4">Эхлээд хурлын өрөө нэмнэ үү</p>
                            <Button onClick={openCreate}>
                                <Plus className="h-4 w-4 mr-2" />
                                Өрөө нэмэх
                            </Button>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {rooms.map(room => (
                            <Card key={room.id} className="group hover:shadow-md transition-shadow overflow-hidden">
                                <div className="h-2" style={{ backgroundColor: room.color }} />
                                <CardContent className="p-5 space-y-3">
                                    <div className="flex items-start justify-between">
                                        <div className="flex items-center gap-3">
                                            <div
                                                className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0"
                                                style={{ backgroundColor: `${room.color}20` }}
                                            >
                                                <DoorOpen className="h-5 w-5" style={{ color: room.color }} />
                                            </div>
                                            <div>
                                                <h3 className="font-semibold text-sm">{room.name}</h3>
                                                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                                                    <Users className="h-3 w-3" />
                                                    <span>{room.capacity} хүн</span>
                                                    {room.floor && (
                                                        <>
                                                            <span className="text-border">|</span>
                                                            <Building2 className="h-3 w-3" />
                                                            <span>{room.floor}</span>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        <Badge
                                            variant={room.isActive ? 'default' : 'secondary'}
                                            className="text-[10px] cursor-pointer"
                                            onClick={() => toggleActive(room)}
                                        >
                                            {room.isActive ? 'Идэвхтэй' : 'Идэвхгүй'}
                                        </Badge>
                                    </div>

                                    {room.amenities && room.amenities.length > 0 && (
                                        <div className="flex flex-wrap gap-1">
                                            {room.amenities.map(a => (
                                                <Badge key={a} variant="outline" className="text-[10px] font-normal">
                                                    {a}
                                                </Badge>
                                            ))}
                                        </div>
                                    )}

                                    <div className="flex gap-2 pt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Button variant="outline" size="sm" className="flex-1 h-8" onClick={() => openEdit(room)}>
                                            <Pencil className="h-3 w-3 mr-1.5" />
                                            Засах
                                        </Button>
                                        <Button variant="outline" size="sm" className="h-8 text-destructive hover:text-destructive" onClick={() => setDeleteRoom(room)}>
                                            <Trash2 className="h-3 w-3" />
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </div>

            {/* Create/Edit Dialog */}
            <Dialog open={isDialogOpen} onOpenChange={(open) => { if (!open) { setIsDialogOpen(false); resetForm(); } }}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>{editingRoom ? 'Өрөө засах' : 'Шинэ өрөө нэмэх'}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-2">
                            <Label>Өрөөний нэр *</Label>
                            <Input
                                value={name}
                                onChange={e => setName(e.target.value)}
                                placeholder="Жишээ: Гол хурлын өрөө"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Багтаамж (хүн)</Label>
                                <Input
                                    type="number"
                                    min={1}
                                    max={200}
                                    value={capacity}
                                    onChange={e => setCapacity(Number(e.target.value))}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Давхар</Label>
                                <Input
                                    value={floor}
                                    onChange={e => setFloor(e.target.value)}
                                    placeholder="Жишээ: 2 давхар"
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Өнгө</Label>
                            <div className="flex flex-wrap gap-2">
                                {ROOM_COLORS.map(c => (
                                    <button
                                        key={c}
                                        type="button"
                                        onClick={() => setColor(c)}
                                        className="h-8 w-8 rounded-lg transition-all border-2"
                                        style={{
                                            backgroundColor: c,
                                            borderColor: color === c ? '#000' : 'transparent',
                                            transform: color === c ? 'scale(1.15)' : 'scale(1)',
                                        }}
                                    />
                                ))}
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Тоног төхөөрөмж</Label>
                            <div className="flex flex-wrap gap-1.5">
                                {DEFAULT_AMENITIES.map(a => (
                                    <Badge
                                        key={a}
                                        variant={amenities.includes(a) ? 'default' : 'outline'}
                                        className="cursor-pointer text-xs"
                                        onClick={() => toggleAmenity(a)}
                                    >
                                        {amenities.includes(a) ? <X className="h-3 w-3 mr-1" /> : <Plus className="h-3 w-3 mr-1" />}
                                        {a}
                                    </Badge>
                                ))}
                            </div>
                            <div className="flex gap-2 mt-2">
                                <Input
                                    value={customAmenity}
                                    onChange={e => setCustomAmenity(e.target.value)}
                                    placeholder="Бусад..."
                                    className="flex-1 h-8 text-xs"
                                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustomAmenity(); } }}
                                />
                                <Button variant="outline" size="sm" className="h-8" onClick={addCustomAmenity}>
                                    Нэмэх
                                </Button>
                            </div>
                            {amenities.filter(a => !DEFAULT_AMENITIES.includes(a as any)).length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-1">
                                    {amenities.filter(a => !DEFAULT_AMENITIES.includes(a as any)).map(a => (
                                        <Badge key={a} variant="default" className="cursor-pointer text-xs" onClick={() => toggleAmenity(a)}>
                                            <X className="h-3 w-3 mr-1" />
                                            {a}
                                        </Badge>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => { setIsDialogOpen(false); resetForm(); }}>
                            Болих
                        </Button>
                        <Button onClick={handleSave} disabled={!name.trim()}>
                            {editingRoom ? 'Хадгалах' : 'Нэмэх'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation */}
            <AlertDialog open={!!deleteRoom} onOpenChange={(open) => { if (!open) setDeleteRoom(null); }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Өрөө устгах уу?</AlertDialogTitle>
                        <AlertDialogDescription>
                            &quot;{deleteRoom?.name}&quot; өрөөг устгахад итгэлтэй байна уу? Энэ үйлдлийг буцаах боломжгүй.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Болих</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            Устгах
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
