'use client';

import * as React from 'react';
import Link from 'next/link';
import { useEmployeeProfile } from '@/hooks/use-employee-profile';
import { useCollection, useMemoFirebase, tenantCollection } from '@/firebase';
import { collection } from 'firebase/firestore';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, ChevronRight, FileText, Shield, FileSearch } from 'lucide-react';
import type { CompanyPolicy } from '@/app/dashboard/company/policies/types';

function PageSkeleton() {
    return (
        <div className="p-6 space-y-6 bg-slate-50 min-h-screen">
            <div className="flex items-center gap-4">
                <Skeleton className="h-10 w-10 rounded-full" />
                <Skeleton className="h-6 w-32" />
            </div>
            <div className="space-y-4">
                <Skeleton className="h-20 w-full rounded-2xl" />
                <Skeleton className="h-20 w-full rounded-2xl" />
                <Skeleton className="h-20 w-full rounded-2xl" />
            </div>
        </div>
    )
}

function PolicyItem({ policy }: { policy: CompanyPolicy }) {
    return (
        <Link href={`/mobile/company/policies/${policy.id}`} className="block group">
            <div className="flex items-center gap-4 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm transition-all hover:shadow-md active:scale-[0.99] mb-3">
                <div className="h-12 w-12 rounded-xl bg-amber-50 flex items-center justify-center shrink-0 border border-amber-100 group-hover:bg-amber-100 transition-colors">
                    <FileText className="h-6 w-6 text-amber-600" />
                </div>
                <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-slate-800 text-sm truncate">{policy.title}</h3>
                    <p className="text-xs text-slate-500 line-clamp-2 mt-0.5">{policy.description}</p>
                </div>
                <ChevronRight className="h-5 w-5 text-slate-300 group-hover:text-primary transition-colors" />
            </div>
        </Link>
    );
}

export default function MobilePoliciesPage() {
    const { employeeProfile, isProfileLoading } = useEmployeeProfile();
    const router = useRouter(); // Forgot to import useRouter in previous thought block, fixing here.
    const policiesQuery = useMemoFirebase(({ firestore, companyPath }) => firestore ? tenantCollection(firestore, companyPath, 'companyPolicies') : null, []);
    const { data: policies, isLoading: isLoadingPolicies } = useCollection<CompanyPolicy>(policiesQuery);

    const applicablePolicies = React.useMemo(() => {
        if (!policies || !employeeProfile) return [];
        return policies.filter(policy => {
            return policy.appliesToAll || (employeeProfile.positionId && policy.applicablePositionIds?.includes(employeeProfile.positionId));
        });
    }, [policies, employeeProfile]);

    const isLoading = isProfileLoading || isLoadingPolicies;

    return (
        <div className="min-h-screen bg-slate-50 pb-12">
            <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-slate-200/50 px-4 py-4 flex items-center gap-3 shadow-sm">
                <Link href="/mobile/company">
                    <Button variant="ghost" size="icon" className="-ml-2 h-9 w-9 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200">
                        <ArrowLeft className="w-5 h-5" />
                    </Button>
                </Link>
                <h1 className="font-semibold text-lg text-slate-800">Дүрэм, журам</h1>
            </header>

            <div className="p-6">
                {isLoading ? (
                    <div className="space-y-4">
                        <Skeleton className="h-20 w-full rounded-2xl" />
                        <Skeleton className="h-20 w-full rounded-2xl" />
                    </div>
                ) : applicablePolicies.length > 0 ? (
                    <div className="space-y-1">
                        {applicablePolicies.map(policy => (
                            <PolicyItem key={policy.id} policy={policy} />
                        ))}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
                        <div className="bg-slate-100 p-6 rounded-full shadow-inner">
                            <FileSearch className="w-12 h-12 text-slate-300" />
                        </div>
                        <div>
                            <h2 className="font-semibold text-lg text-slate-800">Мэдээлэл алга</h2>
                            <p className="text-slate-500 text-sm mt-1 max-w-[250px] mx-auto">Танд хамааралтай дүрэм, журам одоогоор олдсонгүй.</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

// Helper to fix the missing import in the main block
import { useRouter } from 'next/navigation';
