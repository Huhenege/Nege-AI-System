'use client';

import * as React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Building2,
  Briefcase,
  Users,
  CheckCircle2,
  FileEdit,
} from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { Department, Position } from '../types';

const POSITION_STATUS_COLORS = {
  approved: '#10b981',
  draft: '#f59e0b',
  inactive: '#94a3b8',
};

const OCCUPANCY_COLORS = {
  filled: '#6366f1',
  vacant: '#334155',
};

const DEPT_COLORS = [
  '#6366f1', '#8b5cf6', '#a78bfa', '#3b82f6', '#06b6d4',
  '#14b8a6', '#10b981', '#f59e0b', '#f97316', '#ef4444',
  '#ec4899', '#d946ef',
];

const CONDITION_LABELS: Record<string, string> = {
  NORMAL: 'Хэвийн',
  NON_STANDARD: 'Хэвийн бус',
  HEAVY: 'Хүнд',
  HAZARDOUS: 'Хортой',
  EXTREMELY_HAZARDOUS: 'Маш хортой',
};

const CONDITION_COLORS: Record<string, string> = {
  NORMAL: '#10b981',
  NON_STANDARD: '#f59e0b',
  HEAVY: '#f97316',
  HAZARDOUS: '#ef4444',
  EXTREMELY_HAZARDOUS: '#dc2626',
};

interface OrganizationDashboardProps {
  departments: Department[] | null;
  positions: Position[] | null;
  isLoading: boolean;
}

export function OrganizationDashboard({
  departments,
  positions,
  isLoading,
}: OrganizationDashboardProps) {
  const metrics = React.useMemo(() => {
    const depts = departments || [];
    const pos = positions || [];

    const totalDepts = depts.length;
    const totalPositions = pos.length;
    const approved = pos.filter(p => p.isApproved && p.isActive !== false).length;
    const draft = pos.filter(p => !p.isApproved && p.isActive !== false).length;
    const inactive = pos.filter(p => p.isActive === false).length;
    const filled = pos.filter(p => (p.filled || 0) >= 1).length;
    const vacant = totalPositions - filled;

    const statusData = [
      { name: 'Батлагдсан', value: approved, color: POSITION_STATUS_COLORS.approved },
      { name: 'Ноорог', value: draft, color: POSITION_STATUS_COLORS.draft },
      ...(inactive > 0 ? [{ name: 'Идэвхгүй', value: inactive, color: POSITION_STATUS_COLORS.inactive }] : []),
    ].filter(d => d.value > 0);

    const occupancyData = [
      { name: 'Нөхөгдсөн', value: filled, color: OCCUPANCY_COLORS.filled },
      { name: 'Сул орон тоо', value: vacant, color: OCCUPANCY_COLORS.vacant },
    ].filter(d => d.value > 0);

    const deptPositionCounts = depts
      .map(d => ({
        name: d.name,
        count: pos.filter(p => p.departmentId === d.id).length,
      }))
      .filter(d => d.count > 0)
      .sort((a, b) => b.count - a.count);

    const levelCounts: Record<string, number> = {};
    pos.forEach(p => {
      if (p.levelId) {
        levelCounts[p.levelId] = (levelCounts[p.levelId] || 0) + 1;
      }
    });

    const conditionCounts: Record<string, number> = {};
    pos.forEach(p => {
      const cond = (p as any).workingCondition;
      if (cond) {
        conditionCounts[cond] = (conditionCounts[cond] || 0) + 1;
      }
    });
    const conditionData = Object.entries(conditionCounts)
      .map(([key, value]) => ({
        name: CONDITION_LABELS[key] || key,
        value,
        color: CONDITION_COLORS[key] || '#94a3b8',
      }))
      .sort((a, b) => b.value - a.value);

    return {
      totalDepts,
      totalPositions,
      approved,
      draft,
      inactive,
      filled,
      vacant,
      statusData,
      occupancyData,
      deptPositionCounts,
      conditionData,
    };
  }, [departments, positions]);

  if (isLoading) {
    return (
      <Card className="bg-slate-900 dark:bg-slate-800 border-slate-700">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-6">
            <Skeleton className="h-5 w-48" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Skeleton className="h-48 w-full rounded-lg" />
            <Skeleton className="h-48 w-full rounded-lg" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
            <Skeleton className="h-32 w-full rounded-lg" />
            <Skeleton className="h-32 w-full rounded-lg" />
            <Skeleton className="h-32 w-full rounded-lg" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-slate-900 dark:bg-slate-800 border-slate-700 overflow-hidden relative">
      <div className="absolute -right-6 -bottom-6 w-28 h-28 rounded-full blur-3xl bg-gradient-to-br from-indigo-500/10 to-violet-500/10" />
      <CardContent className="p-5 sm:p-6 relative z-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-[10px] sm:text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            Dashboard | байгууллагын бүтэц
          </h3>
        </div>

        {/* Stat pills */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          <StatPill icon={Building2} label="Нэгж" value={metrics.totalDepts} color="text-indigo-400" />
          <StatPill icon={Briefcase} label="Ажлын байр" value={metrics.totalPositions} color="text-violet-400" />
          <StatPill icon={CheckCircle2} label="Батлагдсан" value={metrics.approved} color="text-emerald-400" />
          <StatPill icon={Users} label="Нөхөгдсөн" value={metrics.filled} color="text-blue-400" />
        </div>

        {/* Main grid: Status donut | Occupancy donut */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Position status donut */}
          <div className="rounded-xl bg-slate-800/50 dark:bg-slate-700/30 border border-slate-700/60 p-4 h-full flex flex-col">
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-3">
              Ажлын байрны төлөв
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
                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontSize: '12px' }}
                        formatter={(value: number, name: string) => [`${value} ажлын байр`, name]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="text-center">
                      <div className="text-2xl font-extrabold text-white leading-none">{metrics.totalPositions}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">нийт ажлын байр</div>
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap justify-center gap-x-3 gap-y-1.5 mt-3">
                  {metrics.statusData.map((item) => (
                    <div key={item.name} className="flex items-center gap-1.5">
                      <span className="inline-block h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                      <span className="text-[11px] text-slate-400 whitespace-nowrap">
                        {item.name} ({item.value})
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-xs text-slate-500">Мэдээлэл байхгүй</div>
            )}
          </div>

          {/* Occupancy donut */}
          <div className="rounded-xl bg-slate-800/50 dark:bg-slate-700/30 border border-slate-700/60 p-4 h-full flex flex-col">
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-3">
              Орон тооны нөхцөл байдал
            </p>
            {metrics.occupancyData.length > 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center">
                <div className="w-full h-[170px] relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={metrics.occupancyData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={75}
                        paddingAngle={3}
                        dataKey="value"
                        stroke="none"
                      >
                        {metrics.occupancyData.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontSize: '12px' }}
                        formatter={(value: number, name: string) => [`${value} ажлын байр`, name]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="text-center">
                      <div className="text-2xl font-extrabold text-white leading-none">
                        {metrics.totalPositions > 0 ? Math.round((metrics.filled / metrics.totalPositions) * 100) : 0}%
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">нөхөгдсөн</div>
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap justify-center gap-x-3 gap-y-1.5 mt-3">
                  {metrics.occupancyData.map((item) => (
                    <div key={item.name} className="flex items-center gap-1.5">
                      <span className="inline-block h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                      <span className="text-[11px] text-slate-400 whitespace-nowrap">
                        {item.name} ({item.value})
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-xs text-slate-500">Мэдээлэл байхгүй</div>
            )}
          </div>
        </div>

        {/* Bottom row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
          {/* Departments breakdown */}
          <div className="rounded-xl bg-slate-800/50 dark:bg-slate-700/30 border border-slate-700/60 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Building2 className="h-3.5 w-3.5 text-slate-400" />
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">
                Нэгж тус бүрийн ажлын байр
              </p>
            </div>
            {metrics.deptPositionCounts.length > 0 ? (
              <div className="space-y-2">
                {metrics.deptPositionCounts.slice(0, 8).map((item, idx) => {
                  const maxCount = metrics.deptPositionCounts[0]?.count || 1;
                  const pct = Math.round((item.count / maxCount) * 100);
                  return (
                    <div key={item.name}>
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-[11px] text-slate-400 truncate mr-2">{item.name}</span>
                        <span className="text-[11px] font-semibold text-white tabular-nums shrink-0">{item.count}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-slate-700 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${pct}%`, backgroundColor: DEPT_COLORS[idx % DEPT_COLORS.length] }}
                        />
                      </div>
                    </div>
                  );
                })}
                {metrics.deptPositionCounts.length > 8 && (
                  <div className="text-[10px] text-slate-500 text-center mt-1">
                    +{metrics.deptPositionCounts.length - 8} бусад нэгж
                  </div>
                )}
              </div>
            ) : (
              <div className="text-xs text-slate-500">Мэдээлэл байхгүй</div>
            )}
          </div>

          {/* Working conditions */}
          <div className="rounded-xl bg-slate-800/50 dark:bg-slate-700/30 border border-slate-700/60 p-4">
            <div className="flex items-center gap-2 mb-3">
              <FileEdit className="h-3.5 w-3.5 text-slate-400" />
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">
                Хөдөлмөрийн нөхцөл
              </p>
            </div>
            {metrics.conditionData.length > 0 ? (
              <>
                <div className="flex h-2 rounded-full overflow-hidden bg-slate-700 mb-2">
                  {metrics.conditionData.map((item) => {
                    const total = metrics.conditionData.reduce((s, d) => s + d.value, 0);
                    return (
                      <div
                        key={item.name}
                        className="h-full transition-all duration-500"
                        style={{ width: `${(item.value / total) * 100}%`, backgroundColor: item.color }}
                      />
                    );
                  })}
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
                  {metrics.conditionData.map((item) => (
                    <div key={item.name} className="flex items-center gap-1">
                      <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="text-[10px] text-slate-400">{item.name} ({item.value})</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="text-xs text-slate-500">Мэдээлэл байхгүй</div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function StatPill({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: number; color: string }) {
  return (
    <div className="rounded-xl bg-slate-800/50 dark:bg-slate-700/30 border border-slate-700/60 p-3 flex items-center gap-3">
      <div className={`h-8 w-8 rounded-lg bg-slate-700/50 flex items-center justify-center ${color}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <div className="text-lg font-extrabold text-white leading-none tabular-nums">{value}</div>
        <div className="text-[10px] text-slate-400 mt-0.5">{label}</div>
      </div>
    </div>
  );
}
