'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Department, DepartmentType } from '@/app/dashboard/organization/types';
import {
    Users,
    Calendar,
    Hash,
    Briefcase,
    Target,
    Info,
    Building2,
    User,
    CheckCircle2,
    XCircle,
    ArrowUpRight,
    Loader2
} from 'lucide-react';
import { useCollection, useMemoFirebase, useFirebase, useDoc, tenantCollection, tenantDoc } from '@/firebase';
import { collection, doc, query, where } from 'firebase/firestore';
import { format } from 'date-fns';
import { Employee } from '@/app/dashboard/employees/data';
import { AssignManagerDialog } from './assign-manager-dialog';
import { Position } from '@/app/dashboard/organization/types';

interface OverviewTabProps {
    department: Department;
}

export const OverviewTab = ({ department }: OverviewTabProps) => {
    const { firestore } = useFirebase();

    const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);

    // Queries for display names
    const typesQuery = useMemoFirebase(({ firestore, companyPath }) => (firestore ? tenantCollection(firestore, companyPath, 'departmentTypes') : null), [firestore]);
    const deptsQuery = useMemoFirebase(({ firestore, companyPath }) => (firestore ? tenantCollection(firestore, companyPath, 'departments') : null), [firestore]);

    // Fetch the lead position details
    const leadPositionRef = useMemoFirebase(({ firestore, companyPath }) =>
        (firestore && department.managerPositionId ? tenantDoc(firestore, companyPath, 'positions', department.managerPositionId) : null),
        [firestore, department.managerPositionId]
    );

    // Fetch employees holding this lead position
    const leadEmployeesQuery = useMemoFirebase(({ firestore, companyPath }) => {
        if (!firestore || !department.managerPositionId) return null;
        return query(
            tenantCollection(firestore, companyPath, 'employees'),
            where('positionId', '==', department.managerPositionId),
            where('departmentId', '==', department.id)
        );
    }, [firestore, department.managerPositionId, department.id]);

    const { data: departmentTypes } = useCollection<DepartmentType>(typesQuery);
    const { data: allDepartments } = useCollection<Department>(deptsQuery);
    const { data: leadPosition, isLoading: isPositionLoading } = useDoc<Position>(leadPositionRef as any);
    const { data: leadEmployees, isLoading: isEmployeesLoading } = useCollection<Employee>(leadEmployeesQuery);

    const typeName = departmentTypes?.find(t => t.id === department.typeId)?.name || 'Тодорхойгүй';
    const parentName = allDepartments?.find(d => d.id === department.parentId)?.name || 'Байхгүй (Үндсэн)';

    const isManagementLoading = isPositionLoading || isEmployeesLoading;

    return (
        <div className="space-y-6 max-w-7xl">
            {/* Quick Stats & Identity */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="md:col-span-2 overflow-hidden border-none shadow-md bg-gradient-to-br from-card to-muted/20">
                    <div className="absolute top-0 left-0 w-1 h-full" style={{ backgroundColor: department.color || 'var(--primary)' }} />
                    <CardHeader className="pb-4">
                        <div className="flex justify-between items-start">
                            <div className="space-y-1">
                                <CardTitle className="text-2xl font-semibold uppercase tracking-tight">{department.name}</CardTitle>
                                <CardDescription className="flex items-center gap-2">
                                    <Badge variant="secondary" className="font-semibold">{typeName}</Badge>
                                    <span className="text-muted-foreground">•</span>
                                    {department.status === 'active' ? (
                                        <Badge variant="outline" className="text-emerald-500 border-emerald-500/20 bg-emerald-500/5 gap-1">
                                            <CheckCircle2 className="w-3 h-3" /> Идэвхтэй
                                        </Badge>
                                    ) : (
                                        <Badge variant="outline" className="text-destructive border-destructive/20 bg-destructive/5 gap-1">
                                            <XCircle className="w-3 h-3" /> Идэвхгүй
                                        </Badge>
                                    )}
                                </CardDescription>
                            </div>
                            <div className="h-12 w-12 rounded-xl flex items-center justify-center bg-background shadow-sm border border-border/50 text-xl font-semibold" style={{ color: department.color || 'var(--primary)' }}>
                                {department.code?.substring(0, 2) || '??'}
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                            <div className="space-y-1">
                                <p className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider">Албан код</p>
                                <p className="font-semibold text-sm">
                                    {department.code || '-'}
                                </p>
                            </div>
                            <div className="space-y-1">
                                <p className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider">Харьяалагдах нэгж</p>
                                <p className="font-semibold text-sm">
                                    {parentName}
                                </p>
                            </div>
                            <div className="space-y-1">
                                <p className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider">Нийт ажилтан</p>
                                <p className="font-semibold text-sm">
                                    {department.filled || 0}
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-none shadow-md bg-primary text-primary-foreground relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform">
                        <Briefcase className="w-24 h-24" />
                    </div>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-semibold uppercase tracking-widest opacity-80">Удирдлага</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex flex-col gap-3">
                            {isManagementLoading ? (
                                <div className="space-y-3">
                                    <div className="h-4 w-32 bg-primary-foreground/20 animate-pulse rounded" />
                                    <div className="flex -space-x-2">
                                        {[1, 2, 3].map(i => (
                                            <div key={i} className="w-8 h-8 rounded-full bg-primary-foreground/20 animate-pulse border-2 border-primary" />
                                        ))}
                                    </div>
                                </div>
                            ) : leadPosition ? (
                                <>
                                    <div className="space-y-1">
                                        <h3 className="font-semibold text-lg leading-tight truncate">
                                            {leadPosition.title}
                                        </h3>
                                        <p className="text-xs opacity-70">Толгой албан тушаал</p>
                                    </div>

                                    <div className="flex items-center gap-2 pt-1">
                                        {leadEmployees && leadEmployees.length > 0 ? (
                                            <div className="flex -space-x-2 overflow-hidden">
                                                {leadEmployees.slice(0, 4).map(emp => (
                                                    <Avatar key={emp.id} className="w-8 h-8 border-2 border-primary">
                                                        {emp.photoURL ? (
                                                            <AvatarImage src={emp.photoURL} />
                                                        ) : (
                                                            <AvatarFallback className="bg-primary/20 text-[10px] font-semibold">
                                                                {emp.firstName?.substring(0, 1)}
                                                            </AvatarFallback>
                                                        )}
                                                    </Avatar>
                                                ))}
                                                {leadEmployees.length > 4 && (
                                                    <div className="w-8 h-8 rounded-full bg-primary-foreground/20 border-2 border-primary flex items-center justify-center text-[10px] font-semibold">
                                                        +{leadEmployees.length - 4}
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <p className="text-xs italic opacity-60">Одоогоор ажилтан томилогдоогүй</p>
                                        )}
                                    </div>
                                </>
                            ) : (
                                <div className="space-y-2">
                                    <h3 className="font-semibold text-lg leading-tight">Тохируулаагүй</h3>
                                    <p className="text-xs opacity-70">Энэ нэгжийн толгой албан тушаалыг сонгоно уу.</p>
                                </div>
                            )}
                        </div>
                        <Button
                            variant="secondary"
                            size="sm"
                            className="w-full font-semibold shadow-sm mt-2"
                            onClick={() => setIsAssignDialogOpen(true)}
                        >
                            {leadPosition ? 'Өөрчлөх' : 'Тохируулах'} <ArrowUpRight className="w-4 h-4 ml-1" />
                        </Button>
                    </CardContent>
                </Card>
            </div>

            <AssignManagerDialog
                open={isAssignDialogOpen}
                onOpenChange={setIsAssignDialogOpen}
                department={department}
            />

            {/* Content & Mission */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="border-none shadow-sm hover:shadow-md transition-shadow">
                    <CardHeader className="pb-2">
                        <div>
                            <CardTitle className="text-lg uppercase tracking-widest font-bold">Чиг үүрэг</CardTitle>
                            <CardDescription>Нэгжийн үндсэн үүрэг хариуцлага.</CardDescription>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {department.description ? (
                            <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">
                                {department.description}
                            </p>
                        ) : (
                            <div className="py-6 text-center text-muted-foreground italic text-sm">
                                <Info className="w-8 h-8 mx-auto mb-2 opacity-20" />
                                Чиг үүрэг бүртгэгдээгүй байна...
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card className="border-none shadow-sm hover:shadow-md transition-shadow">
                    <CardHeader className="pb-2">
                        <div>
                            <CardTitle className="text-lg uppercase tracking-widest font-bold">Зорилго</CardTitle>
                            <CardDescription>Нэгжийн хэтийн зорилго болон алсын хараа.</CardDescription>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {department.vision ? (
                            <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">
                                {department.vision}
                            </p>
                        ) : (
                            <div className="py-6 text-center text-muted-foreground italic text-sm">
                                <Target className="w-8 h-8 mx-auto mb-2 opacity-20" />
                                Зорилго бүртгэгдээгүй байна...
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Stats Card */}
            <Card className="border-none shadow-sm overflow-hidden">
                <CardHeader className="pb-3 border-b border-border/50 bg-muted/20">
                    <CardTitle className="text-sm uppercase tracking-widest font-bold">
                        Орон тооны үзүүлэлт
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-border/50">
                        <div className="p-6 text-center">
                            <p className="text-3xl font-semibold text-primary mb-1">{department.filled || 0}</p>
                            <p className="text-[10px] text-muted-foreground uppercase font-semibold tracking-widest">Нийт ажилтан</p>
                        </div>
                        <div className="p-6 text-center">
                            <p className="text-3xl font-semibold text-muted-foreground mb-1">-</p>
                            <p className="text-[10px] text-muted-foreground uppercase font-semibold tracking-widest">Батлагдсан орон тоо</p>
                        </div>
                        <div className="p-6 text-center">
                            <p className="text-3xl font-semibold text-muted-foreground mb-1">-</p>
                            <p className="text-[10px] text-muted-foreground uppercase font-semibold tracking-widest">Empty Positions</p>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};
