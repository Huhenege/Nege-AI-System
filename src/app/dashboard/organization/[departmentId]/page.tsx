'use client';

import { getJsonAuthHeaders } from '@/lib/api/client-auth';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { collection, doc, query, where, writeBatch, arrayUnion, orderBy, limit, getDocs, addDoc, deleteDoc } from 'firebase/firestore';
import { generateNextPositionCode } from '@/lib/code-generator';
import {
    useFirebase,
    useMemoFirebase,
    useDoc,
    useCollection,
    useFetchCollection,
    updateDocumentNonBlocking,
    tenantCollection,
    tenantDoc,
    useTenantWrite
} from '@/firebase';
import { addDepartmentHistoryEvent } from '@/app/dashboard/organization/department-history-log';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Users, Network, LayoutDashboard, History as HistoryIcon, Plus, Edit3, Save, X, Trash2, AlertTriangle, Loader2, PlusCircle, LayoutList, CheckCircle, Upload, FileText, ChevronRight, Copy, Sparkles, MoreVertical } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { PageHeader } from '@/components/patterns/page-layout';
import { Department, Position, DepartmentType, PositionLevel, JobCategory, EmploymentType, WorkSchedule } from '@/app/dashboard/organization/types';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { PositionsManagementTab } from './components/positions-management-tab';
import { HistoryTab } from './components/history-tab';
import { PositionStructureChart } from './components/position-structure-chart';
import { AddPositionDialog } from '@/app/dashboard/organization/add-position-dialog';
import { DepartmentStructureCard } from '@/components/organization/department-structure-card';
import { VerticalTabMenu } from '@/components/ui/vertical-tab-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export default function DepartmentPage() {
    const params = useParams<{ departmentId?: string | string[] }>();
    const departmentId = Array.isArray(params?.departmentId) ? params.departmentId[0] : params?.departmentId;
    const router = useRouter();
    const { firestore, user } = useFirebase();
    const { tDoc, tCollection, companyPath } = useTenantWrite();
    const { toast } = useToast();
    const performedByName = user?.displayName || user?.email || 'Систем';
    const performedBy = user?.uid ?? '';

    // -- State --
    const [isEditingInfo, setIsEditingInfo] = useState(false);
    const [infoForm, setInfoForm] = useState<Partial<Department>>({});
    const [isSavingInfo, setIsSavingInfo] = useState(false);

    // Danger Zone State
    const [isDeptDeleting, setIsDeptDeleting] = useState(false);
    const [isDeptDeleteConfirmOpen, setIsDeptDeleteConfirmOpen] = useState(false);
    const [isDisbandConfirmOpen, setIsDisbandConfirmOpen] = useState(false);
    const [disbandReason, setDisbandReason] = useState('');

    // Add Position Dialog State
    const [isAddPositionOpen, setIsAddPositionOpen] = useState(false);
    const [pendingParentPositionId, setPendingParentPositionId] = useState<string | undefined>(undefined);
    
    // AI Generation State
    const [isGeneratingAI, setIsGeneratingAI] = useState(false);

    // Урд багны нэгжийн карт — тойрог задрах цэс (хулганаар нээгдэнэ)
    const [deptCardMenuOpen, setDeptCardMenuOpen] = useState(false);
    const deptCardMenuRef = useRef<HTMLDivElement>(null);
    const deptCardLeaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const openDeptCardMenu = () => {
        if (deptCardLeaveTimerRef.current) {
            clearTimeout(deptCardLeaveTimerRef.current);
            deptCardLeaveTimerRef.current = null;
        }
        setDeptCardMenuOpen(true);
    };
    const closeDeptCardMenu = () => {
        deptCardLeaveTimerRef.current = setTimeout(() => setDeptCardMenuOpen(false), 250);
    };
    useEffect(() => {
        return () => { if (deptCardLeaveTimerRef.current) clearTimeout(deptCardLeaveTimerRef.current); };
    }, []);

    // -- Queries --
    const deptDocRef = useMemoFirebase(({ firestore, companyPath }) => (firestore && departmentId ? tenantDoc(firestore, companyPath, 'departments', departmentId) : null), [firestore, departmentId]);
    const { data: department, isLoading: isDeptLoading } = useDoc<Department>(deptDocRef as any);

    const positionsColRef = useMemoFirebase(({ firestore, companyPath }) => (firestore ? tenantCollection(firestore, companyPath, 'positions') : null), [firestore]);
    const positionsQuery = useMemoFirebase(({ firestore, companyPath }) => (firestore && departmentId ? query(tenantCollection(firestore, companyPath, 'positions'), where('departmentId', '==', departmentId)) : null), [firestore, departmentId]);
    const { data: positions, refetch: refetchPositions } = useFetchCollection<Position>(positionsQuery as any);

    // Lookups for Edit Form
    const typesQuery = useMemoFirebase(({ firestore, companyPath }) => (firestore ? tenantCollection(firestore, companyPath, 'departmentTypes') : null), [firestore]);
    const deptsQuery = useMemoFirebase(({ firestore, companyPath }) => (firestore ? tenantCollection(firestore, companyPath, 'departments') : null), [firestore]);
    const categoriesQuery = useMemoFirebase(({ firestore, companyPath }) => (firestore ? tenantCollection(firestore, companyPath, 'jobCategories') : null), [firestore]);
    const levelsQuery = useMemoFirebase(({ firestore, companyPath }) => (firestore ? tenantCollection(firestore, companyPath, 'positionLevels') : null), [firestore]);
    const empTypesQuery = useMemoFirebase(({ firestore, companyPath }) => (firestore ? tenantCollection(firestore, companyPath, 'employmentTypes') : null), [firestore]);
    const schedulesQuery = useMemoFirebase(({ firestore, companyPath }) => (firestore ? tenantCollection(firestore, companyPath, 'workSchedules') : null), [firestore]);
    const deptEmployeesQuery = useMemoFirebase(
        ({ firestore, companyPath }) => (firestore
            ? query(tenantCollection(firestore, companyPath, 'employees'), where('status', 'in', ['active', 'active_probation', 'active_permanent', 'appointing']))
            : null),
        [firestore, departmentId]
    );

    const { data: departmentTypes } = useFetchCollection<DepartmentType>(typesQuery);
    const { data: allDepartments } = useFetchCollection<Department>(deptsQuery);
    const { data: levels } = useFetchCollection<PositionLevel>(levelsQuery);
    const { data: categories } = useFetchCollection<JobCategory>(categoriesQuery);
    const { data: empTypes } = useFetchCollection<EmploymentType>(empTypesQuery);
    const { data: schedules } = useFetchCollection<WorkSchedule>(schedulesQuery);
    const { data: allActiveEmployees } = useCollection<any>(deptEmployeesQuery as any);

    // -- Derived Data --
    const lookups = useMemo(() => {
        const departmentMap = allDepartments?.reduce<Record<string, string>>((acc, d) => { acc[d.id] = d.name; return acc; }, {}) || { [departmentId || '']: department?.name || '' };
        const departmentColorMap = allDepartments?.reduce<Record<string, string>>((acc, d) => {
            if (d.color) acc[d.id] = d.color;
            return acc;
        }, {}) || {};

        const levelMap = levels?.reduce<Record<string, string>>((acc, level) => { acc[level.id] = level.name; return acc; }, {}) || {};
        const empTypeMap = empTypes?.reduce<Record<string, string>>((acc, type) => { acc[type.id] = type.name; return acc; }, {}) || {};
        const jobCategoryMap = categories?.reduce<Record<string, string>>((acc, cat) => { acc[cat.id] = `${cat.code} - ${cat.name}`; return acc; }, {}) || {};

        return {
            departmentMap,
            departmentColorMap,
            levelMap,
            empTypeMap,
            jobCategoryMap,
            departmentColor: department?.color || '#ffffff'
        };
    }, [allDepartments, department, levels, empTypes, categories, departmentId]);

    const parentName = allDepartments?.find(d => d.id === department?.parentId)?.name || 'Үндсэн нэгж';
    const typeName = departmentTypes?.find(t => t.id === department?.typeId)?.name || 'Нэгж';
    const deptApprovedPositions = (positions || []).filter(p => p.isApproved !== false);
    const deptApprovedCount = deptApprovedPositions.length;
    const deptUnapprovedCount = Math.max(0, (positions?.length || 0) - deptApprovedCount);
    const deptFilledCount = deptApprovedPositions.reduce((sum, p) => sum + (p.filled || 0), 0);

    // -- Handlers --
    const handleInfoEdit = () => {
        if (!department) return;
        setInfoForm({
            name: department.name,
            code: department.code,
            typeId: department.typeId,
            parentId: department.parentId,
            status: department.status,
            color: department.color,
            vision: department.vision || '',
            description: department.description || ''
        });
        setIsEditingInfo(true);
    };

    const handleInfoCancel = () => {
        setIsEditingInfo(false);
        setInfoForm({});
    };

    const handleInfoSave = async () => {
        if (!firestore || !department || !deptDocRef) return;
        setIsSavingInfo(true);
        try {
            // Remove undefined values to prevent Firestore errors
            const cleanData = Object.entries(infoForm).reduce((acc, [key, value]) => {
                if (value !== undefined) acc[key] = value;
                return acc;
            }, {} as any);

            // Dynamically import updateDoc to ensure it's available
            const { updateDoc } = await import('firebase/firestore');
            await updateDoc(deptDocRef, cleanData);

            setIsEditingInfo(false);
            toast({ title: "Мэдээлэл хадгалагдлаа" });
        } catch (e: any) {
            console.error("Save error:", e);
            let errorMessage = "Мэдээлэл хадгалахад алдаа гарлаа";

            if (e.code === 'permission-denied' || e.message?.includes('Missing or insufficient permissions')) {
                errorMessage = "Та энэ үйлдлийг хийх эрхгүй байна. (Админ эрх шаардлагатай)";
            } else if (e.message) {
                errorMessage = e.message;
            }

            toast({
                title: "Алдаа",
                description: errorMessage,
                variant: "destructive"
            });
        } finally {
            setIsSavingInfo(false);
        }
    };

    const handleDeptDeleteClick = async () => {
        if (!firestore || !department) return;
        setIsDeptDeleting(true);

        try {
            const historyRef = tCollection('departmentHistory');
            const hq = query(historyRef, where('departmentId', '==', department.id));
            const historySnapshot = await getDocs(hq);
            const hasHistory = !historySnapshot.empty;

            const hasPositions = (positions?.length || 0) > 0;

            if (hasPositions && !hasHistory) {
                toast({
                    variant: "destructive",
                    title: "Устгах боломжгүй",
                    description: `Энэ нэгжид ${positions?.length} ажлын байр бүртгэлтэй байна. Түүхгүй нэгжийг устгахын тулд эхлээд ажлын байруудыг устгах эсвэл шилжүүлэх шаардлагатай.`
                });
                setIsDeptDeleting(false);
                return;
            }

            if (hasHistory) {
                setIsDisbandConfirmOpen(true);
            } else {
                setIsDeptDeleteConfirmOpen(true);
            }
        } catch (error) {
            console.error("Error checking dept constraints:", error);
            toast({ variant: "destructive", title: "Алдаа гарлаа" });
        } finally {
            setIsDeptDeleting(false);
        }
    };

    const handleSimpleDeptDelete = async () => {
        if (!firestore || !department) return;
        setIsDeptDeleting(true);
        try {
            await deleteDoc(tDoc('departments', department.id));
            toast({ title: "Нэгж амжилттай устгагдлаа" });
            router.push('/dashboard/organization');
        } catch (error) {
            console.error("Error deleting department:", error);
            toast({ variant: "destructive", title: "Алдаа гарлаа" });
            setIsDeptDeleting(false);
        }
    };

    const handleDeptDisband = async () => {
        if (!firestore || !department) return;
        setIsDeptDeleting(true);
        try {
            const timestamp = new Date().toISOString();

            // 1. Fetch all employees in this department
            const employeesRef = tCollection('employees');
            const eq = query(employeesRef, where('departmentId', '==', department.id));
            const employeeSnapshot = await getDocs(eq);
            const deptEmployees = employeeSnapshot.docs.map(d => ({
                id: d.id,
                ...d.data()
            })) as any[];

            const batch = writeBatch(firestore);

            // 2. Prepare History Entry
            const historyRef = tCollection('departmentHistory');
            const newHistoryDoc = doc(historyRef);

            const snapshot = {
                departmentName: department.name,
                disbandReason: disbandReason || 'Нэгжийг татан буулгав',
                disbandedAt: timestamp,
                disbandedBy: user?.uid || null,
                disbandedByName: user?.displayName || user?.email || 'Систем',
                positions: (positions || []).map(pos => ({
                    ...pos,
                    employees: deptEmployees
                        .filter(emp => emp.positionId === pos.id)
                        .map(emp => ({
                            id: emp.id,
                            firstName: emp.firstName,
                            lastName: emp.lastName,
                            employeeCode: emp.employeeCode
                        }))
                }))
            };

            batch.set(newHistoryDoc, {
                departmentId: department.id,
                approvedAt: timestamp,
                validTo: timestamp,
                isDissolution: true,
                snapshot: snapshot
            });

            // 3. Update old history
            const oldHistoryQuery = query(historyRef, where('departmentId', '==', department.id));
            const oldHistorySnapshot = await getDocs(oldHistoryQuery);
            oldHistorySnapshot.docs.forEach(hDoc => {
                if (!hDoc.data().validTo) {
                    batch.update(hDoc.ref, { validTo: timestamp });
                }
            });

            // 4. Delete Dept and Positions
            batch.delete(tDoc('departments', department.id));
            if (positions) {
                positions.forEach(pos => {
                    batch.delete(tDoc('positions', pos.id));
                });
            }

            await batch.commit();
            toast({ title: "Нэгж амжилттай татан буугдлаа" });
            router.push('/dashboard/organization');
        } catch (error) {
            console.error("Error disbanding department:", error);
            toast({ variant: "destructive", title: "Алдаа гарлаа" });
            setIsDeptDeleting(false);
        }
    };

    const handleAddChild = (parentId: string) => {
        setPendingParentPositionId(parentId);
        setIsAddPositionOpen(true);
    };

    const posCodeConfigRef = useMemoFirebase(
        ({ firestore, companyPath }) => (firestore ? tenantDoc(firestore, companyPath, 'company', 'positionCodeConfig') : null),
        []
    );

    const handleDuplicate = async (pos: any) => {
        if (!firestore || !posCodeConfigRef || !department?.id) return;
        const {
            id,
            filled,
            code: _code,
            onPositionClick,
            onAddChild,
            onDuplicate,
            onAppoint,
            levelName,
            departmentColor,
            assignedEmployee,
            approvalHistory: _history,
            approvedAt: _approvedAt,
            approvedBy: _approvedBy,
            disapprovedAt: _disapprovedAt,
            disapprovedBy: _disapprovedBy,
            ...clonedData
        } = pos;

        const cleanData = Object.entries(clonedData).reduce((acc, [key, value]) => {
            if (value !== undefined && typeof value !== 'function') acc[key] = value;
            return acc;
        }, {} as any);

        delete cleanData.approvalHistory;
        delete cleanData.approvedAt;
        delete cleanData.approvedBy;
        delete cleanData.disapprovedAt;
        delete cleanData.disapprovedBy;

        try {
            const newCode = await generateNextPositionCode(firestore, posCodeConfigRef);
            const newPositionData = {
                ...cleanData,
                departmentId: department.id,
                code: newCode,
                title: `${pos.title || 'Шинэ ажлын байр'} (Хуулбар)`,
                filled: 0,
                isActive: true,
                isApproved: false,
                createdAt: new Date().toISOString(),
            };
            const colRef = tCollection('positions');
            const ref = await addDoc(colRef, newPositionData);
            const deptId = newPositionData.departmentId || department?.id;
            if (deptId && performedBy) {
                addDepartmentHistoryEvent({
                    firestore,
                    companyPath,
                    departmentId: deptId,
                    eventType: 'position_added',
                    positionId: ref.id,
                    positionTitle: newPositionData.title,
                    performedBy,
                    performedByName,
                }).catch(() => {});
            }
            toast({ title: "Амжилттай хувиллаа", description: "Шинэ ажлын байр жагсаалтад нэмэгдлээ." });
            refetchPositions();
        } catch (e) {
            console.error('Хуулбарлах алдаа:', e);
            toast({ variant: 'destructive', title: 'Хувилах амжилтгүй', description: e instanceof Error ? e.message : 'Дахин оролдоно уу.' });
        }
    };

    const handleAddPosition = () => {
        setPendingParentPositionId(undefined);
        setIsAddPositionOpen(true);
    };

    const handleAIGenerate = async () => {
        if (!infoForm.name && !department?.name) {
            toast({
                title: 'Анхааруулга',
                description: 'Нэгжийн нэр оруулсны дараа AI үүсгэх боломжтой',
                variant: 'destructive'
            });
            return;
        }

        setIsGeneratingAI(true);
        try {
            const deptTypeName = departmentTypes?.find(t => t.id === (infoForm.typeId || department?.typeId))?.name;
            const parentDeptName = allDepartments?.find(d => d.id === (infoForm.parentId || department?.parentId))?.name;

            const response = await fetch('/api/generate-department-details', {
                method: 'POST',
                headers: await getJsonAuthHeaders(),
                body: JSON.stringify({
                    departmentName: infoForm.name || department?.name,
                    departmentType: deptTypeName,
                    parentDepartment: parentDeptName
                }),
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'AI үүсгэхэд алдаа гарлаа');
            }

            setInfoForm(prev => ({
                ...prev,
                vision: result.data.vision || prev.vision,
                description: result.data.description || prev.description
            }));

            toast({
                title: 'AI үүсгэлт амжилттай',
                description: 'Зорилго болон чиг үүргийг шалгаад хадгалаарай'
            });
        } catch (error) {
            console.error('AI generation error:', error);
            toast({
                title: 'Алдаа',
                description: error instanceof Error ? error.message : 'AI үүсгэхэд алдаа гарлаа',
                variant: 'destructive',
            });
        } finally {
            setIsGeneratingAI(false);
        }
    };

    if (isDeptLoading) return <div className="p-8"><Skeleton className="h-64 w-full" /></div>;
    if (!department) return <div className="p-10 text-center">Нэгж олдсонгүй</div>;

    return (
        <div className="flex flex-col h-full">
            <div className="flex-1 p-6 md:p-8 space-y-6 pb-32">
                <PageHeader
                    title={isEditingInfo ? infoForm.name || department.name : department.name}
                    description={`${(isEditingInfo ? infoForm.code : department.code) || 'Код оноогоогүй'} • ${typeName}`}
                    breadcrumbs={[
                        { label: 'Бүтэц', href: '/dashboard/organization' },
                        { label: department.name }
                    ]}
                    showBackButton={true}
                    hideBreadcrumbs={true}
                    backButtonPlacement="inline"
                    backBehavior="history"
                    fallbackBackHref="/dashboard/organization"
                    backHref="/dashboard/organization"
                />

                <div className="space-y-6">
                    {/* Edit dialog (moved from Info card) */}
                    <Dialog open={isEditingInfo} onOpenChange={(open) => { if (!open) handleInfoCancel(); }}>
                        <DialogContent className="sm:max-w-[620px]">
                            <DialogHeader>
                                <DialogTitle>Нэгж засах</DialogTitle>
                                <DialogDescription>Алба нэгжийн мэдээллийг шинэчилнэ.</DialogDescription>
                            </DialogHeader>

                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="col-span-2 space-y-1.5">
                                        <Label className="text-xs text-muted-foreground">Нэр</Label>
                                        <Input
                                            value={infoForm.name || ''}
                                            onChange={(e) => setInfoForm(prev => ({ ...prev, name: e.target.value }))}
                                            className="h-9"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-xs text-muted-foreground">Код</Label>
                                        <Input
                                            value={infoForm.code || ''}
                                            onChange={(e) => setInfoForm(prev => ({ ...prev, code: e.target.value }))}
                                            className="h-9 font-mono"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-xs text-muted-foreground">Төлөв</Label>
                                        <Select
                                            value={infoForm.status || 'active'}
                                            onValueChange={(val) => setInfoForm(prev => ({ ...prev, status: val as any }))}
                                        >
                                            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="active">Идэвхтэй</SelectItem>
                                                <SelectItem value="inactive">Идэвхгүй</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-xs text-muted-foreground">Төрөл</Label>
                                        <Select
                                            value={infoForm.typeId || ''}
                                            onValueChange={(val) => setInfoForm(prev => ({ ...prev, typeId: val }))}
                                        >
                                            <SelectTrigger className="h-9"><SelectValue placeholder="Сонгох" /></SelectTrigger>
                                            <SelectContent>
                                                {departmentTypes?.map(t => (
                                                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-xs text-muted-foreground">Харьяалал</Label>
                                        <Select
                                            value={infoForm.parentId || 'root'}
                                            onValueChange={(val) => setInfoForm(prev => ({ ...prev, parentId: val === 'root' ? '' : val }))}
                                        >
                                            <SelectTrigger className="h-9"><SelectValue placeholder="Сонгох" /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="root">Үндсэн нэгж</SelectItem>
                                                {allDepartments?.filter(d => d.id !== department.id).map(d => (
                                                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                <div className="pt-3 border-t space-y-3">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-medium text-muted-foreground">Зорилго & Чиг үүрэг</span>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={handleAIGenerate}
                                            disabled={isGeneratingAI}
                                            className="h-7 gap-1.5 text-xs bg-violet-50 border-violet-200 hover:bg-violet-100 text-violet-700"
                                        >
                                            {isGeneratingAI ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                                            AI
                                        </Button>
                                    </div>
                                    <Textarea
                                        value={infoForm.vision || ''}
                                        onChange={(e) => setInfoForm(prev => ({ ...prev, vision: e.target.value }))}
                                        className="min-h-[70px] text-sm resize-none"
                                        placeholder="Зорилго..."
                                    />
                                    <Textarea
                                        value={infoForm.description || ''}
                                        onChange={(e) => setInfoForm(prev => ({ ...prev, description: e.target.value }))}
                                        className="min-h-[70px] text-sm resize-none"
                                        placeholder="Чиг үүрэг..."
                                    />
                                </div>

                                <div className="pt-3 border-t">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="w-full h-8 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                        onClick={handleDeptDeleteClick}
                                        disabled={isDeptDeleting}
                                    >
                                        {isDeptDeleting ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Trash2 className="h-3 w-3 mr-1" />}
                                        Нэгж устгах
                                    </Button>
                                </div>
                            </div>

                            <DialogFooter>
                                <Button variant="ghost" onClick={handleInfoCancel} disabled={isSavingInfo}>Болих</Button>
                                <Button onClick={handleInfoSave} disabled={isSavingInfo}>
                                    {isSavingInfo ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                                    Хадгалах
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>

                    {/* Chart & Tabs */}
                    <Tabs defaultValue="chart" className="w-full">
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                            {/* Left column: Department card */}
                            <div className="lg:col-span-3 space-y-4">
                                <div className="flex justify-center lg:justify-start overflow-visible">
                                    <DepartmentStructureCard
                                        className="w-full overflow-visible"
                                        department={{
                                            id: department.id,
                                            name: department.name,
                                            typeName,
                                            approvedCount: deptApprovedCount,
                                            unapprovedCount: deptUnapprovedCount,
                                            filled: deptFilledCount,
                                            color: department.color,
                                            status: department.status,
                                            isRoot: false,
                                        }}
                                        actionsVisibility="always"
                                        showOpenButton={false}
                                        onDepartmentUpdate={async (_id, data) => {
                                            if (!firestore || !deptDocRef) return;
                                            try {
                                                await updateDocumentNonBlocking(deptDocRef as any, data as any);
                                            } catch (e) {
                                                console.error(e);
                                            }
                                        }}
                                        topActions={
                                            <TooltipProvider delayDuration={150}>
                                                <div
                                                    ref={deptCardMenuRef}
                                                    className={cn(
                                                        'relative z-[50] overflow-visible transition-all duration-200',
                                                        deptCardMenuOpen ? 'w-[88px] h-[56px] -mt-7' : 'w-7 h-7'
                                                    )}
                                                    onMouseEnter={openDeptCardMenu}
                                                    onMouseLeave={closeDeptCardMenu}
                                                >
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className={cn(
                                                                    'h-7 w-7 rounded-full shrink-0',
                                                                    department.color ? 'hover:bg-white/20 text-current' : 'hover:bg-muted text-muted-foreground',
                                                                    deptCardMenuOpen && 'absolute right-0 bottom-0 rotate-90'
                                                                )}
                                                                style={!deptCardMenuOpen ? { position: 'relative' } : undefined}
                                                                aria-label="Үйлдлүүд"
                                                            >
                                                                <MoreVertical className="h-4 w-4" />
                                                            </Button>
                                                        </TooltipTrigger>
                                                        <TooltipContent><div className="text-xs font-semibold">Үйлдлүүд</div></TooltipContent>
                                                    </Tooltip>
                                                    {[
                                                        { angle: 90, Icon: PlusCircle, label: 'Ажлын байр нэмэх', onClick: handleAddPosition },
                                                        { angle: 150, Icon: Edit3, label: 'Засах', onClick: handleInfoEdit },
                                                    ].map(({ angle, Icon, label, onClick }, i) => {
                                                        const rad = (angle * Math.PI) / 180;
                                                        const x = Math.cos(rad) * 44;
                                                        const y = -Math.sin(rad) * 44;
                                                        return (
                                                            <Tooltip key={label}>
                                                                <TooltipTrigger asChild>
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        className={cn(
                                                                            'absolute h-9 w-9 rounded-full bg-white hover:bg-slate-50 text-slate-700 shadow-lg border border-slate-200 transition-all duration-200',
                                                                            !deptCardMenuOpen && 'pointer-events-none invisible scale-0'
                                                                        )}
                                                                        style={{
                                                                            right: 0,
                                                                            bottom: deptCardMenuOpen ? 0 : undefined,
                                                                            top: deptCardMenuOpen ? undefined : 0,
                                                                            transform: deptCardMenuOpen ? `translate(${x}px, ${y}px)` : 'translate(0,0) scale(0)',
                                                                            transitionDelay: deptCardMenuOpen ? `${i * 50}ms` : '0ms',
                                                                        }}
                                                                        onClick={(e) => { e.stopPropagation(); onClick(); setDeptCardMenuOpen(false); }}
                                                                        aria-label={label}
                                                                    >
                                                                        <Icon className="h-4 w-4" />
                                                                    </Button>
                                                                </TooltipTrigger>
                                                                <TooltipContent side="left"><div className="text-xs font-semibold">{label}</div></TooltipContent>
                                                            </Tooltip>
                                                        );
                                                    })}
                                                </div>
                                            </TooltipProvider>
                                        }
                                        details={
                                            <div className="space-y-3">
                                                <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                                                    <div>
                                                        <p className="text-[10px] font-medium opacity-70">Код</p>
                                                        <p className="text-sm font-semibold">{department.code || 'Код оноогоогүй'}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-[10px] font-medium opacity-70">Төлөв</p>
                                                        <p className="text-sm font-semibold">{department.status === 'active' ? 'Идэвхтэй' : 'Идэвхгүй'}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-[10px] font-medium opacity-70">Харьяалал</p>
                                                        <p className="text-sm font-semibold truncate">{parentName}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-[10px] font-medium opacity-70">Ажлын байр</p>
                                                        <p className="text-sm font-semibold">{positions?.length || 0}</p>
                                                    </div>
                                                </div>

                                                {(department.vision || department.description) ? (
                                                    <div className="space-y-2">
                                                        {department.vision ? (
                                                            <div className={cn("rounded-xl p-3", department.color ? "bg-white/10 border border-white/10" : "bg-slate-50 border border-slate-100")}>
                                                                <p className={cn("text-xs font-semibold mb-1.5", department.color ? "opacity-80" : "text-slate-600")}>Зорилго</p>
                                                                <p className={cn("text-sm leading-relaxed", department.color ? "opacity-90" : "text-foreground")}>{department.vision}</p>
                                                            </div>
                                                        ) : null}
                                                        {department.description ? (
                                                            <div className={cn("rounded-xl p-3", department.color ? "bg-white/10 border border-white/10" : "bg-slate-50 border border-slate-100")}>
                                                                <p className={cn("text-xs font-semibold mb-1.5", department.color ? "opacity-80" : "text-slate-600")}>Чиг үүрэг</p>
                                                                <p className={cn("text-sm leading-relaxed whitespace-pre-wrap", department.color ? "opacity-90" : "text-foreground")}>{department.description}</p>
                                                            </div>
                                                        ) : null}
                                                    </div>
                                                ) : null}
                                            </div>
                                        }
                                    />
                                </div>
                            </div>

                            {/* Right column: tab content */}
                            <div className="lg:col-span-9">
                                {/* Horizontal tab menu (stays visible) */}
                                <div className="flex items-center justify-between mb-4">
                                    <VerticalTabMenu
                                        orientation="horizontal"
                                        items={[
                                            { value: 'chart', label: 'Бүтэц зураглал' },
                                            { value: 'positions', label: 'Жагсаалт' },
                                            { value: 'history', label: 'Түүх' },
                                        ]}
                                    />
                                </div>
                                <div className="bg-transparent border-0 rounded-none">
                                    <div className="p-0 min-h-[700px]">
                                        <TabsContent value="chart" className="mt-0 focus-visible:ring-0">
                                            <div className="bg-slate-50/50 min-h-[700px] relative">
                                                <PositionStructureChart
                                                    positions={positions || []}
                                                    employees={allActiveEmployees || []}
                                                    department={department}
                                                    isLoading={isDeptLoading}
                                                    lookups={lookups}
                                                    onPositionClick={(pos) => router.push(`/dashboard/organization/positions/${pos.id}`)}
                                                    onAddChild={handleAddChild}
                                                    onDuplicate={handleDuplicate}
                                                />
                                            </div>
                                        </TabsContent>
                                        <TabsContent value="positions" className="mt-0 focus-visible:ring-0">
                                            <div className="p-4 pt-2">
                                                <PositionsManagementTab
                                                    department={department}
                                                    hideChart={true}
                                                    hideAddButton={true}
                                                    hideControls={true}
                                                    listVariant="cards"
                                                />
                                            </div>
                                        </TabsContent>
                                        <TabsContent value="history" className="mt-0 focus-visible:ring-0">
                                            <div className="p-6">
                                                <HistoryTab departmentId={department.id} />
                                            </div>
                                        </TabsContent>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </Tabs>
                </div>

                {/* Dialogs */}
                <AddPositionDialog
                    open={isAddPositionOpen}
                    onOpenChange={setIsAddPositionOpen}
                    preselectedDepartmentId={departmentId}
                    departments={allDepartments || []}
                    allPositions={positions || []}
                    positionLevels={levels || []}
                    jobCategories={categories || []}
                    employmentTypes={empTypes || []}
                    workSchedules={schedules || []}
                    parentPositionId={pendingParentPositionId}
                    onSuccess={refetchPositions}
                />

                <AlertDialog open={isDeptDeleteConfirmOpen} onOpenChange={setIsDeptDeleteConfirmOpen}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Та итгэлтэй байна уу?</AlertDialogTitle>
                            <AlertDialogDescription>
                                Та <strong>{department.name}</strong> нэгжийг устгах гэж байна.
                                Энэ үйлдэл буцаагдахгүй бөгөөд системээс бүрмөсөн устах болно.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Болих</AlertDialogCancel>
                            <AlertDialogAction onClick={handleSimpleDeptDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                Устгах
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>

                <AlertDialog open={isDisbandConfirmOpen} onOpenChange={setIsDisbandConfirmOpen}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Нэгжийг татан буулгах</AlertDialogTitle>
                            <AlertDialogDescription>
                                Та тус нэгжийг татан буулгах гэж байна. Энэ үйлдэл нь нэгж болон түүний харьяа бүх албан тушаалуудыг идэвхгүй болгож, түүхэнд хадгалах болно.
                            </AlertDialogDescription>
                            <div className="mt-4">
                                <Label htmlFor="disbandReason" className="mb-2 block">Татан буулгах шалтгаан / Тушаалын дугаар:</Label>
                                <Textarea
                                    id="disbandReason"
                                    value={disbandReason}
                                    onChange={(e) => setDisbandReason(e.target.value)}
                                    placeholder="Жишээ: ТУЗ-ийн ... тоот тушаалын дагуу"
                                />
                            </div>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel onClick={() => setDisbandReason('')}>Болих</AlertDialogCancel>
                            <AlertDialogAction onClick={handleDeptDisband} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                Татан буулгах
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>
        </div>
    );
}
