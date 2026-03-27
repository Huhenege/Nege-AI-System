'use client';

import * as React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardFooter
} from '@/components/ui/card';
import {
    Carousel,
    CarouselContent,
    CarouselItem,
    CarouselApi
} from '@/components/ui/carousel';
import { Button } from '@/components/ui/button';
import { useFirebase, useDoc, useMemoFirebase, useFetchCollection, tenantDoc, tenantCollection, useTenantWrite } from '@/firebase';
import { collection, addDoc, updateDoc, Timestamp, deleteDoc, writeBatch } from 'firebase/firestore';
import { Pencil, Building, Hash, Users, User, Globe, FileText, Rocket, Eye, Shield, Phone, Mail, MapPin, Video, Handshake, Zap, Users2, ScrollText, ChevronLeft, ExternalLink, Calendar, Palette, Building2, Crown, UserPlus, ArrowRight, Loader2, Check, Plus, Trash2, ChevronRight, DollarSign, Gift, Layers, Briefcase, RotateCcw, AlertTriangle, History } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { companyProfileSchema, CompanyProfileValues, videoSchema } from './schemas';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/patterns/page-layout';
import { CoreValue } from '@/types/points';
import { query, orderBy } from 'firebase/firestore';
import { hexToHsl } from '@/lib/color-utils';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Position, Department, PositionLevel, EmploymentType } from '../organization/types';
import { Employee } from '@/types';
import { AppointEmployeeDialog } from '../organization/[departmentId]/components/flow/appoint-employee-dialog';
import { CEOCard } from './components/ceo-card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CurrencyInput } from '../organization/positions/[positionId]/components/currency-input';

// CEO Setup wizard types
interface SalaryStep {
    name: string;
    value: number;
}

interface Incentive {
    type: string;
    description: string;
    amount: number;
    currency: string;
    unit: '%' | '₮';
    frequency: string;
}

interface Allowance {
    type: string;
    amount: number;
    currency: string;
    period: 'once' | 'daily' | 'monthly' | 'quarterly' | 'semi-annually' | 'yearly';
}

interface CEOSetupData {
    levelId: string;
    employmentTypeId: string;
    salaryRange: {
        min: number;
        max: number;
        currency: string;
    };
    salarySteps: {
        items: SalaryStep[];
        activeIndex: number;
        currency: string;
    };
    incentives: Incentive[];
    allowances: Allowance[];
}

// Helper functions for number formatting
const formatNumberWithCommas = (num: number | string): string => {
    if (!num && num !== 0) return '';
    const numStr = typeof num === 'string' ? num.replace(/,/g, '') : num.toString();
    const numVal = parseFloat(numStr);
    if (isNaN(numVal)) return '';
    return numVal.toLocaleString('en-US');
};

const parseFormattedNumber = (str: string): number => {
    if (!str) return 0;
    const cleaned = str.replace(/,/g, '');
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
};

interface BrandColor {
    id: string;
    name: string;
    hex: string;
}

interface CompanyBranding {
    brandColors: BrandColor[];
    themeMapping: {
        primary: string;
        secondary: string;
        accent: string;
    };
}




const valueIcons: { [key: string]: React.ElementType } = {
    responsibility: Handshake,
    innovation: Zap,
    collaboration: Users2,
    default: Shield,
};

const InfoRow = ({
    icon: Icon,
    label,
    value,
    className,
}: {
    icon: React.ElementType;
    label: string;
    value?: string | null;
    className?: string;
}) => (
    <div className={`flex items-start gap-4 ${className}`}>
        <Icon className="h-5 w-5 flex-shrink-0 text-muted-foreground" />
        <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="font-medium text-foreground">{value || 'Тодорхойгүй'}</p>
        </div>
    </div>
);

function PageSkeleton() {
    return (
        <div className='space-y-12 py-8'>
            <div className="flex flex-col items-center text-center space-y-4 mb-12">
                <Skeleton className="h-24 w-24 rounded-full" />
                <Skeleton className="h-10 w-64" />
            </div>
            <div className="space-y-8">
                <Skeleton className="h-48 w-full" />
                <Skeleton className="h-48 w-full" />
            </div>
        </div>
    );
}

export default function CompanyPage() {
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const { tDoc, tCollection } = useTenantWrite();
    const [api, setApi] = React.useState<CarouselApi>();

    React.useEffect(() => {
        if (!api) return;
        const id = setInterval(() => api.scrollNext(), 5000);
        return () => clearInterval(id);
    }, [api]);

    const companyProfileRef = useMemoFirebase(
        ({ firestore, companyPath }) => (firestore ? tenantDoc(firestore, companyPath, 'company', 'profile') : null), []
    );
    const departmentsQuery = useMemoFirebase(({ firestore, companyPath }) => (firestore ? tenantCollection(firestore, companyPath, 'departments') : null), []);
    const positionsQuery = useMemoFirebase(({ firestore, companyPath }) => (firestore ? tenantCollection(firestore, companyPath, 'positions') : null), []);
    const policiesQuery = useMemoFirebase(({ firestore, companyPath }) => (firestore ? tenantCollection(firestore, companyPath, 'companyPolicies') : null), []);
    const positionLevelsQuery = useMemoFirebase(({ firestore, companyPath }) => (firestore ? tenantCollection(firestore, companyPath, 'positionLevels') : null), []);
    const employmentTypesQuery = useMemoFirebase(({ firestore, companyPath }) => (firestore ? tenantCollection(firestore, companyPath, 'employmentTypes') : null), []);
    const brandingRef = useMemoFirebase(({ firestore, companyPath }) => (firestore ? tenantDoc(firestore, companyPath, 'company', 'branding') : null), []);
    const valuesQuery = useMemoFirebase(
        ({ firestore, companyPath }) => {
            if (!firestore || !companyPath) return null;
            return query(collection(firestore, `${companyPath}/company/branding/values`), orderBy('createdAt', 'asc'));
        }, []
    );

    const { data: companyProfile, isLoading: isLoadingProfile, error } = useDoc<CompanyProfileValues>(companyProfileRef as any);
    const { data: branding, isLoading: isLoadingBranding } = useDoc<CompanyBranding>(brandingRef as any);
    const { data: departments, isLoading: isLoadingDepts } = useFetchCollection<Department>(departmentsQuery);
    const { data: positions, isLoading: isLoadingPos } = useFetchCollection<Position>(positionsQuery);
    const { data: policies, isLoading: isLoadingPolicies } = useFetchCollection(policiesQuery);
    const { data: coreValues, isLoading: isLoadingValues } = useFetchCollection<CoreValue>(valuesQuery);
    const { data: positionLevels } = useFetchCollection<PositionLevel>(positionLevelsQuery);
    const { data: employmentTypes } = useFetchCollection<EmploymentType>(employmentTypesQuery);

    const ceoPositionRef = useMemoFirebase(
        ({ firestore, companyPath }) => {
            if (!firestore || !companyProfile) return null;
            const id = (companyProfile as any).ceoPositionId;
            return id ? tenantDoc(firestore, companyPath, 'positions', id) : null;
        }, [companyProfile]
    );
    const ceoEmployeeRef = useMemoFirebase(
        ({ firestore, companyPath }) => {
            if (!firestore || !companyProfile) return null;
            const id = (companyProfile as any).ceoEmployeeId;
            return id ? tenantDoc(firestore, companyPath, 'employees', id) : null;
        }, [companyProfile]
    );
    const { data: ceoPosition, isLoading: isLoadingCeoPosition } = useDoc<Position>(ceoPositionRef as any);
    const { data: ceoEmployee, isLoading: isLoadingCeoEmployee } = useDoc<Employee>(ceoEmployeeRef as any);

    const isLoading = isLoadingProfile || isLoadingDepts || isLoadingPos || isLoadingPolicies || isLoadingValues || isLoadingBranding;

    const brandStyles = React.useMemo(() => {
        if (!branding?.brandColors || !branding?.themeMapping) return {};
        const { brandColors, themeMapping } = branding;
        const styles: Record<string, string> = {};
        const primary = brandColors.find(c => c.id === themeMapping.primary);
        const secondary = brandColors.find(c => c.id === themeMapping.secondary);
        const accent = brandColors.find(c => c.id === themeMapping.accent);
        const p = primary ? hexToHsl(primary.hex) : null;
        const s = secondary ? hexToHsl(secondary.hex) : null;
        const a = accent ? hexToHsl(accent.hex) : null;
        if (p) styles['--primary'] = p;
        if (s) styles['--secondary'] = s;
        if (a) styles['--accent'] = a;
        return styles;
    }, [branding]);

    if (error) {
        return (
            <div className="flex flex-col h-full overflow-hidden p-6 md:p-8">
                <Card>
                    <CardHeader>
                        <CardTitle>Алдаа гарлаа</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-destructive">Компанийн мэдээллийг ачаалахад алдаа гарлаа: {error.message}</p>
                    </CardContent>
                </Card>
            </div>
        )
    }

    if (isLoading) {
        return (
            <div className="flex flex-col h-full overflow-hidden">
                <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8 pb-32">
                    <PageSkeleton />
                </div>
            </div>
        )
    }

    if (!companyProfile) {
        return (
            <div className="flex flex-col h-full overflow-hidden">
                <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8 pb-32">
                    <PageHeader showBackButton backHref="/dashboard" title="Компани" description="Байгууллагын танилцуулга" />
                    <Card>
                        <CardHeader>
                            <CardTitle>Мэдээлэл олдсонгүй</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-muted-foreground mb-4">Компанийн мэдээлэл хараахан оруулаагүй байна.</p>
                            <Button asChild>
                                <Link href="/dashboard/company/edit">
                                    <Pencil className="mr-2 h-4 w-4" />
                                    Мэдээлэл нэмэх
                                </Link>
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </div>
        )
    }

    return (
        <div className="flex flex-col h-full" style={brandStyles}>
            {/* Header */}
            <div className="bg-white border-b sticky top-0 z-20">
                <div className="px-6 md:px-8">
                    <div className="flex items-center justify-between py-4">
                        <div className="flex items-center gap-4">
                            <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                                <Link href="/dashboard">
                                    <ChevronLeft className="h-4 w-4" />
                                </Link>
                            </Button>
                            <div className="flex items-center gap-3">
                                <Avatar className="h-10 w-10 rounded-lg border">
                                    <AvatarImage src={companyProfile.logoUrl} className="object-contain" />
                                    <AvatarFallback className="rounded-lg bg-primary/10">
                                        <Building className="h-5 w-5 text-primary" />
                                    </AvatarFallback>
                                </Avatar>
                                <div>
                                    <h1 className="text-lg font-semibold">{companyProfile.name}</h1>
                                    <p className="text-xs text-muted-foreground">{companyProfile.industry || 'Компанийн танилцуулга'}</p>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button variant="outline" size="sm" asChild>
                                <Link href="/dashboard/company/edit">
                                    <Pencil className="h-3.5 w-3.5 mr-2" />
                                    Засах
                                </Link>
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto">
                <div className="p-6 md:p-8 space-y-8 pb-32">

                    {/* Hero Card with Cover */}
                    <div className="bg-white rounded-xl border overflow-hidden">
                        {/* Cover Image */}
                        {companyProfile.coverUrls && companyProfile.coverUrls.length > 0 ? (
                            <Carousel setApi={setApi} className="w-full" opts={{ loop: true }}>
                                <CarouselContent className="-ml-0">
                                    {companyProfile.coverUrls.map((url, index) => (
                                        <CarouselItem key={index} className="pl-0">
                                            <div className="relative h-[200px] md:h-[280px] w-full bg-slate-100">
                                                <img src={url} alt={`Cover ${index + 1}`} className="w-full h-full object-cover" />
                                                <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                                            </div>
                                        </CarouselItem>
                                    ))}
                                </CarouselContent>
                            </Carousel>
                        ) : (
                            <div className="h-[160px] bg-gradient-to-br from-primary/10 via-primary/5 to-transparent" />
                        )}

                        {/* Company Info */}
                        <div className="p-6 -mt-16 relative bg-white" style={{ marginTop: '-4rem' }}>
                            <div className="flex flex-col md:flex-row gap-6">
                                <Avatar className="h-28 w-28 rounded-2xl border-4 border-white shadow-lg bg-white self-start md:self-end">
                                    <AvatarImage src={companyProfile.logoUrl} className="object-contain p-2" />
                                    <AvatarFallback className="rounded-2xl bg-slate-50">
                                        <Building className="h-12 w-12 text-slate-300" />
                                    </AvatarFallback>
                                </Avatar>
                                <div className="flex-1 space-y-2 mt-20 md:mt-0 md:pt-28">
                                    <h2 className="text-2xl font-bold text-foreground">{companyProfile.name}</h2>
                                    {companyProfile.legalName && (
                                        <p className="text-sm text-muted-foreground">{companyProfile.legalName}</p>
                                    )}
                                    {companyProfile.introduction && (
                                        <p className="text-sm text-foreground leading-relaxed bg-white rounded-lg p-3 border border-slate-200">
                                            {companyProfile.introduction}
                                        </p>
                                    )}
                                    <div className="flex flex-wrap gap-2">
                                        {companyProfile.employeeCount && (
                                            <Badge variant="outline" className="gap-1">
                                                <Users className="h-3 w-3" />
                                                {companyProfile.employeeCount} ажилтан
                                            </Badge>
                                        )}
                                        {companyProfile.establishedDate && (
                                            <Badge variant="outline" className="gap-1">
                                                <Calendar className="h-3 w-3" />
                                                {companyProfile.establishedDate}
                                            </Badge>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Quick Actions */}
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                        <Link href="/dashboard/company/mission" className="bg-white rounded-xl border p-4 hover:border-primary/50 hover:shadow-sm transition-all group">
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-lg bg-orange-50 flex items-center justify-center group-hover:bg-orange-100 transition-colors">
                                    <Rocket className="h-5 w-5 text-orange-600" />
                                </div>
                                <div>
                                    <p className="text-sm font-medium">Соёл</p>
                                    <p className="text-xs text-muted-foreground">Эрхэм зорилго</p>
                                </div>
                            </div>
                        </Link>
                        <Link href="/dashboard/company/videos" className="bg-white rounded-xl border p-4 hover:border-primary/50 hover:shadow-sm transition-all group">
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-lg bg-blue-50 flex items-center justify-center group-hover:bg-blue-100 transition-colors">
                                    <Video className="h-5 w-5 text-blue-600" />
                                </div>
                                <div>
                                    <p className="text-sm font-medium">Видео</p>
                                    <p className="text-xs text-muted-foreground">{companyProfile.videos?.length || 0} видео</p>
                                </div>
                            </div>
                        </Link>
                        <Link href="/dashboard/company/branding" className="bg-white rounded-xl border p-4 hover:border-primary/50 hover:shadow-sm transition-all group">
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-lg bg-violet-50 flex items-center justify-center group-hover:bg-violet-100 transition-colors">
                                    <Palette className="h-5 w-5 text-violet-600" />
                                </div>
                                <div>
                                    <p className="text-sm font-medium">Брэндинг</p>
                                    <p className="text-xs text-muted-foreground">Өнгө, лого</p>
                                </div>
                            </div>
                        </Link>
                        <Link href="/dashboard/company/policies" className="bg-white rounded-xl border p-4 hover:border-primary/50 hover:shadow-sm transition-all group">
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-lg bg-emerald-50 flex items-center justify-center group-hover:bg-emerald-100 transition-colors">
                                    <ScrollText className="h-5 w-5 text-emerald-600" />
                                </div>
                                <div>
                                    <p className="text-sm font-medium">Журам</p>
                                    <p className="text-xs text-muted-foreground">{policies?.length || 0} журам</p>
                                </div>
                            </div>
                        </Link>
                        <Link href="/dashboard/company/history" className="bg-white rounded-xl border p-4 hover:border-primary/50 hover:shadow-sm transition-all group">
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-lg bg-amber-50 flex items-center justify-center group-hover:bg-amber-100 transition-colors">
                                    <History className="h-5 w-5 text-amber-600" />
                                </div>
                                <div>
                                    <p className="text-sm font-medium">Түүх</p>
                                    <p className="text-xs text-muted-foreground">Үйл явдлууд</p>
                                </div>
                            </div>
                        </Link>
                    </div>

                    {/* CEO Card */}
                    <CEOCard
                        companyProfile={companyProfile as Record<string, unknown>}
                        ceoPosition={ceoPosition ?? null}
                        ceoEmployee={ceoEmployee ?? null}
                        isLoadingCeoPosition={isLoadingCeoPosition}
                        isLoadingCeoEmployee={isLoadingCeoEmployee}
                        departments={departments}
                        positions={positions}
                        positionLevels={positionLevels}
                        employmentTypes={employmentTypes}
                    />
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Left Column - Details */}
                        <div className="lg:col-span-2 space-y-6">
                            {/* Mission & Vision */}
                            <div className="bg-white rounded-xl border">
                                <div className="p-4 border-b">
                                    <h3 className="font-medium">Эрхэм зорилго & Алсын хараа</h3>
                                </div>
                                <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-2">
                                            <div className="h-8 w-8 rounded-lg bg-orange-50 flex items-center justify-center">
                                                <Rocket className="h-4 w-4 text-orange-600" />
                                            </div>
                                            <span className="text-sm font-medium text-muted-foreground">Эрхэм зорилго</span>
                                        </div>
                                        <p className="text-sm leading-relaxed">
                                            {companyProfile.mission || 'Оруулаагүй байна'}
                                        </p>
                                    </div>
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-2">
                                            <div className="h-8 w-8 rounded-lg bg-blue-50 flex items-center justify-center">
                                                <Eye className="h-4 w-4 text-blue-600" />
                                            </div>
                                            <span className="text-sm font-medium text-muted-foreground">Алсын хараа</span>
                                        </div>
                                        <p className="text-sm leading-relaxed">
                                            {companyProfile.vision || 'Оруулаагүй байна'}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Core Values - карт бүр тусад картаар */}
                            {coreValues && coreValues.filter(v => v.isActive !== false).length > 0 && (
                                <div className="space-y-3">
                                    <h3 className="font-medium px-1">Үнэт зүйлс</h3>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        {coreValues.filter(v => v.isActive !== false).map((value) => (
                                            <Card key={value.id} className="rounded-xl border overflow-hidden">
                                                <CardContent className="p-4 flex items-start gap-3">
                                                    <div
                                                        className="h-10 w-10 rounded-lg flex items-center justify-center text-xl shrink-0"
                                                        style={{ backgroundColor: `${value.color}15` }}
                                                    >
                                                        {value.emoji || '⭐'}
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <p className="font-medium text-sm">{value.title}</p>
                                                        <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{value.description}</p>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Videos */}
                            {companyProfile.videos && companyProfile.videos.length > 0 && (
                                <div className="bg-white rounded-xl border">
                                    <div className="p-4 border-b flex items-center justify-between">
                                        <h3 className="font-medium">Видео танилцуулга</h3>
                                        <Button variant="ghost" size="sm" asChild>
                                            <Link href="/dashboard/company/videos">
                                                Бүгдийг харах
                                            </Link>
                                        </Button>
                                    </div>
                                    <div className="p-6">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {companyProfile.videos.slice(0, 2).map((video, index) => (
                                                <div key={index} className="space-y-3">
                                                    <div className="aspect-video rounded-lg overflow-hidden bg-slate-100">
                                                        <video src={video.url} controls className="w-full h-full object-cover" />
                                                    </div>
                                                    <div>
                                                        <p className="font-medium text-sm">{video.title}</p>
                                                        {video.description && (
                                                            <p className="text-xs text-muted-foreground line-clamp-1">{video.description}</p>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Right Column - Info */}
                        <div className="space-y-6">
                            {/* Company Info Card */}
                            <div className="bg-white rounded-xl border">
                                <div className="p-4 border-b">
                                    <h3 className="font-medium">Үндсэн мэдээлэл</h3>
                                </div>
                                <div className="p-4 space-y-4">
                                    {companyProfile.ceo && (
                                        <div className="flex items-center gap-3">
                                            <div className="h-9 w-9 rounded-lg bg-slate-100 flex items-center justify-center">
                                                <User className="h-4 w-4 text-slate-500" />
                                            </div>
                                            <div>
                                                <p className="text-[11px] text-muted-foreground">Захирал</p>
                                                <p className="text-sm font-medium">{companyProfile.ceo}</p>
                                            </div>
                                        </div>
                                    )}
                                    {companyProfile.registrationNumber && (
                                        <div className="flex items-center gap-3">
                                            <div className="h-9 w-9 rounded-lg bg-slate-100 flex items-center justify-center">
                                                <Hash className="h-4 w-4 text-slate-500" />
                                            </div>
                                            <div>
                                                <p className="text-[11px] text-muted-foreground">Регистр</p>
                                                <p className="text-sm font-medium">{companyProfile.registrationNumber}</p>
                                            </div>
                                        </div>
                                    )}
                                    {companyProfile.taxId && (
                                        <div className="flex items-center gap-3">
                                            <div className="h-9 w-9 rounded-lg bg-slate-100 flex items-center justify-center">
                                                <FileText className="h-4 w-4 text-slate-500" />
                                            </div>
                                            <div>
                                                <p className="text-[11px] text-muted-foreground">Татварын дугаар</p>
                                                <p className="text-sm font-medium">{companyProfile.taxId}</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Contact Card */}
                            <div className="bg-white rounded-xl border">
                                <div className="p-4 border-b">
                                    <h3 className="font-medium">Холбоо барих</h3>
                                </div>
                                <div className="p-4 space-y-4">
                                    {companyProfile.phoneNumber && (
                                        <div className="flex items-center gap-3">
                                            <div className="h-9 w-9 rounded-lg bg-emerald-50 flex items-center justify-center">
                                                <Phone className="h-4 w-4 text-emerald-600" />
                                            </div>
                                            <div>
                                                <p className="text-[11px] text-muted-foreground">Утас</p>
                                                <p className="text-sm font-medium">{companyProfile.phoneNumber}</p>
                                            </div>
                                        </div>
                                    )}
                                    {companyProfile.contactEmail && (
                                        <div className="flex items-center gap-3">
                                            <div className="h-9 w-9 rounded-lg bg-blue-50 flex items-center justify-center">
                                                <Mail className="h-4 w-4 text-blue-600" />
                                            </div>
                                            <div>
                                                <p className="text-[11px] text-muted-foreground">И-мэйл</p>
                                                <p className="text-sm font-medium">{companyProfile.contactEmail}</p>
                                            </div>
                                        </div>
                                    )}
                                    {companyProfile.website && (
                                        <div className="flex items-center gap-3">
                                            <div className="h-9 w-9 rounded-lg bg-violet-50 flex items-center justify-center">
                                                <Globe className="h-4 w-4 text-violet-600" />
                                            </div>
                                            <div>
                                                <p className="text-[11px] text-muted-foreground">Вэбсайт</p>
                                                <a href={companyProfile.website} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-primary hover:underline flex items-center gap-1">
                                                    {companyProfile.website.replace(/^https?:\/\//, '')}
                                                    <ExternalLink className="h-3 w-3" />
                                                </a>
                                            </div>
                                        </div>
                                    )}
                                    {companyProfile.address && (
                                        <div className="flex items-start gap-3">
                                            <div className="h-9 w-9 rounded-lg bg-orange-50 flex items-center justify-center shrink-0">
                                                <MapPin className="h-4 w-4 text-orange-600" />
                                            </div>
                                            <div>
                                                <p className="text-[11px] text-muted-foreground">Хаяг</p>
                                                <p className="text-sm font-medium">{companyProfile.address}</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Subsidiaries Card */}
                            <Link href="/dashboard/company/subsidiaries" className="block bg-white rounded-xl border hover:border-primary/50 hover:shadow-sm transition-all">
                                <div className="p-4 border-b flex items-center justify-between">
                                    <h3 className="font-medium">Охин компаниуд</h3>
                                    <ChevronLeft className="h-4 w-4 rotate-180 text-muted-foreground" />
                                </div>
                                <div className="p-4">
                                    {companyProfile.subsidiaries && companyProfile.subsidiaries.length > 0 ? (
                                        <div className="space-y-2">
                                            {companyProfile.subsidiaries.slice(0, 3).map((item, index) => {
                                                const name = typeof item === 'string' ? item : item.name;
                                                const regNum = typeof item === 'string' ? null : (item as { registrationNumber?: string }).registrationNumber;
                                                const logoUrl = typeof item === 'string' ? null : (item as { logoUrl?: string }).logoUrl;
                                                return (
                                                    <div
                                                        key={index}
                                                        className="flex items-center gap-2 p-2 rounded-lg bg-slate-50"
                                                    >
                                                        {logoUrl ? (
                                                            <Avatar className="h-8 w-8 rounded-lg shrink-0">
                                                                <AvatarImage src={logoUrl} alt={name} className="object-cover" />
                                                                <AvatarFallback className="rounded-lg bg-indigo-50">
                                                                    <Building2 className="h-4 w-4 text-indigo-500" />
                                                                </AvatarFallback>
                                                            </Avatar>
                                                        ) : (
                                                            <div className="h-8 w-8 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
                                                                <Building2 className="h-4 w-4 text-indigo-500" />
                                                            </div>
                                                        )}
                                                        <div className="min-w-0">
                                                            <p className="text-sm font-medium truncate">{name}</p>
                                                            {regNum && (
                                                                <p className="text-[10px] text-muted-foreground">РД: {regNum}</p>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                            {companyProfile.subsidiaries.length > 3 && (
                                                <p className="text-xs text-muted-foreground text-center pt-1">
                                                    +{companyProfile.subsidiaries.length - 3} бусад
                                                </p>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="text-center py-4">
                                            <Building2 className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                                            <p className="text-xs text-muted-foreground">
                                                Охин компани нэмэх
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
