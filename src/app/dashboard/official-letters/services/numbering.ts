import { Firestore, runTransaction } from 'firebase/firestore';
import { tenantDoc } from '@/firebase/tenant-helpers';
import { OfficialLetterNumberingConfig } from '../types';

const DEFAULT_CONFIG: OfficialLetterNumberingConfig = {
    prefix: 'АБ',
    digitCount: 4,
    nextNumber: 1,
    resetPeriod: 'yearly',
};

function shouldReset(config: OfficialLetterNumberingConfig): boolean {
    const now = new Date();
    if (config.resetPeriod === 'yearly') return config.lastNumberYear !== now.getFullYear();
    if (config.resetPeriod === 'monthly') return config.lastNumberYear !== now.getFullYear() || config.lastNumberMonth !== now.getMonth() + 1;
    return false;
}

function buildNumber(prefix: string, digitCount: number, seq: number, year: number): string {
    return `${prefix}-${year}-${String(seq).padStart(digitCount, '0')}`;
}

export async function getNextOfficialLetterNumber(
    firestore: Firestore,
    companyPath: string | null,
): Promise<string> {
    if (!companyPath) throw new Error('companyPath байхгүй');
    const configRef = tenantDoc(firestore, companyPath, 'official_letter_config', 'main');

    return runTransaction(firestore, async (tx) => {
        const snap = await tx.get(configRef);
        const cfg: OfficialLetterNumberingConfig = snap.exists()
            ? (snap.data() as OfficialLetterNumberingConfig)
            : DEFAULT_CONFIG;

        const now = new Date();
        const year = now.getFullYear();
        const reset = shouldReset(cfg);
        const seq = reset ? 1 : (cfg.nextNumber || 1);

        tx.set(configRef, {
            ...cfg,
            nextNumber: seq + 1,
            lastNumberYear: year,
            lastNumberMonth: now.getMonth() + 1,
        }, { merge: true });

        return buildNumber(cfg.prefix || 'АБ', cfg.digitCount || 4, seq, year);
    });
}
