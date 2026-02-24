'use client';

import React, { useState, useEffect } from 'react';
import { useFirebase } from '@/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { RecruitmentStage, StageType, MessageTemplate } from '@/types/recruitment';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2, Plus, Trash2, GripVertical, Save, Info, AlertCircle, Mail, MessageSquare, Pencil } from 'lucide-react';
import { AddActionButton } from '@/components/ui/add-action-button';
import { useToast } from '@/hooks/use-toast';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Label } from '@/components/ui/label';

const DEFAULT_STAGES: RecruitmentStage[] = [
    { id: 'screening', title: 'Анкет шүүлт', type: 'SCREENING', order: 0 },
    { id: 'first-interview', title: 'Анхан шатны ярилцлага', type: 'INTERVIEW', order: 1 },
    { id: 'tech-task', title: 'Даалгавар', type: 'CHALLENGE', order: 2 },
    { id: 'final-interview', title: 'Эцсийн ярилцлага', type: 'INTERVIEW', order: 3 },
    { id: 'offer', title: 'Санал тавих', type: 'OFFER', order: 4 },
];

const DEFAULT_CRITERIA = [
    { id: 'technical', name: 'Мэргэжлийн ур чадвад', description: 'Тухайн албан тушаалд шаардагдах техник ур чадвар' },
    { id: 'communication', name: 'Харилцааны ур чадвад', description: 'Өөрийгөө илэрхийлэх, сонсох чадвар' },
    { id: 'culture', name: 'Соёлын нийцэл', description: 'Байгууллагын үнэт зүйлстэй нийцэх байдал' },
    { id: 'experience', name: 'Туршлага', description: 'Өмнөх ажлын туршлага, хийсэн ажлууд' },
];

const DEFAULT_TEMPLATES: MessageTemplate[] = [
    {
        id: 'tpl-1',
        title: 'Ярилцлагын урилга',
        body: 'Сайн байна уу, {{name}}.\n\nБид таныг дараагийн шатны ярилцлагад урьж байна.',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    },
    {
        id: 'tpl-2',
        title: 'Татгалзсан хариу',
        body: 'Сайн байна уу, {{name}}.\n\nСонгон шалгаруулалтад оролцсонд баярлалаа. Харамсалтай нь бид дараагийн шатанд өөр горилогчийг сонгохоор боллоо.',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    }
];

interface SortableStageProps {
    stage: RecruitmentStage;
    onEdit: (stage: RecruitmentStage) => void;
    onDelete: (id: string) => void;
}

function SortableStage({ stage, onEdit, onDelete }: SortableStageProps) {
    const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: stage.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    return (
        <TableRow ref={setNodeRef} style={style}>
            <TableCell className="w-[50px]">
                <Button variant="ghost" size="icon" className="cursor-grab" {...attributes} {...listeners}>
                    <GripVertical className="h-4 w-4 text-muted-foreground" />
                </Button>
            </TableCell>
            <TableCell className="font-medium">{stage.title}</TableCell>
            <TableCell>
                <Badge variant="outline">{stage.type}</Badge>
            </TableCell>
            <TableCell className="text-right space-x-1">
                <Button variant="ghost" size="icon" onClick={() => onEdit(stage)} className="text-slate-400 hover:text-blue-500 hover:bg-blue-50">
                    <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => onDelete(stage.id)} className="text-red-500 hover:text-red-600 hover:bg-red-50">
                    <Trash2 className="h-4 w-4" />
                </Button>
            </TableCell>
        </TableRow>
    );
}

export function RecruitmentSettings() {
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const [stages, setStages] = useState<RecruitmentStage[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [initialState, setInitialState] = useState<{
        stages: RecruitmentStage[],
        criteria: any[],
        templates: MessageTemplate[],
        smsConfig: { token: string, senderId: string }
    } | null>(null);

    // New Stage State
    const [newStageTitle, setNewStageTitle] = useState('');
    const [newStageType, setNewStageType] = useState<StageType>('INTERVIEW');
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);

    // Criteria State
    const [criteria, setCriteria] = useState<{ id: string, name: string, description: string }[]>([]);
    const [newCriterionName, setNewCriterionName] = useState('');
    const [newCriterionDesc, setNewCriterionDesc] = useState('');
    const [isAddCriteriaOpen, setIsAddCriteriaOpen] = useState(false);

    // Templates State
    const [templates, setTemplates] = useState<MessageTemplate[]>([]);
    const [newTemplateTitle, setNewTemplateTitle] = useState('');
    const [newTemplateBody, setNewTemplateBody] = useState('');
    const [isAddTemplateOpen, setIsAddTemplateOpen] = useState(false);

    // SMS Config State
    const [smsConfig, setSmsConfig] = useState({ token: '', senderId: 'MOCEAN' });
    const [testPhone, setTestPhone] = useState('');
    const [testingSms, setTestingSms] = useState(false);
    const [smsEnvConfigured, setSmsEnvConfigured] = useState(false);

    // Edit Stage State
    const [editingStage, setEditingStage] = useState<RecruitmentStage | null>(null);
    const [editStageTitle, setEditStageTitle] = useState('');
    const [editStageType, setEditStageType] = useState<StageType>('INTERVIEW');
    const [isEditStageOpen, setIsEditStageOpen] = useState(false);

    // Edit Criteria State
    const [editingCriterion, setEditingCriterion] = useState<{ id: string, name: string, description: string } | null>(null);
    const [editCriterionName, setEditCriterionName] = useState('');
    const [editCriterionDesc, setEditCriterionDesc] = useState('');
    const [isEditCriteriaOpen, setIsEditCriteriaOpen] = useState(false);

    // Edit Template State
    const [editingTemplate, setEditingTemplate] = useState<MessageTemplate | null>(null);
    const [editTemplateTitle, setEditTemplateTitle] = useState('');
    const [editTemplateBody, setEditTemplateBody] = useState('');
    const [isEditTemplateOpen, setIsEditTemplateOpen] = useState(false);

    // Check if env variable is configured
    useEffect(() => {
        fetch('/api/sms/status')
            .then(r => r.json())
            .then(data => setSmsEnvConfigured(data.envConfigured))
            .catch(() => setSmsEnvConfigured(false));
    }, []);

    const handleTestSms = async () => {
        if (!testPhone.trim()) {
            toast({ title: 'Утасны дугаар оруулна уу', variant: 'destructive' });
            return;
        }
        setTestingSms(true);
        try {
            const res = await fetch('/api/sms', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    to: testPhone.trim(),
                    text: 'HR систем: SMS тест амжилттай! 🎉',
                }),
            });
            const data = await res.json();
            if (res.ok && data.success) {
                toast({ title: 'SMS амжилттай илгээгдлээ', description: `${testPhone} руу тест мессеж илгээлээ.` });
                setTestPhone('');
            } else {
                toast({ title: 'SMS илгээж чадсангүй', description: data.error || data.details || 'Алдаа гарлаа', variant: 'destructive' });
            }
        } catch (err: any) {
            toast({ title: 'Алдаа', description: err.message, variant: 'destructive' });
        } finally {
            setTestingSms(false);
        }
    };

    useEffect(() => {
        const fetchSettings = async () => {
            if (!firestore) return;
            try {
                // Fetch General Settings
                const docRef = doc(firestore, 'recruitment_settings', 'default');
                const docSnap = await getDoc(docRef);

                if (docSnap.exists()) {
                    const fetchedStages = docSnap.data().defaultStages as RecruitmentStage[] || DEFAULT_STAGES;
                    const fetchedCriteria = docSnap.data().defaultCriteria || DEFAULT_CRITERIA;
                    const fetchedTemplates = docSnap.data().messageTemplates as MessageTemplate[] || DEFAULT_TEMPLATES;
                    setStages(fetchedStages);
                    setCriteria(fetchedCriteria);
                    setTemplates(fetchedTemplates);

                    const rawSms = docSnap.data().smsConfig || {};
                    const fetchedSmsConfig = {
                        token: rawSms.token || '',
                        senderId: rawSms.senderId || 'MOCEAN',
                    };
                    setSmsConfig(fetchedSmsConfig);

                    setInitialState({
                        stages: fetchedStages,
                        criteria: fetchedCriteria,
                        templates: fetchedTemplates,
                        smsConfig: fetchedSmsConfig
                    });
                } else {
                    setStages(DEFAULT_STAGES);
                    setCriteria(DEFAULT_CRITERIA);
                    setTemplates(DEFAULT_TEMPLATES);
                    setSmsConfig({ token: '', senderId: 'MOCEAN' });
                    setInitialState({
                        stages: DEFAULT_STAGES,
                        criteria: DEFAULT_CRITERIA,
                        templates: DEFAULT_TEMPLATES,
                        smsConfig: { token: '', senderId: 'MOCEAN' }
                    });
                }
            } catch (error) {
                console.error("Failed to fetch settings:", error);
                setStages(DEFAULT_STAGES);
                setCriteria(DEFAULT_CRITERIA);
            } finally {
                setLoading(false);
            }
        };

        fetchSettings();
    }, [firestore]);

    const handleAddStage = (e?: React.FormEvent) => {
        if (e) e.preventDefault();

        if (!newStageTitle.trim()) {
            toast({
                title: 'Мэдээлэл дутуу',
                description: 'Шатны нэрийг оруулна уу.',
                variant: 'destructive'
            });
            return;
        }

        const newStage: RecruitmentStage = {
            id: `stage-${Date.now()}`,
            title: newStageTitle,
            type: newStageType,
            order: stages.length,
        };

        setStages(prev => [...prev, newStage]);
        setNewStageTitle('');
        setNewStageType('INTERVIEW');
        setIsAddDialogOpen(false);

        toast({
            title: 'Шат нэмэгдлээ',
            description: `"${newStageTitle}" шат жагсаалтад нэмэгдлээ.`,
        });
    };

    const handleDeleteStage = (id: string) => {
        setStages(stages.filter(s => s.id !== id));
    };

    const openEditStage = (stage: RecruitmentStage) => {
        setEditingStage(stage);
        setEditStageTitle(stage.title);
        setEditStageType(stage.type);
        setIsEditStageOpen(true);
    };

    const handleUpdateStage = (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingStage || !editStageTitle.trim()) return;

        setStages(prev => prev.map(s =>
            s.id === editingStage.id
                ? { ...s, title: editStageTitle, type: editStageType }
                : s
        ));

        setIsEditStageOpen(false);
        setEditingStage(null);
        toast({
            title: 'Шат шинэчлэгдлээ',
            description: 'Өөрчлөлт хадгалагдлаа.',
        });
    };

    const handleAddCriterion = (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!newCriterionName.trim()) return;

        const newCriterion = {
            id: `crit-${Date.now()}`,
            name: newCriterionName,
            description: newCriterionDesc,
        };

        setCriteria(prev => [...prev, newCriterion]);
        setNewCriterionName('');
        setNewCriterionDesc('');
        setIsAddCriteriaOpen(false);

        toast({
            title: 'Шалгуур нэмэгдлээ',
            description: `"${newCriterionName}" шалгуур жагсаалтад нэмэгдлээ.`,
        });
    };

    const handleDeleteCriterion = (id: string) => {
        setCriteria(prev => prev.filter(c => c.id !== id));
        toast({
            title: 'Шалгуур хасагдлаа',
            variant: 'destructive'
        });
    };

    const openEditCriterion = (crit: { id: string, name: string, description: string }) => {
        setEditingCriterion(crit);
        setEditCriterionName(crit.name);
        setEditCriterionDesc(crit.description);
        setIsEditCriteriaOpen(true);
    };

    const handleUpdateCriterion = (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingCriterion || !editCriterionName.trim()) return;

        setCriteria(prev => prev.map(c =>
            c.id === editingCriterion.id
                ? { ...c, name: editCriterionName, description: editCriterionDesc }
                : c
        ));

        setIsEditCriteriaOpen(false);
        setEditingCriterion(null);
        toast({
            title: 'Шалгуур шинэчлэгдлээ',
            description: 'Өөрчлөлт хадгалагдлаа.',
        });
    };

    const handleAddTemplate = (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!newTemplateTitle.trim() || !newTemplateBody.trim()) return;

        const newTemplate: MessageTemplate = {
            id: `tpl-${Date.now()}`,
            title: newTemplateTitle,
            body: newTemplateBody,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        setTemplates(prev => [...prev, newTemplate]);
        setNewTemplateTitle('');
        setNewTemplateBody('');
        setIsAddTemplateOpen(false);

        toast({
            title: 'Загвар нэмэгдлээ',
            description: `"${newTemplateTitle}" загвар жагсаалтад нэмэгдлээ.`,
        });
    };

    const handleDeleteTemplate = (id: string) => {
        setTemplates(prev => prev.filter(t => t.id !== id));
        toast({
            title: 'Загвар хасагдлаа',
            variant: 'destructive'
        });
    };

    const openEditTemplate = (template: MessageTemplate) => {
        setEditingTemplate(template);
        setEditTemplateTitle(template.title);
        setEditTemplateBody(template.body);
        setIsEditTemplateOpen(true);
    };

    const handleUpdateTemplate = (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingTemplate || !editTemplateTitle.trim() || !editTemplateBody.trim()) return;

        setTemplates(prev => prev.map(t =>
            t.id === editingTemplate.id
                ? { ...t, title: editTemplateTitle, body: editTemplateBody, updatedAt: new Date().toISOString() }
                : t
        ));

        setIsEditTemplateOpen(false);
        setEditingTemplate(null);
        toast({
            title: 'Загвар шинэчлэгдлээ',
            description: 'Өөрчлөлт хадгалагдлаа.',
        });
    };

    const handleSave = async () => {
        if (!firestore) return;
        setSaving(true);
        try {
            const orderedStages = stages.map((s, index) => ({ ...s, order: index }));

            await setDoc(doc(firestore, 'recruitment_settings', 'default'), {
                defaultStages: orderedStages,
                defaultCriteria: criteria,
                messageTemplates: templates,
                smsConfig: smsConfig,
                updatedAt: new Date().toISOString()
            });

            setInitialState({
                stages: orderedStages,
                criteria: criteria,
                templates: templates,
                smsConfig: smsConfig
            });

            toast({
                title: 'Тохиргоо хадгалагдлаа',
                description: 'Бүх өөрчлөлтийг амжилттай хадгаллаа.',
            });
        } catch (error) {
            console.error(error);
            toast({
                title: 'Алдаа',
                description: 'Тохиргоог хадгалж чадсангүй.',
                variant: 'destructive',
            });
        } finally {
            setSaving(false);
        }
    };

    const hasChanges = JSON.stringify(initialState?.stages) !== JSON.stringify(stages) ||
        JSON.stringify(initialState?.criteria) !== JSON.stringify(criteria) ||
        JSON.stringify(initialState?.templates) !== JSON.stringify(templates) ||
        JSON.stringify(initialState?.smsConfig) !== JSON.stringify(smsConfig);

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (active.id !== over?.id) {
            setStages((items) => {
                const oldIndex = items.findIndex((item) => item.id === active.id);
                const newIndex = items.findIndex((item) => item.id === over?.id);
                return arrayMove(items, oldIndex, newIndex);
            });
        }
    };

    if (loading) {
        return <div className="flex h-[200px] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
    }

    return (
        <div className="space-y-6 max-w-5xl animate-in fade-in duration-500 pb-20">
            {/* Header with Global Save */}
            {hasChanges && (
            <div className="flex flex-col md:flex-row md:items-center justify-end gap-4 sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 py-4 border-b">
                    <div className="flex items-center gap-3 animate-in slide-in-from-right-4 duration-300">
                        <span className="text-sm text-amber-600 flex items-center gap-1 font-medium bg-amber-50 px-3 py-1.5 rounded-full border border-amber-100">
                            <AlertCircle className="h-3.5 w-3.5" />
                            Хадгалаагүй өөрчлөлт байна
                        </span>
                        <Button onClick={handleSave} disabled={saving} className="bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-500/20 gap-2 transition-all active:scale-95">
                            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                            Бүгдийг хадгалах
                        </Button>
                    </div>
            </div>
            )}

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
                <div className="xl:col-span-12 space-y-6">
                    {/* Default Stages Card */}
                    <Card className="shadow-sm border-slate-200">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-7">
                            <div>
                                <CardTitle className="text-xl font-bold">Үндсэн үе шатууд</CardTitle>
                                <CardDescription className="mt-1">
                                    Шинэ ажлын байрны зар үүсгэхэд ашиглагдах үндсэн процессын дараалал.
                                </CardDescription>
                            </div>

                            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                                <AddActionButton
                                    label="Шат нэмэх"
                                    description="Шинэ үе шат нэмэх"
                                    onClick={() => setIsAddDialogOpen(true)}
                                />
                                <DialogContent className="sm:max-w-[425px]">
                                    <DialogHeader>
                                        <DialogTitle>Шинэ шат нэмэх</DialogTitle>
                                        <DialogDescription>
                                            Бүрдүүлэлтийн явцад ашиглагдах шинэ шатны мэдээллийг оруулна уу.
                                        </DialogDescription>
                                    </DialogHeader>
                                    <form onSubmit={handleAddStage} className="space-y-4 py-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="title">Шатны нэр</Label>
                                            <Input
                                                id="title"
                                                placeholder="Жишээ: Техник даалгавар..."
                                                value={newStageTitle}
                                                onChange={(e) => setNewStageTitle(e.target.value)}
                                                autoFocus
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="type">Төрөл</Label>
                                            <Select value={newStageType} onValueChange={(v: StageType) => setNewStageType(v)}>
                                                <SelectTrigger id="type">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="SCREENING">Screening (Анкет шүүлт)</SelectItem>
                                                    <SelectItem value="INTERVIEW">Interview (Ярилцлага)</SelectItem>
                                                    <SelectItem value="CHALLENGE">Challenge (Шалгалт/Даалгавар)</SelectItem>
                                                    <SelectItem value="OFFER">Offer (Санал тавих)</SelectItem>
                                                    <SelectItem value="HIRED">Hired (Ажилд авсан)</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <DialogFooter className="pt-4">
                                            <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)}>Болих</Button>
                                            <Button type="submit" className="bg-blue-600 hover:bg-blue-700">Нэмэх</Button>
                                        </DialogFooter>
                                    </form>
                                </DialogContent>
                            </Dialog>

                            <Dialog open={isEditStageOpen} onOpenChange={setIsEditStageOpen}>
                                <DialogContent className="sm:max-w-[425px]">
                                    <DialogHeader>
                                        <DialogTitle>Шат засах</DialogTitle>
                                        <DialogDescription>
                                            Үе шатны мэдээлэлд өөрчлөлт оруулах.
                                        </DialogDescription>
                                    </DialogHeader>
                                    <form onSubmit={handleUpdateStage} className="space-y-4 py-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="edit-stage-title">Шатны нэр</Label>
                                            <Input
                                                id="edit-stage-title"
                                                placeholder="Жишээ: Техник даалгавар..."
                                                value={editStageTitle}
                                                onChange={(e) => setEditStageTitle(e.target.value)}
                                                autoFocus
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="edit-stage-type">Төрөл</Label>
                                            <Select value={editStageType} onValueChange={(v: StageType) => setEditStageType(v)}>
                                                <SelectTrigger id="edit-stage-type">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="SCREENING">Screening (Анкет шүүлт)</SelectItem>
                                                    <SelectItem value="INTERVIEW">Interview (Ярилцлага)</SelectItem>
                                                    <SelectItem value="CHALLENGE">Challenge (Шалгалт/Даалгавар)</SelectItem>
                                                    <SelectItem value="OFFER">Offer (Санал тавих)</SelectItem>
                                                    <SelectItem value="HIRED">Hired (Ажилд авсан)</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <DialogFooter className="pt-4">
                                            <Button type="button" variant="outline" onClick={() => setIsEditStageOpen(false)}>Болих</Button>
                                            <Button type="submit" className="bg-blue-600 hover:bg-blue-700">Хадгалах</Button>
                                        </DialogFooter>
                                    </form>
                                </DialogContent>
                            </Dialog>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <DndContext
                                sensors={sensors}
                                collisionDetection={closestCenter}
                                onDragEnd={handleDragEnd}
                            >
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-[50px]"></TableHead>
                                            <TableHead>Нэр</TableHead>
                                            <TableHead>Төрөл</TableHead>
                                            <TableHead className="text-right"></TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        <SortableContext
                                            items={stages.map(s => s.id)}
                                            strategy={verticalListSortingStrategy}
                                        >
                                            {stages.map((stage) => (
                                                <SortableStage
                                                    key={stage.id}
                                                    stage={stage}
                                                    onEdit={openEditStage}
                                                    onDelete={handleDeleteStage}
                                                />
                                            ))}
                                        </SortableContext>
                                        {stages.length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                                                    Үе шат тохируулаагүй байна.
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </DndContext>

                            <div className="flex items-start gap-2 pt-4 border-t mt-4 text-slate-500">
                                <Info className="h-4 w-4 mt-0.5 text-blue-500" />
                                <p className="text-xs italic leading-relaxed">
                                    * Шатны дарааллыг өөрчлөхийн тулд барьж чирнэ үү. Өөрчлөлт оруулаад дээд хэсэгт байрлах "Хадгалах" товчийг дарж баталгаажуулна уу.
                                </p>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Evaluation Criteria Card */}
                    <Card className="shadow-sm border-slate-200">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-7">
                            <div>
                                <CardTitle className="text-xl font-bold">Үнэлгээний шалгуур</CardTitle>
                                <CardDescription className="mt-1">
                                    Ярилцлагын үед горилогчийг үнэлэх үндсэн шалгуурууд.
                                </CardDescription>
                            </div>

                            <Dialog open={isAddCriteriaOpen} onOpenChange={setIsAddCriteriaOpen}>
                                <AddActionButton
                                    label="Шалгуур нэмэх"
                                    description="Үнэлгээний шинэ шалгуур нэмэх"
                                    onClick={() => setIsAddCriteriaOpen(true)}
                                />
                                <DialogContent className="sm:max-w-[425px]">
                                    <DialogHeader>
                                        <DialogTitle>Шинэ шалгуур нэмэх</DialogTitle>
                                        <DialogDescription>
                                            Үнэлгээний хуудас дээр харагдах шинэ үзүүлэлтийг оруулна уу.
                                        </DialogDescription>
                                    </DialogHeader>
                                    <form onSubmit={handleAddCriterion} className="space-y-4 py-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="crit-name">Шалгуурын нэр</Label>
                                            <Input
                                                id="crit-name"
                                                placeholder="Жишээ: Харилцааны чадвар..."
                                                value={newCriterionName}
                                                onChange={(e) => setNewCriterionName(e.target.value)}
                                                autoFocus
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="crit-desc">Тайлбар (Заавал биш)</Label>
                                            <Textarea
                                                id="crit-desc"
                                                placeholder="Шалгуурын талаарх дэлгэрэнгүй тайлбар..."
                                                value={newCriterionDesc}
                                                onChange={(e) => setNewCriterionDesc(e.target.value)}
                                            />
                                        </div>
                                        <DialogFooter className="pt-4">
                                            <Button type="button" variant="outline" onClick={() => setIsAddCriteriaOpen(false)}>Болих</Button>
                                            <Button type="submit" className="bg-blue-600 hover:bg-blue-700">Нэмэх</Button>
                                        </DialogFooter>
                                    </form>
                                </DialogContent>
                            </Dialog>

                            <Dialog open={isEditCriteriaOpen} onOpenChange={setIsEditCriteriaOpen}>
                                <DialogContent className="sm:max-w-[425px]">
                                    <DialogHeader>
                                        <DialogTitle>Шалгуур засах</DialogTitle>
                                        <DialogDescription>
                                            Үнэлгээний шалгуурт өөрчлөлт оруулах.
                                        </DialogDescription>
                                    </DialogHeader>
                                    <form onSubmit={handleUpdateCriterion} className="space-y-4 py-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="edit-crit-name">Шалгуурын нэр</Label>
                                            <Input
                                                id="edit-crit-name"
                                                placeholder="Жишээ: Харилцааны чадвар..."
                                                value={editCriterionName}
                                                onChange={(e) => setEditCriterionName(e.target.value)}
                                                autoFocus
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="edit-crit-desc">Тайлбар (Заавал биш)</Label>
                                            <Textarea
                                                id="edit-crit-desc"
                                                placeholder="Шалгуурын талаарх дэлгэрэнгүй тайлбар..."
                                                value={editCriterionDesc}
                                                onChange={(e) => setEditCriterionDesc(e.target.value)}
                                            />
                                        </div>
                                        <DialogFooter className="pt-4">
                                            <Button type="button" variant="outline" onClick={() => setIsEditCriteriaOpen(false)}>Болих</Button>
                                            <Button type="submit" className="bg-blue-600 hover:bg-blue-700">Хадгалах</Button>
                                        </DialogFooter>
                                    </form>
                                </DialogContent>
                            </Dialog>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Нэр</TableHead>
                                        <TableHead>Тайлбар</TableHead>
                                        <TableHead className="text-right"></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {criteria.map((crit) => (
                                        <TableRow key={crit.id}>
                                            <TableCell className="font-medium">{crit.name}</TableCell>
                                            <TableCell className="text-muted-foreground text-sm">{crit.description}</TableCell>
                                            <TableCell className="text-right space-x-1">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => openEditCriterion(crit)}
                                                    className="text-slate-400 hover:text-blue-500 hover:bg-blue-50"
                                                >
                                                    <Pencil className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => handleDeleteCriterion(crit.id)}
                                                    className="text-red-500 hover:text-red-600 hover:bg-red-50"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {criteria.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={3} className="h-24 text-center text-muted-foreground">
                                                Шалгуур тохируулаагүй байна.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                    {/* Message Templates Card */}
                    <Card className="shadow-sm border-slate-200">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-7">
                            <div>
                                <CardTitle className="text-xl font-bold">Мессежний загварууд</CardTitle>
                                <CardDescription className="mt-1">
                                    Нэр дэвшигчид рүү илгээх бэлэн мессежний загварууд.
                                </CardDescription>
                            </div>

                            <Dialog open={isAddTemplateOpen} onOpenChange={setIsAddTemplateOpen}>
                                <AddActionButton
                                    label="Загвар нэмэх"
                                    description="Мессежний шинэ загвар нэмэх"
                                    onClick={() => setIsAddTemplateOpen(true)}
                                />
                                <DialogContent className="sm:max-w-[500px]">
                                    <DialogHeader>
                                        <DialogTitle>Шинэ загвар нэмэх</DialogTitle>
                                        <DialogDescription>
                                            Нэр дэвшигчид рүү илгээх мессежний загварыг оруулна уу.
                                        </DialogDescription>
                                    </DialogHeader>
                                    <form onSubmit={handleAddTemplate} className="space-y-4 py-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="tpl-title">Загварын нэр</Label>
                                            <Input
                                                id="tpl-title"
                                                placeholder="Жишээ: Ярилцлагын урилга..."
                                                value={newTemplateTitle}
                                                onChange={(e) => setNewTemplateTitle(e.target.value)}
                                                autoFocus
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="tpl-body">Мессежний агуулга</Label>
                                            <Textarea
                                                id="tpl-body"
                                                placeholder="Мессежний агуулгыг энд бичнэ үү..."
                                                className="min-h-[150px]"
                                                value={newTemplateBody}
                                                onChange={(e) => setNewTemplateBody(e.target.value)}
                                            />
                                            <p className="text-[10px] text-muted-foreground italic">
                                                Зөвлөмж: {'{{name}}'} гэж бичвэл нэр дэвшигчийн нэрээр солигдоно.
                                            </p>
                                        </div>
                                        <DialogFooter className="pt-4">
                                            <Button type="button" variant="outline" onClick={() => setIsAddTemplateOpen(false)}>Болих</Button>
                                            <Button type="submit" className="bg-blue-600 hover:bg-blue-700">Нэмэх</Button>
                                        </DialogFooter>
                                    </form>
                                </DialogContent>
                            </Dialog>

                            <Dialog open={isEditTemplateOpen} onOpenChange={setIsEditTemplateOpen}>
                                <DialogContent className="sm:max-w-[500px]">
                                    <DialogHeader>
                                        <DialogTitle>Загвар засах</DialogTitle>
                                        <DialogDescription>
                                            Мессежний загварт өөрчлөлт оруулах.
                                        </DialogDescription>
                                    </DialogHeader>
                                    <form onSubmit={handleUpdateTemplate} className="space-y-4 py-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="edit-tpl-title">Загварын нэр</Label>
                                            <Input
                                                id="edit-tpl-title"
                                                placeholder="Жишээ: Ярилцлагын урилга..."
                                                value={editTemplateTitle}
                                                onChange={(e) => setEditTemplateTitle(e.target.value)}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="edit-tpl-body">Мессежний агуулга</Label>
                                            <Textarea
                                                id="edit-tpl-body"
                                                placeholder="Мессежний агуулгыг энд бичнэ үү..."
                                                className="min-h-[150px]"
                                                value={editTemplateBody}
                                                onChange={(e) => setEditTemplateBody(e.target.value)}
                                            />
                                            <p className="text-[10px] text-muted-foreground italic">
                                                Зөвлөмж: {'{{name}}'} гэж бичвэл нэр дэвшигчийн нэрээр солигдоно.
                                            </p>
                                        </div>
                                        <DialogFooter className="pt-4">
                                            <Button type="button" variant="outline" onClick={() => setIsEditTemplateOpen(false)}>Болих</Button>
                                            <Button type="submit" className="bg-blue-600 hover:bg-blue-700">Хадгалах</Button>
                                        </DialogFooter>
                                    </form>
                                </DialogContent>
                            </Dialog>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {templates.map((tpl) => (
                                    <Card key={tpl.id} className="relative group overflow-hidden border-slate-200/60 shadow-none hover:shadow-md transition-all">
                                        <div className="p-4 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <Mail className="h-4 w-4 text-blue-500" />
                                                <h4 className="text-sm font-semibold text-slate-900">{tpl.title}</h4>
                                            </div>
                                            <div className="flex items-center">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => openEditTemplate(tpl)}
                                                    className="h-7 w-7 text-slate-400 hover:text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                                >
                                                    <Pencil className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => handleDeleteTemplate(tpl.id)}
                                                    className="h-7 w-7 text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>
                                        <CardContent className="p-4">
                                            <p className="text-xs text-slate-600 line-clamp-3 leading-relaxed whitespace-pre-wrap">
                                                {tpl.body}
                                            </p>
                                        </CardContent>
                                    </Card>
                                ))}
                                {templates.length === 0 && (
                                    <div className="col-span-full py-12 text-center bg-slate-50 rounded-xl border border-dashed text-slate-400">
                                        <MessageSquare className="h-10 w-10 mx-auto mb-3 opacity-20" />
                                        <p className="text-sm">Загвар тохируулаагүй байна.</p>
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    {/* SMS Integration Card */}
                    <Card className="shadow-sm border-slate-200">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-7">
                            <div>
                                <CardTitle className="text-xl font-bold flex items-center gap-2">
                                    <MessageSquare className="h-5 w-5 text-blue-500" />
                                    SMS тохиргоо (MoceanAPI)
                                </CardTitle>
                                <CardDescription className="mt-1">
                                    Горилогчид руу SMS мессеж илгээх Bearer Token нэвтрэлтийн тохиргоо.
                                </CardDescription>
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => window.open('https://dashboard.moceanapi.com/', '_blank')}
                                className="gap-2"
                            >
                                MoceanAPI Dashboard
                                <Info className="h-4 w-4" />
                            </Button>
                        </CardHeader>
                        <CardContent className="space-y-6 max-w-2xl">
                            {/* Env variable status */}
                            {smsEnvConfigured && (
                                <div className="flex items-start gap-3 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800">
                                    <div className="h-2 w-2 rounded-full bg-emerald-500 mt-1.5 shrink-0 animate-pulse" />
                                    <div>
                                        <p className="text-sm font-medium">Environment variable тохирсон</p>
                                        <p className="text-xs text-emerald-600 mt-0.5">
                                            <code className="bg-emerald-100 px-1 py-0.5 rounded text-[11px]">MOCEAN_API_TOKEN</code> .env файлаас амжилттай уншиж байна.
                                            Доорх Firestore тохиргоо нь env байхгүй үед нөөц болж ажиллана.
                                        </p>
                                    </div>
                                </div>
                            )}
                            {!smsEnvConfigured && !smsConfig.token && (
                                <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800">
                                    <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                                    <div>
                                        <p className="text-sm font-medium">SMS тохиргоо хийгдээгүй</p>
                                        <p className="text-xs text-amber-600 mt-0.5">
                                            <code className="bg-amber-100 px-1 py-0.5 rounded text-[11px]">.env.local</code> файлд{' '}
                                            <code className="bg-amber-100 px-1 py-0.5 rounded text-[11px]">MOCEAN_API_TOKEN</code> нэмэх
                                            эсвэл доорх талбарт API Token оруулна уу.
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Token field */}
                            <div className="grid gap-2">
                                <Label htmlFor="api-token">API Token (Bearer)</Label>
                                <Input
                                    id="api-token"
                                    type="password"
                                    value={smsConfig.token}
                                    onChange={(e) => setSmsConfig({ ...smsConfig, token: e.target.value })}
                                    placeholder="apit-xxxx..."
                                    className="font-mono text-sm"
                                />
                                <p className="text-xs text-muted-foreground">
                                    MoceanAPI Dashboard → Settings → API Credentials хэсгээс авна.
                                </p>
                            </div>

                            {/* Sender ID */}
                            <div className="grid gap-2">
                                <Label htmlFor="sender-id">Sender ID (Заавал биш)</Label>
                                <Input
                                    id="sender-id"
                                    value={smsConfig.senderId}
                                    onChange={(e) => setSmsConfig({ ...smsConfig, senderId: e.target.value })}
                                    placeholder="Жишээ: CompanyName"
                                />
                                <p className="text-xs text-muted-foreground">
                                    Илгээгчийн нэр (Latin үсгээр). Хоосон бол &apos;MOCEAN&apos; гэж очно.
                                </p>
                            </div>

                            {/* Test SMS */}
                            <div className="pt-4 border-t space-y-3">
                                <Label className="text-sm font-semibold">Тест SMS илгээх</Label>
                                <div className="flex items-center gap-2">
                                    <Input
                                        value={testPhone}
                                        onChange={(e) => setTestPhone(e.target.value)}
                                        placeholder="Утасны дугаар (жишээ: 99112233)"
                                        className="max-w-[240px] text-sm"
                                    />
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={handleTestSms}
                                        disabled={testingSms || !testPhone.trim()}
                                        className="gap-2 shrink-0"
                                    >
                                        {testingSms ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MessageSquare className="h-3.5 w-3.5" />}
                                        Тест илгээх
                                    </Button>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    976 код автоматаар нэмэгдэнэ. Тест мессеж илгээж SMS тохиргоо зөв эсэхийг шалгана.
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
