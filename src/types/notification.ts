import { Timestamp } from 'firebase/firestore';

export type NotificationType =
  | 'info'
  | 'success'
  | 'warning'
  | 'error'
  | 'task'
  | 'employee'
  | 'project'
  | 'vacation'
  | 'attendance'
  | 'recruitment'
  | 'system';

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  type: NotificationType;
  read: boolean;
  /** Firestore path to the related entity (e.g. "employees/abc123") */
  link?: string;
  /** UID of the actor who triggered this notification */
  actorId?: string;
  actorName?: string;
  createdAt: Timestamp;
}

export type CreateNotificationInput = Omit<AppNotification, 'id' | 'createdAt' | 'read'>;
