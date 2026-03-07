'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { VerticalTabMenu } from '@/components/ui/vertical-tab-menu';
import { Plus, Trash2, Pencil, Info, LogOut, ClipboardList, Calculator, MessageSquare } from 'lucide-react';
import { useFirebase, useDoc, useMemoFirebase, useCollection, tenantCollection, tenantDoc, useTenantWrite } from '@/firebase';
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
import Link from 'next/link';
import { PageHeader } from '@/components/patterns/page-layout';

interface OffboardingTask {
  id: string;
  title: string;
  description?: string;
  policyId?: string;
}

interface OffboardingStage {
  id: string;
  title: string;
  description: string;
  icon: string;
  tasks: OffboardingTask[];
}

const DEFAULT_STAGES: OffboardingStage[] = [
  {
    id: 'exit-initiation',
    title: 'Ажлаас гарах шийдвэр, мэдэгдлийн үе',
    description: 'Ажилтны хүсэлт эсвэл байгууллагын шийдвэр. Албан ёсны мэдэгдэл, баримтжуулалт.',
    icon: 'LogOut',
    tasks: [
      { id: '1', title: 'Ажлаас гарах өргөдөл/мэдэгдэл хүлээн авах', description: 'Ажилтны өргөдөл эсвэл компанийн мэдэгдэл бүртгэх' },
      { id: '2', title: 'Чөлөөлөх үндэслэл тодорхойлох', description: 'Өөрийн хүсэлт, компанийн санаачилга эсвэл бусад шалтгаан' },
      { id: '3', title: 'Сүүлийн ажлын өдөр тогтоох', description: 'Хөдөлмөрийн хуулийн дагуу мэдэгдлийн хугацаа тооцох' },
      { id: '4', title: 'Холбогдох талуудад мэдэгдэх', description: 'Удирдлага, хүний нөөцийн хэлтэст мэдэгдэх' }
    ]
  },
  {
    id: 'knowledge-handover',
    title: 'Ажлын хүлээлцэх, шилжилтийн үе',
    description: 'Ажлын үүрэг, файл, харилцагч шилжүүлэх. Орлох хүний бэлтгэл.',
    icon: 'ClipboardList',
    tasks: [
      { id: '5', title: 'Ажлын үүргийн жагсаалт гаргах', description: 'Одоогийн хариуцаж буй бүх ажлуудыг жагсаах' },
      { id: '6', title: 'Шилжүүлэх ажлуудыг хуваарилах', description: 'Ажил бүрийг хэнд шилжүүлэхийг тодорхойлох' },
      { id: '7', title: 'Баримт бичиг, файлуудыг шилжүүлэх', description: 'Чухал баримт бичгүүдийг зохих газарт хадгалах' },
      { id: '8', title: 'Харилцагч, түншүүдийг танилцуулах', description: 'Гадаад харилцагчдыг орлох хүнд танилцуулах' },
      { id: '9', title: 'Мэдлэгийн баримтжуулалт', description: 'Чухал процесс, мэдлэгийг бичиж үлдээх' }
    ]
  },
  {
    id: 'formal-separation',
    title: 'Албан ёсны хаалт, эцсийн тооцооны үе',
    description: 'Системийн эрх хаах, эд хөрөнгө буцаах, эцсийн цалин тооцох.',
    icon: 'Calculator',
    tasks: [
      { id: '10', title: 'Системийн эрхүүд хаах', description: 'И-мэйл, дотоод системүүдийн эрх хүчингүй болгох' },
      { id: '11', title: 'Эд хөрөнгө буцаах', description: 'Компьютер, утас, түлхүүр, карт гэх мэт' },
      { id: '12', title: 'Эцсийн цалин тооцох', description: 'Цалин, урамшуулал, нөхөн олговор тооцоолох' },
      { id: '13', title: 'Ашиглаагүй амралт тооцох', description: 'Үлдсэн амралтын өдрийн тооцоо' },
      { id: '14', title: 'Ажлаас чөлөөлсөн тушаал гаргах', description: 'Албан ёсны чөлөөлөх тушаал бэлтгэх' }
    ]
  },
  {
    id: 'exit-review',
    title: 'Exit үнэлгээ, харилцаа хадгалах үе',
    description: 'Гарах ярилцлага, сэтгэл ханамж шинжилгээ, Alumni сүлжээ.',
    icon: 'MessageSquare',
    tasks: [
      { id: '15', title: 'Exit interview хийх', description: 'Ажлаас гарах ярилцлага зохион байгуулах' },
      { id: '16', title: 'Сэтгэл ханамж, шалтгааны судалгаа', description: 'Гарах шийдвэрийн шалтгааныг судлах' },
      { id: '17', title: 'Тодорхойлолт бэлтгэх', description: 'Ажилтанд ажил байдлын тодорхойлолт олгох' },
      { id: '18', title: 'Баяртай, талархал илэрхийлэх', description: 'Ажилтны хувь нэмрийг үнэлж талархах' },
      { id: '19', title: 'Alumni сүлжээнд бүртгэх', description: 'Шаардлагатай бол alumni програмд нэмэх' }
    ]
  }
];

const STAGE_ICONS: Record<string, React.ElementType> = {
  'LogOut': LogOut,
  'ClipboardList': ClipboardList,
  'Calculator': Calculator,
  'MessageSquare': MessageSquare,
};

export default function OffboardingSettingsPage() {
  const { firestore } = useFirebase();
  const { tDoc } = useTenantWrite();
  const { toast } = useToast();

  const configRef = useMemoFirebase(({ firestore, companyPath }) => (firestore ? tenantDoc(firestore, companyPath, 'settings', 'offboarding') : null), [firestore]);
  const { data: config, isLoading } = useDoc<any>(configRef as any);

  // Fetch policies for selection
  const policiesQuery = useMemoFirebase(({ firestore, companyPath }) =>
    (firestore ? query(tenantCollection(firestore, companyPath, 'companyPolicies'), orderBy('title', 'asc')) : null),
    [firestore]);
  const { data: policies } = useCollection<any>(policiesQuery);

  const [stages, setStages] = useState<OffboardingStage[]>(DEFAULT_STAGES);
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
    } else if (config === null && firestore) {
      setDoc(tDoc('settings', 'offboarding'), { stages: DEFAULT_STAGES })
        .catch((err) => console.error('Failed to initialize default offboarding stages:', err));
    }
  }, [config, firestore]);

  const handleSaveConfig = async (newStages: OffboardingStage[]) => {
    if (!firestore) return;
    try {
      await setDoc(tDoc('settings', 'offboarding'), { stages: newStages });
      toast({
        title: 'Амжилттай хадгалагдлаа',
        description: 'Ажлаас чөлөөлөх хөтөлбөрийн тохиргоог шинэчиллээ.'
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

  const editTask = (stageId: string, task: OffboardingTask) => {
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
      if (s.id === stageId) return { ...s, tasks: s.tasks.filter(t => t.id !== taskId) };
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
      if (s.id !== editingTask.stageId) return s;
      let newTasks = [...s.tasks];
      if (editingTask.taskId) {
        newTasks = newTasks.map(t => t.id === editingTask.taskId ? {
          ...t,
          title: editingTask.title,
          description: editingTask.description,
          policyId: editingTask.policyId
        } : t);
      } else {
        newTasks.push({
          id: Math.random().toString(36).substr(2, 9),
          title: editingTask.title,
          description: editingTask.description,
          policyId: editingTask.policyId
        });
      }
      return { ...s, tasks: newTasks };
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
        title="Ажлаас чөлөөлөх (Offboarding) - Тохиргоо"
        description="4 үе шат бүхий ажлаас чөлөөлөх процессын таскуудыг удирдах."
        showBackButton
        backHref="/dashboard/offboarding"
        actions={
          <Button asChild variant="outline" className="bg-white hover:bg-slate-50 border-slate-200">
            <Link href="/dashboard/offboarding">
              Буцах
            </Link>
          </Button>
        }
      />

      <Alert className="bg-rose-50 border-rose-100 text-rose-800">
        <Info className="h-4 w-4 text-rose-600" />
        <AlertTitle className="font-bold">Мэдээлэл</AlertTitle>
        <AlertDescription className="text-sm">
          Энд тохируулсан таскууд нь ажлаас гарч буй бүх ажилчдад автоматаар үүсэх болно.
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

        {stages.map(stage => {
          const IconComponent = STAGE_ICONS[stage.icon] || LogOut;
          return (
            <TabsContent key={stage.id} value={stage.id} className="mt-6 space-y-6">
              <Card className="shadow-premium border-slate-200/60 overflow-hidden">
                <CardHeader className="border-b bg-slate-50/50 dark:bg-slate-800/50">
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <IconComponent className="h-5 w-5 text-rose-600" />
                        <CardTitle className="text-xl font-bold text-slate-800 dark:text-slate-100">{stage.title}</CardTitle>
                      </div>
                      <CardDescription>{stage.description}</CardDescription>
                    </div>
                    <Button onClick={() => addTask(stage.id)} size="sm" className="bg-rose-600 hover:bg-rose-700">
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
                          <div className="h-8 w-8 rounded-lg bg-slate-100 flex items-center justify-center text-sm font-bold text-slate-600">
                            {idx + 1}
                          </div>
                          <div className="flex-1 space-y-1">
                            <div className="flex items-center justify-between gap-3">
                              <div className="font-bold text-slate-800 flex items-center gap-2">
                                {task.title}
                                {task.policyId && <Badge variant="outline" className="text-[10px]">Policy</Badge>}
                              </div>
                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => editTask(stage.id, task)}>
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-rose-600" onClick={() => deleteTask(stage.id, task.id)}>
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                            {task.description && <div className="text-sm text-muted-foreground">{task.description}</div>}
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

      {/* Edit/Create Task Modal */}
      {editingTask && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-lg border-none shadow-2xl rounded-3xl overflow-hidden">
            <CardHeader className="border-b bg-slate-50/50">
              <CardTitle className="text-lg font-bold">
                {editingTask.taskId ? 'Таск засах' : 'Таск нэмэх'}
              </CardTitle>
              <CardDescription>Offboarding таскны мэдээллийг оруулна уу.</CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="space-y-2">
                <Label>Гарчиг</Label>
                <Input value={editingTask.title} onChange={(e) => setEditingTask({ ...editingTask, title: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Тайлбар</Label>
                <Input value={editingTask.description} onChange={(e) => setEditingTask({ ...editingTask, description: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Холбогдох бодлого (optional)</Label>
                <Select
                  value={editingTask.policyId || '__none__'}
                  onValueChange={(val) => setEditingTask({ ...editingTask, policyId: val === '__none__' ? undefined : val })}
                >
                  <SelectTrigger className={cn("bg-white", !editingTask.policyId && "text-muted-foreground")}>
                    <SelectValue placeholder="Сонгох..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Сонгоогүй</SelectItem>
                    {(policies || []).map((p: any) => (
                      <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setEditingTask(null)}>Болих</Button>
                <Button className="bg-rose-600 hover:bg-rose-700" onClick={saveTask}>Хадгалах</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

