'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Package,
  RefreshCw,
  Save,
  Pencil,
  Users,
  FolderKanban,
  Building2,
  HardDrive,
  Sparkles,
  Check,
  X,
  Crown,
  Zap,
  Rocket,
  Star,
} from 'lucide-react';
import { useSuperAdminApi } from '../components/use-super-admin-api';
import {
  type PlanDefinition,
  type SaaSModule,
  type CompanyLimits,
  BASE_MODULES,
  MODULE_LABELS,
} from '@/types/company';

const ALL_MODULES: SaaSModule[] = [
  'company', 'organization', 'employees', 'projects',
  'attendance', 'vacation', 'recruitment', 'onboarding', 'offboarding',
  'training', 'survey', 'points', 'employment_relations', 'skills',
  'business_plan', 'calendar', 'meetings', 'ai_assistant',
];

const PLAN_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  free: Star,
  starter: Zap,
  pro: Rocket,
  enterprise: Crown,
};

const PLAN_COLORS: Record<string, { border: string; bg: string; text: string; badge: string }> = {
  free: {
    border: 'border-slate-700',
    bg: 'bg-slate-800/50',
    text: 'text-slate-300',
    badge: 'bg-slate-700 text-slate-300',
  },
  starter: {
    border: 'border-blue-800/50',
    bg: 'bg-blue-900/10',
    text: 'text-blue-400',
    badge: 'bg-blue-900/50 text-blue-400 border-blue-800',
  },
  pro: {
    border: 'border-violet-800/50',
    bg: 'bg-violet-900/10',
    text: 'text-violet-400',
    badge: 'bg-violet-900/50 text-violet-400 border-violet-800',
  },
  enterprise: {
    border: 'border-amber-800/50',
    bg: 'bg-amber-900/10',
    text: 'text-amber-400',
    badge: 'bg-amber-900/50 text-amber-400 border-amber-800',
  },
};

const LIMIT_FIELDS: { key: keyof CompanyLimits; label: string; icon: React.ComponentType<{ className?: string }>; suffix: string }[] = [
  { key: 'maxEmployees', label: 'Ажилчдын тоо', icon: Users, suffix: '' },
  { key: 'maxProjects', label: 'Төслийн тоо', icon: FolderKanban, suffix: '' },
  { key: 'maxDepartments', label: 'Хэлтэс', icon: Building2, suffix: '' },
  { key: 'maxStorageMB', label: 'Хадгалах зай', icon: HardDrive, suffix: 'MB' },
  { key: 'aiQueriesPerMonth', label: 'AI хүсэлт/сар', icon: Sparkles, suffix: '' },
];

function formatPrice(amount: number): string {
  return amount === 0 ? 'Үнэгүй' : `₮${amount.toLocaleString()}`;
}

export default function PricingManagementPage() {
  const { fetchApi } = useSuperAdminApi();
  const [plans, setPlans] = useState<PlanDefinition[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [editingPlan, setEditingPlan] = useState<PlanDefinition | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadPlans = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await fetchApi<{ plans: PlanDefinition[]; updatedAt: string | null }>('/pricing');
      setPlans(data.plans);
      setLastSaved(data.updatedAt);
      setHasChanges(false);
    } catch {
      // handled silently
    } finally {
      setIsLoading(false);
    }
  }, [fetchApi]);

  useEffect(() => {
    loadPlans();
  }, [loadPlans]);

  const handleSaveAll = async () => {
    setIsSaving(true);
    setSaveMessage(null);
    try {
      await fetchApi('/pricing', {
        method: 'PUT',
        body: JSON.stringify({ plans }),
      });
      setHasChanges(false);
      setLastSaved(new Date().toISOString());
      setSaveMessage({ type: 'success', text: 'Багцын тохиргоо амжилттай хадгалагдлаа' });
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (err) {
      setSaveMessage({ type: 'error', text: 'Хадгалахад алдаа гарлаа. Дахин оролдоно уу.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditSave = (updated: PlanDefinition) => {
    setPlans((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    setEditingPlan(null);
    setHasChanges(true);
  };

  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Багцын тохиргоо</h1>
          <p className="text-slate-500 text-sm mt-1">
            Системийн төлбөрийн багцуудын үнэ, лимит, модулиудыг удирдах
          </p>
        </div>
        <div className="flex items-center gap-3">
          {lastSaved && (
            <span className="text-xs text-slate-600">
              Сүүлд хадгалсан: {new Date(lastSaved).toLocaleString('mn-MN')}
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={loadPlans}
            disabled={isLoading}
            className="border-slate-700 text-slate-300 hover:bg-slate-800"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Шинэчлэх
          </Button>
          <Button
            size="sm"
            onClick={handleSaveAll}
            disabled={!hasChanges || isSaving}
            className="bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50"
          >
            <Save className={`h-4 w-4 mr-2 ${isSaving ? 'animate-spin' : ''}`} />
            Хадгалах
          </Button>
        </div>
      </div>

      {/* Save message */}
      {saveMessage && (
        <div
          className={`rounded-lg px-4 py-3 text-sm flex items-center gap-2 ${
            saveMessage.type === 'success'
              ? 'bg-emerald-900/30 text-emerald-400 border border-emerald-800/50'
              : 'bg-red-900/30 text-red-400 border border-red-800/50'
          }`}
        >
          {saveMessage.type === 'success' ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
          {saveMessage.text}
        </div>
      )}

      {/* Unsaved changes indicator */}
      {hasChanges && (
        <div className="rounded-lg px-4 py-3 text-sm bg-amber-900/20 text-amber-400 border border-amber-800/30 flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
          Хадгалагдаагүй өөрчлөлт байна. &quot;Хадгалах&quot; товч дарна уу.
        </div>
      )}

      {/* Plans grid */}
      {isLoading ? (
        <div className="grid gap-6 lg:grid-cols-2">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-80 w-full bg-slate-800 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {plans.map((plan) => {
            const colors = PLAN_COLORS[plan.id] || PLAN_COLORS.free;
            const Icon = PLAN_ICONS[plan.id] || Package;
            return (
              <Card
                key={plan.id}
                className={`bg-slate-900 ${colors.border} border transition-all hover:border-slate-600`}
              >
                <CardHeader className="flex-row items-start justify-between space-y-0 pb-4">
                  <div className="flex items-center gap-3">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${colors.bg}`}>
                      <Icon className={`h-5 w-5 ${colors.text}`} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-lg text-white">{plan.nameMN || plan.name}</CardTitle>
                        <Badge variant="outline" className={`text-[10px] ${colors.badge}`}>
                          {plan.id.toUpperCase()}
                        </Badge>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">{plan.description}</p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-slate-400 hover:text-white hover:bg-slate-800"
                    onClick={() => setEditingPlan({ ...plan, limits: { ...plan.limits }, modules: [...plan.modules] })}
                  >
                    <Pencil className="h-4 w-4 mr-1.5" />
                    Засах
                  </Button>
                </CardHeader>
                <CardContent className="space-y-5">
                  {/* Price */}
                  <div className="flex items-baseline gap-1">
                    <span className={`text-3xl font-bold ${colors.text}`}>
                      {formatPrice(plan.price)}
                    </span>
                    {plan.price > 0 && (
                      <span className="text-sm text-slate-500">
                        /{plan.billingCycle === 'monthly' ? 'сар' : 'жил'}
                      </span>
                    )}
                  </div>

                  <Separator className="bg-slate-800" />

                  {/* Limits */}
                  <div>
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-3">Лимитүүд</p>
                    <div className="grid grid-cols-2 gap-2.5">
                      {LIMIT_FIELDS.map(({ key, label, icon: LimitIcon, suffix }) => (
                        <div key={key} className="flex items-center gap-2 text-sm">
                          <LimitIcon className="h-3.5 w-3.5 text-slate-600 flex-none" />
                          <span className="text-slate-400">{label}:</span>
                          <span className="text-white font-medium">
                            {plan.limits[key]?.toLocaleString()}{suffix && ` ${suffix}`}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <Separator className="bg-slate-800" />

                  {/* Modules */}
                  <div>
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-3">
                      Модулиуд ({plan.modules.length}/{ALL_MODULES.length})
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {ALL_MODULES.map((mod) => {
                        const isEnabled = plan.modules.includes(mod);
                        return (
                          <Badge
                            key={mod}
                            variant="outline"
                            className={`text-[11px] ${
                              isEnabled
                                ? 'bg-emerald-900/30 text-emerald-400 border-emerald-800/50'
                                : 'bg-slate-800/50 text-slate-600 border-slate-700/50'
                            }`}
                          >
                            {isEnabled && <Check className="h-3 w-3 mr-1" />}
                            {MODULE_LABELS[mod]}
                          </Badge>
                        );
                      })}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Edit dialog */}
      {editingPlan && (
        <PlanEditDialog
          plan={editingPlan}
          onSave={handleEditSave}
          onCancel={() => setEditingPlan(null)}
        />
      )}
    </div>
  );
}

function PlanEditDialog({
  plan,
  onSave,
  onCancel,
}: {
  plan: PlanDefinition;
  onSave: (plan: PlanDefinition) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<PlanDefinition>(plan);

  const updateField = <K extends keyof PlanDefinition>(key: K, value: PlanDefinition[K]) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  };

  const updateLimit = (key: keyof CompanyLimits, value: number) => {
    setDraft((prev) => ({
      ...prev,
      limits: { ...prev.limits, [key]: value },
    }));
  };

  const toggleModule = (mod: SaaSModule) => {
    if (BASE_MODULES.includes(mod)) return;
    setDraft((prev) => {
      const has = prev.modules.includes(mod);
      return {
        ...prev,
        modules: has ? prev.modules.filter((m) => m !== mod) : [...prev.modules, mod],
      };
    });
  };

  const colors = PLAN_COLORS[draft.id] || PLAN_COLORS.free;

  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="bg-slate-900 border-slate-800 text-slate-100 max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <Package className={`h-5 w-5 ${colors.text}`} />
            {draft.nameMN || draft.name} багц засах
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {/* Basic info */}
          <section className="space-y-4">
            <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider">Ерөнхий мэдээлэл</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-slate-400">Нэр (EN)</Label>
                <Input
                  value={draft.name}
                  onChange={(e) => updateField('name', e.target.value)}
                  className="bg-slate-800 border-slate-700 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-400">Нэр (MN)</Label>
                <Input
                  value={draft.nameMN}
                  onChange={(e) => updateField('nameMN', e.target.value)}
                  className="bg-slate-800 border-slate-700 text-white"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-slate-400">Тайлбар</Label>
              <Input
                value={draft.description}
                onChange={(e) => updateField('description', e.target.value)}
                className="bg-slate-800 border-slate-700 text-white"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-slate-400">Үнэ (MNT)</Label>
                <Input
                  type="number"
                  min={0}
                  value={draft.price}
                  onChange={(e) => updateField('price', Number(e.target.value))}
                  className="bg-slate-800 border-slate-700 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-400">Төлбөрийн давтамж</Label>
                <div className="flex gap-2 pt-1">
                  <Button
                    size="sm"
                    variant={draft.billingCycle === 'monthly' ? 'default' : 'outline'}
                    className={draft.billingCycle === 'monthly' ? '' : 'border-slate-700 text-slate-400'}
                    onClick={() => updateField('billingCycle', 'monthly')}
                  >
                    Сар бүр
                  </Button>
                  <Button
                    size="sm"
                    variant={draft.billingCycle === 'yearly' ? 'default' : 'outline'}
                    className={draft.billingCycle === 'yearly' ? '' : 'border-slate-700 text-slate-400'}
                    onClick={() => updateField('billingCycle', 'yearly')}
                  >
                    Жил бүр
                  </Button>
                </div>
              </div>
            </div>
          </section>

          <Separator className="bg-slate-800" />

          {/* Limits */}
          <section className="space-y-4">
            <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider">Лимитүүд</h3>
            <div className="grid grid-cols-2 gap-4">
              {LIMIT_FIELDS.map(({ key, label, icon: LimitIcon, suffix }) => (
                <div key={key} className="space-y-2">
                  <Label className="text-slate-400 flex items-center gap-1.5">
                    <LimitIcon className="h-3.5 w-3.5" />
                    {label}
                    {suffix && <span className="text-slate-600">({suffix})</span>}
                  </Label>
                  <Input
                    type="number"
                    min={0}
                    value={draft.limits[key]}
                    onChange={(e) => updateLimit(key, Number(e.target.value))}
                    className="bg-slate-800 border-slate-700 text-white"
                  />
                </div>
              ))}
            </div>
          </section>

          <Separator className="bg-slate-800" />

          {/* Modules */}
          <section className="space-y-4">
            <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider">
              Модулиуд ({draft.modules.length}/{ALL_MODULES.length})
            </h3>
            <div className="grid grid-cols-1 gap-2">
              {ALL_MODULES.map((mod) => {
                const isBase = BASE_MODULES.includes(mod);
                const isEnabled = draft.modules.includes(mod);
                return (
                  <div
                    key={mod}
                    className={`flex items-center justify-between rounded-lg px-4 py-3 transition-colors ${
                      isEnabled
                        ? 'bg-slate-800/80 border border-slate-700/50'
                        : 'bg-slate-800/30 border border-slate-800/30'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`h-2 w-2 rounded-full ${isEnabled ? 'bg-emerald-500' : 'bg-slate-600'}`} />
                      <span className={`text-sm ${isEnabled ? 'text-white' : 'text-slate-500'}`}>
                        {MODULE_LABELS[mod]}
                      </span>
                      {isBase && (
                        <Badge variant="outline" className="text-[10px] bg-slate-700/50 text-slate-400 border-slate-600">
                          Суурь
                        </Badge>
                      )}
                    </div>
                    <Switch
                      checked={isEnabled}
                      onCheckedChange={() => toggleModule(mod)}
                      disabled={isBase}
                    />
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={onCancel}
            className="border-slate-700 text-slate-400 hover:bg-slate-800"
          >
            Болих
          </Button>
          <Button
            onClick={() => onSave(draft)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <Check className="h-4 w-4 mr-1.5" />
            Хадгалах
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
