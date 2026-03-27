'use client';

import * as React from 'react';
import { format } from 'date-fns';
import { mn } from 'date-fns/locale';
import {
    AppConfirmDialog,
    AppDialog,
    AppDialogContent,
    AppDialogDescription,
    AppDialogFooter,
    AppDialogHeader,
    AppDialogTitle,
} from '@/components/patterns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarDay, DayType, HolidayType, DAY_TYPE_CONFIGS } from '../types';
import { CalendarIcon, Trash2, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DayTypeDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    date: Date | null;
    dayData?: CalendarDay;
    onSave: (date: Date, data: Partial<CalendarDay>) => void;
    onDelete?: (date: Date) => void;
    onMove?: (fromDate: Date, toDate: Date, data: Partial<CalendarDay>) => void;
    defaultWorkingHours?: number;
    halfDayHours?: number;
}

export function DayTypeDialog({
    open,
    onOpenChange,
    date,
    dayData,
    onSave,
    onDelete,
    onMove,
    defaultWorkingHours = 8,
    halfDayHours = 4,
}: DayTypeDialogProps) {
    const [dayType, setDayType] = React.useState<DayType>('working');
    const [holidayName, setHolidayName] = React.useState('');
    const [holidayType, setHolidayType] = React.useState<HolidayType>('public');
    const [workingHours, setWorkingHours] = React.useState(defaultWorkingHours);
    const [isPaid, setIsPaid] = React.useState(true);
    const [isRecurring, setIsRecurring] = React.useState(false);
    const [legalReference, setLegalReference] = React.useState('');
    const [note, setNote] = React.useState('');
    
    // Шилжүүлэх огноо
    const [moveDate, setMoveDate] = React.useState<Date | undefined>(undefined);
    const [isMoveDateOpen, setIsMoveDateOpen] = React.useState(false);

    // Форм цэвэрлэх
    React.useEffect(() => {
        if (dayData) {
            setDayType(dayData.dayType);
            setHolidayName(dayData.holidayName ?? '');
            setHolidayType(dayData.holidayType ?? 'public');
            setWorkingHours(dayData.workingHours ?? defaultWorkingHours);
            setIsPaid(dayData.isPaid ?? true);
            setIsRecurring(dayData.isRecurring ?? false);
            setLegalReference(dayData.legalReference ?? '');
            setNote(dayData.note ?? '');
        } else {
            setDayType('working');
            setHolidayName('');
            setHolidayType('public');
            setWorkingHours(defaultWorkingHours);
            setIsPaid(true);
            setIsRecurring(false);
            setLegalReference('');
            setNote('');
        }
        setMoveDate(undefined);
    }, [date, dayData, defaultWorkingHours]);

    // Өдрийн төрөл өөрчлөгдөхөд цагийг автоматаар тохируулах
    React.useEffect(() => {
        if (dayType === 'half_day') {
            setWorkingHours(halfDayHours);
        } else if (dayType === 'working' || dayType === 'special_working') {
            setWorkingHours(defaultWorkingHours);
        } else {
            setWorkingHours(0);
        }
    }, [dayType, defaultWorkingHours, halfDayHours]);

    const getCurrentData = (): Partial<CalendarDay> => {
        const isHolidayType = dayType === 'public_holiday' || dayType === 'company_holiday';
        return {
            dayType,
            holidayName: isHolidayType ? holidayName : undefined,
            holidayType: isHolidayType ? holidayType : undefined,
            workingHours: dayType === 'working' || dayType === 'special_working' || dayType === 'half_day' 
                ? workingHours 
                : 0,
            isPaid: isHolidayType ? isPaid : undefined,
            isRecurring: isHolidayType ? isRecurring : undefined,
            legalReference: isHolidayType && legalReference.trim() ? legalReference : undefined,
            note: note.trim() || undefined,
        };
    };

    const handleSave = () => {
        if (!date) return;
        const data = getCurrentData();
        data.date = format(date, 'yyyy-MM-dd');
        onSave(date, data);
        onOpenChange(false);
    };

    const handleDelete = () => {
        if (!date || !onDelete) return;
        onDelete(date);
        onOpenChange(false);
    };

    const handleMove = () => {
        if (!date || !moveDate || !onMove) return;
        const data = getCurrentData();
        onMove(date, moveDate, data);
        onOpenChange(false);
    };

    if (!date) return null;

    const isHolidayType = dayType === 'public_holiday' || dayType === 'company_holiday';
    const showWorkingHours = dayType === 'working' || dayType === 'special_working' || dayType === 'half_day';
    const hasExistingConfig = !!dayData;

    return (
        <AppDialog open={open} onOpenChange={onOpenChange}>
            <AppDialogContent size="md" className="sm:max-w-lg max-h-[90vh] overflow-y-auto p-6">
                <AppDialogHeader>
                    <AppDialogTitle>Өдрийн тохиргоо</AppDialogTitle>
                    <AppDialogDescription>
                        {format(date, 'yyyy оны MMMM d, EEEE', { locale: mn })}
                    </AppDialogDescription>
                </AppDialogHeader>

                <div className="space-y-4 py-4">
                    {/* Өдрийн төрөл */}
                    <div className="space-y-2">
                        <Label htmlFor="day-type">Өдрийн төрөл</Label>
                        <Select value={dayType} onValueChange={(v) => setDayType(v as DayType)}>
                            <SelectTrigger id="day-type">
                                <SelectValue placeholder="Өдрийн төрөл сонгох" />
                            </SelectTrigger>
                            <SelectContent>
                                {DAY_TYPE_CONFIGS.map((config) => (
                                    <SelectItem key={config.type} value={config.type}>
                                        <div className="flex items-center gap-2">
                                            <div className={`w-3 h-3 rounded ${config.bgColor}`} />
                                            <span>{config.label}</span>
                                            <span className="text-xs text-muted-foreground">({config.labelEn})</span>
                                        </div>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Ажлын цаг (зөвхөн ажлын өдрүүдэд) */}
                    {showWorkingHours && (
                        <div className="space-y-2">
                            <Label htmlFor="working-hours">Ажлын цаг</Label>
                            <Input
                                id="working-hours"
                                type="number"
                                min={0}
                                max={24}
                                step={0.5}
                                value={workingHours}
                                onChange={(e) => setWorkingHours(Number(e.target.value))}
                            />
                        </div>
                    )}

                    {/* Баяр/амралтын мэдээлэл */}
                    {isHolidayType && (
                        <>
                            <Separator />
                            <div className="space-y-4">
                                {/* Баярын нэр */}
                                <div className="space-y-2">
                                    <Label htmlFor="holiday-name">Баярын нэр</Label>
                                    <Input
                                        id="holiday-name"
                                        value={holidayName}
                                        onChange={(e) => setHolidayName(e.target.value)}
                                        placeholder="Баярын нэрийг оруулна уу"
                                    />
                                </div>

                                {/* Баярын төрөл */}
                                <div className="space-y-2">
                                    <Label htmlFor="holiday-type">Баярын төрөл</Label>
                                    <Select value={holidayType} onValueChange={(v) => setHolidayType(v as HolidayType)}>
                                        <SelectTrigger id="holiday-type">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="public">Улсын баяр</SelectItem>
                                            <SelectItem value="company">Байгууллагын амралт</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* Цалинтай эсэх */}
                                <div className="flex items-center justify-between">
                                    <Label htmlFor="is-paid">Цалинтай</Label>
                                    <Switch
                                        id="is-paid"
                                        checked={isPaid}
                                        onCheckedChange={setIsPaid}
                                    />
                                </div>

                                {/* Жил бүр давтагдах */}
                                <div className="flex items-center justify-between">
                                    <Label htmlFor="is-recurring">Жил бүр давтагддаг</Label>
                                    <Switch
                                        id="is-recurring"
                                        checked={isRecurring}
                                        onCheckedChange={setIsRecurring}
                                    />
                                </div>

                                {/* Хуулийн лавлагаа */}
                                <div className="space-y-2">
                                    <Label htmlFor="legal-reference">Хуулийн лавлагаа</Label>
                                    <Input
                                        id="legal-reference"
                                        value={legalReference}
                                        onChange={(e) => setLegalReference(e.target.value)}
                                        placeholder="Хуулийн заалт эсвэл тушаал"
                                    />
                                </div>
                            </div>
                        </>
                    )}

                    <Separator />

                    {/* Тэмдэглэл */}
                    <div className="space-y-2">
                        <Label htmlFor="note">Тэмдэглэл</Label>
                        <Textarea
                            id="note"
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            placeholder="Нэмэлт тэмдэглэл..."
                            rows={2}
                        />
                    </div>

                    {/* Өөр өдөр рүү шилжүүлэх */}
                    {hasExistingConfig && onMove && (
                        <>
                            <Separator />
                            <div className="space-y-2">
                                <Label>Өөр өдөр рүү шилжүүлэх</Label>
                                <div className="flex gap-2">
                                    <Popover open={isMoveDateOpen} onOpenChange={setIsMoveDateOpen}>
                                        <PopoverTrigger asChild>
                                            <Button
                                                variant="outline"
                                                className={cn(
                                                    'flex-1 justify-start text-left font-normal',
                                                    !moveDate && 'text-muted-foreground'
                                                )}
                                            >
                                                <CalendarIcon className="mr-2 h-4 w-4" />
                                                {moveDate ? format(moveDate, 'yyyy-MM-dd') : 'Огноо сонгох'}
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0" align="start">
                                            <Calendar
                                                mode="single"
                                                selected={moveDate}
                                                onSelect={(d) => {
                                                    setMoveDate(d);
                                                    setIsMoveDateOpen(false);
                                                }}
                                                disabled={(d) => format(d, 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd')}
                                                initialFocus
                                            />
                                        </PopoverContent>
                                    </Popover>
                                    <Button
                                        variant="secondary"
                                        onClick={handleMove}
                                        disabled={!moveDate}
                                    >
                                        <ArrowRight className="h-4 w-4 mr-1" />
                                        Шилжүүлэх
                                    </Button>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    Тохиргоог сонгосон өдөр рүү шилжүүлж, одоогийн өдрийн тохиргоог устгана.
                                </p>
                            </div>
                        </>
                    )}
                </div>

                <AppDialogFooter className="flex-col sm:flex-row gap-2 border-t-0 bg-transparent px-0 py-0">
                    {/* Устгах товч */}
                    {hasExistingConfig && onDelete && (
                        <AppConfirmDialog
                            title="Тохиргоог устгах уу?"
                            description={`${format(date, 'yyyy оны MMMM d', { locale: mn })} өдрийн тохиргоог устгах гэж байна. Энэ өдөр дахин ажлын өдөр болно.`}
                            confirmLabel="Устгах"
                            cancelLabel="Цуцлах"
                            onConfirm={handleDelete}
                            trigger={
                                <Button variant="destructive" className="sm:mr-auto">
                                    <Trash2 className="h-4 w-4 mr-1" />
                                    Устгах
                                </Button>
                            }
                        />
                    )}
                    
                    <div className="flex gap-2 w-full sm:w-auto">
                        <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1 sm:flex-none">
                            Цуцлах
                        </Button>
                        <Button onClick={handleSave} className="flex-1 sm:flex-none">
                            Хадгалах
                        </Button>
                    </div>
                </AppDialogFooter>
            </AppDialogContent>
        </AppDialog>
    );
}
