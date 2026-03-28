'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  ArrowLeft,
  Building2,
  Users,
  Shield,
  Package,
  Settings,
  Ban,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Save,
  CreditCard,
  Calendar,
  Receipt,
  Clock,
  Sparkles,
  CheckCircle,
  Trash2,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useSuperAdminApi } from '../../components/use-super-admin-api';

const darkCard = 'bg-slate-900 border-slate-800';
const darkText = 'text-slate-200';
const darkMuted = 'text-slate-500';
const darkInput = 'bg-slate-800 border-slate-700 text-slate-200';
import {
  COMPANY_STATUS_LABELS,
  COMPANY_STATUS_COLORS,
  COMPANY_PLAN_LABELS,
  TENANT_ROLE_LABELS,
  PLAN_DEFINITIONS,
  type Company,
  type CompanyStatus,
  type CompanyPlan,
  type SaaSModule,
  type TenantRole,
  type PlanDefinition,
} from '@/types/company';

const MODULE_LABELS: Record<SaaSModule, string> = {
  company: 'Компани',
  organization: 'Байгууллагын бүтэц',
  employees: 'Ажилтнууд',
  projects: 'Төсөл',
  attendance: 'Ирц',
  vacation: 'Амралт чөлөө',
  recruitment: 'Сонгон шалгаруулалт',
  onboarding: 'Ажилд авах',
  offboarding: 'Ажлаас гарах',
  training: 'Сургалт',
  survey: 'Санал асуулга',
  points: 'Оноо',
  employment_relations: 'Хөдөлмөрийн харилцаа',
  skills: 'Ур чадвар',
  business_plan: 'Бизнес төлөвлөгөө',
  calendar: 'Календар',
  meetings: 'Уулзалт',
  ai_assistant: 'AI туслах',
  official_letters: 'Албан бичиг',
};

interface CompanyUser {
  uid: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  status: string;
  disabled: boolean;
  jobTitle: string;
}

export default function CompanyDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const { fetchApi } = useSuperAdminApi();
  const companyId = params.id as string;

  const [company, setCompany] = useState<Company | null>(null);
  const [users, setUsers] = useState<CompanyUser[]>([]);
  const [plans, setPlans] = useState<PlanDefinition[]>(PLAN_DEFINITIONS);
  const [isLoading, setIsLoading] = useState(true);
  const [isUsersLoading, setIsUsersLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'modules' | 'users' | 'limits' | 'billing' | 'danger'>('overview');

  useEffect(() => {
    fetch('/api/pricing')
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d.plans) && d.plans.length > 0) setPlans(d.plans); })
      .catch(() => {});
  }, []);

  const loadCompany = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await fetchApi<{ company: Company }>(`/company/${companyId}`);
      setCompany(data.company);
    } catch (err: unknown) {
      toast({ title: 'Алдаа', description: err instanceof Error ? err.message : 'Failed', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }, [fetchApi, companyId, toast]);

  const loadUsers = useCallback(async () => {
    setIsUsersLoading(true);
    try {
      const data = await fetchApi<{ users: CompanyUser[] }>(`/company/${companyId}/users`);
      setUsers(data.users);
    } catch (err: unknown) {
      console.error('Failed to load users:', err);
    } finally {
      setIsUsersLoading(false);
    }
  }, [fetchApi, companyId]);

  useEffect(() => {
    loadCompany();
    loadUsers();
  }, [loadCompany, loadUsers]);

  const updateCompany = async (body: Record<string, unknown>) => {
    setIsSaving(true);
    try {
      const data = await fetchApi<{ company: Company }>(`/company/${companyId}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
      setCompany(data.company);
      toast({ title: 'Амжилттай шинэчлэгдлээ' });
    } catch (err: unknown) {
      toast({ title: 'Алдаа', description: err instanceof Error ? err.message : 'Failed', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const updateUserRole = async (uid: string, role: TenantRole) => {
    try {
      await fetchApi(`/company/${companyId}/users`, {
        method: 'POST',
        body: JSON.stringify({ targetUid: uid, role }),
      });
      toast({ title: 'Эрх амжилттай шинэчлэгдлээ' });
      loadUsers();
    } catch (err: unknown) {
      toast({ title: 'Алдаа', description: err instanceof Error ? err.message : 'Failed', variant: 'destructive' });
    }
  };

  const toggleUserDisabled = async (uid: string, disabled: boolean) => {
    try {
      await fetchApi(`/company/${companyId}/users`, {
        method: 'POST',
        body: JSON.stringify({ targetUid: uid, disabled }),
      });
      toast({ title: disabled ? 'Хэрэглэгч блоклогдлоо' : 'Хэрэглэгч нээгдлээ' });
      loadUsers();
    } catch (err: unknown) {
      toast({ title: 'Алдаа', description: err instanceof Error ? err.message : 'Failed', variant: 'destructive' });
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 sm:grid-cols-3">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!company) {
    return (
      <div className="p-6">
        <p className="text-destructive">Байгууллага олдсонгүй</p>
        <Button variant="link" className="mt-2" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Буцах
        </Button>
      </div>
    );
  }

  const tabs = [
    { id: 'overview' as const, label: 'Ерөнхий', icon: Building2 },
    { id: 'billing' as const, label: 'Төлбөр', icon: CreditCard },
    { id: 'modules' as const, label: 'Модулууд', icon: Package },
    { id: 'users' as const, label: 'Хэрэглэгчид', icon: Users },
    { id: 'limits' as const, label: 'Хязгаарлалт', icon: Settings },
    { id: 'danger' as const, label: 'Устгах', icon: Trash2 },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">{company.name}</h1>
              <Badge className={COMPANY_STATUS_COLORS[company.status]}>
                {COMPANY_STATUS_LABELS[company.status]}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              {company.email} {company.domain ? `· ${company.domain}` : ''}
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          {company.status === 'suspended' ? (
            <Button
              variant="default"
              size="sm"
              onClick={() => updateCompany({ status: 'active' })}
              disabled={isSaving}
            >
              <CheckCircle2 className="h-4 w-4 mr-1" /> Идэвхжүүлэх
            </Button>
          ) : company.status !== 'cancelled' ? (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm">
                  <Ban className="h-4 w-4 mr-1" /> Түр зогсоох
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Байгууллагыг түр зогсоох уу?</AlertDialogTitle>
                  <AlertDialogDescription>
                    "{company.name}" байгууллагын хандалтыг түр хязгаарлана. Бүх хэрэглэгчид нэвтрэх боломжгүй болно.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Цуцлах</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    onClick={() => updateCompany({ status: 'suspended' })}
                  >
                    Зогсоох
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : null}
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid gap-4 sm:grid-cols-4">
        <QuickStat label="Багц" value={COMPANY_PLAN_LABELS[company.plan]} />
        <QuickStat label="Ажилтан" value={String(company.employeeCount || 0)} />
        <QuickStat label="Хязгаар" value={String(company.limits?.maxEmployees || 0)} />
        <QuickStat
          label="Модуль"
          value={String(
            Object.values(company.modules || {}).filter((m) => m?.enabled).length
          )}
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm border-b-2 transition-colors ${
              tab.id === 'danger'
                ? activeTab === 'danger'
                  ? 'border-destructive text-destructive font-medium'
                  : 'border-transparent text-destructive/60 hover:text-destructive'
                : activeTab === tab.id
                ? 'border-primary text-primary font-medium'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'overview' && (
        <OverviewTab company={company} onSave={updateCompany} isSaving={isSaving} plans={plans} />
      )}
      {activeTab === 'modules' && (
        <ModulesTab company={company} onToggle={updateCompany} isSaving={isSaving} />
      )}
      {activeTab === 'users' && (
        <UsersTab
          users={users}
          isLoading={isUsersLoading}
          onRefresh={loadUsers}
          onChangeRole={updateUserRole}
          onToggleDisabled={toggleUserDisabled}
        />
      )}
      {activeTab === 'billing' && (
        <BillingTab companyId={companyId} company={company} onRefresh={loadCompany} plans={plans} />
      )}
      {activeTab === 'limits' && (
        <LimitsTab company={company} onSave={updateCompany} isSaving={isSaving} />
      )}
      {activeTab === 'danger' && (
        <DangerZoneTab
          companyId={companyId}
          company={company}
          onDeleted={() => router.replace('/super-admin/companies')}
          onRestored={loadCompany}
        />
      )}
    </div>
  );
}

/* ───────────────── Overview Tab ───────────────── */

function OverviewTab({
  company,
  onSave,
  isSaving,
  plans,
}: {
  company: Company;
  onSave: (body: Record<string, unknown>) => Promise<void>;
  isSaving: boolean;
  plans: PlanDefinition[];
}) {
  const [name, setName] = useState(company.name || '');
  const [email, setEmail] = useState(company.email || '');
  const [phone, setPhone] = useState(company.phone || '');
  const [domain, setDomain] = useState(company.domain || '');
  const [plan, setPlan] = useState(company.plan);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ерөнхий мэдээлэл</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Нэр</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Имэйл</Label>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Утас</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Домэйн</Label>
            <Input value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="example.com" />
          </div>
          <Button
            onClick={() => onSave({ name, email, phone, domain })}
            disabled={isSaving}
            className="w-full"
          >
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            Хадгалах
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Багц өөрчлөх</CardTitle>
          <CardDescription>Багц солиход модуль, хязгаарлалт автоматаар шинэчлэгдэнэ</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Select value={plan} onValueChange={(v) => setPlan(v as CompanyPlan)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {plans.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  <span className="font-medium">{p.nameMN}</span>
                  <span className="text-muted-foreground ml-2 text-xs">
                    {p.price > 0 ? `₮${p.price.toLocaleString()}/сар` : 'Үнэгүй'}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {plan !== company.plan && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button className="w-full" disabled={isSaving}>
                  {COMPANY_PLAN_LABELS[company.plan]} → {COMPANY_PLAN_LABELS[plan]} болгох
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Багц солих уу?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Модулууд болон хязгаарлалт {COMPANY_PLAN_LABELS[plan]} багцын тохиргоогоор шинэчлэгдэнэ.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Цуцлах</AlertDialogCancel>
                  <AlertDialogAction onClick={() => onSave({ plan })}>
                    Солих
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}

          <div className="rounded-lg border p-4 space-y-2 text-sm">
            <p className="font-medium">Одоогийн багц: {COMPANY_PLAN_LABELS[company.plan]}</p>
            <p className="text-muted-foreground">
              Ажилтан: {company.employeeCount || 0} / {company.limits?.maxEmployees || 0}
            </p>
            <p className="text-muted-foreground">
              Төсөл: {company.limits?.maxProjects || 0} хязгаар
            </p>
            <p className="text-muted-foreground">
              Хадгалалт: {company.limits?.maxStorageMB || 0} MB
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ───────────────── Modules Tab ───────────────── */

function ModulesTab({
  company,
  onToggle,
  isSaving,
}: {
  company: Company;
  onToggle: (body: Record<string, unknown>) => Promise<void>;
  isSaving: boolean;
}) {
  const allModules = Object.keys(MODULE_LABELS) as SaaSModule[];
  const baseModules: SaaSModule[] = ['company', 'organization', 'employees'];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Модулууд</CardTitle>
        <CardDescription>Байгууллагад зөвшөөрөгдсөн модулуудыг удирдана</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {allModules.map((mod) => {
            const isEnabled = company.modules?.[mod]?.enabled === true;
            const isBase = baseModules.includes(mod);

            return (
              <div
                key={mod}
                className={`flex items-center justify-between rounded-lg border p-3 transition-colors ${
                  isEnabled ? 'bg-primary/5 border-primary/20' : 'bg-muted/30'
                }`}
              >
                <div>
                  <p className={`text-sm font-medium ${isEnabled ? '' : 'text-muted-foreground'}`}>
                    {MODULE_LABELS[mod]}
                  </p>
                  {isBase && (
                    <p className="text-[10px] text-muted-foreground">Үндсэн модуль</p>
                  )}
                </div>
                <Switch
                  checked={isEnabled}
                  disabled={isBase || isSaving}
                  onCheckedChange={(enabled) =>
                    onToggle({ toggleModule: { module: mod, enabled } })
                  }
                />
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

/* ───────────────── Users Tab ───────────────── */

function UsersTab({
  users,
  isLoading,
  onRefresh,
  onChangeRole,
  onToggleDisabled,
}: {
  users: CompanyUser[];
  isLoading: boolean;
  onRefresh: () => void;
  onChangeRole: (uid: string, role: TenantRole) => Promise<void>;
  onToggleDisabled: (uid: string, disabled: boolean) => Promise<void>;
}) {
  const validRoles: TenantRole[] = ['company_super_admin', 'admin', 'manager', 'employee'];

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-base">Хэрэглэгчид</CardTitle>
          <CardDescription>{users.length} хэрэглэгч</CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={onRefresh} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
          Шинэчлэх
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
          </div>
        ) : users.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Хэрэглэгч олдсонгүй</p>
        ) : (
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Нэр</TableHead>
                  <TableHead>Имэйл</TableHead>
                  <TableHead>Албан тушаал</TableHead>
                  <TableHead>Эрх</TableHead>
                  <TableHead className="text-center">Төлөв</TableHead>
                  <TableHead className="text-right">Үйлдэл</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.uid}>
                    <TableCell className="font-medium">
                      {u.lastName} {u.firstName}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">{u.email}</TableCell>
                    <TableCell className="text-xs">{u.jobTitle}</TableCell>
                    <TableCell>
                      <Select
                        value={u.role}
                        onValueChange={(v) => onChangeRole(u.uid, v as TenantRole)}
                      >
                        <SelectTrigger className="h-8 w-[130px] text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {validRoles.map((r) => (
                            <SelectItem key={r} value={r}>
                              {TENANT_ROLE_LABELS[r]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge
                        variant={u.disabled ? 'destructive' : 'default'}
                        className="text-[10px]"
                      >
                        {u.disabled ? 'Блоклогдсон' : 'Идэвхтэй'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant={u.disabled ? 'outline' : 'ghost'}
                        size="sm"
                        className="text-xs h-7"
                        onClick={() => onToggleDisabled(u.uid, !u.disabled)}
                      >
                        {u.disabled ? (
                          <>
                            <CheckCircle2 className="h-3 w-3 mr-1" /> Нээх
                          </>
                        ) : (
                          <>
                            <Ban className="h-3 w-3 mr-1" /> Блоклох
                          </>
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ───────────────── Limits Tab ───────────────── */

function LimitsTab({
  company,
  onSave,
  isSaving,
}: {
  company: Company;
  onSave: (body: Record<string, unknown>) => Promise<void>;
  isSaving: boolean;
}) {
  const limits = company.limits || {};
  const [maxEmployees, setMaxEmployees] = useState(String(limits.maxEmployees || 0));
  const [maxProjects, setMaxProjects] = useState(String(limits.maxProjects || 0));
  const [maxDepartments, setMaxDepartments] = useState(String(limits.maxDepartments || 0));
  const [maxStorageMB, setMaxStorageMB] = useState(String(limits.maxStorageMB || 0));
  const [aiQueries, setAiQueries] = useState(String(limits.aiQueriesPerMonth || 0));

  const handleSave = () => {
    onSave({
      limits: {
        maxEmployees: Number(maxEmployees),
        maxProjects: Number(maxProjects),
        maxDepartments: Number(maxDepartments),
        maxStorageMB: Number(maxStorageMB),
        aiQueriesPerMonth: Number(aiQueries),
      },
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Хязгаарлалт</CardTitle>
        <CardDescription>Байгууллагын нөөцийн хязгаарыг тохируулна</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 max-w-md">
        <LimitField label="Хамгийн их ажилтан" value={maxEmployees} onChange={setMaxEmployees} />
        <LimitField label="Хамгийн их төсөл" value={maxProjects} onChange={setMaxProjects} />
        <LimitField label="Хамгийн их хэлтэс" value={maxDepartments} onChange={setMaxDepartments} />
        <LimitField label="Хадгалалт (MB)" value={maxStorageMB} onChange={setMaxStorageMB} />
        <LimitField label="AI хүсэлт / сар" value={aiQueries} onChange={setAiQueries} />

        <Button onClick={handleSave} disabled={isSaving} className="w-full">
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
          Хадгалах
        </Button>
      </CardContent>
    </Card>
  );
}

function LimitField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input
        type="number"
        min="0"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9"
      />
    </div>
  );
}

/* ───────────────── Billing Tab ───────────────── */

interface BillingInvoice {
  id: string;
  invoiceNo: string;
  plan: CompanyPlan;
  billingCycle: string;
  amount: number;
  currency: string;
  status: string;
  manuallyPaid?: boolean;
  createdAt: string;
  paidAt: string | null;
}

interface BillingData {
  subscription: {
    plan: CompanyPlan;
    startDate?: string;
    endDate?: string;
    billingCycle?: string;
    amount?: number;
    paymentStatus?: string;
    trialEndsAt?: string;
    lastPaymentDate?: string;
    nextPaymentDate?: string;
  } | null;
  plan: CompanyPlan;
  status: CompanyStatus;
  invoices: BillingInvoice[];
}

function BillingTab({
  companyId,
  company,
  onRefresh,
  plans,
}: {
  companyId: string;
  company: Company;
  onRefresh: () => void;
  plans: PlanDefinition[];
}) {
  const { fetchApi } = useSuperAdminApi();
  const { toast } = useToast();
  const [billing, setBilling] = useState<BillingData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isActing, setIsActing] = useState(false);

  // Change plan form state
  const [newPlan, setNewPlan] = useState<CompanyPlan>(company.plan);
  const [months, setMonths] = useState('1');
  const [extendMonths, setExtendMonths] = useState('1');
  const [trialDays, setTrialDays] = useState('14');

  const loadBilling = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await fetchApi<BillingData>(`/company/${companyId}/billing`);
      setBilling(data);
    } catch (err: unknown) {
      console.error('Failed to load billing:', err);
    } finally {
      setIsLoading(false);
    }
  }, [fetchApi, companyId]);

  useEffect(() => {
    loadBilling();
  }, [loadBilling]);

  const billingAction = async (body: Record<string, unknown>) => {
    setIsActing(true);
    try {
      const result = await fetchApi<{ message: string }>(`/company/${companyId}/billing`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      toast({ title: 'Амжилттай', description: result.message });
      loadBilling();
      onRefresh();
    } catch (err: unknown) {
      toast({
        title: 'Алдаа',
        description: err instanceof Error ? err.message : 'Failed',
        variant: 'destructive',
      });
    } finally {
      setIsActing(false);
    }
  };

  const sub = billing?.subscription;

  const formatDate = (val: string | undefined | null) => {
    if (!val) return '-';
    return new Date(val).toLocaleDateString('mn-MN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const isExpired = sub?.endDate ? new Date(sub.endDate) < new Date() : false;

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-32 w-full" />)}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Subscription status card */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-base">Захиалгын мэдээлэл</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-muted-foreground text-xs">Багц</p>
                <p className="font-semibold">{COMPANY_PLAN_LABELS[billing?.plan || 'free']}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Төлөв</p>
                <Badge className={COMPANY_STATUS_COLORS[billing?.status || 'trial']}>
                  {COMPANY_STATUS_LABELS[billing?.status || 'trial']}
                </Badge>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Эхлэх огноо</p>
                <p className="font-medium">{formatDate(sub?.startDate)}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Дуусах огноо</p>
                <div className="flex items-center gap-1.5">
                  <p className={`font-medium ${isExpired ? 'text-red-500' : ''}`}>
                    {formatDate(sub?.endDate)}
                  </p>
                  {isExpired && <Badge variant="destructive" className="text-[10px]">Дууссан</Badge>}
                </div>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Төлбөрийн хугацаа</p>
                <p className="font-medium">{sub?.billingCycle === 'yearly' ? 'Жилийн' : 'Сарын'}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Дүн</p>
                <p className="font-medium">₮{(sub?.amount || 0).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Төлбөрийн төлөв</p>
                <Badge variant={sub?.paymentStatus === 'paid' ? 'default' : 'secondary'}>
                  {sub?.paymentStatus === 'paid' ? 'Төлсөн' : sub?.paymentStatus === 'pending' ? 'Хүлээгдэж буй' : sub?.paymentStatus || 'Тодорхойгүй'}
                </Badge>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Сүүлийн төлбөр</p>
                <p className="font-medium">{formatDate(sub?.lastPaymentDate)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick actions */}
        <div className="space-y-4">
          {/* Change plan */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-sm">Багц солих</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <Select value={newPlan} onValueChange={(v) => setNewPlan(v as CompanyPlan)}>
                  <SelectTrigger className="flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {plans.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.nameMN} {p.price > 0 ? `(₮${p.price.toLocaleString()}/сар)` : '(Үнэгүй)'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  min="1"
                  max="24"
                  value={months}
                  onChange={(e) => setMonths(e.target.value)}
                  className="w-20"
                  placeholder="Сар"
                />
              </div>
              <Button
                className="w-full"
                size="sm"
                disabled={isActing || newPlan === company.plan}
                onClick={() => billingAction({ action: 'change_plan', plan: newPlan, months: Number(months) })}
              >
                {isActing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <CheckCircle className="h-4 w-4 mr-1" />}
                {COMPANY_PLAN_LABELS[company.plan]} → {COMPANY_PLAN_LABELS[newPlan]} ({months} сар)
              </Button>
            </CardContent>
          </Card>

          {/* Extend + Trial */}
          <div className="grid grid-cols-2 gap-3">
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <CardTitle className="text-sm">Сунгах</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex gap-2">
                  <Input
                    type="number"
                    min="1"
                    max="24"
                    value={extendMonths}
                    onChange={(e) => setExtendMonths(e.target.value)}
                    className="flex-1"
                  />
                  <span className="text-sm text-muted-foreground self-center">сар</span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full"
                  disabled={isActing}
                  onClick={() => billingAction({ action: 'extend', months: Number(extendMonths) })}
                >
                  Хугацаа сунгах
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <CardTitle className="text-sm">Туршилт</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex gap-2">
                  <Input
                    type="number"
                    min="1"
                    max="90"
                    value={trialDays}
                    onChange={(e) => setTrialDays(e.target.value)}
                    className="flex-1"
                  />
                  <span className="text-sm text-muted-foreground self-center">хоног</span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full"
                  disabled={isActing}
                  onClick={() => billingAction({ action: 'set_trial', days: Number(trialDays) })}
                >
                  Trial тохируулах
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Invoice history */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-base">Нэхэмжлэлийн түүх</CardTitle>
          </div>
          <Button variant="outline" size="sm" onClick={loadBilling} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
            Шинэчлэх
          </Button>
        </CardHeader>
        <CardContent>
          {!billing?.invoices?.length ? (
            <p className="text-sm text-muted-foreground text-center py-8">Нэхэмжлэл байхгүй</p>
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Нэхэмжлэл</TableHead>
                    <TableHead>Багц</TableHead>
                    <TableHead>Хугацаа</TableHead>
                    <TableHead className="text-right">Дүн</TableHead>
                    <TableHead className="text-center">Төлөв</TableHead>
                    <TableHead>Огноо</TableHead>
                    <TableHead className="text-right">Үйлдэл</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {billing.invoices.map((inv) => (
                    <TableRow key={inv.id}>
                      <TableCell className="font-mono text-xs">{inv.invoiceNo}</TableCell>
                      <TableCell className="text-sm">{COMPANY_PLAN_LABELS[inv.plan] || inv.plan}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {inv.billingCycle === 'yearly' ? 'Жилийн' : 'Сарын'}
                      </TableCell>
                      <TableCell className="text-right text-sm">₮{inv.amount?.toLocaleString()}</TableCell>
                      <TableCell className="text-center">
                        <Badge
                          variant={inv.status === 'paid' ? 'default' : 'secondary'}
                          className={inv.status === 'paid' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200' : ''}
                        >
                          {inv.status === 'paid' ? (inv.manuallyPaid ? 'Гараар төлсөн' : 'Төлсөн') : 'Хүлээгдэж буй'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{formatDate(inv.createdAt)}</TableCell>
                      <TableCell className="text-right">
                        {inv.status !== 'paid' && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            disabled={isActing}
                            onClick={() => billingAction({ action: 'mark_paid', invoiceNo: inv.invoiceNo })}
                          >
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Төлсөн болгох
                          </Button>
                        )}
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

function QuickStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-bold mt-1">{value}</p>
    </div>
  );
}

/* ───────────────── Danger Zone Tab ───────────────── */

function DangerZoneTab({
  companyId,
  company,
  onDeleted,
  onRestored,
}: {
  companyId: string;
  company: Company;
  onDeleted: () => void;
  onRestored: () => void;
}) {
  const { fetchApi } = useSuperAdminApi();
  const { toast } = useToast();

  const [isActing, setIsActing] = useState(false);

  // Soft delete state
  const [softReason, setSoftReason] = useState('');

  // Hard delete state
  const [hardConfirmName, setHardConfirmName] = useState('');
  const [hardReason, setHardReason] = useState('');

  const isCancelled = company.status === 'cancelled';
  const deletionDate = (company as unknown as Record<string, string>).deletionScheduledAt;

  const softDelete = async () => {
    setIsActing(true);
    try {
      const res = await fetchApi<{ message: string; deletionScheduledAt: string }>(
        `/company/${companyId}/delete`,
        {
          method: 'DELETE',
          body: JSON.stringify({ mode: 'soft', reason: softReason }),
        }
      );
      toast({ title: 'Цуцлагдлаа', description: res.message });
      onRestored(); // reload company
    } catch (err) {
      toast({
        title: 'Алдаа',
        description: err instanceof Error ? err.message : 'Failed',
        variant: 'destructive',
      });
    } finally {
      setIsActing(false);
    }
  };

  const hardDelete = async () => {
    setIsActing(true);
    try {
      const res = await fetchApi<{ message: string; summary: Record<string, unknown> }>(
        `/company/${companyId}/delete`,
        {
          method: 'DELETE',
          body: JSON.stringify({
            mode: 'hard',
            confirmName: hardConfirmName,
            reason: hardReason,
          }),
        }
      );
      toast({ title: '✅ Бүрэн устгагдлаа', description: res.message });
      onDeleted();
    } catch (err) {
      toast({
        title: 'Алдаа',
        description: err instanceof Error ? err.message : 'Failed',
        variant: 'destructive',
      });
    } finally {
      setIsActing(false);
    }
  };

  const restore = async () => {
    setIsActing(true);
    try {
      const res = await fetchApi<{ message: string }>(`/company/${companyId}/delete`, {
        method: 'POST',
      });
      toast({ title: 'Сэргээгдлээ', description: res.message });
      onRestored();
    } catch (err) {
      toast({
        title: 'Алдаа',
        description: err instanceof Error ? err.message : 'Failed',
        variant: 'destructive',
      });
    } finally {
      setIsActing(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Warning banner */}
      <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 flex gap-3">
        <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="font-semibold text-destructive">Аюулт бүс</p>
          <p className="text-muted-foreground mt-1">
            Энэ хэсгийн үйлдлүүд буцаах боломжгүй (hard delete) эсвэл байгууллагын
            хэрэглэгчдийг системд нэвтрэхгүй болгодог. Маш болгоомжтой ашиглана уу.
          </p>
        </div>
      </div>

      {/* Restore — only when cancelled */}
      {isCancelled && (
        <Card className="border-amber-400/40">
          <CardHeader>
            <div className="flex items-center gap-2">
              <RotateCcw className="h-5 w-5 text-amber-500" />
              <CardTitle className="text-base text-amber-600">Байгууллага сэргээх</CardTitle>
            </div>
            <CardDescription>
              {deletionDate
                ? `Бүрэн устгагдах огноо: ${new Date(deletionDate).toLocaleDateString('mn-MN')} — тэр өдрийн өмнө сэргээх боломжтой.`
                : 'Байгууллага цуцлагдсан байна. Сэргээх боломжтой.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" className="border-amber-400 text-amber-600 hover:bg-amber-50" disabled={isActing}>
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Сэргээх
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Байгууллагыг сэргээх үү?</AlertDialogTitle>
                  <AlertDialogDescription>
                    "{company.name}" байгууллага идэвхтэй болж, хэрэглэгчид дахин нэвтрэх боломжтой болно.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Цуцлах</AlertDialogCancel>
                  <AlertDialogAction onClick={restore} disabled={isActing}>
                    {isActing && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                    Сэргээх
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>
      )}

      {/* Soft delete */}
      {!isCancelled && (
        <Card className="border-orange-400/40">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Ban className="h-5 w-5 text-orange-500" />
              <CardTitle className="text-base">Байгууллага цуцлах (Soft delete)</CardTitle>
            </div>
            <CardDescription>
              Байгууллагыг "cancelled" болгож, 30 хоногийн дараа автоматаар бүрэн устгана.
              Энэ хугацаанд сэргээх боломжтой. Хэрэглэгчид нэвтрэх боломжгүй болно.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Шалтгаан (заавал биш)</Label>
              <Input
                placeholder="Цуцлалтын шалтгаан..."
                value={softReason}
                onChange={(e) => setSoftReason(e.target.value)}
                disabled={isActing}
              />
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" className="border-orange-400 text-orange-600 hover:bg-orange-50" disabled={isActing}>
                  <Ban className="h-4 w-4 mr-2" />
                  Байгууллагыг цуцлах
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Байгууллагыг цуцлах уу?</AlertDialogTitle>
                  <AlertDialogDescription className="space-y-2">
                    <span className="block">
                      "{company.name}" байгууллагыг цуцлахад:
                    </span>
                    <ul className="list-disc list-inside text-sm space-y-1">
                      <li>Бүх хэрэглэгчийн нэвтрэх эрх хаагдана</li>
                      <li>30 хоногийн дараа өгөгдөл бүрэн устгагдана</li>
                      <li>Энэ хугацаанд "Сэргээх" товчоор буцаах боломжтой</li>
                    </ul>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Цуцлах</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-orange-500 hover:bg-orange-600 text-white"
                    onClick={softDelete}
                    disabled={isActing}
                  >
                    {isActing && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                    Тийм, цуцлах
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>
      )}

      {/* Hard delete */}
      <Card className="border-destructive/60">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Trash2 className="h-5 w-5 text-destructive" />
            <CardTitle className="text-base text-destructive">Бүрэн устгах (Hard delete)</CardTitle>
          </div>
          <CardDescription>
            <span className="text-destructive font-semibold">Буцаах боломжгүй.</span>{' '}
            Бүх Firestore өгөгдөл, файлууд, Firebase Auth хэрэглэгчид устгагдана.
            Баталгаажуулахын тулд байгууллагын нэрийг доор бичнэ үү.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm space-y-1">
            <p className="font-medium text-destructive">Устгагдах зүйлс:</p>
            <ul className="list-disc list-inside text-muted-foreground space-y-0.5">
              <li>companies/{companyId} + бүх subcollections</li>
              <li>Холбоотой er_documents, vacancies, candidates г.м.</li>
              <li>Firebase Storage файлууд (companies/{companyId}/)</li>
              <li>Firebase Auth хэрэглэгчдийн акаунт</li>
            </ul>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">
              Баталгаажуулах үүднээс байгууллагын нэрийг бичнэ үү:{' '}
              <span className="font-mono text-destructive">{company.name}</span>
            </Label>
            <Input
              placeholder={company.name}
              value={hardConfirmName}
              onChange={(e) => setHardConfirmName(e.target.value)}
              disabled={isActing}
              className="border-destructive/40 focus:border-destructive"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Шалтгаан (заавал биш)</Label>
            <Input
              placeholder="Устгалтын шалтгаан..."
              value={hardReason}
              onChange={(e) => setHardReason(e.target.value)}
              disabled={isActing}
            />
          </div>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="destructive"
                disabled={isActing || hardConfirmName !== company.name}
                className="w-full"
              >
                {isActing ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Trash2 className="h-4 w-4 mr-2" />
                )}
                Бүрэн устгах — {company.name}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="text-destructive">
                  Бүрэн устгах — эцсийн баталгаа
                </AlertDialogTitle>
                <AlertDialogDescription>
                  <span className="font-semibold text-destructive">"{company.name}"</span>{' '}
                  байгууллагын бүх өгөгдөл, файлууд болон{' '}
                  <span className="font-semibold">хэрэглэгчдийн акаунт</span> устгагдана.
                  Энэ үйлдлийг буцаах боломжгүй. Та итгэлтэй байна уу?
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Болих</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive hover:bg-destructive/90 text-white"
                  onClick={hardDelete}
                  disabled={isActing}
                >
                  {isActing && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                  Тийм, бүрэн устга
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    </div>
  );
}
