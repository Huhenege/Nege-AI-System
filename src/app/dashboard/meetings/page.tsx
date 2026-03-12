'use client';

import React, { useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/patterns/page-layout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { AddActionButton } from '@/components/ui/add-action-button';
import { useFirebase, useCollection, useFetchCollection, useMemoFirebase, tenantCollection, useTenantWrite } from '@/firebase';
import { query, orderBy, where, addDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import {
    format,
    addWeeks,
    subWeeks,
    addDays,
    subDays,
    startOfWeek,
    endOfWeek,
    isToday,
    parseISO,
} from 'date-fns';
import { mn } from 'date-fns/locale';
import {
    ChevronLeft,
    ChevronRight,
    DoorOpen,
    Plus,
    Calendar,
    Clock,
    Settings,
    Loader2,
    CalendarDays,
    LayoutList,
} from 'lucide-react';
import type { MeetingRoom, RoomBooking } from '@/types/meeting';
import type { Employee } from '@/types';
import { isActiveStatus } from '@/types';
import { BookingCalendar } from './components/booking-calendar';
import { BookingDialog } from './components/booking-dialog';

export default function MeetingsPage() {
    const { firestore } = useFirebase();
    const { tDoc, tCollection } = useTenantWrite();
    const { toast } = useToast();

    const [currentDate, setCurrentDate] = useState(new Date());
    const [view, setView] = useState<'week' | 'day'>('week');
    const [visibleRooms, setVisibleRooms] = useState<Set<string>>(new Set());
    const [roomsInitialized, setRoomsInitialized] = useState(false);

    // Booking dialog state
    const [isBookingOpen, setIsBookingOpen] = useState(false);
    const [editBooking, setEditBooking] = useState<RoomBooking | null>(null);
    const [defaultDate, setDefaultDate] = useState('');
    const [defaultStartTime, setDefaultStartTime] = useState('');
    const [defaultRoomId, setDefaultRoomId] = useState('');

    // Fetch rooms
    const roomsQuery = useMemoFirebase(({ firestore, companyPath }) =>
        firestore ? query(tenantCollection(firestore, companyPath, 'meeting_rooms'), orderBy('name', 'asc')) : null,
        [firestore]
    );
    const { data: rooms, isLoading: roomsLoading } = useFetchCollection<MeetingRoom>(roomsQuery);

    // Initialize visible rooms once rooms are loaded
    React.useEffect(() => {
        if (rooms && rooms.length > 0 && !roomsInitialized) {
            setVisibleRooms(new Set(rooms.filter(r => r.isActive).map(r => r.id)));
            setRoomsInitialized(true);
        }
    }, [rooms, roomsInitialized]);

    // Fetch bookings for the visible date range
    const dateRange = useMemo(() => {
        if (view === 'day') {
            return {
                start: format(currentDate, 'yyyy-MM-dd'),
                end: format(currentDate, 'yyyy-MM-dd'),
            };
        }
        const wStart = startOfWeek(currentDate, { weekStartsOn: 1 });
        const wEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
        return {
            start: format(wStart, 'yyyy-MM-dd'),
            end: format(wEnd, 'yyyy-MM-dd'),
        };
    }, [currentDate, view]);

    const bookingsQuery = useMemoFirebase(({ firestore, companyPath }) =>
        firestore
            ? query(
                tenantCollection(firestore, companyPath, 'room_bookings'),
                where('date', '>=', dateRange.start),
                where('date', '<=', dateRange.end),
                orderBy('date', 'asc')
            )
            : null,
        [firestore, dateRange.start, dateRange.end]
    );
    const { data: bookings, isLoading: bookingsLoading } = useCollection<RoomBooking>(bookingsQuery);

    // Fetch employees for booking dialog
    const employeesQuery = useMemoFirebase(({ firestore, companyPath }) =>
        firestore ? query(tenantCollection(firestore, companyPath, 'employees'), orderBy('firstName', 'asc')) : null,
        [firestore]
    );
    const { data: allEmployees } = useFetchCollection<Employee>(employeesQuery);
    const employees = useMemo(() =>
        (allEmployees || []).filter(e => isActiveStatus(e.status)),
        [allEmployees]
    );

    // Navigation
    const goToday = () => setCurrentDate(new Date());
    const goPrev = () => setCurrentDate(prev => view === 'week' ? subWeeks(prev, 1) : subDays(prev, 1));
    const goNext = () => setCurrentDate(prev => view === 'week' ? addWeeks(prev, 1) : addDays(prev, 1));

    const dateLabel = useMemo(() => {
        if (view === 'day') {
            return format(currentDate, 'yyyy оны M сарын d', { locale: mn });
        }
        const wStart = startOfWeek(currentDate, { weekStartsOn: 1 });
        const wEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
        return `${format(wStart, 'M/d')} – ${format(wEnd, 'M/d, yyyy')}`;
    }, [currentDate, view]);

    // Toggle room visibility
    const toggleRoom = (roomId: string) => {
        setVisibleRooms(prev => {
            const next = new Set(prev);
            if (next.has(roomId)) next.delete(roomId);
            else next.add(roomId);
            return next;
        });
    };

    const toggleAllRooms = () => {
        if (!rooms) return;
        const activeRooms = rooms.filter(r => r.isActive);
        if (visibleRooms.size === activeRooms.length) {
            setVisibleRooms(new Set());
        } else {
            setVisibleRooms(new Set(activeRooms.map(r => r.id)));
        }
    };

    // Calendar interactions
    const handleSlotClick = useCallback((date: string, time: string) => {
        setEditBooking(null);
        setDefaultDate(date);
        setDefaultStartTime(time);
        setDefaultRoomId('');
        setIsBookingOpen(true);
    }, []);

    const handleBookingClick = useCallback((booking: RoomBooking) => {
        setEditBooking(booking);
        setDefaultDate('');
        setDefaultStartTime('');
        setDefaultRoomId('');
        setIsBookingOpen(true);
    }, []);

    // CRUD
    const handleSaveBooking = async (data: Omit<RoomBooking, 'id' | 'createdAt'>) => {
        if (!firestore) return;
        try {
            if (editBooking) {
                await updateDoc(tDoc('room_bookings', editBooking.id), {
                    ...data,
                });
                toast({ title: 'Захиалга шинэчлэгдлээ' });
            } else {
                await addDoc(tCollection('room_bookings'), {
                    ...data,
                    createdAt: new Date().toISOString(),
                });
                toast({ title: 'Захиалга амжилттай үүслээ' });
            }
        } catch {
            toast({ title: 'Алдаа гарлаа', variant: 'destructive' });
        }
    };

    const handleDeleteBooking = async (bookingId: string) => {
        if (!firestore) return;
        try {
            await updateDoc(tDoc('room_bookings', bookingId), {
                status: 'cancelled',
            });
            toast({ title: 'Захиалга цуцлагдлаа' });
        } catch {
            toast({ title: 'Алдаа гарлаа', variant: 'destructive' });
        }
    };

    // Today's upcoming bookings for sidebar
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const todayBookings = useMemo(() => {
        if (!bookings) return [];
        const now = format(new Date(), 'HH:mm');
        return bookings
            .filter(b => b.date === todayStr && b.status === 'active' && b.endTime > now && visibleRooms.has(b.roomId))
            .sort((a, b) => a.startTime.localeCompare(b.startTime));
    }, [bookings, todayStr, visibleRooms]);

    const isLoading = roomsLoading || bookingsLoading;

    return (
        <div className="flex flex-col h-full overflow-hidden">
            {/* Header */}
            <div className="shrink-0 px-6 py-4 border-b bg-white">
                <PageHeader
                    title="Хурлын өрөөний захиалга"
                    description="Хурлын өрөө захиалах, хуваарь харах"
                    showBackButton
                    hideBreadcrumbs
                    backButtonPlacement="inline"
                    backBehavior="history"
                    fallbackBackHref="/dashboard"
                    actions={
                        <div className="flex items-center gap-2">
                            <Button variant="outline" size="sm" asChild>
                                <Link href="/dashboard/meetings/rooms">
                                    <Settings className="h-4 w-4 mr-1.5" />
                                    Өрөөнүүд
                                </Link>
                            </Button>
                            <AddActionButton
                                label="Шинэ захиалга"
                                description="Хурлын өрөө захиалах"
                                onClick={() => {
                                    setEditBooking(null);
                                    setDefaultDate(format(new Date(), 'yyyy-MM-dd'));
                                    setDefaultStartTime('09:00');
                                    setDefaultRoomId('');
                                    setIsBookingOpen(true);
                                }}
                            />
                        </div>
                    }
                />
            </div>

            {/* Toolbar */}
            <div className="shrink-0 px-6 py-3 border-b bg-slate-50/50 flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={goToday} className="h-8 text-xs">
                        Өнөөдөр
                    </Button>
                    <div className="flex items-center">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={goPrev}>
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={goNext}>
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                    <span className="text-sm font-semibold min-w-[180px]">{dateLabel}</span>
                </div>
                <div className="flex items-center gap-1 bg-white rounded-lg border p-0.5">
                    <Button
                        variant={view === 'day' ? 'default' : 'ghost'}
                        size="sm"
                        className="h-7 text-xs px-3"
                        onClick={() => setView('day')}
                    >
                        <CalendarDays className="h-3.5 w-3.5 mr-1" />
                        Өдөр
                    </Button>
                    <Button
                        variant={view === 'week' ? 'default' : 'ghost'}
                        size="sm"
                        className="h-7 text-xs px-3"
                        onClick={() => setView('week')}
                    >
                        <LayoutList className="h-3.5 w-3.5 mr-1" />
                        Долоо хоног
                    </Button>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex overflow-hidden">
                {/* Calendar */}
                <div className="flex-1 p-4 overflow-hidden flex flex-col">
                    {isLoading ? (
                        <div className="flex-1 flex items-center justify-center">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : !rooms?.length ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-center">
                            <div className="h-16 w-16 rounded-2xl bg-orange-100 flex items-center justify-center mb-4">
                                <DoorOpen className="h-8 w-8 text-orange-600" />
                            </div>
                            <h3 className="text-lg font-semibold mb-1">Хурлын өрөө бүртгэгдээгүй</h3>
                            <p className="text-sm text-muted-foreground mb-4">Эхлээд хурлын өрөө нэмнэ үү</p>
                            <Button asChild>
                                <Link href="/dashboard/meetings/rooms">
                                    <Plus className="h-4 w-4 mr-2" />
                                    Өрөө нэмэх
                                </Link>
                            </Button>
                        </div>
                    ) : (
                        <BookingCalendar
                            currentDate={currentDate}
                            bookings={bookings || []}
                            rooms={rooms || []}
                            visibleRoomIds={visibleRooms}
                            onSlotClick={handleSlotClick}
                            onBookingClick={handleBookingClick}
                            view={view}
                        />
                    )}
                </div>

                {/* Sidebar */}
                <div className="w-[280px] shrink-0 border-l bg-white overflow-y-auto hidden lg:block">
                    <div className="p-4 space-y-5">
                        {/* Room Filter */}
                        <div>
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Өрөөнүүд</h3>
                                <button
                                    onClick={toggleAllRooms}
                                    className="text-[10px] text-indigo-600 hover:underline font-medium"
                                >
                                    {rooms && visibleRooms.size === rooms.filter(r => r.isActive).length ? 'Бүгд арилгах' : 'Бүгд сонгох'}
                                </button>
                            </div>
                            <div className="space-y-1.5">
                                {rooms?.filter(r => r.isActive).map(room => (
                                    <label
                                        key={room.id}
                                        className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors"
                                    >
                                        <Checkbox
                                            checked={visibleRooms.has(room.id)}
                                            onCheckedChange={() => toggleRoom(room.id)}
                                        />
                                        <span
                                            className="h-2.5 w-2.5 rounded-full shrink-0"
                                            style={{ backgroundColor: room.color }}
                                        />
                                        <span className="text-sm truncate">{room.name}</span>
                                        <span className="text-[10px] text-muted-foreground ml-auto">{room.capacity}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        {/* Today's upcoming */}
                        <div>
                            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">
                                Өнөөдрийн хурал
                            </h3>
                            {todayBookings.length === 0 ? (
                                <p className="text-xs text-muted-foreground italic px-2">Хурал байхгүй</p>
                            ) : (
                                <div className="space-y-2">
                                    {todayBookings.map(b => {
                                        const room = rooms?.find(r => r.id === b.roomId);
                                        return (
                                            <button
                                                key={b.id}
                                                className="w-full text-left p-2.5 rounded-lg border hover:bg-slate-50 transition-colors space-y-1"
                                                onClick={() => handleBookingClick(b)}
                                            >
                                                <div className="flex items-center gap-2">
                                                    <span
                                                        className="h-2 w-2 rounded-full shrink-0"
                                                        style={{ backgroundColor: room?.color }}
                                                    />
                                                    <span className="text-xs font-semibold truncate">{b.title}</span>
                                                </div>
                                                <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                                                    <Clock className="h-3 w-3" />
                                                    <span>{b.startTime}–{b.endTime}</span>
                                                    <span className="truncate">{room?.name}</span>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Booking Dialog */}
            <BookingDialog
                open={isBookingOpen}
                onOpenChange={setIsBookingOpen}
                rooms={rooms || []}
                employees={employees}
                existingBookings={bookings || []}
                onSave={handleSaveBooking}
                defaultDate={defaultDate}
                defaultStartTime={defaultStartTime}
                defaultRoomId={defaultRoomId}
                editBooking={editBooking}
                onDelete={handleDeleteBooking}
            />
        </div>
    );
}
