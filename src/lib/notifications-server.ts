import 'server-only';
import { getFirebaseAdminFirestore } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import type { CreateNotificationInput } from '@/types/notification';

/**
 * Create a notification for a specific user within a tenant.
 * Writes to: companies/{companyId}/employees/{uid}/notifications/{auto-id}
 */
export async function createNotification(
  companyId: string,
  targetUid: string,
  input: CreateNotificationInput
) {
  const db = getFirebaseAdminFirestore();
  const ref = db
    .collection(`companies/${companyId}/employees/${targetUid}/notifications`)
    .doc();

  await ref.set({
    ...input,
    read: false,
    createdAt: FieldValue.serverTimestamp(),
  });

  return ref.id;
}

/**
 * Send a notification to all users in a company who have a specific role.
 */
export async function notifyByRole(
  companyId: string,
  role: string,
  input: CreateNotificationInput
) {
  const db = getFirebaseAdminFirestore();
  const employees = await db
    .collection(`companies/${companyId}/employees`)
    .where('role', 'in', role === 'admin' ? ['company_super_admin', 'admin', 'super_admin'] : [role])
    .get();

  const promises = employees.docs.map((doc) =>
    createNotification(companyId, doc.id, input)
  );

  await Promise.all(promises);
  return promises.length;
}
