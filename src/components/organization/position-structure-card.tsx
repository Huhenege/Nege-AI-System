'use client';

import React from 'react';
import Link from 'next/link';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { CalendarCheck2, ExternalLink, LogIn, LogOut, MinusCircle, User } from 'lucide-react';
import { format } from 'date-fns';

export type PositionAttendanceStatus = {
  status: 'on-leave' | 'checked-in' | 'checked-out' | 'absent';
  checkInTime?: string;
  checkOutTime?: string;
};

export type PositionCardEmployee = {
  id?: string;
  firstName?: string;
  lastName?: string;
  employeeCode?: string;
  photoURL?: string;
  questionnaireCompletion?: number;
  status?: string;
  attendanceStatus?: PositionAttendanceStatus;
};

function AttendanceStatusPill({ status, isDarkBg }: { status: PositionAttendanceStatus; isDarkBg: boolean }) {
  const cfg = {
    'checked-in': {
      icon: LogIn,
      text: 'Ирсэн',
      bgColor: 'bg-emerald-500/20',
      textColor: isDarkBg ? 'text-emerald-200' : 'text-emerald-700',
      time: status.checkInTime ? format(new Date(status.checkInTime), 'HH:mm') : '',
    },
    'checked-out': {
      icon: LogOut,
      text: 'Явсан',
      bgColor: 'bg-rose-500/20',
      textColor: isDarkBg ? 'text-rose-200' : 'text-rose-700',
      time: status.checkOutTime ? format(new Date(status.checkOutTime), 'HH:mm') : '',
    },
    'on-leave': {
      icon: CalendarCheck2,
      text: 'Чөлөөтэй',
      bgColor: 'bg-sky-500/20',
      textColor: isDarkBg ? 'text-sky-200' : 'text-sky-700',
      time: '',
    },
    'absent': {
      icon: MinusCircle,
      text: 'Ирээгүй',
      bgColor: 'bg-slate-500/20',
      textColor: isDarkBg ? 'text-white/75' : 'text-slate-700',
      time: '',
    },
  }[status.status];

  const Icon = cfg.icon;
  return (
    <div className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold', cfg.bgColor, cfg.textColor)}>
      <Icon className="h-3 w-3" />
      <span>{cfg.text}</span>
      {cfg.time ? <span className="opacity-70">• {cfg.time}</span> : null}
    </div>
  );
}

function isColorDark(hex: string): boolean {
  if (!hex) return false;
  const color = hex.startsWith('#') ? hex.substring(1) : hex;
  const rgb = parseInt(color, 16);
  const r = (rgb >> 16) & 0xff;
  const g = (rgb >> 8) & 0xff;
  const b = (rgb >> 0) & 0xff;
  const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luma < 128;
}

function AvatarWithProgress({
  employee,
  size = 128,
  avatarSize = 96,
}: {
  employee?: PositionCardEmployee | null;
  size?: number;
  avatarSize?: number;
}) {
  const quesProgress = employee?.questionnaireCompletion || 0;
  const radius = (size - 4) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (quesProgress / 100) * circumference;
  const progressColor = quesProgress < 50 ? '#f43f5e' : quesProgress < 90 ? '#f59e0b' : '#10b981';

  const content = (
    <div className="relative mx-auto" style={{ width: size, height: size }}>
      <div className="absolute inset-0 flex items-center justify-center">
        <Avatar className="border-2 border-white/50" style={{ width: avatarSize, height: avatarSize }}>
          <AvatarImage src={employee?.photoURL} alt={employee?.firstName || ''} className="object-cover" />
          <AvatarFallback className="text-lg font-bold bg-gradient-to-br from-slate-100 to-slate-200 text-slate-600">
            {employee ? `${employee.firstName?.charAt(0) || ''}${employee.lastName?.charAt(0) || ''}` : <User className="h-6 w-6 text-slate-400" />}
          </AvatarFallback>
        </Avatar>
      </div>

      {employee && employee.questionnaireCompletion !== undefined && (
        <svg
          className="absolute inset-0 pointer-events-none -rotate-90"
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
        >
          <circle
            stroke="rgba(255,255,255,0.15)"
            strokeWidth="3"
            fill="transparent"
            r={radius}
            cx={size / 2}
            cy={size / 2}
          />
          <circle
            stroke={progressColor}
            strokeWidth="3"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            fill="transparent"
            r={radius}
            cx={size / 2}
            cy={size / 2}
            style={{ transition: 'stroke-dashoffset 0.6s ease-out' }}
          />
        </svg>
      )}
    </div>
  );

  if (employee?.id) return <Link href={`/dashboard/employees/${employee.id}`}>{content}</Link>;
  return content;
}

function EmployeeCover({
  employee,
  size = 96,
}: {
  employee?: PositionCardEmployee | null;
  size?: number;
}) {
  const content = (
    <div
      className={cn(
        'relative shrink-0 overflow-hidden rounded-full',
        'border border-white/25 bg-white/10'
      )}
      style={{ width: size, height: size }}
    >
      <Avatar className="h-full w-full rounded-full">
        <AvatarImage src={employee?.photoURL} alt={employee?.firstName || ''} className="object-cover" />
        <AvatarFallback className="h-full w-full rounded-full text-lg font-bold bg-gradient-to-br from-slate-100 to-slate-200 text-slate-600">
          {employee ? (
            `${employee.firstName?.charAt(0) || ''}${employee.lastName?.charAt(0) || ''}`
          ) : (
            <User className="h-6 w-6 text-slate-400" />
          )}
        </AvatarFallback>
      </Avatar>
    </div>
  );

  if (employee?.id) return <Link href={`/dashboard/employees/${employee.id}`}>{content}</Link>;
  return content;
}

export function PositionStructureCard({
  positionId,
  positionTitle,
  positionCode,
  companyType,
  subsidiaryName,
  departmentName,
  departmentColor,
  completionPct,
  employee,
  actions,
  actionsVisibility = 'hover',
  bottomLeftMeta,
  footerMeta,
  footerActions,
  // Backward-compatible props (deprecated)
  topSlot,
  bottomSlot,
}: {
  positionId: string;
  positionTitle: string;
  positionCode?: string;
  companyType?: 'main' | 'subsidiary';
  subsidiaryName?: string;
  departmentName?: string;
  departmentColor?: string;
  completionPct?: number;
  employee?: PositionCardEmployee | null;
  /** Rendered on hover in top-right */
  actions?: React.ReactNode;
  /** Control visibility of top-right actions */
  actionsVisibility?: 'hover' | 'always';
  /** Bottom-left subtle status text (e.g. Approved/Draft) */
  bottomLeftMeta?: React.ReactNode;
  /** Footer meta (badges/status) */
  footerMeta?: React.ReactNode;
  /** Footer actions (buttons/controls) */
  footerActions?: React.ReactNode;
  /** @deprecated use footerMeta */
  topSlot?: React.ReactNode;
  /** @deprecated use footerActions */
  bottomSlot?: React.ReactNode;
}) {
  const cardColor = departmentColor || '#1e293b';
  const isDarkBg = cardColor ? isColorDark(cardColor) : false;
  const hasEmployee = !!employee;
  const effectiveFooterMeta = footerMeta ?? topSlot;
  const effectiveFooterActions = footerActions ?? bottomSlot;
  const hasAttendance = !!employee?.attendanceStatus;
  const hasFooter =
    typeof completionPct === 'number' || !!bottomLeftMeta || !!effectiveFooterMeta || !!effectiveFooterActions || hasAttendance;
  const companyAffiliationLabel =
    subsidiaryName?.trim()
      ? subsidiaryName.trim()
      : companyType === 'subsidiary'
        ? 'Охин компани'
        : companyType === 'main'
          ? 'Үндсэн компани'
          : null;

  return (
    <div
      className={cn(
        'w-full max-w-[360px] rounded-2xl shadow-xl relative overflow-hidden transition-all duration-300 group',
        'hover:shadow-2xl hover:-translate-y-1',
        isDarkBg ? 'text-white' : 'text-slate-800'
      )}
      style={{ backgroundColor: cardColor }}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent pointer-events-none" />

      {/* Top accent line removed */}

      {/* Position code (subtle, top-left) */}
      {positionCode ? (
        <div
          className={cn(
            'absolute top-3 left-4 text-[10px] font-mono tracking-wider opacity-60 pointer-events-none'
          )}
        >
          {positionCode}
        </div>
      ) : null}

      {/* Actions (top-right) */}
      {actions ? (
        <div
          className={cn(
            'absolute top-3 right-3 z-10 flex items-center gap-1 transition-opacity',
            actionsVisibility === 'always' ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
          )}
        >
          {actions}
        </div>
      ) : null}

      {/* Give room for top-left code + top-right actions */}
      <div className="px-4 pb-4 pt-11 space-y-3">
        {/* Main row (horizontal) */}
        <div className="flex items-center gap-3">
          {/* Employee cover (left) */}
          <EmployeeCover employee={employee} size={84} />

          {/* Info (right) */}
          <div className="min-w-0 flex-1 space-y-1">
            {employee?.employeeCode ? (
              <div className={cn('text-[10px] font-mono tracking-wider', isDarkBg ? 'text-white/70' : 'text-slate-600')}>
                {employee.employeeCode}
              </div>
            ) : (
              <div className={cn('text-[10px] font-semibold tracking-wide', isDarkBg ? 'text-white/70' : 'text-slate-600')}>
                Сул орон тоо
              </div>
            )}

            {employee ? (
              <Link
                href={employee.id ? `/dashboard/employees/${employee.id}` : '#'}
                className="block"
              >
                <div className="flex flex-col min-w-0 leading-tight">
                  <span className={cn('text-sm font-semibold truncate', isDarkBg ? 'text-white/70' : 'text-slate-600')}>
                    {employee.lastName || ''}
                  </span>
                  <span className={cn('text-lg font-extrabold truncate', isDarkBg ? 'text-white' : 'text-slate-900')}>
                    {employee.firstName || ''}
                  </span>
                </div>
              </Link>
            ) : null}

            {companyAffiliationLabel ? (
              <div className={cn('text-xs font-medium truncate', isDarkBg ? 'text-white/60' : 'text-slate-600/90')}>
                {companyAffiliationLabel}
              </div>
            ) : null}

            <Link href={`/dashboard/organization/positions/${positionId}`} className="block">
              <div className={cn('text-sm font-semibold truncate', isDarkBg ? 'text-white/70' : 'text-slate-700')}>
                {positionTitle}
              </div>
            </Link>

            {departmentName ? (
              <div className={cn('text-xs font-medium truncate', isDarkBg ? 'text-white/60' : 'text-slate-600/90')}>
                {departmentName}
              </div>
            ) : null}
          </div>
        </div>

        {hasFooter && (
          <div className={cn('pt-2 mt-1', isDarkBg ? '' : '')}>
            {/* Progress (replaces divider) */}
            {typeof completionPct === 'number' ? (
              <div className="space-y-2">
                <div className={cn('flex items-center justify-between text-[10px] font-medium', isDarkBg ? 'text-white/70' : 'text-slate-600')}>
                  <span>Шаардлагтай мэдээлэл баталгаажуулалт</span>
                  <span>{Math.max(0, Math.min(100, Math.round(completionPct)))}%</span>
                </div>
                <div className={cn('h-1.5 w-full overflow-hidden rounded-full', isDarkBg ? 'bg-white/15' : 'bg-slate-200')}>
                  <div
                    className={cn('h-full', isDarkBg ? 'bg-white/70' : 'bg-slate-900')}
                    style={{ width: `${Math.max(0, Math.min(100, Math.round(completionPct)))}%` }}
                  />
                </div>
              </div>
            ) : null}

            {/* Bottom-left meta (status text) */}
            {bottomLeftMeta ? (
              <div className={cn('mt-2 text-[10px] font-medium tracking-wide opacity-75', isDarkBg ? 'text-white/75' : 'text-slate-700')}>
                {bottomLeftMeta}
              </div>
            ) : null}

            {effectiveFooterMeta ? (
              <div className={cn('flex flex-wrap items-center gap-2', (typeof completionPct === 'number' || bottomLeftMeta) ? 'mt-2' : '')}>
                {effectiveFooterMeta}
              </div>
            ) : null}
            {effectiveFooterActions ? (
              <div className={cn('flex flex-wrap items-center gap-2', effectiveFooterMeta || typeof completionPct === 'number' || bottomLeftMeta ? 'mt-2' : '')}>
                {effectiveFooterActions}
              </div>
            ) : null}

            {/* Attendance status (bottom-most) */}
            {employee?.attendanceStatus ? (
              <div className={cn('mt-2')}>
                <AttendanceStatusPill status={employee.attendanceStatus} isDarkBg={isDarkBg} />
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

export function PositionCardExternalLinkAction({ positionId, isDarkBg }: { positionId: string; isDarkBg?: boolean }) {
  return (
    <Link href={`/dashboard/organization/positions/${positionId}`} className="block">
      <div
        className={cn(
          'h-8 w-8 rounded-lg flex items-center justify-center transition-all',
          isDarkBg ? 'bg-white/20 hover:bg-white/30 text-white' : 'bg-black/10 hover:bg-black/20 text-slate-700'
        )}
      >
        <ExternalLink className="h-4 w-4" />
      </div>
    </Link>
  );
}

