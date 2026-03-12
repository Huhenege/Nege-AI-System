'use client';

import * as React from 'react';
import { useFetchDoc, useFirebase, useTenantWrite } from '@/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { VerticalTabMenu } from '@/components/ui/vertical-tab-menu';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { 
    Plus, Trash2, Save, RotateCcw, Paintbrush, Palette, Check, X, 
    Sun, Moon, Pencil, AlertTriangle, CheckCircle2, Sparkles, Info
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

// Preset color palettes
const PRESET_PALETTES = [
    {
        id: 'professional',
        name: 'Professional',
        description: 'Цэнхэр, саарал өнгөний мэргэжлийн харагдац',
        colors: [
            { name: 'Ocean Blue', hex: '#0066CC' },
            { name: 'Dark Navy', hex: '#1a365d' },
            { name: 'Steel Gray', hex: '#64748b' },
            { name: 'Light Gray', hex: '#f1f5f9' },
            { name: 'Error Red', hex: '#dc2626' },
        ]
    },
    {
        id: 'warm',
        name: 'Warm',
        description: 'Улаан, улбар шар өнгөний дулаан харагдац',
        colors: [
            { name: 'Sunset Orange', hex: '#ea580c' },
            { name: 'Deep Red', hex: '#b91c1c' },
            { name: 'Golden Yellow', hex: '#ca8a04' },
            { name: 'Warm Cream', hex: '#fef3c7' },
            { name: 'Crimson', hex: '#dc2626' },
        ]
    },
    {
        id: 'nature',
        name: 'Nature',
        description: 'Ногоон, хүрэн өнгөний байгалийн харагдац',
        colors: [
            { name: 'Forest Green', hex: '#15803d' },
            { name: 'Leaf Green', hex: '#22c55e' },
            { name: 'Earth Brown', hex: '#78350f' },
            { name: 'Sand Beige', hex: '#fef3c7' },
            { name: 'Rust Red', hex: '#b45309' },
        ]
    },
    {
        id: 'modern',
        name: 'Modern',
        description: 'Хар, цагаан өнгөний орчин үеийн харагдац',
        colors: [
            { name: 'Pure Black', hex: '#0a0a0a' },
            { name: 'Charcoal', hex: '#262626' },
            { name: 'Electric Purple', hex: '#7c3aed' },
            { name: 'Light Silver', hex: '#f5f5f5' },
            { name: 'Hot Pink', hex: '#ec4899' },
        ]
    },
    {
        id: 'corporate',
        name: 'Corporate',
        description: 'Тогтвортой байгууллагын өнгө',
        colors: [
            { name: 'Corporate Blue', hex: '#2563eb' },
            { name: 'Trust Navy', hex: '#1e3a8a' },
            { name: 'Success Green', hex: '#16a34a' },
            { name: 'Neutral Gray', hex: '#6b7280' },
            { name: 'Alert Red', hex: '#ef4444' },
        ]
    },
];

// Theme slot configurations
const THEME_SLOTS = [
    {
        key: 'primary' as const,
        label: 'Primary (Үндсэн)',
        description: 'Үндсэн товчлуур, идэвхтэй элементүүд, холбоос',
        previewClass: 'bg-primary'
    },
    {
        key: 'secondary' as const,
        label: 'Secondary (Хоёрдогч)',
        description: 'Хоёрдогч товчлуур, badge, дэвсгэр',
        previewClass: 'bg-secondary'
    },
    {
        key: 'accent' as const,
        label: 'Accent (Тодотгол)',
        description: 'Онцлох элемент, hover эффект',
        previewClass: 'bg-accent'
    },
    {
        key: 'destructive' as const,
        label: 'Destructive (Устгах)',
        description: 'Устгах товчлуур, алдааны мессеж',
        previewClass: 'bg-destructive'
    },
    {
        key: 'muted' as const,
        label: 'Muted (Бүдэгдүү)',
        description: 'Идэвхгүй текст, дэвсгэр',
        previewClass: 'bg-muted'
    },
];

// Color item component with edit capability
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
    onEditHexChange 
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
        <div className="group flex items-center justify-between p-3 border rounded-lg bg-card hover:border-primary/50 transition-colors">
            <div className="flex items-center gap-3">
                <div 
                    className="h-10 w-10 rounded-lg border shadow-sm flex items-center justify-center text-xs font-bold"
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
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onEdit}>
                    <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={onDelete} 
                    className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                    <Trash2 className="h-3.5 w-3.5" />
                </Button>
            </div>
        </div>
    );
}

// Contrast checker component
function ContrastChecker({ colors, mapping }: { colors: BrandColor[]; mapping: ThemeMapping }) {
    const primaryColor = colors.find(c => c.id === mapping.primary);
    const secondaryColor = colors.find(c => c.id === mapping.secondary);

    if (!primaryColor) {
        return (
            <div className="text-center py-8 text-muted-foreground">
                <Info className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Primary өнгө сонгосны дараа contrast шалгалт харагдана.</p>
            </div>
        );
    }

    const whiteContrast = checkWcagCompliance(primaryColor.hex, '#ffffff');
    const blackContrast = checkWcagCompliance(primaryColor.hex, '#000000');

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
                {/* White background check */}
                <div className="p-4 rounded-lg border bg-white">
                    <div className="flex items-center gap-2 mb-3">
                        <div 
                            className="w-6 h-6 rounded" 
                            style={{ backgroundColor: primaryColor.hex }}
                        />
                        <span className="text-xs font-medium">+ Цагаан дэвсгэр</span>
                    </div>
                    <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs">
                            <span>Contrast Ratio:</span>
                            <Badge variant={whiteContrast.aa.normalText ? 'default' : 'destructive'}>
                                {whiteContrast.ratio}:1
                            </Badge>
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                            <span className="text-muted-foreground">AA:</span>
                            {whiteContrast.aa.normalText ? (
                                <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                            ) : (
                                <X className="h-3.5 w-3.5 text-red-500" />
                            )}
                            <span className="text-muted-foreground ml-2">AAA:</span>
                            {whiteContrast.aaa.normalText ? (
                                <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                            ) : (
                                <X className="h-3.5 w-3.5 text-red-500" />
                            )}
                        </div>
                    </div>
                </div>

                {/* Black background check */}
                <div className="p-4 rounded-lg border bg-slate-900">
                    <div className="flex items-center gap-2 mb-3">
                        <div 
                            className="w-6 h-6 rounded" 
                            style={{ backgroundColor: primaryColor.hex }}
                        />
                        <span className="text-xs font-medium text-white">+ Хар дэвсгэр</span>
                    </div>
                    <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs">
                            <span className="text-slate-300">Contrast Ratio:</span>
                            <Badge variant={blackContrast.aa.normalText ? 'default' : 'destructive'}>
                                {blackContrast.ratio}:1
                            </Badge>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-300">
                            <span>AA:</span>
                            {blackContrast.aa.normalText ? (
                                <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                            ) : (
                                <X className="h-3.5 w-3.5 text-red-500" />
                            )}
                            <span className="ml-2">AAA:</span>
                            {blackContrast.aaa.normalText ? (
                                <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                            ) : (
                                <X className="h-3.5 w-3.5 text-red-500" />
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <div className="text-xs text-muted-foreground p-3 bg-muted/50 rounded-lg">
                <p><strong>AA стандарт:</strong> Текст дор хаяж 4.5:1 ratio шаардлагатай</p>
                <p><strong>AAA стандарт:</strong> Текст дор хаяж 7:1 ratio шаардлагатай</p>
            </div>
        </div>
    );
}

// Preview component with light/dark mode tabs
function BrandingPreview({ colors, mapping, isDark }: { colors: BrandColor[]; mapping: ThemeMapping; isDark: boolean }) {
    const previewStyle = React.useMemo(() => {
        const primaryColor = colors.find(c => c.id === mapping.primary);
        const secondaryColor = colors.find(c => c.id === mapping.secondary);
        const accentColor = colors.find(c => c.id === mapping.accent);
        const destructiveColor = colors.find(c => c.id === mapping.destructive);
        const mutedColor = colors.find(c => c.id === mapping.muted);

        return {
            '--primary': primaryColor ? hexToHsl(primaryColor.hex) : undefined,
            '--secondary': secondaryColor ? hexToHsl(secondaryColor.hex) : undefined,
            '--accent': accentColor ? hexToHsl(accentColor.hex) : undefined,
            '--destructive': destructiveColor ? hexToHsl(destructiveColor.hex) : undefined,
            '--muted': mutedColor ? hexToHsl(mutedColor.hex) : undefined,
        } as React.CSSProperties;
    }, [colors, mapping]);

    return (
        <div 
            className={cn(
                "rounded-xl border shadow-sm p-6 space-y-6 transition-colors",
                isDark ? "bg-slate-900 text-white" : "bg-white text-slate-900"
            )} 
            style={previewStyle as any}
        >
            {/* Header Preview */}
            <div className="space-y-2">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Navigation</div>
                <div className="bg-primary text-primary-foreground p-4 rounded-lg flex justify-between items-center shadow-md">
                    <span className="font-semibold">Logo</span>
                    <div className="flex gap-4 text-sm font-medium opacity-90">
                        <span>Нүүр</span>
                        <span>Ажилчид</span>
                        <span>Тохиргоо</span>
                    </div>
                </div>
            </div>

            {/* Buttons Preview */}
            <div className="space-y-2">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Товчлуурууд</div>
                <div className="flex flex-wrap gap-2">
                    <Button size="sm">Primary</Button>
                    <Button size="sm" variant="secondary">Secondary</Button>
                    <Button size="sm" variant="outline">Outline</Button>
                    <Button size="sm" variant="destructive">Delete</Button>
                    <Button size="sm" variant="ghost">Ghost</Button>
                </div>
            </div>

            {/* Cards Preview */}
            <div className="space-y-2">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Карт & Badge</div>
                <div className="grid grid-cols-2 gap-3">
                    <div className={cn("p-4 rounded-lg border", isDark ? "bg-slate-800" : "bg-card")}>
                        <p className="font-semibold text-sm mb-2">Жишээ карт</p>
                        <div className="flex gap-2">
                            <Badge>Primary</Badge>
                            <Badge variant="secondary">Secondary</Badge>
                        </div>
                    </div>
                    <div className="p-4 rounded-lg bg-accent/20 border border-accent/30">
                        <p className="font-semibold text-sm mb-2">Accent карт</p>
                        <p className="text-xs text-muted-foreground">Тодотгол өнгө ашигласан</p>
                    </div>
                </div>
            </div>

            {/* Alert Preview */}
            <div className="space-y-2">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Мэдэгдэл</div>
                <Alert variant="destructive" className="py-2">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle className="text-sm">Алдаа!</AlertTitle>
                    <AlertDescription className="text-xs">
                        Энэ бол алдааны мессежний жишээ.
                    </AlertDescription>
                </Alert>
            </div>

            {/* Form Preview */}
            <div className="space-y-2">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Форм</div>
                <div className={cn("p-4 rounded-lg border space-y-3", isDark ? "bg-slate-800" : "bg-card")}>
                    <div className="space-y-1">
                        <Label className="text-xs">Нэр</Label>
                        <Input placeholder="Жишээ текст" className="h-8" />
                    </div>
                    <Button size="sm" className="w-full">Илгээх</Button>
                </div>
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
    
    // Edit state
    const [editingColorId, setEditingColorId] = React.useState<string | null>(null);
    const [editName, setEditName] = React.useState('');
    const [editHex, setEditHex] = React.useState('');

    // Using useDoc for real-time sync
    const brandingRef = React.useMemo(() => firestore ? doc(firestore, 'company', 'branding') : null, [firestore]);
    const { data: branding, isLoading } = useFetchDoc<CompanyBranding>(brandingRef as any);

    // Track original data for unsaved changes detection
    const originalDataRef = React.useRef<{ colors: BrandColor[]; mapping: ThemeMapping } | null>(null);
    const didInitRef = React.useRef(false);

    React.useEffect(() => {
        if (isLoading) return;

        // If the doc doesn't exist yet, we still need a baseline so "Save" can enable on edits.
        const brandColors = branding?.brandColors ?? [];
        const themeMapping = branding?.themeMapping ?? DEFAULT_MAPPING;

        // Sanitize mapping: if an id no longer exists in brandColors, fall back to default.
        const validIds = new Set(brandColors.map((c) => c.id));
        const nextMapping: ThemeMapping = {
            ...DEFAULT_MAPPING,
            ...themeMapping,
        };
        (Object.keys(nextMapping) as Array<keyof ThemeMapping>).forEach((key) => {
            const val = nextMapping[key];
            if (val && !validIds.has(val)) nextMapping[key] = '';
        });

        // First non-loading render: initialize baseline (even if branding is undefined).
        if (!didInitRef.current) {
            didInitRef.current = true;
            setColors(brandColors);
            setMapping(nextMapping);
            originalDataRef.current = { colors: brandColors, mapping: nextMapping };
            setHasUnsavedChanges(false);
            return;
        }

        // Subsequent updates: keep in sync only when user has no local edits.
        if (!hasUnsavedChanges && !isSaving) {
            setColors(brandColors);
            setMapping(nextMapping);
            originalDataRef.current = { colors: brandColors, mapping: nextMapping };
            setHasUnsavedChanges(false);
        }
    }, [branding, isLoading, hasUnsavedChanges, isSaving]);

    // Track unsaved changes
    React.useEffect(() => {
        if (originalDataRef.current) {
            const hasChanges = JSON.stringify({ colors, mapping }) !== JSON.stringify(originalDataRef.current);
            setHasUnsavedChanges(hasChanges);
        }
    }, [colors, mapping]);

    // Warn on tab close/refresh if there are unsaved changes
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
        setEditName('');
        setEditHex('');
    };

    const handleCancelEdit = () => {
        setEditingColorId(null);
        setEditName('');
        setEditHex('');
    };

    const handleApplyPreset = (presetId: string) => {
        const preset = PRESET_PALETTES.find(p => p.id === presetId);
        if (!preset) return;

        const newColors = preset.colors.map(c => ({
            id: crypto.randomUUID(),
            name: c.name,
            hex: c.hex,
        }));
        setColors((prev) => [...prev, ...newColors]);
        toast({ title: `"${preset.name}" палетт нэмэгдлээ` });
    };

    const handleReset = () => {
        const brandColors = branding?.brandColors ?? [];
        const themeMapping = branding?.themeMapping ?? DEFAULT_MAPPING;
        const validIds = new Set(brandColors.map((c) => c.id));
        const nextMapping: ThemeMapping = {
            ...DEFAULT_MAPPING,
            ...themeMapping,
        };
        (Object.keys(nextMapping) as Array<keyof ThemeMapping>).forEach((key) => {
            const val = nextMapping[key];
            if (val && !validIds.has(val)) nextMapping[key] = '';
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
                {
                    brandColors: colors,
                    themeMapping: mapping,
                },
                { merge: true }
            );
            originalDataRef.current = { colors, mapping };
            setHasUnsavedChanges(false);
            toast({ title: "Амжилттай хадгалагдлаа" });
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
                        showBackButton={true}
                        hideBreadcrumbs={true}
                        backHref="/dashboard/company"
                    />
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                        <div className="lg:col-span-5 space-y-4">
                            <Skeleton className="h-[400px] rounded-xl" />
                            <Skeleton className="h-[300px] rounded-xl" />
                        </div>
                        <div className="lg:col-span-7">
                            <Skeleton className="h-[700px] rounded-xl" />
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
                    description="Системийн өнгө төрхийг өөрийн брэндийн дагуу өөрчлөх."
                    showBackButton={true}
                    hideBreadcrumbs={true}
                    backHref="/dashboard/company"
                    actions={
                        <div className="flex items-center gap-2">
                            {hasUnsavedChanges && (
                                <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50">
                                    Хадгалаагүй өөрчлөлт
                                </Badge>
                            )}
                            <Button variant="outline" size="sm" onClick={handleReset} disabled={isLoading || isSaving || !hasUnsavedChanges}>
                                <RotateCcw className="mr-2 h-4 w-4" /> Буцаах
                            </Button>
                            <Button size="sm" onClick={handleSave} disabled={isLoading || isSaving || !hasUnsavedChanges}>
                                <Save className="mr-2 h-4 w-4" /> Хадгалах
                            </Button>
                        </div>
                    }
                />

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                    {/* Left Column: Color Management */}
                    <div className="lg:col-span-5 space-y-6">
                        <Tabs defaultValue="colors" className="w-full">
                            <VerticalTabMenu
                                orientation="horizontal"
                                items={[
                                    { value: 'colors', label: 'Өнгөнүүд' },
                                    { value: 'mapping', label: 'Mapping' },
                                    { value: 'contrast', label: 'Contrast' },
                                ]}
                            />

                            <TabsContent value="colors" className="mt-4 space-y-4">
                                {/* Preset Palettes */}
                                <Card>
                                    <CardHeader className="pb-3">
                                        <CardTitle className="text-base flex items-center gap-2">
                                            <Sparkles className="h-4 w-4" />
                                            Бэлэн палеттууд
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="grid grid-cols-2 gap-2">
                                            {PRESET_PALETTES.map(preset => (
                                                <button
                                                    key={preset.id}
                                                    onClick={() => handleApplyPreset(preset.id)}
                                                    className="p-3 rounded-lg border hover:border-primary/50 hover:bg-muted/50 transition-all text-left group"
                                                >
                                                    <div className="flex gap-1 mb-2">
                                                        {preset.colors.slice(0, 4).map((c, i) => (
                                                            <div 
                                                                key={i}
                                                                className="h-4 w-4 rounded-full border shadow-sm"
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

                                {/* Custom Colors */}
                                <Card>
                                    <CardHeader className="pb-3">
                                        <CardTitle className="text-base">Өнгө нэмэх</CardTitle>
                                    </CardHeader>
                                    <CardContent>
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
                                    </CardContent>
                                </Card>

                                {/* Color List */}
                                <Card>
                                    <CardHeader className="pb-3">
                                        <div className="flex items-center justify-between">
                                            <CardTitle className="text-base">Миний өнгөнүүд</CardTitle>
                                            <Badge variant="secondary">{colors.length}</Badge>
                                        </div>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                                            {colors.length === 0 ? (
                                                <div className="text-center py-8 text-muted-foreground border border-dashed rounded-lg">
                                                    <Palette className="h-8 w-8 mx-auto mb-2 opacity-50" />
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
                            </TabsContent>

                            <TabsContent value="mapping" className="mt-4">
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="text-base">Системийн өнгө оноох</CardTitle>
                                        <CardDescription>
                                            Бүртгэсэн өнгөнүүдээс системийн хэсгүүдэд оноох.
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        {THEME_SLOTS.map(slot => (
                                            <div key={slot.key} className="space-y-2">
                                                <Label className="flex items-center gap-2 text-sm">
                                                    <div 
                                                        className={cn("w-4 h-4 rounded-full border", slot.previewClass)}
                                                        style={
                                                            mapping[slot.key] && colors.find(c => c.id === mapping[slot.key])
                                                                ? { backgroundColor: colors.find(c => c.id === mapping[slot.key])?.hex }
                                                                : undefined
                                                        }
                                                    />
                                                    {slot.label}
                                                </Label>
                                                <Select
                                                    value={mapping[slot.key] || '__default__'}
                                                    onValueChange={(val) => setMapping(prev => ({ ...prev, [slot.key]: val === '__default__' ? '' : val }))}
                                                >
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Өнгө сонгох..." />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="__default__">
                                                            <span className="text-muted-foreground">Анхдагч</span>
                                                        </SelectItem>
                                                        {colors.map(c => (
                                                            <SelectItem key={c.id} value={c.id}>
                                                                <div className="flex items-center gap-2">
                                                                    <div className="w-4 h-4 rounded-full border" style={{ backgroundColor: c.hex }} />
                                                                    {c.name}
                                                                </div>
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                <p className="text-xs text-muted-foreground">{slot.description}</p>
                                            </div>
                                        ))}
                                    </CardContent>
                                </Card>
                            </TabsContent>

                            <TabsContent value="contrast" className="mt-4">
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="text-base flex items-center gap-2">
                                            <CheckCircle2 className="h-4 w-4" />
                                            WCAG Contrast шалгалт
                                        </CardTitle>
                                        <CardDescription>
                                            Өнгөний харагдах байдал, хүртээмжийн шалгалт.
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <ContrastChecker colors={colors} mapping={mapping} />
                                    </CardContent>
                                </Card>
                            </TabsContent>
                        </Tabs>
                    </div>

                    {/* Right Column: Preview */}
                    <div className="lg:col-span-7 lg:sticky lg:top-4">
                        <Card className="border-2 border-dashed overflow-hidden">
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
                            <CardContent className="p-4 bg-slate-100">
                                <BrandingPreview 
                                    colors={colors} 
                                    mapping={mapping} 
                                    isDark={previewMode === 'dark'} 
                                />
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    );
}
