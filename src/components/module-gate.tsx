'use client';

import { useTenant } from '@/contexts/tenant-context';
import type { SaaSModule } from '@/types/company';
import { getPlanDefinition } from '@/types/company';
import { usePricingPlans } from '@/hooks/use-pricing-plans';
import { Lock, Sparkles, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

const MODULE_DISPLAY_NAMES: Record<SaaSModule, string> = {
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
};

interface ModuleGateProps {
  module: SaaSModule;
  children: React.ReactNode;
}

export function ModuleGate({ module, children }: ModuleGateProps) {
  const { isModuleEnabled, company, isLoading } = useTenant();
  const { getPlanLabel } = usePricingPlans();

  if (isLoading) return null;

  if (isModuleEnabled(module)) {
    return <>{children}</>;
  }

  const moduleName = MODULE_DISPLAY_NAMES[module] || module;
  const currentPlan = company?.plan || 'free';

  const requiredPlan = (['starter', 'pro', 'enterprise'] as const).find((planId) => {
    const def = getPlanDefinition(planId);
    return def.modules.includes(module);
  });

  return (
    <div className="flex h-[calc(100vh-3.5rem)] items-center justify-center">
      <div className="flex flex-col items-center gap-5 max-w-md text-center px-6">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
          <Lock className="h-7 w-7 text-muted-foreground" />
        </div>

        <div className="space-y-2">
          <h2 className="text-xl font-bold tracking-tight">
            {moduleName} модуль идэвхгүй байна
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Таны одоогийн <span className="font-medium text-foreground">{getPlanLabel(currentPlan)}</span> багцад
            энэ модуль ороогүй байна.
            {requiredPlan && (
              <> <span className="font-medium text-foreground">{getPlanLabel(requiredPlan)}</span> болон дээш багцад идэвхжинэ.</>
            )}
          </p>
        </div>

        <div className="flex gap-3">
          <Button variant="outline" asChild>
            <Link href="/dashboard">
              <ArrowRight className="h-4 w-4 mr-1 rotate-180" />
              Нүүр хуудас
            </Link>
          </Button>
          <Button asChild>
            <Link href="/dashboard/billing">
              <Sparkles className="h-4 w-4 mr-1" />
              Багц сунгах
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
