'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { VerticalTabMenu } from '@/components/ui/vertical-tab-menu';
import { Plus, Trash2, Pencil, Info, FileText, Briefcase, Monitor, KeyRound, CheckCircle2 } from 'lucide-react';
import { useFirebase, useDoc, useMemoFirebase, tenantDoc, useTenantWrite } from '@/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from '@/components/ui/badge';
import { AddActionButton } from '@/components/ui/add-action-button';

interface PrepTask {
  id: string;
  title: string;
  description?: string;
  policyId?: string;
}

interface PrepStage {
  id: string;
  title: string;
  description: string;
  icon: string;
  tasks: PrepTask[];
}

const DEFAULT_STAGES: PrepStage[] = [
  {
    id: 'workspace',
    title: 'Ажлын орчин бэлтгэх',
    description: 'Ажлын байр, тоног төхөөрөмж, суудал, хэрэгсэл.',
    icon: 'Briefcase',
    tasks: [
      { id: '1', title: 'Суудал, ажлын байр бэлтгэх', description: 'Ажлын ширээ, сандал, ажлын орон зай' },
      { id: '2', title: 'Тоног төхөөрөмж бэлтгэх', description: 'Компьютер, утас, дагалдах хэрэгсэл' },
    ],
  },
  {
    id: 'access',
    title: 'Системийн эрх, нэвтрэлт',
    description: 'И-мэйл, дотоод системүүд, эрхүүдийг бэлтгэх.',
    icon: 'KeyRound',
    tasks: [
      { id: '3', title: 'И-мэйл нээх', description: 'Компанийн и-мэйл аккаунт үүсгэх' },
      { id: '4', title: 'Системийн эрхүүд олгох', description: 'ERP/HR/CRM болон бусад системүүдийн эрх' },
    ],
  },
  {
    id: 'materials',
    title: 'Материал, баримт бичиг',
    description: 'АБТ, процесс, дүрэм журам, танилцуулга материалууд.',
    icon: 'FileText',
    tasks: [
      { id: '5', title: 'АБТ/процесс бэлдэх', description: 'Ажлын байрны тодорхойлолт, процессын зураглал' },
      { id: '6', title: 'Танилцуулга материал бэлдэх', description: 'Компанийн танилцуулга, журам, бодлогууд' },
    ],
  },
  {
    id: 'ready',
    title: 'Бэлтгэл баталгаажуулах',
    description: 'Бүх зүйл бэлэн болсон эсэхийг шалгаж баталгаажуулах.',
    icon: 'CheckCircle2',
    tasks: [
      { id: '7', title: 'Бэлтгэл шалгах checklist', description: 'Хэрэгслийн бүрэн бүтэн байдал, эрхүүд, материалууд' },
    ],
  },
];

const STAGE_ICONS: Record<string, React.ElementType> = {
  Briefcase,
  Monitor,
  KeyRound,
  FileText,
  CheckCircle2,
};

export function PositionPreparationSettings() {
  const { firestore } = useFirebase();
  const { tDoc } = useTenantWrite();
  const { toast } = useToast();

  const configRef = useMemoFirebase(({ firestore, companyPath }) => (firestore ? tenantDoc(firestore, companyPath, 'settings', 'positionPreparation') : null), [firestore]);
  const { data: config } = useDoc<any>(configRef as any);

  const [stages, setStages] = useState<PrepStage[]>(DEFAULT_STAGES);
  const [editingTask, setEditingTask] = useState<{
    stageId: string;
    taskId: string | null;
    title: string;
  } | null>(null);

  useEffect(() => {
    if (config?.stages) setStages(config.stages);
  }, [config]);

  const handleSaveConfig = async (newStages: PrepStage[]) => {
    if (!firestore) return;
    try {
      await setDoc(tDoc('settings', 'positionPreparation'), { stages: newStages });
      toast({ title: 'Хадгалагдлаа', description: 'Ажлын байр бэлтгэх тохиргоог шинэчиллээ.' });
    } catch {
      toast({ variant: 'destructive', title: 'Алдаа', description: 'Тохиргоо хадгалахад алдаа гарлаа.' });
    }
  };

  const addTask = (stageId: string) => {
    setEditingTask({ stageId, taskId: null, title: '' });
  };

  const editTask = (stageId: string, task: PrepTask) => {
    setEditingTask({
      stageId,
      taskId: task.id,
      title: task.title,
    });
  };

  const deleteTask = (stageId: string, taskId: string) => {
    const newStages = stages.map((s) => s.id === stageId ? { ...s, tasks: s.tasks.filter(t => t.id !== taskId) } : s);
    setStages(newStages);
    handleSaveConfig(newStages);
  };

  const saveTask = () => {
    if (!editingTask) return;
    if (!editingTask.title.trim()) {
      toast({ variant: 'destructive', title: 'Гарчиг оруулна уу' });
      return;
    }

    const newStages = stages.map((s) => {
      if (s.id !== editingTask.stageId) return s;
      let tasks = [...(s.tasks || [])];
      if (editingTask.taskId) {
        tasks = tasks.map((t) => t.id === editingTask.taskId ? {
          ...t,
          title: editingTask.title,
        } : t);
      } else {
        tasks.push({
          id: Math.random().toString(36).substr(2, 9),
          title: editingTask.title,
        });
      }
      return { ...s, tasks };
    });

    setStages(newStages);
    handleSaveConfig(newStages);
    setEditingTask(null);
  };

  return (
    <div className="space-y-6">
      <Alert className="bg-indigo-50 border-indigo-100 text-indigo-800">
        <Info className="h-4 w-4 text-indigo-600" />
        <AlertTitle className="font-bold">Мэдээлэл</AlertTitle>
        <AlertDescription className="text-sm">
          Энд тохируулсан таскуудыг ажлын байрны дэлгэрэнгүй дээрээс сонгон (огноо + хариуцагч) тохируулж “Бэлтгэл” төсөл үүсгэнэ.
        </AlertDescription>
      </Alert>

      <Tabs defaultValue={stages[0]?.id} className="w-full">
        <div className="flex overflow-x-auto pb-2 scrollbar-hide">
          <VerticalTabMenu
            orientation="horizontal"
            className="flex-nowrap"
            items={stages.map((stage, idx) => ({
              value: stage.id,
              label: `${idx + 1}. ${stage.title} (${(stage.tasks || []).length})`,
            }))}
          />
        </div>

        {stages.map((stage) => {
          const Icon = STAGE_ICONS[stage.icon] || Briefcase;
          return (
            <TabsContent key={stage.id} value={stage.id} className="mt-6 space-y-6">
              <Card className="border-slate-200/60 overflow-hidden">
                <CardHeader className="border-b bg-slate-50/50">
                  <div className="flex justify-between items-start gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Icon className="h-5 w-5 text-indigo-600" />
                        <CardTitle className="text-lg font-bold text-slate-800">{stage.title}</CardTitle>
                      </div>
                      <CardDescription>{stage.description}</CardDescription>
                    </div>
                    <AddActionButton
                      label="Таск нэмэх"
                      description="Автоматаар үүсгэх таск нэр нэмэх"
                      onClick={() => addTask(stage.id)}
                    />
                  </div>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="space-y-3">
                    {(stage.tasks || []).length === 0 ? (
                      <div className="py-10 text-center border-2 border-dashed rounded-2xl border-slate-100 text-slate-400">
                        Таск нэмээгүй байна.
                      </div>
                    ) : (
                      (stage.tasks || []).map((task, idx) => (
                        <div key={task.id} className="group flex items-start gap-4 p-4 rounded-xl border border-slate-100 hover:bg-slate-50 transition-all">
                          <div className="h-8 w-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0 font-bold text-slate-500 text-xs">
                            {idx + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-3">
                              <div className="font-bold text-slate-800 flex items-center gap-2">
                                {task.title}
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
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          );
        })}
      </Tabs>

      {editingTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <Card className="w-full max-w-md shadow-2xl rounded-2xl border-none">
            <CardHeader>
              <CardTitle className="text-lg">{editingTask.taskId ? 'Таск засах' : 'Шинэ таск нэмэх'}</CardTitle>
              <CardDescription>Таск үүсгэхдээ зөвхөн нэр оруулна.</CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="space-y-2">
                <Label>Таск нэр</Label>
                <Input
                  value={editingTask.title}
                  onChange={(e) => setEditingTask({ ...editingTask, title: e.target.value })}
                  placeholder="Ж: И-мэйл нээх"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setEditingTask(null)}>Болих</Button>
                <Button className="bg-indigo-600 hover:bg-indigo-700" onClick={saveTask}>Хадгалах</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

