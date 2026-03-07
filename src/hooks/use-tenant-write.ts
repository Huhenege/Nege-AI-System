'use client';

import { useMemo } from 'react';
import {
  collection,
  doc,
  CollectionReference,
  DocumentReference,
  Firestore,
} from 'firebase/firestore';
import { useFirebase } from '@/firebase';
import { isTenantScoped } from '@/firebase/tenant-helpers';
import { useTenant } from '@/contexts/tenant-context';

interface TenantWriteHelpers {
  firestore: Firestore;
  companyPath: string | null;
  /**
   * Tenant-aware doc(). Automatically scopes to companies/{companyId}/
   * for tenant-scoped collections.
   *
   * Usage: tDoc('employees', uid) → doc(firestore, 'companies/abc/employees', uid)
   */
  tDoc: (collectionName: string, ...pathSegments: string[]) => DocumentReference;
  /**
   * Tenant-aware collection(). Automatically scopes to companies/{companyId}/
   * for tenant-scoped collections.
   *
   * Usage: tCollection('employees') → collection(firestore, 'companies/abc/employees')
   */
  tCollection: (collectionName: string, ...pathSegments: string[]) => CollectionReference;
}

/**
 * Hook for tenant-aware write operations in event handlers.
 *
 * Instead of:
 *   doc(firestore, 'employees', uid)
 *
 * Use:
 *   const { tDoc } = useTenantWrite();
 *   tDoc('employees', uid)
 */
export function useTenantWrite(): TenantWriteHelpers {
  const { firestore } = useFirebase();
  const { companyId } = useTenant();
  const companyPath = companyId ? `companies/${companyId}` : null;

  return useMemo(() => ({
    firestore,
    companyPath,
    tDoc(collectionName: string, ...pathSegments: string[]): DocumentReference {
      const base = companyPath && isTenantScoped(collectionName)
        ? `${companyPath}/${collectionName}`
        : collectionName;
      return pathSegments.length > 0
        ? doc(firestore, base, ...pathSegments)
        : doc(collection(firestore, base));
    },
    tCollection(collectionName: string, ...pathSegments: string[]): CollectionReference {
      const base = companyPath && isTenantScoped(collectionName)
        ? `${companyPath}/${collectionName}`
        : collectionName;
      return pathSegments.length > 0
        ? collection(firestore, base, ...pathSegments)
        : collection(firestore, base);
    },
  }), [firestore, companyPath]);
}
