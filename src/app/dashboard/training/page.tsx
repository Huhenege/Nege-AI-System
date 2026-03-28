'use client';
// src/app/dashboard/training/page.tsx

import { isSystemUser } from '@/lib/employee-utils';

import React, { useMemo, useState } from 'react';
import { query, orderBy, addDoc, deleteDoc } from 'firebase/firestore';
import { useFirebase, useFetchCollection, useTenantWrite, useMemoFirebase, tenantCollection } from '@/firebase';
import type { Department, PositionLevel, Position } from '@/app/dashboard/organization/types';
import { PageHeader } from '@/components/patterns/page-layout';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { VerticalTabMenu } from '@/components/ui/vertical-tab-menu';
import { useToast } from '@/hooks/use-toast';
import { Employee, isActiveStatus } from '@/types';
import {
    TrainingCourse,
    TrainingPlan,
    SkillAssessment,
    TrainingCategory,
    CreatePlanFormValues,
} from './types';

import { CourseCatalog } from './components/course-catalog';
import { TrainingPlans } from './components/training-plans';
import { SkillAssessmentTab } from './components/skill-assessment-tab';
import { TrainingSettings } from './components/training-settings';
import { TrainingDashboardCard } from './components/training-dashboard-card';

interface SkillInventoryItem {
    id: string;
    name: string;
    category?: string;
    description?: string;
}

export default function TrainingPage() {
    const { firestore, user } = useFirebase();
    const { tDoc, tCollection } = useTenantWrite();
    const { toast } = useToast();

    // ── Queries ──────────────────────────────────────
    const coursesQuery = useMemoFirebase(({ firestore, companyPath }) =>
        firestore ? query(tenantCollection(firestore, companyPath, 'training_courses'), orderBy('createdAt', 'desc')) : null,
        [firestore]
    );

    const plansQuery = useMemoFirebase(({ firestore, companyPath }) =>
        firestore ? tenantCollection(firestore, companyPath, 'training_plans') : null,
        [firestore]
    );

    const assessmentsQuery = useMemoFirebase(({ firestore, companyPath }) =>
        firestore ? query(tenantCollection(firestore, companyPath, 'skill_assessments'), orderBy('assessedAt', 'desc')) : null,
        [firestore]
    );

    const employeesQuery = useMemoFirebase(({ firestore, companyPath }) =>
        firestore ? tenantCollection(firestore, companyPath, 'employees') : null,
        [firestore]
    );

    const skillsQuery = useMemoFirebase(({ firestore, companyPath }) =>
        firestore ? tenantCollection(firestore, companyPath, 'skills_inventory') : null,
        [firestore]
    );

    const categoriesQuery = useMemoFirebase(({ firestore, companyPath }) =>
        firestore ? tenantCollection(firestore, companyPath, 'training_categories') : null,
        [firestore]
    );

    const departmentsQuery = useMemoFirebase(({ firestore, companyPath }) =>
        firestore ? tenantCollection(firestore, companyPath, 'departments') : null,
        [firestore]
    );
    const positionLevelsQuery = useMemoFirebase(({ firestore, companyPath }) =>
        firestore ? tenantCollection(firestore, companyPath, 'positionLevels') : null,
        [firestore]
    );
    const positionsQuery = useMemoFirebase(({ firestore, companyPath }) =>
        firestore ? tenantCollection(firestore, companyPath, 'positions') : null,
        [firestore]
    );

    // ── Data ─────────────────────────────────────────
    const { data: courses, isLoading: coursesLoading, refetch: refetchCourses } = useFetchCollection<TrainingCourse>(coursesQuery);
    const { data: plansRaw, isLoading: plansLoading, refetch: refetchPlans } = useFetchCollection<TrainingPlan>(plansQuery);
    const plans = useMemo(() => {
        const sortKey = (p: TrainingPlan) => p.scheduledQuarter ?? p.scheduledAt ?? p.dueDate ?? p.assignedAt ?? p.createdAt ?? '';
        return [...plansRaw].sort((a, b) => sortKey(b).localeCompare(sortKey(a)));
    }, [plansRaw]);
    const { data: assessments, isLoading: assessmentsLoading } = useFetchCollection<SkillAssessment>(assessmentsQuery);
    const { data: employees, isLoading: employeesLoading } = useFetchCollection<Employee>(employeesQuery);
    const { data: skills } = useFetchCollection<SkillInventoryItem>(skillsQuery);
    const { data: categories, isLoading: categoriesLoading } = useFetchCollection<TrainingCategory>(categoriesQuery);
    const { data: departments } = useFetchCollection<Department>(departmentsQuery);
    const { data: positionLevels } = useFetchCollection<PositionLevel>(positionLevelsQuery);
    const { data: positions } = useFetchCollection<Position>(positionsQuery);

    const isLoadingDashboard = coursesLoading || plansLoading || assessmentsLoading;

    // Active employees
    const activeEmployees = useMemo(() =>
        employees.filter(e => !isSystemUser(e as any) && isActiveStatus(e.status)),
        [employees]
    );

    // ── Create Plan Handler (one plan = one scheduled training + participants) ──
    const handleCreatePlan = async (values: CreatePlanFormValues, courseName: string) => {
        if (!firestore || !user) return;

        const now = new Date().toISOString();
        const participantNames = values.participantIds.map(empId => {
            const emp = employees.find(e => e.id === empId);
            return emp ? `${emp.lastName?.charAt(0) || ''}. ${emp.firstName}` : '';
        });

        const data: Record<string, unknown> = {
            courseId: values.courseId,
            courseName,
            scheduledQuarter: values.scheduledQuarter,
            participantIds: values.participantIds,
            participantNames,
            status: 'scheduled',
            trigger: values.trigger,
            createdBy: user.uid,
            createdByName: 'Админ',
            createdAt: now,
        };
        if (values.budget != null && values.budget > 0) data.budget = values.budget;
        if (values.notes != null && values.notes !== '') data.notes = values.notes;
        if (values.purpose != null && values.purpose !== '') data.purpose = values.purpose;
        if (values.targetAudience != null && values.targetAudience !== '') data.targetAudience = values.targetAudience;
        if (values.planType != null) data.planType = values.planType;
        if (values.owner != null && values.owner !== '') data.owner = values.owner;
        if (values.format != null) data.format = values.format;
        if (values.locationOrLink != null && values.locationOrLink !== '') data.locationOrLink = values.locationOrLink;
        if (values.assessmentMethod != null) data.assessmentMethod = values.assessmentMethod;
        if (values.providerType != null) data.providerType = values.providerType;
        if (values.categoryIds != null && values.categoryIds.length > 0) data.categoryIds = values.categoryIds;

        try {
            await addDoc(tCollection('training_plans'), data);
            toast({
                title: 'Төлөвлөгөө үүслээ',
                description: `${courseName} — ${values.participantIds.length} оролцогч`,
            });
            refetchPlans();
        } catch {
            toast({ variant: 'destructive', title: 'Алдаа', description: 'Төлөвлөгөө үүсгэхэд алдаа гарлаа.' });
        }
    };

    const handleDeletePlan = async (planId: string) => {
        if (!firestore) return;
        try {
            await deleteDoc(tDoc('training_plans', planId));
            toast({ title: 'Төлөвлөгөө устгагдлаа' });
            refetchPlans();
        } catch {
            toast({ variant: 'destructive', title: 'Алдаа', description: 'Устгахад алдаа гарлаа.' });
        }
    };

    return (
        <div className="flex flex-col h-full overflow-hidden bg-slate-50/50">
            <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 pb-32">
                <PageHeader
                    title="Сургалт хөгжил"
                    description="Ур чадварт суурилсан, өгөгдөлд тулгуурласан, үр дүнг хэмждэг сургалтын систем"
                    showBackButton
                    hideBreadcrumbs
                    backButtonPlacement="inline"
                    backBehavior="history"
                    fallbackBackHref="/dashboard"
                />

                <TrainingDashboardCard
                    courses={courses}
                    plans={plans}
                    assessments={assessments}
                    isLoading={isLoadingDashboard}
                />

                <Tabs defaultValue="plans" className="space-y-6">
                    <VerticalTabMenu
                        orientation="horizontal"
                        items={[
                            { value: 'plans', label: 'Сургалтын төлөвлөгөө' },
                            { value: 'catalog', label: 'Сургалтын сан' },
                            { value: 'assessment', label: 'Ур чадварын үнэлгээ' },
                            { value: 'settings', label: 'Тохиргоо' },
                        ]}
                    />

                    {/* Training Plans */}
                    <TabsContent value="plans">
                        <TrainingPlans
                            plans={plans}
                            courses={courses}
                            employees={activeEmployees}
                            departments={departments}
                            positionLevels={positionLevels}
                            positions={positions}
                            categories={categories}
                            skills={skills}
                            isLoading={plansLoading}
                            onCreatePlan={handleCreatePlan}
                            onDeletePlan={handleDeletePlan}
                        />
                    </TabsContent>

                    {/* Сургалтын сан */}
                    <TabsContent value="catalog">
                        <CourseCatalog
                            courses={courses}
                            skills={skills}
                            categories={categories}
                            isLoading={coursesLoading}
                            onMutate={refetchCourses}
                        />
                    </TabsContent>

                    {/* Skill Assessment & Gap Analysis */}
                    <TabsContent value="assessment">
                        <SkillAssessmentTab
                            employees={employees}
                            assessments={assessments}
                            isLoading={assessmentsLoading}
                            onAssignTraining={(employeeId, skillName) => {
                                toast({
                                    title: 'Сургалт оноох',
                                    description: `${skillName} — Сургалтын төлөвлөгөө таб руу очно уу.`,
                                });
                            }}
                        />
                    </TabsContent>

                    {/* Settings */}
                    <TabsContent value="settings">
                        <TrainingSettings
                            categories={categories}
                            isLoading={categoriesLoading}
                        />
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    );
}
