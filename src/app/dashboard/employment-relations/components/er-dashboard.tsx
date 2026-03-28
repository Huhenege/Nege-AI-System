'use client';

import * as React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { AddActionButton } from '@/components/ui/add-action-button';
import { FileCode, FileText, Clock } from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { ERDocument, ERDocumentType, DocumentStatus } from '../types';

// ─── Status colours (matching document-pipeline) ─────────────────────────────
const STATUS_COLORS: Record<string, string> = {
  DRAFT: '#94a3b8',
  IN_REVIEW: '#f59e0b',
  REVIEWED: '#3b82f6',
  SIGNED: '#10b981',
  SENT_TO_EMPLOYEE: '#b45309',
  ACKNOWLEDGED: '#0d9488',
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Төлөвлөх',
  IN_REVIEW: 'Хянах',
  REVIEWED: 'Хянагдсан',
  SIGNED: 'Баталгаажсан',
  SENT_TO_EMPLOYEE: 'Танилцуулах',
  ACKNOWLEDGED: 'Танилцсан',
};

const PIE_STATUS_ORDER: DocumentStatus[] = [
  'DRAFT',
  'IN_REVIEW',
  'REVIEWED',
  'SIGNED',
  'SENT_TO_EMPLOYEE',
  'ACKNOWLEDGED',
];

interface ERTemplateSummary {
  id: string;
  isSystem?: boolean;
}

interface ERDashboardProps {
  documents: ERDocument[] | null;
  docTypes: ERDocumentType[] | null;
  templates: ERTemplateSummary[] | null;
  isLoading: boolean;
}

export function ERDashboard({
  documents,
  docTypes,
  templates,
  isLoading,
}: ERDashboardProps) {
  const templateStats = React.useMemo(() => {
    if (!templates) return { system: 0, user: 0, total: 0 };
    const system = templates.filter((t) => t.isSystem === true).length;
    const user = templates.filter((t) => !t.isSystem).length;
    return { system, user, total: templates.length };
  }, [templates]);
  const metrics = React.useMemo(() => {
    if (!documents) {
      return {
        total: 0,
        pendingCount: 0,
        rejectedCount: 0,
        statusData: [] as { name: string; value: number; color: string }[],
      };
    }

    const total = documents.length;

    // Pending: DRAFT, IN_REVIEW, REVIEWED, SENT_TO_EMPLOYEE
    const pendingStatuses = ['DRAFT', 'IN_REVIEW', 'REVIEWED', 'SENT_TO_EMPLOYEE'];
    const pendingCount = documents.filter((d) => pendingStatuses.includes(d.status)).length;
    const rejectedCount = documents.filter((d) => d.status === 'REJECTED').length;

    // Status distribution
    const statusCounts: Record<string, number> = {};
    PIE_STATUS_ORDER.forEach((s) => {
      statusCounts[s] = 0;
    });
    documents.forEach((d) => {
      if (d.status === 'APPROVED') {
        statusCounts['SIGNED'] = (statusCounts['SIGNED'] || 0) + 1;
      } else if (PIE_STATUS_ORDER.includes(d.status)) {
        statusCounts[d.status] = (statusCounts[d.status] || 0) + 1;
      }
    });

    const statusData = PIE_STATUS_ORDER.map((status) => ({
      name: STATUS_LABELS[status] || status,
      value: statusCounts[status] || 0,
      color: STATUS_COLORS[status] || '#94a3b8',
    })).filter((d) => d.value > 0);

    return {
      total,
      pendingCount,
      rejectedCount,
      statusData,
    };
  }, [documents]);

  if (isLoading) {
    return (
      <Card className="bg-slate-900 dark:bg-slate-800 border-slate-700">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-6">
            <Skeleton className="h-5 w-48 bg-slate-700" />
            <Skeleton className="h-9 w-9 rounded-lg bg-slate-700" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Skeleton className="h-48 w-full rounded-xl bg-slate-700" />
            <Skeleton className="h-48 w-full rounded-xl bg-slate-700" />
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full rounded-lg bg-slate-700" />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-slate-900 dark:bg-slate-800 border-slate-700 overflow-hidden relative">
      {/* Decorative gradient (matches dashboard) */}
      <div className="absolute -right-6 -bottom-6 w-28 h-28 rounded-full blur-3xl bg-gradient-to-br from-blue-500/10 to-indigo-500/10" />
      <CardContent className="p-5 sm:p-6 relative z-10">
        {/* ── Header ───────────────────────────────────────────────── */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-[10px] sm:text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Dashboard | хөдөлмөрийн харилцаа
            </h3>
          </div>
          <AddActionButton
            label="Шинэ документ"
            description="Шинэ процесс/баримт үүсгэх"
            href="/dashboard/employment-relations/create"
          />
        </div>

        {/* ── Main grid: Status donut | Summary stats ──── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* ── Left: Status donut ────── */}
          <div>
            <div className="rounded-xl bg-slate-800/50 dark:bg-slate-700/30 border border-slate-700/60 p-4 h-full flex flex-col">
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-3">
                Баримтын төлөв
              </p>
              {metrics.statusData.length > 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center">
                  <div className="w-full h-[170px] relative">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={metrics.statusData}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={75}
                          paddingAngle={3}
                          dataKey="value"
                          stroke="none"
                        >
                          {metrics.statusData.map((entry, i) => (
                            <Cell key={i} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            borderRadius: '8px',
                            border: 'none',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                            fontSize: '12px',
                            backgroundColor: '#1e293b',
                            color: '#f8fafc',
                          }}
                          formatter={(value: number, name: string) => [`${value} баримт`, name]}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="text-center">
                        <div className="text-2xl font-extrabold text-white leading-none">{metrics.total}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">нийт баримт</div>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap justify-center gap-x-3 gap-y-1.5 mt-3">
                    {metrics.statusData.map((item) => (
                      <div key={item.name} className="flex items-center gap-1.5">
                        <span
                          className="inline-block h-2 w-2 rounded-full shrink-0"
                          style={{ backgroundColor: item.color }}
                        />
                        <span className="text-[11px] text-slate-400 whitespace-nowrap">
                          {item.name} ({item.value})
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center text-xs text-slate-500">
                  Мэдээлэл байхгүй
                </div>
              )}
            </div>
          </div>

          {/* ── Right: Summary stats ─────── */}
          <div className="lg:col-span-2 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Pending */}
              <div className="rounded-xl bg-slate-800/50 dark:bg-slate-700/30 border border-slate-700/60 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="h-3.5 w-3.5 text-amber-400" />
                  <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">
                    Хүлээгдэж буй
                  </p>
                </div>
                <div className="flex items-end gap-3">
                  <div>
                    <div className="text-2xl font-extrabold text-amber-400 leading-none">{metrics.pendingCount}</div>
                    <p className="text-[10px] text-slate-500 mt-0.5">баримт</p>
                  </div>
                  {metrics.rejectedCount > 0 && (
                    <div className="mb-0.5">
                      <div className="text-lg font-bold text-rose-400 leading-none">{metrics.rejectedCount}</div>
                      <p className="text-[10px] text-rose-500/70 mt-0.5">татгалзсан</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Document types */}
              <div className="rounded-xl bg-slate-800/50 dark:bg-slate-700/30 border border-slate-700/60 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="h-3.5 w-3.5 text-blue-400" />
                  <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">
                    Баримтын төрөл
                  </p>
                </div>
                <div className="text-2xl font-extrabold text-white leading-none">{docTypes?.length ?? 0}</div>
                <p className="text-[10px] text-slate-500 mt-0.5">төрөл</p>
              </div>

              {/* Templates */}
              <div className="rounded-xl bg-slate-800/50 dark:bg-slate-700/30 border border-slate-700/60 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <FileCode className="h-3.5 w-3.5 text-indigo-400" />
                  <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">
                    Загвар
                  </p>
                </div>
                <div className="text-2xl font-extrabold text-white leading-none">{templateStats.total}</div>
                <p className="text-[10px] text-slate-500 mt-0.5">загвар</p>
              </div>
            </div>

            {/* Загварын удирдлага - системийн болон үүсгэсэн тоо (график) */}
            <div className="rounded-xl bg-slate-800/50 dark:bg-slate-700/30 border border-slate-700/60 p-4">
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-3">
                Загварын удирдлага
              </p>
              {templateStats.total > 0 ? (
                <div className="flex items-center gap-4">
                  <div className="w-[100px] h-[100px] shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={[
                            { name: 'Системийн', value: templateStats.system, color: '#818cf8' },
                            { name: 'Үүсгэсэн', value: templateStats.user, color: '#a5b4fc' },
                          ].filter((d) => d.value > 0)}
                          cx="50%"
                          cy="50%"
                          innerRadius={28}
                          outerRadius={45}
                          paddingAngle={2}
                          dataKey="value"
                          stroke="none"
                        >
                          {[
                            { name: 'Системийн', value: templateStats.system, color: '#818cf8' },
                            { name: 'Үүсгэсэн', value: templateStats.user, color: '#a5b4fc' },
                          ]
                            .filter((d) => d.value > 0)
                            .map((entry, i) => (
                              <Cell key={i} fill={entry.color} />
                            ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            borderRadius: '8px',
                            border: 'none',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                            fontSize: '12px',
                            backgroundColor: '#1e293b',
                            color: '#f8fafc',
                          }}
                          formatter={(value: number, name: string) => [`${value} загвар`, name]}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className="inline-block h-2 w-2 rounded-full bg-indigo-400 shrink-0" />
                        <span className="text-[11px] text-slate-400">Системийн</span>
                      </div>
                      <span className="text-[11px] font-semibold text-white tabular-nums">{templateStats.system}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-700 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-indigo-400 transition-all duration-500"
                        style={{
                          width: templateStats.total > 0 ? `${(templateStats.system / templateStats.total) * 100}%` : '0%',
                        }}
                      />
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className="inline-block h-2 w-2 rounded-full bg-indigo-300 shrink-0" />
                        <span className="text-[11px] text-slate-400">Үүсгэсэн</span>
                      </div>
                      <span className="text-[11px] font-semibold text-white tabular-nums">{templateStats.user}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-700 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-indigo-300 transition-all duration-500"
                        style={{
                          width: templateStats.total > 0 ? `${(templateStats.user / templateStats.total) * 100}%` : '0%',
                        }}
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center py-6 text-xs text-slate-500">
                  Загвар байхгүй
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
