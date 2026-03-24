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
import { OrgChartFlowNode } from './org-chart-flow-node';
import { Department } from '../../types';
import { Button } from '@/components/ui/button';
import { Maximize2, Minimize2, ZoomIn, ZoomOut, RefreshCw, LayoutTemplate } from 'lucide-react';

const NODE_TYPES = {
    orgNode: OrgChartFlowNode,
};

interface OrgChartFlowCanvasProps {
    data: Department[];
    onDepartmentClick: (id: string) => void;
    onDepartmentUpdate?: (id: string, data: Partial<Department>) => void;
}

const getLayoutedElements = (nodes: Node[], edges: Edge[], direction = 'TB') => {
    const dagreGraph = new dagre.graphlib.Graph();
    dagreGraph.setDefaultEdgeLabel(() => ({}));

    const nodeWidth = 280; // Updated for larger cards
    const nodeHeight = 180; // Updated for larger cards

    dagreGraph.setGraph({ rankdir: direction, nodesep: 80, ranksep: 120 });

    nodes.forEach((node) => {
        dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
    });

    edges.forEach((edge) => {
        // Use minlen from edge data if provided to force gaps between levels
        const minlen = (edge.data as any)?.minlen || 1;
        dagreGraph.setEdge(edge.source, edge.target, { minlen });
    });

    dagre.layout(dagreGraph);

    nodes.forEach((node) => {
        const nodeWithPosition = dagreGraph.node(node.id);
        node.targetPosition = 'top' as any;
        node.sourcePosition = 'bottom' as any;

        // Level-based vertical offset for nodes that might be "higher" or "lower" than their natural rank
        // though minlen usually handles this, we can also fine-tune here if needed.

        node.position = {
            x: nodeWithPosition.x - nodeWidth / 2,
            y: nodeWithPosition.y - nodeHeight / 2,
        };

        return node;
    });

    return { nodes, edges };
};

const STABLE_NODE_TYPES = { orgNode: OrgChartFlowNode };

function FlowInner({ data, onDepartmentClick, initialNodes, initialEdges }: OrgChartFlowCanvasProps & { initialNodes: Node[], initialEdges: Edge[] }) {
    const { fitView } = useReactFlow();
    const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
    const nodeTypesRef = useRef(STABLE_NODE_TYPES);

    useEffect(() => {
        setNodes(initialNodes);
        setEdges(initialEdges);
        // Wait a bit for nodes to render before fitting view
        setTimeout(() => fitView({ duration: 800 }), 100);
    }, [initialNodes, initialEdges, setNodes, setEdges, fitView]);

    const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
        onDepartmentClick(node.id);
    }, [onDepartmentClick]);

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

export function OrgChartFlowCanvas({ data, onDepartmentClick, onDepartmentUpdate }: OrgChartFlowCanvasProps) {
    const { initialNodes, initialEdges } = useMemo(() => {
        const nodes: Node[] = [];
        const edges: Edge[] = [];

        const traverse = (dept: Department, isRoot = false, parentLevel = 0) => {
            const currentLevel = dept.typeLevel ?? (parentLevel + 1);
            nodes.push({
                id: dept.id,
                type: 'orgNode',
                data: {
                    ...dept,
                    label: dept.name,
                    isRoot: isRoot,
                    onDepartmentClick,
                    onDepartmentUpdate
                },
                position: { x: 0, y: 0 },
            });

            if (dept.children) {
                dept.children.forEach((child) => {
                    const childLevel = child.typeLevel ?? (currentLevel + 1);
                    const minlen = Math.max(1, childLevel - currentLevel);

                    edges.push({
                        id: `e-${dept.id}-${child.id}`,
                        source: dept.id,
                        target: child.id,
                        type: 'smoothstep',
                        animated: false,
                        data: { minlen },
                        style: { stroke: 'hsl(var(--muted-foreground) / 0.2)', strokeWidth: 2, strokeDasharray: '5,5' },
                    });
                    traverse(child, false, currentLevel);
                });
            }
        };

        data.forEach(root => traverse(root, true, root.typeLevel ?? 0));

        const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(nodes, edges);
        return { initialNodes: layoutedNodes, initialEdges: layoutedEdges };
    }, [data]);

    return (
        <div className="w-full h-[600px] bg-background border rounded-lg overflow-hidden relative group">
            <ReactFlowProvider>
                <FlowInner
                    data={data}
                    onDepartmentClick={onDepartmentClick}
                    onDepartmentUpdate={onDepartmentUpdate}
                    initialNodes={initialNodes}
                    initialEdges={initialEdges}
                />
            </ReactFlowProvider>
        </div>
    );
}
