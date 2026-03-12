'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/patterns/page-layout';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useFirebase, useFetchDoc, useMemoFirebase, useCollection, tenantDoc, tenantCollection, useTenantWrite } from '@/firebase';
import { collection, addDoc, deleteDoc, serverTimestamp, query, orderBy, setDoc } from 'firebase/firestore';
import { Loader2, Save, PlusCircle, Trash2, Rocket, Eye, ChevronLeft, Heart } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { CoreValue } from '@/types/points';
import Link from 'next/link';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';
import dynamic from 'next/dynamic';

const EmojiPicker = dynamic(() => import('emoji-picker-react'), { ssr: false });


const valueSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1, 'Гарчиг хоосон байж болохгүй.'),
  description: z.string().min(1, 'Тайлбар хоосон байж болохгүй.'),
  emoji: z.string().optional(),
  color: z.string().optional(),
  isActive: z.boolean().default(true),
});

const missionVisionSchema = z.object({
  mission: z.string().optional(),
  vision: z.string().optional(),
  values: z.array(valueSchema).optional(),
});

type MissionVisionFormValues = z.infer<typeof missionVisionSchema>;

function FormSkeleton() {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border p-6 space-y-4">
        <Skeleton className="h-6 w-48" />
        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-32 w-full" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-32 w-full" />
          </div>
        </div>
      </div>
      <div className="bg-white rounded-xl border p-6 space-y-4">
        <Skeleton className="h-6 w-32" />
        <div className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      </div>
    </div>
  );
}

function EditMissionVisionForm({
  initialData,
  coreValues
}: {
  initialData: MissionVisionFormValues,
  coreValues: CoreValue[]
}) {
  const router = useRouter();
  const { firestore } = useFirebase();
  const { tDoc, tCollection } = useTenantWrite();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = React.useState(false);

  const mergedInitialData = React.useMemo(() => ({
    ...initialData,
    values: coreValues.map(v => ({
      id: v.id,
      title: v.title,
      description: v.description,
      emoji: v.emoji || '⭐',
      color: v.color || '#3b82f6',
      isActive: v.isActive ?? true
    }))
  }), [initialData, coreValues]);

  const companyProfileRef = useMemoFirebase(
    ({ firestore, companyPath }) => (firestore ? tenantDoc(firestore, companyPath, 'company', 'profile') : null),
    []
  );

  const form = useForm<MissionVisionFormValues>({
    resolver: zodResolver(missionVisionSchema),
    defaultValues: mergedInitialData,
  });

  React.useEffect(() => {
    form.reset(mergedInitialData);
  }, [mergedInitialData, form]);

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "values",
  });

  const { isSubmitting } = form.formState;

  const handleSave = async (values: MissionVisionFormValues) => {
    if (!companyProfileRef || !firestore) return;

    try {
      // 1. Update Mission/Vision in Profile
      const profileUpdate = {
        mission: values.mission || '',
        vision: values.vision || ''
      };
      await setDoc(companyProfileRef, profileUpdate, { merge: true });

      // 2. Manage Core Values Collection
      const formValues = values.values || [];
      const existingIds = coreValues.map(v => v.id);
      const formIds = formValues.map(v => v.id).filter(Boolean) as string[];

      // Deletions
      const toDelete = existingIds.filter(id => !formIds.includes(id));
      for (const id of toDelete) {
        await deleteDoc(tDoc('company', 'branding', 'values', id));
      }

      // Updates and Adds
      for (const val of formValues) {
        const valueData = {
          title: val.title,
          description: val.description,
          emoji: val.emoji || '⭐',
          color: val.color || '#3b82f6',
          isActive: val.isActive ?? true,
          updatedAt: serverTimestamp()
        };

        if (val.id) {
          // Update
          await setDoc(tDoc('company', 'branding', 'values', val.id), valueData, { merge: true });
        } else {
          // Add
          await addDoc(tCollection('company', 'branding', 'values'), {
            ...valueData,
            createdAt: serverTimestamp()
          });
        }
      }

      toast({
        title: 'Амжилттай хадгаллаа',
        description: 'Компанийн соёлын мэдээлэл шинэчлэгдлээ.',
      });
      router.push('/dashboard/company');
    } catch (error: any) {
      console.error(error);
      toast({
        variant: 'destructive',
        title: 'Алдаа гарлаа',
        description: error.message
      });
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSave)}>
        {/* Header */}
        <div className="bg-white border-b sticky top-0 z-20 -mx-6 md:-mx-8 -mt-6 md:-mt-8 mb-6">
          <div className="px-6 md:px-8 py-4">
            <PageHeader
              title="Байгууллагын соёл"
              description="Эрхэм зорилго, алсын хараа, үнэт зүйлс"
              showBackButton
              hideBreadcrumbs
              backButtonPlacement="inline"
              backBehavior="history"
              fallbackBackHref="/dashboard/company"
              actions={
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" type="button" asChild>
                    <Link href="/dashboard/company">Цуцлах</Link>
                  </Button>
                  <Button size="sm" type="submit" disabled={isSubmitting}>
                    {isSubmitting ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4 mr-2" />
                    )}
                    Хадгалах
                  </Button>
                </div>
              }
            />
          </div>
        </div>

        <div className="space-y-6">
        {/* Mission & Vision Section */}
        <div className="bg-white rounded-xl border">
          <div className="p-4 border-b flex items-center justify-between">
            <h3 className="font-medium">Эрхэм зорилго & Алсын хараа</h3>
          </div>
          <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-orange-50 flex items-center justify-center">
                  <Rocket className="h-4 w-4 text-orange-600" />
                </div>
                <div>
                  <span className="text-sm font-medium">Эрхэм зорилго</span>
                  <p className="text-xs text-muted-foreground">Байгууллагын оршин тогтнох утга учир</p>
                </div>
              </div>
              <FormField
                control={form.control}
                name="mission"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Textarea
                        className="min-h-[120px] resize-none"
                        placeholder="Бидний эрхэм зорилго бол..."
                        {...field}
                        value={field.value ?? ''}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-blue-50 flex items-center justify-center">
                  <Eye className="h-4 w-4 text-blue-600" />
                </div>
                <div>
                  <span className="text-sm font-medium">Алсын хараа</span>
                  <p className="text-xs text-muted-foreground">Бидний хүрэх ирээдүйн дүр зураг</p>
                </div>
              </div>
              <FormField
                control={form.control}
                name="vision"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Textarea
                        className="min-h-[120px] resize-none"
                        placeholder="Бид ирээдүйд..."
                        {...field}
                        value={field.value ?? ''}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>
        </div>

        {/* Core Values Section */}
        <div className="bg-white rounded-xl border shadow-sm">
          <div className="p-5 border-b flex items-center justify-between bg-gradient-to-r from-slate-50 to-white">
            <div>
              <h3 className="font-semibold text-base">Үнэт зүйлс</h3>
              <p className="text-xs text-muted-foreground mt-1">Пойнт системтэй холбоотой</p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-9 w-9 rounded-lg hover:bg-primary hover:text-primary-foreground transition-colors"
              onClick={() => append({ title: '', description: '', emoji: '⭐', color: '#3b82f6', isActive: true })}
            >
              <PlusCircle className="h-4 w-4" />
            </Button>
          </div>
          
          <div className="p-6">
            {fields.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="h-16 w-16 rounded-full bg-gradient-to-br from-orange-50 to-pink-50 flex items-center justify-center mb-4 shadow-sm">
                  <Heart className="h-8 w-8 text-orange-500" />
                </div>
                <p className="text-sm font-semibold text-slate-700 mb-1">Үнэт зүйлс хоосон байна</p>
                <p className="text-xs text-muted-foreground mb-6 max-w-sm">Байгууллагын соёлыг тодорхойлох үнэт зүйлийг нэмнэ үү</p>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-10 w-10 rounded-full hover:bg-primary hover:text-primary-foreground transition-all hover:scale-105"
                  onClick={() => append({ title: '', description: '', emoji: '⭐', color: '#3b82f6', isActive: true })}
                >
                  <PlusCircle className="h-5 w-5" />
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {fields.map((field, index) => {
                  const valueColor = form.watch(`values.${index}.color`) || '#3b82f6';
                  return (
                    <div 
                      key={field.id} 
                      className="group relative border-2 rounded-xl p-5 bg-gradient-to-br from-white to-slate-50/50 hover:shadow-lg transition-all duration-200 hover:border-opacity-60"
                      style={{ 
                        borderColor: `${valueColor}40`,
                        borderLeftWidth: '4px',
                        borderLeftColor: valueColor
                      }}
                    >
                      {/* Emoji & Color Picker */}
                      <div className="flex items-start gap-4 mb-4">
                        <div className="flex flex-col gap-2">
                          <FormField
                            control={form.control}
                            name={`values.${index}.emoji`}
                            render={({ field: emojiField }) => (
                              <FormItem>
                                <FormControl>
                                  <Popover>
                                    <PopoverTrigger asChild>
                                      <button
                                        type="button"
                                        className="h-14 w-14 flex items-center justify-center rounded-xl bg-white border-2 shadow-sm hover:shadow-md text-3xl transition-all hover:scale-105"
                                        style={{ borderColor: `${valueColor}30` }}
                                      >
                                        {emojiField.value || '⭐'}
                                      </button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-full p-0 border-none shadow-xl rounded-lg" align="start">
                                      <EmojiPicker
                                        onEmojiClick={(emojiData) => emojiField.onChange(emojiData.emoji)}
                                        autoFocusSearch={false}
                                        theme={"light" as any}
                                        width={320}
                                        height={350}
                                      />
                                    </PopoverContent>
                                  </Popover>
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name={`values.${index}.color`}
                            render={({ field: colorField }) => (
                              <FormItem>
                                <FormControl>
                                  <div className="relative h-10 w-14 rounded-lg border-2 overflow-hidden shadow-sm hover:shadow-md transition-shadow cursor-pointer group/color"
                                    style={{ borderColor: `${colorField.value}40` }}
                                  >
                                    <div
                                      className="absolute inset-0 rounded-lg"
                                      style={{ backgroundColor: colorField.value }}
                                    />
                                    <Input
                                      type="color"
                                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                      {...colorField}
                                    />
                                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/color:opacity-100 transition-opacity">
                                      <div className="h-2 w-2 rounded-full bg-white shadow-sm" />
                                    </div>
                                  </div>
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </div>

                        {/* Title & Actions */}
                        <div className="flex-1 space-y-3">
                          <div className="flex items-start gap-2">
                            <div className="flex-1">
                              <FormField
                                control={form.control}
                                name={`values.${index}.title`}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormControl>
                                      <Input
                                        className="font-semibold text-base border-0 bg-transparent px-0 focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-slate-400"
                                        placeholder="Үнэт зүйлийн нэр"
                                        {...field}
                                      />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            </div>
                            <div className="flex items-center gap-2">
                              <FormField
                                control={form.control}
                                name={`values.${index}.isActive`}
                                render={({ field }) => (
                                  <FormItem className="flex items-center gap-2">
                                    <FormControl>
                                      <div className="flex items-center gap-2 px-2 py-1 rounded-md bg-slate-100">
                                        <Switch
                                          checked={field.value}
                                          onCheckedChange={field.onChange}
                                          className="data-[state=checked]:bg-green-500"
                                        />
                                        <span className="text-xs font-medium text-slate-600 whitespace-nowrap">
                                          {field.value ? 'Идэвхтэй' : 'Идэвхгүй'}
                                        </span>
                                      </div>
                                    </FormControl>
                                  </FormItem>
                                )}
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-slate-400 hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                                onClick={() => remove(index)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                          <FormField
                            control={form.control}
                            name={`values.${index}.description`}
                            render={({ field }) => (
                              <FormItem>
                                <FormControl>
                                  <Textarea
                                    className="resize-none min-h-[100px] text-sm bg-white border-slate-200 rounded-lg focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-colors"
                                    placeholder="Үнэт зүйлийн тайлбар..."
                                    {...field}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
        </div>
      </form>
    </Form>
  );
}

const defaultFormValues: MissionVisionFormValues = {
  mission: '',
  vision: '',
  values: [],
};

export default function EditMissionPage() {
  const { firestore } = useFirebase();

  const companyProfileRef = useMemoFirebase(
    ({ firestore, companyPath }) => (firestore ? tenantDoc(firestore, companyPath, 'company', 'profile') : null),
    []
  );

  const valuesQuery = useMemoFirebase(
    ({ firestore }) => (firestore ? query(collection(firestore, 'company', 'branding', 'values'), orderBy('createdAt', 'asc')) : null),
    []
  );

  const { data: companyProfile, isLoading: isLoadingProfile } = useFetchDoc<any>(companyProfileRef);
  const { data: coreValues, isLoading: isLoadingValues } = useCollection<CoreValue>(valuesQuery);

  const isLoading = isLoadingProfile || isLoadingValues;
  const initialData = companyProfile || defaultFormValues;
  const values = coreValues || [];

  return (
    <div className="flex flex-col h-full">
      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 md:p-8 pb-32">
          {isLoading ? (
            <FormSkeleton />
          ) : (
            <EditMissionVisionForm initialData={initialData} coreValues={values} />
          )}
        </div>
      </div>
    </div>
  );
}
