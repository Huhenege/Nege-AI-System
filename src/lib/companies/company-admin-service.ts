import { getFirebaseAdminFirestore, getFirebaseAdminAuth } from '@/firebase/admin';
import {
  Company,
  CompanyPlan,
  CompanyStatus,
  SaaSModule,
  TenantClaims,
  TenantRole,
  getPlanDefinition,
  ModuleConfig,
} from '@/types/company';

const COMPANIES = 'companies';

// ─── Read ──────────────────────────────────────────────────────────

export async function getCompanyAdmin(companyId: string): Promise<Company | null> {
  const db = getFirebaseAdminFirestore();
  const snap = await db.collection(COMPANIES).doc(companyId).get();
  if (!snap.exists) return null;
  return { id: snap.id, ...snap.data() } as Company;
}

export async function listCompaniesAdmin(filters?: {
  status?: CompanyStatus;
  plan?: CompanyPlan;
}): Promise<Company[]> {
  const db = getFirebaseAdminFirestore();
  let ref: FirebaseFirestore.Query = db.collection(COMPANIES).orderBy('createdAt', 'desc');

  if (filters?.status) {
    ref = ref.where('status', '==', filters.status);
  }
  if (filters?.plan) {
    ref = ref.where('plan', '==', filters.plan);
  }

  const snap = await ref.get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Company));
}

// ─── Update ────────────────────────────────────────────────────────

export async function updateCompanyStatusAdmin(
  companyId: string,
  status: CompanyStatus
): Promise<void> {
  const db = getFirebaseAdminFirestore();
  await db.collection(COMPANIES).doc(companyId).update({
    status,
    updatedAt: new Date(),
  });
}

export async function suspendCompany(companyId: string): Promise<void> {
  await updateCompanyStatusAdmin(companyId, 'suspended');
}

export async function activateCompany(companyId: string): Promise<void> {
  await updateCompanyStatusAdmin(companyId, 'active');
}

// ─── Auth Custom Claims ────────────────────────────────────────────

export async function setTenantClaims(
  uid: string,
  claims: TenantClaims
): Promise<void> {
  const auth = getFirebaseAdminAuth();
  await auth.setCustomUserClaims(uid, claims);
}

export async function getTenantClaims(uid: string): Promise<TenantClaims | null> {
  const auth = getFirebaseAdminAuth();
  const user = await auth.getUser(uid);
  const claims = user.customClaims as TenantClaims | undefined;
  if (!claims?.role) return null;
  return claims;
}

export async function setUserCompany(
  uid: string,
  companyId: string,
  role: TenantRole = 'employee'
): Promise<void> {
  await setTenantClaims(uid, { role, companyId });
}

export async function setSuperAdmin(uid: string): Promise<void> {
  await setTenantClaims(uid, { role: 'super_admin' });
}

// ─── Module checks (server-side) ──────────────────────────────────

export async function isModuleEnabledAdmin(
  companyId: string,
  module: SaaSModule
): Promise<boolean> {
  const company = await getCompanyAdmin(companyId);
  if (!company) return false;
  return company.modules[module]?.enabled === true;
}

export async function checkCompanyLimitAdmin(
  companyId: string,
  limitKey: keyof Company['limits'],
  currentCount: number
): Promise<{ allowed: boolean; limit: number; current: number }> {
  const company = await getCompanyAdmin(companyId);
  if (!company) return { allowed: false, limit: 0, current: currentCount };
  const limit = company.limits[limitKey];
  return { allowed: currentCount < limit, limit, current: currentCount };
}
