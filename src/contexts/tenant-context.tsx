'use client';

import React, { useContext, useState, useEffect, useMemo, ReactNode } from 'react';
import { useUser, useFirebase } from '@/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import type { Company, TenantClaims, TenantRole, SaaSModule } from '@/types/company';
import { getPlanDefinition, BASE_MODULES } from '@/types/company';
import { TenantContext } from './tenant-types';
import type { TenantState, TenantContextValue } from './tenant-types';

interface TenantProviderProps {
  children: ReactNode;
}

export const TenantProvider: React.FC<TenantProviderProps> = ({ children }) => {
  const { user, isUserLoading } = useUser();
  const { firestore } = useFirebase();

  const [state, setState] = useState<TenantState>({
    companyId: null,
    company: null,
    role: null,
    isLoading: true,
    error: null,
  });

  const refreshClaims = async () => {
    if (!user) return;
    const tokenResult = await user.getIdTokenResult(true);
    const claims = tokenResult.claims as unknown as TenantClaims;

    setState(prev => ({
      ...prev,
      companyId: claims.companyId || null,
      role: claims.role || null,
    }));
  };

  // Extract companyId and role from Firebase Auth custom claims
  useEffect(() => {
    if (isUserLoading) return;

    if (!user) {
      setState({ companyId: null, company: null, role: null, isLoading: false, error: null });
      return;
    }

    let cancelled = false;

    async function loadClaims() {
      try {
        // Force-refresh to always get latest server-side claims
        let tokenResult = await user!.getIdTokenResult(true);
        let claims = tokenResult.claims as unknown as TenantClaims;

        if (cancelled) return;

        if (claims.companyId && claims.role) {
          setState(prev => ({
            ...prev,
            companyId: claims.companyId!,
            role: claims.role!,
            isLoading: true,
            error: null,
          }));
          return;
        }

        // Token doesn't have claims — call ensure-claims API to set them
        // This is critical: Firestore rules check TOKEN claims, not employee docs
        const idToken = await user!.getIdToken();
        const res = await fetch('/api/auth/ensure-claims', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${idToken}` },
        });

        if (cancelled) return;

        if (res.ok) {
          // Refresh token to pick up newly set claims
          tokenResult = await user!.getIdTokenResult(true);
          claims = tokenResult.claims as unknown as TenantClaims;

          if (claims.companyId && claims.role) {
            setState(prev => ({
              ...prev,
              companyId: claims.companyId!,
              role: claims.role!,
              isLoading: true,
              error: null,
            }));
            return;
          }
        }

        // No company found — user needs to register
        setState(prev => ({
          ...prev,
          companyId: null,
          role: claims.role || null,
          isLoading: false,
          error: null,
        }));
      } catch (e) {
        if (cancelled) return;
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: e instanceof Error ? e.message : 'Failed to load claims',
        }));
      }
    }

    loadClaims();
    return () => { cancelled = true; };
  }, [user, isUserLoading, firestore]);

  // Subscribe to company document once companyId is known
  useEffect(() => {
    if (!state.companyId || !firestore || !user) {
      if (!state.isLoading && state.companyId === null && state.role) {
        setState(prev => ({ ...prev, isLoading: false }));
      }
      return;
    }

    let cancelled = false;
    let unsubscribe: (() => void) | null = null;
    let retryTimeout: ReturnType<typeof setTimeout> | null = null;
    let retries = 0;

    function subscribe() {
      const companyDocRef = doc(firestore, 'companies', state.companyId!);

      unsubscribe = onSnapshot(
        companyDocRef,
        (snap) => {
          retries = 0;
          if (snap.exists()) {
            setState(prev => ({
              ...prev,
              company: { id: snap.id, ...snap.data() } as Company,
              isLoading: false,
              error: null,
            }));
          } else {
            setState(prev => ({
              ...prev,
              company: null,
              isLoading: false,
              error: null,
            }));
          }
        },
        async (err) => {
          console.error('[TenantContext] Company snapshot error:', err.message);

          // Retry with a fresh token — the listener may have started
          // before the Firestore SDK picked up the refreshed auth token
          if (retries < 3 && !cancelled) {
            retries++;
            try {
              await user!.getIdToken(true);
            } catch { /* ignore */ }
            retryTimeout = setTimeout(() => {
              if (!cancelled) subscribe();
            }, 500 * retries);
          } else {
            setState(prev => ({
              ...prev,
              isLoading: false,
              error: err.message,
            }));
          }
        }
      );
    }

    subscribe();

    return () => {
      cancelled = true;
      if (unsubscribe) unsubscribe();
      if (retryTimeout) clearTimeout(retryTimeout);
    };
  }, [state.companyId, firestore, user]);

  const contextValue = useMemo((): TenantContextValue => {
    const checkSubscriptionActive = (): boolean => {
      if (state.role === 'super_admin') return true;
      if (!state.company) return false;

      const { status, plan, subscription } = state.company;

      if (status === 'suspended' || status === 'cancelled') return false;
      if (plan === 'free') return true;

      if (subscription?.endDate) {
        const endDate = new Date(subscription.endDate);
        if (endDate < new Date()) return false;
      }

      if (status === 'trial' && subscription?.trialEndsAt) {
        const trialEnd = new Date(subscription.trialEndsAt);
        if (trialEnd < new Date()) return false;
      }

      return status === 'active' || status === 'trial';
    };

    const companyActive = checkSubscriptionActive();

    return {
      ...state,

      isModuleEnabled(module: SaaSModule): boolean {
        if (state.role === 'super_admin') return true;
        if (!state.company) return false;
        if (!companyActive) return BASE_MODULES.includes(module);
        if (state.company.modules?.[module]?.enabled === true) return true;
        const def = getPlanDefinition(state.company.plan);
        return def.modules.includes(module);
      },

      isWithinLimit(limitKey: keyof Company['limits'], currentCount: number): boolean {
        if (state.role === 'super_admin') return true;
        if (!state.company) return false;
        return currentCount < state.company.limits[limitKey];
      },

      get isCompanyActive(): boolean {
        return companyActive;
      },

      get isSuperAdmin(): boolean {
        return state.role === 'super_admin';
      },

      get isAdmin(): boolean {
        return state.role === 'admin' || state.role === 'super_admin';
      },

      get isManager(): boolean {
        return state.role === 'manager' || state.role === 'admin' || state.role === 'super_admin';
      },

      refreshClaims,
    };
  }, [state]);

  return (
    <TenantContext.Provider value={contextValue}>
      {children}
    </TenantContext.Provider>
  );
};

// ─── Hooks ─────────────────────────────────────────────────────────

export function useTenant(): TenantContextValue {
  const ctx = useContext(TenantContext);
  if (ctx === undefined) {
    throw new Error('useTenant must be used within a TenantProvider');
  }
  return ctx;
}

export function useCompanyId(): string | null {
  return useTenant().companyId;
}

export function useCompany(): Company | null {
  return useTenant().company;
}

export function useTenantRole(): TenantRole | null {
  return useTenant().role;
}

/**
 * Returns the Firestore collection path prefix for the current tenant.
 * e.g. "companies/{companyId}" — append subcollection name to build full path.
 */
export function useCompanyPath(): string | null {
  const { companyId } = useTenant();
  if (!companyId) return null;
  return `companies/${companyId}`;
}
