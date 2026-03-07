import { Firestore, doc, getDoc, runTransaction } from 'firebase/firestore';
import { tenantDoc } from '@/firebase/tenant-helpers';
import { ERDocumentType, NumberingConfig } from '../types';

const DEFAULT_NUMBERING_CONFIG: NumberingConfig = {
    includePrefix: true,
    includeYear: true,
    includeMonth: false,
    includeDay: false,
    separator: '-',
    numberPadding: 4,
    startNumber: 1,
    resetPeriod: 'yearly',
};

/**
 * Дугаарлалтын тохиргоогоор дугаар үүсгэх
 */
function generateDocumentNumber(
    prefix: string,
    config: NumberingConfig,
    sequence: number,
    date: Date = new Date()
): string {
    const parts: string[] = [];
    const sep = config.separator || '-';
    
    if (config.includePrefix && prefix) {
        parts.push(prefix);
    }
    
    if (config.includeYear) {
        parts.push(date.getFullYear().toString());
    }
    
    if (config.includeMonth) {
        parts.push(String(date.getMonth() + 1).padStart(2, '0'));
    }
    
    if (config.includeDay) {
        parts.push(String(date.getDate()).padStart(2, '0'));
    }
    
    const padding = config.numberPadding || 4;
    parts.push(String(sequence).padStart(padding, '0'));
    
    return parts.join(sep);
}

/**
 * Дугаар шинэчлэгдэх эсэхийг шалгах
 */
function shouldResetCounter(
    config: NumberingConfig,
    lastYear?: number,
    lastMonth?: number,
    lastDay?: number
): boolean {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const currentDay = now.getDate();
    
    switch (config.resetPeriod) {
        case 'yearly':
            return lastYear !== currentYear;
        case 'monthly':
            return lastYear !== currentYear || lastMonth !== currentMonth;
        case 'daily':
            return lastYear !== currentYear || lastMonth !== currentMonth || lastDay !== currentDay;
        case 'never':
        default:
            return false;
    }
}

/**
 * Дараагийн баримтын дугаарыг авах (атомик үйлдэл)
 * Firestore transaction ашиглан дугаарыг өгөх ба counter-ийг шинэчлэх
 * 
 * @param firestore - Firestore instance
 * @param documentTypeId - Баримтын төрлийн ID
 * @returns Шинэ баримтын дугаар (жнь: "ГЭР-2026-0001")
 */
export async function getNextDocumentNumber(
    firestore: Firestore,
    documentTypeId: string,
    companyPath: string | null = null
): Promise<string> {
    const docTypeRef = tenantDoc(firestore, companyPath, 'er_process_document_types', documentTypeId);
    
    return await runTransaction(firestore, async (transaction) => {
        const docTypeSnap = await transaction.get(docTypeRef);
        
        if (!docTypeSnap.exists()) {
            throw new Error('Баримтын төрөл олдсонгүй');
        }
        
        const docTypeData = docTypeSnap.data() as ERDocumentType;
        const config = docTypeData.numberingConfig || DEFAULT_NUMBERING_CONFIG;
        
        if (config.includePrefix && !docTypeData.prefix) {
            throw new Error('Баримтын төрлийн үсгэн код (prefix) тохируулаагүй байна');
        }
        
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth() + 1;
        const currentDay = now.getDate();
        
        // Дугаар шинэчлэгдэх эсэхийг шалгах
        const shouldReset = shouldResetCounter(
            config,
            docTypeData.lastNumberYear,
            docTypeData.lastNumberMonth,
            docTypeData.lastNumberDay
        );
        
        let nextNumber: number;
        if (shouldReset) {
            nextNumber = config.startNumber || 1;
        } else {
            nextNumber = (docTypeData.currentNumber || 0) + 1;
            // Хэрэв currentNumber нь startNumber-ээс бага бол startNumber ашиглах
            if (nextNumber < (config.startNumber || 1)) {
                nextNumber = config.startNumber || 1;
            }
        }
        
        // Counter-ийг шинэчлэх
        transaction.update(docTypeRef, {
            currentNumber: nextNumber,
            lastNumberYear: currentYear,
            lastNumberMonth: currentMonth,
            lastNumberDay: currentDay,
            updatedAt: new Date()
        });
        
        // Дугаар үүсгэх
        return generateDocumentNumber(docTypeData.prefix, config, nextNumber, now);
    });
}

/**
 * Баримтын төрлийн мэдээлэл авах
 * 
 * @param firestore - Firestore instance
 * @param documentTypeId - Баримтын төрлийн ID
 * @returns ERDocumentType эсвэл null
 */
export async function getDocumentType(
    firestore: Firestore,
    documentTypeId: string,
    companyPath: string | null = null
): Promise<ERDocumentType | null> {
    const docTypeRef = tenantDoc(firestore, companyPath, 'er_process_document_types', documentTypeId);
    const docTypeSnap = await getDoc(docTypeRef);
    
    if (!docTypeSnap.exists()) {
        return null;
    }
    
    return { id: docTypeSnap.id, ...docTypeSnap.data() } as ERDocumentType;
}

/**
 * Дараагийн дугаарыг урьдчилан харах (counter-ийг өөрчлөхгүй)
 * 
 * @param firestore - Firestore instance
 * @param documentTypeId - Баримтын төрлийн ID
 * @returns Дараагийн дугаар (жнь: "ГЭР-2026-0002") эсвэл null
 */
export async function previewNextDocumentNumber(
    firestore: Firestore,
    documentTypeId: string
): Promise<string | null> {
    const docType = await getDocumentType(firestore, documentTypeId);
    
    if (!docType) {
        return null;
    }
    
    const config = docType.numberingConfig || DEFAULT_NUMBERING_CONFIG;
    
    if (config.includePrefix && !docType.prefix) {
        return null;
    }
    
    const now = new Date();
    
    // Дугаар шинэчлэгдэх эсэхийг шалгах
    const shouldReset = shouldResetCounter(
        config,
        docType.lastNumberYear,
        docType.lastNumberMonth,
        docType.lastNumberDay
    );
    
    let nextNumber: number;
    if (shouldReset) {
        nextNumber = config.startNumber || 1;
    } else {
        nextNumber = (docType.currentNumber || 0) + 1;
        if (nextNumber < (config.startNumber || 1)) {
            nextNumber = config.startNumber || 1;
        }
    }
    
    return generateDocumentNumber(docType.prefix, config, nextNumber, now);
}
