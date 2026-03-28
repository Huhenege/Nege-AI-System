export interface CoreValue {
    id: string;
    title: string;
    description: string;
    emoji?: string;
    color?: string; // Hex color for branding alignment
    isActive: boolean;
    createdAt: string; // ISO String
}

export type PointTransactionType = 'RECEIVED' | 'GIVEN' | 'REDEEMED' | 'ADJUSTMENT' | 'PENALTY';

export interface PointTransaction {
    id: string;
    userId: string; // User ID whose balance is affected
    amount: number; // Positive or negative
    type: PointTransactionType;
    refId: string; // ID of the Post or Reward request
    projectId?: string; // Project ID (for project-based point distributions)
    createdAt: string;
    description?: string; // Optional context
    // Recognition-specific fields
    fromUserId?: string;    // RECEIVED: хэнээс авсан
    toUserIds?: string[];   // GIVEN: хэнд өгсөн; RECEIVED: хамт хүлээн авсан
    amountPerPerson?: number; // GIVEN: хүн бүрт хэдэн оноо
    valueId?: string;       // Холбогдох үнэт зүйл
}

export interface RecognitionPost {
    id: string;
    fromUserId: string;
    toUserId: string[]; // Can recognize multiple people
    pointAmount: number; // Total points distributed
    valueId: string; // Linked Core Value
    message: string;
    createdAt: any; // Timestamp or ISO string
    reactions: Record<string, 'like' | 'love' | 'care'>; // { [userId]: 'like' | 'love' | 'care' }
    commentCount: number;
    visibility: 'PUBLIC' | 'TEAM' | 'PRIVATE';
}

export interface UserPointProfile {
    userId: string;
    balance: number; // Spendable points (Wallet)
    monthlyAllowance: number; // Points available to GIVE this month
    lastAllowanceResetMonth?: string; // Format: "YYYY-MM" to track resets
    totalEarned: number; // Lifetime earned metrics
    totalGiven: number; // Lifetime given metrics
}

export interface PointsConfig {
    /** Тохиргоо хамаарах жил */
    year: number;
    /** Сар бүрийн бэлэглэх оноо (ажилчин бүрт) */
    monthlyAllowanceBase: number;
    /** Нийт төсөлийн гүйцэтгэлд олгох жилийн оноо */
    projectPointsBudget: number;
    /** Оноо зарцуулах эрхтэй удирдлагын нийт жилийн төсөв */
    managerBudgetTotal: number;
    /** 1 оноо = хэдэн төгрөг */
    pointToMNT: number;
    /** Системээс авто тооцоолсон: Нийт жилийн төсөв */
    yearlyTotalBudget?: number;
    updatedAt: any;
}

export interface Reward {
    id: string;
    title: string;
    description: string;
    cost: number;
    imageUrl?: string;
    category: string;
    isActive: boolean;
    stock?: number; // Optional inventory tracking
}

export type RedemptionStatus = 'PENDING' | 'APPROVED' | 'FULFILLED' | 'REJECTED';

export interface RedemptionRequest {
    id: string;
    userId: string;
    rewardId: string;
    rewardSnapshot: { // Store snapshot in case reward changes later
        title: string;
        cost: number;
    };
    status: RedemptionStatus;
    createdAt: string;
    updatedAt: string;
    note?: string; // Admin note
}

export type BudgetRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface BudgetPointRequest {
    id: string;
    fromUserId: string;
    positionId: string;
    toUserIds: string[];
    amount: number;
    adjustedAmount?: number;
    valueId: string;
    message: string;
    status: BudgetRequestStatus;
    adminNote?: string;
    createdAt: any;
    approvedAt?: any;
}

