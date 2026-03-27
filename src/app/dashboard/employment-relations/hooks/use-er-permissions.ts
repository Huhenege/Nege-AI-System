'use client';

/**
 * use-er-permissions.ts
 *
 * Derives all permission flags for the ER document detail page.
 * Extracted from [id]/page.tsx to centralize access-control logic.
 */

import { useMemo } from 'react';
import type { ERDocument } from '../types';

interface UseERPermissionsParams {
    document: ERDocument | undefined | null;
    currentUserId: string | undefined;
    currentUserProfile: { role?: string; positionId?: string; id?: string } | undefined | null;
    reviewers: string[];
}

export interface ERPermissions {
    /** Current user is the document creator */
    isOwner: boolean;
    /** Current user has admin-level role (company_super_admin, admin, hr, hr_manager, director) */
    isAdmin: boolean;
    /** Current user is listed as a reviewer (by positionId or uid) */
    isApprover: boolean;
    /**
     * The Firestore key to use when reading/writing approvalStatus for the current user.
     * Resolves to positionId if the reviewer entry matches by position, otherwise uid.
     */
    approveKeyForCurrentUser: string | null;
    /** Whether the current user can still approve (status=IN_REVIEW, is approver, not yet approved) */
    canApproveFromCommentBox: boolean;
}

export function useERPermissions({
    document,
    currentUserId,
    currentUserProfile,
    reviewers,
}: UseERPermissionsParams): ERPermissions {
    const isOwner = useMemo(
        () => !!document && !!currentUserId && document.creatorId === currentUserId,
        [document, currentUserId]
    );

    const isAdmin = useMemo(() => {
        const role = String(currentUserProfile?.role || '').toLowerCase();
        return (
            role === 'company_super_admin' ||
            role === 'admin' ||
            role === 'hr' ||
            role === 'hr_manager' ||
            role === 'director'
        );
    }, [currentUserProfile?.role]);

    const isApprover = useMemo(() => {
        if (!document?.reviewers || !currentUserProfile) return false;
        return document.reviewers.some(
            rid =>
                rid === currentUserProfile.positionId ||
                rid === currentUserProfile.id
        );
    }, [document?.reviewers, currentUserProfile]);

    const approveKeyForCurrentUser = useMemo(() => {
        const rid = reviewers.find(
            r =>
                r === currentUserId ||
                (currentUserProfile?.positionId && r === currentUserProfile.positionId)
        );
        return rid || currentUserId || null;
    }, [reviewers, currentUserId, currentUserProfile?.positionId]);

    const canApproveFromCommentBox = useMemo(() => {
        if (document?.status !== 'IN_REVIEW') return false;
        if (!(isApprover || isAdmin)) return false;
        if (!approveKeyForCurrentUser) return false;
        return document?.approvalStatus?.[approveKeyForCurrentUser]?.status !== 'APPROVED';
    }, [document?.status, document?.approvalStatus, isApprover, isAdmin, approveKeyForCurrentUser]);

    return {
        isOwner,
        isAdmin,
        isApprover,
        approveKeyForCurrentUser,
        canApproveFromCommentBox,
    };
}
