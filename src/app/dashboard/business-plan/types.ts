// src/app/dashboard/business-plan/types.ts
// Business Plan Module — Types, Zod Schemas & Utility Functions

import { z } from 'zod';

// ============================================
// STRATEGY FRAMEWORKS
// ============================================

export const FRAMEWORKS = ['okr', 'ogsm', 'bsc'] as const;
export type StrategyFramework = (typeof FRAMEWORKS)[number];

export const FRAMEWORK_LABELS: Record<StrategyFramework, string> = {
    okr: 'OKR (Objectives & Key Results)',
    ogsm: 'OGSM (Objectives, Goals, Strategies, Measures)',
    bsc: 'Balanced Scorecard',
};

export const FRAMEWORK_SHORT_LABELS: Record<StrategyFramework, string> = {
    okr: 'OKR',
    ogsm: 'OGSM',
    bsc: 'BSC',
};

export const FRAMEWORK_DESCRIPTIONS: Record<StrategyFramework, string> = {
    okr: 'Улирлын зорилго тус бүрт хэмжигдэхүйц гол үр дүнгүүд тодорхойлж, явцыг доороос дээш тооцоолно.',
    ogsm: 'Жилийн зорилго → Зорилт → Стратеги → Хэмжүүр гэсэн 4 түвшинт каскадаар стратеги хэрэгжүүлнэ.',
    bsc: 'Санхүүгийн, Хэрэглэгчийн, Дотоод процесс, Суралцахуй гэсэн 4 хэмжигдэхүүнээр стратегийг тэнцвэржүүлнэ.',
};

/** Framework-specific label mappings for shared entities */
export const THEME_LABEL: Record<StrategyFramework, string> = {
    okr: 'Стратегийн чиглэл',
    ogsm: 'Зорилго (Objective)',
    bsc: 'Хэмжигдэхүүн (Perspective)',
};

export const OBJECTIVE_LABEL: Record<StrategyFramework, string> = {
    okr: 'Зорилго (Objective)',
    ogsm: 'Зорилт (Goal)',
    bsc: 'Стратегийн зорилго',
};

export const KEY_RESULT_LABEL: Record<StrategyFramework, string> = {
    okr: 'Гол үр дүн (Key Result)',
    ogsm: 'Хэмжүүр (Measure)',
    bsc: 'Хэмжүүр (Measure)',
};

// ============================================
// BSC PERSPECTIVES
// ============================================

export const BSC_PERSPECTIVE_TYPES = ['financial', 'customer', 'internal_process', 'learning_growth'] as const;
export type BscPerspectiveType = (typeof BSC_PERSPECTIVE_TYPES)[number];

export const BSC_PERSPECTIVE_LABELS: Record<BscPerspectiveType, string> = {
    financial: 'Санхүүгийн',
    customer: 'Хэрэглэгчийн',
    internal_process: 'Дотоод процесс',
    learning_growth: 'Суралцахуй & Өсөлт',
};

export const BSC_PERSPECTIVE_COLORS: Record<BscPerspectiveType, string> = {
    financial: '#3B82F6',
    customer: '#10B981',
    internal_process: '#F59E0B',
    learning_growth: '#8B5CF6',
};

export const BSC_DEFAULT_PERSPECTIVES: {
    type: BscPerspectiveType;
    title: string;
    description: string;
    color: string;
    weight: number;
}[] = [
    { type: 'financial', title: 'Санхүүгийн хэмжигдэхүүн', description: 'Орлого, ашиг, өгөөж, зардлын бүтэц', color: '#3B82F6', weight: 25 },
    { type: 'customer', title: 'Хэрэглэгчийн хэмжигдэхүүн', description: 'Хэрэглэгчийн сэтгэл ханамж, хадгалалт, шинэ хэрэглэгч', color: '#10B981', weight: 25 },
    { type: 'internal_process', title: 'Дотоод процессийн хэмжигдэхүүн', description: 'Үйл ажиллагааны үр ашиг, чанар, инноваци', color: '#F59E0B', weight: 25 },
    { type: 'learning_growth', title: 'Суралцахуй & Өсөлтийн хэмжигдэхүүн', description: 'Ажилтны ур чадвар, технологи, соёл', color: '#8B5CF6', weight: 25 },
];

// ============================================
// PLAN STATUS
// ============================================

export const PLAN_STATUSES = ['draft', 'active', 'completed', 'archived'] as const;
export type PlanStatus = (typeof PLAN_STATUSES)[number];

export const PLAN_STATUS_LABELS: Record<PlanStatus, string> = {
    draft: 'Ноорог',
    active: 'Идэвхтэй',
    completed: 'Дууссан',
    archived: 'Архивласан',
};

export const PLAN_STATUS_COLORS: Record<PlanStatus, string> = {
    draft: 'bg-slate-100 text-slate-700',
    active: 'bg-emerald-100 text-emerald-700',
    completed: 'bg-blue-100 text-blue-700',
    archived: 'bg-gray-100 text-gray-500',
};

// ============================================
// QUARTERS
// ============================================

export const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4'] as const;
export type Quarter = (typeof QUARTERS)[number];

export const QUARTER_LABELS: Record<Quarter, string> = {
    Q1: '1-р улирал (1-3 сар)',
    Q2: '2-р улирал (4-6 сар)',
    Q3: '3-р улирал (7-9 сар)',
    Q4: '4-р улирал (10-12 сар)',
};

export function getCurrentQuarter(): Quarter {
    const month = new Date().getMonth();
    if (month < 3) return 'Q1';
    if (month < 6) return 'Q2';
    if (month < 9) return 'Q3';
    return 'Q4';
}

// ============================================
// COMPANY PROFILE (read-only, from company/profile)
// ============================================

export interface CompanyProfile {
    name?: string;
    logoUrl?: string;
    mission?: string;
    vision?: string;
}

export interface CoreValue {
    id: string;
    title: string;
    description: string;
    emoji?: string;
    color?: string;
    isActive: boolean;
}

// ============================================
// BUSINESS PLAN (Annual — one per fiscal year)
// ============================================

export interface BusinessPlan {
    id: string;
    title: string;
    fiscalYear: number;
    framework: StrategyFramework;
    status: PlanStatus;
    startDate: string;
    endDate: string;
    createdAt: string;
    createdBy: string;
}

export const businessPlanSchema = z.object({
    title: z.string().min(1, 'Төлөвлөгөөний нэр оруулна уу'),
    fiscalYear: z.coerce.number().min(2020).max(2100),
    framework: z.enum(FRAMEWORKS).default('okr'),
    status: z.enum(PLAN_STATUSES).default('draft'),
    startDate: z.string().min(1, 'Эхлэх огноо оруулна уу'),
    endDate: z.string().min(1, 'Дуусах огноо оруулна уу'),
});

export type BusinessPlanFormValues = z.infer<typeof businessPlanSchema>;

// ============================================
// STRATEGIC THEMES
// ============================================

export const THEME_COLORS = [
    '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
    '#EC4899', '#06B6D4', '#F97316',
] as const;

export interface StrategicTheme {
    id: string;
    planId: string;
    title: string;
    description: string;
    color: string;
    weight: number; // 0-100, all themes must sum to 100
    ownerId: string;
    ownerName: string;
    order: number;
    status: PlanStatus;
    perspectiveType?: BscPerspectiveType; // BSC only
    createdAt: string;
}

export const strategicThemeSchema = z.object({
    title: z.string().min(1, 'Нэр оруулна уу'),
    description: z.string().optional().default(''),
    color: z.string().default(THEME_COLORS[0]),
    weight: z.coerce.number().min(0).max(100),
    ownerId: z.string().optional().default(''),
    ownerName: z.string().optional().default(''),
    status: z.enum(PLAN_STATUSES).default('active'),
});

export type StrategicThemeFormValues = z.infer<typeof strategicThemeSchema>;

// ============================================
// OKR — OBJECTIVES
// ============================================

export const OKR_STATUSES = ['not_started', 'on_track', 'at_risk', 'behind', 'completed'] as const;
export type OkrStatus = (typeof OKR_STATUSES)[number];

export const OKR_STATUS_LABELS: Record<OkrStatus, string> = {
    not_started: 'Эхлээгүй',
    on_track: 'Хэвийн',
    at_risk: 'Эрсдэлтэй',
    behind: 'Хоцорч буй',
    completed: 'Биелсэн',
};

export const OKR_STATUS_COLORS: Record<OkrStatus, string> = {
    not_started: 'bg-slate-100 text-slate-600',
    on_track: 'bg-emerald-100 text-emerald-700',
    at_risk: 'bg-amber-100 text-amber-700',
    behind: 'bg-red-100 text-red-700',
    completed: 'bg-blue-100 text-blue-700',
};

export interface Objective {
    id: string;
    planId: string;
    themeId: string;
    title: string;
    description: string;
    quarter?: Quarter; // optional for OGSM/BSC (annual)
    year: number;
    ownerId: string;
    ownerName: string;
    status: OkrStatus;
    progress: number; // 0-100, computed from key results
    createdAt: string;
}

export const objectiveSchema = z.object({
    themeId: z.string().min(1, 'Стратегийн чиглэл сонгоно уу'),
    title: z.string().min(1, 'Зорилгын нэр оруулна уу'),
    description: z.string().optional().default(''),
    quarter: z.enum(QUARTERS).optional(),
    year: z.coerce.number().min(2020).max(2100),
    ownerId: z.string().optional().default(''),
    ownerName: z.string().optional().default(''),
    status: z.enum(OKR_STATUSES).default('not_started'),
});

/** OKR-specific schema requiring quarter */
export const okrObjectiveSchema = objectiveSchema.extend({
    quarter: z.enum(QUARTERS, { required_error: 'Улирал сонгоно уу' }),
});

export type ObjectiveFormValues = z.infer<typeof objectiveSchema>;

// ============================================
// OKR — KEY RESULTS
// ============================================

export const METRIC_TYPES = ['number', 'percentage', 'currency', 'boolean'] as const;
export type MetricType = (typeof METRIC_TYPES)[number];

export const METRIC_TYPE_LABELS: Record<MetricType, string> = {
    number: 'Тоо',
    percentage: 'Хувь',
    currency: 'Мөнгөн дүн',
    boolean: 'Тийм/Үгүй',
};

export interface KeyResult {
    id: string;
    objectiveId: string;
    themeId: string;
    planId: string;
    strategyId?: string; // OGSM: links measure to strategy
    title: string;
    metricType: MetricType;
    startValue: number;
    currentValue: number;
    targetValue: number;
    unit: string;
    ownerId: string;
    ownerName: string;
    status: OkrStatus;
    dueDate: string;
    createdAt: string;
}

export const keyResultSchema = z.object({
    objectiveId: z.string().min(1, 'Зорилго сонгоно уу'),
    title: z.string().min(1, 'Гол үр дүнгийн нэр оруулна уу'),
    metricType: z.enum(METRIC_TYPES, { required_error: 'Хэмжүүрийн төрөл сонгоно уу' }),
    startValue: z.coerce.number().default(0),
    currentValue: z.coerce.number().default(0),
    targetValue: z.coerce.number().min(0, 'Зорилтот утга оруулна уу'),
    unit: z.string().optional().default(''),
    ownerId: z.string().optional().default(''),
    ownerName: z.string().optional().default(''),
    status: z.enum(OKR_STATUSES).default('not_started'),
    dueDate: z.string().optional().default(''),
});

export type KeyResultFormValues = z.infer<typeof keyResultSchema>;

// ============================================
// STRATEGY / INITIATIVE (OGSM Strategy & BSC Initiative)
// ============================================

export const STRATEGY_TYPES = ['ogsm_strategy', 'bsc_initiative'] as const;
export type StrategyType = (typeof STRATEGY_TYPES)[number];

export interface Strategy {
    id: string;
    planId: string;
    parentId: string; // OGSM: objectiveId (goal), BSC: objectiveId
    themeId: string;
    type: StrategyType;
    title: string;
    description: string;
    ownerId: string;
    ownerName: string;
    status: OkrStatus;
    progress: number; // 0-100
    startDate: string;
    endDate: string;
    budget?: number;
    createdAt: string;
}

export const strategySchema = z.object({
    parentId: z.string().min(1, 'Зорилт/зорилго сонгоно уу'),
    type: z.enum(STRATEGY_TYPES),
    title: z.string().min(1, 'Нэр оруулна уу'),
    description: z.string().optional().default(''),
    ownerId: z.string().optional().default(''),
    ownerName: z.string().optional().default(''),
    status: z.enum(OKR_STATUSES).default('not_started'),
    startDate: z.string().optional().default(''),
    endDate: z.string().optional().default(''),
    budget: z.coerce.number().optional(),
});

export type StrategyFormValues = z.infer<typeof strategySchema>;

// ============================================
// BSC STRATEGY MAP LINKS (cause-effect)
// ============================================

export interface StrategyMapLink {
    id: string;
    planId: string;
    fromObjectiveId: string;
    toObjectiveId: string;
}

// ============================================
// KPI ENGINE
// ============================================

export const KPI_FREQUENCIES = ['daily', 'weekly', 'monthly', 'quarterly'] as const;
export type KpiFrequency = (typeof KPI_FREQUENCIES)[number];

export const KPI_FREQUENCY_LABELS: Record<KpiFrequency, string> = {
    daily: 'Өдөр бүр',
    weekly: 'Долоо хоног бүр',
    monthly: 'Сар бүр',
    quarterly: 'Улирал бүр',
};

export const RAG_STATUSES = ['green', 'amber', 'red'] as const;
export type RagStatus = (typeof RAG_STATUSES)[number];

export const RAG_STATUS_LABELS: Record<RagStatus, string> = {
    green: 'Хэвийн',
    amber: 'Анхааруулга',
    red: 'Сэрэмжлүүлэг',
};

export const RAG_STATUS_COLORS: Record<RagStatus, string> = {
    green: 'bg-emerald-100 text-emerald-700',
    amber: 'bg-amber-100 text-amber-700',
    red: 'bg-red-100 text-red-700',
};

export interface Kpi {
    id: string;
    planId: string;
    themeId: string;
    objectiveId: string; // optional link to objective
    name: string;
    description: string;
    metricType: MetricType;
    target: number;
    current: number;
    unit: string;
    frequency: KpiFrequency;
    ownerId: string;
    ownerName: string;
    departmentId: string;
    ragStatus: RagStatus; // auto-computed
    createdAt: string;
}

export const kpiSchema = z.object({
    themeId: z.string().optional().default(''),
    objectiveId: z.string().optional().default(''),
    name: z.string().min(1, 'KPI нэр оруулна уу'),
    description: z.string().optional().default(''),
    metricType: z.enum(METRIC_TYPES, { required_error: 'Хэмжүүрийн төрөл сонгоно уу' }),
    target: z.coerce.number().min(0, 'Зорилтот утга оруулна уу'),
    current: z.coerce.number().default(0),
    unit: z.string().optional().default(''),
    frequency: z.enum(KPI_FREQUENCIES, { required_error: 'Давтамж сонгоно уу' }),
    ownerId: z.string().optional().default(''),
    ownerName: z.string().optional().default(''),
    departmentId: z.string().optional().default(''),
});

export type KpiFormValues = z.infer<typeof kpiSchema>;

// ============================================
// PERFORMANCE REVIEWS
// ============================================

export const REVIEW_PERIODS = ['Q1', 'Q2', 'Q3', 'Q4', 'annual'] as const;
export type ReviewPeriod = (typeof REVIEW_PERIODS)[number];

export const REVIEW_PERIOD_LABELS: Record<ReviewPeriod, string> = {
    Q1: '1-р улирал',
    Q2: '2-р улирал',
    Q3: '3-р улирал',
    Q4: '4-р улирал',
    annual: 'Жилийн',
};

export const REVIEW_STATUSES = ['draft', 'in_progress', 'completed', 'locked'] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

export const REVIEW_STATUS_LABELS: Record<ReviewStatus, string> = {
    draft: 'Ноорог',
    in_progress: 'Явагдаж буй',
    completed: 'Дууссан',
    locked: 'Түгжсэн',
};

export interface PerformanceReview {
    id: string;
    planId: string;
    title: string;
    period: ReviewPeriod;
    year: number;
    status: ReviewStatus;
    okrWeight: number; // default 60
    kpiWeight: number; // default 40, okrWeight + kpiWeight must = 100
    createdAt: string;
    createdBy: string;
}

export const performanceReviewSchema = z.object({
    title: z.string().min(1, 'Нэр оруулна уу'),
    period: z.enum(REVIEW_PERIODS, { required_error: 'Хугацаа сонгоно уу' }),
    year: z.coerce.number().min(2020).max(2100),
    status: z.enum(REVIEW_STATUSES).default('draft'),
    okrWeight: z.coerce.number().min(0).max(100).default(60),
    kpiWeight: z.coerce.number().min(0).max(100).default(40),
}).refine(data => data.okrWeight + data.kpiWeight === 100, {
    message: 'OKR + KPI жин нийлбэр 100 байх ёстой',
    path: ['kpiWeight'],
});

export type PerformanceReviewFormValues = z.infer<typeof performanceReviewSchema>;

// ============================================
// PERFORMANCE SCORES
// ============================================

export const RATINGS = ['A+', 'A', 'B+', 'B', 'C+', 'C', 'D'] as const;
export type Rating = (typeof RATINGS)[number];

export const RATING_LABELS: Record<Rating, string> = {
    'A+': 'Онцгой (95+)',
    'A': 'Маш сайн (85-94)',
    'B+': 'Сайн (75-84)',
    'B': 'Хангалттай (65-74)',
    'C+': 'Дундаж (55-64)',
    'C': 'Хангалтгүй (45-54)',
    'D': 'Маш муу (<45)',
};

export const RATING_COLORS: Record<Rating, string> = {
    'A+': 'bg-emerald-100 text-emerald-800',
    'A': 'bg-emerald-50 text-emerald-700',
    'B+': 'bg-blue-100 text-blue-700',
    'B': 'bg-blue-50 text-blue-600',
    'C+': 'bg-amber-100 text-amber-700',
    'C': 'bg-orange-100 text-orange-700',
    'D': 'bg-red-100 text-red-700',
};

export const SCORE_STATUSES = ['pending', 'submitted', 'approved'] as const;
export type ScoreStatus = (typeof SCORE_STATUSES)[number];

export interface PerformanceScore {
    id: string;
    reviewId: string;
    planId: string;
    employeeId: string;
    employeeName: string;
    okrScore: number;  // 0-100
    kpiScore: number;  // 0-100
    overallScore: number; // weighted
    rating: Rating;
    reviewedBy: string;
    reviewedByName: string;
    status: ScoreStatus;
    notes: string;
    createdAt: string;
}

export const scoreEmployeeSchema = z.object({
    employeeId: z.string().min(1, 'Ажилтан сонгоно уу'),
    okrScore: z.coerce.number().min(0).max(100),
    kpiScore: z.coerce.number().min(0).max(100),
    notes: z.string().optional().default(''),
});

export type ScoreEmployeeFormValues = z.infer<typeof scoreEmployeeSchema>;

// ============================================
// BONUS / PROMOTION
// ============================================

export const REWARD_TYPES = ['bonus', 'promotion', 'both'] as const;
export type RewardType = (typeof REWARD_TYPES)[number];

export const REWARD_TYPE_LABELS: Record<RewardType, string> = {
    bonus: 'Урамшуулал',
    promotion: 'Албан тушаал дэвшүүлэлт',
    both: 'Аль аль нь',
};

export const BONUS_TYPES = ['percentage', 'fixed'] as const;
export type BonusType = (typeof BONUS_TYPES)[number];

export const REWARD_STATUSES = ['proposed', 'approved', 'applied', 'rejected'] as const;
export type RewardStatus = (typeof REWARD_STATUSES)[number];

export const REWARD_STATUS_LABELS: Record<RewardStatus, string> = {
    proposed: 'Санал болгосон',
    approved: 'Зөвшөөрсөн',
    applied: 'Хэрэгжсэн',
    rejected: 'Татгалзсан',
};

export const REWARD_STATUS_COLORS: Record<RewardStatus, string> = {
    proposed: 'bg-blue-100 text-blue-700',
    approved: 'bg-emerald-100 text-emerald-700',
    applied: 'bg-purple-100 text-purple-700',
    rejected: 'bg-red-100 text-red-700',
};

export interface Reward {
    id: string;
    reviewId: string;
    planId: string;
    employeeId: string;
    employeeName: string;
    type: RewardType;
    bonusType?: BonusType;
    bonusAmount?: number;
    promotionTo?: string; // positionId
    promotionToTitle?: string;
    reason: string;
    status: RewardStatus;
    proposedBy: string;
    proposedByName: string;
    approvedBy?: string;
    approvedByName?: string;
    createdAt: string;
}

export const rewardSchema = z.object({
    employeeId: z.string().min(1, 'Ажилтан сонгоно уу'),
    type: z.enum(REWARD_TYPES, { required_error: 'Төрөл сонгоно уу' }),
    bonusType: z.enum(BONUS_TYPES).optional(),
    bonusAmount: z.coerce.number().optional(),
    promotionTo: z.string().optional(),
    reason: z.string().min(1, 'Шалтгаан оруулна уу'),
    status: z.enum(REWARD_STATUSES).default('proposed'),
});

export type RewardFormValues = z.infer<typeof rewardSchema>;

// ============================================
// UTILITY FUNCTIONS
// ============================================

/** Compute Key Result progress (0-100) */
export function computeKeyResultProgress(kr: KeyResult): number {
    if (kr.metricType === 'boolean') {
        return kr.currentValue >= 1 ? 100 : 0;
    }
    const range = kr.targetValue - kr.startValue;
    if (range === 0) return kr.currentValue >= kr.targetValue ? 100 : 0;
    const progress = ((kr.currentValue - kr.startValue) / range) * 100;
    return Math.max(0, Math.min(100, Math.round(progress)));
}

/** Compute Objective progress from its Key Results (average) */
export function computeObjectiveProgress(keyResults: KeyResult[]): number {
    if (keyResults.length === 0) return 0;
    const total = keyResults.reduce((sum, kr) => sum + computeKeyResultProgress(kr), 0);
    return Math.round(total / keyResults.length);
}

/** Compute Theme progress from its Objectives */
export function computeThemeProgress(objectives: Objective[]): number {
    if (objectives.length === 0) return 0;
    const total = objectives.reduce((sum, obj) => sum + obj.progress, 0);
    return Math.round(total / objectives.length);
}

/** Compute Plan progress (weighted average of themes) */
export function computePlanProgress(
    themes: StrategicTheme[],
    themeProgressMap: Map<string, number>
): number {
    if (themes.length === 0) return 0;
    const totalWeight = themes.reduce((sum, t) => sum + t.weight, 0);
    if (totalWeight === 0) return 0;
    const weightedSum = themes.reduce((sum, t) => {
        const progress = themeProgressMap.get(t.id) ?? 0;
        return sum + progress * t.weight;
    }, 0);
    return Math.round(weightedSum / totalWeight);
}

/** Compute KPI RAG status */
export function computeRagStatus(current: number, target: number): RagStatus {
    if (target === 0) return 'green';
    const achievement = (current / target) * 100;
    if (achievement >= 90) return 'green';
    if (achievement >= 70) return 'amber';
    return 'red';
}

/** Compute KPI achievement percentage */
export function computeKpiAchievement(current: number, target: number): number {
    if (target === 0) return current > 0 ? 100 : 0;
    return Math.round((current / target) * 100);
}

/** Get rating from overall score */
export function getRatingFromScore(score: number): Rating {
    if (score >= 95) return 'A+';
    if (score >= 85) return 'A';
    if (score >= 75) return 'B+';
    if (score >= 65) return 'B';
    if (score >= 55) return 'C+';
    if (score >= 45) return 'C';
    return 'D';
}

/** Compute overall score from OKR + KPI */
export function computeOverallScore(
    okrScore: number,
    kpiScore: number,
    okrWeight: number,
    kpiWeight: number
): number {
    return Math.round((okrScore * okrWeight + kpiScore * kpiWeight) / 100);
}

/** Validate theme weights sum to 100 */
export function validateThemeWeights(themes: { weight: number }[]): boolean {
    if (themes.length === 0) return true;
    const total = themes.reduce((sum, t) => sum + t.weight, 0);
    return total === 100;
}

// ============================================
// OGSM PROGRESS ROLL-UP (Strategy layer)
// ============================================

/** Compute Strategy progress from its Measures (KeyResults linked via strategyId) */
export function computeStrategyProgress(measures: KeyResult[]): number {
    if (measures.length === 0) return 0;
    const total = measures.reduce((sum, m) => sum + computeKeyResultProgress(m), 0);
    return Math.round(total / measures.length);
}

/** Compute Goal (Objective) progress from its Strategies */
export function computeGoalProgressFromStrategies(strategies: Strategy[]): number {
    if (strategies.length === 0) return 0;
    const total = strategies.reduce((sum, s) => sum + s.progress, 0);
    return Math.round(total / strategies.length);
}

/** Get framework-aware label for the main scoring dimension */
export function getFrameworkScoreLabel(framework: StrategyFramework): string {
    switch (framework) {
        case 'okr': return 'OKR оноо';
        case 'ogsm': return 'OGSM оноо';
        case 'bsc': return 'Scorecard оноо';
    }
}
