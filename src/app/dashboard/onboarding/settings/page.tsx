'use client';

import React, { useState, useEffect } from 'react';
import { PageHeader } from '@/components/patterns/page-layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { VerticalTabMenu } from '@/components/ui/vertical-tab-menu';
import { Plus, Trash2, Pencil, Check, X, GripVertical, Info, FileText } from 'lucide-react';
import { useFirebase, useFetchDoc, useMemoFirebase, useCollection, tenantCollection, tenantDoc, useTenantWrite } from '@/firebase';
import { setDoc, query, orderBy } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from '@/components/ui/badge';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

interface OnboardingTask {
    id: string;
    title: string;
    description?: string;
    policyId?: string;
}

interface OnboardingStage {
    id: string;
    title: string;
    description: string;
    tasks: OnboardingTask[];
}

const DEFAULT_STAGES: OnboardingStage[] = [
    {
        id: 'pre-onboarding',
        title: 'Урьдчилсан бэлтгэл үе',
        description: 'Ажил эхлэхээс өмнөх шат. Гэрээ, систем, хүлээлт.',
        tasks: [
            { id: '1', title: 'Гэрээ, бичиг баримт бүрдүүлэх', description: 'Хөдөлмөрийн гэрээ болон нууцын гэрээ байгуулах' },
            { id: '2', title: 'Системийн бэлтгэл', description: 'И-мэйл, дотоод системүүдийн эрх нээх' },
            { id: '3', title: 'Ажилтны хүлээлтийг уялдуулах', description: 'Ажлын байрны тодорхойлолт, хүлээлттэй танилцуулах' }
        ]
    },
    {
        id: 'orientation',
        title: 'Дасан зохицох, танилцах үе',
        description: 'Эхний өдөр, эхний долоо хоног. Соёл, баг, журам.',
        tasks: [
            { id: '4', title: 'Байгууллага, соёл, журамтай танилцах', description: 'Дотоод журам, компанийн үнэт зүйлстэй танилцах' },
            { id: '5', title: 'Баг, удирдлагатай танилцах', description: 'Багийн гишүүд болон шууд удирдлагатай уулзалт хийх' }
        ]
    },
    {
        id: 'integration',
        title: 'Ажлын үүрэгт уусах үе',
        description: '30–60 хоног. KPI, бодит ажлууд, дэмжлэг.',
        tasks: [
            { id: '6', title: 'Ажлын үүрэг, KPI тодорхой болох', description: 'Эхний сарын KPI/OKR-ыг баталгаажуулах' },
            { id: '7', title: 'Эхний бодит ажлууд', description: 'Бие даан гүйцэтгэх анхны төсөл/даалгавар дээр ажиллах' },
            { id: '8', title: 'Ментор, удирдлагын дэмжлэг', description: 'Тогтмол 1:1 уулзалт хийж, эргэх холбоо авах' }
        ]
    },
    {
        id: 'productivity',
        title: 'Тогтворжилт, бүтээмжийн үе',
        description: '60–90 хоног. Бүтээмж, үнэлгээ, тууштай байдал.',
        tasks: [
            { id: '9', title: 'Бүтээмжид бүрэн хүрэх', description: 'Ажлын байрны зорилтуудыг бие даан биелүүлж эхлэх' },
            { id: '10', title: 'Анхны гүйцэтгэлийн үнэлгээ', description: 'Туршилтын хугацааны үнэлгээ хийх' },
            { id: '11', title: 'Байгууллагад тууштай үлдэх шийдвэр', description: 'Цаашид хамтран ажиллах шийдвэр гаргах' }
        ]
    }
];

export default function OnboardingSettingsPage() {
    const { firestore } = useFirebase();
    const { tDoc } = useTenantWrite();
    const { toast } = useToast();
    const configRef = useMemoFirebase(({ firestore, companyPath }) => (firestore ? tenantDoc(firestore, companyPath, 'settings', 'onboarding') : null), [firestore]);
    const { data: config, isLoading } = useFetchDoc<any>(configRef as any);

    // Fetch policies for selection
    const policiesQuery = useMemoFirebase(({ firestore, companyPath }) =>
        (firestore ? query(tenantCollection(firestore, companyPath, 'companyPolicies'), orderBy('title', 'asc')) : null),
        [firestore]);
    const { data: policies } = useCollection<any>(policiesQuery);

    const [stages, setStages] = useState<OnboardingStage[]>(DEFAULT_STAGES);
    const [editingTask, setEditingTask] = useState<{
        stageId: string;
        taskId: string | null;
        title: string;
        description: string;
        policyId?: string;
    } | null>(null);

    useEffect(() => {
        if (config && config.stages) {
            setStages(config.stages);
        }
    }, [config]);

    const handleSaveConfig = async (newStages: OnboardingStage[]) => {
        if (!firestore) return;
        try {
            await setDoc(tDoc('settings', 'onboarding'), { stages: newStages });
            toast({
                title: 'Амжилттай хадгалагдлаа',
                description: 'Чиглүүлэх хөтөлбөрийн тохиргоог шинэчиллээ.'
            });
        } catch (error) {
            toast({
                title: 'Алдаа гарлаа',
                description: 'Тохиргоог хадгалахад алдаа гарлаа.',
                variant: 'destructive'
            });
        }
    };

    const addTask = (stageId: string) => {
        setEditingTask({ stageId, taskId: null, title: '', description: '', policyId: undefined });
    };

    const editTask = (stageId: string, task: OnboardingTask) => {
        setEditingTask({
            stageId,
            taskId: task.id,
            title: task.title,
            description: task.description || '',
            policyId: task.policyId
        });
    };

    const deleteTask = (stageId: string, taskId: string) => {
        const newStages = stages.map(s => {
            if (s.id === stageId) {
                return { ...s, tasks: s.tasks.filter(t => t.id !== taskId) };
            }
            return s;
        });
        setStages(newStages);
        handleSaveConfig(newStages);
    };

    const saveTask = () => {
        if (!editingTask) return;
        if (!editingTask.title.trim()) {
            toast({ title: 'Гарчиг оруулах шаардлагатай', variant: 'destructive' });
            return;
        }

        const newStages = stages.map(s => {
            if (s.id === editingTask.stageId) {
                let newTasks = [...s.tasks];
                if (editingTask.taskId) {
                    // Edit
                    newTasks = newTasks.map(t => t.id === editingTask.taskId ? {
                        ...t,
                        title: editingTask.title,
                        description: editingTask.description,
                        policyId: editingTask.policyId
                    } : t);
                } else {
                    // Add
                    newTasks.push({
                        id: Math.random().toString(36).substr(2, 9),
                        title: editingTask.title,
                        description: editingTask.description,
                        policyId: editingTask.policyId
                    });
                }
                return { ...s, tasks: newTasks };
            }
            return s;
        });

        setStages(newStages);
        handleSaveConfig(newStages);
        setEditingTask(null);
    };

    if (isLoading) {
        return <div className="p-8 text-center animate-pulse">Ачаалж байна...</div>;
    }

    return (
        <div className="py-6 px-4 sm:px-6 min-h-screen container mx-auto max-w-7xl space-y-6">
            <PageHeader
                title="Чиглүүлэх хөтөлбөр тохиргоо"
                description="4 үе шат бүхий дасан зохицох хөтөлбөрийн таскуудыг удирдах"
                showBackButton
                backHref="/dashboard/onboarding"
            />

            <Alert className="bg-blue-50 border-blue-100 text-blue-800">
                <Info className="h-4 w-4 text-blue-600" />
                <AlertTitle className="font-bold">Мэдээлэл</AlertTitle>
                <AlertDescription className="text-sm">
                    Энд тохируулсан таскууд нь шинээр ажилд орж буй бүх ажилчдад автоматаар үүсэх болно.
                </AlertDescription>
            </Alert>

            <Tabs defaultValue={stages[0]?.id} className="w-full">
                <div className="flex overflow-x-auto pb-2 scrollbar-hide">
                    <VerticalTabMenu
                        orientation="horizontal"
                        className="flex-nowrap"
                        items={stages.map((stage, idx) => ({
                            value: stage.id,
                            label: `${idx + 1}. ${stage.title} (${stage.tasks.length})`,
                        }))}
                    />
                </div>

                {stages.map(stage => (
                    <TabsContent key={stage.id} value={stage.id} className="mt-6 space-y-6">
                        <Card className="border-none shadow-sm bg-white dark:bg-slate-900 rounded-2xl overflow-hidden">
                            <CardHeader className="border-b bg-slate-50/50 dark:bg-slate-800/50">
                                <div className="flex justify-between items-start">
                                    <div className="space-y-1">
                                        <CardTitle className="text-xl font-bold text-slate-800 dark:text-slate-100">{stage.title}</CardTitle>
                                        <CardDescription>{stage.description}</CardDescription>
                                    </div>
                                    <Button onClick={() => addTask(stage.id)} size="sm" className="bg-indigo-600 hover:bg-indigo-700">
                                        <Plus className="h-4 w-4 mr-2" /> Таск нэмэх
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent className="p-6">
                                <div className="space-y-4">
                                    {stage.tasks.length === 0 ? (
                                        <div className="py-12 text-center border-2 border-dashed rounded-2xl border-slate-100 text-slate-400">
                                            Таск нэмээгүй байна.
                                        </div>
                                    ) : (
                                        stage.tasks.map((task, idx) => (
                                            <div
                                                key={task.id}
                                                className="group flex items-start gap-4 p-4 rounded-xl border border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all"
                                            >
                                                <div className="h-8 w-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 font-bold text-slate-500 text-xs">
                                                    {idx + 1}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <h4 className="font-bold text-slate-700 dark:text-slate-200 text-sm mb-1">{task.title}</h4>
                                                    {task.description && <p className="text-xs text-slate-500 line-clamp-2">{task.description}</p>}
                                                    {task.policyId && (
                                                        <div className="mt-1 flex items-center gap-1">
                                                            <Badge variant="outline" className="text-[10px] gap-1 px-1.5 py-0 h-5 font-medium text-emerald-600 border-emerald-200 bg-emerald-50">
                                                                <FileText className="h-2.5 w-2.5" />
                                                                {policies?.find(p => p.id === task.policyId)?.title || 'Холбоотой журам'}
                                                            </Badge>
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-indigo-600" onClick={() => editTask(stage.id, task)}>
                                                        <Pencil className="h-4 w-4" />
                                                    </Button>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-600" onClick={() => deleteTask(stage.id, task.id)}>
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>
                ))}
            </Tabs>

            {editingTask && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <Card className="w-full max-w-md shadow-2xl rounded-2xl border-none">
                        <CardHeader>
                            <CardTitle>{editingTask.taskId ? 'Таск засах' : 'Шинэ таск нэмэх'}</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="task-title">Таскын нэр</Label>
                                <Input
                                    id="task-title"
                                    value={editingTask.title}
                                    onChange={e => setEditingTask({ ...editingTask, title: e.target.value })}
                                    placeholder="Жишээ: Гэрээ байгуулах"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="task-desc">Тайлбар (заавал биш)</Label>
                                <Input
                                    id="task-desc"
                                    value={editingTask.description}
                                    onChange={e => setEditingTask({ ...editingTask, description: e.target.value })}
                                    placeholder="Жишээ: Хөдөлмөрийн гэрээ болон нууцын гэрээ..."
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>Холбоотой журам (Сонгох шаардлагагүй)</Label>
                                <Select
                                    value={editingTask.policyId || "none"}
                                    onValueChange={(val) => setEditingTask({ ...editingTask, policyId: val === "none" ? undefined : val })}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Журам сонгох..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none" className="text-slate-500 italic">Журам сонгохгүй</SelectItem>
                                        {policies?.map((policy: any) => (
                                            <SelectItem key={policy.id} value={policy.id}>
                                                {policy.title}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="flex gap-3 pt-4">
                                <Button variant="outline" className="flex-1" onClick={() => setEditingTask(null)}>Цуцлах</Button>
                                <Button className="flex-1 bg-indigo-600 hover:bg-indigo-700" onClick={saveTask}>Хадгалах</Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
}
