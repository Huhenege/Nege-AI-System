import React, { memo, useState, useRef, useEffect, useCallback } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Plus, Copy, UserPlus, Eye, MoreVertical } from 'lucide-react';
import { Position as PositionType } from '../../../types';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { PositionStructureCard, isColorDark } from '@/components/organization/position-structure-card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

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

type AppointingStatus = 'appointing';
const isAppointingStatus = (s?: string): s is AppointingStatus => s === 'appointing';

// ─── Radial menu config ───────────────────────────────────────────────────────
// Зургийн дизайнтай тохируулсан: товчнууд карт дээрх баруун дээд буланд
// гарч ирэхдээ дээш (view), зүүн дээш (add), зүүн (duplicate) байрлана.
const RADIAL_RADIUS = 44; // px
const TRIGGER_SIZE  = 32; // trigger button хэмжээ (px)
const BTN_SIZE      = 36; // радиал товчны хэмжээ (px)
// Wrapper: trigger-г баруун доод буланд байрлуулж,
// радиал товчнууд зүүн+дээш тийш гарна.
// Wrapper хэмжээ = RADIAL_RADIUS + BTN_SIZE (товч бүрэн багтана) + TRIGGER_SIZE/2
const WRAPPER_SIZE  = RADIAL_RADIUS + BTN_SIZE + TRIGGER_SIZE / 2; // ≈ 94px

const ACTIONS = [
    {
        key: 'view'      as const,
        angle: 90,   // зүүн тийш
        Icon: Eye,
        label: 'Дэлгэрэнгүй',
        run: (ctx: ActionCtx) => ctx.onPositionClick?.(ctx.data as PositionType),
    },
    {
        key: 'add'       as const,
        angle: 150,  // зүүн доош
        Icon: Plus,
        label: 'Дэд позиц нэмэх',
        run: (ctx: ActionCtx) => ctx.onAddChild?.(ctx.id),
    },
    {
        key: 'duplicate' as const,
        angle: 30,   // баруун дээш
        Icon: Copy,
        label: 'Хувилах',
        run: (ctx: ActionCtx) => ctx.onDuplicate?.(ctx.data as PositionType),
    },
] as const;

interface ActionCtx {
    onPositionClick?: (p: PositionType) => void;
    onAddChild?: (id: string) => void;
    onDuplicate?: (p: PositionType) => void;
    data: PositionNodeData;
    id: string;
}

// ─── Radial Menu ──────────────────────────────────────────────────────────────

interface RadialMenuProps {
    open: boolean;
    isDarkBg: boolean;
    ctx: ActionCtx;
    onOpen: () => void;
    onClose: () => void;
    onAction: () => void;
}

function RadialMenu({ open, isDarkBg, ctx, onOpen, onClose, onAction }: RadialMenuProps) {
    const { onPositionClick, onAddChild, onDuplicate } = ctx;

    const activeActions = ACTIONS.filter(a =>
        (a.key === 'view'      && onPositionClick) ||
        (a.key === 'add'       && onAddChild) ||
        (a.key === 'duplicate' && onDuplicate)
    );

    if (activeActions.length === 0) return null;

    // ── Layout тооцоолол ──────────────────────────────────────────────────────
    // Wrapper нь WRAPPER_SIZE × WRAPPER_SIZE px тул бүх радиал товчийг
    // хамрах hit area байна. Хулгана wrapper-ийн доторхи ямар ч цэгт байхад
    // mouse event тасрахгүй → flickering байхгүй.
    //
    // Trigger: wrapper-ийн БАРУУН ДООД буланд байрлана.
    // Радиал товчнууд: trigger-ийн төвөөс RADIAL_RADIUS зайд, зүүн+дээш тийш.
    //
    //   wrapper top-left = карт-ийн top-right буланд (top=3, right=3)
    //   trigger top  = WRAPPER_SIZE - TRIGGER_SIZE  (доод тал)
    //   trigger left = WRAPPER_SIZE - TRIGGER_SIZE  (баруун тал)
    //
    const triggerTop  = WRAPPER_SIZE - TRIGGER_SIZE;  // trigger-ийн top px wrapper дотор
    const triggerLeft = WRAPPER_SIZE - TRIGGER_SIZE;  // trigger-ийн left px wrapper дотор
    const triggerCX   = triggerLeft + TRIGGER_SIZE / 2; // trigger-ийн төвийн X
    const triggerCY   = triggerTop  + TRIGGER_SIZE / 2; // trigger-ийн төвийн Y

    return (
        <TooltipProvider delayDuration={100}>
            {/*
             * Wrapper нь WRAPPER_SIZE × WRAPPER_SIZE px тул бүх товчийг хамрана.
             * Карт-ийн баруун дээд буланд байрлуулахын тулд top/right-г
             * wrapper-ийн хэмжээнд тохируулна:
             *   top  = -(WRAPPER_SIZE - TRIGGER_SIZE) - card_padding (≈3px)
             *   right = card_padding (≈3px)
             */}
            <div
                className="absolute z-50"
                style={{
                    width:  WRAPPER_SIZE,
                    height: WRAPPER_SIZE,
                    // Trigger-ийн position карт дотор top:3, right:3 хэвээр байна
                    top:   -(WRAPPER_SIZE - TRIGGER_SIZE) - 3,
                    right: -3,
                    // Pointer events: closed үед зөвхөн trigger-ийн area-д л ажиллана
                    pointerEvents: 'auto',
                }}
                onMouseEnter={onOpen}
                onMouseLeave={onClose}
            >
                {/* ── Trigger ── */}
                <Tooltip>
                    <TooltipTrigger asChild>
                        <button
                            type="button"
                            aria-label="Үйлдлүүд"
                            aria-expanded={open}
                            onClick={(e) => {
                                e.stopPropagation();
                                open ? onClose() : onOpen();
                            }}
                            className={cn(
                                'absolute flex items-center justify-center rounded-full',
                                'transition-all duration-200 z-10',
                                isDarkBg
                                    ? 'bg-white/20 hover:bg-white/35 text-white'
                                    : 'bg-black/10 hover:bg-black/20 text-slate-700',
                                open && 'rotate-90',
                            )}
                            style={{
                                width:  TRIGGER_SIZE,
                                height: TRIGGER_SIZE,
                                top:    triggerTop,
                                left:   triggerLeft,
                            }}
                        >
                            <MoreVertical className="h-4 w-4" />
                        </button>
                    </TooltipTrigger>
                    <TooltipContent side="left">
                        <span className="text-xs font-semibold">Үйлдлүүд</span>
                    </TooltipContent>
                </Tooltip>

                {/* ── Radial action buttons ── */}
                {activeActions.map(({ key, angle, Icon, label, run }, i) => {
                    const rad = (angle * Math.PI) / 180;
                    // Trigger-ийн төвөөс RADIAL_RADIUS зайд байрлуулна
                    const btnCX = triggerCX + Math.cos(rad) * RADIAL_RADIUS;
                    const btnCY = triggerCY - Math.sin(rad) * RADIAL_RADIUS;

                    return (
                        <Tooltip key={key}>
                            <TooltipTrigger asChild>
                                <button
                                    type="button"
                                    aria-label={label}
                                    className={cn(
                                        'absolute flex items-center justify-center rounded-full',
                                        'bg-white hover:bg-slate-50 text-slate-700',
                                        'shadow-lg border border-slate-200',
                                        'transition-all duration-200',
                                        !open && 'pointer-events-none',
                                    )}
                                    style={{
                                        width:  BTN_SIZE,
                                        height: BTN_SIZE,
                                        // Товчны төвийг (btnCX, btnCY)-д тавина
                                        top:    btnCY - BTN_SIZE / 2,
                                        left:   btnCX - BTN_SIZE / 2,
                                        opacity:   open ? 1 : 0,
                                        transform: open ? 'scale(1)' : 'scale(0.5)',
                                        transitionDelay: open ? `${i * 40}ms` : '0ms',
                                    }}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        run(ctx);
                                        onAction();
                                    }}
                                >
                                    <Icon className="h-4 w-4" />
                                </button>
                            </TooltipTrigger>
                            <TooltipContent side="left" className="z-[110]">
                                <span className="text-xs font-semibold">{label}</span>
                            </TooltipContent>
                        </Tooltip>
                    );
                })}
            </div>
        </TooltipProvider>
    );
}

// ─── Main Node ────────────────────────────────────────────────────────────────

export const PositionFlowNode = memo(({ data, selected }: NodeProps<PositionNodeData>) => {
    const [menuOpen, setMenuOpen] = useState(false);
    const leaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const {
        id,
        title,
        code,
        isActive,
        isApproved,
        filled,
        departmentColor,
        departmentName,
        assignedEmployee,
        onPositionClick,
        onAddChild,
        onDuplicate,
        onAppoint,
    } = data;

    // ── Menu open/close (hover + click дэмжинэ) ──
    const openMenu = useCallback(() => {
        if (leaveTimerRef.current) {
            clearTimeout(leaveTimerRef.current);
            leaveTimerRef.current = null;
        }
        setMenuOpen(true);
    }, []);

    const closeMenu = useCallback(() => {
        leaveTimerRef.current = setTimeout(() => setMenuOpen(false), 220);
    }, []);

    // Unmount + dependency change-д cleanup
    useEffect(() => {
        return () => {
            if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current);
        };
    }, []);

    // ── Derived values ──
    const isAppointing = isAppointingStatus(assignedEmployee?.status);

    const occupancyPct = (() => {
        if (typeof filled === 'number') {
            const pct = filled <= 1 ? filled * 100 : filled;
            return Math.max(0, Math.min(100, Math.round(pct)));
        }
        return assignedEmployee ? 100 : 0;
    })();

    const cardColor   = departmentColor || '#1e293b';
    const isDarkBg    = isColorDark(cardColor);
    const hasActions  = !!(onPositionClick || onAddChild || onDuplicate);
    const ctx: ActionCtx = { onPositionClick, onAddChild, onDuplicate, data, id };

    return (
        <div
            className={cn(
                'relative z-10 selection:bg-none overflow-visible',
                selected && 'ring-4 ring-primary/30 scale-[1.02]',
                isActive === false && 'opacity-60 grayscale',
            )}
        >
            {/* Top Handle */}
            <Handle
                type="target"
                position={Position.Top}
                className="!bg-slate-400/20 !w-2 !h-2 !border-none !top-0"
            />

            {/*
             * overflow-visible нь зөвхөн энд нэг удаа — радиал товчнуудыг
             * карт хилийн гадна харуулахад хэрэгтэй.
             */}
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
                    // RadialMenu wrapper нь карт дээр absolute байрлах тул
                    // actions prop-г ашиглахгүй — хоосон зай үлдэхгүй
                    footerActions={
                        !assignedEmployee && isApproved ? (
                            <Button
                                size="sm"
                                className={cn(
                                    'w-full h-10 rounded-xl text-[11px] font-semibold gap-2',
                                    'bg-white/20 hover:bg-white/30 text-white',
                                    'border border-white/20 shadow-none',
                                )}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onAppoint?.(data as PositionType);
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

                {/* ── Fix #1, #4, #5: Radial menu — hover + click, зөв angle, тогтвортой offset ── */}
                {hasActions && (
                    <RadialMenu
                        open={menuOpen}
                        isDarkBg={isDarkBg}
                        ctx={ctx}
                        onOpen={openMenu}
                        onClose={closeMenu}
                        onAction={() => setMenuOpen(false)}
                    />
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
