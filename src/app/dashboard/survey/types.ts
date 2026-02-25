// src/app/dashboard/survey/types.ts
// Survey Module — Types & Zod Schemas

import { z } from 'zod';

// ============================================
// SURVEY TYPE
// ============================================

export const SURVEY_TYPES = ['engagement', 'pulse', 'satisfaction', 'exit', 'onboarding', 'custom'] as const;
export type SurveyType = (typeof SURVEY_TYPES)[number];

export const SURVEY_TYPE_LABELS: Record<SurveyType, string> = {
    engagement: 'Оролцоо',
    pulse: 'Pulse судалгаа',
    satisfaction: 'Сэтгэл ханамж',
    exit: 'Гарах ярилцлага',
    onboarding: 'Шинэ ажилтан',
    custom: 'Бусад',
};

export const SURVEY_TYPE_DESCRIPTIONS: Record<SurveyType, string> = {
    engagement: 'Ажилтнуудын оролцоо, идэвхийг хэмжих',
    pulse: 'Богино хугацааны хурдан судалгаа',
    satisfaction: 'Ажлын байрны сэтгэл ханамжийг үнэлэх',
    exit: 'Ажлаас гарч буй ажилтнаас санал авах',
    onboarding: 'Шинэ ажилтны дасан зохицолтыг үнэлэх',
    custom: 'Тусгай зориулалтын санал асуулга',
};

// ============================================
// SURVEY STATUS
// ============================================

export const SURVEY_STATUSES = ['draft', 'active', 'closed', 'archived'] as const;
export type SurveyStatus = (typeof SURVEY_STATUSES)[number];

export const SURVEY_STATUS_LABELS: Record<SurveyStatus, string> = {
    draft: 'Ноорог',
    active: 'Идэвхтэй',
    closed: 'Хаагдсан',
    archived: 'Архивласан',
};

export const SURVEY_STATUS_COLORS: Record<SurveyStatus, string> = {
    draft: 'bg-slate-100 text-slate-700',
    active: 'bg-emerald-100 text-emerald-700',
    closed: 'bg-amber-100 text-amber-700',
    archived: 'bg-gray-100 text-gray-500',
};

// ============================================
// TARGET AUDIENCE
// ============================================

export const TARGET_AUDIENCES = ['all', 'department', 'position_level', 'employment_type', 'custom'] as const;
export type TargetAudience = (typeof TARGET_AUDIENCES)[number];

export const TARGET_AUDIENCE_LABELS: Record<TargetAudience, string> = {
    all: 'Бүх ажилтнууд',
    department: 'Хэлтсээр',
    position_level: 'Албан тушаалын түвшингээр',
    employment_type: 'Ажил эрхлэлтийн төрлөөр',
    custom: 'Тусгай сонголт',
};

// ============================================
// QUESTION TYPE
// ============================================

export const QUESTION_TYPES = ['single_choice', 'multiple_choice', 'rating', 'text', 'yes_no', 'nps'] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
    single_choice: 'Нэг сонголт',
    multiple_choice: 'Олон сонголт',
    rating: 'Үнэлгээ',
    text: 'Чөлөөт хариулт',
    yes_no: 'Тийм / Үгүй',
    nps: 'NPS (0-10)',
};

export const QUESTION_TYPE_ICONS: Record<QuestionType, string> = {
    single_choice: 'CircleDot',
    multiple_choice: 'CheckSquare',
    rating: 'Star',
    text: 'AlignLeft',
    yes_no: 'ToggleLeft',
    nps: 'Gauge',
};

// ============================================
// INTERFACES
// ============================================

export interface Survey {
    id: string;
    title: string;
    description: string;
    type: SurveyType;
    status: SurveyStatus;
    isAnonymous: boolean;
    targetAudience: TargetAudience;
    targetIds: string[];
    startDate: string;
    endDate: string;
    reminderEnabled: boolean;
    questionsCount: number;
    responsesCount: number;
    createdBy: string;
    createdAt: string;
    updatedAt: string;
    /** Сургалтын үнэлгээний санал асуулга бол survey-ийг энэ төлөвлөгөөтэй холбоно */
    trainingPlanId?: string;
}

export interface SurveyQuestion {
    id: string;
    type: QuestionType;
    text: string;
    description?: string;
    isRequired: boolean;
    order: number;
    section?: string;
    options?: string[];
    ratingMax?: number;
    ratingLabels?: { min: string; max: string };
}

export interface SurveyResponse {
    id: string;
    employeeId: string | null;
    departmentId?: string;
    answers: Record<string, any>;
    submittedAt: string;
}

export interface SurveyTemplate {
    id: string;
    title: string;
    description: string;
    category: SurveyType;
    questions: Omit<SurveyQuestion, 'id'>[];
    isSystem: boolean;
    createdAt: string;
}

// ============================================
// ZOD SCHEMAS
// ============================================

export const createSurveySchema = z.object({
    title: z.string().min(2, 'Гарчиг дор хаяж 2 тэмдэгт байх ёстой'),
    description: z.string().optional().default(''),
    type: z.enum(SURVEY_TYPES, { required_error: 'Төрөл сонгоно уу' }),
    isAnonymous: z.boolean().default(true),
    targetAudience: z.enum(TARGET_AUDIENCES).default('all'),
    targetIds: z.array(z.string()).default([]),
    startDate: z.string().optional().default(''),
    endDate: z.string().optional().default(''),
    reminderEnabled: z.boolean().default(false),
});

export type CreateSurveyFormValues = z.infer<typeof createSurveySchema>;

export const questionSchema = z.object({
    type: z.enum(QUESTION_TYPES, { required_error: 'Асуултын төрөл сонгоно уу' }),
    text: z.string().min(1, 'Асуултын текст оруулна уу'),
    description: z.string().optional(),
    isRequired: z.boolean().default(true),
    order: z.number().default(0),
    section: z.string().optional(),
    options: z.array(z.string()).optional(),
    ratingMax: z.number().optional(),
    ratingLabels: z.object({
        min: z.string(),
        max: z.string(),
    }).optional(),
});

export type QuestionFormValues = z.infer<typeof questionSchema>;
