'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
    format,
    startOfMonth,
    endOfMonth,
    eachDayOfInterval,
    isToday,
    isSameMonth,
    addMonths,
    subMonths,
    isSameDay,
    parseISO,
    startOfWeek,
    endOfWeek,
} from 'date-fns';
import { mn } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, Clock, Plus, Video, MapPin, User, Calendar as CalendarIcon, Edit, ExternalLink } from 'lucide-react';
import { useCollection, useFirebase, useMemoFirebase, tenantCollection } from '@/firebase';
import { query, where, Timestamp } from 'firebase/firestore';
import { Interview } from '@/types/recruitment';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import {
    HoverCard,
    HoverCardContent,
    HoverCardTrigger,
} from "@/components/ui/hover-card"
import { ScheduleInterviewDialog } from './schedule-interview-dialog';

export function RecruitmentCalendar({ vacancyId }: { vacancyId?: string }) {
    const router = useRouter();
    const [currentDate, setCurrentDate] = useState(new Date());
    const [editingInterview, setEditingInterview] = useState<Interview | null>(null);
    const { firestore } = useFirebase();

    // Query interviews for the current month window (plus buffer for week view)
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

    // In a real app with many events, we should filter by date range in Firestore.
    const interviewsQuery = useMemoFirebase(
        ({ firestore, companyPath }) => {
            if (!firestore) return null;
            if (vacancyId) {
                return query(tenantCollection(firestore, companyPath, 'interviews'), where('vacancyId', '==', vacancyId));
            }
            return tenantCollection(firestore, companyPath, 'interviews');
        },
        [firestore, vacancyId]
    );

    const { data: interviews, isLoading } = useCollection<Interview>(interviewsQuery as any);

    const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
    const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));
    const goToToday = () => setCurrentDate(new Date());

    const days = eachDayOfInterval({
        start: calendarStart,
        end: calendarEnd,
    });

    const getDayEvents = (day: Date) => {
        if (!interviews) return [];
        return interviews.filter((interview) =>
            isSameDay(parseISO(interview.startTime), day)
        ).sort((a, b) => parseISO(a.startTime).getTime() - parseISO(b.startTime).getTime());
    };

    if (isLoading) {
        return <div className="h-[600px] w-full flex items-center justify-center">
            <Skeleton className="h-[600px] w-full rounded-xl" />
        </div>;
    }

    return (
        <div className="flex flex-col h-full space-y-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <h2 className="text-lg font-semibold capitalize">
                        {format(currentDate, 'MMMM yyyy', { locale: mn })}
                    </h2>
                    <div className="flex items-center rounded-md border bg-background shadow-sm">
                        <Button variant="ghost" size="icon" onClick={prevMonth} className="h-8 w-8">
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <div className="w-px h-4 bg-border" />
                        <Button variant="ghost" size="icon" onClick={nextMonth} className="h-8 w-8">
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                    <Button variant="outline" size="sm" onClick={goToToday}>
                        Өнөөдөр
                    </Button>
                </div>
                <div className="flex items-center gap-2">
                    <ScheduleInterviewDialog vacancyId={vacancyId} />
                    <ScheduleInterviewDialog
                        interview={editingInterview}
                        open={!!editingInterview}
                        onOpenChange={(o) => !o && setEditingInterview(null)}
                        onUpdated={() => setEditingInterview(null)}
                    />
                </div>
            </div>

            <div className="grid grid-cols-7 gap-px bg-muted rounded-lg overflow-hidden border shadow-sm">
                {/* Weekday headers */}
                {['Дав', 'Мяг', 'Лха', 'Пүр', 'Баа', 'Бям', 'Ням'].map((day, i) => (
                    <div key={day} className="bg-background p-2 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        {day}
                    </div>
                ))}

                {/* Calendar Grid */}
                {days.map((day, dayIdx) => {
                    const isSelectedMonth = isSameMonth(day, currentDate);
                    const isTodayDate = isToday(day);
                    const dayEvents = getDayEvents(day);

                    return (
                        <div
                            key={day.toISOString()}
                            className={cn(
                                "min-h-[120px] bg-background p-2 flex flex-col gap-1 transition-colors hover:bg-muted/30 relative group",
                                !isSelectedMonth && "bg-muted/10 text-muted-foreground"
                            )}
                        >
                            <span
                                className={cn(
                                    "text-sm font-medium h-7 w-7 flex items-center justify-center rounded-full transition-all",
                                    isTodayDate
                                        ? "bg-primary text-primary-foreground shadow-md scale-105"
                                        : "text-foreground/70",
                                    !isSelectedMonth && "opacity-50"
                                )}
                            >
                                {format(day, 'd')}
                            </span>

                            <div className="flex-1 flex flex-col gap-1.5 overflow-y-auto max-h-[100px] custom-scrollbar">
                                {dayEvents.map((event) => (
                                    <HoverCard key={event.id}>
                                        <HoverCardTrigger asChild>
                                            <div className={cn(
                                                "text-xs p-1.5 rounded border border-l-2 cursor-pointer truncate shadow-sm transition-all hover:scale-[1.02]",
                                                event.status === 'SCHEDULED' ? "bg-blue-50 border-blue-200 border-l-blue-500 text-blue-700 hover:bg-blue-100" :
                                                    event.status === 'COMPLETED' ? "bg-green-50 border-green-200 border-l-green-500 text-green-700 hover:bg-green-100" :
                                                        event.status === 'CANCELLED' ? "bg-red-50 border-red-200 border-l-red-500 text-red-700 decoration-line-through opacity-70" :
                                                            "bg-gray-50 border-gray-200 border-l-gray-500 text-gray-700"
                                            )}>
                                                <div className="flex items-center gap-1">
                                                    <span className="font-bold shrink-0">{format(parseISO(event.startTime), 'HH:mm')}</span>
                                                    <span className="truncate font-medium">{event.candidateName}</span>
                                                </div>
                                                <div className="text-[10px] opacity-80 truncate pl-1">
                                                    {event.title}
                                                </div>
                                            </div>
                                        </HoverCardTrigger>
                                        <HoverCardContent className="w-80 p-0 overflow-hidden" align="start">
                                            <div className="bg-primary/5 p-4 border-b">
                                                <div className="flex items-center justify-between mb-2">
                                                    <Badge variant="outline" className={cn(
                                                        "bg-background",
                                                        event.status === 'SCHEDULED' ? "text-blue-600 border-blue-200" : "text-gray-600"
                                                    )}>
                                                        {event.status === 'SCHEDULED' ? 'Төлөвлөгдсөн' : event.status}
                                                    </Badge>
                                                    <div className="flex gap-1">
                                                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setEditingInterview(event); }}>
                                                            <Edit className="h-3 w-3" />
                                                        </Button>
                                                    </div>
                                                </div>
                                                <h4 className="font-semibold text-lg leading-tight mb-1">{event.candidateName}</h4>
                                                <p className="text-sm text-muted-foreground">{event.vacancyTitle}</p>
                                            </div>
                                            <div className="p-4 space-y-3">
                                                <div className="grid grid-cols-2 gap-2">
                                                    <div className="flex items-center gap-2 text-sm">
                                                        <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                                                        <span>{format(parseISO(event.startTime), 'yyyy.MM.dd')}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2 text-sm">
                                                        <Clock className="h-4 w-4 text-muted-foreground" />
                                                        <span>{format(parseISO(event.startTime), 'HH:mm')} - {format(parseISO(event.endTime), 'HH:mm')}</span>
                                                    </div>
                                                </div>
                                                <div className="flex items-start gap-2 text-sm">
                                                    {event.location && event.location.startsWith('http') ? (
                                                        <Video className="h-4 w-4 text-muted-foreground mt-0.5" />
                                                    ) : (
                                                        <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                                                    )}
                                                    <span className="text-muted-foreground line-clamp-2">
                                                        {event.location || 'Байршил тодорхойгүй'}
                                                    </span>
                                                </div>
                                                <Button
                                                    className="w-full bg-blue-600 hover:bg-blue-700 mt-2 gap-2 shadow-sm"
                                                    onClick={() => router.push(`/dashboard/recruitment/applications/${event.applicationId}`)}
                                                >
                                                    <ExternalLink className="h-4 w-4" />
                                                    Дэлгэрэнгүй үзэх
                                                </Button>
                                            </div>
                                        </HoverCardContent>
                                    </HoverCard>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
