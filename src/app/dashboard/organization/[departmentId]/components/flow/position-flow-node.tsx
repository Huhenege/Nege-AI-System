import React, { memo, useState, useEffect, useCallback } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Plus, Copy, UserPlus, Eye } from 'lucide-react';
import { Position as PositionType } from '../../../types';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { PositionStructureCard, isColorDark } from '@/components/organization/position-structure-card';
import { PositionRadialMenu } from '@/components/organization/position-radial-menu';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PositionNodeData extends PositionType {
    levelName?: string;
    departmentColor?: string;
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

const isAppointingStatus = (s?: string) => s === 'appointing';

// ─── Main Node ────────────────────────────────────────────────────────────────

export const PositionFlowNode = memo(({ data, selected }: NodeProps<PositionNodeData>) => {
    const [menuOpen, setMenuOpen] = useState(false);
    const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

    const {
        id, title, code, isActive, isApproved, filled,
        departmentColor, departmentName, assignedEmployee,
        onPositionClick, onAddChild, onDuplicate, onAppoint,
    } = data;

    const openMenu = useCallback(() => {
        if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
        setMenuOpen(true);
    }, []);

    const closeMenu = useCallback(() => {
        timerRef.current = setTimeout(() => setMenuOpen(false), 220);
    }, []);

    useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

    const isAppointing = isAppointingStatus(assignedEmployee?.status);

    const occupancyPct = (() => {
        if (typeof filled === 'number') {
            const pct = filled <= 1 ? filled * 100 : filled;
            return Math.max(0, Math.min(100, Math.round(pct)));
        }
        return assignedEmployee ? 100 : 0;
    })();

    const cardColor = departmentColor || '#1e293b';
    const isDarkBg  = isColorDark(cardColor);

    // Shared RadialMenu-д дамжуулах action-ууд
    const radialActions = [
        onPositionClick && {
            key: 'view', angle: 90, Icon: Eye, label: 'Дэлгэрэнгүй',
            onClick: () => onPositionClick(data as PositionType),
        },
        onAddChild && {
            key: 'add', angle: 150, Icon: Plus, label: 'Дэд позиц нэмэх',
            onClick: () => onAddChild(id),
        },
        onDuplicate && {
            key: 'duplicate', angle: 30, Icon: Copy, label: 'Хувилах',
            onClick: () => onDuplicate(data as PositionType),
        },
    ].filter(Boolean) as React.ComponentProps<typeof PositionRadialMenu>['actions'];

    return (
        <div className={cn(
            'relative z-10 selection:bg-none overflow-visible',
            selected && 'ring-4 ring-primary/30 scale-[1.02]',
            isActive === false && 'opacity-60 grayscale',
        )}>
            <Handle type="target" position={Position.Top}
                className="!bg-slate-400/20 !w-2 !h-2 !border-none !top-0" />

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
                    footerActions={
                        !assignedEmployee && isApproved ? (
                            <Button size="sm" className={cn(
                                'w-full h-10 rounded-xl text-[11px] font-semibold gap-2',
                                'bg-white/20 hover:bg-white/30 text-white border border-white/20 shadow-none',
                            )} onClick={(e) => { e.stopPropagation(); onAppoint?.(data as PositionType); }}>
                                <UserPlus className="w-4 h-4" /> Томилгоо хийх
                            </Button>
                        ) : isAppointing ? (
                            <div className="text-center text-xs font-medium text-white/80">
                                Томилгоо хийгдэж байна…
                            </div>
                        ) : null
                    }
                />

                {radialActions.length > 0 && (
                    <PositionRadialMenu
                        open={menuOpen}
                        isDarkBg={isDarkBg}
                        actions={radialActions}
                        onOpen={openMenu}
                        onClose={closeMenu}
                    />
                )}
            </div>

            <Handle type="source" position={Position.Bottom}
                className="!bg-slate-400/20 !w-2 !h-2 !border-none !bottom-0" />
        </div>
    );
});

PositionFlowNode.displayName = 'PositionFlowNode';
