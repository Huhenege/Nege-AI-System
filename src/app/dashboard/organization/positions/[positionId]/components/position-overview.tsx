'use client';

import React, { useState, useMemo } from 'react';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
    Briefcase,
    Building2,
    Hash,
    Network,
    Layers,
    FolderKanban,
    Clock,
    HardHat,
    CalendarCheck,
    CalendarX,
    Wallet,
    User
} from 'lucide-react';
import { Position, Department, PositionLevel, JobCategory, EmploymentType, WorkSchedule, WorkingCondition } from '../../../types';
import { doc, updateDoc } from 'firebase/firestore';
import { useFirebase, useMemoFirebase, useDoc, tenantDoc, useTenantWrite } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { generateCode } from '@/lib/code-generator';
import { Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FieldCard, LabeledInput } from '@/components/organization/field-card';

const WORKING_CONDITION_LABELS: Record<WorkingCondition, string> = {
    NORMAL: 'Хэвийн',
    NON_STANDARD: 'Хэвийн бус',
    HEAVY: 'Хүнд',
    HAZARDOUS: 'Хортой / Аюултай',
    EXTREMELY_HAZARDOUS: 'Онцгой хортой / Онцгой аюултай',
};

interface Subsidiary {
    name: string;
    registrationNumber?: string;
}

interface CompanyProfile {
    name?: string;
    subsidiaries?: Subsidiary[];
}

interface PositionOverviewProps {
    position: Position;
    departments: Department[];
    allPositions: Position[];
    levels: PositionLevel[];
    categories: JobCategory[];
    employmentTypes: EmploymentType[];
    schedules: WorkSchedule[];
    validationChecklist?: {
        hasBasicInfo: boolean;
        hasReporting: boolean;
        hasAttributes: boolean;
        hasSettings: boolean;
    };
}

export function PositionOverview({
    position,
    departments,
    allPositions,
    levels,
    categories,
    employmentTypes,
    schedules,
}: PositionOverviewProps) {
    const { firestore } = useFirebase();
    const { tDoc } = useTenantWrite();
    const { toast } = useToast();

    // Local edit state for each field
    const [editTitle, setEditTitle] = useState(position.title || '');
    const [editCode, setEditCode] = useState(position.code || '');
    const [editDepartmentId, setEditDepartmentId] = useState(position.departmentId || '');
    const [editReportsToId, setEditReportsToId] = useState(position.reportsToId || '');
    const [editLevelId, setEditLevelId] = useState(position.levelId || '');
    const [editCategoryId, setEditCategoryId] = useState(position.jobCategoryId || '');
    const [editEmploymentTypeId, setEditEmploymentTypeId] = useState(position.employmentTypeId || '');
    const [editScheduleId, setEditScheduleId] = useState(position.workScheduleId || '');
    const [editWorkingCondition, setEditWorkingCondition] = useState(position.workingCondition || '');
    const [editCompanyType, setEditCompanyType] = useState(position.companyType || 'main');
    const [editSubsidiaryName, setEditSubsidiaryName] = useState(position.subsidiaryName || '');
    const [editCanApproveVacation, setEditCanApproveVacation] = useState(position.permissions?.canApproveVacation || false);
    const [editCanApproveLeave, setEditCanApproveLeave] = useState(position.permissions?.canApproveLeave || false);
    const [editYearlyBudget, setEditYearlyBudget] = useState(position.budget?.yearlyBudget || 0);
    const [editCurrency, setEditCurrency] = useState(position.budget?.currency || 'MNT');

    const posCodeConfigRef = useMemoFirebase(
        ({ firestore, companyPath }) => (firestore ? tenantDoc(firestore, companyPath, 'company', 'positionCodeConfig') : null),
        []
    );
    const { data: posCodeConfig } = useDoc<any>(posCodeConfigRef as any);

    const companyProfileRef = useMemoFirebase(
        ({ firestore, companyPath }) => (firestore ? tenantDoc(firestore, companyPath, 'company', 'profile') : null),
        []
    );
    const { data: companyProfile } = useDoc<CompanyProfile>(companyProfileRef as any);

    // Parse subsidiaries
    const subsidiaries: Subsidiary[] = useMemo(() => {
        if (!companyProfile?.subsidiaries) return [];
        return companyProfile.subsidiaries.map(item => {
            if (typeof item === 'string') {
                return { name: item, registrationNumber: '' };
            }
            return item as Subsidiary;
        });
    }, [companyProfile?.subsidiaries]);

    // Sync edit states when position data changes
    React.useEffect(() => {
        setEditTitle(position.title || '');
        setEditCode(position.code || '');
        setEditDepartmentId(position.departmentId || '');
        setEditReportsToId(position.reportsToId || '');
        setEditLevelId(position.levelId || '');
        setEditCategoryId(position.jobCategoryId || '');
        setEditEmploymentTypeId(position.employmentTypeId || '');
        setEditScheduleId(position.workScheduleId || '');
        setEditWorkingCondition(position.workingCondition || '');
        setEditCompanyType(position.companyType || 'main');
        setEditSubsidiaryName(position.subsidiaryName || '');
        setEditCanApproveVacation(position.permissions?.canApproveVacation || false);
        setEditCanApproveLeave(position.permissions?.canApproveLeave || false);
        setEditYearlyBudget(position.budget?.yearlyBudget || 0);
        setEditCurrency(position.budget?.currency || 'MNT');
    }, [position]);

    // Lookup values
    const department = useMemo(() => departments.find(d => d.id === position.departmentId), [departments, position.departmentId]);
    const supervisor = useMemo(() => allPositions.find(p => p.id === position.reportsToId), [allPositions, position.reportsToId]);
    const level = useMemo(() => levels.find(l => l.id === position.levelId), [levels, position.levelId]);
    const category = useMemo(() => categories.find(c => c.id === position.jobCategoryId), [categories, position.jobCategoryId]);
    const employmentType = useMemo(() => employmentTypes.find(t => t.id === position.employmentTypeId), [employmentTypes, position.employmentTypeId]);
    const schedule = useMemo(() => schedules.find(s => s.id === position.workScheduleId), [schedules, position.workScheduleId]);

    // Generic save helper
    const saveField = async (field: string, value: any) => {
        if (!firestore) return;
        await updateDoc(tDoc('positions', position.id), {
            [field]: value,
            updatedAt: new Date().toISOString(),
        });
        toast({ title: 'Амжилттай хадгалагдлаа' });
    };

    // Reset edit state when dialog opens (sync with current position data)
    const resetEditState = () => {
        setEditTitle(position.title || '');
        setEditCode(position.code || '');
        setEditDepartmentId(position.departmentId || '');
        setEditReportsToId(position.reportsToId || '');
        setEditLevelId(position.levelId || '');
        setEditCategoryId(position.jobCategoryId || '');
        setEditEmploymentTypeId(position.employmentTypeId || '');
        setEditScheduleId(position.workScheduleId || '');
        setEditWorkingCondition(position.workingCondition || '');
        setEditCompanyType(position.companyType || 'main');
        setEditSubsidiaryName(position.subsidiaryName || '');
        setEditCanApproveVacation(position.permissions?.canApproveVacation || false);
        setEditCanApproveLeave(position.permissions?.canApproveLeave || false);
        setEditYearlyBudget(position.budget?.yearlyBudget || 0);
        setEditCurrency(position.budget?.currency || 'MNT');
    };

    // Generate code helper
    const handleGenerateCode = async () => {
        if (!firestore || !posCodeConfigRef) return;
        try {
            const { runTransaction } = await import('firebase/firestore');
            await runTransaction(firestore, async (transaction) => {
                const configDoc = await transaction.get(posCodeConfigRef);
                if (configDoc.exists()) {
                    const configData = configDoc.data();
                    const currentNum = configData.nextNumber || 1;
                    const generated = generateCode({
                        prefix: configData.prefix || '',
                        digitCount: configData.digitCount || 4,
                        nextNumber: currentNum
                    });
                    setEditCode(generated);
                    transaction.update(posCodeConfigRef, {
                        nextNumber: currentNum + 1
                    });
                }
            });
        } catch (e) {
            toast({ title: "Код үүсгэхэд алдаа гарлаа", variant: "destructive" });
        }
    };

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {/* Ажлын байрны нэр */}
                    <FieldCard
                        icon={Briefcase}
                        title="Ажлын байрны нэр"
                        value={position.title || 'Оруулаагүй'}
                        isEmpty={!position.title}
                        isLocked={position.isApproved}
                        editContent={
                            <LabeledInput label="Ажлын байрны нэр">
                                <Input
                                    value={editTitle}
                                    onChange={(e) => setEditTitle(e.target.value)}
                                    placeholder="Жишээ: Ахлах менежер"
                                    className="h-12 rounded-xl"
                                />
                            </LabeledInput>
                        }
                        onSave={async () => {
                            await saveField('title', editTitle);
                        }}
                    />

                    {/* Код */}
                    <FieldCard
                        icon={Hash}
                        title="Код"
                        value={position.code ? (
                            <code className="bg-primary/10 text-primary px-2 py-0.5 rounded text-sm font-mono">
                                {position.code}
                            </code>
                        ) : 'Кодгүй'}
                        isEmpty={!position.code}
                        isLocked={position.isApproved}
                        editContent={
                            <LabeledInput label="Ажлын байрны код">
                                <div className="flex gap-2">
                                    <Input
                                        value={editCode}
                                        onChange={(e) => setEditCode(e.target.value.toUpperCase())}
                                        placeholder="Жишээ: POS-0001"
                                        className="h-12 rounded-xl font-mono uppercase flex-1"
                                    />
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={handleGenerateCode}
                                        className="h-12 px-4 rounded-xl"
                                        title="Автомат код үүсгэх"
                                    >
                                        <Wand2 className="w-5 h-5" />
                                    </Button>
                                </div>
                            </LabeledInput>
                        }
                        onSave={async () => {
                            await saveField('code', editCode.trim().toUpperCase());
                        }}
                    />

                    {/* Компани */}
                    <FieldCard
                        icon={Building2}
                        title="Компани"
                        value={
                            position.companyType === 'subsidiary' && position.subsidiaryName
                                ? position.subsidiaryName
                                : companyProfile?.name || 'Үндсэн компани'
                        }
                        editContent={
                            <LabeledInput label="Компани сонгох">
                                <Select
                                    value={editCompanyType === 'subsidiary' && editSubsidiaryName ? editSubsidiaryName : 'main'}
                                    onValueChange={(val) => {
                                        if (val === 'main') {
                                            setEditCompanyType('main');
                                            setEditSubsidiaryName('');
                                        } else {
                                            setEditCompanyType('subsidiary');
                                            setEditSubsidiaryName(val);
                                        }
                                    }}
                                >
                                    <SelectTrigger className="h-12 rounded-xl">
                                        <SelectValue placeholder="Сонгох" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="main">
                                            <div className="flex items-center gap-2">
                                                <Building2 className="w-4 h-4 text-primary" />
                                                {companyProfile?.name || 'Үндсэн компани'}
                                            </div>
                                        </SelectItem>
                                        {subsidiaries.length > 0 && (
                                            <>
                                                <div className="px-2 py-1.5 text-xs text-muted-foreground font-medium">
                                                    Охин компаниуд
                                                </div>
                                                {subsidiaries.map((sub, idx) => (
                                                    <SelectItem key={idx} value={sub.name}>
                                                        <div className="flex items-center gap-2">
                                                            <Building2 className="w-4 h-4 text-indigo-500" />
                                                            {sub.name}
                                                        </div>
                                                    </SelectItem>
                                                ))}
                                            </>
                                        )}
                                    </SelectContent>
                                </Select>
                            </LabeledInput>
                        }
                        onSave={async () => {
                            if (!firestore) return;
                            await updateDoc(tDoc('positions', position.id), {
                                companyType: editCompanyType,
                                subsidiaryName: editCompanyType === 'subsidiary' ? editSubsidiaryName : '',
                                updatedAt: new Date().toISOString(),
                            });
                            toast({ title: 'Амжилттай хадгалагдлаа' });
                        }}
                    />

                    {/* Нэгж / Хэлтэс */}
                    <FieldCard
                        icon={FolderKanban}
                        title="Нэгж / Хэлтэс"
                        value={department?.name || 'Оноогоогүй'}
                        isEmpty={!department}
                        isLocked={position.isApproved}
                        editContent={
                            <LabeledInput label="Нэгж / Хэлтэс сонгох">
                                <Select value={editDepartmentId} onValueChange={setEditDepartmentId}>
                                    <SelectTrigger className="h-12 rounded-xl">
                                        <SelectValue placeholder="Сонгох" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {departments.map(d => (
                                            <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </LabeledInput>
                        }
                        onSave={async () => {
                            await saveField('departmentId', editDepartmentId);
                        }}
                    />

                    {/* Шууд удирдлага */}
                    <FieldCard
                        icon={Network}
                        title="Шууд удирдлага"
                        value={supervisor?.title || 'Дээд шат'}
                        isLocked={position.isApproved}
                        editContent={
                            <LabeledInput label="Шууд удирдлага сонгох">
                                <Select
                                    value={editReportsToId || 'none'}
                                    onValueChange={(val) => setEditReportsToId(val === 'none' ? '' : val)}
                                >
                                    <SelectTrigger className="h-12 rounded-xl">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">Удирдлагагүй (Дээд шат)</SelectItem>
                                        {allPositions.filter(p => p.id !== position.id).map(p => (
                                            <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </LabeledInput>
                        }
                        onSave={async () => {
                            await saveField('reportsToId', editReportsToId);
                        }}
                    />

                    {/* Түвшин */}
                    <FieldCard
                        icon={Layers}
                        title="Түвшин / Зэрэглэл"
                        value={level?.name || 'Тохируулаагүй'}
                        isEmpty={!level}
                        isLocked={position.isApproved}
                        editContent={
                            <LabeledInput label="Түвшин сонгох">
                                <Select value={editLevelId} onValueChange={setEditLevelId}>
                                    <SelectTrigger className="h-12 rounded-xl">
                                        <SelectValue placeholder="Сонгох" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {levels.map(l => (
                                            <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </LabeledInput>
                        }
                        onSave={async () => {
                            await saveField('levelId', editLevelId);
                        }}
                    />

                    {/* Мэргэжлийн ангилал */}
                    <FieldCard
                        icon={FolderKanban}
                        title="Мэргэжлийн ангилал"
                        value={category?.name || 'Оноогоогүй'}
                        isEmpty={!category}
                        editContent={
                            <LabeledInput label="Мэргэжлийн ангилал (ЯАМАТ)">
                                <Select value={editCategoryId} onValueChange={setEditCategoryId}>
                                    <SelectTrigger className="h-12 rounded-xl">
                                        <SelectValue placeholder="Сонгох" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {categories.map(c => (
                                            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </LabeledInput>
                        }
                        onSave={async () => {
                            await saveField('jobCategoryId', editCategoryId);
                        }}
                    />

                    {/* Ажлын байрны төрөл */}
                    <FieldCard
                        icon={User}
                        title="Ажлын байрны төрөл"
                        value={employmentType?.name || 'Бүртгэгдээгүй'}
                        isEmpty={!employmentType}
                        isLocked={position.isApproved}
                        editContent={
                            <LabeledInput label="Ажлын байрны төрөл">
                                <Select value={editEmploymentTypeId} onValueChange={setEditEmploymentTypeId}>
                                    <SelectTrigger className="h-12 rounded-xl">
                                        <SelectValue placeholder="Сонгох" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {employmentTypes.map(t => (
                                            <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </LabeledInput>
                        }
                        onSave={async () => {
                            await saveField('employmentTypeId', editEmploymentTypeId);
                        }}
                    />

                    {/* Цагийн хуваарь */}
                    <FieldCard
                        icon={Clock}
                        title="Цагийн хуваарь"
                        value={schedule?.name || 'Сонгоогүй'}
                        isEmpty={!schedule}
                        editContent={
                            <LabeledInput label="Цагийн хуваарь">
                                <Select value={editScheduleId || '__none__'} onValueChange={(val) => setEditScheduleId(val === '__none__' ? '' : val)}>
                                    <SelectTrigger className="h-12 rounded-xl">
                                        <SelectValue placeholder="Сонгох" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="__none__">Сонгоогүй</SelectItem>
                                        {schedules.filter((s: any) => s?.isActive !== false).map(s => (
                                            <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </LabeledInput>
                        }
                        onSave={async () => {
                            await saveField('workScheduleId', editScheduleId || null);
                        }}
                    />

                    {/* Хөдөлмөрийн нөхцөл */}
                    <FieldCard
                        icon={HardHat}
                        title="Хөдөлмөрийн нөхцөл"
                        value={
                            position.workingCondition
                                ? WORKING_CONDITION_LABELS[position.workingCondition as WorkingCondition] || position.workingCondition
                                : 'Тохируулаагүй'
                        }
                        isEmpty={!position.workingCondition}
                        isLocked={position.isApproved}
                        editContent={
                            <LabeledInput label="Хөдөлмөрийн нөхцөл">
                                <Select value={editWorkingCondition || '__none__'} onValueChange={(val) => setEditWorkingCondition(val === '__none__' ? '' : val)}>
                                    <SelectTrigger className="h-12 rounded-xl">
                                        <SelectValue placeholder="Сонгох" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="__none__">Сонгоогүй</SelectItem>
                                        {Object.entries(WORKING_CONDITION_LABELS).map(([k, label]) => (
                                            <SelectItem key={k} value={k}>{label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </LabeledInput>
                        }
                        onSave={async () => {
                            await saveField('workingCondition', editWorkingCondition || null);
                        }}
                    />

                    {/* Амралт батлах эрх */}
                    <FieldCard
                        icon={CalendarCheck}
                        title="Амралт батлах эрх"
                        value={position.permissions?.canApproveVacation ? 'Тийм' : 'Үгүй'}
                        editContent={
                            <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50 dark:bg-slate-800">
                                <span className="text-sm font-medium">Амралт батлах эрхтэй эсэх</span>
                                <Switch
                                    checked={editCanApproveVacation}
                                    onCheckedChange={setEditCanApproveVacation}
                                />
                            </div>
                        }
                        onSave={async () => {
                            if (!firestore) return;
                            await updateDoc(tDoc('positions', position.id), {
                                'permissions.canApproveVacation': editCanApproveVacation,
                                updatedAt: new Date().toISOString(),
                            });
                            toast({ title: 'Амжилттай хадгалагдлаа' });
                        }}
                    />

                    {/* Чөлөө батлах эрх */}
                    <FieldCard
                        icon={CalendarX}
                        title="Чөлөө батлах эрх"
                        value={position.permissions?.canApproveLeave ? 'Тийм' : 'Үгүй'}
                        editContent={
                            <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50 dark:bg-slate-800">
                                <span className="text-sm font-medium">Чөлөө батлах эрхтэй эсэх</span>
                                <Switch
                                    checked={editCanApproveLeave}
                                    onCheckedChange={setEditCanApproveLeave}
                                />
                            </div>
                        }
                        onSave={async () => {
                            if (!firestore) return;
                            await updateDoc(tDoc('positions', position.id), {
                                'permissions.canApproveLeave': editCanApproveLeave,
                                updatedAt: new Date().toISOString(),
                            });
                            toast({ title: 'Амжилттай хадгалагдлаа' });
                        }}
                    />

                    {/* Жилийн төсөв */}
                    <FieldCard
                        icon={Wallet}
                        title="Жилийн төсөв"
                        value={
                            position.budget?.yearlyBudget
                                ? `${position.budget.yearlyBudget.toLocaleString()} ${position.budget.currency === 'MNT' ? '₮' : '$'}`
                                : 'Тодорхойгүй'
                        }
                        isEmpty={!position.budget?.yearlyBudget}
                        editContent={
                            <LabeledInput label="Жилийн төсөв">
                                <div className="flex gap-2">
                                    <Input
                                        type="number"
                                        value={editYearlyBudget}
                                        onChange={(e) => setEditYearlyBudget(Number(e.target.value))}
                                        className="h-12 rounded-xl flex-1"
                                        placeholder="0"
                                    />
                                    <Select value={editCurrency} onValueChange={setEditCurrency}>
                                        <SelectTrigger className="w-24 h-12 rounded-xl">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="MNT">₮</SelectItem>
                                            <SelectItem value="USD">$</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </LabeledInput>
                        }
                        onSave={async () => {
                            if (!firestore) return;
                            await updateDoc(tDoc('positions', position.id), {
                                budget: {
                                    yearlyBudget: editYearlyBudget,
                                    currency: editCurrency,
                                },
                                updatedAt: new Date().toISOString(),
                            });
                            toast({ title: 'Амжилттай хадгалагдлаа' });
                        }}
                    />
        </div>
    );
}
