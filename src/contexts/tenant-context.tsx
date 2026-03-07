'use client';

import React, { useContext, useState, useEffect, useMemo, ReactNode } from 'react';
import { useUser, useFirebase } from '@/firebase';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import type { Company, TenantClaims, TenantRole, SaaSModule } from '@/types/company';
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
        const tokenResult = await user!.getIdTokenResult();
        const claims = tokenResult.claims as unknown as TenantClaims;

        if (cancelled) return;

        // Backward compatibility: if no custom claims yet, check employees doc
        if (!claims.role) {
          const empDoc = await getDoc(doc(firestore, 'employees', user!.uid));
          if (empDoc.exists()) {
            const empData = empDoc.data() as { role?: string; companyId?: string };
            setState({
              companyId: empData.companyId || null,
              company: null,
              role: (empData.role as TenantRole) || 'employee',
              isLoading: false,
              error: null,
            });
            return;
          }
        }

        setState(prev => ({
          ...prev,
          companyId: claims.companyId || null,
          role: claims.role || null,
          // Keep loading only if companyId exists (need to fetch company doc next)
          // If no companyId, stop loading — login page will handle ensure-claims
          isLoading: !!claims.companyId,
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
    if (!state.companyId || !firestore) {
      if (!state.isLoading && state.companyId === null && state.role) {
        setState(prev => ({ ...prev, isLoading: false }));
      }
      return;
    }

    const companyDocRef = doc(firestore, 'companies', state.companyId);

    const unsubscribe = onSnapshot(
      companyDocRef,
      (snap) => {
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
      (err) => {
        console.error('[TenantContext] Company snapshot error:', err);
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: err.message,
        }));
      }
    );

    return () => unsubscribe();
  }, [state.companyId, firestore]);

  const contextValue = useMemo((): TenantContextValue => {
    return {
      ...state,

      isModuleEnabled(module: SaaSModule): boolean {
        if (state.role === 'super_admin') return true;
        if (!state.company) return false;
        return state.company.modules[module]?.enabled === true;
      },

      isWithinLimit(limitKey: keyof Company['limits'], currentCount: number): boolean {
        if (state.role === 'super_admin') return true;
        if (!state.company) return false;
        return currentCount < state.company.limits[limitKey];
      },

      get isCompanyActive(): boolean {
        if (state.role === 'super_admin') return true;
        if (!state.company) return false;
        return state.company.status === 'active' || state.company.status === 'trial';
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
