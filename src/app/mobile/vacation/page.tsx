'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useFirebase, useCollection, useMemoFirebase, addDocumentNonBlocking, updateDocumentNonBlocking, useDoc, tenantCollection, tenantDoc, useTenantWrite } from '@/firebase';
import { useEmployeeProfile } from '@/hooks/use-employee-profile';
import { query, where, orderBy, collectionGroup, DocumentReference } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    ChevronLeft,
    Plus,
    Calendar,
    Clock,
    CheckCircle2,
    XCircle,
    Info,
    CalendarDays,
    UserCheck,
    ThumbsUp,
    ThumbsDown,
    ListFilter,
    Palmtree,
    History,
    RotateCcw,
    Loader2,
    AlertCircle,
    AlertTriangle,
    CalendarCheck
} from 'lucide-react';
import { format, parseISO, differenceInDays, addMonths, isSameDay, startOfDay, eachMonthOfInterval, startOfMonth, endOfMonth, eachDayOfInterval, isToday, startOfToday, addYears, isAfter, isBefore, isValid, getDay } from 'date-fns';
import { mn } from 'date-fns/locale';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogDescription,
    DialogFooter
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { getCurrentWorkYear } from '@/lib/vacation-utils';
import { VacationRequest } from '@/types/vacation';
import { Employee, Position, isActiveStatus } from '@/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
    buildRecurringDayMap,
    countVacationUnitsInclusive,
    formatVacationUnits,
    isVacationSelectableDayType,
    resolveDayType,
    roundToHalf,
    type WorkCalendar,
} from '@/lib/work-calendar-utils';

type VacationSplit = {
    start: string;
    end: string;
    days: number;
};

export default function MobileVacationPage() {
    const router = useRouter();
    const { toast } = useToast();
    const { firestore } = useFirebase();
    const { tDoc, tCollection } = useTenantWrite();
    const { employeeProfile, isProfileLoading } = useEmployeeProfile();

    const [isRequestOpen, setIsRequestOpen] = React.useState(false);
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [activeTab, setActiveTab] = React.useState('my-vacation');

    // UX States
    const [optimisticUpdates, setOptimisticUpdates] = React.useState<Record<string, 'APPROVED' | 'REJECTED' | 'PENDING'>>({});
    const [processingIds, setProcessingIds] = React.useState<Set<string>>(new Set());

    const [startDate, setStartDate] = React.useState('');
    const [endDate, setEndDate] = React.useState('');
    const [reason, setReason] = React.useState('');
    const [selectedApproverId, setSelectedApproverId] = React.useState('');
    const [editingRequest, setEditingRequest] = React.useState<VacationRequest | null>(null);

    // Splitting states
    const [numSplits, setNumSplits] = React.useState<number>(1);
    const [splits, setSplits] = React.useState<VacationSplit[]>([{ start: '', end: '', days: 0 }]);

    // Fetch Vacation Config
    const vacationConfigRef = useMemoFirebase(({ firestore, companyPath }) => (firestore ? tenantDoc(firestore, companyPath, 'company', 'vacationConfig') as DocumentReference<{ maxSplits: number }> : null), []);
    const { data: vacationConfig } = useDoc<{ maxSplits: number }>(vacationConfigRef);
    const maxSplits = vacationConfig?.maxSplits || 3;

    // Rejection dialog state
    const [isRejectionDialogOpen, setIsRejectionDialogOpen] = React.useState(false);
    const [requestToReject, setRequestToReject] = React.useState<VacationRequest | null>(null);
    const [managerRejectionReason, setManagerRejectionReason] = React.useState('');

    // Cancel dialog state (employee cancel pending request)
    const [isCancelDialogOpen, setIsCancelDialogOpen] = React.useState(false);
    const [requestToCancel, setRequestToCancel] = React.useState<VacationRequest | null>(null);

    // Planning States
    const [isPlanning, setIsPlanning] = React.useState(false);
    const [planningStep, setPlanningStep] = React.useState<'splits' | 'overview' | 'calendar'>('splits');
    const [activeSplitIndex, setActiveSplitIndex] = React.useState(0);
    const [selectingDate, setSelectingDate] = React.useState<'start' | 'end'>('start');

    // Fetch company work calendar (single source of truth for working/non-working days)
    const workCalendarRef = useMemoFirebase(
        ({ firestore, companyPath }) => (firestore ? (tenantDoc(firestore, companyPath, 'workCalendars', 'default') as DocumentReference<any>) : null),
        [firestore]
    );
    const { data: workCalendar, isLoading: isWorkCalendarLoading } = useDoc<WorkCalendar>(workCalendarRef);
    const recurringDayMap = React.useMemo(() => buildRecurringDayMap(workCalendar), [workCalendar]);

    // Fetch current employee's position to check for approval rights
    const myPositionQuery = useMemoFirebase(({ companyPath }) =>
        employeeProfile?.positionId ? tenantDoc(firestore!, companyPath, 'positions', employeeProfile.positionId) as DocumentReference<Position> : null
        , [firestore, employeeProfile?.positionId]);
    const { data: myPosition, isLoading: isPositionLoading } = useDoc<Position>(myPositionQuery);

    const isAuthorizedApprover = myPosition?.canApproveVacation || false;

    // Eligibility check (6 months mark)
    const eligibilityDate = React.useMemo(() => {
        if (!employeeProfile?.hireDate) return null;
        return addMonths(new Date(employeeProfile.hireDate), 6);
    }, [employeeProfile?.hireDate]);

    const isEligibleNow = React.useMemo(() => {
        if (!eligibilityDate) return false;
        return new Date() >= eligibilityDate;
    }, [eligibilityDate]);

    // Calculations
    const workYear = React.useMemo(() => {
        if (!employeeProfile?.hireDate) return null;
        return getCurrentWorkYear(employeeProfile.hireDate);
    }, [employeeProfile?.hireDate]);

    // Query: User's own requests
    const myRequestsQuery = useMemoFirebase(({ companyPath }) =>
        employeeProfile ? query(
            tenantCollection(firestore!, companyPath, `employees/${employeeProfile.id}/vacationRequests`),
            orderBy('startDate', 'desc')
        ) : null
        , [firestore, employeeProfile]);
    const { data: myRequests, isLoading: isMyRequestsLoading } = useCollection<VacationRequest>(myRequestsQuery);

    // Query: All requests assigned to me as approver
    const { user: authUser } = useFirebase();
    const allAssignedRequestsQuery = useMemoFirebase(() =>
        authUser ? query(
            collectionGroup(firestore!, 'vacationRequests'),
            where('approverId', '==', authUser.uid)
        ) : null
        , [firestore, authUser?.uid]);

    const { data: rawAssignedRequests, isLoading: isAssignedLoading, error: queryError } = useCollection<VacationRequest>(allAssignedRequestsQuery);

    // Filter and Process data
    const allAssignedRequests = React.useMemo(() => {
        if (!rawAssignedRequests) return [];
        return rawAssignedRequests.map(req => {
            if (optimisticUpdates[req.id]) {
                return { ...req, status: optimisticUpdates[req.id] };
            }
            return req;
        });
    }, [rawAssignedRequests, optimisticUpdates]);

    const incomingRequests = React.useMemo(() =>
        allAssignedRequests.filter(r => r.status === 'PENDING')
            .sort((a, b) => new Date(b.requestDate).getTime() - new Date(a.requestDate).getTime())
        , [allAssignedRequests]);

    const myHistory = React.useMemo(() =>
        allAssignedRequests.filter(r => r.status === 'APPROVED' || r.status === 'REJECTED')
            .sort((a, b) => {
                const timeA = new Date(b.decisionAt || b.requestDate).getTime();
                const timeB = new Date(a.decisionAt || a.requestDate).getTime();
                return timeA - timeB;
            })
        , [allAssignedRequests]);

    // Query: All employees (for names)
    const employeesQuery = useMemoFirebase(({ companyPath }) => tenantCollection(firestore!, companyPath, 'employees'), [firestore]);
    const { data: allEmployees } = useCollection<Employee>(employeesQuery);
    const employeeMap = React.useMemo(() => {
        const map = new Map<string, Employee>();
        allEmployees?.forEach(e => map.set(e.id, e));
        return map;
    }, [allEmployees]);

    // Approver choices for the form (Vacation approval rights)
    // Some positions store the flag at root `canApproveVacation`, others under `permissions.canApproveVacation`.
    const approverPositionsQueryRoot = useMemoFirebase(({ companyPath }) =>
        firestore ? query(tenantCollection(firestore, companyPath, 'positions'), where('canApproveVacation', '==', true)) : null
        , [firestore]);
    const approverPositionsQueryPermissions = useMemoFirebase(({ companyPath }) =>
        firestore ? query(tenantCollection(firestore, companyPath, 'positions'), where('permissions.canApproveVacation', '==', true)) : null
        , [firestore]);

    const { data: approverPositionsRoot } = useCollection<Position>(approverPositionsQueryRoot);
    const { data: approverPositionsPerm } = useCollection<Position>(approverPositionsQueryPermissions);

    const approverPosIds = React.useMemo(() => {
        const ids = new Set<string>();
        (approverPositionsRoot || []).forEach(p => ids.add(p.id));
        (approverPositionsPerm || []).forEach(p => ids.add(p.id));
        return Array.from(ids);
    }, [approverPositionsRoot, approverPositionsPerm]);

    const potentialApprovers = React.useMemo(() => {
        if (!allEmployees) return [];
        const isMe = (emp: Employee) => emp.id === employeeProfile?.id;
        const hasVacApproveRole = (emp: Employee) =>
            emp.role === 'company_super_admin' || emp.role === 'admin' || (!!emp.positionId && approverPosIds.includes(emp.positionId));

        return allEmployees
            .filter(emp => isActiveStatus(emp.status))
            .filter(emp => !isMe(emp))
            .filter(hasVacApproveRole);
    }, [allEmployees, approverPosIds, employeeProfile?.id]);

    // Vacation units calculation based on company work calendar:
    // - working/special_working => 1
    // - half_day => 0.5
    // - weekend/public_holiday/company_holiday => 0 (not selectable)
    const calculateVacationDays = React.useCallback((start: Date, end: Date) => {
        if (!workCalendar) return 0;
        return countVacationUnitsInclusive(start, end, workCalendar, recurringDayMap);
    }, [workCalendar, recurringDayMap]);

    const getRequestUnits = React.useCallback((r: VacationRequest): number => {
        if (!workCalendar) return roundToHalf(r?.totalDays || 0);

        const splitsArr = (r as any)?.splits as Array<{ start: string; end: string }> | undefined;
        if (Array.isArray(splitsArr) && splitsArr.length > 0) {
            const total = splitsArr.reduce((sum, s) => {
                if (!s?.start || !s?.end) return sum;
                return sum + countVacationUnitsInclusive(parseISO(s.start), parseISO(s.end), workCalendar, recurringDayMap);
            }, 0);
            return roundToHalf(total);
        }

        // Fallback: use the consolidated range
        return countVacationUnitsInclusive(parseISO(r.startDate), parseISO(r.endDate), workCalendar, recurringDayMap);
    }, [workCalendar, recurringDayMap]);

    const totalEntitled = employeeProfile?.vacationConfig?.baseDays || 15;
    const usedDays = React.useMemo(() => {
        if (!myRequests) return 0;
        return myRequests
            .filter(r => r.status === 'APPROVED' && r.workYearStart === workYear?.start.toISOString())
            .reduce((sum: number, r: VacationRequest) => sum + getRequestUnits(r), 0);
    }, [myRequests, workYear, getRequestUnits]);

    const pendingDays = React.useMemo(() => {
        if (!myRequests) return 0;
        return myRequests
            .filter(r => r.status === 'PENDING' && r.workYearStart === workYear?.start.toISOString())
            .reduce((sum: number, r: VacationRequest) => sum + getRequestUnits(r), 0);
    }, [myRequests, workYear, getRequestUnits]);

    const availableDays = Math.max(0, totalEntitled - usedDays - pendingDays);

    // Current selection calculation
    const totalSelectedDays = React.useMemo(() => {
        return roundToHalf(splits.reduce((sum: number, s: VacationSplit) => sum + (s.days || 0), 0));
    }, [splits]);

    const isFullyPlanned = React.useMemo(() => {
        return Math.abs(roundToHalf(totalSelectedDays) - roundToHalf(availableDays)) < 0.001;
    }, [totalSelectedDays, availableDays]);

    const handleSplitDateSelection = (date: Date) => {
        if (!workCalendar) return;
        const dt = resolveDayType(date, workCalendar, recurringDayMap);
        if (!isVacationSelectableDayType(dt)) return;

        const dateStr = format(date, 'yyyy-MM-dd');
        const newSplits = [...splits];
        const currentSplit = newSplits[activeSplitIndex];

        // Overlap check
        const isOverlap = splits.some((s, idx) => {
            if (idx === activeSplitIndex || !s.start || !s.end) return false;
            const d = startOfDay(date);
            return d >= startOfDay(new Date(s.start)) && d <= startOfDay(new Date(s.end));
        });

        if (isOverlap) {
            toast({ title: "Давхардсан огноо", variant: "destructive" });
            return;
        }

        // SMART SELECTION LOGIC
        // 1. If both are already set, any click starts a NEW range
        if (currentSplit.start && currentSplit.end) {
            newSplits[activeSplitIndex] = { ...currentSplit, start: dateStr, end: '', days: 0 };
            setSelectingDate('end');
        }
        // 2. Currently picking start
        else if (selectingDate === 'start' || !currentSplit.start) {
            newSplits[activeSplitIndex] = { ...currentSplit, start: dateStr, end: '', days: 0 };
            setSelectingDate('end');
        }
        // 3. Currently picking end
        else {
            if (isAfter(new Date(currentSplit.start), date)) {
                // If clicked date is before start, it becomes the new start
                newSplits[activeSplitIndex] = { ...currentSplit, start: dateStr, end: '', days: 0 };
                setSelectingDate('end');
            } else {
                // Happy path: selecting the end date
                newSplits[activeSplitIndex] = { ...currentSplit, end: dateStr };
                newSplits[activeSplitIndex].days = calculateVacationDays(new Date(currentSplit.start), date);
                // After setting end, we go back to 'start' mode so the NEXT click starts over if they want
                setSelectingDate('start');
            }
        }
        setSplits(newSplits);
    };

    const handleNumSplitsChange = (val: string) => {
        const n = parseInt(val);
        setNumSplits(n);

        setSplits(prev => {
            const next = Array.from({ length: n }, (_, i) => prev[i] || { start: '', end: '', days: 0 });
            return next;
        });

        if (activeSplitIndex >= n) {
            setActiveSplitIndex(0);
        }
        // After choosing splits for the first time, we move to overview
        setPlanningStep('overview');
    };

    const handleCreateRequest = async () => {
        if (!selectedApproverId || !employeeProfile || !workYear || !workCalendar) {
            toast({ variant: "destructive", title: "Мэдээлэл дутуу" });
            return;
        }

        // Validate all splits
        for (const split of splits) {
            if (!split.start || !split.end) {
                toast({ variant: "destructive", title: "Бүх огноог бөглөнө үү" });
                return;
            }
            const start = startOfDay(new Date(split.start));
            const end = startOfDay(new Date(split.end));

            if (start < workYear.start || end > workYear.end) {
                toast({ variant: "destructive", title: "Буруу огноо", description: "Ажилласан жилийн дотор байх ёстой." });
                return;
            }
            if (eligibilityDate && start < eligibilityDate) {
                toast({ variant: "destructive", title: "Эрх үүсээгүй байна" });
                return;
            }
        }

        // Calculate total available
        const currentUsed = myRequests
            ?.filter(r => r.status === 'APPROVED' && r.workYearStart === workYear?.start.toISOString() && r.id !== editingRequest?.id)
            .reduce((sum, r) => sum + getRequestUnits(r), 0) || 0;

        const currentPending = myRequests
            ?.filter(r => r.status === 'PENDING' && r.workYearStart === workYear?.start.toISOString() && r.id !== editingRequest?.id)
            .reduce((sum, r) => sum + getRequestUnits(r), 0) || 0;

        const dynamicAvailableDays = Math.max(0, totalEntitled - currentUsed - currentPending);

        if (totalSelectedDays > dynamicAvailableDays) {
            toast({ variant: "destructive", title: "Хоног хүрэлцэхгүй" });
            return;
        }

        setIsSubmitting(true);
        try {
            const split0 = splits[0];
            const lastSplit = splits[splits.length - 1];

            // CONSOLIDATED DATA
            const requestData: Omit<VacationRequest, 'id'> = {
                employeeId: employeeProfile.id,
                startDate: new Date(split0.start).toISOString(),
                endDate: new Date(lastSplit.end || split0.end).toISOString(),
                totalDays: totalSelectedDays,
                status: 'PENDING',
                requestDate: new Date().toISOString(),
                reason,
                approverId: selectedApproverId,
                workYearStart: workYear.start.toISOString(),
                workYearEnd: workYear.end.toISOString(),
                splits: splits.map(s => ({
                    start: new Date(s.start).toISOString(),
                    end: new Date(s.end).toISOString(),
                    days: s.days
                }))
            };

            // Employee cannot edit submitted requests (cancel-only flow). Always create a new request.
            if (editingRequest) {
                toast({ variant: "destructive", title: "Илгээсэн хүсэлтийг засах боломжгүй", description: "Шинэ хүсэлт үүсгэж илгээнэ үү." });
                return;
            }
            await addDocumentNonBlocking(tCollection('employees', employeeProfile.id, 'vacationRequests'), requestData);

            toast({ title: "Хүсэлтүүдийг илгээлээ" });
            setIsPlanning(false);
            setPlanningStep('splits');
            setEditingRequest(null);
            setSplits([{ start: '', end: '', days: 0 }]);
            setNumSplits(1);
            setReason('');
        } catch (error) {
            toast({ variant: "destructive", title: "Алдаа гарлаа" });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleStatusUpdate = async (req: VacationRequest, newStatus: 'APPROVED' | 'REJECTED' | 'PENDING', rejectionReason?: string) => {
        if (!firestore) return;

        // Optimistic Update
        setOptimisticUpdates(prev => ({ ...prev, [req.id]: newStatus }));
        setProcessingIds(prev => {
            const next = new Set(prev);
            next.add(req.id);
            return next;
        });

        try {
            const docRef = tDoc('employees', req.employeeId, 'vacationRequests', req.id);
            const updateData: any = {
                status: newStatus,
                decisionAt: newStatus === 'PENDING' ? null : new Date().toISOString(),
            };
            if (newStatus === 'REJECTED') {
                const rr = (rejectionReason || '').trim();
                if (!rr) {
                    toast({ variant: "destructive", title: "Татгалзах шалтгаан шаардлагатай" });
                    return;
                }
                updateData.rejectionReason = rr;
            } else {
                // Clear rejection reason on approve/pending
                updateData.rejectionReason = null;
            }
            // Compat for dashboard
            updateData.approvedAt = newStatus === 'PENDING' ? null : new Date().toISOString();

            await updateDocumentNonBlocking(docRef, updateData);

            toast({
                title: newStatus === 'APPROVED' ? "Баталлаа 🎉" : newStatus === 'REJECTED' ? "Татгалзлаа" : "Буцаалаа",
                className: cn(
                    "border-none text-white font-semibold h-12",
                    newStatus === 'APPROVED' ? "bg-green-600" : newStatus === 'REJECTED' ? "bg-rose-600" : "bg-slate-800"
                )
            });
        } catch (error: any) {
            setOptimisticUpdates(prev => {
                const next = { ...prev };
                delete next[req.id];
                return next;
            });
            toast({ variant: "destructive", title: "Засахад алдаа гарлаа" });
        } finally {
            setProcessingIds(prev => {
                const next = new Set(prev);
                next.delete(req.id);
                return next;
            });
        }
    };

    const handlePlanVacation = () => {
        // If we have more than 1 split OR the first split has a date, assume a plan is in progress
        const planInProgress = splits.length > 1 || (splits.length === 1 && splits[0].start !== '');

        if (planInProgress) {
            setPlanningStep('overview');
        } else {
            setPlanningStep('splits');
        }
        setIsPlanning(true);
    };

    const handleCancelRequest = async () => {
        if (!firestore || !employeeProfile || !requestToCancel) return;
        const req = requestToCancel;
        setIsSubmitting(true);
        try {
            const docRef = tDoc('employees', employeeProfile.id, 'vacationRequests', req.id);
            const nowIso = new Date().toISOString();
            await updateDocumentNonBlocking(docRef, {
                status: 'CANCELLED',
                decisionAt: nowIso,
                updatedAt: nowIso,
            } as any);
            toast({ title: "Хүсэлтийг цуцаллаа" });
        } catch {
            toast({ variant: "destructive", title: "Цуцлахад алдаа гарлаа" });
        } finally {
            setIsSubmitting(false);
            setIsCancelDialogOpen(false);
            setRequestToCancel(null);
        }
    };

    const handleResetPlanning = () => {
        setSplits([{ start: '', end: '', days: 0 }]);
        setNumSplits(1);
        setReason('');
        setSelectedApproverId('');
        setPlanningStep('splits');
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'APPROVED': return <Badge className="bg-green-500 border-none"><CheckCircle2 className="w-3 h-3 mr-1" /> Баталсан</Badge>;
            case 'REJECTED': return <Badge variant="destructive" className="border-none"><XCircle className="w-3 h-3 mr-1" /> Татгалзсан</Badge>;
            case 'PENDING': return <Badge variant="secondary" className="bg-amber-100 text-amber-700 border-none"><Clock className="w-3 h-3 mr-1" /> Хүлээгдэж буй</Badge>;
            default: return <Badge variant="outline">{status}</Badge>;
        }
    };


    // NEW PLANNING VIEWS
    const planningView = (() => {
        // STEP 1: CHOOSE SPLITS
        if (planningStep === 'splits') {
            return (
                <div className="min-h-screen bg-white flex flex-col animate-in slide-in-from-bottom duration-500">
                    <div className="bg-white px-6 py-4 flex items-center justify-between border-b">
                        <Button variant="ghost" size="icon" onClick={() => setIsPlanning(false)} className="rounded-full">
                            <ChevronLeft className="h-6 w-6" />
                        </Button>
                        <h2 className="text-lg font-semibold text-slate-900">Хуваалт сонгох</h2>
                        <div className="w-10" />
                    </div>

                    <div className="flex-1 flex flex-col items-center justify-center p-8 space-y-12">
                        <div className="text-center space-y-4">
                            <div className="w-20 h-20 bg-indigo-50 rounded-[32px] flex items-center justify-center mx-auto">
                                <Palmtree className="w-10 h-10 text-indigo-600" />
                            </div>
                            <h3 className="text-2xl font-semibold text-slate-900 leading-tight">Амралтаа хэд хувааж авах вэ?</h3>
                            <p className="text-slate-400 font-medium px-4">Та нийт авах амралтаа хэдэн хэсэг болгон хувааж авахаа энд сонгоно уу.</p>
                        </div>

                        <div className="w-full max-w-[300px] grid grid-cols-2 gap-3">
                            {Array.from({ length: maxSplits }, (_, i) => i + 1).map(n => (
                                <button
                                    key={n}
                                    onClick={() => handleNumSplitsChange(n.toString())}
                                    className={cn(
                                        "h-20 rounded-3xl border-2 transition-all flex flex-col items-center justify-center gap-1",
                                        numSplits === n ? "border-indigo-600 bg-indigo-50 text-indigo-700 font-semibold shadow-lg" : "border-slate-100 bg-white text-slate-400 font-semibold"
                                    )}
                                >
                                    <span className="text-xl">{n}</span>
                                    <span className="text-[10px] uppercase tracking-tighter">хуваах</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="p-8">
                        <Button
                            className="w-full h-16 rounded-3xl text-lg font-semibold bg-indigo-600 shadow-xl"
                            onClick={() => setPlanningStep('overview')}
                        >
                            Үргэлжлүүлэх
                        </Button>
                    </div>
                </div>
            );
        }

        // STEP 2: OVERVIEW
        if (planningStep === 'overview') {
            return (
                <div className="min-h-screen bg-slate-50 flex flex-col animate-in fade-in duration-300">
                    <div className="bg-white/80 backdrop-blur-xl px-6 py-4 flex items-center justify-between sticky top-0 z-50 border-b">
                        <div className="flex items-center gap-3">
                            <Button variant="ghost" size="icon" onClick={() => setIsPlanning(false)} className="rounded-full">
                                <ChevronLeft className="h-6 w-6" />
                            </Button>
                            <div>
                                <h2 className="text-lg font-semibold text-slate-900">Амралтын хуваарь</h2>
                                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest leading-none mt-0.5">Төлөвлөлт хадгалагдсан</p>
                            </div>
                        </div>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleResetPlanning}
                            className="text-[10px] font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-xl uppercase tracking-tighter"
                        >
                            Шинээр эхлэх
                        </Button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6 space-y-6">
                        {/* ENTITLEMENT SUMMARY CARD */}
                        <div className="bg-white rounded-[32px] p-6 shadow-sm border border-slate-100 space-y-4">
                            <div className="flex justify-between items-end">
                                <div className="space-y-1">
                                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Амралтын эрх</p>
                                    <h3 className="text-2xl font-semibold text-slate-900">
                                        {formatVacationUnits(totalSelectedDays)} <span className="text-slate-300 text-lg font-semibold">/ {formatVacationUnits(availableDays)} хоног</span>
                                    </h3>
                                </div>
                                <div className="text-right">
                                    <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-widest mb-1">Үлдэгдэл</p>
                                    <Badge className={cn(
                                        "rounded-lg font-semibold",
                                        (availableDays - totalSelectedDays) < 0 ? "bg-rose-500" : "bg-indigo-600"
                                    )}>
                                        {formatVacationUnits(availableDays - totalSelectedDays)} хоног
                                    </Badge>
                                </div>
                            </div>

                            {/* Progress Bar */}
                            <div className="h-3 w-full bg-slate-50 rounded-full overflow-hidden flex border border-slate-100/50">
                                <div
                                    className={cn(
                                        "h-full transition-all duration-500",
                                        totalSelectedDays > availableDays ? "bg-rose-500" : "bg-indigo-600"
                                    )}
                                    style={{ width: `${Math.min(100, availableDays > 0 ? (totalSelectedDays / availableDays) * 100 : 0)}%` }}
                                />
                            </div>

                            {totalSelectedDays > availableDays && (
                                <div className="flex items-center gap-2 text-rose-600 bg-rose-50 p-3 rounded-2xl border border-rose-100 animate-in shake duration-500">
                                    <AlertCircle className="w-4 h-4" />
                                    <span className="text-[11px] font-semibold">Амралтын эрх {formatVacationUnits(totalSelectedDays - availableDays)} хоногоор хэтэрсэн байна!</span>
                                </div>
                            )}

                            {totalSelectedDays < availableDays && (
                                <div className="flex items-center gap-2 text-indigo-600 bg-indigo-50 p-3 rounded-2xl border border-indigo-100 italic">
                                    <Info className="w-4 h-4" />
                                    <span className="text-[10px] font-semibold">Та нийт {formatVacationUnits(availableDays)} хоногийг бүрэн төлөвлөх ёстой.</span>
                                </div>
                            )}

                            {!splits.some(s => s.days >= 10) && (
                                <div className="flex items-start gap-2 text-amber-600 bg-amber-50 p-3 rounded-2xl border border-amber-100">
                                    <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-semibold uppercase tracking-tight">Хуулийн шаардлага</p>
                                        <p className="text-[9px] leading-relaxed">Аль нэг амралтын хугацаа заавал 10 болон түүнээс дээш хоног байх ёстой.</p>
                                    </div>
                                </div>
                            )}

                            <div className="pt-2 border-t border-slate-50">
                                <p className="text-[8px] text-slate-400 leading-relaxed italic text-justify px-1">
                                    "Хөдөлмөрийн тухай хуулийн 99.8. Ажилтан өөрийн хүсэлтээр ээлжийн амралтыг тухайн ажлын жилдээ багтаан хэсэгчлэн эдэлж болно. Хэсэгчлэн амрах ээлжийн амралтын аль нэг тасралтгүй амралтын үргэлжлэх хугацаа нь ажлын 10 өдрөөс доошгүй байна."
                                </p>
                            </div>
                        </div>
                        {splits.map((s, i) => (
                            <div key={i} className="bg-white rounded-[32px] p-6 shadow-sm border border-slate-100 space-y-6">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className={cn(
                                            "w-10 h-10 rounded-2xl flex items-center justify-center font-semibold text-white shadow-sm",
                                            ['bg-indigo-600', 'bg-emerald-600', 'bg-amber-500', 'bg-rose-600', 'bg-violet-600'][i % 5]
                                        )}>
                                            {i + 1}
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest leading-none mb-1">Амралт {i + 1}</p>
                                            <p className="text-sm font-semibold text-slate-900">
                                                {s.days > 0 ? `${format(new Date(s.start), 'yyyy.MM.dd')} - ${format(new Date(s.end), 'yyyy.MM.dd')}` : 'Хугацаа сонгох...'}
                                            </p>
                                        </div>
                                    </div>
                                    {s.days > 0 && <Badge className="bg-slate-100 text-slate-600 font-semibold rounded-lg">{s.days} хоног</Badge>}
                                </div>

                                <Button
                                    variant="outline"
                                    className={cn(
                                        "w-full h-12 rounded-2xl border-2 font-semibold transition-all",
                                        s.days > 0 ? "border-slate-50 text-slate-400" : "border-indigo-100 text-indigo-600 bg-indigo-50/50"
                                    )}
                                    onClick={() => {
                                        setActiveSplitIndex(i);
                                        setSelectingDate(s.start ? 'end' : 'start');
                                        setPlanningStep('calendar');
                                    }}
                                >
                                    {s.days > 0 ? "Засах" : "Хугацаа сонгох"}
                                </Button>
                            </div>
                        ))}

                        <div className="bg-white rounded-[32px] p-6 shadow-sm border border-slate-100 space-y-4">
                            <h4 className="text-[10px] font-semibold text-slate-400 uppercase tracking-[0.2em] px-2 mb-2">Нэмэлт мэдээлэл</h4>

                            <div className="space-y-1.5 text-left">
                                <Label className="text-[10px] font-semibold uppercase text-slate-400 ml-3">Батлах ажилтан</Label>
                                <Select onValueChange={setSelectedApproverId} value={selectedApproverId}>
                                    <SelectTrigger className="rounded-[20px] h-12 border-slate-100 bg-slate-50">
                                        <SelectValue placeholder="Сонгох..." />
                                    </SelectTrigger>
                                    <SelectContent className="max-h-[300px] border-none shadow-2xl rounded-3xl">
                                        {potentialApprovers.map(emp => (
                                            <SelectItem key={emp.id} value={emp.id} className="py-2.5 rounded-xl m-1">
                                                <div className="flex items-center gap-2">
                                                    <Avatar className="h-7 w-7">
                                                        <AvatarImage src={emp.photoURL} />
                                                        <AvatarFallback className="text-[9px] font-semibold">{emp.firstName[0]}</AvatarFallback>
                                                    </Avatar>
                                                    <span className="font-semibold text-[11px]">{emp.firstName}</span>
                                                </div>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-1.5 text-left">
                                <Label className="text-[10px] font-semibold uppercase text-slate-400 ml-3">Тайлбар</Label>
                                <Input
                                    placeholder="Тайлбар"
                                    value={reason}
                                    onChange={(e) => setReason(e.target.value)}
                                    className="rounded-[20px] h-12 border-slate-100 bg-slate-50 focus:bg-white"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="p-6 bg-white border-t rounded-t-[40px] shadow-[0_-20px_50px_rgba(0,0,0,0.05)]">
                        <div className="flex items-center justify-between mb-6 px-4">
                            <div className="flex flex-col">
                                <span className="text-[10px] font-semibold uppercase text-slate-400">Нийт хоног</span>
                                <span className="text-xl font-semibold text-slate-900">{formatVacationUnits(totalSelectedDays)} хоног</span>
                            </div>
                            {totalSelectedDays > availableDays && (
                                <Badge variant="destructive" className="animate-bounce">Эрх хүрэхгүй!</Badge>
                            )}
                        </div>
                        <Button
                            className="w-full h-16 rounded-[24px] text-lg font-semibold shadow-xl bg-indigo-600 enabled:hover:bg-indigo-700 transition-all active:scale-[0.98] disabled:opacity-20 disabled:grayscale"
                            disabled={
                                isSubmitting ||
                                !isFullyPlanned ||
                                !splits.some(s => s.days >= 10) ||
                                splits.some(s => !s.start || !s.end) ||
                                !selectedApproverId
                            }
                            onClick={handleCreateRequest}
                        >
                            {isSubmitting ? <Loader2 className="animate-spin" /> : "Хүсэлт илгээх"}
                        </Button>
                    </div>
                </div>
            );
        }

        // STEP 3: CALENDAR
        if (planningStep === 'calendar') {
            const currentSplit = splits[activeSplitIndex];
            return (
                <div className="min-h-screen bg-white flex flex-col animate-in slide-in-from-bottom duration-300 overflow-hidden">
                    <div className="bg-white/95 backdrop-blur-md px-6 py-4 flex items-center justify-between border-b sticky top-0 z-50">
                        <div className="flex items-center gap-3">
                            <Button variant="ghost" size="icon" onClick={() => setPlanningStep('overview')} className="rounded-full">
                                <ChevronLeft className="h-6 w-6" />
                            </Button>
                            <div>
                                <h2 className="text-lg font-semibold text-slate-900">{activeSplitIndex + 1}-р амралт</h2>
                                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">
                                    {selectingDate === 'start' ? 'Эхлэх өдөр сонгох' : 'Дуусах өдөр сонгох'}
                                </p>
                            </div>
                        </div>
                        {currentSplit.days > 0 && <Badge className="bg-indigo-100 text-indigo-700 font-semibold rounded-lg">{formatVacationUnits(currentSplit.days)} хоног</Badge>}
                    </div>

                    <div className="flex-1 overflow-y-auto px-4 py-8 space-y-12 bg-white no-scrollbar">
                        {workYear && eachMonthOfInterval({
                            start: workYear.start,
                            end: addYears(workYear.start, 1)
                        }).slice(0, 12).map((monthDate, mIdx) => {
                            const monthStart = startOfMonth(monthDate);
                            const monthEnd = endOfMonth(monthDate);
                            const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
                            const startEmptyDays = (getDay(monthStart) + 6) % 7;

                            return (
                                <div key={mIdx} className="space-y-4">
                                    <div className="flex items-center justify-center gap-4 px-2">
                                        <div className="h-[1px] flex-1 bg-slate-100" />
                                        <h3 className="text-[11px] font-semibold text-slate-400 uppercase tracking-[0.3em]">
                                            {format(monthDate, 'LLLL yyyy', { locale: mn })}
                                        </h3>
                                        <div className="h-[1px] flex-1 bg-slate-100" />
                                    </div>
                                    <div className="grid grid-cols-7 gap-1">
                                        {['Д', 'М', 'Л', 'П', 'Б', 'Б', 'Н'].map((d, i) => (
                                            <div key={`${d}-${i}`} className="text-[10px] font-semibold text-slate-300 text-center pb-2 uppercase">{d}</div>
                                        ))}
                                        {Array.from({ length: startEmptyDays }).map((_, i) => (
                                            <div key={i} className="h-11" />
                                        ))}
                                        {days.map((day, dIdx) => {
                                            const dateStr = format(day, 'yyyy-MM-dd');
                                            const dt = workCalendar ? resolveDayType(day, workCalendar, recurringDayMap) : 'working';
                                            const isSelectable = workCalendar ? isVacationSelectableDayType(dt) : false;
                                            const isHolidayDay = dt === 'public_holiday' || dt === 'company_holiday';
                                            const isHalfDay = dt === 'half_day';
                                            const isSpecialWorking = dt === 'special_working';

                                            const isApproved = myRequests?.some(r => r.status === 'APPROVED' && (isSameDay(new Date(r.startDate), day) || (isAfter(day, new Date(r.startDate)) && isBefore(day, new Date(r.endDate))) || isSameDay(new Date(r.endDate), day)));
                                            const isBeforeEligibility = eligibilityDate ? isBefore(day, startOfDay(eligibilityDate)) : false;

                                            // Show OTHER splits on this calendar too for context
                                            const splitIdx = splits.findIndex(s => s.start === dateStr || (s.start && s.end && (isAfter(day, new Date(s.start)) || isSameDay(day, new Date(s.start))) && (isBefore(day, new Date(s.end)) || isSameDay(day, new Date(s.end)))));

                                            const colors = ['bg-indigo-600', 'bg-emerald-600', 'bg-amber-500', 'bg-rose-600', 'bg-violet-600'];
                                            const lightColors = ['bg-indigo-50/80 text-indigo-700', 'bg-emerald-50/80 text-emerald-700', 'bg-amber-50/80 text-amber-700', 'bg-rose-50/80 text-rose-700', 'bg-violet-50/80 text-violet-700'];

                                            const isStart = splits[splitIdx]?.start === dateStr;
                                            const isEnd = splits[splitIdx]?.end === dateStr;
                                            const isBetween = splitIdx !== -1 && !isStart && !isEnd;
                                            const isCurrentEditing = splitIdx === activeSplitIndex;

                                            return (
                                                <button
                                                    key={dIdx}
                                                    onClick={() => handleSplitDateSelection(day)}
                                                    disabled={!isSelectable || isApproved || isBeforeEligibility}
                                                    className={cn(
                                                        "relative h-11 w-full flex items-center justify-center text-[13px] font-semibold transition-all",
                                                        !isSelectable || isBeforeEligibility ? "text-slate-200 cursor-not-allowed" : "text-slate-700 hover:bg-slate-50 rounded-xl",
                                                        isBeforeEligibility && "opacity-40",
                                                        isApproved && "text-slate-200 line-through",
                                                        isToday(day) && !splitIdx && "ring-1 ring-slate-900 rounded-xl",
                                                        splitIdx !== -1 && !isBetween && cn(colors[splitIdx % colors.length], "text-white rounded-xl shadow-md z-10", !isCurrentEditing && "opacity-40"),
                                                        isBetween && cn(lightColors[splitIdx % lightColors.length], "rounded-none z-0", !isCurrentEditing && "opacity-20")
                                                    )}
                                                >
                                                    {format(day, 'd')}
                                                    {isHolidayDay && <span className="absolute bottom-1 w-1 h-1 bg-rose-400 rounded-full" />}
                                                    {isSpecialWorking && <span className="absolute bottom-1 w-1 h-1 bg-blue-400 rounded-full" />}
                                                    {isHalfDay && <span className="absolute bottom-1 w-1 h-1 bg-amber-400 rounded-full" />}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <div className="p-6 bg-white border-t space-y-4">
                        <Button
                            className="w-full h-16 rounded-3xl text-lg font-semibold bg-indigo-600 shadow-xl"
                            disabled={!currentSplit.start || !currentSplit.end}
                            onClick={() => setPlanningStep('overview')}
                        >
                            Хадгалах
                        </Button>
                    </div>
                </div>
            );
        }

        return null;
    })();

    const dashboardView = (
        <div className="min-h-screen bg-slate-50 pb-24 overflow-x-hidden">
            {/* Header */}
            <div className="bg-white/80 backdrop-blur-md px-6 py-4 border-b flex items-center justify-between sticky top-0 z-50 h-16 shadow-sm">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full">
                        <ChevronLeft className="h-6 w-6" />
                    </Button>
                    <h1 className="text-xl font-semibold tracking-tight text-slate-900">Ээлжийн амралт</h1>
                </div>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <div className="bg-white px-6 pt-3 border-b sticky top-16 z-40">
                    <TabsList className="w-full bg-slate-100/80 p-1 rounded-2xl h-12">
                        <TabsTrigger value="my-vacation" className="flex-1 rounded-xl text-[11px] font-semibold uppercase">Миний амралт</TabsTrigger>
                        {isAuthorizedApprover && (
                            <TabsTrigger value="to-approve" className="flex-1 rounded-xl text-[11px] font-semibold uppercase relative">
                                Батлах
                                {incomingRequests.length > 0 && (
                                    <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[10px] w-5 h-5 flex items-center justify-center rounded-full border-2 border-white shadow-sm font-semibold">
                                        {incomingRequests.length}
                                    </span>
                                )}
                            </TabsTrigger>
                        )}
                        {isAuthorizedApprover && (
                            <TabsTrigger value="history" className="flex-1 rounded-xl text-[11px] font-semibold uppercase">
                                Түүх
                            </TabsTrigger>
                        )}
                    </TabsList>
                </div>

                {/* 1. MY VACATION TAB */}
                <TabsContent value="my-vacation" className="p-6 space-y-6 animate-in slide-in-from-bottom-5 fade-in duration-500 outline-none">
                    <Card className="bg-gradient-to-br from-indigo-700 via-blue-600 to-sky-500 text-white border-none shadow-2xl overflow-hidden relative">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
                        <CardContent className="p-6 pt-8 relative z-10">
                            <div className="flex items-center justify-between mb-8">
                                <div className="flex items-center gap-2 opacity-90">
                                    <CalendarDays className="w-4 h-4" />
                                    <span className="text-[10px] font-semibold uppercase tracking-widest text-indigo-100">Амралтын эрх ({workYear?.yearNumber}-р жил)</span>
                                </div>
                                <Palmtree className="w-10 h-10 opacity-20" />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <div className="text-5xl font-semibold mb-1 leading-none">{totalEntitled}</div>
                                    <div className="text-[10px] uppercase font-semibold opacity-70 tracking-tight">Нийт амрах эрх</div>
                                </div>
                                <div className="border-l border-white/20 pl-6">
                                    <div className="text-5xl font-semibold mb-1 text-sky-200 leading-none">{totalEntitled - usedDays}</div>
                                    <div className="text-[10px] uppercase font-semibold opacity-70 tracking-tight">Үлдэгдэл хоног</div>
                                </div>
                            </div>

                            <div className="mt-8 pt-4 border-t border-white/10 flex justify-between items-center text-[10px] font-mono opacity-60">
                                <span>{workYear ? format(workYear.start, 'yyyy.MM.dd') : '...'} - {workYear ? format(workYear.end, 'yyyy.MM.dd') : '...'}</span>
                            </div>
                        </CardContent>
                    </Card>

                    {pendingDays > 0 || usedDays > 0 ? (
                        <Alert className={cn(
                            "rounded-[24px] p-5 border-none shadow-sm",
                            pendingDays > 0 ? "bg-amber-50" : "bg-indigo-50"
                        )}>
                            {pendingDays > 0 ? <Clock className="h-5 w-5 text-amber-600" /> : <CalendarCheck className="h-5 w-5 text-indigo-600" />}
                            <AlertTitle className={cn(
                                "font-semibold mb-1",
                                pendingDays > 0 ? "text-amber-800" : "text-indigo-800"
                            )}>
                                {pendingDays > 0 ? "Хүсэлт хүлээгдэж байна" : "Төлөвлөгөө батлагдсан"}
                            </AlertTitle>
                            <AlertDescription className={cn(
                                "text-xs font-medium leading-relaxed",
                                pendingDays > 0 ? "text-amber-700" : "text-indigo-700"
                            )}>
                                {pendingDays > 0
                                    ? "Таны амралтын төлөвлөгөө хянагдаж байна. Батлагдсаны дараа эсвэл цуцалсны дараа дахин төлөвлөх боломжтой."
                                    : "Таны энэ жилийн амралтын хуваарь нэгэнт батлагдсан тул дахин шинээр төлөвлөх боломжгүй."}
                            </AlertDescription>
                        </Alert>
                    ) : (
                        <Button
                            className="w-full h-16 rounded-[24px] text-lg font-semibold shadow-xl bg-slate-900 border-none group relative overflow-hidden"
                            onClick={handlePlanVacation}
                        >
                            <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/20 to-sky-500/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                            <CalendarDays className="mr-3 h-6 w-6 text-sky-400" />
                            Амралт төлөвлөх
                        </Button>
                    )}

                    <div className="space-y-4">
                        <h2 className="text-[12px] font-semibold uppercase text-slate-400 tracking-widest flex items-center gap-2">
                            <Clock className="w-4 h-4" />
                            Миний түүх
                        </h2>
                        <div className="space-y-3">
                            {isMyRequestsLoading ? (
                                [1, 2].map(i => <Skeleton key={i} className="h-28 w-full rounded-2xl bg-white" />)
                            ) : !myRequests || myRequests.length === 0 ? (
                                <div className="text-center py-12 bg-white rounded-3xl border border-dashed border-slate-200">
                                    <Calendar className="w-12 h-12 text-slate-100 mx-auto mb-3" />
                                    <p className="text-sm text-slate-400 font-semibold">Хүсэлт байхгүй</p>
                                </div>
                            ) : (
                                myRequests.map(req => (
                                    <Card key={req.id} className="rounded-2xl border-none shadow-sm hover:shadow-md transition-all overflow-hidden">
                                        <CardContent className="p-4">
                                            <div className="flex justify-between items-start mb-4">
                                                <div className="space-y-1">
                                                    <div className="text-base font-semibold text-slate-900 leading-tight">
                                                        {req.splits && req.splits.length > 1
                                                            ? `${req.splits.length} хэсэгт хуваасан`
                                                            : `${format(parseISO(req.startDate), 'MMM dd', { locale: mn })} - ${format(parseISO(req.endDate), 'MMM dd', { locale: mn })}`
                                                        }
                                                    </div>
                                                    <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-tight">
                                                        Илгээсэн: {format(parseISO(req.requestDate), 'yyyy.MM.dd')}
                                                    </div>
                                                </div>
                                                {getStatusBadge(req.status)}
                                            </div>

                                            {/* Splits List Box */}
                                            {req.splits && req.splits.length > 1 && (
                                                <div className="mb-4 bg-slate-50/50 rounded-2xl p-3 border border-slate-100 space-y-2">
                                                    {req.splits.map((split, sIdx) => (
                                                        <div key={sIdx} className="flex justify-between items-center text-xs">
                                                            <div className="flex items-center gap-2">
                                                                <div className={cn(
                                                                    "w-4 h-4 rounded-md flex items-center justify-center text-[8px] font-semibold text-white",
                                                                    ['bg-indigo-400', 'bg-emerald-400', 'bg-amber-400', 'bg-rose-400', 'bg-violet-400'][sIdx % 5]
                                                                )}>
                                                                    {sIdx + 1}
                                                                </div>
                                                                <span className="text-slate-600 font-medium">
                                                                    {format(parseISO(split.start), 'MMM dd', { locale: mn })} - {format(parseISO(split.end), 'MMM dd', { locale: mn })}
                                                                </span>
                                                            </div>
                                                            <span className="font-semibold text-slate-400">{split.days} хоног</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            {req.status === 'REJECTED' && req.rejectionReason && (
                                                <div className="mb-4 p-3 bg-rose-50 rounded-xl border border-rose-100">
                                                    <p className="text-[10px] uppercase font-semibold text-rose-400 mb-1">Татгалзсан шалтгаан:</p>
                                                    <p className="text-xs text-rose-700 font-medium italic">"{req.rejectionReason}"</p>
                                                </div>
                                            )}

                                            <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                                                <div className="flex items-center gap-2">
                                                    <Badge variant="secondary" className="text-[10px] bg-indigo-50 text-indigo-600 border-none font-semibold px-3">
                                                        {req.totalDays} хоног
                                                    </Badge>
                                                    {/* Cancel-only: no editing after submission */}
                                                    {req.status === 'PENDING' && (
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            className="h-7 px-3 text-[10px] font-semibold uppercase text-rose-600 border-rose-200 hover:bg-rose-50 rounded-lg"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setRequestToCancel(req);
                                                                setIsCancelDialogOpen(true);
                                                            }}
                                                        >
                                                            Цуцлах
                                                        </Button>
                                                    )}
                                                </div>
                                                {req.approverId && (
                                                    <div className="flex items-center gap-2">
                                                        <Avatar className="h-6 w-6">
                                                            <AvatarImage src={employeeMap.get(req.approverId)?.photoURL} />
                                                            <AvatarFallback className="text-[8px]">{employeeMap.get(req.approverId)?.firstName?.[0]}</AvatarFallback>
                                                        </Avatar>
                                                        <span className="text-xs font-semibold text-slate-700">{(employeeMap.get(req.approverId)?.firstName) || "..."}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))
                            )}
                        </div>
                    </div>
                </TabsContent>

                {/* Cancel confirmation dialog */}
                <Dialog
                    open={isCancelDialogOpen}
                    onOpenChange={(o) => {
                        if (!o) {
                            setIsCancelDialogOpen(false);
                            setRequestToCancel(null);
                        }
                    }}
                >
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Хүсэлт цуцлах уу?</DialogTitle>
                            <DialogDescription>
                                Энэ үйлдлийг хийснээр хүсэлт <span className="font-semibold">Цуцлагдсан</span> төлөвт орно.
                            </DialogDescription>
                        </DialogHeader>
                        <DialogFooter>
                            <Button
                                variant="outline"
                                onClick={() => {
                                    setIsCancelDialogOpen(false);
                                    setRequestToCancel(null);
                                }}
                                disabled={isSubmitting}
                            >
                                Болих
                            </Button>
                            <Button variant="destructive" onClick={handleCancelRequest} disabled={isSubmitting}>
                                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Цуцлах'}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* 2. TO APPROVE TAB */}
                <TabsContent value="to-approve" className="p-6 space-y-6 animate-in slide-in-from-right-10 fade-in duration-500 outline-none">
                    <div className="flex items-center justify-between">
                        <h2 className="text-[12px] font-semibold uppercase text-slate-400 tracking-widest flex items-center gap-2">
                            <ListFilter className="w-4 h-4 text-indigo-500" />
                            Шийдвэрлэх
                        </h2>
                    </div>

                    <div className="space-y-4">
                        {(isAssignedLoading || isPositionLoading || isProfileLoading) && (
                            [1, 2].map(i => <Skeleton key={i} className="h-40 w-full rounded-[28px] bg-white" />)
                        ) || (incomingRequests.length === 0 ? (
                            <div className="text-center py-20 bg-white rounded-3xl shadow-sm border border-slate-100 flex flex-col items-center">
                                <CheckCircle2 className="w-12 h-12 text-green-200 mb-4" />
                                <p className="text-slate-500 font-semibold">Бүх хүсэлтийг шийдвэрлэсэн!</p>
                            </div>
                        ) : (
                            incomingRequests.map(req => {
                                const sender = employeeMap.get(req.employeeId);
                                const isProcessing = processingIds.has(req.id);

                                return (
                                    <Card key={req.id} className={cn(
                                        "rounded-3xl border-none shadow-sm hover:shadow-md transition-all overflow-hidden",
                                        isProcessing && "scale-95 opacity-50 grayscale"
                                    )}>
                                        <CardContent className="p-5">
                                            {/* Header with status and main info */}
                                            <div className="flex justify-between items-start mb-4">
                                                <div className="space-y-1">
                                                    <div className="text-base font-semibold text-slate-900 leading-tight">
                                                        {req.splits && req.splits.length > 1
                                                            ? `${req.splits.length} хэсэгт хуваасан`
                                                            : `${format(parseISO(req.startDate), 'MMM dd', { locale: mn })} - ${format(parseISO(req.endDate), 'MMM dd', { locale: mn })}`
                                                        }
                                                    </div>
                                                    <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-tight">
                                                        Илгээсэн: {format(parseISO(req.requestDate), 'yyyy.MM.dd')}
                                                    </div>
                                                </div>
                                                {getStatusBadge(req.status)}
                                            </div>

                                            {/* Splits List Box */}
                                            {req.splits && req.splits.length > 1 && (
                                                <div className="mb-4 bg-slate-50/50 rounded-2xl p-3 border border-slate-100 space-y-2">
                                                    {req.splits.map((split, sIdx) => (
                                                        <div key={sIdx} className="flex justify-between items-center text-xs">
                                                            <div className="flex items-center gap-2">
                                                                <div className={cn(
                                                                    "w-4 h-4 rounded-md flex items-center justify-center text-[8px] font-semibold text-white",
                                                                    ['bg-indigo-400', 'bg-emerald-400', 'bg-amber-400', 'bg-rose-400', 'bg-violet-400'][sIdx % 5]
                                                                )}>
                                                                    {sIdx + 1}
                                                                </div>
                                                                <span className="text-slate-600 font-medium">
                                                                    {format(parseISO(split.start), 'MMM dd', { locale: mn })} - {format(parseISO(split.end), 'MMM dd', { locale: mn })}
                                                                </span>
                                                            </div>
                                                            <span className="font-semibold text-slate-400">{split.days} хоног</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            {/* Reason Box */}
                                            {req.reason && (
                                                <div className="mb-4 p-3 bg-slate-50/50 rounded-xl border border-slate-100 italic">
                                                    <p className="text-xs text-slate-500 font-medium">"{req.reason}"</p>
                                                </div>
                                            )}

                                            {/* Footer with summary and employee */}
                                            <div className="flex items-center justify-between py-4 border-t border-slate-50 mb-4">
                                                <Badge variant="secondary" className="text-[10px] bg-indigo-50 text-indigo-600 border-none font-semibold px-3">
                                                    {req.totalDays} хоног
                                                </Badge>
                                                <div className="flex items-center gap-2">
                                                    <Avatar className="h-7 w-7 ring-2 ring-slate-100">
                                                        <AvatarImage src={sender?.photoURL} />
                                                        <AvatarFallback className="text-[9px] font-semibold">{sender?.firstName?.[0]}</AvatarFallback>
                                                    </Avatar>
                                                    <div className="flex flex-col text-right">
                                                        <span className="text-xs font-semibold text-slate-900 leading-none">{sender?.firstName}</span>
                                                        <span className="text-[9px] text-slate-400 font-semibold uppercase tracking-tighter mt-0.5">{sender?.jobTitle}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Action Buttons */}
                                            <div className="flex gap-2">
                                                <Button
                                                    className="flex-[2] h-12 rounded-2xl bg-slate-900 font-semibold shadow-lg shadow-slate-200 active:scale-95 transition-all"
                                                    onClick={() => handleStatusUpdate(req, 'APPROVED')}
                                                    disabled={isProcessing}
                                                >
                                                    {isProcessing ? <Loader2 className="animate-spin w-4 h-4" /> : <><ThumbsUp className="w-4 h-4 mr-2" /> Батлах</>}
                                                </Button>
                                                <Button
                                                    variant="secondary"
                                                    className="flex-1 h-12 rounded-2xl text-rose-600 bg-rose-50 hover:bg-rose-100 border-none font-semibold active:scale-95 transition-all"
                                                    onClick={() => {
                                                        setRequestToReject(req);
                                                        setIsRejectionDialogOpen(true);
                                                    }}
                                                    disabled={isProcessing}
                                                >
                                                    {isProcessing ? null : <ThumbsDown className="w-4 h-4" />}
                                                </Button>
                                            </div>
                                        </CardContent>
                                    </Card>
                                );
                            })
                        ))}
                    </div>
                </TabsContent>

                {/* 3. HISTORY TAB */}
                <TabsContent value="history" className="p-6 space-y-6 animate-in slide-in-from-right-10 fade-in duration-500 outline-none">
                    <div className="flex items-center justify-between">
                        <h2 className="text-[12px] font-semibold uppercase text-slate-400 tracking-widest flex items-center gap-2">
                            <History className="w-4 h-4 text-slate-400" />
                            Шийдвэрлэсэн түүх
                        </h2>
                    </div>

                    <div className="space-y-4">
                        {(isAssignedLoading || isPositionLoading || isProfileLoading) ? (
                            [1, 2, 3].map(i => <Skeleton key={i} className="h-32 w-full rounded-2xl bg-white" />)
                        ) : myHistory.length === 0 ? (
                            <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-slate-200">
                                <History className="w-12 h-12 text-slate-100 mx-auto mb-3" />
                                <p className="text-slate-400 font-semibold">Түүх олдсонгүй</p>
                            </div>
                        ) : (
                            myHistory.map(req => {
                                const sender = employeeMap.get(req.employeeId);
                                const isProcessing = processingIds.has(req.id);

                                return (
                                    <Card key={req.id} className="rounded-2xl border-none shadow-sm bg-white/80">
                                        <CardContent className="p-4">
                                            <div className="flex items-center justify-between mb-4">
                                                <div className="flex items-center gap-2">
                                                    <Avatar className="h-8 w-8">
                                                        <AvatarImage src={sender?.photoURL} />
                                                        <AvatarFallback className="bg-slate-200 text-slate-700">{sender?.firstName?.[0]}</AvatarFallback>
                                                    </Avatar>
                                                    <div className="flex flex-col">
                                                        <span className="text-xs font-semibold text-slate-900 leading-none mb-1">{sender?.firstName} {sender?.lastName}</span>
                                                        <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-tighter leading-none">
                                                            {format(parseISO(req.startDate), 'MMM dd')} - {format(parseISO(req.endDate), 'MMM dd')}
                                                        </span>
                                                    </div>
                                                </div>
                                                {getStatusBadge(req.status)}
                                            </div>

                                            <div className="flex items-center justify-between pt-3 border-t border-slate-50">
                                                <span className="text-[10px] font-semibold text-slate-400 uppercase">
                                                    {req.totalDays} хоног
                                                </span>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-8 rounded-lg text-xs font-semibold text-slate-400 hover:text-indigo-600 hover:bg-slate-50"
                                                    onClick={() => handleStatusUpdate(req, 'PENDING')}
                                                    disabled={isProcessing}
                                                >
                                                    {isProcessing ? <Loader2 className="animate-spin w-3 h-3" /> : <><RotateCcw className="w-3 h-3 mr-1" /> Буцаах</>}
                                                </Button>
                                            </div>
                                        </CardContent>
                                    </Card>
                                );
                            })
                        )}
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );

    return (
        <div className="min-h-screen bg-slate-50 flex justify-center overflow-x-hidden">
            <div className="w-full max-w-md bg-white min-h-screen shadow-2xl relative">
                {isPlanning ? planningView : dashboardView}

                {/* Rejection Reason Dialog */}
                <Dialog open={isRejectionDialogOpen} onOpenChange={setIsRejectionDialogOpen}>
                    <DialogContent className="max-w-[calc(400px-2rem)] rounded-3xl p-6 border-none shadow-2xl mx-auto">
                        <DialogHeader>
                            <DialogTitle className="text-xl font-semibold text-slate-900">Татгалзах шалтгаан</DialogTitle>
                            <DialogDescription>Ажилтанд очих тайлбарыг бичнэ үү.</DialogDescription>
                        </DialogHeader>
                        <div className="py-4">
                            <Textarea
                                placeholder="Тухайн хугацаанд төсөл дуусах шатандаа байгаа тул боломжгүй..."
                                className="rounded-2xl min-h-[120px] bg-slate-50 border-slate-100 focus:bg-white transition-all"
                                value={managerRejectionReason}
                                onChange={(e) => setManagerRejectionReason(e.target.value)}
                            />
                        </div>
                        <DialogFooter>
                            <Button
                                className="w-full h-12 rounded-xl font-semibold bg-rose-600 hover:bg-rose-700 text-white"
                                disabled={!managerRejectionReason.trim()}
                                onClick={() => {
                                    if (requestToReject) {
                                        handleStatusUpdate(requestToReject, 'REJECTED', managerRejectionReason);
                                        setIsRejectionDialogOpen(false);
                                        setManagerRejectionReason('');
                                        setRequestToReject(null);
                                    }
                                }}
                            >
                                Татгалзах
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </div>
    );
}
