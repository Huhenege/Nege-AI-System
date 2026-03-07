'use client';

import * as React from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { useFirebase, addDocumentNonBlocking, updateDocumentNonBlocking, useTenantWrite } from '@/firebase';
import { collection } from 'firebase/firestore';
import { Loader2, Trash2 } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AddActionButton } from '@/components/ui/add-action-button';

const weekDays = [
    { id: 'monday', label: 'Даваа' },
    { id: 'tuesday', label: 'Мягмар' },
    { id: 'wednesday', label: 'Лхагва' },
    { id: 'thursday', label: 'Пүрэв' },
    { id: 'friday', label: 'Баасан' },
    { id: 'saturday', label: 'Бямба' },
    { id: 'sunday', label: 'Ням' },
] as const;

const timeRegex = /^(?:2[0-3]|[01]?[0-9]):[0-5][0-9]$/;

const splitIntervalSchema = z.object({
  startTime: z.string().regex(timeRegex, 'Цагийн формат буруу (HH:MM)'),
  endTime: z.string().regex(timeRegex, 'Цагийн формат буруу (HH:MM)'),
}).refine(data => data.startTime < data.endTime, {
  message: 'Дуусах цаг эхлэх цагаас өмнө байж болохгүй.',
  path: ['endTime'],
});

const workScheduleSchema = z.object({
  name: z.string().min(1, 'Нэр хоосон байж болохгүй.'),
  code: z.string().optional(),
  category: z.enum(['fixed', 'shift', 'flex', 'split', 'remote']),
  workingDays: z.array(z.string()).refine(value => value.length > 0, 'Дор хаяж нэг ажлын өдөр сонгоно уу.'),
  isActive: z.boolean().default(true),
  hasBreak: z.boolean().default(false),
  breakStartTime: z.string().optional(),
  breakEndTime: z.string().optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  flexStartEarliest: z.string().optional(),
  flexStartLatest: z.string().optional(),
  flexTotalHours: z.coerce.number().optional(),
  splitIntervals: z.array(splitIntervalSchema).optional(),
  remoteTotalHoursDay: z.coerce.number().optional(),
  remoteTotalHoursWeek: z.coerce.number().optional(),
}).superRefine((data, ctx) => {
    // Fixed / Shift validation
    if (['fixed', 'shift'].includes(data.category)) {
      if (!data.startTime) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Эхлэх цаг хоосон байж болохгүй.', path: ['startTime'] });
      if (!data.endTime) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Дуусах цаг хоосон байж болохгүй.', path: ['endTime'] });
      if (data.startTime && data.endTime && data.startTime >= data.endTime) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Дуусах цаг эхлэх цагаас өмнө байж болохгүй.', path: ['endTime'] });
      }
    }
    // Flex validation
    if (data.category === 'flex') {
        if (!data.flexStartEarliest) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Эрт эхлэх цаг хоосон байж болохгүй.', path: ['flexStartEarliest']});
        if (!data.flexStartLatest) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Оройтож эхлэх цаг хоосон байж болохгүй.', path: ['flexStartLatest']});
        if (data.flexStartEarliest && data.flexStartLatest && data.flexStartEarliest >= data.flexStartLatest) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Оройтож эхлэх цаг эрт эхлэх цагаас өмнө байж болохгүй.', path: ['flexStartLatest'] });
        }
        if (!data.flexTotalHours || data.flexTotalHours <= 0) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Нийт цаг 0-ээс их байх ёстой.', path: ['flexTotalHours']});
    }
    // Split validation
    if (data.category === 'split') {
        if (!data.splitIntervals || data.splitIntervals.length === 0) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Дор хаяж нэг цагийн хэсэг оруулна уу.', path: ['splitIntervals'] });
        }
        // Check for overlapping intervals
        if (data.splitIntervals) {
            for (let i = 0; i < data.splitIntervals.length; i++) {
                for (let j = i + 1; j < data.splitIntervals.length; j++) {
                    const a = data.splitIntervals[i];
                    const b = data.splitIntervals[j];
                    if (a.startTime < b.endTime && b.startTime < a.endTime) {
                         ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Цагийн хэсгүүд давхцаж байна.', path: [`splitIntervals.${j}.startTime`] });
                    }
                }
            }
        }
    }
    // Remote validation
    if (data.category === 'remote') {
        if ((!data.remoteTotalHoursDay || data.remoteTotalHoursDay <=0) && (!data.remoteTotalHoursWeek || data.remoteTotalHoursWeek <= 0)) {
             ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Өдрийн эсвэл 7 хоногийн нийт цагийг оруулна уу.', path: ['remoteTotalHoursDay'] });
        }
    }

    if (data.hasBreak) {
        if (!data.breakStartTime) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Завсарлагын эхлэх цаг хоосон байж болохгүй.', path: ['breakStartTime']});
        if (!data.breakEndTime) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Завсарлагын дуусах цаг хоосон байж болохгүй.', path: ['breakEndTime']});
        if (data.breakStartTime && data.breakEndTime && data.breakStartTime >= data.breakEndTime) {
             ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Дуусах цаг эхлэх цагаас өмнө байж болохгүй.', path: ['breakEndTime'] });
        }
    }
});
type WorkScheduleFormValues = z.infer<typeof workScheduleSchema>;

interface AddWorkScheduleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingItem?: WorkScheduleFormValues & { id: string } | null;
}

// Function to remove undefined fields from an object
const cleanupData = (data: any) => {
    const cleanedData: any = {};
    Object.keys(data).forEach(key => {
        if (data[key] !== undefined) {
            cleanedData[key] = data[key];
        }
    });
    return cleanedData;
};

export function AddWorkScheduleDialog({ open, onOpenChange, editingItem }: AddWorkScheduleDialogProps) {
  const { firestore } = useFirebase();
  const { tDoc } = useTenantWrite();
  const { toast } = useToast();
  const isEditMode = !!editingItem;
  
  const collectionRef = React.useMemo(() => (firestore ? collection(firestore, 'workSchedules') : null), [firestore]);

  const form = useForm<WorkScheduleFormValues>({
    resolver: zodResolver(workScheduleSchema),
    defaultValues: {
        name: '',
        code: '',
        category: 'fixed',
        workingDays: [],
        isActive: true,
        hasBreak: false,
    }
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "splitIntervals",
  });

  React.useEffect(() => {
    if (open) {
      if (isEditMode && editingItem) {
        form.reset(editingItem);
      } else {
        form.reset({
            name: '',
            code: '',
            category: 'fixed',
            workingDays: [],
            isActive: true,
            hasBreak: false,
            splitIntervals: [],
        });
      }
    }
  }, [open, editingItem, isEditMode, form]);

  const { isSubmitting } = form.formState;

  const onSubmit = (data: WorkScheduleFormValues) => {
    if (!collectionRef || !firestore) return;

    const cleanedData = cleanupData(data);

    if (isEditMode && editingItem) {
        const docRef = tDoc('workSchedules', editingItem.id);
        updateDocumentNonBlocking(docRef, cleanedData);
        toast({ title: 'Амжилттай шинэчлэгдлээ' });
    } else {
        addDocumentNonBlocking(collectionRef, cleanedData);
        toast({ title: 'Амжилттай нэмэгдлээ' });
    }
    onOpenChange(false);
  };
  
  const category = form.watch('category');
  const hasBreak = form.watch('hasBreak');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <DialogHeader>
              <DialogTitle>{isEditMode ? 'Ажлын цагийн хуваарь засах' : 'Шинэ ажлын цагийн хуваарь'}</DialogTitle>
              <DialogDescription>Байгууллагын ажлын цагийн төрлөө энд тохируулна уу.</DialogDescription>
            </DialogHeader>
            <ScrollArea className="h-[60vh] p-1">
                <div className="py-4 pr-4 space-y-6">
                    {/* Basic Info */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField control={form.control} name="name" render={({ field }) => ( <FormItem><FormLabel>Нэр</FormLabel><FormControl><Input placeholder="Ердийн 09-18" {...field} /></FormControl><FormMessage /></FormItem> )} />
                        <FormField control={form.control} name="code" render={({ field }) => ( <FormItem><FormLabel>Код (Богино нэр)</FormLabel><FormControl><Input placeholder="N-0918" {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem> )} />
                    </div>

                    {/* Working Days */}
                    <FormField
                        control={form.control}
                        name="workingDays"
                        render={() => (
                            <FormItem>
                                <div className="mb-4">
                                    <FormLabel>Ажиллах өдрүүд</FormLabel>
                                </div>
                                <div className="flex flex-wrap gap-4">
                                {weekDays.map((item) => (
                                    <FormField
                                    key={item.id}
                                    control={form.control}
                                    name="workingDays"
                                    render={({ field }) => {
                                        return (
                                        <FormItem
                                            key={item.id}
                                            className="flex flex-row items-start space-x-3 space-y-0"
                                        >
                                            <FormControl>
                                            <Checkbox
                                                checked={field.value?.includes(item.id)}
                                                onCheckedChange={(checked) => {
                                                return checked
                                                    ? field.onChange([...(field.value || []), item.id])
                                                    : field.onChange(
                                                        field.value?.filter(
                                                        (value) => value !== item.id
                                                        )
                                                    )
                                                }}
                                            />
                                            </FormControl>
                                            <FormLabel className="font-normal">{item.label}</FormLabel>
                                        </FormItem>
                                        )
                                    }}
                                    />
                                ))}
                                </div>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    
                     <FormField
                        control={form.control}
                        name="category"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>Ангилал</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl><SelectTrigger><SelectValue placeholder="Ангилал сонгох..." /></SelectTrigger></FormControl>
                                <SelectContent>
                                    <SelectItem value="fixed">Тогтмол цаг (Fixed)</SelectItem>
                                    <SelectItem value="shift">Ээлжийн цаг (Shift)</SelectItem>
                                    <SelectItem value="flex">Уян хатан (Flex)</SelectItem>
                                    <SelectItem value="split">Хуваагддаг (Split)</SelectItem>
                                    <SelectItem value="remote">Зайнаас (Remote)</SelectItem>
                                </SelectContent>
                            </Select>
                            <FormMessage />
                            </FormItem>
                        )}
                    />
                    
                    {/* Category Specific Fields */}
                    { (category === 'fixed' || category === 'shift') && (
                        <div className="grid grid-cols-2 gap-4 rounded-md border p-4">
                             <FormField control={form.control} name="startTime" render={({ field }) => ( <FormItem><FormLabel>Эхлэх цаг</FormLabel><FormControl><Input type="time" {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem> )} />
                             <FormField control={form.control} name="endTime" render={({ field }) => ( <FormItem><FormLabel>Дуусах цаг</FormLabel><FormControl><Input type="time" {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem> )} />
                        </div>
                    )}
                    { category === 'flex' && (
                         <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 rounded-md border p-4">
                             <FormField control={form.control} name="flexStartEarliest" render={({ field }) => ( <FormItem><FormLabel>Эрт эхлэх цаг</FormLabel><FormControl><Input type="time" {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem> )} />
                             <FormField control={form.control} name="flexStartLatest" render={({ field }) => ( <FormItem><FormLabel>Оройтож эхлэх цаг</FormLabel><FormControl><Input type="time" {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem> )} />
                             <FormField control={form.control} name="flexTotalHours" render={({ field }) => ( <FormItem><FormLabel>Нийт цаг</FormLabel><FormControl><Input type="number" {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem> )} />
                        </div>
                    )}
                    { category === 'split' && (
                         <div className="rounded-md border p-4 space-y-4">
                             <FormLabel>Хуваагддаг цагийн хэсгүүд</FormLabel>
                             {fields.map((field, index) => (
                                 <div key={field.id} className="flex items-end gap-2">
                                     <FormField control={form.control} name={`splitIntervals.${index}.startTime`} render={({ field }) => ( <FormItem className="flex-1"><FormLabel className="text-xs">Эхлэх</FormLabel><FormControl><Input type="time" {...field} /></FormControl><FormMessage /></FormItem> )} />
                                     <FormField control={form.control} name={`splitIntervals.${index}.endTime`} render={({ field }) => ( <FormItem className="flex-1"><FormLabel className="text-xs">Дуусах</FormLabel><FormControl><Input type="time" {...field} /></FormControl><FormMessage /></FormItem> )} />
                                     <Button type="button" variant="destructive" size="icon" onClick={() => remove(index)}><Trash2 className="h-4 w-4" /></Button>
                                 </div>
                             ))}
                             <div className="flex justify-end">
                               <AddActionButton
                                 label="Цагийн хэсэг нэмэх"
                                 description="Хуваагддаг цагийн шинэ хэсэг нэмэх"
                                 onClick={() => append({ startTime: '09:00', endTime: '13:00' })}
                               />
                             </div>
                             <FormMessage>{form.formState.errors.splitIntervals?.message || form.formState.errors.splitIntervals?.root?.message}</FormMessage>
                        </div>
                    )}
                     { category === 'remote' && (
                        <div className="grid grid-cols-2 gap-4 rounded-md border p-4">
                             <FormField control={form.control} name="remoteTotalHoursDay" render={({ field }) => ( <FormItem><FormLabel>Өдөрт ажиллах нийт цаг</FormLabel><FormControl><Input type="number" {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem> )} />
                             <FormField control={form.control} name="remoteTotalHoursWeek" render={({ field }) => ( <FormItem><FormLabel>7 хоногт ажиллах нийт цаг</FormLabel><FormControl><Input type="number" {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem> )} />
                        </div>
                    )}

                    {/* Break time */}
                    <FormField
                        control={form.control}
                        name="hasBreak"
                        render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                            <div className="space-y-0.5">
                                <FormLabel>Завсарлагатай эсэх</FormLabel>
                            </div>
                            <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                            </FormItem>
                        )}
                    />
                    {hasBreak && (
                        <div className="grid grid-cols-2 gap-4 rounded-md border p-4">
                            <FormField control={form.control} name="breakStartTime" render={({ field }) => ( <FormItem><FormLabel>Завсарлагын эхлэх цаг</FormLabel><FormControl><Input type="time" {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem> )} />
                            <FormField control={form.control} name="breakEndTime" render={({ field }) => ( <FormItem><FormLabel>Завсарлагын дуусах цаг</FormLabel><FormControl><Input type="time" {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem> )} />
                        </div>
                    )}
                    
                    <FormField
                        control={form.control}
                        name="isActive"
                        render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                            <div className="space-y-0.5">
                                <FormLabel>Идэвхтэй эсэх</FormLabel>
                                <FormDescription>Идэвхгүй болгосон хуваарийг ажилтанд оноох боломжгүй.</FormDescription>
                            </div>
                            <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                            </FormItem>
                        )}
                    />
                </div>
            </ScrollArea>
            <DialogFooter className="pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Цуцлах</Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Хадгалах
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
