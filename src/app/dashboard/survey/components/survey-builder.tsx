'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    Plus,
    CircleDot,
    CheckSquare,
    Star,
    AlignLeft,
    ToggleLeft,
    Gauge,
} from 'lucide-react';
import { QuestionEditor } from './question-editor';
import {
    QuestionType,
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

interface SurveyBuilderProps {
    questions: SurveyQuestion[];
    onChange: (questions: SurveyQuestion[]) => void;
}

function generateId() {
    return `q_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function createDefaultQuestion(type: QuestionType, order: number): SurveyQuestion {
    const base: SurveyQuestion = {
        id: generateId(),
        type,
        text: '',
        isRequired: true,
        order,
    };

    switch (type) {
        case 'single_choice':
        case 'multiple_choice':
            base.options = ['Сонголт 1', 'Сонголт 2'];
            break;
        case 'rating':
            base.ratingMax = 5;
            base.ratingLabels = { min: 'Маш муу', max: 'Маш сайн' };
            break;
    }

    return base;
}

export function SurveyBuilder({ questions, onChange }: SurveyBuilderProps) {
    const addQuestion = (type: QuestionType) => {
        const newQ = createDefaultQuestion(type, questions.length);
        onChange([...questions, newQ]);
    };

    const updateQuestion = (index: number, updated: SurveyQuestion) => {
        const newList = [...questions];
        newList[index] = updated;
        onChange(newList);
    };

    const deleteQuestion = (index: number) => {
        const newList = questions.filter((_, i) => i !== index);
        newList.forEach((q, i) => (q.order = i));
        onChange(newList);
    };

    return (
        <div className="space-y-4">
            {questions.length === 0 && (
                <div className="text-center py-12 border-2 border-dashed rounded-xl">
                    <p className="text-sm text-muted-foreground mb-3">
                        Асуулт нэмэгдээгүй байна. Доорх товч дарж асуулт нэмнэ үү.
                    </p>
                </div>
            )}

            {questions.map((q, idx) => (
                <QuestionEditor
                    key={q.id}
                    question={q}
                    index={idx}
                    onChange={(updated) => updateQuestion(idx, updated)}
                    onDelete={() => deleteQuestion(idx)}
                />
            ))}

            <div className="flex justify-center pt-2">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm">
                            <Plus className="h-4 w-4 mr-1.5" />
                            Асуулт нэмэх
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="center" className="w-52">
                        {(Object.keys(QUESTION_TYPE_LABELS) as QuestionType[]).map(type => {
                            const Icon = QUESTION_TYPE_ICON_MAP[type];
                            return (
                                <DropdownMenuItem key={type} onClick={() => addQuestion(type)}>
                                    <Icon className="h-4 w-4 mr-2" />
                                    {QUESTION_TYPE_LABELS[type]}
                                </DropdownMenuItem>
                            );
                        })}
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </div>
    );
}
