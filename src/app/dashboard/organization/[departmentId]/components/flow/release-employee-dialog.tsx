'use client';

import * as React from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Search, UserPlus, Loader2, GitBranch, ChevronRight, FileText, Check, X, Wand2, ExternalLink, Calendar as CalendarIcon, Clock, UserX, AlertTriangle, UserMinus, XCircle, Info } from 'lucide-react';
import { Employee } from '@/types';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useCollection, useFirebase, useDoc, useTenantWrite } from '@/firebase';
import { collection, query, where, doc, Timestamp, writeBatch, increment, arrayUnion, getDoc, getDocs, deleteDoc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { Position } from '../../../types';
import { ERTemplate, ERDocument } from '../../../../employment-relations/types';
import { generateDocumentContent } from '../../../../employment-relations/utils';
import { getNextDocumentNumber } from '../../../../employment-relations/services/document-numbering';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { mn } from 'date-fns/locale';
import { Switch } from '@/components/ui/switch';
import { useEmployeeProfile } from '@/hooks/use-employee-profile';
import {
    createOffboardingProjects,
    OffboardingStage,
    OffboardingStageTaskPlan,
} from '@/lib/offboarding-project-creator';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import Link from 'next/link';

const ACTION_REQUIREMENTS: Record<string, Array<{ label: string; key: string }>> = {
    release_company: [{ label: 'Ажлаас чөлөөлөх огноо', key: 'releaseDate' }],
    release_employee: [{ label: 'Ажлаас чөлөөлөх огноо', key: 'releaseDate' }],
    release_temporary: [{ label: 'Түр чөлөөлөх огноо', key: 'releaseDate' }],
};

interface ReleaseEmployeeDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    employee: Employee | null;
    position: Position | null;
}

export function ReleaseEmployeeDialog({
    open,
    onOpenChange,
    employee,
    position,
}: ReleaseEmployeeDialogProps) {
    const { firestore, user: firebaseUser } = useFirebase();
    const { tDoc, tCollection } = useTenantWrite();
    const { toast } = useToast();
    const router = useRouter();
    const { employeeProfile: currentUserProfile } = useEmployeeProfile();
    const [step, setStep] = React.useState(1);
    const [selectedActionId, setSelectedActionId] = React.useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [customInputValues, setCustomInputValues] = React.useState<Record<string, any>>({});
    const [enableOffboarding, setEnableOffboarding] = React.useState(false);
    const [taskPlanByStage, setTaskPlanByStage] = React.useState<Record<string, Record<string, { selected: boolean; dueDate?: string; ownerId?: string }>>>({});

    const showActionNotConfiguredToast = React.useCallback((actionName?: string) => {
        toast({
            title: 'Үйлдлийн загвар тохируулаагүй байна',
            description: (
                <div className="space-y-1">
                    <div>
                        {actionName ? `"${actionName}"` : 'Энэ үйлдэл'} дээр “Ашиглах загвар” тохируулаагүй тул үргэлжлүүлэх боломжгүй.
                    </div>
                    <Link className="underline font-medium" href="/dashboard/organization/settings">
                        Тохируулах хэсэг рүү очих (Үйлдэл tab)
                    </Link>
                </div>
            ),
            variant: 'destructive',
        });
    }, [toast]);

    const handleSelectReleaseType = React.useCallback(async (type: { id: string; name: string }) => {
        if (!firestore) return;
        setSelectedActionId(type.id);
        try {
            const actionSnap = await getDoc(tDoc('organization_actions', type.id));
            const cfg = actionSnap.exists() ? (actionSnap.data() as any) : null;
            if (!cfg?.templateId) {
                showActionNotConfiguredToast(type.name);
                return;
            }
            const reqs = ACTION_REQUIREMENTS[type.id];
            if (reqs && reqs.length > 0) {
                const mappings = cfg?.dateMappings || {};
                const missing = reqs.some((r) => !mappings?.[r.key]);
                if (missing) {
                    toast({
                        title: 'Огнооны талбар тохируулаагүй байна',
                        description: (
                            <div className="space-y-1">
                                <div>Шаардлагатай огнооны талбаруудыг “Үйлдэл” тохиргооноос холбоно уу.</div>
                                <Link className="underline font-medium" href="/dashboard/organization/settings">
                                    Тохируулах хэсэг рүү очих (Үйлдэл tab)
                                </Link>
                            </div>
                        ),
                        variant: 'destructive',
                    });
                    return;
                }
            }
        } catch (e) {
            console.error(e);
            toast({
                title: 'Алдаа гарлаа',
                description: 'Үйлдлийн тохиргоо шалгахад алдаа гарлаа.',
                variant: 'destructive',
            });
            return;
        }
        setStep(2);
    }, [firestore, showActionNotConfiguredToast, toast]);

    // Reset state on open
    React.useEffect(() => {
        if (open) {
            setStep(1);
            setSelectedActionId(null);
            setCustomInputValues({});
            setEnableOffboarding(false);
            setTaskPlanByStage({});
        }
    }, [open]);

    // Fetch System Action Config based on selection
    const actionConfigRef = React.useMemo(() =>
        firestore && selectedActionId ? doc(firestore, 'organization_actions', selectedActionId) : null
        , [firestore, selectedActionId]);
    const { data: actionConfig } = useDoc<any>(actionConfigRef);

    // Fetch Template if configured
    const templateRef = React.useMemo(() =>
        firestore && actionConfig?.templateId ? doc(firestore, 'er_templates', actionConfig.templateId) : null
        , [firestore, actionConfig?.templateId]);
    const { data: templateData, isLoading: templateLoading } = useDoc<ERTemplate>(templateRef as any);

    const employeesQuery = React.useMemo(() =>
        firestore
            ? query(collection(firestore, 'employees'), where('status', 'in', ['active', 'active_probation', 'active_permanent']))
            : null
        , [firestore]);
    const { data: employees } = useCollection<Employee>(employeesQuery as any);

    const offboardingProjectsQuery = React.useMemo(() => {
        if (!firestore || !employee?.id) return null;
        return query(
            collection(firestore, 'projects'),
            where('type', '==', 'offboarding'),
            where('offboardingEmployeeId', '==', employee.id),
        );
    }, [firestore, employee?.id]);
    const { data: existingOffboardingProjects } = useCollection<any>(offboardingProjectsQuery as any);

    // Check if employee has pending (unapproved) appointment documents
    const pendingAppointmentDocsQuery = React.useMemo(() => {
        if (!firestore || !employee?.id) return null;
        return query(
            collection(firestore, 'er_documents'),
            where('employeeId', '==', employee.id),
            where('metadata.actionId', 'in', ['appointment_permanent', 'appointment_probation', 'appointment_reappoint', 'appointment_new', 'appointment_internal', 'appointment_transfer'])
        );
    }, [firestore, employee?.id]);
    const { data: pendingAppointmentDocs } = useCollection<ERDocument>(pendingAppointmentDocsQuery as any);

    // Check if employee is in "Томилогдож буй" status with unapproved appointment
    const hasPendingAppointment = React.useMemo(() => {
        if (employee?.status !== 'appointing') return false;
        if (!pendingAppointmentDocs?.length) return false;
        // Check if any appointment doc is not yet signed/approved
        return pendingAppointmentDocs.some(doc => 
            !['SIGNED', 'APPROVED', 'ACKNOWLEDGED', 'SENT_TO_EMPLOYEE'].includes(doc.status)
        );
    }, [employee?.status, pendingAppointmentDocs]);

    const offboardingConfigRef = React.useMemo(() => {
        if (!firestore) return null;
        return doc(firestore, 'settings', 'offboarding');
    }, [firestore]);
    const { data: offboardingConfig } = useDoc<any>(offboardingConfigRef as any);

    const offboardingStages = React.useMemo(() => {
        return (offboardingConfig?.stages || []) as OffboardingStage[];
    }, [offboardingConfig]);

    const stageCount = offboardingStages.length || 4;
    const stageForStep = React.useMemo(() => {
        // step 3 => stage index 0
        const idx = step - 3;
        if (idx < 0) return null;
        return offboardingStages[idx] || null;
    }, [step, offboardingStages]);

    const getReleaseStartDate = React.useCallback((customInputsPayload: Record<string, any>) => {
        const raw = customInputsPayload['releaseDate'] || customInputsPayload['Ажлаас чөлөөлөх огноо'] || null;
        if (typeof raw === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
        return format(new Date(), 'yyyy-MM-dd');
    }, []);

    const isValidDateString = React.useCallback((val?: string) => {
        return !!val && /^\d{4}-\d{2}-\d{2}$/.test(val);
    }, []);

    const getDefaultDueDateForIndex = React.useCallback((startDateStr: string, idx: number) => {
        const offsets = [7, 14, 21, 30];
        const off = offsets[idx] ?? 30;
        const base = new Date(startDateStr);
        base.setDate(base.getDate() + off);
        return format(base, 'yyyy-MM-dd');
    }, []);

    const setTaskSelected = React.useCallback((stageId: string, taskId: string, selected: boolean, stageIdx: number, startDateStr: string) => {
        setTaskPlanByStage((prev) => {
            const stagePlan = { ...(prev[stageId] || {}) };
            const cur = stagePlan[taskId] || { selected: false };
            const initiatorId = currentUserProfile?.id || firebaseUser?.uid || '';
            stagePlan[taskId] = {
                ...cur,
                selected,
                dueDate: selected ? (cur.dueDate || getDefaultDueDateForIndex(startDateStr, stageIdx)) : cur.dueDate,
                ownerId: selected ? (cur.ownerId || initiatorId) : cur.ownerId,
            };
            return { ...prev, [stageId]: stagePlan };
        });
    }, [currentUserProfile?.id, firebaseUser?.uid, getDefaultDueDateForIndex]);

    const setTaskDueDate = React.useCallback((stageId: string, taskId: string, dueDate: string) => {
        setTaskPlanByStage((prev) => {
            const stagePlan = { ...(prev[stageId] || {}) };
            const cur = stagePlan[taskId] || { selected: true };
            stagePlan[taskId] = { ...cur, dueDate };
            return { ...prev, [stageId]: stagePlan };
        });
    }, []);

    const setTaskOwner = React.useCallback((stageId: string, taskId: string, ownerId: string) => {
        setTaskPlanByStage((prev) => {
            const stagePlan = { ...(prev[stageId] || {}) };
            const cur = stagePlan[taskId] || { selected: true };
            stagePlan[taskId] = { ...cur, ownerId };
            return { ...prev, [stageId]: stagePlan };
        });
    }, []);

    const buildOffboardingOverrides = React.useCallback((): OffboardingStageTaskPlan[] => {
        return (offboardingStages || []).map((stage) => {
            const stagePlan = taskPlanByStage[stage.id] || {};
            const tasks = Object.entries(stagePlan)
                .filter(([, p]) => p.selected)
                .map(([templateTaskId, p]) => ({
                    templateTaskId,
                    dueDate: p.dueDate!,
                    ownerId: p.ownerId!,
                }));
            return { stageId: stage.id, tasks };
        });
    }, [offboardingStages, taskPlanByStage]);

    // Normalize customInputs to guarantee unique keys in UI/state, even if template contains duplicates.
    const normalizedCustomInputs = React.useMemo(() => {
        const inputs = templateData?.customInputs || [];
        const counts = new Map<string, number>();
        return inputs.map((input: any, index: number) => {
            const baseKey = String(input?.key || '').trim();
            const prev = counts.get(baseKey) ?? 0;
            counts.set(baseKey, prev + 1);

            const normalizedKey = baseKey
                ? (prev === 0 ? baseKey : `${baseKey}__${prev + 1}`)
                : `__input_${index}`;

            return {
                ...input,
                __baseKey: baseKey,
                __normalizedKey: normalizedKey,
                __index: index,
            };
        });
    }, [templateData]);

    // Initialize custom inputs when template takes effect
    React.useEffect(() => {
        if (normalizedCustomInputs.length > 0) {
            const initialValues: Record<string, any> = {};
            normalizedCustomInputs.forEach((input: any) => {
                initialValues[input.__normalizedKey] = '';
            });
            setCustomInputValues(initialValues);
            return;
        }
        setCustomInputValues({});
    }, [normalizedCustomInputs]);

    // Handle canceling pending appointment (no release document created)
    const handleCancelPendingAppointment = async () => {
        if (!firestore || !employee || !position || !firebaseUser) return;
        
        setIsSubmitting(true);
        try {
            const batch = writeBatch(firestore);
            let deletedDocsCount = 0;
            
            // 1. Delete pending ER documents (appointment docs that are not signed/approved)
            if (pendingAppointmentDocs?.length) {
                for (const erDoc of pendingAppointmentDocs) {
                    if (!['SIGNED', 'APPROVED', 'ACKNOWLEDGED', 'SENT_TO_EMPLOYEE'].includes(erDoc.status)) {
                        const erDocRef = tDoc('er_documents', erDoc.id);
                        batch.delete(erDocRef);
                        deletedDocsCount++;
                    }
                }
            }
            
            // 2. Delete onboarding processes and projects
            const onboardingProcessQuery = query(
                tCollection('onboarding_processes'),
                where('employeeId', '==', employee.id)
            );
            const onboardingSnap = await getDocs(onboardingProcessQuery);
            for (const onboardingDoc of onboardingSnap.docs) {
                batch.delete(onboardingDoc.ref);
            }
            
            const onboardingProjectsQuery = query(
                tCollection('projects'),
                where('type', '==', 'onboarding'),
                where('onboardingEmployeeId', '==', employee.id)
            );
            const projectsSnap = await getDocs(onboardingProjectsQuery);
            for (const projectDoc of projectsSnap.docs) {
                batch.delete(projectDoc.ref);
            }
            
            // 3. Update employee: revert to pre-appointment status
            const empRef = tDoc('employees', employee.id);
            batch.update(empRef, {
                status: 'active_recruitment',
                lifecycleStage: 'recruitment',
                positionId: null,
                jobTitle: null,
                departmentId: null,
                updatedAt: Timestamp.now()
            });
            
            // 4. Decrement position filled count
            const posRef = tDoc('positions', position.id);
            batch.update(posRef, {
                filled: increment(-1),
                updatedAt: Timestamp.now()
            });
            
            await batch.commit();
            
            toast({
                title: 'Томилгоо цуцлагдлаа',
                description: `Ажилтан томилогдохын өмнөх төлөвт буцлаа.${deletedDocsCount > 0 ? ` ${deletedDocsCount} бичиг баримт устгагдлаа.` : ''}`,
            });
            
            onOpenChange(false);
            router.refresh();
        } catch (err) {
            console.error('Cancel appointment error:', err);
            toast({
                title: 'Алдаа гарлаа',
                description: 'Томилгоо цуцлахад алдаа гарлаа.',
                variant: 'destructive',
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleRelease = async (opts?: { createOffboarding?: boolean }) => {
        if (!firestore || !employee || !position || !firebaseUser) return;

        setIsSubmitting(true);
        try {
            // Build customInputs payload with unique keys (and keep the first occurrence of base keys for compatibility)
            const customInputsPayload: Record<string, any> = {};
            normalizedCustomInputs.forEach((input: any) => {
                const normalizedKey = input.__normalizedKey as string;
                const baseKey = input.__baseKey as string;
                const val = customInputValues?.[normalizedKey] ?? '';
                customInputsPayload[normalizedKey] = val;
                if (baseKey && customInputsPayload[baseKey] === undefined) {
                    customInputsPayload[baseKey] = val;
                }
            });

            if (!employee?.id || !position?.id) {
                throw new Error('Ажилтан эсвэл ажлын байрны мэдээлэл дутуу байна');
            }

            const batch = writeBatch(firestore);

            // 1. Update Employee: Clear position data and set lifecycleStage to offboarding
            const departureHistoryEntry = {
                type: 'departure',
                date: new Date().toISOString(),
                position: position?.title || null,
                positionId: position?.id || null,
                departmentId: position?.departmentId || null,
                reason: selectedActionId || null,
                lastWorkingDate: customInputsPayload['releaseDate'] || customInputsPayload['Ажлаас чөлөөлөх огноо'] || null,
                note: `${new Date().getFullYear()} онд ажлаас гарсан`
            };

            // Determine the transitional or final status based on release type and whether ER doc will be created
            const willCreateERDoc = !!templateData;
            let releaseStatus: string;
            if (selectedActionId === 'release_temporary') {
                // Түр чөлөөлөх: баримт байвал түр түдгэлзүүлсэн, баримтгүй бол шууд Түр эзгүй
                releaseStatus = willCreateERDoc ? 'suspended' : 'on_leave';
            } else {
                // Бүрэн чөлөөлөх: баримт байвал Чөлөөлөгдөж буй (баталгаажихыг хүлээнэ), баримтгүй бол шууд Ажлаас гарсан
                releaseStatus = willCreateERDoc ? 'releasing' : 'terminated';
            }

            const empRef = tDoc('employees', employee.id);
            batch.update(empRef, {
                positionId: null,
                jobTitle: null,
                departmentId: null,
                status: releaseStatus,
                lifecycleStage: 'offboarding',
                employmentHistory: arrayUnion(departureHistoryEntry),
                updatedAt: Timestamp.now()
            });

            // 2. Decrement Position Filled Count
            const posRef = tDoc('positions', position.id);
            batch.update(posRef, {
                filled: increment(-1),
                updatedAt: Timestamp.now()
            });

            // 3. Create ER Document if template is configured (optional)
            if (templateData) {
                try {
                    // Get document number if documentTypeId exists
                    let documentNumber: string | undefined;
                    if (templateData.documentTypeId) {
                        try {
                            documentNumber = await getNextDocumentNumber(firestore, templateData.documentTypeId);
                        } catch (numErr) {
                            console.warn("Document number generation failed:", numErr);
                        }
                    }

                    const docContent = generateDocumentContent(templateData.content || '', {
                        employee,
                        position,
                        customInputs: customInputsPayload,
                        company: null,
                        system: {
                            date: format(new Date(), 'yyyy-MM-dd'),
                            year: format(new Date(), 'yyyy'),
                            month: format(new Date(), 'MM'),
                            day: format(new Date(), 'dd'),
                            user: firebaseUser?.displayName || 'Системийн хэрэглэгч',
                            ...(documentNumber ? { documentNumber } : {})
                        },
                    });

                    const erDocRef = doc(tCollection('er_documents'));
                    batch.set(erDocRef, {
                        ...(documentNumber ? { documentNumber } : {}),
                        documentTypeId: templateData.documentTypeId || null,
                        templateId: templateData.id || null,
                        employeeId: employee.id,
                        positionId: position?.id || null,
                        departmentId: position?.departmentId || null,
                        creatorId: firebaseUser.uid,
                        status: 'DRAFT',
                        content: docContent,
                        version: 1,
                        metadata: {
                            employeeName: `${employee.firstName || ''} ${employee.lastName || ''}`.trim(),
                            positionTitle: position?.title || '',
                            templateName: templateData.name || '',
                            actionId: selectedActionId,
                            ...(documentNumber ? { documentNumber } : {})
                        },
                        customInputs: customInputsPayload,
                        history: [{
                            action: 'CREATE',
                            actorId: firebaseUser.uid,
                            timestamp: Timestamp.now(),
                            note: documentNumber ? `Баримт ${documentNumber} үүсгэв (Чөлөөлөх)` : 'Ажилтан чөлөөлөх үед системээс автоматаар үүсгэв.'
                        }],
                        createdAt: Timestamp.now(),
                        updatedAt: Timestamp.now()
                    });
                } catch (docError) {
                    console.error("ER Document creation error:", docError);
                    // Continue without creating ER document
                }
            }

            await batch.commit();

            const shouldCreateOffboarding = !!opts?.createOffboarding;
            let createdProjectId: string | null = null;
            if (shouldCreateOffboarding) {
                if (!offboardingStages?.length) {
                        toast({
                            title: 'Offboarding тохиргоо хоосон байна',
                            description: 'Эхлээд /dashboard/offboarding/settings дээр таскуудаа тохируулна уу.',
                            variant: 'destructive',
                        });
                } else if ((existingOffboardingProjects || []).length > 0) {
                    toast({
                        title: 'Offboarding аль хэдийн үүссэн байна',
                        description: 'Энэ ажилтанд offboarding төслүүд өмнө нь үүссэн байна.',
                        variant: 'destructive',
                    });
                } else {
                    const initiatorId = currentUserProfile?.id || firebaseUser?.uid || '';
                    const employeeName = `${employee.firstName || ''} ${employee.lastName || ''}`.trim() || 'Ажилтан';
                    const startDate = getReleaseStartDate(customInputsPayload);
                    const result = await createOffboardingProjects({
                        firestore,
                        employeeId: employee.id,
                        employeeName,
                        initiatorId,
                        offboardingConfig: offboardingStages,
                        startDate,
                        taskPlan: buildOffboardingOverrides(),
                        alwaysCreateAllStages: true,
                    });
                    createdProjectId = result.projectIds?.[0] || null;
                }
            }

            toast({
                title: "Ажилтан чөлөөлөгдлөө",
                description: templateData
                    ? (shouldCreateOffboarding ? "Баримтын ноорог + Offboarding төслүүд үүслээ." : "Баримтын ноорог үүсгэгдсэн.")
                    : (shouldCreateOffboarding ? "Offboarding төслүүд үүслээ." : "Чөлөөлөх үйлдэл амжилттай.")
            });
            onOpenChange(false);
            if (createdProjectId) {
                router.push(`/dashboard/projects/${createdProjectId}`);
            }
        } catch (e: any) {
            console.error("Release error:", e);
            toast({ variant: 'destructive', title: 'Алдаа гарлаа', description: e.message });
        } finally {
            setIsSubmitting(false);
        }
    };

    const RELEASE_TYPES = [
        { id: 'release_company', name: 'Компанийн санаачилгаар бүрэн чөлөөлөх', icon: AlertTriangle, color: 'bg-rose-50 text-rose-600 border-rose-100' },
        { id: 'release_employee', name: 'Ажилтны санаачилгаар бүрэн чөлөөлөх', icon: UserX, color: 'bg-amber-50 text-amber-600 border-amber-100' },
        { id: 'release_temporary', name: 'Түр чөлөөлөх', icon: Clock, color: 'bg-blue-50 text-blue-600 border-blue-100' },
    ];

    const canProceedCustomInputs = React.useMemo(() => {
        return !normalizedCustomInputs.some((i: any) => i.required && !customInputValues[i.__normalizedKey]);
    }, [normalizedCustomInputs, customInputValues]);

    const startDateForPlanning = React.useMemo(() => {
        const base = (customInputValues?.['releaseDate'] || customInputValues?.['Ажлаас чөлөөлөх огноо']) as string | undefined;
        if (typeof base === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(base)) return base;
        return format(new Date(), 'yyyy-MM-dd');
    }, [customInputValues]);

    const canGoNextOffboardingStage = React.useMemo(() => {
        if (step < 3) return true;
        const stageIdx = step - 3;
        const stage = offboardingStages[stageIdx];
        if (!stage) return true;
        const stagePlan = taskPlanByStage[stage.id] || {};
        const selected = Object.entries(stagePlan).filter(([, p]) => p.selected);
        return selected.every(([, p]) => isValidDateString(p.dueDate) && !!p.ownerId);
    }, [step, offboardingStages, taskPlanByStage, isValidDateString]);

    const renderOffboardingStageStep = (stage: OffboardingStage, stageIdx: number) => {
        const stagePlan = taskPlanByStage[stage.id] || {};
        return (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="text-center space-y-2">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-50 border border-amber-100 text-amber-700">
                        <span className="text-[10px] font-black uppercase tracking-widest">Offboarding {stageIdx + 1}/{stageCount}</span>
                    </div>
                    <h3 className="text-lg font-bold text-slate-900">{stage.title}</h3>
                    <p className="text-sm text-muted-foreground">{stage.description}</p>
                </div>

                <div className="space-y-3">
                    {(stage.tasks || []).length === 0 ? (
                        <div className="p-6 rounded-2xl bg-amber-50/40 border border-amber-100 text-amber-800 text-sm font-medium">
                            Энэ үе шатанд тохируулсан таск алга байна. Дараагийн алхам руу шууд үргэлжлүүлж болно.
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {stage.tasks.map((t) => {
                                const plan = stagePlan[t.id] || { selected: false };
                                return (
                                    <div key={t.id} className={cn("p-4 rounded-2xl border-2 bg-white transition-all", plan.selected ? "border-amber-200 shadow-sm" : "border-slate-100")}>
                                        <div className="flex items-start gap-3">
                                            <Checkbox
                                                checked={!!plan.selected}
                                                onCheckedChange={(checked) => setTaskSelected(stage.id, t.id, !!checked, stageIdx, startDateForPlanning)}
                                                className="mt-1"
                                            />
                                            <div className="flex-1 min-w-0">
                                                <div className="font-bold text-slate-900">{t.title}</div>
                                                {t.description && <div className="text-xs text-muted-foreground mt-0.5">{t.description}</div>}
                                            </div>
                                        </div>

                                        {plan.selected && (
                                            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                <div className="space-y-1">
                                                    <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Дуусах огноо</Label>
                                                    <Popover>
                                                        <PopoverTrigger asChild>
                                                            <Button
                                                                variant="outline"
                                                                className={cn(
                                                                    "h-10 w-full justify-start text-left font-medium rounded-xl border-slate-200",
                                                                    !plan.dueDate && "text-muted-foreground"
                                                                )}
                                                            >
                                                                <CalendarIcon className="mr-2 h-4 w-4" />
                                                                {plan.dueDate ? format(new Date(plan.dueDate), 'yyyy.MM.dd') : <span>Огноо сонгох</span>}
                                                            </Button>
                                                        </PopoverTrigger>
                                                        <PopoverContent className="w-auto p-0" align="start">
                                                            <Calendar
                                                                mode="single"
                                                                selected={plan.dueDate ? new Date(plan.dueDate) : undefined}
                                                                onSelect={(date) => setTaskDueDate(stage.id, t.id, date ? format(date, 'yyyy-MM-dd') : '')}
                                                                initialFocus
                                                            />
                                                        </PopoverContent>
                                                    </Popover>
                                                </div>

                                                <div className="space-y-1">
                                                    <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Хариуцагч</Label>
                                                    <Select value={plan.ownerId || ''} onValueChange={(val) => setTaskOwner(stage.id, t.id, val)}>
                                                        <SelectTrigger className="h-10 rounded-xl border-slate-200 bg-white">
                                                            <SelectValue placeholder="Хариуцагч сонгох" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {(employees || []).map((e) => (
                                                                <SelectItem key={e.id} value={e.id}>
                                                                    {e.firstName} {e.lastName}
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        );
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl p-0 overflow-hidden border-none shadow-2xl bg-white rounded-3xl">
                <div className="flex flex-col h-[85vh] max-h-[700px]">
                    <DialogHeader className="p-8 pb-4 bg-gradient-to-b from-slate-50/50 to-white shrink-0">
                        <div className="flex items-center gap-4 mb-2">
                            <div className="h-12 w-12 rounded-2xl bg-rose-50 flex items-center justify-center">
                                <UserMinus className="h-6 w-6 text-rose-600" />
                            </div>
                            <div>
                                <DialogTitle className="text-2xl font-bold text-slate-900 tracking-tight">Ажилтан чөлөөлөх</DialogTitle>
                                <DialogDescription className="text-sm font-medium text-muted-foreground mt-1">
                                    <span className="font-bold text-slate-700">{employee?.firstName} {employee?.lastName}</span> ажилтныг ажлаас чөлөөлөх үйлдэл.
                                </DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>

                    <div className="flex-1 overflow-hidden relative border-t">
                        {step === 1 ? (
                            <ScrollArea className="h-full">
                                <div className="p-8 space-y-6">
                                    <div className="text-center space-y-2 mb-8">
                                        <h3 className="text-lg font-bold text-slate-900">Чөлөөлөх төрөл сонгох</h3>
                                        <p className="text-sm text-muted-foreground">Тохирох чөлөөлөлтийн төрлийг сонгоно уу.</p>
                                    </div>

                                    <div className="grid grid-cols-1 gap-4">
                                        {/* Show cancel appointment option when employee has pending (unapproved) appointment */}
                                        {hasPendingAppointment && (
                                            <button
                                                onClick={handleCancelPendingAppointment}
                                                disabled={isSubmitting}
                                                className="flex items-center gap-4 p-5 rounded-2xl border-2 border-amber-200 bg-amber-50/50 hover:border-amber-400 hover:shadow-xl hover:shadow-amber-50 transition-all text-left group"
                                            >
                                                <div className="h-12 w-12 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110 bg-amber-100 text-amber-600">
                                                    {isSubmitting ? (
                                                        <Loader2 className="h-6 w-6 animate-spin" />
                                                    ) : (
                                                        <XCircle className="h-6 w-6" />
                                                    )}
                                                </div>
                                                <div className="flex-1">
                                                    <div className="font-bold text-amber-900">Томилгоо цуцлах</div>
                                                    <div className="text-xs text-amber-700 mt-0.5">
                                                        Бичиг баримт баталгаажаагүй тул шууд цуцална
                                                    </div>
                                                </div>
                                                <ChevronRight className="h-5 w-5 text-amber-300 group-hover:text-amber-600 group-hover:translate-x-1 transition-all" />
                                            </button>
                                        )}

                                        {hasPendingAppointment && (
                                            <div className="relative flex items-center py-2">
                                                <div className="flex-1 border-t border-slate-200" />
                                                <span className="px-3 text-xs text-muted-foreground font-medium">эсвэл бүрэн чөлөөлөх</span>
                                                <div className="flex-1 border-t border-slate-200" />
                                            </div>
                                        )}

                                        {RELEASE_TYPES.map((type) => (
                                            <button
                                                key={type.id}
                                                onClick={() => {
                                                    handleSelectReleaseType(type);
                                                }}
                                                className="flex items-center gap-4 p-5 rounded-2xl border-2 border-slate-100 bg-white hover:border-rose-600 hover:shadow-xl hover:shadow-rose-50 transition-all text-left group"
                                            >
                                                <div className={cn("h-12 w-12 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110", type.color)}>
                                                    <type.icon className="h-6 w-6" />
                                                </div>
                                                <div className="flex-1">
                                                    <div className="font-bold text-slate-900">{type.name}</div>
                                                    <div className="text-xs text-muted-foreground mt-0.5">Чөлөөлөх баримт үүсгэгдэх болно</div>
                                                </div>
                                                <ChevronRight className="h-5 w-5 text-slate-300 group-hover:text-rose-600 group-hover:translate-x-1 transition-all" />
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </ScrollArea>
                        ) : (
                            <ScrollArea className="h-full">
                                <div className="p-8 space-y-6">
                                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex items-center gap-4">
                                        <Avatar className="h-14 w-14 border-4 border-white shadow-sm">
                                            <AvatarImage src={employee?.photoURL} />
                                            <AvatarFallback className="bg-rose-50 text-rose-600 text-xl font-bold">
                                                {employee?.firstName?.charAt(0)}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div>
                                            <div className="text-lg font-bold text-slate-900">{employee?.firstName} {employee?.lastName}</div>
                                            <div className="text-xs text-muted-foreground font-medium mt-0.5">
                                                {position?.title}
                                            </div>
                                        </div>
                                    </div>

                                    {step >= 3 && enableOffboarding && stageForStep ? (
                                        renderOffboardingStageStep(stageForStep, step - 3)
                                    ) : templateLoading ? (
                                        <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                                    ) : templateData ? (
                                        <div className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-500">
                                            <div className="flex items-center gap-2 py-2 border-y border-dashed border-slate-200">
                                                <FileText className="w-5 h-5 text-rose-500" />
                                                <div>
                                                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Ашиглах загвар</div>
                                                    <div className="text-sm font-bold text-slate-700">{templateData.name}</div>
                                                </div>
                                            </div>

                                            {normalizedCustomInputs.length > 0 && (
                                                <div className="space-y-4">
                                                    <div className="flex items-center gap-2 text-rose-600">
                                                        <Wand2 className="h-4 w-4" />
                                                        <label className="text-xs font-bold uppercase tracking-widest">Шаардлагатай мэдээллүүд</label>
                                                    </div>
                                                    <div className="grid grid-cols-1 gap-4">
                                                        {normalizedCustomInputs.map((input: any) => (
                                                            <div key={input.__normalizedKey} className="space-y-1.5">
                                                                <Label className="text-xs font-bold text-slate-600 ml-1">
                                                                    {input.label} {input.required && <span className="text-rose-500">*</span>}
                                                                </Label>
                                                                {input.type === 'date' ? (
                                                                    <Popover>
                                                                        <PopoverTrigger asChild>
                                                                            <Button
                                                                                variant={"outline"}
                                                                                className={cn(
                                                                                    "h-11 w-full justify-start text-left font-medium rounded-xl border-slate-200",
                                                                                    !customInputValues[input.__normalizedKey] && "text-muted-foreground"
                                                                                )}
                                                                            >
                                                                                <CalendarIcon className="mr-2 h-4 w-4" />
                                                                                {customInputValues[input.__normalizedKey] ? format(new Date(customInputValues[input.__normalizedKey]), "yyyy.MM.dd") : <span>Огноо сонгох</span>}
                                                                            </Button>
                                                                        </PopoverTrigger>
                                                                        <PopoverContent className="w-auto p-0" align="start">
                                                                            <Calendar
                                                                                mode="single"
                                                                                selected={customInputValues[input.__normalizedKey] ? new Date(customInputValues[input.__normalizedKey]) : undefined}
                                                                                onSelect={(date) => setCustomInputValues(prev => ({ ...prev, [input.__normalizedKey]: date ? format(date, 'yyyy-MM-dd') : '' }))}
                                                                                initialFocus
                                                                            />
                                                                        </PopoverContent>
                                                                    </Popover>
                                                                ) : input.type === 'number' ? (
                                                                    <Input
                                                                        type="number"
                                                                        value={customInputValues[input.__normalizedKey] || ''}
                                                                        onChange={(e) => setCustomInputValues(prev => ({ ...prev, [input.__normalizedKey]: e.target.value }))}
                                                                        placeholder={input.description || `${input.label} оруулна уу...`}
                                                                        className="h-11 bg-white border-slate-200 rounded-xl focus:ring-primary/10 transition-all font-medium"
                                                                    />
                                                                ) : input.type === 'boolean' ? (
                                                                    <div className="flex items-center space-x-2 h-11 px-4 bg-slate-50/50 rounded-xl border border-slate-100">
                                                                        <Switch
                                                                            checked={!!customInputValues[input.__normalizedKey]}
                                                                            onCheckedChange={(checked) => setCustomInputValues(prev => ({ ...prev, [input.__normalizedKey]: checked }))}
                                                                        />
                                                                        <span className="text-sm text-slate-500">{customInputValues[input.__normalizedKey] ? 'Тийм' : 'Үгүй'}</span>
                                                                    </div>
                                                                ) : (
                                                                    <Input
                                                                        value={customInputValues[input.__normalizedKey] || ''}
                                                                        onChange={(e) => setCustomInputValues(prev => ({ ...prev, [input.__normalizedKey]: e.target.value }))}
                                                                        placeholder={input.description || `${input.label} оруулна уу...`}
                                                                        className="h-11 bg-white border-slate-200 rounded-xl focus:ring-primary/10 transition-all font-medium"
                                                                    />
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="p-6 rounded-2xl bg-amber-50 border border-amber-100 text-amber-700 text-sm space-y-4">
                                            <div className="flex items-start gap-3">
                                                <Info className="h-5 w-5 mt-0.5 shrink-0" />
                                                <div>
                                                    <p className="font-bold mb-1">Баримтын загвар тохируулаагүй</p>
                                                    <p className="opacity-80 leading-relaxed font-medium">Чөлөөлөх үйлдлийг үргэлжлүүлж болно. Гэхдээ баримт автоматаар үүсгэхгүй.</p>
                                                </div>
                                            </div>

                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="bg-white border-amber-200 text-amber-700 hover:bg-amber-50 hover:text-amber-800 h-9 rounded-xl font-bold uppercase tracking-widest text-[10px] gap-2"
                                                onClick={() => window.open('/dashboard/organization/settings', '_blank')}
                                            >
                                                <ExternalLink className="h-3.5 w-3.5" />
                                                Тохиргоо руу очих
                                            </Button>
                                        </div>
                                    )}

                                    {step === 2 && (
                                        <div className="mt-6 p-5 rounded-2xl border-2 border-slate-100 bg-white space-y-4">
                                            <div className="flex items-start justify-between gap-4">
                                                <div>
                                                    <div className="text-sm font-bold text-slate-900">Offboarding хөтөлбөр эхлүүлэх үү?</div>
                                                    <div className="text-xs text-muted-foreground mt-0.5">
                                                        Тийм гэж сонговол 4 үе шатны таскуудыг (огноо + хариуцагч) тохируулж байж төслүүд үүснэ.
                                                    </div>
                                                </div>
                                                <Switch
                                                    checked={enableOffboarding}
                                                    onCheckedChange={(checked) => {
                                                        if (checked && (existingOffboardingProjects || []).length > 0) {
                                                            toast({
                                                                title: 'Offboarding аль хэдийн үүссэн байна',
                                                                description: 'Энэ ажилтанд offboarding төслүүд өмнө нь үүссэн байна.',
                                                                variant: 'destructive',
                                                            });
                                                            setEnableOffboarding(false);
                                                            return;
                                                        }
                                                        setEnableOffboarding(checked);
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </ScrollArea>
                        )}

                        {isSubmitting && (
                            <div className="absolute inset-0 bg-white/80 backdrop-blur-[2px] z-50 flex flex-col items-center justify-center gap-4 animate-in fade-in duration-300">
                                <Loader2 className="h-12 w-12 text-rose-600 animate-spin" />
                                <div className="text-center">
                                    <p className="text-sm font-bold text-slate-900">Боловсруулж байна</p>
                                    <p className="text-xs text-muted-foreground">Түр хүлээнэ үү...</p>
                                </div>
                            </div>
                        )}
                    </div>

                    <DialogFooter className="p-6 border-t bg-slate-50/50 shrink-0">
                        {step === 1 ? (
                            <Button
                                variant="ghost"
                                onClick={() => onOpenChange(false)}
                                className="rounded-xl px-6 h-11 font-bold uppercase tracking-wider text-[10px]"
                            >
                                Болих
                            </Button>
                        ) : (
                            <div className="flex w-full gap-3">
                                <Button
                                    variant="outline"
                                    onClick={() => {
                                        if (step === 2) return setStep(1);
                                        if (step >= 3) return setStep(step - 1);
                                        setStep(1);
                                    }}
                                    className="flex-1 rounded-xl h-11 font-bold uppercase tracking-wider text-[10px]"
                                    disabled={isSubmitting}
                                >
                                    Буцах
                                </Button>
                                <Button
                                    onClick={() => {
                                        if (step === 2) {
                                            if (!canProceedCustomInputs) return;
                                            if (enableOffboarding) {
                                                if (!offboardingStages?.length) {
                                                    toast({
                                                        title: 'Offboarding тохиргоо хоосон байна',
                                                        description: 'Эхлээд /dashboard/offboarding/settings дээр таскуудаа тохируулна уу.',
                                                        variant: 'destructive',
                                                    });
                                                    return;
                                                }
                                                return setStep(3);
                                            }
                                            return handleRelease({ createOffboarding: false });
                                        }

                                        if (step >= 3) {
                                            if (!canGoNextOffboardingStage) return;
                                            const isLast = step === (2 + stageCount);
                                            if (isLast) return handleRelease({ createOffboarding: true });
                                            return setStep(step + 1);
                                        }
                                    }}
                                    disabled={
                                        isSubmitting ||
                                        (step === 2 && !canProceedCustomInputs) ||
                                        (step >= 3 && !canGoNextOffboardingStage)
                                    }
                                    className="flex-[2] bg-rose-600 hover:bg-rose-700 text-white rounded-xl h-11 font-bold uppercase tracking-wider text-[10px] shadow-lg shadow-rose-200"
                                >
                                    {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
                                    {step === 2
                                        ? (enableOffboarding ? 'Offboarding тохируулах' : 'Чөлөөлөх үйлдэл баталгаажуулах')
                                        : (step === (2 + stageCount) ? 'Чөлөөлөх + Offboarding үүсгэх' : 'Дараах')}
                                </Button>
                            </div>
                        )}
                    </DialogFooter>
                </div>
            </DialogContent>
        </Dialog>
    );
}
