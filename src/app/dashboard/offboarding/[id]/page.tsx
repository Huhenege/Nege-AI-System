'use client';

import React from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useCollection, useFirebase, useMemoFirebase, tenantCollection } from '@/firebase';
import { query, where } from 'firebase/firestore';
import { Project } from '@/types/project';
import { Button } from '@/components/ui/button';

export default function OffboardingEmployeeRedirectPage() {
    const params = useParams();
    const router = useRouter();
    const employeeId = (Array.isArray(params?.id) ? params.id[0] : params?.id) as string;
    const { firestore } = useFirebase();

    const projectsQuery = useMemoFirebase(({ firestore, companyPath }) => {
        if (!firestore || !employeeId) return null;
        return query(
            tenantCollection(firestore, companyPath, 'projects'),
            where('type', '==', 'offboarding'),
            where('offboardingEmployeeId', '==', employeeId)
        );
    }, [firestore, employeeId]);

    const { data: projects, isLoading } = useCollection<Project>(projectsQuery as any);

    React.useEffect(() => {
        if (isLoading) return;
        const sorted = [...(projects || [])].sort((a, b) => (a.stageOrder || 0) - (b.stageOrder || 0));
        const first = sorted[0];
        if (first?.id) {
            router.replace(`/dashboard/projects/${first.id}`);
        }
    }, [isLoading, projects, router]);

    if (isLoading) {
        return <div className="p-8 text-center animate-pulse">Ачаалж байна...</div>;
    }

    return (
        <div className="p-10 text-center text-muted-foreground space-y-4">
            <div>Энэ ажилтанд offboarding төсөл олдсонгүй.</div>
            <Button onClick={() => router.push('/dashboard/offboarding')}>Offboarding руу буцах</Button>
        </div>
    );
}

