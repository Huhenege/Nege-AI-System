'use client';

import * as React from 'react';
import { Coffee, Play, Square, Clock, AlertTriangle } from 'lucide-react';
import { format, differenceInMinutes } from 'date-fns';
import { useFirebase, useCollection, useMemoFirebase, addDocumentNonBlocking, updateDocumentNonBlocking, tenantCollection } from '@/firebase';
import { collection, query, where, orderBy, doc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { formatWorkTime, triggerHapticFeedback } from '@/lib/attendance';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { breakTypeLabels, type BreakRecord, type BreakType } from '@/types/attendance';

interface BreakSheetProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    employeeId: string;
    attendanceId: string | undefined;
    onBreakStatusChange?: (isOnBreak: boolean) => void;
}

const MAX_BREAK_MINUTES = 60; // 1 hour warning threshold

export function BreakSheet({ 
    open, 
    onOpenChange, 
    employeeId, 
    attendanceId,
    onBreakStatusChange 
}: BreakSheetProps) {
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [currentBreakTime, setCurrentBreakTime] = React.useState<number>(0);

    // Get today's breaks
    const breaksQuery = useMemoFirebase(({ companyPath }) => (
        attendanceId && firestore ? query(
            tenantCollection(firestore, companyPath, `attendance/${attendanceId}/breaks`),
            orderBy('startTime', 'desc')
        ) : null
    ), [firestore, attendanceId]);

    const { data: breaks, isLoading } = useCollection<BreakRecord>(breaksQuery);

    // Find active break
    const activeBreak = React.useMemo(() => (
        breaks?.find(b => !b.endTime)
    ), [breaks]);

    // Calculate total break time
    const totalBreakMinutes = React.useMemo(() => {
        if (!breaks) return 0;
        return breaks.reduce((total, b) => {
            if (b.endTime) {
                return total + differenceInMinutes(new Date(b.endTime), new Date(b.startTime));
            }
            return total;
        }, 0);
    }, [breaks]);

    // Update current break timer
    React.useEffect(() => {
        if (!activeBreak) {
            setCurrentBreakTime(0);
            onBreakStatusChange?.(false);
            return;
        }

        onBreakStatusChange?.(true);
        const updateTimer = () => {
            const minutes = differenceInMinutes(new Date(), new Date(activeBreak.startTime));
            setCurrentBreakTime(minutes);
        };

        updateTimer();
        const interval = setInterval(updateTimer, 1000);
        return () => clearInterval(interval);
    }, [activeBreak, onBreakStatusChange]);

    const handleStartBreak = async (type: BreakType) => {
        if (!firestore || !attendanceId || !employeeId) {
            toast({ title: 'Эхлээд ирц бүртгүүлнэ үү', variant: 'destructive' });
            return;
        }

        setIsSubmitting(true);
        try {
            triggerHapticFeedback('light');
            const breaksCollection = collection(firestore, `attendance/${attendanceId}/breaks`);
            await addDocumentNonBlocking(breaksCollection, {
                employeeId,
                attendanceId,
                startTime: new Date().toISOString(),
                type,
            });
            toast({ title: `${breakTypeLabels[type]} эхэллээ` });
        } catch (error) {
            toast({ title: 'Алдаа гарлаа', variant: 'destructive' });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleEndBreak = async () => {
        if (!firestore || !attendanceId || !activeBreak) return;

        setIsSubmitting(true);
        try {
            triggerHapticFeedback('medium');
            const breakDoc = doc(firestore, `attendance/${attendanceId}/breaks`, activeBreak.id);
            const endTime = new Date().toISOString();
            const durationMinutes = differenceInMinutes(new Date(endTime), new Date(activeBreak.startTime));
            
            await updateDocumentNonBlocking(breakDoc, {
                endTime,
                durationMinutes
            });
            toast({ title: `Амралт дууслаа (${formatWorkTime(durationMinutes)})` });
        } catch (error) {
            toast({ title: 'Алдаа гарлаа', variant: 'destructive' });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent side="bottom" className="rounded-t-[20px] max-h-[80vh]">
                <SheetHeader className="pb-4">
                    <SheetTitle className="flex items-center gap-2">
                        <Coffee className="h-5 w-5" />
                        Амралт
                    </SheetTitle>
                </SheetHeader>

                {!attendanceId ? (
                    <Alert>
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription>
                            Амралт бүртгэхийн тулд эхлээд ирц бүртгүүлнэ үү.
                        </AlertDescription>
                    </Alert>
                ) : (
                    <div className="space-y-6">
                        {/* Current Status */}
                        {activeBreak ? (
                            <div className="bg-green-50 rounded-2xl p-6 text-center">
                                <div className="text-green-600 mb-2">
                                    <Coffee className="h-8 w-8 mx-auto animate-pulse" />
                                </div>
                                <p className="text-sm text-green-700 mb-1">
                                    {breakTypeLabels[activeBreak.type]} үргэлжилж байна
                                </p>
                                <p className="text-3xl font-bold text-green-800">
                                    {formatWorkTime(currentBreakTime)}
                                </p>
                                <p className="text-xs text-green-600 mt-1">
                                    Эхэлсэн: {format(new Date(activeBreak.startTime), 'HH:mm')}
                                </p>
                                
                                {currentBreakTime >= MAX_BREAK_MINUTES && (
                                    <Alert variant="destructive" className="mt-4">
                                        <AlertTriangle className="h-4 w-4" />
                                        <AlertDescription>
                                            Амралтын хугацаа {MAX_BREAK_MINUTES} минутаас хэтэрлээ!
                                        </AlertDescription>
                                    </Alert>
                                )}

                                <Button
                                    onClick={handleEndBreak}
                                    disabled={isSubmitting}
                                    className="mt-4 bg-green-600 hover:bg-green-700"
                                    size="lg"
                                >
                                    <Square className="h-4 w-4 mr-2" />
                                    Амралт дуусгах
                                </Button>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <p className="text-sm text-muted-foreground text-center">
                                    Амралтын төрлөө сонгоно уу
                                </p>
                                <div className="grid grid-cols-2 gap-4">
                                    <Button
                                        variant="outline"
                                        className="h-24 flex-col gap-2"
                                        onClick={() => handleStartBreak('LUNCH')}
                                        disabled={isSubmitting}
                                    >
                                        <Coffee className="h-6 w-6" />
                                        <span>Өдрийн хоол</span>
                                    </Button>
                                    <Button
                                        variant="outline"
                                        className="h-24 flex-col gap-2"
                                        onClick={() => handleStartBreak('SHORT')}
                                        disabled={isSubmitting}
                                    >
                                        <Play className="h-6 w-6" />
                                        <span>Богино амралт</span>
                                    </Button>
                                </div>
                            </div>
                        )}

                        {/* Today's Summary */}
                        <div className="bg-muted/50 rounded-xl p-4">
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-sm font-medium">Өнөөдрийн амралт</span>
                                <span className="text-sm text-muted-foreground">
                                    Нийт: {formatWorkTime(totalBreakMinutes + currentBreakTime)}
                                </span>
                            </div>
                            
                            {isLoading ? (
                                <div className="space-y-2">
                                    <Skeleton className="h-10 w-full" />
                                    <Skeleton className="h-10 w-full" />
                                </div>
                            ) : breaks && breaks.length > 0 ? (
                                <div className="space-y-2">
                                    {breaks.filter(b => b.endTime).map(breakRecord => (
                                        <div 
                                            key={breakRecord.id}
                                            className="flex items-center justify-between text-sm bg-background rounded-lg p-2"
                                        >
                                            <div className="flex items-center gap-2">
                                                <Clock className="h-3 w-3 text-muted-foreground" />
                                                <span>{breakTypeLabels[breakRecord.type]}</span>
                                            </div>
                                            <div className="text-muted-foreground">
                                                {format(new Date(breakRecord.startTime), 'HH:mm')} - {format(new Date(breakRecord.endTime!), 'HH:mm')}
                                                <span className="ml-2 text-foreground font-medium">
                                                    ({formatWorkTime(breakRecord.durationMinutes || 0)})
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-sm text-muted-foreground text-center py-4">
                                    Өнөөдөр амралт аваагүй байна
                                </p>
                            )}
                        </div>
                    </div>
                )}
            </SheetContent>
        </Sheet>
    );
}
