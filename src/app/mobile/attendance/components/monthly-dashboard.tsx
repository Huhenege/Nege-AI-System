'use client';

import * as React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock, AlertCircle, TrendingUp } from 'lucide-react';
import { format, startOfMonth, endOfMonth, addMonths, eachDayOfInterval, isSameDay, differenceInMinutes, parseISO } from 'date-fns';
import { mn } from 'date-fns/locale';
import { useFirebase, useCollection, useDoc, useMemoFirebase, tenantCollection, tenantDoc } from '@/firebase';
import { collection, doc, query, where } from 'firebase/firestore';
import { cn } from '@/lib/utils';
import type { AttendanceRecord } from '@/types/attendance';
import { Skeleton } from '@/components/ui/skeleton';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { buildRecurringDayMap, resolveDayType, type DayType, type WorkCalendar } from '@/lib/work-calendar-utils';

interface MonthlyAttendanceDashboardProps {
    employeeId: string;
}

interface DayDetail {
    date: Date;
    record?: AttendanceRecord;
}

export const MonthlyAttendanceDashboard = React.memo(function MonthlyAttendanceDashboard({ 
    employeeId 
}: MonthlyAttendanceDashboardProps) {
    const { firestore } = useFirebase();
    const [currentMonth, setCurrentMonth] = React.useState(new Date());
    const [selectedDay, setSelectedDay] = React.useState<DayDetail | null>(null);

    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);

    const startStr = format(monthStart, 'yyyy-MM-dd');
    const endStr = format(monthEnd, 'yyyy-MM-dd');

    const attendanceQuery = useMemoFirebase(({ companyPath }) => employeeId ? query(
        tenantCollection(firestore, companyPath, 'attendance'),
        where('employeeId', '==', employeeId),
        where('date', '>=', startStr),
        where('date', '<=', endStr)
    ) : null, [firestore, employeeId, startStr, endStr]);

    const { data: attendanceRecords, isLoading } = useCollection<AttendanceRecord>(attendanceQuery);

    // Company work calendar for day-type resolution
    const workCalendarRef = useMemoFirebase(({ companyPath }) => (firestore ? tenantDoc(firestore, companyPath, 'workCalendars', 'default') : null), [firestore]);
    const { data: workCalendar, isLoading: isWorkCalendarLoading } = useDoc<WorkCalendar>(workCalendarRef as any);
    const recurringDayMap = React.useMemo(() => buildRecurringDayMap(workCalendar), [workCalendar]);

    const getDayType = React.useCallback((date: Date): DayType => {
        if (!workCalendar) return 'working';
        return resolveDayType(date, workCalendar, recurringDayMap);
    }, [workCalendar, recurringDayMap]);

    const getBaselineMinutes = React.useCallback((dateStr: string): number => {
        if (!workCalendar) return 8 * 60;
        const dt = resolveDayType(parseISO(dateStr), workCalendar, recurringDayMap);
        if (dt === 'half_day') return 4 * 60;
        if (dt === 'working' || dt === 'special_working') return 8 * 60;
        // weekend / holidays => 0 baseline (any work counts as overtime)
        return 0;
    }, [workCalendar, recurringDayMap]);

    const stats = React.useMemo(() => {
        let present = 0;
        let totalMinutes = 0;
        let lateDays = 0;
        let earlyDepartures = 0;
        let overtimeMinutes = 0;

        attendanceRecords?.forEach(rec => {
            present++;
            if (rec.checkInTime && rec.checkOutTime) {
                const workedMinutes = differenceInMinutes(new Date(rec.checkOutTime), new Date(rec.checkInTime));
                totalMinutes += workedMinutes;
                const baseline = getBaselineMinutes(rec.date);
                if (workedMinutes > baseline) {
                    overtimeMinutes += workedMinutes - baseline;
                }
            }
            if (rec.status === 'LATE') lateDays++;
            if (rec.status === 'EARLY_DEPARTURE') earlyDepartures++;
        });

        return { 
            present, 
            totalHours: Math.floor(totalMinutes / 60),
            totalMinutes: totalMinutes % 60,
            lateDays,
            earlyDepartures,
            overtimeHours: Math.floor(overtimeMinutes / 60)
        };
    }, [attendanceRecords, getBaselineMinutes]);

    // Create calendar days
    const calendarDays = React.useMemo(() => {
        const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
        return days.map(day => {
            const dateStr = format(day, 'yyyy-MM-dd');
            const record = attendanceRecords?.find(r => r.date === dateStr);
            return { date: day, record };
        });
    }, [monthStart, monthEnd, attendanceRecords]);

    const getDayStatus = (day: { date: Date; record?: AttendanceRecord }) => {
        const dt = getDayType(day.date);
        const isNonWorking = dt === 'weekend' || dt === 'public_holiday' || dt === 'company_holiday';
        if (!day.record) {
            if (dt === 'half_day') return 'half_day';
            if (dt === 'special_working') return 'special_working';
            return isNonWorking ? 'non_working' : 'absent';
        }
        if (day.record.checkOutTime) return 'completed';
        return 'working';
    };

    const getDayColor = (status: string) => {
        switch (status) {
            case 'completed': return 'bg-green-500';
            case 'working': return 'bg-blue-500';
            case 'absent': return 'bg-red-400';
            case 'non_working': return 'bg-gray-200';
            case 'half_day': return 'bg-amber-400';
            case 'special_working': return 'bg-indigo-400';
            default: return 'bg-gray-300';
        }
    };

    if (isLoading || isWorkCalendarLoading) {
        return (
            <Card className="border-none shadow-none bg-transparent">
                <div className="flex items-center justify-between mb-4 px-1">
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-6 w-16" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <Skeleton className="h-20 rounded-2xl" />
                    <Skeleton className="h-20 rounded-2xl" />
                </div>
            </Card>
        );
    }

    return (
        <Card className="border-none shadow-none bg-transparent">
            <div className="flex items-center justify-between mb-4 px-1">
                <h3 className="font-semibold text-sm">
                    Сарын тойм ({format(currentMonth, 'yyyy оны MM-р сар', { locale: mn })})
                </h3>
                <div className="flex gap-1">
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-6 w-6" 
                        onClick={() => setCurrentMonth(prev => addMonths(prev, -1))}
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-6 w-6" 
                        onClick={() => setCurrentMonth(prev => addMonths(prev, 1))}
                    >
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-primary/5 p-4 rounded-2xl flex flex-col items-center justify-center text-center">
                    <CalendarIcon className="h-4 w-4 text-primary/60 mb-1" />
                    <span className="text-2xl font-semibold text-primary">{stats.present}</span>
                    <span className="text-xs text-muted-foreground">Ирцтэй өдөр</span>
                </div>
                <div className="bg-primary/5 p-4 rounded-2xl flex flex-col items-center justify-center text-center">
                    <Clock className="h-4 w-4 text-primary/60 mb-1" />
                    <span className="text-2xl font-semibold text-primary">{stats.totalHours}</span>
                    <span className="text-xs text-muted-foreground">Нийт цаг</span>
                </div>
                <div className="bg-orange-50 p-4 rounded-2xl flex flex-col items-center justify-center text-center">
                    <AlertCircle className="h-4 w-4 text-orange-500/60 mb-1" />
                    <span className="text-2xl font-semibold text-orange-600">{stats.lateDays}</span>
                    <span className="text-xs text-muted-foreground">Хоцролт</span>
                </div>
                <div className="bg-blue-50 p-4 rounded-2xl flex flex-col items-center justify-center text-center">
                    <TrendingUp className="h-4 w-4 text-blue-500/60 mb-1" />
                    <span className="text-2xl font-semibold text-blue-600">{stats.overtimeHours}</span>
                    <span className="text-xs text-muted-foreground">Илүү цаг</span>
                </div>
            </div>

            {/* Mini Calendar */}
            <div className="bg-muted/30 rounded-2xl p-3">
                <div className="grid grid-cols-7 gap-1 mb-2">
                    {['Да', 'Мя', 'Лх', 'Пү', 'Ба', 'Бя', 'Ня'].map(day => (
                        <div key={day} className="text-center text-[10px] text-muted-foreground font-medium">
                            {day}
                        </div>
                    ))}
                </div>
                <div className="grid grid-cols-7 gap-1">
                    {/* Empty cells for days before month start */}
                    {Array.from({ length: (monthStart.getDay() + 6) % 7 }).map((_, i) => (
                        <div key={`empty-${i}`} className="h-7" />
                    ))}
                    {calendarDays.map((day, idx) => {
                        const status = getDayStatus(day);
                        const isToday = isSameDay(day.date, new Date());
                        return (
                            <button
                                key={idx}
                                onClick={() => day.record && setSelectedDay(day)}
                                className={cn(
                                    "h-7 w-7 rounded-full flex items-center justify-center text-[10px] transition-all",
                                    day.record && "cursor-pointer hover:scale-110",
                                    isToday && "ring-2 ring-primary ring-offset-1"
                                )}
                            >
                                <div className={cn(
                                    "h-5 w-5 rounded-full flex items-center justify-center",
                                    getDayColor(status),
                                    status === 'non_working' ? 'text-gray-400' : 'text-white'
                                )}>
                                    {format(day.date, 'd')}
                                </div>
                            </button>
                        );
                    })}
                </div>
                <div className="flex items-center justify-center gap-4 mt-3 text-[10px] text-muted-foreground">
                    <div className="flex items-center gap-1">
                        <div className="h-2 w-2 rounded-full bg-green-500" />
                        <span>Бүтэн</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <div className="h-2 w-2 rounded-full bg-blue-500" />
                        <span>Ажиллаж байна</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <div className="h-2 w-2 rounded-full bg-red-400" />
                        <span>Тасалсан</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <div className="h-2 w-2 rounded-full bg-gray-200 border" />
                        <span>Амралт/Баяр</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <div className="h-2 w-2 rounded-full bg-amber-400" />
                        <span>Хагас өдөр</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <div className="h-2 w-2 rounded-full bg-indigo-400" />
                        <span>Нөхөж</span>
                    </div>
                </div>
            </div>

            {/* Day Detail Dialog */}
            <Dialog open={!!selectedDay} onOpenChange={() => setSelectedDay(null)}>
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle>
                            {selectedDay && format(selectedDay.date, 'yyyy оны MM сарын dd', { locale: mn })}
                        </DialogTitle>
                    </DialogHeader>
                    {selectedDay?.record && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-muted/50 p-3 rounded-lg">
                                    <p className="text-xs text-muted-foreground">Ирсэн</p>
                                    <p className="text-lg font-semibold">
                                        {format(new Date(selectedDay.record.checkInTime), 'HH:mm')}
                                    </p>
                                    {selectedDay.record.checkInLocationName && (
                                        <p className="text-xs text-muted-foreground">
                                            {selectedDay.record.checkInLocationName}
                                        </p>
                                    )}
                                </div>
                                <div className="bg-muted/50 p-3 rounded-lg">
                                    <p className="text-xs text-muted-foreground">Явсан</p>
                                    <p className="text-lg font-semibold">
                                        {selectedDay.record.checkOutTime 
                                            ? format(new Date(selectedDay.record.checkOutTime), 'HH:mm')
                                            : '-'
                                        }
                                    </p>
                                </div>
                            </div>
                            {selectedDay.record.checkOutTime && (
                                <div className="text-center text-sm text-muted-foreground">
                                    Нийт: {Math.floor(differenceInMinutes(
                                        new Date(selectedDay.record.checkOutTime),
                                        new Date(selectedDay.record.checkInTime)
                                    ) / 60)} цаг {differenceInMinutes(
                                        new Date(selectedDay.record.checkOutTime),
                                        new Date(selectedDay.record.checkInTime)
                                    ) % 60} минут
                                </div>
                            )}
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </Card>
    );
});
