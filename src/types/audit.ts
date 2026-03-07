import { Timestamp } from 'firebase/firestore';

export type AuditAction =
  | 'create'
  | 'update'
  | 'delete'
  | 'login'
  | 'logout'
  | 'export'
  | 'invite'
  | 'approve'
  | 'reject'
  | 'assign'
  | 'upload'
  | 'settings_change';

export type AuditResource =
  | 'employee'
  | 'project'
  | 'task'
  | 'department'
  | 'position'
  | 'vacation'
  | 'attendance'
  | 'document'
  | 'er_document'
  | 'training'
  | 'recruitment'
  | 'company'
  | 'billing'
  | 'settings'
  | 'user';

export interface AuditLogEntry {
  id: string;
  action: AuditAction;
  resource: AuditResource;
  resourceId?: string;
  resourceName?: string;
  actorId: string;
  actorName?: string;
  actorRole?: string;
  /** Short human-readable description in Mongolian */
  description: string;
  /** JSON-serializable diff or extra context */
  metadata?: Record<string, unknown>;
  ip?: string;
  createdAt: Timestamp;
}

export type CreateAuditInput = Omit<AuditLogEntry, 'id' | 'createdAt'>;
