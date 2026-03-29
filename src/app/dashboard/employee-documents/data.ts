// ─── Employee Documents — shared types ───────────────────────────────────────

export type DocumentCategory =
    | 'Хөдөлмөрийн гэрээ'
    | 'Дотоод журам'
    | 'Ажилтны гарын авлага'
    | 'Маягт'
    | 'Бусад';

export type Document = {
    id: string;
    title: string;
    description: string;
    url: string;
    fileSize?: number;       // bytes — populated on upload
    mimeType?: string;       // e.g. "application/pdf"
    uploadDate: string;      // ISO date string
    uploadedBy?: string;     // uid of the uploader
    documentType: DocumentCategory;
    assignedEmployeeId?: string | null;
    metadata?: Record<string, unknown>;
};
