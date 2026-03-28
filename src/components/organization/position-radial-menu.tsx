'use client';

/**
 * PositionRadialMenu — PositionStructureCard дээр хэрэглэгдэх
 * hover + click аль алинд ажилладаг radial action menu.
 *
 * Wrapper нь WRAPPER_SIZE × WRAPPER_SIZE px хэмжээтэй тул
 * бүх радиал товчийг бүрэн хамрах hit area болно → flickering байхгүй.
 */

import React, { useRef } from 'react';
import { MoreVertical } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
    Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip';

// ─── Constants ────────────────────────────────────────────────────────────────

export const RADIAL_RADIUS = 50;  // trigger төвөөс радиал товч төв хүртэлх зай (px)
const TRIGGER_SIZE         = 32;  // trigger button (px)
const BTN_SIZE             = 44;  // радиал товч (px) — томруулсан
// Wrapper: trigger нь баруун доод буланд, товчнууд зүүн+дээш тийш гарна
export const WRAPPER_SIZE  = RADIAL_RADIUS + BTN_SIZE + TRIGGER_SIZE / 2; // ≈ 110px

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RadialAction {
    key: string;
    angle: number;   // градус — 0° баруун, 90° зүүн, 180° зүүн доош гэх мэт
    Icon: React.ComponentType<{ className?: string }>;
    label: string;
    onClick: () => void;
}

interface Props {
    open: boolean;
    isDarkBg?: boolean;
    actions: RadialAction[];
    onOpen: () => void;
    onClose: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function PositionRadialMenu({ open, isDarkBg = false, actions, onOpen, onClose }: Props) {
    if (actions.length === 0) return null;

    // Trigger байрлал wrapper дотор (баруун доод булан)
    const triggerTop  = WRAPPER_SIZE - TRIGGER_SIZE;
    const triggerLeft = WRAPPER_SIZE - TRIGGER_SIZE;
    const triggerCX   = triggerLeft + TRIGGER_SIZE / 2;
    const triggerCY   = triggerTop  + TRIGGER_SIZE / 2;

    return (
        <TooltipProvider delayDuration={100}>
            {/*
             * Wrapper нь WRAPPER_SIZE × WRAPPER_SIZE — бүх товч хамрагдана.
             * Карт-ийн баруун дээд буланд тавихын тулд:
             *   top  = -(WRAPPER_SIZE - TRIGGER_SIZE) - card_padding
             *   right = -card_padding
             */}
            <div
                className="absolute z-50"
                style={{
                    width:  WRAPPER_SIZE,
                    height: WRAPPER_SIZE,
                    top:   -(WRAPPER_SIZE - TRIGGER_SIZE) - 3,
                    right: -3,
                    overflow: 'visible',
                    pointerEvents: 'auto',
                }}
                onMouseEnter={onOpen}
                onMouseLeave={onClose}
            >
                {/* ── Trigger (no tooltip — давхардлаас сэргийлнэ) ── */}
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

                {/* ── Radial action buttons ── */}
                {actions.map(({ key, angle, Icon, label, onClick }, i) => {
                    const rad  = (angle * Math.PI) / 180;
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
                                        top:    btnCY - BTN_SIZE / 2,
                                        left:   btnCX - BTN_SIZE / 2,
                                        opacity:   open ? 1 : 0,
                                        transform: open ? 'scale(1)' : 'scale(0.5)',
                                        transitionDelay: open ? `${i * 40}ms` : '0ms',
                                    }}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onClick();
                                        onClose();
                                    }}
                                >
                                    <Icon className="h-5 w-5" />
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
