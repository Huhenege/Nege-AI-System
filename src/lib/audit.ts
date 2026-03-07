import 'server-only';
import { getFirebaseAdminFirestore } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import type { CreateAuditInput } from '@/types/audit';

/**
 * Write an audit log entry to Firestore.
 * Path: companies/{companyId}/audit_logs/{auto-id}
 *
 * Fire-and-forget: errors are logged but don't throw.
 */
export async function writeAuditLog(
  companyId: string,
  input: CreateAuditInput
): Promise<void> {
  try {
    const db = getFirebaseAdminFirestore();
    await db.collection(`companies/${companyId}/audit_logs`).add({
      ...input,
      createdAt: FieldValue.serverTimestamp(),
    });
  } catch (err) {
    console.error('[audit] Failed to write audit log:', err);
  }
}

/**
 * Convenience: create audit entry from auth context + minimal info.
 */
export function audit(
  companyId: string,
  auth: { uid: string; role?: string },
  params: {
    action: CreateAuditInput['action'];
    resource: CreateAuditInput['resource'];
    resourceId?: string;
    resourceName?: string;
    description: string;
    metadata?: Record<string, unknown>;
    ip?: string;
  }
) {
  return writeAuditLog(companyId, {
    ...params,
    actorId: auth.uid,
    actorRole: auth.role,
  });
}
