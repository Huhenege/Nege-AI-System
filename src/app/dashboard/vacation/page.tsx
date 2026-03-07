'use client';

import React, { useState, useMemo } from 'react';
import { useFirebase, useCollection, useMemoFirebase, updateDocumentNonBlocking, tenantCollection, useTenantWrite } from '@/firebase';
import { collectionGroup, query, orderBy, where } from 'firebase/firestore';
import { PageHeader } from '@/components/patterns/page-layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { VacationDashboard } from './components/vacation-dashboard';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AddActionButton } from '@/components/ui/add-action-button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { VerticalTabMenu } from '@/components/ui/vertical-tab-menu';
import {
    format,
    parseISO,
    isWithinInterval,
    startOfDay,
    endOfDay,
    addMonths,
    subMonths,
    startOfMonth,
    endOfMonth,
    startOfWeek,
    endOfWeek,
    eachDayOfInterval,
    isSameMonth,
    isSameDay,
    addDays
} from 'date-fns';
import { mn } from 'date-fns/locale';
import {
    Calendar as CalendarIcon,
    Filter,
    Search,
    CheckCircle2,
    XCircle,
    Clock,
    Palmtree,
    UserCheck,
    MoreHorizontal,
    ChevronLeft,
    ChevronRight,
    CalendarDays
} from 'lucide-react';
import { VacationRequest } from '@/types/vacation';
import { Employee } from '../employees/data';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function VacationPage() {
    const { firestore } = useFirebase();
    const { tDoc } = useTenantWrite();
    const { toast } = useToast();
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState('pending');
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
    const [rejectReason, setRejectReason] = useState('');
    const [requestToReject, setRequestToReject] = useState<VacationRequest | null>(null);

    // Queries
    const requestsQuery = useMemoFirebase(() =>
        firestore ? query(collectionGroup(firestore, 'vacationRequests'), orderBy('startDate', 'desc')) : null
        , [firestore]);

    const employeesQuery = useMemoFirebase(({ firestore, companyPath }) =>
        firestore ? tenantCollection(firestore, companyPath, 'employees') : null
        , [firestore]);

    const { data: requests, isLoading: isLoadingRequests, error: requestsError } = useCollection<VacationRequest>(requestsQuery);
    const { data: employees, isLoading: isLoadingEmps } = useCollection<Employee>(employeesQuery);

    // Map employees for easy lookup
    const employeeMap = useMemo(() => {
        const map = new Map<string, Employee>();
        employees?.forEach(e => map.set(e.id, e));
        return map;
    }, [employees]);

    // Current date for "On Leave" calculation
    const today = startOfDay(new Date());

    // Stats
    const stats = useMemo(() => {
        if (!requests) return { total: 0, pending: 0, onLeave: 0 };

        return {
            total: requests.length,
            pending: requests.filter(r => r.status === 'PENDING').length,
            onLeave: requests.filter(r => {
                if (r.status !== 'APPROVED') return false;

                // Handle split vacation logic
                if (r.splits && r.splits.length > 0) {
                    return r.splits.some(split =>
                        isWithinInterval(today, {
                            start: startOfDay(parseISO(split.start)),
                            end: endOfDay(parseISO(split.end))
                        })
                    );
                }

                // Fallback for legacy requests without splits
                return isWithinInterval(today, {
                    start: startOfDay(parseISO(r.startDate)),
                    end: endOfDay(parseISO(r.endDate))
                });
            }).length
        };
    }, [requests, today]);

    // Filtered Requests based on Tab and Search
    const filteredRequests = useMemo(() => {
        if (!requests) return [];

        return requests.filter(req => {
            // Tab filter
            if (activeTab === 'pending' && req.status !== 'PENDING') return false;
            if (activeTab === 'approved' && req.status !== 'APPROVED') return false;

            // Search filter
            const emp = employeeMap.get(req.employeeId);
            const fullName = emp ? `${emp.firstName} ${emp.lastName}`.toLowerCase() : '';
            return fullName.includes(searchTerm.toLowerCase());
        });
    }, [requests, employeeMap, searchTerm, activeTab]);

    const openRejectDialog = (req: VacationRequest) => {
        setRequestToReject(req);
        setRejectReason('');
        setIsRejectDialogOpen(true);
    };

    const confirmReject = async () => {
        if (!requestToReject) return;
        const rr = rejectReason.trim();
        await handleStatusUpdate(requestToReject, 'REJECTED', rr);
        setIsRejectDialogOpen(false);
        setRequestToReject(null);
        setRejectReason('');
    };

    const handleStatusUpdate = async (req: VacationRequest, newStatus: 'APPROVED' | 'REJECTED', rejectionReason?: string) => {
        if (!firestore) return;

        try {
            const docRef = tDoc('employees', req.employeeId, 'vacationRequests', req.id);
            if (newStatus === 'REJECTED' && !rejectionReason?.trim()) {
                toast({
                    variant: "destructive",
                    title: "Татгалзах шалтгаан шаардлагатай",
                    description: "Татгалзах үед шалтгаанаа заавал оруулна уу.",
                });
                return;
            }

            const nowIso = new Date().toISOString();
            await updateDocumentNonBlocking(docRef, {
                status: newStatus,
                decisionAt: nowIso,
                approvedAt: nowIso, // compat
                rejectionReason: newStatus === 'REJECTED' ? rejectionReason?.trim() : null,
                updatedAt: nowIso,
            });

            toast({
                title: newStatus === 'APPROVED' ? "Хүсэлтийг баталлаа" : "Хүсэлтээс татгалзлаа",
                description: "Төлөв амжилттай шинэчлэгдлээ.",
            });
        } catch (error) {
            toast({
                variant: "destructive",
                title: "Алдаа гарлаа",
                description: "Төлөв өөрчлөхөд алдаа гарлаа.",
            });
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'APPROVED':
                return <Badge className="bg-green-500 hover:bg-green-600"><CheckCircle2 className="w-3 h-3 mr-1" /> Зөвшөөрсөн</Badge>;
            case 'REJECTED':
                return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" /> Татгалзсан</Badge>;
            case 'PENDING':
                return <Badge variant="secondary" className="bg-yellow-500/10 text-yellow-600 hover:bg-yellow-500/20"><Clock className="w-3 h-3 mr-1" /> Хүлээгдэж буй</Badge>;
            case 'CANCELLED':
                return <Badge variant="outline" className="text-muted-foreground">Цуцлагдсан</Badge>;
            default:
                return <Badge variant="outline">{status}</Badge>;
        }
    };

    // Calendar logic
    const calendarDays = useMemo(() => {
        const monthStart = startOfMonth(currentMonth);
        const monthEnd = endOfMonth(monthStart);
        const startDate = startOfWeek(monthStart);
        const endDate = endOfWeek(monthEnd);

        return eachDayOfInterval({ start: startDate, end: endDate });
    }, [currentMonth]);

    const getVacationsForDay = (day: Date) => {
        if (!requests) return [];
        const targetDay = startOfDay(day);

        return requests.filter(req => {
            if (req.status !== 'APPROVED') return false;

            // Check if day is within any split
            if (req.splits && req.splits.length > 0) {
                return req.splits.some(split =>
                    isWithinInterval(targetDay, {
                        start: startOfDay(parseISO(split.start)),
                        end: endOfDay(parseISO(split.end))
                    })
                );
            }

            // Fallback for legacy data
            return isWithinInterval(targetDay, {
                start: startOfDay(parseISO(req.startDate)),
                end: endOfDay(parseISO(req.endDate))
            });
        });
    };

    // Helper to avoid local time of Today check
    function startOfToday(date: Date) { return startOfDay(date); }
    function endOfToday(date: Date) { return endOfDay(date); }

    return (
        <div className="flex flex-col h-full overflow-hidden">
            <div className="flex-1 overflow-y-auto pb-32">
                <div className="bg-gradient-to-br from-violet-500/10 via-purple-500/5 to-fuchsia-500/10 dark:from-violet-500/5 dark:via-purple-500/5 dark:to-fuchsia-500/5">
                    <div className="px-6 py-6 md:p-8">
                        <PageHeader
                            title="Ээлжийн амралт"
                            description="Ажилчдын ээлжийн амралтын хуваарь болон хүсэлтүүдийг удирдах хэсэг."
                            showBackButton={true}
                            hideBreadcrumbs={true}
                            backButtonPlacement="inline"
                            backBehavior="history"
                            fallbackBackHref="/dashboard"
                            actions={
                                <AddActionButton
                                    label="Хуваарь нэмэх"
                                    description="Ээлжийн амралтын хуваарь нэмэх"
                                    onClick={() =>
                                        toast({
                                            title: 'Тун удахгүй',
                                            description: 'Хуваарь нэмэх үйлдэл одоогоор хөгжүүлэлт хийгдэж байна.',
                                        })
                                    }
                                />
                            }
                        />
                        <div className="mt-6">
                            <VacationDashboard />
                        </div>
                    </div>
                </div>

                <div className="px-6 py-6 md:p-8 space-y-6">
            <Tabs defaultValue="pending" onValueChange={setActiveTab} className="space-y-4">
                <div className="flex items-center justify-between">
                    <VerticalTabMenu
                        orientation="horizontal"
                        items={[
                            { value: 'pending', label: `Шийдвэрлэх (${stats.pending})` },
                            { value: 'calendar', label: 'Календарь' },
                            { value: 'approved', label: 'Батлагдсан' },
                            { value: 'all', label: 'Бүх жагсаалт' },
                        ]}
                    />
                    {activeTab !== 'calendar' && (
                        <div className="flex w-[300px] items-center space-x-2">
                            <Search className="h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Ажилтны нэрээр хайх..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="bg-white"
                            />
                        </div>
                    )}
                </div>

                <TabsContent value="calendar" className="border-none p-0 outline-none">
                    <Card className="shadow-sm overflow-hidden">
                        <CardHeader className="bg-white border-b">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <h3 className="text-lg font-semibold capitalize">
                                        {format(currentMonth, 'yyyy оны MMMM', { locale: mn })}
                                    </h3>
                                    <div className="flex items-center gap-1 border rounded-lg p-1">
                                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
                                            <ChevronLeft className="h-4 w-4" />
                                        </Button>
                                        <Button variant="ghost" size="sm" className="h-8 px-3 text-xs" onClick={() => setCurrentMonth(new Date())}>
                                            Өнөөдөр
                                        </Button>
                                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
                                            <ChevronRight className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                    <div className="flex items-center gap-1.5">
                                        <div className="w-3 h-3 bg-green-100 border border-green-200 rounded-sm" />
                                        <span>Батлагдсан амралт</span>
                                    </div>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="grid grid-cols-7 border-b bg-slate-50">
                                {['Дав', 'Мяг', 'Лха', 'Пүр', 'Баа', 'Бям', 'Ням'].map(day => (
                                    <div key={day} className="py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                        {day}
                                    </div>
                                ))}
                            </div>
                            <div className="grid grid-cols-7 auto-rows-[120px]">
                                {calendarDays.map((day, idx) => {
                                    const dayVacations = getVacationsForDay(day);
                                    const isCurrentMonth = isSameMonth(day, currentMonth);
                                    const isToday = isSameDay(day, new Date());

                                    return (
                                        <div
                                            key={idx}
                                            className={cn(
                                                "border-r border-b p-2 transition-colors",
                                                !isCurrentMonth && "bg-slate-50/50 text-slate-400",
                                                isToday && "bg-blue-50/30"
                                            )}
                                        >
                                            <div className="flex justify-between items-start mb-1">
                                                <span className={cn(
                                                    "text-sm font-medium w-6 h-6 flex items-center justify-center rounded-full",
                                                    isToday && "bg-blue-600 text-white shadow-sm"
                                                )}>
                                                    {format(day, 'd')}
                                                </span>
                                            </div>
                                            <div className="space-y-1 overflow-y-auto max-h-[85px] scrollbar-none">
                                                {dayVacations.map(vac => {
                                                    const emp = employeeMap.get(vac.employeeId);
                                                    return (
                                                        <div
                                                            key={vac.id}
                                                            className="text-[10px] p-1 bg-green-50 border border-green-100 text-green-700 rounded-md flex items-center gap-1 truncate font-medium shadow-sm"
                                                            title={`${emp?.firstName}: ${format(parseISO(vac.startDate), 'MM.dd')} - ${format(parseISO(vac.endDate), 'MM.dd')}`}
                                                        >
                                                            <Avatar className="h-3 w-3">
                                                                <AvatarImage src={emp?.photoURL} />
                                                                <AvatarFallback className="text-[6px]">{emp?.firstName?.[0]}</AvatarFallback>
                                                            </Avatar>
                                                            {emp?.firstName}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value={activeTab} className="border-none p-0 outline-none">
                    <Card className="shadow-sm">
                        <CardContent className="p-0">
                            {isLoadingRequests || isLoadingEmps ? (
                                <div className="p-8 space-y-4">
                                    <Skeleton className="h-10 w-full" />
                                    <Skeleton className="h-10 w-full" />
                                    <Skeleton className="h-10 w-full" />
                                </div>
                            ) : filteredRequests.length === 0 ? (
                                <div className="text-center py-20 text-muted-foreground flex flex-col items-center">
                                    <div className="bg-slate-50 p-4 rounded-full mb-4">
                                        <Search className="h-8 w-8 text-slate-300" />
                                    </div>
                                    <p className="font-medium text-slate-500">Хүсэлт олдсонгүй</p>
                                </div>
                            ) : (
                                <Table>
                                    <TableHeader className="bg-slate-50/50">
                                        <TableRow>
                                            <TableHead className="w-[280px]">Ажилтан</TableHead>
                                            <TableHead>Хугацаа / Хоног</TableHead>
                                            <TableHead>Төлөв</TableHead>
                                            <TableHead>Батлах ажилтан</TableHead>
                                            <TableHead className="text-right pr-6">Үйлдэл</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredRequests.map((req) => {
                                            const emp = employeeMap.get(req.employeeId);
                                            const approver = req.approverId ? employeeMap.get(req.approverId) : null;

                                            return (
                                                <TableRow key={req.id} className="hover:bg-slate-50/50 transition-colors group">
                                                    <TableCell className="font-medium">
                                                        <div className="flex items-center gap-3">
                                                            <Avatar className="h-10 w-10 border-2 border-white shadow-sm">
                                                                <AvatarImage src={emp?.photoURL} />
                                                                <AvatarFallback className="bg-slate-100 text-slate-500">{emp?.firstName?.[0]}</AvatarFallback>
                                                            </Avatar>
                                                            <div className="flex flex-col">
                                                                <span className="font-semibold text-slate-900 leading-tight">{emp?.firstName} {emp?.lastName}</span>
                                                                <span className="text-xs text-muted-foreground mt-0.5">{emp?.jobTitle}</span>
                                                            </div>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex flex-col">
                                                            <div className="flex items-center gap-2 font-medium text-slate-800">
                                                                <CalendarIcon className="h-3.5 w-3.5 text-slate-400" />
                                                                {format(parseISO(req.startDate), 'yyyy.MM.dd')} - {format(parseISO(req.endDate), 'yyyy.MM.dd')}
                                                            </div>
                                                            {req.reason && (
                                                                <div className="text-[11px] text-slate-500 mt-1 line-clamp-1" title={req.reason}>
                                                                    {req.reason}
                                                                </div>
                                                            )}
                                                            {req.status === 'REJECTED' && req.rejectionReason && (
                                                                <div className="text-[11px] text-rose-700 mt-1 line-clamp-1" title={req.rejectionReason}>
                                                                    Татгалзсан: “{req.rejectionReason}”
                                                                </div>
                                                            )}
                                                            <div className="flex items-center gap-2 mt-1">
                                                                <Badge variant="outline" className="text-[10px] font-mono border-slate-200">
                                                                    {req.totalDays} хоног
                                                                </Badge>
                                                                <span className="text-[11px] text-muted-foreground">
                                                                    {calculateDistance(req.requestDate)} илгээсэн
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>{getStatusBadge(req.status)}</TableCell>
                                                    <TableCell>
                                                        {approver ? (
                                                            <div className="flex items-center gap-2">
                                                                <UserCheck className="h-4 w-4 text-slate-400" />
                                                                <span className="text-sm text-slate-600 font-medium">{approver.firstName}</span>
                                                            </div>
                                                        ) : (
                                                            <span className="text-xs text-muted-foreground italic">Тодорхойгүй</span>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-right pr-6">
                                                        <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            {req.status === 'PENDING' && (
                                                                <>
                                                                    <Button
                                                                        variant="outline"
                                                                        size="sm"
                                                                        className="h-8 text-green-600 hover:text-green-700 hover:bg-green-50 border-green-200"
                                                                        onClick={() => handleStatusUpdate(req, 'APPROVED')}
                                                                    >
                                                                        <CheckCircle2 className="h-4 w-4 mr-1" /> Батлах
                                                                    </Button>
                                                                    <Button
                                                                        variant="outline"
                                                                        size="sm"
                                                                        className="h-8 text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-rose-200"
                                                                        onClick={() => openRejectDialog(req)}
                                                                    >
                                                                        <XCircle className="h-4 w-4 mr-1" /> Татгалзах
                                                                    </Button>
                                                                </>
                                                            )}
                                                            <DropdownMenu>
                                                                <DropdownMenuTrigger asChild>
                                                                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                                                        <MoreHorizontal className="h-4 w-4" />
                                                                    </Button>
                                                                </DropdownMenuTrigger>
                                                                <DropdownMenuContent align="end">
                                                                    <DropdownMenuLabel>Үйлдэл</DropdownMenuLabel>
                                                                    <DropdownMenuItem>Дэлгэрэнгүй харах</DropdownMenuItem>
                                                                    <DropdownMenuItem>Засах</DropdownMenuItem>
                                                                    <DropdownMenuSeparator />
                                                                    <DropdownMenuItem className="text-rose-600">Устгах</DropdownMenuItem>
                                                                </DropdownMenuContent>
                                                            </DropdownMenu>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

                    {/* Query error (e.g., missing index / permission) */}
                    {requestsError && (
                        <Card className="border border-rose-200 bg-rose-50/50">
                            <CardHeader>
                                <CardTitle className="text-sm text-rose-800">Хүсэлтүүдийг ачаалж чадсангүй</CardTitle>
                                <CardDescription className="text-rose-700">
                                    {requestsError.message}
                                </CardDescription>
                            </CardHeader>
                        </Card>
                    )}

                    {/* Reject dialog */}
                    <Dialog open={isRejectDialogOpen} onOpenChange={(o) => { if (!o) { setIsRejectDialogOpen(false); setRequestToReject(null); setRejectReason(''); } }}>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Хүсэлт татгалзах</DialogTitle>
                                <DialogDescription>Татгалзах шалтгаанаа заавал бичнэ үү.</DialogDescription>
                            </DialogHeader>
                            <div className="space-y-2">
                                <Textarea
                                    value={rejectReason}
                                    onChange={(e) => setRejectReason(e.target.value)}
                                    placeholder="Ж: Хуваарь давхцаж байна..."
                                />
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => { setIsRejectDialogOpen(false); setRequestToReject(null); setRejectReason(''); }}>
                                    Болих
                                </Button>
                                <Button variant="destructive" onClick={confirmReject} disabled={!rejectReason.trim()}>
                                    Татгалзах
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>
        </div>
    );
}

function calculateDistance(dateStr: string) {
    if (!dateStr) return '';
    try {
        const date = parseISO(dateStr);
        const now = new Date();
        const diffTime = Math.abs(now.getTime() - date.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays === 0) return 'Өнөөдөр';
        if (diffDays === 1) return 'Өчигдөр';
        if (diffDays <= 7) return `${diffDays} өдрийн өмнө`;
        return format(date, 'yyyy.MM.dd');
    } catch {
        return '';
    }
}
