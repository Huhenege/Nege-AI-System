import * as admin from 'firebase-admin';

let initialized = false;

function initializeFirebaseAdmin() {
  if (initialized && admin.apps.length > 0) {
    return admin.apps[0]!;
  }

  const projectId = process.env.FIREBASE_PROJECT_ID || 'nege-ai-system';

  try {
    if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
      const app = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId,
      });
      initialized = true;
      return app;
    }

    const app = admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      projectId,
    });
    initialized = true;
    return app;
  } catch (error) {
    console.error('[Firebase Admin] Initialization failed:', error);
    throw error;
  }
}

export function getFirestore() {
  const app = initializeFirebaseAdmin();
  return admin.firestore(app);
}

export default admin;
