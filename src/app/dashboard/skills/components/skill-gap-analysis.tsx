// src/app/dashboard/skills/components/skill-gap-analysis.tsx
'use client';

import React, { useState, useMemo } from 'react';
import { doc } from 'firebase/firestore';
import { useFirebase, useDoc, addDocumentNonBlocking, useTenantWrite } from '@/firebase';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/patterns/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { BarChart3, ClipboardCheck, UserSearch, Building2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Employee, Department, isActiveStatus } from '@/types';
import { Position } from '@/app/dashboard/organization/types';
import { SkillGapCard } from '@/app/dashboard/training/components/skill-gap-card';
import { AssessSkillDialog } from '@/app/dashboard/training/components/assess-skill-dialog';
import {
    computeSkillGaps,
    SKILL_LEVEL_LABELS,
    SKILL_LEVEL_VALUE,
} from '../types';
import type { SkillAssessment, SkillLevel, SkillGap, AssessmentSource } from '../types';

interface SkillGapAnalysisProps {
    employees: Employee[];
    positions: Position[];
    departments: Department[];
    assessments: SkillAssessment[];
    isLoading: boolean;
}

export function SkillGapAnalysis({
    employees,
    positions,
    departments,
    assessments,
    isLoading,
}: SkillGapAnalysisProps) {
    const { firestore, user } = useFirebase();
    const { tCollection } = useTenantWrite();
    const { toast } = useToast();
    const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
    const [viewMode, setViewMode] = useState<'employee' | 'department'>('employee');
    const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>('all');
    const [assessDialogOpen, setAssessDialogOpen] = useState(false);
    const [preSelectedSkill, setPreSelectedSkill] = useState<string>('');

    const activeEmployees = useMemo(() =>
        employees.filter(e => isActiveStatus(e.status)),
        [employees]
    );

    const positionMap = useMemo(() =>
        new Map(positions.map(p => [p.id, p])),
        [positions]
    );

    const departmentMap = useMemo(() =>
        new Map(departments.map(d => [d.id, d])),
        [departments]
    );

    const selectedEmployee = useMemo(() =>
        activeEmployees.find(e => e.id === selectedEmployeeId),
        [activeEmployees, selectedEmployeeId]
    );

    // Fetch position for selected employee
    const positionRef = useMemo(() => {
        if (!firestore || !selectedEmployee?.positionId) return null;
        return doc(firestore, 'positions', selectedEmployee.positionId);
    }, [firestore, selectedEmployee?.positionId]);

    const { data: position, isLoading: positionLoading } = useDoc<Position>(positionRef);

    // Get assessments for selected employee
    const employeeAssessments = useMemo(() =>
        assessments.filter(a => a.employeeId === selectedEmployeeId),
        [assessments, selectedEmployeeId]
    );

    // Compute skill gaps for individual employee
    const skillGaps = useMemo(() => {
        if (!position?.skills || position.skills.length === 0) return [];
        return computeSkillGaps(
            position.skills as { name: string; level: SkillLevel }[],
            employeeAssessments
        );
    }, [position?.skills, employeeAssessments]);

    const gapsWithIssues = skillGaps.filter(g => g.gapSize > 0);
    const gapsOk = skillGaps.filter(g => g.gapSize <= 0);

    // Available skills for assessment (from position)
    const availableSkills = useMemo(() => {
        if (!position?.skills) return [];
        return position.skills.map(s => ({ name: s.name }));
    }, [position?.skills]);

    const selectedEmployeeName = selectedEmployee
        ? `${selectedEmployee.lastName?.charAt(0) || ''}. ${selectedEmployee.firstName}`
        : '';

    // Department-level gap summary
    const departmentGapSummary = useMemo(() => {
        if (viewMode !== 'department') return [];

        const filteredEmps = selectedDepartmentId === 'all'
            ? activeEmployees
            : activeEmployees.filter(e => e.departmentId === selectedDepartmentId);

        const deptSummary = new Map<string, { deptName: string; totalSkills: number; gapCount: number; employeeCount: number }>();

        filteredEmps.forEach(emp => {
            const pos = emp.positionId ? positionMap.get(emp.positionId) : null;
            if (!pos?.skills || pos.skills.length === 0) return;

            const dept = departmentMap.get(emp.departmentId);
            const deptName = dept?.name || 'Тодорхойгүй';
            const deptId = emp.departmentId;

            if (!deptSummary.has(deptId)) {
                deptSummary.set(deptId, { deptName, totalSkills: 0, gapCount: 0, employeeCount: 0 });
            }

            const summary = deptSummary.get(deptId)!;
            summary.employeeCount++;

            const empAssessments = assessments.filter(a => a.employeeId === emp.id);
            const gaps = computeSkillGaps(
                pos.skills as { name: string; level: SkillLevel }[],
                empAssessments
            );

            summary.totalSkills += gaps.length;
            summary.gapCount += gaps.filter(g => g.gapSize > 0).length;
        });

        return Array.from(deptSummary.values()).sort((a, b) => {
            const aRate = a.totalSkills > 0 ? a.gapCount / a.totalSkills : 0;
            const bRate = b.totalSkills > 0 ? b.gapCount / b.totalSkills : 0;
            return bRate - aRate;
        });
    }, [viewMode, selectedDepartmentId, activeEmployees, positions, assessments, positionMap, departmentMap]);

    const handleAssess = (values: { employeeId: string; skillName: string; currentLevel: SkillLevel; source: AssessmentSource; notes?: string }) => {
        if (!firestore || !user || !selectedEmployee) return;

        const data: Omit<SkillAssessment, 'id'> = {
            employeeId: selectedEmployeeId,
            employeeName: selectedEmployeeName,
            skillName: values.skillName,
            currentLevel: values.currentLevel,
            requiredLevel: position?.skills?.find(s => s.name === values.skillName)?.level as SkillLevel | undefined,
            assessedBy: user.uid,
            assessedByName: 'Админ',
            assessedAt: new Date().toISOString(),
            source: values.source,
            notes: values.notes,
        };

        addDocumentNonBlocking(tCollection('skill_assessments'), data);
        toast({
            title: 'Үнэлгээ хадгалагдлаа',
            description: `${values.skillName}: ${SKILL_LEVEL_LABELS[values.currentLevel]}`,
        });
    };

    return (
        <div className="space-y-6">
            <div className="space-y-1">
                <h2 className="text-lg font-bold tracking-tight text-slate-800">Зөрүү шинжилгээ</h2>
                <p className="text-sm text-muted-foreground max-w-2xl">
                    Ажлын байрны шаардлага болон ажилтны одоогийн ур чадварын түвшинг харьцуулж, хөгжлийн хэрэгцээг тодорхойлно.
                </p>
            </div>

            {/* View mode toggle */}
            <div className="flex gap-2">
                <Button
                    variant={viewMode === 'employee' ? 'default' : 'outline'}
                    size="sm"
                    className="rounded-xl"
                    onClick={() => setViewMode('employee')}
                >
                    <UserSearch className="h-4 w-4 mr-1.5" />
                    Ажилтнаар
                </Button>
                <Button
                    variant={viewMode === 'department' ? 'default' : 'outline'}
                    size="sm"
                    className="rounded-xl"
                    onClick={() => setViewMode('department')}
                >
                    <Building2 className="h-4 w-4 mr-1.5" />
                    Нэгжээр
                </Button>
            </div>

            {viewMode === 'employee' ? (
                <>
                    {/* Employee selector */}
                    <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                        <div className="flex items-center gap-2">
                            <UserSearch className="h-5 w-5 text-muted-foreground" />
                            <span className="text-sm font-medium">Ажилтан сонгох:</span>
                        </div>
                        <Select value={selectedEmployeeId} onValueChange={setSelectedEmployeeId}>
                            <SelectTrigger className="w-full sm:w-[320px] bg-white border shadow-sm h-11 rounded-xl">
                                <SelectValue placeholder="Ажилтан сонгоно уу..." />
                            </SelectTrigger>
                            <SelectContent>
                                {activeEmployees.map(emp => (
                                    <SelectItem key={emp.id} value={emp.id}>
                                        {emp.lastName?.charAt(0)}. {emp.firstName} — {emp.jobTitle}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        {selectedEmployeeId && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                    setPreSelectedSkill('');
                                    setAssessDialogOpen(true);
                                }}
                            >
                                <ClipboardCheck className="h-4 w-4 mr-1.5" />
                                Ур чадвар үнэлэх
                            </Button>
                        )}
                    </div>

                    {/* Employee gap content */}
                    {!selectedEmployeeId ? (
                        <EmptyState
                            icon={BarChart3}
                            title="Ажилтан сонгоно уу"
                            description="Ур чадварын зөрүү шинжилгээг харахын тулд ажилтан сонгоно уу."
                        />
                    ) : isLoading || positionLoading ? (
                        <div className="space-y-3">
                            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
                        </div>
                    ) : !position?.skills || position.skills.length === 0 ? (
                        <EmptyState
                            icon={BarChart3}
                            title="Ур чадварын шаардлага тодорхойлогдоогүй"
                            description={`${selectedEmployeeName}-н албан тушаалд ур чадварын шаардлага оруулаагүй байна. Бүтэц > Ажлын байр хэсгээс нэмнэ үү.`}
                        />
                    ) : (
                        <div className="space-y-6">
                            {/* Summary */}
                            <div className="flex items-center gap-4 flex-wrap">
                                <div className="text-sm">
                                    <span className="text-muted-foreground">Ажилтан: </span>
                                    <span className="font-medium">{selectedEmployeeName}</span>
                                </div>
                                <div className="text-sm">
                                    <span className="text-muted-foreground">Албан тушаал: </span>
                                    <span className="font-medium">{position.title}</span>
                                </div>
                                <div className="flex gap-2">
                                    <Badge variant="secondary" className="bg-amber-100 text-amber-700">
                                        {gapsWithIssues.length} зөрүү
                                    </Badge>
                                    <Badge variant="secondary" className="bg-emerald-100 text-emerald-700">
                                        {gapsOk.length} хангалттай
                                    </Badge>
                                </div>
                            </div>

                            {/* Gaps with issues */}
                            {gapsWithIssues.length > 0 && (
                                <div className="space-y-3">
                                    <h3 className="text-sm font-semibold text-amber-700 flex items-center gap-2">
                                        <AlertTriangle className="h-4 w-4" />
                                        Ур чадварын зөрүү ({gapsWithIssues.length})
                                    </h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        {gapsWithIssues.map(gap => (
                                            <SkillGapCard
                                                key={gap.skillName}
                                                gap={gap}
                                                onAssess={(skillName) => {
                                                    setPreSelectedSkill(skillName);
                                                    setAssessDialogOpen(true);
                                                }}
                                            />
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Skills OK */}
                            {gapsOk.length > 0 && (
                                <div className="space-y-3">
                                    <h3 className="text-sm font-semibold text-emerald-700 flex items-center gap-2">
                                        <CheckCircle2 className="h-4 w-4" />
                                        Хангалттай ур чадвар ({gapsOk.length})
                                    </h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        {gapsOk.map(gap => (
                                            <SkillGapCard key={gap.skillName} gap={gap} />
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Assess dialog */}
                    {selectedEmployeeId && (
                        <AssessSkillDialog
                            open={assessDialogOpen}
                            onOpenChange={setAssessDialogOpen}
                            onSubmit={handleAssess}
                            employeeId={selectedEmployeeId}
                            employeeName={selectedEmployeeName}
                            availableSkills={availableSkills}
                            preSelectedSkill={preSelectedSkill}
                        />
                    )}
                </>
            ) : (
                /* Department-level view */
                <>
                    <div className="flex items-center gap-4">
                        <Select value={selectedDepartmentId} onValueChange={setSelectedDepartmentId}>
                            <SelectTrigger className="w-[260px] h-10 rounded-xl">
                                <Building2 className="h-4 w-4 mr-2 text-muted-foreground" />
                                <SelectValue placeholder="Нэгж сонгох" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Бүх нэгж</SelectItem>
                                {departments.map(d => (
                                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {isLoading ? (
                        <div className="space-y-3">
                            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}
                        </div>
                    ) : departmentGapSummary.length === 0 ? (
                        <EmptyState
                            icon={Building2}
                            title="Мэдээлэл олдсонгүй"
                            description="Ажлын байранд ур чадварын шаардлага тодорхойлогдоогүй байна."
                        />
                    ) : (
                        <div className="space-y-3">
                            {departmentGapSummary.map((dept, idx) => {
                                const gapRate = dept.totalSkills > 0
                                    ? Math.round((dept.gapCount / dept.totalSkills) * 100)
                                    : 0;
                                return (
                                    <Card key={idx}>
                                        <CardContent className="p-4">
                                            <div className="flex items-center justify-between">
                                                <div className="space-y-1">
                                                    <h4 className="font-semibold text-sm">{dept.deptName}</h4>
                                                    <p className="text-xs text-muted-foreground">
                                                        {dept.employeeCount} ажилтан · {dept.totalSkills} ур чадварын шаардлага
                                                    </p>
                                                </div>
                                                <div className="flex items-center gap-4">
                                                    <div className="text-right">
                                                        <div className="text-lg font-bold text-amber-600">{dept.gapCount}</div>
                                                        <div className="text-[10px] text-muted-foreground">Зөрүү</div>
                                                    </div>
                                                    <div className="w-20">
                                                        <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                                                            <div
                                                                className={`h-full rounded-full transition-all ${gapRate > 50 ? 'bg-red-500' : gapRate > 25 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                                                                style={{ width: `${Math.min(gapRate, 100)}%` }}
                                                            />
                                                        </div>
                                                        <p className="text-[10px] text-muted-foreground text-center mt-0.5">{gapRate}%</p>
                                                    </div>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                );
                            })}
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
