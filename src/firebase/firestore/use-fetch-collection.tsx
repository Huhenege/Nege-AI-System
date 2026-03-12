import { useEffect, useState, useCallback, useRef } from "react";
import {
  getDocs,
  Query,
  CollectionReference,
  DocumentData,
  FirestoreError,
} from "firebase/firestore";

type TargetRef<T = DocumentData> =
  | Query<T>
  | CollectionReference<T>
  | Query<DocumentData>
  | CollectionReference<DocumentData>
  | null
  | undefined;

export interface UseFetchCollectionResult<T = DocumentData> {
  data: (T & { id: string })[];
  isLoading: boolean;
  error: FirestoreError | null;
  refetch: () => void;
}

/**
 * Нэг удаагийн fetch хийх collection hook (onSnapshot биш).
 * Reference/config/list шиг бараг өөрчлөгддөггүй дата-д зориулсан.
 * - target байхгүй үед fetch хийхгүй.
 * - refetch() дуудаж дахин татах боломжтой.
 */
export function useFetchCollection<T = DocumentData>(
  target: TargetRef<T>
): UseFetchCollectionResult<T> {
  const [data, setData] = useState<(T & { id: string })[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<FirestoreError | null>(null);
  const [fetchKey, setFetchKey] = useState(0);
  const targetRef = useRef(target);
  targetRef.current = target;

  const refetch = useCallback(() => setFetchKey((k) => k + 1), []);

  useEffect(() => {
    const ref = targetRef.current;
    if (!ref) {
      setData([]);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    getDocs(ref as Query<DocumentData>)
      .then((snapshot) => {
        if (cancelled) return;
        const docs = snapshot.docs.map(
          (doc) =>
            ({
              id: doc.id,
              ref: doc.ref,
              ...(doc.data() as Record<string, unknown>),
            } as T & { id: string; ref: any })
        );
        setData(docs);
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
  }, [target, fetchKey]);

  return { data, isLoading, error, refetch };
}
