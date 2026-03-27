'use client';

/**
 * use-er-document-actions.ts
 *
 * Custom hook that encapsulates all write operations for an ER document detail page.
 * Extracted from [id]/page.tsx to keep the page component focused on rendering.
 *
 * Each action:
 *  - Uses writeBatch for atomic document + activity log writes
 *  - Handles optimistic UI via setIsSaving
 *  - Surfaces errors via toast
 */

import { useCallback, useRef } from 'react';
import {
    doc,
    Timestamp,
    updateDoc,
    deleteDoc,
    writeBatch,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useFirebase, useTenantWrite } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import type { ERDocument } from '../types';

interface UseERDocumentActionsParams {
    id: string;
    document: ERDocument;
    currentUserId: string | undefined;
    // Editable state (owned by parent — passed in, not owned here)
    editContent: string;
    selectedDept: string;
    selectedPos: string;
    reviewers: string[];
    isReviewRequired: boolean;
    customInputValues: Record<string, unknown>;
    departments: { id: string; name: string }[] | undefined;
    positions: { id: string; title: string }[] | undefined;
    template: { content?: string } | undefined;
    setEditContent: (v: string) => void;
    setIsSaving: (v: boolean) => void;
    setIsUploading: (v: boolean) => void;
}

export function useERDocumentActions({
    id,
    document,
    currentUserId,
    editContent,
    selectedDept,
    selectedPos,
    reviewers,
    isReviewRequired,
    customInputValues,
    departments,
    positions,
    template,
    setEditContent,
    setIsSaving,
    setIsUploading,
}: UseERDocumentActionsParams) {
    const { firestore, storage } = useFirebase();
    const { tDoc, tCollection } = useTenantWrite();
    const { toast } = useToast();
    const router = useRouter();
    const fileInputRef = useRef<HTMLInputElement>(null);

    // ── Restore template content ──────────────────────────────────────────────
    const restoreTemplateContent = useCallback(() => {
        if (!template?.content) {
            toast({ title: 'Алдаа', description: 'Эх загвар олдсонгүй', variant: 'destructive' });
            return;
        }
        setEditContent(template.content);
        toast({ title: 'Сэргээгдлээ', description: 'Баримтын агуулгыг анхны эх загвараар сольж сэргээлээ.' });
    }, [template, setEditContent, toast]);

    // ── Save draft ────────────────────────────────────────────────────────────
    const handleSaveDraft = useCallback(async () => {
        if (!firestore) return;
        setIsSaving(true);
        try {
            await updateDoc(tDoc('er_documents', id), {
                content: editContent,
                departmentId: selectedDept,
                positionId: selectedPos,
                reviewers,
                customInputs: customInputValues,
                metadata: {
                    ...document.metadata,
                    departmentName: departments?.find(d => d.id === selectedDept)?.name,
                    positionName: positions?.find(p => p.id === selectedPos)?.title,
                },
                updatedAt: Timestamp.now(),
            });
            toast({ title: 'Хадгалагдлаа', description: 'Өөрчлөлтүүд амжилттай хадгалагдлаа' });
        } catch {
            toast({ title: 'Алдаа', description: 'Хадгалахад алдаа гарлаа', variant: 'destructive' });
        } finally {
            setIsSaving(false);
        }
    }, [firestore, id, editContent, selectedDept, selectedPos, reviewers, customInputValues,
        document.metadata, departments, positions, tDoc, toast, setIsSaving]);

    // ── Send for review ───────────────────────────────────────────────────────
    const handleSendForReview = useCallback(async () => {
        if (!firestore) return;

        if (isReviewRequired && reviewers.length === 0) {
            toast({
                title: 'Анхааруулга',
                description: 'Хянуулах шаардлагатай үед заавал хянагч сонгох ёстой.',
                variant: 'destructive',
            });
            return;
        }

        setIsSaving(true);
        try {
            const initialApprovalStatus: Record<string, unknown> = {};
            if (isReviewRequired && reviewers.length > 0) {
                reviewers.forEach(uid => {
                    initialApprovalStatus[uid] = { status: 'PENDING', updatedAt: Timestamp.now() };
                });
            }

            const nextStatus = isReviewRequired ? 'IN_REVIEW' : 'REVIEWED';
            const batch = writeBatch(firestore);

            batch.update(tDoc('er_documents', id), {
                status: nextStatus,
                reviewers: isReviewRequired ? reviewers : [],
                approvalStatus: initialApprovalStatus,
                updatedAt: Timestamp.now(),
            });
            batch.set(doc(tCollection('er_documents', id, 'activity')), {
                type: 'STATUS_CHANGE',
                actorId: currentUserId,
                content: nextStatus === 'REVIEWED' ? 'Хянагдсан төлөвт шилжив' : 'Хянахаар илгээв',
                createdAt: Timestamp.now(),
            });
            await batch.commit();

            toast({
                title: nextStatus === 'REVIEWED' ? 'Хянагдсан' : 'Илгээгдлээ',
                description: nextStatus === 'REVIEWED'
                    ? 'Хянах шат алгасан хянагдсан төлөвт шилжлээ. Одоо эх хувийг хавсаргана уу.'
                    : 'Баримт хянах шат руу шилжлээ',
            });
        } catch {
            toast({ title: 'Алдаа', description: 'Илгээхэд алдаа гарлаа', variant: 'destructive' });
        } finally {
            setIsSaving(false);
        }
    }, [firestore, id, isReviewRequired, reviewers, currentUserId, tDoc, tCollection, toast, setIsSaving]);

    // ── Approve ───────────────────────────────────────────────────────────────
    const handleApprove = useCallback(async (
        approveKeyForCurrentUser: string | null,
        comment?: string
    ) => {
        if (!firestore || !currentUserId || !approveKeyForCurrentUser) return;
        setIsSaving(true);
        try {
            const newApprovalStatus = { ...document.approvalStatus };

            newApprovalStatus[approveKeyForCurrentUser] = {
                status: 'APPROVED',
                actorId: currentUserId,
                ...(comment?.trim() ? { comment: comment.trim() } : {}),
                updatedAt: Timestamp.now(),
            };

            const allApproved = reviewers.every(r => newApprovalStatus[r]?.status === 'APPROVED');

            const batch = writeBatch(firestore);
            batch.update(tDoc('er_documents', id), {
                approvalStatus: newApprovalStatus,
                status: allApproved ? 'REVIEWED' : 'IN_REVIEW',
                updatedAt: Timestamp.now(),
            });
            batch.set(doc(tCollection('er_documents', id, 'activity')), {
                type: 'APPROVE',
                actorId: currentUserId,
                content: comment?.trim() ? `Батлав: ${comment.trim()}` : 'Баримтыг зөвшөөрөв',
                createdAt: Timestamp.now(),
            });
            await batch.commit();

            toast({
                title: 'Зөвшөөрлөө',
                description: allApproved
                    ? 'Бүх хянагчид зөвшөөрсөн. Эцсийн батлалт хүлээж байна.'
                    : 'Таны зөвшөөрөл бүртгэгдлээ',
            });
        } catch {
            toast({ title: 'Алдаа', variant: 'destructive' });
        } finally {
            setIsSaving(false);
        }
    }, [firestore, id, currentUserId, document.approvalStatus, reviewers, tDoc, tCollection, toast, setIsSaving]);

    // ── Final approve (REVIEWED → SIGNED) ────────────────────────────────────
    const handleFinalApprove = useCallback(async () => {
        if (!firestore) return;

        if (!document.signedDocUrl) {
            toast({
                title: 'Анхааруулга',
                description: 'Баримтыг эцэслэн батлахын тулд эх хувийг (сканнердсан хувилбар) заавал хавсаргасан байх ёстой.',
                variant: 'destructive',
            });
            return;
        }

        setIsSaving(true);
        try {
            const batch = writeBatch(firestore);
            batch.update(tDoc('er_documents', id), {
                status: 'SIGNED',
                updatedAt: Timestamp.now(),
            });
            batch.set(doc(tCollection('er_documents', id, 'activity')), {
                type: 'STATUS_CHANGE',
                actorId: currentUserId,
                content: 'Баримт баталгаажлаа (эх хувь хавсаргав)',
                createdAt: Timestamp.now(),
            });
            await batch.commit();

            // Employee lifecycle update — best-effort, non-blocking
            applyEmployeeLifecycle({
                actionId: String((document.metadata as Record<string, unknown>)?.actionId || ''),
                employeeId: document?.employeeId,
                customInputs: document?.customInputs,
                tDoc,
                firestore,
            }).catch(e => console.warn('[finalApprove] Employee lifecycle update failed:', e));

            toast({ title: 'Баталгаажлаа', description: 'Баримт баталгаажлаа' });
        } catch {
            toast({ title: 'Алдаа', variant: 'destructive' });
        } finally {
            setIsSaving(false);
        }
    }, [firestore, id, currentUserId, document, tDoc, tCollection, toast, setIsSaving]);

    // ── Send to employee for acknowledgement ──────────────────────────────────
    const handleSendToEmployeeForAcknowledgement = useCallback(async () => {
        if (!firestore) return;
        if (!document?.employeeId) {
            toast({ variant: 'destructive', title: 'Алдаа', description: 'Ажилтан сонгогдоогүй байна.' });
            return;
        }

        setIsSaving(true);
        try {
            const batch = writeBatch(firestore);
            batch.update(tDoc('er_documents', id), {
                status: 'SENT_TO_EMPLOYEE',
                employeeAckRequired: true,
                employeeAckSentAt: Timestamp.now(),
                employeeAckSentBy: currentUserId || null,
                updatedAt: Timestamp.now(),
            });
            batch.set(doc(tCollection('er_documents', id, 'activity')), {
                type: 'STATUS_CHANGE',
                actorId: currentUserId,
                content: 'Ажилтанд танилцуулахаар илгээлээ',
                createdAt: Timestamp.now(),
            });
            await batch.commit();

            toast({ title: 'Илгээгдлээ', description: 'Ажилтанд танилцуулахаар илгээлээ.' });
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'Танилцуулахад алдаа гарлаа.';
            toast({ variant: 'destructive', title: 'Алдаа', description: msg });
        } finally {
            setIsSaving(false);
        }
    }, [firestore, id, currentUserId, document?.employeeId, tDoc, tCollection, toast, setIsSaving]);

    // ── Delete ────────────────────────────────────────────────────────────────
    const handleDelete = useCallback(async (onDone?: () => void) => {
        if (!firestore) return;
        setIsSaving(true);
        try {
            await deleteDoc(tDoc('er_documents', id));
            toast({ title: 'Устгагдлаа', description: 'Баримт амжилттай устгагдлаа' });
            router.push('/dashboard/employment-relations');
            onDone?.();
        } catch {
            toast({ title: 'Алдаа', description: 'Устгахад алдаа гарлаа', variant: 'destructive' });
        } finally {
            setIsSaving(false);
        }
    }, [firestore, id, tDoc, toast, router, setIsSaving]);

    // ── File upload (signed doc) ──────────────────────────────────────────────
    const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !storage) return;

        setIsUploading(true);
        try {
            const storageRef = ref(storage, `signed_docs/${id}/${Date.now()}_${file.name}`);
            await uploadBytes(storageRef, file);
            const downloadURL = await getDownloadURL(storageRef);

            await updateDoc(tDoc('er_documents', id), {
                signedDocUrl: downloadURL,
                updatedAt: Timestamp.now(),
            });

            toast({ title: 'Амжилттай', description: 'Эх хувь хавсрагдлаа' });
        } catch {
            toast({ title: 'Алдаа', description: 'Файл хуулахад алдаа гарлаа', variant: 'destructive' });
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    }, [storage, id, tDoc, toast, setIsUploading]);

    return {
        fileInputRef,
        restoreTemplateContent,
        handleSaveDraft,
        handleSendForReview,
        handleApprove,
        handleFinalApprove,
        handleSendToEmployeeForAcknowledgement,
        handleDelete,
        handleFileUpload,
    };
}

// ─── Employee lifecycle helper ────────────────────────────────────────────────

interface LifecycleParams {
    actionId: string;
    employeeId?: string;
    customInputs?: Record<string, unknown>;
    tDoc: (col: string, ...segs: string[]) => import('firebase/firestore').DocumentReference;
    firestore: import('firebase/firestore').Firestore;
}

async function applyEmployeeLifecycle({
    actionId,
    employeeId,
    customInputs,
    tDoc,
    firestore,
}: LifecycleParams): Promise<void> {
    if (!employeeId || !actionId) return;

    if (actionId.startsWith('release_')) {
        const ci = (customInputs || {}) as Record<string, string>;
        const terminationDate =
            (typeof ci.releaseDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(ci.releaseDate)
                ? ci.releaseDate
                : null) ||
            (typeof ci['Ажлаас чөлөөлөх огноо'] === 'string' &&
                /^\d{4}-\d{2}-\d{2}$/.test(ci['Ажлаас чөлөөлөх огноо'])
                ? ci['Ажлаас чөлөөлөх огноо']
                : null);

        if (actionId === 'release_temporary') {
            await updateDoc(tDoc('employees', employeeId), {
                status: 'on_leave',
                lifecycleStage: 'retention',
                updatedAt: Timestamp.now(),
            });
        } else {
            await updateDoc(tDoc('employees', employeeId), {
                status: 'terminated',
                lifecycleStage: 'alumni',
                ...(terminationDate ? { terminationDate } : {}),
                updatedAt: Timestamp.now(),
            });
        }
        return;
    }

    if (actionId.startsWith('appointment_')) {
        const appointmentStatus =
            actionId === 'appointment_probation' ? 'active_probation' : 'active_permanent';
        await updateDoc(tDoc('employees', employeeId), {
            status: appointmentStatus,
            lifecycleStage: 'active',
            updatedAt: Timestamp.now(),
        });
    }
}
