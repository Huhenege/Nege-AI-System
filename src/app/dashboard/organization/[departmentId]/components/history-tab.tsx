'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    History as HistoryIcon,
    Calendar,
    ChevronRight,
    ChevronDown,
    Users,
    User,
    ArrowRight,
    Search,
    Info
} from 'lucide-react';
import { useFirebase, useCollection, useMemoFirebase, tenantCollection } from '@/firebase';
import { collection, query, where, orderBy } from 'firebase/firestore';
import { Department, DepartmentHistory } from '@/app/dashboard/organization/types';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

interface HistoryTabProps {
    departmentId: string;
}

export const HistoryTab = ({ departmentId }: HistoryTabProps) => {
    const { firestore } = useFirebase();
    const [expandedSnapshot, setExpandedSnapshot] = useState<string | null>(null);

    const historyQuery = useMemoFirebase(({ firestore, companyPath }) => {
        if (!firestore || !departmentId) return null;
        return query(
            tenantCollection(firestore, companyPath, 'departmentHistory'),
            where('departmentId', '==', departmentId)
        );
    }, [firestore, departmentId]);

    const { data: rawHistory, isLoading } = useCollection<DepartmentHistory>(historyQuery);

    const history = React.useMemo(() => {
        if (!rawHistory) return null;
        return [...rawHistory].sort((a, b) =>
            new Date(b.approvedAt).getTime() - new Date(a.approvedAt).getTime()
        );
    }, [rawHistory]);

    if (isLoading) {
        return (
            <div className="space-y-4">
                {[1, 2, 3].map(i => (
                    <Skeleton key={i} className="h-20 w-full rounded-xl" />
                ))}
            </div>
        );
    }

    if (!history || history.length === 0) {
        return (
            <Card className="border-dashed border-2 bg-muted/5">
                <CardContent className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground">
                    <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                        <HistoryIcon className="w-8 h-8 opacity-20" />
                    </div>
                    <h3 className="text-lg font-semibold">Түүхэн мэдээлэл байхгүй</h3>
                    <p className="max-w-sm mt-1">Одоогоор энэ нэгжийн бүтэц батлагдаагүй байна. Бүтэц батлагдсаны дараа түүх хадгалагдана.</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                    <HistoryIcon className="w-5 h-5 text-primary" />
                    Бүтцийн өөрчлөлтийн түүх
                </h3>
                <Badge variant="outline" className="font-semibold">{history.length} хувилбар</Badge>
            </div>

            <div className="space-y-3">
                {history.map((record, index) => (
                    <Card
                        key={record.id}
                        className={cn(
                            "overflow-hidden border-border/50 transition-all",
                            expandedSnapshot === record.id ? "ring-1 ring-primary shadow-md" : "hover:bg-muted/30"
                        )}
                    >
                        <div
                            className="p-4 cursor-pointer flex items-center justify-between"
                            onClick={() => setExpandedSnapshot(expandedSnapshot === record.id ? null : record.id)}
                        >
                            <div className="flex items-center gap-4">
                                <div className={cn(
                                    "w-12 h-12 rounded-xl flex flex-col items-center justify-center border border-border/50",
                                    index === 0 ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-muted/50 text-muted-foreground"
                                )}>
                                    <span className="text-[10px] font-semibold uppercase leading-none">V{history.length - index}</span>
                                    <span className="text-xs font-semibold">{format(new Date(record.approvedAt), 'MM/dd')}</span>
                                </div>
                                <div className="space-y-0.5">
                                    <div className="flex items-center gap-2">
                                        <p className="font-semibold">Батлагдсан: {format(new Date(record.approvedAt), 'yyyy-MM-dd HH:mm')}</p>
                                        {index === 0 && <Badge className="bg-emerald-500 hover:bg-emerald-600">Одоогийн</Badge>}
                                    </div>
                                    <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                                        <Calendar className="w-3 h-3" />
                                        {record.validTo ? (
                                            <>Хүчинтэй хугацаа: {format(new Date(record.approvedAt), 'yyyy-MM-dd')} ~ {format(new Date(record.validTo), 'yyyy-MM-dd')}</>
                                        ) : (
                                            <>Хүчинтэй хугацаа: {format(new Date(record.approvedAt), 'yyyy-MM-dd')} ~ Одоог хүртэл</>
                                        )}
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-4">
                                <div className="hidden md:flex flex-col items-end text-right">
                                    <p className="text-xs font-semibold">{record.snapshot.positions.length} Ажлын байр</p>
                                    <p className="text-[10px] text-muted-foreground">
                                        {record.snapshot.positions.reduce((acc, p) => acc + (p.employees?.length || 0), 0)} Ажилтан
                                    </p>
                                </div>
                                {expandedSnapshot === record.id ? <ChevronDown className="w-5 h-5 text-muted-foreground" /> : <ChevronRight className="w-5 h-5 text-muted-foreground" />}
                            </div>
                        </div>

                        {expandedSnapshot === record.id && (
                            <CardContent className="pt-0 pb-6 px-6 border-t border-border/50 bg-muted/10">
                                <div className="mt-4 space-y-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {record.snapshot.positions.map(pos => (
                                            <div key={pos.id} className="p-3 rounded-lg border border-border/50 bg-background shadow-sm hover:border-primary/30 transition-colors">
                                                <div className="flex justify-between items-start mb-2">
                                                    <div>
                                                        <p className="font-semibold text-sm leading-tight">{pos.title}</p>
                                                        <Badge variant="outline" className="text-[10px] mt-1 h-5">{pos.levelName || 'Түвшин -'}</Badge>
                                                    </div>
                                                    <div className="flex items-center gap-1 text-[10px] font-semibold text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                                                        <Users className="w-3 h-3" />
                                                        {pos.employees?.length || 0}
                                                    </div>
                                                </div>

                                                <div className="space-y-1">
                                                    {pos.employees && pos.employees.length > 0 ? (
                                                        pos.employees.map(emp => (
                                                            <div key={emp.id} className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/30 p-1.5 rounded-md">
                                                                <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-semibold text-primary">
                                                                    {emp.firstName?.substring(0, 1)}
                                                                </div>
                                                                <span className="font-medium text-foreground">{emp.lastName} {emp.firstName}</span>
                                                                <span className="text-[10px] opacity-60 ml-auto">{emp.employeeCode}</span>
                                                            </div>
                                                        ))
                                                    ) : (
                                                        <p className="text-[10px] text-center py-2 italic text-muted-foreground">Эн сул орон тоо...</p>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="p-4 rounded-xl bg-primary/5 border border-primary/10 flex items-start gap-3">
                                        <Info className="w-5 h-5 text-primary mt-0.5" />
                                        <div className="space-y-1">
                                            <p className="text-xs font-semibold text-primary">Статик хуулбар</p>
                                            <p className="text-[11px] leading-relaxed text-muted-foreground">
                                                Энэ нь тухайн үеийн бүтцийн статик зураглал юм. Ажилтнууд нэгж хооронд шилжсэн эсвэл ажлаас гарсан ч энэ түүхэн мэдээлэл өөрчлөгдөхгүй.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        )}
                    </Card>
                ))}
            </div>
        </div>
    );
};
