'use client';

import * as React from 'react';
import { useFetchDoc, useFirebase, useMemoFirebase, tenantDoc, useTenantWrite } from '@/firebase';
import { setDoc } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
    Plus, Trash2, Save, RotateCcw, Paintbrush, Palette, Check, X, 
    Sun, Moon, Pencil, AlertTriangle, CheckCircle2, Sparkles, Info, Loader2
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { hexToHsl, checkWcagCompliance, getContrastTextColor } from '@/lib/color-utils';
import { PageHeader } from '@/components/patterns/page-layout';
import { Skeleton } from '@/components/ui/skeleton';

interface BrandColor {
    id: string;
    name: string;
    hex: string;
}

interface ThemeMapping {
    primary: string;
    secondary: string;
    accent: string;
    destructive: string;
    muted: string;
}

interface CompanyBranding {
    brandColors: BrandColor[];
    themeMapping: ThemeMapping;
}

const DEFAULT_MAPPING: ThemeMapping = {
    primary: '',
    secondary: '',
    accent: '',
    destructive: '',
    muted: '',
};

const PRESET_PALETTES = [
    {
        id: 'professional',
        name: 'Мэргэжлийн',
        colors: [
            { name: 'Ocean Blue', hex: '#0066CC' },
            { name: 'Dark Navy', hex: '#1a365d' },
            { name: 'Steel Gray', hex: '#64748b' },
            { name: 'Light Gray', hex: '#f1f5f9' },
            { name: 'Error Red', hex: '#dc2626' },
        ],
    },
    {
        id: 'warm',
        name: 'Дулаан',
        colors: [
            { name: 'Sunset Orange', hex: '#ea580c' },
            { name: 'Deep Red', hex: '#b91c1c' },
            { name: 'Golden Yellow', hex: '#ca8a04' },
            { name: 'Warm Cream', hex: '#fef3c7' },
            { name: 'Crimson', hex: '#dc2626' },
        ],
    },
    {
        id: 'nature',
        name: 'Байгаль',
        colors: [
            { name: 'Forest Green', hex: '#15803d' },
            { name: 'Leaf Green', hex: '#22c55e' },
            { name: 'Earth Brown', hex: '#78350f' },
            { name: 'Sand Beige', hex: '#fef3c7' },
            { name: 'Rust Red', hex: '#b45309' },
        ],
    },
    {
        id: 'modern',
        name: 'Орчин үеийн',
        colors: [
            { name: 'Pure Black', hex: '#0a0a0a' },
            { name: 'Charcoal', hex: '#262626' },
            { name: 'Electric Purple', hex: '#7c3aed' },
            { name: 'Light Silver', hex: '#f5f5f5' },
            { name: 'Hot Pink', hex: '#ec4899' },
        ],
    },
    {
        id: 'corporate',
        name: 'Байгууллагын',
        colors: [
            { name: 'Corporate Blue', hex: '#2563eb' },
            { name: 'Trust Navy', hex: '#1e3a8a' },
            { name: 'Success Green', hex: '#16a34a' },
            { name: 'Neutral Gray', hex: '#6b7280' },
            { name: 'Alert Red', hex: '#ef4444' },
        ],
    },
];

const THEME_SLOTS = [
    {
        key: 'primary' as const,
        label: 'Үндсэн өнгө',
        description: 'Товчлуур, холбоос, идэвхтэй элементүүд',
        defaultIndex: 0,
    },
    {
        key: 'secondary' as const,
        label: 'Хоёрдогч өнгө',
        description: 'Badge, хоёрдогч товчлуур, дэвсгэр',
        defaultIndex: 1,
    },
    {
        key: 'accent' as const,
        label: 'Тодотгол өнгө',
        description: 'Hover эффект, онцлох элемент',
        defaultIndex: 2,
    },
    {
        key: 'destructive' as const,
        label: 'Анхааруулга',
        description: 'Устгах товчлуур, алдааны мессеж',
        defaultIndex: 4,
    },
    {
        key: 'muted' as const,
        label: 'Бүдэг өнгө',
        description: 'Идэвхгүй текст, бүдэг дэвсгэр',
        defaultIndex: 3,
    },
];

function ThemeColorPicker({
    label,
    description,
    colorId,
    colors,
    onChange,
}: {
    label: string;
    description: string;
    colorId: string;
    colors: BrandColor[];
    onChange: (colorId: string) => void;
}) {
    const selected = colors.find(c => c.id === colorId);
    const [isOpen, setIsOpen] = React.useState(false);

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-sm font-medium">{label}</p>
                    <p className="text-xs text-muted-foreground">{description}</p>
                </div>
            </div>
            <div className="relative">
                <div
                    role="button"
                    tabIndex={0}
                    onClick={() => setIsOpen(!isOpen)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setIsOpen(!isOpen); } }}
                    className={cn(
                        "w-full flex items-center gap-3 p-3 rounded-lg border-2 transition-all text-left cursor-pointer",
                        isOpen ? "border-primary ring-2 ring-primary/20" : "border-border hover:border-primary/50"
                    )}
                >
                    <div
                        className="h-8 w-8 rounded-md border shadow-sm flex-shrink-0"
                        style={{ backgroundColor: selected?.hex || '#e5e7eb' }}
                    />
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                            {selected ? selected.name : 'Өнгө сонгоно уу'}
                        </p>
                        {selected && (
                            <p className="text-xs text-muted-foreground font-mono uppercase">
                                {selected.hex}
                            </p>
                        )}
                    </div>
                    {selected && (
                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); onChange(''); setIsOpen(false); }}
                            className="p-1 rounded hover:bg-muted"
                        >
                            <X className="h-3.5 w-3.5 text-muted-foreground" />
                        </button>
                    )}
                </div>

                {isOpen && colors.length > 0 && (
                    <div className="absolute z-10 mt-1 w-full bg-popover border rounded-lg shadow-lg p-2 grid grid-cols-5 gap-1.5">
                        {colors.map(c => {
                            const textColor = getContrastTextColor(c.hex);
                            const isSelected = c.id === colorId;
                            return (
                                <button
                                    key={c.id}
                                    type="button"
                                    onClick={() => { onChange(c.id); setIsOpen(false); }}
                                    className={cn(
                                        "flex flex-col items-center gap-1 p-2 rounded-lg transition-all",
                                        isSelected ? "bg-primary/10 ring-2 ring-primary" : "hover:bg-muted"
                                    )}
                                    title={`${c.name} (${c.hex})`}
                                >
                                    <div
                                        className="h-8 w-8 rounded-md border shadow-sm flex items-center justify-center"
                                        style={{ backgroundColor: c.hex, color: textColor }}
                                    >
                                        {isSelected && <Check className="h-4 w-4" />}
                                    </div>
                                    <span className="text-[10px] text-muted-foreground truncate w-full text-center">
                                        {c.name}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                )}

                {isOpen && colors.length === 0 && (
                    <div className="absolute z-10 mt-1 w-full bg-popover border rounded-lg shadow-lg p-4 text-center">
                        <p className="text-sm text-muted-foreground">Эхлээд дээрх хэсэгт өнгө нэмнэ үү</p>
                    </div>
                )}
            </div>
        </div>
    );
}

function ColorItem({
    color,
    isEditing,
    onEdit,
    onSaveEdit,
    onCancelEdit,
    onDelete,
    editName,
    editHex,
    onEditNameChange,
    onEditHexChange,
}: {
    color: BrandColor;
    isEditing: boolean;
    onEdit: () => void;
    onSaveEdit: () => void;
    onCancelEdit: () => void;
    onDelete: () => void;
    editName: string;
    editHex: string;
    onEditNameChange: (name: string) => void;
    onEditHexChange: (hex: string) => void;
}) {
    const textColor = getContrastTextColor(isEditing ? editHex : color.hex);

    if (isEditing) {
        return (
            <div className="flex items-center gap-3 p-3 border-2 border-primary rounded-lg bg-primary/5">
                <div className="relative">
                    <div
                        className="h-10 w-10 rounded-lg border-2 shadow-sm cursor-pointer overflow-hidden"
                        style={{ backgroundColor: editHex }}
                    >
                        <input
                            type="color"
                            value={editHex}
                            onChange={(e) => onEditHexChange(e.target.value)}
                            className="absolute -top-2 -left-2 w-16 h-16 cursor-pointer opacity-0"
                        />
                    </div>
                </div>
                <div className="flex-1 space-y-2">
                    <Input
                        value={editName}
                        onChange={(e) => onEditNameChange(e.target.value)}
                        placeholder="Өнгөний нэр"
                        className="h-8"
                    />
                    <Input
                        value={editHex}
                        onChange={(e) => onEditHexChange(e.target.value)}
                        placeholder="#000000"
                        className="h-8 font-mono text-xs"
                    />
                </div>
                <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={onSaveEdit}>
                        <Check className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={onCancelEdit}>
                        <X className="h-4 w-4" />
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="group flex items-center justify-between p-2.5 border rounded-lg bg-card hover:border-primary/50 transition-colors">
            <div className="flex items-center gap-3">
                <div
                    className="h-9 w-9 rounded-md border shadow-sm flex items-center justify-center text-xs font-bold"
                    style={{ backgroundColor: color.hex, color: textColor }}
                >
                    {color.name.charAt(0)}
                </div>
                <div>
                    <p className="font-medium text-sm">{color.name}</p>
                    <p className="text-xs text-muted-foreground uppercase font-mono">{color.hex}</p>
                </div>
            </div>
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEdit}>
                    <Pencil className="h-3 w-3" />
                </Button>
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={onDelete}
                    className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                    <Trash2 className="h-3 w-3" />
                </Button>
            </div>
        </div>
    );
}

function ContrastInfo({ colors, mapping }: { colors: BrandColor[]; mapping: ThemeMapping }) {
    const primaryColor = colors.find(c => c.id === mapping.primary);
    if (!primaryColor) return null;

    const whiteContrast = checkWcagCompliance(primaryColor.hex, '#ffffff');
    const blackContrast = checkWcagCompliance(primaryColor.hex, '#000000');

    return (
        <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-lg border bg-white">
                <div className="flex items-center gap-2 mb-2">
                    <div className="w-5 h-5 rounded" style={{ backgroundColor: primaryColor.hex }} />
                    <span className="text-xs font-medium">Цагаан дэвсгэр</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                    <Badge variant={whiteContrast.aa.normalText ? 'default' : 'destructive'} className="text-[10px]">
                        {whiteContrast.ratio}:1
                    </Badge>
                    <span className="text-muted-foreground">AA:</span>
                    {whiteContrast.aa.normalText ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                    ) : (
                        <X className="h-3.5 w-3.5 text-red-500" />
                    )}
                </div>
            </div>
            <div className="p-3 rounded-lg border bg-slate-900">
                <div className="flex items-center gap-2 mb-2">
                    <div className="w-5 h-5 rounded" style={{ backgroundColor: primaryColor.hex }} />
                    <span className="text-xs font-medium text-white">Хар дэвсгэр</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                    <Badge variant={blackContrast.aa.normalText ? 'default' : 'destructive'} className="text-[10px]">
                        {blackContrast.ratio}:1
                    </Badge>
                    <span className="text-slate-300">AA:</span>
                    {blackContrast.aa.normalText ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                    ) : (
                        <X className="h-3.5 w-3.5 text-red-500" />
                    )}
                </div>
            </div>
        </div>
    );
}

function BrandingPreview({ colors, mapping, isDark }: { colors: BrandColor[]; mapping: ThemeMapping; isDark: boolean }) {
    const primaryColor = colors.find(c => c.id === mapping.primary);
    const secondaryColor = colors.find(c => c.id === mapping.secondary);
    const accentColor = colors.find(c => c.id === mapping.accent);
    const destructiveColor = colors.find(c => c.id === mapping.destructive);
    const mutedColor = colors.find(c => c.id === mapping.muted);

    const pHex = primaryColor?.hex || '#3b82f6';
    const sHex = secondaryColor?.hex || '#64748b';
    const aHex = accentColor?.hex || '#8b5cf6';
    const dHex = destructiveColor?.hex || '#ef4444';
    const mHex = mutedColor?.hex || '#f1f5f9';

    const pText = getContrastTextColor(pHex);
    const sText = getContrastTextColor(sHex);
    const dText = getContrastTextColor(dHex);

    return (
        <div className={cn(
            "rounded-xl border shadow-sm p-5 space-y-5 transition-colors",
            isDark ? "bg-slate-900 text-white" : "bg-white text-slate-900"
        )}>
            <div className="rounded-lg p-4 flex justify-between items-center" style={{ backgroundColor: pHex, color: pText }}>
                <span className="font-semibold text-sm">Logo</span>
                <div className="flex gap-4 text-sm font-medium opacity-90">
                    <span>Нүүр</span>
                    <span>Ажилчид</span>
                    <span>Тохиргоо</span>
                </div>
            </div>

            <div className="flex flex-wrap gap-2">
                <button className="px-4 py-2 rounded-md text-sm font-medium" style={{ backgroundColor: pHex, color: pText }}>
                    Хадгалах
                </button>
                <button className="px-4 py-2 rounded-md text-sm font-medium" style={{ backgroundColor: sHex, color: sText }}>
                    Хоёрдогч
                </button>
                <button className={cn("px-4 py-2 rounded-md text-sm font-medium border", isDark ? "border-slate-600" : "border-slate-300")}>
                    Outline
                </button>
                <button className="px-4 py-2 rounded-md text-sm font-medium" style={{ backgroundColor: dHex, color: dText }}>
                    Устгах
                </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
                <div className={cn("p-4 rounded-lg border", isDark ? "bg-slate-800" : "bg-card")}>
                    <p className="font-semibold text-sm mb-2">Жишээ карт</p>
                    <div className="flex gap-2">
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: pHex, color: pText }}>Primary</span>
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: sHex, color: sText }}>Secondary</span>
                    </div>
                </div>
                <div className="p-4 rounded-lg border" style={{ backgroundColor: aHex + '20', borderColor: aHex + '40' }}>
                    <p className="font-semibold text-sm mb-2">Accent</p>
                    <p className="text-xs text-muted-foreground">Тодотгол өнгө</p>
                </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-lg border" style={{ borderColor: dHex + '60', backgroundColor: dHex + '10' }}>
                <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" style={{ color: dHex }} />
                <div>
                    <p className="text-sm font-medium" style={{ color: dHex }}>Алдаа!</p>
                    <p className="text-xs text-muted-foreground">Алдааны мессежний жишээ.</p>
                </div>
            </div>

            <div className={cn("p-4 rounded-lg border space-y-3", isDark ? "bg-slate-800" : "bg-card")}>
                <div className="space-y-1">
                    <label className="text-xs font-medium">Нэр</label>
                    <div className={cn("h-8 rounded-md border px-3 flex items-center text-sm text-muted-foreground", isDark ? "bg-slate-700 border-slate-600" : "bg-white")}>
                        Жишээ текст
                    </div>
                </div>
                <button className="w-full py-2 rounded-md text-sm font-medium" style={{ backgroundColor: pHex, color: pText }}>
                    Илгээх
                </button>
            </div>

            <div className="p-3 rounded-lg" style={{ backgroundColor: mHex }}>
                <p className="text-xs text-muted-foreground">Бүдэг дэвсгэр хэсэг (Muted)</p>
            </div>
        </div>
    );
}

export default function BrandingPage() {
    const { firestore } = useFirebase();
    const { tDoc } = useTenantWrite();
    const { toast } = useToast();
    const [colors, setColors] = React.useState<BrandColor[]>([]);
    const [mapping, setMapping] = React.useState<ThemeMapping>(DEFAULT_MAPPING);
    const [newColorHex, setNewColorHex] = React.useState('#3b82f6');
    const [newColorName, setNewColorName] = React.useState('');
    const [isSaving, setIsSaving] = React.useState(false);
    const [hasUnsavedChanges, setHasUnsavedChanges] = React.useState(false);
    const [previewMode, setPreviewMode] = React.useState<'light' | 'dark'>('light');
    const [editingColorId, setEditingColorId] = React.useState<string | null>(null);
    const [editName, setEditName] = React.useState('');
    const [editHex, setEditHex] = React.useState('');

    const brandingRef = useMemoFirebase(
        ({ firestore, companyPath }) => (firestore ? tenantDoc(firestore, companyPath, 'company', 'branding') : null),
        []
    );
    const { data: branding, isLoading, refetch } = useFetchDoc<CompanyBranding>(brandingRef as any);

    const originalDataRef = React.useRef<{ colors: BrandColor[]; mapping: ThemeMapping } | null>(null);
    const didInitRef = React.useRef(false);

    React.useEffect(() => {
        if (isLoading) return;

        const brandColors = branding?.brandColors ?? [];
        const themeMapping = branding?.themeMapping ?? DEFAULT_MAPPING;

        const validIds = new Set(brandColors.map((c) => c.id));
        const nextMapping: ThemeMapping = { ...DEFAULT_MAPPING, ...themeMapping };
        (Object.keys(nextMapping) as Array<keyof ThemeMapping>).forEach((key) => {
            if (nextMapping[key] && !validIds.has(nextMapping[key])) nextMapping[key] = '';
        });

        if (!didInitRef.current) {
            didInitRef.current = true;
            setColors(brandColors);
            setMapping(nextMapping);
            originalDataRef.current = { colors: brandColors, mapping: nextMapping };
            setHasUnsavedChanges(false);
            return;
        }

        if (!hasUnsavedChanges && !isSaving) {
            setColors(brandColors);
            setMapping(nextMapping);
            originalDataRef.current = { colors: brandColors, mapping: nextMapping };
            setHasUnsavedChanges(false);
        }
    }, [branding, isLoading, hasUnsavedChanges, isSaving]);

    React.useEffect(() => {
        if (originalDataRef.current) {
            const hasChanges = JSON.stringify({ colors, mapping }) !== JSON.stringify(originalDataRef.current);
            setHasUnsavedChanges(hasChanges);
        }
    }, [colors, mapping]);

    React.useEffect(() => {
        if (!hasUnsavedChanges) return;
        const onBeforeUnload = (e: BeforeUnloadEvent) => {
            e.preventDefault();
            e.returnValue = '';
        };
        window.addEventListener('beforeunload', onBeforeUnload);
        return () => window.removeEventListener('beforeunload', onBeforeUnload);
    }, [hasUnsavedChanges]);

    const handleAddColor = () => {
        if (!newColorName.trim()) {
            toast({ title: "Өнгөний нэр оруулна уу", variant: "destructive" });
            return;
        }
        const newColor: BrandColor = {
            id: crypto.randomUUID(),
            name: newColorName.trim(),
            hex: newColorHex,
        };
        setColors((prev) => [...prev, newColor]);
        setNewColorName('');
        setNewColorHex('#3b82f6');
    };

    const handleDeleteColor = (id: string) => {
        setColors((prev) => prev.filter((c) => c.id !== id));
        setMapping((prev) => {
            const next = { ...prev };
            (Object.keys(next) as Array<keyof ThemeMapping>).forEach((key) => {
                if (next[key] === id) next[key] = '';
            });
            return next;
        });
    };

    const handleStartEdit = (color: BrandColor) => {
        setEditingColorId(color.id);
        setEditName(color.name);
        setEditHex(color.hex);
    };

    const handleSaveEdit = () => {
        if (!editingColorId || !editName.trim()) return;
        setColors((prev) =>
            prev.map((c) => (c.id === editingColorId ? { ...c, name: editName.trim(), hex: editHex } : c))
        );
        setEditingColorId(null);
    };

    const handleCancelEdit = () => {
        setEditingColorId(null);
    };

    const handleApplyPreset = (presetId: string) => {
        const preset = PRESET_PALETTES.find(p => p.id === presetId);
        if (!preset) return;

        const newColors = preset.colors.map(c => ({
            id: crypto.randomUUID(),
            name: c.name,
            hex: c.hex,
        }));

        setColors(newColors);

        const newMapping: ThemeMapping = { ...DEFAULT_MAPPING };
        THEME_SLOTS.forEach(slot => {
            if (newColors[slot.defaultIndex]) {
                newMapping[slot.key] = newColors[slot.defaultIndex].id;
            }
        });
        setMapping(newMapping);
        toast({ title: `"${preset.name}" палетт ашиглагдлаа` });
    };

    const handleReset = () => {
        const brandColors = branding?.brandColors ?? [];
        const themeMapping = branding?.themeMapping ?? DEFAULT_MAPPING;
        const validIds = new Set(brandColors.map((c) => c.id));
        const nextMapping: ThemeMapping = { ...DEFAULT_MAPPING, ...themeMapping };
        (Object.keys(nextMapping) as Array<keyof ThemeMapping>).forEach((key) => {
            if (nextMapping[key] && !validIds.has(nextMapping[key])) nextMapping[key] = '';
        });
        setColors(brandColors);
        setMapping(nextMapping);
        originalDataRef.current = { colors: brandColors, mapping: nextMapping };
        setHasUnsavedChanges(false);
    };

    const handleSave = async () => {
        if (!firestore) return;
        setIsSaving(true);
        try {
            await setDoc(
                tDoc('company', 'branding'),
                { brandColors: colors, themeMapping: mapping },
                { merge: true }
            );
            originalDataRef.current = { colors, mapping };
            setHasUnsavedChanges(false);
            toast({ title: "Амжилттай хадгалагдлаа" });
            refetch();
        } catch (error: any) {
            toast({ title: "Алдаа гарлаа", description: error.message, variant: "destructive" });
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex flex-col h-full overflow-hidden">
                <div className="flex-1 overflow-y-auto p-6 md:p-8 pt-0 md:pt-0 space-y-8 pb-32">
                    <PageHeader
                        title="Брэндинг тохиргоо"
                        description="Системийн өнгө, төрхийг компанийн брэндийн дагуу тохируулах"
                        showBackButton
                        hideBreadcrumbs
                        backButtonPlacement="inline"
                        backBehavior="history"
                        fallbackBackHref="/dashboard/company"
                    />
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                        <div className="lg:col-span-5 space-y-4">
                            <Skeleton className="h-[200px] rounded-xl" />
                            <Skeleton className="h-[300px] rounded-xl" />
                        </div>
                        <div className="lg:col-span-7">
                            <Skeleton className="h-[500px] rounded-xl" />
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full overflow-hidden">
            <div className="flex-1 overflow-y-auto p-6 md:p-8 pt-0 md:pt-0 space-y-6 pb-32">
                <PageHeader
                    title="Брэндинг тохиргоо"
                    description="Системийн өнгө, төрхийг компанийн брэндийн дагуу тохируулах"
                    showBackButton
                    hideBreadcrumbs
                    backButtonPlacement="inline"
                    backBehavior="history"
                    fallbackBackHref="/dashboard/company"
                    actions={
                        <div className="flex items-center gap-2">
                            {hasUnsavedChanges && (
                                <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50">
                                    Хадгалаагүй өөрчлөлт
                                </Badge>
                            )}
                            <Button variant="outline" size="sm" onClick={handleReset} disabled={isSaving || !hasUnsavedChanges}>
                                <RotateCcw className="mr-2 h-4 w-4" /> Буцаах
                            </Button>
                            <Button size="sm" onClick={handleSave} disabled={isSaving || !hasUnsavedChanges}>
                                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                Хадгалах
                            </Button>
                        </div>
                    }
                />

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                    {/* Left Column */}
                    <div className="lg:col-span-5 space-y-5">
                        {/* Step 1: Quick Start with Presets */}
                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-base flex items-center gap-2">
                                    <Sparkles className="h-4 w-4 text-amber-500" />
                                    Бэлэн палетт сонгох
                                </CardTitle>
                                <CardDescription>Нэг дарахад бүх өнгө автомат тохируулагдана</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                                    {PRESET_PALETTES.map(preset => (
                                        <button
                                            key={preset.id}
                                            onClick={() => handleApplyPreset(preset.id)}
                                            className="p-3 rounded-lg border hover:border-primary hover:shadow-sm transition-all text-left group"
                                        >
                                            <div className="flex gap-1 mb-2">
                                                {preset.colors.slice(0, 5).map((c, i) => (
                                                    <div
                                                        key={i}
                                                        className="h-5 flex-1 first:rounded-l-md last:rounded-r-md border"
                                                        style={{ backgroundColor: c.hex }}
                                                    />
                                                ))}
                                            </div>
                                            <p className="text-xs font-medium group-hover:text-primary transition-colors">{preset.name}</p>
                                        </button>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>

                        {/* Step 2: Theme Role Assignment */}
                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-base flex items-center gap-2">
                                    <Paintbrush className="h-4 w-4 text-primary" />
                                    Системийн өнгө оноох
                                </CardTitle>
                                <CardDescription>Өнгө бүрийн зориулалтыг тодорхойлно</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {colors.length === 0 ? (
                                    <div className="text-center py-6 text-muted-foreground border border-dashed rounded-lg">
                                        <Info className="h-6 w-6 mx-auto mb-2 opacity-50" />
                                        <p className="text-sm">Дээрх палеттаас сонгох эсвэл доорх хэсэгт өнгө нэмнэ үү</p>
                                    </div>
                                ) : (
                                    THEME_SLOTS.map(slot => (
                                        <ThemeColorPicker
                                            key={slot.key}
                                            label={slot.label}
                                            description={slot.description}
                                            colorId={mapping[slot.key]}
                                            colors={colors}
                                            onChange={(id) => setMapping(prev => ({ ...prev, [slot.key]: id }))}
                                        />
                                    ))
                                )}

                                {mapping.primary && (
                                    <div className="pt-2">
                                        <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                                            <CheckCircle2 className="h-3 w-3" /> WCAG Contrast шалгалт
                                        </p>
                                        <ContrastInfo colors={colors} mapping={mapping} />
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Step 3: Custom Brand Colors */}
                        <Card>
                            <CardHeader className="pb-3">
                                <div className="flex items-center justify-between">
                                    <CardTitle className="text-base flex items-center gap-2">
                                        <Palette className="h-4 w-4 text-violet-500" />
                                        Миний өнгөнүүд
                                    </CardTitle>
                                    <Badge variant="secondary">{colors.length}</Badge>
                                </div>
                                <CardDescription>Өнгө нэмэх, засах, устгах</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                {/* Add color */}
                                <div className="flex gap-2 items-end">
                                    <div className="flex-1 space-y-1.5">
                                        <Label className="text-xs">Нэр</Label>
                                        <Input
                                            placeholder="Жишээ: Brand Blue"
                                            value={newColorName}
                                            onChange={(e) => setNewColorName(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && handleAddColor()}
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-xs">Өнгө</Label>
                                        <div className="relative h-10 w-12 rounded-md border shadow-sm overflow-hidden cursor-pointer">
                                            <div className="absolute inset-0" style={{ backgroundColor: newColorHex }} />
                                            <input
                                                type="color"
                                                value={newColorHex}
                                                onChange={(e) => setNewColorHex(e.target.value)}
                                                className="absolute -top-2 -left-2 w-16 h-16 cursor-pointer opacity-0"
                                            />
                                        </div>
                                    </div>
                                    <Button onClick={handleAddColor} size="icon" className="shrink-0">
                                        <Plus className="h-4 w-4" />
                                    </Button>
                                </div>

                                {/* Color list */}
                                <div className="space-y-1.5 max-h-[260px] overflow-y-auto pr-1">
                                    {colors.length === 0 ? (
                                        <div className="text-center py-6 text-muted-foreground border border-dashed rounded-lg">
                                            <Palette className="h-6 w-6 mx-auto mb-2 opacity-50" />
                                            <p className="text-sm">Өнгө оруулаагүй байна</p>
                                        </div>
                                    ) : (
                                        colors.map(color => (
                                            <ColorItem
                                                key={color.id}
                                                color={color}
                                                isEditing={editingColorId === color.id}
                                                onEdit={() => handleStartEdit(color)}
                                                onSaveEdit={handleSaveEdit}
                                                onCancelEdit={handleCancelEdit}
                                                onDelete={() => handleDeleteColor(color.id)}
                                                editName={editName}
                                                editHex={editHex}
                                                onEditNameChange={setEditName}
                                                onEditHexChange={setEditHex}
                                            />
                                        ))
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Right Column: Preview */}
                    <div className="lg:col-span-7 lg:sticky lg:top-4">
                        <Card className="overflow-hidden">
                            <CardHeader className="pb-3 border-b bg-muted/30">
                                <div className="flex items-center justify-between">
                                    <CardTitle className="text-base flex items-center gap-2">
                                        <Paintbrush className="w-4 h-4" />
                                        Харагдах байдал
                                    </CardTitle>
                                    <div className="flex items-center gap-1 p-1 bg-background rounded-lg border">
                                        <Button
                                            variant={previewMode === 'light' ? 'default' : 'ghost'}
                                            size="sm"
                                            className="h-7 gap-1.5"
                                            onClick={() => setPreviewMode('light')}
                                        >
                                            <Sun className="h-3.5 w-3.5" />
                                            Light
                                        </Button>
                                        <Button
                                            variant={previewMode === 'dark' ? 'default' : 'ghost'}
                                            size="sm"
                                            className="h-7 gap-1.5"
                                            onClick={() => setPreviewMode('dark')}
                                        >
                                            <Moon className="h-3.5 w-3.5" />
                                            Dark
                                        </Button>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="p-4 bg-slate-50">
                                <BrandingPreview
                                    colors={colors}
                                    mapping={mapping}
                                    isDark={previewMode === 'dark'}
                                />
                            </CardContent>
                        </Card>

                        {hasUnsavedChanges && (
                            <Alert className="mt-4 border-amber-200 bg-amber-50">
                                <AlertTriangle className="h-4 w-4 text-amber-600" />
                                <AlertDescription className="text-amber-700 text-sm">
                                    Хадгалаагүй өөрчлөлт байна. <button onClick={handleSave} className="font-semibold underline">Хадгалах</button>
                                </AlertDescription>
                            </Alert>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
