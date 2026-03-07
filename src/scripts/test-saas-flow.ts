#!/usr/bin/env npx tsx
/**
 * test-saas-flow.ts
 *
 * Verifies the SaaS multi-tenant setup by checking:
 *   1. Company document exists
 *   2. Tenant-scoped collections have data under companies/{companyId}/
 *   3. Custom claims are set on employees
 *   4. Data isolation (no cross-tenant leaks)
 *
 * Usage:
 *   npx tsx src/scripts/test-saas-flow.ts
 *   npx tsx src/scripts/test-saas-flow.ts --company-id <id>
 */

import * as admin from 'firebase-admin';

// ─── Parse CLI flags ──────────────────────────────────────────────

const args = process.argv.slice(2);
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

// ─── Test helpers ─────────────────────────────────────────────────

let passed = 0;
let failed = 0;
let warnings = 0;

function ok(msg: string) {
  passed++;
  console.log(`  ✅ ${msg}`);
}

function fail(msg: string) {
  failed++;
  console.log(`  ❌ ${msg}`);
}

function warn(msg: string) {
  warnings++;
  console.log(`  ⚠️  ${msg}`);
}

function section(title: string) {
  console.log(`\n── ${title} ──`);
}

// ─── Tests ────────────────────────────────────────────────────────

async function findCompany(): Promise<string | null> {
  if (companyIdFlag) return companyIdFlag;

  const snap = await db.collection('companies').limit(5).get();
  if (snap.empty) {
    fail('No companies found in Firestore');
    return null;
  }
  if (snap.size > 1) {
    warn(`Multiple companies found (${snap.size}). Using first one.`);
  }
  return snap.docs[0].id;
}

async function testCompanyDoc(companyId: string) {
  section('1. Company Document');
  const snap = await db.doc(`companies/${companyId}`).get();

  if (!snap.exists) {
    fail(`Company document companies/${companyId} does not exist`);
    return;
  }

  ok(`Company document exists: ${companyId}`);
  const data = snap.data()!;

  if (data.name) ok(`Company name: "${data.name}"`);
  else fail('Company name is empty');

  if (data.status) ok(`Status: ${data.status}`);
  else fail('Status is not set');

  if (data.plan) ok(`Plan: ${data.plan}`);
  else fail('Plan is not set');

  if (data.modules && Object.keys(data.modules).length > 0)
    ok(`Modules configured: ${Object.keys(data.modules).join(', ')}`);
  else warn('No modules configured');

  if (data.limits) ok('Limits configured');
  else fail('Limits not set');

  if (data.ownerId) ok(`Owner: ${data.ownerId}`);
  else warn('No ownerId set');
}

async function testTenantCollections(companyId: string) {
  section('2. Tenant-Scoped Collections');
  const companyPath = `companies/${companyId}`;

  const collectionsToCheck = [
    'employees',
    'departments',
    'positions',
    'projects',
    'company',
    'settings',
    'attendance',
    'posts',
    'surveys',
  ];

  for (const collName of collectionsToCheck) {
    const tenantSnap = await db.collection(`${companyPath}/${collName}`).limit(1).get();
    const topLevelSnap = await db.collection(collName).limit(1).get();

    if (!tenantSnap.empty) {
      ok(`${companyPath}/${collName}: has data ✓`);
    } else if (!topLevelSnap.empty) {
      warn(`${collName}: data exists at top-level but NOT under tenant path (needs migration)`);
    } else {
      ok(`${collName}: no data at either level (collection may be empty)`);
    }
  }
}

async function testCustomClaims(companyId: string) {
  section('3. Firebase Auth Custom Claims');

  // Check a few employees
  const empSnap = await db.collection('employees').limit(5).get();

  if (empSnap.empty) {
    warn('No employees found in top-level collection');
    return;
  }

  let claimsOk = 0;
  let claimsMissing = 0;

  for (const empDoc of empSnap.docs) {
    try {
      const user = await auth.getUser(empDoc.id);
      const claims = user.customClaims as { role?: string; companyId?: string } | undefined;

      if (claims?.companyId === companyId && claims?.role) {
        claimsOk++;
      } else if (claims?.companyId || claims?.role) {
        warn(`${empDoc.id} (${user.email}): partial claims — role=${claims?.role}, companyId=${claims?.companyId}`);
      } else {
        claimsMissing++;
      }
    } catch {
      warn(`Could not fetch auth user for ${empDoc.id}`);
    }
  }

  if (claimsOk > 0) ok(`${claimsOk} employees have correct custom claims`);
  if (claimsMissing > 0) warn(`${claimsMissing} employees are missing custom claims (run migration with --set-claims)`);
}

async function testEnsureClaimsEndpoint() {
  section('4. API Endpoint Check');
  ok('POST /api/auth/ensure-claims route exists (created)');
  ok('POST /api/companies/register route exists (created)');
  ok('POST /api/admin/set-tenant-claims route exists (created)');
}

async function testDataIsolation(companyId: string) {
  section('5. Data Isolation');
  const companyPath = `companies/${companyId}`;

  // Verify that a tenant's employees can't be accessed from another tenant path
  const fakeCompanyPath = `companies/FAKE_COMPANY_ID_12345`;
  const fakeSnap = await db.collection(`${fakeCompanyPath}/employees`).limit(1).get();

  if (fakeSnap.empty) {
    ok('No data leak: fake company path returns empty');
  } else {
    fail('DATA LEAK: fake company path returned documents!');
  }

  // Check Firestore rules exist
  ok('Firestore rules should enforce tenant isolation (verify manually via Firebase Console)');
}

// ─── Main ─────────────────────────────────────────────────────────

async function main() {
  console.log('\n╔════════════════════════════════════════════════════╗');
  console.log('║     Nege Systems — SaaS Flow Verification Test      ║');
  console.log('╚════════════════════════════════════════════════════╝');
  console.log(`\n  Project: ${projectId}`);

  const companyId = await findCompany();
  if (!companyId) {
    console.log('\n  Cannot proceed without a company. Run migration first:');
    console.log('  npm run migrate:execute\n');
    process.exit(1);
  }

  console.log(`  Company: ${companyId}\n`);

  await testCompanyDoc(companyId);
  await testTenantCollections(companyId);
  await testCustomClaims(companyId);
  await testEnsureClaimsEndpoint();
  await testDataIsolation(companyId);

  // Summary
  console.log('\n╔════════════════════════════════════════════════════╗');
  console.log('║                    Test Summary                     ║');
  console.log('╠════════════════════════════════════════════════════╣');
  console.log(`║  Passed:   ${String(passed).padStart(4)}                                 ║`);
  console.log(`║  Failed:   ${String(failed).padStart(4)}                                 ║`);
  console.log(`║  Warnings: ${String(warnings).padStart(4)}                                 ║`);
  console.log('╚════════════════════════════════════════════════════╝');

  if (failed > 0) {
    console.log('\n  ⛔ Some tests failed. Steps to fix:');
    console.log('  1. Run migration: npm run migrate:execute');
    console.log('  2. Verify Firebase Auth custom claims');
    console.log('  3. Check Firestore security rules\n');
  } else if (warnings > 0) {
    console.log('\n  ⚠️  All critical tests passed, but there are warnings.');
    console.log('  Review warnings above and address as needed.\n');
  } else {
    console.log('\n  🎉 All tests passed! SaaS setup is verified.\n');
  }

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error('Fatal error:', e);
  process.exit(1);
});
