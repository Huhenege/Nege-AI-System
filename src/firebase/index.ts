'use client';

import { firebaseConfig } from '@/firebase/config';
import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, initializeFirestore, memoryLocalCache } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// Persistent singleton to prevent re-initialization during HMR
let cachedSdks: ReturnType<typeof getSdks> | null = null;

export function initializeFirebase() {
  if (cachedSdks) return cachedSdks;

  const isDev = process.env.NODE_ENV !== 'production';

  // Use a customized app name in development to ensure we get a fresh Firestore instance
  // with the correct cache settings, bypassing any corrupted IndexedDB state on the default app.
  // This essentially "sandboxes" the dev session's Firestore connection.
  const appName = isDev ? 'HR_DEV_CLIENT' : undefined;

  // Search for existing app with strict name matching
  const targetAppName = appName || '[DEFAULT]';
  const existingApp = getApps().find(app => app.name === targetAppName);

  let firebaseApp: FirebaseApp;

  if (!existingApp) {
    // If no existing app found, initialize a new one
    if (appName) {
      // Development: Explicitly named app
      firebaseApp = initializeApp(firebaseConfig, appName);
    } else {
      // Production: Default app
      // Try auto-init first (for hosting environments), then fall back to config
      try {
        firebaseApp = initializeApp();
      } catch (e) {
        firebaseApp = initializeApp(firebaseConfig);
      }
    }
  } else {
    firebaseApp = existingApp;
  }

  // Initialize SDKs using the determined app instance
  cachedSdks = getSdks(firebaseApp);
  return cachedSdks;
}

export function getSdks(firebaseApp: FirebaseApp) {
  // Always try to initialize Firestore with MEMORY cache first.
  // This is the most stable configuration for solving "Unexpected state" errors.
  let firestore;
  try {
    firestore = initializeFirestore(firebaseApp, {
      localCache: memoryLocalCache()
    });
  } catch (e: any) {
    // If initialization fails (e.g. app already has Firestore attached from before),
    // we fall back to retrieving the existing instance.
    // In our Dev setup ('HR_DEV_CLIENT'), this existing instance would have been
    // created by us with memoryLocalCache properly, so it's safe.
    firestore = getFirestore(firebaseApp);
  }

  return {
    firebaseApp,
    auth: getAuth(firebaseApp),
    firestore,
    storage: getStorage(firebaseApp),
  };
}

export * from './provider';
export * from './client-provider';
export * from './firestore/use-collection';
export * from './firestore/use-doc';
export * from './non-blocking-updates';
export * from './non-blocking-login';
export * from './errors';
export * from './error-emitter';
export * from './secondary-auth';
export { tenantCollection, tenantDoc, tenantQuery, isTenantScoped } from './tenant-helpers';
export { useTenantWrite } from '@/hooks/use-tenant-write';
