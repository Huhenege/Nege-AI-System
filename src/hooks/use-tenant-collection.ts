'use client';

import { useMemo } from 'react';
import { collection, query, Query, QueryConstraint, DocumentData } from 'firebase/firestore';
import { useFirebase, useCollection } from '@/firebase';
import { useTenant } from '@/contexts/tenant-context';

/**
 * Tenant-aware collection hook.
 *
 * If a companyId is available it reads from:
 *   companies/{companyId}/{collectionName}
 *
 * Otherwise falls back to the top-level collection (backward compat).
 *
 * Returns the same shape as useCollection.
 */
export function useTenantCollection<T = DocumentData>(
  collectionName: string,
  constraints: QueryConstraint[] = []
) {
  const { firestore } = useFirebase();
  const { companyId } = useTenant();

  const ref = useMemo(() => {
    if (!firestore) return null;

    const basePath = companyId
      ? `companies/${companyId}/${collectionName}`
      : collectionName;

    const colRef = collection(firestore, basePath);
    return constraints.length > 0
      ? query(colRef, ...constraints)
      : colRef;
  }, [firestore, companyId, collectionName, constraints.length]);

  return useCollection<T>(ref as Query<T> | null);
}

/**
 * Returns the Firestore path for the current tenant.
 * Use this when you need to build custom queries.
 */
export function useTenantPath(collectionName: string): string {
  const { companyId } = useTenant();
  return companyId
    ? `companies/${companyId}/${collectionName}`
    : collectionName;
}
