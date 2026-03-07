'use client';

import { getJsonAuthHeaders } from '@/lib/api/client-auth';
import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { AddActionButton } from '@/components/ui/add-action-button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import {
    X,
    Target,
    MapPin,
    GraduationCap,
    Award,
    FileText,
    Clock,
    Download,
    Trash2,
    Sparkles,
    Loader2,
    Briefcase,
    BookOpen
} from 'lucide-react';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Position } from '../../../types';
import { doc, collection, addDoc, query, orderBy } from 'firebase/firestore';
import { useFirebase, updateDocumentNonBlocking, useCollection, useTenantWrite } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { format } from 'date-fns';
import { FieldCard, LabeledInput } from '@/components/organization/field-card';

interface PositionCompetencyProps {
    position: Position;
    departmentName?: string;
    levelName?: string;
}

interface Skill {
    name: string;
    level: 'beginner' | 'intermediate' | 'advanced' | 'expert';
}

interface Responsibility {
    title: string;
    description: string;
}

const SKILL_LEVEL_LABELS: Record<string, string> = {
    beginner: 'Анхан шат',
    intermediate: 'Дунд шат',
    advanced: 'Ахисан шат',
    expert: 'Мэргэшсэн'
};

const EDUCATION_LABELS: Record<string, string> = {
    none: 'Шаардлагагүй',
    diploma: 'Диплом',
    bachelor: 'Бакалавр',
    master: 'Магистр',
    doctorate: 'Доктор'
};

export function PositionCompetency({
    position,
    departmentName,
    levelName
}: PositionCompetencyProps) {
    const { firestore, storage } = useFirebase();
    const { tDoc, tCollection } = useTenantWrite();
    const { toast } = useToast();
    const [isGenerating, setIsGenerating] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // Edit states for each field
    const [editPurpose, setEditPurpose] = useState(position.purpose || '');
    const [editResponsibilities, setEditResponsibilities] = useState<Responsibility[]>(position.responsibilities || []);
    const [editSkills, setEditSkills] = useState<Skill[]>(position.skills || []);
    const [editTotalYears, setEditTotalYears] = useState(position.experience?.totalYears || 0);
    const [editLeadershipYears, setEditLeadershipYears] = useState(position.experience?.leadershipYears || 0);
    const [editEducationLevel, setEditEducationLevel] = useState(position.experience?.educationLevel || '');
    const [editProfessions, setEditProfessions] = useState<string[]>(position.experience?.professions || []);

    // Skill search
    const [skillSearch, setSkillSearch] = useState('');
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [selectedSkillLevel, setSelectedSkillLevel] = useState<string>('intermediate');
    const suggestionRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (suggestionRef.current && !suggestionRef.current.contains(event.target as Node)) {
                setShowSuggestions(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Sync edit states when position data changes (e.g., after AI generation)
    React.useEffect(() => {
        setEditPurpose(position.purpose || '');
        setEditResponsibilities(position.responsibilities || []);
        setEditSkills(position.skills || []);
        setEditTotalYears(position.experience?.totalYears || 0);
        setEditLeadershipYears(position.experience?.leadershipYears || 0);
        setEditEducationLevel(position.experience?.educationLevel || '');
        setEditProfessions(position.experience?.professions || []);
    }, [position]);

    const skillsInventoryQuery = useMemo(() =>
        firestore ? query(collection(firestore, 'skills_inventory'), orderBy('name', 'asc')) : null
        , [firestore]);

    const { data: skillsInventory } = useCollection<any>(skillsInventoryQuery);

    const skillTypesQuery = useMemo(() =>
        firestore ? collection(firestore, 'skill_types') : null
        , [firestore]);

    const { data: skillTypes } = useCollection<any>(skillTypesQuery);

    const skillTypeMap = useMemo(() => {
        const map = new Map<string, string>();
        skillTypes?.forEach((t: any) => map.set(t.id, t.name));
        return map;
    }, [skillTypes]);

    const filteredSuggestions = useMemo(() => {
        const available = skillsInventory?.filter(s =>
            !editSkills.some(existing => existing.name.toLowerCase() === s.name.toLowerCase())
        ) || [];
        if (!skillSearch) return available;
        return available.filter(s =>
            s.name.toLowerCase().includes(skillSearch.toLowerCase())
        );
    }, [skillSearch, skillsInventory, editSkills]);

    const groupedSuggestions = useMemo(() => {
        const groups: Record<string, typeof filteredSuggestions> = {};
        filteredSuggestions.forEach(s => {
            const group = (s.type && skillTypeMap.get(s.type)) || 'Бусад';
            if (!groups[group]) groups[group] = [];
            groups[group].push(s);
        });
        return groups;
    }, [filteredSuggestions, skillTypeMap]);

    // Save helpers
    const saveField = async (field: string, value: any) => {
        if (!firestore) return;
        await updateDocumentNonBlocking(tDoc('positions', position.id), {
            [field]: value,
            updatedAt: new Date().toISOString(),
        });
        toast({ title: 'Амжилттай хадгалагдлаа' });
    };

    // Reset edit states
    const resetEditStates = () => {
        setEditPurpose(position.purpose || '');
        setEditResponsibilities(position.responsibilities || []);
        setEditSkills(position.skills || []);
        setEditTotalYears(position.experience?.totalYears || 0);
        setEditLeadershipYears(position.experience?.leadershipYears || 0);
        setEditEducationLevel(position.experience?.educationLevel || '');
        setEditProfessions(position.experience?.professions || []);
    };

    // AI Generation
    const handleAIGenerate = async () => {
        if (!position.title) {
            toast({
                title: 'Анхааруулга',
                description: 'Ажлын байрны нэр оруулсны дараа AI үүсгэх боломжтой',
                variant: 'destructive'
            });
            return;
        }

        setIsGenerating(true);
        try {
            const response = await fetch('/api/generate-position-details', {
                method: 'POST',
                headers: await getJsonAuthHeaders(),
                body: JSON.stringify({
                    positionTitle: position.title,
                    departmentName,
                    levelName
                }),
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'AI үүсгэхэд алдаа гарлаа');
            }

            if (!firestore) return;

            // Reconcile AI-generated skills with the skills inventory
            const generatedSkills: Skill[] = result.data.skills || [];
            const reconciledSkills: Skill[] = [];
            const existingNames = new Set(
                (skillsInventory || []).map((s: any) => s.name.toLowerCase())
            );

            for (const genSkill of generatedSkills) {
                const genNameLower = genSkill.name.toLowerCase().trim();

                // Find a matching skill in inventory (case-insensitive)
                const inventoryMatch = (skillsInventory || []).find(
                    (s: any) => s.name.toLowerCase().trim() === genNameLower
                );

                if (inventoryMatch) {
                    // Use the exact name from inventory
                    reconciledSkills.push({ name: inventoryMatch.name, level: genSkill.level });
                } else {
                    // Use AI name as-is and create new inventory entry
                    reconciledSkills.push({ name: genSkill.name, level: genSkill.level });
                    if (!existingNames.has(genNameLower)) {
                        existingNames.add(genNameLower);
                        try {
                            await addDoc(tCollection('skills_inventory'), {
                                name: genSkill.name,
                                createdAt: new Date().toISOString(),
                            });
                        } catch (e) {
                            console.error('Error adding AI skill to inventory:', e);
                        }
                    }
                }
            }

            // Save all generated content with reconciled skills
            await updateDocumentNonBlocking(tDoc('positions', position.id), {
                purpose: result.data.purpose || '',
                responsibilities: result.data.responsibilities || [],
                skills: reconciledSkills,
                experience: {
                    totalYears: result.data.experience?.totalYears || 0,
                    leadershipYears: result.data.experience?.leadershipYears || 0,
                    educationLevel: result.data.experience?.educationLevel || '',
                    professions: result.data.experience?.professions || [],
                },
                updatedAt: new Date().toISOString(),
            });

            toast({
                title: 'AI үүсгэлт амжилттай',
                description: `${reconciledSkills.length} ур чадвар (${reconciledSkills.length - generatedSkills.filter(g => !(skillsInventory || []).some((s: any) => s.name.toLowerCase().trim() === g.name.toLowerCase().trim())).length} сангаас, ${generatedSkills.filter(g => !(skillsInventory || []).some((s: any) => s.name.toLowerCase().trim() === g.name.toLowerCase().trim())).length} шинээр үүсгэсэн)`
            });
        } catch (error) {
            console.error('AI generation error:', error);
            toast({
                title: 'Алдаа',
                description: error instanceof Error ? error.message : 'AI үүсгэхэд алдаа гарлаа',
                variant: 'destructive',
            });
        } finally {
            setIsGenerating(false);
        }
    };

    // Skill handlers
    const handleAddSkill = async (name: string, level: string) => {
        if (!name) return;
        setEditSkills(prev => [...prev, { name, level: level as any }]);

        // Add to global inventory if it doesn't exist
        if (firestore && skillsInventory) {
            const exists = skillsInventory.some(s => s.name.toLowerCase() === name.toLowerCase());
            if (!exists) {
                try {
                    await addDoc(tCollection('skills_inventory'), {
                        name,
                        createdAt: new Date().toISOString(),
                    });
                } catch (e) {
                    console.error("Error adding to inventory:", e);
                }
            }
        }
    };

    // File upload
    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !firestore) return;

        setIsSaving(true);
        try {
            const fileRef = ref(storage, `positions/${position.id}/jd/${file.name}`);
            await uploadBytes(fileRef, file);
            const url = await getDownloadURL(fileRef);

            await updateDocumentNonBlocking(tDoc('positions', position.id), {
                jobDescriptionFile: {
                    name: file.name,
                    url,
                    size: file.size,
                    uploadedAt: new Date().toISOString()
                }
            });
            toast({ title: "JD Файл амжилттай хавсаргагдлаа" });
        } catch (e) {
            toast({ title: "Файл хуулахад алдаа гарлаа", variant: "destructive" });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* AI Generate Button */}
            <div className="flex justify-end">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={handleAIGenerate}
                    disabled={isGenerating || !position.title}
                    className="h-9 gap-2 bg-gradient-to-r from-violet-50 to-indigo-50 border-violet-200 hover:from-violet-100 hover:to-indigo-100 text-violet-700"
                >
                    {isGenerating ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                        <Sparkles className="w-4 h-4" />
                    )}
                    AI-р бүгдийг үүсгэх
                </Button>
            </div>

            {/* Field Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Зорилго */}
                <FieldCard
                    icon={Target}
                    title="Ажлын байрны зорилго"
                    value={position.purpose ? (
                        <span className="line-clamp-2">{position.purpose}</span>
                    ) : 'Тодорхойлоогүй'}
                    isEmpty={!position.purpose}
                    className="lg:col-span-2"
                    editContent={
                        <LabeledInput label="Ажлын байрны зорилго">
                            <Textarea
                                value={editPurpose}
                                onChange={(e) => setEditPurpose(e.target.value)}
                                placeholder="Энэхүү ажлын байрны үндсэн зорилгыг тодорхойлно уу..."
                                className="min-h-[150px] rounded-xl"
                            />
                        </LabeledInput>
                    }
                    onSave={async () => {
                        await saveField('purpose', editPurpose);
                    }}
                />

                {/* Чиг үүрэг */}
                <FieldCard
                    icon={MapPin}
                    title="Үндсэн чиг үүрэг"
                    value={
                        position.responsibilities?.length
                            ? `${position.responsibilities.length} чиг үүрэг`
                            : 'Бүртгэгдээгүй'
                    }
                    isEmpty={!position.responsibilities?.length}
                    editContent={
                        <div className="space-y-4 max-h-[400px] overflow-y-auto">
                            {editResponsibilities.map((res, i) => (
                                <div key={i} className="p-4 rounded-xl border bg-slate-50 dark:bg-slate-800 space-y-2">
                                    <div className="flex items-center justify-between">
                                        <Input
                                            value={res.title}
                                            onChange={(e) => {
                                                const newList = [...editResponsibilities];
                                                newList[i] = { ...newList[i], title: e.target.value };
                                                setEditResponsibilities(newList);
                                            }}
                                            placeholder="Чиг үүргийн нэр"
                                            className="border-none bg-transparent p-0 h-auto font-semibold focus-visible:ring-0"
                                        />
                                        <button
                                            onClick={() => setEditResponsibilities(prev => prev.filter((_, idx) => idx !== i))}
                                            className="text-slate-400 hover:text-destructive"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                    <Textarea
                                        value={res.description}
                                        onChange={(e) => {
                                            const newList = [...editResponsibilities];
                                            newList[i] = { ...newList[i], description: e.target.value };
                                            setEditResponsibilities(newList);
                                        }}
                                        placeholder="Дэлгэрэнгүй тайлбар..."
                                        className="min-h-[60px] border-none bg-transparent p-0 text-sm resize-none focus-visible:ring-0"
                                    />
                                </div>
                            ))}
                            <div className="flex justify-end">
                                <AddActionButton
                                    label="Чиг үүрэг нэмэх"
                                    description="Шинэ чиг үүргийн мөр нэмэх"
                                    onClick={() => setEditResponsibilities(prev => [...prev, { title: '', description: '' }])}
                                />
                            </div>
                        </div>
                    }
                    onSave={async () => {
                        await saveField('responsibilities', editResponsibilities.filter(r => r.title));
                    }}
                />

                {/* Ур чадвар */}
                <FieldCard
                    icon={Award}
                    title="Ур чадварын шаардлага"
                    value={
                        position.skills?.length
                            ? `${position.skills.length} ур чадвар`
                            : 'Бүртгэгдээгүй'
                    }
                    isEmpty={!position.skills?.length}
                    className="lg:col-span-2"
                    editContent={
                        <div className="space-y-3">
                            <div className="max-h-[200px] overflow-y-auto rounded-lg border bg-slate-50 dark:bg-slate-800 p-3">
                                <div className="flex flex-wrap gap-1.5">
                                    {editSkills.map((skill, i) => (
                                        <span
                                            key={i}
                                            className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-white dark:bg-slate-700 border text-xs group"
                                        >
                                            <span className="font-medium text-foreground">{skill.name}</span>
                                            <span className="text-[9px] text-muted-foreground font-semibold uppercase">
                                                {skill.level === 'beginner' ? 'А' : skill.level === 'intermediate' ? 'Д' : skill.level === 'advanced' ? 'Г' : 'М'}
                                            </span>
                                            <button
                                                onClick={() => setEditSkills(prev => prev.filter((_, idx) => idx !== i))}
                                                className="ml-0.5 p-0.5 hover:bg-destructive/10 hover:text-destructive rounded opacity-50 group-hover:opacity-100"
                                            >
                                                <X className="w-3 h-3" />
                                            </button>
                                        </span>
                                    ))}
                                    {editSkills.length === 0 && (
                                        <span className="text-xs text-muted-foreground italic py-1">Ур чадвар нэмээгүй...</span>
                                    )}
                                </div>
                            </div>
                            <div className="text-[10px] text-muted-foreground px-1">
                                А = Анхан, Д = Дунд, Г = Гүнзгий, М = Мэргэшсэн
                            </div>
                            <div className="flex gap-2" ref={suggestionRef}>
                                <div className="flex-1 relative">
                                    <Input
                                        placeholder="Ур чадварын нэр..."
                                        className="h-10 rounded-lg text-sm"
                                        value={skillSearch}
                                        onChange={(e) => {
                                            setSkillSearch(e.target.value);
                                            setShowSuggestions(true);
                                        }}
                                        onFocus={() => setShowSuggestions(true)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && skillSearch) {
                                                handleAddSkill(skillSearch, selectedSkillLevel);
                                                setSkillSearch('');
                                            }
                                        }}
                                    />
                                    {showSuggestions && filteredSuggestions.length > 0 && (
                                        <div className="absolute z-50 bottom-full mb-2 left-0 right-0 bg-white dark:bg-slate-800 border rounded-lg shadow-lg overflow-hidden">
                                            <div className="px-3 py-1.5 text-[10px] font-bold text-muted-foreground uppercase bg-slate-50 dark:bg-slate-700 border-b flex items-center justify-between">
                                                <span>Ур чадварын сан</span>
                                                <span className="text-[9px] font-normal normal-case">{filteredSuggestions.length} ур чадвар</span>
                                            </div>
                                            <div className="max-h-[240px] overflow-y-auto">
                                                {Object.entries(groupedSuggestions).map(([category, skills]) => (
                                                    <div key={category}>
                                                        <div className="px-3 py-1 text-[10px] font-semibold text-muted-foreground bg-slate-50/50 dark:bg-slate-700/50 border-b border-t sticky top-0">
                                                            {category}
                                                        </div>
                                                        {skills.map((s, idx) => (
                                                            <button
                                                                key={`${category}-${idx}`}
                                                                className="w-full text-left px-3 py-2 text-sm hover:bg-indigo-50 dark:hover:bg-slate-700 flex items-center gap-2 transition-colors"
                                                                onClick={() => {
                                                                    handleAddSkill(s.name, selectedSkillLevel);
                                                                    setSkillSearch('');
                                                                    setShowSuggestions(false);
                                                                }}
                                                            >
                                                                <span className="flex-1">
                                                                    {skillSearch ? (
                                                                        (() => {
                                                                            const lowerName = s.name.toLowerCase();
                                                                            const lowerSearch = skillSearch.toLowerCase();
                                                                            const matchIdx = lowerName.indexOf(lowerSearch);
                                                                            if (matchIdx === -1) return s.name;
                                                                            return (
                                                                                <>
                                                                                    {s.name.slice(0, matchIdx)}
                                                                                    <span className="font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 rounded px-0.5">
                                                                                        {s.name.slice(matchIdx, matchIdx + skillSearch.length)}
                                                                                    </span>
                                                                                    {s.name.slice(matchIdx + skillSearch.length)}
                                                                                </>
                                                                            );
                                                                        })()
                                                                    ) : s.name}
                                                                </span>
                                                                {s.description && (
                                                                    <span className="text-[10px] text-muted-foreground truncate max-w-[120px]">{s.description}</span>
                                                                )}
                                                            </button>
                                                        ))}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <Select value={selectedSkillLevel} onValueChange={setSelectedSkillLevel}>
                                    <SelectTrigger className="w-24 h-10 rounded-lg text-xs">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="beginner">Анхан</SelectItem>
                                        <SelectItem value="intermediate">Дунд</SelectItem>
                                        <SelectItem value="advanced">Гүнзгий</SelectItem>
                                        <SelectItem value="expert">Мэргэшсэн</SelectItem>
                                    </SelectContent>
                                </Select>
                                <Button
                                    onClick={() => {
                                        if (skillSearch) {
                                            handleAddSkill(skillSearch, selectedSkillLevel);
                                            setSkillSearch('');
                                        }
                                    }}
                                    className="h-10 px-4 rounded-lg"
                                >
                                    Нэмэх
                                </Button>
                            </div>
                        </div>
                    }
                    onSave={async () => {
                        await saveField('skills', editSkills);
                    }}
                />

                {/* Нийт туршлага */}
                <FieldCard
                    icon={Briefcase}
                    title="Нийт ажлын туршлага"
                    value={
                        position.experience?.totalYears
                            ? `${position.experience.totalYears} жил`
                            : 'Заагаагүй'
                    }
                    isEmpty={!position.experience?.totalYears}
                    editContent={
                        <LabeledInput label="Нийт ажлын туршлага (жил)">
                            <Input
                                type="number"
                                min="0"
                                value={editTotalYears}
                                onChange={(e) => setEditTotalYears(Number(e.target.value))}
                                className="h-12 rounded-xl"
                            />
                        </LabeledInput>
                    }
                    onSave={async () => {
                        if (!firestore) return;
                        await updateDocumentNonBlocking(tDoc('positions', position.id), {
                            'experience.totalYears': editTotalYears,
                            updatedAt: new Date().toISOString(),
                        });
                        toast({ title: 'Амжилттай хадгалагдлаа' });
                    }}
                />

                {/* Удирдах туршлага */}
                <FieldCard
                    icon={Clock}
                    title="Удирдах ажлын туршлага"
                    value={
                        position.experience?.leadershipYears
                            ? `${position.experience.leadershipYears} жил`
                            : 'Шаардлагагүй'
                    }
                    editContent={
                        <LabeledInput label="Удирдах ажлын туршлага (жил)">
                            <Input
                                type="number"
                                min="0"
                                value={editLeadershipYears}
                                onChange={(e) => setEditLeadershipYears(Number(e.target.value))}
                                className="h-12 rounded-xl"
                            />
                        </LabeledInput>
                    }
                    onSave={async () => {
                        if (!firestore) return;
                        await updateDocumentNonBlocking(tDoc('positions', position.id), {
                            'experience.leadershipYears': editLeadershipYears,
                            updatedAt: new Date().toISOString(),
                        });
                        toast({ title: 'Амжилттай хадгалагдлаа' });
                    }}
                />

                {/* Боловсрол */}
                <FieldCard
                    icon={GraduationCap}
                    title="Боловсролын зэрэг"
                    value={
                        position.experience?.educationLevel
                            ? EDUCATION_LABELS[position.experience.educationLevel] || position.experience.educationLevel
                            : 'Заагаагүй'
                    }
                    isEmpty={!position.experience?.educationLevel}
                    editContent={
                        <LabeledInput label="Боловсролын зэрэг">
                            <Select value={editEducationLevel || 'none'} onValueChange={setEditEducationLevel}>
                                <SelectTrigger className="h-12 rounded-xl">
                                    <SelectValue placeholder="Сонгох..." />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">Шаардлагагүй</SelectItem>
                                    <SelectItem value="diploma">Диплом</SelectItem>
                                    <SelectItem value="bachelor">Бакалавр</SelectItem>
                                    <SelectItem value="master">Магистр</SelectItem>
                                    <SelectItem value="doctorate">Доктор</SelectItem>
                                </SelectContent>
                            </Select>
                        </LabeledInput>
                    }
                    onSave={async () => {
                        if (!firestore) return;
                        await updateDocumentNonBlocking(tDoc('positions', position.id), {
                            'experience.educationLevel': editEducationLevel === 'none' ? '' : editEducationLevel,
                            updatedAt: new Date().toISOString(),
                        });
                        toast({ title: 'Амжилттай хадгалагдлаа' });
                    }}
                />

                {/* Мэргэжлүүд */}
                <FieldCard
                    icon={BookOpen}
                    title="Мэргэжлүүд"
                    value={
                        position.experience?.professions?.length
                            ? `${position.experience.professions.length} мэргэжил`
                            : 'Заагаагүй'
                    }
                    isEmpty={!position.experience?.professions?.length}
                    className="lg:col-span-2"
                    editContent={
                        <div className="space-y-3">
                            <div className="max-h-[200px] overflow-y-auto rounded-lg border bg-slate-50 dark:bg-slate-800 p-3">
                                <div className="flex flex-wrap gap-1.5">
                                    {editProfessions.map((prof, i) => (
                                        <span
                                            key={i}
                                            className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-primary/10 text-primary text-xs group"
                                        >
                                            <span className="font-medium">{prof}</span>
                                            <button
                                                onClick={() => setEditProfessions(prev => prev.filter((_, idx) => idx !== i))}
                                                className="ml-0.5 p-0.5 hover:bg-primary/20 rounded opacity-50 group-hover:opacity-100"
                                            >
                                                <X className="w-3 h-3" />
                                            </button>
                                        </span>
                                    ))}
                                    {editProfessions.length === 0 && (
                                        <span className="text-xs text-muted-foreground italic py-1">Мэргэжил нэмээгүй...</span>
                                    )}
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <Input
                                    id="prof-input"
                                    placeholder="Жишээ: Программ хангамж"
                                    className="h-10 rounded-lg flex-1 text-sm"
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            const val = (e.target as HTMLInputElement).value.trim();
                                            if (val) {
                                                setEditProfessions(prev => [...prev, val]);
                                                (e.target as HTMLInputElement).value = '';
                                            }
                                        }
                                    }}
                                />
                                <Button
                                    variant="outline"
                                    className="h-10 px-4 rounded-lg"
                                    onClick={() => {
                                        const input = document.getElementById('prof-input') as HTMLInputElement;
                                        const val = input.value.trim();
                                        if (val) {
                                            setEditProfessions(prev => [...prev, val]);
                                            input.value = '';
                                        }
                                    }}
                                >
                                    Нэмэх
                                </Button>
                            </div>
                        </div>
                    }
                    onSave={async () => {
                        if (!firestore) return;
                        await updateDocumentNonBlocking(tDoc('positions', position.id), {
                            'experience.professions': editProfessions,
                            updatedAt: new Date().toISOString(),
                        });
                        toast({ title: 'Амжилттай хадгалагдлаа' });
                    }}
                />

                {/* JD Файл */}
                <FieldCard
                    icon={FileText}
                    title="Хавсралт файл"
                    value={
                        position.jobDescriptionFile
                            ? position.jobDescriptionFile.name
                            : 'Файл хавсаргаагүй'
                    }
                    isEmpty={!position.jobDescriptionFile}
                    hideFooter
                    editContent={(closeDialog) => (
                        <div className="space-y-4">
                            {position.jobDescriptionFile ? (
                                <div className="p-4 rounded-xl border bg-slate-50 dark:bg-slate-800">
                                    <div className="flex items-center gap-4">
                                        <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                                            <FileText className="w-6 h-6" />
                                        </div>
                                        <div className="flex-1 min-w-0 space-y-1">
                                            <p className="text-sm font-semibold truncate">
                                                {position.jobDescriptionFile.name}
                                            </p>
                                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                                <span className="flex items-center gap-1">
                                                    <Clock className="w-3 h-3" />
                                                    {format(new Date(position.jobDescriptionFile.uploadedAt), 'yyyy.MM.dd')}
                                                </span>
                                                <span>
                                                    {(position.jobDescriptionFile.size / 1024 / 1024).toFixed(2)} MB
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex gap-2 mt-4">
                                        <Button variant="outline" size="sm" className="flex-1 rounded-lg" asChild>
                                            <a href={position.jobDescriptionFile.url} target="_blank" rel="noopener noreferrer">
                                                <Download className="w-4 h-4 mr-2" />
                                                Татах
                                            </a>
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="rounded-lg text-destructive hover:text-destructive hover:bg-destructive/10"
                                            onClick={async () => {
                                                if (!firestore) return;
                                                await updateDocumentNonBlocking(tDoc('positions', position.id), {
                                                    jobDescriptionFile: null
                                                });
                                                toast({ title: "Файл устгагдлаа" });
                                            }}
                                        >
                                            <Trash2 className="w-4 h-4 mr-2" />
                                            Устгах
                                        </Button>
                                    </div>
                                </div>
                            ) : (
                                <div className="relative group">
                                    <input
                                        type="file"
                                        onChange={async (e) => {
                                            await handleFileUpload(e);
                                            closeDialog();
                                        }}
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                        accept=".pdf,.doc,.docx"
                                    />
                                    <div className="py-10 flex flex-col items-center justify-center text-center rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 group-hover:border-primary/40 group-hover:bg-primary/5 transition-all">
                                        {isSaving ? (
                                            <>
                                                <Loader2 className="w-8 h-8 text-primary animate-spin mb-3" />
                                                <p className="text-sm font-medium text-primary">Файл хуулж байна...</p>
                                            </>
                                        ) : (
                                            <>
                                                <FileText className="w-8 h-8 text-muted-foreground mb-3 group-hover:text-primary transition-colors" />
                                                <p className="text-sm font-medium text-muted-foreground group-hover:text-primary transition-colors">
                                                    Файл сонгох
                                                </p>
                                                <p className="text-xs text-muted-foreground mt-1">PDF, DOC, DOCX</p>
                                            </>
                                        )}
                                    </div>
                                </div>
                            )}
                            <Button
                                variant="ghost"
                                className="w-full"
                                onClick={closeDialog}
                            >
                                Хаах
                            </Button>
                        </div>
                    )}
                />
            </div>
        </div>
    );
}
