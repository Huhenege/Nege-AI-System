'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
    AppDialog,
    AppDialogContent,
    AppDialogDescription,
    AppDialogFooter,
    AppDialogHeader,
    AppDialogTitle,
    AppDialogTrigger,
} from '@/components/patterns';
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { PlusCircle, Loader2 } from 'lucide-react';
import { useFirebase, addDocumentNonBlocking } from '@/firebase';
import { collection, doc, getDoc, query, where, getDocs } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Vacancy, RecruitmentStage, VacancyStatus } from '@/types/recruitment';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

function buildAutoDescription(position: any): string {
    const purpose = typeof position?.purpose === 'string' ? position.purpose.trim() : '';
    const responsibilitiesRaw = Array.isArray(position?.responsibilities) ? position.responsibilities : [];
    const lines = responsibilitiesRaw
        .map((r: any) => {
            if (!r) return '';
            if (typeof r === 'string') return r.trim();
            if (typeof r === 'object') {
                const title = typeof r.title === 'string' ? r.title.trim() : '';
                const desc = typeof r.description === 'string' ? r.description.trim() : '';
                const combined = [title, desc].filter(Boolean).join(' — ');
                return combined;
            }
            return '';
        })
        .filter(Boolean);

    const responsibilitiesBlock = lines.length ? `## Чиг үүрэг\n${lines.map((l: string) => `- ${l}`).join('\n')}` : '';
    return [purpose, responsibilitiesBlock].filter(Boolean).join('\n\n');
}

const vacancySchema = z.object({
    title: z.string().min(2, 'Гарчиг дор хаяж 2 үсэгтэй байх ёстой'),
    departmentId: z.string().min(1, 'Хэлтэс сонгоно уу'),
    status: z.enum(['DRAFT', 'OPEN']),
    description: z.string().optional(),
});

type VacancyFormValues = z.infer<typeof vacancySchema>;

const DEFAULT_STAGES: RecruitmentStage[] = [
    { id: 'screening', title: 'Анкет шүүлт', type: 'SCREENING', order: 0 },
    { id: 'first-interview', title: 'Анхан шатны ярилцлага', type: 'INTERVIEW', order: 1 },
    { id: 'tech-task', title: 'Даалгавар', type: 'CHALLENGE', order: 2 },
    { id: 'final-interview', title: 'Эцсийн ярилцлага', type: 'INTERVIEW', order: 3 },
    { id: 'offer', title: 'Санал тавих', type: 'OFFER', order: 4 },
];

export function CreateVacancyDialog({
    children,
    departments,
    open: controlledOpen,
    onOpenChange,
    hideTrigger = false,
}: {
    children?: React.ReactNode;
    departments: any[];
    /** Controlled open state (optional). */
    open?: boolean;
    /** Controlled open state setter (optional). */
    onOpenChange?: (open: boolean) => void;
    /** Hide the built-in trigger button (use external AddActionButton, etc.) */
    hideTrigger?: boolean;
}) {
    const [internalOpen, setInternalOpen] = useState(false);
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(false);

    const [approvedPositions, setApprovedPositions] = useState<any[]>([]);
    const [isLoadingPositions, setIsLoadingPositions] = useState(false);

    const [allStages, setAllStages] = useState<RecruitmentStage[]>([]);
    const [selectedStageIds, setSelectedStageIds] = useState<Set<string>>(new Set());
    const [isLoadingStages, setIsLoadingStages] = useState(false);
    const [selectedEmploymentTypeId, setSelectedEmploymentTypeId] = useState<string | undefined>(undefined);

    const isControlled = typeof controlledOpen === 'boolean';
    const open = isControlled ? controlledOpen : internalOpen;
    const setOpen = React.useCallback(
        (next: boolean) => {
            onOpenChange?.(next);
            if (!isControlled) setInternalOpen(next);
        },
        [onOpenChange, isControlled]
    );

    // Fetch approved positions and default stages when dialog opens
    React.useEffect(() => {
        if (open && firestore) {
            const fetchPositions = async () => {
                setIsLoadingPositions(true);
                try {
                    const q = query(collection(firestore, 'positions'), where('isApproved', '==', true));
                    const snapshot = await getDocs(q);
                    const positions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                    setApprovedPositions(positions);
                } catch (error) {
                    console.error("Error fetching positions:", error);
                    toast({
                        title: 'Алдаа',
                        description: 'Албан тушаалын жагсаалтыг татаж чадсангүй.',
                        variant: 'destructive'
                    });
                } finally {
                    setIsLoadingPositions(false);
                }
            };
            fetchPositions();

            const fetchStages = async () => {
                setIsLoadingStages(true);
                try {
                    const settingsRef = doc(firestore, 'recruitment_settings', 'default');
                    const settingsSnap = await getDoc(settingsRef);
                    let stages = DEFAULT_STAGES;
                    if (settingsSnap.exists() && settingsSnap.data().defaultStages) {
                        stages = settingsSnap.data().defaultStages;
                    }
                    const sorted = [...stages].sort((a, b) => a.order - b.order);
                    setAllStages(sorted);
                    setSelectedStageIds(new Set(sorted.map(s => s.id)));
                } catch (_) {
                    setAllStages(DEFAULT_STAGES);
                    setSelectedStageIds(new Set(DEFAULT_STAGES.map(s => s.id)));
                } finally {
                    setIsLoadingStages(false);
                }
            };
            fetchStages();
        }
    }, [open, firestore]);

    const form = useForm<VacancyFormValues>({
        resolver: zodResolver(vacancySchema),
        defaultValues: {
            title: '',
            departmentId: '',
            status: 'OPEN',
            description: '',
        },
    });

    const toggleStage = (stageId: string) => {
        setSelectedStageIds(prev => {
            const next = new Set(prev);
            if (next.has(stageId)) {
                next.delete(stageId);
            } else {
                next.add(stageId);
            }
            return next;
        });
    };

    const stageTypeLabel: Record<string, string> = {
        SCREENING: 'Шүүлт',
        INTERVIEW: 'Ярилцлага',
        CHALLENGE: 'Даалгавар',
        OFFER: 'Санал',
        HIRED: 'Авсан',
        REJECTED: 'Татгалзсан',
    };

    const stageTypeColor: Record<string, string> = {
        SCREENING: 'bg-blue-50 text-blue-600 border-blue-200',
        INTERVIEW: 'bg-indigo-50 text-indigo-600 border-indigo-200',
        CHALLENGE: 'bg-amber-50 text-amber-600 border-amber-200',
        OFFER: 'bg-green-50 text-green-600 border-green-200',
        HIRED: 'bg-emerald-50 text-emerald-600 border-emerald-200',
        REJECTED: 'bg-red-50 text-red-600 border-red-200',
    };

    const onSubmit = async (data: VacancyFormValues) => {
        if (!firestore) return;

        if (selectedStageIds.size === 0) {
            toast({ title: 'Алдаа', description: 'Дор хаяж нэг үе шат сонгоно уу.', variant: 'destructive' });
            return;
        }

        setIsLoading(true);

        try {
            const stagesToUse = allStages
                .filter(s => selectedStageIds.has(s.id))
                .map((s, idx) => ({ ...s, order: idx }));

            const newVacancy: Omit<Vacancy, 'id'> = {
                title: data.title,
                departmentId: data.departmentId,
                status: data.status as VacancyStatus,
                hiringManagerId: 'CURRENT_USER_ID',
                description: data.description || '',
                requirements: [],
                stages: stagesToUse,
                ...(selectedEmploymentTypeId ? { employmentTypeId: selectedEmploymentTypeId } : {}),
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            };

            await addDocumentNonBlocking(collection(firestore, 'vacancies'), newVacancy);

            toast({
                title: 'Ажлын байр үүсгэгдлээ',
                description: `"${data.title}" нэртэй шинэ зар үүсгэлээ.`,
            });
            setOpen(false);
            form.reset();
            setSelectedStageIds(new Set(allStages.map(s => s.id)));
            setSelectedEmploymentTypeId(undefined);
        } catch (error) {
            console.error(error);
            toast({
                title: 'Алдаа гарлаа',
                description: 'Хадгалж чадсангүй, дахин оролдоно уу.',
                variant: 'destructive',
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <AppDialog open={open} onOpenChange={setOpen}>
            {!hideTrigger ? (
                <AppDialogTrigger asChild>
                    {children || (
                        <Button className="gap-2">
                            <PlusCircle className="h-4 w-4" />
                            Шинэ зар
                        </Button>
                    )}
                </AppDialogTrigger>
            ) : null}
            <AppDialogContent size="md" className="p-0 overflow-hidden">
                <AppDialogHeader className="px-6 pt-6">
                    <AppDialogTitle>Шинэ ажлын байрны зар үүсгэх</AppDialogTitle>
                    <AppDialogDescription>
                        Сонгон шалгаруулалт эхлүүлэх ажлын байрны үндсэн мэдээллийг оруулна уу.
                    </AppDialogDescription>
                </AppDialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 px-6 py-4">
                        <FormField
                            control={form.control}
                            name="title"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Албан тушаал</FormLabel>
                                    {isLoadingPositions ? (
                                        <div className="flex items-center gap-2 text-sm text-muted-foreground h-10 px-3 border rounded-md">
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                            Батлагдсан орон тоог шалгаж байна...
                                        </div>
                                    ) : approvedPositions.length > 0 ? (
                                        <Select
                                            onValueChange={(posId) => {
                                                const selectedPos = approvedPositions.find(p => p.id === posId);
                                                if (selectedPos) {
                                                    field.onChange(selectedPos.title);
                                                    form.setValue('departmentId', selectedPos.departmentId || '');
                                                    setSelectedEmploymentTypeId(selectedPos.employmentTypeId || undefined);
                                                    const currentDesc = form.getValues('description') || '';
                                                    if (!currentDesc.trim()) {
                                                        const next = buildAutoDescription(selectedPos);
                                                        if (next.trim()) form.setValue('description', next);
                                                    }
                                                }
                                            }}
                                            defaultValue={approvedPositions.find(p => p.title === field.value)?.id}
                                        >
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Батлагдсан албан тушаал сонгох" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {approvedPositions.map((pos) => (
                                                    <SelectItem key={pos.id} value={pos.id}>
                                                        {pos.title} <span className="text-muted-foreground text-xs ml-2">({pos.filled} хүнтэй)</span>
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    ) : (
                                        <div className="p-3 bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-md text-sm">
                                            Одоогоор батлагдсан орон тоо алга байна.
                                        </div>
                                    )}
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="departmentId"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Хэлтэс</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Хэлтэс сонгох" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {departments.map((dept) => (
                                                <SelectItem key={dept.id} value={dept.id}>
                                                    {dept.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="status"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Төлөв</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value="OPEN">Нээлттэй (Шууд эхлэх)</SelectItem>
                                            <SelectItem value="DRAFT">Ноорог (Хадгалах)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="description"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Тайлбар (Заавал биш)</FormLabel>
                                    <FormControl>
                                        <Textarea className="resize-none" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {/* Stage Selection */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <label className="text-sm font-medium">Сонгон шалгаруулалтын үе шатууд</label>
                                <span className="text-xs text-muted-foreground">{selectedStageIds.size}/{allStages.length} сонгосон</span>
                            </div>
                            {isLoadingStages ? (
                                <div className="flex items-center gap-2 text-sm text-muted-foreground py-3">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Үе шатуудыг ачаалж байна...
                                </div>
                            ) : (
                                <div className="border rounded-lg divide-y max-h-[220px] overflow-y-auto">
                                    {allStages.map((stage, idx) => {
                                        const selected = selectedStageIds.has(stage.id);
                                        return (
                                            <label
                                                key={stage.id}
                                                className={cn(
                                                    "flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors hover:bg-slate-50",
                                                    selected && "bg-blue-50/50"
                                                )}
                                            >
                                                <Checkbox
                                                    checked={selected}
                                                    onCheckedChange={() => toggleStage(stage.id)}
                                                />
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-sm font-medium text-slate-900">{stage.title}</span>
                                                        <Badge variant="outline" className={cn("text-[10px] h-5 px-1.5", stageTypeColor[stage.type] || '')}>
                                                            {stageTypeLabel[stage.type] || stage.type}
                                                        </Badge>
                                                    </div>
                                                </div>
                                                <span className="text-xs text-slate-400 tabular-nums shrink-0">#{idx + 1}</span>
                                            </label>
                                        );
                                    })}
                                </div>
                            )}
                            {!isLoadingStages && selectedStageIds.size === 0 && (
                                <p className="text-xs text-destructive">Дор хаяж нэг үе шат сонгоно уу.</p>
                            )}
                        </div>

                        <AppDialogFooter className="px-0 py-0 border-t-0 bg-transparent">
                            <Button type="submit" disabled={isLoading}>
                                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Үүсгэх
                            </Button>
                        </AppDialogFooter>
                    </form>
                </Form>
            </AppDialogContent>
        </AppDialog>
    );
}
