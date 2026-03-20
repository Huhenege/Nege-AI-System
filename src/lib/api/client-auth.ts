'use client';

import { onAuthStateChanged } from 'firebase/auth';
import { initializeFirebase } from '@/firebase';

/**
 * Returns the current user's Firebase ID token, or null if not logged in.
 * Pass `forceRefresh: true` after role changes to pick up updated claims.
 */
export async function getIdToken(forceRefresh = false): Promise<string | null> {
  try {
    const { auth } = initializeFirebase();
    const existingUser = auth.currentUser;
    if (existingUser) {
      return await existingUser.getIdToken(forceRefresh);
    }

    const user = await new Promise<typeof auth.currentUser>((resolve) => {
      const timeoutId = window.setTimeout(() => {
        unsubscribe();
        resolve(null);
      }, 2000);

      const unsubscribe = onAuthStateChanged(
        auth,
        (firebaseUser) => {
          window.clearTimeout(timeoutId);
          unsubscribe();
          resolve(firebaseUser);
        },
        () => {
          window.clearTimeout(timeoutId);
          unsubscribe();
          resolve(null);
        }
      );
    });

    if (!user) return null;
    return await user.getIdToken(forceRefresh);
  } catch {
    return null;
  }
}

/**
 * Returns headers object with Authorization bearer token.
 * Merges with any existing headers you pass in.
 */
export async function getAuthHeaders(
  extra?: Record<string, string>
): Promise<Record<string, string>> {
  const token = await getIdToken();
  return {
    ...(extra || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

/**
 * Convenience: JSON + Auth headers for POST requests.
 */
export async function getJsonAuthHeaders(): Promise<Record<string, string>> {
  return getAuthHeaders({ 'Content-Type': 'application/json' });
}
