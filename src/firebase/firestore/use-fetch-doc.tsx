import { useEffect, useState, useCallback, useRef } from "react";
import {
  getDoc,
  DocumentReference,
  DocumentData,
  FirestoreError,
} from "firebase/firestore";

export interface UseFetchDocResult<T = DocumentData> {
  data: (T & { id: string }) | null;
  isLoading: boolean;
  error: FirestoreError | null;
  exists: boolean | null;
  refetch: () => void;
}

/**
 * Нэг удаагийн fetch хийх document hook (onSnapshot биш).
 * Config/profile шиг бараг өөрчлөгддөггүй дата-д зориулсан.
 * - docRef байхгүй үед fetch хийхгүй.
 * - refetch() дуудаж дахин татах боломжтой.
 */
export function useFetchDoc<T = DocumentData>(
  docRef: DocumentReference<T> | DocumentReference<DocumentData> | null | undefined
): UseFetchDocResult<T> {
  const [data, setData] = useState<(T & { id: string }) | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<FirestoreError | null>(null);
  const [exists, setExists] = useState<boolean | null>(null);
  const [fetchKey, setFetchKey] = useState(0);
  const docRefRef = useRef(docRef);
  docRefRef.current = docRef;

  const refetch = useCallback(() => setFetchKey((k) => k + 1), []);

  useEffect(() => {
    const ref = docRefRef.current;
    if (!ref) {
      setData(null);
      setExists(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    getDoc(ref as any)
      .then((snapshot) => {
        if (cancelled) return;
        if (!snapshot.exists()) {
          setData(null);
          setExists(false);
        } else {
          setData({
            id: snapshot.id,
            ...(snapshot.data() as T),
          });
          setExists(true);
        }
        setError(null);
        setIsLoading(false);
      })
      .catch((err: FirestoreError) => {
        if (cancelled) return;
        setError(err);
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [docRef, fetchKey]);

  return { data, isLoading, error, exists, refetch };
}
