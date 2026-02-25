'use client';

import React, { useMemo, use, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { doc, collection, getDoc } from 'firebase/firestore';
import { useFirebase, useDoc, useCollection, useMemoFirebase } from '@/firebase';
import { PageHeader } from '@/components/patterns/page-layout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { VerticalTabMenu } from '@/components/ui/vertical-tab-menu';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
    Download,
    EyeOff,
    User,
    ChevronDown,
    ChevronUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ResultsOverview } from '../../components/results-overview';
import { QuestionResultCard } from '../../components/question-result-card';
import {
    Survey,
    SurveyQuestion,
    SurveyResponse,
    SURVEY_STATUS_LABELS,
    SURVEY_STATUS_COLORS,
    SURVEY_TYPE_LABELS,
    QUESTION_TYPE_LABELS,
} from '../../types';
import type { Employee } from '@/types';

interface EmployeeMap {
    [id: string]: Employee;
}

function IndividualResponseCard({
    response,
    questions,
    employee,
    index,
}: {
    response: SurveyResponse;
    questions: SurveyQuestion[];
    employee?: Employee;
    index: number;
}) {
    const [isExpanded, setIsExpanded] = useState(false);
    const answeredCount = questions.filter(q => {
        const val = response.answers[q.id];
        return val !== undefined && val !== null && val !== '' && !(Array.isArray(val) && val.length === 0);
    }).length;

    const submittedDate = response.submittedAt
        ? new Date(response.submittedAt).toLocaleString('mn-MN', {
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit',
        })
        : '—';

    return (
        <Card className={cn("transition-all", isExpanded && "ring-1 ring-primary/20")}>
            <button
                className="w-full text-left"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            {employee ? (
                                <Avatar className="h-8 w-8">
                                    <AvatarImage src={(employee as any).photoURL} />
                                    <AvatarFallback className="text-xs bg-slate-100">
                                        {employee.firstName?.charAt(0)}
                                    </AvatarFallback>
                                </Avatar>
                            ) : (
                                <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center">
                                    <User className="h-4 w-4 text-slate-400" />
                                </div>
                            )}
                            <div>
                                <div className="text-sm font-medium">
                                    {employee
                                        ? `${employee.lastName?.charAt(0)}. ${employee.firstName}`
                                        : `Хариулт #${index + 1}`
                                    }
                                </div>
                                <div className="text-[11px] text-muted-foreground">
                                    {submittedDate} • {answeredCount}/{questions.length} хариулсан
                                </div>
                            </div>
                        </div>
                        {isExpanded
                            ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
                            : <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        }
                    </div>
                </CardHeader>
            </button>

            {isExpanded && (
                <CardContent className="pt-0">
                    <div className="divide-y">
                        {questions.map((q, qIdx) => {
                            const answer = response.answers[q.id];
                            return (
                                <div key={q.id} className="py-3 first:pt-1">
                                    <div className="flex items-start gap-2 mb-1">
                                        <span className="text-[11px] text-muted-foreground font-medium mt-0.5">
                                            {qIdx + 1}.
                                        </span>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-medium text-muted-foreground">{q.text}</p>
                                            <div className="mt-1">
                                                <AnswerDisplay question={q} answer={answer} />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </CardContent>
            )}
        </Card>
    );
}

function AnswerDisplay({ question, answer }: { question: SurveyQuestion; answer: any }) {
    if (answer === undefined || answer === null || answer === '') {
        return <span className="text-xs text-muted-foreground italic">Хариулаагүй</span>;
    }

    switch (question.type) {
        case 'single_choice':
            return <span className="text-sm">{answer}</span>;
        case 'multiple_choice':
            return (
                <div className="flex flex-wrap gap-1">
                    {(Array.isArray(answer) ? answer : []).map((opt: string, i: number) => (
                        <Badge key={i} variant="secondary" className="text-xs">{opt}</Badge>
                    ))}
                </div>
            );
        case 'rating': {
            const max = question.ratingMax || 5;
            return (
                <div className="flex items-center gap-1.5">
                    <div className="flex gap-0.5">
                        {Array.from({ length: max }).map((_, i) => (
                            <div
                                key={i}
                                className={cn(
                                    "w-5 h-5 rounded text-[10px] font-medium flex items-center justify-center",
                                    i < answer
                                        ? "bg-primary text-primary-foreground"
                                        : "bg-muted text-muted-foreground"
                                )}
                            >
                                {i + 1}
                            </div>
                        ))}
                    </div>
                    <span className="text-sm font-medium ml-1">{answer}/{max}</span>
                </div>
            );
        }
        case 'nps': {
            const color = answer >= 9 ? 'text-emerald-600' : answer >= 7 ? 'text-amber-600' : 'text-red-600';
            const label = answer >= 9 ? 'Promoter' : answer >= 7 ? 'Passive' : 'Detractor';
            return (
                <div className="flex items-center gap-2">
                    <span className={cn("text-sm font-bold", color)}>{answer}</span>
                    <Badge variant="outline" className={cn("text-[10px]", color)}>{label}</Badge>
                </div>
            );
        }
        case 'yes_no':
            return (
                <Badge variant={answer === 'yes' ? 'default' : 'secondary'} className="text-xs">
                    {answer === 'yes' ? 'Тийм' : 'Үгүй'}
                </Badge>
            );
        case 'text':
            return (
                <p className="text-sm bg-muted/50 rounded-md p-2 leading-relaxed">{answer}</p>
            );
        default:
            return <span className="text-sm">{String(answer)}</span>;
    }
}

export default function SurveyResultsPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const router = useRouter();
    const { firestore } = useFirebase();

    const surveyRef = useMemoFirebase(
        () => firestore ? doc(firestore, 'surveys', id) : null,
        [firestore, id]
    );
    const { data: survey, isLoading: surveyLoading } = useDoc<Survey>(surveyRef);

    const questionsQuery = useMemoFirebase(
        () => firestore ? collection(firestore, 'surveys', id, 'questions') : null,
        [firestore, id]
    );
    const { data: rawQuestions, isLoading: questionsLoading } = useCollection<SurveyQuestion>(questionsQuery);

    const responsesQuery = useMemoFirebase(
        () => firestore ? collection(firestore, 'surveys', id, 'responses') : null,
        [firestore, id]
    );
    const { data: responses, isLoading: responsesLoading } = useCollection<SurveyResponse>(responsesQuery);

    const questions = useMemo(() => {
        if (!rawQuestions) return [];
        return [...rawQuestions].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    }, [rawQuestions]);

    const [employeeMap, setEmployeeMap] = useState<EmployeeMap>({});

    useEffect(() => {
        if (!firestore || !responses || !survey || survey.isAnonymous) return;
        const uniqueIds = [...new Set(
            responses.map(r => r.employeeId).filter((id): id is string => !!id)
        )];
        const missing = uniqueIds.filter(eid => !employeeMap[eid]);
        if (missing.length === 0) return;

        Promise.all(
            missing.map(async (eid) => {
                const snap = await getDoc(doc(firestore, 'employees', eid));
                return snap.exists() ? { id: snap.id, ...snap.data() } as Employee : null;
            })
        ).then(results => {
            const newMap: EmployeeMap = { ...employeeMap };
            results.forEach(emp => {
                if (emp) newMap[emp.id] = emp;
            });
            setEmployeeMap(newMap);
        });
    }, [firestore, responses, survey, employeeMap]);

    const isLoading = surveyLoading || questionsLoading || responsesLoading;
    const showIndividual = survey && !survey.isAnonymous;

    const handleExportCSV = () => {
        if (!questions.length || !responses?.length || !survey) return;

        const hasNames = !survey.isAnonymous;
        const headers = [
            '#',
            ...(hasNames ? ['Ажилтан'] : []),
            'Огноо',
            ...questions.map(q => q.text),
        ];
        const rows = responses.map((r, idx) => {
            const emp = r.employeeId ? employeeMap[r.employeeId] : null;
            return [
                String(idx + 1),
                ...(hasNames ? [emp ? `${emp.lastName?.charAt(0)}. ${emp.firstName}` : '—'] : []),
                r.submittedAt ? new Date(r.submittedAt).toLocaleDateString('mn-MN') : '—',
                ...questions.map(q => {
                    const val = r.answers[q.id];
                    if (val === undefined || val === null) return '';
                    if (Array.isArray(val)) return val.join('; ');
                    return String(val);
                }),
            ];
        });

        const csvContent = [headers, ...rows]
            .map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(','))
            .join('\n');

        const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `survey-${survey?.title || id}-results.csv`;
        link.click();
        URL.revokeObjectURL(url);
    };

    if (isLoading) {
        return (
            <div className="flex flex-col h-full w-full py-6 px-page">
                <Skeleton className="h-8 w-64 mb-4" />
                <Skeleton className="h-4 w-96 mb-8" />
                <div className="grid grid-cols-4 gap-4 mb-8">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <Skeleton key={i} className="h-24" />
                    ))}
                </div>
                <div className="space-y-4">
                    {Array.from({ length: 3 }).map((_, i) => (
                        <Skeleton key={i} className="h-48" />
                    ))}
                </div>
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
                        title={`${survey.title} — Дүн`}
                        description={`${SURVEY_TYPE_LABELS[survey.type]} • ${responses?.length || 0} хариулт${survey.isAnonymous ? ' • Нэргүй' : ''}`}
                        showBackButton={true}
                        hideBreadcrumbs={true}
                        backButtonPlacement="inline"
                        backBehavior="history"
                        fallbackBackHref={`/dashboard/survey/${id}`}
                        backHref={`/dashboard/survey/${id}`}
                        actions={
                            <div className="flex items-center gap-2">
                                <Badge variant="secondary" className={cn('text-xs', SURVEY_STATUS_COLORS[survey.status])}>
                                    {SURVEY_STATUS_LABELS[survey.status]}
                                </Badge>
                                {survey.isAnonymous && (
                                    <Badge variant="outline" className="text-xs gap-1">
                                        <EyeOff className="h-3 w-3" />
                                        Нэргүй
                                    </Badge>
                                )}
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={handleExportCSV}
                                    disabled={!responses?.length}
                                >
                                    <Download className="h-3.5 w-3.5 mr-1" />
                                    CSV
                                </Button>
                            </div>
                        }
                    />
                </div>

                <div className="mb-8">
                    <ResultsOverview
                        survey={survey}
                        questions={questions}
                        responses={responses || []}
                    />
                </div>

                <Tabs defaultValue="aggregate" className="w-full">
                    <div className="mb-4">
                        <VerticalTabMenu
                            orientation="horizontal"
                            items={[
                                { value: 'aggregate', label: `Нэгтгэл (${questions.length})` },
                                ...(showIndividual
                                    ? [{ value: 'individual', label: `Хариултууд (${responses?.length || 0})` }]
                                    : []),
                            ]}
                        />
                    </div>

                    <TabsContent value="aggregate" className="mt-0">
                        <div className="space-y-4">
                            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                                Асуулт бүрийн дүн
                            </h2>
                            {questions.length === 0 ? (
                                <p className="text-sm text-muted-foreground py-8 text-center">
                                    Асуулт олдсонгүй
                                </p>
                            ) : (
                                questions.map((q, idx) => (
                                    <QuestionResultCard
                                        key={q.id}
                                        question={q}
                                        responses={responses || []}
                                        index={idx}
                                    />
                                ))
                            )}
                        </div>
                    </TabsContent>

                    {showIndividual && (
                        <TabsContent value="individual" className="mt-0">
                            <div className="space-y-4">
                                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                                    Хариулагч бүрийн хариулт
                                </h2>
                                {!responses || responses.length === 0 ? (
                                    <Card>
                                        <CardContent className="flex flex-col items-center text-center py-12">
                                            <User className="h-8 w-8 text-muted-foreground/30 mb-2" />
                                            <p className="text-sm text-muted-foreground">
                                                Одоогоор хариулт ирээгүй байна
                                            </p>
                                        </CardContent>
                                    </Card>
                                ) : (
                                    responses.map((r, idx) => (
                                        <IndividualResponseCard
                                            key={r.id}
                                            response={r}
                                            questions={questions}
                                            employee={r.employeeId ? employeeMap[r.employeeId] : undefined}
                                            index={idx}
                                        />
                                    ))
                                )}
                            </div>
                        </TabsContent>
                    )}
                </Tabs>
            </div>
        </div>
    );
}
