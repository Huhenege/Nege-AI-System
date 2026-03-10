'use client';

import React, { DependencyList, createContext, useContext, ReactNode, useMemo, useState, useEffect } from 'react';
import { FirebaseApp } from 'firebase/app';
import { Firestore } from 'firebase/firestore';
import { Auth, User, onAuthStateChanged, onIdTokenChanged } from 'firebase/auth';
import { FirebaseStorage } from 'firebase/storage';
import { FirebaseErrorListener } from '@/components/FirebaseErrorListener';
import { TenantContext } from '@/contexts/tenant-types';
import { setSessionCookie, clearSessionCookie } from '@/lib/session';

interface FirebaseProviderProps {
  children: ReactNode;
  firebaseApp: FirebaseApp;
  firestore: Firestore;
  auth: Auth;
  storage: FirebaseStorage;
}

// Internal state for user authentication
interface UserAuthState {
  user: User | null;
  isUserLoading: boolean;
  userError: Error | null;
}

// Combined state for the Firebase context
export interface FirebaseContextState {
  areServicesAvailable: boolean; // True if core services (app, firestore, auth instance) are provided
  firebaseApp: FirebaseApp | null;
  firestore: Firestore | null;
  auth: Auth | null; // The Auth service instance
  storage: FirebaseStorage | null;
  // User authentication state
  user: User | null;
  isUserLoading: boolean; // True during initial auth check
  userError: Error | null; // Error from auth listener
}

// Return type for useFirebase()
export interface FirebaseServicesAndUser {
  firebaseApp: FirebaseApp;
  firestore: Firestore;
  auth: Auth;
  storage: FirebaseStorage;
  user: User | null;
  isUserLoading: boolean;
  userError: Error | null;
}

// Return type for useUser() - specific to user auth state
export interface UserHookResult { // Renamed from UserAuthHookResult for consistency if desired, or keep as UserAuthHookResult
  user: User | null;
  isUserLoading: boolean;
  userError: Error | null;
}

// React Context
export const FirebaseContext = createContext<FirebaseContextState | undefined>(undefined);

/**
 * FirebaseProvider manages and provides Firebase services and user authentication state.
 */
export const FirebaseProvider: React.FC<FirebaseProviderProps> = ({
  children,
  firebaseApp,
  firestore,
  auth,
  storage,
}) => {
  const [userAuthState, setUserAuthState] = useState<UserAuthState>({
    user: null,
    isUserLoading: true, // Start loading until first auth event
    userError: null,
  });

  const servicesAvailable = !!(firebaseApp && firestore && auth && storage);

  // Effect to subscribe to Firebase auth state changes
  useEffect(() => {
    if (!auth) { // If no Auth service instance, cannot determine user state
      setUserAuthState({ user: null, isUserLoading: false, userError: new Error("Auth service not provided.") });
      return;
    }

    // Safety timeout to prevent infinite loading if Firebase Auth hangs
    const timeoutId = setTimeout(() => {
      if (userAuthState.isUserLoading) {
        console.warn("FirebaseProvider: Auth state check timed out after 5s. Setting loading to false.");
        setUserAuthState(prev => ({ ...prev, isUserLoading: false }));
      }
    }, 5000);

    const unsubscribe = onAuthStateChanged(
      auth,
      (firebaseUser) => { // Auth state determined
        clearTimeout(timeoutId);
        setUserAuthState({ user: firebaseUser, isUserLoading: false, userError: null });
      },
      (error) => { // Auth listener error
        clearTimeout(timeoutId);
        console.error("FirebaseProvider: onAuthStateChanged error:", error);
        setUserAuthState({ user: null, isUserLoading: false, userError: error });
      }
    );
    return () => {
      clearTimeout(timeoutId);
      unsubscribe();
    };
  }, [auth]); // Depends on the auth instance

  // Keep __session cookie in sync with Firebase ID token
  useEffect(() => {
    if (!auth) return;
    const unsubToken = onIdTokenChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const token = await firebaseUser.getIdToken();
        setSessionCookie(token);
      } else {
        clearSessionCookie();
      }
    });
    return () => unsubToken();
  }, [auth]);

  // Memoize the context value
  const contextValue = useMemo((): FirebaseContextState => {
    return {
      areServicesAvailable: servicesAvailable,
      firebaseApp: servicesAvailable ? firebaseApp : null,
      firestore: servicesAvailable ? firestore : null,
      auth: servicesAvailable ? auth : null,
      storage: servicesAvailable ? storage : null,
      user: userAuthState.user,
      isUserLoading: userAuthState.isUserLoading,
      userError: userAuthState.userError,
    };
  }, [servicesAvailable, firebaseApp, firestore, auth, storage, userAuthState.user, userAuthState.isUserLoading, userAuthState.userError]);

  if (!servicesAvailable) {
    return null;
  }

  return (
    <FirebaseContext.Provider value={contextValue}>
      <FirebaseErrorListener />
      {children}
    </FirebaseContext.Provider>
  );
};

/**
 * Hook to access core Firebase services and user authentication state.
 * Throws error if core services are not available or used outside provider.
 */
export const useFirebase = (): FirebaseServicesAndUser => {
  const context = useContext(FirebaseContext);

  if (context === undefined) {
    throw new Error('useFirebase must be used within a FirebaseProvider.');
  }

  if (!context.areServicesAvailable || !context.firebaseApp || !context.firestore || !context.auth || !context.storage) {
    throw new Error('Firebase core services not available. Check FirebaseProvider props.');
  }

  return {
    firebaseApp: context.firebaseApp,
    firestore: context.firestore,
    auth: context.auth,
    storage: context.storage,
    user: context.user,
    isUserLoading: context.isUserLoading,
    userError: context.userError,
  };
};

/** Hook to access Firebase Auth instance. */
export const useAuth = (): Auth => {
  const { auth } = useFirebase();
  return auth;
};

/** Hook to access Firestore instance. */
export const useFirestore = (): Firestore => {
  const { firestore } = useFirebase();
  return firestore;
};

/** Hook to access Firebase App instance. */
export const useFirebaseApp = (): FirebaseApp => {
  const { firebaseApp } = useFirebase();
  return firebaseApp;
};

/** Hook to access Firebase Storage instance. */
export const useStorage = (): FirebaseStorage => {
  const { storage } = useFirebase();
  return storage;
};

export interface MemoFirebaseServices {
  firestore: Firestore;
  auth: Auth;
  user: User | null;
  /** Current tenant company ID (null if not yet loaded or no tenant) */
  companyId: string | null;
  /** "companies/{companyId}" when tenant is available, otherwise null */
  companyPath: string | null;
}

/**
 * A wrapper for React.useMemo that is aware of Firebase + tenant context.
 * The factory receives { firestore, auth, user, companyId, companyPath }.
 * companyPath is automatically set from TenantContext when available.
 */
export const useMemoFirebase = <T,>(
  factory: (services: MemoFirebaseServices) => T,
  deps: DependencyList
): T | null => {
  const { firestore, auth, user } = useFirebase();
  const tenantCtx = useContext(TenantContext);
  const companyId = tenantCtx?.companyId ?? null;
  const companyPath = companyId ? `companies/${companyId}` : null;

  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => {
    if (!firestore || !auth) {
      return null;
    }
    // Block all queries until tenant context is resolved to prevent
    // cross-tenant data leaks through top-level collection fallback
    if (user && !companyPath) {
      return null;
    }
    return factory({ firestore, auth, user, companyId, companyPath });
  }, [firestore, auth, user, companyId, ...deps]);
};

/**
 * Hook specifically for accessing the authenticated user's state.
 * This provides the User object, loading status, and any auth errors.
 * @returns {UserHookResult} Object with user, isUserLoading, userError.
 */
export const useUser = (): UserHookResult => { // Renamed from useAuthUser
  const context = useContext(FirebaseContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a FirebaseProvider.');
  }
  const { user, isUserLoading, userError } = context;
  return { user, isUserLoading, userError };
};
