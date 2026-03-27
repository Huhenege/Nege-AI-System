'use client';

import React, { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { mn } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
    CalendarDays,
    Check,
    Clock,
    DoorOpen,
    HelpCircle,
    Link2,
    MapPin,
    Star,
    Users,
    X,
    Video,
} from 'lucide-react';
import type { Meeting, MeetingType } from '@/types/meeting';
import { MEETING_TYPE_LABELS } from '@/types/meeting';
import { cn } from '@/lib/utils';

type MeetingFilter = 'upcoming' | 'today' | 'pending';

interface MyMeetingsListProps {
    meetings: Meeting[];
    currentUserId: string;
    onMeetingClick: (meeting: Meeting) => void;
    onRsvp: (meetingId: string, response: 'accepted' | 'declined' | 'tentative') => void;
}

const TYPE_ICONS: Record<MeetingType, string> = {
    one_on_one: '👤',
    team: '👥',
    department: '🏢',
    standup: '⚡',
    review: '📋',
    external: '🌐',
    other: '📌',
};

const RESPONSE_CONFIG = {
    accepted: { label: 'Зөвшөөрсөн', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    declined: { label: 'Татгалзсан', className: 'bg-rose-50 text-rose-600 border-rose-200' },
    tentative: { label: 'Магадгүй', className: 'bg-amber-50 text-amber-700 border-amber-200' },
    pending: { label: 'Хүлээгдэж буй', className: 'bg-slate-50 text-slate-600 border-slate-200' },
};

export function MyMeetingsList({
    meetings,
    currentUserId,
    onMeetingClick,
    onRsvp,
}: MyMeetingsListProps) {
    const [filter, setFilter] = useState<MeetingFilter>('upcoming');
    const todayStr = format(new Date(), 'yyyy-MM-dd');

    const filtered = useMemo(() => {
        const now = new Date();
        const nowStr = format(now, 'yyyy-MM-dd');
        const nowTime = format(now, 'HH:mm');

        let list = meetings
            .filter(m => m.status === 'scheduled')
            .filter(m =>
                m.organizer === currentUserId ||
                m.attendeeIds.includes(currentUserId)
            );

        if (filter === 'today') {
            list = list.filter(m => m.date === nowStr);
        } else if (filter === 'pending') {
            list = list.filter(m => {
                const att = m.attendees.find(a => a.employeeId === currentUserId);
                return att?.response === 'pending';
            });
        } else {
            list = list.filter(m => m.date > nowStr || (m.date === nowStr && m.endTime > nowTime));
        }

        return list.sort((a, b) => {
            if (a.date !== b.date) return a.date.localeCompare(b.date);
            return a.startTime.localeCompare(b.startTime);
        });
    }, [meetings, filter, currentUserId]);

    const pendingCount = useMemo(() => {
        return meetings.filter(m =>
            m.status === 'scheduled' &&
            m.attendees.some(a => a.employeeId === currentUserId && a.response === 'pending')
        ).length;
    }, [meetings, currentUserId]);

    const filters: { id: MeetingFilter; label: string; count?: number }[] = [
        { id: 'upcoming', label: 'Удахгүй' },
        { id: 'today', label: 'Өнөөдөр' },
        { id: 'pending', label: 'Хариу өгөөгүй', count: pendingCount },
    ];

    return (
        <div className="space-y-4">
            {/* Filters */}
            <div className="flex items-center gap-1.5">
                {filters.map(f => (
                    <button
                        key={f.id}
                        onClick={() => setFilter(f.id)}
                        className={cn(
                            'px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
                            filter === f.id
                                ? 'bg-primary text-primary-foreground border-primary'
                                : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                        )}
                    >
                        {f.label}
                        {f.count ? (
                            <span className="ml-1.5 bg-destructive text-destructive-foreground rounded-full px-1.5 text-[10px]">
                                {f.count}
                            </span>
                        ) : null}
                    </button>
                ))}
            </div>

            {/* Meeting list */}
            {filtered.length === 0 ? (
                <div className="text-center py-16 space-y-3">
                    <div className="mx-auto h-14 w-14 rounded-2xl bg-slate-100 flex items-center justify-center">
                        <CalendarDays className="h-7 w-7 text-slate-400" />
                    </div>
                    <p className="text-sm text-muted-foreground">
                        {filter === 'pending' ? 'Хариу өгөөгүй уулзалт байхгүй' : 'Уулзалт байхгүй'}
                    </p>
                </div>
            ) : (
                <div className="space-y-2">
                    {filtered.map(meeting => (
                        <MeetingCard
                            key={meeting.id}
                            meeting={meeting}
                            currentUserId={currentUserId}
                            onClick={() => onMeetingClick(meeting)}
                            onRsvp={onRsvp}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

function MeetingCard({
    meeting,
    currentUserId,
    onClick,
    onRsvp,
}: {
    meeting: Meeting;
    currentUserId: string;
    onClick: () => void;
    onRsvp: (meetingId: string, response: 'accepted' | 'declined' | 'tentative') => void;
}) {
    const isOrganizer = meeting.organizer === currentUserId;
    const myAttendee = meeting.attendees.find(a => a.employeeId === currentUserId);
    const myResponse = isOrganizer ? 'accepted' : myAttendee?.response || 'pending';
    const isToday = meeting.date === format(new Date(), 'yyyy-MM-dd');
    const acceptedCount = meeting.attendees.filter(a => a.response === 'accepted').length;

    let dateLabel: string;
    try {
        const d = new Date(meeting.date + 'T00:00:00');
        dateLabel = format(d, 'M/d (EEE)', { locale: mn });
    } catch {
        dateLabel = meeting.date;
    }

    return (
        <div
            className={cn(
                'group rounded-xl border bg-white p-4 transition-all hover:shadow-sm hover:border-primary/20 cursor-pointer',
                isToday && 'ring-1 ring-primary/20',
                meeting.priority === 'high' && 'border-l-4 border-l-amber-400'
            )}
            onClick={onClick}
        >
            <div className="flex items-start gap-3">
                {/* Type icon */}
                <div className="text-xl mt-0.5 shrink-0">
                    {TYPE_ICONS[meeting.type]}
                </div>

                <div className="flex-1 min-w-0 space-y-2">
                    {/* Title row */}
                    <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                                <h4 className="text-sm font-semibold truncate">{meeting.title}</h4>
                                {meeting.priority === 'high' && (
                                    <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500 shrink-0" />
                                )}
                            </div>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                                <span className="flex items-center gap-1">
                                    <CalendarDays className="h-3 w-3" />
                                    {dateLabel}
                                </span>
                                <span className="flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {meeting.startTime}–{meeting.endTime}
                                </span>
                            </div>
                        </div>

                        <Badge variant="outline" className={cn('text-[10px] shrink-0', RESPONSE_CONFIG[myResponse].className)}>
                            {isOrganizer ? 'Зохион байгуулагч' : RESPONSE_CONFIG[myResponse].label}
                        </Badge>
                    </div>

                    {/* Meta row */}
                    <div className="flex items-center gap-3 flex-wrap">
                        {meeting.roomName && (
                            <span className="flex items-center gap-1 text-xs text-slate-500">
                                <DoorOpen className="h-3 w-3" />
                                {meeting.roomName}
                            </span>
                        )}
                        {meeting.location && !meeting.roomId && (
                            <span className="flex items-center gap-1 text-xs text-slate-500">
                                <MapPin className="h-3 w-3" />
                                {meeting.location}
                            </span>
                        )}
                        {meeting.meetingLink && (
                            <span className="flex items-center gap-1 text-xs text-blue-500">
                                <Video className="h-3 w-3" />
                                Онлайн
                            </span>
                        )}
                        <span className="flex items-center gap-1 text-xs text-slate-500">
                            <Users className="h-3 w-3" />
                            {acceptedCount}/{meeting.attendees.length} зөвшөөрсөн
                        </span>
                    </div>

                    {/* Attendee avatars */}
                    {meeting.attendees.length > 0 && (
                        <div className="flex items-center gap-1">
                            <TooltipProvider delayDuration={100}>
                                {meeting.attendees.slice(0, 6).map(att => {
                                    const initials = att.name.split(' ').map(n => n[0]).join('').slice(0, 2);
                                    const respColor = att.response === 'accepted' ? 'ring-emerald-400'
                                        : att.response === 'declined' ? 'ring-rose-400'
                                        : att.response === 'tentative' ? 'ring-amber-400'
                                        : 'ring-slate-200';
                                    return (
                                        <Tooltip key={att.employeeId}>
                                            <TooltipTrigger asChild>
                                                <Avatar className={cn('h-7 w-7 ring-2', respColor)}>
                                                    <AvatarFallback className="text-[10px] bg-slate-100">
                                                        {initials}
                                                    </AvatarFallback>
                                                </Avatar>
                                            </TooltipTrigger>
                                            <TooltipContent>
                                                <p className="text-xs">{att.name} — {RESPONSE_CONFIG[att.response].label}</p>
                                            </TooltipContent>
                                        </Tooltip>
                                    );
                                })}
                            </TooltipProvider>
                            {meeting.attendees.length > 6 && (
                                <span className="text-[10px] text-muted-foreground ml-1">+{meeting.attendees.length - 6}</span>
                            )}
                        </div>
                    )}

                    {/* RSVP actions (only for attendees with pending response) */}
                    {!isOrganizer && myResponse === 'pending' && (
                        <div className="flex items-center gap-2 pt-1" onClick={e => e.stopPropagation()}>
                            <Button
                                size="sm"
                                className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700"
                                onClick={() => onRsvp(meeting.id, 'accepted')}
                            >
                                <Check className="h-3 w-3 mr-1" />
                                Зөвшөөрөх
                            </Button>
                            <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs text-amber-600 border-amber-200 hover:bg-amber-50"
                                onClick={() => onRsvp(meeting.id, 'tentative')}
                            >
                                <HelpCircle className="h-3 w-3 mr-1" />
                                Магадгүй
                            </Button>
                            <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs text-rose-600 border-rose-200 hover:bg-rose-50"
                                onClick={() => onRsvp(meeting.id, 'declined')}
                            >
                                <X className="h-3 w-3 mr-1" />
                                Татгалзах
                            </Button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
