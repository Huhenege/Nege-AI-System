'use client';

import React, { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Survey, SurveyQuestion, SurveyResponse } from '../types';
import { Users, CheckCircle, BarChart3, TrendingUp } from 'lucide-react';

interface ResultsOverviewProps {
    survey: Survey;
    questions: SurveyQuestion[];
    responses: SurveyResponse[];
}

export function ResultsOverview({ survey, questions, responses }: ResultsOverviewProps) {
    const stats = useMemo(() => {
        const totalResponses = responses.length;
        const responseRate = survey.responsesCount > 0 ? totalResponses : 0;

        // Average rating across all rating questions
        const ratingQuestions = questions.filter(q => q.type === 'rating');
        let totalRatingSum = 0;
        let totalRatingCount = 0;
        ratingQuestions.forEach(q => {
            responses.forEach(r => {
                const val = r.answers[q.id];
                if (typeof val === 'number') {
                    totalRatingSum += val;
                    totalRatingCount++;
                }
            });
        });
        const avgRating = totalRatingCount > 0 ? totalRatingSum / totalRatingCount : 0;

        // NPS
        const npsQuestions = questions.filter(q => q.type === 'nps');
        let promoters = 0, detractors = 0, npsTotal = 0;
        npsQuestions.forEach(q => {
            responses.forEach(r => {
                const val = r.answers[q.id];
                if (typeof val === 'number' && val >= 0 && val <= 10) {
                    npsTotal++;
                    if (val >= 9) promoters++;
                    else if (val <= 6) detractors++;
                }
            });
        });
        const npsScore = npsTotal > 0 ? Math.round(((promoters - detractors) / npsTotal) * 100) : null;

        // Completion rate (how many answered all required questions)
        const requiredQuestions = questions.filter(q => q.isRequired);
        const fullyCompleted = responses.filter(r => {
            return requiredQuestions.every(q => {
                const val = r.answers[q.id];
                return val !== undefined && val !== null && val !== '' && !(Array.isArray(val) && val.length === 0);
            });
        }).length;
        const completionRate = totalResponses > 0 ? Math.round((fullyCompleted / totalResponses) * 100) : 0;

        return { totalResponses, avgRating, npsScore, completionRate };
    }, [survey, questions, responses]);

    const npsColor = stats.npsScore !== null
        ? (stats.npsScore >= 50 ? 'text-emerald-600' : stats.npsScore >= 0 ? 'text-amber-600' : 'text-red-600')
        : 'text-muted-foreground';

    return (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
                <CardContent className="p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                        <Users className="h-5 w-5 text-blue-500" />
                    </div>
                    <div>
                        <div className="text-2xl font-bold">{stats.totalResponses}</div>
                        <div className="text-xs text-muted-foreground">Нийт хариулт</div>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardContent className="p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                        <CheckCircle className="h-5 w-5 text-emerald-500" />
                    </div>
                    <div>
                        <div className="text-2xl font-bold">{stats.completionRate}%</div>
                        <div className="text-xs text-muted-foreground">Бүрэн бөглөсөн</div>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardContent className="p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                        <BarChart3 className="h-5 w-5 text-amber-500" />
                    </div>
                    <div>
                        <div className="text-2xl font-bold">{stats.avgRating.toFixed(1)}</div>
                        <div className="text-xs text-muted-foreground">Дундаж үнэлгээ</div>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardContent className="p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center">
                        <TrendingUp className="h-5 w-5 text-violet-500" />
                    </div>
                    <div>
                        <div className={cn("text-2xl font-bold", npsColor)}>
                            {stats.npsScore !== null ? stats.npsScore : '—'}
                        </div>
                        <div className="text-xs text-muted-foreground">NPS Score</div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
