'use client';

import * as React from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronUp, Eye, Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Vacancy } from '@/types/recruitment';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

function vacancyTypeLabel(type?: Vacancy['type']) {
  switch (type) {
    case 'FULL_TIME':
      return 'Full-time';
    case 'PART_TIME':
      return 'Part-time';
    case 'CONTRACT':
      return 'Contract';
    case 'INTERNSHIP':
      return 'Internship';
    default:
      return undefined;
  }
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

function vacancyStatusLabel(status?: Vacancy['status']) {
  switch (status) {
    case 'OPEN':
      return { label: 'Нээлттэй', className: 'text-emerald-400' };
    case 'DRAFT':
      return { label: 'Ноорог', className: 'text-amber-300' };
    case 'CLOSED':
      return { label: 'Хаагдсан', className: 'text-white/70' };
    case 'PAUSED':
      return { label: 'Түр зогссон', className: 'text-white/70' };
    default:
      return { label: 'Төлөвгүй', className: 'text-white/70' };
  }
}

export function OpenVacancyCard({
  vacancy,
  departmentName,
  departmentColor,
  employmentTypeName,
  href,
  className,
  actionsVisibility = 'hover',
  topRightActions,
  showViewAction = true,
  showEditAction = false,
  editHref,
  onEdit,
  sections,
  detailsTitle,
  detailsDescription,
  detailsIcon,
  detailsOpen: controlledDetailsOpen,
  onDetailsOpenChange,
  detailsContent,
}: {
  vacancy: Vacancy;
  departmentName?: string;
  departmentColor?: string;
  employmentTypeName?: string;
  /** Defaults to vacancy detail page */
  href?: string;
  className?: string;
  /** Control visibility of top-right actions */
  actionsVisibility?: 'hover' | 'always';
  /** Optional custom actions (icon buttons) */
  topRightActions?: React.ReactNode;
  /** Show built-in view action (Eye icon) */
  showViewAction?: boolean;
  /** Show built-in edit action (pencil icon) */
  showEditAction?: boolean;
  /** Where edit should navigate (optional). If omitted, uses onEdit. */
  editHref?: string;
  /** Edit click handler (optional). Prefer for in-place editing. */
  onEdit?: () => void;
  /** Optional sections rendered under the main content (used on detail page) */
  sections?: Array<{
    title?: string;
    description?: string;
    content: React.ReactNode;
  }>;
  /** Optional expandable section (used on detail pages) */
  detailsTitle?: string;
  detailsDescription?: string;
  detailsIcon?: React.ReactNode;
  detailsOpen?: boolean;
  onDetailsOpenChange?: (open: boolean) => void;
  detailsContent?: React.ReactNode;
}) {
  const link = href ?? `/dashboard/recruitment/vacancies/${vacancy.id}`;
  const effectiveEditHref = editHref ?? link;
  const typeLabel = employmentTypeName || vacancyTypeLabel(vacancy.type);
  const statusMeta = vacancyStatusLabel(vacancy.status);
  const stageCount = vacancy.stages?.length ? vacancy.stages.length : 5;
  const cardColor = departmentColor || '#1e293b';
  const isDarkBg = isColorDark(cardColor);
  const showActions = !!topRightActions || showViewAction || showEditAction;

  const isDetailsControlled = typeof controlledDetailsOpen === 'boolean';
  const [internalDetailsOpen, setInternalDetailsOpen] = React.useState(false);
  const detailsOpen = isDetailsControlled ? (controlledDetailsOpen as boolean) : internalDetailsOpen;
  const setDetailsOpen = React.useCallback(
    (next: boolean) => {
      onDetailsOpenChange?.(next);
      if (!isDetailsControlled) setInternalDetailsOpen(next);
    },
    [onDetailsOpenChange, isDetailsControlled]
  );

  return (
    <div
      className={cn(
        'w-full max-w-[360px] rounded-2xl shadow-xl relative overflow-hidden transition-all duration-300 group',
        'hover:shadow-2xl hover:-translate-y-1',
        isDarkBg ? 'text-white' : 'text-slate-800',
        className
      )}
      style={{ backgroundColor: cardColor }}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent pointer-events-none" />

      {/* Click-anywhere overlay */}
      <Link href={link} className="absolute inset-0 z-0">
        <span className="sr-only">Ажлын байр дэлгэрэнгүй</span>
      </Link>

      {/* Top-right actions */}
      {showActions ? (
        <TooltipProvider delayDuration={150}>
          <div
            className={cn(
              'absolute top-3 right-3 z-10 flex items-center gap-1 transition-opacity pointer-events-auto',
              actionsVisibility === 'always' ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
            )}
          >
            {topRightActions ? <div className="flex items-center gap-1">{topRightActions}</div> : null}

            {showEditAction ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  {typeof onEdit === 'function' ? (
                    <button
                      type="button"
                      className={cn(
                        'h-8 w-8 rounded-lg flex items-center justify-center transition-all',
                        isDarkBg ? 'bg-white/20 hover:bg-white/30 text-white' : 'bg-black/10 hover:bg-black/20 text-slate-700'
                      )}
                      aria-label="Засах"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onEdit();
                      }}
                      onPointerDown={(e) => e.stopPropagation()}
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                  ) : (
                    <Link
                      href={effectiveEditHref}
                      className={cn(
                        'h-8 w-8 rounded-lg flex items-center justify-center transition-all',
                        isDarkBg ? 'bg-white/20 hover:bg-white/30 text-white' : 'bg-black/10 hover:bg-black/20 text-slate-700'
                      )}
                      aria-label="Засах"
                      onClick={(e) => e.stopPropagation()}
                      onPointerDown={(e) => e.stopPropagation()}
                    >
                      <Pencil className="h-4 w-4" />
                    </Link>
                  )}
                </TooltipTrigger>
                <TooltipContent>
                  <div className="text-xs font-semibold">Засах</div>
                </TooltipContent>
              </Tooltip>
            ) : null}

            {showViewAction ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link
                    href={link}
                    className={cn(
                      'h-8 w-8 rounded-lg flex items-center justify-center transition-all',
                      isDarkBg ? 'bg-white/20 hover:bg-white/30 text-white' : 'bg-black/10 hover:bg-black/20 text-slate-700'
                    )}
                    aria-label="Харах"
                    onClick={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}
                  >
                    <Eye className="h-4 w-4" />
                  </Link>
                </TooltipTrigger>
                <TooltipContent>
                  <div className="text-xs font-semibold">Харах</div>
                </TooltipContent>
              </Tooltip>
            ) : null}
          </div>
        </TooltipProvider>
      ) : null}

      {/* Top-left meta (like PositionStructureCard code) */}
      <div className={cn('absolute top-3 left-4 text-sm font-semibold tracking-wide opacity-90 pointer-events-none')}>
        <span className={cn('inline-flex items-center', statusMeta.className)}>{statusMeta.label}</span>
      </div>

      {/* Give room for meta + actions */}
      <div className="relative z-[1] px-4 pb-4 pt-11 space-y-4">
        {/* Main row (horizontal) */}
        <div className="flex items-center">
          {/* Info */}
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className={cn('text-sm font-semibold tracking-wide', isDarkBg ? 'text-white/70' : 'text-slate-600')}>
              Нээлтэй ажлын байр
            </div>

            <div className={cn('text-lg font-semibold leading-snug truncate', isDarkBg ? 'text-white' : 'text-slate-900')}>
              {vacancy.title}
            </div>
          </div>
        </div>

        {/* Key/value meta (simple, no icons) */}
        <div className="pt-2 mt-1 space-y-2.5">
          <div className={cn('flex items-center justify-between gap-3 text-sm', isDarkBg ? 'text-white/75' : 'text-slate-700')}>
            <span className={cn('shrink-0', isDarkBg ? 'text-white/60' : 'text-slate-500')}>Сонгон шалгаруулалтын үе шат</span>
            <span className={cn('font-medium tabular-nums truncate', isDarkBg ? 'text-white/90' : 'text-slate-900')}>{stageCount} үе шат</span>
          </div>

          {departmentName ? (
            <div className={cn('flex items-center justify-between gap-3 text-sm', isDarkBg ? 'text-white/75' : 'text-slate-700')}>
              <span className={cn('shrink-0', isDarkBg ? 'text-white/60' : 'text-slate-500')}>Алба нэгж</span>
              <span className={cn('font-medium truncate', isDarkBg ? 'text-white/90' : 'text-slate-900')}>{departmentName}</span>
            </div>
          ) : null}

          {vacancy.location ? (
            <div className={cn('flex items-center justify-between gap-3 text-sm', isDarkBg ? 'text-white/75' : 'text-slate-700')}>
              <span className={cn('shrink-0', isDarkBg ? 'text-white/60' : 'text-slate-500')}>Байршил</span>
              <span className={cn('font-medium truncate', isDarkBg ? 'text-white/90' : 'text-slate-900')}>{vacancy.location}</span>
            </div>
          ) : null}

          {vacancy.deadline ? (
            <div className={cn('flex items-center justify-between gap-3 text-sm', isDarkBg ? 'text-white/75' : 'text-slate-700')}>
              <span className={cn('shrink-0', isDarkBg ? 'text-white/60' : 'text-slate-500')}>Хаагдах хугацаа</span>
              <span className={cn('font-medium tabular-nums truncate', isDarkBg ? 'text-white/90' : 'text-slate-900')}>{vacancy.deadline.slice(0, 10)}</span>
            </div>
          ) : null}

          {typeLabel ? (
            <div className={cn('flex items-center justify-between gap-3 text-sm', isDarkBg ? 'text-white/75' : 'text-slate-700')}>
              <span className={cn('shrink-0', isDarkBg ? 'text-white/60' : 'text-slate-500')}>Төрөл</span>
              <span className={cn('font-medium truncate', isDarkBg ? 'text-white/90' : 'text-slate-900')}>{typeLabel}</span>
            </div>
          ) : null}
        </div>

        {/* Sections (used on detail page to remove extra cards) */}
        {sections?.length ? (
          <div className="pt-4 space-y-4">
            {sections.map((section, idx) => (
              <div
                key={`${section.title}-${idx}`}
                className={cn(
                  idx === 0 ? '' : 'pt-4 border-t',
                  isDarkBg ? 'border-white/15' : 'border-black/10'
                )}
              >
                {section.title || section.description ? (
                  <div className="min-w-0">
                    {section.title ? (
                      <div
                        className={cn(
                          'text-sm font-semibold tracking-wide truncate',
                          isDarkBg ? 'text-white/70' : 'text-slate-600'
                        )}
                      >
                        {section.title}
                      </div>
                    ) : null}
                    {section.description ? (
                      <div className={cn('text-sm mt-1', isDarkBg ? 'text-white/60' : 'text-slate-600')}>
                        {section.description}
                      </div>
                    ) : null}
                  </div>
                ) : null}
                <div
                  className={cn(
                    section.title || section.description ? 'mt-3' : 'mt-0',
                    'text-sm leading-relaxed',
                    isDarkBg
                      ? 'text-white/75 [&_.text-muted-foreground]:text-white/60 [&_.prose]:prose-invert [&_.prose]:max-w-none [&_.prose]:prose-sm [&_.prose]:text-inherit'
                      : 'text-slate-700 [&_.prose]:max-w-none [&_.prose]:prose-sm [&_.prose]:text-inherit'
                  )}
                >
                  {section.content}
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {/* Expandable details (used on detail page to replace the old card) */}
        {detailsContent ? (
          <div className="pt-3">
            <button
              type="button"
              onClick={() => setDetailsOpen(!detailsOpen)}
              className={cn(
                'w-full flex items-center justify-between gap-3 rounded-xl px-3 py-3 transition-colors',
                isDarkBg ? 'bg-white/10 hover:bg-white/15' : 'bg-black/5 hover:bg-black/10'
              )}
            >
              <div className="flex items-start gap-3 text-left">
                {detailsIcon ? (
                  <div
                    className={cn(
                      'mt-0.5 h-8 w-8 rounded-lg flex items-center justify-center shrink-0',
                      isDarkBg ? 'bg-white/15 text-white' : 'bg-black/10 text-slate-700'
                    )}
                  >
                    {detailsIcon}
                  </div>
                ) : null}
                <div className="min-w-0">
                  <div className={cn('text-sm font-semibold truncate', isDarkBg ? 'text-white' : 'text-slate-900')}>
                    {detailsTitle ?? 'Дэлгэрэнгүй'}
                  </div>
                  {detailsDescription ? (
                    <div className={cn('text-xs mt-0.5 line-clamp-2', isDarkBg ? 'text-white/70' : 'text-slate-600')}>
                      {detailsDescription}
                    </div>
                  ) : null}
                </div>
              </div>
              <div className={cn('h-8 w-8 rounded-lg flex items-center justify-center', isDarkBg ? 'bg-white/10' : 'bg-black/5')}>
                {detailsOpen ? (
                  <ChevronUp className={cn('h-4 w-4', isDarkBg ? 'text-white/70' : 'text-slate-600')} />
                ) : (
                  <ChevronDown className={cn('h-4 w-4', isDarkBg ? 'text-white/70' : 'text-slate-600')} />
                )}
              </div>
            </button>

            {detailsOpen ? (
              <div className={cn('mt-3 rounded-xl p-4', isDarkBg ? 'bg-white/10' : 'bg-white')}>
                {detailsContent}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

