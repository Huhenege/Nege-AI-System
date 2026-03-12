'use client';

import * as React from 'react';
import { History, Clock, CheckCircle, X, Trash2, Calendar, Briefcase } from 'lucide-react';
import { format } from 'date-fns';
import { mn } from 'date-fns/locale';
import { useFirebase, useCollection, useMemoFirebase, deleteDocumentNonBlocking } from '@/firebase';
import { useTenantWrite } from '@/hooks/use-tenant-write';
import { collection, query, orderBy, limit, doc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { calculateDuration } from '@/lib/attendance';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { 
    statusConfig, 
    attendanceRequestTypeLabels,
    type AttendanceRecord, 
    type TimeOffRequest, 
    type AttendanceRequest 
} from '@/types/attendance';

interface HistorySheetProps {
    employeeId: string;
}

export function HistorySheet({ employeeId }: HistorySheetProps) {
    const { firestore } = useFirebase();
    const { companyPath } = useTenantWrite();
    const { toast } = useToast();
    const [activeTab, setActiveTab] = React.useState('attendance');

    // Attendance records
    const attendanceQuery = useMemoFirebase(({ companyPath }) => (
        employeeId ? query(
            tenantCollection(firestore, companyPath, 'attendance'),
            orderBy('date', 'desc'),
            limit(20)
        ) : null
    ), [firestore, employeeId]);

    // Time-off requests
    const timeOffQuery = useMemoFirebase(({ companyPath }) => (
        employeeId ? query(
            collection(firestore, `${companyPath}/employees/${employeeId}/timeOffRequests`),
            orderBy('createdAt', 'desc'),
            limit(20)
        ) : null
    ), [firestore, employeeId]);

    // Attendance requests
    const attendanceRequestsQuery = useMemoFirebase(({ companyPath }) => (
        employeeId ? query(
            collection(firestore, `${companyPath}/employees/${employeeId}/attendanceRequests`),
            orderBy('createdAt', 'desc'),
            limit(20)
        ) : null
    ), [firestore, employeeId]);

    const { data: attendanceRecords, isLoading: isLoadingAttendance } = useCollection<AttendanceRecord>(attendanceQuery);
    const { data: timeOffRequests, isLoading: isLoadingTimeOff } = useCollection<TimeOffRequest>(timeOffQuery);
    const { data: attendanceRequests, isLoading: isLoadingAttendanceReq } = useCollection<AttendanceRequest>(attendanceRequestsQuery);

    // Filter attendance records for this employee
    const myAttendanceRecords = React.useMemo(() => (
        attendanceRecords?.filter(r => r.employeeId === employeeId) || []
    ), [attendanceRecords, employeeId]);

    const handleCancelTimeOff = async (requestId: string) => {
        if (!firestore || !employeeId || !companyPath) return;
        try {
            await deleteDocumentNonBlocking(doc(firestore, `${companyPath}/employees/${employeeId}/timeOffRequests`, requestId));
            toast({ title: 'Хүсэлт амжилттай цуцлагдлаа' });
        } catch (error) {
            toast({ title: 'Алдаа гарлаа', variant: 'destructive' });
        }
    };

    const handleCancelAttendanceReq = async (requestId: string) => {
        if (!firestore || !employeeId || !companyPath) return;
        try {
            await deleteDocumentNonBlocking(doc(firestore, `${companyPath}/employees/${employeeId}/attendanceRequests`, requestId));
            toast({ title: 'Хүсэлт амжилттай цуцлагдлаа' });
        } catch (error) {
            toast({ title: 'Алдаа гарлаа', variant: 'destructive' });
        }
    };

    return (
        <Sheet>
            <SheetTrigger asChild>
                <div className="flex flex-col items-center gap-2 cursor-pointer group active:scale-95 transition-all">
                    <div className="h-12 w-12 rounded-2xl bg-orange-50 text-orange-600 flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                        <History className="h-6 w-6" />
                    </div>
                    <span className="text-xs font-medium text-muted-foreground">Түүх</span>
                </div>
            </SheetTrigger>
            <SheetContent side="bottom" className="rounded-t-[20px] max-h-[85vh]">
                <SheetHeader className="pb-4">
                    <SheetTitle>Түүх</SheetTitle>
                </SheetHeader>
                
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <TabsList className="grid w-full grid-cols-3 mb-4">
                        <TabsTrigger value="attendance" className="text-xs">
                            <Clock className="h-3 w-3 mr-1" />
                            Ирц
                        </TabsTrigger>
                        <TabsTrigger value="timeoff" className="text-xs">
                            <Calendar className="h-3 w-3 mr-1" />
                            Чөлөө
                        </TabsTrigger>
                        <TabsTrigger value="requests" className="text-xs">
                            <Briefcase className="h-3 w-3 mr-1" />
                            Хүсэлт
                        </TabsTrigger>
                    </TabsList>

                    {/* Attendance History */}
                    <TabsContent value="attendance" className="overflow-y-auto max-h-[60vh]">
                        <div className="space-y-3">
                            {isLoadingAttendance ? (
                                Array.from({ length: 3 }).map((_, i) => (
                                    <Skeleton key={i} className="h-16 w-full rounded-lg" />
                                ))
                            ) : myAttendanceRecords.length === 0 ? (
                                <div className="text-center text-muted-foreground text-sm py-8">
                                    Ирцийн түүх хоосон байна
                                </div>
                            ) : (
                                myAttendanceRecords.map(record => (
                                    <div 
                                        key={record.id} 
                                        className="flex items-center justify-between p-3 bg-muted/30 rounded-lg"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={cn(
                                                "h-10 w-10 rounded-full flex items-center justify-center",
                                                record.checkOutTime 
                                                    ? "bg-green-100 text-green-600" 
                                                    : "bg-blue-100 text-blue-600"
                                            )}>
                                                {record.checkOutTime 
                                                    ? <CheckCircle className="h-5 w-5" /> 
                                                    : <Clock className="h-5 w-5" />
                                                }
                                            </div>
                                            <div>
                                                <p className="font-medium text-sm">
                                                    {format(new Date(record.date), 'MM/dd, EEEE', { locale: mn })}
                                                </p>
                                                <p className="text-xs text-muted-foreground">
                                                    {format(new Date(record.checkInTime), 'HH:mm')}
                                                    {record.checkOutTime 
                                                        ? ` - ${format(new Date(record.checkOutTime), 'HH:mm')}` 
                                                        : ' - ...'
                                                    }
                                                </p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <span className={cn(
                                                "text-xs font-semibold px-2 py-1 rounded-full",
                                                record.checkOutTime 
                                                    ? "bg-green-50 text-green-700" 
                                                    : "bg-blue-50 text-blue-700"
                                            )}>
                                                {record.checkOutTime 
                                                    ? calculateDuration(record.checkInTime, record.checkOutTime) 
                                                    : 'Ажиллаж байна'
                                                }
                                            </span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </TabsContent>

                    {/* Time-off Requests */}
                    <TabsContent value="timeoff" className="overflow-y-auto max-h-[60vh]">
                        <div className="space-y-3">
                            {isLoadingTimeOff ? (
                                Array.from({ length: 3 }).map((_, i) => (
                                    <Skeleton key={i} className="h-16 w-full rounded-lg" />
                                ))
                            ) : !timeOffRequests || timeOffRequests.length === 0 ? (
                                <div className="text-center text-muted-foreground text-sm py-8">
                                    Чөлөөний хүсэлт хоосон байна
                                </div>
                            ) : (
                                timeOffRequests.map(req => {
                                    const status = statusConfig[req.status];
                                    const isPending = req.status === 'Хүлээгдэж буй';
                                    return (
                                        <div 
                                            key={req.id} 
                                            className="p-3 bg-muted/30 rounded-lg"
                                        >
                                            <div className="flex justify-between items-start mb-2">
                                                <div>
                                                    <p className="font-medium text-sm">{req.type}</p>
                                                    <p className="text-xs text-muted-foreground">
                                                        {format(new Date(req.startDate), 'MM/dd')} - {format(new Date(req.endDate), 'MM/dd')}
                                                    </p>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Badge 
                                                        variant={status.variant} 
                                                        className={cn("text-[10px]", status.className)}
                                                    >
                                                        {status.label}
                                                    </Badge>
                                                    {isPending && (
                                                        <AlertDialog>
                                                            <AlertDialogTrigger asChild>
                                                                <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive">
                                                                    <Trash2 className="h-3 w-3" />
                                                                </Button>
                                                            </AlertDialogTrigger>
                                                            <AlertDialogContent>
                                                                <AlertDialogHeader>
                                                                    <AlertDialogTitle>Хүсэлт цуцлах</AlertDialogTitle>
                                                                    <AlertDialogDescription>
                                                                        Энэ хүсэлтийг цуцлахдаа итгэлтэй байна уу?
                                                                    </AlertDialogDescription>
                                                                </AlertDialogHeader>
                                                                <AlertDialogFooter>
                                                                    <AlertDialogCancel>Үгүй</AlertDialogCancel>
                                                                    <AlertDialogAction 
                                                                        onClick={() => handleCancelTimeOff(req.id)}
                                                                        className="bg-destructive text-destructive-foreground"
                                                                    >
                                                                        Тийм, цуцлах
                                                                    </AlertDialogAction>
                                                                </AlertDialogFooter>
                                                            </AlertDialogContent>
                                                        </AlertDialog>
                                                    )}
                                                </div>
                                            </div>
                                            <p className="text-xs text-muted-foreground line-clamp-2">{req.reason}</p>
                                            <p className="text-[10px] text-muted-foreground mt-1">
                                                Илгээсэн: {req.approverName}
                                            </p>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </TabsContent>

                    {/* Attendance Requests */}
                    <TabsContent value="requests" className="overflow-y-auto max-h-[60vh]">
                        <div className="space-y-3">
                            {isLoadingAttendanceReq ? (
                                Array.from({ length: 3 }).map((_, i) => (
                                    <Skeleton key={i} className="h-16 w-full rounded-lg" />
                                ))
                            ) : !attendanceRequests || attendanceRequests.length === 0 ? (
                                <div className="text-center text-muted-foreground text-sm py-8">
                                    Ирцийн хүсэлт хоосон байна
                                </div>
                            ) : (
                                attendanceRequests.map(req => {
                                    const status = statusConfig[req.status];
                                    const isPending = req.status === 'Хүлээгдэж буй';
                                    const typeLabel = attendanceRequestTypeLabels[req.type] || req.type;
                                    return (
                                        <div 
                                            key={req.id} 
                                            className="p-3 bg-muted/30 rounded-lg"
                                        >
                                            <div className="flex justify-between items-start mb-2">
                                                <div>
                                                    <p className="font-medium text-sm">{typeLabel}</p>
                                                    <p className="text-xs text-muted-foreground">
                                                        {format(new Date(req.startDate), 'MM/dd')}
                                                        {req.endDate !== req.startDate && ` - ${format(new Date(req.endDate), 'MM/dd')}`}
                                                        {req.startTime && ` (${req.startTime} - ${req.endTime})`}
                                                    </p>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Badge 
                                                        variant={status.variant} 
                                                        className={cn("text-[10px]", status.className)}
                                                    >
                                                        {status.label}
                                                    </Badge>
                                                    {isPending && (
                                                        <AlertDialog>
                                                            <AlertDialogTrigger asChild>
                                                                <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive">
                                                                    <Trash2 className="h-3 w-3" />
                                                                </Button>
                                                            </AlertDialogTrigger>
                                                            <AlertDialogContent>
                                                                <AlertDialogHeader>
                                                                    <AlertDialogTitle>Хүсэлт цуцлах</AlertDialogTitle>
                                                                    <AlertDialogDescription>
                                                                        Энэ хүсэлтийг цуцлахдаа итгэлтэй байна уу?
                                                                    </AlertDialogDescription>
                                                                </AlertDialogHeader>
                                                                <AlertDialogFooter>
                                                                    <AlertDialogCancel>Үгүй</AlertDialogCancel>
                                                                    <AlertDialogAction 
                                                                        onClick={() => handleCancelAttendanceReq(req.id)}
                                                                        className="bg-destructive text-destructive-foreground"
                                                                    >
                                                                        Тийм, цуцлах
                                                                    </AlertDialogAction>
                                                                </AlertDialogFooter>
                                                            </AlertDialogContent>
                                                        </AlertDialog>
                                                    )}
                                                </div>
                                            </div>
                                            <p className="text-xs text-muted-foreground line-clamp-2">{req.reason}</p>
                                            <p className="text-[10px] text-muted-foreground mt-1">
                                                Илгээсэн: {req.approverName}
                                            </p>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </TabsContent>
                </Tabs>
            </SheetContent>
        </Sheet>
    );
}
