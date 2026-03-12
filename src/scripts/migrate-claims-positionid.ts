#!/usr/bin/env npx tsx
/**
 * migrate-claims-positionid.ts
 *
 * Ensures all users have positionId in their Firebase Auth custom claims.
 * Reads positionId from the tenant-scoped employee doc and updates claims.
 *
 * Usage:
 *   npx tsx src/scripts/migrate-claims-positionid.ts              # dry-run
 *   npx tsx src/scripts/migrate-claims-positionid.ts --execute     # real run
 */

import * as admin from 'firebase-admin';

const DRY_RUN = !process.argv.includes('--execute');

async function main() {
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      projectId: process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    });
  }

  const auth = admin.auth();
  const db = admin.firestore();

  console.log(`\n=== Migrate claims: add positionId ===`);
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'EXECUTE'}\n`);

  const companiesSnap = await db.collection('companies').get();
  console.log(`Found ${companiesSnap.size} companies\n`);

  let total = 0;
  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (const companyDoc of companiesSnap.docs) {
    const companyId = companyDoc.id;
    const companyName = companyDoc.data().name || companyId;
    console.log(`--- Company: ${companyName} (${companyId}) ---`);

    const employeesSnap = await db.collection(`companies/${companyId}/employees`).get();

    for (const empDoc of employeesSnap.docs) {
      total++;
      const uid = empDoc.id;
      const empData = empDoc.data();
      const positionId = empData.positionId as string | undefined;

      if (!positionId) {
        skipped++;
        continue;
      }

      try {
        const user = await auth.getUser(uid);
        const existingClaims = (user.customClaims || {}) as Record<string, unknown>;

        if (existingClaims.positionId === positionId) {
          skipped++;
          continue;
        }

        const newClaims = { ...existingClaims, positionId };

        if (DRY_RUN) {
          console.log(`  [DRY] Would update ${uid} (${empData.name || 'unknown'}): positionId=${positionId}`);
        } else {
          await auth.setCustomUserClaims(uid, newClaims);
          console.log(`  Updated ${uid} (${empData.name || 'unknown'}): positionId=${positionId}`);
        }
        updated++;
      } catch (err: any) {
        if (err.code === 'auth/user-not-found') {
          skipped++;
        } else {
          errors++;
          console.error(`  Error for ${uid}: ${err.message}`);
        }
      }
    }
  }

  console.log(`\n=== Summary ===`);
  console.log(`Total employees: ${total}`);
  console.log(`Updated: ${updated}`);
  console.log(`Skipped: ${skipped}`);
  console.log(`Errors: ${errors}`);
  if (DRY_RUN) {
    console.log(`\nThis was a DRY RUN. Run with --execute to apply changes.`);
  }
}

main().catch(console.error);
