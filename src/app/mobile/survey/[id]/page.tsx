'use client';

import React, { useState, useMemo, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import { collection, query, where, getDocs, increment, updateDoc } from 'firebase/firestore';
import { useFirebase, useDoc, useCollection, useMemoFirebase, addDocumentNonBlocking, tenantDoc, tenantCollection, useTenantWrite } from '@/firebase';
import { useEmployeeProfile } from '@/hooks/use-employee-profile';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Loader2, CheckCircle, ClipboardList } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import type { Survey, SurveyQuestion, SurveyResponse } from '@/app/dashboard/survey/types';

export default function MobileSurveyRespondPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const router = useRouter();
    const { firestore } = useFirebase();
    const { tDoc, tCollection } = useTenantWrite();
    const { toast } = useToast();
    const { employeeProfile } = useEmployeeProfile();
    const [answers, setAnswers] = useState<Record<string, any>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSubmitted, setIsSubmitted] = useState(false);

    const surveyRef = useMemoFirebase(
        ({ companyPath }) => firestore ? tenantDoc(firestore, companyPath, 'surveys', id) : null,
        [firestore, id]
    );
    const { data: survey, isLoading: surveyLoading } = useDoc<Survey>(surveyRef);

    const questionsQuery = useMemoFirebase(
        ({ firestore, companyPath }) => firestore ? collection(firestore, companyPath ? `${companyPath}/surveys` : 'surveys', id, 'questions') : null,
        [firestore, id]
    );
    const { data: rawQuestions, isLoading: questionsLoading } = useCollection<SurveyQuestion>(questionsQuery);

    const questions = useMemo(() => {
        if (!rawQuestions) return [];
        return [...rawQuestions].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    }, [rawQuestions]);

    const setAnswer = useCallback((questionId: string, value: any) => {
        setAnswers(prev => ({ ...prev, [questionId]: value }));
    }, []);

    const toggleMultiChoice = useCallback((questionId: string, option: string) => {
        setAnswers(prev => {
            const current: string[] = prev[questionId] || [];
            const updated = current.includes(option)
                ? current.filter(o => o !== option)
                : [...current, option];
            return { ...prev, [questionId]: updated };
        });
    }, []);

    const handleSubmit = async () => {
        if (!firestore || !survey) return;

        const requiredMissing = questions.filter(q => {
            if (!q.isRequired) return false;
            const answer = answers[q.id];
            if (answer === undefined || answer === null || answer === '') return true;
            if (Array.isArray(answer) && answer.length === 0) return true;
            return false;
        });

        if (requiredMissing.length > 0) {
            toast({
                title: 'Заавал хариулах асуултууд байна',
                description: `${requiredMissing.length} асуултад хариулна уу`,
                variant: 'destructive',
            });
            return;
        }

        setIsSubmitting(true);
        try {
            const response: Record<string, any> = {
                employeeId: survey.isAnonymous ? null : (employeeProfile?.id || null),
                answers,
                submittedAt: new Date().toISOString(),
            };
            const deptId = (employeeProfile as any)?.departmentId;
            if (deptId) response.departmentId = deptId;

            await addDocumentNonBlocking(
                tCollection('surveys', id, 'responses'),
                response
            );

            await updateDoc(tDoc('surveys', id), {
                responsesCount: increment(1),
            });

            setIsSubmitted(true);
            toast({ title: 'Хариулт амжилттай илгээгдлээ' });
        } catch (error) {
            console.error('Failed to submit:', error);
            toast({ title: 'Алдаа гарлаа', variant: 'destructive' });
        } finally {
            setIsSubmitting(false);
        }
    };

    if (surveyLoading || questionsLoading) {
        return (
            <div className="p-4 space-y-4">
                <Skeleton className="h-8 w-3/4" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-32 w-full" />
            </div>
        );
    }

    if (!survey || survey.status !== 'active') {
        return (
            <div className="flex flex-col items-center text-center py-20 px-4">
                <ClipboardList className="h-12 w-12 text-muted-foreground/30 mb-3" />
                <p className="text-sm text-muted-foreground mb-4">
                    Энэ санал асуулга одоогоор идэвхгүй байна
                </p>
                <Button variant="outline" size="sm" onClick={() => router.push('/mobile/survey')}>
                    Буцах
                </Button>
            </div>
        );
    }

    if (isSubmitted) {
        return (
            <div className="flex flex-col items-center text-center py-20 px-4">
                <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center mb-4">
                    <CheckCircle className="h-8 w-8 text-emerald-500" />
                </div>
                <h2 className="text-lg font-semibold mb-1">Баярлалаа!</h2>
                <p className="text-sm text-muted-foreground mb-6">
                    Таны хариулт амжилттай бүртгэгдлээ.
                </p>
                <Button variant="outline" size="sm" onClick={() => router.push('/mobile/survey')}>
                    Буцах
                </Button>
            </div>
        );
    }

    return (
        <div className="flex flex-col min-h-full">
            {/* Header */}
            <div className="sticky top-0 z-10 bg-background border-b px-4 py-3">
                <div className="flex items-center gap-3">
                    <Link href="/mobile/survey">
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                    </Link>
                    <div className="min-w-0">
                        <h1 className="text-sm font-semibold truncate">{survey.title}</h1>
                        <p className="text-xs text-muted-foreground">{questions.length} асуулт</p>
                    </div>
                </div>
            </div>

            {/* Survey content */}
            <div className="flex-1 p-4 space-y-5">
                {survey.description && (
                    <p className="text-sm text-muted-foreground">{survey.description}</p>
                )}

                {survey.isAnonymous && (
                    <Badge variant="outline" className="text-xs">
                        Нэргүй судалгаа — таны мэдээлэл нуугдана
                    </Badge>
                )}

                {questions.map((q, idx) => (
                    <Card key={q.id}>
                        <CardContent className="p-4 space-y-3">
                            <div className="flex items-start gap-2">
                                <span className="text-xs font-medium text-muted-foreground mt-0.5">{idx + 1}.</span>
                                <div>
                                    <p className="text-sm font-medium">
                                        {q.text}
                                        {q.isRequired && <span className="text-destructive ml-1">*</span>}
                                    </p>
                                    {q.description && (
                                        <p className="text-xs text-muted-foreground mt-0.5">{q.description}</p>
                                    )}
                                </div>
                            </div>

                            {/* Single choice */}
                            {q.type === 'single_choice' && (
                                <RadioGroup
                                    value={answers[q.id] || ''}
                                    onValueChange={(val) => setAnswer(q.id, val)}
                                >
                                    {(q.options || []).map((opt, i) => (
                                        <div key={i} className="flex items-center gap-2">
                                            <RadioGroupItem value={opt} id={`${q.id}-${i}`} />
                                            <Label htmlFor={`${q.id}-${i}`} className="text-sm font-normal">{opt}</Label>
                                        </div>
                                    ))}
                                </RadioGroup>
                            )}

                            {/* Multiple choice */}
                            {q.type === 'multiple_choice' && (
                                <div className="space-y-2">
                                    {(q.options || []).map((opt, i) => (
                                        <div key={i} className="flex items-center gap-2">
                                            <Checkbox
                                                id={`${q.id}-${i}`}
                                                checked={(answers[q.id] || []).includes(opt)}
                                                onCheckedChange={() => toggleMultiChoice(q.id, opt)}
                                            />
                                            <Label htmlFor={`${q.id}-${i}`} className="text-sm font-normal">{opt}</Label>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Rating */}
                            {q.type === 'rating' && (
                                <div className="space-y-2">
                                    <div className="flex items-center gap-1 flex-wrap">
                                        {Array.from({ length: q.ratingMax || 5 }).map((_, i) => (
                                            <button
                                                key={i}
                                                type="button"
                                                onClick={() => setAnswer(q.id, i + 1)}
                                                className={cn(
                                                    "w-10 h-10 rounded-lg border-2 flex items-center justify-center text-sm font-medium transition-all",
                                                    answers[q.id] === i + 1
                                                        ? "border-primary bg-primary text-primary-foreground"
                                                        : "border-muted hover:border-primary/50"
                                                )}
                                            >
                                                {i + 1}
                                            </button>
                                        ))}
                                    </div>
                                    {q.ratingLabels && (
                                        <div className="flex justify-between text-[10px] text-muted-foreground">
                                            <span>{q.ratingLabels.min}</span>
                                            <span>{q.ratingLabels.max}</span>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Text */}
                            {q.type === 'text' && (
                                <Textarea
                                    value={answers[q.id] || ''}
                                    onChange={(e) => setAnswer(q.id, e.target.value)}
                                    placeholder="Хариултаа бичнэ үү..."
                                    rows={3}
                                />
                            )}

                            {/* Yes/No */}
                            {q.type === 'yes_no' && (
                                <RadioGroup
                                    value={answers[q.id] || ''}
                                    onValueChange={(val) => setAnswer(q.id, val)}
                                    className="flex gap-4"
                                >
                                    <div className="flex items-center gap-2">
                                        <RadioGroupItem value="yes" id={`${q.id}-yes`} />
                                        <Label htmlFor={`${q.id}-yes`} className="text-sm font-normal">Тийм</Label>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <RadioGroupItem value="no" id={`${q.id}-no`} />
                                        <Label htmlFor={`${q.id}-no`} className="text-sm font-normal">Үгүй</Label>
                                    </div>
                                </RadioGroup>
                            )}

                            {/* NPS */}
                            {q.type === 'nps' && (
                                <div className="space-y-2">
                                    <div className="flex items-center gap-1 flex-wrap">
                                        {Array.from({ length: 11 }).map((_, i) => (
                                            <button
                                                key={i}
                                                type="button"
                                                onClick={() => setAnswer(q.id, i)}
                                                className={cn(
                                                    "w-8 h-8 rounded-lg border-2 flex items-center justify-center text-xs font-medium transition-all",
                                                    answers[q.id] === i
                                                        ? "border-primary bg-primary text-primary-foreground"
                                                        : i <= 6
                                                        ? "border-red-200 text-red-400 hover:border-red-300"
                                                        : i <= 8
                                                        ? "border-amber-200 text-amber-500 hover:border-amber-300"
                                                        : "border-emerald-200 text-emerald-500 hover:border-emerald-300"
                                                )}
                                            >
                                                {i}
                                            </button>
                                        ))}
                                    </div>
                                    <div className="flex justify-between text-[10px] text-muted-foreground">
                                        <span>Огт санал болгохгүй</span>
                                        <span>Маш их санал болгоно</span>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                ))}

                {/* Submit */}
                <div className="pt-4 pb-8">
                    <Button className="w-full" size="lg" onClick={handleSubmit} disabled={isSubmitting}>
                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Хариулт илгээх
                    </Button>
                </div>
            </div>
        </div>
    );
}
