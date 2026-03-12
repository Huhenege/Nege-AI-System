'use client';

import React from 'react';
import { useFetchCollection, useFirebase, useMemoFirebase, tenantCollection } from '@/firebase';
import { query, orderBy } from 'firebase/firestore';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search } from 'lucide-react';
import { CreateVacancyDialog } from './create-vacancy-dialog';
import { Vacancy } from '@/types/recruitment';
import { Department } from '@/types';
import { OpenVacancyCard } from '@/components/recruitment/open-vacancy-card';
import { cn } from '@/lib/utils';
import { AddActionButton } from '@/components/ui/add-action-button';

export function VacanciesList() {
    const { firestore } = useFirebase();
    const [search, setSearch] = React.useState('');
    const [departmentId, setDepartmentId] = React.useState<string>('all');
    const [type, setType] = React.useState<string>('all');
    const [status, setStatus] = React.useState<'all' | 'OPEN' | 'DRAFT'>('all');
    const [sort, setSort] = React.useState<'newest' | 'oldest' | 'deadline'>('newest');
    const [isCreateOpen, setIsCreateOpen] = React.useState(false);

    const vacanciesQuery = useMemoFirebase(
        ({ firestore, companyPath }) => (firestore ? query(tenantCollection(firestore, companyPath, 'vacancies'), orderBy('createdAt', 'desc')) : null),
        [firestore]
    );

    const departmentsQuery = useMemoFirebase(
        ({ firestore, companyPath }) => (firestore ? tenantCollection(firestore, companyPath, 'departments') : null),
        [firestore]
    );

    const empTypesQuery = useMemoFirebase(
        ({ firestore, companyPath }) => (firestore ? tenantCollection(firestore, companyPath, 'employmentTypes') : null),
        [firestore]
    );

    const { data: vacancies, isLoading: isLoadingVacancies } = useFetchCollection<Vacancy>(vacanciesQuery as any);
    const { data: departments, isLoading: isLoadingDepts } = useFetchCollection<Department>(departmentsQuery as any);
    const { data: employmentTypes } = useFetchCollection<any>(empTypesQuery as any);

    const getDeptName = (id: string) => {
        return departments?.find(d => d.id === id)?.name || 'Unknown';
    };
    const getDeptColor = (id: string) => {
        return departments?.find(d => d.id === id)?.color;
    };
    const getEmpTypeName = (id?: string) => {
        if (!id) return undefined;
        return employmentTypes?.find((t: any) => t.id === id)?.name;
    };

    const filtered = React.useMemo(() => {
        const list = (vacancies || [])
            .filter(v => v.status === 'OPEN' || v.status === 'DRAFT')
            .slice();

        // Sort
        list.sort((a, b) => {
            if (sort === 'deadline') {
                const ad = a.deadline ? Date.parse(a.deadline) : Number.POSITIVE_INFINITY;
                const bd = b.deadline ? Date.parse(b.deadline) : Number.POSITIVE_INFINITY;
                return ad - bd;
            }
            const at = Date.parse(a.createdAt || '') || 0;
            const bt = Date.parse(b.createdAt || '') || 0;
            return sort === 'oldest' ? at - bt : bt - at;
        });

        const q = search.trim().toLowerCase();
        return list.filter((v) => {
            if (status !== 'all' && v.status !== status) return false;
            if (departmentId !== 'all' && v.departmentId !== departmentId) return false;
            if (type !== 'all' && (v.employmentTypeId || '') !== type) return false;
            if (!q) return true;

            const hay = `${v.title} ${v.location || ''} ${getDeptName(v.departmentId)}`.toLowerCase();
            return hay.includes(q);
        });
    }, [vacancies, search, departmentId, type, status, sort, departments]);

    if (isLoadingVacancies || isLoadingDepts) {
        return <div className="space-y-4">
            <div className="flex justify-between">
                <Skeleton className="h-10 w-32" />
                <Skeleton className="h-10 w-32" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {Array.from({ length: 8 }).map((_, i) => (
                    <Skeleton key={i} className="h-[150px] w-full rounded-2xl" />
                ))}
            </div>
        </div>;
    }

    return (
        <div className="space-y-6">
            <Card className="p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
                    <div className="relative flex-1 min-w-0">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Хайх (ажлын байр, хэлтэс, байршил)"
                            className="pl-9"
                        />
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <Select value={status} onValueChange={(v) => setStatus(v as any)}>
                            <SelectTrigger className="h-10 w-[160px] bg-muted/30">
                                <SelectValue placeholder="Төлөв" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Бүгд</SelectItem>
                                <SelectItem value="OPEN">Нээлттэй</SelectItem>
                                <SelectItem value="DRAFT">Ноорог</SelectItem>
                            </SelectContent>
                        </Select>

                        <Select value={departmentId} onValueChange={setDepartmentId}>
                            <SelectTrigger className="h-10 w-[220px] bg-muted/30">
                                <SelectValue placeholder="Хэлтэс" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Бүх хэлтэс</SelectItem>
                                {(departments || []).map((d) => (
                                    <SelectItem key={d.id} value={d.id}>
                                        {d.name || d.id}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <Select value={type} onValueChange={setType}>
                            <SelectTrigger className="h-10 w-[170px] bg-muted/30">
                                <SelectValue placeholder="Төрөл" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Бүгд</SelectItem>
                                {(employmentTypes || []).map((et: any) => (
                                    <SelectItem key={et.id} value={et.id}>
                                        {et.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <Select value={sort} onValueChange={(v) => setSort(v as any)}>
                            <SelectTrigger className="h-10 w-[170px] bg-muted/30">
                                <SelectValue placeholder="Эрэмбэ" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="newest">Шинээс</SelectItem>
                                <SelectItem value="oldest">Хуучнаас</SelectItem>
                                <SelectItem value="deadline">Дуусах огноо</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <AddActionButton
                        label="Шинэ зар"
                        description="Нээлттэй ажлын байр нэмэх"
                        onClick={() => setIsCreateOpen(true)}
                        className="shrink-0"
                    />
                </div>
            </Card>
            <CreateVacancyDialog
                departments={departments || []}
                open={isCreateOpen}
                onOpenChange={setIsCreateOpen}
                hideTrigger={true}
            />

            {!filtered.length ? (
                <div className="rounded-2xl border bg-muted/20 text-center py-16 text-muted-foreground">
                    Одоогоор нээлттэй зар олдсонгүй.
                </div>
            ) : (
                <div className={cn('grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4')}>
                    {filtered.map((vacancy) => (
                        <OpenVacancyCard
                            key={vacancy.id}
                            vacancy={vacancy}
                            departmentName={getDeptName(vacancy.departmentId)}
                            departmentColor={getDeptColor(vacancy.departmentId)}
                            employmentTypeName={getEmpTypeName(vacancy.employmentTypeId)}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
