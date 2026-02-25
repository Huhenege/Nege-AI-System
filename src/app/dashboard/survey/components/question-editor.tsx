'use client';

import React from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    CircleDot,
    CheckSquare,
    Star,
    AlignLeft,
    ToggleLeft,
    Gauge,
    Trash2,
    GripVertical,
    Plus,
    X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
    QuestionType,
    QUESTION_TYPES,
    QUESTION_TYPE_LABELS,
    SurveyQuestion,
} from '../types';

const QUESTION_TYPE_ICON_MAP: Record<QuestionType, React.ElementType> = {
    single_choice: CircleDot,
    multiple_choice: CheckSquare,
    rating: Star,
    text: AlignLeft,
    yes_no: ToggleLeft,
    nps: Gauge,
};

interface QuestionEditorProps {
    question: SurveyQuestion;
    index: number;
    onChange: (updated: SurveyQuestion) => void;
    onDelete: () => void;
}

export function QuestionEditor({ question, index, onChange, onDelete }: QuestionEditorProps) {
    const Icon = QUESTION_TYPE_ICON_MAP[question.type];

    const updateField = <K extends keyof SurveyQuestion>(key: K, value: SurveyQuestion[K]) => {
        onChange({ ...question, [key]: value });
    };

    const addOption = () => {
        const opts = [...(question.options || []), `Сонголт ${(question.options?.length || 0) + 1}`];
        updateField('options', opts);
    };

    const updateOption = (idx: number, value: string) => {
        const opts = [...(question.options || [])];
        opts[idx] = value;
        updateField('options', opts);
    };

    const removeOption = (idx: number) => {
        const opts = (question.options || []).filter((_, i) => i !== idx);
        updateField('options', opts);
    };

    const needsOptions = question.type === 'single_choice' || question.type === 'multiple_choice';
    const isRating = question.type === 'rating';
    const isNps = question.type === 'nps';

    return (
        <div className="border rounded-xl p-4 space-y-4 bg-card hover:shadow-sm transition-shadow group">
            <div className="flex items-start gap-3">
                <div className="flex items-center gap-1 pt-2 text-muted-foreground cursor-grab">
                    <GripVertical className="h-4 w-4" />
                    <span className="text-xs font-medium text-muted-foreground/70 w-5">{index + 1}</span>
                </div>

                <div className="flex-1 space-y-3">
                    <div className="flex items-start gap-3">
                        <div className="flex-1">
                            <Input
                                value={question.text}
                                onChange={(e) => updateField('text', e.target.value)}
                                placeholder="Асуултын текст..."
                                className="text-base font-medium border-0 border-b rounded-none px-0 focus-visible:ring-0 focus-visible:border-primary"
                            />
                        </div>

                        <Select
                            value={question.type}
                            onValueChange={(val) => {
                                const newType = val as QuestionType;
                                const updated: SurveyQuestion = { ...question, type: newType };
                                if (newType === 'single_choice' || newType === 'multiple_choice') {
                                    if (!updated.options?.length) {
                                        updated.options = ['Сонголт 1', 'Сонголт 2'];
                                    }
                                }
                                if (newType === 'rating' && !updated.ratingMax) {
                                    updated.ratingMax = 5;
                                    updated.ratingLabels = { min: 'Маш муу', max: 'Маш сайн' };
                                }
                                onChange(updated);
                            }}
                        >
                            <SelectTrigger className="w-[160px]">
                                <div className="flex items-center gap-2">
                                    <Icon className="h-3.5 w-3.5" />
                                    <SelectValue />
                                </div>
                            </SelectTrigger>
                            <SelectContent>
                                {QUESTION_TYPES.map(type => {
                                    const TypeIcon = QUESTION_TYPE_ICON_MAP[type];
                                    return (
                                        <SelectItem key={type} value={type}>
                                            <div className="flex items-center gap-2">
                                                <TypeIcon className="h-3.5 w-3.5" />
                                                {QUESTION_TYPE_LABELS[type]}
                                            </div>
                                        </SelectItem>
                                    );
                                })}
                            </SelectContent>
                        </Select>
                    </div>

                    <Input
                        value={question.description || ''}
                        onChange={(e) => updateField('description', e.target.value)}
                        placeholder="Тайлбар (заавал биш)..."
                        className="text-sm text-muted-foreground border-0 border-b rounded-none px-0 focus-visible:ring-0 focus-visible:border-primary"
                    />

                    {/* Options for choice questions */}
                    {needsOptions && (
                        <div className="space-y-2 pl-1">
                            {(question.options || []).map((opt, optIdx) => (
                                <div key={optIdx} className="flex items-center gap-2">
                                    {question.type === 'single_choice' ? (
                                        <div className="w-4 h-4 rounded-full border-2 border-muted-foreground/30 flex-shrink-0" />
                                    ) : (
                                        <div className="w-4 h-4 rounded border-2 border-muted-foreground/30 flex-shrink-0" />
                                    )}
                                    <Input
                                        value={opt}
                                        onChange={(e) => updateOption(optIdx, e.target.value)}
                                        className="h-8 text-sm"
                                        placeholder={`Сонголт ${optIdx + 1}`}
                                    />
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7 flex-shrink-0"
                                        onClick={() => removeOption(optIdx)}
                                    >
                                        <X className="h-3.5 w-3.5" />
                                    </Button>
                                </div>
                            ))}
                            <Button variant="ghost" size="sm" onClick={addOption} className="text-xs">
                                <Plus className="h-3.5 w-3.5 mr-1" />
                                Сонголт нэмэх
                            </Button>
                        </div>
                    )}

                    {/* Rating settings */}
                    {isRating && (
                        <div className="flex items-center gap-4 pl-1">
                            <div className="flex items-center gap-2">
                                <Label className="text-xs text-muted-foreground">Хамгийн бага</Label>
                                <Input
                                    value={question.ratingLabels?.min || ''}
                                    onChange={(e) => updateField('ratingLabels', {
                                        min: e.target.value,
                                        max: question.ratingLabels?.max || 'Маш сайн',
                                    })}
                                    className="h-8 w-28 text-sm"
                                    placeholder="Маш муу"
                                />
                            </div>
                            <div className="flex items-center gap-2">
                                <Label className="text-xs text-muted-foreground">Хамгийн их</Label>
                                <Input
                                    value={question.ratingLabels?.max || ''}
                                    onChange={(e) => updateField('ratingLabels', {
                                        min: question.ratingLabels?.min || 'Маш муу',
                                        max: e.target.value,
                                    })}
                                    className="h-8 w-28 text-sm"
                                    placeholder="Маш сайн"
                                />
                            </div>
                            <Select
                                value={String(question.ratingMax || 5)}
                                onValueChange={(val) => updateField('ratingMax', Number(val))}
                            >
                                <SelectTrigger className="w-20 h-8">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="5">1-5</SelectItem>
                                    <SelectItem value="10">1-10</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    {/* NPS info */}
                    {isNps && (
                        <div className="pl-1">
                            <p className="text-xs text-muted-foreground">
                                NPS (Net Promoter Score): 0-10 хүртэл оноо. 0-6 = Detractors, 7-8 = Passives, 9-10 = Promoters
                            </p>
                        </div>
                    )}
                </div>

                <div className="flex flex-col items-center gap-2 pt-1">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={onDelete}
                    >
                        <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t">
                <div className="flex items-center gap-2">
                    <Checkbox
                        id={`required-${question.id}`}
                        checked={question.isRequired}
                        onCheckedChange={(val) => updateField('isRequired', !!val)}
                    />
                    <Label htmlFor={`required-${question.id}`} className="text-xs text-muted-foreground cursor-pointer">
                        Заавал хариулах
                    </Label>
                </div>
                <Input
                    value={question.section || ''}
                    onChange={(e) => updateField('section', e.target.value)}
                    placeholder="Бүлэг (заавал биш)"
                    className="h-7 w-40 text-xs"
                />
            </div>
        </div>
    );
}
