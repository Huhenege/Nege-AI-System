// src/app/dashboard/skills/page.tsx
'use client';

import React, { useMemo } from 'react';
import { collection, query, orderBy } from 'firebase/firestore';
import { useFirebase, useFetchCollection } from '@/firebase';
import { PageHeader } from '@/components/patterns/page-layout';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { VerticalTabMenu } from '@/components/ui/vertical-tab-menu';
import { Employee, Department } from '@/types';
import { Position } from '@/app/dashboard/organization/types';
import {
    SkillInventoryItem,
    SkillTypeItem,
} from './types';
import type { SkillAssessment } from './types';

import { SkillsInventory } from './components/skills-inventory';
import { SkillMatrix } from './components/skill-matrix';
import { SkillGapAnalysis } from './components/skill-gap-analysis';
import { SkillsSettings } from './components/skills-settings';

export default function SkillsPage() {
    const { firestore } = useFirebase();

    // ── Queries ──────────────────────────────────────
    const skillsQuery = useMemo(() =>
        firestore ? query(collection(firestore, 'skills_inventory'), orderBy('name', 'asc')) : null,
        [firestore]
    );

    const assessmentsQuery = useMemo(() =>
        firestore ? query(collection(firestore, 'skill_assessments'), orderBy('assessedAt', 'desc')) : null,
        [firestore]
    );

    const skillTypesQuery = useMemo(() =>
        firestore ? collection(firestore, 'skill_types') : null,
        [firestore]
    );

    const employeesQuery = useMemo(() =>
        firestore ? collection(firestore, 'employees') : null,
        [firestore]
    );

    const positionsQuery = useMemo(() =>
        firestore ? collection(firestore, 'positions') : null,
        [firestore]
    );

    const departmentsQuery = useMemo(() =>
        firestore ? collection(firestore, 'departments') : null,
        [firestore]
    );

    // ── Data ─────────────────────────────────────────
    const { data: skills, isLoading: skillsLoading } = useFetchCollection<SkillInventoryItem>(skillsQuery);
    const { data: assessments, isLoading: assessmentsLoading } = useFetchCollection<SkillAssessment>(assessmentsQuery);
    const { data: skillTypes, isLoading: skillTypesLoading } = useFetchCollection<SkillTypeItem>(skillTypesQuery);
    const { data: employees, isLoading: employeesLoading } = useFetchCollection<Employee>(employeesQuery);
    const { data: positions, isLoading: positionsLoading } = useFetchCollection<Position>(positionsQuery);
    const { data: departments } = useFetchCollection<Department>(departmentsQuery);

    const isLoading = skillsLoading || assessmentsLoading || employeesLoading || positionsLoading;

    return (
        <div className="flex flex-col h-full overflow-hidden bg-slate-50/50">
            <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 pb-32">
                <PageHeader
                    title="Ур чадвар"
                    description="Байгууллагын ур чадварын сан, матриц, зөрүү шинжилгээ — олон улсын сайн туршлагад суурилсан"
                    showBackButton
                    hideBreadcrumbs
                    backButtonPlacement="inline"
                    backBehavior="history"
                    fallbackBackHref="/dashboard"
                />

                <Tabs defaultValue="inventory" className="space-y-6">
                    <VerticalTabMenu
                        orientation="horizontal"
                        items={[
                            { value: 'inventory', label: 'Ур чадварын сан' },
                            { value: 'matrix', label: 'Ур чадварын матриц' },
                            { value: 'gap', label: 'Зөрүү шинжилгээ' },
                            { value: 'settings', label: 'Тохиргоо' },
                        ]}
                    />

                    {/* Tab 1: Skills Inventory */}
                    <TabsContent value="inventory">
                        <SkillsInventory
                            skills={skills}
                            skillTypes={skillTypes}
                            assessments={assessments}
                            employees={employees}
                            positions={positions}
                            isLoading={skillsLoading || assessmentsLoading}
                        />
                    </TabsContent>

                    {/* Tab 3: Skill Matrix */}
                    <TabsContent value="matrix">
                        <SkillMatrix
                            employees={employees}
                            positions={positions}
                            departments={departments}
                            skills={skills}
                            skillTypes={skillTypes}
                            assessments={assessments}
                            isLoading={isLoading}
                        />
                    </TabsContent>

                    {/* Tab 4: Gap Analysis */}
                    <TabsContent value="gap">
                        <SkillGapAnalysis
                            employees={employees}
                            positions={positions as Position[]}
                            departments={departments}
                            assessments={assessments}
                            isLoading={isLoading}
                        />
                    </TabsContent>

                    {/* Tab 5: Settings */}
                    <TabsContent value="settings">
                        <SkillsSettings
                            skillTypes={skillTypes}
                            isLoading={skillTypesLoading}
                        />
                    </TabsContent>

                </Tabs>
            </div>
        </div>
    );
}
