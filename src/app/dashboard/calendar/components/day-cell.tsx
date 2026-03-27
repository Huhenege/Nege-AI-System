'use client';

import { cn } from '@/lib/utils';
import { CalendarDay, DayType, getDayTypeConfig } from '../types';

interface DayCellProps {
    date: Date;
    dayData?: CalendarDay;
    dayType: DayType;
    isToday?: boolean;
    isSelected?: boolean;
    onClick?: (date: Date) => void;
    compact?: boolean;
}

export function DayCell({
    date,
    dayData,
    dayType,
    isToday = false,
    isSelected = false,
    onClick,
    compact = false,
}: DayCellProps) {
    const config = getDayTypeConfig(dayType);
    const day = date.getDate();

    // Өдрийн төрлөөс хамааран тусгай тэмдэглэгээ
    const hasHoliday = dayType === 'public_holiday' || dayType === 'company_holiday';
    const isSpecialWorking = dayType === 'special_working';
    const isHalfDay = dayType === 'half_day';

    return (
        <button
            type="button"
            onClick={() => onClick?.(date)}
            className={cn(
                // overflow-visible ensures indicator dots are not clipped in compact mode
                'relative flex items-center justify-center rounded-md transition-all overflow-visible',
                compact ? 'h-6 w-6 text-xs' : 'h-8 w-8 text-sm',
                config.bgColor,
                config.textColor,
                'hover:ring-2 hover:ring-primary/50',
                isSelected && 'ring-2 ring-primary',
                isToday && 'ring-2 ring-blue-500 font-bold',
                onClick && 'cursor-pointer',
                !onClick && 'cursor-default'
            )}
            disabled={!onClick}
            title={
                dayData?.holidayName || 
                (dayData?.events?.length ? dayData.events.map(e => e.title).join(', ') : undefined) ||
                dayData?.note
            }
        >
            {day}
            
            {/* Улсын баяр - улаан цэг */}
            {dayType === 'public_holiday' && (
                <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-red-500 rounded-full" />
            )}
            
            {/* Байгууллагын амралт - улбар шар цэг */}
            {dayType === 'company_holiday' && (
                <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-orange-500 rounded-full" />
            )}
            
            {/* Нөхөж ажиллах өдөр - цэнхэр цэг */}
            {isSpecialWorking && (
                <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-blue-500 rounded-full" />
            )}
            
            {/* Хагас өдөр - шар цэг */}
            {isHalfDay && (
                <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-amber-500 rounded-full" />
            )}
            
            {/* Тэмдэглэл байгаа эсэх */}
            {dayData?.note && !hasHoliday && !isSpecialWorking && !isHalfDay && (
                <span className="absolute -bottom-0.5 -right-0.5 w-1.5 h-1.5 bg-purple-500 rounded-full" />
            )}
            
            {/* Үйл явдал байгаа эсэх - зүүн доод буланд ягаан цэг */}
            {dayData?.events && dayData.events.length > 0 && (
                <span className="absolute -bottom-0.5 -left-0.5 w-1.5 h-1.5 bg-pink-500 rounded-full" />
            )}
        </button>
    );
}
