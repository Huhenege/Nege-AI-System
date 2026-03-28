// official-letters/types.ts
import { Timestamp } from 'firebase/firestore';

export type OfficialLetterStatus = 'DRAFT' | 'SENT' | 'ARCHIVED';

export type PaperSize = 'A4' | 'A5';
export type Orientation = 'portrait' | 'landscape';
export type FontFamily = 'Arial' | 'Times New Roman';

export interface OfficialLetterConfig {
    // Байгууллага
    orgName: string;
    orgLogo: string | null;
    orgTagline: string;
    address: string;
    phone: string;
    email: string;
    web: string;
    // Баримт мэдээлэл
    docIndex: string;
    docDate: string;
    docCity: string;
    tanaiRef: string;
    tanaiNo: string;
    // Хүлээн авагч
    addresseeName: string;
    addresseeOrg: string;
    // Агуулга
    subject: string;
    content: string;
    // Гарын үсэг
    signPosition: string;
    signName: string;
    // Формат
    paperSize: PaperSize;
    orientation: Orientation;
    fontFamily: FontFamily;
}

export interface OfficialLetter {
    id: string;
    letterNumber?: string;
    status: OfficialLetterStatus;
    config: OfficialLetterConfig;
    templateId?: string;
    sentTo?: string;
    sentAt?: Timestamp;
    createdBy: string;
    createdAt: Timestamp;
    updatedAt: Timestamp;
}

export interface OfficialLetterTemplate {
    id: string;
    name: string;
    config: Partial<OfficialLetterConfig>;
    isSystem?: boolean;
    createdBy: string;
    createdAt: Timestamp;
    updatedAt?: Timestamp;
}

export interface OfficialLetterNumberingConfig {
    prefix: string;
    digitCount: number;
    nextNumber: number;
    resetPeriod: 'yearly' | 'monthly' | 'never';
    lastNumberYear?: number;
    lastNumberMonth?: number;
}

export const STATUS_LABELS: Record<OfficialLetterStatus, string> = {
    DRAFT: 'Ноорог',
    SENT: 'Илгээсэн',
    ARCHIVED: 'Архивлагдсан',
};

export const STATUS_COLORS: Record<OfficialLetterStatus, string> = {
    DRAFT: 'bg-slate-100 text-slate-700',
    SENT: 'bg-emerald-100 text-emerald-700',
    ARCHIVED: 'bg-gray-100 text-gray-600',
};

export const DEFAULT_CONFIG: OfficialLetterConfig = {
    orgName: 'БАЙГУУЛЛАГЫН НЭР',
    orgLogo: null,
    orgTagline: 'БАЙГУУЛЛАГЫН ҮЙЛ АЖИЛЛАГААНЫ ЧИГЛЭЛ',
    address: 'Улаанбаатар хот, Сүхбаатар дүүрэг, 1-р хороо',
    phone: '7700-0000',
    email: 'info@organization.mn',
    web: 'www.organization.mn',
    docIndex: '',
    docDate: new Date().toISOString().split('T')[0],
    docCity: 'Улаанбаатар хот',
    tanaiRef: '',
    tanaiNo: '',
    addresseeName: 'АЛБАН ТУШААЛТАН ТАНАА',
    addresseeOrg: 'ИЛГЭЭН БАЙГУУЛЛАГА',
    subject: '',
    content: '',
    signPosition: 'Захирал',
    signName: '',
    paperSize: 'A4',
    orientation: 'portrait',
    fontFamily: 'Times New Roman',
};
