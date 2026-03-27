'use client';

/**
 * ceo-card.tsx
 *
 * Extracted from company/page.tsx (lines 43–1547).
 * Contains:
 *  - CEO types (SalaryStep, Incentive, Allowance, CEOSetupData)
 *  - CEOCard component — handles all 4 states:
 *      A. Not configured → show "Тохируулах" button
 *      B. Wizard open    → 5-step setup wizard
 *      C. Position set, no employee → "Томилох" button
 *      D. Fully configured → show CEO employee card
 *  - Reset confirmation UI
 */

import * as React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
    Crown, UserPlus, ArrowRight, Loader2, Check, Plus, Trash2,
    ChevronLeft, ChevronRight, RotateCcw, AlertTriangle,
    DollarSign, Gift, Layers, Briefcase,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFirebase, useTenantWrite } from '@/firebase';
import { Timestamp, writeBatch, doc as fsDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { CurrencyInput } from '../../organization/positions/[positionId]/components/currency-input';
import { AppointEmployeeDialog } from '../../organization/[departmentId]/components/flow/appoint-employee-dialog';
import type { Position, Department, PositionLevel, EmploymentType } from '../../organization/types';
import type { Employee } from '@/types';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SalaryStep {
    name: string;
    value: number;
}

export interface Incentive {
    type: string;
    description: string;
    amount: number;
    currency: string;
    unit: '%' | '₮';
    frequency: string;
}

export interface Allowance {
    type: string;
    amount: number;
    currency: string;
    period: 'once' | 'daily' | 'monthly' | 'quarterly' | 'semi-annually' | 'yearly';
}

export interface CEOSetupData {
    levelId: string;
    employmentTypeId: string;
    salaryRange: { min: number; max: number; currency: string };
    salarySteps: { items: SalaryStep[]; activeIndex: number; currency: string };
    incentives: Incentive[];
    allowances: Allowance[];
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface CEOCardProps {
    companyProfile: Record<string, unknown>;
    ceoPosition: Position | undefined | null;
    ceoEmployee: Employee | undefined | null;
    isLoadingCeoPosition: boolean;
    isLoadingCeoEmployee: boolean;
    departments: Department[] | undefined;
    positions: Position[] | undefined;
    positionLevels: PositionLevel[] | undefined;
    employmentTypes: EmploymentType[] | undefined;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function CEOCard({
    companyProfile,
    ceoPosition,
    ceoEmployee,
    isLoadingCeoPosition,
    isLoadingCeoEmployee,
    departments,
    positions,
    positionLevels,
    employmentTypes,
}: CEOCardProps) {
    const { firestore } = useFirebase();
    const { tDoc, tCollection } = useTenantWrite();
    const { toast } = useToast();

    const [showCEOWizard, setShowCEOWizard] = React.useState(false);
    const [wizardStep, setWizardStep] = React.useState(1);
    const [isSettingUpCEO, setIsSettingUpCEO] = React.useState(false);
    const [isResettingCEO, setIsResettingCEO] = React.useState(false);
    const [showResetConfirm, setShowResetConfirm] = React.useState(false);
    const [showAppointDialog, setShowAppointDialog] = React.useState(false);

    const [ceoSetupData, setCeoSetupData] = React.useState<CEOSetupData>({
        levelId: '',
        employmentTypeId: '',
        salaryRange: { min: 0, max: 0, currency: 'MNT' },
        salarySteps: { items: [], activeIndex: 0, currency: 'MNT' },
        incentives: [],
        allowances: [],
    });

    const handleStartWizard = () => {
        setShowCEOWizard(true);
        setWizardStep(1);
        setCeoSetupData({
            levelId: '',
            employmentTypeId: '',
            salaryRange: { min: 0, max: 0, currency: 'MNT' },
            salarySteps: { items: [], activeIndex: 0, currency: 'MNT' },
            incentives: [],
            allowances: [],
        });
    };

    const canProceed = () => {
        if (wizardStep === 1) return !!ceoSetupData.levelId;
        if (wizardStep === 2) return !!ceoSetupData.employmentTypeId;
        return true;
    };

    // ── Setup CEO (atomic batch) ─────────────────────────────────────────────
    const handleSetupCEO = async () => {
        if (!firestore) return;
        setIsSettingUpCEO(true);
        try {
            const existingDept = departments?.find(d => d.name === 'Удирдлага');
            const posDocRef = fsDoc(tCollection('positions'));

            const posData = {
                title: 'Гүйцэтгэх захирал',
                code: 'CEO',
                reportsTo: null,
                filled: 0,
                headcount: 1,
                isApproved: true,
                isActive: true,
                levelId: ceoSetupData.levelId || null,
                employmentTypeId: ceoSetupData.employmentTypeId || null,
                salaryRange: ceoSetupData.salaryRange,
                salarySteps: ceoSetupData.salarySteps,
                incentives: ceoSetupData.incentives,
                allowances: ceoSetupData.allowances,
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now(),
            };

            const batch = writeBatch(firestore);

            if (!existingDept) {
                const deptDocRef = fsDoc(tCollection('departments'));
                batch.set(deptDocRef, {
                    name: 'Удирдлага',
                    type: 'executive',
                    description: 'Байгууллагын удирдлага',
                    createdAt: Timestamp.now(),
                    updatedAt: Timestamp.now(),
                });
                batch.set(posDocRef, { ...posData, departmentId: deptDocRef.id });
                batch.set(tDoc('company', 'profile'), {
                    ceoDepartmentId: deptDocRef.id,
                    ceoPositionId: posDocRef.id,
                    ceoEmployeeId: null,
                    updatedAt: Timestamp.now(),
                }, { merge: true });
            } else {
                batch.set(posDocRef, { ...posData, departmentId: existingDept.id });
                batch.set(tDoc('company', 'profile'), {
                    ceoDepartmentId: existingDept.id,
                    ceoPositionId: posDocRef.id,
                    ceoEmployeeId: null,
                    updatedAt: Timestamp.now(),
                }, { merge: true });
            }

            await batch.commit();
            toast({ title: 'Амжилттай', description: 'Гүйцэтгэх захирлын ажлын байр үүслээ.' });
            setShowCEOWizard(false);
            setWizardStep(1);
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Алдаа гарлаа.';
            toast({ title: 'Алдаа гарлаа', description: msg, variant: 'destructive' });
        } finally {
            setIsSettingUpCEO(false);
        }
    };

    // ── Reset CEO (atomic batch) ─────────────────────────────────────────────
    const handleResetCEO = async () => {
        if (!firestore) return;
        setIsResettingCEO(true);
        try {
            const batch = writeBatch(firestore);

            if (companyProfile.ceoEmployeeId && typeof companyProfile.ceoEmployeeId === 'string') {
                batch.update(tDoc('employees', companyProfile.ceoEmployeeId), {
                    positionId: null, jobTitle: null, departmentId: null, updatedAt: Timestamp.now(),
                });
            }
            if (companyProfile.ceoPositionId && typeof companyProfile.ceoPositionId === 'string') {
                batch.delete(tDoc('positions', companyProfile.ceoPositionId));
            }
            if (companyProfile.ceoDepartmentId && typeof companyProfile.ceoDepartmentId === 'string') {
                const dept = departments?.find(d => d.id === companyProfile.ceoDepartmentId);
                if (dept?.name === 'Удирдлага') {
                    const otherPos = positions?.filter(
                        p => p.departmentId === companyProfile.ceoDepartmentId && p.id !== companyProfile.ceoPositionId
                    );
                    if (!otherPos?.length) {
                        batch.delete(tDoc('departments', companyProfile.ceoDepartmentId as string));
                    }
                }
            }
            batch.update(tDoc('company', 'profile'), {
                ceoDepartmentId: null, ceoPositionId: null, ceoEmployeeId: null, updatedAt: Timestamp.now(),
            });

            await batch.commit();
            toast({ title: 'Амжилттай', description: 'Гүйцэтгэх захирлын тохиргоо устгагдлаа.' });
            setShowResetConfirm(false);
            setTimeout(() => handleStartWizard(), 500);
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Тохиргоо устгахад алдаа гарлаа.';
            toast({ title: 'Алдаа гарлаа', description: msg, variant: 'destructive' });
        } finally {
            setIsResettingCEO(false);
        }
    };

    // ── Appoint complete ─────────────────────────────────────────────────────
    const handleAppointComplete = async (employeeId: string) => {
        if (!firestore) return;
        try {
            const { updateDoc } = await import('firebase/firestore');
            await updateDoc(tDoc('company', 'profile'), { ceoEmployeeId: employeeId, updatedAt: Timestamp.now() });
            toast({ title: 'Амжилттай', description: 'Гүйцэтгэх захирал амжилттай томилогдлоо.' });
        } catch (err) {
            console.error('CEO appointment update error:', err);
        }
    };

    // ── Wizard helpers ───────────────────────────────────────────────────────
    const addSalaryStep = () => setCeoSetupData(p => ({
        ...p, salarySteps: { ...p.salarySteps, items: [...p.salarySteps.items, { name: '', value: 0 }] }
    }));
    const removeSalaryStep = (i: number) => setCeoSetupData(p => ({
        ...p, salarySteps: { ...p.salarySteps, items: p.salarySteps.items.filter((_, idx) => idx !== i) }
    }));
    const addIncentive = () => setCeoSetupData(p => ({
        ...p, incentives: [...p.incentives, { type: '', description: '', amount: 0, currency: 'MNT', unit: '₮', frequency: 'Сар бүр' }]
    }));
    const removeIncentive = (i: number) => setCeoSetupData(p => ({
        ...p, incentives: p.incentives.filter((_, idx) => idx !== i)
    }));
    const addAllowance = () => setCeoSetupData(p => ({
        ...p, allowances: [...p.allowances, { type: '', amount: 0, currency: 'MNT', period: 'monthly' }]
    }));
    const removeAllowance = (i: number) => setCeoSetupData(p => ({
        ...p, allowances: p.allowances.filter((_, idx) => idx !== i)
    }));

    const hasCeoPosition = !!companyProfile.ceoPositionId;
    const hasCeoEmployee = !!companyProfile.ceoEmployeeId;

    return (
        <div className="bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 rounded-xl border border-amber-200/60 overflow-hidden">
            <div className="p-5">
                {/* Header */}
                <div className="flex items-center gap-3 mb-4">
                    <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-200">
                        <Crown className="h-5 w-5 text-white" />
                    </div>
                    <div>
                        <h3 className="font-semibold text-amber-900">Гүйцэтгэх захирал</h3>
                        <p className="text-xs text-amber-600">Байгууллагын удирдлага</p>
                    </div>
                </div>

                {/* State A: Not configured */}
                {!hasCeoPosition && !showCEOWizard && (
                    <div className="text-center py-6">
                        <div className="h-16 w-16 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
                            <Crown className="h-8 w-8 text-amber-400" />
                        </div>
                        <p className="text-sm text-amber-700 mb-4">Гүйцэтгэх захирлын ажлын байр тохируулаагүй байна</p>
                        <Button
                            onClick={handleStartWizard}
                            className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-lg shadow-amber-200"
                        >
                            <Crown className="h-4 w-4 mr-2" />
                            Гүйцэтгэх захирал тохируулах
                        </Button>
                    </div>
                )}

                {/* State B: Wizard open */}
                {!hasCeoPosition && showCEOWizard && (
                    <WizardBody
                        wizardStep={wizardStep}
                        ceoSetupData={ceoSetupData}
                        setCeoSetupData={setCeoSetupData}
                        positionLevels={positionLevels}
                        employmentTypes={employmentTypes}
                        isSettingUpCEO={isSettingUpCEO}
                        canProceed={canProceed}
                        addSalaryStep={addSalaryStep}
                        removeSalaryStep={removeSalaryStep}
                        addIncentive={addIncentive}
                        removeIncentive={removeIncentive}
                        addAllowance={addAllowance}
                        removeAllowance={removeAllowance}
                        onBack={() => { if (wizardStep === 1) { setShowCEOWizard(false); } else { setWizardStep(p => p - 1); } }}
                        onNext={() => setWizardStep(p => p + 1)}
                        onConfirm={handleSetupCEO}
                    />
                )}

                {/* State C: Position set, no employee */}
                {hasCeoPosition && !hasCeoEmployee && !showResetConfirm && (
                    <div className="text-center py-6">
                        <div className="flex items-center justify-center gap-3 mb-4">
                            <div className="h-14 w-14 rounded-xl bg-amber-100 border-2 border-dashed border-amber-300 flex items-center justify-center">
                                <UserPlus className="h-6 w-6 text-amber-400" />
                            </div>
                        </div>
                        <p className="text-sm font-medium text-amber-900 mb-1">Гүйцэтгэх захирал</p>
                        <p className="text-xs text-amber-600 mb-4">Ажлын байр үүссэн • Ажилтан томилогдоогүй</p>
                        <div className="flex items-center justify-center gap-2">
                            <Button
                                onClick={() => setShowAppointDialog(true)}
                                className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-lg shadow-amber-200"
                            >
                                <UserPlus className="h-4 w-4 mr-2" /> Ажилтан томилох
                            </Button>
                            <Button variant="outline" onClick={() => setShowResetConfirm(true)} className="border-amber-300 text-amber-700 hover:bg-amber-50">
                                <RotateCcw className="h-4 w-4 mr-2" /> Шинээр эхлэх
                            </Button>
                        </div>
                    </div>
                )}

                {/* State D: Fully configured */}
                {hasCeoPosition && hasCeoEmployee && !showResetConfirm && (
                    <div className="space-y-4 py-2">
                        {(isLoadingCeoEmployee || isLoadingCeoPosition) ? (
                            <div className="flex items-center gap-4">
                                <Skeleton className="h-16 w-16 rounded-xl" />
                                <div className="flex-1 space-y-2">
                                    <Skeleton className="h-5 w-32" />
                                    <Skeleton className="h-4 w-24" />
                                </div>
                            </div>
                        ) : ceoEmployee ? (
                            <div className="flex items-center gap-4">
                                <Avatar className="h-16 w-16 rounded-xl border-2 border-amber-200 shadow-lg">
                                    <AvatarImage src={(ceoEmployee as any).photoURL} className="object-cover" />
                                    <AvatarFallback className="rounded-xl bg-gradient-to-br from-amber-100 to-orange-100 text-amber-700 text-lg font-semibold">
                                        {ceoEmployee.firstName?.[0]}{ceoEmployee.lastName?.[0]}
                                    </AvatarFallback>
                                </Avatar>
                                <div className="flex-1 min-w-0">
                                    <p className="font-semibold text-amber-900 text-lg">{ceoEmployee.lastName} {ceoEmployee.firstName}</p>
                                    <p className="text-sm text-amber-600 mt-0.5">Гүйцэтгэх захирал</p>
                                    {ceoEmployee.email && <p className="text-xs text-amber-500 mt-1 truncate">{ceoEmployee.email}</p>}
                                </div>
                                <Link href={`/dashboard/employees/${ceoEmployee.id}`} className="flex items-center gap-1 text-xs text-amber-600 hover:text-amber-700 font-medium">
                                    Дэлгэрэнгүй <ArrowRight className="h-3.5 w-3.5" />
                                </Link>
                            </div>
                        ) : (
                            <p className="text-center text-sm text-amber-600 py-4">Томилогдсон ажилтны мэдээлэл олдсонгүй</p>
                        )}
                        <div className="flex justify-end">
                            <Button variant="ghost" size="sm" onClick={() => setShowResetConfirm(true)} className="text-amber-600 hover:text-amber-700 hover:bg-amber-50">
                                <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Шинээр эхлэх
                            </Button>
                        </div>
                    </div>
                )}

                {/* Reset confirmation */}
                {hasCeoPosition && showResetConfirm && (
                    <div className="py-4">
                        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-center">
                            <div className="h-12 w-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-3">
                                <AlertTriangle className="h-6 w-6 text-red-500" />
                            </div>
                            <h4 className="font-semibold text-red-900 mb-2">Шинээр эхлэх</h4>
                            <ul className="text-xs text-red-600 text-left mb-4 space-y-1 max-w-xs mx-auto">
                                <li className="flex items-start gap-2"><span className="text-red-400">•</span>"Гүйцэтгэх захирал" ажлын байрыг устгана</li>
                                {hasCeoEmployee && <li className="flex items-start gap-2"><span className="text-red-400">•</span>Томилогдсон ажилтныг чөлөөлнө</li>}
                                <li className="flex items-start gap-2"><span className="text-red-400">•</span>"Удирдлага" бүтэц нэгжийг устгана (бусад ажлын байр байхгүй бол)</li>
                            </ul>
                            <div className="flex items-center justify-center gap-2">
                                <Button variant="outline" onClick={() => setShowResetConfirm(false)} className="border-red-200 text-red-700 hover:bg-red-50">Цуцлах</Button>
                                <Button onClick={handleResetCEO} disabled={isResettingCEO} className="bg-red-500 hover:bg-red-600 text-white">
                                    {isResettingCEO ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Устгаж байна...</> : <><RotateCcw className="h-4 w-4 mr-2" />Тийм, шинээр эхлэх</>}
                                </Button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Appoint dialog */}
            {ceoPosition && (
                <AppointEmployeeDialog
                    open={showAppointDialog}
                    onOpenChange={setShowAppointDialog}
                    position={ceoPosition}
                    onSuccess={handleAppointComplete}
                />
            )}
        </div>
    );
}

// ─── Wizard body ──────────────────────────────────────────────────────────────

interface WizardBodyProps {
    wizardStep: number;
    ceoSetupData: CEOSetupData;
    setCeoSetupData: React.Dispatch<React.SetStateAction<CEOSetupData>>;
    positionLevels: PositionLevel[] | undefined;
    employmentTypes: EmploymentType[] | undefined;
    isSettingUpCEO: boolean;
    canProceed: () => boolean;
    addSalaryStep: () => void;
    removeSalaryStep: (i: number) => void;
    addIncentive: () => void;
    removeIncentive: (i: number) => void;
    addAllowance: () => void;
    removeAllowance: (i: number) => void;
    onBack: () => void;
    onNext: () => void;
    onConfirm: () => void;
}

function WizardBody({
    wizardStep, ceoSetupData, setCeoSetupData,
    positionLevels, employmentTypes,
    isSettingUpCEO, canProceed,
    addSalaryStep, removeSalaryStep,
    addIncentive, removeIncentive,
    addAllowance, removeAllowance,
    onBack, onNext, onConfirm,
}: WizardBodyProps) {
    const STEPS = [
        { step: 1, icon: Layers, label: 'Зэрэглэл' },
        { step: 2, icon: Briefcase, label: 'Төрөл' },
        { step: 3, icon: DollarSign, label: 'Цалин' },
        { step: 4, icon: Gift, label: 'Хангамж' },
        { step: 5, icon: Check, label: 'Баталгаажуулах' },
    ];

    return (
        <div className="py-4">
            {/* Progress */}
            <div className="flex items-center justify-between mb-6 px-2">
                {STEPS.map(({ step, icon: Icon, label }, index) => (
                    <React.Fragment key={step}>
                        <div className="flex flex-col items-center">
                            <div className={cn(
                                'h-10 w-10 rounded-full flex items-center justify-center text-sm font-medium transition-all',
                                wizardStep === step ? 'bg-amber-500 text-white shadow-lg'
                                    : wizardStep > step ? 'bg-emerald-500 text-white'
                                    : 'bg-amber-100 text-amber-600'
                            )}>
                                {wizardStep > step ? <Check className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                            </div>
                            <span className={cn('text-[10px] mt-1 font-medium', wizardStep >= step ? 'text-amber-700' : 'text-amber-400')}>{label}</span>
                        </div>
                        {index < 4 && <div className={cn('flex-1 h-0.5 mx-1', wizardStep > step ? 'bg-emerald-400' : 'bg-amber-200')} />}
                    </React.Fragment>
                ))}
            </div>

            <ScrollArea className="h-[320px] pr-3">
                {/* Step 1: Level */}
                {wizardStep === 1 && (
                    <div className="space-y-4">
                        <div className="text-center mb-4">
                            <h4 className="font-semibold text-amber-900">Түвшин / Зэрэглэл сонгох</h4>
                            <p className="text-xs text-amber-600 mt-1">Гүйцэтгэх захирлын ажлын байрны зэрэглэлийг сонгоно уу</p>
                        </div>
                        <div className="grid grid-cols-1 gap-2">
                            {positionLevels?.map(level => (
                                <button
                                    key={level.id}
                                    onClick={() => setCeoSetupData(p => ({ ...p, levelId: level.id }))}
                                    className={cn('p-4 rounded-xl border-2 text-left transition-all hover:shadow-md',
                                        ceoSetupData.levelId === level.id ? 'border-amber-500 bg-amber-50 shadow-md' : 'border-amber-100 hover:border-amber-300'
                                    )}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={cn('h-10 w-10 rounded-lg flex items-center justify-center', ceoSetupData.levelId === level.id ? 'bg-amber-500 text-white' : 'bg-amber-100 text-amber-600')}>
                                            <Layers className="h-5 w-5" />
                                        </div>
                                        <p className="font-medium text-amber-900">{level.name}</p>
                                        {ceoSetupData.levelId === level.id && <Check className="h-5 w-5 text-amber-500 ml-auto" />}
                                    </div>
                                </button>
                            ))}
                            {!positionLevels?.length && <p className="text-center text-amber-600 text-sm py-4">Зэрэглэл тохируулаагүй байна. Тохиргоо хэсэгт нэмнэ үү.</p>}
                        </div>
                    </div>
                )}

                {/* Step 2: Employment type */}
                {wizardStep === 2 && (
                    <div className="space-y-4">
                        <div className="text-center mb-4">
                            <h4 className="font-semibold text-amber-900">Ажлын байрны төрөл</h4>
                            <p className="text-xs text-amber-600 mt-1">Хөдөлмөр эрхлэлтийн төрлийг сонгоно уу</p>
                        </div>
                        <div className="grid grid-cols-1 gap-2">
                            {employmentTypes?.map(type => (
                                <button
                                    key={type.id}
                                    onClick={() => setCeoSetupData(p => ({ ...p, employmentTypeId: type.id }))}
                                    className={cn('p-4 rounded-xl border-2 text-left transition-all hover:shadow-md',
                                        ceoSetupData.employmentTypeId === type.id ? 'border-amber-500 bg-amber-50 shadow-md' : 'border-amber-100 hover:border-amber-300'
                                    )}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={cn('h-10 w-10 rounded-lg flex items-center justify-center', ceoSetupData.employmentTypeId === type.id ? 'bg-amber-500 text-white' : 'bg-amber-100 text-amber-600')}>
                                            <Briefcase className="h-5 w-5" />
                                        </div>
                                        <p className="font-medium text-amber-900">{type.name}</p>
                                        {ceoSetupData.employmentTypeId === type.id && <Check className="h-5 w-5 text-amber-500 ml-auto" />}
                                    </div>
                                </button>
                            ))}
                            {!employmentTypes?.length && <p className="text-center text-amber-600 text-sm py-4">Ажлын байрны төрөл тохируулаагүй байна.</p>}
                        </div>
                    </div>
                )}

                {/* Step 3: Salary */}
                {wizardStep === 3 && (
                    <div className="space-y-5">
                        <div className="text-center mb-4">
                            <h4 className="font-semibold text-amber-900">Цалин тохируулах</h4>
                        </div>
                        {/* Salary step count */}
                        <div className="space-y-4 p-4 rounded-xl bg-amber-50/50 border border-amber-100">
                            <Label className="text-sm font-bold text-amber-800">Цалингийн шатлал</Label>
                            <Select
                                value={ceoSetupData.salarySteps.items.length.toString()}
                                onValueChange={(val) => {
                                    const count = parseInt(val);
                                    const cur = [...ceoSetupData.salarySteps.items];
                                    const newItems = count > cur.length
                                        ? [...cur, ...Array(count - cur.length).fill(0).map((_, i) => ({ name: `Шатлал ${cur.length + i + 1}`, value: 0 }))]
                                        : cur.slice(0, count);
                                    setCeoSetupData(p => ({ ...p, salarySteps: { ...p.salarySteps, items: newItems, activeIndex: Math.min(p.salarySteps.activeIndex, newItems.length - 1) } }));
                                }}
                            >
                                <SelectTrigger className="h-10 rounded-lg"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {[1,2,3,4,5,6,7,8,9,10].map(n => <SelectItem key={n} value={n.toString()}>{n} шатлалт</SelectItem>)}
                                </SelectContent>
                            </Select>
                            <div className="space-y-3 max-h-[240px] overflow-y-auto pr-1">
                                {ceoSetupData.salarySteps.items.map((step, index) => (
                                    <div key={index} className={cn('p-4 rounded-xl border space-y-3', ceoSetupData.salarySteps.activeIndex === index ? 'bg-amber-100/50 border-amber-400' : 'bg-white border-amber-200')}>
                                        <Badge
                                            variant={ceoSetupData.salarySteps.activeIndex === index ? 'default' : 'outline'}
                                            className={cn('h-5 px-2 text-[9px] font-bold uppercase cursor-pointer', ceoSetupData.salarySteps.activeIndex === index ? 'bg-amber-500 text-white' : 'text-amber-600')}
                                            onClick={() => setCeoSetupData(p => ({ ...p, salarySteps: { ...p.salarySteps, activeIndex: index } }))}
                                        >
                                            {ceoSetupData.salarySteps.activeIndex === index ? 'Идэвхтэй' : 'Сонгох'}
                                        </Badge>
                                        <Input value={step.name} onChange={e => { const items = [...ceoSetupData.salarySteps.items]; items[index].name = e.target.value; setCeoSetupData(p => ({ ...p, salarySteps: { ...p.salarySteps, items } })); }} placeholder={`Шатлал ${index + 1}`} className="h-9 text-sm" />
                                        <CurrencyInput value={step.value} onValueChange={val => { const items = [...ceoSetupData.salarySteps.items]; items[index].value = val; setCeoSetupData(p => ({ ...p, salarySteps: { ...p.salarySteps, items } })); }} className="h-9" placeholder="Цалингийн дүн" />
                                    </div>
                                ))}
                            </div>
                        </div>
                        {/* Incentives */}
                        <div className="space-y-3 p-4 rounded-xl bg-amber-50/50 border border-amber-100">
                            <div className="flex items-center justify-between">
                                <Label className="text-sm font-bold text-amber-800">Урамшуулал</Label>
                                <Button variant="ghost" size="sm" onClick={addIncentive} className="h-7 text-amber-600 text-xs"><Plus className="h-3.5 w-3.5 mr-1" />Нэмэх</Button>
                            </div>
                            {ceoSetupData.incentives.map((inc, i) => (
                                <div key={i} className="p-3 rounded-xl bg-white border border-amber-200 space-y-2 relative group">
                                    <button onClick={() => removeIncentive(i)} className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-red-100 text-red-500 flex items-center justify-center hover:bg-red-500 hover:text-white transition-all opacity-0 group-hover:opacity-100"><Trash2 className="w-3 h-3" /></button>
                                    <Input value={inc.type} onChange={e => { const n = [...ceoSetupData.incentives]; n[i].type = e.target.value; setCeoSetupData(p => ({ ...p, incentives: n })); }} placeholder="Жишээ: KPI Бонус" className="h-9 text-sm" />
                                    <div className="flex gap-1.5">
                                        <CurrencyInput value={inc.amount} onValueChange={val => { const n = [...ceoSetupData.incentives]; n[i].amount = val; setCeoSetupData(p => ({ ...p, incentives: n })); }} className="h-9 flex-1" />
                                        <Select value={inc.unit} onValueChange={val => { const n = [...ceoSetupData.incentives]; n[i].unit = val as '%'|'₮'; setCeoSetupData(p => ({ ...p, incentives: n })); }}>
                                            <SelectTrigger className="w-14 h-9"><SelectValue /></SelectTrigger>
                                            <SelectContent><SelectItem value="%">%</SelectItem><SelectItem value="₮">₮</SelectItem></SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            ))}
                            {!ceoSetupData.incentives.length && <p className="text-center text-xs text-amber-400 py-2">Урамшуулал нэмэгдээгүй</p>}
                        </div>
                    </div>
                )}

                {/* Step 4: Allowances */}
                {wizardStep === 4 && (
                    <div className="space-y-5">
                        <div className="text-center mb-4">
                            <h4 className="font-semibold text-amber-900">Хангамж тохируулах</h4>
                        </div>
                        <div className="space-y-3 p-4 rounded-xl bg-amber-50/50 border border-amber-100">
                            <div className="flex items-center justify-between">
                                <Label className="text-sm font-bold text-amber-800">Нэмэгдэл хөлс</Label>
                                <Button variant="ghost" size="sm" onClick={addAllowance} className="h-7 text-amber-600 text-xs"><Plus className="h-3.5 w-3.5 mr-1" />Нэмэх</Button>
                            </div>
                            {ceoSetupData.allowances.map((all, i) => (
                                <div key={i} className="p-3 rounded-xl bg-white border border-amber-200 space-y-2 relative group">
                                    <button onClick={() => removeAllowance(i)} className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-red-100 text-red-500 flex items-center justify-center hover:bg-red-500 hover:text-white transition-all opacity-0 group-hover:opacity-100"><Trash2 className="w-3 h-3" /></button>
                                    <Input value={all.type} onChange={e => { const n = [...ceoSetupData.allowances]; n[i].type = e.target.value; setCeoSetupData(p => ({ ...p, allowances: n })); }} placeholder="Жишээ: Унааны мөнгө" className="h-9 text-sm" />
                                    <div className="flex gap-2">
                                        <CurrencyInput value={all.amount} onValueChange={val => { const n = [...ceoSetupData.allowances]; n[i].amount = val; setCeoSetupData(p => ({ ...p, allowances: n })); }} className="h-9 flex-1" />
                                        <Select value={all.period} onValueChange={val => { const n = [...ceoSetupData.allowances]; n[i].period = val as Allowance['period']; setCeoSetupData(p => ({ ...p, allowances: n })); }}>
                                            <SelectTrigger className="h-9 w-36"><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="once">Нэг удаа</SelectItem>
                                                <SelectItem value="daily">Өдөр бүр</SelectItem>
                                                <SelectItem value="monthly">Сар бүр</SelectItem>
                                                <SelectItem value="quarterly">Улирал бүр</SelectItem>
                                                <SelectItem value="semi-annually">Хагас жил</SelectItem>
                                                <SelectItem value="yearly">Жил бүр</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            ))}
                            {!ceoSetupData.allowances.length && <p className="text-center text-xs text-amber-400 py-2">Нэмэгдэл хөлс нэмэгдээгүй</p>}
                        </div>
                    </div>
                )}

                {/* Step 5: Confirm */}
                {wizardStep === 5 && (
                    <div className="space-y-4">
                        <div className="text-center mb-4">
                            <h4 className="font-semibold text-amber-900">Баталгаажуулах</h4>
                        </div>
                        <div className="p-4 rounded-xl bg-amber-50/50 border border-amber-100 grid grid-cols-2 gap-4 text-sm">
                            <div><span className="text-amber-600">Зэрэглэл:</span><p className="font-medium">{positionLevels?.find(l => l.id === ceoSetupData.levelId)?.name || '-'}</p></div>
                            <div><span className="text-amber-600">Төрөл:</span><p className="font-medium">{employmentTypes?.find(t => t.id === ceoSetupData.employmentTypeId)?.name || '-'}</p></div>
                            <div><span className="text-amber-600">Шатлал:</span><p className="font-medium">{ceoSetupData.salarySteps.items.length} шатлал</p></div>
                            <div><span className="text-amber-600">Урамшуулал:</span><p className="font-medium">{ceoSetupData.incentives.length}</p></div>
                        </div>
                        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-center">
                            <Check className="h-10 w-10 text-emerald-500 mx-auto mb-2" />
                            <p className="text-sm font-medium text-emerald-800">"Гүйцэтгэх захирал" ажлын байр үүсгэхэд бэлэн</p>
                        </div>
                    </div>
                )}
            </ScrollArea>

            {/* Navigation */}
            <div className="flex items-center justify-between mt-6 pt-4 border-t border-amber-100">
                <Button variant="ghost" onClick={onBack} className="text-amber-600 hover:text-amber-700">
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    {wizardStep === 1 ? 'Цуцлах' : 'Өмнөх'}
                </Button>
                {wizardStep < 5 ? (
                    <Button onClick={onNext} disabled={!canProceed()} className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white">
                        Үргэлжлүүлэх <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                ) : (
                    <Button onClick={onConfirm} disabled={isSettingUpCEO} className="bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-600 hover:to-green-600 text-white">
                        {isSettingUpCEO ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Үүсгэж байна...</> : <><Check className="h-4 w-4 mr-2" />Баталгаажуулах</>}
                    </Button>
                )}
            </div>
        </div>
    );
}
