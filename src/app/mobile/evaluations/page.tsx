'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useFirebase } from '@/firebase';
import { useEmployeeProfile } from '@/hooks/use-employee-profile';
import { collection, query, where, getDocs, doc, getDoc, addDoc, updateDoc } from 'firebase/firestore';
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

export default function MobileEvaluationsPage() {
    const router = useRouter();
    const { firestore } = useFirebase();
    const { user, employeeProfile } = useEmployeeProfile();
    const { toast } = useToast();
    const mobileContainer = useMobileContainer();

    const [groups, setGroups] = useState<CandidateGroup[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedGroup, setSelectedGroup] = useState<CandidateGroup | null>(null);
    const [activeRequest, setActiveRequest] = useState<EvaluationRequest | null>(null);
    const [submitting, setSubmitting] = useState(false);

    // Notes state
    const [noteText, setNoteText] = useState('');
    const [savingNote, setSavingNote] = useState(false);
    const [myNotes, setMyNotes] = useState<{ id: string; text: string; authorName: string; authorPhotoURL?: string; authorId?: string; createdAt: string }[]>([]);
    const [loadingNotes, setLoadingNotes] = useState(false);

    // File viewer state
    const [viewingFile, setViewingFile] = useState<{ url: string; name: string } | null>(null);

    useEffect(() => {
        if (!firestore || !user?.uid) {
            setLoading(false);
            return;
        }
        let cancelled = false;

        const loadData = async () => {
            setLoading(true);

            // Collect all user IDs that might match this employee
            const allMyIds = [user.uid];
            if (user.email) {
                try {
                    const empQ = query(collection(firestore, 'employees'), where('email', '==', user.email));
                    const empSnap = await getDocs(empQ);
                    empSnap.docs.forEach(d => {
                        if (!allMyIds.includes(d.id)) allMyIds.push(d.id);
                    });
                } catch (_) {}
            }

            // Fetch evaluation requests
            const evalMap = new Map<string, EvaluationRequest>();
            for (const myId of allMyIds) {
                try {
                    const q = query(collection(firestore, 'evaluation_requests'), where('assignedTo', '==', myId));
                    const snap = await getDocs(q);
                    snap.docs.forEach(d => evalMap.set(d.id, { id: d.id, ...d.data() } as EvaluationRequest));
                } catch (_) {}
            }
            if (user.email) {
                try {
                    const q = query(collection(firestore, 'evaluation_requests'), where('assignedToEmail', '==', user.email));
                    const snap = await getDocs(q);
                    snap.docs.forEach(d => evalMap.set(d.id, { id: d.id, ...d.data() } as EvaluationRequest));
                } catch (_) {}
            }
            const allEvals = Array.from(evalMap.values());

            // Fetch interviews
            const interviewMap = new Map<string, Interview>();
            for (const myId of allMyIds) {
                try {
                    const q = query(
                        collection(firestore, 'interviews'),
                        where('interviewerIds', 'array-contains', myId),
                    );
                    const snap = await getDocs(q);
                    snap.docs.forEach(d => interviewMap.set(d.id, { id: d.id, ...d.data() } as Interview));
                } catch (_) {}
            }
            const allInterviews = Array.from(interviewMap.values());

            // Group by candidateId
            const groupMap = new Map<string, CandidateGroup>();

            for (const ev of allEvals) {
                const key = ev.candidateId;
                if (!groupMap.has(key)) {
                    groupMap.set(key, {
                        candidateId: key,
                        candidateName: ev.candidateName,
                        vacancyTitle: ev.vacancyTitle || '',
                        vacancyId: '',
                        applicationId: ev.applicationId,
                        interviews: [],
                        evaluations: [],
                        stages: [],
                    });
                }
                groupMap.get(key)!.evaluations.push(ev);
            }

            for (const iv of allInterviews) {
                const key = iv.candidateId;
                if (!groupMap.has(key)) {
                    groupMap.set(key, {
                        candidateId: key,
                        candidateName: iv.candidateName || 'Горилогч',
                        vacancyTitle: iv.vacancyTitle || '',
                        vacancyId: iv.vacancyId || '',
                        applicationId: iv.applicationId,
                        interviews: [],
                        evaluations: [],
                        stages: [],
                    });
                }
                const g = groupMap.get(key)!;
                g.interviews.push(iv);
                if (!g.vacancyId && iv.vacancyId) g.vacancyId = iv.vacancyId;
            }

            // Fetch global default stages
            let defaultStages: RecruitmentStage[] = [];
            try {
                const settingsSnap = await getDoc(doc(firestore, 'recruitment_settings', 'default'));
                if (settingsSnap.exists()) {
                    defaultStages = settingsSnap.data().defaultStages || [];
                }
            } catch (_) {}

            // Fetch candidate info, application (for files), and vacancy (for stages) for each group
            const groupArr = Array.from(groupMap.values());
            await Promise.all(groupArr.map(async (g) => {
                try {
                    const candidateDoc = await getDoc(doc(firestore, 'candidates', g.candidateId));
                    if (candidateDoc.exists()) {
                        g.candidate = { id: candidateDoc.id, ...candidateDoc.data() } as Candidate;
                        g.candidateName = `${g.candidate.lastName?.[0] || ''}. ${g.candidate.firstName}`;
                    }
                } catch (_) {}

                if (g.applicationId) {
                    try {
                        const appDoc = await getDoc(doc(firestore, 'applications', g.applicationId));
                        if (appDoc.exists()) {
                            g.application = { id: appDoc.id, ...appDoc.data() } as JobApplication;
                            if (!g.vacancyId && g.application.vacancyId) {
                                g.vacancyId = g.application.vacancyId;
                            }
                        }
                    } catch (_) {}
                }

                // Fetch vacancy for stages
                if (g.vacancyId) {
                    try {
                        const vacDoc = await getDoc(doc(firestore, 'vacancies', g.vacancyId));
                        if (vacDoc.exists()) {
                            g.vacancy = { id: vacDoc.id, ...vacDoc.data() } as Vacancy;
                            g.stages = g.vacancy.stages || defaultStages;
                            if (!g.vacancyTitle && g.vacancy.title) g.vacancyTitle = g.vacancy.title;
                        }
                    } catch (_) {}
                }
                if (g.stages.length === 0) {
                    g.stages = defaultStages;
                }
            }));

            const activeGroups = groupArr.filter(g => {
                const appStatus = g.application?.status;
                return appStatus !== 'HIRED' && appStatus !== 'REJECTED';
            });

            activeGroups.sort((a, b) => {
                const aPending = a.evaluations.filter(e => e.status === 'pending').length + a.interviews.filter(i => i.status === 'SCHEDULED').length;
                const bPending = b.evaluations.filter(e => e.status === 'pending').length + b.interviews.filter(i => i.status === 'SCHEDULED').length;
                return bPending - aPending;
            });

            if (!cancelled) {
                setGroups(activeGroups);
                setLoading(false);
            }
        };

        loadData();
        return () => { cancelled = true; };
    }, [firestore, user?.uid, user?.email]);

    // Fetch notes when a candidate is selected
    useEffect(() => {
        if (!firestore || !selectedGroup?.applicationId) {
            setMyNotes([]);
            return;
        }
        setLoadingNotes(true);
        const notesQ = query(
            collection(firestore, 'application_notes'),
            where('applicationId', '==', selectedGroup.applicationId),
        );
        getDocs(notesQ).then(async (snap) => {
            const items = snap.docs.map(d => {
                const data = d.data();
                return {
                    id: d.id,
                    text: data.text || '',
                    authorName: data.authorName || '',
                    authorPhotoURL: data.authorPhotoURL,
                    authorId: data.authorId,
                    createdAt: data.createdAt || '',
                };
            });
            for (const item of items) {
                if (item.authorId) {
                    const needsName = !item.authorName || item.authorName === 'Нэргүй';
                    const needsPhoto = !item.authorPhotoURL;
                    if (needsName || needsPhoto) {
                        try {
                            const empSnap = await getDoc(doc(firestore, 'employees', item.authorId));
                            if (empSnap.exists()) {
                                const e = empSnap.data();
                                if (needsName) item.authorName = [e.lastName, e.firstName].filter(Boolean).join(' ').trim() || 'Ажилтан';
                                if (needsPhoto && e.photoURL) item.authorPhotoURL = e.photoURL;
                            } else if (needsName) {
                                item.authorName = item.authorName || 'Нэргүй';
                            }
                        } catch {
                            if (needsName) item.authorName = item.authorName || 'Нэргүй';
                        }
                    }
                } else if (!item.authorName) {
                    item.authorName = 'Нэргүй';
                }
            }
            items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            setMyNotes(items);
        }).catch(() => {}).finally(() => setLoadingNotes(false));
    }, [firestore, selectedGroup?.applicationId]);

    const totalPending = useMemo(() => {
        let count = 0;
        for (const g of groups) {
            count += g.evaluations.filter(e => e.status === 'pending').length;
            count += g.interviews.filter(i => i.status === 'SCHEDULED').length;
        }
        return count;
    }, [groups]);

    const handleScorecardSubmit = async (criteria: ScorecardCriteria[], notes: string) => {
        if (!firestore || !activeRequest || !user) return;
        setSubmitting(true);
        try {
            const averageScore = criteria.reduce((sum, c) => sum + c.score, 0) / (criteria.length || 1);

            const scorecardDoc = await addDoc(collection(firestore, 'scorecards'), {
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

            await updateDoc(doc(firestore, 'evaluation_requests', activeRequest.id), {
                status: 'completed',
                scorecardId: scorecardDoc.id,
                completedAt: new Date().toISOString(),
            });

            await addDoc(collection(firestore, 'application_events'), {
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

            toast({ title: 'Үнэлгээ амжилттай илгээгдлээ' });
            setActiveRequest(null);

            setGroups(prev => prev.map(g => ({
                ...g,
                evaluations: g.evaluations.map(e =>
                    e.id === activeRequest.id ? { ...e, status: 'completed' as const, scorecardId: scorecardDoc.id, completedAt: new Date().toISOString() } : e
                ),
            })));
            if (selectedGroup) {
                setSelectedGroup(prev => prev ? ({
                    ...prev,
                    evaluations: prev.evaluations.map(e =>
                        e.id === activeRequest.id ? { ...e, status: 'completed' as const, scorecardId: scorecardDoc.id, completedAt: new Date().toISOString() } : e
                    ),
                }) : null);
            }
        } catch (err: any) {
            toast({ title: 'Алдаа', description: err.message, variant: 'destructive' });
        } finally {
            setSubmitting(false);
        }
    };

    const handleSaveNote = async () => {
        if (!firestore || !selectedGroup || !noteText.trim() || !user) return;
        setSavingNote(true);
        try {
            const now = new Date().toISOString();
            const authorName = employeeProfile
                ? [employeeProfile.lastName, employeeProfile.firstName].filter(Boolean).join(' ').trim() || 'Ажилтан'
                : (user.displayName || 'Ажилтан');
            const authorPhotoURL = employeeProfile?.photoURL ?? (user as any).photoURL ?? null;
            const stageId = selectedGroup.application?.currentStageId || null;
            const noteDoc = await addDoc(collection(firestore, 'application_notes'), {
                applicationId: selectedGroup.applicationId,
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

    // ---------- DETAIL VIEW ----------
    if (selectedGroup) {
        const pendingEvals = selectedGroup.evaluations.filter(e => e.status === 'pending');
        const completedEvals = selectedGroup.evaluations.filter(e => e.status === 'completed');
        const scheduledInterviews = selectedGroup.interviews.filter(i => i.status === 'SCHEDULED');
        const pastInterviews = selectedGroup.interviews.filter(i => i.status !== 'SCHEDULED');
        const candidate = selectedGroup.candidate;
        const application = selectedGroup.application;
        const files: ApplicationFile[] = application?.files || [];
        const hasResume = !!candidate?.resumeUrl;

        return (
            <div className="min-h-screen bg-slate-50/50 flex flex-col">
                {/* Detail Header */}
                <div className="sticky top-0 z-20 bg-white border-b px-4 py-3 flex items-center gap-3">
                    <Button variant="ghost" size="icon" className="shrink-0 -ml-2" onClick={() => setSelectedGroup(null)}>
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div className="flex-1 min-w-0">
                        <h1 className="text-base font-semibold text-slate-900 truncate">{selectedGroup.candidateName}</h1>
                        <p className="text-[11px] text-slate-400 truncate">{selectedGroup.vacancyTitle}</p>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto">
                    {/* Candidate Info Card */}
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
                                            <p className="text-xs text-slate-400 truncate">{selectedGroup.vacancyTitle}</p>
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

                    {/* Scheduled Interviews */}
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

                    {/* Past / Completed Interviews */}
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

                    {/* Pending Evaluations */}
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

                    {/* Completed Evaluations */}
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

                    {/* Files Section — grouped by stage */}
                    {(hasResume || files.length > 0) && (() => {
                        const stages = selectedGroup.stages;
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

                                {/* Resume */}
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

                                {/* Files grouped by stage */}
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
                                                            <p className="text-[11px] text-slate-400">
                                                                {(file.size / 1024).toFixed(0)} KB
                                                                {file.uploadedBy && ` • ${file.uploadedBy}`}
                                                                {file.uploadedAt && ` • ${format(new Date(file.uploadedAt), 'MM/dd')}`}
                                                            </p>
                                                        </div>
                                                        <Eye className="h-4 w-4 text-slate-400 shrink-0" />
                                                    </CardContent>
                                                </Card>
                                            ))}
                                        </div>
                                    </div>
                                ))}

                                {/* Files without stage */}
                                {unstaged.length > 0 && (
                                    <div className="mb-3">
                                        {orderedStages.length > 0 && (
                                            <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wide mb-1.5">Бусад</p>
                                        )}
                                        <div className="space-y-2">
                                            {unstaged.map(file => (
                                                <Card key={file.id} className="cursor-pointer hover:bg-slate-50 transition-colors" onClick={() => setViewingFile({ url: file.url, name: file.name })}>
                                                    <CardContent className="p-3 flex items-center gap-3">
                                                        <div className="h-9 w-9 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                                                            <FileText className="h-4 w-4 text-slate-500" />
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-sm font-medium text-slate-900 truncate">{file.name}</p>
                                                            <p className="text-[11px] text-slate-400">
                                                                {(file.size / 1024).toFixed(0)} KB
                                                                {file.uploadedBy && ` • ${file.uploadedBy}`}
                                                                {file.uploadedAt && ` • ${format(new Date(file.uploadedAt), 'MM/dd')}`}
                                                            </p>
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

                    {/* Notes Section */}
                    <div className="px-4 pt-4 pb-6">
                        <div className="flex items-center gap-2 mb-3">
                            <StickyNote className="h-4 w-4 text-amber-500" />
                            <h2 className="text-sm font-semibold text-slate-900">Тэмдэглэл</h2>
                            {myNotes.length > 0 && (
                                <Badge variant="outline" className="text-[10px] h-5 px-1.5">{myNotes.length}</Badge>
                            )}
                        </div>

                        {/* Write note */}
                        <Card className="mb-3">
                            <CardContent className="p-3 space-y-2">
                                <Textarea
                                    placeholder="Тэмдэглэл бичих..."
                                    value={noteText}
                                    onChange={e => setNoteText(e.target.value)}
                                    className="min-h-[80px] resize-none text-sm"
                                />
                                <Button
                                    size="sm"
                                    className="w-full h-8 text-xs bg-amber-500 hover:bg-amber-600 gap-1.5"
                                    disabled={!noteText.trim() || savingNote}
                                    onClick={handleSaveNote}
                                >
                                    {savingNote ? <Loader2 className="h-3 w-3 animate-spin" /> : <StickyNote className="h-3 w-3" />}
                                    Тэмдэглэл хадгалах
                                </Button>
                            </CardContent>
                        </Card>

                        {/* Existing notes */}
                        {loadingNotes ? (
                            <div className="flex justify-center py-4">
                                <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                            </div>
                        ) : myNotes.length > 0 ? (
                            <div className="space-y-2">
                                {myNotes.map(note => (
                                    <Card key={note.id}>
                                        <CardContent className="p-3">
                                            <p className="text-sm text-slate-800 whitespace-pre-wrap">{note.text}</p>
                                            <div className="flex items-center gap-2 mt-2 pt-2 border-t border-slate-100">
                                                <Avatar className="h-6 w-6 shrink-0">
                                                    <AvatarImage src={note.authorPhotoURL} alt={note.authorName} />
                                                    <AvatarFallback className="text-[10px] font-semibold bg-amber-100 text-amber-800">
                                                        {(note.authorName || 'Нэргүй')[0]}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <span className="text-[11px] font-medium text-slate-600">{note.authorName || 'Нэргүй'}</span>
                                                <span className="text-[10px] text-slate-400 ml-auto">{note.createdAt ? format(new Date(note.createdAt), 'yyyy/MM/dd HH:mm') : ''}</span>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        ) : (
                            <p className="text-xs text-slate-400 text-center py-2">Тэмдэглэл байхгүй</p>
                        )}
                    </div>
                </div>

                {/* Scorecard Overlay - мобайл контейнер дотор render хийгдэнэ */}
                {!!activeRequest && mobileContainer && createPortal(
                    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 p-3 overflow-hidden">
                        <div
                            className="w-full max-h-[85dvh] overflow-y-auto overflow-x-hidden rounded-2xl shadow-2xl bg-white"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <InterviewScorecard
                                candidateName={selectedGroup.candidateName}
                                onSubmit={handleScorecardSubmit}
                                onCancel={() => setActiveRequest(null)}
                                isLoading={submitting}
                            />
                        </div>
                    </div>,
                    mobileContainer
                )}
                {!!activeRequest && !mobileContainer && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3">
                        <div className="w-full max-w-md max-h-[85dvh] overflow-y-auto overflow-x-hidden rounded-2xl shadow-2xl bg-white">
                            <InterviewScorecard
                                candidateName={selectedGroup.candidateName}
                                onSubmit={handleScorecardSubmit}
                                onCancel={() => setActiveRequest(null)}
                                isLoading={submitting}
                            />
                        </div>
                    </div>
                )}

                {/* File Viewer Overlay */}
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
                                    <iframe
                                        src={gviewUrl}
                                        title={viewingFile.name}
                                        className="w-full h-full border-none"
                                    />
                                )}
                            </div>
                        </div>
                    );
                    return mobileContainer ? createPortal(viewerContent, mobileContainer) : (
                        <div className="fixed inset-0 z-50">{viewerContent}</div>
                    );
                })()}
            </div>
        );
    }

    // ---------- LIST VIEW ----------
    return (
        <div className="min-h-screen bg-slate-50/50 flex flex-col">
            {/* Header */}
            <div className="sticky top-0 z-20 bg-white border-b px-4 py-3 flex items-center gap-3">
                <Button variant="ghost" size="icon" className="shrink-0 -ml-2" onClick={() => router.back()}>
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <div className="flex-1">
                    <h1 className="text-base font-semibold text-slate-900">Сонгон шалгаруулалт</h1>
                    <p className="text-[11px] text-slate-400">Миний горилогчид</p>
                </div>
                {totalPending > 0 && (
                    <Badge variant="destructive" className="h-6 min-w-[24px] px-2 text-xs">
                        {totalPending}
                    </Badge>
                )}
            </div>

            {/* Content */}
            <div className="flex-1 px-4 py-3 space-y-3">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-3">
                        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                        <p className="text-xs text-slate-400">Ачаалж байна...</p>
                    </div>
                ) : groups.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                        <div className="h-16 w-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                            <ClipboardCheck className="h-8 w-8 text-slate-300" />
                        </div>
                        <p className="text-sm font-medium text-slate-500">Горилогч олдсонгүй</p>
                        <p className="text-xs text-slate-400 mt-1">Танд хуваарилагдсан горилогч одоогоор алга байна.</p>
                    </div>
                ) : (
                    groups.map(group => {
                        const pendingEvalCount = group.evaluations.filter(e => e.status === 'pending').length;
                        const scheduledCount = group.interviews.filter(i => i.status === 'SCHEDULED').length;
                        const completedEvalCount = group.evaluations.filter(e => e.status === 'completed').length;
                        const totalActions = pendingEvalCount + scheduledCount;
                        const initials = group.candidate
                            ? (group.candidate.firstName?.[0] || '') + (group.candidate.lastName?.[0] || '')
                            : (group.candidateName?.[0] || '?');

                        return (
                            <Card
                                key={group.candidateId}
                                className={cn(
                                    "cursor-pointer active:scale-[0.98] transition-all",
                                    totalActions > 0 && "border-blue-100"
                                )}
                                onClick={() => {
                                    setSelectedGroup(group);
                                    setNoteText('');
                                }}
                            >
                                <CardContent className="p-4">
                                    <div className="flex items-start gap-3">
                                        <Avatar className="h-11 w-11">
                                            <AvatarFallback className={cn(
                                                "text-sm font-semibold",
                                                totalActions > 0 ? "bg-blue-50 text-blue-600" : "bg-slate-100 text-slate-500"
                                            )}>
                                                {initials}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="min-w-0">
                                                    <p className="text-sm font-semibold text-slate-900 truncate">{group.candidateName}</p>
                                                    <p className="text-[11px] text-slate-400 truncate">{group.vacancyTitle}</p>
                                                </div>
                                                <ChevronRight className="h-5 w-5 text-slate-300 shrink-0 mt-0.5" />
                                            </div>

                                            <div className="flex flex-wrap items-center gap-1.5 mt-2">
                                                {scheduledCount > 0 && (
                                                    <Badge variant="outline" className="text-[10px] border-blue-200 text-blue-600 bg-blue-50 gap-1">
                                                        <Calendar className="h-2.5 w-2.5" />
                                                        Ярилцлага {scheduledCount}
                                                    </Badge>
                                                )}
                                                {pendingEvalCount > 0 && (
                                                    <Badge variant="outline" className="text-[10px] border-orange-200 text-orange-600 bg-orange-50 gap-1">
                                                        <Star className="h-2.5 w-2.5" />
                                                        Үнэлгээ {pendingEvalCount}
                                                    </Badge>
                                                )}
                                                {completedEvalCount > 0 && (
                                                    <Badge variant="outline" className="text-[10px] border-green-200 text-green-600 bg-green-50 gap-1">
                                                        <CheckCircle2 className="h-2.5 w-2.5" />
                                                        Бөглөсөн {completedEvalCount}
                                                    </Badge>
                                                )}
                                                {((group.candidate?.resumeUrl ? 1 : 0) + (group.application?.files?.length || 0)) > 0 && (
                                                    <Badge variant="outline" className="text-[10px] border-slate-200 text-slate-500 gap-1">
                                                        <FileText className="h-2.5 w-2.5" />
                                                        Файл {(group.candidate?.resumeUrl ? 1 : 0) + (group.application?.files?.length || 0)}
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
