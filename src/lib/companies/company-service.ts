import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  Timestamp,
  Firestore,
  serverTimestamp,
} from 'firebase/firestore';
import {
  Company,
  CompanyPlan,
  CompanyStatus,
  CreateCompanyInput,
  ModuleConfig,
  SaaSModule,
  getPlanDefinition,
} from '@/types/company';

const COMPANIES_COLLECTION = 'companies';

function companiesRef(firestore: Firestore) {
  return collection(firestore, COMPANIES_COLLECTION);
}

function companyDocRef(firestore: Firestore, companyId: string) {
  return doc(firestore, COMPANIES_COLLECTION, companyId);
}

// ─── Read ──────────────────────────────────────────────────────────

export async function getCompany(
  firestore: Firestore,
  companyId: string
): Promise<Company | null> {
  const snap = await getDoc(companyDocRef(firestore, companyId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Company;
}

export async function getCompanyByDomain(
  firestore: Firestore,
  domain: string
): Promise<Company | null> {
  const q = query(
    companiesRef(firestore),
    where('domain', '==', domain),
    orderBy('createdAt', 'desc')
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() } as Company;
}

export async function listCompanies(
  firestore: Firestore,
  filters?: { status?: CompanyStatus; plan?: CompanyPlan }
): Promise<Company[]> {
  let q = query(companiesRef(firestore), orderBy('createdAt', 'desc'));

  if (filters?.status) {
    q = query(companiesRef(firestore), where('status', '==', filters.status), orderBy('createdAt', 'desc'));
  }

  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Company));
}

// ─── Create ────────────────────────────────────────────────────────

export async function createCompany(
  firestore: Firestore,
  companyId: string,
  input: CreateCompanyInput
): Promise<Company> {
  const now = Timestamp.now();
  const data: Omit<Company, 'id'> = {
    ...input,
    employeeCount: input.employeeCount ?? 0,
    createdAt: now,
    updatedAt: now,
  };

  await setDoc(companyDocRef(firestore, companyId), data);

  return { id: companyId, ...data };
}

/**
 * Shortcut: create a company with plan defaults pre-filled.
 * Used during signup flow.
 */
export async function createCompanyFromPlan(
  firestore: Firestore,
  companyId: string,
  opts: {
    name: string;
    email: string;
    ownerId: string;
    plan?: CompanyPlan;
    domain?: string;
  }
): Promise<Company> {
  const plan = opts.plan ?? 'free';
  const def = getPlanDefinition(plan);

  const modules: Partial<Record<SaaSModule, ModuleConfig>> = {};
  for (const m of def.modules) {
    modules[m] = { enabled: true, enabledAt: new Date().toISOString() };
  }

  const trialEnd = new Date();
  trialEnd.setDate(trialEnd.getDate() + 14);

  const input: CreateCompanyInput = {
    name: opts.name,
    email: opts.email,
    domain: opts.domain,
    status: plan === 'free' ? 'active' : 'trial',
    plan,
    modules,
    limits: { ...def.limits },
    subscription: {
      plan,
      startDate: new Date().toISOString(),
      endDate: trialEnd.toISOString(),
      trialEndsAt: plan !== 'free' ? trialEnd.toISOString() : undefined,
      billingCycle: 'monthly',
      amount: def.price,
      currency: def.currency,
      paymentStatus: plan === 'free' ? 'none' : 'pending',
    },
    ownerId: opts.ownerId,
  };

  return createCompany(firestore, companyId, input);
}

// ─── Update ────────────────────────────────────────────────────────

export async function updateCompany(
  firestore: Firestore,
  companyId: string,
  data: Partial<Omit<Company, 'id' | 'createdAt'>>
): Promise<void> {
  await updateDoc(companyDocRef(firestore, companyId), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

export async function updateCompanyStatus(
  firestore: Firestore,
  companyId: string,
  status: CompanyStatus
): Promise<void> {
  await updateCompany(firestore, companyId, { status });
}

export async function updateCompanyPlan(
  firestore: Firestore,
  companyId: string,
  plan: CompanyPlan
): Promise<void> {
  const def = getPlanDefinition(plan);

  const modules: Partial<Record<SaaSModule, ModuleConfig>> = {};
  for (const m of def.modules) {
    modules[m] = { enabled: true, enabledAt: new Date().toISOString() };
  }

  await updateCompany(firestore, companyId, {
    plan,
    modules,
    limits: { ...def.limits },
  });
}

export async function toggleModule(
  firestore: Firestore,
  companyId: string,
  module: SaaSModule,
  enabled: boolean
): Promise<void> {
  const key = `modules.${module}`;
  const config: ModuleConfig = {
    enabled,
    ...(enabled
      ? { enabledAt: new Date().toISOString() }
      : { disabledAt: new Date().toISOString() }),
  };

  await updateDoc(companyDocRef(firestore, companyId), {
    [key]: config,
    updatedAt: serverTimestamp(),
  });
}

export async function incrementEmployeeCount(
  firestore: Firestore,
  companyId: string,
  delta: number
): Promise<void> {
  const company = await getCompany(firestore, companyId);
  if (!company) throw new Error(`Company ${companyId} not found`);

  const newCount = Math.max(0, company.employeeCount + delta);
  await updateCompany(firestore, companyId, { employeeCount: newCount });
}

// ─── Helpers ───────────────────────────────────────────────────────

export function isModuleEnabled(
  company: Company | null,
  module: SaaSModule
): boolean {
  if (!company) return false;
  if (company.modules?.[module]?.enabled === true) return true;
  const def = getPlanDefinition(company.plan);
  return def.modules.includes(module);
}

export function isWithinLimit(
  company: Company | null,
  limitKey: keyof Company['limits'],
  currentCount: number
): boolean {
  if (!company) return false;
  return currentCount < company.limits[limitKey];
}

export function isCompanyActive(company: Company | null): boolean {
  if (!company) return false;
  return company.status === 'active' || company.status === 'trial';
}
