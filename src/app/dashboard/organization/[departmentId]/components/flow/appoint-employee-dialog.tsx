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
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { 
    Search, UserPlus, Loader2, GitBranch, ChevronRight, ChevronLeft, FileText, Check, X, Wand2, 
    ExternalLink, Calendar as CalendarIcon, Clock, DollarSign, Zap, Gift, GraduationCap,
    ArrowRight
} from 'lucide-react';
import { Employee } from '@/types';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useCollection, useFirebase, useDoc, useTenantWrite, tenantDoc, tenantCollection } from '@/firebase';
import { query, where, doc, getDoc, getDocs, Timestamp, addDoc, writeBatch, increment } from 'firebase/firestore';
import { useEmployeeProfile } from '@/hooks/use-employee-profile';
import { createOnboardingProjects, OnboardingStage, OnboardingStageTaskPlan } from '@/lib/onboarding-project-creator';
import { useRouter } from 'next/navigation';
import { Position } from '../../../types';
import { ERTemplate, ERDocument } from '../../../../employment-relations/types';
import { generateDocumentContent } from '../../../../employment-relations/utils';
import { getNextDocumentNumber } from '../../../../employment-relations/services/document-numbering';
import { addDays, addMonths, format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { mn } from 'date-fns/locale';
import Link from 'next/link';

const ACTION_REQUIREMENTS: Record<string, Array<{ label: string; key: string }>> = {
    appointment_permanent: [{ label: 'Томилогдсон огноо', key: 'appointmentDate' }],
    appointment_probation: [
        { label: 'Туршилтын эхлэх огноо', key: 'probationStartDate' },
        { label: 'Туршилтын дуусах огноо', key: 'probationEndDate' },
    ],
    appointment_reappoint: [{ label: 'Эргүүлэн томилсон огноо', key: 'reappointmentDate' }],
};

interface AppointEmployeeDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    position: Position | null;
    initialEmployee?: Employee | null;
    onSuccess?: (employeeId: string) => void;
}

// Full position data fetched from Firestore
interface FullPositionData extends Position {
    salarySteps?: {
        items: { name: string; value: number }[];
        activeIndex: number;
        currency: string;
    };
    incentives?: {
        type: string;
        description: string;
        amount: number;
        currency: string;
        unit: string;
        frequency?: string;
    }[];
    allowances?: {
        type: string;
        amount: number;
        currency: string;
        period: string;
    }[];
}

// Wizard steps
const WIZARD_STEPS = {
    EMPLOYEE_SELECT: 1,
    APPOINTMENT_TYPE: 2,
    SALARY_STEP: 3,
    INCENTIVES: 4,
    ALLOWANCES: 5,
    ONBOARDING: 6,
    ONBOARDING_PRE: 7,
    ONBOARDING_ORIENTATION: 8,
    ONBOARDING_INTEGRATION: 9,
    ONBOARDING_PRODUCTIVITY: 10,
    DOCUMENT_INPUTS: 11,
};

type OnboardingStageId = 'pre-onboarding' | 'orientation' | 'integration' | 'productivity';
const ONBOARDING_STAGE_ORDER: OnboardingStageId[] = ['pre-onboarding', 'orientation', 'integration', 'productivity'];
const ONBOARDING_STAGE_TITLES: Record<OnboardingStageId, string> = {
    'pre-onboarding': 'Урьдчилсан бэлтгэл үе',
    orientation: 'Дасан зохицох, танилцах үе',
    integration: 'Ажлын үүрэгт уусах үе',
    productivity: 'Тогтворжилт, бүтээмжийн үе',
};
const ONBOARDING_STAGE_DUE_OFFSETS: Record<OnboardingStageId, number> = {
    'pre-onboarding': 7,
    orientation: 30,
    integration: 60,
    productivity: 90,
};

export function AppointEmployeeDialog({
    open,
    onOpenChange,
    position,
    initialEmployee,
    onSuccess,
}: AppointEmployeeDialogProps) {
    const { firestore, user: firebaseUser } = useFirebase();
    const { tDoc, tCollection, companyPath } = useTenantWrite();
    const { employeeProfile: currentUserProfile } = useEmployeeProfile();
    const { toast } = useToast();
    const router = useRouter();
    
    // Fetch full position data from Firestore (position prop might be incomplete)
    const fullPositionRef = React.useMemo(() => 
        firestore && companyPath && position?.id && open ? tenantDoc(firestore, companyPath, 'positions', position.id) : null
    , [firestore, companyPath, position?.id, open]);
    const { data: fullPosition, isLoading: isPositionLoading } = useDoc<FullPositionData>(fullPositionRef as any);
    
    // Use full position data if available, fallback to prop
    const positionData = fullPosition || position;
    
    // Basic states
    const [search, setSearch] = React.useState('');
    const [step, setStep] = React.useState(WIZARD_STEPS.EMPLOYEE_SELECT);
    const [selectedEmployee, setSelectedEmployee] = React.useState<Employee | null>(null);
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [offboardingStatus, setOffboardingStatus] = React.useState<'checking' | 'active' | 'none'>('none');

    // Wizard selection states
    const [selectedActionId, setSelectedActionId] = React.useState<string | null>(null);
    const [selectedSalaryStepIndex, setSelectedSalaryStepIndex] = React.useState<number>(0);
    const [selectedIncentives, setSelectedIncentives] = React.useState<number[]>([]);
    const [selectedAllowances, setSelectedAllowances] = React.useState<number[]>([]);
    const [enableOnboarding, setEnableOnboarding] = React.useState<boolean | null>(null);
    const [onboardingTaskPlan, setOnboardingTaskPlan] = React.useState<Record<string, Record<string, { selected: boolean; dueDate?: string; ownerId?: string }>>>({});
    const [customInputValues, setCustomInputValues] = React.useState<Record<string, any>>({});

    const onboardingConfigRef = React.useMemo(() =>
        firestore && companyPath && open ? tenantDoc(firestore, companyPath, 'settings', 'onboarding') : null
        , [firestore, companyPath, open]);
    const { data: onboardingConfig } = useDoc<any>(onboardingConfigRef as any);
    const onboardingStages = React.useMemo(() => ((onboardingConfig?.stages || []) as OnboardingStage[]), [onboardingConfig]);

    const hasActiveOffboarding = React.useCallback(async (empId: string) => {
        if (!firestore || !empId) return false;
        try {
            const snap = await getDocs(query(
                tCollection('projects'),
                where('type', '==', 'offboarding'),
                where('offboardingEmployeeId', '==', empId)
            ));
            return !snap.empty;
        } catch (e) {
            console.warn('Offboarding projects check failed:', e);
            return false;
        }
    }, [firestore, tCollection]);

    const isValidDateString = React.useCallback((val?: string) => !!val && /^\d{4}-\d{2}-\d{2}$/.test(val), []);
    const getDefaultDueDateForStage = React.useCallback((stageId: OnboardingStageId) => {
        const start = new Date();
        return format(addDays(start, ONBOARDING_STAGE_DUE_OFFSETS[stageId] ?? 30), 'yyyy-MM-dd');
    }, []);

    const getStageConfig = React.useCallback((stageId: OnboardingStageId) => onboardingStages.find(s => s.id === stageId), [onboardingStages]);

    // Fetch all active employees (filter for unassigned on client-side)
    // Note: Firestore doesn't support OR queries, so we fetch active employees and filter
    const employeesQuery = React.useMemo(() => {
        if (!firestore || !companyPath) return null;
        return query(
            tenantCollection(firestore, companyPath, 'employees'),
            where('status', 'in', ['active', 'active_probation', 'active_permanent'])
        );
    }, [firestore, companyPath]);

    const { data: allEmployees, isLoading: employeesLoading } = useCollection<Employee>(employeesQuery);

    // Fetch System Appointment Action Config
    const actionConfigRef = React.useMemo(() =>
        firestore && companyPath && selectedActionId ? tenantDoc(firestore, companyPath, 'organization_actions', selectedActionId) : null
        , [firestore, companyPath, selectedActionId]);
    const { data: appointmentAction } = useDoc<any>(actionConfigRef);

    // Fetch Template if configured
    const templateRef = React.useMemo(() =>
        firestore && companyPath && appointmentAction?.templateId ? tenantDoc(firestore, companyPath, 'er_templates', appointmentAction.templateId) : null
        , [firestore, companyPath, appointmentAction?.templateId]);
    const { data: templateData, isLoading: templateLoading } = useDoc<ERTemplate>(templateRef as any);

    // Stabilize customInputs dependency using JSON signature (Firestore snapshots return new array refs)
    const customInputsJson = React.useMemo(() => {
        try {
            return JSON.stringify(templateData?.customInputs || []);
        } catch {
            return '[]';
        }
    }, [templateData?.customInputs]);

    // Normalize customInputs to guarantee unique keys in UI/state, even if template contains duplicates.
    const normalizedCustomInputs = React.useMemo(() => {
        let inputs: any[];
        try {
            inputs = JSON.parse(customInputsJson);
        } catch {
            inputs = [];
        }
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
    }, [customInputsJson]);

    const assignableEmployees = React.useMemo(() => {
        if (!allEmployees) return [];
        // Filter employees without a position (null, undefined, or empty string)
        return allEmployees.filter(emp => !emp.positionId || emp.positionId === '');
    }, [allEmployees]);

    const filteredEmployees = React.useMemo(() => {
        return assignableEmployees.filter(emp =>
            `${emp.firstName} ${emp.lastName}`.toLowerCase().includes(search.toLowerCase()) ||
            emp.employeeCode?.toLowerCase().includes(search.toLowerCase())
        );
    }, [assignableEmployees, search]);

    // Normalize salary steps (handle old format with 'values' array)
    const normalizeSalarySteps = React.useCallback((pos: Position | FullPositionData | null) => {
        if (!pos?.salarySteps) return [];
        // New format with items array
        if (pos.salarySteps.items && Array.isArray(pos.salarySteps.items)) {
            return pos.salarySteps.items;
        }
        // Old format with values array
        const oldValues = (pos.salarySteps as any)?.values;
        if (oldValues && Array.isArray(oldValues)) {
            return oldValues.map((v: number, i: number) => ({
                name: `Шатлал ${i + 1}`,
                value: v
            }));
        }
        return [];
    }, []);

    // Get position data with normalization - use fullPosition from Firestore
    const salarySteps = React.useMemo(() => normalizeSalarySteps(positionData), [positionData, normalizeSalarySteps]);
    const incentives = positionData?.incentives || [];
    const allowances = positionData?.allowances || [];

    // Debug logging
    React.useEffect(() => {
        if (open) {
            console.log('AppointDialog - Position prop:', {
                id: position?.id,
                title: position?.title,
                hasSalarySteps: !!position?.salarySteps,
                hasIncentives: !!position?.incentives,
                hasAllowances: !!position?.allowances,
            });
            console.log('AppointDialog - Full Position (Firestore):', {
                id: fullPosition?.id,
                title: fullPosition?.title,
                salarySteps: fullPosition?.salarySteps,
                incentives: fullPosition?.incentives,
                allowances: fullPosition?.allowances,
                isLoading: isPositionLoading,
            });
            console.log('AppointDialog - Normalized data:', {
                salarySteps,
                incentives,
                allowances,
            });
        }
    }, [open, position, fullPosition, positionData, isPositionLoading, salarySteps, incentives, allowances]);

    // Calculate total steps based on position data
    const getMaxSteps = () => {
        let max = WIZARD_STEPS.APPOINTMENT_TYPE; // Always have appointment type
        if (salarySteps.length > 0) max = WIZARD_STEPS.SALARY_STEP;
        if (incentives.length > 0) max = WIZARD_STEPS.INCENTIVES;
        if (allowances.length > 0) max = WIZARD_STEPS.ALLOWANCES;
        max = WIZARD_STEPS.ONBOARDING; // Always have onboarding selection
        if (enableOnboarding) max = WIZARD_STEPS.ONBOARDING_PRODUCTIVITY;
        if (templateData?.customInputs?.length) max = WIZARD_STEPS.DOCUMENT_INPUTS;
        return max;
    };

    // Initialize custom inputs when template loads (idempotent; don't reset on every snapshot)
    const expectedCustomInputKeys = React.useMemo(
        () => normalizedCustomInputs.map((i: any) => String(i.__normalizedKey)),
        [normalizedCustomInputs]
    );
    const expectedCustomInputKeysSig = React.useMemo(() => expectedCustomInputKeys.join('|'), [expectedCustomInputKeys]);
    const customInputsTemplateId = String(appointmentAction?.templateId || '');

    React.useEffect(() => {
        // Derive keys from signature to avoid stale closure issues
        const keys = expectedCustomInputKeysSig ? expectedCustomInputKeysSig.split('|').filter(Boolean) : [];
        
        // When no template is selected, clear (once)
        if (!customInputsTemplateId || keys.length === 0) {
            setCustomInputValues((prev) => (Object.keys(prev || {}).length === 0 ? prev : {}));
            return;
        }

        // Merge missing keys only; keep existing values
        setCustomInputValues((prev) => {
            const current = prev || {};
            let changed = false;
            const next: Record<string, any> = { ...current };
            for (const key of keys) {
                if (!(key in next)) {
                    next[key] = '';
                    changed = true;
                }
            }
            // If we already have all keys, avoid re-setting state
            return changed ? next : current;
        });
    }, [customInputsTemplateId, expectedCustomInputKeysSig]);

    // Compute probation auto-fill keys as STABLE primitives (no object reference instability)
    // Uses Mongolian labels to reliably identify fields
    const probationAutoFillKeys = React.useMemo(() => {
        if (selectedActionId !== 'appointment_probation') return null;
        if (!normalizedCustomInputs || normalizedCustomInputs.length === 0) return null;

        // Find inputs by their Mongolian labels (most reliable method)
        const startInput = normalizedCustomInputs.find((i: any) => {
            const label = String(i.label || '').toLowerCase();
            return label.includes('томилох огноо') || label.includes('эхлэх огноо') || label.includes('ажилд орсон');
        });
        
        const endInput = normalizedCustomInputs.find((i: any) => {
            const label = String(i.label || '').toLowerCase();
            return label.includes('дуусах огноо') || label.includes('дуусгавар');
        });
        
        const durationInput = normalizedCustomInputs.find((i: any) => {
            const label = String(i.label || '').toLowerCase();
            return label.includes('туршилтын хугацаа') || label.includes('хугацаа');
        });

        // If label-based search fails, try dataMappings fallback
        if (!startInput || !endInput || !durationInput) {
            if (!appointmentAction?.dateMappings) return null;
            const mappings = appointmentAction.dateMappings as Record<string, string>;
            const startBaseKey = String(mappings.probationStartDate || '').trim();
            const endBaseKey = String(mappings.probationEndDate || '').trim();
            if (!startBaseKey || !endBaseKey) return null;

            const fallbackStart = startInput || normalizedCustomInputs.find((i: any) => i.__baseKey === startBaseKey || i.__normalizedKey === startBaseKey);
            const fallbackEnd = endInput || normalizedCustomInputs.find((i: any) => i.__baseKey === endBaseKey || i.__normalizedKey === endBaseKey);
            const fallbackDuration = durationInput || 
                normalizedCustomInputs.find((i: any) => ['probationDuration', 'probationPeriod', 'probationMonths', 'probationMonth'].includes(String(i.__baseKey || '')));
            
            if (!fallbackStart || !fallbackEnd || !fallbackDuration) return null;
            
            const hint = `${fallbackDuration.label || ''} ${fallbackDuration.description || ''} ${fallbackDuration.__baseKey || ''}`.toLowerCase();
            const isDays = hint.includes('өдөр') || hint.includes('day');
            return `${fallbackStart.__normalizedKey}|${fallbackEnd.__normalizedKey}|${fallbackDuration.__normalizedKey}|${isDays ? '1' : '0'}`;
        }

        const hint = `${durationInput.label || ''} ${durationInput.description || ''} ${durationInput.__baseKey || ''}`.toLowerCase();
        const isDays = hint.includes('өдөр') || hint.includes('day');

        // Return a stable string signature instead of object to avoid reference instability
        return `${startInput.__normalizedKey}|${endInput.__normalizedKey}|${durationInput.__normalizedKey}|${isDays ? '1' : '0'}`;
    }, [appointmentAction?.dateMappings, normalizedCustomInputs, selectedActionId]);

    // Parse the stable keys signature into usable values
    const probationStartKey = probationAutoFillKeys ? probationAutoFillKeys.split('|')[0] : '';
    const probationEndKey = probationAutoFillKeys ? probationAutoFillKeys.split('|')[1] : '';
    const probationDurationKey = probationAutoFillKeys ? probationAutoFillKeys.split('|')[2] : '';
    const probationIsDays = probationAutoFillKeys ? probationAutoFillKeys.split('|')[3] === '1' : false;

    const probationStartVal = probationStartKey ? String(customInputValues?.[probationStartKey] || '').trim() : '';
    const probationDurationVal = probationDurationKey ? String(customInputValues?.[probationDurationKey] || '').trim() : '';
    const probationCurrentEndVal = probationEndKey ? String(customInputValues?.[probationEndKey] || '').trim() : '';

    // Handler for custom input changes - includes probation end date auto-fill logic
    const handleCustomInputChange = React.useCallback((key: string, value: any) => {
        setCustomInputValues(prev => {
            const next = { ...prev, [key]: value };
            
            // Auto-fill probation end date if we have the config and relevant fields changed
            if (probationAutoFillKeys && probationStartKey && probationEndKey && probationDurationKey) {
                const isStartOrDurationChange = key === probationStartKey || key === probationDurationKey;
                
                if (isStartOrDurationChange) {
                    const startVal = String(key === probationStartKey ? value : next[probationStartKey] || '').trim();
                    const durationVal = String(key === probationDurationKey ? value : next[probationDurationKey] || '').trim();
                    
                    // Only compute if we have valid start date and duration
                    if (/^\d{4}-\d{2}-\d{2}$/.test(startVal)) {
                        const durationNum = Number(String(durationVal).replace(/[^\d.]/g, ''));
                        if (Number.isFinite(durationNum) && durationNum > 0) {
                            const [y, m, d] = startVal.split('-').map((p) => Number(p));
                            if (y && m && d) {
                                const startDate = new Date(y, m - 1, d, 12, 0, 0, 0);
                                const computedEnd = probationIsDays
                                    ? addDays(startDate, Math.round(durationNum))
                                    : addMonths(startDate, Math.round(durationNum));
                                next[probationEndKey] = format(computedEnd, 'yyyy-MM-dd');
                            }
                        }
                    }
                }
            }
            
            return next;
        });
    }, [probationAutoFillKeys, probationStartKey, probationEndKey, probationDurationKey, probationIsDays]);

    // Handle initial employee from dashboard drag & drop
    React.useEffect(() => {
        if (open && initialEmployee) {
            setSelectedEmployee(initialEmployee);
            setStep(WIZARD_STEPS.APPOINTMENT_TYPE);
        }
    }, [open, initialEmployee]);

    // Check for active offboarding
    React.useEffect(() => {
        const checkOffboarding = async () => {
            if (!firestore || !initialEmployee?.id || !open) return;

            setOffboardingStatus('checking');
            try {
                const active = await hasActiveOffboarding(initialEmployee.id);
                if (active) {
                    setOffboardingStatus('active');
                    toast({
                        title: 'Анхааруулга: Offboarding идэвхтэй',
                        description: `${initialEmployee.firstName} ${initialEmployee.lastName} ажилтанд ажилаас чөлөөлөх хөтөлбөр явагдаж байна.`,
                        variant: 'destructive',
                    });
                    return;
                }
                setOffboardingStatus('none');
            } catch (error) {
                console.error("Offboarding check error:", error);
                setOffboardingStatus('none');
            }
        };
        checkOffboarding();
    }, [firestore, initialEmployee?.id, open, toast, hasActiveOffboarding]);

    // Reset on close
    React.useEffect(() => {
        if (!open) {
            setStep(WIZARD_STEPS.EMPLOYEE_SELECT);
            setSelectedEmployee(null);
            setSelectedActionId(null);
            setSelectedSalaryStepIndex(position?.salarySteps?.activeIndex || 0);
            setSelectedIncentives([]);
            setSelectedAllowances([]);
            setEnableOnboarding(null);
            setOnboardingTaskPlan({});
            setSearch('');
            setCustomInputValues({});
            setOffboardingStatus('none');
        }
    }, [open, position?.salarySteps?.activeIndex]);

    // Initialize default salary step from position
    React.useEffect(() => {
        if (positionData?.salarySteps?.activeIndex !== undefined && salarySteps.length > 0) {
            const activeIdx = Math.min(positionData.salarySteps.activeIndex, salarySteps.length - 1);
            setSelectedSalaryStepIndex(activeIdx);
        }
    }, [positionData?.salarySteps?.activeIndex, salarySteps.length]);

    const handleEmployeeSelect = async (employee: Employee) => {
        if (!firestore) return;
        
        try {
            const active = await hasActiveOffboarding(employee.id);
            if (active) {
                toast({
                    title: 'Анхааруулга: Offboarding идэвхтэй',
                    description: `${employee.firstName} ${employee.lastName} ажилтанд ажилаас чөлөөлөх хөтөлбөр явагдаж байна.`,
                    variant: 'destructive',
                });
                setOffboardingStatus('active');
                return;
            }
            setOffboardingStatus('none');
        } catch (error) {
            console.error("Offboarding check error:", error);
            setOffboardingStatus('none');
        }
        
        setSelectedEmployee(employee);
        setStep(WIZARD_STEPS.APPOINTMENT_TYPE);
    };

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

    const handleSelectAppointmentType = React.useCallback(async (type: { id: string; name: string }) => {
        if (!firestore) return;
        if (offboardingStatus === 'active' || offboardingStatus === 'checking') return;

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

        goToNextStep(WIZARD_STEPS.APPOINTMENT_TYPE);
    }, [firestore, offboardingStatus, showActionNotConfiguredToast, toast, goToNextStep]);

    // Navigate to next step based on available data
    function goToNextStep(currentStep: number) {
        console.log('goToNextStep called:', {
            currentStep,
            salaryStepsLength: salarySteps.length,
            incentivesLength: incentives.length,
            allowancesLength: allowances.length,
            salarySteps,
            incentives,
            allowances
        });
        
        if (currentStep === WIZARD_STEPS.APPOINTMENT_TYPE) {
            if (salarySteps.length > 0) {
                console.log('Going to SALARY_STEP');
                setStep(WIZARD_STEPS.SALARY_STEP);
            } else if (incentives.length > 0) {
                console.log('Going to INCENTIVES');
                setStep(WIZARD_STEPS.INCENTIVES);
            } else if (allowances.length > 0) {
                console.log('Going to ALLOWANCES');
                setStep(WIZARD_STEPS.ALLOWANCES);
            } else {
                console.log('Going to ONBOARDING');
                setStep(WIZARD_STEPS.ONBOARDING);
            }
        } else if (currentStep === WIZARD_STEPS.SALARY_STEP) {
            if (incentives.length > 0) {
                setStep(WIZARD_STEPS.INCENTIVES);
            } else if (allowances.length > 0) {
                setStep(WIZARD_STEPS.ALLOWANCES);
            } else {
                setStep(WIZARD_STEPS.ONBOARDING);
            }
        } else if (currentStep === WIZARD_STEPS.INCENTIVES) {
            if (allowances.length > 0) {
                setStep(WIZARD_STEPS.ALLOWANCES);
            } else {
                setStep(WIZARD_STEPS.ONBOARDING);
            }
        } else if (currentStep === WIZARD_STEPS.ALLOWANCES) {
            setStep(WIZARD_STEPS.ONBOARDING);
        } else if (currentStep === WIZARD_STEPS.ONBOARDING) {
            if (enableOnboarding === true) {
                setStep(WIZARD_STEPS.ONBOARDING_PRE);
                return;
            }
            if (templateData?.customInputs?.length) {
                setStep(WIZARD_STEPS.DOCUMENT_INPUTS);
            } else {
                handleStartProcess();
            }
        } else if (currentStep === WIZARD_STEPS.ONBOARDING_PRE) {
            setStep(WIZARD_STEPS.ONBOARDING_ORIENTATION);
        } else if (currentStep === WIZARD_STEPS.ONBOARDING_ORIENTATION) {
            setStep(WIZARD_STEPS.ONBOARDING_INTEGRATION);
        } else if (currentStep === WIZARD_STEPS.ONBOARDING_INTEGRATION) {
            setStep(WIZARD_STEPS.ONBOARDING_PRODUCTIVITY);
        } else if (currentStep === WIZARD_STEPS.ONBOARDING_PRODUCTIVITY) {
            if (templateData?.customInputs?.length) {
                setStep(WIZARD_STEPS.DOCUMENT_INPUTS);
            } else {
                handleStartProcess();
            }
        }
    }

    // Navigate to previous step
    const goToPreviousStep = (currentStep: number) => {
        if (currentStep === WIZARD_STEPS.DOCUMENT_INPUTS) {
            if (enableOnboarding) {
                setStep(WIZARD_STEPS.ONBOARDING_PRODUCTIVITY);
            } else {
                setStep(WIZARD_STEPS.ONBOARDING);
            }
        } else if (currentStep === WIZARD_STEPS.ONBOARDING_PRODUCTIVITY) {
            setStep(WIZARD_STEPS.ONBOARDING_INTEGRATION);
        } else if (currentStep === WIZARD_STEPS.ONBOARDING_INTEGRATION) {
            setStep(WIZARD_STEPS.ONBOARDING_ORIENTATION);
        } else if (currentStep === WIZARD_STEPS.ONBOARDING_ORIENTATION) {
            setStep(WIZARD_STEPS.ONBOARDING_PRE);
        } else if (currentStep === WIZARD_STEPS.ONBOARDING_PRE) {
            setStep(WIZARD_STEPS.ONBOARDING);
        } else if (currentStep === WIZARD_STEPS.ONBOARDING) {
            if (allowances.length > 0) {
                setStep(WIZARD_STEPS.ALLOWANCES);
            } else if (incentives.length > 0) {
                setStep(WIZARD_STEPS.INCENTIVES);
            } else if (salarySteps.length > 0) {
                setStep(WIZARD_STEPS.SALARY_STEP);
            } else {
                setStep(WIZARD_STEPS.APPOINTMENT_TYPE);
            }
        } else if (currentStep === WIZARD_STEPS.ALLOWANCES) {
            if (incentives.length > 0) {
                setStep(WIZARD_STEPS.INCENTIVES);
            } else if (salarySteps.length > 0) {
                setStep(WIZARD_STEPS.SALARY_STEP);
            } else {
                setStep(WIZARD_STEPS.APPOINTMENT_TYPE);
            }
        } else if (currentStep === WIZARD_STEPS.INCENTIVES) {
            if (salarySteps.length > 0) {
                setStep(WIZARD_STEPS.SALARY_STEP);
            } else {
                setStep(WIZARD_STEPS.APPOINTMENT_TYPE);
            }
        } else if (currentStep === WIZARD_STEPS.SALARY_STEP) {
            setStep(WIZARD_STEPS.APPOINTMENT_TYPE);
        } else if (currentStep === WIZARD_STEPS.APPOINTMENT_TYPE) {
            setStep(WIZARD_STEPS.EMPLOYEE_SELECT);
        }
    };

    const handleStartProcess = async () => {
        if (!firestore || !position || !selectedEmployee || !firebaseUser) {
            console.warn("Missing required data");
            return;
        }

        if (!selectedEmployee?.id || !position?.id) {
            toast({
                title: 'Алдаа',
                description: 'Ажилтан эсвэл ажлын байрны мэдээлэл дутуу байна.',
                variant: 'destructive'
            });
            return;
        }

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

            // Double-check offboarding status
            try {
                const active = await hasActiveOffboarding(selectedEmployee.id);
                if (active) {
                    toast({
                        title: 'Томилох боломжгүй',
                        description: 'Тухайн ажилтанд offboarding хөтөлбөр идэвхтэй байгаа тул томилох боломжгүй.',
                        variant: 'destructive'
                    });
                    setIsSubmitting(false);
                    return;
                }
            } catch (e) {
                console.warn("Offboarding check failed:", e);
            }

            const batch = writeBatch(firestore);

            // Fetch company profile
            let companyProfile = null;
            try {
                const companySnap = await getDocs(tCollection('company_profile'));
                companyProfile = !companySnap.empty ? companySnap.docs[0].data() : null;
            } catch (e) {
                console.warn("Failed to fetch company profile:", e);
            }

            // Fetch department
            let deptData = null;
            if (position.departmentId) {
                try {
                    const deptSnap = await getDoc(tDoc('departments', position.departmentId));
                    deptData = deptSnap.exists() ? { id: deptSnap.id, ...deptSnap.data() } : null;
                } catch (e) {
                    console.warn("Failed to fetch department:", e);
                }
            }

            // Prepare selected compensation data
            const selectedSalary = salarySteps[selectedSalaryStepIndex];
            const selectedIncentivesList = selectedIncentives.map(i => incentives[i]);
            const selectedAllowancesList = selectedAllowances.map(i => allowances[i]);

            // Generate document content if template exists
            let content = '';
            if (templateData) {
                try {
                    content = generateDocumentContent(templateData.content || '', {
                        employee: selectedEmployee,
                        department: deptData,
                        position: position,
                        company: companyProfile,
                        system: {
                            date: format(new Date(), 'yyyy-MM-dd'),
                            year: format(new Date(), 'yyyy'),
                            month: format(new Date(), 'MM'),
                            day: format(new Date(), 'dd'),
                            user: firebaseUser?.displayName || 'Системийн хэрэглэгч'
                        },
                        customInputs: customInputsPayload,
                        // Add selected compensation data to template
                        appointment: {
                            salaryStep: selectedSalary,
                            incentives: selectedIncentivesList,
                            allowances: selectedAllowancesList,
                        }
                    });
                } catch (e) {
                    console.error("Document content generation failed:", e);
                    content = '';
                }

                // Create er_document with document number
                try {
                    // Get document number if documentTypeId exists
                    let documentNumber: string | undefined;
                    if (templateData?.documentTypeId) {
                        try {
                            documentNumber = await getNextDocumentNumber(firestore, templateData.documentTypeId);
                        } catch (numErr) {
                            console.warn("Document number generation failed:", numErr);
                        }
                    }

                    // Re-generate content with documentNumber if available
                    if (documentNumber && templateData?.content) {
                        try {
                            content = generateDocumentContent(templateData.content, {
                                employee: selectedEmployee,
                                department: deptData,
                                position: position,
                                company: companyProfile,
                                system: {
                                    date: format(new Date(), 'yyyy-MM-dd'),
                                    year: format(new Date(), 'yyyy'),
                                    month: format(new Date(), 'MM'),
                                    day: format(new Date(), 'dd'),
                                    user: firebaseUser?.displayName || 'Системийн хэрэглэгч',
                                    documentNumber: documentNumber
                                },
                                customInputs: customInputsPayload,
                                appointment: {
                                    salaryStep: selectedSalary,
                                    incentives: selectedIncentivesList,
                                    allowances: selectedAllowancesList,
                                }
                            });
                        } catch (e) {
                            console.warn("Content regeneration with docNumber failed:", e);
                        }
                    }

                    const docRef = doc(tCollection('er_documents'));
                    batch.set(docRef, {
                        ...(documentNumber ? { documentNumber } : {}),
                        documentTypeId: templateData?.documentTypeId || null,
                        templateId: templateData?.id || null,
                        employeeId: selectedEmployee.id,
                        departmentId: position?.departmentId || null,
                        positionId: position.id,
                        creatorId: firebaseUser?.uid || null,
                        status: 'DRAFT',
                        content: content,
                        version: 1,
                        printSettings: templateData?.printSettings || null,
                        customInputs: customInputsPayload,
                        // Store appointment selections
                        appointmentData: {
                            actionId: selectedActionId,
                            salaryStepIndex: selectedSalaryStepIndex,
                            salaryStep: selectedSalary,
                            incentiveIndices: selectedIncentives,
                            incentives: selectedIncentivesList,
                            allowanceIndices: selectedAllowances,
                            allowances: selectedAllowancesList,
                            enableOnboarding: enableOnboarding,
                        },
                        metadata: {
                            employeeName: `${selectedEmployee?.firstName || ''} ${selectedEmployee?.lastName || ''}`,
                            templateName: templateData?.name || '',
                            departmentName: (deptData as any)?.name || '',
                            positionName: position?.title || '',
                            actionId: selectedActionId || '',
                            ...(documentNumber ? { documentNumber } : {})
                        },
                        history: [{
                            stepId: 'CREATE',
                            action: 'CREATE',
                            actorId: firebaseUser?.uid || null,
                            timestamp: Timestamp.now(),
                            comment: documentNumber ? `Баримт ${documentNumber} үүсгэв (Томилгоо)` : 'Томилгооны процесс эхлүүлэв (Бүтэц зураглалаас)'
                        }],
                        createdAt: Timestamp.now(),
                        updatedAt: Timestamp.now()
                    });
                } catch (e) {
                    console.error("ER document creation failed:", e);
                }
            }

            // Note: Onboarding projects will be created after batch commit

            // Update Employee with selected compensation
            try {
                const empRef = tDoc('employees', selectedEmployee.id);
                batch.update(empRef, {
                    positionId: position?.id || null,
                    jobTitle: position?.title || null,
                    departmentId: position?.departmentId || null,
                    status: 'appointing',
                    lifecycleStage: 'onboarding',
                    // Store appointment compensation
                    appointedCompensation: {
                        salaryStepIndex: selectedSalaryStepIndex,
                        salary: selectedSalary?.value || 0,
                        salaryStepName: selectedSalary?.name || '',
                        incentiveIndices: selectedIncentives,
                        allowanceIndices: selectedAllowances,
                    },
                    updatedAt: Timestamp.now()
                });
            } catch (e) {
                console.error("Employee update failed:", e);
                throw new Error('Ажилтны мэдээллийг шинэчлэхэд алдаа гарлаа.');
            }

            // Update Position filled count
            try {
                const posRef = tDoc('positions', position.id);
                batch.update(posRef, {
                    filled: increment(1),
                    updatedAt: Timestamp.now()
                });
            } catch (e) {
                console.error("Position update failed:", e);
                throw new Error('Ажлын байрны мэдээллийг шинэчлэхэд алдаа гарлаа.');
            }

            // Commit Batch
            try {
                await batch.commit();
            } catch (e) {
                console.error("Batch commit failed:", e);
                throw new Error('Мэдээллийг хадгалахад алдаа гарлаа.');
            }

            // Create Onboarding Projects (after batch commit succeeds)
            if (enableOnboarding) {
                try {
                    const configSnap = await getDoc(tDoc('settings', 'onboarding'));
                    const config = configSnap.exists() ? configSnap.data() : { stages: [] };
                    const onboardingStages = (config.stages || []) as OnboardingStage[];

                    if (onboardingStages.length > 0) {
                        const employeeName = `${selectedEmployee.firstName || ''} ${selectedEmployee.lastName || ''}`.trim();
                        const appointerId = currentUserProfile?.id || firebaseUser?.uid || '';
                        const startDate = format(new Date(), 'yyyy-MM-dd');

                        // Build task plan from wizard selections (4 stages)
                        const taskPlan: OnboardingStageTaskPlan[] = ONBOARDING_STAGE_ORDER.map((sid) => {
                            const stageMap = onboardingTaskPlan[sid] || {};
                            const tasks = Object.entries(stageMap)
                                .filter(([, p]) => p?.selected)
                                .map(([templateTaskId, p]) => ({
                                    templateTaskId,
                                    dueDate: String(p.dueDate || ''),
                                    ownerId: String(p.ownerId || ''),
                                }))
                                .filter(t => isValidDateString(t.dueDate) && !!t.ownerId);
                            return { stageId: sid, tasks };
                        });

                        const totalSelected = taskPlan.reduce((acc, s) => acc + (s.tasks?.length || 0), 0);
                        if (totalSelected === 0) {
                            throw new Error('Onboarding таск сонгоогүй байна. Onboarding-ийг сонгосон бол дор хаяж 1 таск сонгоно уу.');
                        }

                        const result = await createOnboardingProjects({
                            firestore,
                            employeeId: selectedEmployee.id,
                            employeeName: employeeName || 'Шинэ ажилтан',
                            mentorId: undefined, // TODO: Add mentor selection if needed
                            appointerId,
                            onboardingConfig: onboardingStages,
                            // Position дээр onboarding тохируулах логик цаашид ашиглахгүй
                            positionOnboardingIds: undefined,
                            startDate,
                            taskPlan,
                            alwaysCreateAllStages: true,
                        });

                        console.log(`[Appoint] Created ${result.projectIds.length} onboarding projects with ${result.taskCount} tasks`);
                    }
                } catch (e) {
                    console.error("Onboarding projects creation failed:", e);
                    // Don't throw error - appointment was successful, just onboarding projects failed
                    toast({
                        title: 'Анхааруулга',
                        description: 'Onboarding төслүүд үүсгэхэд алдаа гарлаа. Гараар нэмнэ үү.',
                        variant: 'destructive'
                    });
                }
            }

            toast({
                title: 'Томилгоо эхэллээ',
                description: `${selectedEmployee?.firstName || ''} ${selectedEmployee?.lastName || ''} ажилтныг "${position?.title || ''}" албан тушаалд томилох процесс эхэллээ.`,
            });

            if (onSuccess && selectedEmployee?.id) {
                onSuccess(selectedEmployee.id);
            }

            onOpenChange(false);
        } catch (error: any) {
            console.error("Appointment error:", error);
            toast({
                title: 'Алдаа гарлаа',
                description: error?.message || 'Томилгооны процесс хийхэд алдаа гарлаа.',
                variant: 'destructive'
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    // Calculate current step progress
    const getStepProgress = () => {
        const steps = [];
        steps.push({ id: 1, name: 'Ажилтан' });
        steps.push({ id: 2, name: 'Төрөл' });
        if (salarySteps.length > 0) steps.push({ id: 3, name: 'Цалин' });
        if (incentives.length > 0) steps.push({ id: 4, name: 'Урамшуулал' });
        if (allowances.length > 0) steps.push({ id: 5, name: 'Хангамж' });
        steps.push({ id: WIZARD_STEPS.ONBOARDING, name: 'Onboarding' });
        if (enableOnboarding) {
            steps.push({ id: WIZARD_STEPS.ONBOARDING_PRE, name: 'Бэлтгэл' });
            steps.push({ id: WIZARD_STEPS.ONBOARDING_ORIENTATION, name: 'Танилцах' });
            steps.push({ id: WIZARD_STEPS.ONBOARDING_INTEGRATION, name: 'Уусах' });
            steps.push({ id: WIZARD_STEPS.ONBOARDING_PRODUCTIVITY, name: 'Бүтээмж' });
        }
        if (templateData?.customInputs?.length) steps.push({ id: WIZARD_STEPS.DOCUMENT_INPUTS, name: 'Баримт' });
        return steps;
    };

    const stepProgress = getStepProgress();
    const currentStepIndex = stepProgress.findIndex(s => s.id === step);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[560px] h-[700px] flex flex-col p-0 gap-0 overflow-hidden rounded-3xl border-none shadow-premium">
                <DialogHeader className="p-6 pb-4 bg-gradient-to-br from-primary/5 to-background border-b shrink-0">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 rounded-xl bg-primary/10 text-primary">
                            <UserPlus className="h-5 w-5" />
                        </div>
                        <div>
                            <DialogTitle className="text-lg font-bold">
                                Ажилтан томилох
                            </DialogTitle>
                            <DialogDescription className="text-xs">
                                <span className="font-semibold text-foreground">"{position?.title}"</span> ажлын байр
                            </DialogDescription>
                        </div>
                    </div>
                    
                    {/* Step Progress Indicator */}
                    {step > WIZARD_STEPS.EMPLOYEE_SELECT && (
                        <div className="flex items-center gap-1 mt-3">
                            {stepProgress.map((s, i) => (
                                <React.Fragment key={s.id}>
                                    <div className={cn(
                                        "flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-bold transition-all",
                                        s.id === step 
                                            ? "bg-primary text-primary-foreground" 
                                            : s.id < step 
                                                ? "bg-primary/20 text-primary"
                                                : "bg-muted text-muted-foreground"
                                    )}>
                                        {s.id < step ? (
                                            <Check className="h-3 w-3" />
                                        ) : (
                                            <span>{i + 1}</span>
                                        )}
                                        <span className="hidden sm:inline">{s.name}</span>
                                    </div>
                                    {i < stepProgress.length - 1 && (
                                        <div className={cn(
                                            "h-0.5 w-3 rounded-full transition-all",
                                            s.id < step ? "bg-primary" : "bg-muted"
                                        )} />
                                    )}
                                </React.Fragment>
                            ))}
                        </div>
                    )}
                    
                    {/* Debug: Show available data */}
                    {step === WIZARD_STEPS.APPOINTMENT_TYPE && (
                        <div className="flex flex-wrap gap-1 mt-2">
                            {isPositionLoading ? (
                                <Badge variant="outline" className="text-[9px]">
                                    <Loader2 className="h-3 w-3 animate-spin mr-1" />
                                    Ачаалж байна...
                                </Badge>
                            ) : (
                                <>
                                    <Badge variant={salarySteps.length > 0 ? "default" : "outline"} className="text-[9px]">
                                        Цалин: {salarySteps.length}
                                    </Badge>
                                    <Badge variant={incentives.length > 0 ? "default" : "outline"} className="text-[9px]">
                                        Урамшуулал: {incentives.length}
                                    </Badge>
                                    <Badge variant={allowances.length > 0 ? "default" : "outline"} className="text-[9px]">
                                        Хангамж: {allowances.length}
                                    </Badge>
                                </>
                            )}
                        </div>
                    )}
                </DialogHeader>

                <div className="flex-1 flex flex-col overflow-hidden relative">
                    {/* Step 1: Employee Selection */}
                    {step === WIZARD_STEPS.EMPLOYEE_SELECT && (
                        <>
                            <div className="px-6 py-3 border-b bg-muted/20 shrink-0">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        placeholder="Ажилтны нэр, кодоор хайх..."
                                        value={search}
                                        onChange={(e) => setSearch(e.target.value)}
                                        className="pl-10 h-10 bg-background rounded-xl"
                                    />
                                </div>
                            </div>
                            <ScrollArea className="flex-1">
                                <div className="p-4 space-y-2">
                                    {employeesLoading ? (
                                        <div className="flex flex-col items-center justify-center py-16 gap-3">
                                            <Loader2 className="h-8 w-8 animate-spin text-primary/40" />
                                            <p className="text-xs text-muted-foreground">Ажилтны жагсаалт уншиж байна...</p>
                                        </div>
                                    ) : filteredEmployees.length > 0 ? (
                                        filteredEmployees.map((emp) => (
                                            <div
                                                key={emp.id}
                                                className="flex items-center justify-between p-3 rounded-xl bg-background border hover:border-primary/30 hover:bg-primary/5 transition-all cursor-pointer group"
                                                onClick={() => handleEmployeeSelect(emp)}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <Avatar className="h-10 w-10 border-2 border-white shadow-sm">
                                                        <AvatarImage src={emp.photoURL} />
                                                        <AvatarFallback className="bg-primary/5 text-primary font-bold">
                                                            {emp.firstName?.charAt(0)}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <div>
                                                        <div className="font-semibold text-sm">{emp.firstName} {emp.lastName}</div>
                                                        <div className="text-[10px] text-muted-foreground">#{emp.employeeCode}</div>
                                                    </div>
                                                </div>
                                                <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                                            </div>
                                        ))
                                    ) : (
                                        <div className="py-16 text-center">
                                            <Search className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                                            <p className="text-sm font-medium">Илэрц олдсонгүй</p>
                                            <p className="text-xs text-muted-foreground">Томилогдоогүй ажилтан олдсонгүй</p>
                                        </div>
                                    )}
                                </div>
                            </ScrollArea>
                        </>
                    )}

                    {/* Step 2: Appointment Type */}
                    {step === WIZARD_STEPS.APPOINTMENT_TYPE && (
                        <ScrollArea className="flex-1">
                            <div className="p-6 space-y-4">
                                {/* Offboarding warnings */}
                                {offboardingStatus === 'checking' && (
                                    <div className="p-3 rounded-xl bg-slate-50 border flex items-center gap-2">
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        <span className="text-sm">Төлөв шалгаж байна...</span>
                                    </div>
                                )}
                                {offboardingStatus === 'active' && (
                                    <div className="p-3 rounded-xl bg-red-50 border border-red-200 flex items-start gap-2">
                                        <X className="h-4 w-4 text-red-600 mt-0.5" />
                                        <div>
                                            <div className="font-semibold text-red-800 text-sm">Offboarding идэвхтэй</div>
                                            <p className="text-xs text-red-600">Томилох боломжгүй</p>
                                        </div>
                                    </div>
                                )}

                                <div className="text-center mb-4">
                                    <h3 className="font-bold">Томилгооны төрөл сонгох</h3>
                                    <p className="text-xs text-muted-foreground mt-1">Сонголт дарахад автоматаар үргэлжилнэ</p>
                                </div>

                                {[
                                    { id: 'appointment_permanent', name: 'Үндсэн ажилтнаар томилох', desc: 'Байнгын гэрээтэй', icon: UserPlus, color: 'bg-indigo-50 text-indigo-600' },
                                    { id: 'appointment_probation', name: 'Туршилтын хугацаатай томилох', desc: 'Туршилтын гэрээтэй', icon: Clock, color: 'bg-amber-50 text-amber-600' },
                                    { id: 'appointment_reappoint', name: 'Эргүүлэн томилох', desc: 'Дахин томилолт', icon: GitBranch, color: 'bg-emerald-50 text-emerald-600' },
                                ].map((type) => (
                                    <button
                                        key={type.id}
                                        onClick={() => handleSelectAppointmentType(type)}
                                        disabled={offboardingStatus === 'active' || offboardingStatus === 'checking'}
                                        className={cn(
                                            "w-full flex items-center gap-4 p-4 rounded-xl border-2 bg-white transition-all text-left group",
                                            offboardingStatus !== 'none'
                                                ? "opacity-50 cursor-not-allowed"
                                                : "hover:border-primary hover:shadow-md"
                                        )}
                                    >
                                        <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center", type.color)}>
                                            <type.icon className="h-5 w-5" />
                                        </div>
                                        <div className="flex-1">
                                            <div className="font-semibold">{type.name}</div>
                                            <div className="text-xs text-muted-foreground">{type.desc}</div>
                                        </div>
                                        <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                                    </button>
                                ))}
                            </div>
                        </ScrollArea>
                    )}

                    {/* Step 3: Salary Step Selection */}
                    {step === WIZARD_STEPS.SALARY_STEP && (
                        <ScrollArea className="flex-1">
                            <div className="p-6 space-y-4">
                                <div className="text-center mb-4">
                                    <div className="inline-flex items-center justify-center h-10 w-10 rounded-xl bg-emerald-100 text-emerald-600 mb-2">
                                        <DollarSign className="h-5 w-5" />
                                    </div>
                                    <h3 className="font-bold">Цалингийн шатлал сонгох</h3>
                                    <p className="text-xs text-muted-foreground mt-1">Сонголт дарахад автоматаар үргэлжилнэ</p>
                                </div>

                                <div className="space-y-2">
                                    {salarySteps.map((salaryStep, index) => (
                                        <button
                                            key={index}
                                            onClick={() => {
                                                setSelectedSalaryStepIndex(index);
                                                goToNextStep(WIZARD_STEPS.SALARY_STEP);
                                            }}
                                            className={cn(
                                                "w-full flex items-center justify-between p-4 rounded-xl border-2 transition-all text-left group",
                                                positionData?.salarySteps?.activeIndex === index
                                                    ? "border-emerald-300 bg-emerald-50"
                                                    : "border-slate-200 bg-white hover:border-primary hover:shadow-md"
                                            )}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className={cn(
                                                    "h-8 w-8 rounded-full flex items-center justify-center font-bold text-sm",
                                                    positionData?.salarySteps?.activeIndex === index
                                                        ? "bg-emerald-500 text-white"
                                                        : "bg-slate-100 text-slate-600"
                                                )}>
                                                    {index + 1}
                                                </div>
                                                <div>
                                                    <div className="font-semibold">{salaryStep.name}</div>
                                                    {positionData?.salarySteps?.activeIndex === index && (
                                                        <Badge variant="outline" className="text-[9px] h-4 border-emerald-300 text-emerald-600">
                                                            Анхдагч
                                                        </Badge>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="font-bold text-lg">{salaryStep.value.toLocaleString()}₮</span>
                                                <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </ScrollArea>
                    )}

                    {/* Step 4: Incentives Selection */}
                    {step === WIZARD_STEPS.INCENTIVES && (
                        <ScrollArea className="flex-1">
                            <div className="p-6 space-y-4">
                                <div className="text-center mb-4">
                                    <div className="inline-flex items-center justify-center h-10 w-10 rounded-xl bg-amber-100 text-amber-600 mb-2">
                                        <Zap className="h-5 w-5" />
                                    </div>
                                    <h3 className="font-bold">Урамшуулал & Нэмэгдэл сонгох</h3>
                                    <p className="text-xs text-muted-foreground mt-1">Олгохыг хүссэн урамшууллуудаа сонгоно уу</p>
                                </div>

                                <div className="space-y-2">
                                    {incentives.map((inc, index) => (
                                        <label
                                            key={index}
                                            className={cn(
                                                "flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all",
                                                selectedIncentives.includes(index)
                                                    ? "border-amber-300 bg-amber-50"
                                                    : "border-slate-200 bg-white hover:border-amber-200"
                                            )}
                                        >
                                            <Checkbox
                                                checked={selectedIncentives.includes(index)}
                                                onCheckedChange={(checked) => {
                                                    if (checked) {
                                                        setSelectedIncentives(prev => [...prev, index]);
                                                    } else {
                                                        setSelectedIncentives(prev => prev.filter(i => i !== index));
                                                    }
                                                }}
                                                className="h-5 w-5"
                                            />
                                            <div className="flex-1">
                                                <div className="font-semibold text-sm">{inc.type}</div>
                                                {inc.description && (
                                                    <p className="text-xs text-muted-foreground">{inc.description}</p>
                                                )}
                                            </div>
                                            <div className="text-right">
                                                <Badge variant="secondary" className="font-bold">
                                                    {inc.unit === '₮' ? inc.amount.toLocaleString() : inc.amount}{inc.unit}
                                                </Badge>
                                                {inc.frequency && (
                                                    <p className="text-[10px] text-muted-foreground mt-0.5">{inc.frequency}</p>
                                                )}
                                            </div>
                                        </label>
                                    ))}
                                </div>

                                {incentives.length === 0 && (
                                    <div className="text-center py-8 text-muted-foreground">
                                        <Zap className="h-8 w-8 mx-auto mb-2 opacity-30" />
                                        <p className="text-sm">Урамшуулал тохируулаагүй</p>
                                    </div>
                                )}
                            </div>
                        </ScrollArea>
                    )}

                    {/* Step 5: Allowances Selection */}
                    {step === WIZARD_STEPS.ALLOWANCES && (
                        <ScrollArea className="flex-1">
                            <div className="p-6 space-y-4">
                                <div className="text-center mb-4">
                                    <div className="inline-flex items-center justify-center h-10 w-10 rounded-xl bg-violet-100 text-violet-600 mb-2">
                                        <Gift className="h-5 w-5" />
                                    </div>
                                    <h3 className="font-bold">Хангамж сонгох</h3>
                                    <p className="text-xs text-muted-foreground mt-1">Олгохыг хүссэн хангамжуудаа сонгоно уу</p>
                                </div>

                                <div className="space-y-2">
                                    {allowances.map((all, index) => (
                                        <label
                                            key={index}
                                            className={cn(
                                                "flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all",
                                                selectedAllowances.includes(index)
                                                    ? "border-violet-300 bg-violet-50"
                                                    : "border-slate-200 bg-white hover:border-violet-200"
                                            )}
                                        >
                                            <Checkbox
                                                checked={selectedAllowances.includes(index)}
                                                onCheckedChange={(checked) => {
                                                    if (checked) {
                                                        setSelectedAllowances(prev => [...prev, index]);
                                                    } else {
                                                        setSelectedAllowances(prev => prev.filter(i => i !== index));
                                                    }
                                                }}
                                                className="h-5 w-5"
                                            />
                                            <div className="flex-1">
                                                <div className="font-semibold text-sm">{all.type}</div>
                                            </div>
                                            <div className="text-right">
                                                <Badge variant="secondary" className="font-bold">
                                                    {all.amount.toLocaleString()}₮
                                                </Badge>
                                                <p className="text-[10px] text-muted-foreground mt-0.5">
                                                    {all.period === 'monthly' ? 'Сар бүр' : 
                                                     all.period === 'yearly' ? 'Жил бүр' : 
                                                     all.period === 'once' ? 'Нэг удаа' : all.period}
                                                </p>
                                            </div>
                                        </label>
                                    ))}
                                </div>

                                {allowances.length === 0 && (
                                    <div className="text-center py-8 text-muted-foreground">
                                        <Gift className="h-8 w-8 mx-auto mb-2 opacity-30" />
                                        <p className="text-sm">Хангамж тохируулаагүй</p>
                                    </div>
                                )}
                            </div>
                        </ScrollArea>
                    )}

                    {/* Step 6: Onboarding Selection */}
                    {step === WIZARD_STEPS.ONBOARDING && (
                        <ScrollArea className="flex-1">
                            <div className="p-6 space-y-4">
                                <div className="text-center mb-4">
                                    <div className="inline-flex items-center justify-center h-10 w-10 rounded-xl bg-blue-100 text-blue-600 mb-2">
                                        <GraduationCap className="h-5 w-5" />
                                    </div>
                                    <h3 className="font-bold">Чиглүүлэх хөтөлбөр (Onboarding)</h3>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        Тийм гэж сонговол дараагийн алхмуудаар таск сонгож (хугацаа/хариуцагч) onboarding төслүүд үүсгэнэ.
                                    </p>
                                </div>

                                <div className="space-y-3">
                                    <button
                                        onClick={() => {
                                            setEnableOnboarding(true);
                                            // IMPORTANT: setState is async, so jump directly to onboarding planning step
                                            setStep(WIZARD_STEPS.ONBOARDING_PRE);
                                        }}
                                        className={cn(
                                            "w-full flex items-center gap-4 p-5 rounded-xl border-2 transition-all text-left group",
                                            "border-slate-200 bg-white hover:border-blue-400 hover:shadow-md"
                                        )}
                                    >
                                        <div className="h-12 w-12 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600">
                                            <Check className="h-6 w-6" />
                                        </div>
                                        <div className="flex-1">
                                            <div className="font-bold">Тийм, эхлүүлэх</div>
                                            <div className="text-xs text-muted-foreground">Onboarding хөтөлбөр автоматаар эхэлнэ</div>
                                        </div>
                                        <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
                                    </button>

                                    <button
                                        onClick={() => {
                                            setEnableOnboarding(false);
                                            // Skip onboarding planning steps
                                            if (templateData?.customInputs?.length) {
                                                setStep(WIZARD_STEPS.DOCUMENT_INPUTS);
                                            } else {
                                                handleStartProcess();
                                            }
                                        }}
                                        className={cn(
                                            "w-full flex items-center gap-4 p-5 rounded-xl border-2 transition-all text-left group",
                                            "border-slate-200 bg-white hover:border-slate-400 hover:shadow-md"
                                        )}
                                    >
                                        <div className="h-12 w-12 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600">
                                            <X className="h-6 w-6" />
                                        </div>
                                        <div className="flex-1">
                                            <div className="font-bold">Үгүй, алгасах</div>
                                            <div className="text-xs text-muted-foreground">Onboarding хөтөлбөргүйгээр томилно</div>
                                        </div>
                                        <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-slate-600 group-hover:translate-x-1 transition-all" />
                                    </button>
                                </div>
                            </div>
                        </ScrollArea>
                    )}

                    {/* Step 7-10: Onboarding task planning (4 stages) */}
                    {(step === WIZARD_STEPS.ONBOARDING_PRE ||
                        step === WIZARD_STEPS.ONBOARDING_ORIENTATION ||
                        step === WIZARD_STEPS.ONBOARDING_INTEGRATION ||
                        step === WIZARD_STEPS.ONBOARDING_PRODUCTIVITY) && (
                        <ScrollArea className="flex-1">
                            <div className="p-6 space-y-5">
                                {(() => {
                                    const stageId: OnboardingStageId =
                                        step === WIZARD_STEPS.ONBOARDING_PRE
                                            ? 'pre-onboarding'
                                            : step === WIZARD_STEPS.ONBOARDING_ORIENTATION
                                            ? 'orientation'
                                            : step === WIZARD_STEPS.ONBOARDING_INTEGRATION
                                            ? 'integration'
                                            : 'productivity';

                                    const stage = getStageConfig(stageId);
                                    const tasks = stage?.tasks || [];
                                    const stagePlan = onboardingTaskPlan[stageId] || {};

                                    return (
                                        <>
                                            <div className="text-center">
                                                <div className="inline-flex items-center justify-center h-10 w-10 rounded-xl bg-indigo-100 text-indigo-600 mb-2">
                                                    <GraduationCap className="h-5 w-5" />
                                                </div>
                                                <h3 className="font-bold">{ONBOARDING_STAGE_TITLES[stageId]}</h3>
                                                <p className="text-xs text-muted-foreground mt-1">
                                                    Сонгосон таск: <span className="font-bold">{Object.values(stagePlan).filter(p => p?.selected).length}</span>
                                                </p>
                                            </div>

                                            {!stage ? (
                                                <div className="p-4 rounded-xl border bg-slate-50 text-slate-700 text-sm">
                                                    Onboarding тохиргоо олдсонгүй. `/dashboard/onboarding/settings` дээр тохируулна уу.
                                                </div>
                                            ) : tasks.length === 0 ? (
                                                <div className="p-4 rounded-xl border bg-slate-50 text-slate-700 text-sm">
                                                    Энэ үе шатанд таск тохируулаагүй байна.
                                                </div>
                                            ) : (
                                                <div className="space-y-3">
                                                    {tasks.map((t: any, idx: number) => {
                                                        const plan = stagePlan[t.id] || { selected: false };
                                                        const selected = !!plan.selected;
                                                        const dueDate = plan.dueDate;
                                                        const ownerId = plan.ownerId;

                                                        return (
                                                            <div
                                                                key={t.id}
                                                                className={cn(
                                                                    'rounded-2xl border p-4 transition-all',
                                                                    selected ? 'border-indigo-200 bg-indigo-50/40' : 'border-slate-200 bg-white'
                                                                )}
                                                            >
                                                                <div className="flex items-start gap-3">
                                                                    <Checkbox
                                                                        checked={selected}
                                                                        onCheckedChange={(val) => {
                                                                            const checked = !!val;
                                                                            setOnboardingTaskPlan(prev => {
                                                                                const prevStage = prev[stageId] || {};
                                                                                const existing = prevStage[t.id] || { selected: false };
                                                                                const nextStage = {
                                                                                    ...prevStage,
                                                                                    [t.id]: {
                                                                                        ...existing,
                                                                                        selected: checked,
                                                                                        dueDate: checked && !isValidDateString(existing.dueDate)
                                                                                            ? getDefaultDueDateForStage(stageId)
                                                                                            : existing.dueDate,
                                                                                        ownerId: checked && !existing.ownerId
                                                                                            ? (currentUserProfile?.id || undefined)
                                                                                            : existing.ownerId,
                                                                                    }
                                                                                };
                                                                                return { ...prev, [stageId]: nextStage };
                                                                            });
                                                                        }}
                                                                        className="mt-0.5"
                                                                    />
                                                                    <div className="flex-1 min-w-0">
                                                                        <div className="flex items-center gap-2">
                                                                            <span className="text-xs font-bold text-slate-400">{idx + 1}.</span>
                                                                            <div className="font-semibold text-sm text-slate-800 truncate">{t.title}</div>
                                                                            {selected && (
                                                                                <Badge variant="secondary" className="text-[10px]">
                                                                                    Сонгосон
                                                                                </Badge>
                                                                            )}
                                                                        </div>
                                                                        {t.description ? (
                                                                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{t.description}</p>
                                                                        ) : null}

                                                                        {selected ? (
                                                                            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                                                <div className="space-y-1.5">
                                                                                    <Label className="text-xs font-semibold">Хугацаа</Label>
                                                                                    <Popover>
                                                                                        <PopoverTrigger asChild>
                                                                                            <Button
                                                                                                variant="outline"
                                                                                                className={cn(
                                                                                                    'h-10 w-full justify-start text-left font-medium rounded-xl bg-white',
                                                                                                    !dueDate && 'text-muted-foreground'
                                                                                                )}
                                                                                            >
                                                                                                <CalendarIcon className="mr-2 h-4 w-4" />
                                                                                                {dueDate ? format(new Date(dueDate), 'yyyy.MM.dd') : 'Огноо сонгох'}
                                                                                            </Button>
                                                                                        </PopoverTrigger>
                                                                                        <PopoverContent className="w-auto p-0" align="start">
                                                                                            <Calendar
                                                                                                mode="single"
                                                                                                selected={dueDate ? new Date(dueDate) : undefined}
                                                                                                onSelect={(date) => {
                                                                                                    setOnboardingTaskPlan(prev => ({
                                                                                                        ...prev,
                                                                                                        [stageId]: {
                                                                                                            ...(prev[stageId] || {}),
                                                                                                            [t.id]: {
                                                                                                                ...((prev[stageId] || {})[t.id] || { selected: true }),
                                                                                                                selected: true,
                                                                                                                dueDate: date ? format(date, 'yyyy-MM-dd') : undefined,
                                                                                                            }
                                                                                                        }
                                                                                                    }));
                                                                                                }}
                                                                                                initialFocus
                                                                                            />
                                                                                        </PopoverContent>
                                                                                    </Popover>
                                                                                </div>

                                                                                <div className="space-y-1.5">
                                                                                    <Label className="text-xs font-semibold">Хариуцагч</Label>
                                                                                    <Select
                                                                                        value={ownerId || ''}
                                                                                        onValueChange={(val) => {
                                                                                            setOnboardingTaskPlan(prev => ({
                                                                                                ...prev,
                                                                                                [stageId]: {
                                                                                                    ...(prev[stageId] || {}),
                                                                                                    [t.id]: {
                                                                                                        ...((prev[stageId] || {})[t.id] || { selected: true }),
                                                                                                        selected: true,
                                                                                                        ownerId: val || undefined,
                                                                                                    }
                                                                                                }
                                                                                            }));
                                                                                        }}
                                                                                    >
                                                                                        <SelectTrigger className="h-10 rounded-xl bg-white">
                                                                                            <SelectValue placeholder="Хариуцагч сонгох..." />
                                                                                        </SelectTrigger>
                                                                                        <SelectContent>
                                                                                            {(allEmployees || []).map((emp) => {
                                                                                                const label = `${emp.lastName || ''} ${emp.firstName || ''}`.trim() || emp.email || emp.id;
                                                                                                return (
                                                                                                    <SelectItem key={emp.id} value={emp.id}>
                                                                                                        {label}
                                                                                                    </SelectItem>
                                                                                                );
                                                                                            })}
                                                                                        </SelectContent>
                                                                                    </Select>
                                                                                </div>
                                                                            </div>
                                                                        ) : null}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </>
                                    );
                                })()}
                            </div>
                        </ScrollArea>
                    )}

                    {/* Step 7: Document Custom Inputs */}
                    {step === WIZARD_STEPS.DOCUMENT_INPUTS && (
                        <ScrollArea className="flex-1">
                            <div className="p-6 space-y-4">
                                <div className="text-center mb-4">
                                    <div className="inline-flex items-center justify-center h-10 w-10 rounded-xl bg-indigo-100 text-indigo-600 mb-2">
                                        <FileText className="h-5 w-5" />
                                    </div>
                                    <h3 className="font-bold">Баримтын мэдээлэл бөглөх</h3>
                                    <p className="text-xs text-muted-foreground mt-1">Томилгооны баримтад шаардлагатай мэдээллүүд</p>
                                </div>

                                {templateLoading ? (
                                    <div className="flex justify-center py-8">
                                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                                    </div>
                    ) : normalizedCustomInputs.length ? (
                                    <div className="space-y-4">
                            {normalizedCustomInputs.map((input: any) => (
                                <div key={input.__normalizedKey} className="space-y-1.5">
                                                <Label className="text-xs font-semibold">
                                                    {input.label} {input.required && <span className="text-rose-500">*</span>}
                                                </Label>
                                                {input.type === 'date' ? (
                                                    <Popover>
                                                        <PopoverTrigger asChild>
                                                            <Button
                                                                variant="outline"
                                                                className={cn(
                                                                    "h-10 w-full justify-start text-left font-medium rounded-xl",
                                                        !customInputValues[input.__normalizedKey] && "text-muted-foreground"
                                                                )}
                                                            >
                                                                <CalendarIcon className="mr-2 h-4 w-4" />
                                                    {customInputValues[input.__normalizedKey]
                                                        ? format(new Date(customInputValues[input.__normalizedKey]), "yyyy.MM.dd")
                                                                    : "Огноо сонгох"
                                                                }
                                                            </Button>
                                                        </PopoverTrigger>
                                                        <PopoverContent className="w-auto p-0" align="start">
                                                            <Calendar
                                                                mode="single"
                                                    selected={customInputValues[input.__normalizedKey] ? new Date(customInputValues[input.__normalizedKey]) : undefined}
                                                    onSelect={(date) => handleCustomInputChange(input.__normalizedKey, date ? format(date, 'yyyy-MM-dd') : '')}
                                                                initialFocus
                                                            />
                                                        </PopoverContent>
                                                    </Popover>
                                                ) : input.type === 'number' ? (
                                                    <Input
                                                        type="number"
                                            value={customInputValues[input.__normalizedKey] || ''}
                                            onChange={(e) => handleCustomInputChange(input.__normalizedKey, e.target.value)}
                                                        placeholder={input.description || `${input.label} оруулна уу`}
                                                        className="h-10 rounded-xl"
                                                    />
                                                ) : input.type === 'boolean' ? (
                                                    <div className="flex items-center space-x-2 h-10 px-4 bg-slate-50 rounded-xl border">
                                                        <Switch
                                                checked={!!customInputValues[input.__normalizedKey]}
                                                onCheckedChange={(checked) => handleCustomInputChange(input.__normalizedKey, checked)}
                                                        />
                                            <span className="text-sm">{customInputValues[input.__normalizedKey] ? 'Тийм' : 'Үгүй'}</span>
                                                    </div>
                                                ) : (
                                                    <Input
                                            value={customInputValues[input.__normalizedKey] || ''}
                                            onChange={(e) => handleCustomInputChange(input.__normalizedKey, e.target.value)}
                                                        placeholder={input.description || `${input.label} оруулна уу`}
                                                        className="h-10 rounded-xl"
                                                    />
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center py-8 text-muted-foreground">
                                        <FileText className="h-8 w-8 mx-auto mb-2 opacity-30" />
                                        <p className="text-sm">Нэмэлт мэдээлэл шаардлагагүй</p>
                                    </div>
                                )}
                            </div>
                        </ScrollArea>
                    )}

                    {/* Loading Overlay */}
                    {isSubmitting && (
                        <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center gap-4">
                            <div className="h-16 w-16 rounded-full border-4 border-slate-100 border-t-primary animate-spin" />
                            <div className="text-center">
                                <p className="font-bold">Томилгоо хийж байна</p>
                                <p className="text-xs text-muted-foreground">Түр хүлээнэ үү...</p>
                            </div>
                        </div>
                    )}
                </div>

                <DialogFooter className="p-4 border-t bg-slate-50/50 shrink-0">
                    {step === WIZARD_STEPS.EMPLOYEE_SELECT ? (
                        <Button variant="ghost" onClick={() => onOpenChange(false)} className="rounded-xl">
                            Болих
                        </Button>
                    ) : step === WIZARD_STEPS.APPOINTMENT_TYPE || step === WIZARD_STEPS.SALARY_STEP || step === WIZARD_STEPS.ONBOARDING ? (
                        // Single-choice steps - only back button
                        <Button 
                            variant="outline" 
                            onClick={() => goToPreviousStep(step)} 
                            className="rounded-xl"
                            disabled={isSubmitting}
                        >
                            <ChevronLeft className="h-4 w-4 mr-1" />
                            Буцах
                        </Button>
                    ) : (
                        // Multi-choice steps - back and continue buttons
                        <div className="flex w-full gap-3">
                            <Button
                                variant="outline"
                                onClick={() => goToPreviousStep(step)}
                                className="flex-1 rounded-xl"
                                disabled={isSubmitting}
                            >
                                <ChevronLeft className="h-4 w-4 mr-1" />
                                Буцах
                            </Button>
                            {step === WIZARD_STEPS.DOCUMENT_INPUTS ? (
                                <Button
                                    onClick={handleStartProcess}
                                    disabled={isSubmitting || normalizedCustomInputs.some((i: any) => i.required && !customInputValues[i.__normalizedKey])}
                                    className="flex-[2] bg-primary hover:bg-primary/90 rounded-xl"
                                >
                                    {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
                                    Томилгоо эхлүүлэх
                                </Button>
                            ) : (
                                <Button
                                    onClick={() => goToNextStep(step)}
                                    className="flex-[2] rounded-xl"
                                    disabled={isSubmitting}
                                >
                                    Үргэлжлүүлэх
                                    <ChevronRight className="h-4 w-4 ml-1" />
                                </Button>
                            )}
                        </div>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
