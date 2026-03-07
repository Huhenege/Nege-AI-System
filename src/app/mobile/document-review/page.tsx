'use client';

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
    ArrowLeft,
    FileText,
    Check,
    X,
    Clock,
    Search,
    Loader2,
    CheckCircle2,
    Eye
} from 'lucide-react';
import { useFirebase, useCollection, useTenantWrite } from '@/firebase';
import { useEmployeeProfile } from '@/hooks/use-employee-profile';
import { query, where, orderBy } from 'firebase/firestore';
import { ERDocument } from '../../dashboard/employment-relations/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { formatDateTime } from '../../dashboard/employment-relations/utils';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function DocumentReviewPage() {
    const router = useRouter();
    const { firestore } = useFirebase();
    const { tCollection } = useTenantWrite();
    const { employeeProfile, isProfileLoading } = useEmployeeProfile();
    const [searchTerm, setSearchTerm] = useState('');
    const [tab, setTab] = useState<'review' | 'ack'>('review');

    // Reviewer docs (position-based review)
    const reviewDocsQuery = useMemo(() => {
        if (!firestore || !employeeProfile) return null;

        const reviewerIds = [employeeProfile.id];
        if (employeeProfile.positionId) reviewerIds.push(employeeProfile.positionId);

        return query(
            tCollection('er_documents'),
            where('reviewers', 'array-contains-any', reviewerIds),
            where('status', '==', 'IN_REVIEW'),
            orderBy('updatedAt', 'desc')
        );
    }, [firestore, employeeProfile, tCollection]);

    // Employee acknowledgement docs (ad-hoc): only those explicitly sent for acknowledgement
    const ackDocsQuery = useMemo(() => {
        if (!firestore || !employeeProfile?.id) return null;
        return query(
            tCollection('er_documents'),
            where('employeeId', '==', employeeProfile.id),
            where('status', '==', 'SENT_TO_EMPLOYEE'),
            orderBy('updatedAt', 'desc')
        );
    }, [firestore, employeeProfile?.id, tCollection]);

    const {
        data: reviewDocs,
        isLoading: isLoadingReview,
        error: reviewError,
    } = useCollection<ERDocument>(reviewDocsQuery as any);
    const {
        data: ackDocs,
        isLoading: isLoadingAck,
        error: ackError,
    } = useCollection<ERDocument>(ackDocsQuery as any);

    const documents = tab === 'review' ? reviewDocs : ackDocs;
    const isLoading = tab === 'review' ? isLoadingReview : isLoadingAck;
    const queryError = tab === 'review' ? reviewError : ackError;

    const filteredDocs = useMemo(() => {
        if (!documents) return [];
        return documents.filter(doc =>
            doc.metadata?.templateName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            doc.metadata?.employeeName?.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [documents, searchTerm]);

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col pb-10">
            {/* Header */}
            <div className="bg-white/80 backdrop-blur-md sticky top-0 z-20 px-6 pt-12 pb-6 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => router.back()}
                        className="rounded-full hover:bg-slate-100 shrink-0"
                    >
                        <ArrowLeft className="h-6 w-6 text-slate-600" />
                    </Button>
                    <div>
                        <h1 className="text-xl font-bold text-slate-900 leading-tight">Баримтууд</h1>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                            {tab === 'review' ? 'Хянах' : 'Танилцах'}
                        </p>
                    </div>
                </div>
                {documents && documents.length > 0 && (
                    <Badge className="bg-primary/10 text-primary border-none text-xs font-bold px-3 py-1 rounded-full">
                        {documents.length}
                    </Badge>
                )}
            </div>

            {/* Tabs */}
            <div className="px-6 pt-4">
                <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="review">Хянах</TabsTrigger>
                        <TabsTrigger value="ack">Танилцах</TabsTrigger>
                    </TabsList>
                </Tabs>
            </div>

            {/* User Info / Position Badge */}
            {employeeProfile && (
                <div className="px-6 pt-4">
                    <div className="bg-primary/5 border border-primary/10 rounded-2xl p-3 flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-white text-[10px] font-bold shrink-0">
                            {employeeProfile.jobTitle?.charAt(0)}
                        </div>
                        <div className="min-w-0">
                            <p className="text-[9px] font-bold text-primary uppercase tracking-wider leading-none mb-1">Таны албан тушаал</p>
                            <p className="text-xs font-bold text-slate-700 truncate">{employeeProfile.jobTitle}</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Search */}
            <div className="px-6 pt-4 space-y-4">
                <div className="relative group">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-primary transition-colors" />
                    <Input
                        placeholder="Ажилтан эсвэл загвараар хайх..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 h-10 bg-white border-slate-100 rounded-2xl shadow-sm focus:ring-primary/10 transition-all text-sm"
                    />
                </div>
            </div>

            {/* Documents List */}
            <div className="flex-1 px-6 pt-4 space-y-4">
                {queryError && (
                    <div className="bg-rose-50 border-2 border-rose-200 rounded-2xl p-4 space-y-2">
                        <h3 className="font-bold text-rose-900">Алдаа гарлаа</h3>
                        <p className="text-sm text-rose-700">{queryError.message}</p>
                        {queryError.message.includes('index') && (
                            <a
                                href={queryError.message.match(/https:\/\/[^\s]+/)?.[0] || '#'}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-blue-600 underline block mt-2"
                            >
                                Index үүсгэх холбоос
                            </a>
                        )}
                    </div>
                )}

                {(isLoading || isProfileLoading) ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-4">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Уншиж байна...</p>
                    </div>
                ) : !employeeProfile ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center space-y-4 text-slate-400 font-bold uppercase tracking-widest text-xs">
                        Ажилтны мэдээлэл олдсонгүй
                    </div>
                ) : filteredDocs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
                        <div className="h-20 w-20 bg-slate-100 rounded-[30px] flex items-center justify-center">
                            <CheckCircle2 className="h-10 w-10 text-slate-300" />
                        </div>
                        <div className="space-y-1">
                            <h3 className="text-lg font-bold text-slate-900">Одоогоор баримт байхгүй</h3>
                            <p className="text-sm text-slate-500 max-w-[200px] mx-auto leading-relaxed text-balance">
                                {tab === 'review'
                                    ? 'Таны албан тушаалд хамаарах хүлээгдэж буй баримт алга байна.'
                                    : 'Танд танилцуулах шаардлагатай баримт алга байна.'}
                            </p>
                        </div>
                    </div>
                ) : (
                    filteredDocs.map((doc) => {
                        const handledByMe = doc.approvalStatus?.[employeeProfile.id] ??
                            (employeeProfile.positionId ? doc.approvalStatus?.[employeeProfile.positionId] : undefined);
                        const isHandled = handledByMe && handledByMe.status !== 'PENDING';
                        const myStatus = handledByMe?.status;

                        return (
                            <Card
                                key={doc.id}
                                className={cn(
                                    "border-none shadow-premium overflow-hidden transition-all active:scale-[0.98] group relative rounded-3xl",
                                    isHandled ? "opacity-60" : "hover:border-primary/20"
                                )}
                                onClick={() => router.push(`/mobile/document-review/${doc.id}`)}
                            >
                                <CardContent className="p-5 flex flex-col gap-4">
                                    <div className="flex justify-between items-start">
                                        <div className="space-y-1 flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <div className="h-8 w-8 rounded-xl bg-slate-50 flex items-center justify-center border border-slate-100 group-hover:bg-primary/10 group-hover:border-primary/20 transition-colors">
                                                    <FileText className="h-4 w-4 text-slate-500 group-hover:text-primary" />
                                                </div>
                                                <Badge variant="outline" className="text-[9px] font-black uppercase tracking-tighter py-0 h-5 border-slate-200 text-slate-400">
                                                    {doc.metadata?.templateName || 'Загвар'}
                                                </Badge>
                                            </div>
                                            <h4 className="text-base font-bold text-slate-900 truncate pr-4 pt-1">
                                                {doc.metadata?.employeeName}
                                            </h4>
                                            <div className="flex items-center gap-2 text-[11px] font-bold text-slate-400">
                                                <Clock className="h-3 w-3" />
                                                {formatDateTime(doc.updatedAt)}
                                            </div>
                                        </div>
                                        {isHandled ? (
                                            myStatus === 'APPROVED' ? (
                                                <Badge className="bg-emerald-50 text-emerald-600 border-none rounded-full px-2 py-0.5">
                                                    <Check className="h-3 w-3" />
                                                </Badge>
                                            ) : (
                                                <Badge className="bg-rose-50 text-rose-600 border-none rounded-full px-2 py-0.5">
                                                    <X className="h-3 w-3" />
                                                </Badge>
                                            )
                                        ) : (
                                            <div className="h-2 w-2 rounded-full bg-primary animate-pulse mt-2" />
                                        )}
                                    </div>

                                    <div className="flex items-center justify-between pt-2 border-t border-slate-50 mt-2">
                                        <span className="text-[10px] font-bold text-primary flex items-center gap-1">
                                            <Eye className="h-3 w-3" /> Дэлгэрэнгүй харах
                                        </span>
                                    </div>
                                </CardContent>
                            </Card>
                        )
                    })
                )}
            </div>
        </div>
    );
}
