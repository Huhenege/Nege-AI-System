'use client';

import * as React from 'react';
import Link from 'next/link';
import { useCollection, useFirebase, useMemoFirebase, tenantCollection } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { Employee } from '@/app/dashboard/employees/data';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Search, Users, Building2, Phone, Mail } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ReactFlow, {
    Background,
    Controls,
    BackgroundVariant,
    Handle,
    Position as FlowHandlePosition,
    type Node,
    type Edge,
    MarkerType,
    ReactFlowProvider,
} from 'reactflow';
import 'reactflow/dist/style.css';
import dagre from 'dagre';

type Department = {
    id: string;
    name: string;
    parentId?: string | null;
}

type Position = {
    id: string;
    title: string;
    departmentId: string;
    isActive?: boolean;
    isApproved?: boolean;
    reportsToId?: string;
    reportsTo?: string;
    filled?: number;
}

function EmployeeListSkeleton() {
    return (
        <div className="space-y-2">
            {[1, 2, 3, 4, 5, 6].map(i => (
                <div key={i} className="flex items-start gap-4 p-4 bg-white rounded-2xl border border-slate-100">
                    <Skeleton className="h-12 w-12 rounded-full" />
                    <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-3 w-24" />
                        <Skeleton className="h-3 w-40" />
                    </div>
                </div>
            ))}
        </div>
    );
}

function EmployeeListItem({ employee, department }: { employee: Employee; department?: Department }) {
    return (
        <div className="flex items-start gap-4 p-4 bg-white rounded-2xl border border-slate-100 shadow-sm">
            <div className="relative">
                <Avatar className="h-12 w-12 ring-2 ring-white shadow-sm">
                    <AvatarImage src={employee.photoURL} alt={`${employee.firstName} ${employee.lastName}`} className="object-cover" />
                    <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-purple-500 text-white font-semibold text-lg">
                        {employee.firstName?.charAt(0)}
                    </AvatarFallback>
                </Avatar>
            </div>

            <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-slate-900 truncate">
                    {employee.lastName} {employee.firstName}
                </h3>
                <p className="text-sm text-slate-500 truncate">
                    {employee.jobTitle || 'Ажилтан'}
                </p>

                {department && (
                    <div className="flex items-center gap-1 mt-1">
                        <Building2 className="h-3 w-3 text-slate-400" />
                        <span className="text-xs text-slate-400">{department.name}</span>
                    </div>
                )}

                <div className="mt-2 space-y-1">
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                        <Mail className="h-3.5 w-3.5 text-slate-400" />
                        <span className="truncate">{employee.email || '—'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                        <Phone className="h-3.5 w-3.5 text-slate-400" />
                        <span className="truncate">{employee.phoneNumber || '—'}</span>
                    </div>
                </div>
            </div>
        </div>
    );
}

function StructureSkeleton() {
    return (
        <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
                <div key={i} className="bg-white rounded-2xl border border-slate-100 p-4">
                    <div className="flex items-center justify-between">
                        <Skeleton className="h-4 w-40" />
                        <Skeleton className="h-5 w-12" />
                    </div>
                    <div className="mt-3 space-y-2">
                        <Skeleton className="h-3 w-56" />
                        <Skeleton className="h-3 w-44" />
                    </div>
                </div>
            ))}
        </div>
    );
}

function OrgStructureView({
    departments,
    positions,
    employees,
}: {
    departments: Department[];
    positions: Position[];
    employees: Employee[];
}) {
    // --- Read-only org chart (ReactFlow) similar to admin dashboard approach ---
    type PositionNodeData = {
        title: string;
        departmentName: string;
        departmentColor?: string;
        employeeName?: string;
        employeePhotoURL?: string;
        employeeEmail?: string;
        employeePhone?: string;
        filled?: number;
    };

    const deptMap = React.useMemo(() => new Map(departments.map((d) => [d.id, d])), [departments]);

    const approvedPositions = React.useMemo(() => {
        return (positions || []).filter((p) => p.isApproved !== false);
    }, [positions]);

    const posToEmployees = React.useMemo(() => {
        const m = new Map<string, Employee[]>();
        (employees || []).forEach((e) => {
            if (!e.positionId) return;
            if (!m.has(e.positionId)) m.set(e.positionId, []);
            m.get(e.positionId)!.push(e);
        });
        return m;
    }, [employees]);

    const nodeTypes = React.useMemo(() => {
        const PositionNode = ({ data }: { data: PositionNodeData }) => {
            const isDarkBg = !!data.departmentColor;
            const initials = (data.employeeName || '')
                .split(' ')
                .filter(Boolean)
                .slice(0, 2)
                .map((p) => p.charAt(0))
                .join('');

            return (
                <div className="relative">
                    {/* Handles are required for edges to render with custom nodes */}
                    <Handle
                        type="target"
                        position={FlowHandlePosition.Top}
                        className="!opacity-0 !w-2 !h-2 !border-0"
                    />
                    <div
                        className="w-[280px] rounded-2xl border shadow-lg overflow-hidden"
                        style={{ backgroundColor: data.departmentColor || '#0f172a' }}
                    >
                        <div className="p-4">
                            <div className={cn("text-xs font-semibold opacity-80", isDarkBg ? "text-white" : "text-slate-100")}>
                                {data.departmentName}
                            </div>
                            <div className={cn("mt-1 text-base font-bold leading-snug", "text-white")}>
                                {data.title}
                            </div>

                            <div className="mt-3 rounded-xl bg-white/10 border border-white/10 p-3">
                                <div className="flex items-start gap-3">
                                    <Avatar className="h-10 w-10 ring-2 ring-white/30 shrink-0">
                                        <AvatarImage src={data.employeePhotoURL} alt={data.employeeName || ''} className="object-cover" />
                                        <AvatarFallback className="bg-white/15 text-white font-semibold">
                                            {initials || '—'}
                                        </AvatarFallback>
                                    </Avatar>

                                    <div className="min-w-0 flex-1">
                                        <div className="font-semibold text-white truncate">
                                            {data.employeeName || 'Томилоогүй'}
                                        </div>
                                        <div className="text-xs text-white/70 truncate">
                                            {data.title}
                                        </div>

                                        {data.employeeName ? (
                                            <div className="mt-2 space-y-1">
                                                <div className="flex items-center gap-2 text-[11px] text-white/80">
                                                    <Mail className="h-3.5 w-3.5 text-white/60" />
                                                    <span className="truncate">{data.employeeEmail || '—'}</span>
                                                </div>
                                                <div className="flex items-center gap-2 text-[11px] text-white/80">
                                                    <Phone className="h-3.5 w-3.5 text-white/60" />
                                                    <span className="truncate">{data.employeePhone || '—'}</span>
                                                </div>
                                            </div>
                                        ) : null}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <Handle
                        type="source"
                        position={FlowHandlePosition.Bottom}
                        className="!opacity-0 !w-2 !h-2 !border-0"
                    />
                </div>
            );
        };

        return { positionNode: PositionNode };
    }, []);

    const { nodes, edges } = React.useMemo(() => {
        const nodes: Node<PositionNodeData>[] = [];
        const edges: Edge[] = [];

        approvedPositions.forEach((p) => {
            const dept = deptMap.get(p.departmentId);
            const assigned = posToEmployees.get(p.id) || [];
            const emp = assigned[0];
            nodes.push({
                id: p.id,
                type: 'positionNode',
                position: { x: 0, y: 0 },
                targetPosition: 'top' as any,
                sourcePosition: 'bottom' as any,
                data: {
                    title: p.title,
                    departmentName: dept?.name || 'Тодорхойгүй',
                    departmentColor: (dept as any)?.color,
                    employeeName: emp ? `${emp.firstName || ''} ${emp.lastName || ''}`.trim() : undefined,
                    employeePhotoURL: emp?.photoURL,
                    employeeEmail: emp?.email,
                    employeePhone: (emp as any)?.phoneNumber,
                    filled: (p as any)?.filled ?? assigned.length,
                },
            });

            const managerId = (p as any).reportsToId || (p as any).reportsTo;
            if (managerId && approvedPositions.some((x) => x.id === managerId)) {
                edges.push({
                    id: `e-${managerId}-${p.id}`,
                    source: managerId,
                    target: p.id,
                    type: 'smoothstep',
                    animated: true,
                    // Make connections very visible on mobile
                    style: { strokeWidth: 4, stroke: '#2563eb' },
                    markerEnd: { type: MarkerType.ArrowClosed, color: '#2563eb' },
                });
            }
        });

        // Dagre layout tuned for the larger cards on mobile
        const g = new dagre.graphlib.Graph();
        g.setDefaultEdgeLabel(() => ({}));
        g.setGraph({ rankdir: 'TB', nodesep: 90, ranksep: 220 });

        const nodeWidth = 280;
        // Card is taller now (employee details). Keep generous height for clean edge routing.
        const nodeHeight = 240;

        nodes.forEach((n) => g.setNode(n.id, { width: nodeWidth, height: nodeHeight }));
        edges.forEach((e) => g.setEdge(e.source, e.target));
        dagre.layout(g);

        nodes.forEach((n) => {
            const p = g.node(n.id);
            n.position = { x: p.x - nodeWidth / 2, y: p.y - nodeHeight / 2 };
        });

        return { nodes, edges };
    }, [approvedPositions, deptMap, posToEmployees]);

    return (
        <div className="w-full h-[70vh] bg-white rounded-2xl border border-slate-100 overflow-hidden">
            <ReactFlowProvider>
                <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    nodeTypes={nodeTypes as any}
                    fitView
                    nodesDraggable={false}
                    nodesConnectable={false}
                    elementsSelectable={false}
                    zoomOnDoubleClick={false}
                    className="bg-dot-pattern"
                >
                    <Background gap={24} size={1} variant={BackgroundVariant.Dots} className="opacity-30" />
                    <Controls showInteractive={false} />
                </ReactFlow>
            </ReactFlowProvider>
        </div>
    );
}

export default function EmployeesListPage() {
    const { firestore } = useFirebase();
    const [searchQuery, setSearchQuery] = React.useState('');
    const [tab, setTab] = React.useState<'list' | 'structure'>('list');

    // Fetch employees
    const employeesQuery = useMemoFirebase(
        ({ companyPath }) => firestore ? query(tenantCollection(firestore, companyPath, 'employees'), orderBy('firstName')) : null,
        [firestore]
    );
    const { data: employees, isLoading: isLoadingEmployees } = useCollection<Employee>(employeesQuery);

    const departmentsQuery = useMemoFirebase(
        ({ companyPath }) => firestore ? tenantCollection(firestore, companyPath, 'departments') : null,
        [firestore]
    );
    const { data: departments, isLoading: isLoadingDepartments } = useCollection<Department>(departmentsQuery as any);

    const positionsQuery = useMemoFirebase(
        ({ companyPath }) => firestore ? query(tenantCollection(firestore, companyPath, 'positions'), orderBy('title')) : null,
        [firestore]
    );
    const { data: positions, isLoading: isLoadingPositions } = useCollection<Position>(positionsQuery as any);

    // Filter employees based on search
    const filteredEmployees = React.useMemo(() => {
        if (!employees) return [];

        return employees.filter(emp => {
            // Filter by search query
            const searchLower = searchQuery.toLowerCase();
            const matchesSearch = searchQuery === '' ||
                emp.firstName?.toLowerCase().includes(searchLower) ||
                emp.lastName?.toLowerCase().includes(searchLower) ||
                emp.jobTitle?.toLowerCase().includes(searchLower) ||
                emp.email?.toLowerCase().includes(searchLower) ||
                emp.phoneNumber?.toLowerCase().includes(searchLower);

            return matchesSearch;
        });
    }, [employees, searchQuery]);

    const isLoading = isLoadingEmployees || isLoadingDepartments || isLoadingPositions;

    return (
        <div className="min-h-screen bg-slate-50/50 pb-20">
            {/* Header */}
            <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-xl border-b border-slate-200/50 px-4 py-4 shadow-sm">
                <div className="flex items-center gap-3">
                    <Button asChild variant="ghost" size="icon" className="rounded-full">
                        <Link href="/mobile/home">
                            <ArrowLeft className="h-5 w-5" />
                            <span className="sr-only">Буцах</span>
                        </Link>
                    </Button>
                    <div className="flex-1">
                        <h1 className="text-lg font-semibold text-slate-900">Хамт олон</h1>
                        <p className="text-xs text-slate-500">
                            {employees
                                ? (searchQuery ? `${filteredEmployees.length}/${employees.length} ажилтан` : `${employees.length} ажилтан`)
                                : 'Ачааллаж байна...'}
                        </p>
                    </div>
                    <div className="flex items-center justify-center h-10 w-10 rounded-full bg-primary/10">
                        <Users className="h-5 w-5 text-primary" />
                    </div>
                </div>

                {/* Search bar */}
                <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="mt-4">
                    <TabsList className="w-full bg-slate-100/80 p-1 rounded-2xl h-12">
                        <TabsTrigger value="list" className="flex-1 rounded-xl text-[11px] font-semibold uppercase">
                            Жагсаалт
                        </TabsTrigger>
                        <TabsTrigger value="structure" className="flex-1 rounded-xl text-[11px] font-semibold uppercase">
                            Бүтцийн зураглал
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="list" className="mt-3">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <Input
                                placeholder="Нэр, албан тушаал, имэйл, утсаар хайх..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-10 rounded-xl border-slate-200 bg-slate-50 focus:bg-white transition-colors"
                            />
                        </div>
                    </TabsContent>
                    <TabsContent value="structure" className="mt-0" />
                </Tabs>
            </header>

            {/* Content */}
            <main className="p-4 space-y-6">
                {tab === 'list' ? (
                    isLoading ? (
                        <EmployeeListSkeleton />
                    ) : filteredEmployees.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-center">
                            <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                                <Users className="w-10 h-10 text-slate-400" />
                            </div>
                            <h3 className="text-lg font-semibold text-slate-900">Ажилтан олдсонгүй</h3>
                            <p className="text-sm text-slate-500 mt-1">
                                {searchQuery ? 'Хайлтын үр дүн байхгүй байна' : 'Одоогоор ажилтан бүртгэгдээгүй байна'}
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {filteredEmployees.map(emp => (
                                <EmployeeListItem
                                    key={emp.id}
                                    employee={emp}
                                />
                            ))}
                        </div>
                    )
                ) : (
                    isLoading ? (
                        <StructureSkeleton />
                    ) : !departments || departments.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-center">
                            <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                                <Building2 className="w-10 h-10 text-slate-400" />
                            </div>
                            <h3 className="text-lg font-semibold text-slate-900">Бүтэц олдсонгүй</h3>
                            <p className="text-sm text-slate-500 mt-1">
                                Одоогоор хэлтэс/нэгж бүртгэгдээгүй байна
                            </p>
                        </div>
                    ) : (
                        <OrgStructureView
                            departments={departments}
                            positions={positions || []}
                            employees={employees || []}
                        />
                    )
                )}
            </main>
        </div>
    );
}
