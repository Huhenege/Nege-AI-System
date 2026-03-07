'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Building2, Users, UserCheck, TrendingUp } from 'lucide-react';
import { useSuperAdminApi } from './components/use-super-admin-api';
import {
  COMPANY_STATUS_LABELS,
  COMPANY_PLAN_LABELS,
  COMPANY_STATUS_COLORS,
  type CompanyStatus,
  type CompanyPlan,
} from '@/types/company';

interface Stats {
  totalCompanies: number;
  totalEmployees: number;
  totalUsers: number;
  statusCounts: Record<CompanyStatus, number>;
  planCounts: Record<CompanyPlan, number>;
}

export default function SuperAdminDashboard() {
  const { fetchApi } = useSuperAdminApi();
  const [stats, setStats] = useState<Stats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);

    fetchApi<Stats>('/stats')
      .then((data) => {
        if (!cancelled) setStats(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => { cancelled = true; };
  }, [fetchApi]);

  if (error) {
    return (
      <div className="p-8">
        <p className="text-red-400">Алдаа: {error}</p>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">Хяналтын самбар</h1>
        <p className="text-slate-500 text-sm mt-1">Платформын ерөнхий мэдээлэл</p>
      </div>

      {/* Top stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Building2} label="Нийт байгууллага" value={stats?.totalCompanies} isLoading={isLoading} />
        <StatCard icon={Users} label="Нийт ажилтан" value={stats?.totalEmployees} isLoading={isLoading} />
        <StatCard icon={UserCheck} label="Нийт хэрэглэгч" value={stats?.totalUsers} isLoading={isLoading} />
        <StatCard
          icon={TrendingUp}
          label="Идэвхтэй"
          value={stats ? stats.statusCounts.active + stats.statusCounts.trial : undefined}
          isLoading={isLoading}
        />
      </div>

      {/* Breakdowns */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-slate-200">Төлөвөөр</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-8 w-full bg-slate-800" />)}
              </div>
            ) : (
              <div className="space-y-2">
                {(Object.entries(stats?.statusCounts || {}) as [CompanyStatus, number][]).map(
                  ([status, count]) => (
                    <div key={status} className="flex items-center justify-between rounded-lg border border-slate-800 px-4 py-2.5">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${COMPANY_STATUS_COLORS[status]}`}>
                        {COMPANY_STATUS_LABELS[status]}
                      </span>
                      <span className="text-sm font-semibold tabular-nums text-slate-200">{count}</span>
                    </div>
                  )
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-slate-200">Багцаар</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-8 w-full bg-slate-800" />)}
              </div>
            ) : (
              <div className="space-y-2">
                {(Object.entries(stats?.planCounts || {}) as [CompanyPlan, number][]).map(
                  ([plan, count]) => {
                    const colors: Record<CompanyPlan, string> = {
                      free: 'bg-slate-700 text-slate-300',
                      starter: 'bg-blue-900/50 text-blue-400',
                      pro: 'bg-purple-900/50 text-purple-400',
                      enterprise: 'bg-amber-900/50 text-amber-400',
                    };
                    return (
                      <div key={plan} className="flex items-center justify-between rounded-lg border border-slate-800 px-4 py-2.5">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${colors[plan]}`}>
                          {COMPANY_PLAN_LABELS[plan]}
                        </span>
                        <span className="text-sm font-semibold tabular-nums text-slate-200">{count}</span>
                      </div>
                    );
                  }
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  isLoading,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value?: number;
  isLoading: boolean;
}) {
  return (
    <Card className="bg-slate-900 border-slate-800">
      <CardContent className="flex items-center gap-4 p-5">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-600/10">
          <Icon className="h-5 w-5 text-red-500" />
        </div>
        <div>
          <p className="text-xs text-slate-500">{label}</p>
          {isLoading ? (
            <Skeleton className="mt-1 h-7 w-16 bg-slate-800" />
          ) : (
            <p className="text-2xl font-bold tabular-nums text-white">{value ?? 0}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
