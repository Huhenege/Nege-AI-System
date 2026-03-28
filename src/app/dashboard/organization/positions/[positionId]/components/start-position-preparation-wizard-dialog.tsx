'use client';

import { isSystemUser } from '@/lib/employee-utils';

import * as React from 'react';
import {
  AppDialog,
  AppDialogContent,
  AppDialogFooter,
  AppDialogHeader,
  AppDialogTitle,
} from '@/components/patterns';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import * as SelectPrimitive from '@radix-ui/react-select';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useCollection, useDoc, useFirebase, useMemoFirebase, tenantCollection, tenantDoc } from '@/firebase';
import { collection, doc, query, where } from 'firebase/firestore';
import { Employee } from '@/types';
import {
  createPositionPreparationProjects,
  PositionPreparationStage,
  PositionPreparationStageTaskPlan,
} from '@/lib/position-preparation-project-creator';
import { useEmployeeProfile } from '@/hooks/use-employee-profile';
import { useRouter } from 'next/navigation';
import { addDays, format } from 'date-fns';
import { mn } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Calendar as CalendarIcon,
  Check,
  Loader2,
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
  const offsets = [7, 10, 14, 21];
  const start = new Date();
  const off = offsets[idx] ?? 21;
  return format(addDays(start, off), 'yyyy-MM-dd');
}

export interface StartPositionPreparationWizardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  positionId: string;
  positionTitle: string;
}

export function StartPositionPreparationWizardDialog({
  open,
  onOpenChange,
  positionId,
  positionTitle,
}: StartPositionPreparationWizardDialogProps) {
  const { firestore, user: firebaseUser } = useFirebase();
  const { employeeProfile: currentUserProfile } = useEmployeeProfile();
  const { toast } = useToast();
  const router = useRouter();

  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [taskPlanByStage, setTaskPlanByStage] = React.useState<TaskPlanByStage>({});

  const employeesQuery = useMemoFirebase(({ firestore, companyPath }) => {
    if (!firestore) return null;
    return query(tenantCollection(firestore, companyPath, 'employees'), where('status', 'in', ['active', 'active_probation', 'active_permanent']));
  }, [firestore]);
  const { data: employees, isLoading: employeesLoading } = useCollection<Employee>(employeesQuery as any);

  const existingPrepProjectsQuery = useMemoFirebase(({ firestore, companyPath }) => {
    if (!firestore || !positionId) return null;
    return query(
      tenantCollection(firestore, companyPath, 'projects'),
      where('type', '==', 'position_preparation'),
      where('positionPreparationPositionId', '==', positionId),
    );
  }, [firestore, positionId]);
  const { data: existingPrepProjects, isLoading: projectsLoading } = useCollection<any>(existingPrepProjectsQuery as any);

  const prepConfigRef = useMemoFirebase(({ firestore, companyPath }) => {
    if (!firestore) return null;
    return tenantDoc(firestore, companyPath, 'settings', 'positionPreparation');
  }, [firestore]);
  const { data: prepConfig, isLoading: configLoading } = useDoc<any>(prepConfigRef as any);

  const prepStages = React.useMemo(() => {
    return (prepConfig?.stages || []) as PositionPreparationStage[];
  }, [prepConfig]);

  const canSubmit = React.useMemo(() => {
    const activeStages = prepStages.filter((s) => (s.tasks || []).length > 0);
    for (const stage of activeStages) {
      const stagePlan = taskPlanByStage[stage.id] || {};
      const selected = Object.entries(stagePlan).filter(([, p]) => p.selected);
      const ok = selected.every(([, p]) => isValidDateString(p.dueDate) && !!p.ownerId);
      if (!ok) return false;
    }
    return true;
  }, [prepStages, taskPlanByStage]);

  const resetState = React.useCallback(() => {
    setIsSubmitting(false);
    setTaskPlanByStage({});
  }, []);

  React.useEffect(() => {
    if (!open) resetState();
  }, [open, resetState]);

  const buildOverrides = React.useCallback((): PositionPreparationStageTaskPlan[] => {
    return prepStages
      .filter((s) => (s.tasks || []).length > 0)
      .map((stage) => {
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
  }, [prepStages, taskPlanByStage]);

  const handleCreate = React.useCallback(async () => {
    if (!firestore || !firebaseUser) return;
    if (!positionId) return;

    if ((existingPrepProjects || []).length > 0) {
      toast({
        title: 'Бэлтгэл төсөл аль хэдийн үүссэн байна',
        description: 'Энэ ажлын байранд бэлтгэл төслүүд өмнө нь үүссэн байна.',
        variant: 'destructive',
      });
      return;
    }

    if (!prepStages?.length) {
      toast({
        title: 'Бэлтгэл тохиргоо хоосон байна',
        description: 'Байгууллагын тохиргоо дээр “Ажлын байр бэлтгэх” tab дээр таскуудаа тохируулна уу.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const initiatorId = currentUserProfile?.id || firebaseUser?.uid || '';
      const startDateStr = format(new Date(), 'yyyy-MM-dd');

      const result = await createPositionPreparationProjects({
        firestore,
        positionId,
        positionTitle: positionTitle || 'Ажлын байр',
        initiatorId,
        prepConfig: prepStages,
        startDate: startDateStr,
        taskPlan: buildOverrides(),
      });

      toast({
        title: 'Бэлтгэл төсөл үүслээ',
        description: `${result.projectIds.length} төсөл, ${result.taskCount} таск үүслээ.`,
      });

      onOpenChange(false);
      if (result.projectIds?.[0]) router.push(`/dashboard/projects/${result.projectIds[0]}`);
    } catch (e: any) {
      console.error(e);
      toast({
        title: 'Алдаа гарлаа',
        description: e?.message || 'Бэлтгэл төсөл үүсгэхэд алдаа гарлаа.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [
    firestore,
    firebaseUser,
    positionId,
    positionTitle,
    currentUserProfile?.id,
    prepStages,
    buildOverrides,
    existingPrepProjects,
    toast,
    onOpenChange,
    router,
  ]);

  const setTaskSelected = React.useCallback((stageId: string, taskId: string, selected: boolean, stageIndex: number) => {
    setTaskPlanByStage((prev) => {
      const stagePlan = { ...(prev[stageId] || {}) };
      const cur = stagePlan[taskId] || { selected: false };
      const initiatorId = currentUserProfile?.id || firebaseUser?.uid || '';
      stagePlan[taskId] = {
        ...cur,
        selected,
        dueDate: selected ? (cur.dueDate || getDefaultDueDateForIndex(stageIndex)) : cur.dueDate,
        ownerId: selected ? (cur.ownerId || initiatorId) : cur.ownerId,
      };
      return { ...prev, [stageId]: stagePlan };
    });
  }, [currentUserProfile?.id, firebaseUser?.uid]);

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

  const renderStageStep = (stage: PositionPreparationStage, stageIndex: number) => {
    const stagePlan = taskPlanByStage[stage.id] || {};
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-base font-semibold text-slate-900">{stage.title}</div>
            {stage.description ? (
              <div className="text-sm text-muted-foreground">{stage.description}</div>
            ) : null}
          </div>
        </div>

        <div className="space-y-3">
          {(stage.tasks || []).length === 0 ? (
            <div className="p-4 rounded-xl bg-muted/30 text-sm text-muted-foreground">
              Энэ үе шатанд таск тохируулаагүй байна.
            </div>
          ) : (
            (stage.tasks || []).map((t) => {
              const plan = stagePlan[t.id] || { selected: false };
              return (
                <div
                  key={t.id}
                  className="p-3 rounded-xl bg-white shadow-sm"
                >
                  <div className="flex items-start gap-3">
                    <Checkbox
                      checked={!!plan.selected}
                      onCheckedChange={(checked) => setTaskSelected(stage.id, t.id, !!checked, stageIndex)}
                      className="mt-1"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-slate-900">{t.title}</div>
                      {t.description && <div className="text-xs text-muted-foreground mt-0.5">{t.description}</div>}
                    </div>
                  </div>

                  {plan.selected && (
                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-sm font-medium text-slate-700">Дуусах огноо</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className={cn(
                                "h-9 w-full justify-start text-left font-normal rounded-lg border-slate-200 bg-white",
                                !plan.dueDate && "text-muted-foreground"
                              )}
                            >
                              <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                              {plan.dueDate ? format(new Date(plan.dueDate), 'yyyy.MM.dd') : <span>Он сар өдөр</span>}
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
                        <Label className="text-sm font-medium text-slate-700">Хариуцагч</Label>
                        <Select value={plan.ownerId || ''} onValueChange={(val) => setTaskOwner(stage.id, t.id, val)}>
                          <SelectTrigger className="h-9 rounded-lg border-slate-200 bg-white">
                            <SelectValue placeholder="Хариуцагч сонгох" />
                          </SelectTrigger>
                          <SelectContent>
                            {(employees || []).filter(e => !isSystemUser(e as any)).map((e) => (
                              <SelectPrimitive.Item
                                key={e.id}
                                value={e.id}
                                textValue={`${e.firstName || ''} ${e.lastName || ''}`.trim()}
                                className="relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
                              >
                                <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                                  <SelectPrimitive.ItemIndicator>
                                    <Check className="h-4 w-4" />
                                  </SelectPrimitive.ItemIndicator>
                                </span>

                                <div className="flex items-center gap-2 min-w-0">
                                  <Avatar className="h-6 w-6 shrink-0">
                                    <AvatarImage src={(e as any).photoURL || (e as any).avatarUrl || ''} />
                                    <AvatarFallback className="text-[10px]">
                                      {(e.firstName?.[0] || '').toUpperCase()}
                                      {(e.lastName?.[0] || '').toUpperCase()}
                                    </AvatarFallback>
                                  </Avatar>
                                  <SelectPrimitive.ItemText>
                                    <span className="truncate">
                                      {e.firstName} {e.lastName}
                                    </span>
                                  </SelectPrimitive.ItemText>
                                </div>
                              </SelectPrimitive.Item>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  };

  return (
    <AppDialog open={open} onOpenChange={onOpenChange}>
      <AppDialogContent
        size="xl"
        withBorder={false}
        closeTone="primary"
        className="p-0 overflow-hidden"
      >
        <div className="flex flex-col h-[80vh] max-h-[680px]">
          <AppDialogHeader className="p-6 pb-4 bg-background shrink-0">
            <AppDialogTitle className="text-xl font-semibold text-slate-900">Ажлын байр бэлтгэх</AppDialogTitle>
          </AppDialogHeader>

          <div className="flex-1 overflow-hidden relative border-t">
            <ScrollArea className="h-full">
                <div className="p-6">
                {employeesLoading || projectsLoading || configLoading ? (
                  <div className="flex items-center justify-center py-16">
                    <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
                  </div>
                ) : !prepStages?.length ? (
                  <div className="p-6 rounded-2xl bg-amber-50 border border-amber-100 text-amber-700 text-sm">
                    Бэлтгэл тохиргоо хоосон байна. Байгууллагын тохиргоо дээр “Ажлын байр бэлтгэх” tab-аа тохируулна уу.
                  </div>
                ) : (
                  <div className="space-y-6">
                    {prepStages
                      .filter((s) => (s.tasks || []).length > 0)
                      .map((s, idx) => (
                      <div key={s.id} className="pb-6 border-b last:border-b-0 last:pb-0">
                        {renderStageStep(s, idx)}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </ScrollArea>

            {isSubmitting && (
              <div className="absolute inset-0 bg-white/80 backdrop-blur-[2px] z-50 flex flex-col items-center justify-center gap-4 animate-in fade-in duration-300">
                <Loader2 className="h-12 w-12 text-indigo-600 animate-spin" />
                <div className="text-center">
                  <p className="text-sm font-bold text-slate-900">Боловсруулж байна</p>
                  <p className="text-xs text-muted-foreground">Түр хүлээнэ үү...</p>
                </div>
              </div>
            )}
          </div>

          <AppDialogFooter className="px-4 py-4 bg-background shrink-0">
            <div className="flex w-full gap-3">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="flex-1 rounded-lg h-10"
                disabled={isSubmitting}
              >
                Цуцлах
              </Button>
              <Button
                onClick={handleCreate}
                disabled={isSubmitting || !canSubmit || !prepStages?.length}
                className="flex-[2] rounded-lg h-10"
              >
                Хадгалах
              </Button>
            </div>
          </AppDialogFooter>
        </div>
      </AppDialogContent>
    </AppDialog>
  );
}

