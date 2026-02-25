'use client';

import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
    FileText,
    Plus,
    CircleDot,
    CheckSquare,
    Star,
    AlignLeft,
    ToggleLeft,
    Gauge,
    Eye,
    Loader2,
    ClipboardList,
    Trash2,
    User,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
    SurveyTemplate,
    SurveyQuestion,
    SURVEY_TYPE_LABELS,
    QUESTION_TYPE_LABELS,
    QuestionType,
} from '../types';

const QUESTION_ICON_MAP: Record<QuestionType, React.ElementType> = {
    single_choice: CircleDot,
    multiple_choice: CheckSquare,
    rating: Star,
    text: AlignLeft,
    yes_no: ToggleLeft,
    nps: Gauge,
};

export interface TemplateItem {
    id: string;
    title: string;
    description: string;
    category: string;
    isSystem: boolean;
    questions: Omit<SurveyQuestion, 'id'>[];
}

interface SurveyTemplateListProps {
    templates: TemplateItem[];
    isLoading: boolean;
    onUseTemplate: (template: TemplateItem) => Promise<void>;
    onDeleteTemplate?: (templateId: string) => Promise<void>;
}

export function SurveyTemplateList({ templates, isLoading, onUseTemplate, onDeleteTemplate }: SurveyTemplateListProps) {
    const [previewTemplate, setPreviewTemplate] = useState<TemplateItem | null>(null);
    const [creatingId, setCreatingId] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const handleUse = async (template: TemplateItem) => {
        setCreatingId(template.id);
        try {
            await onUseTemplate(template);
        } finally {
            setCreatingId(null);
        }
    };

    const handleDelete = async (template: TemplateItem) => {
        if (!onDeleteTemplate || template.isSystem) return;
        if (!confirm(`"${template.title}" загварыг устгах уу?`)) return;
        setDeletingId(template.id);
        try {
            await onDeleteTemplate(template.id);
        } finally {
            setDeletingId(null);
        }
    };

    const systemTemplates = templates.filter(t => t.isSystem);
    const customTemplates = templates.filter(t => !t.isSystem);

    if (isLoading) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                    <Card key={i}>
                        <CardContent className="p-5">
                            <Skeleton className="h-5 w-3/4 mb-2" />
                            <Skeleton className="h-4 w-full mb-1" />
                            <Skeleton className="h-4 w-2/3 mb-4" />
                            <div className="flex gap-1 mb-4">
                                <Skeleton className="h-5 w-16" />
                                <Skeleton className="h-5 w-12" />
                            </div>
                            <Skeleton className="h-8 w-full" />
                        </CardContent>
                    </Card>
                ))}
            </div>
        );
    }

    if (templates.length === 0) {
        return (
            <Card>
                <CardContent className="flex flex-col items-center text-center py-16">
                    <FileText className="h-10 w-10 text-muted-foreground/50 mb-3" />
                    <p className="text-sm text-muted-foreground">
                        Загвар олдсонгүй
                    </p>
                </CardContent>
            </Card>
        );
    }

    const renderTemplateCard = (template: TemplateItem) => {
        const isCreating = creatingId === template.id;
        const isDeleting = deletingId === template.id;
        const questionTypes = [...new Set(template.questions.map(q => q.type))];
        return (
            <Card key={template.id} className={cn(
                "group hover:shadow-md transition-all hover:border-primary/20",
                isDeleting && "opacity-50 pointer-events-none"
            )}>
                <CardContent className="p-5 flex flex-col h-full">
                    <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="min-w-0 flex-1">
                            <h3 className="font-medium text-sm leading-snug">{template.title}</h3>
                        </div>
                        {template.isSystem ? (
                            <Badge variant="outline" className="text-[10px] flex-shrink-0 bg-blue-50 text-blue-600 border-blue-200">
                                Системийн
                            </Badge>
                        ) : (
                            <Badge variant="outline" className="text-[10px] flex-shrink-0 bg-violet-50 text-violet-600 border-violet-200">
                                <User className="h-2.5 w-2.5 mr-0.5" />
                                Өөрийн
                            </Badge>
                        )}
                    </div>

                    <p className="text-xs text-muted-foreground line-clamp-2 mb-3 leading-relaxed">
                        {template.description}
                    </p>

                    <div className="flex items-center gap-2 mb-3">
                        <Badge variant="secondary" className="text-[10px]">
                            {SURVEY_TYPE_LABELS[template.category as keyof typeof SURVEY_TYPE_LABELS] || template.category}
                        </Badge>
                        <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                            <ClipboardList className="h-3 w-3" />
                            {template.questions.length} асуулт
                        </span>
                    </div>

                    <div className="flex items-center gap-1 mb-4">
                        {questionTypes.map(type => {
                            const Icon = QUESTION_ICON_MAP[type as QuestionType];
                            if (!Icon) return null;
                            return (
                                <div
                                    key={type}
                                    className="w-6 h-6 rounded bg-muted flex items-center justify-center"
                                    title={QUESTION_TYPE_LABELS[type as QuestionType]}
                                >
                                    <Icon className="h-3 w-3 text-muted-foreground" />
                                </div>
                            );
                        })}
                    </div>

                    <div className="flex items-center gap-2 mt-auto pt-2 border-t">
                        <Button
                            size="sm"
                            variant="ghost"
                            className="text-xs"
                            onClick={() => setPreviewTemplate(template)}
                        >
                            <Eye className="h-3.5 w-3.5 mr-1" />
                            Харах
                        </Button>
                        {!template.isSystem && onDeleteTemplate && (
                            <Button
                                size="sm"
                                variant="ghost"
                                className="text-xs text-destructive hover:text-destructive"
                                onClick={() => handleDelete(template)}
                                disabled={isDeleting}
                            >
                                <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                        )}
                        <Button
                            size="sm"
                            className="flex-1 text-xs"
                            onClick={() => handleUse(template)}
                            disabled={isCreating}
                        >
                            {isCreating
                                ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                                : <Plus className="h-3.5 w-3.5 mr-1" />
                            }
                            Ашиглах
                        </Button>
                    </div>
                </CardContent>
            </Card>
        );
    };

    return (
        <>
            <div className="space-y-6">
                {customTemplates.length > 0 && (
                    <div>
                        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                            Өөрийн загварууд ({customTemplates.length})
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {customTemplates.map(renderTemplateCard)}
                        </div>
                    </div>
                )}

                <div>
                    {customTemplates.length > 0 && (
                        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                            Системийн загварууд ({systemTemplates.length})
                        </h3>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {systemTemplates.map(renderTemplateCard)}
                    </div>
                </div>
            </div>

            <Dialog open={!!previewTemplate} onOpenChange={() => setPreviewTemplate(null)}>
                <DialogContent className="sm:max-w-lg max-h-[80vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle className="text-base">{previewTemplate?.title}</DialogTitle>
                        <DialogDescription>{previewTemplate?.description}</DialogDescription>
                    </DialogHeader>
                    <ScrollArea className="flex-1 -mx-6 px-6">
                        <div className="space-y-3 py-2">
                            {previewTemplate?.questions.map((q, idx) => {
                                const Icon = QUESTION_ICON_MAP[q.type as QuestionType] || FileText;
                                return (
                                    <div key={idx} className="flex items-start gap-3 p-3 rounded-lg border">
                                        <div className="w-7 h-7 rounded-md bg-muted flex items-center justify-center flex-shrink-0 mt-0.5">
                                            <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-start justify-between gap-2">
                                                <p className="text-sm font-medium leading-snug">
                                                    <span className="text-muted-foreground mr-1">{idx + 1}.</span>
                                                    {q.text}
                                                </p>
                                                {q.isRequired && (
                                                    <span className="text-destructive text-xs flex-shrink-0">*</span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className="text-[10px] text-muted-foreground">
                                                    {QUESTION_TYPE_LABELS[q.type as QuestionType]}
                                                </span>
                                                {q.section && (
                                                    <>
                                                        <span className="text-muted-foreground/30">•</span>
                                                        <span className="text-[10px] text-muted-foreground">{q.section}</span>
                                                    </>
                                                )}
                                            </div>
                                            {q.options && q.options.length > 0 && (
                                                <div className="flex flex-wrap gap-1 mt-1.5">
                                                    {q.options.map((opt, oi) => (
                                                        <Badge key={oi} variant="outline" className="text-[10px] font-normal">
                                                            {opt}
                                                        </Badge>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </ScrollArea>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setPreviewTemplate(null)}>
                            Хаах
                        </Button>
                        <Button
                            onClick={() => {
                                if (previewTemplate) {
                                    setPreviewTemplate(null);
                                    handleUse(previewTemplate);
                                }
                            }}
                            disabled={!!creatingId}
                        >
                            {creatingId
                                ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                                : <Plus className="h-3.5 w-3.5 mr-1" />
                            }
                            Ашиглах
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
