'use client';

import { getJsonAuthHeaders } from '@/lib/api/client-auth';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ReferenceTable, type ReferenceItem } from "@/components/ui/reference-table";
import { useCollection, useFetchCollection, useMemoFirebase, useFirebase, addDocumentNonBlocking, tenantCollection, useTenantWrite } from "@/firebase";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { VerticalTabMenu } from '@/components/ui/vertical-tab-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    Globe,
    GraduationCap,
    Languages,
    Users,
    Briefcase,
    Award,
    Search,
    BookOpen,
    Building2,
    Heart,
    Phone,
    FileText,
    Sparkles,
    ChevronRight,
    Database,
    Wand2,
    Loader2,
    CheckCircle2,
    Plus,
    Brain
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';

type SimpleReferenceItem = ReferenceItem & { name: string };
type JobCategoryReferenceItem = ReferenceItem & { name: string; code: string };

interface CategoryConfig {
    id: string;
    label: string;
    icon: React.ElementType;
    color: string;
    bgColor: string;
    borderColor: string;
    collectionName: string;
    columns: { key: string; header: string }[];
    dialogTitle: string;
    description: string;
    hideAI?: boolean;
}

const CATEGORIES: CategoryConfig[] = [
    {
        id: 'countries',
        label: 'Улс орнууд',
        icon: Globe,
        color: 'text-blue-600',
        bgColor: 'bg-blue-50',
        borderColor: 'border-blue-200',
        collectionName: 'questionnaireCountries',
        columns: [{ key: 'name', header: 'Улсын нэр' }],
        dialogTitle: 'Улс',
        description: 'Боловсрол эзэмшсэн улс орнуудын жагсаалт'
    },
    {
        id: 'schools',
        label: 'Сургуулиуд',
        icon: Building2,
        color: 'text-indigo-600',
        bgColor: 'bg-indigo-50',
        borderColor: 'border-indigo-200',
        collectionName: 'questionnaireSchools',
        columns: [{ key: 'name', header: 'Сургуулийн нэр' }],
        dialogTitle: 'Сургууль',
        description: 'Их, дээд сургууль, коллежуудын жагсаалт'
    },
    {
        id: 'degrees',
        label: 'Мэргэжлүүд',
        icon: BookOpen,
        color: 'text-purple-600',
        bgColor: 'bg-purple-50',
        borderColor: 'border-purple-200',
        collectionName: 'questionnaireDegrees',
        columns: [{ key: 'name', header: 'Мэргэжлийн нэр' }],
        dialogTitle: 'Мэргэжил',
        description: 'Эзэмшсэн мэргэжлүүдийн жагсаалт'
    },
    {
        id: 'academicRanks',
        label: 'Эрдмийн зэрэг',
        icon: Award,
        color: 'text-amber-600',
        bgColor: 'bg-amber-50',
        borderColor: 'border-amber-200',
        collectionName: 'questionnaireAcademicRanks',
        columns: [{ key: 'name', header: 'Зэрэг, цол' }],
        dialogTitle: 'Эрдмийн зэрэг',
        description: 'Бакалавр, Магистр, Доктор гэх мэт'
    },
    {
        id: 'languages',
        label: 'Гадаад хэлнүүд',
        icon: Languages,
        color: 'text-emerald-600',
        bgColor: 'bg-emerald-50',
        borderColor: 'border-emerald-200',
        collectionName: 'questionnaireLanguages',
        columns: [{ key: 'name', header: 'Хэлний нэр' }],
        dialogTitle: 'Гадаад хэл',
        description: 'Гадаад хэлний мэдлэгийн жагсаалт'
    },
    {
        id: 'familyRelationships',
        label: 'Гэр бүлийн хамаарал',
        icon: Heart,
        color: 'text-rose-600',
        bgColor: 'bg-rose-50',
        borderColor: 'border-rose-200',
        collectionName: 'questionnaireFamilyRelationships',
        columns: [{ key: 'name', header: 'Хамаарал' }],
        dialogTitle: 'Гэр бүлийн хамаарал',
        description: 'Эхнэр, нөхөр, хүүхэд гэх мэт'
    },
    {
        id: 'emergencyRelationships',
        label: 'Яаралтай холбоо барих',
        icon: Phone,
        color: 'text-orange-600',
        bgColor: 'bg-orange-50',
        borderColor: 'border-orange-200',
        collectionName: 'questionnaireEmergencyRelationships',
        columns: [{ key: 'name', header: 'Хамаарал' }],
        dialogTitle: 'Яаралтай үеийн холбоо барих хамаарал',
        description: 'Найз, хамаатан гэх мэт'
    },
    {
        id: 'jobCategories',
        label: 'Мэргэжлийн ангилал',
        icon: FileText,
        color: 'text-slate-600',
        bgColor: 'bg-slate-50',
        borderColor: 'border-slate-200',
        collectionName: 'jobCategories',
        columns: [{ key: 'code', header: 'Код' }, { key: 'name', header: 'Нэр' }],
        dialogTitle: 'Ажил мэргэжлийн ангилал',
        description: 'Үндэсний ажил мэргэжлийн ангилал (ҮАМА)',
        hideAI: true
    },
];

const TABS = [
    { id: 'all', label: 'Бүгд', icon: Database },
    { id: 'education', label: 'Боловсрол', icon: GraduationCap, categories: ['countries', 'schools', 'degrees', 'academicRanks'] },
    { id: 'language', label: 'Хэл', icon: Languages, categories: ['languages'] },
    { id: 'relations', label: 'Хамаарал', icon: Users, categories: ['familyRelationships', 'emergencyRelationships'] },
    { id: 'work', label: 'Ажил', icon: Briefcase, categories: ['jobCategories'] },
];

// AI Generation Dialog
function AIGenerateDialog({ 
    open, 
    onOpenChange, 
    category, 
    existingItems,
    onItemsGenerated 
}: { 
    open: boolean; 
    onOpenChange: (open: boolean) => void; 
    category: CategoryConfig;
    existingItems: string[];
    onItemsGenerated: (items: any[]) => void;
}) {
    const [isGenerating, setIsGenerating] = React.useState(false);
    const [generatedItems, setGeneratedItems] = React.useState<any[]>([]);
    const [selectedItems, setSelectedItems] = React.useState<Set<number>>(new Set());
    const [step, setStep] = React.useState<'generate' | 'select' | 'saving'>('generate');
    const { toast } = useToast();
    const Icon = category.icon;

    const handleGenerate = async () => {
        setIsGenerating(true);
        setGeneratedItems([]);
        setSelectedItems(new Set());

        try {
            const response = await fetch('/api/generate-reference-data', {
                method: 'POST',
                headers: await getJsonAuthHeaders(),
                body: JSON.stringify({
                    category: category.collectionName,
                    existingItems,
                }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to generate');
            }

            const result = await response.json();
            setGeneratedItems(result.items || []);
            setSelectedItems(new Set(result.items?.map((_: any, i: number) => i) || []));
            setStep('select');
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Алдаа',
                description: error instanceof Error ? error.message : 'AI үүсгэхэд алдаа гарлаа',
            });
        } finally {
            setIsGenerating(false);
        }
    };

    const handleSave = () => {
        const itemsToSave = generatedItems.filter((_, i) => selectedItems.has(i));
        if (itemsToSave.length === 0) {
            toast({ variant: 'destructive', title: 'Алдаа', description: 'Нэг ч утга сонгоогүй байна' });
            return;
        }
        setStep('saving');
        onItemsGenerated(itemsToSave);
    };

    const toggleItem = (index: number) => {
        const newSet = new Set(selectedItems);
        if (newSet.has(index)) {
            newSet.delete(index);
        } else {
            newSet.add(index);
        }
        setSelectedItems(newSet);
    };

    const toggleAll = () => {
        if (selectedItems.size === generatedItems.length) {
            setSelectedItems(new Set());
        } else {
            setSelectedItems(new Set(generatedItems.map((_, i) => i)));
        }
    };

    const handleClose = () => {
        setStep('generate');
        setGeneratedItems([]);
        setSelectedItems(new Set());
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <div className={cn("p-2 rounded-lg", category.bgColor)}>
                            <Icon className={cn("h-4 w-4", category.color)} />
                        </div>
                        AI {category.label} үүсгэх
                    </DialogTitle>
                    <DialogDescription>
                        Монголын орчинд тохирсон "{category.label}" лавлах сангийн утгуудыг AI автоматаар үүсгэнэ
                    </DialogDescription>
                </DialogHeader>

                {step === 'generate' && (
                    <div className="py-8 text-center">
                        <div className="mx-auto w-20 h-20 rounded-full bg-gradient-to-br from-violet-100 to-purple-100 flex items-center justify-center mb-4">
                            <Brain className="h-10 w-10 text-violet-600" />
                        </div>
                        <p className="text-sm text-slate-600 mb-2">
                            AI модель Монгол улсын орчинд тохирсон утгуудыг үүсгэнэ
                        </p>
                        <p className="text-xs text-slate-400">
                            {existingItems.length > 0 && `Одоо байгаа ${existingItems.length} утгатай давхардахгүй`}
                        </p>
                    </div>
                )}

                {step === 'select' && (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <p className="text-sm font-medium text-slate-700">
                                {generatedItems.length} утга үүсгэгдлээ
                            </p>
                            <Button variant="ghost" size="sm" onClick={toggleAll}>
                                {selectedItems.size === generatedItems.length ? 'Бүгдийг болих' : 'Бүгдийг сонгох'}
                            </Button>
                        </div>
                        <ScrollArea className="h-[300px] rounded-lg border p-3">
                            <div className="space-y-2">
                                {generatedItems.map((item, index) => (
                                    <label
                                        key={index}
                                        className={cn(
                                            "flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-all",
                                            selectedItems.has(index)
                                                ? "bg-primary/10 border border-primary/30"
                                                : "bg-slate-50 hover:bg-slate-100 border border-transparent"
                                        )}
                                    >
                                        <Checkbox
                                            checked={selectedItems.has(index)}
                                            onCheckedChange={() => toggleItem(index)}
                                        />
                                        <span className="text-sm flex-1">
                                            {item.code ? (
                                                <>
                                                    <span className="font-mono text-blue-600 mr-2">{item.code}</span>
                                                    {item.name}
                                                </>
                                            ) : (
                                                item.name
                                            )}
                                        </span>
                                        {selectedItems.has(index) && (
                                            <CheckCircle2 className="h-4 w-4 text-primary" />
                                        )}
                                    </label>
                                ))}
                            </div>
                        </ScrollArea>
                        <p className="text-xs text-slate-500 text-center">
                            {selectedItems.size} / {generatedItems.length} сонгогдсон
                        </p>
                    </div>
                )}

                {step === 'saving' && (
                    <div className="py-8 text-center">
                        <Loader2 className="h-10 w-10 text-primary animate-spin mx-auto mb-4" />
                        <p className="text-sm text-slate-600">Хадгалж байна...</p>
                    </div>
                )}

                <DialogFooter>
                    {step === 'generate' && (
                        <>
                            <Button variant="outline" onClick={handleClose}>Болих</Button>
                            <Button
                                onClick={handleGenerate}
                                disabled={isGenerating}
                                className="bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700"
                            >
                                {isGenerating ? (
                                    <>
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        Үүсгэж байна...
                                    </>
                                ) : (
                                    <>
                                        <Wand2 className="h-4 w-4 mr-2" />
                                        AI-аар үүсгэх
                                    </>
                                )}
                            </Button>
                        </>
                    )}
                    {step === 'select' && (
                        <>
                            <Button variant="outline" onClick={() => setStep('generate')}>Дахин үүсгэх</Button>
                            <Button onClick={handleSave} disabled={selectedItems.size === 0}>
                                <Plus className="h-4 w-4 mr-2" />
                                {selectedItems.size} утга нэмэх
                            </Button>
                        </>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function CategoryCard({ category, data, isLoading }: { category: CategoryConfig; data: SimpleReferenceItem[] | null; isLoading: boolean }) {
    const Icon = category.icon;
    const itemCount = data?.length || 0;
    const [showAIDialog, setShowAIDialog] = React.useState(false);
    const { firestore } = useFirebase();
    const { tCollection } = useTenantWrite();
    const { toast } = useToast();

    const existingItems = React.useMemo(() => {
        if (!data) return [];
        return data.map(item => item.name || '').filter(Boolean);
    }, [data]);

    const handleItemsGenerated = async (items: any[]) => {
        if (!firestore) return;

        try {
            const collectionRef = tCollection(category.collectionName);
            
            // Add items one by one
            for (const item of items) {
                await addDocumentNonBlocking(collectionRef, item);
            }

            toast({
                title: 'Амжилттай!',
                description: `${items.length} утга нэмэгдлээ`,
            });
            setShowAIDialog(false);
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Алдаа',
                description: 'Хадгалахад алдаа гарлаа',
            });
        }
    };

    return (
        <>
            <Card className={cn("border shadow-sm hover:shadow-md transition-all", category.borderColor)}>
                <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                            <div className={cn("p-2.5 rounded-xl", category.bgColor)}>
                                <Icon className={cn("h-5 w-5", category.color)} />
                            </div>
                            <div>
                                <CardTitle className="text-base font-semibold">{category.label}</CardTitle>
                                <CardDescription className="text-xs mt-0.5">{category.description}</CardDescription>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            {!category.hideAI && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setShowAIDialog(true)}
                                    className="h-8 text-violet-600 hover:text-violet-700 hover:bg-violet-50"
                                >
                                    <Sparkles className="h-3.5 w-3.5 mr-1" />
                                    AI
                                </Button>
                            )}
                            <Badge variant="secondary" className="text-xs font-bold">
                                {isLoading ? '...' : itemCount}
                            </Badge>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="pt-0">
                    <ReferenceTable
                        collectionName={category.collectionName}
                        columns={category.columns}
                        itemData={data}
                        isLoading={isLoading}
                        dialogTitle={category.dialogTitle}
                    />
                </CardContent>
            </Card>

            <AIGenerateDialog
                open={showAIDialog}
                onOpenChange={setShowAIDialog}
                category={category}
                existingItems={existingItems}
                onItemsGenerated={handleItemsGenerated}
            />
        </>
    );
}

function QuickStats({ categories, dataMap, loadingMap }: { 
    categories: CategoryConfig[]; 
    dataMap: Record<string, SimpleReferenceItem[] | null>;
    loadingMap: Record<string, boolean>;
}) {
    const totalItems = categories.reduce((sum, cat) => sum + (dataMap[cat.id]?.length || 0), 0);
    const isLoading = Object.values(loadingMap).some(v => v);

    return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <div className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-xl p-4 border border-primary/20">
                <div className="flex items-center gap-2 mb-1">
                    <Database className="h-4 w-4 text-primary" />
                    <span className="text-xs font-medium text-primary">Нийт бүртгэл</span>
                </div>
                <div className="text-2xl font-bold text-primary">
                    {isLoading ? <Skeleton className="h-8 w-16" /> : totalItems}
                </div>
            </div>
            <div className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 rounded-xl p-4 border border-blue-200">
                <div className="flex items-center gap-2 mb-1">
                    <GraduationCap className="h-4 w-4 text-blue-600" />
                    <span className="text-xs font-medium text-blue-600">Боловсрол</span>
                </div>
                <div className="text-2xl font-bold text-blue-600">
                    {isLoading ? <Skeleton className="h-8 w-12" /> : 
                        (dataMap['countries']?.length || 0) + 
                        (dataMap['schools']?.length || 0) + 
                        (dataMap['degrees']?.length || 0) + 
                        (dataMap['academicRanks']?.length || 0)
                    }
                </div>
            </div>
            <div className="bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 rounded-xl p-4 border border-emerald-200">
                <div className="flex items-center gap-2 mb-1">
                    <Languages className="h-4 w-4 text-emerald-600" />
                    <span className="text-xs font-medium text-emerald-600">Хэлнүүд</span>
                </div>
                <div className="text-2xl font-bold text-emerald-600">
                    {isLoading ? <Skeleton className="h-8 w-12" /> : dataMap['languages']?.length || 0}
                </div>
            </div>
            <div className="bg-gradient-to-br from-rose-500/10 to-rose-500/5 rounded-xl p-4 border border-rose-200">
                <div className="flex items-center gap-2 mb-1">
                    <Users className="h-4 w-4 text-rose-600" />
                    <span className="text-xs font-medium text-rose-600">Хамаарал</span>
                </div>
                <div className="text-2xl font-bold text-rose-600">
                    {isLoading ? <Skeleton className="h-8 w-12" /> : 
                        (dataMap['familyRelationships']?.length || 0) + 
                        (dataMap['emergencyRelationships']?.length || 0)
                    }
                </div>
            </div>
        </div>
    );
}

export default function QuestionnaireSettingsPage() {
    const [searchQuery, setSearchQuery] = React.useState('');
    const [activeTab, setActiveTab] = React.useState('all');

    // Data fetching
    const { data: countries, isLoading: loadingCountries } = useCollection<SimpleReferenceItem>(
        useMemoFirebase(({ firestore, companyPath }) => firestore ? tenantCollection(firestore, companyPath, 'questionnaireCountries') : null, [])
    );
    const { data: schools, isLoading: loadingSchools } = useCollection<SimpleReferenceItem>(
        useMemoFirebase(({ firestore, companyPath }) => firestore ? tenantCollection(firestore, companyPath, 'questionnaireSchools') : null, [])
    );
    const { data: degrees, isLoading: loadingDegrees } = useCollection<SimpleReferenceItem>(
        useMemoFirebase(({ firestore, companyPath }) => firestore ? tenantCollection(firestore, companyPath, 'questionnaireDegrees') : null, [])
    );
    const { data: academicRanks, isLoading: loadingRanks } = useCollection<SimpleReferenceItem>(
        useMemoFirebase(({ firestore, companyPath }) => firestore ? tenantCollection(firestore, companyPath, 'questionnaireAcademicRanks') : null, [])
    );
    const { data: languages, isLoading: loadingLanguages } = useCollection<SimpleReferenceItem>(
        useMemoFirebase(({ firestore, companyPath }) => firestore ? tenantCollection(firestore, companyPath, 'questionnaireLanguages') : null, [])
    );
    const { data: familyRelationships, isLoading: loadingFamilyR } = useCollection<SimpleReferenceItem>(
        useMemoFirebase(({ firestore, companyPath }) => firestore ? tenantCollection(firestore, companyPath, 'questionnaireFamilyRelationships') : null, [])
    );
    const { data: emergencyRelationships, isLoading: loadingEmergencyR } = useCollection<SimpleReferenceItem>(
        useMemoFirebase(({ firestore, companyPath }) => firestore ? tenantCollection(firestore, companyPath, 'questionnaireEmergencyRelationships') : null, [])
    );
    const { data: jobCategories, isLoading: loadingJobCat } = useFetchCollection<JobCategoryReferenceItem>(
        useMemoFirebase(({ firestore, companyPath }) => firestore ? tenantCollection(firestore, companyPath, 'jobCategories') : null, [])
    );

    const dataMap: Record<string, SimpleReferenceItem[] | null> = {
        countries,
        schools,
        degrees,
        academicRanks,
        languages,
        familyRelationships,
        emergencyRelationships,
        jobCategories: jobCategories as SimpleReferenceItem[] | null,
    };

    const loadingMap: Record<string, boolean> = {
        countries: loadingCountries,
        schools: loadingSchools,
        degrees: loadingDegrees,
        academicRanks: loadingRanks,
        languages: loadingLanguages,
        familyRelationships: loadingFamilyR,
        emergencyRelationships: loadingEmergencyR,
        jobCategories: loadingJobCat,
    };

    // Filter categories based on search and tab
    const filteredCategories = React.useMemo(() => {
        let filtered = CATEGORIES;

        // Filter by tab
        if (activeTab !== 'all') {
            const tab = TABS.find(t => t.id === activeTab);
            if (tab?.categories) {
                filtered = filtered.filter(cat => tab.categories?.includes(cat.id));
            }
        }

        // Filter by search
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(cat => 
                cat.label.toLowerCase().includes(query) ||
                cat.description.toLowerCase().includes(query) ||
                dataMap[cat.id]?.some(item => item.name?.toLowerCase().includes(query))
            );
        }

        return filtered;
    }, [activeTab, searchQuery, dataMap]);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="space-y-1">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 shadow-lg shadow-violet-500/25">
                            <Sparkles className="h-5 w-5 text-white" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold tracking-tight text-slate-800">Анкетын лавлах сан</h2>
                            <p className="text-sm text-muted-foreground">
                                Ажилтны анкетын сонголттой талбаруудыг удирдах
                            </p>
                        </div>
                    </div>
                </div>
                
                {/* Search */}
                <div className="relative w-full md:w-80">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Лавлах сангаас хайх..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9 h-10"
                    />
                </div>
            </div>

            {/* Quick Stats */}
            <QuickStats categories={CATEGORIES} dataMap={dataMap} loadingMap={loadingMap} />

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
                <div className="bg-white rounded-xl border p-1.5 mb-6 overflow-x-auto no-scrollbar">
                    <VerticalTabMenu
                        orientation="horizontal"
                        className="flex-wrap gap-2"
                        triggerClassName="text-sm"
                        items={TABS.map((tab) => ({ value: tab.id, label: tab.label }))}
                    />
                </div>

                {/* Content */}
                <TabsContent value={activeTab} className="mt-0">
                    {filteredCategories.length === 0 ? (
                        <div className="bg-white rounded-xl border p-12 text-center">
                            <Search className="h-10 w-10 text-slate-200 mx-auto mb-3" />
                            <p className="text-sm text-slate-500">
                                "{searchQuery}" хайлтаар илэрц олдсонгүй
                            </p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {filteredCategories.map((category) => (
                                <CategoryCard
                                    key={category.id}
                                    category={category}
                                    data={dataMap[category.id]}
                                    isLoading={loadingMap[category.id]}
                                />
                            ))}
                        </div>
                    )}
                </TabsContent>
            </Tabs>
        </div>
    );
}
