'use client';

import React, { useState } from 'react';
import { PageHeader } from '@/components/patterns/page-layout';
import {
    useFirebase,
    useCollection,
    useMemoFirebase,
    tenantCollection,
} from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { DepartmentHistory } from '../types';
import { format } from 'date-fns';
import { mn } from 'date-fns/locale';
import {
    History,
    Building2,
    Users,
    Clock,
    ChevronDown,
    AlertCircle,
    FileText,
    ChevronLeft
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useRouter } from 'next/navigation';

export default function OrganizationHistoryPage() {
    const { firestore } = useFirebase();
    const router = useRouter();
    const [expandedIds, setExpandedIds] = useState<string[]>([]);

    const historyQuery = useMemoFirebase(({ firestore, companyPath }) =>
        firestore ? query(tenantCollection(firestore, companyPath, 'departmentHistory'), orderBy('approvedAt', 'desc')) : null
        , [firestore]);

    const { data: history, isLoading } = useCollection<DepartmentHistory>(historyQuery);

    const toggleExpand = (id: string) => {
        setExpandedIds(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    return (
        <div className="flex flex-col h-full bg-slate-50/50">
            <div className="p-6 md:p-8 space-y-6 max-w-5xl mx-auto w-full">
                <PageHeader
                    title="Бүтцийн өөрчлөлтийн түүх"
                    description="Байгууллагын бүтэц, нэгжүүдийн түүхэн өөрчлөлтүүд болон татан буугдсан нэгжүүд."
                    showBackButton
                    backHref="/dashboard/organization"
                />

                <div className="space-y-4 pb-20">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center h-64 space-y-4">
                            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
                            <p className="text-sm font-medium text-slate-500 italic">Түүхэн мэдээллийг ачаалж байна...</p>
                        </div>
                    ) : !history || history.length === 0 ? (
                        <Card className="border-dashed border-2 bg-transparent shadow-none">
                            <CardContent className="flex flex-col items-center justify-center h-64 text-center space-y-3 p-6">
                                <div className="p-4 bg-slate-100 rounded-full">
                                    <FileText className="h-10 w-10 text-slate-400" />
                                </div>
                                <p className="text-slate-500 font-medium tracking-tight">Өөрчлөлтийн түүх одоогоор байхгүй байна.</p>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="space-y-4">
                            {history.map((record) => {
                                const isExpanded = expandedIds.includes(record.id);
                                const isDissolution = record.isDissolution;
                                const snapshot = record.snapshot;
                                const date = new Date(record.approvedAt);

                                return (
                                    <div
                                        key={record.id}
                                        className={cn(
                                            "group bg-white rounded-3xl border border-slate-100 shadow-sm transition-all duration-300 overflow-hidden",
                                            isExpanded ? "ring-4 ring-primary/5 border-primary/20 shadow-xl" : "hover:border-slate-200 hover:shadow-md"
                                        )}
                                    >
                                        <div
                                            className="p-5 cursor-pointer flex items-center justify-between gap-4"
                                            onClick={() => toggleExpand(record.id)}
                                        >
                                            <div className="flex items-center gap-5 flex-1 min-w-0">
                                                <div className={cn(
                                                    "h-14 w-14 rounded-2xl flex items-center justify-center shrink-0 transition-all duration-300",
                                                    isDissolution
                                                        ? "bg-red-50 text-red-600 group-hover:bg-red-100"
                                                        : "bg-emerald-50 text-emerald-600 group-hover:bg-emerald-100"
                                                )}>
                                                    {isDissolution ? <AlertCircle className="h-7 w-7" /> : <Building2 className="h-7 w-7" />}
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="font-bold text-lg text-slate-900 truncate">
                                                            {snapshot?.departmentName || 'Үл мэдэгдэх нэгж'}
                                                        </span>
                                                        {isDissolution && (
                                                            <Badge variant="destructive" className="text-[10px] px-2 py-0.5 rounded-full font-black uppercase tracking-widest bg-red-100 text-red-700 border-none shadow-sm">
                                                                Татан буугдсан
                                                            </Badge>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-4 text-xs text-slate-500 font-bold uppercase tracking-widest">
                                                        <span className="flex items-center gap-1.5">
                                                            <Clock className="h-3.5 w-3.5" />
                                                            {format(date, 'yyyy/MM/dd HH:mm', { locale: mn })}
                                                        </span>
                                                        <span className="flex items-center gap-1.5 opacity-60">
                                                            <Users className="h-3.5 w-3.5" />
                                                            {snapshot?.positions?.length || 0} Ажлын байр
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className={cn(
                                                        "h-10 w-10 rounded-2xl transition-all duration-300",
                                                        isExpanded ? "rotate-0 bg-slate-100 text-primary" : "-rotate-90 text-slate-400 group-hover:text-primary"
                                                    )}
                                                >
                                                    <ChevronDown className="h-5 w-5" />
                                                </Button>
                                            </div>
                                        </div>

                                        {isExpanded && (
                                            <div className="px-6 pb-6 pt-0 animate-in slide-in-from-top-4 fade-in duration-300">
                                                <div className="h-px bg-slate-100 mb-6" />

                                                <div className="space-y-8">
                                                    {record.isDissolution && (
                                                        <div className="p-5 bg-slate-50/80 rounded-2xl border border-slate-100 relative overflow-hidden group/reason">
                                                            <div className="absolute top-0 left-0 w-1 h-full bg-red-400" />
                                                            <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3">Татан буулгасан шалтгаан</h5>
                                                            <p className="text-sm text-slate-700 font-bold leading-relaxed">
                                                                {snapshot?.disbandReason || 'Шалтгаан тодорхойгүй'}
                                                            </p>
                                                            <div className="mt-4 pt-4 border-t border-slate-200/50 flex items-center justify-between">
                                                                <div className="flex items-center gap-2 text-[10px] text-slate-400 font-black uppercase tracking-widest">
                                                                    <Users className="h-3 w-3" />
                                                                    Гүйцэтгэсэн: <span className="text-slate-600">{snapshot?.disbandedByName || 'Систем'}</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}

                                                    <div className="space-y-4">
                                                        <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.3em] mb-4 flex items-center gap-2.5">
                                                            <div className="h-1 w-8 bg-primary/20 rounded-full" />
                                                            Бүтэц ба Ажилтнууд
                                                        </h4>
                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                            {snapshot?.positions?.length > 0 ? (
                                                                snapshot.positions.map((pos: any, idx: number) => (
                                                                    <div key={idx} className="p-5 bg-white rounded-3xl border border-slate-100 shadow-sm space-y-4 group/pos hover:border-primary/20 hover:shadow-md transition-all">
                                                                        <div className="flex items-center justify-between gap-3">
                                                                            <span className="text-sm font-black text-slate-900 leading-tight">{pos.title}</span>
                                                                            <Badge variant="secondary" className="text-[10px] font-black px-2 py-0.5 rounded-lg bg-slate-100 text-slate-600">
                                                                                {pos.code}
                                                                            </Badge>
                                                                        </div>

                                                                        {pos.employees && pos.employees.length > 0 ? (
                                                                            <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-50">
                                                                                {pos.employees.map((emp: any, eIdx: number) => (
                                                                                    <div
                                                                                        key={eIdx}
                                                                                        className="bg-primary/5 text-[11px] font-bold py-1.5 px-3 rounded-xl border border-primary/10 text-primary flex items-center gap-2"
                                                                                    >
                                                                                        <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                                                                                        {emp.lastName.substring(0, 1)}. {emp.firstName}
                                                                                        <span className="opacity-50 font-black">#{emp.employeeCode}</span>
                                                                                    </div>
                                                                                ))}
                                                                            </div>
                                                                        ) : (
                                                                            <div className="text-[10px] text-slate-300 font-black uppercase tracking-widest text-center py-2 bg-slate-50/50 rounded-xl">Сул орон тоо</div>
                                                                        )}
                                                                    </div>
                                                                ))
                                                            ) : (
                                                                <div className="col-span-full text-sm text-slate-400 py-10 border-dashed border-2 rounded-3xl border-slate-100 text-center italic font-medium">Мэдээлэл олдсонгүй</div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
