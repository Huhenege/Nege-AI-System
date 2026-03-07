'use client';

import * as React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { AddActionButton } from '@/components/ui/add-action-button';
import {
  FileBarChart2,
  ClipboardCheck,
  GraduationCap,
} from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { Employee, Department, isActiveStatus, EMPLOYEE_STATUS_LABELS } from '@/types';
import { useTenantWrite } from '@/firebase';
import { getDoc } from 'firebase/firestore';

// ─── Status colours (semantic, matching the page's statusConfig) ─────────────
const STATUS_COLORS: Record<string, string> = {
  'active': '#10b981',
  'active_probation': '#f59e0b',
  'active_permanent': '#10b981',
  'on_leave': '#3b82f6',
  'releasing': '#f97316',
  'terminated': '#f43f5e',
  'suspended': '#94a3b8',
};

const STATUS_LABELS: Record<string, string> = {
  'active': EMPLOYEE_STATUS_LABELS.active,
  'active_probation': EMPLOYEE_STATUS_LABELS.active_probation,
  'active_permanent': EMPLOYEE_STATUS_LABELS.active_permanent,
  'on_leave': EMPLOYEE_STATUS_LABELS.on_leave,
  'releasing': EMPLOYEE_STATUS_LABELS.releasing,
  'terminated': EMPLOYEE_STATUS_LABELS.terminated,
  'suspended': EMPLOYEE_STATUS_LABELS.suspended,
};

const LIFECYCLE_COLORS: Record<string, { color: string; label: string }> = {
  attraction: { color: '#a78bfa', label: 'Татах' },
  recruitment: { color: '#818cf8', label: 'Сонгон шалгаруулалт' },
  onboarding: { color: '#34d399', label: 'Чиглүүлэлт' },
  development: { color: '#60a5fa', label: 'Хөгжүүлэлт' },
  retention: { color: '#fbbf24', label: 'Тогтвортой байдал' },
  offboarding: { color: '#fb923c', label: 'Чөлөөлөлт' },
  alumni: { color: '#94a3b8', label: 'Алумни' },
};

// ─── Age group definitions ───────────────────────────────────────────────────
const AGE_GROUPS = [
  { label: '18-25', min: 18, max: 25, color: '#34d399' },
  { label: '26-35', min: 26, max: 35, color: '#60a5fa' },
  { label: '36-45', min: 36, max: 45, color: '#a78bfa' },
  { label: '46-55', min: 46, max: 55, color: '#fbbf24' },
  { label: '56+', min: 56, max: 999, color: '#fb923c' },
];

// ─── Education level colours ─────────────────────────────────────────────────
const EDUCATION_COLORS: Record<string, string> = {
  'Доктор': '#8b5cf6',
  'Магистр': '#6366f1',
  'Бакалавр': '#3b82f6',
  'Дипломын': '#06b6d4',
  'Тусгай дунд': '#14b8a6',
  'Бүрэн дунд': '#22c55e',
  'Суурь': '#84cc16',
};
const EDUCATION_FALLBACK_COLOR = '#94a3b8';

// ─── Props ───────────────────────────────────────────────────────────────────
interface EmployeesDashboardProps {
  employees: Employee[] | null;
  departments: Department[] | null;
  documents: any[] | null;
  onboardingProcesses: any[] | null;
  offboardingProjects: any[] | null;
  isLoading: boolean;
}

// ─── Helper: calculate age from birth date ───────────────────────────────────
function calcAge(birthDate: any): number | null {
  if (!birthDate) return null;
  let d: Date;
  if (typeof birthDate === 'string') {
    d = new Date(birthDate);
  } else if (birthDate instanceof Date) {
    d = birthDate;
  } else if (typeof birthDate === 'object' && 'seconds' in birthDate) {
    // Firestore Timestamp
    d = new Date(birthDate.seconds * 1000);
  } else {
    return null;
  }
  if (isNaN(d.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - d.getFullYear();
  const m = today.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age--;
  return age >= 0 ? age : null;
}

// ─── Component ───────────────────────────────────────────────────────────────
export function EmployeesDashboard({
  employees,
  departments,
  documents,
  isLoading,
}: EmployeesDashboardProps) {
  // ── Fetch questionnaire data (gender + birthDate) per employee ──────────
  const { firestore, tDoc } = useTenantWrite();
  const [questionnaireMap, setQuestionnaireMap] = React.useState<
    Map<string, { gender?: string; birthDate?: any; education?: any[] }>
  >(new Map());

  React.useEffect(() => {
    if (!firestore || !employees || employees.length === 0) {
      setQuestionnaireMap(new Map());
      return;
    }

    let cancelled = false;

    const fetchAll = async () => {
      const map = new Map<string, { gender?: string; birthDate?: any; education?: any[] }>();
      const promises = employees.map(async (emp) => {
        try {
          const docRef = tDoc('employees', emp.id, 'questionnaire', 'data');
          const snap = await getDoc(docRef);
          if (snap.exists()) {
            const d = snap.data();
            map.set(emp.id, {
              gender: d?.gender,
              birthDate: d?.birthDate,
              education: Array.isArray(d?.education) ? d.education : [],
            });
          }
        } catch {
          // Skip if doc doesn't exist or permission denied
        }
      });
      await Promise.all(promises);
      if (!cancelled) setQuestionnaireMap(map);
    };

    fetchAll();
    return () => { cancelled = true; };
  }, [firestore, employees]);

  // ── Derived metrics ──────────────────────────────────────────────────────
  const metrics = React.useMemo(() => {
    if (!employees) {
      return {
        total: 0,
        active: 0,
        avgQuestionnaire: 0,
        statusData: [] as { name: string; value: number; color: string }[],
        maleCount: 0,
        femaleCount: 0,
        unknownGenderCount: 0,
        pyramidData: [] as { label: string; male: number; female: number }[],
        pyramidMax: 1,
        educationData: [] as { name: string; value: number; color: string }[],
        lifecycleData: [] as { stage: string; count: number; color: string; label: string }[],
      };
    }

    const total = employees.length;
    const active = employees.filter(e => isActiveStatus(e.status)).length;

    // Average questionnaire completion
    const withQuestionnaire = employees.filter(e => typeof e.questionnaireCompletion === 'number');
    const avgQuestionnaire = withQuestionnaire.length > 0
      ? Math.round(withQuestionnaire.reduce((sum, e) => sum + (e.questionnaireCompletion || 0), 0) / withQuestionnaire.length)
      : 0;

    // Status distribution
    const statusCounts: Record<string, number> = {};
    employees.forEach(e => {
      const s = e.status || 'Тодорхойгүй';
      statusCounts[s] = (statusCounts[s] || 0) + 1;
    });
    const statusData = Object.entries(statusCounts)
      .map(([name, value]) => ({
        name: STATUS_LABELS[name] || name,
        value,
        color: STATUS_COLORS[name] || '#94a3b8',
      }))
      .sort((a, b) => b.value - a.value);

    // Gender + Age → Population Pyramid
    let maleCount = 0;
    let femaleCount = 0;
    let unknownGenderCount = 0;
    const pyramidCounts: Record<string, { male: number; female: number }> = {};
    AGE_GROUPS.forEach(g => { pyramidCounts[g.label] = { male: 0, female: 0 }; });

    employees.forEach(e => {
      const q = questionnaireMap.get(e.id);
      const gender = q?.gender;
      if (gender === 'male') maleCount++;
      else if (gender === 'female') femaleCount++;
      else unknownGenderCount++;

      const age = calcAge(q?.birthDate);
      if (age !== null && (gender === 'male' || gender === 'female')) {
        const group = AGE_GROUPS.find(g => age >= g.min && age <= g.max);
        if (group) {
          if (gender === 'male') pyramidCounts[group.label].male++;
          else pyramidCounts[group.label].female++;
        }
      }
    });

    // Pyramid data ordered from oldest (top) to youngest (bottom)
    const pyramidData = [...AGE_GROUPS].reverse().map(g => ({
      label: g.label,
      male: pyramidCounts[g.label].male,
      female: pyramidCounts[g.label].female,
    }));
    const pyramidMax = Math.max(
      1,
      ...pyramidData.map(d => Math.max(d.male, d.female))
    );

    // Education level distribution (highest rank per employee)
    const educationRankOrder = ['Доктор', 'Магистр', 'Бакалавр', 'Дипломын', 'Тусгай дунд', 'Бүрэн дунд', 'Суурь'];
    const educationCounts: Record<string, number> = {};
    employees.forEach(e => {
      const q = questionnaireMap.get(e.id);
      const eduList = q?.education;
      if (eduList && eduList.length > 0) {
        // Pick highest academic rank
        let bestRank = '';
        let bestIdx = educationRankOrder.length;
        eduList.forEach((edu: any) => {
          const rank = edu.academicRank || '';
          if (rank) {
            const idx = educationRankOrder.indexOf(rank);
            if (idx !== -1 && idx < bestIdx) {
              bestIdx = idx;
              bestRank = rank;
            } else if (idx === -1 && !bestRank) {
              bestRank = rank; // unknown rank, use as fallback
            }
          }
        });
        if (bestRank) {
          educationCounts[bestRank] = (educationCounts[bestRank] || 0) + 1;
        }
      }
    });
    // Sort by rank order, then any unknown ranks
    const educationData = Object.entries(educationCounts)
      .sort(([a], [b]) => {
        const ia = educationRankOrder.indexOf(a);
        const ib = educationRankOrder.indexOf(b);
        return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
      })
      .map(([name, value]) => ({
        name,
        value,
        color: EDUCATION_COLORS[name] || EDUCATION_FALLBACK_COLOR,
      }));

    // Lifecycle distribution
    const lifecycleCounts: Record<string, number> = {};
    employees.forEach(e => {
      if (e.lifecycleStage) {
        lifecycleCounts[e.lifecycleStage] = (lifecycleCounts[e.lifecycleStage] || 0) + 1;
      }
    });
    const lifecycleData = Object.entries(lifecycleCounts)
      .map(([stage, count]) => ({
        stage,
        count,
        color: LIFECYCLE_COLORS[stage]?.color || '#94a3b8',
        label: LIFECYCLE_COLORS[stage]?.label || stage,
      }));

    return {
      total,
      active,
      avgQuestionnaire,
      statusData,
      maleCount,
      femaleCount,
      unknownGenderCount,
      pyramidData,
      pyramidMax,
      educationData,
      lifecycleData,
    };
  }, [employees, questionnaireMap]);

  // ── Loading skeleton ─────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <Card className="bg-slate-900 dark:bg-slate-800 border-slate-700">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-6">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-9 w-9 rounded-lg" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="space-y-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded-lg" />
              ))}
            </div>
            <Skeleton className="h-48 w-full rounded-lg" />
            <Skeleton className="h-48 w-full rounded-lg" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const lifecycleTotal = metrics.lifecycleData.reduce((s, d) => s + d.count, 0);
  const hasPyramidData = metrics.pyramidData.some(d => d.male > 0 || d.female > 0);

  return (
    <Card className="bg-slate-900 dark:bg-slate-800 border-slate-700 overflow-hidden relative">
      {/* Decorative gradient (matches dashboard employees widget) */}
      <div className="absolute -right-6 -bottom-6 w-28 h-28 rounded-full blur-3xl bg-gradient-to-br from-emerald-500/10 to-teal-500/10" />
      <CardContent className="p-5 sm:p-6 relative z-10">
        {/* ── Header ───────────────────────────────────────────────── */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-[10px] sm:text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Dashboard | хамт олон
            </h3>
          </div>
          <AddActionButton
            label="Дэлгэрэнгүй тайлан"
            description="Ажилтнуудын тайлан харах"
            href="/dashboard/employees/reports"
            icon={<FileBarChart2 className="h-4 w-4" />}
          />
        </div>

        {/* ── Main grid: Status donut | Population Pyramid ──── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

          {/* ── Left: Status donut (with total & active) ────── */}
          <div>
            <div className="rounded-xl bg-slate-800/50 dark:bg-slate-700/30 border border-slate-700/60 p-4 h-full flex flex-col">
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-3">
                Ажилтнуудын төлөв
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
                            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                            fontSize: '12px',
                          }}
                          formatter={(value: number, name: string) => [`${value} ажилтан`, name]}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    {/* Center label – total + active */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="text-center">
                        <div className="text-2xl font-extrabold text-white leading-none">{metrics.total}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">нийт ажилтан</div>
                      </div>
                    </div>
                  </div>
                  {/* Legend */}
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

          {/* ── Right: Population Pyramid (Gender × Age) ─────── */}
          <div>
            <div className="rounded-xl bg-slate-800/50 dark:bg-slate-700/30 border border-slate-700/60 p-4 h-full flex flex-col">
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-3">
                Нас & Хүйсийн пирамид
              </p>
              {hasPyramidData ? (
                <div className="flex-1 flex flex-col justify-center">
                  {/* Legend row */}
                  <div className="flex items-center justify-center gap-5 mb-3">
                    <div className="flex items-center gap-1.5">
                      <MaleFigure className="h-4 w-4 text-blue-400" />
                      <span className="text-[11px] font-semibold text-blue-400">
                        Эрэгтэй ({metrics.maleCount})
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <FemaleFigure className="h-4 w-4 text-pink-400" />
                      <span className="text-[11px] font-semibold text-pink-400">
                        Эмэгтэй ({metrics.femaleCount})
                      </span>
                    </div>
                  </div>

                  {/* Pyramid rows */}
                  <div className="space-y-1.5">
                    {metrics.pyramidData.map((row) => (
                      <div key={row.label} className="flex items-center gap-1">
                        {/* Male bar (right-aligned) */}
                        <div className="flex-1 flex justify-end">
                          <div className="flex items-center gap-1 w-full justify-end">
                            {row.male > 0 && (
                              <span className="text-[10px] font-semibold text-blue-400 tabular-nums">
                                {row.male}
                              </span>
                            )}
                            <div
                              className="h-5 rounded-l-md bg-gradient-to-l from-blue-500 to-blue-400 dark:from-blue-500 dark:to-blue-600 transition-all duration-500 min-w-0"
                              style={{
                                width: row.male > 0 ? `${Math.max((row.male / metrics.pyramidMax) * 100, 8)}%` : '0%',
                              }}
                            />
                          </div>
                        </div>

                        {/* Age label (center) */}
                        <div className="w-12 text-center shrink-0">
                          <span className="text-[11px] font-bold text-white tabular-nums">
                            {row.label}
                          </span>
                        </div>

                        {/* Female bar (left-aligned) */}
                        <div className="flex-1">
                          <div className="flex items-center gap-1">
                            <div
                              className="h-5 rounded-r-md bg-gradient-to-r from-pink-500 to-pink-400 dark:from-pink-500 dark:to-pink-600 transition-all duration-500 min-w-0"
                              style={{
                                width: row.female > 0 ? `${Math.max((row.female / metrics.pyramidMax) * 100, 8)}%` : '0%',
                              }}
                            />
                            {row.female > 0 && (
                              <span className="text-[10px] font-semibold text-pink-400 tabular-nums">
                                {row.female}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Unknown gender note */}
                  {metrics.unknownGenderCount > 0 && (
                    <div className="text-[10px] text-slate-500 mt-3 text-center">
                      Хүйс тодорхойгүй: {metrics.unknownGenderCount}
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center text-xs text-slate-500">
                  Анкет мэдээлэл байхгүй
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Bottom row: Education + Questionnaire + Lifecycle ── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
          {/* Education level distribution */}
          <div className="rounded-xl bg-slate-800/50 dark:bg-slate-700/30 border border-slate-700/60 p-4">
            <div className="flex items-center gap-2 mb-3">
              <GraduationCap className="h-3.5 w-3.5 text-slate-400" />
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">
                Боловсролын зэрэг
              </p>
            </div>
            {metrics.educationData.length > 0 ? (
              <div className="space-y-2">
                {metrics.educationData.map((item) => {
                  const eduTotal = metrics.educationData.reduce((s, d) => s + d.value, 0);
                  const pct = eduTotal > 0 ? Math.round((item.value / eduTotal) * 100) : 0;
                  return (
                    <div key={item.name}>
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-[11px] text-slate-400">{item.name}</span>
                        <span className="text-[11px] font-semibold text-white tabular-nums">
                          {item.value} <span className="text-slate-500 font-normal">({pct}%)</span>
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-slate-700 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${pct}%`,
                            backgroundColor: item.color,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-xs text-slate-500">Мэдээлэл байхгүй</div>
            )}
          </div>

          {/* Questionnaire average */}
          <div className="rounded-xl bg-slate-800/50 dark:bg-slate-700/30 border border-slate-700/60 p-4">
            <div className="flex items-center gap-2 mb-2">
              <ClipboardCheck className="h-3.5 w-3.5 text-slate-400" />
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">
                Анкет бөглөлт (дундаж)
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex-1 h-2 rounded-full bg-slate-700 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all duration-500"
                  style={{ width: `${metrics.avgQuestionnaire}%` }}
                />
              </div>
              <span className="text-sm font-semibold text-white tabular-nums w-10 text-right">
                {metrics.avgQuestionnaire}%
              </span>
            </div>
          </div>

          {/* Lifecycle stage bar */}
          <div className="rounded-xl bg-slate-800/50 dark:bg-slate-700/30 border border-slate-700/60 p-4">
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-2">
              Амьдралын мөчлөг
            </p>
            {lifecycleTotal > 0 ? (
              <>
                <div className="flex h-2 rounded-full overflow-hidden bg-slate-700">
                  {metrics.lifecycleData.map((item) => (
                    <div
                      key={item.stage}
                      className="h-full transition-all duration-500"
                      style={{
                        width: `${(item.count / lifecycleTotal) * 100}%`,
                        backgroundColor: item.color,
                      }}
                    />
                  ))}
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
                  {metrics.lifecycleData.map((item) => (
                    <div key={item.stage} className="flex items-center gap-1">
                      <span
                        className="inline-block h-1.5 w-1.5 rounded-full"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="text-[10px] text-slate-400">
                        {item.label} ({item.count})
                      </span>
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

// ─── SVG Figure components ───────────────────────────────────────────────────

/** Male icon – stylised avatar with Mars arrow symbol */
function MaleFigure({ className, ...props }: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 64 64" fill="none" className={className} {...props}>
      {/* Head circle */}
      <circle cx="32" cy="26" r="12" fill="currentColor" />
      {/* Shoulders + torso */}
      <path
        d="M12 54a20 20 0 0 1 40 0"
        fill="currentColor"
      />
      {/* Mars arrow ♂ top-right */}
      <circle cx="48" cy="12" r="6" stroke="currentColor" strokeWidth="2.5" fill="none" />
      <line x1="52.5" y1="7.5" x2="58" y2="2" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <polyline points="53,2 58,2 58,7" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Female icon – stylised avatar with Venus cross symbol */
function FemaleFigure({ className, ...props }: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 64 64" fill="none" className={className} {...props}>
      {/* Head circle */}
      <circle cx="32" cy="26" r="12" fill="currentColor" />
      {/* Shoulders + torso */}
      <path
        d="M12 54a20 20 0 0 1 40 0"
        fill="currentColor"
      />
      {/* Venus cross ♀ top-right */}
      <circle cx="50" cy="10" r="6" stroke="currentColor" strokeWidth="2.5" fill="none" />
      <line x1="50" y1="16" x2="50" y2="26" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="46" y1="22" x2="54" y2="22" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

