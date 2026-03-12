'use client';

import * as React from 'react';
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
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Save, Mail, RotateCcw, Eye, ExternalLink } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useMemoFirebase, useFetchDoc, setDocumentNonBlocking, tenantDoc } from '@/firebase';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { VerticalTabMenu } from '@/components/ui/vertical-tab-menu';
import {
  buildInvitationEmailHtmlFromFields,
  INVITATION_EMAIL_DEFAULT_FIELDS,
  INVITATION_EMAIL_DEFAULT_SUBJECT,
  INVITATION_EMAIL_PLACEHOLDERS,
  INVITATION_EMAIL_PREVIEW_VARS,
  INVITATION_EMAIL_TEMPLATE_DOC_ID,
  InvitationEmailTemplateFields,
  replacePlaceholders,
} from '@/lib/invitation-email-template';

const schema = z.object({
  subject: z.string().min(1, 'Гарчиг хоосон байж болохгүй.'),
  fields: z.object({
    headerTitle: z.string().min(1, 'Header title хоосон байж болохгүй.'),
    headerSubtitle: z.string().min(1, 'Header subtitle хоосон байж болохгүй.'),
    introText: z.string().min(1, 'Танилцуулга текст хоосон байж болохгүй.'),
    securityTitle: z.string().min(1, 'Анхааруулгын гарчиг хоосон байж болохгүй.'),
    securityText: z.string().min(1, 'Анхааруулгын текст хоосон байж болохгүй.'),
    helpText: z.string().min(1, 'Тусламжийн текст хоосон байж болохгүй.'),
    footerAutoText: z.string().min(1, 'Footer текст хоосон байж болохгүй.'),
    footerAdminLabel: z.string().min(1, 'Footer admin label хоосон байж болохгүй.'),
  }),
  /** Нарийвчилсан: хүсвэл шууд HTML засна */
  htmlBody: z.string().min(1, 'HTML бие хоосон байж болохгүй.'),
});

type FormValues = z.infer<typeof schema>;

export type InvitationEmailTemplate = {
  subject: string;
  htmlBody: string;
  fields?: InvitationEmailTemplateFields;
  templateVersion?: number;
};

export function InvitationEmailTemplateSection() {
  const { toast } = useToast();
  const [resetConfirmOpen, setResetConfirmOpen] = React.useState(false);
  const [mode, setMode] = React.useState<'fields' | 'html'>('fields');
  const templateRef = useMemoFirebase(
    ({ firestore, companyPath }) =>
      firestore ? tenantDoc(firestore, companyPath, 'company', INVITATION_EMAIL_TEMPLATE_DOC_ID) : null,
    []
  );

  const { data: template, isLoading } = useFetchDoc<InvitationEmailTemplate>(templateRef as any);

  const defaultValues: FormValues = React.useMemo(
    () => ({
      subject: template?.subject ?? INVITATION_EMAIL_DEFAULT_SUBJECT,
      fields: (template?.fields ?? INVITATION_EMAIL_DEFAULT_FIELDS) as InvitationEmailTemplateFields,
      htmlBody:
        template?.htmlBody ??
        buildInvitationEmailHtmlFromFields(
          (template?.fields ?? INVITATION_EMAIL_DEFAULT_FIELDS) as InvitationEmailTemplateFields
        ),
    }),
    [template?.subject, template?.htmlBody, template?.fields]
  );

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues,
  });

  React.useEffect(() => {
    form.reset(defaultValues);
  }, [defaultValues.subject, defaultValues.htmlBody, defaultValues.fields, form]);

  const { isSubmitting, isDirty } = form.formState;
  const watchSubject = form.watch('subject');
  const watchFields = form.watch('fields');
  const watchHtmlBody = form.watch('htmlBody');

  const onSubmit = async (data: FormValues) => {
    if (!templateRef) return;
    try {
      if (mode === 'fields') {
        const htmlBody = buildInvitationEmailHtmlFromFields(data.fields);
        const payload: InvitationEmailTemplate = {
          subject: data.subject,
          fields: data.fields,
          htmlBody,
          templateVersion: 2,
        };
        await setDocumentNonBlocking(templateRef, payload, { merge: true });
        form.reset({ ...data, htmlBody });
      } else {
        // HTML mode: зөвхөн subject + htmlBody хадгална (хуучин загвартай нийцтэй)
        const payload: InvitationEmailTemplate = {
          subject: data.subject,
          htmlBody: data.htmlBody,
          templateVersion: template?.templateVersion ?? 1,
        };
        await setDocumentNonBlocking(templateRef, payload, { merge: true });
        form.reset(data);
      }
      toast({
        title: 'Амжилттай хадгаллаа',
        description: 'Урилга мэйлын загвар шинэчлэгдлээ.',
      });
    } catch (error) {
      console.error(error);
      toast({
        title: 'Алдаа гарлаа',
        description: 'Загвар хадгалах үед алдаа гарлаа. Дахин оролдож үзнэ үү.',
        variant: 'destructive',
      });
    }
  };

  // Хадгалаагүй өөрчлөлттэй таб/цонх хаах үед анхааруулах
  React.useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  // Ctrl/Cmd+S хадгалах
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        form.handleSubmit(onSubmit)();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [form, onSubmit]);

  const previewSubject = React.useMemo(
    () =>
      replacePlaceholders(
        watchSubject || INVITATION_EMAIL_DEFAULT_SUBJECT,
        INVITATION_EMAIL_PREVIEW_VARS
      ),
    [watchSubject]
  );
  const previewHtml = React.useMemo(
    () => {
      const htmlTemplate =
        mode === 'fields'
          ? buildInvitationEmailHtmlFromFields(watchFields || INVITATION_EMAIL_DEFAULT_FIELDS)
          : (watchHtmlBody ||
              buildInvitationEmailHtmlFromFields(INVITATION_EMAIL_DEFAULT_FIELDS));
      return replacePlaceholders(htmlTemplate, INVITATION_EMAIL_PREVIEW_VARS);
    },
    [mode, watchFields, watchHtmlBody]
  );

  const handleReset = () => {
    setResetConfirmOpen(false);
    form.reset({
      subject: INVITATION_EMAIL_DEFAULT_SUBJECT,
      fields: INVITATION_EMAIL_DEFAULT_FIELDS,
      htmlBody: buildInvitationEmailHtmlFromFields(INVITATION_EMAIL_DEFAULT_FIELDS),
    });
    toast({
      title: 'Үндсэн загвар руу буцаалаа',
      description: 'Өөрчлөлт хадгалахын тулд "Хадгалах" дарна уу.',
    });
  };

  if (isLoading) {
    return (
      <Card className="shadow-premium border-slate-200/60">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Урилга мэйлын загвар
          </CardTitle>
          <CardDescription>
            Шинэ ажилтан нэмэх үед илгээгдэх нэвтрэх мэйлын загварыг тохируулна.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-10 w-48 bg-muted animate-pulse rounded" />
          <div className="h-64 mt-4 bg-muted animate-pulse rounded" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
    {/* Бодит харагдах байдал — жишээ өгөгдлөөр урьдчилан харах */}
    <Card className={cn('shadow-premium border-slate-200/60')}>
      <CardHeader>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <CardTitle className="flex items-center gap-2 text-base">
            <Eye className="h-4 w-4" />
            Бодит харагдах байдал
          </CardTitle>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              const blob = new Blob([previewHtml], { type: 'text/html;charset=utf-8' });
              const url = URL.createObjectURL(blob);
              window.open(url, '_blank', 'noopener,noreferrer');
              setTimeout(() => URL.revokeObjectURL(url), 5000);
            }}
            className="shrink-0"
          >
            <ExternalLink className="h-4 w-4 mr-1.5" />
            Шинэ цонхонд нээх
          </Button>
        </div>
        <CardDescription>
          Одоогийн загвар жишээ өгөгдлөөр хэрхэн харагдахыг доор харуулна. “Текст талбарууд” эсвэл “HTML” засахад энд
          шинэчлэгдэнэ.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1">Мэйлын гарчиг (жишээ)</p>
          <p className="text-sm font-medium text-foreground break-all rounded-md bg-muted/50 px-3 py-2">
            {previewSubject}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">Мэйлын бие (жишээ)</p>
          <div className="rounded-lg border bg-white overflow-hidden" style={{ minHeight: 360 }}>
            <iframe
              title="Урилга мэйл урьдчилан харах"
              srcDoc={previewHtml}
              className="w-full border-0"
              style={{ height: 480, display: 'block' }}
              sandbox="allow-same-origin"
            />
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Жишээ утгууд: {Object.entries(INVITATION_EMAIL_PREVIEW_VARS).map(([k, v]) => `${k}=${v}`).join(', ')}
          </p>
        </div>
      </CardContent>
    </Card>

    <Card className="shadow-premium border-slate-200/60">
      <CardHeader>
        <div className="flex items-center gap-2 flex-wrap">
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Урилга мэйлын загвар
          </CardTitle>
          {isDirty && (
            <span className="text-xs font-medium text-amber-600 bg-amber-50 border border-amber-200 rounded-md px-2 py-1">
              Хадгалаагүй өөрчлөлт
            </span>
          )}
        </div>
        <CardDescription>
          Шинэ ажилтан нэмэх үед илгээгдэх нэвтрэх мэйлын загварыг тохируулна. Дараах орлуулагчууд автоматаар
          солигдоно: {INVITATION_EMAIL_PLACEHOLDERS.map((p) => p.key).join(', ')}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <Tabs value={mode} onValueChange={(v) => setMode(v as any)}>
              <VerticalTabMenu
                orientation="horizontal"
                items={[
                  { value: 'fields', label: 'Текст талбарууд' },
                  { value: 'html', label: 'HTML (нарийвчилсан)' },
                ]}
              />
              <TabsContent value="fields" className="pt-4 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="fields.headerTitle"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Header title</FormLabel>
                        <FormControl>
                          <Input placeholder="{{companyName}}" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="fields.headerSubtitle"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Header subtitle</FormLabel>
                        <FormControl>
                          <Input placeholder="Нэвтрэх мэдээлэл" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="fields.introText"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Танилцуулга текст</FormLabel>
                      <FormControl>
                        <Textarea className="min-h-[110px]" {...field} />
                      </FormControl>
                      <p className="text-xs text-muted-foreground">
                        Орлуулагч: {INVITATION_EMAIL_PLACEHOLDERS.map((p) => p.key).join(', ')}
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="fields.securityTitle"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Анхааруулгын гарчиг</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="fields.securityText"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Анхааруулгын текст</FormLabel>
                        <FormControl>
                          <Textarea className="min-h-[90px]" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="fields.helpText"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Тусламжийн текст</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="fields.footerAutoText"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Footer автоматаар</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="fields.footerAdminLabel"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Footer “Бүртгэсэн:”</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </TabsContent>

              <TabsContent value="html" className="pt-4 space-y-6">
                <FormField
                  control={form.control}
                  name="htmlBody"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>HTML бие</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="HTML форматаар мэйлын бие..."
                          className="min-h-[320px] font-mono text-sm"
                          {...field}
                        />
                      </FormControl>
                      <p className="text-xs text-muted-foreground">
                        Орлуулагч: {INVITATION_EMAIL_PLACEHOLDERS.map((p) => p.key).join(', ')}
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </TabsContent>
            </Tabs>

            <FormField
              control={form.control}
              name="subject"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Мэйлын гарчиг</FormLabel>
                  <FormControl>
                    <Input placeholder={INVITATION_EMAIL_DEFAULT_SUBJECT} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex items-center gap-2">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <Loader2 className="mr-2 size-4 shrink-0 animate-spin" />
                ) : (
                  <Save className="mr-2 size-4 shrink-0" />
                )}
                Хадгалах
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setResetConfirmOpen(true)}
                disabled={isSubmitting}
              >
                <RotateCcw className="mr-2 size-4 shrink-0" />
                Үндсэн загвар
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>

    <AlertDialog open={resetConfirmOpen} onOpenChange={setResetConfirmOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Үндсэн загвар руу буцаах уу?</AlertDialogTitle>
          <AlertDialogDescription>
            Одоогийн өөрчлөлт цуцлагдаж, системийн үндсэн загвар сэргээгдэнэ. Хадгалах товч дарснаар л шинэчлэлт хадгалагдана.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Болих</AlertDialogCancel>
          <AlertDialogAction onClick={handleReset}>Тийм, буцаах</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </>
  );
}
