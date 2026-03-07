'use client';

import React, { useEffect, useRef, useState, useMemo } from 'react';
import { PageHeader } from '@/components/patterns/page-layout';
import {
    useFirebase,
    useDoc,
    useMemoFirebase,
    useCollection,
    updateDocumentNonBlocking,
    deleteDocumentNonBlocking,
    tenantCollection,
    tenantDoc,
    useTenantWrite
} from '@/firebase';
import { doc, collection, arrayUnion, query, where } from 'firebase/firestore';
import { Position, PositionLevel, JobCategory, EmploymentType, WorkSchedule, Department, ApprovalLog } from '../../types';
import { ERDocument } from '../../../employment-relations/types';
import { isActiveStatus } from '@/types';
import { Badge } from '@/components/ui/badge';
import {
    Stamp,
    XCircle,
    CheckCircle2,
    Calendar as CalendarIcon,
    FileText,
    Download,
    History as HistoryIcon,
    Clock,
    User,
    UserPlus,
    UserMinus,
    UserX,
    Loader2,
    Briefcase,
    Building2,
    MoreVertical,
    Trash2,
    ExternalLink
} from 'lucide-react';
import { writeBatch, increment as firestoreIncrement, getDocs } from 'firebase/firestore';
import { AppointEmployeeDialog } from '../../[departmentId]/components/flow/appoint-employee-dialog';
import { ReleaseEmployeeDialog } from '../../[departmentId]/components/flow/release-employee-dialog';
import { format } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useParams, useRouter } from 'next/navigation';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { VerticalTabMenu } from '@/components/ui/vertical-tab-menu';
import { PositionStructureCard } from '@/components/organization/position-structure-card';
import { useToast } from '@/hooks/use-toast';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { mn } from 'date-fns/locale';
import { PositionOverview } from './components/position-overview';
import { PositionCompetency } from './components/position-competency';
import { PositionCompensation } from './components/position-compensation';
import { PositionBenefits } from './components/position-benefits';
import { StartPositionPreparationWizardDialog } from './components/start-position-preparation-wizard-dialog';
import type { Project, Task } from '@/types/project';

export default function PositionDetailPage() {
    const params = useParams<{ positionId?: string | string[] }>();
    const positionId = Array.isArray(params?.positionId) ? params.positionId[0] : params?.positionId;
    const { firestore, user } = useFirebase();
    const { tDoc, tCollection } = useTenantWrite();
    const router = useRouter();
    const { toast } = useToast();

    // States
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
    const [isApproveConfirmOpen, setIsApproveConfirmOpen] = useState(false);
    const [isDisapproveConfirmOpen, setIsDisapproveConfirmOpen] = useState(false);
    const [isApproving, setIsApproving] = useState(false);
    const [approvalDate, setApprovalDate] = useState<Date>(new Date());
    const [approvalNote, setApprovalNote] = useState('');
    const [disapproveDate, setDisapproveDate] = useState<Date>(new Date());
    const [disapproveNote, setDisapproveNote] = useState('');
    const [isAppointDialogOpen, setIsAppointDialogOpen] = useState(false);
    const [isCancelAppointmentConfirmOpen, setIsCancelAppointmentConfirmOpen] = useState(false);
    const [isConfirmAppointmentConfirmOpen, setIsConfirmAppointmentConfirmOpen] = useState(false);
    const [isActionLoading, setIsActionLoading] = useState(false);
    const [isDocStatusOpen, setIsDocStatusOpen] = useState(false);
    const [isReleaseDialogOpen, setIsReleaseDialogOpen] = useState(false);
    const [isPrepWizardOpen, setIsPrepWizardOpen] = useState(false);

    // Data Fetching
    const positionRef = useMemoFirebase(({ firestore, companyPath }) => (firestore && positionId ? tenantDoc(firestore, companyPath, 'positions', positionId) : null), [firestore, positionId]);
    const { data: position, isLoading: isPositionLoading } = useDoc<Position>(positionRef as any);

    const deptRef = useMemoFirebase(({ firestore, companyPath }) => (firestore && position?.departmentId ? tenantDoc(firestore, companyPath, 'departments', position.departmentId) : null), [firestore, position?.departmentId]);
    const { data: department } = useDoc<Department>(deptRef as any);

    // Lookups
    const levelsQuery = useMemoFirebase(({ firestore, companyPath }) => (firestore ? tenantCollection(firestore, companyPath, 'positionLevels') : null), [firestore]);
    const categoriesQuery = useMemoFirebase(({ firestore, companyPath }) => (firestore ? tenantCollection(firestore, companyPath, 'jobCategories') : null), [firestore]);
    const empTypesQuery = useMemoFirebase(({ firestore, companyPath }) => (firestore ? tenantCollection(firestore, companyPath, 'employmentTypes') : null), [firestore]);
    const schedulesQuery = useMemoFirebase(({ firestore, companyPath }) => (firestore ? tenantCollection(firestore, companyPath, 'workSchedules') : null), [firestore]);
    const allDeptsQuery = useMemoFirebase(({ firestore, companyPath }) => (firestore ? tenantCollection(firestore, companyPath, 'departments') : null), [firestore]);
    const allPositionsQuery = useMemoFirebase(({ firestore, companyPath }) => (firestore ? tenantCollection(firestore, companyPath, 'positions') : null), [firestore]);

    const { data: levels } = useCollection<PositionLevel>(levelsQuery);
    const { data: categories } = useCollection<JobCategory>(categoriesQuery);
    const { data: empTypes } = useCollection<EmploymentType>(empTypesQuery);
    const { data: schedules } = useCollection<WorkSchedule>(schedulesQuery);
    const { data: allDepartments } = useCollection<any>(allDeptsQuery);
    const { data: allPositions } = useCollection<Position>(allPositionsQuery);

    // Fetch assigned employee
    const employeeQuery = useMemoFirebase(
        ({ firestore, companyPath }) => (firestore
            ? query(
                tenantCollection(firestore, companyPath, 'employees'),
                where('positionId', '==', positionId),
                where('status', 'in', ['active', 'active_probation', 'active_permanent', 'appointing'])
            )
            : null),
        [firestore, positionId]
    );
    const { data: employees } = useCollection<any>(employeeQuery as any);
    const assignedEmployee = employees?.[0];

    // Fetch Appointment Document if "Appointing"
    const docQuery = useMemoFirebase(({ firestore, companyPath }) => {
        if (!firestore || !assignedEmployee || assignedEmployee.status !== 'appointing') return null;
        return query(
            tenantCollection(firestore, companyPath, 'er_documents'),
            where('employeeId', '==', assignedEmployee.id),
            where('positionId', '==', positionId)
        );
    }, [firestore, assignedEmployee, positionId]);
    const { data: appointmentDocs } = useCollection<ERDocument>(docQuery);
    const appointmentDoc = appointmentDocs?.[0];

    // Position preparation projects (before appointment)
    const prepProjectsQuery = useMemoFirebase(({ firestore, companyPath }) => {
        if (!firestore || !positionId) return null;
        return query(
            tenantCollection(firestore, companyPath, 'projects'),
            where('type', '==', 'position_preparation'),
            where('positionPreparationPositionId', '==', positionId)
        );
    }, [firestore, positionId]);
    const { data: prepProjects } = useCollection<Project>(prepProjectsQuery as any);
    const [prepTaskSummary, setPrepTaskSummary] = useState<{ total: number; done: number; projectId: string | null } | null>(null);

    useEffect(() => {
        let cancelled = false;
        const run = async () => {
            if (!firestore) return;
            if (!prepProjects || prepProjects.length === 0) {
                if (!cancelled) setPrepTaskSummary(null);
                return;
            }
            const sorted = [...prepProjects].sort((a, b) => (a.stageOrder || 0) - (b.stageOrder || 0));
            let total = 0;
            let done = 0;
            const p = sorted[0];
            const tasksSnap = await getDocs(tCollection('projects', p.id, 'tasks'));
            tasksSnap.forEach((d) => {
                const t = d.data() as Task;
                total += 1;
                if (t.status === 'DONE') done += 1;
            });
            if (!cancelled) {
                setPrepTaskSummary({ total, done, projectId: p?.id || null });
            }
        };
        run();
        return () => { cancelled = true; };
    }, [firestore, prepProjects]);

    const prepProgressPct = useMemo(() => {
        if (!prepTaskSummary || prepTaskSummary.total === 0) return 0;
        return Math.round((prepTaskSummary.done / prepTaskSummary.total) * 100);
    }, [prepTaskSummary]);

    const isPrepCompleted = useMemo(() => {
        if (!prepProjects || prepProjects.length === 0) return false;
        const allProjectsCompleted = prepProjects.every((p) => p.status === 'COMPLETED');
        if (allProjectsCompleted) return true;
        if (!prepTaskSummary) return false;
        return prepTaskSummary.total === 0 ? true : prepTaskSummary.done === prepTaskSummary.total;
    }, [prepProjects, prepTaskSummary]);

    // Auto-confirm appointment when ER doc is approved/signed
    // Sets employee to 'Идэвхтэй' (Active) status
    const didAutoConfirmRef = useRef(false);
    useEffect(() => {
        if (!firestore || !assignedEmployee) return;
        if (didAutoConfirmRef.current) return;
        // Only run if employee is still in pending status
        if (assignedEmployee.status !== 'appointing') return;
        if (!appointmentDoc || !['APPROVED', 'SIGNED'].includes(appointmentDoc.status)) return;

        didAutoConfirmRef.current = true;
        setIsActionLoading(true);
        (async () => {
            try {
                const aId = appointmentDoc?.metadata?.actionId || '';
                const autoStatus =
                    aId === 'appointment_probation' ? 'active_probation' :
                    aId === 'appointment_permanent' ? 'active_permanent' :
                    'active_permanent';
                await writeBatch(firestore)
                    .update(tDoc('employees', assignedEmployee.id), { 
                        status: autoStatus,
                        lifecycleStage: 'active'
                    })
                    .commit();
                toast({ title: "Томилгоо баталгаажлаа" });
            } catch (e) {
                console.error(e);
                didAutoConfirmRef.current = false;
                toast({ variant: 'destructive', title: 'Алдаа', description: 'Томилгоог автоматаар баталгаажуулахад алдаа гарлаа.' });
            } finally {
                setIsActionLoading(false);
            }
        })();
    }, [firestore, assignedEmployee, appointmentDoc, toast]);

    const validationChecklist = useMemo(() => {
        if (!position) return { hasBasicInfo: false, hasReporting: false, hasAttributes: false, hasSettings: false, isComplete: false };
        const checks = {
            hasBasicInfo: !!position.title?.trim() && !!position.code?.trim(),
            hasReporting: !!position.departmentId && !!position.reportsToId,
            hasAttributes: !!position.levelId && !!position.jobCategoryId && !!position.employmentTypeId && !!position.workScheduleId && !!position.workingCondition,
            hasSettings: !!position.budget?.yearlyBudget && position.budget.yearlyBudget > 0,
        };
        return { ...checks, isComplete: Object.values(checks).every(Boolean) };
    }, [position]);

    /**
     * Completion % for PositionStructureCard (equal weights).
     * When a position is already approved, some fields become locked (non-editable).
     * If a locked field is empty, we exclude it from the denominator so the remaining
     * fields keep equal weight (prevents "stuck incomplete" states).
     */
    const completionPercentage = useMemo(() => {
        if (!position) return 0;

        const activeSalaryStepValue = (() => {
            const steps = position.salarySteps?.items;
            const idx = position.salarySteps?.activeIndex ?? 0;
            const v = Array.isArray(steps) ? steps[idx]?.value : undefined;
            return typeof v === 'number' ? v : 0;
        })();

        const hasSalary =
            (typeof position.compensation?.salaryRange?.mid === 'number' && position.compensation.salaryRange.mid > 0) ||
            activeSalaryStepValue > 0 ||
            (typeof position.salaryRange?.min === 'number' && position.salaryRange.min > 0) ||
            (typeof position.salaryRange?.max === 'number' && position.salaryRange.max > 0);

        const hasAllowances = (position.allowances?.length || 0) > 0;
        const hasIncentives = (position.incentives?.length || 0) > 0;

        const criteria = [
            { key: 'hasBasicInfo', filled: validationChecklist.hasBasicInfo, lockedWhenApproved: false },
            { key: 'hasReporting', filled: validationChecklist.hasReporting, lockedWhenApproved: false },
            { key: 'hasAttributes', filled: validationChecklist.hasAttributes, lockedWhenApproved: false },
            { key: 'hasSettings', filled: validationChecklist.hasSettings, lockedWhenApproved: false },
            // These sections are locked after approval in the UI
            { key: 'hasSalary', filled: hasSalary, lockedWhenApproved: true },
            { key: 'hasAllowances', filled: hasAllowances, lockedWhenApproved: true },
            { key: 'hasIncentives', filled: hasIncentives, lockedWhenApproved: true },
        ] as const;

        const included = criteria.filter((c) => {
            if (!position.isApproved) return true;
            // If approved and the field is locked + empty, exclude from denominator (re-balance)
            if (c.lockedWhenApproved && !c.filled) return false;
            return true;
        });

        if (included.length === 0) return 0;
        const filledCount = included.filter((c) => c.filled).length;
        return Math.round((filledCount / included.length) * 100);
    }, [position, validationChecklist]);

    if (!positionId) return <div className="p-10 text-center text-muted-foreground">Ажлын байр олдсонгүй</div>;
    if (isPositionLoading) return (
        <div className="p-8 space-y-4">
            <Skeleton className="h-12 w-64" />
            <Skeleton className="h-32 w-full rounded-xl" />
            <Skeleton className="h-96 w-full rounded-xl" />
        </div>
    );
    if (!position) return <div className="p-10 text-center text-muted-foreground">Ажлын байр олдсонгүй</div>;

    const history = [...(position.approvalHistory || [])].sort((a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    // Actions
    const handleDisapprove = async () => {
        if (!firestore || !user) return;
        setIsApproving(true);
        const logEntry: ApprovalLog = {
            action: 'disapprove',
            userId: user.uid,
            userName: user.displayName || user.email || 'Систем',
            timestamp: disapproveDate.toISOString(),
            note: disapproveNote || 'Батламжийг цуцаллаа'
        };
        try {
            await updateDocumentNonBlocking(tDoc('positions', positionId), {
                isApproved: false,
                isActive: false, // Цуцлах үед идэвхгүй болгоно
                disapprovedAt: disapproveDate.toISOString(),
                disapprovedBy: user.uid,
                approvalHistory: arrayUnion(logEntry)
            });
            toast({ title: "Батламж цуцлагдлаа" });
            setIsDisapproveConfirmOpen(false);
            setDisapproveNote('');
        } catch { toast({ variant: 'destructive', title: 'Алдаа' }) }
        finally { setIsApproving(false); }
    };

    const handleDelete = async () => {
        if (!firestore) return;
        try {
            await deleteDocumentNonBlocking(tDoc('positions', positionId));
            toast({ title: "Устгагдлаа" });
            router.push(`/dashboard/organization/${position.departmentId}`);
        } catch { toast({ variant: 'destructive', title: 'Алдаа' }) }
    };

    const runApproval = async () => {
        if (!firestore || !user) return;
        setIsApproving(true);
        const logEntry: ApprovalLog = {
            action: 'approve',
            userId: user.uid,
            userName: user.displayName || user.email || 'Систем',
            timestamp: approvalDate.toISOString(),
            note: approvalNote || 'Ажлын байрыг баталлаа'
        };
        try {
            await updateDocumentNonBlocking(tDoc('positions', positionId), {
                isApproved: true,
                isActive: true, // Батлах үед идэвхтэй болгоно
                approvedAt: approvalDate.toISOString(),
                approvedBy: user.uid,
                approvalHistory: arrayUnion(logEntry)
            });
            toast({ title: "Батлагдлаа" });
            setIsApproveConfirmOpen(false);
            setApprovalNote('');
        } catch { toast({ variant: 'destructive', title: 'Алдаа' }) }
        finally { setIsApproving(false); }
    };

    const handleCancelAppointment = async () => {
        if (!firestore || !assignedEmployee || !position) return;
        if (appointmentDoc && ['APPROVED', 'SIGNED'].includes(appointmentDoc.status)) {
            toast({ variant: 'destructive', title: 'Цуцлах боломжгүй', description: 'Бичиг баримт батлагдсан.' });
            return;
        }
        setIsActionLoading(true);
        try {
            const batch = writeBatch(firestore);
            let deletedDocsCount = 0;
            
            // 1. Delete ER documents (drafts only) - query by employeeId AND positionId
            const docsQuery = query(
                tCollection('er_documents'), 
                where('employeeId', '==', assignedEmployee.id), 
                where('positionId', '==', positionId)
            );
            const docsSnap = await getDocs(docsQuery);
            docsSnap.forEach(docSnap => {
                const status = docSnap.data().status;
                // Delete if not approved/signed
                if (!['APPROVED', 'SIGNED', 'ACKNOWLEDGED'].includes(status)) {
                    batch.delete(docSnap.ref);
                    deletedDocsCount++;
                }
            });
            
            // 2. Also try to delete by metadata.actionId (appointment documents)
            const appointmentDocsQuery = query(
                tCollection('er_documents'),
                where('employeeId', '==', assignedEmployee.id),
                where('metadata.actionId', 'in', ['appointment_permanent', 'appointment_probation', 'appointment_reappoint'])
            );
            try {
                const appointmentDocsSnap = await getDocs(appointmentDocsQuery);
                appointmentDocsSnap.forEach(docSnap => {
                    const status = docSnap.data().status;
                    if (!['APPROVED', 'SIGNED', 'ACKNOWLEDGED'].includes(status)) {
                        batch.delete(docSnap.ref);
                        deletedDocsCount++;
                    }
                });
            } catch (e) {
                console.warn('Appointment docs query failed (index may be missing):', e);
            }
            
            // 3. Delete onboarding process (if exists)
            const onboardingRef = tDoc('onboarding_processes', assignedEmployee.id);
            batch.delete(onboardingRef);
            
            // 4. Delete onboarding projects (if any)
            const onboardingProjectsQuery = query(
                tCollection('projects'),
                where('type', '==', 'onboarding'),
                where('onboardingEmployeeId', '==', assignedEmployee.id)
            );
            try {
                const projectsSnap = await getDocs(onboardingProjectsQuery);
                projectsSnap.forEach(projectDoc => {
                    batch.delete(projectDoc.ref);
                });
            } catch (e) {
                console.warn('Onboarding projects query failed:', e);
            }
            
            // 5. Update employee - clear position data and reset to recruitment status
            batch.update(tDoc('employees', assignedEmployee.id), { 
                positionId: null, 
                jobTitle: null, 
                departmentId: null, 
                status: 'active_recruitment',
                lifecycleStage: 'recruitment'
            });
            
            // 6. Update position filled count
            batch.update(tDoc('positions', positionId), { filled: firestoreIncrement(-1) });
            
            await batch.commit();
            toast({ 
                title: "Томилгоо цуцлагдлаа", 
                description: deletedDocsCount > 0 
                    ? `${deletedDocsCount} баримт устгагдлаа.` 
                    : "Onboarding хөтөлбөр устгагдлаа." 
            });
            setIsCancelAppointmentConfirmOpen(false);
        } catch (e) { 
            console.error('Cancel appointment error:', e);
            toast({ variant: 'destructive', title: 'Алдаа' });
        }
        finally { setIsActionLoading(false); }
    };

    const handleConfirmAppointment = async () => {
        if (!firestore || !assignedEmployee) return;
        if (!appointmentDoc || !['APPROVED', 'SIGNED'].includes(appointmentDoc.status)) {
            toast({ variant: 'destructive', title: 'Баталгаажуулах боломжгүй' });
            return;
        }
        setIsActionLoading(true);
        try {
            const confirmActionId = appointmentDoc?.metadata?.actionId || '';
            const confirmStatus =
                confirmActionId === 'appointment_probation' ? 'active_probation' :
                confirmActionId === 'appointment_permanent' ? 'active_permanent' :
                'active_permanent';
            await writeBatch(firestore).update(tDoc('employees', assignedEmployee.id), { status: confirmStatus }).commit();
            toast({ title: "Томилгоо баталгаажлаа" });
            setIsConfirmAppointmentConfirmOpen(false);
        } catch { toast({ variant: 'destructive', title: 'Алдаа' }) }
        finally { setIsActionLoading(false); }
    };

    const level = levels?.find(l => l.id === position.levelId);

    return (
        <div className="flex flex-col h-full">
            <div className="flex-1 p-6 md:p-8 space-y-6 pb-32">
                <PageHeader
                    title={position.title}
                    description="Ажлын байр"
                    breadcrumbs={[
                        { label: 'Бүтэц', href: '/dashboard/organization' },
                        { label: department?.name || '', href: `/dashboard/organization/${position.departmentId}` },
                        { label: position.title }
                    ]}
                    showBackButton={true}
                    hideBreadcrumbs={true}
                    backButtonPlacement="inline"
                    backBehavior="history"
                    fallbackBackHref={position.departmentId ? `/dashboard/organization/${position.departmentId}` : '/dashboard/organization'}
                    backHref={`/dashboard/organization/${position.departmentId}`}
                />

                <Tabs defaultValue="overview" className="w-full">
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                        {/* Left column: employee card + vertical tab menu */}
                        <div className="lg:col-span-3 space-y-4">
                            {/* Position Card (structure style) */}
                            <div className="flex justify-center">
                                <PositionStructureCard
                                    positionId={position.id}
                                    positionTitle={position.title}
                                    positionCode={position.code}
                                    companyType={position.companyType}
                                    subsidiaryName={position.subsidiaryName}
                                    departmentName={department?.name || ''}
                                    departmentColor={department?.color}
                                    completionPct={completionPercentage}
                                    actionsVisibility="always"
                                    employee={
                                        assignedEmployee
                                            ? {
                                                id: assignedEmployee.id,
                                                firstName: assignedEmployee.firstName,
                                                lastName: assignedEmployee.lastName,
                                                employeeCode: assignedEmployee.employeeCode,
                                                photoURL: assignedEmployee.photoURL,
                                            }
                                            : null
                                    }
                                    actions={
                                        <TooltipProvider delayDuration={150}>
                                        <>
                                            {/* Delete (icon) */}
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <span className={cn(!!assignedEmployee && "cursor-not-allowed")}>
                                                        <button
                                                            type="button"
                                                            className={cn(
                                                                "h-8 w-8 rounded-lg flex items-center justify-center",
                                                                "bg-rose-500/25 hover:bg-rose-500/35 text-white",
                                                                !!assignedEmployee && "opacity-50"
                                                            )}
                                                            onClick={() => setIsDeleteConfirmOpen(true)}
                                                            disabled={!!assignedEmployee}
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </button>
                                                    </span>
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                    <div className="space-y-0.5">
                                                        <div className="text-xs font-semibold">Устгах</div>
                                                        {assignedEmployee ? (
                                                            <div className="text-xs text-muted-foreground">Ажилтан томилогдсон тул устгах боломжгүй</div>
                                                        ) : null}
                                                    </div>
                                                </TooltipContent>
                                            </Tooltip>

                                            {/* Approve / Disapprove (icon) */}
                                            {position.isApproved ? (
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <span className={cn(!!assignedEmployee && "cursor-not-allowed")}>
                                                            <button
                                                                type="button"
                                                                className={cn(
                                                                    "h-8 w-8 rounded-lg flex items-center justify-center",
                                                                    "bg-amber-500/30 hover:bg-amber-500/40 text-white",
                                                                    !!assignedEmployee && "opacity-50"
                                                                )}
                                                                onClick={() => setIsDisapproveConfirmOpen(true)}
                                                                disabled={!!assignedEmployee}
                                                            >
                                                                <XCircle className="h-4 w-4" />
                                                            </button>
                                                        </span>
                                                    </TooltipTrigger>
                                                    <TooltipContent>
                                                        <div className="space-y-0.5">
                                                            <div className="text-xs font-semibold">Цуцлах</div>
                                                            {assignedEmployee ? (
                                                                <div className="text-xs text-muted-foreground">Ажилтан томилогдсон тул цуцлах боломжгүй</div>
                                                            ) : null}
                                                        </div>
                                                    </TooltipContent>
                                                </Tooltip>
                                            ) : (
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <span className={cn(!validationChecklist.isComplete && "cursor-not-allowed")}>
                                                            <button
                                                                type="button"
                                                                className={cn(
                                                                    "h-8 w-8 rounded-lg flex items-center justify-center",
                                                                    "bg-white/20 hover:bg-white/30 text-white",
                                                                    !validationChecklist.isComplete && "opacity-50"
                                                                )}
                                                                onClick={() => setIsApproveConfirmOpen(true)}
                                                                disabled={!validationChecklist.isComplete}
                                                            >
                                                                <Stamp className="h-4 w-4" />
                                                            </button>
                                                        </span>
                                                    </TooltipTrigger>
                                                    <TooltipContent>
                                                        <div className="space-y-0.5">
                                                            <div className="text-xs font-semibold">Батлах</div>
                                                            {!validationChecklist.isComplete ? (
                                                                <div className="text-xs text-muted-foreground">Мэдээлэл дутуу</div>
                                                            ) : null}
                                                        </div>
                                                    </TooltipContent>
                                                </Tooltip>
                                            )}

                                            {/* Employee/appointment actions in top-right (icon buttons) */}
                                            {assignedEmployee ? (
                                                assignedEmployee.status === 'appointing' ? (
                                                    <>
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <span className={cn(isActionLoading && "cursor-not-allowed")}>
                                                                    <button
                                                                        type="button"
                                                                        className={cn(
                                                                            "h-8 w-8 rounded-lg bg-white/20 hover:bg-white/30 text-white flex items-center justify-center",
                                                                            isActionLoading && "opacity-50"
                                                                        )}
                                                                        onClick={() => setIsDocStatusOpen(true)}
                                                                        disabled={isActionLoading}
                                                                    >
                                                                        <FileText className="h-4 w-4" />
                                                                    </button>
                                                                </span>
                                                            </TooltipTrigger>
                                                            <TooltipContent>
                                                                <div className="text-xs font-semibold">Баримт</div>
                                                            </TooltipContent>
                                                        </Tooltip>

                                                        {(() => {
                                                            const disabled = !['APPROVED', 'SIGNED'].includes(appointmentDoc?.status || '') || isActionLoading;
                                                            return (
                                                                <Tooltip>
                                                                    <TooltipTrigger asChild>
                                                                        <span className={cn(disabled && "cursor-not-allowed")}>
                                                                            <button
                                                                                type="button"
                                                                                className={cn(
                                                                                    "h-8 w-8 rounded-lg flex items-center justify-center",
                                                                                    "bg-emerald-500/30 hover:bg-emerald-500/40 text-white",
                                                                                    disabled && "opacity-50"
                                                                                )}
                                                                                onClick={() => setIsConfirmAppointmentConfirmOpen(true)}
                                                                                disabled={disabled}
                                                                            >
                                                                                <CheckCircle2 className="h-4 w-4" />
                                                                            </button>
                                                                        </span>
                                                                    </TooltipTrigger>
                                                                    <TooltipContent>
                                                                        <div className="space-y-0.5">
                                                                            <div className="text-xs font-semibold">Баталгаажуулах</div>
                                                                            {disabled ? (
                                                                                <div className="text-xs text-muted-foreground">Баримт батлагдаагүй эсвэл ачаалж байна</div>
                                                                            ) : null}
                                                                        </div>
                                                                    </TooltipContent>
                                                                </Tooltip>
                                                            );
                                                        })()}

                                                        {(() => {
                                                            const disabled = ['APPROVED', 'SIGNED'].includes(appointmentDoc?.status || '') || isActionLoading;
                                                            return (
                                                                <Tooltip>
                                                                    <TooltipTrigger asChild>
                                                                        <span className={cn(disabled && "cursor-not-allowed")}>
                                                                            <button
                                                                                type="button"
                                                                                className={cn(
                                                                                    "h-8 w-8 rounded-lg flex items-center justify-center",
                                                                                    "bg-amber-500/30 hover:bg-amber-500/40 text-white",
                                                                                    disabled && "opacity-50"
                                                                                )}
                                                                                onClick={() => setIsCancelAppointmentConfirmOpen(true)}
                                                                                disabled={disabled}
                                                                            >
                                                                                <UserX className="h-4 w-4" />
                                                                            </button>
                                                                        </span>
                                                                    </TooltipTrigger>
                                                                    <TooltipContent>
                                                                        <div className="space-y-0.5">
                                                                            <div className="text-xs font-semibold">Томилгоо цуцлах</div>
                                                                            {disabled ? (
                                                                                <div className="text-xs text-muted-foreground">Баримт батлагдсан эсвэл ачаалж байна</div>
                                                                            ) : null}
                                                                        </div>
                                                                    </TooltipContent>
                                                                </Tooltip>
                                                            );
                                                        })()}
                                                    </>
                                                ) : (
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <button
                                                                type="button"
                                                                className="h-8 w-8 rounded-lg bg-rose-500/30 hover:bg-rose-500/40 text-white flex items-center justify-center"
                                                                onClick={() => setIsReleaseDialogOpen(true)}
                                                            >
                                                                <UserMinus className="h-4 w-4" />
                                                            </button>
                                                        </TooltipTrigger>
                                                        <TooltipContent>
                                                            <div className="text-xs font-semibold">Чөлөөлөх</div>
                                                        </TooltipContent>
                                                    </Tooltip>
                                                )
                                            ) : (
                                                position.isApproved && (
                                                    isPrepCompleted ? (
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <button
                                                                    type="button"
                                                                    className="h-8 w-8 rounded-lg bg-white/20 hover:bg-white/30 text-white flex items-center justify-center"
                                                                    onClick={() => setIsAppointDialogOpen(true)}
                                                                >
                                                                    <UserPlus className="h-4 w-4" />
                                                                </button>
                                                            </TooltipTrigger>
                                                            <TooltipContent>
                                                                <div className="text-xs font-semibold">Томилох</div>
                                                            </TooltipContent>
                                                        </Tooltip>
                                                    ) : (prepProjects && prepProjects.length > 0 && prepTaskSummary?.projectId) ? (
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <button
                                                                    type="button"
                                                                    className="h-8 w-8 rounded-lg bg-white/20 hover:bg-white/30 text-white flex items-center justify-center"
                                                                    onClick={() => router.push(`/dashboard/projects/${prepTaskSummary.projectId}`)}
                                                                >
                                                                    <Briefcase className="h-4 w-4" />
                                                                </button>
                                                            </TooltipTrigger>
                                                            <TooltipContent>
                                                                <div className="text-xs font-semibold">Бэлтгэл үргэлжлүүлэх</div>
                                                            </TooltipContent>
                                                        </Tooltip>
                                                    ) : (
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <button
                                                                    type="button"
                                                                    className="h-8 w-8 rounded-lg bg-indigo-500/30 hover:bg-indigo-500/40 text-white flex items-center justify-center"
                                                                    onClick={() => setIsPrepWizardOpen(true)}
                                                                >
                                                                    <Briefcase className="h-4 w-4" />
                                                                </button>
                                                            </TooltipTrigger>
                                                            <TooltipContent>
                                                                <div className="text-xs font-semibold">Ажлын байр бэлтгэх</div>
                                                            </TooltipContent>
                                                        </Tooltip>
                                                    )
                                                )
                                            )}
                                        </>
                                        </TooltipProvider>
                                    }
                                    bottomLeftMeta={position.isApproved ? 'Батлагдсан' : 'Ноорог'}
                                />
                            </div>
                        </div>

                        {/* Right column: selected tab content */}
                        <div className="lg:col-span-9">
                            {/* Horizontal tab menu (above content) */}
                            <div className="mb-4">
                                <VerticalTabMenu
                                    orientation="horizontal"
                                    items={[
                                        { value: 'overview', label: 'Ерөнхий' },
                                        { value: 'competency', label: 'АБТ' },
                                        { value: 'compensation', label: 'Цалин' },
                                        { value: 'benefits', label: 'Хангамж' },
                                        { value: 'history', label: 'Түүх' },
                                    ]}
                                />
                            </div>
                            <div className="bg-transparent border-0 rounded-none">
                                <div className="p-0 min-h-[400px]">
                                    <TabsContent value="overview" className="mt-0">
                                        <PositionOverview
                                            position={position}
                                            departments={allDepartments || []}
                                            allPositions={allPositions || []}
                                            levels={levels || []}
                                            categories={categories || []}
                                            employmentTypes={empTypes || []}
                                            schedules={schedules || []}
                                            validationChecklist={validationChecklist}
                                        />
                                    </TabsContent>

                                    <TabsContent value="competency" className="mt-0">
                                        <PositionCompetency position={position} departmentName={department?.name} levelName={level?.name} />
                                    </TabsContent>

                                    <TabsContent value="compensation" className="mt-0">
                                        <PositionCompensation position={position} />
                                    </TabsContent>

                                    <TabsContent value="benefits" className="mt-0">
                                        <PositionBenefits position={position} />
                                    </TabsContent>

                                    <TabsContent value="history" className="mt-0">
                                        <div className="space-y-4">
                                            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-tight">Өөрчлөлтийн түүх</p>

                                            {!history.length ? (
                                                <div className="rounded-xl border bg-muted/30 text-center py-16 text-muted-foreground">
                                                    <HistoryIcon className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                                    <p>Түүх байхгүй</p>
                                                </div>
                                            ) : (
                                                <div className="rounded-xl border bg-muted/30 p-4 space-y-3">
                                                    {history.map((log, idx) => (
                                                        <div key={idx} className="flex items-start gap-4 p-4 bg-background/80 rounded-lg border">
                                                            <div className={cn(
                                                                "h-8 w-8 rounded-full flex items-center justify-center shrink-0",
                                                                log.action === 'approve' ? "bg-emerald-100 text-emerald-600" : "bg-rose-100 text-rose-600"
                                                            )}>
                                                                {log.action === 'approve' ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <div className="flex items-center justify-between mb-1 gap-3">
                                                                    <span className="font-medium truncate">{log.userName}</span>
                                                                    <span className="text-xs text-muted-foreground shrink-0">{format(new Date(log.timestamp), 'yyyy/MM/dd HH:mm')}</span>
                                                                </div>
                                                                <p className="text-sm text-muted-foreground">{log.note}</p>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </TabsContent>
                                </div>
                            </div>
                        </div>
                    </div>
                </Tabs>
            </div>

            {/* Dialogs */}
            <AlertDialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Ажлын байр устгах?</AlertDialogTitle>
                        <AlertDialogDescription>Энэ үйлдлийг буцаах боломжгүй.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Болих</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">Устгах</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog open={isApproveConfirmOpen} onOpenChange={setIsApproveConfirmOpen}>
                <AlertDialogContent className="sm:max-w-md">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2"><Stamp className="w-5 h-5 text-primary" /> Батлах</AlertDialogTitle>
                        <AlertDialogDescription>Ажлын байрыг батлагдсан төлөвт шилжүүлнэ.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label className="text-xs text-muted-foreground">Огноо</Label>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" className="w-full justify-start">
                                        {format(approvalDate, "yyyy/MM/dd", { locale: mn })}
                                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar mode="single" selected={approvalDate} onSelect={(d) => d && setApprovalDate(d)} />
                                </PopoverContent>
                            </Popover>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-xs text-muted-foreground">Тэмдэглэл</Label>
                            <Textarea placeholder="Нэмэлт тайлбар..." value={approvalNote} onChange={(e) => setApprovalNote(e.target.value)} className="resize-none" />
                        </div>
                    </div>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setApprovalNote('')}>Болих</AlertDialogCancel>
                        <AlertDialogAction onClick={runApproval} disabled={isApproving}>Батлах</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog open={isDisapproveConfirmOpen} onOpenChange={setIsDisapproveConfirmOpen}>
                <AlertDialogContent className="sm:max-w-md">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2"><XCircle className="w-5 h-5 text-amber-500" /> Цуцлах</AlertDialogTitle>
                        <AlertDialogDescription>Ажлын байр ноорог төлөвт буцна.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label className="text-xs text-muted-foreground">Огноо</Label>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" className="w-full justify-start">
                                        {format(disapproveDate, "yyyy/MM/dd", { locale: mn })}
                                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar mode="single" selected={disapproveDate} onSelect={(d) => d && setDisapproveDate(d)} disabled={(d) => d > new Date()} />
                                </PopoverContent>
                            </Popover>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-xs text-muted-foreground">Шалтгаан</Label>
                            <Textarea placeholder="Цуцлах шалтгаан..." value={disapproveNote} onChange={(e) => setDisapproveNote(e.target.value)} className="resize-none" />
                        </div>
                    </div>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setDisapproveNote('')}>Болих</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDisapprove} disabled={isApproving} className="bg-amber-500 hover:bg-amber-600">Цуцлах</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog open={isCancelAppointmentConfirmOpen} onOpenChange={setIsCancelAppointmentConfirmOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Томилгоо цуцлах?</AlertDialogTitle>
                        <AlertDialogDescription>
                            <b>{assignedEmployee?.firstName}</b>-н томилгоо цуцлагдаж, холбогдох баримтууд устана.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Болих</AlertDialogCancel>
                        <AlertDialogAction onClick={handleCancelAppointment} className="bg-amber-500 hover:bg-amber-600" disabled={isActionLoading}>Цуцлах</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog open={isConfirmAppointmentConfirmOpen} onOpenChange={setIsConfirmAppointmentConfirmOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Томилгоо баталгаажуулах?</AlertDialogTitle>
                        <AlertDialogDescription><b>{assignedEmployee?.firstName}</b> албан ёсоор томилогдоно.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Болих</AlertDialogCancel>
                        <AlertDialogAction onClick={handleConfirmAppointment} className="bg-emerald-600 hover:bg-emerald-700" disabled={isActionLoading}>Баталгаажуулах</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog open={isDocStatusOpen} onOpenChange={setIsDocStatusOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2"><FileText className="w-5 h-5" /> Баримтын явц</AlertDialogTitle>
                    </AlertDialogHeader>
                    {appointmentDoc ? (
                        <div className="py-4 space-y-3">
                            <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                                <span className="text-sm text-muted-foreground">Баримт</span>
                                <span className="font-medium">{appointmentDoc.metadata?.templateName || '-'}</span>
                            </div>
                            <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                                <span className="text-sm text-muted-foreground">Төлөв</span>
                                <Badge variant="outline">{appointmentDoc.status}</Badge>
                            </div>
                            <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                                <span className="text-sm text-muted-foreground">Үүсгэсэн</span>
                                <span className="text-sm">{format(appointmentDoc.createdAt.toDate(), 'yyyy/MM/dd')}</span>
                            </div>
                        </div>
                    ) : (
                        <div className="py-8 text-center text-muted-foreground">Баримт олдсонгүй</div>
                    )}
                    <AlertDialogFooter>
                        <AlertDialogCancel>Хаах</AlertDialogCancel>
                        {appointmentDoc && (
                            <Button variant="outline" onClick={() => window.open(`/dashboard/employment-relations/${appointmentDoc.id}`, '_blank')}>
                                <ExternalLink className="w-4 h-4 mr-2" /> Баримт руу
                            </Button>
                        )}
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AppointEmployeeDialog open={isAppointDialogOpen} onOpenChange={setIsAppointDialogOpen} position={position} />
            <ReleaseEmployeeDialog open={isReleaseDialogOpen} onOpenChange={setIsReleaseDialogOpen} employee={assignedEmployee} position={position} />
            <StartPositionPreparationWizardDialog
                open={isPrepWizardOpen}
                onOpenChange={setIsPrepWizardOpen}
                positionId={positionId}
                positionTitle={position.title}
            />
        </div>
    );
}
