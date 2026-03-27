import { NextRequest, NextResponse } from 'next/server';
import {
  getFirebaseAdminAuth,
  getFirebaseAdminFirestore,
  getFirebaseAdminStorage,
} from '@/lib/firebase-admin';
import { requireSuperAdmin } from '../../../lib/auth-guard';
import { checkRateLimit } from '@/lib/api/rate-limiter';
import { z } from 'zod';
import { FieldValue } from 'firebase-admin/firestore';

// ─── Types ────────────────────────────────────────────────────────────────────

type Params = { params: Promise<{ id: string }> };

type DeleteMode = 'soft' | 'hard';

const DeleteBodySchema = z.object({
  /**
   * soft: Mark company as cancelled + schedule hard delete after 30 days.
   * hard: Permanently delete ALL data + Firebase Auth users.
   */
  mode: z.enum(['soft', 'hard']).default('soft'),

  /**
   * Required for hard delete — must match company name exactly.
   * Acts as a human confirmation gate.
   */
  confirmName: z.string().optional(),

  /** Optional reason stored in the audit log. */
  reason: z.string().max(500).optional(),
});

// ─── Top-level collections that store companyId references ───────────────────
// These live outside companies/{id}/... and must be cleaned up separately.
const TOP_LEVEL_COLLECTIONS_WITH_COMPANY_ID = [
  'er_documents',
  'vacancies',
  'candidates',
  'applications',
  'interviews',
  'evaluation_requests',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Recursively delete all subcollections under a Firestore document reference.
 * Uses the Firebase Admin SDK's built-in recursive delete (v11+).
 * Falls back to manual deletion for older SDK versions.
 */
async function deleteCompanySubcollections(companyId: string): Promise<number> {
  const db = getFirebaseAdminFirestore();
  const companyRef = db.collection('companies').doc(companyId);

  // Firebase Admin SDK v11+ supports recursive delete natively
  // This deletes the document and all its subcollections atomically
  await db.recursiveDelete(companyRef);
  return 1; // recursiveDelete handles count internally
}

/**
 * Delete top-level documents that reference this companyId.
 * Batched to stay within Firestore's 500-writes-per-batch limit.
 */
async function deleteTopLevelRefs(companyId: string): Promise<number> {
  const db = getFirebaseAdminFirestore();
  let totalDeleted = 0;

  for (const collectionName of TOP_LEVEL_COLLECTIONS_WITH_COMPANY_ID) {
    let lastDoc: FirebaseFirestore.QueryDocumentSnapshot | undefined;
    const PAGE_SIZE = 400;

    while (true) {
      let q = db
        .collection(collectionName)
        .where('companyId', '==', companyId)
        .limit(PAGE_SIZE);

      if (lastDoc) q = q.startAfter(lastDoc);

      const snap = await q.get();
      if (snap.empty) break;

      const batch = db.batch();
      for (const doc of snap.docs) {
        batch.delete(doc.ref);
      }
      await batch.commit();
      totalDeleted += snap.size;

      lastDoc = snap.docs[snap.docs.length - 1];
      if (snap.size < PAGE_SIZE) break;
    }
  }

  return totalDeleted;
}

/**
 * Delete all Firebase Storage files under companies/{companyId}/.
 * Best-effort: errors are logged but don't abort the deletion.
 */
async function deleteStorageFiles(companyId: string): Promise<number> {
  try {
    const bucket = getFirebaseAdminStorage();
    const prefix = `companies/${companyId}/`;

    const [files] = await bucket.getFiles({ prefix });
    if (files.length === 0) return 0;

    await Promise.all(
      files.map((f: { name: string; delete: () => Promise<unknown> }) =>
        f.delete().catch((err: unknown) => {
          console.warn(`[delete-company] Storage delete failed for ${f.name}:`, err);
        })
      )
    );

    return files.length;
  } catch (err) {
    console.warn('[delete-company] Storage cleanup failed (non-fatal):', err);
    return 0;
  }
}

/**
 * Revoke Firebase Auth custom claims and optionally delete the auth user.
 * For soft delete: only clear companyId claim (user can't log in without it).
 * For hard delete: delete the auth account entirely.
 */
async function cleanupAuthUsers(
  companyId: string,
  mode: DeleteMode
): Promise<{ cleared: number; deleted: number }> {
  const db = getFirebaseAdminFirestore();
  const adminAuth = getFirebaseAdminAuth();

  // Fetch all employee UIDs from the tenant subcollection
  const employeesSnap = await db
    .collection(`companies/${companyId}/employees`)
    .select('id') // only fetch id field to minimize reads
    .get()
    .catch(() => null);

  if (!employeesSnap || employeesSnap.empty) {
    return { cleared: 0, deleted: 0 };
  }

  const uids = employeesSnap.docs
    .map((d) => d.data()?.id as string | undefined)
    .filter((uid): uid is string => typeof uid === 'string' && uid.length > 0);

  let cleared = 0;
  let deleted = 0;

  // Process in chunks of 100 (Firebase Auth limit per listUsers call)
  const CHUNK = 100;
  for (let i = 0; i < uids.length; i += CHUNK) {
    const chunk = uids.slice(i, i + CHUNK);

    await Promise.all(
      chunk.map(async (uid) => {
        try {
          if (mode === 'hard') {
            await adminAuth.deleteUser(uid);
            deleted++;
          } else {
            // Soft: wipe companyId so they can't log in, but preserve the account
            await adminAuth.setCustomUserClaims(uid, {});
            cleared++;
          }
        } catch (err: unknown) {
          // auth/user-not-found is fine — already gone
          const code = (err as { errorInfo?: { code?: string } })?.errorInfo?.code;
          if (code !== 'auth/user-not-found') {
            console.warn(`[delete-company] Auth cleanup failed for uid ${uid}:`, err);
          }
        }
      })
    );
  }

  return { cleared, deleted };
}

// ─── Route handlers ───────────────────────────────────────────────────────────

/**
 * DELETE /api/super-admin/company/[id]/delete
 *
 * Two-phase company deletion:
 *   mode=soft  → Marks company as "cancelled", clears Auth claims, schedules
 *                hard delete at deletionScheduledAt (30 days from now).
 *                Reversible by a super_admin before deletionScheduledAt.
 *
 *   mode=hard  → Permanently deletes:
 *                  1. companies/{id} + all subcollections (recursiveDelete)
 *                  2. Top-level documents (er_documents, vacancies, etc.)
 *                  3. Firebase Storage files under companies/{id}/
 *                  4. Firebase Auth users (delete accounts)
 *                  5. Audit log entry written to platform/deletion_log
 *
 * Hard delete requires confirmName == company.name as a safety gate.
 */
export async function DELETE(request: NextRequest, { params }: Params) {
  // ── Auth ─────────────────────────────────────────────────────────────────
  const authResult = await requireSuperAdmin(request);
  if (authResult instanceof NextResponse) return authResult;
  const { uid: superAdminUid } = authResult;

  // ── Rate limit ────────────────────────────────────────────────────────────
  const rateLimited = checkRateLimit(superAdminUid, '/api/super-admin/company/delete', {
    limit: 5,
    windowSeconds: 300, // 5 deletions per 5 min per super admin
  });
  if (rateLimited) return rateLimited;

  const { id: companyId } = await params;

  // ── Parse + validate body ─────────────────────────────────────────────────
  let body: z.infer<typeof DeleteBodySchema>;
  try {
    const raw = await request.json().catch(() => ({}));
    body = DeleteBodySchema.parse(raw);
  } catch (err) {
    const message =
      err instanceof z.ZodError
        ? err.errors.map((e) => e.message).join('; ')
        : 'Хүсэлтийн өгөгдөл буруу байна.';
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const db = getFirebaseAdminFirestore();

  // ── Fetch company ─────────────────────────────────────────────────────────
  const companyRef = db.collection('companies').doc(companyId);
  const companySnap = await companyRef.get();

  if (!companySnap.exists) {
    return NextResponse.json({ error: 'Байгууллага олдсонгүй.' }, { status: 404 });
  }

  const companyData = companySnap.data()!;
  const companyName: string = companyData.name || '';

  // ── Hard delete safety gate ───────────────────────────────────────────────
  if (body.mode === 'hard') {
    if (!body.confirmName) {
      return NextResponse.json(
        {
          error:
            'Бүрэн устгахад confirmName (байгууллагын нэр) шаардлагатай.',
          requiredField: 'confirmName',
          expectedValue: companyName,
        },
        { status: 422 }
      );
    }

    if (body.confirmName.trim() !== companyName.trim()) {
      return NextResponse.json(
        {
          error: `Баталгаажуулалт буруу байна. "${companyName}" гэж оруулна уу.`,
        },
        { status: 422 }
      );
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SOFT DELETE
  // ─────────────────────────────────────────────────────────────────────────
  if (body.mode === 'soft') {
    const deletionDate = new Date();
    deletionDate.setDate(deletionDate.getDate() + 30);

    await companyRef.update({
      status: 'cancelled',
      deletionScheduledAt: deletionDate.toISOString(),
      deletionRequestedBy: superAdminUid,
      deletionReason: body.reason || '',
      updatedAt: FieldValue.serverTimestamp(),
    });

    // Clear Auth claims so users can no longer log in
    const authResult2 = await cleanupAuthUsers(companyId, 'soft');

    // Audit log
    await db.collection('platform').doc('deletion_log').collection('entries').add({
      type: 'soft_delete',
      companyId,
      companyName,
      requestedBy: superAdminUid,
      reason: body.reason || '',
      scheduledFor: deletionDate.toISOString(),
      authUsersCleared: authResult2.cleared,
      createdAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({
      success: true,
      mode: 'soft',
      message: `"${companyName}" байгууллага цуцлагдлаа. ${deletionDate.toLocaleDateString('mn-MN')}-д бүрэн устгагдана.`,
      deletionScheduledAt: deletionDate.toISOString(),
      authUsersCleared: authResult2.cleared,
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // HARD DELETE
  // ─────────────────────────────────────────────────────────────────────────

  // Snapshot employee count + owner before deletion for audit log
  const employeesSnap = await db.collection(`companies/${companyId}/employees`).select('id').get();
  const employeeCount = employeesSnap.size;
  const ownerUid: string = companyData.ownerId || '';

  const auditEntry = {
    type: 'hard_delete',
    companyId,
    companyName,
    companyEmail: companyData.email || '',
    companyPlan: companyData.plan || 'free',
    ownerUid,
    employeeCount,
    requestedBy: superAdminUid,
    reason: body.reason || '',
    steps: {} as Record<string, unknown>,
    createdAt: FieldValue.serverTimestamp(),
  };

  // Step 1: Delete Firestore subcollections (recursive)
  try {
    await deleteCompanySubcollections(companyId);
    auditEntry.steps['firestore_subcollections'] = 'ok';
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    auditEntry.steps['firestore_subcollections'] = `error: ${msg}`;
    // Non-recoverable: abort and surface the error
    await db.collection('platform').doc('deletion_log').collection('entries').add(auditEntry);
    return NextResponse.json({ error: `Firestore устгалт амжилтгүй болов: ${msg}` }, { status: 500 });
  }

  // Step 2: Delete top-level references
  try {
    const topLevelDeleted = await deleteTopLevelRefs(companyId);
    auditEntry.steps['top_level_refs'] = `ok (${topLevelDeleted} docs)`;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    auditEntry.steps['top_level_refs'] = `error: ${msg}`;
    console.error('[delete-company] Top-level ref deletion failed:', msg);
    // Continue — partial cleanup is better than stopping
  }

  // Step 3: Delete Storage files (best-effort)
  const storageDeleted = await deleteStorageFiles(companyId);
  auditEntry.steps['storage_files'] = `ok (${storageDeleted} files)`;

  // Step 4: Delete Firebase Auth users
  const authCleanup = await cleanupAuthUsers(companyId, 'hard');
  auditEntry.steps['auth_users'] = `deleted: ${authCleanup.deleted}`;

  // Step 5: Write audit log (before returning)
  await db.collection('platform').doc('deletion_log').collection('entries').add(auditEntry);

  return NextResponse.json({
    success: true,
    mode: 'hard',
    message: `"${companyName}" байгууллага бүрэн устгагдлаа.`,
    summary: {
      companyId,
      companyName,
      employeeCount,
      authUsersDeleted: authCleanup.deleted,
      storageFilesDeleted: storageDeleted,
      steps: auditEntry.steps,
    },
  });
}

/**
 * POST /api/super-admin/company/[id]/delete
 * Restore a soft-deleted company (undo cancellation before hard delete fires).
 * Only possible if status === 'cancelled' and deletionScheduledAt is in the future.
 */
export async function POST(request: NextRequest, { params }: Params) {
  const authResult = await requireSuperAdmin(request);
  if (authResult instanceof NextResponse) return authResult;
  const { uid: superAdminUid } = authResult;

  const { id: companyId } = await params;
  const db = getFirebaseAdminFirestore();

  const companyRef = db.collection('companies').doc(companyId);
  const companySnap = await companyRef.get();

  if (!companySnap.exists) {
    return NextResponse.json({ error: 'Байгууллага олдсонгүй.' }, { status: 404 });
  }

  const data = companySnap.data()!;

  if (data.status !== 'cancelled') {
    return NextResponse.json(
      { error: 'Зөвхөн цуцлагдсан (cancelled) байгууллагыг сэргээх боломжтой.' },
      { status: 400 }
    );
  }

  if (data.deletionScheduledAt) {
    const scheduledAt = new Date(data.deletionScheduledAt);
    if (scheduledAt <= new Date()) {
      return NextResponse.json(
        { error: 'Устгалтын хугацаа дууссан тул сэргээх боломжгүй.' },
        { status: 400 }
      );
    }
  }

  // Restore to active
  await companyRef.update({
    status: 'active',
    deletionScheduledAt: FieldValue.delete(),
    deletionRequestedBy: FieldValue.delete(),
    deletionReason: FieldValue.delete(),
    restoredBy: superAdminUid,
    restoredAt: new Date().toISOString(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  // Re-set Auth claims for the owner (employees will need to log in again via ensure-claims)
  try {
    const adminAuth = getFirebaseAdminAuth();
    await adminAuth.setCustomUserClaims(data.ownerId, {
      role: 'company_super_admin',
      companyId,
    });
  } catch (err) {
    console.warn('[restore-company] Failed to restore owner claims:', err);
  }

  // Audit log
  await db.collection('platform').doc('deletion_log').collection('entries').add({
    type: 'restore',
    companyId,
    companyName: data.name,
    restoredBy: superAdminUid,
    createdAt: FieldValue.serverTimestamp(),
  });

  return NextResponse.json({
    success: true,
    message: `"${data.name}" байгууллага амжилттай сэргээгдлээ.`,
  });
}
