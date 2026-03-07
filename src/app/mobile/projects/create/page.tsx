'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';

import {
  useFirebase,
  useMemoFirebase,
  useCollection,
  addDocumentNonBlocking,
  tenantCollection,
  useTenantWrite,
} from '@/firebase';
import { query, orderBy, Timestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { useEmployeeProfile } from '@/hooks/use-employee-profile';
import { Employee, isActiveStatus } from '@/types';
import { Priority, ProjectStatus } from '@/types/project';
import { CalendarIcon, ChevronLeft, ChevronRight, Loader2, Users, Tag } from 'lucide-react';
import { useMobileContainer } from '../../hooks/use-mobile-container';

const projectSchema = z
  .object({
    name: z.string().min(1, 'Төслийн нэр оруулна уу'),
    goal: z.string().min(1, 'Зорилго оруулна уу'),
    expectedOutcome: z.string().min(1, 'Хүлээгдэж буй үр дүн оруулна уу'),
    startDate: z.date({ required_error: 'Эхлэх огноо сонгоно уу' }),
    endDate: z.date({ required_error: 'Дуусах огноо сонгоно уу' }),
    teamMemberIds: z.array(z.string()).min(1, 'Багийн гишүүн сонгоно уу'),
    groupIds: z.array(z.string()).optional(),
  })
  .refine((data) => data.endDate >= data.startDate, {
    message: 'Дуусах огноо эхлэх огноогоос өмнө байж болохгүй',
    path: ['endDate'],
  });

type ProjectFormValues = z.infer<typeof projectSchema>;

export default function MobileCreateProjectPage() {
  const container = useMobileContainer();
  const router = useRouter();
  const { firestore } = useFirebase();
  const { tCollection } = useTenantWrite();
  const { employeeProfile } = useEmployeeProfile();
  const { toast } = useToast();

  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [showTeamPicker, setShowTeamPicker] = React.useState(false);
  const [showGroupPicker, setShowGroupPicker] = React.useState(false);

  // Fetch employees
  const employeesQuery = useMemoFirebase(
    ({ companyPath }) => (firestore ? tenantCollection(firestore, companyPath, 'employees') : null),
    [firestore]
  );
  const { data: employees } = useCollection<Employee>(employeesQuery);

  const activeEmployees = React.useMemo(() => {
    return (employees || []).filter((e) => isActiveStatus(e.status) && e.id);
  }, [employees]);

  // Fetch project groups
  const groupsQuery = useMemoFirebase(
    ({ companyPath }) => (firestore ? query(tenantCollection(firestore, companyPath, 'project_groups'), orderBy('name', 'asc')) : null),
    [firestore]
  );
  const { data: groups } = useCollection<{ id: string; name: string; color?: string }>(groupsQuery as any);

  const form = useForm<ProjectFormValues>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      name: '',
      goal: '',
      expectedOutcome: '',
      teamMemberIds: employeeProfile?.id ? [employeeProfile.id] : [],
      groupIds: [],
    },
  });

  // Auto-add current user to team when profile loads
  React.useEffect(() => {
    if (!employeeProfile?.id) return;
    const current = form.getValues('teamMemberIds') || [];
    if (!current.includes(employeeProfile.id)) {
      form.setValue('teamMemberIds', [...current, employeeProfile.id], { shouldValidate: true });
    }
  }, [employeeProfile?.id, form]);

  const watchedTeamMembers = form.watch('teamMemberIds');

  const toggleTeamMember = (employeeId: string) => {
    const current = form.getValues('teamMemberIds') || [];
    if (current.includes(employeeId)) {
      // Don't allow removing self
      if (employeeId === employeeProfile?.id) return;
      form.setValue(
        'teamMemberIds',
        current.filter((id) => id !== employeeId),
        { shouldValidate: true }
      );
    } else {
      form.setValue('teamMemberIds', [...current, employeeId], { shouldValidate: true });
    }
  };

  const watchedGroupIds = form.watch('groupIds');
  const toggleGroup = (groupId: string) => {
    const current = form.getValues('groupIds') || [];
    if (current.includes(groupId)) {
      form.setValue('groupIds', current.filter((id) => id !== groupId), { shouldValidate: true });
    } else {
      form.setValue('groupIds', [...current, groupId], { shouldValidate: true });
    }
  };

  const selectedMembers = React.useMemo(() => {
    return activeEmployees.filter((e) => watchedTeamMembers?.includes(e.id!));
  }, [activeEmployees, watchedTeamMembers]);

  const onSubmit = async (values: ProjectFormValues) => {
    if (!firestore || !employeeProfile?.id) return;

    setIsSubmitting(true);
    try {
      const projectData: Record<string, unknown> = {
        name: values.name,
        goal: values.goal,
        expectedOutcome: values.expectedOutcome,
        startDate: format(values.startDate, 'yyyy-MM-dd'),
        endDate: format(values.endDate, 'yyyy-MM-dd'),
        ownerId: employeeProfile.id,
        teamMemberIds: values.teamMemberIds,
        status: 'DRAFT' as ProjectStatus,
        priority: 'MEDIUM' as Priority,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        createdBy: employeeProfile.id,
      };
      if (values.groupIds && values.groupIds.length > 0) {
        projectData.groupIds = values.groupIds;
      }

      await addDocumentNonBlocking(tCollection('projects'), projectData);

      toast({ title: 'Амжилттай', description: 'Шинэ төсөл үүсгэгдлээ' });
      router.push('/mobile/projects');
    } catch (error) {
      console.error('Error creating project:', error);
      toast({
        title: 'Алдаа',
        description: 'Төсөл үүсгэхэд алдаа гарлаа',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/50">
      <header className="sticky top-0 z-50 border-b border-slate-200/60 bg-white/75 backdrop-blur-xl shadow-[0_1px_3px_rgba(0,0,0,0.04)] supports-[backdrop-filter]:bg-white/60">
        <div className="px-5 pb-3 pt-[calc(env(safe-area-inset-top)+14px)]">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => router.back()}
                className="rounded-2xl bg-white/70 hover:bg-white text-slate-600 ring-1 ring-slate-200/70 h-10 w-10 transition-colors shrink-0"
                disabled={isSubmitting}
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <div className="min-w-0">
                <h1 className="text-[18px] font-semibold tracking-tight text-slate-900 leading-tight truncate">
                  Шинэ төсөл үүсгэх
                </h1>
                <p className="mt-1 text-[12px] font-medium text-slate-500 truncate">
                  Үндсэн мэдээллээ оруулаад хадгална уу
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="px-5 pt-5 pb-24">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-semibold text-slate-700">
                    Төслийн нэр *
                  </FormLabel>
                  <FormControl>
                    <Input placeholder="Төслийн нэр" className="h-11 rounded-xl border-slate-200" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="goal"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-semibold text-slate-700">
                    Зорилго *
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Төслийн зорилго..."
                      className="resize-none rounded-xl border-slate-200 min-h-[90px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="expectedOutcome"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-semibold text-slate-700">
                    Хүлээгдэж буй үр дүн *
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Амжилтын шалгуур..."
                      className="resize-none rounded-xl border-slate-200 min-h-[90px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="startDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-semibold text-slate-700">
                      Эхлэх *
                    </FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            type="button"
                            variant="outline"
                            className={cn(
                              'w-full h-11 rounded-xl border-slate-200 justify-start text-left font-normal',
                              !field.value && 'text-muted-foreground'
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {field.value ? format(field.value, 'yyyy.MM.dd') : 'Сонгох'}
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent container={container} className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="endDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-semibold text-slate-700">
                      Дуусах *
                    </FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            type="button"
                            variant="outline"
                            className={cn(
                              'w-full h-11 rounded-xl border-slate-200 justify-start text-left font-normal',
                              !field.value && 'text-muted-foreground'
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {field.value ? format(field.value, 'yyyy.MM.dd') : 'Сонгох'}
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent container={container} className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="teamMemberIds"
              render={() => (
                <FormItem>
                  <FormLabel className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Багийн гишүүд *
                  </FormLabel>

                  <button
                    type="button"
                    onClick={() => setShowTeamPicker((p) => !p)}
                    className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-white"
                  >
                    <div className="flex items-center gap-2">
                      <div className="flex -space-x-2">
                        {selectedMembers.slice(0, 4).map((m) => (
                          <Avatar key={m.id} className="h-8 w-8 ring-2 ring-white">
                            <AvatarImage src={m.photoURL} />
                            <AvatarFallback className="text-xs bg-indigo-100 text-indigo-600">
                              {m.firstName?.[0]}
                            </AvatarFallback>
                          </Avatar>
                        ))}
                        {selectedMembers.length > 4 && (
                          <div className="h-8 w-8 rounded-full bg-slate-100 ring-2 ring-white flex items-center justify-center">
                            <span className="text-xs font-semibold text-slate-500">
                              +{selectedMembers.length - 4}
                            </span>
                          </div>
                        )}
                      </div>
                      <span className="text-sm text-slate-600">
                        {selectedMembers.length > 0 ? `${selectedMembers.length} гишүүн` : 'Сонгоогүй'}
                      </span>
                    </div>
                    <ChevronRight
                      className={cn(
                        'h-4 w-4 text-slate-400 transition-transform',
                        showTeamPicker && 'rotate-90'
                      )}
                    />
                  </button>

                  {showTeamPicker && (
                    <div className="border rounded-xl p-3 max-h-56 overflow-y-auto space-y-1 bg-slate-50 animate-in slide-in-from-top-2">
                      {activeEmployees.map((employee) => {
                        const isSelected = watchedTeamMembers?.includes(employee.id!);
                        const isSelf = employee.id === employeeProfile?.id;
                        return (
                          <div
                            key={employee.id}
                            className={cn(
                              'flex items-center gap-3 p-2 rounded-lg transition-colors',
                              isSelected ? 'bg-indigo-50' : 'hover:bg-white'
                            )}
                          >
                            <Checkbox
                              id={`team-${employee.id}`}
                              checked={isSelected}
                              onCheckedChange={() => toggleTeamMember(employee.id!)}
                              disabled={isSelf}
                            />
                            <Avatar className="h-7 w-7">
                              <AvatarImage src={employee.photoURL} />
                              <AvatarFallback className="text-[10px]">
                                {employee.firstName?.[0]}
                              </AvatarFallback>
                            </Avatar>
                            <label
                              htmlFor={`team-${employee.id}`}
                              className={cn('flex-1 text-sm cursor-pointer', isSelf && 'text-slate-400')}
                            >
                              {employee.firstName} {employee.lastName}
                              {isSelf ? <span className="text-xs text-indigo-500 ml-1">(Та)</span> : null}
                            </label>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <FormMessage />
                </FormItem>
              )}
            />

            {(groups || []).length > 0 && (
              <FormField
                control={form.control}
                name="groupIds"
                render={() => (
                  <FormItem>
                    <FormLabel className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                      <Tag className="h-4 w-4" />
                      Бүлэг
                    </FormLabel>
                    <button
                      type="button"
                      onClick={() => setShowGroupPicker((p) => !p)}
                      className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-white"
                    >
                      <span className="text-sm text-slate-600">
                        {watchedGroupIds && watchedGroupIds.length > 0
                          ? `${watchedGroupIds.length} бүлэг сонгогдсон`
                          : 'Бүлэг сонгох'}
                      </span>
                      <ChevronRight
                        className={cn(
                          'h-4 w-4 text-slate-400 transition-transform',
                          showGroupPicker && 'rotate-90'
                        )}
                      />
                    </button>
                    {showGroupPicker && (
                      <div className="border rounded-xl p-3 max-h-44 overflow-y-auto space-y-1 bg-slate-50 animate-in slide-in-from-top-2">
                        {(groups || []).map((g) => {
                          const isSelected = watchedGroupIds?.includes(g.id);
                          return (
                            <div
                              key={g.id}
                              className={cn(
                                'flex items-center gap-3 p-2 rounded-lg transition-colors',
                                isSelected ? 'bg-indigo-50' : 'hover:bg-white'
                              )}
                            >
                              <Checkbox
                                id={`group-${g.id}`}
                                checked={isSelected}
                                onCheckedChange={() => toggleGroup(g.id)}
                              />
                              <span
                                className="h-3 w-3 rounded-full shrink-0"
                                style={{ backgroundColor: g.color || '#94a3b8' }}
                              />
                              <label htmlFor={`group-${g.id}`} className="flex-1 text-sm cursor-pointer">
                                {g.name}
                              </label>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </FormItem>
                )}
              />
            )}

            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1 h-12 rounded-xl"
                onClick={() => router.back()}
                disabled={isSubmitting}
              >
                Цуцлах
              </Button>
              <Button
                type="submit"
                className="flex-1 h-12 rounded-xl bg-primary hover:bg-primary/90"
                disabled={isSubmitting}
              >
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Үүсгэх
              </Button>
            </div>
          </form>
        </Form>
      </main>
    </div>
  );
}

