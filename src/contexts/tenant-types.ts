import { createContext } from 'react';
import type { Company, TenantRole, SaaSModule } from '@/types/company';

/**
 * Core tenant state — shared between TenantProvider and consumers.
 * Extracted to a separate file to avoid circular imports between
 * @/firebase (provider.tsx) and @/contexts/tenant-context.
 */
export interface TenantState {
  companyId: string | null;
  company: Company | null;
  role: TenantRole | null;
  isLoading: boolean;
  error: string | null;
}

export interface TenantContextValue extends TenantState {
  isModuleEnabled: (module: SaaSModule) => boolean;
  isWithinLimit: (limitKey: keyof Company['limits'], currentCount: number) => boolean;
  isCompanyActive: boolean;
  isSuperAdmin: boolean;
  isAdmin: boolean;
  isManager: boolean;
  refreshClaims: () => Promise<void>;
}

export const TenantContext = createContext<TenantContextValue | undefined>(undefined);
