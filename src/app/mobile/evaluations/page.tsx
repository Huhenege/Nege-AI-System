'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useFirebase, useTenantWrite, tenantCollection, tenantDoc } from '@/firebase';
import { useEmployeeProfile } from '@/hooks/use-employee-profile';
import { collection, query, where, getDocs, doc, getDoc, addDoc, updateDoc, onSnapshot } from 'firebase/firestore';
import { format } from 'date-fns';
import {
    ArrowLeft,
    Loader2,
    ClipboardCheck,
    CheckCircle2,
    Clock,
    Star,
    ChevronRight,
    Calendar,
    MapPin,
    Video,
    FileText,
    Eye,
    StickyNote,
    Briefcase,
    Phone,
    Mail,
    X,
    Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { createPortal } from 'react-dom';
import { useMobileContainer } from '../hooks/use-mobile-container';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { InterviewScorecard, ScorecardCriteria } from '../../dashboard/recruitment/components/interview-scorecard';
import type { EvaluationRequest, Interview, Candidate, JobApplication, ApplicationFile, Vacancy, RecruitmentStage } from '@/types/recruitment';

interface CandidateGroup {
    candidateId: string;
    candidateName: string;
    vacancyTitle: string;
    vacancyId: string;
    applicationId: string;
    interviews: Interview[];
    evaluations: EvaluationRequest[];
    candidate?: Candidate;
    application?: JobApplication;
    vacancy?: Vacancy;
    stages: RecruitmentStage[];
}

interface VacancyGroup {
    vacancyId: string;
    vacancyTitle: string;
    vacancy: Vacancy;
    stages: RecruitmentStage[];
    candidates: CandidateGroup[];
}

export default function MobileEvaluationsPage() {
    const router = useRouter();
    const { firestore } = useFirebase();
    const { tDoc, tCollection, companyPath } = useTenantWrite();
    const { user, employeeProfile } = useEmployeeProfile();
    const { toast } = useToast();
    const mobileContainer = useMobileContainer();

    const [vacancyGroups, setVacancyGroups] = useState<VacancyGroup[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedVacancy, setSelectedVacancy] = useState<VacancyGroup | null>(null);
    const [selectedCandidate, setSelectedCandidate] = useState<CandidateGroup | null>(null);
    const [activeRequest, setActiveRequest] = useState<EvaluationRequest | null>(null);
    const [submitting, setSubmitting] = useState(false);

    // Notes state
    const [noteText, setNoteText] = useState('');
    const [savingNote, setSavingNote] = useState(false);
    const [myNotes, setMyNotes] = useState<{ id: string; text: string; authorName: string; authorPhotoURL?: string; authorId?: string; createdAt: string }[]>([]);
    const [loadingNotes, setLoadingNotes] = useState(false);

    // File viewer state
    const [viewingFile, setViewingFile] = useState<{ url: string; name: string } | null>(null);

    // Employee info cache: authorId → { name, photoURL }
    const empCache = useRef<Map<string, { name: string; photoURL?: string }>>(new Map());

    const resolveAuthor = useCallback(async (authorId: string): Promise<{ name: string; photoURL?: string } | null> => {
        if (!firestore || !companyPath) return null;
        if (empCache.current.has(authorId)) return empCache.current.get(authorId)!;
        try {
            const empDoc = await getDoc(tenantDoc(firestore, companyPath, 'employees', authorId));
            if (empDoc.exists()) {
                const d = empDoc.data();
                const info = {
                    name: [d.lastName, d.firstName].filter(Boolean).join(' ').trim() || d.email || 'Ажилтан',
                    photoURL: d.photoURL as string | undefined,
                };
                empCache.current.set(authorId, info);
                return info;
            }
        } catch (_) {}
        return null;
    }, [firestore, companyPath]);

    useEffect(() => {
        if (!firestore || !companyPath || !user?.uid) {
            setLoading(false);
            return;
        }
        let cancelled = false;

        const loadData = async () => {
            setLoading(true);

            // Get all user IDs for this employee
            const allMyIds = [user.uid];
            if (user.email) {
                try {
                    const empQ = query(tenantCollection(firestore, companyPath, 'employees'), where('email', '==', user.email));
                    const empSnap = await getDocs(empQ);
                    empSnap.docs.forEach(d => {
                        if (!allMyIds.includes(d.id)) allMyIds.push(d.id);
                    });
                } catch (_) {}
            }

            // Fetch all evaluation requests assigned to me
            const evalMap = new Map<string, EvaluationRequest>();
            for (const myId of allMyIds) {
                try {
                    const q = query(tenantCollection(firestore, companyPath, 'evaluation_requests'), where('assignedTo', '==', myId));
                    const snap = await getDocs(q);
                    snap.docs.forEach(d => evalMap.set(d.id, { id: d.id, ...d.data() } as EvaluationRequest));
                } catch (_) {}
            }
            if (user.email) {
                try {
                    const q = query(tenantCollection(firestore, companyPath, 'evaluation_requests'), where('assignedToEmail', '==', user.email));
                    const snap = await getDocs(q);
                    snap.docs.forEach(d => evalMap.set(d.id, { id: d.id, ...d.data() } as EvaluationRequest));
                } catch (_) {}
            }
            const allEvals = Array.from(evalMap.values());

            // Fetch all interviews for me
            const interviewMap = new Map<string, Interview>();
            for (const myId of allMyIds) {
                try {
                    const q = query(tenantCollection(firestore, companyPath, 'interviews'), where('interviewerIds', 'array-contains', myId));
                    const snap = await getDocs(q);
                    snap.docs.forEach(d => interviewMap.set(d.id, { id: d.id, ...d.data() } as Interview));
                } catch (_) {}
            }
            const allInterviews = Array.from(interviewMap.values());

            // Fetch default stages
            let defaultStages: RecruitmentStage[] = [];
            try {
                const settingsSnap = await getDoc(tenantDoc(firestore, companyPath, 'recruitment_settings', 'default'));
                if (settingsSnap.exists()) {
                    defaultStages = settingsSnap.data().defaultStages || [];
                }
            } catch (_) {}

            // Fetch vacancies where I'm a participant
            const vacancyMap = new Map<string, Vacancy>();
            for (const myId of allMyIds) {
                try {
                    const q = query(tenantCollection(firestore, companyPath, 'vacancies'), where('participantIds', 'array-contains', myId));
                    const snap = await getDocs(q);
                    snap.docs.forEach(d => {
                        const v = { id: d.id, ...d.data() } as Vacancy;
                        vacancyMap.set(d.id, v);
                    });
                } catch (_) {}
            }

            // For each vacancy, load active applications + candidate details
            const groups: VacancyGroup[] = [];

            await Promise.all(Array.from(vacancyMap.values()).map(async (vacancy) => {
                const stages = vacancy.stages?.length ? vacancy.stages : defaultStages;
                try {
                    const appsQ = query(
                        tenantCollection(firestore, companyPath, 'applications'),
                        where('vacancyId', '==', vacancy.id),
                        where('status', '==', 'ACTIVE'),
                    );
                    const appsSnap = await getDocs(appsQ);
                    const apps = appsSnap.docs.map(d => ({ id: d.id, ...d.data() } as JobApplication));

                    const candidateGroups: CandidateGroup[] = [];

                    await Promise.all(apps.map(async (app) => {
                        let candidate: Candidate | undefined;
                        try {
                            const cDoc = await getDoc(tenantDoc(firestore, companyPath, 'candidates', app.candidateId));
                            if (cDoc.exists()) candidate = { id: cDoc.id, ...cDoc.data() } as Candidate;
                        } catch (_) {}

                        const appEvals = allEvals.filter(e => e.applicationId === app.id);
                        const appInterviews = allInterviews.filter(i => i.applicationId === app.id);
                        const name = candidate
                            ? `${candidate.lastName?.[0] || ''}. ${candidate.firstName}`
                            : (app.candidate?.firstName || 'Горилогч');

                        candidateGroups.push({
                            candidateId: app.candidateId,
                            candidateName: name,
                            vacancyTitle: vacancy.title,
                            vacancyId: vacancy.id,
                            applicationId: app.id,
                            interviews: appInterviews,
                            evaluations: appEvals,
                            candidate,
                            application: app,
                            vacancy,
                            stages,
                        });
                    }));

                    candidateGroups.sort((a, b) => {
                        const aPending = a.evaluations.filter(e => e.status === 'pending').length + a.interviews.filter(i => i.status === 'SCHEDULED').length;
                        const bPending = b.evaluations.filter(e => e.status === 'pending').length + b.interviews.filter(i => i.status === 'SCHEDULED').length;
                        return bPending - aPending;
                    });

                    groups.push({ vacancyId: vacancy.id, vacancyTitle: vacancy.title, vacancy, stages, candidates: candidateGroups });
                } catch (_) {}
            }));

            groups.sort((a, b) => {
                const aPending = a.candidates.reduce((s, c) => s + c.evaluations.filter(e => e.status === 'pending').length + c.interviews.filter(i => i.status === 'SCHEDULED').length, 0);
                const bPending = b.candidates.reduce((s, c) => s + c.evaluations.filter(e => e.status === 'pending').length + c.interviews.filter(i => i.status === 'SCHEDULED').length, 0);
                return bPending - aPending;
            });

            if (!cancelled) {
                setVacancyGroups(groups);
                setLoading(false);
            }
        };

        loadData();
        return () => { cancelled = true; };
    }, [firestore, companyPath, user?.uid, user?.email]);

    // Real-time notes subscription when a candidate is selected
    useEffect(() => {
        if (!firestore || !companyPath || !selectedCandidate?.applicationId) {
            setMyNotes([]);
            return;
        }
        setLoadingNotes(true);
        const notesQ = query(
            tenantCollection(firestore, companyPath, 'application_notes'),
            where('applicationId', '==', selectedCandidate.applicationId),
        );
        const unsub = onSnapshot(notesQ, async (snap) => {
            const raw = snap.docs.map(d => {
                const data = d.data();
                return {
                    id: d.id,
                    text: data.text || '',
                    authorName: data.authorName || 'Нэргүй',
                    authorPhotoURL: data.authorPhotoURL as string | undefined,
                    authorId: data.authorId as string | undefined,
                    createdAt: data.createdAt || '',
                };
            });

            // Resolve employee name & photo for each unique authorId
            const uniqueIds = [...new Set(raw.map(n => n.authorId).filter(Boolean) as string[])];
            await Promise.all(uniqueIds.map(id => resolveAuthor(id)));

            const items = raw.map(note => {
                if (note.authorId) {
                    const resolved = empCache.current.get(note.authorId);
                    if (resolved) {
                        return {
                            ...note,
                            authorName: resolved.name,
                            authorPhotoURL: resolved.photoURL ?? note.authorPhotoURL,
                        };
                    }
                }
                return note;
            });

            items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            setMyNotes(items);
            setLoadingNotes(false);
        }, () => setLoadingNotes(false));
        return () => unsub();
    }, [firestore, companyPath, selectedCandidate?.applicationId, resolveAuthor]);

    // Real-time application subscription — шат шилжилтийг шууд тусгана
    useEffect(() => {
        if (!firestore || !companyPath || !selectedCandidate?.applicationId) return;
        const unsub = onSnapshot(
            tenantDoc(firestore, companyPath, 'applications', selectedCandidate.applicationId),
            (snap) => {
                if (!snap.exists()) return;
                const appData = { id: snap.id, ...snap.data() } as JobApplication;
                setSelectedCandidate(prev => prev ? { ...prev, application: appData } : null);
                setVacancyGroups(prev => prev.map(vg => ({
                    ...vg,
                    candidates: vg.candidates.map(c =>
                        c.applicationId === appData.id ? { ...c, application: appData } : c
                    ),
                })));
            },
        );
        return () => unsub();
    }, [firestore, companyPath, selectedCandidate?.applicationId]);

    const totalPending = useMemo(() => {
        let count = 0;
        for (const vg of vacancyGroups) {
            for (const c of vg.candidates) {
                count += c.evaluations.filter(e => e.status === 'pending').length;
                count += c.interviews.filter(i => i.status === 'SCHEDULED').length;
            }
        }
        return count;
    }, [vacancyGroups]);

    const handleScorecardSubmit = async (criteria: ScorecardCriteria[], notes: string) => {
        if (!firestore || !activeRequest || !user) return;
        setSubmitting(true);
        try {
            const averageScore = criteria.reduce((sum, c) => sum + c.score, 0) / (criteria.length || 1);

            const scorecardDoc = await addDoc(tCollection('scorecards'), {
                applicationId: activeRequest.applicationId,
                candidateId: activeRequest.candidateId,
                interviewerId: user.uid,
                interviewerName: user.displayName || activeRequest.assignedToName,
                stageId: activeRequest.stageId,
                criteria,
                notes,
                averageScore,
                createdAt: new Date().toISOString(),
            });

            await updateDoc(tDoc('evaluation_requests', activeRequest.id), {
                status: 'completed',
                scorecardId: scorecardDoc.id,
                completedAt: new Date().toISOString(),
            });

            await addDoc(tCollection('application_events'), {
                applicationId: activeRequest.applicationId,
                type: 'EVALUATION_COMPLETED',
                stageId: activeRequest.stageId,
                userId: user.uid,
                userName: user.displayName || activeRequest.assignedToName,
                title: 'Үнэлгээ бөглөгдлөө',
                description: `${activeRequest.assignedToName} үнэлгээ бөглөв — дундаж: ${averageScore.toFixed(1)}/5`,
                data: { scorecardId: scorecardDoc.id },
                createdAt: new Date().toISOString(),
            });

            const updatedEval = { status: 'completed' as const, scorecardId: scorecardDoc.id, completedAt: new Date().toISOString() };

            toast({ title: 'Үнэлгээ амжилттай илгээгдлээ' });
            setActiveRequest(null);

            setVacancyGroups(prev => prev.map(vg => ({
                ...vg,
                candidates: vg.candidates.map(c => c.applicationId === activeRequest.applicationId ? ({
                    ...c,
                    evaluations: c.evaluations.map(e => e.id === activeRequest.id ? { ...e, ...updatedEval } : e),
                }) : c),
            })));
            if (selectedCandidate?.applicationId === activeRequest.applicationId) {
                setSelectedCandidate(prev => prev ? ({
                    ...prev,
                    evaluations: prev.evaluations.map(e => e.id === activeRequest.id ? { ...e, ...updatedEval } : e),
                }) : null);
            }
        } catch (err: any) {
            toast({ title: 'Алдаа', description: err.message, variant: 'destructive' });
        } finally {
            setSubmitting(false);
        }
    };

    const handleSaveNote = async () => {
        if (!firestore || !selectedCandidate || !noteText.trim() || !user) return;
        setSavingNote(true);
        try {
            const now = new Date().toISOString();
            const authorName = employeeProfile
                ? [employeeProfile.lastName, employeeProfile.firstName].filter(Boolean).join(' ').trim() || 'Ажилтан'
                : (user.displayName || 'Ажилтан');
            const authorPhotoURL = employeeProfile?.photoURL ?? (user as any).photoURL ?? null;
            const stageId = selectedCandidate.application?.currentStageId || null;
            const noteDoc = await addDoc(tCollection('application_notes'), {
                applicationId: selectedCandidate.applicationId,
                stageId,
                authorId: user.uid,
                authorName,
                authorPhotoURL,
                text: noteText.trim(),
                createdAt: now,
            });
            setMyNotes(prev => [{ id: noteDoc.id, text: noteText.trim(), authorName, authorPhotoURL: authorPhotoURL ?? undefined, authorId: user.uid, createdAt: now }, ...prev]);
            toast({ title: 'Тэмдэглэл хадгалагдлаа' });
            setNoteText('');
        } catch (err: any) {
            toast({ title: 'Алдаа', description: err.message, variant: 'destructive' });
        } finally {
            setSavingNote(false);
        }
    };

    // ===================== CANDIDATE DETAIL VIEW =====================
    if (selectedCandidate) {
        const pendingEvals = selectedCandidate.evaluations.filter(e => e.status === 'pending');
        const completedEvals = selectedCandidate.evaluations.filter(e => e.status === 'completed');
        const scheduledInterviews = selectedCandidate.interviews.filter(i => i.status === 'SCHEDULED');
        const pastInterviews = selectedCandidate.interviews.filter(i => i.status !== 'SCHEDULED');
        const candidate = selectedCandidate.candidate;
        const application = selectedCandidate.application;
        const files: ApplicationFile[] = application?.files || [];
        const hasResume = !!candidate?.resumeUrl;

        // Stage stepper data
        const stages = selectedCandidate.stages;
        const currentStageId = application?.currentStageId;
        const isHired = application?.status === 'HIRED';
        const isRejected = application?.status === 'REJECTED';

        let currentStageIdx = stages.findIndex(s => s.id === currentStageId);
        const currentStage = stages.find(s => s.id === currentStageId);

        // Terminal states: 'hired'/'rejected' aren't in stages array → compute effective index
        if (currentStageIdx === -1) {
            if (isHired) {
                currentStageIdx = stages.length;
            } else if (isRejected) {
                const stageIdsWithActivity = new Set([
                    ...selectedCandidate.evaluations.map(e => e.stageId),
                    ...selectedCandidate.interviews.map(i => (i as any).stageId),
                ].filter(Boolean));
                let lastIdx = 0;
                stages.forEach((s, idx) => { if (stageIdsWithActivity.has(s.id)) lastIdx = idx; });
                currentStageIdx = lastIdx;
            }
        }

        return (
            <div className="min-h-screen bg-slate-50/50 flex flex-col">
                {/* Header */}
                <div className="sticky top-0 z-20 bg-white border-b px-4 py-3 flex items-center gap-3">
                    <Button variant="ghost" size="icon" className="shrink-0 -ml-2" onClick={() => { setSelectedCandidate(null); setNoteText(''); }}>
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div className="flex-1 min-w-0">
                        <h1 className="text-base font-semibold text-slate-900 truncate">{selectedCandidate.candidateName}</h1>
                        <div className="flex items-center gap-1.5 mt-0.5">
                            <p className="text-[11px] text-slate-400 truncate">{selectedCandidate.vacancyTitle}</p>
                            {currentStage && !isHired && !isRejected && (
                                <Badge variant="outline" className="text-[10px] h-4 px-1.5 shrink-0 border-blue-200 text-blue-600 bg-blue-50">
                                    {currentStage.title}
                                </Badge>
                            )}
                            {isHired && (
                                <Badge className="text-[10px] h-4 px-1.5 shrink-0 bg-green-100 text-green-700 border-green-200" variant="outline">
                                    Ажилд авсан
                                </Badge>
                            )}
                            {isRejected && (
                                <Badge className="text-[10px] h-4 px-1.5 shrink-0 bg-red-50 text-red-600 border-red-200" variant="outline">
                                    Татгалзсан
                                </Badge>
                            )}
                        </div>
                    </div>
                </div>

                {/* Stage Progress Stepper */}
                {stages.length > 0 && (
                    <div className="bg-white border-b px-4 py-3 overflow-x-auto">
                        <div className="flex items-start gap-0 min-w-max">
                            {stages.map((stage, idx) => {
                                const isPast = idx < currentStageIdx;
                                const isCurrent = stage.id === currentStageId && !isHired && !isRejected;
                                return (
                                    <React.Fragment key={stage.id}>
                                        <div className="flex flex-col items-center gap-1 w-14">
                                            <div className={cn(
                                                "h-6 w-6 rounded-full flex items-center justify-center border-2 transition-all",
                                                isCurrent
                                                    ? "bg-blue-600 border-blue-600 text-white shadow-sm shadow-blue-200"
                                                    : isPast
                                                        ? "bg-blue-100 border-blue-300 text-blue-600"
                                                        : "bg-slate-100 border-slate-200 text-slate-400",
                                            )}>
                                                {isPast
                                                    ? <CheckCircle2 className="h-3.5 w-3.5" />
                                                    : <span className="text-[9px] font-bold">{idx + 1}</span>
                                                }
                                            </div>
                                            <span className={cn(
                                                "text-[9px] text-center leading-tight w-full truncate px-0.5",
                                                isCurrent ? "font-semibold text-blue-600" : isPast ? "text-slate-500" : "text-slate-300",
                                            )}>
                                                {stage.title}
                                            </span>
                                        </div>
                                        {idx < stages.length - 1 && (
                                            <div className={cn(
                                                "h-0.5 w-4 mt-3 shrink-0",
                                                idx < currentStageIdx ? "bg-blue-300" : "bg-slate-200",
                                            )} />
                                        )}
                                    </React.Fragment>
                                );
                            })}
                            {/* Terminal stage indicator */}
                            {(isHired || isRejected) && (
                                <>
                                    <div className="h-0.5 w-4 mt-3 shrink-0 bg-slate-200" />
                                    <div className="flex flex-col items-center gap-1 w-14">
                                        <div className={cn(
                                            "h-6 w-6 rounded-full flex items-center justify-center border-2",
                                            isHired
                                                ? "bg-green-500 border-green-500 text-white"
                                                : "bg-red-100 border-red-300 text-red-600",
                                        )}>
                                            {isHired
                                                ? <CheckCircle2 className="h-3.5 w-3.5" />
                                                : <X className="h-3 w-3" />
                                            }
                                        </div>
                                        <span className={cn(
                                            "text-[9px] text-center leading-tight w-full truncate px-0.5 font-semibold",
                                            isHired ? "text-green-600" : "text-red-500",
                                        )}>
                                            {isHired ? 'Ажилд авсан' : 'Татгалзсан'}
                                        </span>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                )}

                <div className="flex-1 overflow-y-auto">
                    {candidate && (
                        <div className="px-4 pt-4">
                            <Card>
                                <CardContent className="p-4">
                                    <div className="flex items-center gap-3">
                                        <Avatar className="h-12 w-12">
                                            <AvatarFallback className="bg-blue-50 text-blue-600 text-sm font-semibold">
                                                {(candidate.firstName?.[0] || '') + (candidate.lastName?.[0] || '')}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-semibold text-slate-900">{candidate.lastName} {candidate.firstName}</p>
                                            <p className="text-xs text-slate-400 truncate">{selectedCandidate.vacancyTitle}</p>
                                        </div>
                                    </div>
                                    <div className="mt-3 space-y-1.5">
                                        {candidate.email && (
                                            <div className="flex items-center gap-2 text-xs text-slate-500">
                                                <Mail className="h-3.5 w-3.5 text-slate-400" />
                                                <span className="truncate">{candidate.email}</span>
                                            </div>
                                        )}
                                        {candidate.phone && (
                                            <div className="flex items-center gap-2 text-xs text-slate-500">
                                                <Phone className="h-3.5 w-3.5 text-slate-400" />
                                                <span>{candidate.phone}</span>
                                            </div>
                                        )}
                                        {candidate.source && (
                                            <div className="flex items-center gap-2 text-xs text-slate-500">
                                                <Briefcase className="h-3.5 w-3.5 text-slate-400" />
                                                <span>{candidate.source}</span>
                                            </div>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    )}

                    {scheduledInterviews.length > 0 && (
                        <div className="px-4 pt-4">
                            <div className="flex items-center gap-2 mb-2">
                                <Calendar className="h-4 w-4 text-blue-600" />
                                <h2 className="text-sm font-semibold text-slate-900">Товлогдсон ярилцлага</h2>
                                <Badge className="h-5 min-w-[20px] px-1.5 text-[10px] bg-blue-600">{scheduledInterviews.length}</Badge>
                            </div>
                            <div className="space-y-2">
                                {scheduledInterviews.map(iv => {
                                    const start = new Date(iv.startTime);
                                    const end = new Date(iv.endTime);
                                    const isToday = format(start, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
                                    const isOnline = iv.location?.startsWith('http') || iv.location?.toLowerCase().includes('meet') || iv.location?.toLowerCase().includes('zoom');
                                    return (
                                        <Card key={iv.id} className={cn(isToday && "border-blue-200 bg-blue-50/30")}>
                                            <CardContent className="p-3">
                                                <div className="flex items-center justify-between">
                                                    <p className="text-sm font-medium text-slate-900">{iv.title}</p>
                                                    {isToday && <Badge className="text-[10px] bg-blue-600 hover:bg-blue-600">Өнөөдөр</Badge>}
                                                </div>
                                                <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-500">
                                                    <div className="flex items-center gap-1">
                                                        <Clock className="h-3 w-3" />
                                                        <span>{format(start, 'yyyy/MM/dd')} {format(start, 'HH:mm')}–{format(end, 'HH:mm')}</span>
                                                    </div>
                                                </div>
                                                {iv.location && (
                                                    <div className="flex items-center gap-1 mt-1 text-xs text-slate-500">
                                                        {isOnline ? <Video className="h-3 w-3 text-blue-500" /> : <MapPin className="h-3 w-3" />}
                                                        <span className="truncate">{iv.location}</span>
                                                    </div>
                                                )}
                                                {iv.location?.startsWith('http') && (
                                                    <a href={iv.location} target="_blank" rel="noopener noreferrer" className="block mt-2">
                                                        <Button size="sm" variant="outline" className="w-full gap-1.5 h-8 text-xs text-blue-600 border-blue-200 hover:bg-blue-50">
                                                            <Video className="h-3 w-3" /> Уулзалтад нэгдэх
                                                        </Button>
                                                    </a>
                                                )}
                                            </CardContent>
                                        </Card>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {pastInterviews.length > 0 && (
                        <div className="px-4 pt-4">
                            <div className="flex items-center gap-2 mb-2">
                                <CheckCircle2 className="h-4 w-4 text-slate-400" />
                                <h2 className="text-sm font-semibold text-slate-600">Өнгөрсөн ярилцлага</h2>
                            </div>
                            <div className="space-y-2">
                                {pastInterviews.map(iv => {
                                    const start = new Date(iv.startTime);
                                    const end = new Date(iv.endTime);
                                    return (
                                        <Card key={iv.id} className="opacity-60">
                                            <CardContent className="p-3">
                                                <p className="text-sm font-medium text-slate-700">{iv.title}</p>
                                                <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
                                                    <span>{format(start, 'yyyy/MM/dd')} {format(start, 'HH:mm')}–{format(end, 'HH:mm')}</span>
                                                    <Badge variant="outline" className="text-[10px]">{iv.status}</Badge>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {pendingEvals.length > 0 && (
                        <div className="px-4 pt-4">
                            <div className="flex items-center gap-2 mb-2">
                                <Star className="h-4 w-4 text-orange-500" />
                                <h2 className="text-sm font-semibold text-slate-900">Хүлээгдэж буй үнэлгээ</h2>
                                <Badge variant="destructive" className="h-5 min-w-[20px] px-1.5 text-[10px]">{pendingEvals.length}</Badge>
                            </div>
                            <div className="space-y-2">
                                {pendingEvals.map(ev => (
                                    <Card key={ev.id} className="border-orange-100 cursor-pointer active:scale-[0.98] transition-all" onClick={() => setActiveRequest(ev)}>
                                        <CardContent className="p-3">
                                            <div className="flex items-center justify-between">
                                                <div className="min-w-0">
                                                    <p className="text-sm font-medium text-slate-900">Үнэлгээ бөглөх</p>
                                                    <p className="text-[11px] text-slate-400">{ev.requestedByName} илгээсэн • {format(new Date(ev.createdAt), 'MM/dd')}</p>
                                                </div>
                                                <ChevronRight className="h-5 w-5 text-slate-300 shrink-0" />
                                            </div>
                                            <Button size="sm" className="w-full mt-2 bg-orange-500 hover:bg-orange-600 gap-1.5 h-8 text-xs">
                                                <Star className="h-3 w-3" /> Үнэлгээ бөглөх
                                            </Button>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        </div>
                    )}

                    {completedEvals.length > 0 && (
                        <div className="px-4 pt-4">
                            <div className="flex items-center gap-2 mb-2">
                                <CheckCircle2 className="h-4 w-4 text-green-500" />
                                <h2 className="text-sm font-semibold text-slate-600">Бөглөсөн үнэлгээ</h2>
                            </div>
                            <div className="space-y-2">
                                {completedEvals.map(ev => (
                                    <Card key={ev.id} className="opacity-70">
                                        <CardContent className="p-3 flex items-center gap-3">
                                            <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
                                            <div className="min-w-0">
                                                <p className="text-sm font-medium text-slate-700">Үнэлгээ бөглөсөн</p>
                                                <p className="text-[11px] text-slate-400">{ev.completedAt ? format(new Date(ev.completedAt), 'yyyy/MM/dd HH:mm') : ''}</p>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        </div>
                    )}

                    {(hasResume || files.length > 0) && (() => {
                        const stages = selectedCandidate.stages;
                        const stageMap = new Map<string, RecruitmentStage>();
                        stages.forEach(s => stageMap.set(s.id, s));
                        const filesByStage = new Map<string, ApplicationFile[]>();
                        const unstaged: ApplicationFile[] = [];
                        for (const f of files) {
                            if (f.stageId && stageMap.has(f.stageId)) {
                                if (!filesByStage.has(f.stageId)) filesByStage.set(f.stageId, []);
                                filesByStage.get(f.stageId)!.push(f);
                            } else {
                                unstaged.push(f);
                            }
                        }
                        const orderedStages = stages.filter(s => filesByStage.has(s.id));
                        return (
                            <div className="px-4 pt-4">
                                <div className="flex items-center gap-2 mb-3">
                                    <FileText className="h-4 w-4 text-indigo-500" />
                                    <h2 className="text-sm font-semibold text-slate-900">Файлууд</h2>
                                    <Badge variant="outline" className="text-[10px] h-5 px-1.5">{(hasResume ? 1 : 0) + files.length}</Badge>
                                </div>
                                {hasResume && (
                                    <div className="mb-3">
                                        <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wide mb-1.5">CV / Анкет</p>
                                        <Card className="cursor-pointer hover:bg-slate-50 transition-colors" onClick={() => setViewingFile({ url: candidate!.resumeUrl!, name: candidate?.resumeName || 'Resume' })}>
                                            <CardContent className="p-3 flex items-center gap-3">
                                                <div className="h-9 w-9 rounded-lg bg-red-50 flex items-center justify-center shrink-0">
                                                    <FileText className="h-4 w-4 text-red-500" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium text-slate-900 truncate">{candidate?.resumeName || 'Resume'}</p>
                                                    <p className="text-[11px] text-slate-400">Горилогчийн анкет</p>
                                                </div>
                                                <Eye className="h-4 w-4 text-slate-400 shrink-0" />
                                            </CardContent>
                                        </Card>
                                    </div>
                                )}
                                {orderedStages.map(stage => (
                                    <div key={stage.id} className="mb-3">
                                        <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wide mb-1.5">{stage.title}</p>
                                        <div className="space-y-2">
                                            {filesByStage.get(stage.id)!.map(file => (
                                                <Card key={file.id} className="cursor-pointer hover:bg-slate-50 transition-colors" onClick={() => setViewingFile({ url: file.url, name: file.name })}>
                                                    <CardContent className="p-3 flex items-center gap-3">
                                                        <div className="h-9 w-9 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
                                                            <FileText className="h-4 w-4 text-indigo-500" />
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-sm font-medium text-slate-900 truncate">{file.name}</p>
                                                            <p className="text-[11px] text-slate-400">{(file.size / 1024).toFixed(0)} KB{file.uploadedAt && ` • ${format(new Date(file.uploadedAt), 'MM/dd')}`}</p>
                                                        </div>
                                                        <Eye className="h-4 w-4 text-slate-400 shrink-0" />
                                                    </CardContent>
                                                </Card>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                                {unstaged.length > 0 && (
                                    <div className="mb-3">
                                        {orderedStages.length > 0 && <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wide mb-1.5">Бусад</p>}
                                        <div className="space-y-2">
                                            {unstaged.map(file => (
                                                <Card key={file.id} className="cursor-pointer hover:bg-slate-50 transition-colors" onClick={() => setViewingFile({ url: file.url, name: file.name })}>
                                                    <CardContent className="p-3 flex items-center gap-3">
                                                        <div className="h-9 w-9 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                                                            <FileText className="h-4 w-4 text-slate-500" />
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-sm font-medium text-slate-900 truncate">{file.name}</p>
                                                            <p className="text-[11px] text-slate-400">{(file.size / 1024).toFixed(0)} KB{file.uploadedAt && ` • ${format(new Date(file.uploadedAt), 'MM/dd')}`}</p>
                                                        </div>
                                                        <Eye className="h-4 w-4 text-slate-400 shrink-0" />
                                                    </CardContent>
                                                </Card>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })()}

                    <div className="px-4 pt-4 pb-6">
                        <div className="flex items-center gap-2 mb-3">
                            <StickyNote className="h-4 w-4 text-amber-500" />
                            <h2 className="text-sm font-semibold text-slate-900">Тэмдэглэл</h2>
                            {myNotes.length > 0 && (
                                <Badge variant="outline" className="text-[10px] h-5 px-1.5">{myNotes.length}</Badge>
                            )}
                        </div>

                        {/* Existing notes — real-time, all authors */}
                        {loadingNotes ? (
                            <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin text-slate-400" /></div>
                        ) : myNotes.length > 0 ? (
                            <div className="space-y-2 mb-3">
                                {myNotes.map(note => {
                                    const isOwn = note.authorId === user?.uid;
                                    return (
                                        <Card key={note.id} className={cn(isOwn && "border-amber-100 bg-amber-50/30")}>
                                            <CardContent className="p-3">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <Avatar className="h-6 w-6 shrink-0">
                                                        <AvatarImage src={note.authorPhotoURL} alt={note.authorName} />
                                                        <AvatarFallback className={cn(
                                                            "text-[10px] font-semibold",
                                                            isOwn ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-600"
                                                        )}>
                                                            {(note.authorName || 'Н')[0]}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <span className="text-[11px] font-medium text-slate-700">{note.authorName}</span>
                                                    {isOwn && <span className="text-[10px] text-amber-600 font-medium">Би</span>}
                                                    <span className="text-[10px] text-slate-400 ml-auto">
                                                        {note.createdAt ? format(new Date(note.createdAt), 'MM/dd HH:mm') : ''}
                                                    </span>
                                                </div>
                                                <p className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">{note.text}</p>
                                            </CardContent>
                                        </Card>
                                    );
                                })}
                            </div>
                        ) : !loadingNotes ? (
                            <p className="text-xs text-slate-400 text-center py-3 mb-3">Тэмдэглэл байхгүй байна</p>
                        ) : null}

                        {/* Write note */}
                        <Card>
                            <CardContent className="p-3 space-y-2">
                                <Textarea
                                    placeholder="Тэмдэглэл бичих..."
                                    value={noteText}
                                    onChange={e => setNoteText(e.target.value)}
                                    className="min-h-[72px] resize-none text-sm"
                                />
                                <Button size="sm" className="w-full h-8 text-xs bg-amber-500 hover:bg-amber-600 gap-1.5" disabled={!noteText.trim() || savingNote} onClick={handleSaveNote}>
                                    {savingNote ? <Loader2 className="h-3 w-3 animate-spin" /> : <StickyNote className="h-3 w-3" />}
                                    Тэмдэглэл нэмэх
                                </Button>
                            </CardContent>
                        </Card>
                    </div>
                </div>

                {/* Scorecard Overlay */}
                {!!activeRequest && mobileContainer && createPortal(
                    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 p-3 overflow-hidden">
                        <div className="w-full max-h-[85dvh] overflow-y-auto overflow-x-hidden rounded-2xl shadow-2xl bg-white" onClick={(e) => e.stopPropagation()}>
                            <InterviewScorecard candidateName={selectedCandidate.candidateName} onSubmit={handleScorecardSubmit} onCancel={() => setActiveRequest(null)} isLoading={submitting} />
                        </div>
                    </div>,
                    mobileContainer
                )}
                {!!activeRequest && !mobileContainer && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3">
                        <div className="w-full max-w-md max-h-[85dvh] overflow-y-auto overflow-x-hidden rounded-2xl shadow-2xl bg-white">
                            <InterviewScorecard candidateName={selectedCandidate.candidateName} onSubmit={handleScorecardSubmit} onCancel={() => setActiveRequest(null)} isLoading={submitting} />
                        </div>
                    </div>
                )}

                {/* File Viewer */}
                {viewingFile && (() => {
                    const isImage = /\.(jpe?g|png|gif|webp|bmp|svg)(\?|$)/i.test(viewingFile.url);
                    const gviewUrl = `https://docs.google.com/gview?url=${encodeURIComponent(viewingFile.url)}&embedded=true`;
                    const viewerContent = (
                        <div className="absolute inset-0 z-50 flex flex-col bg-white">
                            <div className="flex items-center gap-3 px-4 py-3 border-b shrink-0">
                                <Button variant="ghost" size="icon" className="shrink-0 -ml-2" onClick={() => setViewingFile(null)}>
                                    <X className="h-5 w-5" />
                                </Button>
                                <p className="text-sm font-semibold text-slate-900 truncate flex-1">{viewingFile.name}</p>
                            </div>
                            <div className="flex-1 overflow-hidden">
                                {isImage ? (
                                    <div className="w-full h-full overflow-auto flex items-start justify-center p-2 bg-slate-50">
                                        <img src={viewingFile.url} alt={viewingFile.name} className="max-w-full object-contain" />
                                    </div>
                                ) : (
                                    <iframe src={gviewUrl} title={viewingFile.name} className="w-full h-full border-none" />
                                )}
                            </div>
                        </div>
                    );
                    return mobileContainer ? createPortal(viewerContent, mobileContainer) : <div className="fixed inset-0 z-50">{viewerContent}</div>;
                })()}
            </div>
        );
    }

    // ===================== VACANCY CANDIDATES VIEW =====================
    if (selectedVacancy) {
        const vCandidates = selectedVacancy.candidates;
        const vacancyPending = vCandidates.reduce((s, c) =>
            s + c.evaluations.filter(e => e.status === 'pending').length + c.interviews.filter(i => i.status === 'SCHEDULED').length, 0);

        return (
            <div className="min-h-screen bg-slate-50/50 flex flex-col">
                <div className="sticky top-0 z-20 bg-white border-b px-4 py-3 flex items-center gap-3">
                    <Button variant="ghost" size="icon" className="shrink-0 -ml-2" onClick={() => setSelectedVacancy(null)}>
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div className="flex-1 min-w-0">
                        <h1 className="text-base font-semibold text-slate-900 truncate">{selectedVacancy.vacancyTitle}</h1>
                        <p className="text-[11px] text-slate-400">{vCandidates.length} горилогч</p>
                    </div>
                    {vacancyPending > 0 && (
                        <Badge variant="destructive" className="h-6 min-w-[24px] px-2 text-xs shrink-0">{vacancyPending}</Badge>
                    )}
                </div>

                <div className="flex-1 px-4 py-3 space-y-3">
                    {vCandidates.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-center">
                            <div className="h-16 w-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                                <Users className="h-8 w-8 text-slate-300" />
                            </div>
                            <p className="text-sm font-medium text-slate-500">Горилогч байхгүй</p>
                            <p className="text-xs text-slate-400 mt-1">Энэ ажлын байранд идэвхтэй горилогч алга байна.</p>
                        </div>
                    ) : (
                        vCandidates.map(c => {
                            const pendingEvalCount = c.evaluations.filter(e => e.status === 'pending').length;
                            const scheduledCount = c.interviews.filter(i => i.status === 'SCHEDULED').length;
                            const completedEvalCount = c.evaluations.filter(e => e.status === 'completed').length;
                            const totalActions = pendingEvalCount + scheduledCount;
                            const initials = c.candidate
                                ? (c.candidate.firstName?.[0] || '') + (c.candidate.lastName?.[0] || '')
                                : (c.candidateName?.[0] || '?');
                            const cStage = c.stages.find(s => s.id === c.application?.currentStageId);
                            const cIsHired = c.application?.status === 'HIRED';
                            const cIsRejected = c.application?.status === 'REJECTED';

                            return (
                                <Card
                                    key={c.candidateId}
                                    className={cn("cursor-pointer active:scale-[0.98] transition-all", totalActions > 0 && "border-blue-100")}
                                    onClick={() => { setSelectedCandidate(c); setNoteText(''); }}
                                >
                                    <CardContent className="p-4">
                                        <div className="flex items-start gap-3">
                                            <Avatar className="h-11 w-11">
                                                <AvatarFallback className={cn("text-sm font-semibold", totalActions > 0 ? "bg-blue-50 text-blue-600" : "bg-slate-100 text-slate-500")}>
                                                    {initials}
                                                </AvatarFallback>
                                            </Avatar>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-start justify-between gap-2">
                                                    <div className="min-w-0">
                                                        <p className="text-sm font-semibold text-slate-900 truncate">{c.candidateName}</p>
                                                        <div className="flex items-center gap-1.5 mt-0.5">
                                                            {c.candidate?.phone && (
                                                                <p className="text-[11px] text-slate-400 truncate">{c.candidate.phone}</p>
                                                            )}
                                                            {cIsHired && (
                                                                <Badge className="text-[10px] h-4 px-1.5 bg-green-100 text-green-700 border-green-200" variant="outline">Ажилд авсан</Badge>
                                                            )}
                                                            {cIsRejected && (
                                                                <Badge className="text-[10px] h-4 px-1.5 bg-red-50 text-red-600 border-red-200" variant="outline">Татгалзсан</Badge>
                                                            )}
                                                            {!cIsHired && !cIsRejected && cStage && (
                                                                <Badge variant="outline" className="text-[10px] h-4 px-1.5 border-slate-200 text-slate-500 bg-slate-50">
                                                                    {cStage.title}
                                                                </Badge>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <ChevronRight className="h-5 w-5 text-slate-300 shrink-0 mt-0.5" />
                                                </div>
                                                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                                                    {scheduledCount > 0 && (
                                                        <Badge variant="outline" className="text-[10px] border-blue-200 text-blue-600 bg-blue-50 gap-1">
                                                            <Calendar className="h-2.5 w-2.5" />Ярилцлага {scheduledCount}
                                                        </Badge>
                                                    )}
                                                    {pendingEvalCount > 0 && (
                                                        <Badge variant="outline" className="text-[10px] border-orange-200 text-orange-600 bg-orange-50 gap-1">
                                                            <Star className="h-2.5 w-2.5" />Үнэлгээ {pendingEvalCount}
                                                        </Badge>
                                                    )}
                                                    {completedEvalCount > 0 && (
                                                        <Badge variant="outline" className="text-[10px] border-green-200 text-green-600 bg-green-50 gap-1">
                                                            <CheckCircle2 className="h-2.5 w-2.5" />Бөглөсөн {completedEvalCount}
                                                        </Badge>
                                                    )}
                                                    {((c.candidate?.resumeUrl ? 1 : 0) + (c.application?.files?.length || 0)) > 0 && (
                                                        <Badge variant="outline" className="text-[10px] border-slate-200 text-slate-500 gap-1">
                                                            <FileText className="h-2.5 w-2.5" />Файл {(c.candidate?.resumeUrl ? 1 : 0) + (c.application?.files?.length || 0)}
                                                        </Badge>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            );
                        })
                    )}
                </div>
            </div>
        );
    }

    // ===================== VACANCY LIST VIEW =====================
    return (
        <div className="min-h-screen bg-slate-50/50 flex flex-col">
            <div className="sticky top-0 z-20 bg-white border-b px-4 py-3 flex items-center gap-3">
                <Button variant="ghost" size="icon" className="shrink-0 -ml-2" onClick={() => router.back()}>
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <div className="flex-1">
                    <h1 className="text-base font-semibold text-slate-900">Сонгон шалгаруулалт</h1>
                    <p className="text-[11px] text-slate-400">Миний ажлын байрнууд</p>
                </div>
                {totalPending > 0 && (
                    <Badge variant="destructive" className="h-6 min-w-[24px] px-2 text-xs">{totalPending}</Badge>
                )}
            </div>

            <div className="flex-1 px-4 py-3 space-y-3">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-3">
                        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                        <p className="text-xs text-slate-400">Ачаалж байна...</p>
                    </div>
                ) : vacancyGroups.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                        <div className="h-16 w-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                            <ClipboardCheck className="h-8 w-8 text-slate-300" />
                        </div>
                        <p className="text-sm font-medium text-slate-500">Ажлын байр олдсонгүй</p>
                        <p className="text-xs text-slate-400 mt-1">Танд хуваарилагдсан сонгон шалгаруулалт одоогоор алга байна.</p>
                    </div>
                ) : (
                    vacancyGroups.map(vg => {
                        const pendingCount = vg.candidates.reduce((s, c) =>
                            s + c.evaluations.filter(e => e.status === 'pending').length + c.interviews.filter(i => i.status === 'SCHEDULED').length, 0);
                        const candidateCount = vg.candidates.length;
                        const completedCount = vg.candidates.reduce((s, c) => s + c.evaluations.filter(e => e.status === 'completed').length, 0);

                        return (
                            <Card
                                key={vg.vacancyId}
                                className={cn("cursor-pointer active:scale-[0.98] transition-all", pendingCount > 0 && "border-blue-100")}
                                onClick={() => setSelectedVacancy(vg)}
                            >
                                <CardContent className="p-4">
                                    <div className="flex items-start gap-3">
                                        <div className={cn(
                                            "h-11 w-11 rounded-xl flex items-center justify-center shrink-0",
                                            pendingCount > 0 ? "bg-blue-50" : "bg-slate-100"
                                        )}>
                                            <Briefcase className={cn("h-5 w-5", pendingCount > 0 ? "text-blue-600" : "text-slate-400")} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-start justify-between gap-2">
                                                <p className="text-sm font-semibold text-slate-900 truncate">{vg.vacancyTitle}</p>
                                                <ChevronRight className="h-5 w-5 text-slate-300 shrink-0 mt-0.5" />
                                            </div>
                                            <div className="flex flex-wrap items-center gap-1.5 mt-2">
                                                <Badge variant="outline" className="text-[10px] border-slate-200 text-slate-500 gap-1">
                                                    <Users className="h-2.5 w-2.5" />{candidateCount} горилогч
                                                </Badge>
                                                {pendingCount > 0 && (
                                                    <Badge variant="outline" className="text-[10px] border-orange-200 text-orange-600 bg-orange-50 gap-1">
                                                        <Star className="h-2.5 w-2.5" />{pendingCount} хүлээгдэж буй
                                                    </Badge>
                                                )}
                                                {completedCount > 0 && (
                                                    <Badge variant="outline" className="text-[10px] border-green-200 text-green-600 bg-green-50 gap-1">
                                                        <CheckCircle2 className="h-2.5 w-2.5" />{completedCount} бөглөсөн
                                                    </Badge>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })
                )}
            </div>
        </div>
    );
}
