
import {
    collection,
    doc,
    runTransaction,
    serverTimestamp,
    Timestamp,
    query,
    where,
    getDocs,
    orderBy,
    limit,
    Firestore,
    addDoc,
    updateDoc,
    getDoc,
    setDoc
} from 'firebase/firestore';
import { RecognitionPost, PointTransaction, UserPointProfile, Reward, RedemptionRequest, PointsConfig, BudgetPointRequest, BudgetRequestStatus } from '@/types/points';
import { Position } from '@/app/dashboard/organization/types';

export class PointsService {

    /**
     * Submits a request to distribute points from a position's budget.
     */
    static async requestBudgetPoints(
        db: Firestore,
        companyPath: string,
        fromUserId: string,
        positionId: string,
        toUserIds: string[],
        amount: number,
        valueId: string,
        message: string
    ) {
        if (!fromUserId || !positionId || toUserIds.length === 0 || amount <= 0) {
            throw new Error('Invalid budget request data');
        }

        const requestRef = doc(collection(db, `${companyPath}/budget_point_requests`));
        const request: Partial<BudgetPointRequest> = {
            id: requestRef.id,
            fromUserId,
            positionId,
            toUserIds,
            amount,
            valueId,
            message,
            status: 'PENDING',
            createdAt: serverTimestamp()
        };

        await setDoc(requestRef, request);
        return requestRef.id;
    }

    /**
     * Admin approves a budget point request.
     * Deducts from Position budget, distributes points, and creates post.
     */
    static async approveBudgetRequest(
        db: Firestore,
        companyPath: string,
        requestId: string,
        adjustedAmount?: number,
        adminNote?: string
    ) {
        try {
            await runTransaction(db, async (transaction) => {
                // 1. Read Request
                const requestRef = doc(db, `${companyPath}/budget_point_requests`, requestId);
                const requestSnap = await transaction.get(requestRef);
                if (!requestSnap.exists()) throw new Error('Request not found');

                const request = requestSnap.data() as BudgetPointRequest;
                if (request.status !== 'PENDING') throw new Error('Request is already processed');

                const finalAmount = adjustedAmount !== undefined ? adjustedAmount : request.amount;
                const totalPointsToDistribute = finalAmount * request.toUserIds.length;

                // 2. Read Position
                const positionRef = doc(db, `${companyPath}/positions`, request.positionId);
                const positionSnap = await transaction.get(positionRef);
                if (!positionSnap.exists()) throw new Error('Position not found');

                const positionData = positionSnap.data() as Position;
                if (!positionData.hasPointBudget) throw new Error('This position does not have a budget');

                const remaining = positionData.remainingPointBudget ?? positionData.yearlyPointBudget ?? 0;
                if (remaining < totalPointsToDistribute) {
                    throw new Error(`Хангалттай төсөв байхгүй байна. (Үлдэгдэл: ${remaining})`);
                }

                // 3. Read Receivers
                const receiverSnaps = await Promise.all(
                    request.toUserIds.map(id => transaction.get(doc(db, `${companyPath}/employees`, id, 'point_profile', 'main')))
                );

                // 4. Update Position Budget
                transaction.update(positionRef, {
                    remainingPointBudget: remaining - totalPointsToDistribute
                });

                // 5. Create Recognition Post
                const postRef = doc(collection(db, `${companyPath}/recognition_posts`));
                transaction.set(postRef, {
                    id: postRef.id,
                    fromUserId: request.fromUserId,
                    toUserId: request.toUserIds,
                    pointAmount: finalAmount,
                    valueId: request.valueId,
                    message: request.message,
                    createdAt: serverTimestamp(),
                    commentCount: 0,
                    reactions: {},
                    visibility: 'PUBLIC'
                });

                // 6. Update Receivers & Transactions
                receiverSnaps.forEach((snap, idx) => {
                    const toId = request.toUserIds[idx];
                    const receiverRef = doc(db, `${companyPath}/employees`, toId, 'point_profile', 'main');

                    if (!snap.exists()) {
                        transaction.set(receiverRef, {
                            userId: toId,
                            balance: finalAmount,
                            monthlyAllowance: 0,
                            totalEarned: finalAmount,
                            totalGiven: 0,
                            lastAllowanceResetMonth: new Date().toISOString().slice(0, 7)
                        });
                    } else {
                        const rData = snap.data() as UserPointProfile;
                        transaction.update(receiverRef, {
                            balance: (rData.balance || 0) + finalAmount,
                            totalEarned: (rData.totalEarned || 0) + finalAmount
                        });
                    }

                    const transRef = doc(collection(db, `${companyPath}/point_transactions`));
                    transaction.set(transRef, {
                        userId: toId,
                        amount: finalAmount,
                        type: 'RECEIVED',
                        refId: postRef.id,
                        fromUserId: request.fromUserId,
                        createdAt: serverTimestamp()
                    });
                });

                // 7. Update Request Status
                transaction.update(requestRef, {
                    status: 'APPROVED',
                    adjustedAmount: finalAmount,
                    adminNote,
                    approvedAt: serverTimestamp()
                });
            });
            return true;
        } catch (e) {
            console.error('[PointsService] approveBudgetRequest Failed:', e);
            throw e;
        }
    }

    /**
     * Admin rejects a budget point request.
     */
    static async rejectBudgetRequest(db: Firestore, companyPath: string, requestId: string, adminNote?: string) {
        const requestRef = doc(db, `${companyPath}/budget_point_requests`, requestId);
        await updateDoc(requestRef, {
            status: 'REJECTED',
            adminNote,
            processedAt: serverTimestamp()
        });
    }


    /**
     * Sends points from one user to another (Recognition).
     * Uses a transaction to ensure integrity of balance and allowance.
     */
    static async sendRecognition(
        db: Firestore,
        companyPath: string,
        fromUserId: string,
        toUserIds: string[],
        amountPerPerson: number,
        valueId: string,
        message: string,
        visibility: 'PUBLIC' | 'TEAM' | 'PRIVATE' = 'PUBLIC'
    ) {
        const totalPointsNeeded = amountPerPerson * toUserIds.length;
        const currentMonth = new Date().toISOString().slice(0, 7);

        console.log('[PointsService] sendRecognition Request:', { fromUserId, toUserIds, amount: amountPerPerson });

        try {
            await runTransaction(db, async (transaction) => {
                // --- PHASE 1: ALL READS ---

                // 1. Read Config
                const configRef = doc(db, `${companyPath}/points_config`, 'main');
                const configSnap = await transaction.get(configRef);
                const baseAllowance = configSnap.exists()
                    ? (configSnap.data() as PointsConfig).monthlyAllowanceBase
                    : 1000;

                // 2. Read Sender
                const senderRef = doc(db, `${companyPath}/employees`, fromUserId, 'point_profile', 'main');
                const senderSnap = await transaction.get(senderRef);

                // 3. Read Receivers
                const receiverSnaps = await Promise.all(
                    toUserIds.map(id => transaction.get(doc(db, `${companyPath}/employees`, id, 'point_profile', 'main')))
                );

                // --- PHASE 2: CALCULATIONS & PREPARATION ---

                // Prepare Sender Data
                let senderData: UserPointProfile;
                const senderExists = senderSnap.exists();

                if (!senderExists) {
                    senderData = {
                        userId: fromUserId,
                        balance: 0,
                        monthlyAllowance: baseAllowance,
                        totalEarned: 0,
                        totalGiven: 0,
                        lastAllowanceResetMonth: currentMonth
                    };
                } else {
                    senderData = senderSnap.data() as UserPointProfile;
                    if (senderData.lastAllowanceResetMonth !== currentMonth) {
                        senderData.monthlyAllowance = baseAllowance;
                        senderData.lastAllowanceResetMonth = currentMonth;
                    }
                }

                if (senderData.monthlyAllowance < totalPointsNeeded) {
                    throw new Error(`Хангалттай оноо байхгүй байна. (Үлдэгдэл: ${senderData.monthlyAllowance})`);
                }

                // --- PHASE 3: ALL WRITES ---

                // 1. Update/Set Sender
                if (!senderExists) {
                    transaction.set(senderRef, {
                        ...senderData,
                        monthlyAllowance: senderData.monthlyAllowance - totalPointsNeeded,
                        totalGiven: totalPointsNeeded
                    });
                } else {
                    transaction.update(senderRef, {
                        monthlyAllowance: senderData.monthlyAllowance - totalPointsNeeded,
                        totalGiven: (senderData.totalGiven || 0) + totalPointsNeeded,
                        lastAllowanceResetMonth: senderData.lastAllowanceResetMonth
                    });
                }

                // 2. Create Recognition Post
                const postRef = doc(collection(db, `${companyPath}/recognition_posts`));
                transaction.set(postRef, {
                    id: postRef.id,
                    fromUserId,
                    toUserId: toUserIds,
                    pointAmount: amountPerPerson,
                    valueId,
                    message,
                    createdAt: serverTimestamp(),
                    commentCount: 0,
                    reactions: {},
                    visibility
                });

                // 3. Update/Set Receivers & Transactions
                receiverSnaps.forEach((snap, idx) => {
                    const toId = toUserIds[idx];
                    const receiverRef = doc(db, `${companyPath}/employees`, toId, 'point_profile', 'main');

                    if (!snap.exists()) {
                        transaction.set(receiverRef, {
                            userId: toId,
                            balance: amountPerPerson,
                            monthlyAllowance: baseAllowance,
                            totalEarned: amountPerPerson,
                            totalGiven: 0,
                            lastAllowanceResetMonth: currentMonth
                        });
                    } else {
                        const rData = snap.data() as UserPointProfile;
                        transaction.update(receiverRef, {
                            balance: (rData.balance || 0) + amountPerPerson,
                            totalEarned: (rData.totalEarned || 0) + amountPerPerson
                        });
                    }

                    const transRef = doc(collection(db, `${companyPath}/point_transactions`));
                    transaction.set(transRef, {
                        userId: toId,
                        amount: amountPerPerson,
                        type: 'RECEIVED',
                        refId: postRef.id,
                        fromUserId,
                        toUserIds,      // Хамт хүлээн авсан бусад хүмүүс
                        valueId,        // Ямар үнэт зүйлээр
                        createdAt: serverTimestamp()
                    });
                });

                // 4. Record Sender's Transaction
                const senderTxRef = doc(collection(db, `${companyPath}/point_transactions`));
                transaction.set(senderTxRef, {
                    userId: fromUserId,
                    amount: -totalPointsNeeded,
                    type: 'GIVEN',
                    refId: postRef.id,
                    toUserIds,          // Хэнд оноо өгсөн
                    amountPerPerson,    // Хүн бүрт хэдэн оноо
                    createdAt: serverTimestamp()
                });
            });

            return true;
        } catch (e: any) {
            console.error('[PointsService] sendRecognition Failed:', e);
            throw e;
        }
    }

    /**
     * Redeems a reward using points.
     */
    static async redeemReward(db: Firestore, companyPath: string, userId: string, reward: Reward) {
        if (!userId || !reward || !reward.id) throw new Error('Invalid reward data');

        try {
            await runTransaction(db, async (transaction) => {
                const userRef = doc(db, `${companyPath}/employees`, userId, 'point_profile', 'main');
                const userDoc = await transaction.get(userRef);

                if (!userDoc.exists()) throw new Error('Хэрэглэгчийн пойнт профайл олдсонгүй');

                const userData = userDoc.data() as UserPointProfile;
                if (userData.balance < reward.cost) {
                    throw new Error('Уучлаарай, таны оноо хүрэлцэхгүй байна');
                }

                // 1. Deduct balance
                transaction.update(userRef, {
                    balance: userData.balance - reward.cost
                });

                // 2. Create Redemption Request
                const requestRef = doc(collection(db, `${companyPath}/redemption_requests`));
                const request: any = {
                    id: requestRef.id,
                    userId,
                    rewardId: reward.id,
                    rewardSnapshot: {
                        title: reward.title,
                        cost: reward.cost
                    },
                    status: 'PENDING',
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp()
                };
                transaction.set(requestRef, request);

                // 3. Create Transaction Statement
                const txRef = doc(collection(db, `${companyPath}/point_transactions`));
                const tx: any = {
                    userId,
                    amount: -reward.cost,
                    type: 'REDEEMED',
                    refId: requestRef.id,
                    description: `${reward.title} худалдан авалт`,
                    createdAt: serverTimestamp()
                };
                transaction.set(txRef, tx);
            });
            return true;
        } catch (e) {
            console.error('Redeem failed:', e);
            throw e;
        }
    }

    /**
     * Checks if the user's monthly allowance needs to be reset (e.g., at the start of a new month).
     */
    static async checkAndResetAllowance(db: Firestore, companyPath: string, userId: string) {
        if (!userId) return;

        const currentMonth = new Date().toISOString().slice(0, 7); // Format: "YYYY-MM"
        const profileRef = doc(db, `${companyPath}/employees`, userId, 'point_profile', 'main');

        try {
            const profileSnap = await getDoc(profileRef);
            const configRef = doc(db, `${companyPath}/points_config`, 'main');
            const configSnap = await getDoc(configRef);

            const baseAllowance = configSnap.exists()
                ? (configSnap.data() as PointsConfig).monthlyAllowanceBase
                : 1000; // Default fallback

            if (!profileSnap.exists()) {
                await updateDoc(profileRef, {
                    userId,
                    balance: 0,
                    monthlyAllowance: baseAllowance,
                    lastAllowanceResetMonth: currentMonth,
                    totalEarned: 0,
                    totalGiven: 0
                }).catch(async () => {
                    const { setDoc } = await import('firebase/firestore');
                    await setDoc(profileRef, {
                        userId,
                        balance: 0,
                        monthlyAllowance: baseAllowance,
                        lastAllowanceResetMonth: currentMonth,
                        totalEarned: 0,
                        totalGiven: 0
                    });
                });
                return;
            }

            const profile = profileSnap.data() as UserPointProfile;

            if (profile.lastAllowanceResetMonth !== currentMonth) {
                await updateDoc(profileRef, {
                    monthlyAllowance: baseAllowance,
                    lastAllowanceResetMonth: currentMonth
                });
                console.log(`Allowance reset for user ${userId} to ${baseAllowance}`);
            }
        } catch (error) {
            console.error('Error in checkAndResetAllowance:', error);
        }
    }

    /**
     * Fetches the main recognition feed.
     */
    static async getFeed(db: Firestore, companyPath: string, limitCount = 20) {
        const q = query(
            collection(db, `${companyPath}/recognition_posts`),
            orderBy('createdAt', 'desc'),
            limit(limitCount)
        );
        return getDocs(q);
    }
}
