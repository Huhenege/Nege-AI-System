/**
 * Client-side session cookie helpers.
 * The `__session` cookie mirrors the Firebase ID token so that
 * Next.js middleware (Edge Runtime) can gate routes without
 * calling Firebase Admin SDK.
 *
 * Real auth enforcement still happens at the API-route level via
 * requireAuth / requireTenantAuth.
 */

const COOKIE_NAME = '__session';

export function setSessionCookie(idToken: string) {
  document.cookie = `${COOKIE_NAME}=${idToken}; path=/; max-age=3600; SameSite=Lax; Secure`;
}

export function clearSessionCookie() {
  document.cookie = `${COOKIE_NAME}=; path=/; max-age=0; SameSite=Lax; Secure`;
}

/**
 * Decode a Firebase JWT payload without verifying the signature.
 * Safe for client-side / edge routing decisions only.
 */
export function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(payload));
  } catch {
    return null;
  }
}
