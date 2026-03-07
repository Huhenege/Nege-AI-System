#!/usr/bin/env npx tsx
/**
 * migrate-to-tenant.ts
 *
 * Migrates top-level Firestore collections into companies/{companyId}/...
 * Also sets Firebase Auth custom claims for all employees.
 *
 * Usage:
 *   npx tsx src/scripts/migrate-to-tenant.ts                  # dry-run
 *   npx tsx src/scripts/migrate-to-tenant.ts --execute         # real run
 *   npx tsx src/scripts/migrate-to-tenant.ts --execute --set-claims
 *
 * Flags:
 *   --execute       Actually write data (without this, only prints what would happen)
 *   --set-claims    Also set Firebase Auth custom claims on each employee
 *   --company-id X  Use a specific company ID (otherwise auto-detects or creates one)
 *
 * Requirements:
 *   - GOOGLE_APPLICATION_CREDENTIALS or gcloud ADC configured
 *   - FIREBASE_PROJECT_ID or NEXT_PUBLIC_FIREBASE_PROJECT_ID env var
 */

import * as admin from 'firebase-admin';

// ─── Configuration ────────────────────────────────────────────────

const TENANT_SCOPED_COLLECTIONS = [
  'employees',
  'departments',
  'positions',
  'projects',
  'project_groups',
  'attendance',
  'attendanceLocations',
  'documents',
  'company',
  'company_profile',
  'companyHistory',
  'companyPolicies',
  'vacancies',
  'candidates',
  'applications',
  'application_events',
  'application_notes',
  'interviews',
  'scorecards',
  'evaluation_requests',
  'surveys',
  'survey_templates',
  'onboarding_processes',
  'onboardingPrograms',
  'offboarding_processes',
  'training_courses',
  'training_plans',
  'training_categories',
  'skill_assessments',
  'skills_inventory',
  'meeting_rooms',
  'room_bookings',
  'recognition_posts',
  'point_transactions',
  'points_config',
  'rewards',
  'redemption_requests',
  'budget_point_requests',
  'posts',
  'er_documents',
  'er_document_types',
  'er_templates',
  'er_workflows',
  'er_process_document_types',
  'newHires',
  'organization_actions',
  'settings',
  'positionLevels',
  'employmentTypes',
  'jobCategories',
  'workSchedules',
  'salaryRangeVersions',
  'benefitReferences',
  'departmentTypes',
  'timeOffRequests',
  'departmentHistory',
  'organization_settings',
];

/**
 * Known subcollections under specific documents.
 * key = "parentCollection" → list of subcollection names to also migrate.
 */
const KNOWN_SUBCOLLECTIONS: Record<string, string[]> = {
  projects: ['tasks', 'messages'],
  surveys: ['questions', 'responses'],
  training_plans: ['modules', 'assignments'],
};

/**
 * Known doc-level subcollections (documents that have nested subcollections).
 * key = "collection/docId" → list of subcollection names.
 */
const KNOWN_DOC_SUBCOLLECTIONS: Record<string, string[]> = {
  'company/branding': ['values'],
};

// ─── Parse CLI flags ──────────────────────────────────────────────

const args = process.argv.slice(2);
const DRY_RUN = !args.includes('--execute');
const SET_CLAIMS = args.includes('--set-claims');
const companyIdFlag = args.includes('--company-id')
  ? args[args.indexOf('--company-id') + 1]
  : null;

// ─── Init Admin SDK ───────────────────────────────────────────────

const projectId =
  process.env.FIREBASE_PROJECT_ID ||
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
  'nege-ai-system';

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId,
  });
}

const db = admin.firestore();
const auth = admin.auth();

// ─── Stats ────────────────────────────────────────────────────────

let totalDocsRead = 0;
let totalDocsCopied = 0;
let totalSubDocsCopied = 0;
let totalClaimsSet = 0;
let errors: string[] = [];

function log(msg: string) {
  const prefix = DRY_RUN ? '[DRY-RUN]' : '[EXECUTE]';
  console.log(`${prefix} ${msg}`);
}

function logError(msg: string) {
  errors.push(msg);
  console.error(`[ERROR] ${msg}`);
}

// ─── Migration helpers ────────────────────────────────────────────

async function getOrCreateCompanyId(): Promise<string> {
  if (companyIdFlag) {
    const snap = await db.doc(`companies/${companyIdFlag}`).get();
    if (snap.exists) {
      log(`Using existing company: ${companyIdFlag} ("${snap.data()?.name}")`);
      return companyIdFlag;
    }
    logError(`Company ${companyIdFlag} does not exist!`);
    process.exit(1);
  }

  // Check if any company already exists
  const existing = await db.collection('companies').limit(5).get();
  if (!existing.empty) {
    if (existing.size === 1) {
      const c = existing.docs[0];
      log(`Found existing company: ${c.id} ("${c.data().name}")`);
      return c.id;
    }
    console.log('\nMultiple companies found:');
    existing.docs.forEach((d) => console.log(`  ${d.id} — ${d.data().name}`));
    logError('Multiple companies exist. Use --company-id to specify which one.');
    process.exit(1);
  }

  // Create from legacy company/profile
  const profileSnap = await db.doc('company/profile').get();
  const profileData = profileSnap.exists ? profileSnap.data() : null;

  const ref = db.collection('companies').doc();
  const companyData = {
    name: profileData?.name || 'My Company',
    email: profileData?.email || '',
    domain: profileData?.domain || '',
    status: 'active',
    plan: 'free',
    modules: {
      company: { enabled: true },
      organization: { enabled: true },
      employees: { enabled: true },
      projects: { enabled: true },
    },
    limits: {
      maxEmployees: 9999,
      maxProjects: 9999,
      maxDepartments: 999,
      maxStorageMB: 51200,
      aiQueriesPerMonth: 9999,
    },
    subscription: {
      plan: 'free',
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      billingCycle: 'monthly',
      amount: 0,
      currency: 'MNT',
      paymentStatus: 'none',
    },
    ownerId: '',
    employeeCount: 0,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  if (!DRY_RUN) {
    await ref.set(companyData);
  }
  log(`Created company: ${ref.id} ("${companyData.name}")`);
  return ref.id;
}

/**
 * Copy all docs from a source collection to a destination path.
 * Uses batched writes (max 500 per batch).
 */
async function copyCollection(
  sourcePath: string,
  destPath: string,
  subcollections?: string[]
): Promise<number> {
  const sourceRef = db.collection(sourcePath);
  const snapshot = await sourceRef.get();

  if (snapshot.empty) {
    return 0;
  }

  totalDocsRead += snapshot.size;
  let copied = 0;

  // Process in chunks of 400 (leaving room for subcollection ops)
  const docs = snapshot.docs;
  for (let i = 0; i < docs.length; i += 400) {
    const chunk = docs.slice(i, i + 400);
    const batch = db.batch();

    for (const docSnap of chunk) {
      const destRef = db.doc(`${destPath}/${docSnap.id}`);
      if (!DRY_RUN) {
        batch.set(destRef, docSnap.data());
      }
      copied++;
    }

    if (!DRY_RUN) {
      await batch.commit();
    }
  }

  log(`  ${sourcePath} → ${destPath}: ${copied} docs`);

  // Copy known subcollections for each doc
  if (subcollections && subcollections.length > 0) {
    for (const docSnap of docs) {
      for (const subCol of subcollections) {
        const subSource = `${sourcePath}/${docSnap.id}/${subCol}`;
        const subDest = `${destPath}/${docSnap.id}/${subCol}`;
        const subCopied = await copyCollection(subSource, subDest);
        totalSubDocsCopied += subCopied;
      }
    }
  }

  // Copy known doc-level subcollections
  for (const docSnap of docs) {
    const docKey = `${sourcePath.split('/').pop()}/${docSnap.id}`;
    const docSubcols = KNOWN_DOC_SUBCOLLECTIONS[docKey];
    if (docSubcols) {
      for (const subCol of docSubcols) {
        const subSource = `${sourcePath}/${docSnap.id}/${subCol}`;
        const subDest = `${destPath}/${docSnap.id}/${subCol}`;
        const subCopied = await copyCollection(subSource, subDest);
        totalSubDocsCopied += subCopied;
      }
    }
  }

  return copied;
}

async function setClaimsForEmployees(companyId: string) {
  if (!SET_CLAIMS) {
    log('Skipping claims (use --set-claims to enable)');
    return;
  }

  const empSnap = await db.collection('employees').get();
  log(`Setting claims for ${empSnap.size} employees...`);

  for (const empDoc of empSnap.docs) {
    const uid = empDoc.id;
    const data = empDoc.data() as { role?: string; email?: string };
    const role = data.role === 'admin' ? 'admin' : 'employee';

    try {
      if (!DRY_RUN) {
        await auth.setCustomUserClaims(uid, { role, companyId });
      }
      totalClaimsSet++;
      log(`  Claims set: ${uid} (${data.email || 'no email'}) → role=${role}`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      logError(`  Failed to set claims for ${uid}: ${msg}`);
    }
  }
}

// ─── Main ─────────────────────────────────────────────────────────

async function main() {
  console.log('\n╔════════════════════════════════════════════════════╗');
  console.log('║       Nege Systems — Tenant Migration Script       ║');
  console.log('╚════════════════════════════════════════════════════╝');
  console.log(`\n  Project:     ${projectId}`);
  console.log(`  Mode:        ${DRY_RUN ? '🔍 DRY RUN (no writes)' : '⚡ EXECUTE (writing data!)'}`);
  console.log(`  Set Claims:  ${SET_CLAIMS ? 'Yes' : 'No'}`);
  console.log('');

  // Step 1: Get or create company
  const companyId = await getOrCreateCompanyId();
  const companyPath = `companies/${companyId}`;
  console.log(`\n  Company ID:  ${companyId}`);
  console.log(`  Tenant Path: ${companyPath}/\n`);

  // Step 2: Copy each tenant-scoped collection
  log('─── Copying collections ───');
  for (const collName of TENANT_SCOPED_COLLECTIONS) {
    try {
      const subcols = KNOWN_SUBCOLLECTIONS[collName] || undefined;
      const copied = await copyCollection(collName, `${companyPath}/${collName}`, subcols);
      totalDocsCopied += copied;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      logError(`Failed to copy collection ${collName}: ${msg}`);
    }
  }

  // Step 3: Update company employeeCount
  if (!DRY_RUN) {
    const empCount = await db.collection(`${companyPath}/employees`).count().get();
    await db.doc(companyPath).update({
      employeeCount: empCount.data().count,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }

  // Step 4: Set claims
  log('\n─── Setting custom claims ───');
  await setClaimsForEmployees(companyId);

  // Summary
  console.log('\n╔════════════════════════════════════════════════════╗');
  console.log('║                  Migration Summary                  ║');
  console.log('╠════════════════════════════════════════════════════╣');
  console.log(`║  Docs read:           ${String(totalDocsRead).padStart(8)} ║`);
  console.log(`║  Docs copied:         ${String(totalDocsCopied).padStart(8)} ║`);
  console.log(`║  Subdocs copied:      ${String(totalSubDocsCopied).padStart(8)} ║`);
  console.log(`║  Claims set:          ${String(totalClaimsSet).padStart(8)} ║`);
  console.log(`║  Errors:              ${String(errors.length).padStart(8)} ║`);
  console.log('╚════════════════════════════════════════════════════╝');

  if (DRY_RUN) {
    console.log('\n  This was a dry run. To execute, run with --execute');
    console.log('  npx tsx src/scripts/migrate-to-tenant.ts --execute --set-claims\n');
  } else {
    console.log('\n  Migration complete! Original top-level data was NOT deleted.');
    console.log('  Verify the data, then you can clean up top-level collections manually.\n');
  }

  if (errors.length > 0) {
    console.log('  Errors encountered:');
    errors.forEach((e) => console.log(`    - ${e}`));
  }

  process.exit(errors.length > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error('Fatal error:', e);
  process.exit(1);
});
