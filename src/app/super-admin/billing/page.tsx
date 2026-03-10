'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Banknote,
  TrendingUp,
  Clock,
  CheckCircle2,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import { useSuperAdminApi } from '../components/use-super-admin-api';
import { COMPANY_PLAN_LABELS, type CompanyPlan } from '@/types/company';

interface BillingStats {
  totalRevenue: number;
  monthlyRevenue: number;
  pendingAmount: number;
  paidCount: number;
  pendingCount: number;
}

interface PlatformInvoice {
  id: string;
  companyId: string;
  companyName: string;
  invoiceNo: string;
  plan: CompanyPlan;
  amount: number;
  currency: string;
  status: string;
  billingCycle: string;
  manuallyPaid: boolean;
  createdAt: string;
  paidAt: string | null;
}

function formatDate(val: string | null | undefined): string {
  if (!val) return '-';
  return new Date(val).toLocaleDateString('mn-MN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default function PlatformBillingPage() {
  const { fetchApi } = useSuperAdminApi();
  const [stats, setStats] = useState<BillingStats | null>(null);
  const [invoices, setInvoices] = useState<PlatformInvoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'paid' | 'pending'>('all');

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await fetchApi<{ stats: BillingStats; invoices: PlatformInvoice[] }>('/billing');
      setStats(data.stats);
      setInvoices(data.invoices);
    } catch {
      // API error handled silently — stats will show as empty
    } finally {
      setIsLoading(false);
    }
  }, [fetchApi]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filtered = filter === 'all'
    ? invoices
    : invoices.filter((i) => (filter === 'paid' ? i.status === 'paid' : i.status !== 'paid'));

  return (
    <div className="p-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Төлбөрийн удирдлага</h1>
          <p className="text-slate-500 text-sm mt-1">Платформын нийт орлого, нэхэмжлэлийн мэдээлэл</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={loadData}
          disabled={isLoading}
          className="border-slate-700 text-slate-300 hover:bg-slate-800"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Шинэчлэх
        </Button>
      </div>

      {/* Stats cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Banknote}
          label="Нийт орлого"
          value={stats ? `₮${stats.totalRevenue.toLocaleString()}` : undefined}
          isLoading={isLoading}
          color="text-emerald-500"
          bgColor="bg-emerald-600/10"
        />
        <StatCard
          icon={TrendingUp}
          label="Энэ сарын орлого"
          value={stats ? `₮${stats.monthlyRevenue.toLocaleString()}` : undefined}
          isLoading={isLoading}
          color="text-blue-500"
          bgColor="bg-blue-600/10"
        />
        <StatCard
          icon={CheckCircle2}
          label="Төлсөн нэхэмжлэл"
          value={stats ? String(stats.paidCount) : undefined}
          isLoading={isLoading}
          color="text-emerald-500"
          bgColor="bg-emerald-600/10"
        />
        <StatCard
          icon={Clock}
          label="Хүлээгдэж буй"
          value={stats ? `${stats.pendingCount} (₮${stats.pendingAmount.toLocaleString()})` : undefined}
          isLoading={isLoading}
          color="text-amber-500"
          bgColor="bg-amber-600/10"
        />
      </div>

      {/* Invoice list */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader className="flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="text-base text-slate-200">Нэхэмжлэлүүд</CardTitle>
          <div className="flex gap-1">
            {(['all', 'paid', 'pending'] as const).map((f) => (
              <Button
                key={f}
                variant={filter === f ? 'default' : 'ghost'}
                size="sm"
                className={`text-xs h-7 ${filter !== f ? 'text-slate-400 hover:text-slate-200' : ''}`}
                onClick={() => setFilter(f)}
              >
                {f === 'all' ? 'Бүгд' : f === 'paid' ? 'Төлсөн' : 'Хүлээгдэж буй'}
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full bg-slate-800" />)}
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-8">Нэхэмжлэл олдсонгүй</p>
          ) : (
            <div className="rounded-lg border border-slate-800 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-800 hover:bg-slate-800/50">
                    <TableHead className="text-slate-400">Байгууллага</TableHead>
                    <TableHead className="text-slate-400">Нэхэмжлэл</TableHead>
                    <TableHead className="text-slate-400">Багц</TableHead>
                    <TableHead className="text-right text-slate-400">Дүн</TableHead>
                    <TableHead className="text-center text-slate-400">Төлөв</TableHead>
                    <TableHead className="text-slate-400">Огноо</TableHead>
                    <TableHead className="text-slate-400">Төлсөн</TableHead>
                    <TableHead className="text-right text-slate-400"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((inv) => (
                    <TableRow key={inv.id} className="border-slate-800 hover:bg-slate-800/30">
                      <TableCell className="text-slate-200 font-medium">{inv.companyName}</TableCell>
                      <TableCell className="font-mono text-xs text-slate-400">{inv.invoiceNo}</TableCell>
                      <TableCell className="text-sm text-slate-300">
                        {COMPANY_PLAN_LABELS[inv.plan] || inv.plan}
                      </TableCell>
                      <TableCell className="text-right text-slate-200">
                        ₮{inv.amount?.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge
                          variant={inv.status === 'paid' ? 'default' : 'secondary'}
                          className={
                            inv.status === 'paid'
                              ? 'bg-emerald-900/50 text-emerald-400 border-emerald-800'
                              : 'bg-amber-900/30 text-amber-400 border-amber-800'
                          }
                        >
                          {inv.status === 'paid'
                            ? inv.manuallyPaid ? 'Гараар' : 'Төлсөн'
                            : 'Хүлээгдэж буй'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-slate-500">{formatDate(inv.createdAt)}</TableCell>
                      <TableCell className="text-xs text-slate-500">{formatDate(inv.paidAt)}</TableCell>
                      <TableCell className="text-right">
                        <Link href={`/super-admin/companies/${inv.companyId}`}>
                          <Button variant="ghost" size="sm" className="h-7 text-xs text-slate-400 hover:text-slate-200">
                            <ExternalLink className="h-3 w-3" />
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  isLoading,
  color,
  bgColor,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value?: string;
  isLoading: boolean;
  color: string;
  bgColor: string;
}) {
  return (
    <Card className="bg-slate-900 border-slate-800">
      <CardContent className="flex items-center gap-4 p-5">
        <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${bgColor}`}>
          <Icon className={`h-5 w-5 ${color}`} />
        </div>
        <div>
          <p className="text-xs text-slate-500">{label}</p>
          {isLoading ? (
            <Skeleton className="mt-1 h-7 w-24 bg-slate-800" />
          ) : (
            <p className="text-lg font-bold tabular-nums text-white">{value ?? '-'}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
