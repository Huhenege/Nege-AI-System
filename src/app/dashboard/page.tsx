

// src/app/dashboard/page.tsx
'use client';

import React, { useCallback, useMemo, useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import ReactFlow, {
    addEdge,
    applyNodeChanges,
    applyEdgeChanges,
    Node,
    Edge,
    OnNodesChange,
    OnEdgesChange,
    OnConnect,
    Background,
    Controls,
    Panel,
    MarkerType,
    Handle,
    Position,
    NodePositionChange,
    Connection,
} from 'reactflow';
import 'reactflow/dist/style.css';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import {
    useFetchCollection,
    useMemoFirebase,
    updateDocumentNonBlocking,
    useFetchDoc,
    addDocumentNonBlocking,
    tenantCollection,
    tenantDoc,
    useTenantWrite,
    useUser,
} from '@/firebase';
import { query, where, collectionGroup, writeBatch, getDoc, getDocs, increment } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { User, Users, Briefcase, CalendarCheck2, LogIn, LogOut, MoreHorizontal, Layout, LayoutTemplate, Loader2, MinusCircle, UserCheck, Newspaper, Building, Settings, UserMinus, UserPlus, ArrowLeft, Home, Palmtree, Sparkles, Rocket, Network, ScrollText, Handshake, Flag, ExternalLink, Calendar, MoreVertical } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { AppointEmployeeDialog } from './organization/[departmentId]/components/flow/appoint-employee-dialog';
import { ReleaseEmployeeDialog } from './organization/[departmentId]/components/flow/release-employee-dialog';
import { UnassignedEmployeesDialog } from './organization/unassigned-employees-dialog';
import { AddEmployeeDialog } from './employees/add-employee-dialog';
import { isWithinInterval, format, startOfToday, endOfToday, isToday, startOfDay, endOfDay, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useTenant } from '@/contexts/tenant-context';
import { COMPANY_STATUS_LABELS } from '@/types/company';
import { usePricingPlans } from '@/hooks/use-pricing-plans';
import { UserNav } from '@/components/user-nav';
import { VacationRequest } from '@/types/vacation';
import { Task } from '@/types/project';

// Widget system imports
import { DashboardWidgetsBar, useDashboardWidgets, WidgetData } from './widgets';

import {
    Department,
    Position as JobPosition,
    Employee,
    AttendanceRecord,
    ReferenceItem,
    isActiveStatus
} from '@/types';

// Local types for the chart
interface TimeOffRequest {
    id: string;
    employeeId: string;
    status: 'Зөвшөөрсөн' | 'Хүлээгдэж буй' | 'Татгалзсан';
    startDate: string;
    endDate: string;
}

type AttendanceStatus = {
    status: 'on-leave' | 'checked-in' | 'checked-out' | 'absent';
    checkInTime?: string;
    checkOutTime?: string;
}

interface CompanyProfile {
    name?: string;
    logoUrl?: string;
}


interface JobPositionNodeData {
    id: string;
    label: string;
    title: string;
    department: string;
    departmentColor?: string; // Color inherited from department
    filled: number;
    employees: Employee[];
    workScheduleName?: string;
    attendanceStatus?: AttendanceStatus;
    onOpenDetails?: () => void;
    onAppoint?: () => void;
    onRelease?: () => void;
}

interface EmployeeNodeData {
    label: string;
    name: string;
    jobTitle: string;
    avatar?: string;
    employee?: Employee;
    isMore?: boolean;
    onClick?: () => void;
}

type CustomNode = Node<JobPositionNodeData | EmployeeNodeData>;

// --- Constants & Layout ---
const X_GAP = 450;
const Y_GAP = 500;
const UNASSIGNED_X = -600;
const UNASSIGNED_Y_GAP = 220;
const LAYOUT_STORAGE_KEY = 'org-chart-layout';

import { PositionStructureCard } from '@/components/organization/position-structure-card';
import { PositionRadialMenu } from '@/components/organization/position-radial-menu';
import { EmployeeCard } from '@/components/employees/employee-card';

// --- Node Components ---

const AttendanceStatusIndicator = ({ status }: { status?: AttendanceStatus }) => {
    if (!status) return null;

    const config = {
        'checked-in': { 
            icon: LogIn, 
            text: 'Ирсэн', 
            bgColor: 'bg-emerald-500/20', 
            textColor: 'text-emerald-400',
            time: status.checkInTime ? format(new Date(status.checkInTime), 'HH:mm') : '' 
        },
        'checked-out': { 
            icon: LogOut, 
            text: 'Явсан', 
            bgColor: 'bg-rose-500/20', 
            textColor: 'text-rose-400',
            time: status.checkOutTime ? format(new Date(status.checkOutTime), 'HH:mm') : '' 
        },
        'on-leave': { 
            icon: CalendarCheck2, 
            text: 'Чөлөөтэй', 
            bgColor: 'bg-sky-500/20', 
            textColor: 'text-sky-400',
            time: '' 
        },
        'absent': { 
            icon: MinusCircle, 
            text: 'Ирээгүй', 
            bgColor: 'bg-slate-500/20', 
            textColor: 'text-slate-400',
            time: '' 
        },
    }[status.status];

    if (!config) return null;

    const Icon = config.icon;

    return (
        <div className={cn(
            "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold",
            config.bgColor,
            config.textColor
        )}>
            <Icon className="h-3 w-3" />
            <span>{config.text}</span>
            {config.time && <span className="opacity-70">• {config.time}</span>}
        </div>
    )
}

const JobPositionNode = ({ data }: { data: JobPositionNodeData }) => {
    const [menuOpen, setMenuOpen] = React.useState(false);
    const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

    const employee = data.employees[0]
        ? ({ ...(data.employees[0] as any), attendanceStatus: data.attendanceStatus } as any)
        : undefined;
    const hasEmployee = (data.filled ?? 0) >= 1;

    const openMenu = () => {
        if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
        setMenuOpen(true);
    };
    const closeMenu = () => {
        timerRef.current = setTimeout(() => setMenuOpen(false), 220);
    };
    React.useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

    const radialActions = (hasEmployee
        ? [
            data.onRelease     && { key: 'release', angle: 90,  Icon: UserMinus,    label: 'Чөлөөлөх',         onClick: data.onRelease },
            data.onOpenDetails && { key: 'details', angle: 150, Icon: ExternalLink,  label: 'Дэлгэрэнгүй',      onClick: data.onOpenDetails },
        ]
        : [
            data.onAppoint     && { key: 'appoint', angle: 90,  Icon: UserPlus,     label: 'Ажилтан томилох',   onClick: data.onAppoint },
            data.onOpenDetails && { key: 'details', angle: 150, Icon: ExternalLink,  label: 'Дэлгэрэнгүй',      onClick: data.onOpenDetails },
        ]
    ).filter(Boolean) as React.ComponentProps<typeof PositionRadialMenu>['actions'];

    return (
        <div className="relative group overflow-visible">
            <Handle type="target" position={Position.Top} className="!bg-primary opacity-0" />
            <div className="relative overflow-visible">
                <PositionStructureCard
                    positionId={data.id}
                    positionTitle={data.title}
                    departmentName={data.department}
                    departmentColor={data.departmentColor}
                    employee={employee as any}
                />
                {radialActions.length > 0 && (
                    <PositionRadialMenu
                        open={menuOpen}
                        isDarkBg={true}
                        actions={radialActions}
                        onOpen={openMenu}
                        onClose={closeMenu}
                    />
                )}
            </div>
            <Handle type="source" position={Position.Bottom} className="!bg-primary opacity-0" />
        </div>
    );
};


const UnassignedEmployeeNode = ({ data }: { data: EmployeeNodeData & { isMore?: boolean, onClick?: () => void } }) => {
    if (data.isMore) {
        return (
            <div
                className="w-72 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700/50 shadow-xl p-5 cursor-pointer hover:from-slate-700 hover:to-slate-800 transition-all duration-300 hover:shadow-2xl hover:-translate-y-1 group"
                onClick={data.onClick}
            >
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-xl bg-slate-700/50 flex items-center justify-center border border-dashed border-slate-600 group-hover:border-slate-500 transition-colors">
                        <MoreHorizontal className="h-6 w-6 text-slate-400 group-hover:text-slate-300" />
                    </div>
                    <div>
                        <p className="font-bold text-base text-white">{data.name}</p>
                        <p className="text-xs text-slate-400 font-medium">{data.jobTitle}</p>
                    </div>
                </div>
            </div>
        );
    }

    const employee = data.employee;
    if (!employee) return null;

    return (
        <div className="relative group">
            {/* Drag Handle - visible connection point */}
            <Handle 
                type="source" 
                position={Position.Right} 
                className="!w-3 !h-3 !bg-slate-300 !border-2 !border-white !rounded-full !right-[-6px] hover:!bg-slate-400 transition-all cursor-default" 
            />
            <EmployeeCard
                employee={employee}
                variant="compact"
                footer="Томилогдоогүй"
            />
        </div>
    );
}

const SkeletonChart = () => <div className="relative h-[80vh] w-full"><Skeleton className="h-32 w-64 absolute top-10 left-10" /><Skeleton className="h-32 w-64 absolute top-60 left-80" /><Skeleton className="h-32 w-64 absolute top-10 right-10" /></div>

// --- Layouting Logic ---
function calculateLayout(positions: JobPosition[]) {
    const positionMap = new Map(positions.map((p) => [p.id, p]));
    const childrenMap = new Map<string, string[]>();
    positions.forEach((p) => {
        const managerId = (p as any).reportsToId || (p as any).reportsTo;
        if (managerId) {
            if (!childrenMap.has(managerId)) childrenMap.set(managerId, []);
            childrenMap.get(managerId)!.push(p.id);
        }
    });

    const nodePositions: Record<string, { x: number; y: number }> = {};
    const processedNodes = new Set<string>();

    const widthMemo = new Map<string, number>();
    const calculateSubtreeWidth = (nodeId: string, visited = new Set<string>()): number => {
        if (widthMemo.has(nodeId)) return widthMemo.get(nodeId)!;
        if (visited.has(nodeId)) return X_GAP; // Cycle detected

        const newVisited = new Set(visited);
        newVisited.add(nodeId);

        const children = childrenMap.get(nodeId) || [];
        if (children.length === 0) {
            return X_GAP;
        }
        const width = children.reduce((sum, childId) => sum + calculateSubtreeWidth(childId, newVisited), 0);
        widthMemo.set(nodeId, width);
        return width;
    };

    function positionNodes(nodeId: string, x: number, y: number) {
        if (processedNodes.has(nodeId)) return;
        nodePositions[nodeId] = { x, y };
        processedNodes.add(nodeId);

        const children = childrenMap.get(nodeId) || [];
        children.sort((a, b) => (positionMap.get(a)?.title || '').localeCompare(positionMap.get(b)?.title || ''));

        if (children.length === 0) return;

        const totalWidth = children.reduce((sum, childId) => sum + calculateSubtreeWidth(childId), 0);
        let currentX = x - totalWidth / 2;

        children.forEach((childId) => {
            const subtreeWidth = calculateSubtreeWidth(childId);
            positionNodes(childId, currentX + subtreeWidth / 2, y + Y_GAP);
            currentX += subtreeWidth;
        });
    }

    const rootNodes = positions.filter((p) => !((p as any).reportsToId || (p as any).reportsTo));
    rootNodes.sort((a, b) => (a.title || '').localeCompare(b.title || ''));

    let currentX = 0;
    rootNodes.forEach(rootNode => {
        const rootWidth = calculateSubtreeWidth(rootNode.id);
        positionNodes(rootNode.id, currentX + rootWidth / 2, 0);
        currentX += rootWidth;
    });

    return nodePositions;
}


function useLayout(positions: JobPosition[] | null) {
    const [nodePositions, setNodePositions] = useState<Record<string, { x: number, y: number }>>({});

    useEffect(() => {
        if (!positions) return;

        // Load saved layout from localStorage
        const savedLayout = localStorage.getItem(LAYOUT_STORAGE_KEY);
        if (savedLayout) {
            try {
                setNodePositions(JSON.parse(savedLayout));
                return;
            } catch (e) {
                console.error("Failed to parse saved layout", e);
            }
        }

        // If no saved layout, calculate initial layout
        const initialLayout = calculateLayout(positions);
        setNodePositions(initialLayout);

    }, [positions]);

    const saveLayout = useCallback((nodes: CustomNode[]) => {
        const layoutToSave: Record<string, { x: number, y: number }> = {};
        nodes.forEach(node => {
            if (node.position) {
                layoutToSave[node.id] = node.position;
            }
        });
        localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(layoutToSave));
    }, []);

    const resetLayout = useCallback(() => {
        if (!positions) return;
        const initialLayout = calculateLayout(positions);
        setNodePositions(initialLayout);
        localStorage.removeItem(LAYOUT_STORAGE_KEY);
    }, [positions]);

    return { nodePositions, saveLayout, resetLayout };
}


// --- Main Component ---
const STABLE_NODE_TYPES = Object.freeze({ position: JobPositionNode, unassigned: UnassignedEmployeeNode });

const OrganizationChart = () => {
    const router = useRouter();
    const [nodes, setNodes] = useState<CustomNode[]>([]);
    const [edges, setEdges] = useState<Edge[]>([]);
    const [isAppointDialogOpen, setIsAppointDialogOpen] = useState(false);
    const [selectedPosition, setSelectedPosition] = useState<JobPosition | null>(null);
    const [isUnassignedDialogOpen, setIsUnassignedDialogOpen] = React.useState(false);
    const [selectedEmployeeForAppointment, setSelectedEmployeeForAppointment] = React.useState<Employee | null>(null);
    const [isAddEmployeeDialogOpen, setIsAddEmployeeDialogOpen] = React.useState(false);
    const [isReleaseDialogOpen, setIsReleaseDialogOpen] = React.useState(false);
    const [positionForRelease, setPositionForRelease] = React.useState<JobPosition | null>(null);
    const [employeeForRelease, setEmployeeForRelease] = React.useState<Employee | null>(null);

    const { toast } = useToast();
    const { company, isModuleEnabled } = useTenant();
    const { firestore, tDoc, tCollection, companyPath } = useTenantWrite();
    const { user } = useUser();
    const { getPlanLabel } = usePricingPlans();

    // Data fetching
    const deptsQuery = useMemoFirebase(({ firestore, companyPath }) => (firestore ? tenantCollection(firestore, companyPath, 'departments') : null), [firestore]);
    const positionsQuery = useMemoFirebase(({ firestore, companyPath }) => firestore ? query(tenantCollection(firestore, companyPath, 'positions'), where('isActive', '==', true)) : null, [firestore]);
    const employeesQuery = useMemoFirebase(({ firestore, companyPath }) => firestore ? tenantCollection(firestore, companyPath, 'employees') : null, [firestore]);
    const workSchedulesQuery = useMemoFirebase(({ firestore, companyPath }) => (firestore ? tenantCollection(firestore, companyPath, 'workSchedules') : null), [firestore]);
    const positionLevelsQuery = useMemoFirebase(({ firestore, companyPath }) => (firestore ? tenantCollection(firestore, companyPath, 'positionLevels') : null), [firestore]);
    const employmentTypesQuery = useMemoFirebase(({ firestore, companyPath }) => (firestore ? tenantCollection(firestore, companyPath, 'employmentTypes') : null), [firestore]);
    const jobCategoriesQuery = useMemoFirebase(({ firestore, companyPath }) => (firestore ? tenantCollection(firestore, companyPath, 'jobCategories') : null), [firestore]);
    const companyProfileRef = useMemoFirebase(({ firestore, companyPath }) => (firestore ? tenantDoc(firestore, companyPath, 'company', 'profile') : null), [firestore]);

    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const attendanceQuery = useMemoFirebase(({ firestore, companyPath }) => (firestore ? query(tenantCollection(firestore, companyPath, 'attendance'), where('date', '==', todayStr)) : null), [firestore, todayStr]);
    const timeOffQuery = useMemoFirebase(() => (firestore ? query(collectionGroup(firestore, 'timeOffRequests'), where('status', '==', 'Зөвшөөрсөн')) : null), [firestore]);
    const postsQuery = useMemoFirebase(({ firestore, companyPath }) => firestore ? tenantCollection(firestore, companyPath, 'posts') : null, [firestore]);


    const { data: departments, isLoading: isLoadingDepts } = useFetchCollection<Department>(deptsQuery);
    const { data: positions, isLoading: isLoadingPos } = useFetchCollection<JobPosition>(positionsQuery);
    const { data: employees, isLoading: isLoadingEmp } = useFetchCollection<Employee>(employeesQuery);
    const { data: workSchedules, isLoading: isLoadingSchedules } = useFetchCollection<any>(workSchedulesQuery);
    const { data: positionLevels, isLoading: isLoadingLevels } = useFetchCollection<any>(positionLevelsQuery);
    const { data: employmentTypes, isLoading: isLoadingEmpTypes } = useFetchCollection<any>(employmentTypesQuery);
    const { data: jobCategories, isLoading: isLoadingJobCategories } = useFetchCollection<any>(jobCategoriesQuery);
    const { data: attendanceData, isLoading: isLoadingAttendance } = useFetchCollection<AttendanceRecord>(attendanceQuery);
    // Vacation Statistics for Dashboard
    const vacationRequestsQuery = useMemoFirebase(() =>
        firestore ? query(collectionGroup(firestore, 'vacationRequests'), where('status', '==', 'APPROVED')) : null
        , [firestore]);
    const { data: vacationRequests } = useFetchCollection<VacationRequest>(vacationRequestsQuery);

    // Projects query (for projects widget)
    const projectsQuery = useMemoFirebase(({ firestore, companyPath }) =>
        firestore ? query(tenantCollection(firestore, companyPath, 'projects'), where('status', 'in', ['DRAFT', 'ACTIVE', 'ON_HOLD', 'PLANNING', 'IN_PROGRESS'])) : null
        , [firestore]);
    const { data: activeProjects } = useFetchCollection<any>(projectsQuery);

    // Recruitment queries (for Recruitment widget)
    const vacanciesQuery = useMemoFirebase(({ firestore, companyPath }) =>
        firestore ? tenantCollection(firestore, companyPath, 'vacancies') : null
        , [firestore]);
    const { data: allVacancies } = useFetchCollection<any>(vacanciesQuery);

    const applicationsQuery = useMemoFirebase(({ firestore, companyPath }) =>
        firestore ? tenantCollection(firestore, companyPath, 'applications') : null
        , [firestore]);
    const { data: allApplications } = useFetchCollection<any>(applicationsQuery);

    // Employment Relations queries (for ER widget)
    const erDocumentsQuery = useMemoFirebase(({ firestore, companyPath }) =>
        firestore ? tenantCollection(firestore, companyPath, 'er_documents') : null
        , [firestore]);
    const { data: erDocuments } = useFetchCollection<any>(erDocumentsQuery);

    const erTemplatesQuery = useMemoFirebase(({ firestore, companyPath }) =>
        firestore ? tenantCollection(firestore, companyPath, 'er_templates') : null
        , [firestore]);
    const { data: erTemplates } = useFetchCollection<any>(erTemplatesQuery);

    // Training queries (for Training widget)
    const trainingCoursesQuery = useMemoFirebase(({ firestore, companyPath }) =>
        firestore ? tenantCollection(firestore, companyPath, 'training_courses') : null
        , [firestore]);
    const { data: trainingCourses } = useFetchCollection<any>(trainingCoursesQuery);

    const trainingPlansQuery = useMemoFirebase(({ firestore, companyPath }) =>
        firestore ? tenantCollection(firestore, companyPath, 'training_plans') : null
        , [firestore]);
    const { data: trainingPlans } = useFetchCollection<any>(trainingPlansQuery);

    // Skills queries (for Skills widget)
    const skillsInventoryQuery = useMemoFirebase(({ firestore, companyPath }) =>
        firestore ? tenantCollection(firestore, companyPath, 'skills_inventory') : null
        , [firestore]);
    const { data: skillsInventory } = useFetchCollection<any>(skillsInventoryQuery);

    const skillAssessmentsQuery = useMemoFirebase(({ firestore, companyPath }) =>
        firestore ? tenantCollection(firestore, companyPath, 'skill_assessments') : null
        , [firestore]);
    const { data: skillAssessments } = useFetchCollection<any>(skillAssessmentsQuery);

    // All tasks query for overdue count (using collectionGroup)
    const allTasksQuery = useMemoFirebase(() =>
        firestore ? collectionGroup(firestore, 'tasks') : null
        , [firestore]);
    const { data: allTasks } = useFetchCollection<any>(allTasksQuery);

    // Meeting rooms and today's bookings (for Meetings widget)
    const meetingRoomsQuery = useMemoFirebase(({ firestore, companyPath }) =>
        firestore ? tenantCollection(firestore, companyPath, 'meeting_rooms') : null
        , [firestore]);
    const { data: meetingRooms } = useFetchCollection<any>(meetingRoomsQuery);

    const todayBookingsQuery = useMemoFirebase(({ firestore, companyPath }) => {
        if (!firestore) return null;
        const todayStr = format(new Date(), 'yyyy-MM-dd');
        return query(
            tenantCollection(firestore, companyPath, 'room_bookings'),
            where('date', '==', todayStr),
            where('status', '==', 'active')
        );
    }, [firestore]);
    const { data: todayBookings } = useFetchCollection<any>(todayBookingsQuery);

    // Business Plan queries (for Business Plan widget)
    const bpPlansQuery = useMemoFirebase(({ firestore, companyPath }) =>
        firestore ? query(tenantCollection(firestore, companyPath, 'bp_plans'), where('status', '==', 'active')) : null
        , [firestore]);
    const { data: bpPlans } = useFetchCollection<any>(bpPlansQuery);

    const bpObjectivesQuery = useMemoFirebase(({ firestore, companyPath }) =>
        firestore ? tenantCollection(firestore, companyPath, 'bp_objectives') : null
        , [firestore]);
    const { data: bpObjectives } = useFetchCollection<any>(bpObjectivesQuery);

    const bpKpisQuery = useMemoFirebase(({ firestore, companyPath }) =>
        firestore ? tenantCollection(firestore, companyPath, 'bp_kpis') : null
        , [firestore]);
    const { data: bpKpis } = useFetchCollection<any>(bpKpisQuery);

    // Survey queries (for Survey widget)
    const surveysQuery = useMemoFirebase(({ firestore, companyPath }) =>
        firestore ? tenantCollection(firestore, companyPath, 'surveys') : null
        , [firestore]);
    const { data: allSurveys } = useFetchCollection<any>(surveysQuery);

    // Calculate overdue tasks
    const overdueTasksCount = useMemo(() => {
        if (!allTasks) return 0;
        const today = new Date();
        return allTasks.filter((task: any) => {
            if (task.status === 'DONE') return false;
            try {
                return parseISO(task.dueDate) < today;
            } catch {
                return false;
            }
        }).length;
    }, [allTasks]);

    // Dashboard widgets hook
    const {
        order: widgetOrder,
        hidden: hiddenWidgets,
        isLoaded: isWidgetsLoaded,
        setOrder,
        hideWidget,
        showWidget
    } = useDashboardWidgets({
        firestore: firestore ?? null,
        companyPath: companyPath ?? null,
        userId: user?.uid ?? null,
    });

    const onLeaveCount = useMemo(() => {
        if (!vacationRequests) return 0;
        const now = startOfDay(new Date());
        return vacationRequests.filter(r => {
            try {
                return isWithinInterval(now, {
                    start: startOfDay(parseISO(r.startDate)),
                    end: endOfDay(parseISO(r.endDate))
                });
            } catch (e) {
                return false;
            }
        }).length;
    }, [vacationRequests]);
    const { data: timeOffData, isLoading: isLoadingTimeOff } = useFetchCollection<TimeOffRequest>(timeOffQuery);
    const { data: posts, isLoading: isLoadingPosts } = useFetchCollection(postsQuery);
    const { data: companyProfile, isLoading: isLoadingProfile } = useFetchDoc<CompanyProfile>(companyProfileRef);


    const { nodePositions, saveLayout, resetLayout } = useLayout(positions);

    // Critical loading states for the organization chart
    const isCriticalLoading = isLoadingDepts || isLoadingPos || isLoadingEmp || isLoadingProfile;
    // Secondary loading states for statistics
    const isStatsLoading = isLoadingSchedules || isLoadingLevels || isLoadingEmpTypes || isLoadingJobCategories || isLoadingAttendance || isLoadingTimeOff || isLoadingPosts;

    // For visual skeleton of the chart
    const isLoading = isCriticalLoading;

    // Fetch gender data + birth dates from questionnaire subcollections
    const [genderCounts, setGenderCounts] = useState<{ male: number; female: number; averageAge: number }>({ male: 0, female: 0, averageAge: 0 });
    useEffect(() => {
        if (!firestore || !employees || employees.length === 0) return;
        let cancelled = false;
        (async () => {
            let m = 0, f = 0;
            let totalAge = 0, ageCount = 0;
            const today = new Date();
            const promises = employees.map(async (emp) => {
                try {
                    const snap = await getDoc(tDoc('employees', emp.id, 'questionnaire', 'data'));
                    if (snap.exists()) {
                        const data = snap.data();
                        const g = data?.gender;
                        if (g === 'male') m++;
                        else if (g === 'female') f++;

                        // Calculate age from birthDate
                        const birthDate = data?.birthDate;
                        if (birthDate) {
                            let d: Date | null = null;
                            if (typeof birthDate === 'string') {
                                d = new Date(birthDate);
                            } else if (birthDate instanceof Date) {
                                d = birthDate;
                            } else if (typeof birthDate === 'object' && 'seconds' in birthDate) {
                                d = new Date(birthDate.seconds * 1000);
                            }
                            if (d && !isNaN(d.getTime())) {
                                let age = today.getFullYear() - d.getFullYear();
                                const mDiff = today.getMonth() - d.getMonth();
                                if (mDiff < 0 || (mDiff === 0 && today.getDate() < d.getDate())) age--;
                                if (age >= 0) {
                                    totalAge += age;
                                    ageCount++;
                                }
                            }
                        }
                    }
                } catch { /* skip */ }
            });
            await Promise.all(promises);
            if (!cancelled) {
                const averageAge = ageCount > 0 ? Math.round((totalAge / ageCount) * 10) / 10 : 0;
                setGenderCounts({ male: m, female: f, averageAge });
            }
        })();
        return () => { cancelled = true; };
    }, [firestore, employees]);

    const unassignedEmployees = useMemo(() => {
        return (employees || []).filter(e => !e.positionId && isActiveStatus(e.status));
    }, [employees]);

    const onLeaveEmployees = useMemo(() => {
        if (!timeOffData) return new Set<string>();
        const today = new Date();
        const onLeave = new Set<string>();
        timeOffData.forEach(req => {
            if (isWithinInterval(today, { start: new Date(req.startDate), end: new Date(req.endDate) })) {
                onLeave.add(req.employeeId);
            }
        });
        return onLeave;
    }, [timeOffData]);

    const presentEmployees = useMemo(() => {
        if (!attendanceData) return new Set<string>();
        return new Set(attendanceData.map(a => a.employeeId));
    }, [attendanceData]);


    // Recent activities (last 10)
    const recentActivities = useMemo(() => {
        const activities: Array<{ id: string; type: string; employeeName: string; time: string; description: string }> = [];

        // Add today's attendance check-ins
        if (attendanceData && employees) {
            const empMap = new Map((employees as Employee[]).map(e => [e.id, e]));
            attendanceData.forEach(record => {
                const emp = empMap.get(record.employeeId);
                if (emp && record.checkInTime) {
                    activities.push({
                        id: `attendance-${record.id}`,
                        type: 'check-in',
                        employeeName: `${emp.firstName || ''} ${emp.lastName || ''}`,
                        time: record.checkInTime,
                        description: 'Ирлээ'
                    });
                }
            });
        }

        // Sort by time and take last 10
        activities.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
        return activities.slice(0, 10);
    }, [attendanceData, employees]);

    // Calculate ER pending documents count
    const erPendingCount = useMemo(() => {
        if (!erDocuments) return 0;
        return erDocuments.filter((doc: any) => 
            ['DRAFT', 'IN_REVIEW', 'REVIEWED', 'SENT_TO_EMPLOYEE'].includes(doc.status)
        ).length;
    }, [erDocuments]);

    // Prepare widget data for the dashboard widgets bar
    const widgetData: WidgetData = useMemo(() => {
        const empArr = employees || [];
        return {
            // Projects widget
            activeProjectsCount: activeProjects?.length || 0,
            overdueTasksCount,

            // Employees widget
            employeesCount: empArr.length,
            permanentCount: empArr.filter(e => e.status === 'active_permanent').length,
            probationCount: empArr.filter(e => e.status === 'active_probation').length,
            maleCount: genderCounts.male,
            femaleCount: genderCounts.female,
            averageAge: genderCounts.averageAge,
            
            // Structure widget
            departmentsCount: departments?.length || 0,
            positionsCount: positions?.length || 0,
            
            // Attendance widget
            presentCount: presentEmployees.size,
            onLeaveCount: onLeaveEmployees.size,
            
            // Vacation widget
            vacationCount: onLeaveCount,
            
            // Posts widget
            postsCount: posts?.length || 0,

            // Recruitment widget
            recruitmentOpenVacancies: allVacancies?.filter((v: any) => v.status === 'OPEN').length || 0,
            recruitmentTotalCandidates: allApplications?.length || 0,
            recruitmentActiveCandidates: allApplications?.filter((a: any) => a.status === 'ACTIVE').length || 0,
            recruitmentHiredCount: allApplications?.filter((a: any) => a.status === 'HIRED').length || 0,

            // Employment Relations widget
            erDocumentsCount: erDocuments?.length || 0,
            erPendingCount,
            erTemplatesCount: erTemplates?.length || 0,

            // Training widget
            trainingCoursesCount: trainingCourses?.filter((c: any) => c.status === 'active').length || 0,
            trainingActivePlansCount: trainingPlans?.filter((p: any) => p.status === 'assigned' || p.status === 'in_progress').length || 0,
            trainingCompletionRate: (() => {
                const total = trainingPlans?.filter((p: any) => p.status !== 'cancelled').length || 0;
                const completed = trainingPlans?.filter((p: any) => p.status === 'completed').length || 0;
                return total > 0 ? Math.round((completed / total) * 100) : 0;
            })(),

            // Meetings widget
            meetingsTodayCount: todayBookings?.length || 0,
            meetingRoomsCount: meetingRooms?.filter((r: any) => r.isActive).length || 0,
            nextMeetingTime: (() => {
                if (!todayBookings?.length) return undefined;
                const nowStr = format(new Date(), 'HH:mm');
                const upcoming = todayBookings
                    .filter((b: any) => b.startTime > nowStr)
                    .sort((a: any, b: any) => a.startTime.localeCompare(b.startTime));
                return upcoming[0]?.startTime;
            })(),

            // Skills widget
            skillsInventoryCount: skillsInventory?.length || 0,
            skillsAssessedCount: (() => {
                if (!skillAssessments?.length) return 0;
                const uniqueEmployees = new Set(skillAssessments.map((a: any) => a.employeeId));
                return uniqueEmployees.size;
            })(),
            skillGapPercentage: (() => {
                if (!skillAssessments?.length) return 0;
                const withGap = skillAssessments.filter((a: any) => {
                    if (!a.requiredLevel || !a.currentLevel) return false;
                    const levelVal: Record<string, number> = { beginner: 1, intermediate: 2, advanced: 3, expert: 4 };
                    return (levelVal[a.requiredLevel] || 0) > (levelVal[a.currentLevel] || 0);
                });
                return Math.round((withGap.length / skillAssessments.length) * 100);
            })(),

            // Business Plan widget
            bpPlanProgress: 0, // computed client-side in the BP module
            bpOkrCount: bpObjectives?.length || 0,
            bpKpiGreenCount: bpKpis?.filter((k: any) => {
                if (!k.target || k.target === 0) return true;
                return (k.current / k.target) * 100 >= 90;
            }).length || 0,

            // Survey widget
            surveyActiveCount: allSurveys?.filter((s: any) => s.status === 'active').length || 0,
            surveyDraftCount: allSurveys?.filter((s: any) => s.status === 'draft').length || 0,
            surveyTotalResponses: allSurveys?.reduce((sum: number, s: any) => sum + (s.responsesCount || 0), 0) || 0,

            // Billing widget
            billingPlan: company?.plan,
            billingPlanLabel: company?.plan ? getPlanLabel(company.plan) : undefined,
            billingStatus: company?.status,
            billingStatusLabel: company?.status ? COMPANY_STATUS_LABELS[company.status] : undefined,
            billingEmployeeCount: company?.employeeCount ?? (employees || []).length,
            billingMaxEmployees: company?.limits?.maxEmployees,
            billingAmount: company?.subscription?.amount,
            billingCurrency: company?.subscription?.currency,
            billingNextPayment: company?.subscription?.nextPaymentDate,
        };
    }, [
        activeProjects,
        overdueTasksCount,
        employees,
        departments,
        positions,
        presentEmployees.size,
        onLeaveEmployees.size,
        onLeaveCount,
        posts,
        erDocuments,
        erPendingCount,
        erTemplates,
        genderCounts,
        trainingCourses,
        trainingPlans,
        todayBookings,
        meetingRooms,
        skillsInventory,
        skillAssessments,
        bpPlans,
        bpObjectives,
        bpKpis,
        allSurveys,
        company,
    ]);




    // Create nodes and edges based on data
    useEffect(() => {
        if (isCriticalLoading || !departments || !positions) return;

        const deptMap = new Map(departments?.map(d => [d.id, d]));
        const workScheduleMap = new Map(workSchedules?.map(ws => [ws.id, ws.name]));

        const posToEmployeeMap = new Map<string, Employee[]>();
        employees?.forEach(e => {
            if (e.positionId) {
                if (!posToEmployeeMap.has(e.positionId)) posToEmployeeMap.set(e.positionId, []);
                posToEmployeeMap.get(e.positionId)?.push(e);
            }
        });

        const today = new Date();
        const employeeAttendanceStatus = new Map<string, AttendanceStatus>();
        employees.forEach(emp => {
            if (onLeaveEmployees.has(emp.id)) {
                employeeAttendanceStatus.set(emp.id, { status: 'on-leave' });
                return;
            }

            const attendanceRecord = attendanceData?.find(rec => rec.employeeId === emp.id);
            if (attendanceRecord) {
                if (attendanceRecord.checkOutTime) {
                    employeeAttendanceStatus.set(emp.id, { status: 'checked-out', checkInTime: attendanceRecord.checkInTime, checkOutTime: attendanceRecord.checkOutTime });
                } else {
                    employeeAttendanceStatus.set(emp.id, { status: 'checked-in', checkInTime: attendanceRecord.checkInTime });
                }
            } else {
                employeeAttendanceStatus.set(emp.id, { status: 'absent' });
            }
        });




        const newNodes: CustomNode[] = [];
        const newEdges: Edge[] = [];

        // Filter positions to only show approved ones on the dashboard chart
        const approvedPositions = positions.filter(pos => pos.isApproved !== false);

        approvedPositions.forEach(pos => {
            const assignedEmployees = posToEmployeeMap.get(pos.id) || [];
            const department = deptMap.get(pos.departmentId);
            const employee = assignedEmployees[0];
            const filled = assignedEmployees.length;

            const node: Node<JobPositionNodeData> = {
                id: pos.id,
                type: 'position',
                position: nodePositions[pos.id] || { x: 0, y: 0 },
                data: {
                    id: pos.id,
                    label: pos.title,
                    title: pos.title,
                    department: department?.name || 'Unknown',
                    departmentColor: department?.color || '', // Color inherited from department
                    filled,
                    employees: assignedEmployees,
                    workScheduleName: pos.workScheduleId ? workScheduleMap.get(pos.workScheduleId) : undefined,
                    attendanceStatus: employee ? employeeAttendanceStatus.get(employee.id) : undefined,
                    onOpenDetails: () => router.push(`/dashboard/organization/positions/${pos.id}`),
                    onAppoint: filled < 1 ? () => {
                        setSelectedPosition(pos as JobPosition);
                        setSelectedEmployeeForAppointment(null);
                        setIsAppointDialogOpen(true);
                    } : undefined,
                    onRelease: filled >= 1 && assignedEmployees[0] ? () => {
                        setPositionForRelease(pos as JobPosition);
                        setEmployeeForRelease(assignedEmployees[0]);
                        setIsReleaseDialogOpen(true);
                    } : undefined,
                },
            };
            newNodes.push(node);

            const managerId = (pos as any).reportsToId || (pos as any).reportsTo;
            if (managerId && approvedPositions.some(p => p.id === managerId)) {
                newEdges.push({
                    id: `e-${managerId}-${pos.id}`,
                    source: managerId,
                    target: pos.id,
                    type: 'smoothstep',
                    animated: true,
                    style: { stroke: '#2563eb', strokeWidth: 2 }
                });
            }
        });

        // Limit unassigned nodes to 10 on the chart to prevent clutter
        const visibleUnassigned = unassignedEmployees.slice(0, 10);
        visibleUnassigned.forEach((emp, index) => {
            newNodes.push({
                id: emp.id,
                type: 'unassigned',
                position: { x: UNASSIGNED_X, y: index * UNASSIGNED_Y_GAP },
                data: {
                    label: emp.firstName || '',
                    name: `${emp.firstName || ''} ${emp.lastName || ''}`,
                    jobTitle: emp.jobTitle || '',
                    avatar: emp.photoURL,
                    employee: emp,
                },
            });
        });

        if (unassignedEmployees.length > 10) {
            newNodes.push({
                id: 'unassigned-more',
                type: 'unassigned',
                position: { x: UNASSIGNED_X, y: visibleUnassigned.length * UNASSIGNED_Y_GAP },
                data: {
                    label: `Бусад ${unassignedEmployees.length - 10}...`,
                    name: `+${unassignedEmployees.length - 10} ажилтан`,
                    jobTitle: 'Бүгдийг харах',
                    isMore: true,
                    onClick: () => setIsUnassignedDialogOpen(true)
                }
            });
        }

        setNodes(newNodes);
        setEdges(newEdges);
    }, [isLoading, departments, positions, employees, workSchedules, nodePositions, attendanceData, timeOffData, onLeaveEmployees, router]);

    const onNodesChange: OnNodesChange = useCallback(
        (changes) => {
            setNodes((nds) => {
                const newNodes = applyNodeChanges(changes, nds);
                // Save layout on drag stop
                const dragChange = changes.find(c => c.type === 'position' && c.dragging === false);
                if (dragChange) {
                    saveLayout(newNodes);
                }
                return newNodes;
            });
        },
        [saveLayout]
    );
    const onEdgesChange: OnEdgesChange = useCallback((changes) => setEdges((eds) => applyEdgeChanges(changes, eds)), []);

    const onConnect: OnConnect = useCallback(
        (connection) => {
            const employeeNode = nodes.find(n => n.id === connection.source);
            const positionNode = nodes.find(n => n.id === connection.target);

            if (employeeNode?.type !== 'unassigned' || positionNode?.type !== 'position') return;

            const posData = positionNode?.data as JobPositionNodeData;
            if (posData.filled >= 1) {
                toast({
                    title: "Орон тоо дүүрсэн",
                    description: `"${posData.title}" ажлын байранд ажилтан томилогдсон байна.`,
                    variant: "destructive"
                })
                return;
            }

            (async () => {
                if (!firestore) return;

                // Before appoint: ensure position preparation is completed
                try {
                    const prepSnap = await getDocs(
                        query(
                            tCollection('projects'),
                            where('type', '==', 'position_preparation'),
                            where('positionPreparationPositionId', '==', positionNode.id)
                        )
                    );

                    if (prepSnap.empty) {
                        toast({
                            title: 'Ажлын байр бэлтгэгдээгүй байна',
                            description: (
                                <div className="space-y-1">
                                    <div>Эхлээд ажлын байрны бэлтгэлийг хангана уу.</div>
                                    <Link className="underline font-medium" href={`/dashboard/organization/positions/${positionNode.id}`}>
                                        Ажлын байр бэлтгэх
                                    </Link>
                                </div>
                            ),
                            variant: 'destructive',
                        });
                        return;
                    }

                    const prepProject = prepSnap.docs[0].data() as any;
                    const tasksSnap = await getDocs(tCollection('projects', prepProject.id, 'tasks'));
                    const tasks = tasksSnap.docs.map((d) => d.data() as Task);
                    const total = tasks.length;
                    const done = tasks.filter((t) => t.status === 'DONE').length;
                    const isPrepared = total > 0 && done === total;

                    if (!isPrepared) {
                        toast({
                            title: 'Ажлын байрны бэлтгэл дуусаагүй байна',
                            description: (
                                <div className="space-y-1">
                                    <div>Эхлээд бэлтгэлийн таскуудаа дуусгаад дараа нь ажилтан томилно уу.</div>
                                    <Link className="underline font-medium" href={`/dashboard/organization/positions/${positionNode.id}`}>
                                        Ажлын байр бэлтгэх
                                    </Link>
                                </div>
                            ),
                            variant: 'destructive',
                        });
                        return;
                    }
                } catch (e) {
                    console.error(e);
                    toast({
                        title: 'Алдаа гарлаа',
                        description: 'Ажлын байрны бэлтгэлийг шалгахад алдаа гарлаа. Дахин оролдоно уу.',
                        variant: 'destructive',
                    });
                    return;
                }

                setSelectedPosition(positionNode.data as any);
                setSelectedEmployeeForAppointment((employeeNode.data as any).employee);
                setIsAppointDialogOpen(true);
            })();
        },
        [nodes, toast, firestore]
    );

    return (
        <div className="flex flex-col h-full">
            {/* Draggable Stats Bar with Widgets */}
            <DashboardWidgetsBar
                order={widgetOrder}
                hidden={hiddenWidgets}
                onOrderChange={setOrder}
                onHideWidget={hideWidget}
                onShowWidget={showWidget}
                data={widgetData}
                isLoading={isStatsLoading || !isWidgetsLoaded}
                isModuleEnabled={isModuleEnabled}
                currentPlan={company?.plan || 'free'}
            />

            {/* Organization Chart - 80% height */}
            <div className="flex-1 relative w-full bg-[#f5f5f7] dark:bg-slate-950">
                {isLoading ? <SkeletonChart /> : (
                    <ReactFlow
                        nodes={nodes}
                        edges={edges}
                        onNodesChange={onNodesChange}
                        onEdgesChange={onEdgesChange}
                        onConnect={onConnect}
                        nodeTypes={STABLE_NODE_TYPES}
                        className="bg-transparent"
                        fitView>
                        <Background />
                        <Controls />
                        <Panel position="top-left" className="flex flex-col gap-2">
                            <Button
                                variant="outline"
                                size="icon"
                                className="bg-white/90 dark:bg-slate-900/90 backdrop-blur shadow-md hover:shadow-lg transition-all h-9 w-9 rounded-xl border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200"
                                onClick={resetLayout}
                                title="Байршил цэгцлэх"
                            >
                                <LayoutTemplate className="h-4 w-4 text-indigo-500" />
                            </Button>
                        </Panel>
                    </ReactFlow>
                )}
                <div className="absolute bottom-8 right-4 z-10 flex items-center gap-3 flex-shrink-0">
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    asChild
                                    size="icon"
                                    variant="default"
                                    className="rounded-full h-12 w-12 shadow-lg flex-shrink-0 bg-primary text-primary-foreground hover:bg-primary/90"
                                >
                                    <Link href="/dashboard/calendar">
                                        <Calendar className="h-6 w-6 text-primary-foreground" />
                                        <span className="sr-only">Календар</span>
                                    </Link>
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>Календар</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button 
                                    size="icon" 
                                    variant="default"
                                    className="rounded-full h-12 w-12 shadow-lg flex-shrink-0 bg-primary text-primary-foreground hover:bg-primary/90"
                                    onClick={() => setIsAddEmployeeDialogOpen(true)}
                                >
                                    <User className="h-6 w-6 text-primary-foreground" />
                                    <span className="sr-only">Ажилтан нэмэх</span>
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>Шинэ ажилтан нэмэх</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </div>
            </div>
            <AddEmployeeDialog 
                open={isAddEmployeeDialogOpen} 
                onOpenChange={setIsAddEmployeeDialogOpen} 
            />
            <UnassignedEmployeesDialog
                open={isUnassignedDialogOpen}
                onOpenChange={setIsUnassignedDialogOpen}
                employees={employees?.filter(e => !e.positionId && isActiveStatus(e.status)) || []}
                onAssign={(emp) => {
                    setSelectedEmployeeForAppointment(emp);
                    setIsAppointDialogOpen(true);
                    setIsUnassignedDialogOpen(false);
                }}
            />
            <AppointEmployeeDialog
                open={isAppointDialogOpen}
                onOpenChange={(open) => {
                    setIsAppointDialogOpen(open);
                    if (!open) setSelectedEmployeeForAppointment(null);
                }}
                position={selectedPosition}
                initialEmployee={selectedEmployeeForAppointment}
            />
            <ReleaseEmployeeDialog
                open={isReleaseDialogOpen}
                onOpenChange={(open) => {
                    setIsReleaseDialogOpen(open);
                    if (!open) {
                        setPositionForRelease(null);
                        setEmployeeForRelease(null);
                    }
                }}
                position={positionForRelease}
                employee={employeeForRelease}
            />
        </div >
    );
};

export default OrganizationChart;
