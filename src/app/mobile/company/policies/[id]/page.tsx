'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useDoc, useMemoFirebase, tenantDoc } from '@/firebase';
import { doc } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, FileText } from 'lucide-react';
import type { CompanyPolicy } from '@/app/dashboard/company/policies/types';

function PageSkeleton() {
    return (
        <div className="p-4 space-y-4">
            <header className="py-4 relative flex items-center justify-center">
                <Skeleton className="h-9 w-9 absolute left-0" />
                <Skeleton className="h-7 w-48" />
            </header>
            <Card>
                <CardHeader>
                    <Skeleton className="h-6 w-3/4" />
                    <Skeleton className="h-4 w-1/2 mt-2" />
                </CardHeader>
                <CardContent>
                    <Skeleton className="h-[60vh] w-full" />
                </CardContent>
            </Card>
        </div>
    )
}

function DocumentViewer({ policy }: { policy: CompanyPolicy }) {
    if (!policy.documentUrl) {
        return (
             <div className="h-[60vh] flex flex-col items-center justify-center rounded-md border bg-muted">
                <FileText className="h-16 w-16 text-muted-foreground" />
                <p className="mt-4 text-muted-foreground">Баримт бичиг хавсаргаагүй байна.</p>
            </div>
        )
    }

    const fileExtension = policy.documentUrl.split('.').pop()?.split('?')[0].toLowerCase();
    const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
    const officeExtensions = ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'];

    if (fileExtension === 'pdf') {
        return <iframe src={policy.documentUrl} className="h-[60vh] w-full rounded-md border" title={policy.title} />;
    }

    if (imageExtensions.includes(fileExtension || '')) {
        return (
            <div className="relative h-[60vh] w-full">
                <Image src={policy.documentUrl} alt={policy.title} fill style={{ objectFit: 'contain' }} className="rounded-md border" />
            </div>
        );
    }
    
    if (officeExtensions.includes(fileExtension || '')) {
         const viewerUrl = `https://docs.google.com/gview?url=${encodeURIComponent(policy.documentUrl)}&embedded=true`;
         return <iframe src={viewerUrl} className="h-[60vh] w-full rounded-md border" title={policy.title} />;
    }

    return (
        <div className="h-[60vh] flex flex-col items-center justify-center rounded-md border bg-muted">
            <FileText className="h-16 w-16 text-muted-foreground" />
            <p className="mt-4 text-muted-foreground">Урьдчилан харах боломжгүй файл.</p>
            <p className="text-sm text-muted-foreground mt-2">Зөвхөн PDF болон зургийн файлыг харуулах боломжтой.</p>
        </div>
    );
}

export default function PolicyDetailPage() {
    const { id } = useParams();
    const policyId = Array.isArray(id) ? id[0] : id;

    const policyDocRef = useMemoFirebase(
        ({firestore, companyPath}) => (firestore && policyId ? tenantDoc(firestore, companyPath, 'companyPolicies', policyId) : null),
        [policyId]
    );

    const { data: policy, isLoading, error } = useDoc<CompanyPolicy>(policyDocRef);

    if (isLoading) {
        return <PageSkeleton />;
    }

    if (error) {
        return (
            <div className="p-4 text-center text-destructive">
                Дүрэм ачаалахад алдаа гарлаа: {error.message}
            </div>
        )
    }

    if (!policy) {
        return (
            <div className="p-4 text-center">
                <p>Дүрэм, журам олдсонгүй.</p>
                <Button asChild variant="link">
                    <Link href="/mobile/company/policies">Жагсаалт руу буцах</Link>
                </Button>
            </div>
        )
    }

    return (
        <div className="p-4">
            <header className="py-4 relative flex items-center justify-center">
                <Button asChild variant="ghost" size="icon" className="absolute left-0">
                    <Link href="/mobile/company/policies">
                        <ArrowLeft className="h-5 w-5" />
                        <span className="sr-only">Буцах</span>
                    </Link>
                </Button>
                <h1 className="text-xl font-semibold text-center truncate px-12">{policy.title}</h1>
            </header>
            
            <Card>
                <CardHeader>
                    <CardTitle>{policy.title}</CardTitle>
                    {policy.description && <CardDescription>{policy.description}</CardDescription>}
                </CardHeader>
                <CardContent>
                    <DocumentViewer policy={policy} />
                </CardContent>
            </Card>
        </div>
    )
}
