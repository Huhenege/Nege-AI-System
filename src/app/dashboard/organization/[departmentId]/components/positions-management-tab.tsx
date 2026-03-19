'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { PlusCircle, LayoutList, Network, CheckCircle, CheckCircle2, XCircle, History as HistoryIcon, Loader2, Sparkles, Calendar as CalendarIcon, Info, Briefcase, Trash2, AlertTriangle, Save } from 'lucide-react';
import { useFirebase, useCollection, useMemoFirebase, tenantCollection, tenantDoc, useTenantWrite } from '@/firebase';
import { collection, doc, query, where, getDocs, orderBy, limit, writeBatch, getDoc, arrayUnion, addDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { addDepartmentHistoryEvent } from '../../department-history-log';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { mn } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { Department, Position, PositionLevel, EmploymentType, JobCategory, WorkSchedule, DepartmentHistory, DepartmentType } from '../../types';
import { PositionsListTable } from '../../components/positions-list-table';
import { AddPositionDialog } from '../../add-position-dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Tabs } from '@/components/ui/tabs';
import { VerticalTabMenu } from '@/components/ui/vertical-tab-menu';
import { motion, AnimatePresence } from 'framer-motion';
import { SettingsTab } from './settings-tab';
import { PositionStructureChart } from './position-structure-chart';

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
import { Badge } from '@/components/ui/badge';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import { generateNextPositionCode } from '@/lib/code-generator';

interface PositionsManagementTabProps {
    department: Department;
    hideChart?: boolean;
    hideAddButton?: boolean;
    /** Hide the internal top control bar (used when page provides its own tabs/controls) */
    hideControls?: boolean;
    /** Render list as table or card list */
    listVariant?: 'table' | 'cards';
    // We can pass lookup data here or fetch internally. Fetching internally within the tab allows this tab to be self-contained.
    // However, for performance, common lookups like Levels/Types might be better passed down if reused.
    // For now, let's fetch strictly needed data here.
}

export const PositionsManagementTab = ({ department, hideChart, hideAddButton, hideControls, listVariant = 'table' }: PositionsManagementTabProps) => {
    const { firestore, user } = useFirebase();
    const { tDoc, tCollection, companyPath } = useTenantWrite();
    const { toast } = useToast();
    const router = useRouter();
    const [isAddPositionOpen, setIsAddPositionOpen] = useState(false);
    const [editingPosition, setEditingPosition] = useState<Position | null>(null);
    const [viewMode, setViewMode] = useState<'list' | 'chart'>(hideChart ? 'list' : 'chart');
    const [selectedPositionIds, setSelectedPositionIds] = useState<string[]>([]);
    // SettingTab is used instead of inline editing logic

    const [isDisapproveConfirmOpen, setIsDisapproveConfirmOpen] = useState(false);
    const [approvalNote, setApprovalNote] = useState('');
    const [disapproveNote, setDisapproveNote] = useState('');
    const [approvalDate, setApprovalDate] = useState<Date>(new Date());
    const [disapproveDate, setDisapproveDate] = useState<Date>(new Date());

    // -- Queries --
    // 1. Positions for THIS department only
    const positionsQuery = useMemoFirebase(({ firestore, companyPath }) => {
        if (!firestore || !department?.id) return null;
        return query(tenantCollection(firestore, companyPath, 'positions'), where('departmentId', '==', department.id));
    }, [firestore, department?.id]);

    // 2. Lookups (Cached by `useCollection` usually if keys match, but fetching fresh is safer for now)
    const levelsQuery = useMemoFirebase(({ firestore, companyPath }) => (firestore ? tenantCollection(firestore, companyPath, 'positionLevels') : null), [firestore]);
    const empTypesQuery = useMemoFirebase(({ firestore, companyPath }) => (firestore ? tenantCollection(firestore, companyPath, 'employmentTypes') : null), [firestore]);
    const departmentsQuery = useMemoFirebase(({ firestore, companyPath }) => (firestore ? tenantCollection(firestore, companyPath, 'departments') : null), [firestore]); // Needed mainly for dropdowns in dialog
    const jobCategoriesQuery = useMemoFirebase(({ firestore, companyPath }) => (firestore ? tenantCollection(firestore, companyPath, 'jobCategories') : null), [firestore]);
    const workSchedulesQuery = useMemoFirebase(({ firestore, companyPath }) => (firestore ? tenantCollection(firestore, companyPath, 'workSchedules') : null), [firestore]);
    const deptTypesQuery = useMemoFirebase(({ firestore, companyPath }) => (firestore ? tenantCollection(firestore, companyPath, 'departmentTypes') : null), [firestore]);



    const employeesQuery = useMemoFirebase(({ firestore, companyPath }) => {
        if (!firestore || !department?.id) return null;
        return query(tenantCollection(firestore, companyPath, 'employees'), where('departmentId', '==', department.id));
    }, [firestore, department?.id]);

    const { data: positions, isLoading: isPositionsLoading } = useCollection<Position>(positionsQuery);
    const { data: employees } = useCollection<any>(employeesQuery);
    const { data: levels } = useCollection<PositionLevel>(levelsQuery);
    const { data: empTypes } = useCollection<EmploymentType>(empTypesQuery);
    const { data: allDepartments } = useCollection<Department>(departmentsQuery);
    const { data: jobCategories } = useCollection<JobCategory>(jobCategoriesQuery);
    const { data: workSchedules } = useCollection<WorkSchedule>(workSchedulesQuery);
    const { data: departmentTypes } = useCollection<DepartmentType>(deptTypesQuery);

    const [isApproveConfirmOpen, setIsApproveConfirmOpen] = useState(false);
    const [isApproving, setIsApproving] = useState(false);

    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    const [isDeptDeleting, setIsDeptDeleting] = useState(false);
    const [isDeptDeleteConfirmOpen, setIsDeptDeleteConfirmOpen] = useState(false);
    const [isDisbandConfirmOpen, setIsDisbandConfirmOpen] = useState(false);
    const [isPosDisbandConfirmOpen, setIsPosDisbandConfirmOpen] = useState(false);
    const [disbandPosition, setDisbandPosition] = useState<Position | null>(null);
    const [disbandReason, setDisbandReason] = useState('');

    const isLoading = isPositionsLoading || !levels || !empTypes;

    const stats = useMemo(() => {
        if (!positions) return { total: 0, approved: 0, pending: 0 };
        const total = positions.length;
        const approved = positions.filter(p => p.isApproved === true).length;
        const pending = total - approved;
        return { total, approved, pending };
    }, [positions]);

    const lookups = useMemo(() => {
        const departmentMap = allDepartments?.reduce((acc, d) => { acc[d.id] = d.name; return acc; }, {} as Record<string, string>) || { [department.id]: department.name };
        const departmentColorMap = allDepartments?.reduce((acc, d) => {
            if (d.color) acc[d.id] = d.color;
            return acc;
        }, {} as Record<string, string>) || {};
        const levelMap = levels?.reduce((acc, level) => { acc[level.id] = level.name; return acc; }, {} as Record<string, string>) || {};
        const empTypeMap = empTypes?.reduce((acc, type) => { acc[type.id] = type.name; return acc; }, {} as Record<string, string>) || {};
        const jobCategoryMap = jobCategories?.reduce((acc, cat) => { acc[cat.id] = `${cat.code} - ${cat.name}`; return acc; }, {} as Record<string, string>) || {};
        const typeName = departmentTypes?.find(t => t.id === department.typeId)?.name || department.typeName || 'Нэгж';
        return { departmentMap, departmentColorMap, levelMap, empTypeMap, jobCategoryMap, typeName, departmentColor: department.color };
    }, [department, levels, empTypes, allDepartments, jobCategories, departmentTypes]);

    const validationChecklist = useMemo(() => {
        const dept = department;
        const checks = {
            hasName: !!dept.name?.trim(),
            hasCode: !!dept.code?.trim(),
            hasVision: !!dept.vision?.trim(),
            hasDescription: !!dept.description?.trim(),
            hasType: !!dept.typeId,
            hasPositions: (positions?.length || 0) > 0,
            allPositionsApproved: (positions?.length || 0) > 0 && (stats.pending === 0)
        };

        const isComplete = Object.values(checks).every(Boolean);
        return { ...checks, isComplete };
    }, [department, positions, stats]);

    const completionPercentage = useMemo(() => {
        if (!validationChecklist) return 0;
        const keys = Object.keys(validationChecklist).filter(k => k !== 'isComplete');
        const total = keys.length;
        if (total === 0) return 0;
        const completed = keys.filter(k => (validationChecklist as any)[k]).length;
        return Math.round((completed / total) * 100);
    }, [validationChecklist]);

    const [pendingParentPositionId, setPendingParentPositionId] = useState<string | undefined>(undefined);

    const handleAddChildPosition = (parentId: string) => {
        setPendingParentPositionId(parentId);
        setEditingPosition(null);
        setIsAddPositionOpen(true);
    };

    const handleAddPositionWithReset = () => {
        setPendingParentPositionId(undefined);
        handleAddPosition();
    };

    const handleAddPosition = () => {
        setEditingPosition(null);
        setIsAddPositionOpen(true);
    };

    const handleEditPosition = (pos: Position) => {
        router.push(`/dashboard/organization/positions/${pos.id}`);
    };

    const handleDeletePosition = async (pos: Position) => {
        if (pos.isApproved) {
            toast({
                title: "Устгах боломжгүй",
                description: "Батлагдсан ажлын байрыг устгах боломжгүй. Эхлээд батлагдаагүй болгоно уу.",
                variant: "destructive"
            });
            return;
        }

        try {
            await deleteDoc(tDoc('positions', pos.id));
            toast({ title: "Амжилттай устгалаа", description: "Жагсаалт шинэчлэгдлээ." });
        } catch (error) {
            toast({ title: "Алдаа гарлаа", variant: "destructive", description: error instanceof Error ? error.message : undefined });
        }
    };

    const posCodeConfigRef = useMemoFirebase(
        ({ firestore, companyPath }) => (firestore ? tenantDoc(firestore, companyPath, 'company', 'positionCodeConfig') : null),
        [firestore]
    );

    const handleDuplicatePosition = async (pos: any) => {
        if (!firestore || !posCodeConfigRef || !department?.id) return;

        // Strip UI-specific fields; do not copy code — generate new unique one
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
            ...clonedData
        } = pos;

        const cleanData = Object.entries(clonedData).reduce((acc, [key, value]) => {
            if (value !== undefined && typeof value !== 'function') acc[key] = value;
            return acc;
        }, {} as any);

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
            if (department?.id && user) {
                addDepartmentHistoryEvent({
                    firestore,
                    companyPath,
                    departmentId: department.id,
                    eventType: 'position_added',
                    positionId: ref.id,
                    positionTitle: newPositionData.title,
                    performedBy: user.uid,
                    performedByName: user.displayName || user.email || 'Систем',
                }).catch(() => {});
            }
            toast({ title: "Амжилттай хувиллаа", description: "Шинэ ажлын байр жагсаалтад нэмэгдлээ." });
        } catch (e) {
            console.error('Хуулбарлах алдаа:', e);
            toast({ variant: 'destructive', title: 'Хувилах амжилтгүй', description: e instanceof Error ? e.message : 'Дахин оролдоно уу.' });
        }
    };

    const handleApproveSelected = async () => {
        if (!firestore || !positions || !user || selectedPositionIds.length === 0) return;

        // Validation Check
        const targets = positions.filter(p => selectedPositionIds.includes(p.id));
        const invalidPositions = targets.filter(pos => {
            const checks = {
                hasTitle: !!pos.title?.trim(),
                hasCode: !!pos.code?.trim(),
                hasDepartment: !!(pos.departmentId && pos.departmentId.trim()),
                hasLevel: !!pos.levelId,
                hasCategory: !!pos.jobCategoryId,
                hasEmpType: !!pos.employmentTypeId,
                hasSchedule: !!pos.workScheduleId,
                hasPurpose: !!pos.purpose?.trim(),
                hasResponsibilities: (pos.responsibilities?.length || 0) > 0,
                hasJDFile: !!pos.jobDescriptionFile?.url,
                hasSalary: !!(pos.salaryRange?.min && pos.salaryRange?.max)
            };
            return !Object.values(checks).every(Boolean);
        });

        if (invalidPositions.length > 0) {
            const names = invalidPositions.slice(0, 3).map(p => p.title || 'Нэргүй').join(', ');
            const remaining = invalidPositions.length - 3;
            const suffix = remaining > 0 ? ` ба бусад ${remaining}` : '';

            toast({
                title: "Батлах боломжгүй",
                description: `${names}${suffix} ажлын байрны мэдээлэл дутуу байна. Бүх мэдээллийг гүйцэд бөглөсний дараа батлах боломжтой.`,
                variant: "destructive"
            });
            setIsApproveConfirmOpen(false);
            return;
        }

        setIsApproving(true);
        try {
            const approvedAt = approvalDate.toISOString();
            const logEntry = {
                action: 'approve',
                userId: user.uid,
                userName: user.displayName || user.email || 'Систем',
                timestamp: approvedAt,
                note: approvalNote || 'Ажлын байрыг баталлаа'
            };

            const batch = writeBatch(firestore);
            const targets = positions.filter(p => selectedPositionIds.includes(p.id));

            targets.forEach(pos => {
                const posRef = tDoc('positions', pos.id);
                batch.update(posRef, {
                    isApproved: true,
                    isActive: true, // Батлах үед идэвхтэй болгоно
                    approvedAt,
                    approvedBy: user.uid,
                    approvedByName: user.displayName || user.email || 'Систем',
                    approvalHistory: arrayUnion(logEntry)
                });
            });

            await batch.commit();
            toast({ title: "Сонгосон ажлын байрнууд батлагдлаа" });
            setIsApproveConfirmOpen(false);
            setApprovalNote('');
            setSelectedPositionIds([]);
        } catch (error) {
            console.error("Error approving positions:", error);
            toast({ title: "Алдаа гарлаа", variant: "destructive" });
        } finally {
            setIsApproving(false);
        }
    };

    const handleBulkDisapprove = async () => {
        if (!firestore || !positions || !user) return;

        const targets = positions.filter(p => selectedPositionIds.includes(p.id) && p.isApproved !== false);

        setIsApproving(true);
        try {
            const disapprovedAt = disapproveDate.toISOString();
            const logEntry = {
                action: 'disapprove',
                userId: user.uid,
                userName: user.displayName || user.email || 'Систем',
                timestamp: disapprovedAt,
                note: disapproveNote || 'Батламжийг цуцаллаа'
            };

            const batch = writeBatch(firestore);
            targets.forEach(pos => {
                const posRef = tDoc('positions', pos.id);
                batch.update(posRef, {
                    isApproved: false,
                    isActive: false, // Цуцлах үед идэвхгүй болгоно
                    disapprovedAt,
                    disapprovedBy: user.uid,
                    disapprovedByName: user.displayName || user.email || 'Систем',
                    approvalHistory: arrayUnion(logEntry)
                });
            });
            await batch.commit();
            toast({ title: "Сонгосон ажлын байрнуудын батламжийг цуцаллаа" });
            setIsDisapproveConfirmOpen(false);
            setDisapproveNote('');
            setSelectedPositionIds([]);
        } catch (error) {
            toast({ title: "Алдаа гарлаа", variant: "destructive" });
        } finally {
            setIsApproving(false);
        }
    };



    const handleBulkDelete = async () => {
        if (!firestore || selectedPositionIds.length === 0 || !department?.id || !user) return;
        const toDelete = (positions || []).filter(p => selectedPositionIds.includes(p.id));
        setIsDeleting(true);
        try {
            const batch = writeBatch(firestore);
            selectedPositionIds.forEach(id => {
                batch.delete(tDoc('positions', id));
            });
            await batch.commit();
            for (const pos of toDelete) {
                addDepartmentHistoryEvent({
                    firestore,
                    companyPath,
                    departmentId: department.id,
                    eventType: 'position_deleted',
                    positionId: pos.id,
                    positionTitle: pos.title || '',
                    performedBy: user.uid,
                    performedByName: user.displayName || user.email || 'Систем',
                }).catch(() => {});
            }
            toast({ title: "Сонгосон ажлын байрнуудыг устгалаа" });
            setIsDeleteConfirmOpen(false);
            setSelectedPositionIds([]);
        } catch (error) {
            toast({ title: "Алдаа гарлаа", variant: "destructive" });
        } finally {
            setIsDeleting(false);
        }
    };

    const handleDeptDeleteClick = async () => {
        if (!firestore) return;
        setIsDeptDeleting(true);

        try {
            const historyRef = tCollection('departmentHistory');
            const hq = query(historyRef, where('departmentId', '==', department.id));
            const historySnapshot = await getDocs(hq);
            const hasHistory = !historySnapshot.empty;

            const positionsRef = tCollection('positions');
            const q = query(positionsRef, where('departmentId', '==', department.id));
            const snapshot = await getDocs(q);
            const hasPositions = !snapshot.empty;

            if (hasPositions && !hasHistory) {
                toast({
                    variant: "destructive",
                    title: "Устгах боломжгүй",
                    description: `Энэ нэгжид ${snapshot.size} ажлын байр бүртгэлтэй байна. Түүхгүй нэгжийг устгахын тулд эхлээд ажлын байруудыг устгах эсвэл шилжүүлэх шаардлагатай.`
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
            console.error("Error checking department constraints:", error);
            toast({ variant: "destructive", title: "Алдаа гарлаа" });
        } finally {
            setIsDeptDeleting(false);
        }
    };

    const handleSimpleDeptDelete = async () => {
        if (!firestore) return;
        setIsDeptDeleting(true);
        try {
            const batch = writeBatch(firestore);
            batch.delete(tDoc('departments', department.id));
            await batch.commit();

            toast({ title: "Нэгж амжилттай устгагдлаа" });
            router.push('/dashboard/organization');
        } catch (error) {
            console.error("Error deleting department:", error);
            toast({ variant: "destructive", title: "Алдаа гарлаа" });
            setIsDeptDeleting(false);
        }
    };

    const handleDeptDisband = async () => {
        if (!firestore) return;
        setIsDeptDeleting(true);
        try {
            const timestamp = new Date().toISOString();

            // 1. Fetch all employees in this department to include in snapshot
            const employeesRef = tCollection('employees');
            const eq = query(employeesRef, where('departmentId', '==', department.id));
            const employeeSnapshot = await getDocs(eq);
            const deptEmployees = employeeSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as any[];

            const batch = writeBatch(firestore);

            // 2. Prepare the final "Dissolution" history entry
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

            // 3. Mark existing history records as validTo = now
            const oldHistoryQuery = query(historyRef, where('departmentId', '==', department.id));
            const oldHistorySnapshot = await getDocs(oldHistoryQuery);
            oldHistorySnapshot.docs.forEach(hDoc => {
                if (!hDoc.data().validTo) {
                    batch.update(hDoc.ref, { validTo: timestamp });
                }
            });

            // 4. Delete the department and its positions
            batch.delete(tDoc('departments', department.id));

            if (positions) {
                positions.forEach(pos => {
                    batch.delete(tDoc('positions', pos.id));
                });
            }

            await batch.commit();
            toast({ title: "Нэгж амжилттай татан буугдаж, түүх хадгалагдлаа" });
            router.push('/dashboard/organization');
        } catch (error) {
            console.error("Error disbanding department:", error);
            toast({ variant: "destructive", title: "Алдаа гарлаа" });
            setIsDeptDeleting(false);
        }
    };

    const handleDisbandPosition = async () => {
        if (!firestore || !disbandPosition || !user) return;
        setIsDeleting(true);
        try {
            const timestamp = new Date().toISOString();
            const logEntry = {
                action: 'disapprove',
                userId: user.uid,
                userName: user.displayName || user.email || 'Систем',
                timestamp: timestamp,
                note: disbandReason || 'Албан тушаалыг татан буулгав'
            };

            await updateDoc(tDoc('positions', disbandPosition.id), {
                isActive: false,
                isApproved: false,
                disbandedAt: timestamp,
                disbandedBy: user.uid,
                disbandedByName: user.displayName || user.email || 'Систем',
                approvalHistory: arrayUnion(logEntry)
            });

            toast({ title: "Албан тушаал амжилттай татан буугдлаа", description: "Жагсаалт шинэчлэгдлээ." });
            setIsPosDisbandConfirmOpen(false);
            setDisbandPosition(null);
            setDisbandReason('');
        } catch (error) {
            console.error("Error disbanding position:", error);
            toast({ title: "Алдаа гарлаа", variant: "destructive" });
        } finally {
            setIsDeleting(false);
        }
    };

    const parentName = department.parentId
        ? (allDepartments?.find(d => d.id === department.parentId)?.name || 'Үндсэн нэгж')
        : 'Үндсэн нэгж';
    const typeName = departmentTypes?.find(t => t.id === department.typeId)?.name || 'Нэгж';


    const showControls = !hideControls;

    return (
        <div className={cn('space-y-4', showControls && 'space-y-6')}>
            {showControls && (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-2 border-b border-border/50">
                    <div className="flex items-center gap-3">
                        <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as any)} className="w-auto">
                            {!hideChart && (
                                <VerticalTabMenu
                                    orientation="horizontal"
                                    items={[
                                        { value: 'chart', label: 'Зураглал' },
                                        { value: 'list', label: 'Жагсаалт' },
                                    ]}
                                />
                            )}
                        </Tabs>
                    </div>

                    {!hideAddButton && (
                        <Button
                            variant="default"
                            size="sm"
                            className="h-9 rounded-xl font-bold gap-2 px-6 shadow-sm"
                            onClick={handleAddPositionWithReset}
                        >
                            <PlusCircle className="h-4 w-4" />
                            Ажлын байр нэмэх
                        </Button>
                    )}
                </div>
            )}

            {viewMode === 'chart' ? (
                <PositionStructureChart
                    positions={positions || []}
                    employees={employees || []}
                    department={department}
                    isLoading={isLoading}
                    onPositionClick={handleEditPosition}
                    onAddChild={handleAddChildPosition}
                    onDuplicate={handleDuplicatePosition}
                    lookups={lookups}
                />
            ) : listVariant === 'cards' ? (
                <PositionsListTable
                    variant="cards"
                    positions={positions || []}
                    lookups={lookups}
                    isLoading={isLoading}
                    selectedIds={selectedPositionIds}
                    onSelectionChange={setSelectedPositionIds}
                    onEdit={handleEditPosition}
                    onDelete={handleDeletePosition}
                    onDisband={(pos) => {
                        setDisbandPosition(pos);
                        setIsPosDisbandConfirmOpen(true);
                    }}
                    onDuplicate={handleDuplicatePosition}
                />
            ) : (
                <Card className="border-none shadow-xl shadow-slate-200/40 ring-1 ring-slate-200/50 overflow-hidden">
                    <PositionsListTable
                        positions={positions || []}
                        lookups={lookups}
                        isLoading={isLoading}
                        selectedIds={selectedPositionIds}
                        onSelectionChange={setSelectedPositionIds}
                        onEdit={handleEditPosition}
                        onDelete={handleDeletePosition}
                        onDisband={(pos) => {
                            setDisbandPosition(pos);
                            setIsPosDisbandConfirmOpen(true);
                        }}
                        onDuplicate={handleDuplicatePosition}
                    />
                </Card>
            )}


            <AlertDialog open={isApproveConfirmOpen} onOpenChange={setIsApproveConfirmOpen}>
                <AlertDialogContent className="sm:max-w-[500px]">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2 text-emerald-600">
                            <CheckCircle className="h-5 w-5" />
                            {selectedPositionIds.length > 0 ? 'Ажлын байр баталгаажуулах' : 'Бүтэц баталгаажуулах'}
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-slate-600" asChild>
                            <div>
                                {selectedPositionIds.length === 0 && stats.pending > 0 ? (
                                    <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-[11px] font-medium mb-2 flex items-start gap-2">
                                        <Info className="w-4 h-4 mt-0.5 shrink-0" />
                                        <span>Анхааруулга: {stats.pending} ажлын байр батлагдаагүй байна. Бүтцийг батлахын тулд бүх ажлын байрнууд батлагдсан байх ёстой.</span>
                                    </div>
                                ) : (
                                    <span>
                                        {selectedPositionIds.length > 0
                                            ? `Сонгосон ${selectedPositionIds.length} ажлын байрыг батлахдаа итгэлтэй байна уу?`
                                            : "Ажлын байрны бүтцийг баталснаар орон тоо албан ёсоор бүртгэгдэж, түүхэнд хадгалагдана."
                                        }
                                    </span>
                                )}
                            </div>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="py-4 space-y-4">
                        <div className="space-y-2">
                            <Label className="text-[11px] font-semibold uppercase text-slate-500 tracking-wider">Батлах огноо (Тушаалын огноо)</Label>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        className={cn(
                                            "w-full justify-start text-left font-normal h-11 rounded-xl border-slate-200",
                                            !approvalDate && "text-muted-foreground"
                                        )}
                                    >
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {approvalDate ? format(approvalDate, "yyyy оны MM сарын dd", { locale: mn }) : <span>Огноо сонгох</span>}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar
                                        mode="single"
                                        selected={approvalDate}
                                        onSelect={(date) => date && setApprovalDate(date)}
                                        initialFocus
                                    />
                                </PopoverContent>
                            </Popover>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-[11px] font-semibold uppercase text-slate-500 tracking-wider">Тэмдэглэл (Сонголттой)</Label>
                            <Textarea
                                placeholder="Батлахтай холбоотой тайлбар оруулна уу..."
                                value={approvalNote}
                                onChange={(e) => setApprovalNote(e.target.value)}
                                className="min-h-[100px] rounded-xl border-slate-200 resize-none focus:ring-primary"
                            />
                        </div>
                    </div>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => {
                            setApprovalNote('');
                            setApprovalDate(new Date());
                        }}>Цуцлах</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={(e) => {
                                e.preventDefault();
                                handleApproveSelected();
                            }}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold h-10 px-6 rounded-xl transition-all"
                            disabled={isApproving}
                        >
                            {isApproving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-2" />}
                            Ажлын байр батлах
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog open={isDisapproveConfirmOpen} onOpenChange={setIsDisapproveConfirmOpen}>
                <AlertDialogContent className="sm:max-w-[500px]">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2 text-amber-600">
                            <HistoryIcon className="h-5 w-5" />
                            Батламж цуцлахыг баталгаажуулах
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-slate-600">
                            Сонгосон ажлын байрнуудын батламжийг цуцалснаар эдгээр нь "Батлагдаагүй" төлөвт шилжинэ.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="py-4 space-y-4">
                        <div className="space-y-2">
                            <Label className="text-sm font-medium">Цуцлах огноо (Тушаалын огноо)</Label>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        className={cn(
                                            "w-full pl-3 text-left font-normal h-10 border-slate-200",
                                            !disapproveDate && "text-muted-foreground"
                                        )}
                                    >
                                        {disapproveDate ? (
                                            format(disapproveDate, "yyyy оны MM сарын dd", { locale: mn })
                                        ) : (
                                            <span>Огноо сонгох</span>
                                        )}
                                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar
                                        mode="single"
                                        selected={disapproveDate}
                                        onSelect={(date) => date && setDisapproveDate(date)}
                                        disabled={(date) => date > new Date()}
                                        initialFocus
                                    />
                                </PopoverContent>
                            </Popover>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="disapprove-note" className="text-sm font-medium">Цуцлах шалтгаан (заавал биш)</Label>
                            <Textarea
                                id="disapprove-note"
                                placeholder="Шалтгаан эсвэл нэмэлт тайлбар..."
                                value={disapproveNote}
                                onChange={(e) => setDisapproveNote(e.target.value)}
                                className="min-h-[100px] resize-none border-slate-200 focus:border-amber-500 focus:ring-amber-500"
                            />
                        </div>
                    </div>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => {
                            setDisapproveNote('');
                            setDisapproveDate(new Date());
                        }}>Цуцлах</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={(e) => {
                                e.preventDefault();
                                handleBulkDisapprove();
                            }}
                            variant="warning"
                            disabled={isApproving}
                        >
                            {isApproving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <HistoryIcon className="w-4 h-4" />}
                            Батламж цуцлах
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>


            {
                selectedPositionIds.length > 0 && (
                    <div className="flex items-center justify-between p-4 bg-primary/5 border border-primary/10 rounded-xl animate-in fade-in slide-in-from-top-2">
                        <div className="flex items-center gap-3">
                            <span className="text-sm font-semibold text-primary">{selectedPositionIds.length} ширхэг сонгосон</span>
                            <Button variant="ghost" size="sm" onClick={() => setSelectedPositionIds([])} className="h-8 text-[11px]">Сонголтыг цэвэрлэх</Button>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="success"
                                size="sm"
                                className="h-9 px-4"
                                onClick={() => setIsApproveConfirmOpen(true)}
                                disabled={isApproving}
                            >
                                {isApproving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                                Батлах
                            </Button>
                            <Button
                                variant="warning"
                                size="sm"
                                className="h-9 px-4"
                                onClick={() => setIsDisapproveConfirmOpen(true)}
                                disabled={isApproving}
                            >
                                <XCircle className="w-4 h-4" />
                                Цуцлах
                            </Button>
                            <Button
                                variant="destructive"
                                size="sm"
                                className="h-9 px-4"
                                onClick={() => setIsDeleteConfirmOpen(true)}
                                disabled={isDeleting}
                            >
                                {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                                Устгах
                            </Button>
                        </div>
                    </div>
                )
            }

            <AddPositionDialog
                open={isAddPositionOpen}
                onOpenChange={setIsAddPositionOpen}
                departments={allDepartments || [department]}
                allPositions={positions || []}
                positionLevels={levels || []}
                employmentTypes={empTypes || []}
                jobCategories={jobCategories || []}
                workSchedules={workSchedules || []}
                editingPosition={editingPosition}
                preselectedDepartmentId={department.id}
                parentPositionId={pendingParentPositionId}
                initialMode={pendingParentPositionId ? 'quick' : 'full'}
            />
            <AlertDialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Устгахдаа итгэлтэй байна уу?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Сонгосон {selectedPositionIds.length} ажлын байрыг устгах гэж байна. Энэ үйлдлийг буцаах боломжгүй.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Болих</AlertDialogCancel>
                        <AlertDialogAction variant="destructive" onClick={handleBulkDelete}>
                            Тийм, устгах
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>



            {/* Department Deletion Dialogs */}
            <AlertDialog open={isDeptDeleteConfirmOpen} onOpenChange={setIsDeptDeleteConfirmOpen}>
                <AlertDialogContent className="rounded-2xl border-none shadow-2xl">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-xl font-bold">Нэгжийг устгах уу?</AlertDialogTitle>
                        <AlertDialogDescription className="text-sm font-medium">
                            Энэ нэгж нь батлагдсан түүхгүй тул шууд устгах боломжтой. Энэ үйлдлийг буцаах боломжгүй.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="gap-2">
                        <AlertDialogCancel className="font-bold rounded-xl border-none bg-muted hover:bg-muted/80">Болих</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleSimpleDeptDelete}
                            className="bg-destructive hover:bg-destructive/90 font-bold rounded-xl shadow-lg shadow-destructive/20"
                            disabled={isDeptDeleting}
                        >
                            {isDeptDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Устгах'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <Dialog open={isDisbandConfirmOpen} onOpenChange={setIsDisbandConfirmOpen}>
                <DialogContent className="sm:max-w-[500px] border-none shadow-2xl rounded-2xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-destructive font-bold text-xl">
                            <AlertTriangle className="w-6 h-6" />
                            Нэгжийг татан буулгах
                        </DialogTitle>
                        <DialogDescription className="font-medium text-slate-500 pt-2">
                            Энэ нэгж нь өмнө нь батлагдсан түүхтэй тул "Татан буулгах" бүртгэл үүсгэж хаах шаардлагатай.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-6">
                        <div className="space-y-2">
                            <Label className="font-bold text-xs uppercase tracking-wider text-slate-400">Татан буулгах шалтгаан / Тушаалын дугаар</Label>
                            <Textarea
                                placeholder="Жишээ: Гүйцэтгэх захирлын тушаал №..."
                                value={disbandReason}
                                onChange={(e) => setDisbandReason(e.target.value)}
                                className="min-h-[120px] rounded-xl bg-muted/30 border-none focus-visible:ring-primary/20"
                            />
                        </div>
                        <div className="rounded-xl bg-amber-50 border border-amber-100 p-4 text-[11px] text-amber-900 leading-relaxed font-medium">
                            <strong className="block mb-1">Анхааруулга:</strong>
                            Татан буулгаснаар энэ нэгжийн түүх архивлагдаж, идэвхтэй бүтцээс хасагдана. Доторх бүх идэвхтэй ажлын байрууд мөн архивлагдах болно.
                        </div>
                    </div>

                    <DialogFooter className="gap-2">
                        <Button variant="outline" className="font-bold rounded-xl border-none bg-muted hover:bg-muted/80" onClick={() => setIsDisbandConfirmOpen(false)}>Болих</Button>
                        <Button
                            variant="destructive"
                            onClick={handleDeptDisband}
                            className="font-bold rounded-xl shadow-lg shadow-destructive/20"
                            disabled={isDeptDeleting || !disbandReason.trim()}
                        >
                            {isDeptDeleting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
                            Татан буулгах
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isPosDisbandConfirmOpen} onOpenChange={setIsPosDisbandConfirmOpen}>
                <DialogContent className="sm:max-w-[500px] border-none shadow-2xl rounded-2xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-destructive font-bold text-xl">
                            <AlertTriangle className="w-6 h-6" />
                            Ажлын байр татан буулгах
                        </DialogTitle>
                        <DialogDescription className="font-medium text-slate-500 pt-2">
                            "{disbandPosition?.title}" ажлын байрыг татан буулгаж, идэвхгүй төлөвт шилжүүлэх гэж байна.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-6">
                        <div className="space-y-2">
                            <Label className="font-bold text-xs uppercase tracking-wider text-slate-400">Татан буулгах шалтгаан / Тушаалын дугаар</Label>
                            <Textarea
                                placeholder="Жишээ: Гүйцэтгэх захирлын тушаал №..."
                                value={disbandReason}
                                onChange={(e) => setDisbandReason(e.target.value)}
                                className="min-h-[120px] rounded-xl bg-muted/30 border-none focus-visible:ring-primary/20"
                            />
                        </div>
                        <div className="rounded-xl bg-amber-50 border border-amber-100 p-4 text-[11px] text-amber-900 leading-relaxed font-medium">
                            <strong className="block mb-1">Мэдээлэл:</strong>
                            Ажлын байрыг татан буулгаснаар тухайн ажлын байр идэвхгүй болж, бүтэц дээр харагдахаа болино. Түүхэн мэдээлэл хэвээр үлдэнэ.
                        </div>
                    </div>

                    <DialogFooter className="gap-2">
                        <Button variant="outline" className="font-bold rounded-xl border-none bg-muted hover:bg-muted/80" onClick={() => { setIsPosDisbandConfirmOpen(false); setDisbandPosition(null); }}>Болих</Button>
                        <Button
                            variant="destructive"
                            onClick={handleDisbandPosition}
                            className="font-bold rounded-xl shadow-lg shadow-destructive/20"
                            disabled={isDeleting || !disbandReason.trim()}
                        >
                            {isDeleting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
                            Татан буулгах
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};
