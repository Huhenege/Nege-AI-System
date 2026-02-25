'use client';

import React, { useMemo, useState, useCallback } from 'react';
import { collection, query, orderBy, doc, deleteDoc } from 'firebase/firestore';
import { useFirebase, useCollection, useMemoFirebase, addDocumentNonBlocking } from '@/firebase';
import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/patterns/page-layout';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { VerticalTabMenu } from '@/components/ui/vertical-tab-menu';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { SurveyList } from './components/survey-list';
import { CreateSurveyDialog } from './components/create-survey-dialog';
import { SurveyTemplateList } from './components/survey-template-list';
import { SYSTEM_TEMPLATES } from './data/system-templates';
import type { Survey, SurveyTemplate } from './types';

export default function SurveyPage() {
    const { firestore } = useFirebase();
    const router = useRouter();
    const { toast } = useToast();
    const [isCreateOpen, setIsCreateOpen] = useState(false);

    const surveysQuery = useMemoFirebase(
        () => firestore ? query(collection(firestore, 'surveys'), orderBy('createdAt', 'desc')) : null,
        [firestore]
    );
    const { data: surveys, isLoading } = useCollection<Survey>(surveysQuery);

    const templatesQuery = useMemoFirebase(
        () => firestore ? collection(firestore, 'survey_templates') : null,
        [firestore]
    );
    const { data: firestoreTemplates, isLoading: templatesLoading } = useCollection<SurveyTemplate>(templatesQuery);

    const allTemplates = useMemo(() => {
        const system = SYSTEM_TEMPLATES.map((t, idx) => ({
            ...t,
            id: `system-${idx}`,
        }));
        const custom = (firestoreTemplates || []).map(t => ({
            ...t,
            questions: t.questions || [],
        }));
        return [...system, ...custom];
    }, [firestoreTemplates]);

    const counts = useMemo(() => {
        if (!surveys) return { active: 0, draft: 0, closed: 0 };
        return {
            active: surveys.filter(s => s.status === 'active').length,
            draft: surveys.filter(s => s.status === 'draft').length,
            closed: surveys.filter(s => s.status === 'closed' || s.status === 'archived').length,
        };
    }, [surveys]);

    const handleUseTemplate = useCallback(async (template: typeof allTemplates[number]) => {
        if (!firestore) return;
        try {
            const now = new Date().toISOString();
            const newSurvey: Omit<Survey, 'id'> = {
                title: template.title,
                description: template.description,
                type: (template.category as Survey['type']) || 'custom',
                status: 'draft',
                isAnonymous: true,
                targetAudience: 'all',
                targetIds: [],
                startDate: '',
                endDate: '',
                reminderEnabled: false,
                questionsCount: template.questions.length,
                responsesCount: 0,
                createdBy: '',
                createdAt: now,
                updatedAt: now,
            };

            const docRef = await addDocumentNonBlocking(
                collection(firestore, 'surveys'),
                newSurvey
            );

            if (docRef?.id && template.questions.length > 0) {
                const questionsRef = collection(firestore, 'surveys', docRef.id, 'questions');
                for (const q of template.questions) {
                    const questionData: Record<string, any> = {};
                    for (const [key, value] of Object.entries(q)) {
                        if (value !== undefined) questionData[key] = value;
                    }
                    await addDocumentNonBlocking(questionsRef, questionData);
                }
            }

            toast({ title: `"${template.title}" загвараар судалгаа үүсгэгдлээ` });
            if (docRef?.id) {
                router.push(`/dashboard/survey/${docRef.id}`);
            }
        } catch (error) {
            console.error('Failed to create from template:', error);
            toast({ title: 'Алдаа гарлаа', variant: 'destructive' });
        }
    }, [firestore, router, toast]);

    const handleDeleteTemplate = useCallback(async (templateId: string) => {
        if (!firestore) return;
        try {
            await deleteDoc(doc(firestore, 'survey_templates', templateId));
            toast({ title: 'Загвар устгагдлаа' });
        } catch (error) {
            console.error('Failed to delete template:', error);
            toast({ title: 'Устгахад алдаа гарлаа', variant: 'destructive' });
        }
    }, [firestore, toast]);

    return (
        <div className="flex flex-col h-full w-full py-6 px-page overflow-hidden">
            <div className="flex-1 overflow-y-auto pb-32">
                <div className="pb-6">
                    <PageHeader
                        title="Санал асуулга"
                        description="Ажилтнуудын санал асуулга, судалгаа явуулах, хариултыг шинжлэх"
                        showBackButton={true}
                        hideBreadcrumbs={true}
                        backButtonPlacement="inline"
                        backBehavior="history"
                        fallbackBackHref="/dashboard"
                        backHref="/dashboard"
                        actions={
                            <Button onClick={() => setIsCreateOpen(true)} size="sm">
                                <Plus className="h-4 w-4 mr-1.5" />
                                Шинэ санал асуулга
                            </Button>
                        }
                    />
                </div>

                <Tabs defaultValue="active" className="w-full">
                    <div className="mb-4">
                        <VerticalTabMenu
                            orientation="horizontal"
                            items={[
                                { value: 'active', label: `Идэвхтэй (${counts.active})` },
                                { value: 'draft', label: `Ноорог (${counts.draft})` },
                                { value: 'closed', label: `Хаагдсан (${counts.closed})` },
                                { value: 'templates', label: `Загварууд (${allTemplates.length})` },
                            ]}
                        />
                    </div>

                    <TabsContent value="active" className="mt-0">
                        <SurveyList surveys={surveys} isLoading={isLoading} filterStatus="active" />
                    </TabsContent>

                    <TabsContent value="draft" className="mt-0">
                        <SurveyList surveys={surveys} isLoading={isLoading} filterStatus="draft" />
                    </TabsContent>

                    <TabsContent value="closed" className="mt-0">
                        <SurveyList
                            surveys={surveys?.filter(s => s.status === 'closed' || s.status === 'archived') ?? null}
                            isLoading={isLoading}
                            filterStatus="all"
                        />
                    </TabsContent>

                    <TabsContent value="templates" className="mt-0">
                        <SurveyTemplateList
                            templates={allTemplates}
                            isLoading={templatesLoading}
                            onUseTemplate={handleUseTemplate}
                            onDeleteTemplate={handleDeleteTemplate}
                        />
                    </TabsContent>
                </Tabs>
            </div>

            <CreateSurveyDialog open={isCreateOpen} onOpenChange={setIsCreateOpen} />
        </div>
    );
}
