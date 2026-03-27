'use client';

import React, { useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { PageHeader } from '@/components/patterns/page-layout';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { AddActionButton } from '@/components/ui/add-action-button';
import { useFirebase, useCollection, useFetchCollection, useMemoFirebase, tenantCollection, useTenantWrite, useUser } from '@/firebase';
import { query, orderBy, where, addDoc, updateDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import {
    format,
    addWeeks,
    subWeeks,
    addDays,
    subDays,
    startOfWeek,
    endOfWeek,
} from 'date-fns';
import { mn } from 'date-fns/locale';
import {
    ChevronLeft,
    ChevronRight,
    DoorOpen,
    Plus,
    Clock,
    Settings,
    Loader2,
    CalendarDays,
    CalendarPlus,
    LayoutList,
    Users,
} from 'lucide-react';
import type { MeetingRoom, Meeting } from '@/types/meeting';
import type { Employee } from '@/types';
import { isActiveStatus } from '@/types';
import { useEmployeeProfile } from '@/hooks/use-employee-profile';
import { BookingCalendar } from './components/booking-calendar';
import { MeetingDialog } from './components/meeting-dialog';
import { MyMeetingsList } from './components/my-meetings-list';
import { MeetingDetailDialog } from './components/meeting-detail-dialog';
import { cn } from '@/lib/utils';
import { getJsonAuthHeaders } from '@/lib/api/client-auth';

type TabId = 'my-meetings' | 'room-calendar';

export default function MeetingsPage() {
    return (
        <React.Suspense fallback={<div className="flex h-full items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>}>
            <MeetingsContent />
        </React.Suspense>
    );
}

function MeetingsContent() {
    const { firestore } = useFirebase();
    const { tDoc, tCollection } = useTenantWrite();
    const { toast } = useToast();
    const searchParams = useSearchParams();
    const router = useRouter();
    const { employeeProfile } = useEmployeeProfile();
    const { user } = useUser();
    const currentUserId = user?.uid || '';

    const [activeTab, setActiveTab] = useState<TabId>('my-meetings');
    const [currentDate, setCurrentDate] = useState(new Date());
    const [view, setView] = useState<'week' | 'day'>('week');
    const [visibleRooms, setVisibleRooms] = useState<Set<string>>(new Set());
    const [roomsInitialized, setRoomsInitialized] = useState(false);

    // Meeting dialog state
    const [isMeetingOpen, setIsMeetingOpen] = useState(false);
    const [editMeeting, setEditMeeting] = useState<Meeting | null>(null);
    const [defaultDate, setDefaultDate] = useState('');
    const [defaultStartTime, setDefaultStartTime] = useState('');
    const [defaultRoomId, setDefaultRoomId] = useState('');
    const [defaultTitle, setDefaultTitle] = useState('');
    const [defaultDescription, setDefaultDescription] = useState('');

    // Detail dialog state
    const [detailMeeting, setDetailMeeting] = useState<Meeting | null>(null);
    const [isDetailOpen, setIsDetailOpen] = useState(false);

    // Deep-link support (?book=1)
    React.useEffect(() => {
        if (searchParams.get('book') === '1') {
            setEditMeeting(null);
            setDefaultDate(searchParams.get('date') || format(new Date(), 'yyyy-MM-dd'));
            setDefaultStartTime(searchParams.get('startTime') || '09:00');
            setDefaultRoomId('');
            setDefaultTitle(searchParams.get('title') || '');
            setDefaultDescription(searchParams.get('description') || '');
            setIsMeetingOpen(true);
            setActiveTab('room-calendar');
            router.replace('/dashboard/meetings', { scroll: false });
        }
    }, [searchParams, router]);

    // Fetch rooms
    const roomsQuery = useMemoFirebase(({ firestore, companyPath }) =>
        firestore ? query(tenantCollection(firestore, companyPath, 'meeting_rooms'), orderBy('name', 'asc')) : null,
        [firestore]
    );
    const { data: rooms, isLoading: roomsLoading } = useFetchCollection<MeetingRoom>(roomsQuery);

    React.useEffect(() => {
        if (rooms && rooms.length > 0 && !roomsInitialized) {
            setVisibleRooms(new Set(rooms.filter(r => r.isActive).map(r => r.id)));
            setRoomsInitialized(true);
        }
    }, [rooms, roomsInitialized]);

    // Date range for room calendar
    const dateRange = useMemo(() => {
        if (view === 'day') {
            return { start: format(currentDate, 'yyyy-MM-dd'), end: format(currentDate, 'yyyy-MM-dd') };
        }
        const wStart = startOfWeek(currentDate, { weekStartsOn: 1 });
        const wEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
        return { start: format(wStart, 'yyyy-MM-dd'), end: format(wEnd, 'yyyy-MM-dd') };
    }, [currentDate, view]);

    // Fetch meetings (room calendar range + broader for my-meetings)
    const meetingsQuery = useMemoFirebase(({ firestore, companyPath }) =>
        firestore
            ? query(
                tenantCollection(firestore, companyPath, 'meetings'),
                where('date', '>=', dateRange.start),
                where('date', '<=', dateRange.end),
                orderBy('date', 'asc')
            )
            : null,
        [firestore, dateRange.start, dateRange.end]
    );
    const { data: calendarMeetings, isLoading: meetingsLoading } = useCollection<Meeting>(meetingsQuery);

    // Broader query for "my meetings" (next 30 days)
    const myMeetingsRange = useMemo(() => {
        const start = format(new Date(), 'yyyy-MM-dd');
        const end = format(addDays(new Date(), 30), 'yyyy-MM-dd');
        return { start, end };
    }, []);

    const myMeetingsQuery = useMemoFirebase(({ firestore, companyPath }) =>
        firestore
            ? query(
                tenantCollection(firestore, companyPath, 'meetings'),
                where('date', '>=', myMeetingsRange.start),
                where('date', '<=', myMeetingsRange.end),
                orderBy('date', 'asc')
            )
            : null,
        [firestore, myMeetingsRange.start, myMeetingsRange.end]
    );
    const { data: allMyMeetings } = useCollection<Meeting>(myMeetingsQuery);

    // Fetch employees
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
        if (view === 'day') return format(currentDate, 'yyyy оны M сарын d', { locale: mn });
        const wStart = startOfWeek(currentDate, { weekStartsOn: 1 });
        const wEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
        return `${format(wStart, 'M/d')} – ${format(wEnd, 'M/d, yyyy')}`;
    }, [currentDate, view]);

    const toggleRoom = (roomId: string) => {
        setVisibleRooms(prev => {
            const next = new Set(prev);
            if (next.has(roomId)) next.delete(roomId); else next.add(roomId);
            return next;
        });
    };

    const toggleAllRooms = () => {
        if (!rooms) return;
        const activeRooms = rooms.filter(r => r.isActive);
        setVisibleRooms(visibleRooms.size === activeRooms.length ? new Set() : new Set(activeRooms.map(r => r.id)));
    };

    const openNewMeeting = useCallback((date?: string, time?: string, roomId?: string) => {
        setEditMeeting(null);
        setDefaultDate(date || format(new Date(), 'yyyy-MM-dd'));
        setDefaultStartTime(time || '09:00');
        setDefaultRoomId(roomId || '');
        setDefaultTitle('');
        setDefaultDescription('');
        setIsMeetingOpen(true);
    }, []);

    const handleSlotClick = useCallback((date: string, time: string) => {
        openNewMeeting(date, time);
    }, [openNewMeeting]);

    const handleCalendarMeetingClick = useCallback((meeting: Meeting) => {
        setDetailMeeting(meeting);
        setIsDetailOpen(true);
    }, []);

    const handleMyMeetingClick = useCallback((meeting: Meeting) => {
        setDetailMeeting(meeting);
        setIsDetailOpen(true);
    }, []);

    const sendCalendarInvite = async (meetingId: string, action: 'create' | 'update' | 'cancel') => {
        try {
            const headers = await getJsonAuthHeaders();
            const res = await fetch('/api/meetings/invite', {
                method: 'POST',
                headers,
                body: JSON.stringify({ meetingId, action }),
            });
            const result = await res.json();
            if (result.success && result.sent > 0) {
                toast({ title: `Календар урилга илгээгдлээ (${result.sent})` });
            }
        } catch {
            // Calendar invite is best-effort; don't block the main operation
        }
    };

    // CRUD
    const handleSaveMeeting = async (data: Omit<Meeting, 'id' | 'createdAt'>) => {
        if (!firestore) return;
        try {
            if (editMeeting) {
                const newSequence = (editMeeting.sequence ?? 0) + 1;
                await updateDoc(tDoc('meetings', editMeeting.id), {
                    ...data,
                    sequence: newSequence,
                    updatedAt: new Date().toISOString(),
                });
                toast({ title: 'Уулзалт шинэчлэгдлээ' });
                sendCalendarInvite(editMeeting.id, 'update');
            } else {
                const docRef = await addDoc(tCollection('meetings'), {
                    ...data,
                    sequence: 0,
                    createdAt: new Date().toISOString(),
                });
                toast({ title: 'Уулзалт амжилттай товлогдлоо' });
                sendCalendarInvite(docRef.id, 'create');
            }
        } catch (err) {
            toast({
                title: 'Уулзалт хадгалахад алдаа гарлаа',
                description: err instanceof Error ? err.message : 'Дахин оролдоно уу.',
                variant: 'destructive',
            });
            throw err;
        }
    };

    const handleCancelMeeting = async (meetingId: string) => {
        if (!firestore) return;
        try {
            await updateDoc(tDoc('meetings', meetingId), {
                status: 'cancelled',
                updatedAt: new Date().toISOString(),
            });
            toast({ title: 'Уулзалт цуцлагдлаа' });
            sendCalendarInvite(meetingId, 'cancel');
            setIsDetailOpen(false);
        } catch (err) {
            toast({
                title: 'Цуцлахад алдаа гарлаа',
                description: err instanceof Error ? err.message : 'Дахин оролдоно уу.',
                variant: 'destructive',
            });
        }
    };

    const handleRsvp = useCallback(async (meetingId: string, response: 'accepted' | 'declined' | 'tentative') => {
        if (!firestore || !currentUserId) return;
        try {
            const meetingList = [...(allMyMeetings || []), ...(calendarMeetings || [])];
            const meeting = meetingList.find(m => m.id === meetingId);
            if (!meeting) return;

            const updatedAttendees = meeting.attendees.map(a =>
                a.employeeId === currentUserId
                    ? { ...a, response, respondedAt: new Date().toISOString() }
                    : a
            );

            await updateDoc(tDoc('meetings', meetingId), {
                attendees: updatedAttendees,
                updatedAt: new Date().toISOString(),
            });

            const labels = { accepted: 'Зөвшөөрсөн', declined: 'Татгалзсан', tentative: 'Магадгүй' };
            toast({ title: `Хариу: ${labels[response]}` });
        } catch (err) {
            toast({
                title: 'Хариу өгөхөд алдаа гарлаа',
                variant: 'destructive',
            });
        }
    }, [firestore, currentUserId, allMyMeetings, calendarMeetings, tDoc, toast]);

    const handleEditFromDetail = useCallback((meeting: Meeting) => {
        setEditMeeting(meeting);
        setDefaultDate('');
        setDefaultStartTime('');
        setDefaultRoomId('');
        setDefaultTitle('');
        setDefaultDescription('');
        setIsMeetingOpen(true);
    }, []);

    // Today's upcoming for sidebar
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const todayMeetings = useMemo(() => {
        if (!calendarMeetings) return [];
        const now = format(new Date(), 'HH:mm');
        return calendarMeetings
            .filter(m => m.date === todayStr && m.status === 'scheduled' && m.endTime > now)
            .sort((a, b) => a.startTime.localeCompare(b.startTime));
    }, [calendarMeetings, todayStr]);

    const isLoading = roomsLoading || meetingsLoading;

    const tabs = [
        { id: 'my-meetings' as TabId, label: 'Миний уулзалтууд', icon: Users },
        { id: 'room-calendar' as TabId, label: 'Өрөөний календар', icon: DoorOpen },
    ];

    return (
        <div className="flex flex-col h-full overflow-hidden">
            {/* Header */}
            <div className="shrink-0 px-6 py-4 border-b bg-white">
                <PageHeader
                    title="Уулзалт"
                    description="Уулзалт товлох, хуваарь харах"
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
                                label="Уулзалт товлох"
                                description="Шинэ уулзалт үүсгэх"
                                onClick={() => openNewMeeting()}
                            />
                        </div>
                    }
                />
            </div>

            {/* Tab bar */}
            <div className="shrink-0 px-6 border-b bg-white">
                <div className="flex items-center gap-1">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={cn(
                                'flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
                                activeTab === tab.id
                                    ? 'border-primary text-primary'
                                    : 'border-transparent text-muted-foreground hover:text-foreground'
                            )}
                        >
                            <tab.icon className="h-4 w-4" />
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Content */}
            {activeTab === 'my-meetings' ? (
                <div className="flex-1 overflow-y-auto p-6">
                    <MyMeetingsList
                        meetings={allMyMeetings || []}
                        currentUserId={currentUserId}
                        onMeetingClick={handleMyMeetingClick}
                        onRsvp={handleRsvp}
                    />
                </div>
            ) : (
                <>
                    {/* Room Calendar Toolbar */}
                    <div className="shrink-0 px-6 py-3 border-b bg-slate-50/50 flex items-center justify-between gap-4 flex-wrap">
                        <div className="flex items-center gap-2">
                            <Button variant="outline" size="sm" onClick={goToday} className="h-8 text-xs">Өнөөдөр</Button>
                            <div className="flex items-center">
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={goPrev}><ChevronLeft className="h-4 w-4" /></Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={goNext}><ChevronRight className="h-4 w-4" /></Button>
                            </div>
                            <span className="text-sm font-semibold min-w-[180px]">{dateLabel}</span>
                        </div>
                        <div className="flex items-center gap-1 bg-white rounded-lg border p-0.5">
                            <Button variant={view === 'day' ? 'default' : 'ghost'} size="sm" className="h-7 text-xs px-3" onClick={() => setView('day')}>
                                <CalendarDays className="h-3.5 w-3.5 mr-1" />Өдөр
                            </Button>
                            <Button variant={view === 'week' ? 'default' : 'ghost'} size="sm" className="h-7 text-xs px-3" onClick={() => setView('week')}>
                                <LayoutList className="h-3.5 w-3.5 mr-1" />Долоо хоног
                            </Button>
                        </div>
                    </div>

                    {/* Main content with sidebar */}
                    <div className="flex-1 flex overflow-hidden">
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
                                        <Link href="/dashboard/meetings/rooms"><Plus className="h-4 w-4 mr-2" />Өрөө нэмэх</Link>
                                    </Button>
                                </div>
                            ) : (
                                <BookingCalendar
                                    currentDate={currentDate}
                                    meetings={calendarMeetings || []}
                                    rooms={rooms || []}
                                    visibleRoomIds={visibleRooms}
                                    onSlotClick={handleSlotClick}
                                    onMeetingClick={handleCalendarMeetingClick}
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
                                        <button onClick={toggleAllRooms} className="text-[10px] text-indigo-600 hover:underline font-medium">
                                            {rooms && visibleRooms.size === rooms.filter(r => r.isActive).length ? 'Бүгд арилгах' : 'Бүгд сонгох'}
                                        </button>
                                    </div>
                                    <div className="space-y-1.5">
                                        {rooms?.filter(r => r.isActive).map(room => (
                                            <label key={room.id} className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors">
                                                <Checkbox checked={visibleRooms.has(room.id)} onCheckedChange={() => toggleRoom(room.id)} />
                                                <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: room.color }} />
                                                <span className="text-sm truncate">{room.name}</span>
                                                <span className="text-[10px] text-muted-foreground ml-auto">{room.capacity}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                {/* Today's meetings */}
                                <div>
                                    <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Өнөөдрийн уулзалт</h3>
                                    {todayMeetings.length === 0 ? (
                                        <p className="text-xs text-muted-foreground italic px-2">Уулзалт байхгүй</p>
                                    ) : (
                                        <div className="space-y-2">
                                            {todayMeetings.map(m => {
                                                const room = rooms?.find(r => r.id === m.roomId);
                                                return (
                                                    <button
                                                        key={m.id}
                                                        className="w-full text-left p-2.5 rounded-lg border hover:bg-slate-50 transition-colors space-y-1"
                                                        onClick={() => handleCalendarMeetingClick(m)}
                                                    >
                                                        <div className="flex items-center gap-2">
                                                            {room && <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: room.color }} />}
                                                            <span className="text-xs font-semibold truncate">{m.title}</span>
                                                        </div>
                                                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                                                            <Clock className="h-3 w-3" />
                                                            <span>{m.startTime}–{m.endTime}</span>
                                                            {room && <span className="truncate">{room.name}</span>}
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
                </>
            )}

            {/* Meeting Dialog */}
            <MeetingDialog
                open={isMeetingOpen}
                onOpenChange={setIsMeetingOpen}
                rooms={rooms || []}
                employees={employees}
                existingMeetings={calendarMeetings || []}
                onSave={handleSaveMeeting}
                defaultDate={defaultDate}
                defaultStartTime={defaultStartTime}
                defaultRoomId={defaultRoomId}
                defaultTitle={defaultTitle}
                defaultDescription={defaultDescription}
                defaultOrganizer={employeeProfile?.id}
                defaultOrganizerName={employeeProfile ? `${employeeProfile.lastName || ''} ${employeeProfile.firstName || ''}`.trim() : undefined}
                editMeeting={editMeeting}
                onCancel={handleCancelMeeting}
            />

            {/* Meeting Detail Dialog */}
            <MeetingDetailDialog
                open={isDetailOpen}
                onOpenChange={setIsDetailOpen}
                meeting={detailMeeting}
                currentUserId={currentUserId}
                onEdit={handleEditFromDetail}
                onCancel={handleCancelMeeting}
                onRsvp={handleRsvp}
            />
        </div>
    );
}
