// src/types/project.ts
// Project-based Task Management Module Types

import { Timestamp } from 'firebase/firestore';

// Project Status
export type ProjectStatus =
  | 'DRAFT'       // Ноорог - төлөвлөгдөж байгаа
  | 'ACTIVE'      // Идэвхтэй - хэрэгжиж байгаа
  | 'ON_HOLD'     // Түр зогссон
  | 'COMPLETED'   // Дууссан
  | 'ARCHIVED'    // Архивласан - түүхэн зорилгоор хадгалсан
  // Legacy statuses (for backward compatibility with older docs/UI)
  | 'PLANNING'
  | 'IN_PROGRESS'
  | 'CANCELLED';

// Task Status
export type TaskStatus =
  | 'TODO'          // Хийх
  | 'IN_PROGRESS'   // Гүйцэтгэж байна
  | 'DONE';         // Дууссан

// Priority levels (shared between Project and Task)
export type Priority = 
  | 'LOW' 
  | 'MEDIUM' 
  | 'HIGH' 
  | 'URGENT';

// Project Type
export type ProjectType = 'general' | 'onboarding' | 'offboarding' | 'position_preparation' | 'training';

// Project interface
export interface Project {
  id: string;
  name: string;
  goal: string;              // ЗОРИЛГО - Project goal/objective
  expectedOutcome: string;   // ХҮЛЭЭГДЭЖ БУЙ ҮР ДҮН - Expected outcome / success criteria
  startDate: string;         // ISO date string (YYYY-MM-DD)
  endDate: string;           // ISO date string (YYYY-MM-DD)
  ownerId: string;           // Employee ID who owns this project
  teamMemberIds: string[];   // Багийн гишүүд (Employee IDs)
  groupIds?: string[];       // Project Groups (tagging) - one project can belong to many groups
  status: ProjectStatus;
  priority: Priority;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;         // Employee ID who created the project
  
  // Onboarding-specific fields (optional)
  type?: ProjectType;                // Төслийн төрөл (general | onboarding)
  onboardingGroupId?: string;        // Onboarding бүлгийн ID (4 төслийг холбоно)
  onboardingStageId?: string;        // Үе шатны ID (pre-onboarding, orientation, etc.)
  onboardingEmployeeId?: string;     // Onboarding хийж буй ажилтны ID
  stageOrder?: number;               // Үе шатны дараалал (1-4)

  // Offboarding-specific fields (optional)
  offboardingGroupId?: string;       // Offboarding бүлгийн ID (4 төслийг холбоно)
  offboardingStageId?: string;       // Үе шатны ID (exit-initiation, etc.)
  offboardingEmployeeId?: string;    // Offboarding хийж буй ажилтны ID

  // Position preparation-specific fields (optional)
  positionPreparationGroupId?: string;     // Ажлын байр бэлтгэх бүлгийн ID (олон үе шатны төслүүдийг холбоно)
  positionPreparationStageId?: string;     // Үе шатны ID (workspace, access, etc.)
  positionPreparationPositionId?: string;  // Аль ажлын байранд зориулсан бэлтгэл вэ

  // Points integration fields (optional)
  pointBudget?: number;            // Төслийн нийт оноо (project total point budget)
  completedAt?: string;            // ISO date string (YYYY-MM-DD) - when project was marked COMPLETED
  pointsDistributed?: boolean;     // true = points already distributed to team members (prevents double-distribution)

  // Training plan link (when project was created from training plan)
  trainingPlanId?: string;         // Сургалтын төлөвлөгөөний ID
}

// Task interface
export interface Task {
  id: string;
  projectId: string;        // Parent project ID
  title: string;
  dueDate: string;          // ISO date string (YYYY-MM-DD) - only end date
  ownerId?: string;         // Optional task owner (Employee ID)
  assigneeIds: string[];    // Multiple assignees (Employee IDs)
  status: TaskStatus;
  priority: Priority;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  completedAt?: Timestamp;  // When the task was marked as DONE
  
  // Onboarding-specific fields (optional)
  policyId?: string;        // Холбогдох бодлогын ID (onboarding таскуудад)
}

// Project Chat Message interface
export interface ProjectMessage {
  id: string;
  projectId: string;        // Parent project ID
  content: string;          // Message content
  senderId: string;         // Employee ID who sent the message
  mentions: string[];       // Mentioned employee IDs (@mention)
  createdAt: Timestamp;
}

// Project group (tag) – shared across projects
export interface ProjectGroup {
  id: string;
  name: string;
  color?: string;       // optional hex color (e.g. #6366F1)
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;    // employee/user id
}

// Helper type for creating a new project (without id and timestamps)
export type CreateProjectInput = Omit<Project, 'id' | 'createdAt' | 'updatedAt'>;

// Helper type for creating a new task (without id and timestamps)
export type CreateTaskInput = Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'completedAt'>;

// Status label mappings for UI
export const PROJECT_STATUS_LABELS: Record<string, string> = {
  // New statuses
  DRAFT: 'Ноорог',
  ACTIVE: 'Идэвхтэй',
  ON_HOLD: 'Түр зогссон',
  COMPLETED: 'Дууссан',
  ARCHIVED: 'Архивласан',
  // Legacy statuses (for backward compatibility)
  PLANNING: 'Ноорог',
  IN_PROGRESS: 'Идэвхтэй',
  CANCELLED: 'Архивласан',
};

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  TODO: 'Хийх',
  IN_PROGRESS: 'Гүйцэтгэж байна',
  DONE: 'Дууссан',
};

export const PRIORITY_LABELS: Record<Priority, string> = {
  LOW: 'Бага',
  MEDIUM: 'Дунд',
  HIGH: 'Өндөр',
  URGENT: 'Яаралтай',
};

// Status colors for badges
export const PROJECT_STATUS_COLORS: Record<string, string> = {
  // New statuses
  DRAFT: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  ACTIVE: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  ON_HOLD: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  COMPLETED: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  ARCHIVED: 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400',
  // Legacy statuses (for backward compatibility)
  PLANNING: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  IN_PROGRESS: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  CANCELLED: 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400',
};

export const TASK_STATUS_COLORS: Record<TaskStatus, string> = {
  TODO: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  IN_PROGRESS: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  DONE: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
};

export const PRIORITY_COLORS: Record<Priority, string> = {
  LOW: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
  MEDIUM: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
  HIGH: 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400',
  URGENT: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
};
