// src/app/dashboard/training/components/skill-assessment-tab.tsx
'use client';

import React, { useState, useMemo } from 'react';
import { doc } from 'firebase/firestore';
import { useFirebase, useCollection, useDoc, addDocumentNonBlocking, useTenantWrite } from '@/firebase';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/patterns/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { BarChart3, ClipboardCheck, GraduationCap, UserSearch } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Employee, isActiveStatus } from '@/types';
import { Position } from '@/app/dashboard/organization/types';
import {
    SkillAssessment,
    AssessSkillFormValues,
    SkillGap,
    computeSkillGaps,
    SkillLevel,
    SKILL_LEVEL_LABELS,
} from '../types';
import { SkillGapCard } from './skill-gap-card';
import { AssessSkillDialog } from './assess-skill-dialog';

interface SkillAssessmentTabProps {
    employees: Employee[];
    assessments: SkillAssessment[];
    isLoading: boolean;
    onAssignTraining?: (employeeId: string, skillName: string) => void;
}

export function SkillAssessmentTab({
    employees,
    assessments,
    isLoading,
    onAssignTraining,
}: SkillAssessmentTabProps) {
    const { firestore, user } = useFirebase();
    const { tCollection } = useTenantWrite();
    const { toast } = useToast();
    const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
    const [assessDialogOpen, setAssessDialogOpen] = useState(false);
    const [preSelectedSkill, setPreSelectedSkill] = useState<string>('');

    // Active employees only
    const activeEmployees = useMemo(() =>
        employees.filter(e => isActiveStatus(e.status)),
        [employees]
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

    // Compute skill gaps
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

    const handleAssess = (values: AssessSkillFormValues) => {
        if (!firestore || !user || !selectedEmployee) return;

        const data: Omit<SkillAssessment, 'id'> = {
            employeeId: selectedEmployeeId,
            employeeName: selectedEmployeeName,
            skillName: values.skillName,
            currentLevel: values.currentLevel,
            requiredLevel: position?.skills?.find(s => s.name === values.skillName)?.level as SkillLevel | undefined,
            assessedBy: user.uid,
            assessedByName: 'Админ',  // In real app, get from employee profile
            assessedAt: new Date().toISOString(),
            source: values.source,
            notes: values.notes,
        };

        addDocumentNonBlocking(tCollection('skill_assessments'), data);
        toast({ title: 'Үнэлгээ хадгалагдлаа', description: `${values.skillName}: ${SKILL_LEVEL_LABELS[values.currentLevel]}` });
    };

    return (
        <div className="space-y-6">
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

            {/* Content */}
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
                                <BarChart3 className="h-4 w-4" />
                                Ур чадварын зөрүү ({gapsWithIssues.length})
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {gapsWithIssues.map(gap => (
                                    <SkillGapCard
                                        key={gap.skillName}
                                        gap={gap}
                                        onAssignTraining={(skillName) => onAssignTraining?.(selectedEmployeeId, skillName)}
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
                                <GraduationCap className="h-4 w-4" />
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
        </div>
    );
}
