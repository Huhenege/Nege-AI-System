'use client';

import * as React from 'react';
import { format, getDay, eachDayOfInterval, startOfYear, endOfYear, getMonth } from 'date-fns';
import { PageHeader } from '@/components/patterns/page-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useFirebase, useTenantWrite } from '@/firebase';
import { doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';

import {
    CalendarStatsDashboard,
    CalendarLegend,
    YearCalendarView,
    DayTypeDialog,
    CalendarTypeSelector,
} from './components';

import { 
    WorkCalendar, 
    CalendarDay, 
    CalendarStats, 
    DayType, 
    MonthlyStats,
    QuarterlyStats,
    WorkingTimeRules
} from './types';

// Сарын нэрс
const MONTH_NAMES = [
    '1-р сар', '2-р сар', '3-р сар', '4-р сар', '5-р сар', '6-р сар',
    '7-р сар', '8-р сар', '9-р сар', '10-р сар', '11-р сар', '12-р сар'
];

// Улирлын нэрс
const QUARTER_NAMES = ['I улирал', 'II улирал', 'III улирал', 'IV улирал'];

// Байгууллагын цорын ганц календарын ID
const DEFAULT_CALENDAR_ID = 'default';

export default function CalendarPage() {
    const [selectedYear, setSelectedYear] = React.useState(() => new Date().getFullYear());
    const [selectedDate, setSelectedDate] = React.useState<Date | null>(null);
    const [isDialogOpen, setIsDialogOpen] = React.useState(false);
    const [workCalendar, setWorkCalendar] = React.useState<WorkCalendar | null>(null);
    const [isLoading, setIsLoading] = React.useState(true);

    const { firestore } = useFirebase();
    const { tDoc } = useTenantWrite();
    const { toast } = useToast();

    // Байгууллагын календарыг татах эсвэл автоматаар үүсгэх
    React.useEffect(() => {
        const initializeCalendar = async () => {
            if (!firestore) return;

            setIsLoading(true);
            
            try {
                const calendarRef = doc(firestore, 'workCalendars', DEFAULT_CALENDAR_ID);
                const calendarSnap = await getDoc(calendarRef);

                if (calendarSnap.exists()) {
                    // Календар байгаа бол ашиглах
                    setWorkCalendar({ id: calendarSnap.id, ...calendarSnap.data() } as WorkCalendar);
                } else {
                    // Календар байхгүй бол автоматаар үүсгэх
                    const workingTimeRules: WorkingTimeRules = {
                        standardWorkingHoursPerDay: 8,
                        workingHoursPerWeek: 40,
                        breakTimeMinutes: 60,
                        isShiftBased: false,
                        overtimeEligible: true,
                        halfDayHours: 4,
                    };

                    const newCalendar: WorkCalendar = {
                        id: DEFAULT_CALENDAR_ID,
                        name: 'Ажлын календар',
                        description: 'Даваа-Баасан ажлын, Бямба-Ням амралтын стандарт хуваарь',
                        year: new Date().getFullYear(),
                        country: 'Монгол',
                        region: 'Улаанбаатар',
                        timeZone: 'Asia/Ulaanbaatar',
                        status: 'active',
                        isDefault: true,
                        workingTimeRules,
                        weekendDays: [0, 6],
                        days: {},
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString(),
                        version: 1,
                    };

                    await setDoc(calendarRef, newCalendar);
                    setWorkCalendar(newCalendar);

                    toast({
                        title: 'Календар үүсгэгдлээ',
                        description: 'Ажлын календар амжилттай үүсгэгдлээ.',
                    });
                }
            } catch (error) {
                console.error('Error initializing calendar:', error);
                toast({
                    title: 'Алдаа гарлаа',
                    description: 'Календар ачаалахад алдаа гарлаа.',
                    variant: 'destructive',
                });
            } finally {
                setIsLoading(false);
            }
        };

        initializeCalendar();
    }, [firestore, toast]);

    // Жил бүр давтагдах баярын өдрүүдийг Map болгон бэлтгэх
    const recurringHolidays = React.useMemo(() => {
        const holidays = new Map<string, CalendarDay>();
        if (workCalendar?.days) {
            Object.values(workCalendar.days).forEach((day) => {
                if (day.isRecurring && (day.dayType === 'public_holiday' || day.dayType === 'company_holiday')) {
                    const [, monthStr, dayStr] = day.date.split('-');
                    const key = `${monthStr}-${dayStr}`;
                    holidays.set(key, day);
                }
            });
        }
        return holidays;
    }, [workCalendar?.days]);

    // Статистик тооцоолох
    const stats = React.useMemo((): CalendarStats | null => {
        if (!workCalendar) return null;

        const yearStart = startOfYear(new Date(selectedYear, 0, 1));
        const yearEnd = endOfYear(new Date(selectedYear, 0, 1));
        const allDays = eachDayOfInterval({ start: yearStart, end: yearEnd });

        const workingHoursPerDay = workCalendar.workingTimeRules?.standardWorkingHoursPerDay || 8;
        const halfDayHours = workCalendar.workingTimeRules?.halfDayHours || 4;

        // Жилийн нэгтгэл
        let workingDays = 0;
        let weekendDays = 0;
        let publicHolidaysCount = 0;
        let companyHolidays = 0;
        let specialWorkingDays = 0;
        let halfDays = 0;
        let totalWorkingHours = 0;

        // Сарын нэгтгэл
        const monthly: MonthlyStats[] = MONTH_NAMES.map((name, i) => ({
            month: i + 1,
            monthName: name,
            totalDays: 0,
            workingDays: 0,
            weekendDays: 0,
            publicHolidays: 0,
            companyHolidays: 0,
            specialWorkingDays: 0,
            halfDays: 0,
            totalWorkingHours: 0,
        }));

        // Өдөр бүрээр тооцоолох
        allDays.forEach((date) => {
            const dateStr = format(date, 'yyyy-MM-dd');
            const monthDay = format(date, 'MM-dd'); // Жил бүр давтагдах баярт ашиглах
            const dayOfWeek = getDay(date);
            const monthIndex = getMonth(date);
            const dayData = workCalendar.days?.[dateStr];

            // Өдрийн төрлийг тодорхойлох
            let dayType: DayType;
            if (dayData?.dayType) {
                // 1. Тухайн оны тодорхой өдрийн тохиргоо
                dayType = dayData.dayType;
            } else if (recurringHolidays.has(monthDay)) {
                // 2. Жил бүр давтагдах баярын өдөр
                dayType = recurringHolidays.get(monthDay)!.dayType;
            } else if (workCalendar.weekendDays.includes(dayOfWeek)) {
                // 3. Амралтын өдөр
                dayType = 'weekend';
            } else {
                dayType = 'working';
            }

            // Сарын нийт өдрийг нэмэх
            monthly[monthIndex].totalDays++;

            // Төрлөөр нь тоолох
            switch (dayType) {
                case 'working':
                    workingDays++;
                    monthly[monthIndex].workingDays++;
                    const hours = dayData?.workingHours ?? workingHoursPerDay;
                    totalWorkingHours += hours;
                    monthly[monthIndex].totalWorkingHours += hours;
                    break;
                case 'weekend':
                    weekendDays++;
                    monthly[monthIndex].weekendDays++;
                    break;
                case 'public_holiday':
                    publicHolidaysCount++;
                    monthly[monthIndex].publicHolidays++;
                    break;
                case 'company_holiday':
                    companyHolidays++;
                    monthly[monthIndex].companyHolidays++;
                    break;
                case 'special_working':
                    specialWorkingDays++;
                    workingDays++;
                    monthly[monthIndex].specialWorkingDays++;
                    monthly[monthIndex].workingDays++;
                    const swHours = dayData?.workingHours ?? workingHoursPerDay;
                    totalWorkingHours += swHours;
                    monthly[monthIndex].totalWorkingHours += swHours;
                    break;
                case 'half_day':
                    halfDays++;
                    workingDays++;
                    monthly[monthIndex].halfDays++;
                    monthly[monthIndex].workingDays++;
                    const hdHours = dayData?.workingHours ?? halfDayHours;
                    totalWorkingHours += hdHours;
                    monthly[monthIndex].totalWorkingHours += hdHours;
                    break;
            }
        });

        // Улирлын нэгтгэл
        const quarterly: QuarterlyStats[] = QUARTER_NAMES.map((name, i) => {
            const startMonth = i * 3;
            const quarterMonths = monthly.slice(startMonth, startMonth + 3);
            return {
                quarter: i + 1,
                quarterName: name,
                totalDays: quarterMonths.reduce((sum, m) => sum + m.totalDays, 0),
                workingDays: quarterMonths.reduce((sum, m) => sum + m.workingDays, 0),
                weekendDays: quarterMonths.reduce((sum, m) => sum + m.weekendDays, 0),
                publicHolidays: quarterMonths.reduce((sum, m) => sum + m.publicHolidays, 0),
                companyHolidays: quarterMonths.reduce((sum, m) => sum + m.companyHolidays, 0),
                totalWorkingHours: quarterMonths.reduce((sum, m) => sum + m.totalWorkingHours, 0),
            };
        });

        // Хагас жилийн нэгтгэл
        const firstHalfMonths = monthly.slice(0, 6);
        const secondHalfMonths = monthly.slice(6, 12);

        return {
            totalDays: allDays.length,
            workingDays,
            weekendDays,
            publicHolidays: publicHolidaysCount,
            companyHolidays,
            specialWorkingDays,
            halfDays,
            totalWorkingHours,
            monthly,
            quarterly,
            firstHalf: {
                workingDays: firstHalfMonths.reduce((sum, m) => sum + m.workingDays, 0),
                totalWorkingHours: firstHalfMonths.reduce((sum, m) => sum + m.totalWorkingHours, 0),
            },
            secondHalf: {
                workingDays: secondHalfMonths.reduce((sum, m) => sum + m.workingDays, 0),
                totalWorkingHours: secondHalfMonths.reduce((sum, m) => sum + m.totalWorkingHours, 0),
            },
        };
    }, [workCalendar, selectedYear, recurringHolidays]);

    // Өдөр дарахад
    const handleDayClick = (date: Date) => {
        setSelectedDate(date);
        setIsDialogOpen(true);
    };

    // Өдрийн мэдээлэл хадгалах
    const handleDaySave = async (date: Date, data: Partial<CalendarDay>) => {
        if (!firestore || !workCalendar) return;

        const dateStr = format(date, 'yyyy-MM-dd');

        // Шинэ өдрийн мэдээлэл
        const dayData: CalendarDay = {
            date: dateStr,
            dayType: data.dayType || 'working',
            ...(data.holidayName && { holidayName: data.holidayName }),
            ...(data.holidayType && { holidayType: data.holidayType }),
            ...(data.workingHours !== undefined && { workingHours: data.workingHours }),
            ...(data.isPaid !== undefined && { isPaid: data.isPaid }),
            ...(data.isRecurring !== undefined && { isRecurring: data.isRecurring }),
            ...(data.legalReference && { legalReference: data.legalReference }),
            ...(data.note && { note: data.note }),
        };

        // Local state-ийг эхлээд шинэчлэх (optimistic update)
        setWorkCalendar(prev => prev ? {
            ...prev,
            days: {
                ...prev.days,
                [dateStr]: dayData,
            },
            updatedAt: new Date().toISOString(),
        } : null);

        try {
            const calendarRef = tDoc('workCalendars', DEFAULT_CALENDAR_ID);
            
            // Firestore-д хадгалах
            await updateDoc(calendarRef, {
                [`days.${dateStr}`]: dayData,
                updatedAt: new Date().toISOString(),
            });

            toast({
                title: 'Амжилттай хадгалагдлаа',
                description: `${format(date, 'yyyy-MM-dd')} өдрийн тохиргоо шинэчлэгдлээ.`,
            });
        } catch (error) {
            console.error('Error updating day:', error);
            
            // Алдаа гарвал буцаах
            setWorkCalendar(prev => {
                if (!prev) return null;
                const newDays = { ...prev.days };
                delete newDays[dateStr];
                return { ...prev, days: newDays };
            });
            
            toast({
                title: 'Алдаа гарлаа',
                description: 'Өдрийн тохиргоог хадгалахад алдаа гарлаа.',
                variant: 'destructive',
            });
        }
    };

    // Өдрийн тохиргоог устгах
    const handleDayDelete = async (date: Date) => {
        if (!firestore || !workCalendar) return;

        const dateStr = format(date, 'yyyy-MM-dd');
        const previousDayData = workCalendar.days?.[dateStr];

        // Local state-ийг эхлээд шинэчлэх
        setWorkCalendar(prev => {
            if (!prev) return null;
            const newDays = { ...prev.days };
            delete newDays[dateStr];
            return { ...prev, days: newDays, updatedAt: new Date().toISOString() };
        });

        try {
            const calendarRef = tDoc('workCalendars', DEFAULT_CALENDAR_ID);
            
            // Firestore-оос устгах (deleteField ашиглах)
            const { deleteField } = await import('firebase/firestore');
            await updateDoc(calendarRef, {
                [`days.${dateStr}`]: deleteField(),
                updatedAt: new Date().toISOString(),
            });

            toast({
                title: 'Амжилттай устгагдлаа',
                description: `${format(date, 'yyyy-MM-dd')} өдрийн тохиргоо устгагдлаа.`,
            });
        } catch (error) {
            console.error('Error deleting day:', error);
            
            // Алдаа гарвал буцаах
            if (previousDayData) {
                setWorkCalendar(prev => prev ? {
                    ...prev,
                    days: { ...prev.days, [dateStr]: previousDayData },
                } : null);
            }
            
            toast({
                title: 'Алдаа гарлаа',
                description: 'Өдрийн тохиргоог устгахад алдаа гарлаа.',
                variant: 'destructive',
            });
        }
    };

    // Өдрийн тохиргоог өөр өдөр рүү шилжүүлэх
    const handleDayMove = async (fromDate: Date, toDate: Date, data: Partial<CalendarDay>) => {
        if (!firestore || !workCalendar) return;

        const fromDateStr = format(fromDate, 'yyyy-MM-dd');
        const toDateStr = format(toDate, 'yyyy-MM-dd');
        const previousFromData = workCalendar.days?.[fromDateStr];
        const previousToData = workCalendar.days?.[toDateStr];

        // Шинэ өдрийн мэдээлэл
        const newDayData: CalendarDay = {
            date: toDateStr,
            dayType: data.dayType || 'working',
            ...(data.holidayName && { holidayName: data.holidayName }),
            ...(data.holidayType && { holidayType: data.holidayType }),
            ...(data.workingHours !== undefined && { workingHours: data.workingHours }),
            ...(data.isPaid !== undefined && { isPaid: data.isPaid }),
            ...(data.isRecurring !== undefined && { isRecurring: data.isRecurring }),
            ...(data.legalReference && { legalReference: data.legalReference }),
            ...(data.note && { note: data.note }),
        };

        // Local state-ийг эхлээд шинэчлэх
        setWorkCalendar(prev => {
            if (!prev) return null;
            const newDays = { ...prev.days };
            delete newDays[fromDateStr];
            newDays[toDateStr] = newDayData;
            return { ...prev, days: newDays, updatedAt: new Date().toISOString() };
        });

        try {
            const calendarRef = tDoc('workCalendars', DEFAULT_CALENDAR_ID);
            
            const { deleteField } = await import('firebase/firestore');
            await updateDoc(calendarRef, {
                [`days.${fromDateStr}`]: deleteField(),
                [`days.${toDateStr}`]: newDayData,
                updatedAt: new Date().toISOString(),
            });

            toast({
                title: 'Амжилттай шилжүүлэгдлээ',
                description: `${format(fromDate, 'MM-dd')} → ${format(toDate, 'MM-dd')} руу шилжүүлэгдлээ.`,
            });
        } catch (error) {
            console.error('Error moving day:', error);
            
            // Алдаа гарвал буцаах
            setWorkCalendar(prev => {
                if (!prev) return null;
                const newDays = { ...prev.days };
                delete newDays[toDateStr];
                if (previousFromData) {
                    newDays[fromDateStr] = previousFromData;
                }
                if (previousToData) {
                    newDays[toDateStr] = previousToData;
                }
                return { ...prev, days: newDays };
            });
            
            toast({
                title: 'Алдаа гарлаа',
                description: 'Өдрийн тохиргоог шилжүүлэхэд алдаа гарлаа.',
                variant: 'destructive',
            });
        }
    };

    // Сонгосон өдрийн мэдээлэл
    const selectedDayData = React.useMemo(() => {
        if (!selectedDate || !workCalendar) return undefined;
        const dateStr = format(selectedDate, 'yyyy-MM-dd');
        return workCalendar.days?.[dateStr];
    }, [selectedDate, workCalendar]);

    return (
        <div className="flex flex-col h-full w-full py-6 px-page">
            <div className="shrink-0 pb-6">
                <PageHeader
                    title="Хүний нөөцийн календар"
                    description="Ажлын хуваарь, баярын өдрүүд, нэгтгэл статистик"
                    showBackButton={true}
                    hideBreadcrumbs={true}
                    backButtonPlacement="inline"
                    backBehavior="history"
                    fallbackBackHref="/dashboard"
                />
            </div>

            <div className="flex-1 overflow-auto space-y-6 pb-page">
                {/* Календар мэдээлэл ба он сонголт */}
                <CalendarTypeSelector
                    calendar={workCalendar}
                    selectedYear={selectedYear}
                    onYearChange={setSelectedYear}
                    isLoading={isLoading}
                />

                {/* Нэгтгэл статистик */}
                {(workCalendar || isLoading) && (
                    <CalendarStatsDashboard
                        stats={stats}
                        isLoading={isLoading}
                        year={selectedYear}
                    />
                )}

                {/* Тэмдэглэгээ */}
                {workCalendar && (
                    <Card>
                        <CardHeader className="py-3">
                            <CardTitle className="text-sm font-medium">Тэмдэглэгээ</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-0 pb-4">
                            <CalendarLegend />
                        </CardContent>
                    </Card>
                )}

                {/* 12 сарын календар */}
                {workCalendar && (
                    <YearCalendarView
                        year={selectedYear}
                        calendar={workCalendar}
                        onDayClick={handleDayClick}
                        selectedDate={selectedDate}
                    />
                )}

                {/* Ачааллын скелетон */}
                {isLoading && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {Array.from({ length: 12 }).map((_, i) => (
                            <Card key={i}>
                                <CardContent className="p-4">
                                    <Skeleton className="h-4 w-20 mx-auto mb-4" />
                                    <div className="space-y-2">
                                        {Array.from({ length: 6 }).map((_, j) => (
                                            <Skeleton key={j} className="h-6 w-full" />
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </div>

            {/* Өдрийн тохиргооны диалог */}
            <DayTypeDialog
                open={isDialogOpen}
                onOpenChange={setIsDialogOpen}
                date={selectedDate}
                dayData={selectedDayData}
                onSave={handleDaySave}
                onDelete={handleDayDelete}
                onMove={handleDayMove}
                defaultWorkingHours={workCalendar?.workingTimeRules?.standardWorkingHoursPerDay ?? 8}
                halfDayHours={workCalendar?.workingTimeRules?.halfDayHours ?? 4}
            />
        </div>
    );
}
