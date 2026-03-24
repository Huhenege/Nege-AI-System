'use client';

import React, { useMemo, useCallback, useEffect, useRef } from 'react';
import ReactFlow, {
    Background,
    Controls,
    useNodesState,
    useEdgesState,
    Node,
    Edge,
    BackgroundVariant,
    ConnectionLineType,
    Panel,
    ReactFlowProvider,
    useReactFlow,
} from 'reactflow';
import 'reactflow/dist/style.css';
import dagre from 'dagre';
import { PositionFlowNode } from './position-flow-node';
import { Position, Department } from '../../../types';
import { Button } from '@/components/ui/button';
import { LayoutTemplate } from 'lucide-react';
import { AppointEmployeeDialog } from './appoint-employee-dialog';
import { useToast } from '@/hooks/use-toast';

const NODE_TYPES = {
    positionNode: PositionFlowNode,
};

interface PositionStructureFlowCanvasProps {
    positions: Position[];
    employees: any[];
    department: Department;
    lookups: any;
    onPositionClick?: (pos: Position) => void;
    onAddChild?: (parentId: string) => void;
    onDuplicate?: (pos: Position) => void;
}

const getLayoutedElements = (nodes: Node[], edges: Edge[], direction = 'TB') => {
    const dagreGraph = new dagre.graphlib.Graph();
    dagreGraph.setDefaultEdgeLabel(() => ({}));

    // Keep in sync with PositionStructureCard sizing (horizontal layout)
    const nodeWidth = 360; // max-w-[360px]
    // Slightly taller to fit progress + status + optional footer actions
    const nodeHeight = 300;

    dagreGraph.setGraph({ rankdir: direction, nodesep: 110, ranksep: 170 });

    nodes.forEach((node) => {
        dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
    });

    edges.forEach((edge) => {
        dagreGraph.setEdge(edge.source, edge.target);
    });

    dagre.layout(dagreGraph);

    nodes.forEach((node) => {
        const nodeWithPosition = dagreGraph.node(node.id);
        node.targetPosition = 'top' as any;
        node.sourcePosition = 'bottom' as any;

        node.position = {
            x: nodeWithPosition.x - nodeWidth / 2,
            y: nodeWithPosition.y - nodeHeight / 2,
        };

        return node;
    });

    return { nodes, edges };
};

function FlowInner({
    positions,
    department,
    lookups,
    onPositionClick,
    onAddChild,
    initialNodes,
    initialEdges
}: PositionStructureFlowCanvasProps & { initialNodes: Node[], initialEdges: Edge[] }) {
    const { fitView } = useReactFlow();
    const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
    const nodeTypesRef = useRef(NODE_TYPES);

    useEffect(() => {
        setNodes(initialNodes);
        setEdges(initialEdges);
        setTimeout(() => fitView({ duration: 800 }), 100);
    }, [initialNodes, initialEdges, setNodes, setEdges, fitView]);

    const onLayout = useCallback(() => {
        const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(nodes, edges);
        setNodes([...layoutedNodes]);
        setEdges([...layoutedEdges]);
        window.requestAnimationFrame(() => fitView({ duration: 800 }));
    }, [nodes, edges, setNodes, setEdges, fitView]);

    return (
        <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            nodeTypes={nodeTypesRef.current}
            connectionLineType={ConnectionLineType.SmoothStep}
            fitView
            className="bg-dot-pattern"
        >
            <Background gap={24} size={1} variant={BackgroundVariant.Dots} className="opacity-50" />
            <Controls showInteractive={false} className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-xl rounded-xl p-1" />

            <Panel position="top-left" className="flex flex-col gap-2">
                <Button
                    variant="outline"
                    size="icon"
                    className="bg-white/90 dark:bg-slate-900/90 backdrop-blur shadow-md hover:shadow-lg transition-all h-9 w-9 rounded-xl border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200"
                    onClick={onLayout}
                    title="Байршил цэгцлэх"
                >
                    <LayoutTemplate className="h-4 w-4 text-indigo-500" />
                </Button>
            </Panel>
        </ReactFlow>
    );
}

export function PositionStructureFlowCanvas(props: PositionStructureFlowCanvasProps) {
    const { positions = [], employees = [], department, lookups, onPositionClick, onAddChild, onDuplicate } = props;
    const [isAppointDialogOpen, setIsAppointDialogOpen] = React.useState(false);
    const [selectedPosition, setSelectedPosition] = React.useState<Position | null>(null);
    const { toast } = useToast();

    const { initialNodes, initialEdges } = useMemo(() => {
        const nodes: Node[] = [];
        const edges: Edge[] = [];

        // Build a Map for quick lookup
        const posMap = new Map<string, Position>(positions.map(p => [p.id, p]));

        // Build employee map by positionId
        const employeeMap = new Map<string, any>(
            (employees || []).filter(emp => emp?.positionId).map(emp => [emp.positionId, {
                id: emp.id,
                firstName: emp.firstName,
                lastName: emp.lastName,
                employeeCode: emp.employeeCode,
                photoURL: emp.photoURL,
                status: emp.status
            }])
        );

        positions.forEach(pos => {
            const assignedEmployee = employeeMap.get(pos.id);
            nodes.push({
                id: pos.id,
                type: 'positionNode',
                data: {
                    ...pos,
                    levelName: lookups.levelMap[pos.levelId || ''] || 'Түвшин -',
                    departmentColor: lookups.departmentColorMap?.[pos.departmentId] || lookups.departmentColor,
                    departmentName: department?.name,
                    assignedEmployee,
                    onPositionClick,
                    onAddChild,
                    onDuplicate,
                    onAppoint: (pos: Position) => {
                        // Validate before opening appoint dialog
                        if (!pos.isApproved) {
                            toast({ variant: 'destructive', title: 'Томилох боломжгүй', description: 'Ажлын байр батлагдаагүй байна.' });
                            return;
                        }
                        if ((pos.filled || 0) >= 1) {
                            toast({ variant: 'destructive', title: 'Орон тоо дүүрсэн', description: `"${pos.title}" ажлын байранд ажилтан томилогдсон байна.` });
                            return;
                        }
                        setSelectedPosition(pos);
                        setIsAppointDialogOpen(true);
                    }
                },
                position: { x: 0, y: 0 },
            });

            if (pos.reportsToId && posMap.has(pos.reportsToId)) {
                edges.push({
                    id: `e-${pos.reportsToId}-${pos.id}`,
                    source: pos.reportsToId,
                    target: pos.id,
                    type: 'smoothstep',
                    animated: false,
                    style: { stroke: 'hsl(var(--muted-foreground) / 0.2)', strokeWidth: 2, strokeDasharray: '5,5' },
                });
            }
        });

        const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(nodes, edges);
        return { initialNodes: layoutedNodes, initialEdges: layoutedEdges };
    }, [positions, employees, lookups, onPositionClick, onAddChild, onDuplicate]);

    return (
        <div className="w-full h-full min-h-[500px] bg-background border-none rounded-xl overflow-visible relative group">
            <ReactFlowProvider>
                <FlowInner
                    {...props}
                    initialNodes={initialNodes}
                    initialEdges={initialEdges}
                />
            </ReactFlowProvider>

            <AppointEmployeeDialog
                open={isAppointDialogOpen}
                onOpenChange={setIsAppointDialogOpen}
                position={selectedPosition}
            />
        </div>
    );
}
