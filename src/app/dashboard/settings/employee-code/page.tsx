
'use client';

import * as React from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  useFirebase,
  useMemoFirebase,
  useDoc,
  useFetchDoc,
  setDocumentNonBlocking,
  tenantDoc,
  useTenantWrite,
} from '@/firebase';
import { useUser } from '@/firebase';
import { getDoc, setDoc, runTransaction } from 'firebase/firestore';
import { generateCode } from '@/lib/code-generator';

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, Save, History, ArrowLeft, Hash, Mail, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { InvitationEmailTemplateSection } from './invitation-email-template-section';
import { VerticalTabMenu } from '@/components/ui/vertical-tab-menu';

const employeeCodeSchema = z
  .object({
    prefix: z.string().min(1, 'Угтвар үсэг хоосон байж болохгүй.'),
    digitCount: z
      .coerce
      .number()
      .min(1, 'Оронгийн тоо 1-ээс бага байж болохгүй.')
      .max(10, 'Оронгийн тоо 10-аас их байж болохгүй.'),
    nextNumber: z
      .coerce
      .number()
      .min(1, 'Эхлэх дугаар 1-ээс бага байж болохгүй.'),
  })
  .refine(
    (data) => {
      const maxNumber = Math.pow(10, data.digitCount);
      return data.nextNumber < maxNumber;
    },
    {
      message: 'Эхлэх дугаар нь тооны орноос хэтэрсэн байна.',
      path: ['nextNumber'],
    }
  );

type EmployeeCodeFormValues = z.infer<typeof employeeCodeSchema>;

type EmployeeCodeConfig = {
  prefix: string;
  digitCount: number;
  nextNumber: number;
};

function EmployeeCodeConfigForm({
  initialData,
}: {
  initialData: EmployeeCodeFormValues;
}) {
  const { toast } = useToast();
  const { user } = useUser();
  const { firestore, tDoc } = useTenantWrite();

  const codeConfigRef = useMemoFirebase(
    ({ firestore, companyPath }) => (firestore ? tenantDoc(firestore, companyPath, 'company', 'employeeCodeConfig') : null),
    []
  );

  const form = useForm<EmployeeCodeFormValues>({
    resolver: zodResolver(employeeCodeSchema),
    defaultValues: initialData,
  });

  const { isSubmitting } = form.formState;

  React.useEffect(() => {
    form.reset(initialData);
  }, [initialData, form]);

  const onSubmit = async (data: EmployeeCodeFormValues) => {
    if (!codeConfigRef || !firestore || !user) return;

    try {
      // ── 1. Config-г transaction дотор хадгалж, admin-д код олгоно ──────────
      await runTransaction(firestore, async (tx) => {
        const configSnap = await tx.get(codeConfigRef);
        const isFirstTime = !configSnap.exists();

        // Одоогийн config-д nextNumber-г шалгана
        const currentNext = configSnap.exists()
          ? (configSnap.data()?.nextNumber ?? data.nextNumber)
          : data.nextNumber;

        // Admin-ийн employee doc-г уншина
        const adminDocRef = tDoc('employees', user.uid);
        const adminSnap = await tx.get(adminDocRef);
        const adminData = adminSnap.exists() ? adminSnap.data() : null;
        const adminHasCode = !!(adminData?.employeeCode);

        // ── Config хадгалах ──
        // Анх тохируулж байгаа бол admin-д эхний код өгч nextNumber нэмэгдүүлнэ
        // Хэрэв admin-д аль хэдийн код байвал config-г шууд хадгална
        if (adminSnap.exists() && !adminHasCode) {
          // Admin-д эхний код олгоно
          const adminCode = generateCode({
            prefix: data.prefix,
            digitCount: data.digitCount,
            nextNumber: data.nextNumber,
          });

          tx.update(adminDocRef, { employeeCode: adminCode });

          // Config-д nextNumber+1-ийг хадгална (admin дугаараа авсан учир)
          const configData = {
            prefix: data.prefix,
            digitCount: data.digitCount,
            nextNumber: data.nextNumber + 1,
          };

          if (isFirstTime) {
            tx.set(codeConfigRef, configData);
          } else {
            tx.update(codeConfigRef, configData);
          }

          return { adminCode, assigned: true };
        } else {
          // Admin-д код байна эсвэл employee doc байхгүй — config-г хадгална
          const configData = {
            prefix: data.prefix,
            digitCount: data.digitCount,
            nextNumber: isFirstTime ? data.nextNumber : currentNext,
          };

          if (isFirstTime) {
            tx.set(codeConfigRef, configData);
          } else {
            tx.update(codeConfigRef, configData);
          }

          return { adminCode: null, assigned: false };
        }
      }).then((result: any) => {
        if (result?.assigned && result?.adminCode) {
          toast({
            title: 'Амжилттай хадгаллаа',
            description: `Кодчлол тохируулагдлаа. Таны ажилтны код: ${result.adminCode}`,
          });
        } else {
          toast({
            title: 'Амжилттай хадгаллаа',
            description: 'Ажилтны кодчлолын тохиргоо шинэчлэгдлээ.',
          });
        }
      });

    } catch (error) {
      console.error(error);
      toast({
        title: 'Алдаа гарлаа',
        description: 'Тохиргоо хадгалах үед алдаа гарлаа. Дахин оролдож үзнэ үү.',
        variant: 'destructive',
      });
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Угтвар үсэг */}
          <FormField
            control={form.control}
            name="prefix"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Угтвар үсэг</FormLabel>
                <FormControl>
                  {/* FormControl дотор ганцхан хүүхэд = Input */}
                  <Input placeholder="EMP" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Тооны орон */}
          <FormField
            control={form.control}
            name="digitCount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Тооны орон</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    placeholder="4"
                    min={1}
                    max={10}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Эхлэх дугаар */}
          <FormField
            control={form.control}
            name="nextNumber"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Эхлэх дугаар</FormLabel>
                <FormControl>
                  <Input type="number" placeholder="1" min={1} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="flex items-center gap-2">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? (
              <Loader2 className="mr-2 size-4 shrink-0 animate-spin" />
            ) : (
              <Save className="mr-2 size-4 shrink-0" />
            )}
            Хадгалах
          </Button>

          <Button asChild type="button" variant="outline">
            <Link href="/dashboard/settings/code-log">
              <History className="mr-2 size-4 shrink-0" />
              Түүх харах
            </Link>
          </Button>
        </div>
      </form>
    </Form>
  );
}

function ConfigCardSkeleton() {
  // Карт давхардахаас зайлсхийж зөвхөн контент хэсгийн skeleton
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-10 w-full" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-10 w-full" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-10 w-full" />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Skeleton className="h-10 w-28" />
      </div>
    </div>
  );
}

export default function EmployeeCodeSettingsPage() {
  const { user } = useUser();

  const codeConfigRef = useMemoFirebase(
    ({ firestore, companyPath }) => (firestore ? tenantDoc(firestore, companyPath, 'company', 'employeeCodeConfig') : null),
    []
  );

  // Admin-ийн employee doc — код байгаа эсэхийг шалгах
  const adminDocRef = useMemoFirebase(
    ({ firestore, companyPath }) => (firestore && user?.uid ? tenantDoc(firestore, companyPath, 'employees', user.uid) : null),
    [user?.uid]
  );
  const { data: adminEmployee } = useFetchDoc<{ employeeCode?: string }>(adminDocRef as any);
  const adminHasCode = !!(adminEmployee?.employeeCode);
  const adminCode = adminEmployee?.employeeCode;

  const { data: codeConfig, isLoading } = useDoc<EmployeeCodeConfig>(codeConfigRef as any);
  const configExists = !!codeConfig;

  const initialData: EmployeeCodeFormValues = codeConfig || {
    prefix: '',
    digitCount: 4,
    nextNumber: 1,
  };

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-2xl font-bold tracking-tight text-slate-800">Кодчлол</h2>
        <p className="text-sm text-muted-foreground max-w-2xl">
          Системийн хэмжээнд ашиглагдах дугаарлалт, кодчлолын тохиргоо болон урилга мэйлын загварыг эндээс удирдана.
        </p>
      </div>

      {/* ── Admin-д код байхгүй бол анхааруулга ── */}
      {!isLoading && adminEmployee && (
        adminHasCode ? (
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 text-sm">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>Таны ажилтны код: <strong>{adminCode}</strong></span>
          </div>
        ) : (
          <div className="flex items-start gap-3 px-4 py-3 rounded-xl border border-amber-200 bg-amber-50 text-amber-800 text-sm">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Таны ажилтны код тохируулаагүй байна</p>
              <p className="text-amber-700 text-xs mt-0.5">
                {configExists
                  ? 'Доорх тохиргоог хадгалахад таны код автоматаар олгогдоно.'
                  : 'Кодчлолын тохиргоо анх тохируулж Хадгалах дарахад таны код автоматаар олгогдоно.'}
              </p>
            </div>
          </div>
        )
      )}

      <Tabs defaultValue="code" className="w-full">
        <div className="mb-6">
          <VerticalTabMenu
            orientation="horizontal"
            items={[
              { value: 'code', label: 'Кодчлол' },
              { value: 'invitation-email', label: 'Системийн урилга мэйл' },
            ]}
          />
        </div>

        <TabsContent value="code" className="space-y-6 mt-0">
          <Card className="shadow-premium border-slate-200/60">
            <CardHeader>
              <CardTitle>Ажилтны кодчлол</CardTitle>
              <CardDescription>Байгууллагын ажилтны кодыг хэрхэн үүсгэхийг тохируулах. Жишээ: EMP0001</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <ConfigCardSkeleton />
              ) : (
                <EmployeeCodeConfigForm initialData={initialData} />
              )}
            </CardContent>
          </Card>

          <Card className="shadow-premium border-slate-200/60">
            <CardHeader>
              <CardTitle>Ажлын байрны кодчлол</CardTitle>
              <CardDescription>Ажлын байрны кодыг хэрхэн үүсгэхийг тохируулах. Жишээ: POS0001</CardDescription>
            </CardHeader>
            <CardContent>
              <PositionCodeConfigSection />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="invitation-email" className="mt-0">
          <InvitationEmailTemplateSection />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function PositionCodeConfigSection() {
  const codeConfigRef = useMemoFirebase(
    ({ firestore, companyPath }) => (firestore ? tenantDoc(firestore, companyPath, 'company', 'positionCodeConfig') : null),
    []
  );

  const { data: codeConfig, isLoading } = useDoc<EmployeeCodeConfig>(codeConfigRef as any);

  const initialData: EmployeeCodeFormValues = codeConfig || {
    prefix: '',
    digitCount: 4,
    nextNumber: 1,
  };

  if (isLoading) return <ConfigCardSkeleton />;

  return <PositionCodeConfigForm initialData={initialData} />;
}

function PositionCodeConfigForm({
  initialData,
}: {
  initialData: EmployeeCodeFormValues;
}) {
  const { toast } = useToast();

  const codeConfigRef = useMemoFirebase(
    ({ firestore, companyPath }) => (firestore ? tenantDoc(firestore, companyPath, 'company', 'positionCodeConfig') : null),
    []
  );

  const form = useForm<EmployeeCodeFormValues>({
    resolver: zodResolver(employeeCodeSchema),
    defaultValues: initialData,
  });

  const { isSubmitting } = form.formState;

  React.useEffect(() => {
    form.reset(initialData);
  }, [initialData, form]);

  const onSubmit = async (data: EmployeeCodeFormValues) => {
    if (!codeConfigRef) return;

    try {
      await setDocumentNonBlocking(codeConfigRef, data, { merge: true });

      toast({
        title: 'Амжилттай хадгаллаа',
        description: 'Ажлын байрны кодчлолын тохиргоо шинэчлэгдлээ.',
      });
    } catch (error) {
      console.error(error);
      toast({
        title: 'Алдаа гарлаа',
        description:
          'Тохиргоо хадгалах үед алдаа гарлаа. Дахин оролдож үзнэ үү.',
        variant: 'destructive',
      });
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <FormField
            control={form.control}
            name="prefix"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Угтвар үсэг</FormLabel>
                <FormControl>
                  <Input placeholder="POS" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="digitCount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Тооны орон</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    placeholder="4"
                    min={1}
                    max={10}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="nextNumber"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Эхлэх дугаар</FormLabel>
                <FormControl>
                  <Input type="number" placeholder="1" min={1} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="flex items-center gap-2">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? (
              <Loader2 className="mr-2 size-4 shrink-0 animate-spin" />
            ) : (
              <Save className="mr-2 size-4 shrink-0" />
            )}
            Хадгалах
          </Button>
        </div>
      </form>
    </Form>
  );
}
