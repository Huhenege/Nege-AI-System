import { ActionType, DocumentStatus, StatusConfig, DOCUMENT_STATUSES } from './types';
import { Timestamp, collection, getDocs } from 'firebase/firestore';
import { format } from 'date-fns';
import { mn } from 'date-fns/locale';
import { ALL_DYNAMIC_FIELDS } from './data/field-dictionary';

export function getStatusConfig(status: DocumentStatus) {
    return DOCUMENT_STATUSES[status] || { label: status, color: 'bg-gray-100 text-gray-700' };
}

export function formatActionType(action: ActionType): string {
    const map: Record<ActionType, string> = {
        'CREATE': 'Үүсгэсэн',
        'UPDATE': 'Зассан',
        'REVIEW': 'Хянасан',
        'APPROVE': 'Зөвшөөрсөн',
        'SIGN': 'Гарын үсэг зурсан',
        'ARCHIVE': 'Архивласан',
        'REJECT': 'Татгалзсан'
    };
    return map[action] || action;
}

export function formatDateTime(date: any): string {
    if (!date) return '-';
    // Handle Firestore Timestamp
    const d = date.toDate ? date.toDate() : new Date(date);
    return format(d, 'yyyy-MM-dd HH:mm', { locale: mn });
}

/**
 * Баримтын дугаар үүсгэх
 * Формат: PREFIX-YYYY-NNNN (жнь: ГЭР-2026-0001)
 * 
 * @param prefix - Баримтын төрлийн үсгэн код (жнь: "ГЭР", "ТШЛ")
 * @param year - Он (жнь: 2026)
 * @param sequence - Дэс дугаар (жнь: 1)
 * @returns Форматлагдсан дугаар (жнь: "ГЭР-2026-0001")
 */
export function generateDocCode(prefix: string, year: number, sequence: number): string {
    return `${prefix}-${year}-${String(sequence).padStart(4, '0')}`;
}

/**
 * Баримтын дугаараас мэдээлэл задлах
 * @param docCode - Баримтын дугаар (жнь: "ГЭР-2026-0001")
 * @returns { prefix, year, sequence } эсвэл null
 */
export function parseDocCode(docCode: string): { prefix: string; year: number; sequence: number } | null {
    const match = docCode.match(/^([А-ЯӨҮа-яөү]+)-(\d{4})-(\d+)$/);
    if (!match) return null;
    return {
        prefix: match[1],
        year: parseInt(match[2], 10),
        sequence: parseInt(match[3], 10)
    };
}


// Helper to resolve deep paths like "position.compensation.salaryRange.min"
function resolvePath(obj: any, path: string): any {
    return path.split('.').reduce((prev, curr) => {
        return prev ? prev[curr] : undefined;
    }, obj);
}

export function getReplacementMap(data: {
    employee?: any,
    position?: any,
    department?: any,
    questionnaire?: any,
    system?: any,
    company?: any,
    appointment?: any,
    customInputs?: Record<string, any>
}): Record<string, string> {
    const map: Record<string, string> = {};

    // ── Virtual / computed field-үүд ────────────────────────────────────────
    // employee.fullName — Firestore-д байхгүй, firstName+lastName-с тооцно
    const emp = data.employee || {};
    const computedEmployee = {
        ...emp,
        fullName: [emp.lastName, emp.firstName].filter(Boolean).join(' ') || emp.fullName || '',
    };

    // company — компанийн profile field нэрийг normalize хийнэ
    // Firestore-д contactEmail/email, phoneNumber/phone гэж хос байж болно
    const cp = data.company || {};
    const computedCompany = {
        ...cp,
        email: cp.email || cp.contactEmail || '',
        phone: cp.phone || cp.phoneNumber || '',
        legalName: cp.legalName || cp.name || '',
        ceo: cp.ceo || cp.directorName || cp.directorFullName || '',
        registrationNumber: cp.registrationNumber || cp.regNumber || '',
        taxId: cp.taxId || cp.taxNumber || '',
        website: cp.website || cp.websiteUrl || '',
        address: cp.address || cp.fullAddress || '',
        industry: cp.industry || cp.industryName || '',
        mission: cp.mission || '',
        vision: cp.vision || '',
        introduction: cp.introduction || cp.description || '',
        logoUrl: cp.logoUrl || '',
        establishedDate: cp.establishedDate || cp.foundedDate || '',
    };

    ALL_DYNAMIC_FIELDS.forEach(field => {
        const context = {
            company: computedCompany,
            employee: computedEmployee,
            position: data.position,
            department: data.department,
            questionnaire: data.questionnaire,
            system: data.system,
            appointment: data.appointment,
        };

        const rawValue = resolvePath(context, field.path);

        let formattedValue = '________________'; // Default placeholder

        if (rawValue !== undefined && rawValue !== null && rawValue !== '') {
            if (typeof rawValue === 'number') {
                // Formatting for salary/money if key contains salary or min/max
                if (field.key.includes('salary') || field.key.includes('Amount')) {
                    formattedValue = new Intl.NumberFormat('mn-MN').format(rawValue);
                } else {
                    formattedValue = String(rawValue);
                }
            } else {
                formattedValue = String(rawValue);
            }
        }

        map[field.key] = formattedValue;
    });

    // Add custom inputs to the map
    if (data.customInputs) {
        Object.entries(data.customInputs).forEach(([key, value]) => {
            const valStr = value !== undefined && value !== null && value !== '' ? String(value) : '________________';
            map[`{{${key}}}`] = valStr;
            map[`{{custom.${key}}}`] = valStr; // Handle the custom. prefix as well
        });
    }

    return map;
}

export function generateDocumentContent(
    templateContent: string,
    data: Parameters<typeof getReplacementMap>[0]
): string {
    const replacements = getReplacementMap(data);

    // Use a regex to find any sequence of 2+ curly braces wrapping a key
    // This allows us to replace {{{key}}} or {{{{key}}}} entirely with the value,
    // solving the 'extra braces' issue reported by users.
    return (templateContent || '').replace(/{{+([^{}]+)}+/g, (match, inner) => {
        const key = inner.trim();
        // Check if {{key}} exists in our replacement map
        const lookup = `{{${key}}}`;
        if (replacements[lookup] !== undefined) {
            return replacements[lookup];
        }
        return match; // Return original text if no replacement found
    });
}
