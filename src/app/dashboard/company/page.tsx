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
import { z } from 'zod';
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


const videoSchema = z.object({
    title: z.string(),
    description: z.string().optional(),
    url: z.string(),
});

const companyProfileSchema = z.object({
    name: z.string().min(2, { message: 'Нэр дор хаяж 2 тэмдэгттэй байх ёстой.' }),
    logoUrl: z.string().optional(),
    legalName: z.string().optional(),
    registrationNumber: z.string().optional(),
    taxId: z.string().optional(),
    industry: z.string().optional(),
    employeeCount: z.string().optional(),
    establishedDate: z.string().optional(),
    ceo: z.string().optional(),
    website: z.string().url({ message: 'Вэбсайтын хаяг буруу байна.' }).optional().or(z.literal('')),
    mission: z.string().optional(),
    vision: z.string().optional(),
    videos: z.array(videoSchema).optional(),
    phoneNumber: z.string().optional(),
    contactEmail: z.string().email().optional().or(z.literal('')),
    address: z.string().optional(),
    introduction: z.string().optional(),
    coverUrls: z.array(z.string()).optional(),
    subsidiaries: z.array(z.union([
        z.string(),
        z.object({
            name: z.string(),
            registrationNumber: z.string().optional(),
        })
    ])).optional(),
});

type CompanyProfileValues = z.infer<typeof companyProfileSchema>;


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
    const [isSettingUpCEO, setIsSettingUpCEO] = React.useState(false);
    const [showAppointDialog, setShowAppointDialog] = React.useState(false);
    
    // CEO Setup Wizard State
    const [showCEOWizard, setShowCEOWizard] = React.useState(false);
    const [wizardStep, setWizardStep] = React.useState(1);
    const [isResettingCEO, setIsResettingCEO] = React.useState(false);
    const [showResetConfirm, setShowResetConfirm] = React.useState(false);
    const { tDoc, tCollection } = useTenantWrite();
    const [ceoSetupData, setCeoSetupData] = React.useState<CEOSetupData>({
        levelId: '',
        employmentTypeId: '',
        salaryRange: { min: 0, max: 0, currency: 'MNT' },
        salarySteps: { items: [], activeIndex: 0, currency: 'MNT' },
        incentives: [],
        allowances: []
    });
    
    const companyProfileRef = useMemoFirebase(
        ({ firestore, companyPath }) => (firestore ? tenantDoc(firestore, companyPath, 'company', 'profile') : null),
        []
    );

    const departmentsQuery = useMemoFirebase(({ firestore, companyPath }) => (firestore ? tenantCollection(firestore, companyPath, 'departments') : null), []);
    const positionsQuery = useMemoFirebase(({ firestore, companyPath }) => (firestore ? tenantCollection(firestore, companyPath, 'positions') : null), []);
    const policiesQuery = useMemoFirebase(({ firestore, companyPath }) => (firestore ? tenantCollection(firestore, companyPath, 'companyPolicies') : null), []);
    
    // For CEO Setup Wizard
    const positionLevelsQuery = useMemoFirebase(({ firestore, companyPath }) => (firestore ? tenantCollection(firestore, companyPath, 'positionLevels') : null), []);
    const employmentTypesQuery = useMemoFirebase(({ firestore, companyPath }) => (firestore ? tenantCollection(firestore, companyPath, 'employmentTypes') : null), []);

    const brandingRef = useMemoFirebase(
        ({ firestore, companyPath }) => (firestore ? tenantDoc(firestore, companyPath, 'company', 'branding') : null),
        []
    );

    const valuesQuery = useMemoFirebase(
        ({ firestore, companyPath }) => {
            if (!firestore || !companyPath) return null;
            return query(collection(firestore, `${companyPath}/company/branding/values`), orderBy('createdAt', 'asc'));
        },
        []
    );
    const { data: companyProfile, isLoading: isLoadingProfile, error } = useDoc<CompanyProfileValues>(companyProfileRef as any);
    const { data: branding, isLoading: isLoadingBranding } = useDoc<CompanyBranding>(brandingRef as any);
    const { data: departments, isLoading: isLoadingDepts } = useFetchCollection<Department>(departmentsQuery);
    const { data: positions, isLoading: isLoadingPos } = useFetchCollection<Position>(positionsQuery);
    const { data: policies, isLoading: isLoadingPolicies } = useFetchCollection(policiesQuery);
    const { data: coreValues, isLoading: isLoadingValues } = useFetchCollection<CoreValue>(valuesQuery);
    
    // For CEO Setup Wizard
    const { data: positionLevels } = useFetchCollection<PositionLevel>(positionLevelsQuery);
    const { data: employmentTypes } = useFetchCollection<EmploymentType>(employmentTypesQuery);

    // CEO Position and Employee fetching
    const ceoPositionRef = useMemoFirebase(
        ({ firestore, companyPath }) => {
            if (!firestore || !companyProfile) return null;
            const ceoPositionId = (companyProfile as any).ceoPositionId;
            if (!ceoPositionId) return null;
            return tenantDoc(firestore, companyPath, 'positions', ceoPositionId);
        },
        [companyProfile]
    );
    
    const ceoEmployeeRef = useMemoFirebase(
        ({ firestore, companyPath }) => {
            if (!firestore || !companyProfile) return null;
            const ceoEmployeeId = (companyProfile as any).ceoEmployeeId;
            if (!ceoEmployeeId) return null;
            return tenantDoc(firestore, companyPath, 'employees', ceoEmployeeId);
        },
        [companyProfile]
    );

    const { data: ceoPosition, isLoading: isLoadingCeoPosition } = useDoc<Position>(ceoPositionRef as any);
    const { data: ceoEmployee, isLoading: isLoadingCeoEmployee } = useDoc<Employee>(ceoEmployeeRef as any);

    const [api, setApi] = React.useState<CarouselApi>();

    React.useEffect(() => {
        if (!api) return;

        const intervalId = setInterval(() => {
            api.scrollNext();
        }, 5000);

        return () => clearInterval(intervalId);
    }, [api]);

    const isLoading = isLoadingProfile || isLoadingDepts || isLoadingPos || isLoadingPolicies || isLoadingValues || isLoadingBranding;

    const brandStyles = React.useMemo(() => {
        if (!branding || !branding.brandColors || !branding.themeMapping) return {};

        const { brandColors, themeMapping } = branding;
        const styles: any = {};

        const primaryColor = brandColors.find(c => c.id === themeMapping.primary);
        const secondaryColor = brandColors.find(c => c.id === themeMapping.secondary);
        const accentColor = brandColors.find(c => c.id === themeMapping.accent);

        if (primaryColor) styles['--primary'] = hexToHsl(primaryColor.hex);
        if (secondaryColor) styles['--secondary'] = hexToHsl(secondaryColor.hex);
        if (accentColor) styles['--accent'] = hexToHsl(accentColor.hex);

        return styles;
    }, [branding]);

    // Start CEO Setup Wizard
    const handleStartCEOWizard = () => {
        setShowCEOWizard(true);
        setWizardStep(1);
        setCeoSetupData({
            levelId: '',
            employmentTypeId: '',
            salaryRange: { min: 0, max: 0, currency: 'MNT' },
            salarySteps: { items: [], activeIndex: 0, currency: 'MNT' },
            incentives: [],
            allowances: []
        });
    };

    // Handle CEO Position Setup (Final step of wizard)
    const handleSetupCEO = async () => {
        if (!firestore) return;
        
        setIsSettingUpCEO(true);
        try {
            let ceoDepartmentId: string;
            
            // Step 1: Find or create "Удирдлага" department
            const existingDept = departments?.find(d => d.name === 'Удирдлага');
            if (!existingDept) {
                // Create new department
                const deptRef = await addDoc(tCollection('departments'), {
                    name: 'Удирдлага',
                    type: 'executive',
                    description: 'Байгууллагын удирдлага',
                    createdAt: Timestamp.now(),
                    updatedAt: Timestamp.now()
                });
                ceoDepartmentId = deptRef.id;
            } else {
                ceoDepartmentId = existingDept.id;
            }

            // Step 2: Create "Гүйцэтгэх захирал" position with all wizard data
            const posRef = await addDoc(tCollection('positions'), {
                title: 'Гүйцэтгэх захирал',
                code: 'CEO',
                departmentId: ceoDepartmentId,
                reportsTo: null,
                filled: 0,
                headcount: 1,
                isApproved: true,
                isActive: true,
                // Wizard data
                levelId: ceoSetupData.levelId || null,
                employmentTypeId: ceoSetupData.employmentTypeId || null,
                salaryRange: ceoSetupData.salaryRange,
                salarySteps: ceoSetupData.salarySteps,
                incentives: ceoSetupData.incentives,
                allowances: ceoSetupData.allowances,
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now()
            });

            // Step 3: Update company profile with CEO IDs
            await updateDoc(tDoc('company', 'profile'), {
                ceoDepartmentId: ceoDepartmentId,
                ceoPositionId: posRef.id,
                ceoEmployeeId: null
            });

            toast({
                title: 'Амжилттай',
                description: 'Гүйцэтгэх захирлын ажлын байр үүслээ. Одоо ажилтан томилно уу.',
            });
            
            // Close wizard
            setShowCEOWizard(false);
            setWizardStep(1);

        } catch (error: any) {
            console.error('CEO setup error:', error);
            toast({
                title: 'Алдаа гарлаа',
                description: error?.message || 'Гүйцэтгэх захирлын ажлын байр үүсгэхэд алдаа гарлаа.',
                variant: 'destructive'
            });
        } finally {
            setIsSettingUpCEO(false);
        }
    };
    
    // Wizard helper functions
    const addSalaryStep = () => {
        setCeoSetupData(prev => ({
            ...prev,
            salarySteps: {
                ...prev.salarySteps,
                items: [...prev.salarySteps.items, { name: '', value: 0 }]
            }
        }));
    };
    
    const removeSalaryStep = (index: number) => {
        setCeoSetupData(prev => ({
            ...prev,
            salarySteps: {
                ...prev.salarySteps,
                items: prev.salarySteps.items.filter((_, i) => i !== index)
            }
        }));
    };
    
    const addIncentive = () => {
        setCeoSetupData(prev => ({
            ...prev,
            incentives: [...prev.incentives, { type: '', description: '', amount: 0, currency: 'MNT', unit: '₮', frequency: 'Сар бүр' }]
        }));
    };
    
    const removeIncentive = (index: number) => {
        setCeoSetupData(prev => ({
            ...prev,
            incentives: prev.incentives.filter((_, i) => i !== index)
        }));
    };
    
    const addAllowance = () => {
        setCeoSetupData(prev => ({
            ...prev,
            allowances: [...prev.allowances, { type: '', amount: 0, currency: 'MNT', period: 'monthly' }]
        }));
    };
    
    const removeAllowance = (index: number) => {
        setCeoSetupData(prev => ({
            ...prev,
            allowances: prev.allowances.filter((_, i) => i !== index)
        }));
    };
    
    const canProceedToNextStep = () => {
        switch (wizardStep) {
            case 1: return !!ceoSetupData.levelId;
            case 2: return !!ceoSetupData.employmentTypeId;
            case 3: return true; // Salary is optional
            case 4: return true; // Benefits is optional
            default: return true;
        }
    };

    // Handle CEO Appointment Complete
    const handleAppointComplete = async (employeeId: string) => {
        if (!firestore) return;
        
        try {
            // Update company profile with CEO employee ID
            await updateDoc(tDoc('company', 'profile'), {
                ceoEmployeeId: employeeId
            });
            
            toast({
                title: 'Амжилттай',
                description: 'Гүйцэтгэх захирал амжилттай томилогдлоо.',
            });
        } catch (error: any) {
            console.error('CEO appointment update error:', error);
        }
    };
    
    // Reset CEO Setup - Delete everything and start fresh
    const handleResetCEO = async () => {
        if (!firestore || !companyProfile) return;
        
        setIsResettingCEO(true);
        try {
            const profile = companyProfile as any;
            
            // 1. If CEO employee is appointed, release them (use individual update with try-catch)
            if (profile.ceoEmployeeId && ceoEmployee) {
                try {
                    const empRef = tDoc('employees', profile.ceoEmployeeId);
                    await updateDoc(empRef, {
                        positionId: null,
                        jobTitle: null,
                        departmentId: null,
                        updatedAt: Timestamp.now()
                    });
                } catch (empError) {
                    console.warn('Employee update skipped:', empError);
                }
            }
            
            // 2. Delete CEO position if exists
            if (profile.ceoPositionId) {
                try {
                    const posRef = tDoc('positions', profile.ceoPositionId);
                    await deleteDoc(posRef);
                } catch (posError) {
                    console.warn('Position delete skipped:', posError);
                }
            }
            
            // 3. Delete "Удирдлага" department if it was created for CEO
            // Only delete if it's the CEO department and has no other positions
            if (profile.ceoDepartmentId) {
                const dept = departments?.find(d => d.id === profile.ceoDepartmentId);
                if (dept && dept.name === 'Удирдлага') {
                    // Check if there are other positions in this department
                    const otherPositions = positions?.filter(
                        p => p.departmentId === profile.ceoDepartmentId && p.id !== profile.ceoPositionId
                    );
                    if (!otherPositions || otherPositions.length === 0) {
                        try {
                            const deptRef = tDoc('departments', profile.ceoDepartmentId);
                            await deleteDoc(deptRef);
                        } catch (deptError) {
                            console.warn('Department delete skipped:', deptError);
                        }
                    }
                }
            }
            
            // 4. Clear CEO IDs from company profile
            const profileRef = tDoc('company', 'profile');
            await updateDoc(profileRef, {
                ceoDepartmentId: null,
                ceoPositionId: null,
                ceoEmployeeId: null
            });
            
            toast({
                title: 'Амжилттай',
                description: 'Гүйцэтгэх захирлын тохиргоо устгагдлаа. Дахин эхлүүлж болно.',
            });
            
            setShowResetConfirm(false);
            
            // Auto-start wizard after reset
            setTimeout(() => {
                handleStartCEOWizard();
            }, 500);
            
        } catch (error: any) {
            console.error('CEO reset error:', error);
            toast({
                title: 'Алдаа гарлаа',
                description: error?.message || 'Тохиргоо устгахад алдаа гарлаа.',
                variant: 'destructive'
            });
        } finally {
            setIsResettingCEO(false);
        }
    };

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
                    <div className="bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 rounded-xl border border-amber-200/60 overflow-hidden">
                        <div className="p-5">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-200">
                                    <Crown className="h-5 w-5 text-white" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-amber-900">Гүйцэтгэх захирал</h3>
                                    <p className="text-xs text-amber-600">Байгууллагын удирдлага</p>
                                </div>
                            </div>

                            {/* State A: Not configured - Show Wizard */}
                            {!(companyProfile as any).ceoPositionId && !showCEOWizard && (
                                <div className="text-center py-6">
                                    <div className="h-16 w-16 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
                                        <Crown className="h-8 w-8 text-amber-400" />
                                    </div>
                                    <p className="text-sm text-amber-700 mb-4">
                                        Гүйцэтгэх захирлын ажлын байр тохируулаагүй байна
                                    </p>
                                    <Button 
                                        onClick={handleStartCEOWizard}
                                        className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-lg shadow-amber-200"
                                    >
                                        <Crown className="h-4 w-4 mr-2" />
                                        Гүйцэтгэх захирал тохируулах
                                    </Button>
                                </div>
                            )}
                            
                            {/* CEO Setup Wizard */}
                            {!(companyProfile as any).ceoPositionId && showCEOWizard && (
                                <div className="py-4">
                                    {/* Wizard Progress */}
                                    <div className="flex items-center justify-between mb-6 px-2">
                                        {[
                                            { step: 1, icon: Layers, label: 'Зэрэглэл' },
                                            { step: 2, icon: Briefcase, label: 'Төрөл' },
                                            { step: 3, icon: DollarSign, label: 'Цалин' },
                                            { step: 4, icon: Gift, label: 'Хангамж' },
                                            { step: 5, icon: Check, label: 'Баталгаажуулах' }
                                        ].map(({ step, icon: Icon, label }, index) => (
                                            <React.Fragment key={step}>
                                                <div className="flex flex-col items-center">
                                                    <div className={cn(
                                                        "h-10 w-10 rounded-full flex items-center justify-center text-sm font-medium transition-all",
                                                        wizardStep === step 
                                                            ? "bg-amber-500 text-white shadow-lg" 
                                                            : wizardStep > step 
                                                                ? "bg-emerald-500 text-white" 
                                                                : "bg-amber-100 text-amber-600"
                                                    )}>
                                                        {wizardStep > step ? <Check className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                                                    </div>
                                                    <span className={cn(
                                                        "text-[10px] mt-1 font-medium",
                                                        wizardStep >= step ? "text-amber-700" : "text-amber-400"
                                                    )}>{label}</span>
                                                </div>
                                                {index < 4 && (
                                                    <div className={cn(
                                                        "flex-1 h-0.5 mx-1",
                                                        wizardStep > step ? "bg-emerald-400" : "bg-amber-200"
                                                    )} />
                                                )}
                                            </React.Fragment>
                                        ))}
                                    </div>
                                    
                                    <ScrollArea className="h-[320px] pr-3">
                                        {/* Step 1: Position Level */}
                                        {wizardStep === 1 && (
                                            <div className="space-y-4">
                                                <div className="text-center mb-4">
                                                    <h4 className="font-semibold text-amber-900">Түвшин / Зэрэглэл сонгох</h4>
                                                    <p className="text-xs text-amber-600 mt-1">Гүйцэтгэх захирлын ажлын байрны зэрэглэлийг сонгоно уу</p>
                                                </div>
                                                <div className="grid grid-cols-1 gap-2">
                                                    {positionLevels?.map((level) => (
                                                        <button
                                                            key={level.id}
                                                            onClick={() => setCeoSetupData(prev => ({ ...prev, levelId: level.id }))}
                                                            className={cn(
                                                                "p-4 rounded-xl border-2 text-left transition-all hover:shadow-md",
                                                                ceoSetupData.levelId === level.id
                                                                    ? "border-amber-500 bg-amber-50 shadow-md"
                                                                    : "border-amber-100 hover:border-amber-300"
                                                            )}
                                                        >
                                                            <div className="flex items-center gap-3">
                                                                <div className={cn(
                                                                    "h-10 w-10 rounded-lg flex items-center justify-center",
                                                                    ceoSetupData.levelId === level.id ? "bg-amber-500 text-white" : "bg-amber-100 text-amber-600"
                                                                )}>
                                                                    <Layers className="h-5 w-5" />
                                                                </div>
                                                                <div>
                                                                    <p className="font-medium text-amber-900">{level.name}</p>
                                                                </div>
                                                                {ceoSetupData.levelId === level.id && (
                                                                    <Check className="h-5 w-5 text-amber-500 ml-auto" />
                                                                )}
                                                            </div>
                                                        </button>
                                                    ))}
                                                    {(!positionLevels || positionLevels.length === 0) && (
                                                        <p className="text-center text-amber-600 text-sm py-4">
                                                            Зэрэглэл тохируулаагүй байна. Тохиргоо хэсэгт нэмнэ үү.
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                        
                                        {/* Step 2: Employment Type */}
                                        {wizardStep === 2 && (
                                            <div className="space-y-4">
                                                <div className="text-center mb-4">
                                                    <h4 className="font-semibold text-amber-900">Ажлын байрны төрөл</h4>
                                                    <p className="text-xs text-amber-600 mt-1">Хөдөлмөр эрхлэлтийн төрлийг сонгоно уу</p>
                                                </div>
                                                <div className="grid grid-cols-1 gap-2">
                                                    {employmentTypes?.map((type) => (
                                                        <button
                                                            key={type.id}
                                                            onClick={() => setCeoSetupData(prev => ({ ...prev, employmentTypeId: type.id }))}
                                                            className={cn(
                                                                "p-4 rounded-xl border-2 text-left transition-all hover:shadow-md",
                                                                ceoSetupData.employmentTypeId === type.id
                                                                    ? "border-amber-500 bg-amber-50 shadow-md"
                                                                    : "border-amber-100 hover:border-amber-300"
                                                            )}
                                                        >
                                                            <div className="flex items-center gap-3">
                                                                <div className={cn(
                                                                    "h-10 w-10 rounded-lg flex items-center justify-center",
                                                                    ceoSetupData.employmentTypeId === type.id ? "bg-amber-500 text-white" : "bg-amber-100 text-amber-600"
                                                                )}>
                                                                    <Briefcase className="h-5 w-5" />
                                                                </div>
                                                                <div>
                                                                    <p className="font-medium text-amber-900">{type.name}</p>
                                                                </div>
                                                                {ceoSetupData.employmentTypeId === type.id && (
                                                                    <Check className="h-5 w-5 text-amber-500 ml-auto" />
                                                                )}
                                                            </div>
                                                        </button>
                                                    ))}
                                                    {(!employmentTypes || employmentTypes.length === 0) && (
                                                        <p className="text-center text-amber-600 text-sm py-4">
                                                            Ажлын байрны төрөл тохируулаагүй байна.
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                        
                                        {/* Step 3: Salary */}
                                        {wizardStep === 3 && (
                                            <div className="space-y-5">
                                                <div className="text-center mb-4">
                                                    <h4 className="font-semibold text-amber-900">Цалин тохируулах</h4>
                                                    <p className="text-xs text-amber-600 mt-1">Цалингийн шатлал болон урамшууллыг тохируулна уу</p>
                                                </div>
                                                
                                                {/* Salary Steps */}
                                                <div className="space-y-4 p-4 rounded-xl bg-amber-50/50 border border-amber-100">
                                                    <div className="flex items-center justify-between">
                                                        <Label className="text-sm font-bold text-amber-800">Цалингийн шатлал</Label>
                                                    </div>
                                                    
                                                    {/* Step Count Selector */}
                                                    <div className="space-y-1.5">
                                                        <label className="text-[10px] font-bold text-amber-600 uppercase tracking-widest">Шатлалын тоо</label>
                                                        <Select
                                                            value={ceoSetupData.salarySteps.items.length.toString()}
                                                            onValueChange={(val) => {
                                                                const count = parseInt(val);
                                                                const currentItems = [...ceoSetupData.salarySteps.items];
                                                                let newItems = [];
                                                                if (count > currentItems.length) {
                                                                    newItems = [
                                                                        ...currentItems,
                                                                        ...Array(count - currentItems.length).fill(0).map((_, i) => ({
                                                                            name: `Шатлал ${currentItems.length + i + 1}`,
                                                                            value: 0
                                                                        }))
                                                                    ];
                                                                } else {
                                                                    newItems = currentItems.slice(0, count);
                                                                }
                                                                setCeoSetupData(prev => ({
                                                                    ...prev,
                                                                    salarySteps: {
                                                                        ...prev.salarySteps,
                                                                        items: newItems,
                                                                        activeIndex: Math.min(prev.salarySteps.activeIndex, newItems.length - 1)
                                                                    }
                                                                }));
                                                            }}
                                                        >
                                                            <SelectTrigger className="h-10 rounded-lg">
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                                                                    <SelectItem key={n} value={n.toString()}>{n} шатлалт</SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                    
                                                    {/* Step Items */}
                                                    <div className="space-y-3 max-h-[280px] overflow-y-auto pr-1">
                                                        {ceoSetupData.salarySteps.items.map((step, index) => (
                                                            <div
                                                                key={index}
                                                                className={cn(
                                                                    "p-4 rounded-xl border transition-all space-y-3 relative",
                                                                    ceoSetupData.salarySteps.activeIndex === index
                                                                        ? "bg-amber-100/50 border-amber-400"
                                                                        : "bg-white border-amber-200"
                                                                )}
                                                            >
                                                                <div className="flex items-center justify-between">
                                                                    <Badge
                                                                        variant={ceoSetupData.salarySteps.activeIndex === index ? "default" : "outline"}
                                                                        className={cn(
                                                                            "h-5 px-2 text-[9px] font-bold uppercase cursor-pointer transition-all",
                                                                            ceoSetupData.salarySteps.activeIndex === index
                                                                                ? "bg-amber-500 text-white"
                                                                                : "text-amber-600 hover:border-amber-400"
                                                                        )}
                                                                        onClick={() => setCeoSetupData(prev => ({
                                                                            ...prev,
                                                                            salarySteps: { ...prev.salarySteps, activeIndex: index }
                                                                        }))}
                                                                    >
                                                                        {ceoSetupData.salarySteps.activeIndex === index ? 'Идэвхтэй' : 'Сонгох'}
                                                                    </Badge>
                                                                </div>
                                                                
                                                                <div className="space-y-2">
                                                                    <div className="space-y-1">
                                                                        <label className="text-[10px] font-bold text-amber-600 uppercase">Шатлалын нэр</label>
                                                                        <Input
                                                                            value={step.name}
                                                                            onChange={(e) => {
                                                                                const newItems = [...ceoSetupData.salarySteps.items];
                                                                                newItems[index].name = e.target.value;
                                                                                setCeoSetupData(prev => ({
                                                                                    ...prev,
                                                                                    salarySteps: { ...prev.salarySteps, items: newItems }
                                                                                }));
                                                                            }}
                                                                            placeholder={`Шатлал ${index + 1}`}
                                                                            className="h-9 text-sm font-medium"
                                                                        />
                                                                    </div>
                                                                    <div className="space-y-1">
                                                                        <label className="text-[10px] font-bold text-amber-600 uppercase">Цалингийн дүн</label>
                                                                        <CurrencyInput
                                                                            value={step.value}
                                                                            onValueChange={(val) => {
                                                                                const newItems = [...ceoSetupData.salarySteps.items];
                                                                                newItems[index].value = val;
                                                                                setCeoSetupData(prev => ({
                                                                                    ...prev,
                                                                                    salarySteps: { ...prev.salarySteps, items: newItems }
                                                                                }));
                                                                            }}
                                                                            className="h-9"
                                                                            placeholder="Цалингийн дүн"
                                                                        />
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                                
                                                {/* Incentives */}
                                                <div className="space-y-3 p-4 rounded-xl bg-amber-50/50 border border-amber-100">
                                                    <div className="flex items-center justify-between">
                                                        <Label className="text-sm font-bold text-amber-800">Урамшуулал & Нэмэгдэл</Label>
                                                        <Button variant="ghost" size="sm" onClick={addIncentive} className="h-7 text-amber-600 hover:text-amber-700 text-xs">
                                                            <Plus className="h-3.5 w-3.5 mr-1" />
                                                            Нэмэх
                                                        </Button>
                                                    </div>
                                                    
                                                    <div className="space-y-3 max-h-[200px] overflow-y-auto pr-1">
                                                        {ceoSetupData.incentives.map((inc, index) => (
                                                            <div key={index} className="p-4 rounded-xl bg-white border border-amber-200 space-y-3 relative group">
                                                                <button
                                                                    onClick={() => removeIncentive(index)}
                                                                    className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-red-100 text-red-500 flex items-center justify-center hover:bg-red-500 hover:text-white transition-all opacity-0 group-hover:opacity-100"
                                                                >
                                                                    <Trash2 className="w-3 h-3" />
                                                                </button>
                                                                
                                                                <div className="space-y-1">
                                                                    <label className="text-[10px] font-bold text-amber-600 uppercase">Урамшууллын нэр</label>
                                                                    <Input
                                                                        value={inc.type}
                                                                        onChange={(e) => {
                                                                            const newInc = [...ceoSetupData.incentives];
                                                                            newInc[index].type = e.target.value;
                                                                            setCeoSetupData(prev => ({ ...prev, incentives: newInc }));
                                                                        }}
                                                                        placeholder="Жишээ: KPI Бонус, Хоолны мөнгө"
                                                                        className="h-9 text-sm font-medium"
                                                                    />
                                                                </div>
                                                                
                                                                <div className="grid grid-cols-2 gap-3">
                                                                    <div className="space-y-1">
                                                                        <label className="text-[10px] font-bold text-amber-600 uppercase">Дүн / Хэмжээ</label>
                                                                        <div className="flex gap-1.5">
                                                                            <div className="flex-1">
                                                                                {inc.unit === '₮' ? (
                                                                                    <CurrencyInput
                                                                                        value={inc.amount}
                                                                                        onValueChange={(val) => {
                                                                                            const newInc = [...ceoSetupData.incentives];
                                                                                            newInc[index].amount = val;
                                                                                            setCeoSetupData(prev => ({ ...prev, incentives: newInc }));
                                                                                        }}
                                                                                        className="h-9"
                                                                                        placeholder="Дүн"
                                                                                    />
                                                                                ) : (
                                                                                    <div className="relative">
                                                                                        <Input
                                                                                            type="number"
                                                                                            value={inc.amount || ''}
                                                                                            onChange={(e) => {
                                                                                                const newInc = [...ceoSetupData.incentives];
                                                                                                newInc[index].amount = Number(e.target.value);
                                                                                                setCeoSetupData(prev => ({ ...prev, incentives: newInc }));
                                                                                            }}
                                                                                            className="h-9 pr-7 font-medium"
                                                                                            placeholder="Хэмжээ"
                                                                                        />
                                                                                        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-amber-400">%</span>
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                            <Select
                                                                                value={inc.unit}
                                                                                onValueChange={(val) => {
                                                                                    const newInc = [...ceoSetupData.incentives];
                                                                                    newInc[index].unit = val as '%' | '₮';
                                                                                    setCeoSetupData(prev => ({ ...prev, incentives: newInc }));
                                                                                }}
                                                                            >
                                                                                <SelectTrigger className="w-14 h-9 font-bold">
                                                                                    <SelectValue />
                                                                                </SelectTrigger>
                                                                                <SelectContent>
                                                                                    <SelectItem value="%">%</SelectItem>
                                                                                    <SelectItem value="₮">₮</SelectItem>
                                                                                </SelectContent>
                                                                            </Select>
                                                                        </div>
                                                                    </div>
                                                                    
                                                                    <div className="space-y-1">
                                                                        <label className="text-[10px] font-bold text-amber-600 uppercase">Олгох давтамж</label>
                                                                        <Select
                                                                            value={inc.frequency || 'Сар бүр'}
                                                                            onValueChange={(val) => {
                                                                                const newInc = [...ceoSetupData.incentives];
                                                                                newInc[index].frequency = val;
                                                                                setCeoSetupData(prev => ({ ...prev, incentives: newInc }));
                                                                            }}
                                                                        >
                                                                            <SelectTrigger className="h-9 font-medium">
                                                                                <SelectValue />
                                                                            </SelectTrigger>
                                                                            <SelectContent>
                                                                                <SelectItem value="Өдөр бүр">Өдөр бүр</SelectItem>
                                                                                <SelectItem value="Сар бүр">Сар бүр</SelectItem>
                                                                                <SelectItem value="Улирал бүр">Улирал бүр</SelectItem>
                                                                                <SelectItem value="Хагас жил тутам">Хагас жил тутам</SelectItem>
                                                                                <SelectItem value="Жил бүр">Жил бүр</SelectItem>
                                                                            </SelectContent>
                                                                        </Select>
                                                                    </div>
                                                                </div>
                                                                
                                                                <div className="space-y-1">
                                                                    <label className="text-[10px] font-bold text-amber-600 uppercase">Тайлбар / Нөхцөл</label>
                                                                    <Input
                                                                        value={inc.description}
                                                                        onChange={(e) => {
                                                                            const newInc = [...ceoSetupData.incentives];
                                                                            newInc[index].description = e.target.value;
                                                                            setCeoSetupData(prev => ({ ...prev, incentives: newInc }));
                                                                        }}
                                                                        placeholder="Олгох нөхцөл, дүрмийн тайлбар..."
                                                                        className="h-8 text-xs text-muted-foreground italic"
                                                                    />
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                    
                                                    {ceoSetupData.incentives.length === 0 && (
                                                        <div className="py-6 flex flex-col items-center justify-center text-center border-2 border-dashed border-amber-200 rounded-xl">
                                                            <DollarSign className="w-6 h-6 text-amber-300 mb-2" />
                                                            <p className="text-[10px] font-bold uppercase tracking-widest text-amber-400">Урамшуулал нэмэгдээгүй</p>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                        
                                        {/* Step 4: Benefits/Allowances */}
                                        {wizardStep === 4 && (
                                            <div className="space-y-5">
                                                <div className="text-center mb-4">
                                                    <h4 className="font-semibold text-amber-900">Хангамж тохируулах</h4>
                                                    <p className="text-xs text-amber-600 mt-1">Нэмэгдэл хөлс, тэтгэмжүүдийг тохируулна уу</p>
                                                </div>
                                                
                                                <div className="space-y-3 p-4 rounded-xl bg-amber-50/50 border border-amber-100">
                                                    <div className="flex items-center justify-between">
                                                        <Label className="text-sm font-bold text-amber-800">Нэмэгдэл хөлс</Label>
                                                        <Button variant="ghost" size="sm" onClick={addAllowance} className="h-7 text-amber-600 hover:text-amber-700 text-xs">
                                                            <Plus className="h-3.5 w-3.5 mr-1" />
                                                            Нэмэх
                                                        </Button>
                                                    </div>
                                                    
                                                    <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
                                                        {ceoSetupData.allowances.map((all, index) => (
                                                            <div key={index} className="p-4 rounded-xl bg-white border border-amber-200 space-y-3 relative group">
                                                                <button
                                                                    onClick={() => removeAllowance(index)}
                                                                    className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-red-100 text-red-500 flex items-center justify-center hover:bg-red-500 hover:text-white transition-all opacity-0 group-hover:opacity-100"
                                                                >
                                                                    <Trash2 className="w-3 h-3" />
                                                                </button>
                                                                
                                                                <div className="space-y-1">
                                                                    <label className="text-[10px] font-bold text-amber-600 uppercase">Нэмэгдлийн төрөл</label>
                                                                    <Input
                                                                        placeholder="Жишээ: Унааны мөнгө, Утасны төлбөр"
                                                                        value={all.type}
                                                                        onChange={(e) => {
                                                                            const newAll = [...ceoSetupData.allowances];
                                                                            newAll[index].type = e.target.value;
                                                                            setCeoSetupData(prev => ({ ...prev, allowances: newAll }));
                                                                        }}
                                                                        className="h-9 text-sm font-medium"
                                                                    />
                                                                </div>
                                                                
                                                                <div className="grid grid-cols-2 gap-3">
                                                                    <div className="space-y-1">
                                                                        <label className="text-[10px] font-bold text-amber-600 uppercase">Дүн</label>
                                                                        <CurrencyInput
                                                                            value={all.amount}
                                                                            onValueChange={(val) => {
                                                                                const newAll = [...ceoSetupData.allowances];
                                                                                newAll[index].amount = val;
                                                                                setCeoSetupData(prev => ({ ...prev, allowances: newAll }));
                                                                            }}
                                                                            className="h-9"
                                                                            placeholder="Дүн оруулна уу"
                                                                        />
                                                                    </div>
                                                                <div className="space-y-1">
                                                                        <label className="text-[10px] font-bold text-amber-600 uppercase">Олгох давтамж</label>
                                                                        <Select
                                                                            value={all.period}
                                                                            onValueChange={(value) => {
                                                                                const newAll = [...ceoSetupData.allowances];
                                                                                newAll[index].period = value as any;
                                                                                setCeoSetupData(prev => ({ ...prev, allowances: newAll }));
                                                                            }}
                                                                        >
                                                                            <SelectTrigger className="h-9 font-medium">
                                                                                <SelectValue />
                                                                            </SelectTrigger>
                                                                            <SelectContent>
                                                                                <SelectItem value="once">Нэг удаа</SelectItem>
                                                                                <SelectItem value="daily">Өдөр бүр</SelectItem>
                                                                                <SelectItem value="monthly">Сар бүр</SelectItem>
                                                                                <SelectItem value="quarterly">Улирал бүр</SelectItem>
                                                                                <SelectItem value="semi-annually">Хагас жил тутам</SelectItem>
                                                                                <SelectItem value="yearly">Жил бүр</SelectItem>
                                                                            </SelectContent>
                                                                        </Select>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                    
                                                    {ceoSetupData.allowances.length === 0 && (
                                                        <div className="py-6 flex flex-col items-center justify-center text-center border-2 border-dashed border-amber-200 rounded-xl">
                                                            <Gift className="w-6 h-6 text-amber-300 mb-2" />
                                                            <p className="text-[10px] font-bold uppercase tracking-widest text-amber-400">Нэмэгдэл хөлс нэмэгдээгүй</p>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                        
                                        {/* Step 5: Confirmation */}
                                        {wizardStep === 5 && (
                                            <div className="space-y-4">
                                                <div className="text-center mb-4">
                                                    <h4 className="font-semibold text-amber-900">Баталгаажуулах</h4>
                                                    <p className="text-xs text-amber-600 mt-1">Мэдээллийг шалгаад баталгаажуулна уу</p>
                                                </div>
                                                
                                                <div className="space-y-3">
                                                    {/* Summary */}
                                                    <div className="p-4 rounded-xl bg-amber-50/50 border border-amber-100">
                                                        <div className="grid grid-cols-2 gap-4 text-sm">
                                                            <div>
                                                                <span className="text-amber-600">Зэрэглэл:</span>
                                                                <p className="font-medium text-amber-900">
                                                                    {positionLevels?.find(l => l.id === ceoSetupData.levelId)?.name || '-'}
                                                                </p>
                                                            </div>
                                                            <div>
                                                                <span className="text-amber-600">Төрөл:</span>
                                                                <p className="font-medium text-amber-900">
                                                                    {employmentTypes?.find(t => t.id === ceoSetupData.employmentTypeId)?.name || '-'}
                                                                </p>
                                                            </div>
                                                            <div>
                                                                <span className="text-amber-600">Цалингийн хүрээ:</span>
                                                                <p className="font-medium text-amber-900">
                                                                    {ceoSetupData.salaryRange.min.toLocaleString()} - {ceoSetupData.salaryRange.max.toLocaleString()} ₮
                                                                </p>
                                                            </div>
                                                            <div>
                                                                <span className="text-amber-600">Шатлал:</span>
                                                                <p className="font-medium text-amber-900">{ceoSetupData.salarySteps.items.length} шатлал</p>
                                                            </div>
                                                            <div>
                                                                <span className="text-amber-600">Урамшуулал:</span>
                                                                <p className="font-medium text-amber-900">{ceoSetupData.incentives.length} урамшуулал</p>
                                                            </div>
                                                            <div>
                                                                <span className="text-amber-600">Нэмэгдэл:</span>
                                                                <p className="font-medium text-amber-900">{ceoSetupData.allowances.length} нэмэгдэл</p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    
                                                    <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-center">
                                                        <Check className="h-10 w-10 text-emerald-500 mx-auto mb-2" />
                                                        <p className="text-sm font-medium text-emerald-800">
                                                            "Гүйцэтгэх захирал" ажлын байр үүсгэхэд бэлэн
                                                        </p>
                                                        <p className="text-xs text-emerald-600 mt-1">
                                                            "Удирдлага" бүтэц нэгж автоматаар үүснэ
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </ScrollArea>
                                    
                                    {/* Navigation Buttons */}
                                    <div className="flex items-center justify-between mt-6 pt-4 border-t border-amber-100">
                                        <Button
                                            variant="ghost"
                                            onClick={() => {
                                                if (wizardStep === 1) {
                                                    setShowCEOWizard(false);
                                                } else {
                                                    setWizardStep(prev => prev - 1);
                                                }
                                            }}
                                            className="text-amber-600 hover:text-amber-700"
                                        >
                                            <ChevronLeft className="h-4 w-4 mr-1" />
                                            {wizardStep === 1 ? 'Цуцлах' : 'Өмнөх'}
                                        </Button>
                                        
                                        {wizardStep < 5 ? (
                                            <Button
                                                onClick={() => setWizardStep(prev => prev + 1)}
                                                disabled={!canProceedToNextStep()}
                                                className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white"
                                            >
                                                Үргэлжлүүлэх
                                                <ChevronRight className="h-4 w-4 ml-1" />
                                            </Button>
                                        ) : (
                                            <Button
                                                onClick={handleSetupCEO}
                                                disabled={isSettingUpCEO}
                                                className="bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-600 hover:to-green-600 text-white"
                                            >
                                                {isSettingUpCEO ? (
                                                    <>
                                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                                        Үүсгэж байна...
                                                    </>
                                                ) : (
                                                    <>
                                                        <Check className="h-4 w-4 mr-2" />
                                                        Баталгаажуулах
                                                    </>
                                                )}
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* State B: Position created, vacant */}
                            {(companyProfile as any).ceoPositionId && !(companyProfile as any).ceoEmployeeId && !showResetConfirm && (
                                <div className="text-center py-6">
                                    <div className="flex items-center justify-center gap-3 mb-4">
                                        <div className="h-14 w-14 rounded-xl bg-amber-100 border-2 border-dashed border-amber-300 flex items-center justify-center">
                                            <UserPlus className="h-6 w-6 text-amber-400" />
                                        </div>
                                    </div>
                                    <p className="text-sm font-medium text-amber-900 mb-1">
                                        Гүйцэтгэх захирал
                                    </p>
                                    <p className="text-xs text-amber-600 mb-4">
                                        Ажлын байр үүссэн • Ажилтан томилогдоогүй
                                    </p>
                                    <div className="flex items-center justify-center gap-2">
                                        <Button 
                                            onClick={() => setShowAppointDialog(true)}
                                            className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-lg shadow-amber-200"
                                        >
                                            <UserPlus className="h-4 w-4 mr-2" />
                                            Ажилтан томилох
                                        </Button>
                                        <Button 
                                            variant="outline"
                                            onClick={() => setShowResetConfirm(true)}
                                            className="border-amber-300 text-amber-700 hover:bg-amber-50"
                                        >
                                            <RotateCcw className="h-4 w-4 mr-2" />
                                            Шинээр эхлэх
                                        </Button>
                                    </div>
                                </div>
                            )}

                            {/* State C: Fully configured */}
                            {(companyProfile as any).ceoPositionId && (companyProfile as any).ceoEmployeeId && !showResetConfirm && (
                                <div className="space-y-4 py-2">
                                    {ceoEmployee ? (
                                        <div className="flex items-center gap-4">
                                            <Avatar className="h-16 w-16 rounded-xl border-2 border-amber-200 shadow-lg">
                                                <AvatarImage src={ceoEmployee.photoURL} className="object-cover" />
                                                <AvatarFallback className="rounded-xl bg-gradient-to-br from-amber-100 to-orange-100 text-amber-700 text-lg font-semibold">
                                                    {ceoEmployee.firstName?.[0]}{ceoEmployee.lastName?.[0]}
                                                </AvatarFallback>
                                            </Avatar>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-semibold text-amber-900 text-lg">
                                                    {ceoEmployee.lastName} {ceoEmployee.firstName}
                                                </p>
                                                <p className="text-sm text-amber-600 mt-0.5">
                                                    Гүйцэтгэх захирал
                                                </p>
                                                {ceoEmployee.email && (
                                                    <p className="text-xs text-amber-500 mt-1 truncate">
                                                        {ceoEmployee.email}
                                                    </p>
                                                )}
                                            </div>
                                            <Link 
                                                href={`/dashboard/employees/${ceoEmployee.id}`}
                                                className="flex items-center gap-1 text-xs text-amber-600 hover:text-amber-700 font-medium"
                                            >
                                                Дэлгэрэнгүй
                                                <ArrowRight className="h-3.5 w-3.5" />
                                            </Link>
                                        </div>
                                    ) : (isLoadingCeoEmployee || isLoadingCeoPosition) ? (
                                        <div className="flex items-center gap-4">
                                            <Skeleton className="h-16 w-16 rounded-xl" />
                                            <div className="flex-1 space-y-2">
                                                <Skeleton className="h-5 w-32" />
                                                <Skeleton className="h-4 w-24" />
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="text-center py-4">
                                            <p className="text-sm text-amber-600">Томилогдсон ажилтны мэдээлэл олдсонгүй</p>
                                        </div>
                                    )}
                                    <div className="flex justify-end">
                                        <Button 
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => setShowResetConfirm(true)}
                                            className="text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                                        >
                                            <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                                            Шинээр эхлэх
                                        </Button>
                                    </div>
                                </div>
                            )}
                            
                            {/* Reset Confirmation */}
                            {(companyProfile as any).ceoPositionId && showResetConfirm && (
                                <div className="py-4">
                                    <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-center">
                                        <div className="h-12 w-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-3">
                                            <AlertTriangle className="h-6 w-6 text-red-500" />
                                        </div>
                                        <h4 className="font-semibold text-red-900 mb-2">Шинээр эхлэх</h4>
                                        <p className="text-sm text-red-700 mb-4">
                                            Энэ үйлдэл нь:
                                        </p>
                                        <ul className="text-xs text-red-600 text-left mb-4 space-y-1 max-w-xs mx-auto">
                                            <li className="flex items-start gap-2">
                                                <span className="text-red-400">•</span>
                                                "Гүйцэтгэх захирал" ажлын байрыг устгана
                                            </li>
                                            {(companyProfile as any).ceoEmployeeId && (
                                                <li className="flex items-start gap-2">
                                                    <span className="text-red-400">•</span>
                                                    Томилогдсон ажилтныг чөлөөлнө
                                                </li>
                                            )}
                                            <li className="flex items-start gap-2">
                                                <span className="text-red-400">•</span>
                                                "Удирдлага" бүтэц нэгжийг устгана (бусад ажлын байр байхгүй бол)
                                            </li>
                                        </ul>
                                        <div className="flex items-center justify-center gap-2">
                                            <Button 
                                                variant="outline"
                                                onClick={() => setShowResetConfirm(false)}
                                                className="border-red-200 text-red-700 hover:bg-red-50"
                                            >
                                                Цуцлах
                                            </Button>
                                            <Button 
                                                onClick={handleResetCEO}
                                                disabled={isResettingCEO}
                                                className="bg-red-500 hover:bg-red-600 text-white"
                                            >
                                                {isResettingCEO ? (
                                                    <>
                                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                                        Устгаж байна...
                                                    </>
                                                ) : (
                                                    <>
                                                        <RotateCcw className="h-4 w-4 mr-2" />
                                                        Тийм, шинээр эхлэх
                                                    </>
                                                )}
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* AppointEmployeeDialog for CEO */}
                    {ceoPosition && (
                        <AppointEmployeeDialog
                            open={showAppointDialog}
                            onOpenChange={setShowAppointDialog}
                            position={ceoPosition}
                            onSuccess={handleAppointComplete}
                        />
                    )}

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
