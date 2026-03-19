import React, { memo, useState, useRef, useEffect } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Plus, Copy, UserPlus, Eye, MoreVertical } from 'lucide-react';
import { Position as PositionType } from '../../../types';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { PositionStructureCard } from '@/components/organization/position-structure-card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface PositionNodeData extends PositionType {
    levelName?: string;
    departmentColor?: string; // Color inherited from department
    departmentName?: string;
    assignedEmployee?: {
        id: string;
        firstName: string;
        lastName: string;
        employeeCode: string;
        photoURL?: string;
        status?: string;
    };
    onPositionClick?: (pos: PositionType) => void;
    onAddChild?: (parentId: string) => void;
    onDuplicate?: (pos: PositionType) => void;
    onAppoint?: (pos: PositionType) => void;
}

const RADIUS = 44;
const ACTIONS = [
    { key: 'view', angle: 90, Icon: Eye, label: 'Дэлгэрэнгүй', run: (ctx: { onPositionClick?: (p: PositionType) => void; data: PositionNodeData }) => ctx.onPositionClick?.(ctx.data as PositionType) },
    { key: 'add', angle: 150, Icon: Plus, label: 'Нэмэх', run: (ctx: { onAddChild?: (id: string) => void; id: string }) => ctx.onAddChild?.(ctx.id) },
    { key: 'duplicate', angle: 30, Icon: Copy, label: 'Хувилах', run: (ctx: { onDuplicate?: (p: PositionType) => void; data: PositionNodeData }) => ctx.onDuplicate?.(ctx.data as PositionType) },
] as const;

export const PositionFlowNode = memo(({ data, selected }: NodeProps<PositionNodeData>) => {
    const router = useRouter();
    const [menuOpen, setMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    const leaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const {
        id,
        title,
        code,
        isActive,
        isApproved,
        filled,
        levelName,
        departmentColor,
        departmentName,
        assignedEmployee,
        onPositionClick,
        onAddChild,
        onDuplicate,
        onAppoint
    } = data;

    const openMenu = () => {
        if (leaveTimerRef.current) {
            clearTimeout(leaveTimerRef.current);
            leaveTimerRef.current = null;
        }
        setMenuOpen(true);
    };

    const closeMenu = () => {
        leaveTimerRef.current = setTimeout(() => setMenuOpen(false), 250);
    };

    useEffect(() => {
        return () => {
            if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current);
        };
    }, []);

    const isAppointing = assignedEmployee?.status === 'appointing';
    const occupancyPct = (() => {
        // `filled` is used across the system; treat 0..1 as ratio, 0..100 as percent.
        if (typeof filled === 'number') {
            const pct = filled <= 1 ? filled * 100 : filled;
            return Math.max(0, Math.min(100, Math.round(pct)));
        }
        return assignedEmployee ? 100 : 0;
    })();

    const hasActions = onPositionClick || onAddChild || onDuplicate;
    const ctx = { onPositionClick, onAddChild, onDuplicate, data, id };

    return (
        <div className={cn(
            "relative z-10 selection:bg-none overflow-visible",
            selected ? "ring-4 ring-primary/30 scale-[1.02]" : "",
            isActive === false && "opacity-60 grayscale"
        )}>
            {/* Top Handle */}
            <Handle
                type="target"
                position={Position.Top}
                className="!bg-slate-400/20 !w-2 !h-2 !border-none !top-0"
            />
            <div className="relative overflow-visible">
                <PositionStructureCard
                    positionId={id}
                    positionTitle={title}
                    positionCode={code || `POS-${id.slice(-4).toUpperCase()}`}
                    companyType={(data as any).companyType}
                    subsidiaryName={(data as any).subsidiaryName}
                    departmentName={departmentName}
                    departmentColor={departmentColor}
                    employee={assignedEmployee as any}
                    completionPct={occupancyPct}
                    bottomLeftMeta={isApproved ? 'Батлагдсан' : 'Ноорог'}
                    actions={
                        hasActions ? (
                            /* Триггер нь доорх floating цэс дээр байрлана, карт дээр хоосон зай үлдээнэ */
                            <div className="w-8 h-8" aria-hidden />
                        ) : null
                    }
                    bottomSlot={
                        !assignedEmployee && isApproved ? (
                            <Button
                                size="sm"
                                className={cn(
                                    "w-full h-10 rounded-xl text-[11px] font-semibold gap-2",
                                    "bg-white/20 hover:bg-white/30 text-white border border-white/20 shadow-none"
                                )}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (onAppoint) onAppoint(data as PositionType);
                                }}
                            >
                                <UserPlus className="w-4 h-4" />
                                Томилгоо хийх
                            </Button>
                        ) : isAppointing ? (
                            <div className="text-center text-xs font-medium text-white/80">
                                Томилгоо хийгдэж байна…
                            </div>
                        ) : null
                    }
                />
                {/* Цэс картаас гадна, дээр нь — overflow-аас гарч бүрэн харагдана */}
                {hasActions && (
                    <TooltipProvider delayDuration={150}>
                        <div
                            ref={menuRef}
                            className={cn(
                                "absolute right-3 z-[100] overflow-visible transition-all duration-200",
                                menuOpen ? "top-0 w-[88px] h-[56px] -mt-11" : "top-3 w-8 h-8"
                            )}
                            onMouseEnter={openMenu}
                            onMouseLeave={closeMenu}
                        >
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <button
                                        type="button"
                                        className={cn(
                                            "h-8 w-8 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center transition-transform",
                                            menuOpen ? "absolute right-0 bottom-0 rotate-90" : "absolute right-0 top-0"
                                        )}
                                    >
                                        <MoreVertical className="h-4 w-4" />
                                    </button>
                                </TooltipTrigger>
                                <TooltipContent><div className="text-xs font-semibold">Үйлдлүүд</div></TooltipContent>
                            </Tooltip>
                            {ACTIONS.map(({ key, angle, Icon, label, run }, i) => {
                            const hasHandler = (key === 'view' && onPositionClick) || (key === 'add' && onAddChild) || (key === 'duplicate' && onDuplicate);
                            if (!hasHandler) return null;
                            const rad = (angle * Math.PI) / 180;
                            const x = Math.cos(rad) * RADIUS;
                            const y = -Math.sin(rad) * RADIUS;
                            return (
                                <Tooltip key={key}>
                                    <TooltipTrigger asChild>
                                        <button
                                            type="button"
                                            className={cn(
                                                "absolute h-9 w-9 rounded-full bg-white hover:bg-slate-50 text-slate-700 flex items-center justify-center shadow-lg border border-slate-200 transition-all duration-200",
                                                menuOpen ? "right-0 bottom-0" : "right-0 top-0",
                                                !menuOpen && "pointer-events-none invisible scale-0"
                                            )}
                                            style={{
                                                transform: menuOpen ? `translate(${x}px, ${y}px)` : 'translate(0, 0) scale(0)',
                                                transitionDelay: menuOpen ? `${i * 50}ms` : '0ms',
                                            }}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                run(ctx);
                                                setMenuOpen(false);
                                            }}
                                        >
                                            <Icon className="h-4 w-4" />
                                        </button>
                                    </TooltipTrigger>
                                    <TooltipContent side="left" className="z-[110]"><div className="text-xs font-semibold">{label}</div></TooltipContent>
                                </Tooltip>
                            );
                        })}
                        </div>
                    </TooltipProvider>
                )}
            </div>

            {/* Bottom Handle */}
            <Handle
                type="source"
                position={Position.Bottom}
                className="!bg-slate-400/20 !w-2 !h-2 !border-none !bottom-0"
            />
        </div>
    );
});

PositionFlowNode.displayName = 'PositionFlowNode';
