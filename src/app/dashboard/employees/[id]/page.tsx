// src/app/dashboard/employees/[id]/page.tsx
'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useFirebase, useDoc, useMemoFirebase, useCollection, addDocumentNonBlocking, updateDocumentNonBlocking, deleteDocumentNonBlocking, useUser, tenantCollection, tenantDoc, useTenantWrite } from '@/firebase';
import { query, orderBy, where, getDocs } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { type Employee } from '../data';
import { isActiveStatus, EMPLOYEE_STATUS_LABELS } from '@/types';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import {
    ArrowLeft,
    Calendar,
    Edit,
    Mail,
    Phone,
    FileText,
    User,
    PlusCircle,
    AlertTriangle,
    Trash2,
    ChevronRight,
    File as FileIcon,
    Activity,
    ClipboardCheck,
    LogOut,
    Shield,
    Settings,
    Check,
    X,
    Loader2
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { ERDocument, DOCUMENT_STATUSES } from '../../employment-relations/types';
import { EmployeeCard } from '@/components/employees/employee-card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { PageHeader } from '@/components/patterns/page-layout';
import { VerticalTabMenu } from '@/components/ui/vertical-tab-menu';
import { ReferenceTable, type ReferenceItem } from '@/components/ui/reference-table';

import { VacationTabContent } from './vacation-tab-content';
import { OnboardingTabContent } from './onboarding-tab-content';
import { OffboardingTabContent } from './offboarding-tab-content';
import { AddEmployeeDocumentDialog } from './AddEmployeeDocumentDialog';
import { MakeAdminDialog } from './make-admin-dialog';
import { SystemSettingsTabContent } from './system-settings-tab-content';
import { CVTabContent } from './cv-tab-content';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Project, Task } from '@/types/project';


type Department = {
    id: string;
    name: string;
};

type Position = {
    id: string;
    workScheduleId?: string;
}

type WorkSchedule = {
    id: string;
    name: string;
}

type EmploymentHistoryEvent = {
    id: string;
    eventType: string;
    eventDate: string;
    notes?: string;
    documentUrl?: string;
    documentName?: string;
    documentId?: string;
};

type CompanyPolicy = {
    id: string;
    title: string;
    documentUrl: string;
    uploadDate: string;
    appliesToAll: boolean;
    applicablePositionIds: string[];
}


const statusConfig: { [key: string]: { variant: 'default' | 'secondary' | 'destructive' | 'outline', className: string, label: string } } = {
    "active_recruitment": { variant: 'outline', className: 'bg-indigo-50 text-indigo-700 hover:bg-indigo-50/80 border-indigo-200', label: EMPLOYEE_STATUS_LABELS.active_recruitment },
    "appointing": { variant: 'secondary', className: 'bg-amber-50 text-amber-700 hover:bg-amber-50/80 border-amber-200', label: EMPLOYEE_STATUS_LABELS.appointing },
    "active": { variant: 'default', className: 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100/80 border-emerald-200', label: EMPLOYEE_STATUS_LABELS.active },
    "active_probation": { variant: 'secondary', className: 'bg-amber-50 text-amber-700 hover:bg-amber-50/80 border-amber-200', label: EMPLOYEE_STATUS_LABELS.active_probation },
    "active_permanent": { variant: 'default', className: 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100/80 border-emerald-200', label: EMPLOYEE_STATUS_LABELS.active_permanent },
    "on_leave": { variant: 'secondary', className: 'bg-blue-50 text-blue-700 hover:bg-blue-50/80 border-blue-200', label: EMPLOYEE_STATUS_LABELS.on_leave },
    "releasing": { variant: 'secondary', className: 'bg-orange-50 text-orange-700 hover:bg-orange-50/80 border-orange-200', label: EMPLOYEE_STATUS_LABELS.releasing },
    "terminated": { variant: 'destructive', className: 'bg-rose-50 text-rose-700 hover:bg-rose-50/80 border-rose-200', label: EMPLOYEE_STATUS_LABELS.terminated },
    "suspended": { variant: 'destructive', className: 'bg-gray-100 text-gray-700 hover:bg-gray-100/80 border-gray-200', label: EMPLOYEE_STATUS_LABELS.suspended },
};

const AvatarWithProgress = ({ 
    employee, 
    size = 120, 
    // kept for backward-compatibility, but no longer rendered as a ring
    onboardingProgress = 0,
    onClick
}: { 
    employee?: Employee; 
    size?: number; 
    onboardingProgress?: number;
    onClick?: () => void;
}) => {
    // Questionnaire progress (single ring)
    const questionnaireProgress = employee?.questionnaireCompletion || 0;
    
    const strokeWidth = 3;
    // Single ring radius around avatar
    const ringRadius = (size / 2) + 2;
    const ringCircumference = 2 * Math.PI * ringRadius;
    const ringOffset = ringCircumference - (questionnaireProgress / 100) * ringCircumference;
    const questionnaireColor = questionnaireProgress < 50 ? '#ef4444' : questionnaireProgress < 90 ? '#f59e0b' : '#10b981'; // red -> amber -> emerald

    const avatarContent = (
        <div className="relative" style={{ width: size, height: size }}>
            <Avatar className="h-full w-full border-2 border-background shadow-xl">
                <AvatarImage src={employee?.photoURL} alt={employee?.firstName} className="object-cover" />
                <AvatarFallback className="text-2xl bg-muted text-muted-foreground">
                    {employee ? `${employee.firstName?.charAt(0)}${employee.lastName?.charAt(0)}` : <User className="h-8 w-8" />}
                </AvatarFallback>
            </Avatar>
            {employee && (
                <svg
                    className="absolute pointer-events-none"
                    style={{ top: -strokeWidth - 2, left: -strokeWidth - 2 }}
                    width={size + (strokeWidth + 2) * 2}
                    height={size + (strokeWidth + 2) * 2}
                >
                    {/* Ring Background (Questionnaire) */}
                    <circle
                        stroke="#e2e8f0"
                        strokeWidth={strokeWidth}
                        fill="transparent"
                        r={ringRadius}
                        cx={size / 2 + strokeWidth + 2}
                        cy={size / 2 + strokeWidth + 2}
                    />
                    {/* Ring Progress (Questionnaire) */}
                    <circle
                        stroke={questionnaireColor}
                        strokeWidth={strokeWidth}
                        strokeDasharray={ringCircumference}
                        strokeDashoffset={ringOffset}
                        strokeLinecap="round"
                        fill="transparent"
                        r={ringRadius}
                        cx={size / 2 + strokeWidth + 2}
                        cy={size / 2 + strokeWidth + 2}
                        transform={`rotate(-90 ${size / 2 + strokeWidth + 2} ${size / 2 + strokeWidth + 2})`}
                        style={{ transition: 'stroke-dashoffset 0.8s ease-out' }}
                    />
                </svg>
            )}
        </div>
    );

    if (employee && onClick) {
        return (
            <button
                type="button"
                onClick={onClick}
                className="group relative focus:outline-none"
                aria-label="Зураг солих"
            >
                {avatarContent}
                <div className="absolute inset-0 bg-black/30 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white font-medium text-[10px] backdrop-blur-[1px] text-center leading-tight px-2">
                    Зураг солих
                </div>
            </button>
        );
    }

    return avatarContent;
};


function ProfileSkeleton() {
    return (
        <div className="space-y-8 animate-pulse p-6">
            <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-4" />
                <Skeleton className="h-4 w-32" />
            </div>

            <div className="flex flex-col md:flex-row gap-8 items-start">
                <Skeleton className="h-32 w-32 rounded-full" />
                <div className="space-y-4 flex-1 w-full">
                    <Skeleton className="h-8 w-64" />
                    <Skeleton className="h-5 w-48" />
                    <div className="flex gap-4 pt-2">
                        <Skeleton className="h-10 w-32 rounded-lg" />
                        <Skeleton className="h-10 w-32 rounded-lg" />
                    </div>
                </div>
            </div>
            <div className="space-y-4 pt-8">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-64 w-full rounded-xl" />
            </div>
        </div>
    )
}



const DocumentsTabContent = ({ employee }: { employee: Employee }) => {
    const { firestore, tDoc, tCollection } = useTenantWrite();
    const { toast } = useToast();

    const documentsQuery = useMemoFirebase(
        ({ firestore, companyPath }) =>
            firestore
                ? query(
                    tenantCollection(firestore, companyPath, 'documents'),
                    where('metadata.employeeId', '==', employee.id),
                    orderBy('uploadDate', 'desc')
                )
                : null,
        [employee.id]
    );

    const { data: documents, isLoading: isLoadingDocs, error } = useCollection<any>(documentsQuery as any);

    const mandatoryQuery = useMemoFirebase(
        ({ firestore, companyPath }) => firestore ? tenantCollection(firestore, companyPath, 'er_document_types') : null,
        []
    );
    const { data: allDocTypes, isLoading: isLoadingDocTypes } = useCollection<any>(mandatoryQuery);

    const legacyDocTypesQuery = useMemoFirebase(
        ({ firestore, companyPath }) => firestore ? tenantCollection(firestore, companyPath, 'documentTypes') : null,
        []
    );
    const { data: legacyDocTypes, isLoading: isLoadingLegacyDocTypes } = useCollection<any>(legacyDocTypesQuery);

    const [isAddDialogOpen, setIsAddDialogOpen] = React.useState(false);
    const [isDocTypeSettingsOpen, setIsDocTypeSettingsOpen] = React.useState(false);
    const didImportLegacyRef = React.useRef(false);

    React.useEffect(() => {
        async function importLegacyTypesIfNeeded() {
            if (!firestore) return;
            if (!isDocTypeSettingsOpen) return;
            if (didImportLegacyRef.current) return;

            const legacy = legacyDocTypes || [];
            const current = allDocTypes || [];
            if (legacy.length === 0) {
                didImportLegacyRef.current = true;
                return;
            }

            const existingNames = new Set(
                current.map((t: any) => String(t?.name || '').trim()).filter(Boolean)
            );
            const toImport = legacy.filter((t: any) => {
                const name = String(t?.name || '').trim();
                return !!name && !existingNames.has(name);
            });

            // Nothing to import
            if (toImport.length === 0) {
                didImportLegacyRef.current = true;
                return;
            }

            try {
                // Create missing legacy types in `er_document_types`
                for (const t of toImport) {
                    const name = String(t?.name || '').trim();
                    await addDocumentNonBlocking(tCollection('er_document_types'), {
                        name,
                        isMandatory: t?.isMandatory === true,
                        fields: Array.isArray(t?.fields) ? t.fields : [],
                    });
                }

                toast({
                    title: 'Төрлүүд импортлогдлоо',
                    description: `${toImport.length} хуучин төрлийг шинэ тохиргоо руу автоматаар шилжүүллээ.`,
                });
            } catch (e: any) {
                console.error('Import legacy document types error:', e);
                toast({
                    variant: 'destructive',
                    title: 'Алдаа',
                    description: e?.message || 'Хуучин төрлүүдийг импортлоход алдаа гарлаа.',
                });
            } finally {
                didImportLegacyRef.current = true;
            }
        }

        importLegacyTypesIfNeeded();
    }, [firestore, isDocTypeSettingsOpen, legacyDocTypes, allDocTypes, toast]);

    const complianceStats = React.useMemo(() => {
        if (!allDocTypes || !documents) return null;
        const mandatoryDocs = allDocTypes.filter((t: any) => t.isMandatory === true);
        const total = mandatoryDocs.length;
        if (total === 0) return null;

        const uploadedTypes = new Set(documents.map((d: any) => d.documentType));
        const completedDocs = mandatoryDocs.filter((m: any) => uploadedTypes.has(m.name));
        const missingDocs = mandatoryDocs.filter((m: any) => !uploadedTypes.has(m.name));
        const completed = completedDocs.length;
        const percentage = Math.round((completed / total) * 100);

        return { total, completed, percentage, missingDocs };
    }, [allDocTypes, documents]);

    const isLoading = isLoadingDocs || isLoadingDocTypes || isLoadingLegacyDocTypes;

    if (error) {
        return (
            <div className="p-4 bg-red-50 border border-red-100 rounded-xl text-red-600 text-sm">
                Алдаа: {error.message}
            </div>
        );
    }

    if (isLoading) return (
        <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
        </div>
    );

    const docTypeColumns = [
        { key: 'name', header: 'Нэр' },
        {
            key: 'isMandatory',
            header: 'Заавал бүрдүүлэх',
            render: (val: boolean | undefined) =>
                val === true ? (
                    <Badge variant="secondary" className="bg-indigo-600 text-white border-none text-[10px] font-bold uppercase tracking-tighter px-2 h-5">
                        Шаардлагатай
                    </Badge>
                ) : (
                    <span className="text-slate-300 text-[10px] font-bold uppercase tracking-widest">Үгүй</span>
                ),
        },
        {
            key: 'fields',
            header: 'Талбарууд',
            render: (value: any[] | undefined) => {
                const fields = Array.isArray(value) ? value : [];
                if (fields.length === 0) return <span className="text-muted-foreground">-</span>;
                const labels = fields
                    .map((f) => (typeof (f as any)?.label === 'string' ? String((f as any).label).trim() : ''))
                    .filter(Boolean);
                return (
                    <div className="flex flex-wrap items-center gap-1">
                        <Badge variant="secondary" className="text-[10px] h-5">
                            {fields.length}
                        </Badge>
                        <span className="text-xs text-muted-foreground line-clamp-1">
                            {labels.slice(0, 3).join(', ')}
                            {labels.length > 3 ? ` +${labels.length - 3}` : ''}
                        </span>
                    </div>
                );
            },
        },
    ] as const;

    return (
        <div className="space-y-4">
            {/* Compliance Stats */}
            {complianceStats && (
                <div className="bg-white rounded-xl border p-4">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <ClipboardCheck className="h-4 w-4 text-primary" />
                            <span className="text-sm font-medium">Баримтын бүрдүүлэлт</span>
                        </div>
                        <span className="text-sm font-medium">{complianceStats.percentage}%</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden mb-3">
                        <div
                            className="h-full bg-primary rounded-full transition-all"
                            style={{ width: `${complianceStats.percentage}%` }}
                        />
                    </div>
                    {complianceStats.missingDocs.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                            {complianceStats.missingDocs.map((m: any, i: number) => (
                                <Badge key={i} variant="outline" className="text-[10px] bg-rose-50 text-rose-600 border-rose-200">
                                    Дутуу: {m.name}
                                </Badge>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Header */}
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-slate-600">Бичиг баримт</h3>
                <div className="flex items-center gap-2">
                    <TooltipProvider delayDuration={150}>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => setIsDocTypeSettingsOpen(true)}
                                    aria-label="Баримт бичгийн төрөл тохируулах"
                                >
                                    <Settings className="h-4 w-4" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                                <div className="text-xs font-semibold">Төрөл тохируулах</div>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                    <Button onClick={() => setIsAddDialogOpen(true)} size="sm" className="h-8">
                        <PlusCircle className="w-3.5 h-3.5 mr-1.5" />
                        Нэмэх
                    </Button>
                </div>
            </div>

            {/* Documents List */}
            <div className="space-y-2">
                {documents && documents.length > 0 ? (
                    documents.map((docItem: any, idx: number) => (
                        <div key={idx} className="flex items-center gap-3 p-3 bg-white rounded-xl border hover:border-primary/20 transition-all group">
                            <div className="h-9 w-9 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                                <FileIcon className="h-4 w-4 text-slate-500" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <h4 className="text-sm font-medium truncate">{docItem.title}</h4>
                                    <Badge variant="secondary" className="text-[10px] shrink-0">
                                        {docItem.documentType}
                                    </Badge>
                                </div>
                                <p className="text-xs text-slate-500">
                                    {new Date(docItem.uploadDate).toLocaleDateString()}
                                </p>
                            </div>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-rose-600">
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>Баримт устгах</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                Энэ баримтыг устгахдаа итгэлтэй байна уу?
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>Болих</AlertDialogCancel>
                                            <AlertDialogAction
                                                onClick={() => {
                                                    if (!firestore) return;
                                                    deleteDocumentNonBlocking(tDoc('documents', docItem.id));
                                                }}
                                                className="bg-rose-600 hover:bg-rose-700"
                                            >
                                                Устгах
                                            </AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400" asChild>
                                    <Link href={`/dashboard/employee-documents/${docItem.id}`}>
                                        <ChevronRight className="h-4 w-4" />
                                    </Link>
                                </Button>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="bg-white rounded-xl border p-12 text-center">
                        <FileIcon className="h-10 w-10 text-slate-200 mx-auto mb-3" />
                        <p className="text-sm text-slate-500 mb-4">Баримт бичиг байхгүй</p>
                        <Button onClick={() => setIsAddDialogOpen(true)} variant="outline" size="sm">
                            Баримт нэмэх
                        </Button>
                    </div>
                )}
            </div>

            <AddEmployeeDocumentDialog
                employeeId={employee.id || ''}
                open={isAddDialogOpen}
                onOpenChange={setIsAddDialogOpen}
            />

            <Dialog open={isDocTypeSettingsOpen} onOpenChange={setIsDocTypeSettingsOpen}>
                <DialogContent className="sm:max-w-3xl max-h-[80vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle>Баримт бичгийн төрөл</DialogTitle>
                        <DialogDescription>
                            Баримт бичгийн төрлийг эндээс нэмэх, засах, устгах боломжтой.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="min-h-0 flex-1">
                        <ReferenceTable
                            collectionName="er_document_types"
                            columns={docTypeColumns as any}
                            itemData={(allDocTypes || []) as ReferenceItem[]}
                            isLoading={false}
                            dialogTitle="Баримт бичгийн төрөл"
                            enableFieldDefs={true}
                            compact={false}
                            maxVisibleItems={50}
                        />
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
};


const HistoryTabContent = ({ employeeId, erDocuments, isLoading }: { employeeId: string; erDocuments?: ERDocument[]; isLoading: boolean }) => {
    const sortedDocs = React.useMemo(() => {
        if (!erDocuments) return [];
        return [...erDocuments].sort((a, b) => {
            const dateA = a.createdAt?.seconds ? a.createdAt.seconds : new Date(a.createdAt).getTime() / 1000;
            const dateB = b.createdAt?.seconds ? b.createdAt.seconds : new Date(b.createdAt).getTime() / 1000;
            return (dateB || 0) - (dateA || 0);
        });
    }, [erDocuments]);

    if (isLoading) {
        return (
            <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-20 w-full rounded-xl" />
                ))}
            </div>
        );
    }

    if (!sortedDocs || sortedDocs.length === 0) {
        return (
            <div className="bg-white rounded-xl border p-12 text-center">
                <FileText className="h-10 w-10 text-slate-200 mx-auto mb-3" />
                <p className="text-sm text-slate-500">Хөдөлмөрийн харилцааны баримт байхгүй</p>
            </div>
        );
    }

    // Helper to extract date fields from customInputs
    const getDateFields = (customInputs: Record<string, any> | undefined) => {
        if (!customInputs) return [];
        return Object.entries(customInputs)
            .filter(([key, value]) => {
                // Check if value looks like a date (yyyy-MM-dd format)
                if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return true;
                return false;
            })
            .map(([key, value]) => {
                // Convert key to readable label
                const label = key
                    .replace(/_/g, ' ')
                    .replace(/([a-z])([A-Z])/g, '$1 $2')
                    .replace(/^\w/, c => c.toUpperCase());
                return { label, value };
            });
    };

    return (
        <div className="space-y-3">
            {sortedDocs.map((doc, idx) => {
                const dateFields = getDateFields(doc.customInputs);

                return (
                    <Link 
                        key={`${doc.id}-${idx}`} 
                        href={`/dashboard/employment-relations/${doc.id}`}
                        className="flex items-center gap-4 p-4 bg-white rounded-xl border hover:border-primary/20 hover:shadow-sm transition-all group"
                    >
                        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                            <FileText className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                            {/* Document number - most prominent */}
                            {doc.documentNumber && (
                                <div className="text-base font-bold text-slate-900 mb-0.5">
                                    {doc.documentNumber}
                                </div>
                            )}
                            {/* Template name with status badge */}
                            <div className="flex items-center gap-2 mb-1">
                                <h4 className="text-sm font-medium text-slate-700 truncate">{doc.metadata?.templateName || 'Баримт'}</h4>
                                <Badge className={cn("text-[10px] shrink-0", DOCUMENT_STATUSES[doc.status].color)}>
                                    {DOCUMENT_STATUSES[doc.status].label}
                                </Badge>
                            </div>
                            {/* Custom input dates with labels */}
                            {dateFields.length > 0 && (
                                <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-slate-500">
                                    {dateFields.map(({ label, value }, i) => (
                                        <span key={i}>
                                            <span className="text-slate-400">{label}:</span>{' '}
                                            <span className="font-medium">{value}</span>
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>
                        <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-primary transition-colors shrink-0" />
                    </Link>
                );
            })}
        </div>
    );
};

export default function EmployeeProfilePage() {
    const { id } = useParams();
    const router = useRouter();
    const employeeId = Array.isArray(id) ? id[0] : id;
    const { storage } = useFirebase();
    const { firestore, tDoc, tCollection } = useTenantWrite();
    const { toast } = useToast();
    const { user } = useUser();
    const [showAdminDialog, setShowAdminDialog] = React.useState(false);
    const [isUploadingPhoto, setIsUploadingPhoto] = React.useState(false);
    const photoInputRef = React.useRef<HTMLInputElement>(null);
    
    // Inline editing state
    const [isEditing, setIsEditing] = React.useState(false);
    const [isSaving, setIsSaving] = React.useState(false);
    const [editForm, setEditForm] = React.useState({
        firstName: '',
        lastName: '',
        phoneNumber: '',
        email: ''
    });

    // Start editing - populate form with current values
    const handleStartEdit = React.useCallback((emp: Employee) => {
        setEditForm({
            firstName: emp.firstName || '',
            lastName: emp.lastName || '',
            phoneNumber: emp.phoneNumber || '',
            email: emp.email || ''
        });
        setIsEditing(true);
    }, []);

    // Cancel editing
    const handleCancelEdit = React.useCallback(() => {
        setIsEditing(false);
        setEditForm({ firstName: '', lastName: '', phoneNumber: '', email: '' });
    }, []);

    // Save changes
    const handleSaveEdit = React.useCallback(async () => {
        if (!firestore || !employeeId) return;
        
        // Validation
        if (!editForm.firstName.trim()) {
            toast({ variant: 'destructive', title: 'Алдаа', description: 'Нэр хоосон байж болохгүй' });
            return;
        }
        if (!editForm.lastName.trim()) {
            toast({ variant: 'destructive', title: 'Алдаа', description: 'Овог хоосон байж болохгүй' });
            return;
        }
        if (!editForm.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editForm.email)) {
            toast({ variant: 'destructive', title: 'Алдаа', description: 'Имэйл хаяг буруу байна' });
            return;
        }

        setIsSaving(true);
        try {
            const empRef = tDoc('employees', employeeId);
            await updateDocumentNonBlocking(empRef, {
                firstName: editForm.firstName.trim(),
                lastName: editForm.lastName.trim(),
                phoneNumber: editForm.phoneNumber.trim(),
                email: editForm.email.trim()
            });
            toast({ title: 'Амжилттай', description: 'Мэдээлэл шинэчлэгдлээ' });
            setIsEditing(false);
        } catch (error) {
            console.error('Error updating employee:', error);
            toast({ variant: 'destructive', title: 'Алдаа', description: 'Мэдээлэл хадгалахад алдаа гарлаа' });
        } finally {
            setIsSaving(false);
        }
    }, [firestore, employeeId, editForm, toast]);

    const handlePhotoSelected = React.useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file || !firestore || !storage || !employeeId) return;

        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
        if (!allowedTypes.includes(file.type)) {
            toast({ variant: 'destructive', title: 'Алдаа', description: 'Зөвхөн зураг (JPG, PNG, WebP) оруулна уу.' });
            if (photoInputRef.current) photoInputRef.current.value = '';
            return;
        }
        if (file.size > 8 * 1024 * 1024) {
            toast({ variant: 'destructive', title: 'Алдаа', description: 'Файл хэт том байна (8MB-с бага байх ёстой).' });
            if (photoInputRef.current) photoInputRef.current.value = '';
            return;
        }

        setIsUploadingPhoto(true);
        try {
            const storageRef = ref(storage, `employee-photos/${employeeId}/${Date.now()}-${file.name}`);
            await uploadBytes(storageRef, file);
            const url = await getDownloadURL(storageRef);
            const empRef = tDoc('employees', employeeId);
            await updateDocumentNonBlocking(empRef, { photoURL: url });
            toast({ title: 'Амжилттай', description: 'Аватар зураг шинэчлэгдлээ' });
        } catch (error) {
            console.error('Photo upload error:', error);
            toast({ variant: 'destructive', title: 'Алдаа', description: 'Зураг солиход алдаа гарлаа' });
        } finally {
            setIsUploadingPhoto(false);
            if (photoInputRef.current) photoInputRef.current.value = '';
        }
    }, [employeeId, firestore, storage, toast]);

    const employeeDocRef = useMemoFirebase(
        ({ firestore, companyPath }) => (firestore && employeeId ? tenantDoc(firestore, companyPath, 'employees', employeeId) : null),
        [employeeId]
    );

    const departmentsQuery = useMemoFirebase(
        ({ firestore, companyPath }) => (firestore ? tenantCollection(firestore, companyPath, 'departments') : null),
        []
    );

    const { data: employee, isLoading: isLoadingEmployee } = useDoc<Employee>(employeeDocRef as any);

    // Fetch questionnaire for gender & birthDate
    const questionnaireDocRef = useMemoFirebase(
        ({ firestore, companyPath }) => (firestore && employeeId ? tenantDoc(firestore, companyPath, `employees/${employeeId}/questionnaire`, 'data') : null),
        [employeeId]
    );
    const { data: questionnaireData } = useDoc<any>(questionnaireDocRef as any);

    const positionDocRef = useMemoFirebase(
        ({ firestore, companyPath }) => (firestore && employee?.positionId ? tenantDoc(firestore, companyPath, 'positions', employee.positionId) : null),
        [employee]
    );

    const { data: position, isLoading: isLoadingPosition } = useDoc<Position>(positionDocRef as any);

    const workScheduleDocRef = useMemoFirebase(
        ({ firestore, companyPath }) => (firestore && position?.workScheduleId ? tenantDoc(firestore, companyPath, 'workSchedules', position.workScheduleId) : null),
        [position?.workScheduleId]
    );

    const { data: workSchedule, isLoading: isLoadingWorkSchedule } = useDoc<WorkSchedule>(workScheduleDocRef as any);

    const orgActionsRef = useMemoFirebase(
        ({ firestore, companyPath }) => (firestore ? tenantCollection(firestore, companyPath, 'organization_actions') : null),
        []
    );
    const { data: orgActions, isLoading: isLoadingOrgActions } = useCollection<any>(orgActionsRef);


    const erDocumentsQuery = React.useMemo(() =>
        firestore && employeeId ? query(
            tCollection('er_documents'),
            where('employeeId', '==', employeeId)
        ) : null
        , [firestore, employeeId, tCollection]);

    const { data: erDocuments, isLoading: isLoadingDocs } = useCollection<ERDocument>(erDocumentsQuery as any);

    // Fetch onboarding process for this employee
    const onboardingProcessRef = useMemoFirebase(
        ({ firestore, companyPath }) => (firestore && employeeId ? tenantDoc(firestore, companyPath, 'onboarding_processes', employeeId) : null),
        [employeeId]
    );
    const { data: onboardingProcess, isLoading: isLoadingOnboarding } = useDoc<any>(onboardingProcessRef as any);

    // Fetch offboarding projects for this employee (project-based)
    const offboardingProjectsQuery = useMemoFirebase(({ firestore, companyPath }) => {
        if (!firestore || !employeeId) return null;
        return query(
            tenantCollection(firestore, companyPath, 'projects'),
            where('type', '==', 'offboarding'),
            where('offboardingEmployeeId', '==', employeeId)
        );
    }, [employeeId]);
    const { data: offboardingProjects, isLoading: isLoadingOffboarding } = useCollection<Project>(offboardingProjectsQuery as any);
    const [offboardingTaskCounts, setOffboardingTaskCounts] = React.useState<Record<string, { total: number; completed: number }>>({});

    // Calculate onboarding progress
    const onboardingProgress = React.useMemo(() => {
        if (!onboardingProcess?.stages) return 0;
        const stages = onboardingProcess.stages;
        let totalTasks = 0;
        let completedTasks = 0;
        stages.forEach((stage: any) => {
            if (stage.tasks) {
                totalTasks += stage.tasks.length;
                completedTasks += stage.tasks.filter((t: any) => t.completed).length;
            }
        });
        return totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
    }, [onboardingProcess]);

    React.useEffect(() => {
        async function fetchOffboardingCounts() {
            if (!firestore || !offboardingProjects || offboardingProjects.length === 0) return;
            const counts: Record<string, { total: number; completed: number }> = {};
            for (const p of offboardingProjects) {
                const snap = await getDocs(tCollection('projects', p.id, 'tasks'));
                const tasks = snap.docs.map(d => d.data() as Task);
                counts[p.id] = { total: tasks.length, completed: tasks.filter(t => t.status === 'DONE').length };
            }
            setOffboardingTaskCounts(counts);
        }
        fetchOffboardingCounts();
    }, [firestore, offboardingProjects]);

    const offboardingProgress = React.useMemo(() => {
        const ps = offboardingProjects || [];
        let total = 0;
        let done = 0;
        ps.forEach(p => {
            const c = offboardingTaskCounts[p.id];
            if (!c) return;
            total += c.total;
            done += c.completed;
        });
        return total > 0 ? Math.round((done / total) * 100) : 0;
    }, [offboardingProjects, offboardingTaskCounts]);

    const { data: departments, isLoading: isLoadingDepts } = useCollection<Department>(departmentsQuery as any);

    const currentUserEmployeeRef = useMemoFirebase(
        ({ firestore, companyPath, user }) => (firestore && user ? tenantDoc(firestore, companyPath, 'employees', user.uid) : null),
        [user?.uid]
    );
    const { data: currentUserEmployee } = useDoc<Employee>(currentUserEmployeeRef as any);
    const currentUserRole = currentUserEmployee?.role;

    const isLoading = isLoadingEmployee || isLoadingDepts || isLoadingPosition || isLoadingWorkSchedule || isLoadingDocs || isLoadingOrgActions || isLoadingOnboarding || isLoadingOffboarding;

    const { effectiveHireDate, probationEndDate, effectiveTerminationDate } = React.useMemo(() => {
        let hireDate = employee?.hireDate;
        let probationEnd = null;
        let terminationDate = employee?.terminationDate;

        if (!erDocuments || erDocuments.length === 0) return { effectiveHireDate: hireDate, probationEndDate: null, effectiveTerminationDate: terminationDate };

        // Filter for appointment documents and sort by date (newest first)
        const appointmentDocs = erDocuments
            .filter(doc =>
                (doc.metadata?.actionId?.startsWith('appointment') || doc.templateId?.includes('appointment')) &&
                ['APPROVED', 'SIGNED'].includes(doc.status)
            )
            .sort((a, b) => {
                const dateA = a.createdAt?.seconds ? a.createdAt.seconds : new Date(a.createdAt).getTime() / 1000;
                const dateB = b.createdAt?.seconds ? b.createdAt.seconds : new Date(b.createdAt).getTime() / 1000;
                return (dateB || 0) - (dateA || 0);
            });

        if (appointmentDocs.length > 0) {
            const latestDoc = appointmentDocs[0];
            const inputs = latestDoc.customInputs || {};
            const actionId = latestDoc.metadata?.actionId;

            // Get mapping for this action
            const actionConfig = orgActions?.find((a: any) => a.id === actionId);
            const mappings = actionConfig?.dateMappings || {};

            let hireDateKey = null;
            let probationEndKey = null;

            if (actionId === 'appointment_probation') {
                hireDateKey = mappings['probationStartDate'];
                probationEndKey = mappings['probationEndDate'];
            } else if (actionId === 'appointment_reappoint') {
                hireDateKey = mappings['reappointmentDate'];
            } else if (actionId === 'appointment_permanent') {
                hireDateKey = mappings['appointmentDate'];
            }

            let hireDateVal = hireDateKey ? inputs[hireDateKey] : null;
            probationEnd = probationEndKey ? inputs[probationEndKey] : null;

            // Fallback to legacy hardcoded keys or generic ones if mapping is missing
            if (!hireDateVal) {
                if (actionId === 'appointment_probation') {
                    hireDateVal = inputs['Туршилтын эхлэх огноо'] || inputs['probationStartDate'];
                } else if (actionId === 'appointment_reappoint') {
                    hireDateVal = inputs['Томилогдсон огноо'] || inputs['appointmentDate'];
                } else if (actionId === 'appointment_permanent') {
                    hireDateVal = inputs['Томилогдсон хугацаа'] || inputs['appointmentDate'];
                }
            }

            // General fallbacks for hire date
            if (!hireDateVal) {
                hireDateVal = inputs['startDate'] || inputs['date'] || inputs['Огноо'];
            }

            // Last resort: find any string that looks like a date
            if (!hireDateVal) {
                hireDateVal = Object.values(inputs).find(v => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v));
            }

            if (hireDateVal) {
                hireDate = hireDateVal;
            }
        }

        // Filter for release documents
        const releaseDocs = erDocuments
            .filter(doc =>
                (doc.metadata?.actionId?.startsWith('release') || doc.templateId?.includes('release')) &&
                ['APPROVED', 'SIGNED'].includes(doc.status)
            )
            .sort((a, b) => {
                const dateA = a.createdAt?.seconds ? a.createdAt.seconds : new Date(a.createdAt).getTime() / 1000;
                const dateB = b.createdAt?.seconds ? b.createdAt.seconds : new Date(b.createdAt).getTime() / 1000;
                return (dateB || 0) - (dateA || 0);
            });

        if (releaseDocs.length > 0) {
            const latestDoc = releaseDocs[0];
            const inputs = latestDoc.customInputs || {};
            const actionId = latestDoc.metadata?.actionId;
            const actionConfig = orgActions?.find((a: any) => a.id === actionId);
            const mappings = actionConfig?.dateMappings || {};

            const releaseDateKey = mappings['releaseDate'];
            let releaseDateVal = releaseDateKey ? inputs[releaseDateKey] : null;

            if (!releaseDateVal) {
                releaseDateVal = inputs['Ажлаас чөлөөлөх огноо'] || inputs['releaseDate'] || inputs['terminationDate'];
            }

            if (releaseDateVal) {
                terminationDate = releaseDateVal;
            }
        }

        return { effectiveHireDate: hireDate, probationEndDate: probationEnd, effectiveTerminationDate: terminationDate };
    }, [erDocuments, employee, orgActions]);

    const departmentMap = React.useMemo(() => {
        if (!departments) return new Map<string, string>();
        return departments.reduce((map, dept) => {
            map.set(dept.id, dept.name);
            return map;
        }, new Map<string, string>());
    }, [departments]);



    if (isLoading) {
        return (
            <div className="py-8 min-h-screen container mx-auto max-w-7xl">
                <ProfileSkeleton />
            </div>
        )
    }

    if (!employee) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center text-center space-y-4">
                <div className="h-20 w-20 bg-muted rounded-full flex items-center justify-center">
                    <User className="h-10 w-10 text-muted-foreground" />
                </div>
                <h2 className="text-xl font-semibold">Ажилтан олдсонгүй</h2>
                <p className="text-muted-foreground max-w-md">
                    Таны хайж буй ажилтны мэдээлэл системд байхгүй эсвэл устгагдсан байж болзошгүй.
                </p>
                <Button asChild>
                    <Link href="/dashboard/employees">Жагсаалт руу буцах</Link>
                </Button>
            </div>
        )
    }

    const fullName = employee.lastName
        ? `${employee.lastName.substring(0, 1)}.${employee.firstName}`
        : employee.firstName;
    const departmentName = departmentMap.get(employee.departmentId ?? '') || 'Тодорхойгүй';
    const workScheduleName = workSchedule?.name || 'Тодорхойгүй';
    const statusInfo = statusConfig[employee.status] || { variant: 'outline', className: '', label: employee.status };
    const isActive = isActiveStatus(employee.status);



    return (
        <>
        <div className="flex flex-col h-full bg-slate-50/50">
            <div className="px-6 md:px-8 pt-6">
                <PageHeader
                    title={fullName}
                    description="Ажилтаны хувийн хэрэг"
                    showBackButton={true}
                    hideBreadcrumbs={true}
                    backButtonPlacement="inline"
                    backBehavior="history"
                    fallbackBackHref="/dashboard/employees"
                    actions={
                        <>
                            <Button
                                variant="outline"
                                size="sm"
                                className={cn("h-8", employee.role === 'admin' && "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100")}
                                onClick={() => setShowAdminDialog(true)}
                            >
                                <Shield className="h-3.5 w-3.5 mr-1.5" />
                                {employee.role === 'admin' ? 'Админ' : 'Админ болгох'}
                            </Button>
                            <Button variant="outline" size="sm" className="h-8" asChild>
                                <Link href={`/dashboard/employees/${employeeId}/lifecycle`}>
                                    <Activity className="h-3.5 w-3.5 mr-1.5" />
                                    Life Cycle
                                </Link>
                            </Button>
                        </>
                    }
                />
            </div>

            {/* Main Content */}
            <div className="flex-1 overflow-y-auto">
                <div className="p-6 md:p-8 space-y-6 pb-32">
                    {/* Status Warning - only for pending appointment */}
                    {employee.status === 'appointing' && (
                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3">
                            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                            <p className="text-sm font-medium text-amber-900">
                                Энэ ажилтан <strong>томилогдож буй</strong> төлөвтэй байна. Томилох бичиг баримт баталгаажсан үед идэвхтэй болно.
                            </p>
                        </div>
                    )}
                    {/* Releasing employee info */}
                    {employee.status === 'releasing' && (
                        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 flex items-center gap-3">
                            <AlertTriangle className="w-5 h-5 text-orange-600 shrink-0" />
                            <p className="text-sm font-medium text-orange-900">
                                Энэ ажилтан <strong>чөлөөлөгдөж буй</strong> төлөвтэй байна. Чөлөөлөх бичиг баримт баталгаажсан үед &quot;Ажлаас гарсан&quot; болно.
                            </p>
                        </div>
                    )}
                    {/* Terminated employee info */}
                    {employee.status === 'terminated' && (
                        <div className="bg-slate-100 border border-slate-200 rounded-xl p-4 flex items-center gap-3">
                            <AlertTriangle className="w-5 h-5 text-slate-500 shrink-0" />
                            <p className="text-sm font-medium text-slate-700">
                                Энэ ажилтан <strong>ажлаас гарсан</strong> төлөвтэй байна.
                            </p>
                        </div>
                    )}

            {/* Main Layout */}
            <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
                {/* Left Sidebar - Profile Card */}
                <div className="xl:col-span-1 space-y-4">
                    {/* Employee Card (replaces old profile + quick info cards) */}
                    <EmployeeCard
                        employee={{
                            ...(employee as any),
                            gender: questionnaireData?.gender,
                            birthDate: questionnaireData?.birthDate,
                        }}
                        variant="detailed"
                        asLink={false}
                        departmentName={departmentName}
                        className="shadow-sm"
                        topRightActions={
                            <TooltipProvider delayDuration={150}>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 rounded-lg"
                                            onPointerDown={(e) => e.stopPropagation()}
                                            onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                handleStartEdit(employee);
                                            }}
                                            disabled={isSaving || isUploadingPhoto}
                                            aria-label="Засах"
                                        >
                                            <Edit className="h-4 w-4" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <div className="text-xs font-semibold">Засах</div>
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        }
                    />

                    {/* Edit dialog (kept outside EmployeeCard for reliable interactions) */}
                    <Dialog
                        open={isEditing}
                        onOpenChange={(open) => {
                            if (open) return;
                            handleCancelEdit();
                        }}
                    >
                        <DialogContent className="sm:max-w-[520px]">
                            <DialogHeader>
                                <DialogTitle>Ажилтны мэдээлэл засах</DialogTitle>
                                <DialogDescription>Овог, нэр, утас, имэйл, аватар зураг.</DialogDescription>
                            </DialogHeader>

                            <div className="space-y-5">
                                {/* Avatar */}
                                <div className="flex items-center gap-4">
                                    <input
                                        ref={photoInputRef}
                                        type="file"
                                        accept="image/jpeg,image/jpg,image/png,image/webp"
                                        className="hidden"
                                        onChange={handlePhotoSelected}
                                        disabled={isUploadingPhoto}
                                    />
                                    <div className="shrink-0">
                                        <AvatarWithProgress
                                            employee={employee}
                                            size={72}
                                            onboardingProgress={onboardingProgress}
                                            onClick={() => photoInputRef.current?.click()}
                                        />
                                    </div>
                                    <div className="min-w-0">
                                        <div className="text-sm font-semibold truncate">{fullName}</div>
                                        <div className="text-xs text-muted-foreground truncate">
                                            #{employee.employeeCode} • {departmentName}
                                        </div>
                                        <div className="mt-2 text-[11px] text-muted-foreground">
                                            Зураг дээр дарж солино (JPG/PNG/WebP, 8MB).
                                        </div>
                                    </div>
                                </div>

                                {/* Fields */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div className="space-y-1">
                                        <div className="text-[10px] font-medium text-slate-500 uppercase">Овог</div>
                                        <Input
                                            value={editForm.lastName}
                                            onChange={(e) => setEditForm((prev) => ({ ...prev, lastName: e.target.value }))}
                                            className="h-9"
                                            placeholder="Овог"
                                            disabled={isSaving}
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <div className="text-[10px] font-medium text-slate-500 uppercase">Нэр</div>
                                        <Input
                                            value={editForm.firstName}
                                            onChange={(e) => setEditForm((prev) => ({ ...prev, firstName: e.target.value }))}
                                            className="h-9"
                                            placeholder="Нэр"
                                            disabled={isSaving}
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <div className="text-[10px] font-medium text-slate-500 uppercase">Утас</div>
                                        <Input
                                            value={editForm.phoneNumber}
                                            onChange={(e) => setEditForm((prev) => ({ ...prev, phoneNumber: e.target.value }))}
                                            className="h-9"
                                            placeholder="+976 9911..."
                                            disabled={isSaving}
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <div className="text-[10px] font-medium text-slate-500 uppercase">Имэйл</div>
                                        <Input
                                            type="email"
                                            value={editForm.email}
                                            onChange={(e) => setEditForm((prev) => ({ ...prev, email: e.target.value }))}
                                            className="h-9"
                                            placeholder="email@example.com"
                                            disabled={isSaving}
                                        />
                                    </div>
                                </div>
                            </div>

                            <DialogFooter>
                                <Button variant="outline" onClick={handleCancelEdit} disabled={isSaving}>
                                    Болих
                                </Button>
                                <Button onClick={handleSaveEdit} disabled={isSaving}>
                                    {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Хадгалах'}
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>

                    {/* Offboarding Progress - Only show if projects exist */}
                    {(offboardingProjects && offboardingProjects.length > 0) && (
                        <div className="bg-white rounded-xl border p-4 ring-2 ring-amber-100">
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="text-xs font-semibold text-amber-600 uppercase">Offboarding</h3>
                                <span className={cn(
                                    "text-xs font-medium",
                                    offboardingProgress >= 100 ? "text-emerald-600" : "text-amber-600"
                                )}>
                                    {offboardingProgress}%
                                </span>
                            </div>
                            <div className="h-2 bg-amber-100 rounded-full overflow-hidden">
                                <div 
                                    className={cn(
                                        "h-full rounded-full transition-all",
                                        offboardingProgress >= 100 ? "bg-emerald-500" : "bg-amber-500"
                                    )}
                                    style={{ width: `${offboardingProgress}%` }}
                                />
                            </div>
                            <Button variant="ghost" size="sm" className="w-full mt-3 h-8 text-xs text-amber-700 hover:text-amber-800 hover:bg-amber-50" asChild>
                                <Link href={`/dashboard/offboarding/${employeeId}`}>
                                    Offboarding харах
                                    <ChevronRight className="h-3.5 w-3.5 ml-1" />
                                </Link>
                            </Button>
                        </div>
                    )}
                </div>

                {/* Right Content - Tabs */}
                <div className="xl:col-span-3">
                    <Tabs defaultValue="history" className="w-full">
                        {/* Tab Navigation (shared VerticalTabMenu like Position Detail) */}
                        <div className="mb-4">
                            <VerticalTabMenu
                                orientation="horizontal"
                                items={[
                                    { value: 'history', label: 'Хөдөлмөрийн харилцаа' },
                                    { value: 'onboarding', label: 'Onboarding' },
                                    ...(offboardingProjects && offboardingProjects.length > 0
                                        ? [{ value: 'offboarding', label: 'Offboarding' as const }]
                                        : []),
                                    { value: 'documents', label: 'Ажилтны бичиг баримт' },
                                    { value: 'time-off', label: 'Чөлөө' },
                                    { value: 'vacation', label: 'Амралт' },
                                    { value: 'cv', label: 'CV' },
                                    { value: 'system-settings', label: 'Системийн тохиргоо' },
                                ]}
                                className="w-full"
                                triggerClassName="text-sm"
                            />
                        </div>

                        {/* Tab Contents */}
                        <TabsContent value="history" className="mt-0 focus-visible:outline-none">
                            <HistoryTabContent employeeId={employeeId || ''} erDocuments={erDocuments} isLoading={isLoadingDocs} />
                        </TabsContent>
                        <TabsContent value="vacation" className="mt-0 focus-visible:outline-none">
                            <VacationTabContent employee={employee} effectiveHireDate={effectiveHireDate || undefined} />
                        </TabsContent>
                        <TabsContent value="time-off" className="mt-0 focus-visible:outline-none">
                            <div className="bg-white rounded-xl border p-8 text-center">
                                <Calendar className="mx-auto h-10 w-10 text-slate-200 mb-3" />
                                <p className="text-sm text-slate-500">Одоогоор чөлөөний бүртгэл байхгүй байна</p>
                            </div>
                        </TabsContent>
                        <TabsContent value="documents" className="mt-0 focus-visible:outline-none">
                            <DocumentsTabContent employee={employee} />
                        </TabsContent>
                        <TabsContent value="onboarding" className="mt-0 focus-visible:outline-none">
                            <OnboardingTabContent employeeId={employeeId || ''} employee={employee} />
                        </TabsContent>
                        {(offboardingProjects && offboardingProjects.length > 0) && (
                            <TabsContent value="offboarding" className="mt-0 focus-visible:outline-none">
                                <OffboardingTabContent employeeId={employeeId || ''} employee={employee} />
                            </TabsContent>
                        )}
                        <TabsContent value="cv" className="mt-0 focus-visible:outline-none">
                            <CVTabContent employee={employee} />
                        </TabsContent>
                        <TabsContent value="system-settings" className="mt-0 focus-visible:outline-none">
                            <SystemSettingsTabContent
                                employee={employee}
                                currentUserId={user?.uid ?? ''}
                                currentUserRole={currentUserRole}
                            />
                        </TabsContent>
                    </Tabs>
                </div>
            </div>
                </div>
            </div>
        </div>

            {/* Admin Dialog */}
            {user && (
                <MakeAdminDialog
                    open={showAdminDialog}
                    onOpenChange={setShowAdminDialog}
                    employee={employee}
                    currentUserId={user.uid}
                />
            )}
        </>
    )
}
