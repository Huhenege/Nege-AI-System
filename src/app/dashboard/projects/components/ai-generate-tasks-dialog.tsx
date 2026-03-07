'use client';

import * as React from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, Sparkles, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useFirebase, addDocumentNonBlocking, useTenantWrite } from '@/firebase';
import { Timestamp } from 'firebase/firestore';
import { type GeneratedTask } from '@/app/api/generate-project-tasks/route';
import { TaskStatus, Priority } from '@/types/project';
import { format } from 'date-fns';
import { PRIORITY_LABELS } from '@/types/project';

interface AiGenerateTasksDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    projectId: string;
    projectName: string;
    goal: string;
    expectedOutcome: string;
    startDate: string;
    endDate: string;
    onTasksCreated?: () => void;
}

export function AiGenerateTasksDialog({
    open,
    onOpenChange,
    projectId,
    projectName,
    goal,
    expectedOutcome,
    startDate,
    endDate,
    onTasksCreated,
}: AiGenerateTasksDialogProps) {
    const { firestore } = useFirebase();
    const { tCollection } = useTenantWrite();
    const { toast } = useToast();
    const [isGenerating, setIsGenerating] = React.useState(false);
    const [isAdding, setIsAdding] = React.useState(false);
    const [generatedTasks, setGeneratedTasks] = React.useState<GeneratedTask[]>([]);

    const generateTasks = React.useCallback(async () => {
        setIsGenerating(true);
        setGeneratedTasks([]);
        try {
            const res = await fetch('/api/generate-project-tasks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectName,
                    goal,
                    expectedOutcome: expectedOutcome || undefined,
                    startDate: startDate || undefined,
                    endDate: endDate || undefined,
                }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || 'Алдаа гарлаа');
            setGeneratedTasks(json.data.tasks || []);
            if (json.data.tasks?.length === 0) {
                toast({
                    title: 'Анхааруулга',
                    description: 'AI таск олдсонгүй.',
                    variant: 'destructive',
                });
            }
        } catch (err) {
            toast({
                title: 'Алдаа',
                description: err instanceof Error ? err.message : 'Таск үүсгэхэд алдаа гарлаа.',
                variant: 'destructive',
            });
        } finally {
            setIsGenerating(false);
        }
    }, [projectName, goal, expectedOutcome, startDate, endDate, toast]);

    React.useEffect(() => {
        if (open) {
            generateTasks();
        }
    }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleAddAll = async () => {
        if (!generatedTasks.length || !firestore) return;

        setIsAdding(true);
        try {
            const tasksRef = tCollection('projects', projectId, 'tasks');
            for (const t of generatedTasks) {
                await addDocumentNonBlocking(tasksRef, {
                    projectId,
                    title: t.title,
                    dueDate: t.dueDate,
                    priority: t.priority as Priority,
                    status: 'TODO' as TaskStatus,
                    assigneeIds: [],
                    ownerId: null,
                    createdAt: Timestamp.now(),
                    updatedAt: Timestamp.now(),
                });
            }
            toast({
                title: 'Амжилттай',
                description: `${generatedTasks.length} таск нэмэгдлээ.`,
            });
            onTasksCreated?.();
            handleOpenChange(false);
        } catch (err) {
            toast({
                title: 'Алдаа',
                description: 'Таск нэмэхэд алдаа гарлаа.',
                variant: 'destructive',
            });
        } finally {
            setIsAdding(false);
        }
    };

    const removeTask = (index: number) => {
        setGeneratedTasks((prev) => prev.filter((_, i) => i !== index));
    };

    const handleOpenChange = (next: boolean) => {
        if (!next) setGeneratedTasks([]);
        onOpenChange(next);
    };

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-violet-500" />
                        AI таск үүсгэх
                    </DialogTitle>
                    <DialogDescription asChild>
                        <div className="space-y-2">
                            <p>Төслийн зорилго болон хүлээгдэж буй үр дүнд үндэслэн таскууд үүсгэгдсэн. Шалгаад нэмнэ үү.</p>
                            <div className="rounded-lg bg-slate-100 dark:bg-slate-800/50 px-3 py-2 text-xs text-muted-foreground">
                                <p className="font-medium text-slate-600 dark:text-slate-300 mb-1">AI-ийн сургалт</p>
                                <ul className="space-y-0.5 list-disc list-inside">
                                    <li>Суурь: Google Gemini AI</li>
                                    <li>Мэргэжил: OKR (Objectives and Key Results) менежментийн мэргэжилтэн</li>
                                    <li>Ур чадвар: Зорилго, хүлээгдэж буй үр дүнд нийцсэн 5–10 гол Key Result таск үүсгэх</li>
                                </ul>
                            </div>
                        </div>
                    </DialogDescription>
                </DialogHeader>

                <div className="max-h-64 overflow-y-auto space-y-2 py-2">
                    {isGenerating ? (
                        <div className="flex flex-col items-center justify-center py-8 gap-3">
                            <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
                            <p className="text-sm text-muted-foreground">AI таск үүсгэж байна...</p>
                        </div>
                    ) : generatedTasks.length === 0 ? (
                        <div className="text-center py-6 space-y-2">
                            <p className="text-sm text-muted-foreground">Таск үүсгэгдсэнгүй.</p>
                            <Button variant="outline" size="sm" onClick={generateTasks} disabled={isGenerating}>
                                Дахин үүсгэх
                            </Button>
                        </div>
                    ) : (
                        generatedTasks.map((task, i) => (
                            <div
                                key={i}
                                className="flex items-start gap-2 p-3 rounded-lg border bg-slate-50 dark:bg-slate-900/50"
                            >
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium">{task.title}</p>
                                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                                        <span>{PRIORITY_LABELS[task.priority]}</span>
                                        <span>•</span>
                                        <span>{task.dueDate ? format(new Date(task.dueDate), 'yyyy-MM-dd') : '-'}</span>
                                    </div>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                                    onClick={() => removeTask(i)}
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>
                        ))
                    )}
                </div>

                <DialogFooter className="flex-wrap gap-2">
                    <Button variant="outline" onClick={() => handleOpenChange(false)}>
                        Болих
                    </Button>
                    {generatedTasks.length > 0 && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={generateTasks}
                            disabled={isGenerating}
                        >
                            Дахин үүсгэх
                        </Button>
                    )}
                    <Button
                        onClick={handleAddAll}
                        disabled={isAdding || generatedTasks.length === 0}
                        className="bg-violet-600 hover:bg-violet-700"
                    >
                        {isAdding && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {generatedTasks.length} таск нэмэх
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
