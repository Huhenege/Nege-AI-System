/**
 * Firebase config from env. Set NEXT_PUBLIC_FIREBASE_* in .env.local.
 * Fallbacks use nege-ai-system.
 */
const env = typeof process !== 'undefined' ? process.env : ({} as NodeJS.ProcessEnv);

export const firebaseConfig = {
  apiKey: env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "AIzaSyA5geJbyu8wMObj2SH9ab3jgCnpJHkD4AY",
  authDomain: env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "nege-ai-system.firebaseapp.com",
  projectId: env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "nege-ai-system",
  storageBucket: env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "nege-ai-system.firebasestorage.app",
  messagingSenderId: env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "793331337444",
  appId: env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "1:793331337444:web:a4759b6d6805bb302784f1",
  measurementId: env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID ?? "G-ZCR3WVZ25X",
};

