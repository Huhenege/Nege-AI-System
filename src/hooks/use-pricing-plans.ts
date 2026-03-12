'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { PLAN_DEFINITIONS, COMPANY_PLAN_LABELS, type PlanDefinition, type CompanyPlan } from '@/types/company';

let globalCache: PlanDefinition[] | null = null;
let globalFetchPromise: Promise<PlanDefinition[]> | null = null;

async function fetchPlansOnce(): Promise<PlanDefinition[]> {
  if (globalCache) return globalCache;

  if (!globalFetchPromise) {
    globalFetchPromise = fetch('/api/pricing')
      .then(async (res) => {
        if (!res.ok) throw new Error('fetch failed');
        const data = await res.json();
        if (Array.isArray(data.plans) && data.plans.length > 0) {
          globalCache = data.plans as PlanDefinition[];
          return globalCache;
        }
        return PLAN_DEFINITIONS;
      })
      .catch(() => PLAN_DEFINITIONS)
      .finally(() => {
        globalFetchPromise = null;
      });
  }

  return globalFetchPromise;
}

/**
 * Hook that fetches dynamic pricing plans from the API (with global in-memory cache).
 * Falls back to hardcoded PLAN_DEFINITIONS if API is unavailable.
 *
 * Returns:
 * - plans: PlanDefinition[]
 * - planLabels: Record<CompanyPlan, string>  (dynamic nameMN map)
 * - getPlanLabel(plan): string
 * - isLoading: boolean
 */
export function usePricingPlans() {
  const [plans, setPlans] = useState<PlanDefinition[]>(globalCache ?? PLAN_DEFINITIONS);
  const [isLoading, setIsLoading] = useState(!globalCache);

  useEffect(() => {
    let cancelled = false;
    fetchPlansOnce().then((fetched) => {
      if (!cancelled) {
        setPlans(fetched);
        setIsLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, []);

  const planLabels = useMemo(() => {
    const labels = { ...COMPANY_PLAN_LABELS } as Record<CompanyPlan, string>;
    for (const p of plans) {
      if (p.nameMN) labels[p.id] = p.nameMN;
    }
    return labels;
  }, [plans]);

  const getPlanLabel = useCallback(
    (plan: CompanyPlan): string => planLabels[plan] ?? COMPANY_PLAN_LABELS[plan] ?? plan,
    [planLabels]
  );

  return { plans, planLabels, getPlanLabel, isLoading };
}
