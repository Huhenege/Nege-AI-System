'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

/**
 * AUTH_TRANSITION_PATHS: Pages where a temporary permission-denied error is
 * expected because Firebase Auth custom claims propagation has a short delay
 * after signup/login. We suppress the global error throw on these routes.
 */
const AUTH_TRANSITION_PATHS = ['/signup', '/login'];

/**
 * An invisible component that listens for globally emitted 'permission-error' events.
 * It throws any received error to be caught by Next.js's global-error.tsx,
 * EXCEPT on auth-transition pages where a transient permission error is expected.
 */
export function FirebaseErrorListener() {
  const pathname = usePathname();
  const [error, setError] = useState<FirestorePermissionError | null>(null);

  useEffect(() => {
    const handleError = (err: FirestorePermissionError) => {
      // Suppress transient permission errors during auth transitions
      // (signup, login) where custom claims may not yet be propagated.
      const isAuthTransition = AUTH_TRANSITION_PATHS.some(
        (p) => pathname === p || pathname?.startsWith(p + '/')
      );
      if (isAuthTransition) {
        console.warn('[FirebaseErrorListener] Suppressed permission error on auth transition page:', err.message);
        return;
      }
      setError(err);
    };

    errorEmitter.on('permission-error', handleError);
    return () => {
      errorEmitter.off('permission-error', handleError);
    };
  }, [pathname]);

  // Reset error state when navigating away from the errored page
  useEffect(() => {
    setError(null);
  }, [pathname]);

  // On re-render, if an error exists in state, throw it to the error boundary.
  if (error) {
    throw error;
  }

  return null;
}
