'use client';

import React, { useState, useMemo } from 'react';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MoreHorizontal, PlusCircle, Pencil, Trash2, Copy, Power, PowerOff, Sparkles, Briefcase } from 'lucide-react';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { VerticalTabMenu } from '@/components/ui/vertical-tab-menu';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useFirebase, useMemoFirebase, updateDocumentNonBlocking, addDocumentNonBlocking, tenantDoc, useTenantWrite } from '@/firebase';
import { collection, doc } from 'firebase/firestore';
import { generateNextPositionCode } from '@/lib/code-generator';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipProvider, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

import { AddPositionDialog } from '../../add-position-dialog';
import { StructureConfigDialog } from '../../structure-config-dialog';
import { Department, DepartmentType, Position, PositionLevel, EmploymentType, JobCategory, WorkSchedule } from '../../types';
import { OrganizationFilters } from '@/hooks/use-organization-filters';
import { EmptyState } from '@/components/organization/empty-state';

interface PositionsTabProps {
    departmentTypes: DepartmentType[] | null;
    positions: Position[] | null;
    departments: Department[] | null;
    levels: PositionLevel[] | null;
    employmentTypes: EmploymentType[] | null;
    jobCategories: JobCategory[] | null;
    workSchedules: WorkSchedule[] | null;
    filters: OrganizationFilters;
    onAddPosition: () => void;
    onClearFilters: () => void;
}

export const PositionsTab = ({
    departmentTypes,
    positions,
    departments,
    levels,
    employmentTypes,
    jobCategories,
    workSchedules,
    filters,
    onAddPosition,
    onClearFilters
}: PositionsTabProps) => {
    const { firestore } = useFirebase();
    const { tDoc, tCollection } = useTenantWrite();
    const { toast } = useToast();
    const [activePositionsCount, setActivePositionsCount] = useState(0);
    const [inactivePositionsCount, setInactivePositionsCount] = useState(0);
    const [currentTab, setCurrentTab] = useState<'active' | 'inactive'>('active');

    // Local state for Editing
    const [isEditPositionOpen, setIsEditPositionOpen] = useState(false);
    const [editingPosition, setEditingPosition] = useState<Position | null>(null);

    const isLoading = !positions || !departments || !levels || !employmentTypes || !jobCategories || !workSchedules;

    const { activePositions, inactivePositions } = useMemo(() => {
        if (!positions) {
            return { activePositions: [], inactivePositions: [] };
        }

        // Apply Filters
        const filtered = positions.filter(pos => {
            // Search filter
            if (filters.search) {
                const searchLower = filters.search.toLowerCase();
                const matchesName = pos.title.toLowerCase().includes(searchLower);
                if (!matchesName) return false;
            }

            // Department filter
            if (filters.departments.length > 0 && !filters.departments.includes(pos.departmentId)) {
                return false;
            }

            // Level filter
            if (filters.levels.length > 0 && (!pos.levelId || !filters.levels.includes(pos.levelId))) {
                return false;
            }

            // Employment Type filter
            if (filters.employmentTypes.length > 0 && (!pos.employmentTypeId || !filters.employmentTypes.includes(pos.employmentTypeId))) {
                return false;
            }

            // Status filter is handled by the tab split, but we can double check if needed,
            // though usually 'status' filter might overlap with the tabs.
            // For now, let's respect the tabs (active/inactive) split primarily,
            // AND the filter from the bar if it filters specifically for active/inactive.
            if (filters.statuses.length > 0) {
                const isActive = pos.isActive !== false;
                const statusStr = isActive ? 'active' : 'inactive';
                if (!filters.statuses.includes(statusStr)) {
                    return false;
                }
            }

            return true;
        });

        const active = filtered.filter(p => p.isActive !== false);
        const inactive = filtered.filter(p => p.isActive === false);
        return { activePositions: active, inactivePositions: inactive };
    }, [positions, filters]);

    const lookups = useMemo(() => {
        const departmentMap = departments?.reduce((acc, dept) => { acc[dept.id] = dept.name; return acc; }, {} as Record<string, string>) || {};
        const levelMap = levels?.reduce((acc, level) => { acc[level.id] = level.name; return acc; }, {} as Record<string, string>) || {};
        const empTypeMap = employmentTypes?.reduce((acc, type) => { acc[type.id] = type.name; return acc; }, {} as Record<string, string>) || {};
        const jobCategoryMap = jobCategories?.reduce((acc, cat) => { acc[cat.id] = `${cat.code} - ${cat.name}`; return acc; }, {} as Record<string, string>) || {};
        return { departmentMap, levelMap, empTypeMap, jobCategoryMap };
    }, [departments, levels, employmentTypes, jobCategories]);

    const handleOpenAddDialog = () => {
        onAddPosition();
    };

    const handleOpenEditDialog = (position: Position) => {
        setEditingPosition(position);
        setIsEditPositionOpen(true);
    };

    const handleToggleActive = (pos: Position) => {
        if (!firestore) return;
        const docRef = tDoc('positions', pos.id);
        updateDocumentNonBlocking(docRef, { isActive: false });
        toast({
            title: 'Амжилттай идэвхгүй боллоо.',
            description: `"${pos.title}" ажлын байр идэвхгүй төлөвт шилжлээ.`,
        });
    };

    const handleReactivate = (pos: Position) => {
        if (!firestore) return;
        const docRef = tDoc('positions', pos.id);
        updateDocumentNonBlocking(docRef, { isActive: true });
        toast({
            title: 'Амжилттай идэвхжүүллээ.',
            description: `"${pos.title}" ажлын байр идэвхтэй төлөвт шилжлээ.`,
        });
    }

    const posCodeConfigRef = useMemoFirebase(
        ({ firestore, companyPath }) => (firestore ? tenantDoc(firestore, companyPath, 'company', 'positionCodeConfig') : null),
        []
    );

    const handleDuplicatePosition = async (pos: Position) => {
        if (!firestore || !posCodeConfigRef) return;

        const {
            id,
            filled,
            code: _code,
            approvalHistory: _history,
            approvedAt: _approvedAt,
            approvedBy: _approvedBy,
            disapprovedAt: _disapprovedAt,
            disapprovedBy: _disapprovedBy,
            ...clonedData
        } = pos as any;
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
                code: newCode,
                title: `${pos.title} (Хуулбар)`,
                filled: 0,
                isActive: true,
                isApproved: false,
                createdAt: new Date().toISOString(),
            };
            addDocumentNonBlocking(tCollection('positions'), newPositionData);
            toast({
                title: "Амжилттай хувиллаа",
                description: `"${pos.title}" ажлын байрыг хувилж, "${newPositionData.title}"-г үүсгэлээ.`,
            });
        } catch (e) {
            console.error('Хуулбарлах алдаа:', e);
            toast({ variant: 'destructive', title: 'Код үүсгэхэд алдаа гарлаа' });
        }
    };

    return (
        <div className="space-y-6">
            {/* Dialog for Editing Only (Adding is handled by parent/QuickActions) */}
            <AddPositionDialog
                open={isEditPositionOpen}
                onOpenChange={setIsEditPositionOpen}
                departments={departments || []}
                allPositions={positions || []}
                positionLevels={levels || []}
                employmentTypes={employmentTypes || []}
                jobCategories={jobCategories || []}
                workSchedules={workSchedules || []}
                editingPosition={editingPosition}
            />
            <Card className="shadow-sm">
                <CardHeader className="flex-row items-center justify-between pb-4 border-b">
                    <div className="space-y-1">
                        <CardTitle>Ажлын байрны жагсаалт</CardTitle>
                        <CardDescription>
                            Байгууллагад бүртгэлтэй бүх албан тушаал.
                        </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                        <StructureConfigDialog />
                        <Button size="sm" className="gap-2" onClick={handleOpenAddDialog}>
                            <PlusCircle className="h-3.5 w-3.5" />
                            <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                                Ажлын байр нэмэх
                            </span>
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <Tabs defaultValue="active" className="w-full">
                        <div className="px-6 pt-4">
                            <VerticalTabMenu
                                orientation="horizontal"
                                items={[
                                    { value: 'active', label: 'Идэвхтэй' },
                                    { value: 'inactive', label: 'Идэвхгүй' },
                                ]}
                            />
                        </div>

                        <TabsContent value="active" className="mt-0">
                            <PositionsList
                                positions={activePositions}
                                lookups={lookups}
                                isLoading={isLoading}
                                onEdit={handleOpenEditDialog}
                                onToggleActive={handleToggleActive}
                                onReactivate={handleReactivate}
                                onDuplicate={handleDuplicatePosition}
                                onClearFilters={onClearFilters}
                            />
                        </TabsContent>
                        <TabsContent value="inactive" className="mt-0">
                            <PositionsList
                                positions={inactivePositions}
                                lookups={lookups}
                                isLoading={isLoading}
                                onEdit={handleOpenEditDialog}
                                onToggleActive={handleToggleActive}
                                onReactivate={handleReactivate}
                                onDuplicate={handleDuplicatePosition}
                                onClearFilters={onClearFilters}
                            />
                        </TabsContent>
                    </Tabs>
                </CardContent>
            </Card>
        </div>
    );
};

const PositionsList = ({ positions, lookups, isLoading, onEdit, onToggleActive, onReactivate, onDuplicate, onClearFilters }: { positions: Position[] | null, lookups: any, isLoading: boolean, onEdit: (pos: Position) => void, onToggleActive: (pos: Position) => void, onReactivate: (pos: Position) => void, onDuplicate: (pos: Position) => void, onClearFilters: () => void }) => {
    return (
        <Table>
            <TableHeader>
                <TableRow className="hover:bg-transparent">
                    <TableHead className="pl-6">Албан тушаалын нэр</TableHead>
                    <TableHead>Хэлтэс</TableHead>
                    <TableHead>Зэрэглэл</TableHead>
                    <TableHead>Ажил эрхлэлтийн төрөл</TableHead>
                    <TableHead className="w-[100px] text-right pr-6">Үйлдэл</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {isLoading &&
                    Array.from({ length: 5 }).map((_, i) => (
                        <TableRow key={i}>
                            <TableCell className="pl-6"><Skeleton className="h-5 w-48" /></TableCell>
                            <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                            <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                            <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                            <TableCell className="text-right pr-6"><Skeleton className="ml-auto h-8 w-8" /></TableCell>
                        </TableRow>
                    ))}
                {!isLoading && positions?.map((pos) => {
                    const isActive = pos.isActive === undefined ? true : pos.isActive;
                    return (
                        <TableRow key={pos.id} className={cn(!isActive && 'text-muted-foreground')}>
                            <TableCell className="font-medium pl-6">
                                <div className="flex flex-col">
                                    <div className="flex items-center gap-2">
                                        {pos.title}
                                        {pos.hasPointBudget && (
                                            <TooltipProvider>
                                                <Tooltip>
                                                    <TooltipTrigger>
                                                        <Sparkles className="h-3.5 w-3.5 text-yellow-500" />
                                                    </TooltipTrigger>
                                                    <TooltipContent>Онооны төсөвтэй</TooltipContent>
                                                </Tooltip>
                                            </TooltipProvider>
                                        )}
                                    </div>
                                    {pos.hasPointBudget && (
                                        <div className="flex items-center gap-1.5 mt-0.5">
                                            <div className="h-1 w-20 bg-muted rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-yellow-400"
                                                    style={{ width: `${Math.min(100, ((pos.remainingPointBudget ?? 0) / (pos.yearlyPointBudget ?? 1)) * 100)}%` }}
                                                />
                                            </div>
                                            <span className="text-[10px] text-muted-foreground font-medium">
                                                {(pos.remainingPointBudget ?? 0).toLocaleString()} / {(pos.yearlyPointBudget ?? 0).toLocaleString()}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </TableCell>
                            <TableCell>
                                {lookups.departmentMap[pos.departmentId] || 'Тодорхойгүй'}
                            </TableCell>
                            <TableCell>
                                {pos.levelId ? <Badge variant="secondary">{lookups.levelMap[pos.levelId] || 'Тодорхойгүй'}</Badge> : '-'}
                            </TableCell>
                            <TableCell>
                                {pos.employmentTypeId ? <Badge variant="outline">{lookups.empTypeMap[pos.employmentTypeId] || 'Тодорхойгүй'}</Badge> : '-'}
                            </TableCell>
                            <TableCell className="text-right pr-6">
                                <AlertDialog>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-8 w-8">
                                                <MoreHorizontal className="h-4 w-4" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuItem onClick={() => onEdit(pos)}>
                                                <Pencil className="mr-2 h-4 w-4" /> Засах
                                            </DropdownMenuItem>
                                            <AlertDialogTrigger asChild>
                                                <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                                    <Copy className="mr-2 h-4 w-4" /> Хувилах
                                                </DropdownMenuItem>
                                            </AlertDialogTrigger>
                                            <DropdownMenuSeparator />
                                            {isActive ? (
                                                <DropdownMenuItem onClick={() => onToggleActive(pos)} className="text-destructive">
                                                    <PowerOff className="mr-2 h-4 w-4" /> Идэвхгүй болгох
                                                </DropdownMenuItem>
                                            ) : (
                                                <DropdownMenuItem onClick={() => onReactivate(pos)} className="text-green-600 focus:text-green-700">
                                                    <Power className="mr-2 h-4 w-4" /> Идэвхжүүлэх
                                                </DropdownMenuItem>
                                            )}
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>Ажлын байр хувилах</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                Та "{pos.title}" ажлын байрыг хувилахдаа итгэлтэй байна уу? Шинэ ажлын байр нь ижил мэдээлэлтэй боловч ажилтан томилогдоогүйгээр үүснэ.
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>Цуцлах</AlertDialogCancel>
                                            <AlertDialogAction onClick={() => onDuplicate(pos)}>Тийм, хувилах</AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            </TableCell>
                        </TableRow>
                    )
                })}
                {!isLoading && !positions?.length && (
                    <TableRow>
                        <TableCell colSpan={5} className="p-0">
                            <EmptyState
                                icon={Briefcase}
                                title="Ажлын байр олдсонгүй"
                                description="Хайлт болон шүүлтэд тохирох ажлын байр олдсонгүй, эсвэл бүртгэгдээгүй байна."
                                className="py-12"
                                action={{
                                    label: "Шүүлтүүдийг цэвэрлэх",
                                    onClick: onClearFilters
                                }}
                            />
                        </TableCell>
                    </TableRow>
                )}
            </TableBody>
        </Table>
    )
}
