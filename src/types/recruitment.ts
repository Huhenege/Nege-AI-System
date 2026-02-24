
export type VacancyStatus = 'DRAFT' | 'OPEN' | 'CLOSED' | 'PAUSED';

export type StageType = 'SCREENING' | 'INTERVIEW' | 'CHALLENGE' | 'OFFER' | 'HIRED' | 'REJECTED';

export interface RecruitmentStage {
    id: string;
    title: string;
    type: StageType;
    order: number;
}

export interface Vacancy {
    id: string;
    title: string;
    departmentId: string;
    hiringManagerId: string; // User ID
    status: VacancyStatus;
    stages: RecruitmentStage[];
    description: string; // HTML or Markdown
    requirements: string[];
    createdAt: string;
    updatedAt: string;
    salaryRange?: {
        min: number;
        max: number;
        currency: string;
    };
    location?: string;
    type?: 'FULL_TIME' | 'PART_TIME' | 'CONTRACT' | 'INTERNSHIP';
    employmentTypeId?: string;
    deadline?: string; // ISO Date string
}

export interface Candidate {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    resumeUrl?: string; // URL to storage
    resumeName?: string;
    linkedinUrl?: string;
    portfolioUrl?: string;
    source?: string; // e.g., 'LINKEDIN', 'REFERRAL', 'AGENCY'
    tags?: string[];
    createdAt: string;
    updatedAt: string;
    notes?: string;
}

export interface ApplicationFile {
    id: string;
    name: string;
    url: string;
    size: number;
    type: string;
    stageId?: string;
    uploadedAt: string;
    uploadedBy?: string;
}

export interface JobApplication {
    id: string;
    vacancyId: string;
    candidateId: string;
    /** Employees collection-тай холбох (горилогч = ажилтан) */
    employeeId?: string;
    currentStageId: string;
    status: 'ACTIVE' | 'REJECTED' | 'WITHDRAWN' | 'HIRED';
    /** Татгалзсан шалтгаан */
    rejectionReason?: string;
    files?: ApplicationFile[];
    appliedAt: string;
    updatedAt: string;
    candidate?: Candidate; // For easier displaying in lists
    vacancy?: Vacancy;     // For easier displaying in lists
}

export type InterviewStatus = 'SCHEDULED' | 'COMPLETED' | 'CANCELLED' | 'RESCHEDULED' | 'NO_SHOW';

export interface Interview {
    id: string;
    applicationId: string;
    vacancyId: string;
    candidateId: string;
    candidateName?: string; // Denormalized for display
    vacancyTitle?: string;  // Denormalized for display
    title: string;
    startTime: string; // ISO string
    endTime: string;   // ISO string
    location?: string; // Meeting link or physical room
    interviewerIds: string[]; // User IDs
    status: InterviewStatus;
    notes?: string;
    feedback?: string; // Internal feedback summary
    calendarEventId?: string; // If synced with external calendar
}

export interface ScorecardCriteria {
    id: string;
    name: string;
    description?: string;
    score: number;
}

export interface Scorecard {
    id: string;
    applicationId: string;
    candidateId: string;
    interviewerId: string;
    interviewerName?: string;
    stageId: string;
    criteria: ScorecardCriteria[];
    notes?: string;
    averageScore: number;
    createdAt: string;
}
export interface EvaluationRequest {
    id: string;
    applicationId: string;
    candidateId: string;
    candidateName: string;
    vacancyTitle?: string;
    stageId: string;
    requestedBy: string;
    requestedByName: string;
    assignedTo: string;
    assignedToName: string;
    assignedToEmail?: string;
    status: 'pending' | 'completed';
    scorecardId?: string;
    createdAt: string;
    completedAt?: string;
}

export interface MessageTemplate {
    id: string;
    title: string;
    body: string;
    createdAt: string;
    updatedAt: string;
}
