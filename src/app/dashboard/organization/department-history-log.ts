import { collection, addDoc } from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';
import type { DepartmentHistoryEventType } from './types';
import { tenantCollection } from '@/firebase/tenant-helpers';

export interface AddDepartmentHistoryEventParams {
  firestore: Firestore;
  companyPath: string | null;
  departmentId: string;
  eventType: DepartmentHistoryEventType;
  positionId?: string;
  positionTitle?: string;
  performedBy: string;
  performedByName: string;
}

/**
 * Нэгжийн бүтэц дотор хийгдсэн үйлдлийг түүхэнд бичнэ (ажлын байр нэмэх/засах/устгах).
 */
export async function addDepartmentHistoryEvent(params: AddDepartmentHistoryEventParams): Promise<void> {
  const { firestore, companyPath, departmentId, eventType, positionId, positionTitle, performedBy, performedByName } = params;
  const approvedAt = new Date().toISOString();
  await addDoc(tenantCollection(firestore, companyPath, 'departmentHistory'), {
    departmentId,
    approvedAt,
    eventType,
    ...(positionId != null && { positionId }),
    ...(positionTitle != null && positionTitle !== '' && { positionTitle }),
    performedBy,
    performedByName,
  });
}
