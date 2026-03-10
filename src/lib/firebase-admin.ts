import 'server-only';

import * as admin from 'firebase-admin';
import { cert, getApp, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { writeFileSync, existsSync } from 'fs';

const ADC_TMP_PATH = '/tmp/gcloud-adc.json';

export function getFirebaseAdminApp() {
  if (getApps().length > 0) return getApp();

  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'nege-ai-system';
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');
  const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

  if (clientEmail && privateKey) {
    return initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
  }

  if (serviceAccountKey) {
    try {
      const sa = JSON.parse(serviceAccountKey);
      return initializeApp({ credential: cert(sa), projectId });
    } catch {
      console.warn('[firebase-admin] Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY');
    }
  }

  // Support ADC JSON via env var (for Vercel/serverless where gcloud CLI is unavailable)
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON && !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    try {
      writeFileSync(ADC_TMP_PATH, process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
      process.env.GOOGLE_APPLICATION_CREDENTIALS = ADC_TMP_PATH;
    } catch (e) {
      console.warn('[firebase-admin] Failed to write ADC temp file:', e);
    }
  }

  // Fallback: ADC (works locally with gcloud CLI, on Google Cloud, or via temp file above)
  return initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId,
  });
}

export function getFirebaseAdminAuth() {
  return getAuth(getFirebaseAdminApp());
}

export function getFirebaseAdminFirestore() {
  return getFirestore(getFirebaseAdminApp());
}

