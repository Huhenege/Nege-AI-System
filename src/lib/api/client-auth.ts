'use client';

import { getAuth } from 'firebase/auth';

/**
 * Returns the current user's Firebase ID token, or null if not logged in.
 */
export async function getIdToken(): Promise<string | null> {
  try {
    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) return null;
    return await user.getIdToken();
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
