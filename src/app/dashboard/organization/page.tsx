'use client';

import React, { useState } from 'react';
import { PageHeader } from '@/components/patterns/page-layout';
import { useRouter } from 'next/navigation';
import {
    useCollection,
    useFirebase,
    useMemoFirebase,
    tenantCollection,
} from '@/firebase';

// Types
import {
    Department,
    DepartmentType,
    Position,
    PositionLevel,
    EmploymentType,
    JobCategory,
    WorkSchedule
} from './types';

// Components


// Tab Components
import { StructureTab } from './components/tabs/structure-tab';

// Dialogs
import { AddDepartmentDialog } from './add-department-dialog';
import { AddPositionDialog } from './add-position-dialog';

// Hooks
import { useOrganizationFilters } from '@/hooks/use-organization-filters';

export default function OrganizationPage() {
    const { firestore } = useFirebase();
    const router = useRouter();
    const [isDeptDialogOpen, setIsDeptDialogOpen] = useState(false);
    const [isPositionDialogOpen, setIsPositionDialogOpen] = useState(false);

    // Filter state
    const {
        filters,
        updateFilters,
        clearFilters,
        hasActiveFilters,
        activeFilterCount,
    } = useOrganizationFilters();

    // -- Data Fetching Strategy: Fetch commonly used collections at the page level --
    const departmentsQuery = useMemoFirebase(({ firestore, companyPath }) => (firestore ? tenantCollection(firestore, companyPath, 'departments') : null), [firestore]);
    const deptTypesQuery = useMemoFirebase(({ firestore, companyPath }) => (firestore ? tenantCollection(firestore, companyPath, 'departmentTypes') : null), [firestore]);
    const positionsQuery = useMemoFirebase(({ firestore, companyPath }) => (firestore ? tenantCollection(firestore, companyPath, 'positions') : null), [firestore]);
    const levelsQuery = useMemoFirebase(({ firestore, companyPath }) => (firestore ? tenantCollection(firestore, companyPath, 'positionLevels') : null), [firestore]);
    const empTypesQuery = useMemoFirebase(({ firestore, companyPath }) => (firestore ? tenantCollection(firestore, companyPath, 'employmentTypes') : null), [firestore]);
    const jobCategoriesQuery = useMemoFirebase(({ firestore, companyPath }) => (firestore ? tenantCollection(firestore, companyPath, 'jobCategories') : null), [firestore]);
    const workSchedulesQuery = useMemoFirebase(({ firestore, companyPath }) => (firestore ? tenantCollection(firestore, companyPath, 'workSchedules') : null), [firestore]);

    const { data: departments } = useCollection<Department>(departmentsQuery);
    const { data: departmentTypes } = useCollection<DepartmentType>(deptTypesQuery);
    const { data: positions } = useCollection<Position>(positionsQuery);
    const { data: levels } = useCollection<PositionLevel>(levelsQuery);
    const { data: employmentTypes } = useCollection<EmploymentType>(empTypesQuery);
    const { data: jobCategories } = useCollection<JobCategory>(jobCategoriesQuery);
    const { data: workSchedules } = useCollection<WorkSchedule>(workSchedulesQuery);



    const handleAddDepartment = () => setIsDeptDialogOpen(true);
    const handleAddPosition = () => setIsPositionDialogOpen(true);

    return (
        <div className="flex flex-col h-full overflow-hidden">
            <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 pb-32">
                <PageHeader
                    title="Байгууллагын бүтэц"
                    description="Компанийн бүтэц, ажлын байр, орон тооны төлөвлөлт "
                    showBackButton={true}
                    hideBreadcrumbs={true}
                    backButtonPlacement="inline"
                    backBehavior="history"
                    fallbackBackHref="/dashboard"
                    backHref="/dashboard"
                />

                <div className="flex-1 min-h-0">
                    <StructureTab
                        departments={departments}
                        departmentTypes={departmentTypes}
                        positions={positions}
                        filters={filters}
                        onAddDepartment={handleAddDepartment}
                        onClearFilters={clearFilters}
                        onDepartmentClick={(deptId) => {
                            router.push(`/dashboard/organization/${deptId}`);
                        }}
                    />
                </div>

                {/* Quick Actions (Floating or Fixed) - Integrated into UI or via QuickActionsBar */}


                {/* Global Dialogs */}
                <AddDepartmentDialog
                    open={isDeptDialogOpen}
                    onOpenChange={setIsDeptDialogOpen}
                    departments={departments || []}
                    departmentTypes={departmentTypes || []}
                />

                <AddPositionDialog
                    open={isPositionDialogOpen}
                    onOpenChange={setIsPositionDialogOpen}
                    departments={departments || []}
                    allPositions={positions || []}
                    positionLevels={levels || []}
                    employmentTypes={employmentTypes || []}
                    jobCategories={jobCategories || []}
                    workSchedules={workSchedules || []}
                />
            </div>
        </div>
    );
}
