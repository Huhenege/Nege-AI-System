'use client';

import { useCallback } from 'react';
import { useFirebase } from '@/firebase';

export function useSuperAdminApi() {
  const { user } = useFirebase();

  const fetchApi = useCallback(
    async <T = unknown>(path: string, options?: RequestInit): Promise<T> => {
      if (!user) throw new Error('Not authenticated');

      const token = await user.getIdToken();
      const res = await fetch(`/api/super-admin${path}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          ...options?.headers,
        },
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(errBody.error || `API error ${res.status}`);
      }

      return res.json();
    },
    [user]
  );

  return { fetchApi };
}
