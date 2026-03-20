'use client';

import * as React from 'react';
import { getJsonAuthHeaders } from '@/lib/api/client-auth';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import {
    Upload,
    FileText,
    Sparkles,
    CheckCircle2,
    AlertCircle,
    Loader2,
    X,
    Wand2,
    Brain,
    FileImage,
    User,
    Phone,
    GraduationCap,
    Languages,
    Briefcase,
    Award,
    Car,
    Check,
    Heart,
    ChevronLeft,
    ChevronRight,
    Trash2,
    Info,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Types ───────────────────────────────────────────────────────────────────

interface ParsedCVData {
    lastName?: string;
    firstName?: string;
    registrationNumber?: string;
    birthDate?: string;
    gender?: string;
    idCardNumber?: string;
    personalPhone?: string;
    personalEmail?: string;
    homeAddress?: string;
    maritalStatus?: string;
    education?: Array<{
        country?: string;
        school?: string;
        degree?: string;
        academicRank?: string;
        entryDate?: string;
        gradDate?: string;
        diplomaNumber?: string;
        isCurrent?: boolean;
        _originalSchool?: string;
        _originalDegree?: string;
        _originalAcademicRank?: string;
        _originalCountry?: string;
    }>;
    languages?: Array<{
        language?: string;
        listening?: string;
        reading?: string;
        speaking?: string;
        writing?: string;
        testScore?: string;
        _originalLanguage?: string;
    }>;
    trainings?: Array<{
        name?: string;
        organization?: string;
        startDate?: string;
        endDate?: string;
        certificateNumber?: string;
    }>;
    experiences?: Array<{
        company?: string;
        position?: string;
        startDate?: string;
        endDate?: string;
        description?: string;
        isCurrent?: boolean;
    }>;
    hasDriversLicense?: boolean;
    driverLicenseCategories?: string[];
}

interface ReferenceItem {
    id: string;
    name: string;
}

interface ReferenceData {
    countries?: ReferenceItem[];
    schools?: ReferenceItem[];
    degrees?: ReferenceItem[];
    academicRanks?: ReferenceItem[];
    languages?: ReferenceItem[];
}

interface CVUploadDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onDataExtracted: (data: ParsedCVData) => Promise<boolean> | boolean;
    references: ReferenceData;
}

// ─── Constants ───────────────────────────────────────────────────────────────

type ProcessingStep = 'idle' | 'uploading' | 'analyzing' | 'extracting' | 'wizard' | 'complete' | 'error';

const STEP_MESSAGES: Record<string, string> = {
    idle: 'CV файлаа сонгоно уу',
    uploading: 'Файл уншиж байна...',
    analyzing: 'AI CV-г шинжилж байна...',
    extracting: 'Мэдээлэл задалж байна...',
};

const PROFICIENCY_LEVELS = ['Анхан', 'Дунд', 'Ахисан', 'Мэргэжлийн'];
const MARITAL_STATUSES = ['Гэрлээгүй', 'Гэрлэсэн', 'Салсан', 'Бэлэвсэн'];
const DRIVER_CATEGORIES = ['A', 'B', 'C', 'D', 'E', 'M'];

interface WizardStepDef {
    id: string;
    label: string;
    icon: React.ElementType;
    color: string;
}

const ALL_WIZARD_STEPS: WizardStepDef[] = [
    { id: 'general', label: 'Ерөнхий', icon: User, color: 'text-blue-600' },
    { id: 'contact', label: 'Холбоо барих', icon: Phone, color: 'text-green-600' },
    { id: 'education', label: 'Боловсрол', icon: GraduationCap, color: 'text-purple-600' },
    { id: 'language', label: 'Хэл', icon: Languages, color: 'text-amber-600' },
    { id: 'training', label: 'Мэргэшил', icon: Award, color: 'text-rose-600' },
    { id: 'family', label: 'Гэр бүл', icon: Heart, color: 'text-pink-600' },
    { id: 'experience', label: 'Туршлага', icon: Briefcase, color: 'text-indigo-600' },
];

// ─── Fuzzy Matching ──────────────────────────────────────────────────────────

function fuzzyMatchReference(input: string, items: ReferenceItem[]): string | null {
    if (!input || !items || items.length === 0) return null;
    const normalizedInput = input.trim();
    const normalizedInputLower = normalizedInput.toLowerCase();
    const names = items.map(i => i.name);

    // 1. Exact match (case-insensitive)
    const exact = names.find(n => n.toLowerCase() === normalizedInputLower);
    if (exact) return exact;

    // 2. Abbreviation match: input full name → reference abbreviation
    // e.g. "Шинжлэх Ухаан Технологийн Их Сургууль" → "ШУТИС"
    const inputWords = normalizedInput.split(/\s+/).filter(w => w.length > 0);
    if (inputWords.length >= 2) {
        const inputAbbrev = inputWords.map(w => w[0]).join('').toUpperCase();
        const abbrevMatch = names.find(n => n.toUpperCase() === inputAbbrev);
        if (abbrevMatch) return abbrevMatch;
    }

    // 3. Reverse: reference full name → check if input is its abbreviation
    // e.g. input "ШУТИС" → reference "Шинжлэх Ухаан Технологийн Их Сургууль"
    if (normalizedInput.length >= 2 && normalizedInput.length <= 8 && !/\s/.test(normalizedInput)) {
        const inputUpper = normalizedInput.toUpperCase();
        const reverseMatch = names.find(n => {
            const nWords = n.split(/\s+/).filter(w => w.length > 0);
            if (nWords.length < 2) return false;
            const nAbbrev = nWords.map(w => w[0]).join('').toUpperCase();
            return nAbbrev === inputUpper;
        });
        if (reverseMatch) return reverseMatch;
    }

    // 4. Contains match
    const containsMatch = names.find(n =>
        n.toLowerCase().includes(normalizedInputLower) ||
        normalizedInputLower.includes(n.toLowerCase())
    );
    if (containsMatch) return containsMatch;

    // 5. Word overlap (Jaccard-like similarity)
    const inputWordSet = new Set(normalizedInputLower.split(/\s+/).filter(w => w.length > 1));
    let bestMatch: string | null = null;
    let bestScore = 0;

    for (const name of names) {
        const nameWordSet = new Set(name.toLowerCase().split(/\s+/).filter(w => w.length > 1));
        const intersection = [...inputWordSet].filter(w => nameWordSet.has(w)).length;
        const union = new Set([...inputWordSet, ...nameWordSet]).size;
        const score = union > 0 ? intersection / union : 0;

        if (score > bestScore && score >= 0.25) {
            bestScore = score;
            bestMatch = name;
        }
    }

    return bestMatch;
}

/** Pre-process extracted data: fuzzy-match reference fields and store originals */
function matchReferences(data: ParsedCVData, refs: ReferenceData): ParsedCVData {
    const result: ParsedCVData = { ...data };

    if (result.education) {
        result.education = result.education.map(edu => {
            const matched: any = { ...edu };
            if (edu.school && refs.schools?.length) {
                const m = fuzzyMatchReference(edu.school, refs.schools);
                if (m && m !== edu.school) {
                    matched._originalSchool = edu.school;
                    matched.school = m;
                }
            }
            if (edu.degree && refs.degrees?.length) {
                const m = fuzzyMatchReference(edu.degree, refs.degrees);
                if (m && m !== edu.degree) {
                    matched._originalDegree = edu.degree;
                    matched.degree = m;
                }
            }
            if (edu.academicRank && refs.academicRanks?.length) {
                const m = fuzzyMatchReference(edu.academicRank, refs.academicRanks);
                if (m && m !== edu.academicRank) {
                    matched._originalAcademicRank = edu.academicRank;
                    matched.academicRank = m;
                }
            }
            if (edu.country && refs.countries?.length) {
                const m = fuzzyMatchReference(edu.country, refs.countries);
                if (m && m !== edu.country) {
                    matched._originalCountry = edu.country;
                    matched.country = m;
                }
            }
            return matched;
        });
    }

    if (result.languages) {
        result.languages = result.languages.map(lang => {
            const matched: any = { ...lang };
            if (lang.language && refs.languages?.length) {
                const m = fuzzyMatchReference(lang.language, refs.languages);
                if (m && m !== lang.language) {
                    matched._originalLanguage = lang.language;
                    matched.language = m;
                }
            }
            return matched;
        });
    }

    return result;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const FormRow = ({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) => (
    <div className="space-y-1">
        <label className="text-xs font-medium text-slate-500">{label}</label>
        {children}
        {hint && <p className="text-[10px] text-amber-600 flex items-center gap-1"><Info className="h-3 w-3 shrink-0" /> AI таньсан: {hint}</p>}
    </div>
);

/** Build unique Select options: reference items + the AI extracted value (if not in list) */
function buildSelectOptions(refItems: ReferenceItem[] | undefined, currentValue: string | undefined, originalValue?: string): string[] {
    const names = (refItems || []).map(i => i.name);
    const extras: string[] = [];
    if (currentValue && !names.includes(currentValue)) extras.push(currentValue);
    if (originalValue && originalValue !== currentValue && !names.includes(originalValue)) extras.push(originalValue);
    return [...extras, ...names];
}

function hasStepData(stepId: string, data: ParsedCVData): boolean {
    switch (stepId) {
        case 'general':
            return !!(data.lastName || data.firstName || data.registrationNumber || data.birthDate || data.gender || data.idCardNumber || data.hasDriversLicense);
        case 'contact':
            return !!(data.personalPhone || data.personalEmail || data.homeAddress);
        case 'education':
            return !!(data.education && data.education.length > 0);
        case 'language':
            return !!(data.languages && data.languages.length > 0);
        case 'training':
            return !!(data.trainings && data.trainings.length > 0);
        case 'family':
            return !!(data.maritalStatus);
        case 'experience':
            return !!(data.experiences && data.experiences.length > 0);
        default:
            return false;
    }
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function CVUploadDialog({ open, onOpenChange, onDataExtracted, references }: CVUploadDialogProps) {
    const { toast } = useToast();
    const [file, setFile] = React.useState<File | null>(null);
    const [step, setStep] = React.useState<ProcessingStep>('idle');
    const [progress, setProgress] = React.useState(0);
    const [error, setError] = React.useState<string | null>(null);
    const [isApplying, setIsApplying] = React.useState(false);
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    // Wizard state
    const [wizardData, setWizardData] = React.useState<ParsedCVData>({});
    const [currentStepIndex, setCurrentStepIndex] = React.useState(0);
    const [activeSteps, setActiveSteps] = React.useState<WizardStepDef[]>([]);

    const resetState = () => {
        setFile(null);
        setStep('idle');
        setProgress(0);
        setError(null);
        setWizardData({});
        setCurrentStepIndex(0);
        setActiveSteps([]);
        setIsApplying(false);
    };

    const handleClose = () => {
        resetState();
        onOpenChange(false);
    };

    // ── File handling ──

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            const validTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
            if (!validTypes.includes(selectedFile.type)) {
                toast({ variant: 'destructive', title: 'Буруу файл төрөл', description: 'PDF, JPG, PNG, WEBP файл оруулна уу' });
                return;
            }
            if (selectedFile.size > 15 * 1024 * 1024) {
                toast({ variant: 'destructive', title: 'Файл хэт том', description: 'Файлын хэмжээ 15MB-аас бага байх ёстой' });
                return;
            }
            setFile(selectedFile);
            setError(null);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        const f = e.dataTransfer.files[0];
        if (f) {
            const validTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
            if (!validTypes.includes(f.type)) {
                toast({ variant: 'destructive', title: 'Буруу файл төрөл', description: 'PDF, JPG, PNG, WEBP файл оруулна уу' });
                return;
            }
            setFile(f);
            setError(null);
        }
    };

    // ── AI Processing ──

    const processCV = async () => {
        if (!file) return;
        try {
            setStep('uploading');
            setProgress(10);

            const dataUrl = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result as string);
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });

            setProgress(30);
            setStep('analyzing');

            const response = await fetch('/api/parse-cv', {
                method: 'POST',
                headers: await getJsonAuthHeaders(),
                body: JSON.stringify({ imageDataUrl: dataUrl, mimeType: file.type }),
            });

            setProgress(70);
            setStep('extracting');

            if (!response.ok) {
                let errorMessage = 'CV задлахад алдаа гарлаа';
                try {
                    const errorData = await response.json();
                    errorMessage = errorData.error || errorMessage;
                } catch {
                    // Ignore invalid error response body and use fallback text.
                }
                throw new Error(errorMessage);
            }

            const result = await response.json();
            setProgress(90);

            if (!result.success || !result.data) throw new Error('CV-ээс мэдээлэл олдсонгүй');

            // Pre-process: fuzzy match reference fields
            const rawData = result.data as ParsedCVData;
            const matched = matchReferences(rawData, references);

            // Determine which wizard steps have data
            const stepsWithData = ALL_WIZARD_STEPS.filter(s => hasStepData(s.id, matched));

            setWizardData(matched);
            setActiveSteps(stepsWithData);
            setCurrentStepIndex(0);
            setProgress(100);
            setStep('wizard');
        } catch (err) {
            console.warn('CV processing error:', err);
            setStep('error');
            setError(err instanceof Error ? err.message : 'CV задлахад алдаа гарлаа');
        }
    };

    // ── Wizard data helpers ──

    const updateField = (field: string, value: any) => {
        setWizardData(prev => ({ ...prev, [field]: value }));
    };

    const updateArrayItem = (arrayKey: string, index: number, updates: Record<string, any>) => {
        setWizardData(prev => {
            const arr = [...((prev as any)[arrayKey] || [])];
            arr[index] = { ...arr[index], ...updates };
            return { ...prev, [arrayKey]: arr };
        });
    };

    const removeArrayItem = (arrayKey: string, index: number) => {
        setWizardData(prev => {
            const arr = ((prev as any)[arrayKey] || []).filter((_: any, i: number) => i !== index);
            return { ...prev, [arrayKey]: arr };
        });
    };

    // ── Navigation ──

    const currentStep = activeSteps[currentStepIndex];
    const isFirstStep = currentStepIndex === 0;
    const isLastStep = currentStepIndex === activeSteps.length - 1;

    const goNext = () => {
        if (!isLastStep) setCurrentStepIndex(i => i + 1);
    };
    const goPrev = () => {
        if (!isFirstStep) setCurrentStepIndex(i => i - 1);
    };

    // ── Apply / Save ──

    const handleApply = async () => {
        // Strip internal _original* keys before sending
        const cleanData: ParsedCVData = { ...wizardData };
        if (cleanData.education) {
            cleanData.education = cleanData.education.map(({ _originalSchool, _originalDegree, _originalAcademicRank, _originalCountry, ...rest }) => rest);
        }
        if (cleanData.languages) {
            cleanData.languages = cleanData.languages.map(({ _originalLanguage, ...rest }) => rest);
        }

        setIsApplying(true);
        const saved = await onDataExtracted(cleanData);
        setIsApplying(false);

        if (!saved) return;

        setStep('complete');
        toast({ title: 'CV амжилттай задлагдлаа!', description: 'Мэдээлэл анкетэд оруулагдлаа' });
        setTimeout(() => handleClose(), 1200);
    };

    const isProcessing = ['uploading', 'analyzing', 'extracting'].includes(step);

    // ── Render step content ──

    const renderStepContent = () => {
        if (!currentStep) return null;

        switch (currentStep.id) {
            case 'general':
                return (
                    <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                            <FormRow label="Овог">
                                <Input value={wizardData.lastName || ''} onChange={e => updateField('lastName', e.target.value)} className="h-9" />
                            </FormRow>
                            <FormRow label="Нэр">
                                <Input value={wizardData.firstName || ''} onChange={e => updateField('firstName', e.target.value)} className="h-9" />
                            </FormRow>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <FormRow label="Регистрийн дугаар">
                                <Input value={wizardData.registrationNumber || ''} onChange={e => updateField('registrationNumber', e.target.value)} className="h-9 font-mono" />
                            </FormRow>
                            <FormRow label="ТТД">
                                <Input value={wizardData.idCardNumber || ''} onChange={e => updateField('idCardNumber', e.target.value)} className="h-9" />
                            </FormRow>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <FormRow label="Төрсөн огноо">
                                <Input type="date" value={wizardData.birthDate || ''} onChange={e => updateField('birthDate', e.target.value)} className="h-9" />
                            </FormRow>
                            <FormRow label="Хүйс">
                                <Select value={wizardData.gender || ''} onValueChange={v => updateField('gender', v)}>
                                    <SelectTrigger className="h-9"><SelectValue placeholder="Сонгох" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="male">Эрэгтэй</SelectItem>
                                        <SelectItem value="female">Эмэгтэй</SelectItem>
                                    </SelectContent>
                                </Select>
                            </FormRow>
                        </div>
                        {/* Driver's License */}
                        {wizardData.hasDriversLicense !== undefined && (
                            <div className="p-3 rounded-lg bg-slate-50 border space-y-2">
                                <div className="flex items-center gap-2">
                                    <Car className="h-4 w-4 text-slate-500" />
                                    <span className="text-xs font-medium text-slate-700">Жолооны үнэмлэх</span>
                                    <Badge variant="secondary" className="text-[10px] ml-auto">
                                        {wizardData.hasDriversLicense ? 'Тийм' : 'Үгүй'}
                                    </Badge>
                                </div>
                                {wizardData.hasDriversLicense && wizardData.driverLicenseCategories && (
                                    <div className="flex flex-wrap gap-1.5">
                                        {DRIVER_CATEGORIES.map(cat => {
                                            const isSelected = wizardData.driverLicenseCategories?.includes(cat);
                                            return (
                                                <button
                                                    key={cat}
                                                    type="button"
                                                    onClick={() => {
                                                        const current = wizardData.driverLicenseCategories || [];
                                                        updateField('driverLicenseCategories',
                                                            isSelected ? current.filter(c => c !== cat) : [...current, cat]
                                                        );
                                                    }}
                                                    className={cn(
                                                        "px-3 py-1 rounded-md border text-xs font-medium transition-all",
                                                        isSelected ? "bg-primary/10 border-primary text-primary" : "bg-white hover:bg-slate-50 text-slate-500"
                                                    )}
                                                >
                                                    {cat}
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                );

            case 'contact':
                return (
                    <div className="space-y-3">
                        <FormRow label="Хувийн утас">
                            <Input value={wizardData.personalPhone || ''} onChange={e => updateField('personalPhone', e.target.value)} className="h-9" />
                        </FormRow>
                        <FormRow label="И-мэйл">
                            <Input type="email" value={wizardData.personalEmail || ''} onChange={e => updateField('personalEmail', e.target.value)} className="h-9" />
                        </FormRow>
                        <FormRow label="Гэрийн хаяг">
                            <Input value={wizardData.homeAddress || ''} onChange={e => updateField('homeAddress', e.target.value)} className="h-9" />
                        </FormRow>
                    </div>
                );

            case 'education':
                return (
                    <div className="space-y-3">
                        {(wizardData.education || []).map((edu, i) => {
                            const schoolOptions = buildSelectOptions(references.schools, edu.school, edu._originalSchool);
                            const degreeOptions = buildSelectOptions(references.degrees, edu.degree, edu._originalDegree);
                            const rankOptions = buildSelectOptions(references.academicRanks, edu.academicRank, edu._originalAcademicRank);
                            const countryOptions = buildSelectOptions(references.countries, edu.country, edu._originalCountry);

                            return (
                                <div key={i} className="p-3 rounded-lg border bg-white relative group">
                                    <Button type="button" variant="ghost" size="icon" className="absolute top-1 right-1 h-7 w-7 opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500" onClick={() => removeArrayItem('education', i)}>
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                    <div className="text-[10px] font-medium text-slate-400 mb-2">Боловсрол #{i + 1}</div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <FormRow label="Улс" hint={edu._originalCountry}>
                                            <Select value={edu.country || ''} onValueChange={v => updateArrayItem('education', i, { country: v })}>
                                                <SelectTrigger className="h-9"><SelectValue placeholder="Сонгох" /></SelectTrigger>
                                                <SelectContent className="max-h-[200px]">
                                                    {countryOptions.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                        </FormRow>
                                        <FormRow label="Зэрэг" hint={edu._originalAcademicRank}>
                                            <Select value={edu.academicRank || ''} onValueChange={v => updateArrayItem('education', i, { academicRank: v })}>
                                                <SelectTrigger className="h-9"><SelectValue placeholder="Сонгох" /></SelectTrigger>
                                                <SelectContent className="max-h-[200px]">
                                                    {rankOptions.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                        </FormRow>
                                    </div>
                                    <div className="mt-2">
                                        <FormRow label="Сургууль" hint={edu._originalSchool}>
                                            <Select value={edu.school || ''} onValueChange={v => updateArrayItem('education', i, { school: v })}>
                                                <SelectTrigger className="h-9"><SelectValue placeholder="Сургууль сонгох" /></SelectTrigger>
                                                <SelectContent className="max-h-[200px]">
                                                    {schoolOptions.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                        </FormRow>
                                    </div>
                                    <div className="mt-2">
                                        <FormRow label="Мэргэжил" hint={edu._originalDegree}>
                                            <Select value={edu.degree || ''} onValueChange={v => updateArrayItem('education', i, { degree: v })}>
                                                <SelectTrigger className="h-9"><SelectValue placeholder="Мэргэжил сонгох" /></SelectTrigger>
                                                <SelectContent className="max-h-[200px]">
                                                    {degreeOptions.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                        </FormRow>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 mt-2">
                                        <FormRow label="Элссэн">
                                            <Input type="date" value={edu.entryDate || ''} onChange={e => updateArrayItem('education', i, { entryDate: e.target.value })} className="h-9" />
                                        </FormRow>
                                        <FormRow label="Төгссөн">
                                            <Input type="date" value={edu.gradDate || ''} onChange={e => updateArrayItem('education', i, { gradDate: e.target.value })} className="h-9" disabled={edu.isCurrent} />
                                        </FormRow>
                                    </div>
                                </div>
                            );
                        })}
                        {(!wizardData.education || wizardData.education.length === 0) && (
                            <p className="text-xs text-slate-400 text-center py-4">Боловсролын мэдээлэл олдсонгүй</p>
                        )}
                    </div>
                );

            case 'language':
                return (
                    <div className="space-y-3">
                        {(wizardData.languages || []).map((lang, i) => {
                            const langOptions = buildSelectOptions(references.languages, lang.language, lang._originalLanguage);
                            return (
                                <div key={i} className="p-3 rounded-lg border bg-white relative group">
                                    <Button type="button" variant="ghost" size="icon" className="absolute top-1 right-1 h-7 w-7 opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500" onClick={() => removeArrayItem('languages', i)}>
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                    <FormRow label="Хэл" hint={lang._originalLanguage}>
                                        <Select value={lang.language || ''} onValueChange={v => updateArrayItem('languages', i, { language: v })}>
                                            <SelectTrigger className="h-9"><SelectValue placeholder="Хэл сонгох" /></SelectTrigger>
                                            <SelectContent className="max-h-[200px]">
                                                {langOptions.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </FormRow>
                                    <div className="grid grid-cols-4 gap-2 mt-2">
                                        {(['listening', 'reading', 'speaking', 'writing'] as const).map(skill => (
                                            <FormRow key={skill} label={skill === 'listening' ? 'Сонсох' : skill === 'reading' ? 'Унших' : skill === 'speaking' ? 'Ярих' : 'Бичих'}>
                                                <Select value={(lang as any)[skill] || ''} onValueChange={v => updateArrayItem('languages', i, { [skill]: v })}>
                                                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="--" /></SelectTrigger>
                                                    <SelectContent>
                                                        {PROFICIENCY_LEVELS.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                                                    </SelectContent>
                                                </Select>
                                            </FormRow>
                                        ))}
                                    </div>
                                    <div className="mt-2">
                                        <FormRow label="Шалгалтын оноо">
                                            <Input value={lang.testScore || ''} onChange={e => updateArrayItem('languages', i, { testScore: e.target.value })} className="h-9" placeholder="IELTS 6.5, TOPIK 4..." />
                                        </FormRow>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                );

            case 'training':
                return (
                    <div className="space-y-3">
                        {(wizardData.trainings || []).map((t, i) => (
                            <div key={i} className="p-3 rounded-lg border bg-white relative group">
                                <Button type="button" variant="ghost" size="icon" className="absolute top-1 right-1 h-7 w-7 opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500" onClick={() => removeArrayItem('trainings', i)}>
                                    <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                                <div className="text-[10px] font-medium text-slate-400 mb-2">Сургалт #{i + 1}</div>
                                <div className="grid grid-cols-1 gap-2">
                                    <FormRow label="Сургалтын нэр">
                                        <Input value={t.name || ''} onChange={e => updateArrayItem('trainings', i, { name: e.target.value })} className="h-9" />
                                    </FormRow>
                                    <FormRow label="Байгууллага">
                                        <Input value={t.organization || ''} onChange={e => updateArrayItem('trainings', i, { organization: e.target.value })} className="h-9" />
                                    </FormRow>
                                </div>
                                <div className="grid grid-cols-2 gap-2 mt-2">
                                    <FormRow label="Эхэлсэн">
                                        <Input type="date" value={t.startDate || ''} onChange={e => updateArrayItem('trainings', i, { startDate: e.target.value })} className="h-9" />
                                    </FormRow>
                                    <FormRow label="Дууссан">
                                        <Input type="date" value={t.endDate || ''} onChange={e => updateArrayItem('trainings', i, { endDate: e.target.value })} className="h-9" />
                                    </FormRow>
                                </div>
                            </div>
                        ))}
                    </div>
                );

            case 'family':
                return (
                    <div className="space-y-3">
                        <FormRow label="Гэрлэлтийн байдал">
                            <Select value={wizardData.maritalStatus || ''} onValueChange={v => updateField('maritalStatus', v)}>
                                <SelectTrigger className="h-9"><SelectValue placeholder="Сонгох" /></SelectTrigger>
                                <SelectContent>
                                    {MARITAL_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </FormRow>
                    </div>
                );

            case 'experience':
                return (
                    <div className="space-y-3">
                        {(wizardData.experiences || []).map((exp, i) => (
                            <div key={i} className="p-3 rounded-lg border bg-white relative group">
                                <Button type="button" variant="ghost" size="icon" className="absolute top-1 right-1 h-7 w-7 opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500" onClick={() => removeArrayItem('experiences', i)}>
                                    <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="text-[10px] font-medium text-slate-400">Туршлага #{i + 1}</span>
                                    {exp.isCurrent && <Badge className="text-[9px] h-4 bg-emerald-100 text-emerald-700 border-0">Одоо ажиллаж байгаа</Badge>}
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <FormRow label="Компани">
                                        <Input value={exp.company || ''} onChange={e => updateArrayItem('experiences', i, { company: e.target.value })} className="h-9" />
                                    </FormRow>
                                    <FormRow label="Албан тушаал">
                                        <Input value={exp.position || ''} onChange={e => updateArrayItem('experiences', i, { position: e.target.value })} className="h-9" />
                                    </FormRow>
                                </div>
                                <div className="grid grid-cols-2 gap-2 mt-2">
                                    <FormRow label="Эхэлсэн">
                                        <Input type="date" value={exp.startDate || ''} onChange={e => updateArrayItem('experiences', i, { startDate: e.target.value })} className="h-9" />
                                    </FormRow>
                                    <FormRow label="Дууссан">
                                        <Input type="date" value={exp.endDate || ''} onChange={e => updateArrayItem('experiences', i, { endDate: e.target.value })} className="h-9" disabled={exp.isCurrent} />
                                    </FormRow>
                                </div>
                                {exp.description && (
                                    <div className="mt-2">
                                        <FormRow label="Тодорхойлолт">
                                            <Input value={exp.description || ''} onChange={e => updateArrayItem('experiences', i, { description: e.target.value })} className="h-9" />
                                        </FormRow>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                );

            default:
                return null;
        }
    };

    // ─── Render ──────────────────────────────────────────────────────────────

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className={cn("sm:max-w-md", step === 'wizard' && "sm:max-w-2xl")}>
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <div className="p-2 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600">
                            <Sparkles className="h-4 w-4 text-white" />
                        </div>
                        AI CV Уншигч
                    </DialogTitle>
                    <DialogDescription>
                        {step === 'wizard'
                            ? 'Мэдээллийг алхам бүрт шалгаж, засварлаад баталгаажуулна уу'
                            : 'CV файлаа upload хийхэд AI автоматаар задлан бөглөнө'
                        }
                    </DialogDescription>
                </DialogHeader>

                <div className="py-2">
                    {/* ── Upload ── */}
                    {step === 'idle' && (
                        <div
                            className={cn(
                                "border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer",
                                file ? "border-primary bg-primary/5" : "border-slate-200 hover:border-primary/50 hover:bg-slate-50"
                            )}
                            onClick={() => fileInputRef.current?.click()}
                            onDrop={handleDrop}
                            onDragOver={(e) => e.preventDefault()}
                        >
                            <input ref={fileInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={handleFileSelect} className="hidden" />
                            {file ? (
                                <div className="space-y-2">
                                    <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                                        <FileText className="h-6 w-6 text-primary" />
                                    </div>
                                    <p className="text-sm font-medium text-slate-800">{file.name}</p>
                                    <p className="text-xs text-slate-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                                    <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setFile(null); }}>
                                        <X className="h-4 w-4 mr-1" /> Арилгах
                                    </Button>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    <div className="mx-auto w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center">
                                        <Upload className="h-7 w-7 text-slate-400" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-slate-700">CV файлаа энд чирж оруулна уу</p>
                                        <p className="text-xs text-slate-500 mt-1">эсвэл дарж сонгоно уу</p>
                                    </div>
                                    <div className="flex items-center justify-center gap-2">
                                        <Badge variant="secondary" className="text-[10px]"><FileText className="h-3 w-3 mr-1" /> PDF</Badge>
                                        <Badge variant="secondary" className="text-[10px]"><FileImage className="h-3 w-3 mr-1" /> JPG/PNG</Badge>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── Processing ── */}
                    {isProcessing && (
                        <div className="space-y-4 py-4">
                            <div className="flex items-center justify-center">
                                <div className="relative">
                                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center animate-pulse">
                                        <Brain className="h-10 w-10 text-white" />
                                    </div>
                                    <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-white shadow-lg flex items-center justify-center">
                                        <Loader2 className="h-5 w-5 text-primary animate-spin" />
                                    </div>
                                </div>
                            </div>
                            <div className="text-center">
                                <p className="text-sm font-medium text-slate-800">{STEP_MESSAGES[step]}</p>
                                <p className="text-xs text-slate-500 mt-1">Түр хүлээнэ үү...</p>
                            </div>
                            <Progress value={progress} className="h-2" />
                        </div>
                    )}

                    {/* ── Wizard ── */}
                    {step === 'wizard' && currentStep && (
                        <div className="space-y-4">
                            {/* Stepper */}
                            <div className="flex items-center gap-1">
                                {activeSteps.map((s, idx) => {
                                    const Icon = s.icon;
                                    const isCurrent = idx === currentStepIndex;
                                    const isDone = idx < currentStepIndex;
                                    return (
                                        <React.Fragment key={s.id}>
                                            <button
                                                type="button"
                                                onClick={() => setCurrentStepIndex(idx)}
                                                className={cn(
                                                    "flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-medium transition-all shrink-0",
                                                    isCurrent
                                                        ? "bg-primary text-white shadow-sm"
                                                        : isDone
                                                            ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                                                            : "bg-slate-50 text-slate-400 hover:bg-slate-100"
                                                )}
                                            >
                                                {isDone ? <Check className="h-3 w-3" /> : <Icon className="h-3 w-3" />}
                                                <span className="hidden md:inline">{s.label}</span>
                                            </button>
                                            {idx < activeSteps.length - 1 && (
                                                <div className={cn("h-px flex-1 min-w-2", isDone ? "bg-emerald-200" : "bg-slate-200")} />
                                            )}
                                        </React.Fragment>
                                    );
                                })}
                            </div>

                            {/* Step Header */}
                            <div className="flex items-center gap-2 pb-1">
                                {React.createElement(currentStep.icon, { className: cn("h-4 w-4", currentStep.color) })}
                                <h3 className="text-sm font-semibold text-slate-800">{currentStep.label}</h3>
                                <Badge variant="outline" className="text-[10px] ml-auto">
                                    {currentStepIndex + 1} / {activeSteps.length}
                                </Badge>
                            </div>

                            {/* Step Content */}
                            <ScrollArea className="h-[400px]">
                                <div className="pr-4 pb-2">
                                    {renderStepContent()}
                                </div>
                            </ScrollArea>
                        </div>
                    )}

                    {/* ── Complete ── */}
                    {step === 'complete' && (
                        <div className="space-y-4 py-4">
                            <div className="flex items-center justify-center">
                                <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center">
                                    <CheckCircle2 className="h-10 w-10 text-emerald-600" />
                                </div>
                            </div>
                            <p className="text-sm font-semibold text-emerald-700 text-center">Амжилттай оруулагдлаа!</p>
                        </div>
                    )}

                    {/* ── Error ── */}
                    {step === 'error' && (
                        <div className="space-y-4 py-4">
                            <div className="flex items-center justify-center">
                                <div className="w-20 h-20 rounded-full bg-rose-100 flex items-center justify-center">
                                    <AlertCircle className="h-10 w-10 text-rose-600" />
                                </div>
                            </div>
                            <div className="text-center">
                                <p className="text-sm font-semibold text-rose-700">Алдаа гарлаа</p>
                                <p className="text-xs text-slate-500 mt-1">{error || 'CV задлахад алдаа гарлаа'}</p>
                            </div>
                            <Button variant="outline" onClick={resetState} className="w-full">Дахин оролдох</Button>
                        </div>
                    )}
                </div>

                {/* ── Actions ── */}
                {step === 'idle' && (
                    <div className="flex gap-2 pt-2 border-t">
                        <Button variant="outline" onClick={handleClose} size="sm" className="h-9">Болих</Button>
                        <Button
                            onClick={processCV}
                            disabled={!file}
                            size="sm"
                            className="flex-1 h-9 bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700"
                        >
                            <Wand2 className="h-4 w-4 mr-1.5" />
                            AI-аар задлах
                        </Button>
                    </div>
                )}

                {step === 'wizard' && (
                    <div className="flex items-center gap-2 pt-2 border-t">
                        <Button variant="outline" onClick={resetState} size="sm" className="h-9">
                            <X className="h-4 w-4 mr-1" /> Цуцлах
                        </Button>
                        <div className="flex-1" />
                        {!isFirstStep && (
                            <Button variant="outline" onClick={goPrev} size="sm" className="h-9">
                                <ChevronLeft className="h-4 w-4 mr-1" /> Өмнөх
                            </Button>
                        )}
                        {isLastStep ? (
                            <Button
                                onClick={handleApply}
                                disabled={isApplying}
                                size="sm"
                                className="h-9 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700"
                            >
                                {isApplying ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Check className="h-4 w-4 mr-1" />}
                                {isApplying ? 'Хадгалж байна...' : 'Хадгалах'}
                            </Button>
                        ) : (
                            <Button onClick={goNext} size="sm" className="h-9">
                                Дараах <ChevronRight className="h-4 w-4 ml-1" />
                            </Button>
                        )}
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
