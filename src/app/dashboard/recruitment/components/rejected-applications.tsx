'use client';

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useCollection, useFirebase, useMemoFirebase, tenantCollection } from '@/firebase';
import { query, where } from 'firebase/firestore';
import { JobApplication, RejectionCategory } from '@/types/recruitment';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ExternalLink, ShieldAlert, Archive, BookmarkCheck, User, Briefcase, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

const CATEGORY_CONFIG: Record<RejectionCategory, { label: string; icon: React.ReactNode; color: string; emptyText: string }> = {
    reserve: {
        label: 'Нөөц',
        icon: <BookmarkCheck className="h-4 w-4" />,
        color: 'text-blue-600 border-blue-200 bg-blue-50',
        emptyText: 'Нөөцөд бүртгэгдсэн горилогч байхгүй байна.',
    },
    blacklist: {
        label: 'Хар жагсаалт',
        icon: <ShieldAlert className="h-4 w-4" />,
        color: 'text-slate-800 border-slate-300 bg-slate-100',
        emptyText: 'Хар жагсаалтад горилогч байхгүй байна.',
    },
    archive: {
        label: 'Архив',
        icon: <Archive className="h-4 w-4" />,
        color: 'text-gray-600 border-gray-200 bg-gray-50',
        emptyText: 'Архивлагдсан анкет байхгүй байна.',
    },
};

const TYPE_LABELS: Record<string, string> = {
    employer: 'Ажил олгогчоос',
    candidate: 'Горилогчоос',
};

export function RejectedApplications() {
    const router = useRouter();
    const { firestore } = useFirebase();
    const [activeTab, setActiveTab] = useState<RejectionCategory>('reserve');

    const rejectedQuery = useMemoFirebase(
        ({ firestore, companyPath }) => (firestore ? query(tenantCollection(firestore, companyPath, 'applications'), where('status', '==', 'REJECTED')) : null),
        [firestore]
    );
    const { data: rejectedApps, isLoading } = useCollection<JobApplication>(rejectedQuery as any);

    const grouped = useMemo(() => {
        if (!rejectedApps) return { reserve: [], blacklist: [], archive: [] };
        const result: Record<RejectionCategory, JobApplication[]> = { reserve: [], blacklist: [], archive: [] };
        rejectedApps.forEach(app => {
            const cat = app.rejectionCategory || 'archive';
            if (result[cat]) result[cat].push(app);
            else result.archive.push(app);
        });
        Object.values(result).forEach(arr => arr.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()));
        return result;
    }, [rejectedApps]);

    if (isLoading) {
        return <div className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-64 w-full" />
        </div>;
    }

    const totalCount = rejectedApps?.length || 0;

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-semibold">Татгалзсан анкетууд</h2>
                    <p className="text-sm text-muted-foreground">Нийт {totalCount} анкет</p>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {(['reserve', 'blacklist', 'archive'] as RejectionCategory[]).map(cat => (
                        <Badge key={cat} variant="outline" className={cn("gap-1", CATEGORY_CONFIG[cat].color)}>
                            {CATEGORY_CONFIG[cat].icon}
                            {CATEGORY_CONFIG[cat].label}: {grouped[cat].length}
                        </Badge>
                    ))}
                </div>
            </div>

            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as RejectionCategory)}>
                <TabsList className="grid grid-cols-3 w-full max-w-md">
                    {(['reserve', 'blacklist', 'archive'] as RejectionCategory[]).map(cat => (
                        <TabsTrigger key={cat} value={cat} className="gap-1.5 text-xs">
                            {CATEGORY_CONFIG[cat].icon}
                            {CATEGORY_CONFIG[cat].label} ({grouped[cat].length})
                        </TabsTrigger>
                    ))}
                </TabsList>

                {(['reserve', 'blacklist', 'archive'] as RejectionCategory[]).map(cat => (
                    <TabsContent key={cat} value={cat} className="mt-4">
                        {grouped[cat].length === 0 ? (
                            <Card>
                                <CardContent className="py-12 text-center text-muted-foreground">
                                    {CATEGORY_CONFIG[cat].emptyText}
                                </CardContent>
                            </Card>
                        ) : (
                            <div className="space-y-2">
                                {grouped[cat].map(app => (
                                    <Card key={app.id} className="hover:shadow-md transition-shadow">
                                        <CardContent className="p-4">
                                            <div className="flex items-center justify-between gap-4">
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <User className="h-4 w-4 text-muted-foreground shrink-0" />
                                                        <span className="font-semibold text-sm truncate">
                                                            {app.candidate
                                                                ? `${app.candidate.lastName || ''} ${app.candidate.firstName || ''}`.trim()
                                                                : app.candidateId}
                                                        </span>
                                                        {app.rejectionType && (
                                                            <Badge variant="outline" className={cn("text-[10px] shrink-0",
                                                                app.rejectionType === 'employer' ? "border-red-200 text-red-600" : "border-orange-200 text-orange-600"
                                                            )}>
                                                                {TYPE_LABELS[app.rejectionType] || app.rejectionType}
                                                            </Badge>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                                        <span className="flex items-center gap-1">
                                                            <Briefcase className="h-3 w-3" />
                                                            {app.vacancy?.title || app.vacancyId}
                                                        </span>
                                                        <span className="flex items-center gap-1">
                                                            <Calendar className="h-3 w-3" />
                                                            {app.updatedAt ? format(new Date(app.updatedAt), 'yyyy.MM.dd') : '—'}
                                                        </span>
                                                    </div>
                                                    {app.rejectionReason && (
                                                        <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                                                            Шалтгаан: {app.rejectionReason}
                                                        </p>
                                                    )}
                                                </div>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="shrink-0 gap-1.5"
                                                    onClick={() => router.push(`/dashboard/recruitment/applications/${app.id}`)}
                                                >
                                                    <ExternalLink className="h-3.5 w-3.5" />
                                                    Дэлгэрэнгүй
                                                </Button>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        )}
                    </TabsContent>
                ))}
            </Tabs>
        </div>
    );
}
