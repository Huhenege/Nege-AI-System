import {
  collection,
  doc,
  query,
  CollectionReference,
  DocumentReference,
  Firestore,
  QueryConstraint,
} from 'firebase/firestore';

/**
 * Collections that should be scoped under companies/{companyId}/.
 * Everything else stays at the top level.
 */
const TENANT_SCOPED = new Set([
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
  'meetings',
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
  'workCalendars',
  'verification_codes',
]);

/**
 * Returns a tenant-scoped collection reference.
 * If companyPath is set and the collection is tenant-scoped,
 * returns companies/{companyId}/{name}. Otherwise returns top-level {name}.
 */
export function tenantCollection(
  firestore: Firestore,
  companyPath: string | null,
  name: string
): CollectionReference {
  if (companyPath && TENANT_SCOPED.has(name)) {
    return collection(firestore, `${companyPath}/${name}`);
  }
  return collection(firestore, name);
}

/**
 * Returns a tenant-scoped document reference.
 */
export function tenantDoc(
  firestore: Firestore,
  companyPath: string | null,
  collectionName: string,
  docId: string
): DocumentReference {
  if (companyPath && TENANT_SCOPED.has(collectionName)) {
    return doc(firestore, `${companyPath}/${collectionName}`, docId);
  }
  return doc(firestore, collectionName, docId);
}

/**
 * Returns a tenant-scoped query.
 */
export function tenantQuery(
  firestore: Firestore,
  companyPath: string | null,
  name: string,
  ...constraints: QueryConstraint[]
) {
  const colRef = tenantCollection(firestore, companyPath, name);
  return constraints.length > 0 ? query(colRef, ...constraints) : colRef;
}

export function isTenantScoped(collectionName: string): boolean {
  return TENANT_SCOPED.has(collectionName);
}
