import { isSystemUser } from '@/lib/employee-utils';
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
import { useCollection, useDoc, useFirebase, useMemoFirebase, tenantCollection, tenantDoc } from '@/firebase';
import { query, where } from 'firebase/firestore';
import { Employee } from '@/types';
import {
  createOffboardingProjects,
  OffboardingStage,
  OffboardingStageTaskPlan,
} from '@/lib/offboarding-project-creator';
import { useEmployeeProfile } from '@/hooks/use-employee-profile';
import { useRouter } from 'next/navigation';
import { addDays, format } from 'date-fns';
import { mn } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import {
  ArrowRight,
  Calendar as CalendarIcon,
  Check,
  ChevronLeft,
  ChevronRight,
  Loader2,
  LogOut,
  Search,
  UserCircle2,
} from 'lucide-react';

type TaskPlanItem = {
  selected: boolean;
  dueDate?: string; // YYYY-MM-DD
  ownerId?: string;
};

type TaskPlanByStage = Record<string, Record<string, TaskPlanItem>>; // stageId -> templateTaskId -> plan

function isValidDateString(val?: string) {
  return !!val && /^\d{4}-\d{2}-\d{2}$/.test(val);
}

function getDefaultDueDateForIndex(idx: number) {
  // Simple default: 7, 14, 21, 30 days
  const offsets = [7, 14, 21, 30];
  const start = new Date();
  const off = offsets[idx] ?? 30;
  return format(addDays(start, off), 'yyyy-MM-dd');
}

export interface StartOffboardingWizardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function StartOffboardingWizardDialog({ open, onOpenChange }: StartOffboardingWizardDialogProps) {
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
    return query(tenantCollection(firestore, companyPath, 'employees'), where('status', 'in', ['active', 'active_probation', 'active_permanent']));
  }, [firestore]);
  const { data: employees, isLoading: employeesLoading } = useCollection<Employee>(employeesQuery as any);

  const offboardingProjectsQuery = useMemoFirebase(({ firestore, companyPath }) => {
    if (!firestore) return null;
    return query(tenantCollection(firestore, companyPath, 'projects'), where('type', '==', 'offboarding'));
  }, [firestore]);
  const { data: offboardingProjects, isLoading: projectsLoading } = useCollection<any>(offboardingProjectsQuery as any);

  const offboardingConfigRef = useMemoFirebase(({ firestore, companyPath }) => {
    if (!firestore) return null;
    return tenantDoc(firestore, companyPath, 'settings', 'offboarding');
  }, [firestore]);
  const { data: offboardingConfig, isLoading: configLoading } = useDoc<any>(offboardingConfigRef as any);

  const offboardingStages = React.useMemo(() => {
    return (offboardingConfig?.stages || []) as OffboardingStage[];
  }, [offboardingConfig]);

  const employeesWithOffboarding = React.useMemo(() => {
    const set = new Set<string>();
    (offboardingProjects || []).forEach((p: any) => {
      if (p?.offboardingEmployeeId) set.add(p.offboardingEmployeeId);
    });
    return set;
  }, [offboardingProjects]);

  const employeesWithoutOffboarding = React.useMemo(() => {
    const list = employees || [];
    return list.filter((e) => !isSystemUser(e as any) && !employeesWithOffboarding.has(e.id));
  }, [employees, employeesWithOffboarding]);

  const filteredEmployees = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return employeesWithoutOffboarding;
    return employeesWithoutOffboarding.filter((emp) => {
      const full = `${emp.firstName || ''} ${emp.lastName || ''}`.toLowerCase();
      return (
        full.includes(q) ||
        (emp.employeeCode || '').toLowerCase().includes(q) ||
        (emp.email || '').toLowerCase().includes(q)
      );
    });
  }, [employeesWithoutOffboarding, search]);

  const stageCount = offboardingStages.length || 4;

  const canGoNext = React.useMemo(() => {
    if (step === 1) return !!selectedEmployee;
    const stage = offboardingStages[step - 2];
    if (!stage) return true;
    const stagePlan = taskPlanByStage[stage.id] || {};
    const selected = Object.entries(stagePlan).filter(([, p]) => p.selected);
    return selected.every(([, p]) => isValidDateString(p.dueDate) && !!p.ownerId);
  }, [step, selectedEmployee, offboardingStages, taskPlanByStage]);

  const resetState = React.useCallback(() => {
    setStep(1);
    setSearch('');
    setIsSubmitting(false);
    setSelectedEmployee(null);
    setTaskPlanByStage({});
  }, []);

  React.useEffect(() => {
    if (!open) resetState();
  }, [open, resetState]);

  const handleSelectEmployee = React.useCallback(
    (emp: Employee) => {
      if (employeesWithOffboarding.has(emp.id)) {
        toast({
          title: 'Offboarding аль хэдийн үүссэн байна',
          description: 'Энэ ажилтанд offboarding төслүүд өмнө нь үүссэн байна.',
          variant: 'destructive',
        });
        return;
      }
      setSelectedEmployee(emp);
      setStep(2);
    },
    [employeesWithOffboarding, toast]
  );

  const buildOverrides = React.useCallback((): OffboardingStageTaskPlan[] => {
    return offboardingStages.map((stage) => {
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

  const handleCreate = React.useCallback(async () => {
    if (!firestore || !selectedEmployee || !firebaseUser) return;

    const stages = offboardingStages;
    if (!stages?.length) {
      toast({
        title: 'Offboarding тохиргоо хоосон байна',
        description: 'Эхлээд /dashboard/offboarding/settings дээр таскуудаа тохируулна уу.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const initiatorId = currentUserProfile?.id || firebaseUser?.uid || '';
      const employeeName = `${selectedEmployee.firstName || ''} ${selectedEmployee.lastName || ''}`.trim() || 'Ажилтан';
      const startDateStr = format(new Date(), 'yyyy-MM-dd');

      const result = await createOffboardingProjects({
        firestore,
        employeeId: selectedEmployee.id,
        employeeName,
        initiatorId,
        offboardingConfig: stages,
        startDate: startDateStr,
        taskPlan: buildOverrides(),
        alwaysCreateAllStages: true,
      });

      toast({
        title: 'Offboarding үүслээ',
        description: `${employeeName} ажилтанд ${result.projectIds.length} төсөл, ${result.taskCount} таск үүслээ.`,
      });

      onOpenChange(false);
      if (result.projectIds?.[0]) router.push(`/dashboard/projects/${result.projectIds[0]}`);
    } catch (e: any) {
      console.error(e);
      toast({
        title: 'Алдаа гарлаа',
        description: e?.message || 'Offboarding үүсгэхэд алдаа гарлаа.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [
    firestore,
    selectedEmployee,
    firebaseUser,
    offboardingStages,
    buildOverrides,
    currentUserProfile?.id,
    toast,
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
                className="flex items-center justify-between p-3 rounded-xl bg-background border hover:border-rose-300 hover:bg-rose-50/40 transition-all cursor-pointer group"
                onClick={() => handleSelectEmployee(emp)}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar className="h-10 w-10 border-2 border-white shadow-sm shrink-0">
                    <AvatarImage src={emp.photoURL} />
                    <AvatarFallback className="bg-rose-100 text-rose-700 font-bold">
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
                <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-rose-600 transition-colors" />
              </div>
            ))
          ) : (
            <div className="py-16 text-center">
              <UserCircle2 className="h-10 w-10 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm font-medium">Илэрц олдсонгүй</p>
              <p className="text-xs text-muted-foreground">Offboarding хөтөлбөргүй ажилтан олдсонгүй</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </>
  );

  const renderStageStep = (stage: OffboardingStage, idx: number) => {
    const stagePlan = taskPlanByStage[stage.id] || {};
    const tasks = stage?.tasks || [];

    return (
      <ScrollArea className="flex-1">
        <div className="p-6 space-y-5">
          <div className="text-center">
            <div className="inline-flex items-center justify-center h-10 w-10 rounded-xl bg-rose-100 text-rose-600 mb-2">
              <LogOut className="h-5 w-5" />
            </div>
            <h3 className="font-bold">{stage.title}</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Сонгосон таск: <span className="font-bold">{Object.values(stagePlan).filter((p) => p?.selected).length}</span>
            </p>
          </div>

          {configLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : tasks.length === 0 ? (
            <div className="p-4 rounded-xl border bg-slate-50 text-slate-700 text-sm">Энэ үе шатанд таск тохируулаагүй байна.</div>
          ) : (
            <div className="space-y-3">
              {tasks.map((t: any, tIdx: number) => {
                const plan = stagePlan[t.id] || { selected: false };
                const selected = !!plan.selected;
                const dueDate = plan.dueDate;
                const ownerId = plan.ownerId;

                return (
                  <div
                    key={t.id}
                    className={cn(
                      'rounded-2xl border p-4 transition-all',
                      selected ? 'border-rose-200 bg-rose-50/40' : 'border-slate-200 bg-white'
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <Checkbox
                        checked={selected}
                        onCheckedChange={(val) => {
                          const checked = !!val;
                          setTaskPlanByStage((prev) => {
                            const prevStage = prev[stage.id] || {};
                            const existing = prevStage[t.id] || { selected: false };
                            return {
                              ...prev,
                              [stage.id]: {
                                ...prevStage,
                                [t.id]: {
                                  ...existing,
                                  selected: checked,
                                  dueDate:
                                    checked && !isValidDateString(existing.dueDate)
                                      ? getDefaultDueDateForIndex(idx)
                                      : existing.dueDate,
                                  ownerId:
                                    checked && !existing.ownerId
                                      ? (currentUserProfile?.id || undefined)
                                      : existing.ownerId,
                                },
                              },
                            };
                          });
                        }}
                        className="mt-0.5"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-400">{tIdx + 1}.</span>
                          <div className="font-semibold text-sm text-slate-800 truncate">{t.title}</div>
                          {selected && (
                            <Badge variant="secondary" className="text-[10px]">
                              Сонгосон
                            </Badge>
                          )}
                        </div>
                        {t.description ? <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{t.description}</p> : null}

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
                                      setTaskPlanByStage((prev) => ({
                                        ...prev,
                                        [stage.id]: {
                                          ...(prev[stage.id] || {}),
                                          [t.id]: {
                                            ...((prev[stage.id] || {})[t.id] || { selected: true }),
                                            selected: true,
                                            dueDate: date ? format(date, 'yyyy-MM-dd') : undefined,
                                          },
                                        },
                                      }))
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
                                onValueChange={(val) =>
                                  setTaskPlanByStage((prev) => ({
                                    ...prev,
                                    [stage.id]: {
                                      ...(prev[stage.id] || {}),
                                      [t.id]: {
                                        ...((prev[stage.id] || {})[t.id] || { selected: true }),
                                        selected: true,
                                        ownerId: val || undefined,
                                      },
                                    },
                                  }))
                                }
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
        </div>
      </ScrollArea>
    );
  };

  const stepTitle = React.useMemo(() => {
    if (step === 1) return '1. Ажилтан сонгох';
    const stage = offboardingStages[step - 2];
    return `${step}. ${stage?.title || 'Үе шат'}`;
  }, [step, offboardingStages]);

  return (
    <AppDialog open={open} onOpenChange={onOpenChange}>
      <AppDialogContent
        size="xl"
        withBorder={false}
        className="sm:max-w-[860px] h-[760px] flex flex-col p-0 gap-0 overflow-hidden rounded-3xl border-none shadow-premium"
      >
        <AppDialogHeader className="p-6 pb-4 bg-gradient-to-br from-rose-500/10 to-background border-b shrink-0">
          <AppDialogTitle className="text-lg font-bold">Offboarding хөтөлбөр эхлүүлэх</AppDialogTitle>
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
            {Array.from({ length: 1 + stageCount }).map((_, i) => {
              const s = i + 1;
              return (
                <React.Fragment key={s}>
                  <div
                    className={cn(
                      'flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-bold transition-all',
                      s === step ? 'bg-rose-600 text-white' : s < step ? 'bg-rose-200 text-rose-700' : 'bg-muted text-muted-foreground'
                    )}
                  >
                    {s < step ? <Check className="h-3 w-3" /> : <span>{s}</span>}
                    <span className="hidden sm:inline">{s === 1 ? 'Ажилтан' : 'Үе'}</span>
                  </div>
                  {s < 1 + stageCount ? <div className={cn('h-0.5 w-3 rounded-full transition-all', s < step ? 'bg-rose-500' : 'bg-muted')} /> : null}
                </React.Fragment>
              );
            })}
          </div>
        </AppDialogHeader>

        <div className="flex-1 flex flex-col overflow-hidden relative">
          {step === 1 ? renderEmployeeStep() : renderStageStep(offboardingStages[step - 2], step - 2)}

          {isSubmitting && (
            <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center gap-4">
              <div className="h-16 w-16 rounded-full border-4 border-slate-100 border-t-rose-500 animate-spin" />
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
              onClick={() => (step === 1 ? onOpenChange(false) : setStep((s) => Math.max(1, s - 1)))}
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

            {step < 1 + stageCount ? (
              <Button
                onClick={() => setStep((s) => Math.min(1 + stageCount, s + 1))}
                className="flex-[2] rounded-xl bg-rose-600 hover:bg-rose-700"
                disabled={isSubmitting || !canGoNext}
              >
                Үргэлжлүүлэх
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <Button
                onClick={handleCreate}
                className="flex-[2] bg-rose-600 hover:bg-rose-700 rounded-xl"
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

