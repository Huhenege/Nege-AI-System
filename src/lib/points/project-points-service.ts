import {
    collection,
    doc,
    runTransaction,
    serverTimestamp,
    Firestore,
} from 'firebase/firestore';
import { UserPointProfile } from '@/types/points';
import { Project } from '@/types/project';
import { differenceInCalendarDays, parseISO, format } from 'date-fns';

/**
 * Result of a project point distribution.
 */
export interface ProjectPointDistributionResult {
    success: boolean;
    totalBudget: number;
    actualPoints: number;
    pointsPerMember: number;
    overdueDays: number;
    penaltyPercent: number;
    memberCount: number;
}

/**
 * Calculates the actual points to distribute for a project based on its
 * completion date relative to the deadline.
 *
 * Rules:
 * - On time (completionDate <= endDate): full pointBudget
 * - Overdue: 1% penalty per day overdue
 * - 100+ days overdue: 0 points
 */
export function calculateProjectPoints(
    pointBudget: number,
    endDate: string,
    completionDate: string
): { actualPoints: number; overdueDays: number; penaltyPercent: number } {
    const end = parseISO(endDate);
    const completed = parseISO(completionDate);

    const overdueDays = Math.max(0, differenceInCalendarDays(completed, end));

    if (overdueDays === 0) {
        return { actualPoints: pointBudget, overdueDays: 0, penaltyPercent: 0 };
    }

    if (overdueDays >= 100) {
        return { actualPoints: 0, overdueDays, penaltyPercent: 100 };
    }

    const penaltyPercent = overdueDays; // 1% per day
    const actualPoints = Math.floor(pointBudget * (1 - overdueDays * 0.01));

    return { actualPoints: Math.max(0, actualPoints), overdueDays, penaltyPercent };
}

export class ProjectPointsService {

    /**
     * Distributes project points to all team members when a project is completed.
     *
     * Uses a Firestore transaction to atomically:
     * 1. Read the project to verify it hasn't been distributed yet
     * 2. Read all team members' point profiles
     * 3. Calculate points with overdue penalty
     * 4. Update each member's balance and totalEarned
     * 5. Create a PointTransaction for each member
     * 6. Mark the project as pointsDistributed = true
     */
    static async distributeProjectPoints(
        db: Firestore,
        companyPath: string,
        projectId: string,
        completionDate: string
    ): Promise<ProjectPointDistributionResult> {
        try {
            const result = await runTransaction(db, async (transaction) => {
                // --- PHASE 1: ALL READS ---

                // 1. Read Project
                const projectRef = doc(db, `${companyPath}/projects`, projectId);
                const projectSnap = await transaction.get(projectRef);
                if (!projectSnap.exists()) {
                    throw new Error('Төсөл олдсонгүй');
                }

                const project = { id: projectSnap.id, ...projectSnap.data() } as Project;

                // Guard: already distributed
                if (project.pointsDistributed) {
                    throw new Error('Энэ төслийн оноо аль хэдийн хуваарилагдсан байна');
                }

                // Guard: no point budget
                if (!project.pointBudget || project.pointBudget <= 0) {
                    throw new Error('Энэ төсөлд оноо тохируулаагүй байна');
                }

                // Guard: no team members
                if (!project.teamMemberIds || project.teamMemberIds.length === 0) {
                    throw new Error('Төслийн багийн гишүүд олдсонгүй');
                }

                // 2. Read all team members' point profiles
                const memberIds = project.teamMemberIds;
                const memberProfileSnaps = await Promise.all(
                    memberIds.map(id =>
                        transaction.get(doc(db, `${companyPath}/employees`, id, 'point_profile', 'main'))
                    )
                );

                // --- PHASE 2: CALCULATIONS ---

                const { actualPoints, overdueDays, penaltyPercent } = calculateProjectPoints(
                    project.pointBudget,
                    project.endDate,
                    completionDate
                );

                const pointsPerMember = memberIds.length > 0
                    ? Math.floor(actualPoints / memberIds.length)
                    : 0;

                // --- PHASE 3: ALL WRITES ---

                // 1. Mark project as points distributed
                transaction.update(projectRef, {
                    pointsDistributed: true,
                    completedAt: completionDate,
                    updatedAt: serverTimestamp(),
                });

                // 2. If there are points to distribute, update each member
                if (pointsPerMember > 0) {
                    memberProfileSnaps.forEach((snap, idx) => {
                        const memberId = memberIds[idx];
                        const profileRef = doc(db, `${companyPath}/employees`, memberId, 'point_profile', 'main');

                        if (!snap.exists()) {
                            transaction.set(profileRef, {
                                userId: memberId,
                                balance: pointsPerMember,
                                monthlyAllowance: 0,
                                totalEarned: pointsPerMember,
                                totalGiven: 0,
                                lastAllowanceResetMonth: new Date().toISOString().slice(0, 7),
                            });
                        } else {
                            const profileData = snap.data() as UserPointProfile;
                            transaction.update(profileRef, {
                                balance: (profileData.balance || 0) + pointsPerMember,
                                totalEarned: (profileData.totalEarned || 0) + pointsPerMember,
                            });
                        }

                        const txRef = doc(collection(db, `${companyPath}/point_transactions`));
                        const description = overdueDays > 0
                            ? `"${project.name}" төсөл дууссан (${overdueDays} хоног хоцорсон, ${penaltyPercent}% хасагдсан)`
                            : `"${project.name}" төсөл амжилттай дууссан`;

                        transaction.set(txRef, {
                            userId: memberId,
                            amount: pointsPerMember,
                            type: 'RECEIVED',
                            refId: projectId,
                            projectId: projectId,
                            description,
                            createdAt: serverTimestamp(),
                        });
                    });
                }

                return {
                    success: true,
                    totalBudget: project.pointBudget,
                    actualPoints,
                    pointsPerMember,
                    overdueDays,
                    penaltyPercent,
                    memberCount: memberIds.length,
                } as ProjectPointDistributionResult;
            });

            return result;
        } catch (e: any) {
            console.error('[ProjectPointsService] distributeProjectPoints Failed:', e);
            throw e;
        }
    }
}
