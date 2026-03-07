'use client';

import React, { useState, useMemo, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import { collection, deleteDoc, getDocs } from 'firebase/firestore';
import { useFirebase, useDoc, useCollection, useMemoFirebase, addDocumentNonBlocking, updateDocumentNonBlocking, tenantCollection, tenantDoc, useTenantWrite } from '@/firebase';
import { PageHeader } from '@/components/patterns/page-layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { VerticalTabMenu } from '@/components/ui/vertical-tab-menu';
import { Skeleton } from '@/components/ui/skeleton';
import {
    Play,
    Pause,
    Archive,
    Trash2,
    BarChart3,
    Save,
    Loader2,
    Settings2,
    ShieldCheck,
    Eye,
    EyeOff,
    BookmarkPlus,
} from 'lucide-react';
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
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { SurveyBuilder } from '../components/survey-builder';
import { SurveyPreview } from '../components/survey-preview';
import { EmployeeTargetCard } from '../components/employee-target-card';
import {
    Survey,
    SurveyQuestion,
    SURVEY_STATUS_LABELS,
    SURVEY_STATUS_COLORS,
    SURVEY_TYPE_LABELS,
} from '../types';

export default function SurveyDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const router = useRouter();
    const { firestore } = useFirebase();
    const { tDoc, tCollection } = useTenantWrite();
    const { toast } = useToast();
    const [isSaving, setIsSaving] = useState(false);
    const [editTitle, setEditTitle] = useState<string | null>(null);
    const [editDescription, setEditDescription] = useState<string | null>(null);
    const [localQuestions, setLocalQuestions] = useState<SurveyQuestion[] | null>(null);
    const [localTargetIds, setLocalTargetIds] = useState<string[] | null>(null);
    const [localIsAnonymous, setLocalIsAnonymous] = useState<boolean | null>(null);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    const surveyRef = useMemoFirebase(
        ({ firestore, companyPath }) => firestore ? tenantDoc(firestore, companyPath, 'surveys', id) : null,
        [firestore, id]
    );
    const { data: survey, isLoading: surveyLoading } = useDoc<Survey>(surveyRef);

    const questionsQuery = useMemoFirebase(
        ({ firestore, companyPath }) => firestore ? collection(firestore, companyPath ? `${companyPath}/surveys` : 'surveys', id, 'questions') : null,
        [firestore, id]
    );
    const { data: firestoreQuestions, isLoading: questionsLoading } = useCollection<SurveyQuestion>(questionsQuery);

    const questions = useMemo(() => {
        if (localQuestions !== null) return localQuestions;
        if (!firestoreQuestions) return [];
        return [...firestoreQuestions].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    }, [localQuestions, firestoreQuestions]);

    const title = editTitle ?? survey?.title ?? '';
    const description = editDescription ?? survey?.description ?? '';
    const targetIds = localTargetIds ?? survey?.targetIds ?? [];
    const isAnonymous = localIsAnonymous ?? survey?.isAnonymous ?? true;
    const isDraft = survey?.status === 'draft';
    const isActive = survey?.status === 'active';

    const hasSettingsChanges = editTitle !== null || editDescription !== null || localTargetIds !== null || localIsAnonymous !== null;

    const handleSaveQuestions = useCallback(async () => {
        if (!firestore || !survey) return;
        setIsSaving(true);
        try {
            const questionsRef = tCollection('surveys', id, 'questions');
            const existingSnap = await getDocs(questionsRef);
            const deletePromises = existingSnap.docs.map(d => deleteDoc(d.ref));
            await Promise.all(deletePromises);

            for (const q of questions) {
                const { id: _qId, ...rest } = q;
                const questionData: Record<string, any> = {};
                for (const [key, value] of Object.entries(rest)) {
                    if (value !== undefined) questionData[key] = value;
                }
                await addDocumentNonBlocking(questionsRef, questionData);
            }

            const surveyUpdates: Record<string, any> = {
                questionsCount: questions.length,
                updatedAt: new Date().toISOString(),
            };
            if (editTitle !== null) surveyUpdates.title = editTitle;
            if (editDescription !== null) surveyUpdates.description = editDescription;
            if (localTargetIds !== null) {
                surveyUpdates.targetIds = localTargetIds;
                surveyUpdates.targetAudience = localTargetIds.length > 0 ? 'custom' : 'all';
            }
            if (localIsAnonymous !== null) surveyUpdates.isAnonymous = localIsAnonymous;

            updateDocumentNonBlocking(tDoc('surveys', id), surveyUpdates);

            setLocalQuestions(null);
            setEditTitle(null);
            setEditDescription(null);
            setLocalTargetIds(null);
            setLocalIsAnonymous(null);
            toast({ title: 'Амжилттай хадгалагдлаа' });
        } catch (error) {
            console.error('Failed to save:', error);
            toast({ title: 'Хадгалахад алдаа гарлаа', variant: 'destructive' });
        } finally {
            setIsSaving(false);
        }
    }, [firestore, id, survey, questions, editTitle, editDescription, localTargetIds, localIsAnonymous, toast]);

    const handleStatusChange = async (newStatus: 'active' | 'closed' | 'archived') => {
        if (!firestore) return;
        try {
            await updateDocumentNonBlocking(tDoc('surveys', id), {
                status: newStatus,
                updatedAt: new Date().toISOString(),
            });
            const labels = { active: 'идэвхжүүлсэн', closed: 'хаасан', archived: 'архивласан' };
            toast({ title: `Санал асуулгыг ${labels[newStatus]}` });
        } catch (error) {
            toast({ title: 'Алдаа гарлаа', variant: 'destructive' });
        }
    };

    const handleDelete = async () => {
        if (!firestore) return;
        setIsDeleting(true);
        setDeleteDialogOpen(false);
        let success = false;
        try {
            const responsesRef = tCollection('surveys', id, 'responses');
            const responsesSnap = await getDocs(responsesRef);
            for (const d of responsesSnap.docs) {
                await deleteDoc(d.ref);
            }

            const questionsDelRef = tCollection('surveys', id, 'questions');
            const questionsSnap = await getDocs(questionsDelRef);
            for (const d of questionsSnap.docs) {
                await deleteDoc(d.ref);
            }

            await deleteDoc(tDoc('surveys', id));
            success = true;
        } catch (error) {
            toast({ title: 'Устгахад алдаа гарлаа', variant: 'destructive' });
        } finally {
            setIsDeleting(false);
        }
        if (success) {
            toast({ title: 'Санал асуулга устгагдлаа' });
            router.push('/dashboard/survey');
        }
    };

    const handleSaveAsTemplate = async () => {
        if (!firestore || !survey || questions.length === 0) return;
        try {
            const templateQuestions = questions.map(q => {
                const { id: _qId, ...rest } = q;
                const clean: Record<string, any> = {};
                for (const [key, value] of Object.entries(rest)) {
                    if (value !== undefined) clean[key] = value;
                }
                return clean;
            });

            await addDocumentNonBlocking(
                tCollection('survey_templates'),
                {
                    title: survey.title,
                    description: survey.description,
                    category: survey.type,
                    isSystem: false,
                    questions: templateQuestions,
                    createdAt: new Date().toISOString(),
                }
            );
            toast({ title: 'Загвар болгон хадгалагдлаа' });
        } catch (error) {
            console.error('Failed to save as template:', error);
            toast({ title: 'Алдаа гарлаа', variant: 'destructive' });
        }
    };

    if (surveyLoading) {
        return (
            <div className="flex flex-col h-full w-full py-6 px-page">
                <Skeleton className="h-8 w-64 mb-4" />
                <Skeleton className="h-4 w-96 mb-8" />
                <Skeleton className="h-64 w-full" />
            </div>
        );
    }

    if (!survey) {
        return (
            <div className="flex flex-col items-center justify-center h-full py-20">
                <p className="text-muted-foreground">Санал асуулга олдсонгүй</p>
                <Button variant="outline" className="mt-4" onClick={() => router.push('/dashboard/survey')}>
                    Буцах
                </Button>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full w-full py-6 px-page overflow-hidden">
            <div className="flex-1 overflow-y-auto pb-32">
                <div className="pb-6">
                    <PageHeader
                        title={survey.title}
                        description={`${SURVEY_TYPE_LABELS[survey.type]} • ${survey.questionsCount} асуулт • ${survey.responsesCount} хариулт`}
                        showBackButton={true}
                        hideBreadcrumbs={true}
                        backButtonPlacement="inline"
                        backBehavior="history"
                        fallbackBackHref="/dashboard/survey"
                        backHref="/dashboard/survey"
                        actions={
                            <div className="flex items-center gap-2">
                                <Badge variant="secondary" className={cn('text-xs', SURVEY_STATUS_COLORS[survey.status])}>
                                    {SURVEY_STATUS_LABELS[survey.status]}
                                </Badge>
                                {questions.length > 0 && (
                                    <Button size="sm" variant="ghost" onClick={handleSaveAsTemplate}>
                                        <BookmarkPlus className="h-3.5 w-3.5 mr-1" />
                                        Загвар болгох
                                    </Button>
                                )}
                                {isDraft && (
                                    <>
                                        <Button size="sm" variant="outline" onClick={() => setDeleteDialogOpen(true)} disabled={isDeleting}>
                                            <Trash2 className="h-3.5 w-3.5 mr-1" />
                                            Устгах
                                        </Button>
                                        <Button
                                            size="sm"
                                            onClick={() => handleStatusChange('active')}
                                            disabled={questions.length === 0}
                                        >
                                            <Play className="h-3.5 w-3.5 mr-1" />
                                            Идэвхжүүлэх
                                        </Button>
                                    </>
                                )}
                                {isActive && (
                                    <>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => router.push(`/dashboard/survey/${id}/results`)}
                                        >
                                            <BarChart3 className="h-3.5 w-3.5 mr-1" />
                                            Дүн
                                        </Button>
                                        <Button size="sm" variant="destructive" onClick={() => handleStatusChange('closed')}>
                                            <Pause className="h-3.5 w-3.5 mr-1" />
                                            Хаах
                                        </Button>
                                    </>
                                )}
                                {survey.status === 'closed' && (
                                    <>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => router.push(`/dashboard/survey/${id}/results`)}
                                        >
                                            <BarChart3 className="h-3.5 w-3.5 mr-1" />
                                            Дүн
                                        </Button>
                                        <Button size="sm" variant="ghost" onClick={() => handleStatusChange('archived')}>
                                            <Archive className="h-3.5 w-3.5 mr-1" />
                                            Архивлах
                                        </Button>
                                        <Button size="sm" variant="outline" onClick={() => setDeleteDialogOpen(true)} disabled={isDeleting} className="text-rose-600 hover:text-rose-700">
                                            <Trash2 className="h-3.5 w-3.5 mr-1" />
                                            Устгах
                                        </Button>
                                    </>
                                )}
                                {survey.status === 'archived' && (
                                    <Button size="sm" variant="outline" onClick={() => setDeleteDialogOpen(true)} disabled={isDeleting} className="text-rose-600 hover:text-rose-700">
                                        <Trash2 className="h-3.5 w-3.5 mr-1" />
                                        Устгах
                                    </Button>
                                )}
                            </div>
                        }
                    />
                </div>

                <Tabs defaultValue={isDraft ? 'edit' : 'settings'} className="w-full">
                    <div className="mb-4">
                        <VerticalTabMenu
                            orientation="horizontal"
                            items={[
                                ...(isDraft
                                    ? [{ value: 'edit', label: 'Засварлах' }]
                                    : []),
                                { value: 'settings', label: 'Тохиргоо' },
                                { value: 'preview', label: 'Урьдчилан харах' },
                            ]}
                        />
                    </div>

                    {isDraft && (
                        <TabsContent value="edit" className="mt-0">
                            <div className="max-w-3xl space-y-4">
                                <SurveyBuilder
                                    questions={questions}
                                    onChange={(newQs) => setLocalQuestions(newQs)}
                                />
                                <div className="flex justify-end pt-4">
                                    <Button onClick={handleSaveQuestions} disabled={isSaving}>
                                        {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                        <Save className="h-4 w-4 mr-1.5" />
                                        Хадгалах
                                    </Button>
                                </div>
                            </div>
                        </TabsContent>
                    )}

                    <TabsContent value="settings" className="mt-0">
                        <div className="max-w-2xl space-y-6">
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-base flex items-center gap-2">
                                        <Settings2 className="h-4 w-4" />
                                        Ерөнхий мэдээлэл
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Гарчиг</label>
                                        <Input
                                            value={title}
                                            onChange={(e) => setEditTitle(e.target.value)}
                                            disabled={!isDraft}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Тайлбар</label>
                                        <Textarea
                                            value={description}
                                            onChange={(e) => setEditDescription(e.target.value)}
                                            rows={3}
                                            disabled={!isDraft}
                                        />
                                    </div>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-base flex items-center gap-2">
                                        <ShieldCheck className="h-4 w-4" />
                                        Нууцлал
                                    </CardTitle>
                                    <CardDescription>
                                        Хариулагчийн мэдээлэл харагдах эсэхийг тохируулна
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="flex items-center justify-between p-4 rounded-lg border">
                                        <div className="flex items-start gap-3">
                                            <div className={cn(
                                                "w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0",
                                                isAnonymous ? "bg-amber-500/10" : "bg-blue-500/10"
                                            )}>
                                                {isAnonymous
                                                    ? <EyeOff className="h-4.5 w-4.5 text-amber-600" />
                                                    : <Eye className="h-4.5 w-4.5 text-blue-600" />
                                                }
                                            </div>
                                            <div>
                                                <div className="text-sm font-medium">
                                                    {isAnonymous ? 'Нэргүй судалгаа' : 'Нээлттэй судалгаа'}
                                                </div>
                                                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                                                    {isAnonymous
                                                        ? 'Хариулагчийн нэр, мэдээлэл нууцлагдана. Дүн хэсэгт зөвхөн нэгдсэн статистик харагдана.'
                                                        : 'Хэн ямар хариулт өгснийг дүн хэсэгт нэг бүрчлэн харах боломжтой.'
                                                    }
                                                </p>
                                            </div>
                                        </div>
                                        <Switch
                                            checked={!isAnonymous}
                                            onCheckedChange={(checked) => setLocalIsAnonymous(!checked)}
                                            disabled={!isDraft}
                                        />
                                    </div>
                                    {!isDraft && (
                                        <p className="text-[11px] text-muted-foreground mt-2">
                                            Нууцлалын тохиргоог зөвхөн ноорог төлөвт өөрчлөх боломжтой
                                        </p>
                                    )}
                                </CardContent>
                            </Card>

                            <EmployeeTargetCard
                                selectedIds={targetIds}
                                onChange={(ids) => setLocalTargetIds(ids)}
                                disabled={!isDraft && !isActive}
                            />

                            {(isDraft || isActive) && (
                                <div className="flex justify-end">
                                    <Button onClick={handleSaveQuestions} disabled={isSaving || !hasSettingsChanges}>
                                        {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                        <Save className="h-4 w-4 mr-1.5" />
                                        Хадгалах
                                    </Button>
                                </div>
                            )}
                        </div>
                    </TabsContent>

                                    <TabsContent value="preview" className="mt-0">
                        <SurveyPreview
                            title={survey.title}
                            description={survey.description}
                            questions={questions}
                        />
                    </TabsContent>
                </Tabs>
            </div>

            <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Санал асуулгыг устгах уу?</AlertDialogTitle>
                        <AlertDialogDescription>
                            &quot;{survey?.title}&quot; болон энэ санал асуулгын бүх асуулт, хүмүүсийн бүх хариулт үйлдлийг бүрмөсөн устгана. Энэ үйлдлийг буцааж болохгүй.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeleting}>Цуцлах</AlertDialogCancel>
                        <AlertDialogAction variant="destructive" onClick={handleDelete} disabled={isDeleting}>
                            {isDeleting ? (
                                <>
                                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                                    Устгаж байна...
                                </>
                            ) : (
                                'Устгах'
                            )}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
