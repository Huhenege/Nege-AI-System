'use client';

import * as React from 'react';
import {
  AppDialog,
  AppDialogContent,
  AppDialogDescription,
  AppDialogFooter,
  AppDialogHeader,
  AppDialogTitle,
} from '@/components/patterns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { useFetchCollection, useFetchDoc, useFirebase, useMemoFirebase, tenantCollection, tenantDoc } from '@/firebase';
import { query, where } from 'firebase/firestore';
import { Employee } from '@/types';
import {
  createOnboardingProjects,
  OnboardingStage,
  OnboardingStageTaskPlan,
} from '@/lib/onboarding-project-creator';
import { useEmployeeProfile } from '@/hooks/use-employee-profile';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { mn } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import {
  ArrowRight,
  Calendar as CalendarIcon,
  Check,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  Loader2,
  Search,
  UserCircle2,
} from 'lucide-react';

type StageId = 'pre-onboarding' | 'orientation' | 'integration' | 'productivity';

const STAGE_ORDER: StageId[] = ['pre-onboarding', 'orientation', 'integration', 'productivity'];

const STAGE_TITLES: Record<StageId, string> = {
  'pre-onboarding': 'Урьдчилсан бэлтгэл үе',
  orientation: 'Дасан зохицох, танилцах үе',
  integration: 'Ажлын үүрэгт уусах үе',
  productivity: 'Тогтворжилт, бүтээмжийн үе',
};

// Default due offsets used only for initial suggestion when selecting a task
const STAGE_DUE_DATE_OFFSETS: Record<StageId, number> = {
  'pre-onboarding': 7,
  orientation: 30,
  integration: 60,
  productivity: 90,
};

type TaskPlanItem = {
  selected: boolean;
  dueDate?: string; // YYYY-MM-DD
  ownerId?: string;
};

type TaskPlanByStage = Record<string, Record<string, TaskPlanItem>>; // stageId -> templateTaskId -> plan

function isValidDateString(val?: string) {
  return !!val && /^\d{4}-\d{2}-\d{2}$/.test(val);
}

function getDefaultDueDateForStage(stageId: StageId, startDate: Date) {
  const base = new Date(startDate);
  base.setDate(base.getDate() + (STAGE_DUE_DATE_OFFSETS[stageId] ?? 30));
  return format(base, 'yyyy-MM-dd');
}

export interface StartOnboardingWizardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function StartOnboardingWizardDialog({ open, onOpenChange }: StartOnboardingWizardDialogProps) {
  const { firestore, user: firebaseUser } = useFirebase();
  const { employeeProfile: currentUserProfile } = useEmployeeProfile();
  const { toast } = useToast();
  const router = useRouter();

  const [step, setStep] = React.useState<number>(1);
  const [search, setSearch] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const [selectedEmployee, setSelectedEmployee] = React.useState<Employee | null>(null);
  const [taskPlanByStage, setTaskPlanByStage] = React.useState<TaskPlanByStage>({});

  const employeesQuery = useMemoFirebase(({ firestore, companyPath }) => {
    if (!firestore) return null;
    return query(tenantCollection(firestore, companyPath, 'employees'), where('status', 'in', ['active', 'active_probation', 'active_permanent', 'appointing']));
  }, [firestore]);
  const { data: employees, isLoading: employeesLoading } = useFetchCollection<Employee>(employeesQuery as any);

  const onboardingProjectsQuery = useMemoFirebase(({ firestore, companyPath }) => {
    if (!firestore) return null;
    return query(tenantCollection(firestore, companyPath, 'projects'), where('type', '==', 'onboarding'));
  }, [firestore]);
  const { data: onboardingProjects, isLoading: projectsLoading } = useFetchCollection<any>(onboardingProjectsQuery as any);

  const onboardingConfigRef = useMemoFirebase(({ firestore, companyPath }) => {
    if (!firestore) return null;
    return tenantDoc(firestore, companyPath, 'settings', 'onboarding');
  }, [firestore]);
  const { data: onboardingConfig, isLoading: configLoading } = useFetchDoc<any>(onboardingConfigRef as any);

  const onboardingStages = React.useMemo(() => {
    const stages = (onboardingConfig?.stages || []) as OnboardingStage[];
    return stages;
  }, [onboardingConfig]);

  const employeesWithOnboarding = React.useMemo(() => {
    const set = new Set<string>();
    (onboardingProjects || []).forEach((p: any) => {
      if (p?.onboardingEmployeeId) set.add(p.onboardingEmployeeId);
    });
    return set;
  }, [onboardingProjects]);

  const employeesWithoutOnboarding = React.useMemo(() => {
    const list = employees || [];
    return list.filter((e) => !employeesWithOnboarding.has(e.id));
  }, [employees, employeesWithOnboarding]);

  const filteredEmployees = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return employeesWithoutOnboarding;
    return employeesWithoutOnboarding.filter((emp) => {
      const full = `${emp.firstName || ''} ${emp.lastName || ''}`.toLowerCase();
      return (
        full.includes(q) ||
        (emp.employeeCode || '').toLowerCase().includes(q) ||
        (emp.email || '').toLowerCase().includes(q)
      );
    });
  }, [employeesWithoutOnboarding, search]);

  const startDate = React.useMemo(() => new Date(), []);

  const getStageFromConfig = React.useCallback(
    (stageId: StageId) => onboardingStages.find((s) => s.id === stageId),
    [onboardingStages]
  );

  const toggleTaskSelected = React.useCallback(
    (stageId: StageId, templateTaskId: string, checked: boolean) => {
      setTaskPlanByStage((prev) => {
        const stage = prev[stageId] || {};
        const existing = stage[templateTaskId] || { selected: false };

        const next: TaskPlanByStage = {
          ...prev,
          [stageId]: {
            ...stage,
            [templateTaskId]: {
              ...existing,
              selected: checked,
              dueDate:
                checked && !isValidDateString(existing.dueDate)
                  ? getDefaultDueDateForStage(stageId, startDate)
                  : existing.dueDate,
              // Do not auto-assign owner to the onboarding employee.
              // If you want a default, prefer current user profile (often HR/manager).
              ownerId:
                checked && !existing.ownerId
                  ? (currentUserProfile?.id || undefined)
                  : existing.ownerId,
            },
          },
        };
        return next;
      });
    },
    [currentUserProfile?.id, startDate]
  );

  const setTaskDueDate = React.useCallback((stageId: StageId, templateTaskId: string, dueDate?: string) => {
    setTaskPlanByStage((prev) => ({
      ...prev,
      [stageId]: {
        ...(prev[stageId] || {}),
        [templateTaskId]: {
          ...((prev[stageId] || {})[templateTaskId] || { selected: true }),
          selected: true,
          dueDate,
        },
      },
    }));
  }, []);

  const setTaskOwner = React.useCallback((stageId: StageId, templateTaskId: string, ownerId?: string) => {
    setTaskPlanByStage((prev) => ({
      ...prev,
      [stageId]: {
        ...(prev[stageId] || {}),
        [templateTaskId]: {
          ...((prev[stageId] || {})[templateTaskId] || { selected: true }),
          selected: true,
          ownerId,
        },
      },
    }));
  }, []);

  const selectedCounts = React.useMemo(() => {
    const counts: Record<StageId, number> = {
      'pre-onboarding': 0,
      orientation: 0,
      integration: 0,
      productivity: 0,
    };
    (Object.keys(taskPlanByStage) as StageId[]).forEach((stageId) => {
      const stagePlan = taskPlanByStage[stageId] || {};
      counts[stageId] = Object.values(stagePlan).filter((p) => p?.selected).length;
    });
    return counts;
  }, [taskPlanByStage]);

  const canGoNext = React.useMemo(() => {
    if (step === 1) return !!selectedEmployee;
    if (step >= 2 && step <= 5) {
      const stageId = STAGE_ORDER[step - 2];
      const stagePlan = taskPlanByStage[stageId] || {};
      const selected = Object.entries(stagePlan).filter(([, p]) => p.selected);
      // allow zero tasks, but if selected, each must have dueDate + ownerId
      return selected.every(([, p]) => isValidDateString(p.dueDate) && !!p.ownerId);
    }
    return true;
  }, [step, selectedEmployee, taskPlanByStage]);

  const goNext = React.useCallback(() => {
    setStep((s) => Math.min(5, s + 1));
  }, []);

  const goBack = React.useCallback(() => {
    setStep((s) => Math.max(1, s - 1));
  }, []);

  const resetState = React.useCallback(() => {
    setStep(1);
    setSearch('');
    setIsSubmitting(false);
    setSelectedEmployee(null);
    setTaskPlanByStage({});
  }, []);

  React.useEffect(() => {
    if (!open) {
      resetState();
    }
  }, [open, resetState]);

  const handleSelectEmployee = React.useCallback(
    (emp: Employee) => {
      if (employeesWithOnboarding.has(emp.id)) {
        toast({
          title: 'Onboarding аль хэдийн үүссэн байна',
          description: 'Энэ ажилтанд onboarding төслүүд өмнө нь үүссэн байна.',
          variant: 'destructive',
        });
        return;
      }
      setSelectedEmployee(emp);
      setStep(2);
    },
    [employeesWithOnboarding, toast]
  );

  const buildOverrides = React.useCallback(() => {
    const overrides: OnboardingStageTaskPlan[] = STAGE_ORDER.map((stageId) => {
      const stagePlan = taskPlanByStage[stageId] || {};
      const tasks = Object.entries(stagePlan)
        .filter(([, p]) => p.selected)
        .map(([templateTaskId, p]) => ({
          templateTaskId,
          dueDate: p.dueDate!,
          ownerId: p.ownerId!,
        }));
      return { stageId, tasks };
    });
    return overrides;
  }, [taskPlanByStage]);

  const handleCreate = React.useCallback(async () => {
    if (!firestore || !selectedEmployee || !firebaseUser) return;
    if (employeesWithOnboarding.has(selectedEmployee.id)) {
      toast({
        title: 'Onboarding аль хэдийн үүссэн байна',
        description: 'Энэ ажилтанд onboarding төслүүд өмнө нь үүссэн байна.',
        variant: 'destructive',
      });
      return;
    }

    const stages = onboardingStages;
    if (!stages?.length) {
      toast({
        title: 'Onboarding тохиргоо хоосон байна',
        description: 'Эхлээд /dashboard/onboarding/settings дээр таскуудаа тохируулна уу.',
        variant: 'destructive',
      });
      return;
    }

    // Validate selected tasks requirements
    for (const stageId of STAGE_ORDER) {
      const stagePlan = taskPlanByStage[stageId] || {};
      for (const [taskId, p] of Object.entries(stagePlan)) {
        if (!p.selected) continue;
        if (!isValidDateString(p.dueDate) || !p.ownerId) {
          toast({
            title: 'Мэдээлэл дутуу байна',
            description: `${STAGE_TITLES[stageId]}: Сонгосон таск бүр дээр хугацаа ба хариуцагч сонгоно уу.`,
            variant: 'destructive',
          });
          return;
        }
      }
    }

    setIsSubmitting(true);
    try {
      const appointerId = currentUserProfile?.id || firebaseUser?.uid || '';
      const employeeName = `${selectedEmployee.firstName || ''} ${selectedEmployee.lastName || ''}`.trim() || 'Шинэ ажилтан';
      const startDateStr = format(new Date(), 'yyyy-MM-dd');

      const result = await createOnboardingProjects({
        firestore,
        employeeId: selectedEmployee.id,
        employeeName,
        mentorId: undefined,
        appointerId,
        onboardingConfig: stages,
        positionOnboardingIds: undefined,
        startDate: startDateStr,
        taskPlan: buildOverrides(),
        alwaysCreateAllStages: true,
      });

      toast({
        title: 'Onboarding үүслээ',
        description: `${employeeName} ажилтанд ${result.projectIds.length} төсөл, ${result.taskCount} таск үүслээ.`,
      });

      onOpenChange(false);
      if (result.projectIds?.[0]) {
        router.push(`/dashboard/projects/${result.projectIds[0]}`);
      }
    } catch (e: any) {
      console.error(e);
      toast({
        title: 'Алдаа гарлаа',
        description: e?.message || 'Onboarding үүсгэхэд алдаа гарлаа.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [
    firestore,
    selectedEmployee,
    firebaseUser,
    employeesWithOnboarding,
    toast,
    onboardingStages,
    taskPlanByStage,
    currentUserProfile?.id,
    buildOverrides,
    onOpenChange,
    router,
  ]);

  const renderEmployeeStep = () => (
    <>
      <div className="px-6 py-3 border-b bg-muted/20 shrink-0">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Ажилтны нэр, код, имэйлээр хайх..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 h-10 bg-background rounded-xl"
          />
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-2">
          {employeesLoading || projectsLoading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary/40" />
              <p className="text-xs text-muted-foreground">Жагсаалт уншиж байна...</p>
            </div>
          ) : filteredEmployees.length > 0 ? (
            filteredEmployees.map((emp) => (
              <div
                key={emp.id}
                className="flex items-center justify-between p-3 rounded-xl bg-background border hover:border-primary/30 hover:bg-primary/5 transition-all cursor-pointer group"
                onClick={() => handleSelectEmployee(emp)}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar className="h-10 w-10 border-2 border-white shadow-sm shrink-0">
                    <AvatarImage src={emp.photoURL} />
                    <AvatarFallback className="bg-primary/5 text-primary font-bold">
                      {emp.firstName?.charAt(0)}
                      {emp.lastName?.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <div className="font-semibold text-sm truncate">
                      {emp.firstName} {emp.lastName}
                    </div>
                    <div className="text-[10px] text-muted-foreground truncate">
                      #{emp.employeeCode} {emp.email ? `• ${emp.email}` : ''}
                    </div>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
            ))
          ) : (
            <div className="py-16 text-center">
              <UserCircle2 className="h-10 w-10 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm font-medium">Илэрц олдсонгүй</p>
              <p className="text-xs text-muted-foreground">Onboarding хөтөлбөргүй ажилтан олдсонгүй</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </>
  );

  const renderStageStep = (stageId: StageId) => {
    const stage = getStageFromConfig(stageId);
    const tasks = stage?.tasks || [];

    const stagePlan = taskPlanByStage[stageId] || {};

    return (
      <ScrollArea className="flex-1">
        <div className="p-6 space-y-5">
          <div className="text-center">
            <div className="inline-flex items-center justify-center h-10 w-10 rounded-xl bg-blue-100 text-blue-600 mb-2">
              <GraduationCap className="h-5 w-5" />
            </div>
            <h3 className="font-bold">{STAGE_TITLES[stageId]}</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Сонгосон таск: <span className="font-bold">{selectedCounts[stageId]}</span>
            </p>
          </div>

          {configLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !stage ? (
            <div className="p-4 rounded-xl border bg-slate-50 text-slate-700 text-sm">
              Энэ үе шатны тохиргоо олдсонгүй. `/dashboard/onboarding/settings` дээр тохируулна уу.
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
                      selected ? 'border-blue-200 bg-blue-50/40' : 'border-slate-200 bg-white'
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <Checkbox
                        checked={selected}
                        onCheckedChange={(val) => toggleTaskSelected(stageId, t.id, !!val)}
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
                                    onSelect={(date) =>
                                      setTaskDueDate(stageId, t.id, date ? format(date, 'yyyy-MM-dd') : undefined)
                                    }
                                    initialFocus
                                  />
                                </PopoverContent>
                              </Popover>
                            </div>

                            <div className="space-y-1.5">
                              <Label className="text-xs font-semibold">Хариуцагч</Label>
                              <Select
                                value={ownerId || ''}
                                onValueChange={(val) => setTaskOwner(stageId, t.id, val || undefined)}
                              >
                                <SelectTrigger className="h-10 rounded-xl bg-white">
                                  <SelectValue placeholder="Хариуцагч сонгох..." />
                                </SelectTrigger>
                                <SelectContent>
                                  {(employees || []).map((emp) => {
                                    const label = `${emp.lastName || ''} ${emp.firstName || ''}`.trim() || emp.email || emp.id;
                                    return (
                                      <SelectItem key={emp.id} value={emp.id}>
                                        {label}
                                      </SelectItem>
                                    );
                                  })}
                                </SelectContent>
                              </Select>
                              <p className="text-[10px] text-muted-foreground">
                                `ownerId` = хариуцагч, `assigneeIds` = ажилтан + хариуцагч
                              </p>
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

          {stageId === 'productivity' ? (
            <div className="mt-4 rounded-2xl border bg-white p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-bold text-sm">Дүгнэлт</div>
                  <div className="text-xs text-muted-foreground">Нийт сонгосон таскууд</div>
                </div>
                <Badge className="bg-indigo-600">
                  {selectedCounts['pre-onboarding'] +
                    selectedCounts.orientation +
                    selectedCounts.integration +
                    selectedCounts.productivity}{' '}
                  таск
                </Badge>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
                {STAGE_ORDER.map((sid) => (
                  <div key={sid} className="rounded-xl border bg-slate-50 p-2">
                    <div className="text-[10px] font-bold text-slate-500 uppercase">{STAGE_TITLES[sid]}</div>
                    <div className="text-sm font-black text-slate-800">{selectedCounts[sid]}</div>
                  </div>
                ))}
              </div>
              <div className="mt-3 text-xs text-muted-foreground">
                Үүсгэх үед үе шат бүр тусдаа onboarding төсөл болж, таскууд нь сонгосон хугацаа/хариуцагчаар үүснэ.
              </div>
            </div>
          ) : null}
        </div>
      </ScrollArea>
    );
  };

  const stepTitle = React.useMemo(() => {
    if (step === 1) return '1. Ажилтан сонгох';
    const stageId = STAGE_ORDER[step - 2];
    return `${step}. ${STAGE_TITLES[stageId]}`;
  }, [step]);

  return (
    <AppDialog open={open} onOpenChange={onOpenChange}>
      <AppDialogContent
        size="xl"
        withBorder={false}
        className="sm:max-w-[860px] h-[760px] flex flex-col p-0 gap-0 overflow-hidden rounded-3xl border-none shadow-premium"
      >
        <AppDialogHeader className="p-6 pb-4 bg-gradient-to-br from-primary/5 to-background border-b shrink-0">
          <AppDialogTitle className="text-lg font-bold">Onboarding хөтөлбөр эхлүүлэх</AppDialogTitle>
          <AppDialogDescription className="text-xs">
            {stepTitle}
            {selectedEmployee ? (
              <>
                {' '}
                • <span className="font-semibold">{selectedEmployee.lastName} {selectedEmployee.firstName}</span>
              </>
            ) : null}
          </AppDialogDescription>

          <div className="flex items-center gap-1 mt-3">
            {[1, 2, 3, 4, 5].map((s) => (
              <React.Fragment key={s}>
                <div
                  className={cn(
                    'flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-bold transition-all',
                    s === step ? 'bg-primary text-primary-foreground' : s < step ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'
                  )}
                >
                  {s < step ? <Check className="h-3 w-3" /> : <span>{s}</span>}
                  <span className="hidden sm:inline">
                    {s === 1 ? 'Ажилтан' : 'Үе'}
                  </span>
                </div>
                {s < 5 ? <div className={cn('h-0.5 w-3 rounded-full transition-all', s < step ? 'bg-primary' : 'bg-muted')} /> : null}
              </React.Fragment>
            ))}
          </div>
        </AppDialogHeader>

        <div className="flex-1 flex flex-col overflow-hidden relative">
          {step === 1 ? renderEmployeeStep() : renderStageStep(STAGE_ORDER[step - 2])}

          {isSubmitting && (
            <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center gap-4">
              <div className="h-16 w-16 rounded-full border-4 border-slate-100 border-t-primary animate-spin" />
              <div className="text-center">
                <p className="font-bold">Үүсгэж байна</p>
                <p className="text-xs text-muted-foreground">Түр хүлээнэ үү...</p>
              </div>
            </div>
          )}
        </div>

        <AppDialogFooter className="p-4 border-t bg-slate-50/50 shrink-0">
          <div className="flex w-full gap-3">
            <Button
              variant="outline"
              onClick={() => (step === 1 ? onOpenChange(false) : goBack())}
              className="rounded-xl"
              disabled={isSubmitting}
            >
              {step === 1 ? (
                'Болих'
              ) : (
                <>
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Буцах
                </>
              )}
            </Button>

            {step < 5 ? (
              <Button
                onClick={goNext}
                className="flex-[2] rounded-xl"
                disabled={isSubmitting || !canGoNext}
              >
                Үргэлжлүүлэх
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <Button
                onClick={handleCreate}
                className="flex-[2] bg-indigo-600 hover:bg-indigo-700 rounded-xl"
                disabled={isSubmitting || !canGoNext || !selectedEmployee}
              >
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ArrowRight className="h-4 w-4 mr-2" />}
                Үүсгэх
              </Button>
            )}
          </div>
        </AppDialogFooter>
      </AppDialogContent>
    </AppDialog>
  );
}

