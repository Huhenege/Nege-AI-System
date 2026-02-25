'use client';

import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { SurveyQuestion, SurveyResponse, QUESTION_TYPE_LABELS } from '../types';

interface QuestionResultCardProps {
    question: SurveyQuestion;
    responses: SurveyResponse[];
    index: number;
}

function BarChart({ data, total }: { data: { label: string; count: number }[]; total: number }) {
    const maxCount = Math.max(...data.map(d => d.count), 1);
    return (
        <div className="space-y-2">
            {data.map((item, idx) => {
                const pct = total > 0 ? Math.round((item.count / total) * 100) : 0;
                return (
                    <div key={idx} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                            <span className="truncate mr-2">{item.label}</span>
                            <span className="text-muted-foreground flex-shrink-0">{item.count} ({pct}%)</span>
                        </div>
                        <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                            <div
                                className="h-full rounded-full bg-primary transition-all"
                                style={{ width: `${total > 0 ? (item.count / maxCount) * 100 : 0}%` }}
                            />
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

function RatingDistribution({ responses, questionId, ratingMax, ratingLabels }: {
    responses: SurveyResponse[];
    questionId: string;
    ratingMax: number;
    ratingLabels?: { min: string; max: string };
}) {
    const stats = useMemo(() => {
        const values: number[] = [];
        const distribution: Record<number, number> = {};
        for (let i = 1; i <= ratingMax; i++) distribution[i] = 0;

        responses.forEach(r => {
            const val = r.answers[questionId];
            if (typeof val === 'number' && val >= 1 && val <= ratingMax) {
                values.push(val);
                distribution[val]++;
            }
        });

        const avg = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
        return { avg, distribution, total: values.length };
    }, [responses, questionId, ratingMax]);

    return (
        <div className="space-y-3">
            <div className="flex items-center gap-4">
                <div className="text-3xl font-bold text-primary">{stats.avg.toFixed(1)}</div>
                <div className="text-sm text-muted-foreground">
                    дундаж ({stats.total} хариулт)
                </div>
            </div>
            <div className="space-y-1.5">
                {Array.from({ length: ratingMax }).map((_, i) => {
                    const rating = ratingMax - i;
                    const count = stats.distribution[rating] || 0;
                    const pct = stats.total > 0 ? (count / stats.total) * 100 : 0;
                    return (
                        <div key={rating} className="flex items-center gap-2 text-sm">
                            <span className="w-4 text-right font-medium">{rating}</span>
                            <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                                <div
                                    className="h-full rounded-full bg-amber-400 transition-all"
                                    style={{ width: `${pct}%` }}
                                />
                            </div>
                            <span className="w-10 text-right text-muted-foreground">{count}</span>
                        </div>
                    );
                })}
            </div>
            {ratingLabels && (
                <div className="flex justify-between text-xs text-muted-foreground pt-1">
                    <span>{ratingLabels.min}</span>
                    <span>{ratingLabels.max}</span>
                </div>
            )}
        </div>
    );
}

function NpsResult({ responses, questionId }: { responses: SurveyResponse[]; questionId: string }) {
    const stats = useMemo(() => {
        let promoters = 0, passives = 0, detractors = 0;
        let total = 0;
        responses.forEach(r => {
            const val = r.answers[questionId];
            if (typeof val === 'number' && val >= 0 && val <= 10) {
                total++;
                if (val >= 9) promoters++;
                else if (val >= 7) passives++;
                else detractors++;
            }
        });
        const npsScore = total > 0
            ? Math.round(((promoters - detractors) / total) * 100)
            : 0;
        return { promoters, passives, detractors, total, npsScore };
    }, [responses, questionId]);

    const npsColor = stats.npsScore >= 50 ? 'text-emerald-500' : stats.npsScore >= 0 ? 'text-amber-500' : 'text-red-500';

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-4">
                <div className={cn("text-4xl font-bold", npsColor)}>{stats.npsScore}</div>
                <div className="text-sm text-muted-foreground">NPS Score ({stats.total} хариулт)</div>
            </div>
            <div className="flex gap-3">
                <div className="flex-1 text-center p-3 rounded-lg bg-emerald-50">
                    <div className="text-lg font-semibold text-emerald-600">{stats.promoters}</div>
                    <div className="text-xs text-emerald-600">Promoters (9-10)</div>
                </div>
                <div className="flex-1 text-center p-3 rounded-lg bg-amber-50">
                    <div className="text-lg font-semibold text-amber-600">{stats.passives}</div>
                    <div className="text-xs text-amber-600">Passives (7-8)</div>
                </div>
                <div className="flex-1 text-center p-3 rounded-lg bg-red-50">
                    <div className="text-lg font-semibold text-red-600">{stats.detractors}</div>
                    <div className="text-xs text-red-600">Detractors (0-6)</div>
                </div>
            </div>
        </div>
    );
}

function YesNoResult({ responses, questionId }: { responses: SurveyResponse[]; questionId: string }) {
    const stats = useMemo(() => {
        let yes = 0, no = 0;
        responses.forEach(r => {
            const val = r.answers[questionId];
            if (val === 'yes') yes++;
            else if (val === 'no') no++;
        });
        return { yes, no, total: yes + no };
    }, [responses, questionId]);

    return (
        <div className="flex gap-4">
            <div className="flex-1 text-center p-4 rounded-lg bg-emerald-50">
                <div className="text-2xl font-semibold text-emerald-600">{stats.yes}</div>
                <div className="text-sm text-emerald-600">
                    Тийм ({stats.total > 0 ? Math.round((stats.yes / stats.total) * 100) : 0}%)
                </div>
            </div>
            <div className="flex-1 text-center p-4 rounded-lg bg-red-50">
                <div className="text-2xl font-semibold text-red-600">{stats.no}</div>
                <div className="text-sm text-red-600">
                    Үгүй ({stats.total > 0 ? Math.round((stats.no / stats.total) * 100) : 0}%)
                </div>
            </div>
        </div>
    );
}

function TextResponses({ responses, questionId }: { responses: SurveyResponse[]; questionId: string }) {
    const textAnswers = useMemo(() => {
        return responses
            .map(r => r.answers[questionId])
            .filter(a => typeof a === 'string' && a.trim().length > 0);
    }, [responses, questionId]);

    if (textAnswers.length === 0) {
        return <p className="text-sm text-muted-foreground">Хариулт байхгүй</p>;
    }

    return (
        <div className="space-y-2 max-h-60 overflow-y-auto">
            {textAnswers.map((text, idx) => (
                <div key={idx} className="p-2.5 rounded-lg bg-muted/50 text-sm">
                    {text}
                </div>
            ))}
        </div>
    );
}

export function QuestionResultCard({ question, responses, index }: QuestionResultCardProps) {
    const answeredCount = responses.filter(r => {
        const val = r.answers[question.id];
        return val !== undefined && val !== null && val !== '' && !(Array.isArray(val) && val.length === 0);
    }).length;

    return (
        <Card>
            <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-sm font-medium">
                        <span className="text-muted-foreground mr-1">{index + 1}.</span>
                        {question.text}
                    </CardTitle>
                    <div className="flex items-center gap-2 flex-shrink-0">
                        <Badge variant="outline" className="text-[10px]">
                            {QUESTION_TYPE_LABELS[question.type]}
                        </Badge>
                        <span className="text-xs text-muted-foreground">{answeredCount} хариулт</span>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                {(question.type === 'single_choice' || question.type === 'multiple_choice') && (
                    <BarChart
                        data={(question.options || []).map(opt => ({
                            label: opt,
                            count: responses.filter(r => {
                                const val = r.answers[question.id];
                                if (question.type === 'multiple_choice') {
                                    return Array.isArray(val) && val.includes(opt);
                                }
                                return val === opt;
                            }).length,
                        }))}
                        total={answeredCount}
                    />
                )}

                {question.type === 'rating' && (
                    <RatingDistribution
                        responses={responses}
                        questionId={question.id}
                        ratingMax={question.ratingMax || 5}
                        ratingLabels={question.ratingLabels}
                    />
                )}

                {question.type === 'nps' && (
                    <NpsResult responses={responses} questionId={question.id} />
                )}

                {question.type === 'yes_no' && (
                    <YesNoResult responses={responses} questionId={question.id} />
                )}

                {question.type === 'text' && (
                    <TextResponses responses={responses} questionId={question.id} />
                )}
            </CardContent>
        </Card>
    );
}
