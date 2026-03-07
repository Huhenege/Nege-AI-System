'use client';

import { useState } from 'react';
import { useTenant } from '@/contexts/tenant-context';
import { useFirebase, useCollection, useMemoFirebase, tenantCollection } from '@/firebase';
import { query, orderBy } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  PLAN_DEFINITIONS,
  COMPANY_PLAN_LABELS,
  COMPANY_STATUS_LABELS,
  COMPANY_STATUS_COLORS,
  type CompanyPlan,
} from '@/types/company';
import { Check, Loader2, Sparkles, QrCode, Receipt } from 'lucide-react';
import { cn } from '@/lib/utils';

interface InvoiceRecord {
  id: string;
  invoiceNo: string;
  plan: CompanyPlan;
  billingCycle: string;
  amount: number;
  currency: string;
  status: string;
  createdAt: { toDate?: () => Date } | string;
  paidAt?: { toDate?: () => Date } | string;
}

interface InvoiceResult {
  invoiceNo: string;
  qrImage: string;
  shortUrl: string;
  amount: number;
}

function formatDate(val: { toDate?: () => Date } | string | undefined): string {
  if (!val) return '-';
  const d = typeof val === 'string' ? new Date(val) : val.toDate?.() ?? new Date(val as unknown as string);
  return d.toLocaleDateString('mn-MN', { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function BillingPage() {
  const { company } = useTenant();
  const { user, firestore } = useFirebase();
  const { toast } = useToast();
  const [selectedPlan, setSelectedPlan] = useState<CompanyPlan | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [invoice, setInvoice] = useState<InvoiceResult | null>(null);
  const [isChecking, setIsChecking] = useState(false);

  const invoicesQuery = useMemoFirebase(
    ({ firestore, companyPath }) =>
      firestore && companyPath
        ? query(tenantCollection(firestore, companyPath, 'invoices'), orderBy('createdAt', 'desc'))
        : null,
    [firestore]
  );
  const { data: invoiceHistory } = useCollection<InvoiceRecord>(invoicesQuery);

  if (!company) return null;

  const currentPlan = company.plan;

  const handleUpgrade = async (plan: CompanyPlan) => {
    if (!user || plan === 'free') return;
    setSelectedPlan(plan);
    setIsCreating(true);
    setInvoice(null);

    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/billing/create-invoice', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ plan, billingCycle: 'monthly' }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed');
      }

      const data = await res.json();
      setInvoice(data);
    } catch (err: unknown) {
      toast({
        title: 'Алдаа',
        description: err instanceof Error ? err.message : 'Нэхэмжлэл үүсгэхэд алдаа гарлаа',
        variant: 'destructive',
      });
      setSelectedPlan(null);
    } finally {
      setIsCreating(false);
    }
  };

  const handleCheckPayment = async () => {
    if (!invoice) return;
    setIsChecking(true);
    try {
      const res = await fetch(`/api/billing/callback?invoice=${invoice.invoiceNo}`);
      const data = await res.json();

      if (data.status === 'paid') {
        toast({ title: 'Төлбөр амжилттай!', description: `${COMPANY_PLAN_LABELS[selectedPlan!]} багц идэвхжлээ.` });
        setInvoice(null);
        setSelectedPlan(null);
        window.location.reload();
      } else {
        toast({ title: 'Хүлээгдэж байна', description: 'Төлбөр хийгдээгүй байна. Дахин шалгана уу.' });
      }
    } catch {
      toast({ title: 'Алдаа', variant: 'destructive' });
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <div className="p-6 space-y-8 max-w-5xl mx-auto">
      {/* Current plan info */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Багц & Төлбөр</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Одоогийн багц: <span className="font-medium text-foreground">{COMPANY_PLAN_LABELS[currentPlan]}</span>
          {' · '}
          <Badge className={cn('text-xs', COMPANY_STATUS_COLORS[company.status])}>
            {COMPANY_STATUS_LABELS[company.status]}
          </Badge>
        </p>
      </div>

      {/* QR payment modal */}
      {invoice && (
        <Card className="border-primary">
          <CardHeader className="text-center">
            <QrCode className="mx-auto h-8 w-8 text-primary mb-2" />
            <CardTitle>QPay Төлбөр</CardTitle>
            <CardDescription>
              {COMPANY_PLAN_LABELS[selectedPlan!]} багц · ₮{invoice.amount.toLocaleString()}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4">
            {invoice.qrImage && (
              <img
                src={`data:image/png;base64,${invoice.qrImage}`}
                alt="QPay QR"
                className="w-64 h-64 rounded-lg border"
              />
            )}
            <p className="text-xs text-muted-foreground text-center max-w-sm">
              QR кодыг банкны аппаар уншуулна уу. Төлбөр хийсний дараа "Төлбөр шалгах" товч дарна уу.
            </p>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => { setInvoice(null); setSelectedPlan(null); }}>
                Цуцлах
              </Button>
              <Button onClick={handleCheckPayment} disabled={isChecking}>
                {isChecking && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                Төлбөр шалгах
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Plans grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {PLAN_DEFINITIONS.map((plan) => {
          const isCurrent = plan.id === currentPlan;
          const isUpgrade = PLAN_DEFINITIONS.indexOf(plan) > PLAN_DEFINITIONS.findIndex((p) => p.id === currentPlan);

          return (
            <Card
              key={plan.id}
              className={cn(
                'relative transition-all',
                isCurrent && 'border-primary ring-1 ring-primary',
                plan.id === 'pro' && !isCurrent && 'border-purple-300 dark:border-purple-800'
              )}
            >
              {plan.id === 'pro' && !isCurrent && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-purple-600 text-white">Санал болгох</Badge>
                </div>
              )}
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{plan.nameMN}</CardTitle>
                <CardDescription className="text-xs">{plan.description}</CardDescription>
                <div className="pt-2">
                  {plan.price === 0 ? (
                    <span className="text-2xl font-bold">Үнэгүй</span>
                  ) : (
                    <>
                      <span className="text-2xl font-bold">₮{plan.price.toLocaleString()}</span>
                      <span className="text-sm text-muted-foreground"> /сар</span>
                    </>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <ul className="space-y-1.5 text-xs">
                  <PlanFeature label={`${plan.limits.maxEmployees} ажилтан`} />
                  <PlanFeature label={`${plan.limits.maxProjects} төсөл`} />
                  <PlanFeature label={`${plan.limits.maxStorageMB >= 1024 ? `${plan.limits.maxStorageMB / 1024} GB` : `${plan.limits.maxStorageMB} MB`} хадгалалт`} />
                  <PlanFeature label={`${plan.modules.length} модуль`} />
                  <PlanFeature label={`${plan.limits.aiQueriesPerMonth} AI хүсэлт/сар`} />
                </ul>
                {isCurrent ? (
                  <Button variant="outline" className="w-full" disabled>
                    Одоогийн багц
                  </Button>
                ) : isUpgrade ? (
                  <Button
                    className="w-full"
                    onClick={() => handleUpgrade(plan.id)}
                    disabled={isCreating || plan.id === 'free'}
                  >
                    {isCreating && selectedPlan === plan.id ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-1" />
                    ) : (
                      <Sparkles className="h-4 w-4 mr-1" />
                    )}
                    Сунгах
                  </Button>
                ) : (
                  <Button variant="ghost" className="w-full" disabled>
                    Бага багц
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Invoice history */}
      {invoiceHistory && invoiceHistory.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Receipt className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-base">Нэхэмжлэлийн түүх</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground text-xs">
                    <th className="text-left py-2 font-medium">Нэхэмжлэл</th>
                    <th className="text-left py-2 font-medium">Багц</th>
                    <th className="text-left py-2 font-medium">Хугацаа</th>
                    <th className="text-right py-2 font-medium">Дүн</th>
                    <th className="text-center py-2 font-medium">Төлөв</th>
                    <th className="text-left py-2 font-medium">Огноо</th>
                  </tr>
                </thead>
                <tbody>
                  {invoiceHistory.map((inv) => (
                    <tr key={inv.id} className="border-b last:border-0">
                      <td className="py-2 font-mono text-xs">{inv.invoiceNo}</td>
                      <td className="py-2">{COMPANY_PLAN_LABELS[inv.plan] || inv.plan}</td>
                      <td className="py-2 text-xs text-muted-foreground">
                        {inv.billingCycle === 'yearly' ? 'Жилийн' : 'Сарын'}
                      </td>
                      <td className="py-2 text-right">₮{inv.amount?.toLocaleString()}</td>
                      <td className="py-2 text-center">
                        <Badge
                          variant={inv.status === 'paid' ? 'default' : 'secondary'}
                          className={cn(
                            'text-xs',
                            inv.status === 'paid' && 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200'
                          )}
                        >
                          {inv.status === 'paid' ? 'Төлсөн' : 'Хүлээгдэж буй'}
                        </Badge>
                      </td>
                      <td className="py-2 text-xs text-muted-foreground">{formatDate(inv.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function PlanFeature({ label }: { label: string }) {
  return (
    <li className="flex items-center gap-1.5 text-muted-foreground">
      <Check className="h-3.5 w-3.5 text-emerald-500 flex-none" />
      {label}
    </li>
  );
}
