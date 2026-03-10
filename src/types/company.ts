import { Timestamp } from 'firebase/firestore';

// ─── Company (Tenant) ──────────────────────────────────────────────

export type CompanyStatus = 'trial' | 'active' | 'suspended' | 'cancelled';

export type CompanyPlan = 'free' | 'starter' | 'pro' | 'enterprise';

export type SaaSModule =
  | 'company'
  | 'organization'
  | 'employees'
  | 'projects'
  | 'attendance'
  | 'vacation'
  | 'recruitment'
  | 'onboarding'
  | 'offboarding'
  | 'training'
  | 'survey'
  | 'points'
  | 'employment_relations'
  | 'skills'
  | 'business_plan'
  | 'calendar'
  | 'meetings'
  | 'ai_assistant';

export const BASE_MODULES: SaaSModule[] = ['company', 'organization', 'employees'];

export interface ModuleConfig {
  enabled: boolean;
  enabledAt?: string;
  disabledAt?: string;
}

export interface CompanyLimits {
  maxEmployees: number;
  maxProjects: number;
  maxDepartments: number;
  maxStorageMB: number;
  aiQueriesPerMonth: number;
}

export interface CompanySubscription {
  plan: CompanyPlan;
  startDate: string;
  endDate: string;
  trialEndsAt?: string;
  billingCycle: 'monthly' | 'yearly';
  amount: number;
  currency: string;
  lastPaymentDate?: string;
  nextPaymentDate?: string;
  paymentStatus: 'paid' | 'pending' | 'overdue' | 'none';
}

/**
 * Firestore: companies/{companyId}
 * The root tenant entity for multi-tenant SaaS.
 */
export interface Company {
  id: string;
  name: string;
  legalName?: string;
  domain?: string;
  logo?: string;
  email: string;
  phone?: string;
  address?: string;
  status: CompanyStatus;
  plan: CompanyPlan;
  modules: Partial<Record<SaaSModule, ModuleConfig>>;
  limits: CompanyLimits;
  subscription: CompanySubscription;
  ownerId: string;
  employeeCount: number;
  setupComplete?: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type CreateCompanyInput = Omit<Company, 'id' | 'createdAt' | 'updatedAt' | 'employeeCount'> & {
  employeeCount?: number;
};

// ─── Plan definitions ──────────────────────────────────────────────

export interface PlanDefinition {
  id: CompanyPlan;
  name: string;
  nameMN: string;
  price: number;
  currency: string;
  billingCycle: 'monthly' | 'yearly';
  limits: CompanyLimits;
  modules: SaaSModule[];
  description: string;
}

export const PLAN_DEFINITIONS: PlanDefinition[] = [
  {
    id: 'free',
    name: 'Free',
    nameMN: 'Үнэгүй',
    price: 0,
    currency: 'MNT',
    billingCycle: 'monthly',
    limits: {
      maxEmployees: 5,
      maxProjects: 3,
      maxDepartments: 2,
      maxStorageMB: 100,
      aiQueriesPerMonth: 20,
    },
    modules: ['company', 'organization', 'employees', 'projects'],
    description: 'Жижиг багт зориулсан үнэгүй хувилбар',
  },
  {
    id: 'starter',
    name: 'Starter',
    nameMN: 'Эхлэл',
    price: 29000,
    currency: 'MNT',
    billingCycle: 'monthly',
    limits: {
      maxEmployees: 25,
      maxProjects: 20,
      maxDepartments: 10,
      maxStorageMB: 1024,
      aiQueriesPerMonth: 100,
    },
    modules: [
      'company', 'organization', 'employees', 'projects',
      'attendance', 'vacation', 'onboarding', 'offboarding',
    ],
    description: 'Жижиг дунд бизнест тохирсон',
  },
  {
    id: 'pro',
    name: 'Pro',
    nameMN: 'Мэргэжлийн',
    price: 79000,
    currency: 'MNT',
    billingCycle: 'monthly',
    limits: {
      maxEmployees: 100,
      maxProjects: 100,
      maxDepartments: 50,
      maxStorageMB: 5120,
      aiQueriesPerMonth: 500,
    },
    modules: [
      'company', 'organization', 'employees', 'projects',
      'attendance', 'vacation', 'recruitment', 'onboarding', 'offboarding',
      'training', 'survey', 'points', 'employment_relations', 'skills',
      'ai_assistant',
    ],
    description: 'Бүх модулийг агуулсан мэргэжлийн хувилбар',
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    nameMN: 'Аж ахуйн нэгж',
    price: 199000,
    currency: 'MNT',
    billingCycle: 'monthly',
    limits: {
      maxEmployees: 9999,
      maxProjects: 9999,
      maxDepartments: 999,
      maxStorageMB: 51200,
      aiQueriesPerMonth: 9999,
    },
    modules: [
      'company', 'organization', 'employees', 'projects',
      'attendance', 'vacation', 'recruitment', 'onboarding', 'offboarding',
      'training', 'survey', 'points', 'employment_relations', 'skills',
      'business_plan', 'calendar', 'meetings', 'ai_assistant',
    ],
    description: 'Хязгааргүй, бүрэн тохируулах боломжтой',
  },
];

export function getPlanDefinition(plan: CompanyPlan): PlanDefinition {
  return PLAN_DEFINITIONS.find(p => p.id === plan) ?? PLAN_DEFINITIONS[0];
}

// ─── Roles ─────────────────────────────────────────────────────────

export type TenantRole = 'super_admin' | 'admin' | 'manager' | 'employee';

export const TENANT_ROLE_LABELS: Record<TenantRole, string> = {
  super_admin: 'Системийн админ',
  admin: 'Компанийн админ',
  manager: 'Менежер',
  employee: 'Ажилтан',
};

/**
 * Firebase Auth Custom Claims structure.
 * Set via Admin SDK: auth.setCustomUserClaims(uid, claims)
 */
export interface TenantClaims {
  role: TenantRole;
  companyId?: string;
}

// ─── Status labels ─────────────────────────────────────────────────

export const COMPANY_STATUS_LABELS: Record<CompanyStatus, string> = {
  trial: 'Туршилт',
  active: 'Идэвхтэй',
  suspended: 'Түр зогсоосон',
  cancelled: 'Цуцалсан',
};

export const COMPANY_STATUS_COLORS: Record<CompanyStatus, string> = {
  trial: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  active: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  suspended: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  cancelled: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

export const COMPANY_PLAN_LABELS: Record<CompanyPlan, string> = {
  free: 'Үнэгүй',
  starter: 'Эхлэл',
  pro: 'Мэргэжлийн',
  enterprise: 'Аж ахуйн нэгж',
};

export const MODULE_LABELS: Record<SaaSModule, string> = {
  company: 'Компани',
  organization: 'Бүтэц',
  employees: 'Ажилчид',
  projects: 'Төслүүд',
  attendance: 'Ирц',
  vacation: 'Чөлөө',
  recruitment: 'Сонгон шалгаруулалт',
  onboarding: 'Онбоардинг',
  offboarding: 'Оффбоардинг',
  training: 'Сургалт',
  survey: 'Судалгаа',
  points: 'Оноо',
  employment_relations: 'Хөдөлмөрийн харилцаа',
  skills: 'Ур чадвар',
  business_plan: 'Бизнес төлөвлөгөө',
  calendar: 'Календарь',
  meetings: 'Уулзалт',
  ai_assistant: 'AI Туслах',
};
