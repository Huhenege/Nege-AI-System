// src/app/dashboard/business-plan/page.tsx
'use client';

import React, { useMemo } from 'react';
import { collection, doc, query, orderBy, where } from 'firebase/firestore';
import { useFirebase, useCollection, useDoc, useMemoFirebase, tenantCollection, tenantDoc } from '@/firebase';
import { PageHeader } from '@/components/patterns/page-layout';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { VerticalTabMenu } from '@/components/ui/vertical-tab-menu';
import { Employee, isActiveStatus } from '@/types';
import { Department } from '@/types';

import {
    BusinessPlan,
    StrategicTheme,
    Objective,
    KeyResult,
    Kpi,
    PerformanceReview,
    PerformanceScore,
    Reward,
    CompanyProfile,
    CoreValue,
} from './types';

import { BpDashboard } from './components/bp-dashboard';
import { PlansTab } from './components/plans-tab';
import { OkrTab } from './components/okr-tab';
import { KpiTab } from './components/kpi-tab';
import { PerformanceTab } from './components/performance-tab';
import { RewardsTab } from './components/rewards-tab';
import { BpSettings } from './components/bp-settings';

export default function BusinessPlanPage() {
    const { firestore } = useFirebase();

    // ── Queries ──────────────────────────────────────
    const plansQuery = useMemo(() =>
        firestore ? query(collection(firestore, 'bp_plans'), orderBy('createdAt', 'desc')) : null,
        [firestore]
    );

    const themesQuery = useMemo(() =>
        firestore ? query(collection(firestore, 'bp_themes'), orderBy('order', 'asc')) : null,
        [firestore]
    );

    const objectivesQuery = useMemo(() =>
        firestore ? query(collection(firestore, 'bp_objectives'), orderBy('createdAt', 'desc')) : null,
        [firestore]
    );

    const keyResultsQuery = useMemo(() =>
        firestore ? query(collection(firestore, 'bp_key_results'), orderBy('createdAt', 'desc')) : null,
        [firestore]
    );

    const kpisQuery = useMemo(() =>
        firestore ? query(collection(firestore, 'bp_kpis'), orderBy('createdAt', 'desc')) : null,
        [firestore]
    );

    const reviewsQuery = useMemo(() =>
        firestore ? query(collection(firestore, 'bp_reviews'), orderBy('createdAt', 'desc')) : null,
        [firestore]
    );

    const scoresQuery = useMemo(() =>
        firestore ? query(collection(firestore, 'bp_scores'), orderBy('createdAt', 'desc')) : null,
        [firestore]
    );

    const rewardsQuery = useMemo(() =>
        firestore ? query(collection(firestore, 'bp_rewards'), orderBy('createdAt', 'desc')) : null,
        [firestore]
    );

    const employeesQuery = useMemo(() =>
        firestore ? collection(firestore, 'employees') : null,
        [firestore]
    );

    const departmentsQuery = useMemo(() =>
        firestore ? collection(firestore, 'departments') : null,
        [firestore]
    );

    // Company profile (vision, mission, values — read-only)
    const companyProfileRef = useMemoFirebase(({ firestore, companyPath }) =>
        firestore ? tenantDoc(firestore, companyPath, 'company', 'profile') : null,
        [firestore]
    );
    const coreValuesQuery = useMemoFirebase(({ firestore, companyPath }) => {
        if (!firestore) return null;
        const basePath = companyPath ? `${companyPath}/company` : 'company';
        return query(collection(firestore, basePath, 'branding', 'values'), orderBy('createdAt', 'asc'));
    }, []);

    // ── Data ─────────────────────────────────────────
    const { data: companyProfile } = useDoc<CompanyProfile>(companyProfileRef);
    const { data: coreValues } = useCollection<CoreValue>(coreValuesQuery);
    const { data: plans, isLoading: plansLoading } = useCollection<BusinessPlan>(plansQuery);
    const { data: themes, isLoading: themesLoading } = useCollection<StrategicTheme>(themesQuery);
    const { data: objectives, isLoading: objectivesLoading } = useCollection<Objective>(objectivesQuery);
    const { data: keyResults, isLoading: keyResultsLoading } = useCollection<KeyResult>(keyResultsQuery);
    const { data: kpis, isLoading: kpisLoading } = useCollection<Kpi>(kpisQuery);
    const { data: reviews, isLoading: reviewsLoading } = useCollection<PerformanceReview>(reviewsQuery);
    const { data: scores, isLoading: scoresLoading } = useCollection<PerformanceScore>(scoresQuery);
    const { data: rewards, isLoading: rewardsLoading } = useCollection<Reward>(rewardsQuery);
    const { data: employees } = useCollection<Employee>(employeesQuery);
    const { data: departments } = useCollection<Department>(departmentsQuery);

    const activeEmployees = useMemo(() =>
        employees.filter(e => isActiveStatus(e.status)),
        [employees]
    );

    // Find active plan
    const activePlan = useMemo(() =>
        plans.find(p => p.status === 'active') || plans[0],
        [plans]
    );

    // Filter data by active plan
    const activePlanThemes = useMemo(() =>
        activePlan ? themes.filter(t => t.planId === activePlan.id) : [],
        [themes, activePlan]
    );

    const activePlanObjectives = useMemo(() =>
        activePlan ? objectives.filter(o => o.planId === activePlan.id) : [],
        [objectives, activePlan]
    );

    const activePlanKeyResults = useMemo(() =>
        activePlan ? keyResults.filter(kr => kr.planId === activePlan.id) : [],
        [keyResults, activePlan]
    );

    const activePlanKpis = useMemo(() =>
        activePlan ? kpis.filter(k => k.planId === activePlan.id) : [],
        [kpis, activePlan]
    );

    const activePlanReviews = useMemo(() =>
        activePlan ? reviews.filter(r => r.planId === activePlan.id) : [],
        [reviews, activePlan]
    );

    const activePlanScores = useMemo(() =>
        activePlan ? scores.filter(s => s.planId === activePlan.id) : [],
        [scores, activePlan]
    );

    const activePlanRewards = useMemo(() =>
        activePlan ? rewards.filter(r => r.planId === activePlan.id) : [],
        [rewards, activePlan]
    );

    const isLoading = plansLoading || themesLoading || objectivesLoading || keyResultsLoading;

    return (
        <div className="flex flex-col h-full overflow-hidden bg-slate-50/50">
            <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 pb-32">
                <PageHeader
                    title="Бизнес төлөвлөгөө"
                    description="Стратегийн гүйцэтгэлийн систем — Төлөвлөгөө → Зорилго → KPI → Гүйцэтгэл → Урамшуулал"
                    showBackButton
                    hideBreadcrumbs
                    backButtonPlacement="inline"
                    backBehavior="history"
                    fallbackBackHref="/dashboard"
                />

                <Tabs defaultValue="dashboard" className="space-y-6">
                    <VerticalTabMenu
                        orientation="horizontal"
                        items={[
                            { value: 'dashboard', label: 'Хянах самбар' },
                            { value: 'plans', label: 'Төлөвлөгөө' },
                            { value: 'okr', label: 'OKR Зорилго' },
                            { value: 'kpi', label: 'KPI Хэмжүүр' },
                            { value: 'performance', label: 'Гүйцэтгэл' },
                            { value: 'rewards', label: 'Урамшуулал' },
                            { value: 'settings', label: 'Тохиргоо' },
                        ]}
                    />

                    <TabsContent value="dashboard">
                        <BpDashboard
                            activePlan={activePlan}
                            themes={activePlanThemes}
                            objectives={activePlanObjectives}
                            keyResults={activePlanKeyResults}
                            kpis={activePlanKpis}
                            reviews={activePlanReviews}
                            scores={activePlanScores}
                            companyProfile={companyProfile}
                            coreValues={coreValues.filter(v => v.isActive)}
                            isLoading={isLoading}
                        />
                    </TabsContent>

                    <TabsContent value="plans">
                        <PlansTab
                            plans={plans}
                            themes={themes}
                            employees={activeEmployees}
                            companyProfile={companyProfile}
                            coreValues={coreValues.filter(v => v.isActive)}
                            isLoading={plansLoading || themesLoading}
                        />
                    </TabsContent>

                    <TabsContent value="okr">
                        <OkrTab
                            activePlan={activePlan}
                            themes={activePlanThemes}
                            objectives={activePlanObjectives}
                            keyResults={activePlanKeyResults}
                            employees={activeEmployees}
                            isLoading={objectivesLoading || keyResultsLoading}
                        />
                    </TabsContent>

                    <TabsContent value="kpi">
                        <KpiTab
                            activePlan={activePlan}
                            themes={activePlanThemes}
                            objectives={activePlanObjectives}
                            kpis={activePlanKpis}
                            employees={activeEmployees}
                            departments={departments}
                            isLoading={kpisLoading}
                        />
                    </TabsContent>

                    <TabsContent value="performance">
                        <PerformanceTab
                            activePlan={activePlan}
                            reviews={activePlanReviews}
                            scores={activePlanScores}
                            objectives={activePlanObjectives}
                            kpis={activePlanKpis}
                            employees={activeEmployees}
                            isLoading={reviewsLoading || scoresLoading}
                        />
                    </TabsContent>

                    <TabsContent value="rewards">
                        <RewardsTab
                            activePlan={activePlan}
                            reviews={activePlanReviews}
                            scores={activePlanScores}
                            rewards={activePlanRewards}
                            employees={activeEmployees}
                            isLoading={rewardsLoading}
                        />
                    </TabsContent>

                    <TabsContent value="settings">
                        <BpSettings />
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    );
}
