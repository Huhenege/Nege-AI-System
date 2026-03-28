'use client';

/**
 * EmployeeCodeBanner
 *
 * Admin-ийн employeeCode байхгүй бол header-ын доор нарийн banner харуулна.
 * Дарахад:
 *   - employeeCodeConfig байгаа → nextNumber-р код олгож banner арилгана
 *   - байхгүй → Settings/employee-code хуудас руу явна
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { runTransaction } from 'firebase/firestore';
import { AlertTriangle, Loader2, Hash } from 'lucide-react';
import { useUser, useFetchDoc, useTenantWrite } from '@/firebase';
import { useTenant } from '@/contexts/tenant-context';
import { generateCode } from '@/lib/code-generator';

interface CodeConfig {
    prefix: string;
    digitCount: number;
    nextNumber: number;
}

interface EmployeeDoc {
    employeeCode?: string;
}

export function EmployeeCodeBanner() {
    const { user } = useUser();
    const { role } = useTenant();
    const { firestore, tDoc } = useTenantWrite();
    const router = useRouter();
    const [assigning, setAssigning] = React.useState(false);
    const [done, setDone] = React.useState(false);

    // tDoc нь tenant-scoped ref үүсгэдэг — firestore instance нэгдмэл байна
    const adminDocRef = React.useMemo(
        () => (firestore && user?.uid ? tDoc('employees', user.uid) : null),
        [firestore, user?.uid, tDoc]
    );
    const { data: adminDoc, isLoading: adminLoading } = useFetchDoc<EmployeeDoc>(adminDocRef as any);

    // Employee code config
    const configRef = React.useMemo(
        () => (firestore ? tDoc('company', 'employeeCodeConfig') : null),
        [firestore, tDoc]
    );
    const { data: codeConfig } = useFetchDoc<CodeConfig>(configRef as any);

    // super_admin эсвэл код аль хэдийн байвал → харуулахгүй
    const shouldShow = React.useMemo(() => {
        if (done) return false;
        if (adminLoading) return false;
        if (role === 'super_admin') return false;
        if (!adminDoc) return false;              // employee doc байхгүй — харуулахгүй
        if (adminDoc.employeeCode) return false;  // код байна — сайн
        return true;
    }, [done, adminLoading, role, adminDoc]);

    const handleAssign = async () => {
        if (!firestore || !user?.uid || assigning) return;

        // Config байхгүй бол → Settings руу явна
        if (!codeConfig) {
            router.push('/dashboard/settings/employee-code');
            return;
        }

        setAssigning(true);
        try {
            const adminRef = tDoc('employees', user.uid);
            const cRef = configRef!;

            await runTransaction(firestore, async (tx) => {
                const configSnap = await tx.get(cRef);
                const adminSnap = await tx.get(adminRef);

                if (!configSnap.exists()) throw new Error('Config байхгүй');

                const config = configSnap.data() as CodeConfig;
                const current = adminSnap.exists() ? adminSnap.data() : null;

                // Аль хэдийн код авсан бол зогсооно
                if (current?.employeeCode) {
                    setDone(true);
                    return;
                }

                const newCode = generateCode({
                    prefix: config.prefix,
                    digitCount: config.digitCount,
                    nextNumber: config.nextNumber,
                });

                // Код олгоно
                if (adminSnap.exists()) {
                    tx.update(adminRef, { employeeCode: newCode });
                } else {
                    tx.set(adminRef, { employeeCode: newCode });
                }

                // nextNumber нэмэгдүүлнэ
                tx.update(cRef, { nextNumber: config.nextNumber + 1 });
            });

            setDone(true);
        } catch (err) {
            console.error('[EmployeeCodeBanner] assign failed:', err);
            // Config байхгүй алдаа → Settings руу явна
            router.push('/dashboard/settings/employee-code');
        } finally {
            setAssigning(false);
        }
    };

    if (!shouldShow) return null;

    const hasConfig = !!codeConfig;

    return (
        <div className="flex-none bg-amber-50 border-b border-amber-200 px-4 py-2">
            <div className="max-w-[1920px] mx-auto flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm text-amber-800">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
                    <span>
                        {hasConfig
                            ? 'Танд ажилтны код олгогдоогүй байна. Доорх товчийг дарж код авна уу.'
                            : 'Ажилтны кодчлолын тохиргоо хийгдээгүй байна.'}
                    </span>
                </div>
                <button
                    type="button"
                    disabled={assigning}
                    onClick={handleAssign}
                    className="flex items-center gap-1.5 shrink-0 text-xs font-semibold px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white transition-colors disabled:opacity-60"
                >
                    {assigning ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                        <Hash className="h-3.5 w-3.5" />
                    )}
                    {hasConfig ? 'Код авах' : 'Тохиргоо хийх'}
                </button>
            </div>
        </div>
    );
}
