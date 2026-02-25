'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import { collection, query, where } from 'firebase/firestore';
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { useEmployeeProfile } from '@/hooks/use-employee-profile';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ClipboardList, Clock } from 'lucide-react';
import type { Survey } from '@/app/dashboard/survey/types';

export default function MobileSurveyListPage() {
    const { firestore } = useFirebase();
    const { employeeProfile } = useEmployeeProfile();

    const surveysQuery = useMemoFirebase(
        () => firestore ? query(collection(firestore, 'surveys'), where('status', '==', 'active')) : null,
        [firestore]
    );
    const { data: allSurveys, isLoading } = useCollection<Survey>(surveysQuery);

    const surveys = useMemo(() => {
        if (!allSurveys || !employeeProfile) return [];
        return allSurveys.filter(s => {
            if (s.targetAudience === 'all') return true;
            if (!s.targetIds || s.targetIds.length === 0) return true;
            return s.targetIds.includes(employeeProfile.id);
        });
    }, [allSurveys, employeeProfile]);

    const isLoadingAll = isLoading || !employeeProfile;

    return (
        <div className="flex flex-col min-h-full">
            <div className="sticky top-0 z-10 bg-background border-b px-4 py-3">
                <div className="flex items-center gap-3">
                    <Link href="/mobile/home">
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                    </Link>
                    <div>
                        <h1 className="text-base font-semibold">Санал асуулга</h1>
                        <p className="text-xs text-muted-foreground">Хариулах санал асуулгууд</p>
                    </div>
                </div>
            </div>

            <div className="flex-1 p-4 space-y-3">
                {isLoadingAll ? (
                    Array.from({ length: 3 }).map((_, i) => (
                        <Card key={i}>
                            <CardContent className="p-4">
                                <Skeleton className="h-5 w-3/4 mb-2" />
                                <Skeleton className="h-4 w-full mb-2" />
                                <Skeleton className="h-8 w-24" />
                            </CardContent>
                        </Card>
                    ))
                ) : surveys.length === 0 ? (
                    <div className="flex flex-col items-center text-center py-16">
                        <ClipboardList className="h-12 w-12 text-muted-foreground/30 mb-3" />
                        <p className="text-sm text-muted-foreground">
                            Одоогоор хариулах санал асуулга байхгүй байна
                        </p>
                    </div>
                ) : (
                    surveys.map(survey => (
                        <Link key={survey.id} href={`/mobile/survey/${survey.id}`}>
                            <Card className="hover:shadow-md transition-shadow">
                                <CardContent className="p-4 space-y-2">
                                    <div className="flex items-start justify-between gap-2">
                                        <h3 className="font-medium text-sm">{survey.title}</h3>
                                        {survey.isAnonymous && (
                                            <Badge variant="outline" className="text-[10px] flex-shrink-0">Нэргүй</Badge>
                                        )}
                                    </div>
                                    {survey.description && (
                                        <p className="text-xs text-muted-foreground line-clamp-2">
                                            {survey.description}
                                        </p>
                                    )}
                                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                        <span className="flex items-center gap-1">
                                            <ClipboardList className="h-3 w-3" />
                                            {survey.questionsCount} асуулт
                                        </span>
                                        {survey.endDate && (
                                            <span className="flex items-center gap-1">
                                                <Clock className="h-3 w-3" />
                                                {survey.endDate}
                                            </span>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        </Link>
                    ))
                )}
            </div>
        </div>
    );
}
