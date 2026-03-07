'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/patterns/page-layout';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { useDoc, useCollection, setDocumentNonBlocking, useMemoFirebase, tenantDoc, tenantCollection, useTenantWrite } from '@/firebase';
import { query, where } from 'firebase/firestore';
import type { Employee } from '@/types';
import { parseISO } from 'date-fns';
import {
    ArrowLeft,
    Calculator,
    Upload,
    FileText,
    Loader2,
    CheckCircle2,
    AlertTriangle,
    Building2,
    CalendarDays,
    TrendingUp,
    FileImage,
    Brain,
    Sparkles,
    Save,
    RefreshCw,
    Database,
    Heart,
    ChevronDown,
    ChevronRight,
    ChevronsUpDown,
} from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

interface NDSHPayment {
    year: number;
    month: number;
    organization: string;
    paid: boolean;
}

interface NDSHParsedData {
    employeeInfo?: {
        lastName?: string;
        firstName?: string;
        registrationNumber?: string;
    };
    payments: NDSHPayment[];
    abnormalMonths?: Record<number, number>; // year -> abnormal months count
    baseVacationDays?: 15 | 20; // 15 for regular, 20 for disabled/under 18
    summary: {
        totalYears: number;
        totalMonths: number;
        hasGaps: boolean;
        gapMonths: string[];
        longestEmployment: {
            organization: string;
            months: number;
        };
    };
}

type ProcessingStep = 'idle' | 'uploading' | 'analyzing' | 'complete' | 'error';

export default function WorkYearsPage() {
    const { id } = useParams();
    const router = useRouter();
    const { toast } = useToast();
    const { firestore, tDoc } = useTenantWrite();
    const employeeId = Array.isArray(id) ? id[0] : id;

    const [file, setFile] = React.useState<File | null>(null);
    const [step, setStep] = React.useState<ProcessingStep>('idle');
    const [progress, setProgress] = React.useState(0);
    const [error, setError] = React.useState<string | null>(null);
    const [parsedData, setParsedData] = React.useState<NDSHParsedData | null>(null);
    const [isSaving, setIsSaving] = React.useState(false);
    const [showUpload, setShowUpload] = React.useState(false);
    const [includeVoluntary, setIncludeVoluntary] = React.useState(true);
    const [expandedYears, setExpandedYears] = React.useState<Set<number>>(new Set());
    const [expandedCompanyYears, setExpandedCompanyYears] = React.useState<Set<number>>(new Set());
    const [abnormalMonths, setAbnormalMonths] = React.useState<Record<number, number>>({});
    const [baseVacationDays, setBaseVacationDays] = React.useState<15 | 20>(15);
    const [isReuploadMode, setIsReuploadMode] = React.useState(false);
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    // Update abnormal months for a year
    const updateAbnormalMonths = (year: number, value: number, maxMonths: number) => {
        const clampedValue = Math.max(0, Math.min(value, maxMonths));
        
        setAbnormalMonths(prev => ({
            ...prev,
            [year]: clampedValue
        }));
    };

    // Calculate total abnormal months
    const totalAbnormalMonths = React.useMemo(() => {
        return Object.values(abnormalMonths).reduce((sum, val) => sum + (val || 0), 0);
    }, [abnormalMonths]);

    // Load saved NDSH data from Firebase
    const ndshDocRef = useMemoFirebase(
        ({ firestore, companyPath }) => (firestore && employeeId ? tenantDoc(firestore, companyPath, `employees/${employeeId}/ndsh`, 'data') : null),
        [employeeId]
    );
    const { data: savedNdshData, isLoading: isLoadingSaved } = useDoc<NDSHParsedData>(ndshDocRef);

    // Employee profile (for appointment/hire date)
    const employeeDocRef = useMemoFirebase(
        ({ firestore, companyPath }) => (firestore && employeeId ? tenantDoc(firestore, companyPath, 'employees', employeeId) : null),
        [employeeId]
    );
    const { data: employeeProfile } = useDoc<Employee>(employeeDocRef as any);

    // ER documents (for appointment date extraction)
    const erDocsQuery = useMemoFirebase(
        ({ firestore, companyPath }) => (firestore && employeeId ? query(tenantCollection(firestore, companyPath, 'er_documents'), where('employeeId', '==', employeeId)) : null),
        [employeeId]
    );
    const { data: erDocuments } = useCollection<any>(erDocsQuery as any);

    // Use saved data if available and no new data parsed (skip when user explicitly wants to re-upload)
    React.useEffect(() => {
        if (savedNdshData && !parsedData && step === 'idle' && !isReuploadMode) {
            setParsedData(savedNdshData);
            if (savedNdshData.abnormalMonths) {
                setAbnormalMonths(savedNdshData.abnormalMonths);
            }
            if (savedNdshData.baseVacationDays) {
                setBaseVacationDays(savedNdshData.baseVacationDays);
            }
            setStep('complete');
        }
    }, [savedNdshData, parsedData, step, isReuploadMode]);

    // Save NDSH data to Firebase
    const handleSave = async () => {
        if (!parsedData || !ndshDocRef || !firestore || !employeeId) return;
        
        setIsSaving(true);
        try {
            // Save NDSH data
            await setDocumentNonBlocking(ndshDocRef, {
                ...parsedData,
                abnormalMonths,
                baseVacationDays,
                calculatedVacationDays: vacationCalculation.total,
                updatedAt: new Date().toISOString(),
            });
            
            // Also save vacation days to employee document
            const employeeDocRef = tDoc('employees', employeeId);
            await setDocumentNonBlocking(employeeDocRef, {
                vacationConfig: {
                    baseDays: vacationCalculation.total,
                    calculatedAt: new Date().toISOString(),
                    breakdown: {
                        base: vacationCalculation.base,
                        normalAdditional: vacationCalculation.normalAdditional,
                        abnormalAdditional: vacationCalculation.abnormalAdditional,
                        normalMonths: vacationCalculation.normalMonths,
                        abnormalMonths: vacationCalculation.effectiveAbnormalMonths,
                    }
                }
            }, { merge: true });
            
            toast({
                title: 'Амжилттай хадгалагдлаа!',
                description: `Амралтын хоног: ${vacationCalculation.total} өдөр`,
            });
        } catch (err) {
            toast({
                variant: 'destructive',
                title: 'Алдаа',
                description: 'Хадгалахад алдаа гарлаа',
            });
        } finally {
            setIsSaving(false);
        }
    };

    // Check if data has changed from saved version
    const hasUnsavedChanges = React.useMemo(() => {
        if (!parsedData) return false;
        if (!savedNdshData) return true;
        // Check payments
        if (parsedData.payments.length !== savedNdshData.payments.length) return true;
        // Check abnormal months
        const savedAbnormal = savedNdshData.abnormalMonths || {};
        if (JSON.stringify(abnormalMonths) !== JSON.stringify(savedAbnormal)) return true;
        // Check base vacation days
        const savedBaseDays = savedNdshData.baseVacationDays || 15;
        if (baseVacationDays !== savedBaseDays) return true;
        return false;
    }, [parsedData, savedNdshData, abnormalMonths, baseVacationDays]);

    const handleBack = () => {
        router.push(`/dashboard/employees/${employeeId}?tab=vacation`);
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            const validTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
            if (!validTypes.includes(selectedFile.type)) {
                toast({
                    variant: 'destructive',
                    title: 'Буруу файл төрөл',
                    description: 'PDF, JPG, PNG файл оруулна уу',
                });
                return;
            }
            if (selectedFile.size > 20 * 1024 * 1024) {
                toast({
                    variant: 'destructive',
                    title: 'Файл хэт том',
                    description: 'Файлын хэмжээ 20MB-аас бага байх ёстой',
                });
                return;
            }
            setFile(selectedFile);
            setError(null);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        const droppedFile = e.dataTransfer.files[0];
        if (droppedFile) {
            const validTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
            if (validTypes.includes(droppedFile.type)) {
                setFile(droppedFile);
                setError(null);
            }
        }
    };

    const processFile = async () => {
        if (!file) return;

        try {
            setStep('uploading');
            setProgress(20);

            const dataUrl = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result as string);
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });

            setProgress(40);
            setStep('analyzing');

            const response = await fetch('/api/parse-ndsh', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    imageDataUrl: dataUrl,
                    mimeType: file.type,
                }),
            });

            setProgress(80);

            let result;
            try {
                result = await response.json();
            } catch (jsonError) {
                console.error('JSON parse error:', jsonError);
                throw new Error('Сервер хариу боловсруулахад алдаа гарлаа');
            }

            if (!response.ok) {
                throw new Error(result?.error || 'Файл задлахад алдаа гарлаа');
            }

            setProgress(100);

            if (!result.success || !result.data) {
                throw new Error(result?.error || 'Өгөгдөл олдсонгүй');
            }

            setParsedData(result.data);
            setStep('complete');
            setIsReuploadMode(false);

            const paymentCount = result.data.payments?.length || 0;
            if (paymentCount === 0) {
                toast({
                    variant: 'destructive',
                    title: 'Анхааруулга',
                    description: 'Файлаас НДШ төлөлтийн мэдээлэл олдсонгүй. Зөв файл оруулсан эсэхээ шалгана уу.',
                });
            } else {
                toast({
                    title: 'Амжилттай!',
                    description: `${paymentCount} бүртгэл олдлоо`,
                });
            }

        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Алдаа гарлаа';
            console.error('NDSH processing error:', errorMessage);
            setStep('error');
            setError(errorMessage);
            toast({
                variant: 'destructive',
                title: 'Алдаа',
                description: errorMessage,
            });
        }
    };

    const resetState = () => {
        setFile(null);
        setStep('idle');
        setProgress(0);
        setError(null);
        setParsedData(null);
        setShowUpload(false);
    };

    // Group payments by year
    const groupedByYear = React.useMemo(() => {
        if (!parsedData) return {};
        
        const grouped: Record<number, Record<string, boolean[]>> = {};
        
        parsedData.payments.forEach(payment => {
            if (!grouped[payment.year]) {
                grouped[payment.year] = {};
            }
            if (!grouped[payment.year][payment.organization]) {
                grouped[payment.year][payment.organization] = Array(12).fill(false);
            }
            if (payment.month >= 1 && payment.month <= 12) {
                grouped[payment.year][payment.organization][payment.month - 1] = payment.paid;
            }
        });
        
        return grouped;
    }, [parsedData]);

    // Check if organization is voluntary insurance
    const isVoluntaryInsurance = (org: string) => {
        return org.toLowerCase().includes('сайн дурын') || 
               org.toLowerCase().includes('сайн дурын даатгал');
    };

    // Separate voluntary insurance payments
    const voluntaryStats = React.useMemo(() => {
        if (!parsedData) return { totalMonths: 0, uniqueMonths: new Set<string>() };
        
        const uniqueMonths = new Set<string>();
        
        parsedData.payments.forEach(payment => {
            if (payment.paid && isVoluntaryInsurance(payment.organization)) {
                uniqueMonths.add(`${payment.year}-${payment.month}`);
            }
        });
        
        return { 
            totalMonths: uniqueMonths.size,
            uniqueMonths
        };
    }, [parsedData]);

    const companyStartDateStr = React.useMemo(() => {
        // 1) Try to extract from latest approved/signed appointment-related ER document (tomilgoo).
        const docs = Array.isArray(erDocuments) ? erDocuments : [];
        const appointmentDocs = docs
            .filter((d: any) => {
                const status = String(d?.status || '');
                if (!['APPROVED', 'SIGNED'].includes(status)) return false;
                const actionId = String(d?.metadata?.actionId || '');
                const templateId = String(d?.templateId || '');
                return actionId.startsWith('appointment') || templateId.includes('appointment');
            })
            .sort((a: any, b: any) => {
                const ta = a?.createdAt?.seconds ? a.createdAt.seconds : new Date(a?.createdAt || 0).getTime() / 1000;
                const tb = b?.createdAt?.seconds ? b.createdAt.seconds : new Date(b?.createdAt || 0).getTime() / 1000;
                return (tb || 0) - (ta || 0);
            });

        const latest = appointmentDocs[0];
        if (latest) {
            const inputs = latest.customInputs || {};
            const actionId = String(latest?.metadata?.actionId || '');

            let hireDateVal: any = null;
            if (actionId === 'appointment_probation') {
                hireDateVal = inputs['Туршилтын эхлэх огноо'] || inputs['probationStartDate'];
            } else if (actionId === 'appointment_reappoint') {
                hireDateVal = inputs['Томилогдсон огноо'] || inputs['appointmentDate'];
            } else if (actionId === 'appointment_permanent') {
                hireDateVal = inputs['Томилогдсон хугацаа'] || inputs['appointmentDate'];
            }

            if (!hireDateVal) {
                hireDateVal = inputs['startDate'] || inputs['date'] || inputs['Огноо'];
            }

            if (!hireDateVal) {
                hireDateVal = Object.values(inputs).find(v => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v));
            }

            if (typeof hireDateVal === 'string' && /^\d{4}-\d{2}-\d{2}/.test(hireDateVal)) {
                return hireDateVal.substring(0, 10);
            }
        }

        // 2) Fallback to employee profile hireDate.
        const hd = (employeeProfile as any)?.hireDate;
        return typeof hd === 'string' && hd ? hd : null;
    }, [erDocuments, employeeProfile]);

    const companyMonths = React.useMemo(() => {
        const set = new Set<number>();
        if (!companyStartDateStr) return set;
        const d = parseISO(companyStartDateStr);
        if (Number.isNaN(d.getTime())) return set;
        const startIdx = d.getFullYear() * 12 + d.getMonth(); // month is 0-based
        const now = new Date();
        const nowIdx = now.getFullYear() * 12 + now.getMonth();
        if (nowIdx < startIdx) return set;
        for (let idx = startIdx; idx <= nowIdx; idx++) set.add(idx);
        return set;
    }, [companyStartDateStr]);

    const companyMonthsByYear = React.useMemo(() => {
        const map: Record<number, boolean[]> = {};
        companyMonths.forEach((idx) => {
            const year = Math.floor(idx / 12);
            const month0 = idx % 12;
            if (!map[year]) map[year] = Array(12).fill(false);
            map[year][month0] = true;
        });
        return map;
    }, [companyMonths]);

    const companyYearStats = React.useMemo(() => {
        const stats: Record<number, { workedMonths: number }> = {};
        Object.entries(companyMonthsByYear).forEach(([y, months]) => {
            const year = Number(y);
            stats[year] = { workedMonths: (months || []).filter(Boolean).length };
        });
        return stats;
    }, [companyMonthsByYear]);

    const sortedCompanyYears = React.useMemo(() => {
        return Object.keys(companyMonthsByYear).map(Number).sort((a, b) => b - a);
    }, [companyMonthsByYear]);

    // Calculate unique paid months per year (multiple companies in same month = 1)
    const yearlyStats = React.useMemo(() => {
        if (!parsedData) return {};
        
        const stats: Record<number, { 
            paidMonths: number; 
            uniqueMonths: Set<number>;
            voluntaryMonths: Set<number>;
            regularMonths: Set<number>;
        }> = {};
        
        parsedData.payments.forEach(payment => {
            if (!stats[payment.year]) {
                stats[payment.year] = { 
                    paidMonths: 0, 
                    uniqueMonths: new Set(),
                    voluntaryMonths: new Set(),
                    regularMonths: new Set()
                };
            }
            if (payment.paid && payment.month >= 1 && payment.month <= 12) {
                stats[payment.year].uniqueMonths.add(payment.month);
                
                if (isVoluntaryInsurance(payment.organization)) {
                    stats[payment.year].voluntaryMonths.add(payment.month);
                } else {
                    stats[payment.year].regularMonths.add(payment.month);
                }
            }
        });
        
        // Convert sets to counts
        Object.keys(stats).forEach(year => {
            const yearNum = Number(year);
            // Calculate effective paid months based on includeVoluntary setting
            stats[yearNum].paidMonths = stats[yearNum].uniqueMonths.size;
        });
        
        return stats;
    }, [parsedData]);

    // Calculate total months as: other organizations (NDSH paid months) + our company months (from appointment date)
    const totalStats = React.useMemo(() => {
        // Build month meta from NDSH payments
        const monthMeta = new Map<number, { hasRegular: boolean; hasVoluntary: boolean }>();
        const payments = parsedData?.payments || [];
        payments.forEach((p) => {
            if (!p?.paid) return;
            if (!(p.month >= 1 && p.month <= 12) || !p.year) return;
            const idx = p.year * 12 + (p.month - 1);
            const cur = monthMeta.get(idx) || { hasRegular: false, hasVoluntary: false };
            if (isVoluntaryInsurance(p.organization || '')) cur.hasVoluntary = true;
            else cur.hasRegular = true;
            monthMeta.set(idx, cur);
        });

        // Other-org months: months that qualify from NDSH, but only BEFORE our company start month to avoid double-count.
        const otherMonths = new Set<number>();
        let startIdx: number | null = null;
        if (companyStartDateStr) {
            const d = parseISO(companyStartDateStr);
            if (!Number.isNaN(d.getTime())) startIdx = d.getFullYear() * 12 + d.getMonth();
        }

        for (const [idx, meta] of monthMeta.entries()) {
            const counts = includeVoluntary ? (meta.hasRegular || meta.hasVoluntary) : meta.hasRegular;
            if (!counts) continue;
            if (startIdx !== null && idx >= startIdx) continue;
            otherMonths.add(idx);
        }

        const ourMonthsCount = companyMonths.size;
        const otherMonthsCount = otherMonths.size;
        const totalMonths = ourMonthsCount + otherMonthsCount;

        const coveredYears = new Set<number>();
        otherMonths.forEach((idx) => coveredYears.add(Math.floor(idx / 12)));
        companyMonths.forEach((idx) => coveredYears.add(Math.floor(idx / 12)));

        return {
            totalMonths,
            yearsCount: Math.floor(totalMonths / 12),
            remainingMonths: totalMonths % 12,
            coveredYears: coveredYears.size,
            ourMonths: ourMonthsCount,
            otherMonths: otherMonthsCount,
        };
    }, [parsedData?.payments, includeVoluntary, companyStartDateStr, companyMonths]);

    const sortedYears = Object.keys(groupedByYear).map(Number).sort((a, b) => b - a);

    // Toggle year expansion
    const toggleYear = (year: number) => {
        setExpandedYears(prev => {
            const newSet = new Set(prev);
            if (newSet.has(year)) {
                newSet.delete(year);
            } else {
                newSet.add(year);
            }
            return newSet;
        });
    };

    // Expand/collapse all years
    const toggleAllYears = () => {
        if (expandedYears.size === sortedYears.length) {
            setExpandedYears(new Set());
        } else {
            setExpandedYears(new Set(sortedYears));
        }
    };

    // Toggle company year expansion
    const toggleCompanyYear = (year: number) => {
        setExpandedCompanyYears(prev => {
            const newSet = new Set(prev);
            if (newSet.has(year)) {
                newSet.delete(year);
            } else {
                newSet.add(year);
            }
            return newSet;
        });
    };

    // Expand/collapse all company years
    const toggleAllCompanyYears = () => {
        if (expandedCompanyYears.size === sortedCompanyYears.length) {
            setExpandedCompanyYears(new Set());
        } else {
            setExpandedCompanyYears(new Set(sortedCompanyYears));
        }
    };

    // Abnormal interval definitions
    const ABNORMAL_INTERVALS = [
        { days: 5, min: 61, max: 120, label: '6–10 жил' },
        { days: 7, min: 121, max: 180, label: '11–15 жил' },
        { days: 9, min: 181, max: 240, label: '16–20 жил' },
        { days: 12, min: 241, max: 300, label: '21–25 жил' },
        { days: 15, min: 301, max: 372, label: '26–31 жил' },
        { days: 18, min: 373, max: Infinity, label: '32+ жил' },
    ];

    // Calculate additional vacation days based on months
    const getAdditionalDays = (months: number, isAbnormal: boolean) => {
        if (isAbnormal) {
            // Abnormal conditions table
            if (months >= 373) return 18;
            if (months >= 301) return 15;
            if (months >= 241) return 12;
            if (months >= 181) return 9;
            if (months >= 121) return 7;
            if (months >= 61) return 5;
            return 0;
        } else {
            // Normal conditions table
            if (months >= 373) return 14;
            if (months >= 301) return 11;
            if (months >= 241) return 9;
            if (months >= 181) return 7;
            if (months >= 121) return 5;
            if (months >= 61) return 3;
            return 0;
        }
    };

    // Find matching abnormal interval
    const getAbnormalInterval = (months: number) => {
        // Find the interval that this month count qualifies for
        for (let i = ABNORMAL_INTERVALS.length - 1; i >= 0; i--) {
            if (months >= ABNORMAL_INTERVALS[i].min) {
                return ABNORMAL_INTERVALS[i];
            }
        }
        return null;
    };

    // Calculate total vacation days
    const vacationCalculation = React.useMemo(() => {
        // Find which interval the abnormal months qualify for
        const matchedInterval = getAbnormalInterval(totalAbnormalMonths);
        const abnormalQualifies = matchedInterval !== null;
        
        // Only use the minimum of the matched interval
        // Excess months go back to normal
        const effectiveAbnormalMonths = abnormalQualifies ? matchedInterval.min : 0;
        const excessAbnormalMonths = abnormalQualifies ? totalAbnormalMonths - matchedInterval.min : totalAbnormalMonths;
        
        // Normal months = (Total - Abnormal input) + Excess from abnormal
        // Simplified: Total - Effective abnormal
        const normalMonths = totalStats.totalMonths - effectiveAbnormalMonths;
        
        const normalAdditional = getAdditionalDays(normalMonths, false);
        const abnormalAdditional = getAdditionalDays(effectiveAbnormalMonths, true);
        const total = baseVacationDays + normalAdditional + abnormalAdditional;
        
        return {
            base: baseVacationDays,
            normalMonths,
            normalAdditional,
            effectiveAbnormalMonths,
            excessAbnormalMonths,
            abnormalAdditional,
            abnormalQualifies,
            matchedInterval,
            total,
        };
    }, [baseVacationDays, totalStats.totalMonths, totalAbnormalMonths]);

    const isProcessing = step === 'uploading' || step === 'analyzing';

    return (
        <div className="min-h-screen bg-slate-50/50">
            {/* Header */}
            <div className="bg-white border-b sticky top-0 z-10">
                <div className="px-6 md:px-8 py-4">
                    <PageHeader
                        title="Ажилсан жил тооцоолох"
                        description="НДШ төлөлтийн лавлагаагаар ажилласан жил тооцоолох"
                        showBackButton
                        hideBreadcrumbs
                        backButtonPlacement="inline"
                        backBehavior="history"
                        fallbackBackHref={`/dashboard/employees/${employeeId}`}
                    />
                </div>
            </div>

            {/* Content */}
            <div className="px-6 md:px-8 py-8">
                {/* Loading State */}
                {isLoadingSaved && (
                    <Card className="border-none shadow-lg bg-white rounded-2xl overflow-hidden mb-6">
                        <CardContent className="p-8">
                            <div className="flex items-center justify-center gap-4">
                                <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
                                <span className="text-sm text-slate-600">Хадгалсан мэдээлэл ачааллаж байна...</span>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Upload Section */}
                {!isLoadingSaved && (step === 'idle' || step === 'uploading' || step === 'analyzing' || step === 'error' || showUpload) && (
                    <Card className="border-none shadow-lg bg-white rounded-2xl overflow-hidden mb-6">
                        <CardHeader className="border-b bg-gradient-to-r from-indigo-50 to-purple-50 px-6 py-4">
                            <CardTitle className="text-sm font-bold text-slate-700 flex items-center gap-2">
                                <Sparkles className="h-4 w-4 text-indigo-500" />
                                НДШ төлөлтийн лавлагаа оруулах
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-6">
                            {step === 'idle' && (
                                <>
                                    <div
                                        className={`border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer ${
                                            file
                                                ? 'border-indigo-300 bg-indigo-50/50'
                                                : 'border-slate-200 hover:border-indigo-300 hover:bg-slate-50'
                                        }`}
                                        onClick={() => fileInputRef.current?.click()}
                                        onDrop={handleDrop}
                                        onDragOver={(e) => e.preventDefault()}
                                    >
                                        <input
                                            ref={fileInputRef}
                                            type="file"
                                            accept=".pdf,.jpg,.jpeg,.png,.webp"
                                            onChange={handleFileSelect}
                                            className="hidden"
                                        />
                                        {file ? (
                                            <div className="space-y-2">
                                                <div className="mx-auto w-12 h-12 rounded-xl bg-indigo-100 flex items-center justify-center">
                                                    <FileText className="h-6 w-6 text-indigo-600" />
                                                </div>
                                                <p className="text-sm font-semibold text-slate-800">{file.name}</p>
                                                <p className="text-xs text-slate-500">
                                                    {(file.size / 1024 / 1024).toFixed(2)} MB
                                                </p>
                                            </div>
                                        ) : (
                                            <div className="space-y-3">
                                                <div className="mx-auto w-14 h-14 rounded-xl bg-slate-100 flex items-center justify-center">
                                                    <Upload className="h-7 w-7 text-slate-400" />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-medium text-slate-700">
                                                        НДШ лавлагааг энд чирж оруулна уу
                                                    </p>
                                                    <p className="text-xs text-slate-500 mt-1">
                                                        эсвэл дарж сонгоно уу
                                                    </p>
                                                </div>
                                                <div className="flex items-center justify-center gap-2">
                                                    <Badge variant="secondary" className="text-[10px]">
                                                        <FileText className="h-3 w-3 mr-1" />
                                                        PDF
                                                    </Badge>
                                                    <Badge variant="secondary" className="text-[10px]">
                                                        <FileImage className="h-3 w-3 mr-1" />
                                                        JPG/PNG
                                                    </Badge>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex gap-3 mt-4">
                                        <Button 
                                            variant="outline" 
                                            onClick={() => {
                                                if (savedNdshData) {
                                                    setIsReuploadMode(false);
                                                    setShowUpload(false);
                                                    setFile(null);
                                                } else {
                                                    handleBack();
                                                }
                                            }} 
                                            className="h-10"
                                        >
                                            {savedNdshData ? 'Болих' : 'Буцах'}
                                        </Button>
                                        <Button
                                            onClick={processFile}
                                            disabled={!file}
                                            className="flex-1 h-10 bg-indigo-600 hover:bg-indigo-700"
                                        >
                                            <Brain className="h-4 w-4 mr-2" />
                                            AI-аар шинжлэх
                                        </Button>
                                    </div>
                                </>
                            )}

                            {isProcessing && (
                                <div className="py-8 space-y-4">
                                    <div className="flex items-center justify-center">
                                        <div className="relative">
                                            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center animate-pulse">
                                                <Brain className="h-10 w-10 text-white" />
                                            </div>
                                            <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-xl bg-white shadow-lg flex items-center justify-center">
                                                <Loader2 className="h-5 w-5 text-indigo-600 animate-spin" />
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-center">
                                        <p className="text-sm font-semibold text-slate-800">
                                            {step === 'uploading' ? 'Файл уншиж байна...' : 'AI шинжилж байна...'}
                                        </p>
                                        <p className="text-xs text-slate-500 mt-1">Түр хүлээнэ үү</p>
                                    </div>
                                    <Progress value={progress} className="h-2" />
                                </div>
                            )}

                            {step === 'error' && (
                                <div className="py-8 space-y-4 text-center">
                                    <div className="mx-auto w-16 h-16 rounded-2xl bg-rose-100 flex items-center justify-center">
                                        <AlertTriangle className="h-8 w-8 text-rose-600" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold text-rose-700">Алдаа гарлаа</p>
                                        <p className="text-xs text-slate-500 mt-1">{error}</p>
                                    </div>
                                    <Button variant="outline" onClick={resetState}>
                                        Дахин оролдох
                                    </Button>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )}

                {/* Results Section */}
                {!isLoadingSaved && step === 'complete' && parsedData && !showUpload && (
                    <div className="space-y-6">
                        {/* Total Vacation Days Calculation - Hero Card */}
                        <Card className="border-none shadow-lg bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 rounded-2xl overflow-hidden">
                            <CardContent className="p-6">
                                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                                    {/* Total Display */}
                                    <div className="flex items-center gap-4">
                                        <div className="h-16 w-16 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                                            <CalendarDays className="h-8 w-8 text-white" />
                                        </div>
                                        <div>
                                            <p className="text-white/80 text-sm font-medium">Нийт амралтын хоног</p>
                                            <p className="text-5xl font-black text-white">
                                                {vacationCalculation.total}
                                                <span className="text-2xl font-medium ml-2 text-white/80">өдөр</span>
                                            </p>
                                        </div>
                                    </div>

                                    {/* Breakdown */}
                                    <div className="flex flex-wrap gap-3">
                                        {/* Base Days */}
                                        <div className="bg-white/15 backdrop-blur-sm rounded-xl px-4 py-3 min-w-[120px]">
                                            <p className="text-white/70 text-[10px] uppercase tracking-wider font-medium">Суурь</p>
                                            <p className="text-2xl font-bold text-white">{vacationCalculation.base}</p>
                                            <p className="text-white/60 text-[10px]">
                                                {baseVacationDays === 15 ? 'Ердийн' : 'ХБИ/18-'}
                                            </p>
                                        </div>

                                        {/* Plus Sign */}
                                        <div className="flex items-center text-white/50 text-2xl font-light">+</div>

                                        {/* Normal Additional */}
                                        <div className="bg-white/15 backdrop-blur-sm rounded-xl px-4 py-3 min-w-[120px]">
                                            <p className="text-white/70 text-[10px] uppercase tracking-wider font-medium">Хэвийн нэмэлт</p>
                                            <p className="text-2xl font-bold text-white">{vacationCalculation.normalAdditional}</p>
                                            <p className="text-white/60 text-[10px]">{vacationCalculation.normalMonths} сар</p>
                                        </div>

                                        {/* Plus Sign */}
                                        <div className="flex items-center text-white/50 text-2xl font-light">+</div>

                                        {/* Abnormal Additional */}
                                        <div className={`backdrop-blur-sm rounded-xl px-4 py-3 min-w-[120px] ${vacationCalculation.abnormalQualifies ? 'bg-white/15' : 'bg-white/10 opacity-60'}`}>
                                            <p className="text-white/70 text-[10px] uppercase tracking-wider font-medium">Хэв. бус нэмэлт</p>
                                            <p className="text-2xl font-bold text-white">{vacationCalculation.abnormalAdditional}</p>
                                            <p className="text-white/60 text-[10px]">
                                                {vacationCalculation.abnormalQualifies 
                                                    ? `${vacationCalculation.effectiveAbnormalMonths} сар`
                                                    : `${totalAbnormalMonths} сар < 61`
                                                }
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Explanation Note */}
                                {totalAbnormalMonths > 0 && (
                                    <div className="mt-4 bg-white/10 backdrop-blur-sm rounded-xl px-4 py-3">
                                        <p className="text-white/90 text-xs">
                                            <span className="text-yellow-300 mr-2">ℹ️</span>
                                            {!vacationCalculation.abnormalQualifies ? (
                                                <span>
                                                    Хэвийн бус <strong>{totalAbnormalMonths}</strong> сар нь 61 сарын доогуур учир бүгд хэвийн нөхцөлд шилжив.
                                                    <span className="text-white/70 ml-1">
                                                        (Хэвийн: {vacationCalculation.normalMonths} сар)
                                                    </span>
                                                </span>
                                            ) : (
                                                <span>
                                                    Хэвийн бус <strong>{totalAbnormalMonths}</strong> сар → 
                                                    <strong className="text-pink-300 mx-1">{vacationCalculation.effectiveAbnormalMonths}</strong> сар 
                                                    ({vacationCalculation.matchedInterval?.min}–{vacationCalculation.matchedInterval?.max === Infinity ? '∞' : vacationCalculation.matchedInterval?.max} интервал).
                                                    {vacationCalculation.excessAbnormalMonths > 0 && (
                                                        <span className="text-emerald-300 ml-1">
                                                            Илүүдэл <strong>{vacationCalculation.excessAbnormalMonths}</strong> сар хэвийн рүү шилжив.
                                                        </span>
                                                    )}
                                                    <span className="text-white/70 ml-1">
                                                        (Хэвийн: {vacationCalculation.normalMonths} сар)
                                                    </span>
                                                </span>
                                            )}
                                        </p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Employee Info */}
                        {parsedData.employeeInfo && (parsedData.employeeInfo.lastName || parsedData.employeeInfo.firstName) && (
                            <Card className="border-none shadow-sm bg-white rounded-2xl">
                                <CardContent className="p-4">
                                    <div className="flex items-center gap-3">
                                        <div className="h-10 w-10 rounded-xl bg-slate-100 flex items-center justify-center">
                                            <svg className="h-5 w-5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                            </svg>
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Даатгуулагч</p>
                                            <p className="text-sm font-bold text-slate-800">
                                                {parsedData.employeeInfo.lastName} {parsedData.employeeInfo.firstName}
                                                {parsedData.employeeInfo.registrationNumber && (
                                                    <span className="ml-2 text-slate-500 font-mono text-xs">
                                                        ({parsedData.employeeInfo.registrationNumber})
                                                    </span>
                                                )}
                                            </p>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {/* Base Vacation Days Selection */}
                        <Card className="border-none shadow-sm bg-gradient-to-r from-sky-50 to-cyan-50 rounded-2xl">
                            <CardContent className="p-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="h-10 w-10 rounded-xl bg-sky-100 flex items-center justify-center">
                                            <CalendarDays className="h-5 w-5 text-sky-600" />
                                        </div>
                                        <div>
                                            <p className="text-xs font-bold text-sky-700">Жилийн суурь амралт</p>
                                            <p className="text-[10px] text-sky-600">Ажилтны ангилал сонгох</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => setBaseVacationDays(15)}
                                            className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                                                baseVacationDays === 15
                                                    ? 'bg-sky-600 text-white shadow-sm'
                                                    : 'bg-white text-sky-700 border border-sky-200 hover:bg-sky-50'
                                            }`}
                                        >
                                            <span className="font-bold">15 өдөр</span>
                                            <span className="block text-[10px] opacity-80">Ердийн ажилтан</span>
                                        </button>
                                        <button
                                            onClick={() => setBaseVacationDays(20)}
                                            className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                                                baseVacationDays === 20
                                                    ? 'bg-sky-600 text-white shadow-sm'
                                                    : 'bg-white text-sky-700 border border-sky-200 hover:bg-sky-50'
                                            }`}
                                        >
                                            <span className="font-bold">20 өдөр</span>
                                            <span className="block text-[10px] opacity-80">ХБИ / 18-аас доош</span>
                                        </button>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Voluntary Insurance Section */}
                        {voluntaryStats.totalMonths > 0 && (
                            <Card className="border-none shadow-sm bg-gradient-to-r from-pink-50 to-rose-50 rounded-2xl mb-4">
                                <CardContent className="p-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="h-10 w-10 rounded-xl bg-pink-100 flex items-center justify-center">
                                                <Heart className="h-5 w-5 text-pink-600" />
                                            </div>
                                            <div>
                                                <p className="text-xs font-bold text-pink-700">Сайн дурын даатгал</p>
                                                <p className="text-sm text-pink-600">
                                                    {voluntaryStats.totalMonths} сар илэрсэн
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <div className="flex items-center space-x-2">
                                                <Checkbox 
                                                    id="includeVoluntary" 
                                                    checked={includeVoluntary}
                                                    onCheckedChange={(checked) => setIncludeVoluntary(checked === true)}
                                                />
                                                <Label 
                                                    htmlFor="includeVoluntary" 
                                                    className="text-xs font-medium text-pink-700 cursor-pointer"
                                                >
                                                    Нийт хугацаанд оруулах
                                                </Label>
                                            </div>
                                            <Badge className={`${includeVoluntary ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                                                {includeVoluntary ? 'Оруулсан' : 'Оруулаагүй'}
                                            </Badge>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {/* Summary Section - Two Columns */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                            {/* Left Column - Additional Days Tables */}
                            <Card className="border-none shadow-sm bg-white rounded-2xl lg:col-span-1">
                                <CardHeader className="pb-2 pt-4 px-4">
                                    <CardTitle className="text-sm font-bold text-slate-700 flex items-center gap-2">
                                        <div className="h-8 w-8 rounded-lg bg-indigo-100 flex items-center justify-center">
                                            <TrendingUp className="h-4 w-4 text-indigo-600" />
                                        </div>
                                        Нэмэлт хоног (жилд)
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="px-4 pb-4 pt-0 space-y-3">
                                    {/* Normal Conditions Table */}
                                    <div>
                                        <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                                            <CheckCircle2 className="h-3 w-3" />
                                            Хэвийн нөхцөлд
                                            <span className="ml-1 font-normal text-emerald-500">
                                                ({vacationCalculation.normalMonths} сар)
                                            </span>
                                        </p>
                                        <div className="overflow-hidden rounded-lg border border-emerald-200">
                                            <table className="w-full text-xs">
                                                <thead>
                                                    <tr className="bg-emerald-50">
                                                        <th className="text-right px-2 py-1.5 font-semibold text-emerald-700 text-[10px]">Нэмэлт</th>
                                                        <th className="text-left px-2 py-1.5 font-semibold text-emerald-700 text-[10px]">Интервал</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {[
                                                        { days: 3, range: '61–120', years: '6–10 жил', min: 61, max: 120 },
                                                        { days: 5, range: '121–180', years: '11–15 жил', min: 121, max: 180 },
                                                        { days: 7, range: '181–240', years: '16–20 жил', min: 181, max: 240 },
                                                        { days: 9, range: '241–300', years: '21–25 жил', min: 241, max: 300 },
                                                        { days: 11, range: '301–372', years: '26–31 жил', min: 301, max: 372 },
                                                        { days: 14, range: '373+', years: '32+ жил', min: 373, max: Infinity },
                                                    ].map((row, idx) => {
                                                        const isActive = vacationCalculation.normalMonths >= row.min && vacationCalculation.normalMonths <= row.max;
                                                        return (
                                                            <tr 
                                                                key={idx} 
                                                                className={`border-t border-emerald-100 ${isActive ? 'bg-emerald-100' : 'hover:bg-emerald-50/50'}`}
                                                            >
                                                                <td className={`text-right px-2 py-1 font-bold text-[11px] ${isActive ? 'text-emerald-800' : 'text-slate-600'}`}>
                                                                    {row.days} өдөр {isActive && '✓'}
                                                                </td>
                                                                <td className={`px-2 py-1 text-[10px] ${isActive ? 'text-emerald-700' : 'text-slate-500'}`}>
                                                                    {row.range} сар <span className="opacity-60">({row.years})</span>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>

                                    {/* Abnormal Conditions Table */}
                                    <div>
                                        <p className="text-[10px] font-bold text-rose-600 uppercase tracking-wider mb-1.5 flex items-center gap-1 flex-wrap">
                                            <AlertTriangle className="h-3 w-3" />
                                            Хэвийн бус нөхцөлд
                                            {totalAbnormalMonths > 0 && (
                                                <span className="ml-1 font-normal text-rose-500">
                                                    ({totalAbnormalMonths} сар 
                                                    {vacationCalculation.abnormalQualifies 
                                                        ? ` → ${vacationCalculation.effectiveAbnormalMonths} сар`
                                                        : ' → хэвийн рүү'
                                                    }
                                                    {vacationCalculation.excessAbnormalMonths > 0 && 
                                                        <span className="text-emerald-600"> +{vacationCalculation.excessAbnormalMonths} хэвийн</span>
                                                    })
                                                </span>
                                            )}
                                        </p>
                                        <div className={`overflow-hidden rounded-lg border ${vacationCalculation.abnormalQualifies ? 'border-rose-200' : 'border-slate-200 opacity-50'}`}>
                                            <table className="w-full text-xs">
                                                <thead>
                                                    <tr className={vacationCalculation.abnormalQualifies ? 'bg-rose-50' : 'bg-slate-50'}>
                                                        <th className={`text-right px-2 py-1.5 font-semibold text-[10px] ${vacationCalculation.abnormalQualifies ? 'text-rose-700' : 'text-slate-500'}`}>Нэмэлт</th>
                                                        <th className={`text-left px-2 py-1.5 font-semibold text-[10px] ${vacationCalculation.abnormalQualifies ? 'text-rose-700' : 'text-slate-500'}`}>Интервал</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {[
                                                        { days: 5, range: '61–120', years: '6–10 жил', min: 61, max: 120 },
                                                        { days: 7, range: '121–180', years: '11–15 жил', min: 121, max: 180 },
                                                        { days: 9, range: '181–240', years: '16–20 жил', min: 181, max: 240 },
                                                        { days: 12, range: '241–300', years: '21–25 жил', min: 241, max: 300 },
                                                        { days: 15, range: '301–372', years: '26–31 жил', min: 301, max: 372 },
                                                        { days: 18, range: '373+', years: '32+ жил', min: 373, max: Infinity },
                                                    ].map((row, idx) => {
                                                        const isActive = vacationCalculation.abnormalQualifies && vacationCalculation.effectiveAbnormalMonths >= row.min && vacationCalculation.effectiveAbnormalMonths <= row.max;
                                                        return (
                                                            <tr 
                                                                key={idx} 
                                                                className={`border-t border-rose-100 ${isActive ? 'bg-rose-100' : 'hover:bg-rose-50/50'}`}
                                                            >
                                                                <td className={`text-right px-2 py-1 font-bold text-[11px] ${isActive ? 'text-rose-800' : 'text-slate-600'}`}>
                                                                    {row.days} өдөр {isActive && '✓'}
                                                                </td>
                                                                <td className={`px-2 py-1 text-[10px] ${isActive ? 'text-rose-700' : 'text-slate-500'}`}>
                                                                    {row.range} сар <span className="opacity-60">({row.years})</span>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Right Column - Summary Cards */}
                            <div className="lg:col-span-2 grid grid-cols-2 md:grid-cols-3 gap-3">
                                <Card className="border-none shadow-sm bg-gradient-to-br from-emerald-50 to-green-50 rounded-2xl">
                                    <CardContent className="p-4">
                                        <div className="flex items-center gap-3">
                                            <div className="h-10 w-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                                                <CalendarDays className="h-5 w-5 text-emerald-600" />
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Нийт хугацаа</p>
                                                <p className="text-xl font-black text-emerald-700">
                                                    {totalStats.yearsCount > 0 ? `${totalStats.yearsCount} жил ` : ''}
                                                    {totalStats.remainingMonths > 0 ? `${totalStats.remainingMonths} сар` : totalStats.yearsCount === 0 ? '0 сар' : ''}
                                                </p>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>

                                <Card className="border-none shadow-sm bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl">
                                    <CardContent className="p-4">
                                        <div className="flex items-center gap-3">
                                            <div className="h-10 w-10 rounded-xl bg-blue-100 flex items-center justify-center">
                                                <CheckCircle2 className="h-5 w-5 text-blue-600" />
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">Нийт сар</p>
                                                <p className="text-2xl font-black text-blue-700">{totalStats.totalMonths}</p>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>

                                <Card className="border-none shadow-sm bg-gradient-to-br from-purple-50 to-violet-50 rounded-2xl">
                                    <CardContent className="p-4">
                                        <div className="flex items-center gap-3">
                                            <div className="h-10 w-10 rounded-xl bg-purple-100 flex items-center justify-center">
                                                <TrendingUp className="h-5 w-5 text-purple-600" />
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-bold text-purple-600 uppercase tracking-wider">Хамрагдсан жил</p>
                                                <p className="text-2xl font-black text-purple-700">{totalStats.coveredYears}</p>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>

                                <Card className="border-none shadow-sm bg-gradient-to-br from-sky-50 to-cyan-50 rounded-2xl">
                                    <CardContent className="p-4">
                                        <div className="flex items-center gap-3">
                                            <div className="h-10 w-10 rounded-xl bg-sky-100 flex items-center justify-center">
                                                <Building2 className="h-5 w-5 text-sky-600" />
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-bold text-sky-600 uppercase tracking-wider">Манай байгууллага</p>
                                                <p className="text-2xl font-black text-sky-700">{totalStats.ourMonths} <span className="text-sm font-medium">сар</span></p>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>

                                <Card className="border-none shadow-sm bg-gradient-to-br from-slate-50 to-zinc-50 rounded-2xl">
                                    <CardContent className="p-4">
                                        <div className="flex items-center gap-3">
                                            <div className="h-10 w-10 rounded-xl bg-slate-100 flex items-center justify-center">
                                                <Building2 className="h-5 w-5 text-slate-600" />
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Бусад байгууллага</p>
                                                <p className="text-2xl font-black text-slate-700">{totalStats.otherMonths} <span className="text-sm font-medium">сар</span></p>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>

                                <Card className="border-none shadow-sm bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl">
                                    <CardContent className="p-4">
                                        <div className="flex items-center gap-3">
                                            <div className="h-10 w-10 rounded-xl bg-amber-100 flex items-center justify-center">
                                                <Building2 className="h-5 w-5 text-amber-600" />
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">Байгууллага</p>
                                                <p className="text-2xl font-black text-amber-700">
                                                    {Object.keys(Object.values(groupedByYear).reduce((acc, orgs) => ({ ...acc, ...orgs }), {})).length}
                                                </p>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>

                                {/* Abnormal Working Conditions Summary */}
                                <Card className="border-none shadow-sm bg-gradient-to-br from-rose-50 to-red-50 rounded-2xl">
                                    <CardContent className="p-4">
                                        <div className="flex items-center gap-3">
                                            <div className="h-10 w-10 rounded-xl bg-rose-100 flex items-center justify-center">
                                                <AlertTriangle className="h-5 w-5 text-rose-600" />
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-bold text-rose-600 uppercase tracking-wider">Хэвийн бус нөхцөл</p>
                                                <p className="text-2xl font-black text-rose-700">{totalAbnormalMonths} <span className="text-sm font-medium">сар</span></p>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        </div>

                        {/* Longest Employment Info */}
                        {parsedData.summary.longestEmployment.organization && (
                            <Card className="border-none shadow-sm bg-white rounded-2xl">
                                <CardContent className="p-4">
                                    <div className="flex items-center gap-3">
                                        <div className="h-10 w-10 rounded-xl bg-indigo-100 flex items-center justify-center">
                                            <Building2 className="h-5 w-5 text-indigo-600" />
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Хамгийн удаан ажилласан байгууллага</p>
                                            <p className="text-sm font-bold text-slate-800">{parsedData.summary.longestEmployment.organization}</p>
                                        </div>
                                        <Badge className="ml-auto bg-indigo-100 text-indigo-700 hover:bg-indigo-100">
                                            {parsedData.summary.longestEmployment.months} сар
                                        </Badge>
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {/* Our company employment (from appointment date) */}
                        {companyStartDateStr && companyMonths.size > 0 && (
                            <div className="space-y-3">
                                <Card className="border-none shadow-sm bg-gradient-to-r from-emerald-50 to-teal-50 rounded-2xl overflow-hidden">
                                    <CardContent className="p-4">
                                        <div className="flex items-center justify-between gap-4 flex-wrap">
                                            <div className="flex items-center gap-3">
                                                <div className="h-10 w-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                                                    <Building2 className="h-5 w-5 text-emerald-600" />
                                                </div>
                                                <div>
                                                    <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Манай байгуулагад ажиллаж буй</p>
                                                    <p className="text-xs text-slate-600 mt-0.5">
                                                        Эхэлсэн огноо: <span className="font-mono font-semibold">{companyStartDateStr.replaceAll('-', '.')}</span>
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                                                    {totalStats.ourMonths} сар
                                                </Badge>
                                                <Badge variant="outline" className="bg-white/60">
                                                    {Math.floor(totalStats.ourMonths / 12)} жил {totalStats.ourMonths % 12} сар
                                                </Badge>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>

                                {sortedCompanyYears.length > 0 && (
                                    <>
                                        <div className="flex justify-end mb-2">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={toggleAllCompanyYears}
                                                className="h-8 text-xs text-slate-500 hover:text-slate-700"
                                            >
                                                <ChevronsUpDown className="h-4 w-4 mr-1" />
                                                {expandedCompanyYears.size === sortedCompanyYears.length ? 'Бүгдийг хураах' : 'Бүгдийг дэлгэх'}
                                            </Button>
                                        </div>

                                        {sortedCompanyYears.map((year) => {
                                            const months = companyMonthsByYear[year] || Array(12).fill(false);
                                            const workedMonths = companyYearStats[year]?.workedMonths || 0;
                                            const isExpanded = expandedCompanyYears.has(year);
                                            const yearAbnormal = abnormalMonths[year] || 0;

                                            return (
                                                <Card key={`our-${year}`} className="border-none shadow-sm bg-white rounded-2xl overflow-hidden">
                                                    <CardHeader
                                                        className="border-b bg-emerald-50/50 px-6 py-3 cursor-pointer hover:bg-emerald-50 transition-colors"
                                                        onClick={() => toggleCompanyYear(year)}
                                                    >
                                                        <CardTitle className="text-sm font-bold text-slate-700 flex items-center justify-between">
                                                            <span className="flex items-center gap-2">
                                                                {isExpanded ? (
                                                                    <ChevronDown className="h-4 w-4 text-slate-400" />
                                                                ) : (
                                                                    <ChevronRight className="h-4 w-4 text-slate-400" />
                                                                )}
                                                                🏢 {year} он
                                                            </span>
                                                            <div className="flex items-center gap-3">
                                                                {/* Abnormal months input */}
                                                                <div
                                                                    className="flex items-center gap-1.5 bg-rose-50 rounded-lg px-2 py-1"
                                                                    onClick={(e) => e.stopPropagation()}
                                                                >
                                                                    <AlertTriangle className="h-3.5 w-3.5 text-rose-500" />
                                                                    <input
                                                                        type="number"
                                                                        min={0}
                                                                        max={workedMonths}
                                                                        value={yearAbnormal || ''}
                                                                        onChange={(e) => updateAbnormalMonths(year, parseInt(e.target.value) || 0, workedMonths)}
                                                                        placeholder="0"
                                                                        className="w-8 h-6 text-center text-xs font-bold text-rose-700 bg-white border border-rose-200 rounded focus:outline-none focus:ring-1 focus:ring-rose-400"
                                                                    />
                                                                    <span className="text-[10px] text-rose-600">/{workedMonths}</span>
                                                                </div>
                                                                <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                                                                    {workedMonths}/12 сар
                                                                </Badge>
                                                            </div>
                                                        </CardTitle>
                                                    </CardHeader>
                                                    {isExpanded && (
                                                        <CardContent className="p-0">
                                                            <div className="overflow-x-auto">
                                                                <table className="w-full text-sm">
                                                                    <thead>
                                                                        <tr className="border-b bg-slate-50/50">
                                                                            <th className="text-left px-4 py-2 font-semibold text-slate-600 text-xs min-w-[200px]">Байгууллага</th>
                                                                            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => (
                                                                                <th key={m} className="text-center px-1 py-2 font-semibold text-slate-500 text-xs w-8">
                                                                                    {m}
                                                                                </th>
                                                                            ))}
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody>
                                                                        <tr className="border-b last:border-b-0 hover:bg-slate-50/50">
                                                                            <td className="px-4 py-2 font-medium text-slate-700 text-xs max-w-[200px]" title="Манай байгууллага">
                                                                                Манай байгууллага
                                                                            </td>
                                                                            {months.map((worked: boolean, monthIdx: number) => (
                                                                                <td key={monthIdx} className="text-center px-1 py-2">
                                                                                    <span className={`text-base ${worked ? '' : 'opacity-30'}`}>
                                                                                        {worked ? '✅' : '⬜'}
                                                                                    </span>
                                                                                </td>
                                                                            ))}
                                                                        </tr>
                                                                    </tbody>
                                                                </table>
                                                            </div>
                                                        </CardContent>
                                                    )}
                                                </Card>
                                            );
                                        })}
                                    </>
                                )}
                            </div>
                        )}

                        {/* No Data Message */}
                        {sortedYears.length === 0 && companyMonths.size === 0 && (
                            <Card className="border-none shadow-sm bg-white rounded-2xl">
                                <CardContent className="p-12 text-center">
                                    <div className="mx-auto w-16 h-16 rounded-2xl bg-amber-100 flex items-center justify-center mb-4">
                                        <AlertTriangle className="h-8 w-8 text-amber-600" />
                                    </div>
                                    <h3 className="text-lg font-bold text-slate-700 mb-2">Өгөгдөл олдсонгүй</h3>
                                    <p className="text-sm text-slate-500 max-w-md mx-auto">
                                        Файлаас НДШ төлөлтийн мэдээлэл олдсонгүй. Зөв форматтай файл оруулсан эсэхээ шалгана уу.
                                        НДШ-ийн лавлагаа нь он, сар, байгууллагын нэр, төлөлтийн мэдээллийг агуулсан байх ёстой.
                                    </p>
                                </CardContent>
                            </Card>
                        )}

                        {/* Expand/Collapse All Button */}
                        <div className="flex justify-end mb-2">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={toggleAllYears}
                                className="h-8 text-xs text-slate-500 hover:text-slate-700"
                            >
                                <ChevronsUpDown className="h-4 w-4 mr-1" />
                                {expandedYears.size === sortedYears.length ? 'Бүгдийг хураах' : 'Бүгдийг дэлгэх'}
                            </Button>
                        </div>

                        {/* Year by Year Tables */}
                        {sortedYears.map(year => {
                            const yearStat = yearlyStats[year];
                            const paidMonths = yearStat?.paidMonths || 0;
                            const isFullYear = paidMonths === 12;
                            const isExpanded = expandedYears.has(year);
                            const orgCount = Object.keys(groupedByYear[year] || {}).length;
                            const yearAbnormal = abnormalMonths[year] || 0;
                            
                            return (
                            <Card key={year} className="border-none shadow-sm bg-white rounded-2xl overflow-hidden">
                                <CardHeader 
                                    className="border-b bg-slate-50 px-6 py-3 cursor-pointer hover:bg-slate-100 transition-colors"
                                    onClick={() => toggleYear(year)}
                                >
                                    <CardTitle className="text-sm font-bold text-slate-700 flex items-center justify-between">
                                        <span className="flex items-center gap-2">
                                            {isExpanded ? (
                                                <ChevronDown className="h-4 w-4 text-slate-400" />
                                            ) : (
                                                <ChevronRight className="h-4 w-4 text-slate-400" />
                                            )}
                                            🗓️ {year} он
                                            <span className="text-xs font-normal text-slate-400">
                                                ({orgCount} байгууллага)
                                            </span>
                                        </span>
                                        <div className="flex items-center gap-3">
                                            {/* Abnormal months input */}
                                            <div 
                                                className="flex items-center gap-1.5 bg-rose-50 rounded-lg px-2 py-1"
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                <AlertTriangle className="h-3.5 w-3.5 text-rose-500" />
                                                <input
                                                    type="number"
                                                    min={0}
                                                    max={paidMonths}
                                                    value={yearAbnormal || ''}
                                                    onChange={(e) => updateAbnormalMonths(year, parseInt(e.target.value) || 0, paidMonths)}
                                                    placeholder="0"
                                                    className="w-8 h-6 text-center text-xs font-bold text-rose-700 bg-white border border-rose-200 rounded focus:outline-none focus:ring-1 focus:ring-rose-400"
                                                />
                                                <span className="text-[10px] text-rose-600">/{paidMonths}</span>
                                            </div>
                                            <Badge 
                                                className={`text-xs font-bold ${
                                                    isFullYear 
                                                        ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100' 
                                                        : paidMonths >= 6 
                                                            ? 'bg-blue-100 text-blue-700 hover:bg-blue-100'
                                                            : 'bg-amber-100 text-amber-700 hover:bg-amber-100'
                                                }`}
                                            >
                                                {paidMonths}/12 сар {isFullYear && '✓'}
                                            </Badge>
                                        </div>
                                    </CardTitle>
                                </CardHeader>
                                {isExpanded && (
                                <CardContent className="p-0">
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="border-b bg-slate-50/50">
                                                    <th className="text-left px-4 py-2 font-semibold text-slate-600 text-xs min-w-[200px]">Байгууллага</th>
                                                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(month => (
                                                        <th key={month} className="text-center px-1 py-2 font-semibold text-slate-500 text-xs w-8">
                                                            {month}
                                                        </th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {Object.entries(groupedByYear[year]).map(([org, months], idx) => {
                                                    const isVoluntary = isVoluntaryInsurance(org);
                                                    return (
                                                    <tr key={`${year}-${org}-${idx}`} className={`border-b last:border-b-0 hover:bg-slate-50/50 ${isVoluntary && !includeVoluntary ? 'opacity-40' : ''}`}>
                                                        <td className="px-4 py-2 font-medium text-slate-700 text-xs max-w-[200px]" title={org}>
                                                            <div className="flex items-center gap-2">
                                                                <span className="truncate">{org}</span>
                                                                {isVoluntary && (
                                                                    <Badge className="shrink-0 text-[9px] px-1.5 py-0 h-4 bg-pink-100 text-pink-600 hover:bg-pink-100">
                                                                        СД
                                                                    </Badge>
                                                                )}
                                                            </div>
                                                        </td>
                                                        {months.map((paid, monthIdx) => (
                                                            <td key={monthIdx} className="text-center px-1 py-2">
                                                                <span className={`text-base ${paid ? '' : 'opacity-30'}`}>
                                                                    {paid ? '✅' : '⬜'}
                                                                </span>
                                                            </td>
                                                        ))}
                                                    </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </CardContent>
                                )}
                            </Card>
                            );
                        })}

                        {/* Actions */}
                        <div className="flex gap-3 flex-wrap">
                            <Button 
                                onClick={handleSave} 
                                disabled={isSaving}
                                className={`h-10 ${hasUnsavedChanges ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-slate-600 hover:bg-slate-700'}`}
                            >
                                {isSaving ? (
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                ) : (
                                    <Save className="h-4 w-4 mr-2" />
                                )}
                                {hasUnsavedChanges ? 'Хадгалах' : 'Дахин хадгалах'}
                            </Button>
                            {!hasUnsavedChanges && savedNdshData && (
                                <Badge variant="outline" className="h-10 px-4 flex items-center gap-2 text-emerald-600 border-emerald-200 bg-emerald-50">
                                    <CheckCircle2 className="h-4 w-4" />
                                    Хадгалагдсан
                                </Badge>
                            )}
                            <Button 
                                variant="outline" 
                                onClick={() => {
                                    setIsReuploadMode(true);
                                    resetState();
                                    setShowUpload(true);
                                    fileInputRef.current && (fileInputRef.current.value = '');
                                }} 
                                className="h-10"
                            >
                                <RefreshCw className="h-4 w-4 mr-2" />
                                Дахин лавлагаа оруулах
                            </Button>
                            <Button onClick={handleBack} className="h-10 bg-indigo-600 hover:bg-indigo-700">
                                <ArrowLeft className="h-4 w-4 mr-2" />
                                Буцах
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
