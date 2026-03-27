export interface MeetingRoom {
    id: string;
    name: string;
    capacity: number;
    floor?: string;
    amenities?: string[];
    color: string;
    isActive: boolean;
    createdAt: string;
}

/** @deprecated Use Meeting instead */
export interface RoomBooking {
    id: string;
    roomId: string;
    roomName: string;
    title: string;
    description?: string;
    date: string;
    startTime: string;
    endTime: string;
    organizer: string;
    organizerName: string;
    attendees?: string[];
    status: 'active' | 'cancelled';
    createdAt: string;
}

// ─── Meeting scheduling types ────────────────────────────────────────

export type MeetingType =
    | 'one_on_one'
    | 'team'
    | 'department'
    | 'standup'
    | 'review'
    | 'external'
    | 'other';

export const MEETING_TYPE_LABELS: Record<MeetingType, string> = {
    one_on_one: '1:1 уулзалт',
    team: 'Багийн уулзалт',
    department: 'Алба хорооны уулзалт',
    standup: 'Standup',
    review: 'Тойм уулзалт',
    external: 'Гадны уулзалт',
    other: 'Бусад',
};

export interface MeetingAttendee {
    employeeId: string;
    name: string;
    response: 'pending' | 'accepted' | 'declined' | 'tentative';
    respondedAt?: string;
    isRequired: boolean;
}

export interface Meeting {
    id: string;
    title: string;
    description?: string;
    date: string;
    startTime: string;
    endTime: string;

    organizer: string;
    organizerName: string;
    attendees: MeetingAttendee[];
    attendeeIds: string[];

    roomId?: string;
    roomName?: string;

    type: MeetingType;
    status: 'scheduled' | 'completed' | 'cancelled';
    priority?: 'normal' | 'high';

    meetingLink?: string;
    location?: string;
    agenda?: string;

    createdAt: string;
    updatedAt?: string;
    cancelReason?: string;
    sequence?: number;
}

// ─── Constants ───────────────────────────────────────────────────────

export const ROOM_COLORS = [
    '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316',
    '#eab308', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6',
] as const;

export const DEFAULT_AMENITIES = [
    'Проектор',
    'Цагаан самбар',
    'Видео дуудлага',
    'ТВ дэлгэц',
    'Утасны шугам',
    'Wi-Fi',
] as const;

export const TIME_SLOTS: string[] = [];
for (let h = 8; h <= 20; h++) {
    for (let m = 0; m < 60; m += 30) {
        if (h === 20 && m > 0) break;
        TIME_SLOTS.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    }
}
