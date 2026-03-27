'use client';

import React, { useMemo } from 'react';
import { format, addDays, startOfWeek, isToday } from 'date-fns';
import { mn } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import type { MeetingRoom, Meeting } from '@/types/meeting';

interface BookingCalendarProps {
    currentDate: Date;
    meetings: Meeting[];
    rooms: MeetingRoom[];
    visibleRoomIds: Set<string>;
    onSlotClick: (date: string, time: string) => void;
    onMeetingClick: (meeting: Meeting) => void;
    view: 'week' | 'day';
}

const HOUR_START = 8;
const HOUR_END = 20;
const SLOT_HEIGHT = 48;
const HOURS = Array.from({ length: HOUR_END - HOUR_START }, (_, i) => HOUR_START + i);

function timeToMinutes(time: string): number {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
}

function minutesToOffset(minutes: number): number {
    const startMinutes = HOUR_START * 60;
    return ((minutes - startMinutes) / 30) * SLOT_HEIGHT;
}

function getMeetingStyle(meeting: Meeting, room: MeetingRoom | undefined) {
    const startMin = timeToMinutes(meeting.startTime);
    const endMin = timeToMinutes(meeting.endTime);
    const top = minutesToOffset(startMin);
    const height = ((endMin - startMin) / 30) * SLOT_HEIGHT;
    const color = room?.color || '#6366f1';

    return {
        top: `${top}px`,
        height: `${Math.max(height, SLOT_HEIGHT / 2)}px`,
        backgroundColor: `${color}18`,
        borderLeft: `3px solid ${color}`,
        color,
    };
}

export function BookingCalendar({
    currentDate,
    meetings,
    rooms,
    visibleRoomIds,
    onSlotClick,
    onMeetingClick,
    view,
}: BookingCalendarProps) {
    const weekDays = useMemo(() => {
        if (view === 'day') return [currentDate];
        const start = startOfWeek(currentDate, { weekStartsOn: 1 });
        return Array.from({ length: 7 }, (_, i) => addDays(start, i));
    }, [currentDate, view]);

    const meetingsByDate = useMemo(() => {
        const map = new Map<string, Meeting[]>();
        meetings
            .filter(m => m.status === 'scheduled' && m.roomId && visibleRoomIds.has(m.roomId))
            .forEach(m => {
                const key = m.date;
                if (!map.has(key)) map.set(key, []);
                map.get(key)!.push(m);
            });
        return map;
    }, [meetings, visibleRoomIds]);

    const roomMap = useMemo(() => {
        const m = new Map<string, MeetingRoom>();
        rooms.forEach(r => m.set(r.id, r));
        return m;
    }, [rooms]);

    const layoutMeetings = (dayMeetings: Meeting[]) => {
        const sorted = [...dayMeetings].sort((a, b) => a.startTime.localeCompare(b.startTime));
        const columns: Meeting[][] = [];

        sorted.forEach(meeting => {
            let placed = false;
            for (const col of columns) {
                const last = col[col.length - 1];
                if (last.endTime <= meeting.startTime) {
                    col.push(meeting);
                    placed = true;
                    break;
                }
            }
            if (!placed) columns.push([meeting]);
        });

        const layoutMap = new Map<string, { col: number; totalCols: number }>();
        columns.forEach((col, colIdx) => {
            col.forEach(m => {
                layoutMap.set(m.id, { col: colIdx, totalCols: columns.length });
            });
        });

        return layoutMap;
    };

    const totalHeight = HOURS.length * SLOT_HEIGHT * 2;

    return (
        <div className="flex-1 overflow-auto border rounded-xl bg-white">
            <div className="flex min-w-[600px]">
                {/* Time column */}
                <div className="w-16 shrink-0 border-r bg-slate-50/50">
                    <div className="h-12 border-b" />
                    <div className="relative" style={{ height: `${totalHeight}px` }}>
                        {HOURS.map(hour => (
                            <div
                                key={hour}
                                className="absolute left-0 right-0 text-right pr-2"
                                style={{ top: `${(hour - HOUR_START) * SLOT_HEIGHT * 2}px` }}
                            >
                                <span className="text-[10px] font-medium text-muted-foreground -translate-y-1/2 inline-block">
                                    {String(hour).padStart(2, '0')}:00
                                </span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Day columns */}
                {weekDays.map(day => {
                    const dateStr = format(day, 'yyyy-MM-dd');
                    const dayMeetings = meetingsByDate.get(dateStr) || [];
                    const layout = layoutMeetings(dayMeetings);
                    const today = isToday(day);

                    return (
                        <div
                            key={dateStr}
                            className={cn('flex-1 min-w-[100px] border-r last:border-r-0', today && 'bg-indigo-50/30')}
                        >
                            <div className={cn(
                                'h-12 border-b flex flex-col items-center justify-center sticky top-0 z-10 bg-white',
                                today && 'bg-indigo-50'
                            )}>
                                <span className="text-[10px] font-medium text-muted-foreground uppercase">
                                    {format(day, 'EEE', { locale: mn })}
                                </span>
                                <span className={cn(
                                    'text-sm font-semibold',
                                    today ? 'text-indigo-600 bg-indigo-100 rounded-full h-6 w-6 flex items-center justify-center' : 'text-foreground'
                                )}>
                                    {format(day, 'd')}
                                </span>
                            </div>

                            <div className="relative" style={{ height: `${totalHeight}px` }}>
                                {HOURS.map(hour => (
                                    <React.Fragment key={hour}>
                                        <div className="absolute left-0 right-0 border-t border-slate-100" style={{ top: `${(hour - HOUR_START) * SLOT_HEIGHT * 2}px` }} />
                                        <div className="absolute left-0 right-0 border-t border-slate-50" style={{ top: `${(hour - HOUR_START) * SLOT_HEIGHT * 2 + SLOT_HEIGHT}px` }} />
                                    </React.Fragment>
                                ))}

                                {HOURS.map(hour => (
                                    <React.Fragment key={`slot-${hour}`}>
                                        <button
                                            className="absolute left-0 right-0 hover:bg-indigo-50/50 transition-colors z-0"
                                            style={{ top: `${(hour - HOUR_START) * SLOT_HEIGHT * 2}px`, height: `${SLOT_HEIGHT}px` }}
                                            onClick={() => onSlotClick(dateStr, `${String(hour).padStart(2, '0')}:00`)}
                                        />
                                        <button
                                            className="absolute left-0 right-0 hover:bg-indigo-50/50 transition-colors z-0"
                                            style={{ top: `${(hour - HOUR_START) * SLOT_HEIGHT * 2 + SLOT_HEIGHT}px`, height: `${SLOT_HEIGHT}px` }}
                                            onClick={() => onSlotClick(dateStr, `${String(hour).padStart(2, '0')}:30`)}
                                        />
                                    </React.Fragment>
                                ))}

                                {dayMeetings.map(meeting => {
                                    const room = meeting.roomId ? roomMap.get(meeting.roomId) : undefined;
                                    const style = getMeetingStyle(meeting, room);
                                    const { col, totalCols } = layout.get(meeting.id) || { col: 0, totalCols: 1 };
                                    const widthPct = totalCols > 1 ? 100 / totalCols : 100;
                                    const leftPct = col * widthPct;

                                    return (
                                        <button
                                            key={meeting.id}
                                            className="absolute rounded-md px-1.5 py-1 text-left z-10 hover:opacity-80 transition-opacity overflow-hidden cursor-pointer"
                                            style={{
                                                ...style,
                                                width: `${widthPct - 2}%`,
                                                left: `${leftPct + 1}%`,
                                            }}
                                            onClick={e => { e.stopPropagation(); onMeetingClick(meeting); }}
                                        >
                                            <p className="text-[10px] font-bold truncate leading-tight" style={{ color: style.color }}>
                                                {meeting.title}
                                            </p>
                                            <p className="text-[9px] opacity-70 truncate" style={{ color: style.color }}>
                                                {meeting.startTime}–{meeting.endTime}
                                            </p>
                                            {room && (
                                                <p className="text-[9px] opacity-60 truncate" style={{ color: style.color }}>
                                                    {room.name}
                                                </p>
                                            )}
                                        </button>
                                    );
                                })}

                                {today && <CurrentTimeIndicator />}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function CurrentTimeIndicator() {
    const [now, setNow] = React.useState(new Date());

    React.useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 60000);
        return () => clearInterval(timer);
    }, []);

    const minutes = now.getHours() * 60 + now.getMinutes();
    if (minutes < HOUR_START * 60 || minutes > HOUR_END * 60) return null;

    const top = minutesToOffset(minutes);

    return (
        <div className="absolute left-0 right-0 z-20 pointer-events-none" style={{ top: `${top}px` }}>
            <div className="flex items-center">
                <div className="h-2.5 w-2.5 rounded-full bg-red-500 -ml-1" />
                <div className="flex-1 h-[2px] bg-red-500" />
            </div>
        </div>
    );
}
