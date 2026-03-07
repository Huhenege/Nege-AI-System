'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useFirebase, useCollection, useMemoFirebase, tenantCollection } from '@/firebase';
import { query, where } from 'firebase/firestore';
import { Loader2, FolderKanban, AlertCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Project } from '@/types/project';

/**
 * This page now redirects to the project-based onboarding system.
 * The old onboarding_processes system has been replaced with projects.
 */
export default function OnboardingDetailRedirectPage() {
    const params = useParams();
    const router = useRouter();
    const { firestore } = useFirebase();
    const employeeId = params.id as string;

    // Fetch onboarding projects for this employee
    const projectsQuery = useMemoFirebase(({ firestore, companyPath }) =>
        firestore && employeeId
            ? query(
                tenantCollection(firestore, companyPath, 'projects'),
                where('type', '==', 'onboarding'),
                where('onboardingEmployeeId', '==', employeeId)
            )
            : null
        , [firestore, employeeId]);
    const { data: projects, isLoading } = useCollection<Project>(projectsQuery as any);

    const [redirecting, setRedirecting] = useState(false);

    useEffect(() => {
        if (!isLoading && projects) {
            if (projects.length > 0) {
                // Sort by stageOrder and redirect to first project
                const sortedProjects = [...projects].sort((a, b) => (a.stageOrder || 0) - (b.stageOrder || 0));
                const firstProject = sortedProjects[0];
                setRedirecting(true);
                router.replace(`/dashboard/projects/${firstProject.id}`);
            }
        }
    }, [isLoading, projects, router]);

    if (isLoading || redirecting) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center space-y-4">
                    <Loader2 className="h-8 w-8 animate-spin text-indigo-500 mx-auto" />
                    <p className="text-sm text-slate-500">Төсөл рүү шилжүүлж байна...</p>
                </div>
            </div>
        );
    }

    // No projects found for this employee
    return (
        <div className="py-6 px-4 sm:px-6 min-h-screen container mx-auto max-w-2xl">
            <Card className="border-none shadow-sm bg-white rounded-3xl overflow-hidden">
                <CardContent className="p-12 text-center space-y-6">
                    <div className="h-20 w-20 bg-amber-50 rounded-full flex items-center justify-center mx-auto">
                        <AlertCircle className="h-10 w-10 text-amber-500" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-slate-800 mb-2">Onboarding төсөл олдсонгүй</h2>
                        <p className="text-slate-500 text-sm max-w-sm mx-auto">
                            Энэ ажилтны хувьд onboarding төсөл үүсээгүй байна. Onboarding систем одоо төслийн модулаар ажиллаж байна.
                        </p>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3 justify-center">
                        <Button asChild variant="outline" className="rounded-xl">
                            <Link href={`/dashboard/employees/${employeeId}`}>
                                Ажилтны хуудас руу очих
                            </Link>
                        </Button>
                        <Button asChild className="rounded-xl bg-indigo-600 hover:bg-indigo-700">
                            <Link href="/dashboard/onboarding">
                                <FolderKanban className="h-4 w-4 mr-2" />
                                Onboarding жагсаалт
                            </Link>
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
