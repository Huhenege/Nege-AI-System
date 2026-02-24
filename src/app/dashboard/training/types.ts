// src/app/dashboard/training/types.ts
// L&D Module — Types & Zod Schemas

import { z } from 'zod';

// ============================================
// SKILL LEVEL
// ============================================

export const SKILL_LEVELS = ['beginner', 'intermediate', 'advanced', 'expert'] as const;
export type SkillLevel = (typeof SKILL_LEVELS)[number];

export const SKILL_LEVEL_LABELS: Record<SkillLevel, string> = {
    beginner: 'Анхан шат',
    intermediate: 'Дунд шат',
    advanced: 'Ахисан шат',
    expert: 'Мэргэжилтэн',
};

/** Numeric value for gap comparison (higher = more skilled) */
export const SKILL_LEVEL_VALUE: Record<SkillLevel, number> = {
    beginner: 1,
    intermediate: 2,
    advanced: 3,
    expert: 4,
};

// ============================================
// TRAINING COURSE
// ============================================

// Training category — Firestore collection: training_categories
// Categories are managed dynamically via Тохиргоо tab
export interface TrainingCategory {
    id: string;
    name: string;
    description?: string;
}

export const COURSE_TYPES = ['online', 'classroom', 'blended', 'self_study'] as const;
export type CourseType = (typeof COURSE_TYPES)[number];

export const COURSE_TYPE_LABELS: Record<CourseType, string> = {
    online: 'Онлайн',
    classroom: 'Танхимын',
    blended: 'Хосолсон',
    self_study: 'Бие даан',
};

export const COURSE_STATUSES = ['active', 'draft', 'archived'] as const;
export type CourseStatus = (typeof COURSE_STATUSES)[number];

export const COURSE_STATUS_LABELS: Record<CourseStatus, string> = {
    active: 'Идэвхтэй',
    draft: 'Ноорог',
    archived: 'Архивласан',
};

export const PROVIDER_TYPES = ['internal', 'external'] as const;
export type ProviderType = (typeof PROVIDER_TYPES)[number];

export const PROVIDER_TYPE_LABELS: Record<ProviderType, string> = {
    internal: 'Дотоод сургагч багш',
    external: 'Аутсорсинг сургагч багш',
};

export interface TrainingCourse {
    id: string;
    title: string;
    description: string;
    categoryId: string;       // links to training_categories
    skillIds: string[];       // linked to skills_inventory
    targetLevel: SkillLevel;
    duration: number;         // hours
    type: CourseType;
    providerType: ProviderType;
    providerName: string;
    status: CourseStatus;
    createdAt: string;
    createdBy: string;
}

export const trainingCourseSchema = z.object({
    title: z.string().min(1, 'Сургалтын нэр оруулна уу'),
    description: z.string().min(1, 'Тайлбар оруулна уу'),
    categoryId: z.string().min(1, 'Ангилал сонгоно уу'),
    skillIds: z.array(z.string()).default([]),
    targetLevel: z.enum(SKILL_LEVELS, { required_error: 'Түвшин сонгоно уу' }),
    duration: z.coerce.number().min(0.5, 'Хугацаа 0.5-аас их байх ёстой'),
    type: z.enum(COURSE_TYPES, { required_error: 'Төрөл сонгоно уу' }),
    providerType: z.enum(PROVIDER_TYPES, { required_error: 'Зохион байгуулагчийн төрөл сонгоно уу' }),
    providerName: z.string().min(1, 'Зохион байгуулагчийн нэр оруулна уу'),
    status: z.enum(COURSE_STATUSES).default('draft'),
});

export type TrainingCourseFormValues = z.infer<typeof trainingCourseSchema>;

// ============================================
// TRAINING PLAN (per-training: one plan = one scheduled course + participants)
// ============================================

export const PLAN_STATUSES = ['scheduled', 'in_progress', 'completed', 'cancelled'] as const;
export type PlanStatus = (typeof PLAN_STATUSES)[number];

/** Status shown in UI; includes legacy values from old per-employee plans */
export type PlanStatusDisplay = PlanStatus | 'assigned' | 'overdue';

export const PLAN_STATUS_LABELS: Record<string, string> = {
    scheduled: 'Төлөвлөгдсөн',
    in_progress: 'Явагдаж буй',
    completed: 'Дууссан',
    cancelled: 'Цуцалсан',
    // Legacy
    assigned: 'Оноогдсон',
    overdue: 'Хугацаа хэтэрсэн',
};

export const PLAN_TRIGGERS = ['skill_gap', 'onboarding', 'manual', 'position_change'] as const;
export type PlanTrigger = (typeof PLAN_TRIGGERS)[number];

export const PLAN_TRIGGER_LABELS: Record<PlanTrigger, string> = {
    skill_gap: 'Ур чадварын зөрүү',
    onboarding: 'Дасан зохицох',
    manual: 'Гараар оноосон',
    position_change: 'Албан тушаал өөрчлөлт',
};

// Төлөвлөгөөний төрөл (зориулалт)
export const PLAN_TYPES = ['soft_skill', 'mandatory', 'technical', 'compliance', 'other'] as const;
export type PlanType = (typeof PLAN_TYPES)[number];
export const PLAN_TYPE_LABELS: Record<PlanType, string> = {
    soft_skill: 'Soft skill',
    mandatory: 'Заавал',
    technical: 'Техникийн',
    compliance: 'Нийцэл',
    other: 'Бусад',
};

// Сургалтын формат (төлөвлөгөөнд)
export const PLAN_FORMATS = ['workshop', 'classroom', 'online', 'blended', 'self_study'] as const;
export type PlanFormat = (typeof PLAN_FORMATS)[number];
export const PLAN_FORMAT_LABELS: Record<PlanFormat, string> = {
    workshop: 'Workshop',
    classroom: 'Classroom',
    online: 'Онлайн',
    blended: 'Хосолсон',
    self_study: 'Бие даан',
};

// Үнэлгээний арга
export const ASSESSMENT_METHODS = ['quiz_feedback', 'test', 'assignment', 'observation', 'none'] as const;
export type AssessmentMethod = (typeof ASSESSMENT_METHODS)[number];
export const ASSESSMENT_METHOD_LABELS: Record<AssessmentMethod, string> = {
    quiz_feedback: 'Quiz + feedback',
    test: 'Тест',
    assignment: 'Даалгавар',
    observation: 'Ажиглалт',
    none: 'Үгүй',
};

/** Participant in a training plan (for display/storage) */
export interface PlanParticipant {
    employeeId: string;
    employeeName: string;
}

/** One plan = one scheduled training from catalog, with date, budget, and participants */
export interface TrainingPlan {
    id: string;
    courseId: string;
    courseName: string;
    /** When the training is scheduled (ISO date or datetime) */
    scheduledAt?: string;
    /** Legacy: old per-employee plan had dueDate */
    dueDate?: string;
    /** Budget in MNT or other currency (optional) */
    budget?: number;
    /** Who will attend */
    participantIds?: string[];
    participantNames?: string[]; // denormalized for list display
    /** Legacy: old per-employee plan had single employeeId */
    employeeId?: string;
    employeeName?: string;
    status: PlanStatus | 'assigned' | 'overdue';
    trigger: PlanTrigger;
    createdBy?: string;
    createdByName?: string;
    createdAt?: string;
    /** Legacy */
    assignedBy?: string;
    assignedByName?: string;
    assignedAt?: string;
    startedAt?: string;
    completedAt?: string;
    notes?: string;
    // —— Шинэ бүтэц (хүснэгтийн баганууд) ——
    /** Зорилго */
    purpose?: string;
    /** Хэнд (зорилтот аудитори) */
    targetAudience?: string;
    /** Төрөл: soft_skill, mandatory, ... */
    planType?: PlanType;
    /** Хариуцсан эзэн (HR/L&D, HSE manager гэх мэт) */
    owner?: string;
    /** Формат: workshop, classroom, ... */
    format?: PlanFormat;
    /** Байршил эсвэл холбоос */
    locationOrLink?: string;
    /** Үнэлгээний арга */
    assessmentMethod?: AssessmentMethod;
}

/** Form values for creating one unified plan (course + when + budget + who) */
export const createPlanSchema = z.object({
    courseId: z.string().min(1, 'Сургалт сонгоно уу'),
    scheduledAt: z.date({ required_error: 'Хэзээ явуулахыг сонгоно уу' }),
    budget: z.coerce.number().min(0).optional(),
    participantIds: z.array(z.string()).min(1, 'Дор хаяж нэг оролцогч сонгоно уу'),
    trigger: z.enum(PLAN_TRIGGERS).default('manual'),
    notes: z.string().optional(),
    purpose: z.string().optional(),
    targetAudience: z.string().optional(),
    planType: z.enum(PLAN_TYPES).optional(),
    owner: z.string().optional(),
    format: z.enum(PLAN_FORMATS).optional(),
    locationOrLink: z.string().optional(),
    assessmentMethod: z.enum(ASSESSMENT_METHODS).optional(),
});

export type CreatePlanFormValues = z.infer<typeof createPlanSchema>;

// Legacy: keep for any backward compat / migration (old per-employee assign flow)
export const assignTrainingSchema = z.object({
    employeeIds: z.array(z.string()).min(1, 'Дор хаяж нэг ажилтан сонгоно уу'),
    courseId: z.string().min(1, 'Сургалт сонгоно уу'),
    dueDate: z.date({ required_error: 'Дуусах огноо сонгоно уу' }),
    trigger: z.enum(PLAN_TRIGGERS).default('manual'),
    preAssessmentScore: z.coerce.number().min(0).max(100).optional(),
    notes: z.string().optional(),
});

export type AssignTrainingFormValues = z.infer<typeof assignTrainingSchema>;

// ============================================
// SKILL ASSESSMENT
// ============================================

export const ASSESSMENT_SOURCES = ['self', 'manager', 'training_completion'] as const;
export type AssessmentSource = (typeof ASSESSMENT_SOURCES)[number];

export const ASSESSMENT_SOURCE_LABELS: Record<AssessmentSource, string> = {
    self: 'Өөрийн үнэлгээ',
    manager: 'Удирдлагын үнэлгээ',
    training_completion: 'Сургалт дууссан',
};

export interface SkillAssessment {
    id: string;
    employeeId: string;
    employeeName: string;
    skillName: string;
    currentLevel: SkillLevel;
    requiredLevel?: SkillLevel;   // from Position.skills
    assessedBy: string;
    assessedByName: string;
    assessedAt: string;
    source: AssessmentSource;
    notes?: string;
}

export const assessSkillSchema = z.object({
    employeeId: z.string().min(1, 'Ажилтан сонгоно уу'),
    skillName: z.string().min(1, 'Ур чадвар сонгоно уу'),
    currentLevel: z.enum(SKILL_LEVELS, { required_error: 'Түвшин сонгоно уу' }),
    source: z.enum(ASSESSMENT_SOURCES).default('manager'),
    notes: z.string().optional(),
});

export type AssessSkillFormValues = z.infer<typeof assessSkillSchema>;

// ============================================
// SKILL GAP (computed, not stored)
// ============================================

export interface SkillGap {
    skillName: string;
    requiredLevel: SkillLevel;
    currentLevel: SkillLevel | null;  // null = not assessed
    gapSize: number;                  // positive = gap exists
}

/** Compare required vs current and compute gap */
export function computeSkillGaps(
    requiredSkills: { name: string; level: SkillLevel }[],
    assessments: SkillAssessment[]
): SkillGap[] {
    const assessmentMap = new Map<string, SkillAssessment>();

    // Keep the latest assessment per skill
    for (const a of assessments) {
        const existing = assessmentMap.get(a.skillName);
        if (!existing || a.assessedAt > existing.assessedAt) {
            assessmentMap.set(a.skillName, a);
        }
    }

    return requiredSkills.map(req => {
        const assessed = assessmentMap.get(req.name);
        const currentLevel = assessed?.currentLevel ?? null;
        const requiredValue = SKILL_LEVEL_VALUE[req.level];
        const currentValue = currentLevel ? SKILL_LEVEL_VALUE[currentLevel] : 0;

        return {
            skillName: req.name,
            requiredLevel: req.level,
            currentLevel,
            gapSize: requiredValue - currentValue,
        };
    });
}
