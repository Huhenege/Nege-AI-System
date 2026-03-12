'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useFirebase, useDoc, useCollection, useTenantWrite } from '@/firebase';
import { updateDoc, Timestamp, addDoc, query, orderBy, onSnapshot, writeBatch, doc } from 'firebase/firestore';
import { ERDocument, ProcessActivity } from '../../../dashboard/employment-relations/types';
import { useEmployeeProfile } from '@/hooks/use-employee-profile';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import {
    ArrowLeft, Check, X, MessageSquare, Loader2,
    CheckCircle2, FileText, Send, Clock, AlertCircle, Users
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { generateDocumentContent, formatDateTime } from '../../../dashboard/employment-relations/utils';
import { format } from 'date-fns';
import { getDoc, getDocs } from 'firebase/firestore';

export default function DocumentReviewDetailPage() {
    const router = useRouter();
    const { firestore, auth } = useFirebase();
    const { tDoc, tCollection } = useTenantWrite();
    const { employeeProfile } = useEmployeeProfile();
    const { toast } = useToast();

    const params = useParams<{ id?: string | string[] }>();
    const id = Array.isArray(params?.id) ? params.id[0] : params?.id;

    // Document Data
    const docRef = useMemo(() => (firestore && id ? tDoc('er_documents', id) : null), [firestore, id, tDoc]);
    const { data: document, isLoading: isDocLoading } = useDoc<ERDocument>(docRef as any);

    // Initial check for 404
    useEffect(() => {
        if (!isDocLoading && !document) {
            toast({ title: "Баримт олдсонгүй", variant: "destructive" });
            router.back();
        }
    }, [isDocLoading, document, router, toast]);

    // Employee Data (to map IDs to Names)
    const employeesRef = useMemo(() => firestore ? tCollection('employees') : null, [firestore, tCollection]);
    const { data: employees } = useCollection<any>(employeesRef);

    // Activity Feed (Real-time)
    const [activities, setActivities] = useState<ProcessActivity[]>([]);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!firestore || !id) return;

        const q = query(
            tCollection('er_documents', id, 'activity'),
            orderBy('createdAt', 'asc')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const acts: ProcessActivity[] = [];
            snapshot.forEach(d => {
                acts.push({ id: d.id, ...d.data() } as ProcessActivity);
            });
            setActivities(acts);
            // Scroll to bottom on new message
            setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
        });

        return () => unsubscribe();
    }, [firestore, id, tCollection]);


    // Actions State
    const [commentText, setCommentText] = useState('');
    const [isActionDialogOpen, setIsActionDialogOpen] = useState(false);
    const [actionType, setActionType] = useState<'APPROVE'>('APPROVE'); // Only Approve remaining for Dialog
    const [isProcessing, setIsProcessing] = useState(false);
    const [isAcknowledging, setIsAcknowledging] = useState(false);

    // Dynamic Data for resolution
    const [companyProfile, setCompanyProfile] = useState<any>(null);
    const [targetEmployee, setTargetEmployee] = useState<any>(null);

    useEffect(() => {
        if (!firestore) return;
        getDocs(tCollection('company_profile')).then(snap => {
            if (!snap.empty) setCompanyProfile(snap.docs[0].data());
        });
    }, [firestore, tCollection]);

    useEffect(() => {
        if (document?.employeeId && firestore) {
            getDoc(tDoc('employees', document.employeeId)).then(snap => {
                if (snap.exists()) setTargetEmployee({ id: snap.id, ...snap.data() });
            });
        }
    }, [document?.employeeId, firestore, tDoc]);

    // Current User Status
    const myReviewStatus = useMemo(() => {
        if (!document || !employeeProfile) return null;

        // Find which reviewer record matches current user
        const matchedReviewerKey = document.reviewers?.find((rid: string) =>
            rid === employeeProfile.id || (employeeProfile.positionId && rid === employeeProfile.positionId)
        );

        if (!matchedReviewerKey) return null;

        return document.approvalStatus?.[matchedReviewerKey];
    }, [document, employeeProfile]);

    const isReviewer = !!myReviewStatus || (document?.reviewers?.includes(employeeProfile?.id || '') || (employeeProfile?.positionId && document?.reviewers?.includes(employeeProfile.positionId)));
    const hasDecided = myReviewStatus?.status === 'APPROVED' || myReviewStatus?.status === 'REJECTED';

    const isTargetEmployee = !!employeeProfile?.id && employeeProfile.id === document?.employeeId;
    const canAcknowledge = isTargetEmployee && document?.status === 'SENT_TO_EMPLOYEE';
    const isEmployeeAcknowledgeView =
        isTargetEmployee && (document?.status === 'SENT_TO_EMPLOYEE' || document?.status === 'ACKNOWLEDGED');


    const handleSendComment = async () => {
        if (!commentText.trim() || !firestore || !employeeProfile) return;

        try {
            await addDoc(tCollection('er_documents', id!, 'activity'), {
                type: 'COMMENT',
                actorId: employeeProfile.id,
                content: commentText,
                createdAt: Timestamp.now()
            });
            setCommentText('');
        } catch (e) {
            console.error(e);
            toast({ title: "Алдаа", description: "Коммент илгээхэд алдаа гарлаа", variant: "destructive" });
        }
    };

    const handleApprove = async () => {
        if (!employeeProfile || !firestore || !document || isProcessing) return;

        setIsProcessing(true);
        try {
            const docRef = tDoc('er_documents', document.id);
            const batch = (await import('firebase/firestore')).writeBatch(firestore);

            // 1. Add Activity Log
            const activityRef = doc(tCollection('er_documents', id!, 'activity'));
            batch.set(activityRef, {
                type: 'APPROVE',
                actorId: employeeProfile.id,
                content: commentText || 'Баримтыг зөвшөөрөв',
                createdAt: Timestamp.now()
            });

            // 2. Update Document Status
            const newApprovalStatus = { ...(document.approvalStatus || {}) };

            // Determine key (User ID or Position ID)
            const matchedReviewerKey = document.reviewers?.find((rid: string) =>
                rid === employeeProfile.id || (employeeProfile.positionId && rid === employeeProfile.positionId)
            ) || employeeProfile.id;

            newApprovalStatus[matchedReviewerKey] = {
                status: 'APPROVED',
                comment: commentText,
                actorId: employeeProfile.id,
                updatedAt: Timestamp.now()
            };

            const updateData: any = {
                approvalStatus: newApprovalStatus,
                updatedAt: Timestamp.now()
            };

            // Check if ALL reviewers have approved
            const allApproved = document.reviewers?.every((rid: string) => {
                if (rid === matchedReviewerKey) return true;
                return newApprovalStatus[rid]?.status === 'APPROVED';
            });

            if (allApproved) {
                updateData.status = 'REVIEWED';
            }

            batch.update(docRef, updateData);
            await batch.commit();

            toast({
                title: "Батлагдлаа",
                description: "Үйлдэл амжилттай бүртгэгдлээ"
            });

            setCommentText('');

        } catch (error) {
            console.error(error);
            toast({ title: "Алдаа гарлаа", variant: "destructive" });
        } finally {
            setIsProcessing(false);
        }
    };

    const handleAcknowledge = async () => {
        if (!employeeProfile || !firestore || !document || !id) return;
        if (!canAcknowledge) return;
        if (isAcknowledging) return;
        setIsAcknowledging(true);
        try {
            const batch = writeBatch(firestore);
            batch.update(tDoc('er_documents', document.id), {
                status: 'ACKNOWLEDGED',
                employeeAckAt: Timestamp.now(),
                employeeAckBy: employeeProfile.id,
                updatedAt: Timestamp.now(),
            });
            batch.set(doc(tCollection('er_documents', id!, 'activity')), {
                type: 'STATUS_CHANGE',
                actorId: employeeProfile.id,
                content: 'Ажилтан танилцлаа',
                createdAt: Timestamp.now(),
            });
            await batch.commit();

            toast({
                title: 'Танилцсан гэж тэмдэглэлээ',
                description: 'Таны танилцсан тэмдэглэл бүртгэгдлээ.',
            });
        } catch (e: any) {
            console.error(e);
            toast({ variant: 'destructive', title: 'Алдаа', description: e?.message || 'Тэмдэглэхэд алдаа гарлаа.' });
        } finally {
            setIsAcknowledging(false);
        }
    };

    if (isDocLoading || !document) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 gap-4">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Уншиж байна...</p>
            </div>
        );
    }

    // Helper to get user info
    const getUserInfo = (uid: string) => {
        const u = employees?.find((e: any) => e.id === uid);
        return {
            name: u ? `${u.firstName} ${u.lastName}` : 'Хэрэглэгч',
            avatar: u?.photoURL,
            initial: u?.firstName?.charAt(0) || '?'
        };
    };

    const signedUrl = String(document?.signedDocUrl || '');
    const signedUrlPath = (() => {
        if (!signedUrl) return '';
        try {
            const u = new URL(signedUrl);
            return u.pathname.toLowerCase();
        } catch {
            return signedUrl.toLowerCase();
        }
    })();
    const isPdf = signedUrlPath.includes('.pdf');

    return (
        // Full Screen Overlay: Covers the Layout's Bottom Nav
        // Using "fixed inset-0 z-[60]" ensures it sits ON TOP of the mobile layout navigation (z-50)
        // Using "flex justify-center" centers the mobile view on desktop
        <div className="fixed inset-0 z-[60] flex justify-center bg-black/5 dark:bg-black/80 backdrop-blur-[2px]">
            {/* Mobile Container constraint: 
               - max-w-md: keeps it phone-sized on desktop
               - h-full: takes full height of viewport
               - flex-col: enables internal scrolling logic
            */}
            <div className="w-full max-w-md h-full bg-slate-50 flex flex-col shadow-xl overflow-hidden relative">

                {/* Header (Static in Flex) */}
                <div className="bg-white px-4 py-3 border-b border-slate-100 flex items-center justify-between shrink-0 shadow-sm z-20">
                    <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full -ml-2 hover:bg-slate-100">
                        <ArrowLeft className="h-6 w-6 text-slate-800" />
                    </Button>
                    <div className="text-center flex-1 mx-2 min-w-0">
                        <h1 className="text-sm font-bold text-slate-900 truncate">{document.metadata?.templateName || 'Баримт'}</h1>
                        <p className="text-[10px] text-slate-500 font-medium truncate">{document.metadata?.employeeName}</p>
                    </div>
                    <div className="w-10" /> {/* Spacer */}
                </div>

                {/* Main Scrollable Content (Flex Grow) */}
                <div className="flex-1 overflow-y-auto bg-slate-50 overscroll-y-contain px-0 relative">
                    {isEmployeeAcknowledgeView ? (
                        <div className="p-4 space-y-3">
                            <div className="bg-white rounded-2xl border shadow-sm p-4">
                                <div className="flex items-center gap-2 mb-3">
                                    <div className="h-9 w-9 rounded-full bg-slate-100 flex items-center justify-center">
                                        <FileText className="h-4 w-4 text-slate-500" />
                                    </div>
                                    <div className="min-w-0">
                                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                            Эх хувь
                                        </div>
                                        <div className="text-sm font-bold text-slate-900 truncate">
                                            {document.metadata?.templateName || 'Баримт'}
                                        </div>
                                    </div>
                                </div>

                                {!signedUrl ? (
                                    <div className="text-sm text-slate-600">
                                        Эх хувь хавсаргагдаагүй байна.
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            className="w-full h-11 rounded-2xl"
                                            onClick={() => window.open(signedUrl, '_blank')}
                                        >
                                            Эх хувь нээх
                                        </Button>

                                        <div className="rounded-2xl overflow-hidden border bg-slate-50">
                                            {isPdf ? (
                                                <iframe
                                                    title="signed-document"
                                                    src={signedUrl}
                                                    className="w-full h-[70dvh]"
                                                />
                                            ) : (
                                                <img
                                                    src={signedUrl}
                                                    alt="signed document"
                                                    className="w-full h-auto"
                                                />
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <>
                            {/* 1. Document Content Section */}
                            <div className="bg-white p-4 pb-8 mb-2 shadow-sm">
                                <div className="flex items-center gap-2 mb-4">
                                    <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center">
                                        <FileText className="h-4 w-4 text-slate-500" />
                                    </div>
                                    <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Баримтын агуулга</h2>
                                </div>
                                <div className="prose prose-slate prose-sm max-w-none bg-slate-50/50 p-4 rounded-2xl border border-slate-100 min-h-[400px]">
                                    <div
                                        dangerouslySetInnerHTML={{
                                            __html: generateDocumentContent(document.content || '', {
                                                employee: targetEmployee,
                                                company: companyProfile,
                                                system: {
                                                    date: format(new Date(), 'yyyy-MM-dd'),
                                                    year: format(new Date(), 'yyyy'),
                                                    month: format(new Date(), 'MM'),
                                                    day: format(new Date(), 'dd'),
                                                    user: employeeProfile?.firstName || 'Системийн хэрэглэгч'
                                                },
                                                customInputs: document.customInputs
                                            }).replace(/\n/g, '<br/>')
                                        }}
                                    />
                                </div>
                            </div>

                    {/* 2. Reviewers Status (only when reviewers exist) */}
                    {document.reviewers && document.reviewers.length > 0 && (
                        <Card className="mx-4 mb-4 border-none shadow-sm overflow-hidden bg-white">
                            <CardContent className="p-4">
                                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                                    <Users className="h-3.5 w-3.5" /> Хянах бүрэлдэхүүн
                                </h3>
                                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                                    {document.reviewers?.map((rid: string) => {
                                        const status = document.approvalStatus?.[rid];
                                        const user = getUserInfo(rid);
                                        const displayName = user.name !== 'Хэрэглэгч' ? user.name.split(' ')[0] : (rid.length > 8 ? 'Албан тушаал' : rid);

                                        return (
                                            <div key={rid} className="flex flex-col items-center gap-1 min-w-[60px]">
                                                <div className={cn(
                                                    "h-10 w-10 rounded-full flex items-center justify-center border-2 bg-slate-50 transition-all overflow-hidden",
                                                    status?.status === 'APPROVED' ? "border-emerald-500 text-emerald-600 bg-emerald-50" :
                                                        status?.status === 'REJECTED' ? "border-rose-500 text-rose-600 bg-rose-50" :
                                                            "border-slate-200 text-slate-400"
                                                )}>
                                                    {user.avatar ? (
                                                        <img src={user.avatar} alt={user.name} className="h-full w-full object-cover" />
                                                    ) : (
                                                        status?.status === 'APPROVED' ? <Check className="h-5 w-5" /> :
                                                            status?.status === 'REJECTED' ? <X className="h-5 w-5" /> :
                                                                <span className="text-[10px] font-bold">{user.initial}</span>
                                                    )}
                                                </div>
                                                <span className="text-[10px] font-bold text-slate-600 truncate max-w-[70px]">
                                                    {displayName}
                                                </span>
                                            </div>
                                        )
                                    })}
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* 3. Activity Feed */}
                    <div className="px-4 pb-4">
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 pl-2 flex items-center gap-2">
                            <MessageSquare className="h-3.5 w-3.5" /> Процессын түүх
                        </h3>

                        <div className="space-y-4">
                            {activities.length === 0 && (
                                <div className="text-center py-10 text-slate-400 text-xs italic bg-white rounded-2xl border border-dashed">
                                    Одоогоор ямар нэг түүх алга байна.
                                </div>
                            )}

                            {activities.map((act) => {
                                const user = getUserInfo(act.actorId);
                                const isMe = act.actorId === employeeProfile?.id;
                                const isSys = act.type === 'STATUS_CHANGE';
                                const isApprove = act.type === 'APPROVE';
                                const isReject = act.type === 'REJECT';

                                if (isSys) {
                                    return (
                                        <div key={act.id} className="flex justify-center my-4">
                                            <Badge variant="secondary" className="bg-slate-200/50 text-slate-500 text-[10px] font-medium px-3 py-1">
                                                {act.content}
                                            </Badge>
                                        </div>
                                    )
                                }

                                return (
                                    <div key={act.id} className={cn("flex gap-3", isMe ? "flex-row-reverse" : "flex-row")}>
                                        <Avatar className="h-8 w-8 border shrink-0">
                                            <AvatarImage src={user.avatar} />
                                            <AvatarFallback className="text-[10px]">{user.initial}</AvatarFallback>
                                        </Avatar>
                                        <div className={cn(
                                            "max-w-[85%] rounded-2xl p-3 text-sm shadow-sm relative",
                                            isMe ? "bg-white text-slate-800 rounded-tr-none border border-slate-100" : "bg-white text-slate-700 rounded-tl-none border border-slate-100",
                                            isApprove ? "bg-emerald-50 border-emerald-100 text-emerald-800" :
                                                isReject ? "bg-rose-50 border-rose-100 text-rose-800" : ""
                                        )}>
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="text-[10px] font-bold opacity-70">{user.name}</span>
                                                <span className="text-[9px] opacity-50">{formatDateTime(act.createdAt)}</span>
                                            </div>

                                            {isApprove && (
                                                <div className="flex items-center gap-1 font-bold text-xs mb-1">
                                                    <CheckCircle2 className="h-3.5 w-3.5" /> Батлав
                                                </div>
                                            )}
                                            {isReject && (
                                                <div className="flex items-center gap-1 font-bold text-xs mb-1">
                                                    <AlertCircle className="h-3.5 w-3.5" /> Буцаав
                                                </div>
                                            )}

                                            <p className="leading-relaxed whitespace-pre-wrap">{act.content}</p>
                                        </div>
                                    </div>
                                )
                            })}
                            <div ref={messagesEndRef} />
                        </div>
                    </div>
                        </>
                    )}
                </div>

                {/* Footer: Chat Input & Actions */}
                {isEmployeeAcknowledgeView ? (
                    <div className="bg-white border-t p-3 pb-safe-area-bottom shadow-[0_-5px_20px_-5px_rgba(0,0,0,0.05)] z-20 shrink-0">
                        <div className="flex gap-2">
                            {document.status === 'ACKNOWLEDGED' ? (
                                <Button className="w-full h-11 rounded-2xl" disabled>
                                    Танилцсан
                                </Button>
                            ) : (
                                <Button
                                    className="w-full h-11 rounded-2xl bg-amber-600 hover:bg-amber-700 text-white shadow-lg"
                                    onClick={handleAcknowledge}
                                    disabled={isAcknowledging || !canAcknowledge}
                                    title="Танилцсан гэж тэмдэглэх"
                                >
                                    {isAcknowledging ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Танилцлаа'}
                                </Button>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="bg-white border-t p-3 pb-safe-area-bottom shadow-[0_-5px_20px_-5px_rgba(0,0,0,0.05)] z-20 shrink-0">
                        <div className="flex gap-2 items-end">
                            <Textarea
                                value={commentText}
                                onChange={e => setCommentText(e.target.value)}
                                placeholder="Коммент бичих..."
                                className="min-h-[44px] max-h-[100px] bg-slate-50 border-slate-200 focus:ring-1 focus:ring-primary/20 resize-none py-3 rounded-2xl text-sm"
                                onKeyDown={e => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        handleSendComment();
                                    }
                                }}
                            />

                            {/* Quick Action Button: Approve */}
                            {isReviewer && !hasDecided && (
                                <Button
                                    size="icon"
                                    className="h-11 w-11 shrink-0 rounded-2xl bg-emerald-600 shadow-lg hover:bg-emerald-700 transition-all"
                                    onClick={handleApprove}
                                    disabled={isProcessing}
                                >
                                    {isProcessing ? (
                                        <Loader2 className="h-5 w-5 animate-spin text-white" />
                                    ) : (
                                        <Check className="h-5 w-5 text-white" />
                                    )}
                                </Button>
                            )}

                            <Button
                                size="icon"
                                className="h-11 w-11 shrink-0 rounded-2xl bg-slate-900 shadow-lg hover:bg-slate-800 transition-all"
                                onClick={handleSendComment}
                                disabled={!commentText.trim() || isProcessing}
                            >
                                <Send className="h-5 w-5 text-white" />
                            </Button>
                        </div>
                    </div>
                )}


            </div>
        </div>
    );
}
