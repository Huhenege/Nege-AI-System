'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Building2, Users, Search, ExternalLink, RefreshCw } from 'lucide-react';
import { useSuperAdminApi } from '../components/use-super-admin-api';
import {
  COMPANY_STATUS_LABELS,
  COMPANY_STATUS_COLORS,
  COMPANY_PLAN_LABELS,
  type Company,
  type CompanyStatus,
  type CompanyPlan,
} from '@/types/company';

export default function CompaniesListPage() {
  const { fetchApi } = useSuperAdminApi();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [planFilter, setPlanFilter] = useState<string>('all');

  const loadCompanies = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (planFilter !== 'all') params.set('plan', planFilter);

      const data = await fetchApi<{ companies: Company[] }>(`/companies?${params.toString()}`);
      setCompanies(data.companies);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setIsLoading(false);
    }
  }, [fetchApi, statusFilter, planFilter]);

  useEffect(() => {
    loadCompanies();
  }, [loadCompanies]);

  const filtered = companies.filter((c) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      c.name?.toLowerCase().includes(q) ||
      c.email?.toLowerCase().includes(q) ||
      c.domain?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Байгууллагууд</h1>
          <p className="text-slate-500 text-sm mt-1">
            Нийт {companies.length} байгууллага бүртгэлтэй
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={loadCompanies}
          disabled={isLoading}
          className="border-slate-700 text-slate-300 hover:bg-slate-800"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Шинэчлэх
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <Input
            placeholder="Нэр, имэйл, домэйн хайх..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-slate-900 border-slate-700 text-slate-200 placeholder:text-slate-600"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px] bg-slate-900 border-slate-700 text-slate-300">
            <SelectValue placeholder="Төлөв" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Бүх төлөв</SelectItem>
            {(Object.entries(COMPANY_STATUS_LABELS) as [CompanyStatus, string][]).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={planFilter} onValueChange={setPlanFilter}>
          <SelectTrigger className="w-[160px] bg-slate-900 border-slate-700 text-slate-300">
            <SelectValue placeholder="Багц" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Бүх багц</SelectItem>
            {(Object.entries(COMPANY_PLAN_LABELS) as [CompanyPlan, string][]).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      {/* Companies list */}
      <div className="space-y-3">
        {isLoading ? (
          [...Array(4)].map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-xl bg-slate-800" />)
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-500">
            <Building2 className="h-10 w-10 mb-3" />
            <p>Байгууллага олдсонгүй</p>
          </div>
        ) : (
          filtered.map((company) => (
            <Link key={company.id} href={`/super-admin/companies/${company.id}`}>
              <Card className="bg-slate-900 border-slate-800 transition-all hover:border-slate-600 hover:bg-slate-800/70 cursor-pointer">
                <CardContent className="flex items-center gap-4 p-4">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-800 flex-none">
                    <Building2 className="h-5 w-5 text-slate-400" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-slate-100 truncate">{company.name}</p>
                      <Badge
                        variant="secondary"
                        className={`text-[10px] px-1.5 py-0 ${COMPANY_STATUS_COLORS[company.status]}`}
                      >
                        {COMPANY_STATUS_LABELS[company.status]}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-500">
                      <span>{company.email}</span>
                      {company.domain && (
                        <>
                          <span className="text-slate-700">·</span>
                          <span>{company.domain}</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-6 flex-none">
                    <div className="text-center">
                      <p className="text-lg font-bold tabular-nums text-white">{company.employeeCount || 0}</p>
                      <p className="text-[10px] text-slate-500 flex items-center gap-1">
                        <Users className="h-3 w-3" /> Ажилтан
                      </p>
                    </div>
                    <div className="text-center">
                      <Badge variant="outline" className="text-xs border-slate-700 text-slate-400">
                        {COMPANY_PLAN_LABELS[company.plan]}
                      </Badge>
                    </div>
                    <ExternalLink className="h-4 w-4 text-slate-600" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
