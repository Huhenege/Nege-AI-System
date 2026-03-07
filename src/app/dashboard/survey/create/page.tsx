'use client';

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useFirebase, useCollection, useMemoFirebase, addDocumentNonBlocking, tenantCollection, useTenantWrite } from '@/firebase';
import { PageHeader } from '@/components/patterns/page-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
    FormDescription,
} from '@/components/ui/form';
import { Loader2, ArrowRight, ArrowLeft, Eye, Save, ChevronRight } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { SurveyBuilder } from '../components/survey-builder';
import { SurveyPreview } from '../components/survey-preview';
import { SurveyTemplateList, type TemplateItem } from '../components/survey-template-list';
import {
    createSurveySchema,
    CreateSurveyFormValues,
    SURVEY_TYPES,
    SURVEY_TYPE_LABELS,
    SURVEY_TYPE_DESCRIPTIONS,
    Survey,
    SurveyQuestion,
    SurveyTemplate,
} from '../types';

type WizardStep = 'type' | 'template' | 'settings' | 'questions' | 'preview';

const STEPS: { key: WizardStep; label: string }[] = [
    { key: 'type', label: 'Төрөл' },
    { key: 'template', label: 'Загвар' },
    { key: 'settings', label: 'Тохиргоо' },
    { key: 'questions', label: 'Асуултууд' },
    { key: 'preview', label: 'Урьдчилан харах' },
];

export default function CreateSurveyPage() {
    const router = useRouter();
    const { firestore } = useFirebase();
    const { tCollection } = useTenantWrite();
    const { toast } = useToast();
    const [currentStep, setCurrentStep] = useState<WizardStep>('type');
    const [questions, setQuestions] = useState<SurveyQuestion[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [selectedType, setSelectedType] = useState<string>('');

    const templatesQuery = useMemoFirebase(
        ({ firestore, companyPath }) => firestore ? tenantCollection(firestore, companyPath, 'survey_templates') : null,
        [firestore]
    );
    const { data: templates, isLoading: templatesLoading } = useCollection<SurveyTemplate>(templatesQuery);

    const filteredTemplates = useMemo(() => {
        if (!templates || !selectedType) return templates;
        return templates.filter(t => t.category === selectedType);
    }, [templates, selectedType]);

    const form = useForm<CreateSurveyFormValues>({
        resolver: zodResolver(createSurveySchema),
        defaultValues: {
            title: '',
            description: '',
            type: 'satisfaction',
            isAnonymous: true,
            targetAudience: 'all',
            targetIds: [],
            startDate: '',
            endDate: '',
            reminderEnabled: false,
        },
    });

    const currentStepIndex = STEPS.findIndex(s => s.key === currentStep);

    const goNext = () => {
        const nextIdx = currentStepIndex + 1;
        if (nextIdx < STEPS.length) setCurrentStep(STEPS[nextIdx].key);
    };

    const goBack = () => {
        const prevIdx = currentStepIndex - 1;
        if (prevIdx >= 0) setCurrentStep(STEPS[prevIdx].key);
    };

    const handleSelectType = (type: string) => {
        setSelectedType(type);
        form.setValue('type', type as any);
        goNext();
    };

    const handleUseTemplate = (template: SurveyTemplate) => {
        form.setValue('title', template.title);
        form.setValue('description', template.description);
        const templateQuestions: SurveyQuestion[] = template.questions.map((q, idx) => ({
            ...q,
            id: `q_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 6)}`,
        }));
        setQuestions(templateQuestions);
        goNext();
    };

    const handleSkipTemplate = () => {
        goNext();
    };

    const handleSave = async () => {
        if (!firestore) return;
        const data = form.getValues();

        if (!data.title?.trim()) {
            toast({ title: 'Гарчиг оруулна уу', variant: 'destructive' });
            setCurrentStep('settings');
            return;
        }

        setIsLoading(true);
        try {
            const now = new Date().toISOString();
            const newSurvey: Omit<Survey, 'id'> = {
                title: data.title,
                description: data.description || '',
                type: data.type,
                status: 'draft',
                isAnonymous: data.isAnonymous,
                targetAudience: data.targetAudience,
                targetIds: data.targetIds,
                startDate: data.startDate || '',
                endDate: data.endDate || '',
                reminderEnabled: data.reminderEnabled,
                questionsCount: questions.length,
                responsesCount: 0,
                createdBy: '',
                createdAt: now,
                updatedAt: now,
            };

            const docRef = await addDocumentNonBlocking(
                tCollection('surveys'),
                newSurvey
            );

            if (docRef?.id && questions.length > 0) {
                for (const q of questions) {
                    const { id: _qId, ...rest } = q;
                    const questionData: Record<string, any> = {};
                    for (const [key, value] of Object.entries(rest)) {
                        if (value !== undefined) questionData[key] = value;
                    }
                    await addDocumentNonBlocking(
                        tCollection('surveys', docRef.id, 'questions'),
                        questionData
                    );
                }
            }

            toast({ title: 'Санал асуулга амжилттай үүсгэгдлээ' });
            if (docRef?.id) {
                router.push(`/dashboard/survey/${docRef.id}`);
            } else {
                router.push('/dashboard/survey');
            }
        } catch (error) {
            console.error('Failed to create survey:', error);
            toast({
                title: 'Алдаа гарлаа',
                description: 'Санал асуулга үүсгэхэд алдаа гарлаа.',
                variant: 'destructive',
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-full w-full py-6 px-page overflow-hidden">
            <div className="flex-1 overflow-y-auto pb-32">
                <div className="pb-6">
                    <PageHeader
                        title="Шинэ санал асуулга"
                        description="Асуулга үүсгэх шидтэн"
                        showBackButton={true}
                        hideBreadcrumbs={true}
                        backButtonPlacement="inline"
                        backBehavior="history"
                        fallbackBackHref="/dashboard/survey"
                        backHref="/dashboard/survey"
                    />
                </div>

                {/* Step indicator */}
                <div className="flex items-center gap-1 mb-8 overflow-x-auto">
                    {STEPS.map((step, idx) => (
                        <React.Fragment key={step.key}>
                            {idx > 0 && <ChevronRight className="h-4 w-4 text-muted-foreground/40 flex-shrink-0" />}
                            <button
                                onClick={() => {
                                    if (idx <= currentStepIndex) setCurrentStep(step.key);
                                }}
                                className={cn(
                                    "flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors whitespace-nowrap",
                                    idx === currentStepIndex
                                        ? "bg-primary text-primary-foreground"
                                        : idx < currentStepIndex
                                        ? "bg-primary/10 text-primary cursor-pointer hover:bg-primary/20"
                                        : "bg-muted text-muted-foreground"
                                )}
                            >
                                <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs border border-current">
                                    {idx + 1}
                                </span>
                                {step.label}
                            </button>
                        </React.Fragment>
                    ))}
                </div>

                {/* Step: Type */}
                {currentStep === 'type' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {SURVEY_TYPES.map(type => (
                            <Card
                                key={type}
                                className={cn(
                                    "cursor-pointer transition-all hover:shadow-md hover:border-primary/50",
                                    selectedType === type && "border-primary ring-1 ring-primary"
                                )}
                                onClick={() => handleSelectType(type)}
                            >
                                <CardContent className="p-5 space-y-2">
                                    <h3 className="font-medium">{SURVEY_TYPE_LABELS[type]}</h3>
                                    <p className="text-sm text-muted-foreground">
                                        {SURVEY_TYPE_DESCRIPTIONS[type]}
                                    </p>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}

                {/* Step: Template */}
                {currentStep === 'template' && (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <p className="text-sm text-muted-foreground">
                                Загвар ашиглах эсвэл хоосон эхлэх
                            </p>
                            <Button variant="outline" size="sm" onClick={handleSkipTemplate}>
                                Хоосон эхлэх
                                <ArrowRight className="h-4 w-4 ml-1.5" />
                            </Button>
                        </div>
                        <SurveyTemplateList
                            templates={(filteredTemplates ?? []) as TemplateItem[]}
                            isLoading={templatesLoading}
                            onUseTemplate={async (t) => handleUseTemplate(t as SurveyTemplate)}
                        />
                    </div>
                )}

                {/* Step: Settings */}
                {currentStep === 'settings' && (
                    <Card className="max-w-2xl">
                        <CardHeader>
                            <CardTitle className="text-base">Ерөнхий тохиргоо</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Form {...form}>
                                <div className="space-y-5">
                                    <FormField
                                        control={form.control}
                                        name="title"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Гарчиг</FormLabel>
                                                <FormControl>
                                                    <Input placeholder="Санал асуулгын нэр" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        control={form.control}
                                        name="description"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Тайлбар</FormLabel>
                                                <FormControl>
                                                    <Textarea placeholder="Зорилго, тайлбар..." rows={3} {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    <div className="grid grid-cols-2 gap-4">
                                        <FormField
                                            control={form.control}
                                            name="isAnonymous"
                                            render={({ field }) => (
                                                <FormItem className="flex flex-col">
                                                    <div className="flex items-center gap-2">
                                                        <FormControl>
                                                            <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                                                        </FormControl>
                                                        <FormLabel className="!mt-0 cursor-pointer">Нэргүй (Anonymous)</FormLabel>
                                                    </div>
                                                    <FormDescription className="text-xs">
                                                        Хариулагчийн мэдээлэл нуугдана
                                                    </FormDescription>
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={form.control}
                                            name="reminderEnabled"
                                            render={({ field }) => (
                                                <FormItem className="flex flex-col">
                                                    <div className="flex items-center gap-2">
                                                        <FormControl>
                                                            <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                                                        </FormControl>
                                                        <FormLabel className="!mt-0 cursor-pointer">Сануулга илгээх</FormLabel>
                                                    </div>
                                                    <FormDescription className="text-xs">
                                                        Хариулаагүй ажилтнуудад сануулга
                                                    </FormDescription>
                                                </FormItem>
                                            )}
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <FormField
                                            control={form.control}
                                            name="startDate"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Эхлэх огноо</FormLabel>
                                                    <FormControl>
                                                        <Input type="date" {...field} />
                                                    </FormControl>
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={form.control}
                                            name="endDate"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Дуусах огноо</FormLabel>
                                                    <FormControl>
                                                        <Input type="date" {...field} />
                                                    </FormControl>
                                                </FormItem>
                                            )}
                                        />
                                    </div>
                                </div>
                            </Form>
                        </CardContent>
                    </Card>
                )}

                {/* Step: Questions */}
                {currentStep === 'questions' && (
                    <div className="max-w-3xl">
                        <SurveyBuilder questions={questions} onChange={setQuestions} />
                    </div>
                )}

                {/* Step: Preview */}
                {currentStep === 'preview' && (
                    <SurveyPreview
                        title={form.getValues('title')}
                        description={form.getValues('description')}
                        questions={questions}
                    />
                )}

                {/* Navigation */}
                <div className="flex items-center justify-between pt-8 max-w-3xl">
                    <Button
                        variant="outline"
                        onClick={goBack}
                        disabled={currentStepIndex === 0}
                    >
                        <ArrowLeft className="h-4 w-4 mr-1.5" />
                        Буцах
                    </Button>

                    <div className="flex items-center gap-3">
                        {currentStep === 'preview' ? (
                            <Button onClick={handleSave} disabled={isLoading}>
                                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                <Save className="h-4 w-4 mr-1.5" />
                                Хадгалах
                            </Button>
                        ) : currentStep !== 'type' && currentStep !== 'template' ? (
                            <Button onClick={goNext}>
                                Үргэлжлүүлэх
                                <ArrowRight className="h-4 w-4 ml-1.5" />
                            </Button>
                        ) : null}
                    </div>
                </div>
            </div>
        </div>
    );
}
