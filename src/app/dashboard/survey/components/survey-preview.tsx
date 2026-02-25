'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { SurveyQuestion } from '../types';

interface SurveyPreviewProps {
    title: string;
    description?: string;
    questions: SurveyQuestion[];
    className?: string;
}

function QuestionPreview({ question, index }: { question: SurveyQuestion; index: number }) {
    return (
        <div className="space-y-3">
            <div className="flex items-start gap-2">
                <span className="text-sm font-medium text-muted-foreground mt-0.5">{index + 1}.</span>
                <div className="flex-1">
                    <p className="text-sm font-medium">
                        {question.text || 'Асуултын текст...'}
                        {question.isRequired && <span className="text-destructive ml-1">*</span>}
                    </p>
                    {question.description && (
                        <p className="text-xs text-muted-foreground mt-1">{question.description}</p>
                    )}
                </div>
            </div>

            <div className="pl-6">
                {question.type === 'single_choice' && (
                    <RadioGroup disabled className="space-y-2">
                        {(question.options || []).map((opt, i) => (
                            <div key={i} className="flex items-center gap-2">
                                <RadioGroupItem value={String(i)} disabled />
                                <Label className="text-sm font-normal">{opt}</Label>
                            </div>
                        ))}
                    </RadioGroup>
                )}

                {question.type === 'multiple_choice' && (
                    <div className="space-y-2">
                        {(question.options || []).map((opt, i) => (
                            <div key={i} className="flex items-center gap-2">
                                <Checkbox disabled />
                                <Label className="text-sm font-normal">{opt}</Label>
                            </div>
                        ))}
                    </div>
                )}

                {question.type === 'rating' && (
                    <div className="space-y-2">
                        <div className="flex items-center gap-1">
                            {Array.from({ length: question.ratingMax || 5 }).map((_, i) => (
                                <div
                                    key={i}
                                    className="w-10 h-10 rounded-lg border-2 border-muted flex items-center justify-center text-sm font-medium text-muted-foreground hover:border-primary/50 transition-colors"
                                >
                                    {i + 1}
                                </div>
                            ))}
                        </div>
                        {question.ratingLabels && (
                            <div className="flex justify-between text-xs text-muted-foreground">
                                <span>{question.ratingLabels.min}</span>
                                <span>{question.ratingLabels.max}</span>
                            </div>
                        )}
                    </div>
                )}

                {question.type === 'text' && (
                    <Textarea disabled placeholder="Хариултаа бичнэ үү..." rows={3} />
                )}

                {question.type === 'yes_no' && (
                    <RadioGroup disabled className="flex gap-4">
                        <div className="flex items-center gap-2">
                            <RadioGroupItem value="yes" disabled />
                            <Label className="text-sm font-normal">Тийм</Label>
                        </div>
                        <div className="flex items-center gap-2">
                            <RadioGroupItem value="no" disabled />
                            <Label className="text-sm font-normal">Үгүй</Label>
                        </div>
                    </RadioGroup>
                )}

                {question.type === 'nps' && (
                    <div className="space-y-2">
                        <div className="flex items-center gap-1">
                            {Array.from({ length: 11 }).map((_, i) => (
                                <div
                                    key={i}
                                    className={cn(
                                        "w-9 h-9 rounded-lg border-2 flex items-center justify-center text-xs font-medium transition-colors",
                                        i <= 6 ? "border-red-200 text-red-400" :
                                        i <= 8 ? "border-amber-200 text-amber-500" :
                                        "border-emerald-200 text-emerald-500"
                                    )}
                                >
                                    {i}
                                </div>
                            ))}
                        </div>
                        <div className="flex justify-between text-xs text-muted-foreground">
                            <span>Огт санал болгохгүй</span>
                            <span>Маш их санал болгоно</span>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export function SurveyPreview({ title, description, questions, className }: SurveyPreviewProps) {
    return (
        <Card className={cn("max-w-2xl mx-auto", className)}>
            <CardHeader className="space-y-1">
                <CardTitle className="text-lg">{title || 'Санал асуулгын нэр'}</CardTitle>
                {description && (
                    <p className="text-sm text-muted-foreground">{description}</p>
                )}
                <div className="flex items-center gap-2 pt-1">
                    <Badge variant="outline" className="text-[10px]">Урьдчилан харах</Badge>
                    <span className="text-xs text-muted-foreground">{questions.length} асуулт</span>
                </div>
            </CardHeader>
            <CardContent className="space-y-6">
                {questions.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">Асуулт нэмэгдээгүй байна</p>
                ) : (
                    questions.map((q, idx) => (
                        <QuestionPreview key={q.id || idx} question={q} index={idx} />
                    ))
                )}
            </CardContent>
        </Card>
    );
}
