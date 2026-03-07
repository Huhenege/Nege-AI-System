'use client';

import { DependencyList, useMemo } from 'react';
import { Firestore, collection, doc, query, CollectionReference, DocumentReference, Query, QueryConstraint } from 'firebase/firestore';
import { Auth, User } from 'firebase/auth';
import { useFirebase } from '@/firebase';
import { useTenant } from '@/contexts/tenant-context';

interface TenantFirebaseServices {
  firestore: Firestore;
  auth: Auth;
  user: User | null;
  companyId: string | null;
  companyPath: string | null;
}

/**
 * Drop-in replacement for useMemoFirebase that is tenant-aware.
 * The factory function receives { firestore, auth, user, companyId, companyPath }.
 *
 * companyPath is "companies/{companyId}" when a tenant is loaded, otherwise null.
 */
export function useTenantMemo<T>(
  factory: (services: TenantFirebaseServices) => T,
  deps: DependencyList
): T | null {
  const { firestore, auth, user } = useFirebase();
  const { companyId } = useTenant();

  const companyPath = companyId ? `companies/${companyId}` : null;

  return useMemo(() => {
    if (!firestore || !auth) return null;
    return factory({ firestore, auth, user, companyId, companyPath });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firestore, auth, user, companyId, ...deps]);
}

/**
 * Shortcut: get a tenant-scoped collection reference.
 * If companyId exists: companies/{companyId}/{collectionName}
 * Otherwise: {collectionName} (backward compat)
 */
export function useTenantCollectionRef(
  collectionName: string,
  ...constraints: QueryConstraint[]
): Query | CollectionReference | null {
  const { firestore } = useFirebase();
  const { companyId } = useTenant();

  return useMemo(() => {
    if (!firestore) return null;

    const path = companyId
      ? `companies/${companyId}/${collectionName}`
      : collectionName;

    const colRef = collection(firestore, path);
    return constraints.length > 0 ? query(colRef, ...constraints) : colRef;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firestore, companyId, collectionName, constraints.length]);
}

/**
 * Shortcut: get a tenant-scoped document reference.
 * If companyId exists: companies/{companyId}/{collectionName}/{docId}
 * Otherwise: {collectionName}/{docId} (backward compat)
 */
export function useTenantDocRef(
  collectionName: string,
  docId: string | null | undefined
): DocumentReference | null {
  const { firestore } = useFirebase();
  const { companyId } = useTenant();

  return useMemo(() => {
    if (!firestore || !docId) return null;

    const path = companyId
      ? `companies/${companyId}/${collectionName}`
      : collectionName;

    return doc(firestore, path, docId);
  }, [firestore, companyId, collectionName, docId]);
}
