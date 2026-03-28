import React, { memo, useState, useRef, useEffect, useCallback } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Plus, Copy, UserPlus, Eye, MoreVertical } from 'lucide-react';
import { Position as PositionType } from '../../../types';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { PositionStructureCard, PositionCardExternalLinkAction, isColorDark } from '@/components/organization/position-structure-card';
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
const RADIAL_RADIUS = 44; // px — CSS variable биш тул нэг газраас удирдана

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
    const wrapperRef = useRef<HTMLDivElement>(null);

    const activeActions = ACTIONS.filter(a =>
        (a.key === 'view'      && onPositionClick) ||
        (a.key === 'add'       && onAddChild) ||
        (a.key === 'duplicate' && onDuplicate)
    );

    if (activeActions.length === 0) return null;

    // ── Flickering fix ────────────────────────────────────────────────────────
    // Радиал товчнууд CSS transform-аар container-ийн hit area-с гадагш гарах
    // тул хулгана товч руу шилжихэд container-с гарах mouseleave гарч
    // close timer эхэлж flickering үүсдэг байсан.
    //
    // Шийдэл: mouseleave event-д relatedTarget (хулгана очих element) нь
    // манай wrapper-ийн дотор байгаа эсэхийг шалгана. Дотор байвал — зөвхөн
    // дотоод шилжилт тул хаахгүй.
    const handleMouseLeave = (e: React.MouseEvent<HTMLDivElement>) => {
        const related = e.relatedTarget as Node | null;
        if (wrapperRef.current && related && wrapperRef.current.contains(related)) {
            // Wrapper-ийн дотор хэвээр байна — хаахгүй
            return;
        }
        onClose();
    };

    // Радиал товчны байрлал тооцоолол:
    // Товчнууд "absolute top-0 left-0" байрлалтай (trigger-ийн төвтэй давхцана).
    // CSS transform-аар final position руу шилжинэ.
    // Trigger-ийн хэмжээ: 32×32px → центр offset = 16px
    // Радиал товчны хэмжээ: 36×36px → центр offset = 18px
    const TRIGGER_HALF = 16;  // 32px / 2
    const BTN_HALF     = 18;  // 36px / 2

    return (
        <TooltipProvider delayDuration={100}>
            <div
                ref={wrapperRef}
                className="absolute top-3 right-3 z-50"
                style={{ overflow: 'visible' }}
                onMouseEnter={onOpen}
                onMouseLeave={handleMouseLeave}
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
                                'relative z-10',
                                'h-8 w-8 rounded-full flex items-center justify-center',
                                'transition-all duration-200',
                                isDarkBg
                                    ? 'bg-white/20 hover:bg-white/35 text-white'
                                    : 'bg-black/10 hover:bg-black/20 text-slate-700',
                                open && 'rotate-90',
                            )}
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
                    // Trigger-ийн төвөөс (TRIGGER_HALF, TRIGGER_HALF) offset
                    const tx = Math.cos(rad) * RADIAL_RADIUS;
                    const ty = -Math.sin(rad) * RADIAL_RADIUS;

                    return (
                        <Tooltip key={key}>
                            <TooltipTrigger asChild>
                                <button
                                    type="button"
                                    aria-label={label}
                                    onMouseEnter={onOpen}  // радиал товч руу шилжихэд цэс хэвээр байна
                                    className={cn(
                                        'absolute',
                                        'h-9 w-9 rounded-full',
                                        'bg-white hover:bg-slate-50 text-slate-700',
                                        'flex items-center justify-center',
                                        'shadow-lg border border-slate-200',
                                        'transition-all duration-200',
                                        !open && 'pointer-events-none',
                                    )}
                                    style={{
                                        // Trigger-ийн төв = (TRIGGER_HALF, TRIGGER_HALF)
                                        // Товчны төвийг тэр цэгт тавьж offset-лэнэ
                                        top: TRIGGER_HALF - BTN_HALF + ty,
                                        left: TRIGGER_HALF - BTN_HALF + tx,
                                        opacity: open ? 1 : 0,
                                        transform: open ? 'scale(1)' : 'scale(0)',
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
                    // ── Fix #2: placeholder div устгаж PositionCardExternalLinkAction ашиглав
                    actions={
                        hasActions
                            ? <PositionCardExternalLinkAction positionId={id} isDarkBg={isDarkBg} />
                            : null
                    }
                    actionsVisibility="always"
                    // ── Fix #3: deprecated bottomSlot → footerActions болгов
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
