'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useFirebase } from '@/firebase';
import { doc, getDoc, updateDoc, collection, query, where, getDocs, addDoc, onSnapshot, writeBatch, setDoc } from 'firebase/firestore';
import { JobApplication, Vacancy, RecruitmentStage, Candidate, Scorecard, MessageTemplate, ApplicationFile } from '@/types/recruitment';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { format } from 'date-fns';
import {
    Loader2,
    MessageSquare,
    Send,
    CheckCircle2,
    Clock,
    FileText,
    ChevronRight,
    Star,
    Calendar,
    X,
    Trash2,
    History,
    Files,
    Quote,
    Check,
    Download,
    StickyNote,
    ChevronDown,
    ChevronUp,
    Upload,
    Pencil,
    Link as LinkIcon,
    Globe,
    User as UserIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { EmployeeCard, EmployeeCardEmployee } from '@/components/employees/employee-card';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/patterns/page-layout';
import { AnimatePresence, motion } from 'framer-motion';
import { sendSMS } from '@/lib/notifications';
import { createUserWithSecondaryAuth } from '@/firebase';
import { InterviewScorecard, ScorecardCriteria } from '../../components/interview-scorecard';
import { ScheduleInterviewDialog } from '../../components/schedule-interview-dialog';
import { SendEvaluationDialog } from '../../components/send-evaluation-dialog';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

// --- Types & Helpers ---

const DEFAULT_STAGES: RecruitmentStage[] = [
    { id: 'screening', title: 'Анкет шүүлт', type: 'SCREENING', order: 0 },
    { id: 'first-interview', title: 'Анхан шатны ярилцлага', type: 'INTERVIEW', order: 1 },
    { id: 'tech-task', title: 'Даалгавар', type: 'CHALLENGE', order: 2 },
    { id: 'final-interview', title: 'Эцсийн ярилцлага', type: 'INTERVIEW', order: 3 },
    { id: 'offer', title: 'Санал тавих', type: 'OFFER', order: 4 },
];

const DEFAULT_TEMPLATES: MessageTemplate[] = [
    {
        id: 'tpl-1',
        title: 'Ярилцлагын урилга',
        body: 'Сайн байна уу, {{name}}.\n\nБид таныг дараагийн шатны ярилцлагад урьж байна.',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    },
    {
        id: 'tpl-2',
        title: 'Татгалзсан хариу',
        body: 'Сайн байна уу, {{name}}.\n\nСонгон шалгаруулалтад оролцсонд баярлалаа. Харамсалтай нь бид дараагийн шатанд өөр горилогчийг сонгохоор боллоо.',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    }
];

interface ApplicationEvent {
    id: string;
    applicationId: string;
    type: 'STAGE_CHANGE' | 'NOTE' | 'MESSAGE' | 'SCORECARD' | 'SYSTEM';
    userId: string;
    userName: string;
    title: string;
    description: string;
    stageId?: string;
    data?: any;
    createdAt: string;
}

interface InternalNote {
    id: string;
    applicationId: string;
    stageId?: string;
    authorId: string;
    authorName: string;
    authorPhotoURL?: string;
    text: string;
    createdAt: string;
}

const getTime = (date: any) => {
    if (!date) return 0;
    if (typeof date === 'string') return new Date(date).getTime();
    if (date.seconds) return date.seconds * 1000;
    return new Date(date).getTime();
};

// --- Collapsible Section Component ---
function Section({ title, icon: Icon, children, defaultOpen = false, count, actions }: {
    title: string;
    icon: React.ElementType;
    children: React.ReactNode;
    defaultOpen?: boolean;
    count?: number;
    actions?: React.ReactNode;
}) {
    const [open, setOpen] = useState(defaultOpen);
    return (
        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
            <div
                role="button"
                tabIndex={0}
                onClick={() => setOpen(!open)}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(!open); } }}
                className="w-full flex items-center gap-3 p-4 hover:bg-slate-50/50 transition-colors text-left cursor-pointer select-none"
            >
                <div className="h-8 w-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 shrink-0">
                    <Icon className="h-4 w-4" />
                </div>
                <span className="text-sm font-semibold text-slate-900 flex-1">{title}</span>
                {count !== undefined && count > 0 && (
                    <Badge variant="secondary" className="text-[10px] h-5 min-w-[20px] justify-center">{count}</Badge>
                )}
                {actions && <div onClick={e => e.stopPropagation()}>{actions}</div>}
                {open ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
            </div>
            <AnimatePresence initial={false}>
                {open && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                    >
                        <div className="px-4 pb-4 border-t pt-4">
                            {children}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

export default function CandidateDetailPage() {
    const { applicationId } = useParams();
    const router = useRouter();
    const { firestore, storage, user } = useFirebase();
    const { toast } = useToast();

    // --- State ---
    const [application, setApplication] = useState<JobApplication | null>(null);
    const [candidate, setCandidate] = useState<Candidate | null>(null);
    const [vacancy, setVacancy] = useState<Vacancy | null>(null);
    const [globalStages, setGlobalStages] = useState<RecruitmentStage[]>([]);
    const [messageTemplates, setMessageTemplates] = useState<MessageTemplate[]>([]);

    // Live Data
    const [events, setEvents] = useState<ApplicationEvent[]>([]);
    const [notes, setNotes] = useState<InternalNote[]>([]);
    const [scorecards, setScorecards] = useState<Scorecard[]>([]);

    // UI State
    const [selectedStageId, setSelectedStageId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Actions State
    const [noteText, setNoteText] = useState('');
    const [tagInput, setTagInput] = useState('');
    const [sendingMessage, setSendingMessage] = useState(false);
    const [sendingNote, setSendingNote] = useState(false);
    const [showScorecard, setShowScorecard] = useState(false);
    const [showSendEvaluation, setShowSendEvaluation] = useState(false);
    const [submittingScorecard, setSubmittingScorecard] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    // Advance stage confirmation
    const [showAdvanceConfirm, setShowAdvanceConfirm] = useState(false);
    const [pendingNextStageId, setPendingNextStageId] = useState<string | null>(null);

    // Reject confirmation
    const [showRejectConfirm, setShowRejectConfirm] = useState(false);
    const [rejectReason, setRejectReason] = useState('');

    // Hire confirmation
    const [showHireConfirm, setShowHireConfirm] = useState(false);
    const [isHiring, setIsHiring] = useState(false);

    // Edit Candidate
    const [isEditCandidateOpen, setIsEditCandidateOpen] = useState(false);
    const [editCandidate, setEditCandidate] = useState({
        firstName: '', lastName: '', email: '', phone: '',
        linkedinUrl: '', portfolioUrl: '', source: '', notes: '',
    });
    const [savingCandidate, setSavingCandidate] = useState(false);

    // File Upload
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploadingFile, setUploadingFile] = useState(false);
    const [deletingFileId, setDeletingFileId] = useState<string | null>(null);

    // Message Preview
    const [selectedTemplate, setSelectedTemplate] = useState<MessageTemplate | null>(null);
    const [previewText, setPreviewText] = useState('');
    const [showPreview, setShowPreview] = useState(false);
    const [sendAsSms, setSendAsSms] = useState(false);

    // --- Data Fetching ---

    useEffect(() => {
        const fetchData = async () => {
            if (!firestore || !applicationId) return;

            try {
                const appRef = doc(firestore, 'applications', applicationId as string);
                const appSnap = await getDoc(appRef);
                if (!appSnap.exists()) {
                    toast({ title: 'Өргөдөл олдсонгүй', variant: 'destructive' });
                    router.push('/dashboard/recruitment');
                    return;
                }
                const appData = { id: appSnap.id, ...appSnap.data() } as JobApplication;
                setApplication(appData);
                setSelectedStageId(appData.currentStageId);

                const candidateSnap = await getDoc(doc(firestore, 'candidates', appData.candidateId));
                if (candidateSnap.exists()) {
                    setCandidate({ id: candidateSnap.id, ...candidateSnap.data() } as Candidate);
                }

                const vacancySnap = await getDoc(doc(firestore, 'vacancies', appData.vacancyId));
                let vacancyStages: RecruitmentStage[] | null = null;
                if (vacancySnap.exists()) {
                    const vacancyData = { id: vacancySnap.id, ...vacancySnap.data() } as Vacancy;
                    setVacancy(vacancyData);
                    if (vacancyData.stages && vacancyData.stages.length > 0) {
                        vacancyStages = vacancyData.stages;
                    }
                }

                const settingsSnap = await getDoc(doc(firestore, 'recruitment_settings', 'default'));
                let fallbackStages = DEFAULT_STAGES;
                if (settingsSnap.exists()) {
                    const settingsData = settingsSnap.data();
                    fallbackStages = settingsData.defaultStages || DEFAULT_STAGES;
                    const templates = settingsData.messageTemplates;
                    setMessageTemplates(Array.isArray(templates) && templates.length > 0 ? templates : DEFAULT_TEMPLATES);
                } else {
                    setMessageTemplates(DEFAULT_TEMPLATES);
                }

                setGlobalStages(vacancyStages || fallbackStages);
            } catch (err: any) {
                console.error("Error fetching application details:", err);
                setError(err.message || "Мэдээлэл татахад алдаа гарлаа.");
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [firestore, applicationId, router, toast]);

    // Subscriptions
    useEffect(() => {
        if (!firestore || !applicationId) return;

        const eventsQuery = query(collection(firestore, 'application_events'), where('applicationId', '==', applicationId));
        const unsubEvents = onSnapshot(eventsQuery, (snapshot) => {
            const evts = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as ApplicationEvent));
            evts.sort((a, b) => getTime(b.createdAt) - getTime(a.createdAt));
            setEvents(evts);
        });

        const notesQuery = query(collection(firestore, 'application_notes'), where('applicationId', '==', applicationId));
        const unsubNotes = onSnapshot(notesQuery, (snapshot) => {
            const nts = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as InternalNote));
            nts.sort((a, b) => getTime(b.createdAt) - getTime(a.createdAt));
            setNotes(nts);
        });

        const scorecardsQuery = query(collection(firestore, 'scorecards'), where('applicationId', '==', applicationId));
        const unsubScorecards = onSnapshot(scorecardsQuery, (snapshot) => {
            const scs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Scorecard));
            scs.sort((a, b) => getTime(b.createdAt) - getTime(a.createdAt));
            setScorecards(scs);
        });

        return () => { unsubEvents(); unsubNotes(); unsubScorecards(); };
    }, [firestore, applicationId]);

    // --- Filtered data by selected stage ---
    const stageNotes = useMemo(() => {
        return notes.filter(n => {
            if (n.stageId === selectedStageId) return true;
            if (!n.stageId && application?.currentStageId === selectedStageId) return true;
            return false;
        });
    }, [notes, selectedStageId, application?.currentStageId]);
    const stageScorecards = useMemo(() => scorecards.filter(s => s.stageId === selectedStageId), [scorecards, selectedStageId]);
    const stageEvents = useMemo(() => events.filter(e => e.stageId === selectedStageId || (e.data?.stageId === selectedStageId)), [events, selectedStageId]);

    // --- Actions ---

    const logEvent = async (type: ApplicationEvent['type'], title: string, description: string, extraData?: any) => {
        if (!firestore || !applicationId || !user) return;
        try {
            await addDoc(collection(firestore, 'application_events'), {
                applicationId,
                type,
                stageId: application?.currentStageId || selectedStageId,
                userId: user.uid,
                userName: user.displayName || 'Систем',
                title,
                description,
                data: extraData || null,
                createdAt: new Date().toISOString()
            });
        } catch (error) {
            console.error("Error logging event:", error);
        }
    };

    const requestAdvanceStage = () => {
        if (!application) return;
        const currentIndex = globalStages.findIndex(s => s.id === application.currentStageId);
        if (currentIndex < globalStages.length - 1) {
            setPendingNextStageId(globalStages[currentIndex + 1].id);
            setShowAdvanceConfirm(true);
        }
    };

    const confirmAdvanceStage = async () => {
        if (!pendingNextStageId || !firestore || !applicationId) return;
        try {
            await updateDoc(doc(firestore, 'applications', applicationId as string), {
                currentStageId: pendingNextStageId,
                updatedAt: new Date().toISOString()
            });
            setApplication(prev => prev ? { ...prev, currentStageId: pendingNextStageId } : null);

            const stageTitle = globalStages.find(s => s.id === pendingNextStageId)?.title || pendingNextStageId;
            await logEvent('STAGE_CHANGE', 'Үе шат өөрчлөгдсөн', `Шинэ шат: ${stageTitle}`, { toStageId: pendingNextStageId });

            setSelectedStageId(pendingNextStageId);
            toast({ title: `"${stageTitle}" шат руу шилжлээ` });
        } catch (error) {
            console.error("Error advancing stage:", error);
            toast({ title: 'Шинэчилж чадсангүй', variant: 'destructive' });
        } finally {
            setShowAdvanceConfirm(false);
            setPendingNextStageId(null);
        }
    };

    const generateEmployeeCode = async (): Promise<string> => {
        if (!firestore) throw new Error("Firestore холбогдоогүй");
        const configRef = doc(firestore, 'company', 'employeeCodeConfig');
        const configSnap = await getDoc(configRef);
        if (!configSnap.exists()) throw new Error("Кодчлолын тохиргоо олдсонгүй");
        const { prefix, digitCount, nextNumber } = configSnap.data() as { prefix: string; digitCount: number; nextNumber: number };
        const code = `${prefix}${nextNumber.toString().padStart(digitCount, '0')}`;
        await setDoc(configRef, { nextNumber: nextNumber + 1 }, { merge: true });
        return code;
    };

    const confirmHire = async () => {
        if (!firestore || !applicationId || !application || !candidate) return;
        setIsHiring(true);
        try {
            const now = new Date().toISOString();
            const employeeId = application.employeeId;
            const employeeCode = await generateEmployeeCode();
            const authEmail = `${employeeCode}@example.com`;
            const password = candidate.phone || '123456';
            const newUser = await createUserWithSecondaryAuth(authEmail, password);
            if (!newUser.uid) throw new Error("Auth хэрэглэгч үүсгэж чадсангүй");
            const empDocRef = doc(firestore, 'employees', employeeId || newUser.uid);
            const employeeData: Record<string, any> = {
                id: newUser.uid, employeeCode, firstName: candidate.firstName, lastName: candidate.lastName,
                email: candidate.email, phoneNumber: candidate.phone, status: 'active_recruitment',
                lifecycleStage: 'onboarding', hireDate: now, role: 'employee', candidateId: candidate.id,
            };
            if (employeeId) { await updateDoc(empDocRef, employeeData); }
            else {
                await setDoc(doc(firestore, 'employees', newUser.uid), employeeData);
                await updateDoc(doc(firestore, 'applications', applicationId as string), { employeeId: newUser.uid });
            }
            await updateDoc(doc(firestore, 'applications', applicationId as string), { status: 'HIRED', currentStageId: 'hired', updatedAt: now });
            setApplication(prev => prev ? { ...prev, status: 'HIRED', currentStageId: 'hired' } : null);
            setSelectedStageId('hired');
            await logEvent('SYSTEM', 'Ажилд авсан', `${candidate.lastName} ${candidate.firstName} — Код: ${employeeCode}`);
            toast({ title: 'Амжилттай ажилд авлаа!', description: `Код: ${employeeCode}, Нууц үг: ${password}` });
            setShowHireConfirm(false);
        } catch (error: any) {
            console.error("Error hiring candidate:", error);
            toast({ title: 'Ажилд авахад алдаа гарлаа', description: error.message, variant: 'destructive' });
        } finally {
            setIsHiring(false);
        }
    };

    const handleStatusUpdate = async (newStatus: JobApplication['status']) => {
        if (!firestore || !applicationId) return;
        if (newStatus === 'HIRED') { setShowHireConfirm(true); return; }
        if (newStatus === 'REJECTED') { setRejectReason(''); setShowRejectConfirm(true); return; }
        try {
            await updateDoc(doc(firestore, 'applications', applicationId as string), { status: newStatus, updatedAt: new Date().toISOString() });
            setApplication(prev => prev ? { ...prev, status: newStatus } : null);
            const labels: Record<string, string> = { REJECTED: 'Татгалзсан', HIRED: 'Ажилд авсан', WITHDRAWN: 'Нэрээ татсан', ACTIVE: 'Идэвхтэй' };
            await logEvent('SYSTEM', 'Төлөв өөрчлөгдсөн', `Шинэ төлөв: ${labels[newStatus] || newStatus}`);
            toast({ title: `Төлөв: ${labels[newStatus]}` });
        } catch { toast({ title: 'Алдаа гарлаа', variant: 'destructive' }); }
    };

    const confirmReject = async () => {
        if (!firestore || !applicationId) return;
        try {
            const now = new Date().toISOString();
            await updateDoc(doc(firestore, 'applications', applicationId as string), {
                status: 'REJECTED',
                currentStageId: 'rejected',
                rejectionReason: rejectReason.trim() || undefined,
                updatedAt: now,
            });
            setApplication(prev => prev ? { ...prev, status: 'REJECTED', currentStageId: 'rejected' } : null);
            setSelectedStageId('rejected');
            const reasonText = rejectReason.trim() ? `Шалтгаан: ${rejectReason.trim()}` : 'Шалтгаан тэмдэглээгүй';
            await logEvent('SYSTEM', 'Татгалзсан', reasonText);
            toast({ title: 'Татгалзсан', description: reasonText });
        } catch {
            toast({ title: 'Алдаа гарлаа', variant: 'destructive' });
        } finally {
            setShowRejectConfirm(false);
            setRejectReason('');
        }
    };

    const handleSendNote = async () => {
        if (!firestore || !user || !noteText.trim() || !applicationId || !selectedStageId) return;
        setSendingNote(true);
        try {
            await addDoc(collection(firestore, 'application_notes'), {
                applicationId,
                stageId: selectedStageId,
                authorId: user.uid,
                authorName: user.displayName || 'Коллагатор',
                authorPhotoURL: (user as any).photoURL || null,
                text: noteText,
                createdAt: new Date().toISOString()
            });
            await logEvent('NOTE', 'Тэмдэглэл нэмсэн', noteText);
            setNoteText('');
        } catch { toast({ title: 'Тэмдэглэл хадгалж чадсангүй', variant: 'destructive' }); }
        finally { setSendingNote(false); }
    };

    const handleSelectTemplate = (tpl: MessageTemplate) => {
        setSelectedTemplate(tpl);
        setPreviewText(tpl.body.replace(/{{name}}/g, candidate?.firstName || 'Нэр'));
        setShowPreview(true);
    };

    const handleSendMessage = async () => {
        if (!firestore || !candidate || !previewText.trim() || !applicationId) return;
        setSendingMessage(true);
        try {
            await logEvent('MESSAGE', 'Мессеж илгээсэн', previewText);
            if (sendAsSms && candidate.phone) {
                await sendSMS(candidate.phone, previewText);
                toast({ title: 'SMS амжилттай илгээгдлээ' });
            } else {
                toast({ title: 'Мессеж хадгалагдлаа' });
            }
            setShowPreview(false);
            setPreviewText('');
        } catch (error: any) {
            toast({ title: 'Мессеж илгээж чадсангүй', description: error.message, variant: 'destructive' });
        } finally { setSendingMessage(false); }
    };

    const openEditCandidate = () => {
        if (!candidate) return;
        setEditCandidate({
            firstName: candidate.firstName || '',
            lastName: candidate.lastName || '',
            email: candidate.email || '',
            phone: candidate.phone || '',
            linkedinUrl: candidate.linkedinUrl || '',
            portfolioUrl: candidate.portfolioUrl || '',
            source: candidate.source || '',
            notes: candidate.notes || '',
        });
        setIsEditCandidateOpen(true);
    };

    const handleSaveCandidate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!firestore || !candidate) return;
        if (!editCandidate.firstName.trim() || !editCandidate.lastName.trim()) {
            toast({ title: 'Нэр овог заавал оруулна уу', variant: 'destructive' });
            return;
        }
        setSavingCandidate(true);
        try {
            const updates: Record<string, any> = {
                firstName: editCandidate.firstName.trim(),
                lastName: editCandidate.lastName.trim(),
                email: editCandidate.email.trim(),
                phone: editCandidate.phone.trim(),
                linkedinUrl: editCandidate.linkedinUrl.trim() || null,
                portfolioUrl: editCandidate.portfolioUrl.trim() || null,
                source: editCandidate.source.trim() || null,
                notes: editCandidate.notes.trim() || null,
                updatedAt: new Date().toISOString(),
            };
            await updateDoc(doc(firestore, 'candidates', candidate.id), updates);
            setCandidate(prev => prev ? { ...prev, ...updates } : null);
            await logEvent('SYSTEM', 'Горилогчийн мэдээлэл засагдсан', `${updates.lastName} ${updates.firstName}`);
            toast({ title: 'Мэдээлэл шинэчлэгдлээ' });
            setIsEditCandidateOpen(false);
        } catch (error: any) {
            toast({ title: 'Алдаа гарлаа', description: error.message, variant: 'destructive' });
        } finally {
            setSavingCandidate(false);
        }
    };

    const handleAddTag = async () => {
        if (!firestore || !candidate || !tagInput.trim()) return;
        const newTag = tagInput.trim();
        if ((candidate.tags || []).includes(newTag)) return;
        const updatedTags = [...(candidate.tags || []), newTag];
        try {
            await updateDoc(doc(firestore, 'candidates', candidate.id), { tags: updatedTags, updatedAt: new Date().toISOString() });
            setCandidate({ ...candidate, tags: updatedTags });
            await logEvent('SYSTEM', 'Таг нэмсэн', newTag);
            setTagInput('');
        } catch (e) { console.error(e); }
    };

    const handleRemoveTag = async (tagToRemove: string) => {
        if (!firestore || !candidate) return;
        const updatedTags = (candidate.tags || []).filter(t => t !== tagToRemove);
        try {
            await updateDoc(doc(firestore, 'candidates', candidate.id), { tags: updatedTags, updatedAt: new Date().toISOString() });
            setCandidate({ ...candidate, tags: updatedTags });
        } catch (e) { console.error(e); }
    };

    const handleScorecardSubmit = async (scores: ScorecardCriteria[], notesContent: string) => {
        if (!firestore || !application || !candidate) return;
        setSubmittingScorecard(true);
        try {
            const averageScore = scores.reduce((acc, curr) => acc + curr.score, 0) / scores.length;
            const cleanCriteria = scores.map(c => ({ id: c.id, name: c.name, description: c.description || '', score: c.score }));
            await addDoc(collection(firestore, 'scorecards'), {
                applicationId: application.id, candidateId: candidate.id,
                stageId: selectedStageId || application.currentStageId,
                interviewerId: user?.uid || 'unknown',
                interviewerName: user?.displayName || 'Үнэлгээчин',
                criteria: cleanCriteria, notes: notesContent, averageScore,
                createdAt: new Date().toISOString()
            });
            await logEvent('SCORECARD', 'Үнэлгээ өгсөн', `Дундаж: ${averageScore.toFixed(1)}`);
            toast({ title: 'Үнэлгээ хадгалагдлаа' });
            setShowScorecard(false);
        } catch (error: any) {
            toast({ title: 'Алдаа', description: error.message, variant: 'destructive' });
        } finally { setSubmittingScorecard(false); }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0 || !firestore || !storage || !applicationId) return;

        setUploadingFile(true);
        try {
            const newFiles: ApplicationFile[] = [];
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                const uniqueName = `${Date.now()}-${file.name}`;
                const storageRef = ref(storage, `applications/${applicationId}/${uniqueName}`);
                await uploadBytes(storageRef, file);
                const downloadURL = await getDownloadURL(storageRef);
                newFiles.push({
                    id: `file-${Date.now()}-${i}`,
                    name: file.name,
                    url: downloadURL,
                    size: file.size,
                    type: file.type,
                    stageId: selectedStageId || application?.currentStageId,
                    uploadedAt: new Date().toISOString(),
                    uploadedBy: user?.displayName || 'Unknown',
                });
            }

            const existingFiles = application?.files || [];
            const updatedFiles = [...existingFiles, ...newFiles];
            await updateDoc(doc(firestore, 'applications', applicationId as string), {
                files: updatedFiles,
                updatedAt: new Date().toISOString(),
            });
            setApplication(prev => prev ? { ...prev, files: updatedFiles } : null);
            await logEvent('SYSTEM', 'Файл хавсарсан', newFiles.map(f => f.name).join(', '));
            toast({ title: 'Файл амжилттай хавсаргалаа', description: `${newFiles.length} файл нэмэгдлээ.` });
        } catch (error: any) {
            console.error("File upload error:", error);
            toast({ title: 'Файл хавсаргахад алдаа гарлаа', description: error.message, variant: 'destructive' });
        } finally {
            setUploadingFile(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleDeleteFile = async (fileToDelete: ApplicationFile) => {
        if (!firestore || !storage || !applicationId || !application) return;
        setDeletingFileId(fileToDelete.id);
        try {
            try {
                const storageRef = ref(storage, fileToDelete.url);
                await deleteObject(storageRef);
            } catch {}

            const updatedFiles = (application.files || []).filter(f => f.id !== fileToDelete.id);
            await updateDoc(doc(firestore, 'applications', applicationId as string), {
                files: updatedFiles,
                updatedAt: new Date().toISOString(),
            });
            setApplication(prev => prev ? { ...prev, files: updatedFiles } : null);
            toast({ title: 'Файл устгагдлаа' });
        } catch (error: any) {
            toast({ title: 'Файл устгахад алдаа гарлаа', description: error.message, variant: 'destructive' });
        } finally {
            setDeletingFileId(null);
        }
    };

    const handleDeleteApplication = async () => {
        if (!firestore || !applicationId) return;
        setIsDeleting(true);
        try {
            const batch = writeBatch(firestore);
            for (const collName of ['application_messages', 'application_events', 'application_notes', 'scorecards']) {
                const q = query(collection(firestore, collName), where('applicationId', '==', applicationId));
                const snapshot = await getDocs(q);
                snapshot.forEach((d) => batch.delete(d.ref));
            }
            if (application?.candidateId) batch.delete(doc(firestore, 'candidates', application.candidateId));
            batch.delete(doc(firestore, 'applications', applicationId as string));
            await batch.commit();
            router.push('/dashboard/recruitment');
            toast({ title: 'Устгагдлаа' });
        } catch { setIsDeleting(false); }
    };

    // --- Loading / Error States ---
    if (loading) return <div className="flex h-screen items-center justify-center bg-slate-50"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>;
    if (error || !application || !candidate) return <div className="p-8 text-center text-red-500">{error || 'Мэдээлэл олдсонгүй'}</div>;

    const REJECTED_STAGE: RecruitmentStage = { id: 'rejected', title: 'Татгалзсан', type: 'REJECTED', order: 999 };
    const HIRED_STAGE: RecruitmentStage = { id: 'hired', title: 'Ажилд авсан', type: 'HIRED', order: 998 };
    const isRejected = application.status === 'REJECTED';
    const isHired = application.status === 'HIRED';
    const displayStages = isRejected
        ? [...globalStages, REJECTED_STAGE]
        : isHired
            ? [...globalStages, HIRED_STAGE]
            : globalStages;

    const currentStage = displayStages.find(s => s.id === application.currentStageId);
    const selectedStage = displayStages.find(s => s.id === selectedStageId);
    const currentStageIdx = displayStages.findIndex(s => s.id === application.currentStageId);
    const selectedStageIdx = displayStages.findIndex(s => s.id === selectedStageId);
    const isViewingCurrentStage = selectedStageId === application.currentStageId;
    const isViewingPastStage = selectedStageIdx < currentStageIdx;
    const isViewingFutureStage = selectedStageIdx > currentStageIdx;
    const nextStageName = pendingNextStageId ? displayStages.find(s => s.id === pendingNextStageId)?.title : '';

    return (
        <div className="flex h-screen w-full flex-col bg-[#F8FAFC] overflow-hidden text-slate-900 font-sans">

            <header className="shrink-0 border-b bg-white/80 backdrop-blur-md z-30">
                <div className="px-6 py-4">
                    <PageHeader
                        title={`${candidate.lastName} ${candidate.firstName}`}
                        description={[vacancy?.title, currentStage?.title].filter(Boolean).join(' • ')}
                        showBackButton
                        hideBreadcrumbs
                        backButtonPlacement="inline"
                        backBehavior="history"
                        fallbackBackHref="/dashboard/recruitment"
                        actions={
                            <Button variant="ghost" size="sm" className="h-9 w-9 p-0 text-slate-400 hover:text-red-600 hover:bg-red-50" onClick={() => setShowDeleteConfirm(true)}>
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        }
                    />
                </div>
            </header>

            {/* Main Layout Area */}
            <main className="flex flex-1 min-h-0 overflow-hidden">

                {/* Left Sidebar: Candidate Card */}
                <aside className="w-[340px] shrink-0 bg-white border-r flex flex-col z-20">
                            <ScrollArea className="flex-1">
                                <div className="p-4 space-y-5">
                                    <div className="relative group">
                                        <EmployeeCard
                                            variant="detailed"
                                            asLink={false}
                                            showQuestionnaireAction={false}
                                            showProgressRing={false}
                                            employee={{
                                                id: candidate.id,
                                                firstName: candidate.firstName,
                                                lastName: candidate.lastName,
                                                email: candidate.email,
                                                phoneNumber: candidate.phone,
                                                status: application.status === 'HIRED' ? 'active_recruitment' : 'candidate',
                                                lifecycleStage: application.status === 'HIRED' ? 'onboarding' : 'recruitment',
                                                jobTitle: vacancy?.title || '',
                                            } as EmployeeCardEmployee}
                                            footer={
                                                <div className="flex items-center justify-between w-full">
                                                    <Badge variant="outline" className={cn(
                                                        "bg-white font-medium text-[10px]",
                                                        application.status === 'ACTIVE' && "text-blue-600 border-blue-200",
                                                        application.status === 'HIRED' && "text-emerald-600 border-emerald-200",
                                                        application.status === 'REJECTED' && "text-red-600 border-red-200",
                                                        application.status === 'WITHDRAWN' && "text-slate-500 border-slate-200",
                                                    )}>
                                                        {{ ACTIVE: 'Идэвхтэй', HIRED: 'Ажилд авсан', REJECTED: 'Татгалзсан', WITHDRAWN: 'Нэрээ татсан' }[application.status]}
                                                    </Badge>
                                                    <span className="text-[10px] text-muted-foreground">
                                                        {currentStage?.title}
                                                    </span>
                                                </div>
                                            }
                                        />
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="absolute top-2 right-2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-blue-600 hover:bg-blue-50"
                                            onClick={openEditCandidate}
                                        >
                                            <Pencil className="h-3.5 w-3.5" />
                                        </Button>
                                    </div>

                                    {/* Candidate Extra Info */}
                                    {(candidate.linkedinUrl || candidate.portfolioUrl || candidate.source || candidate.notes) && (
                                        <div className="space-y-2 px-1">
                                            <span className="text-xs font-bold uppercase text-slate-400 tracking-wider">Нэмэлт мэдээлэл</span>
                                            <div className="space-y-1.5">
                                                {candidate.linkedinUrl && (
                                                    <a href={candidate.linkedinUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-xs text-blue-600 hover:underline">
                                                        <LinkIcon className="h-3 w-3" /> LinkedIn
                                                    </a>
                                                )}
                                                {candidate.portfolioUrl && (
                                                    <a href={candidate.portfolioUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-xs text-blue-600 hover:underline">
                                                        <Globe className="h-3 w-3" /> Портфолио
                                                    </a>
                                                )}
                                                {candidate.source && (
                                                    <div className="flex items-center gap-2 text-xs text-slate-500">
                                                        <UserIcon className="h-3 w-3" /> Эх сурвалж: {candidate.source}
                                                    </div>
                                                )}
                                                {candidate.notes && (
                                                    <p className="text-xs text-slate-500 bg-slate-50 rounded-lg p-2 italic">{candidate.notes}</p>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {/* Tags */}
                                    <div className="space-y-2 px-1">
                                        <span className="text-xs font-bold uppercase text-slate-400 tracking-wider">Тагууд</span>
                                        <div className="flex flex-wrap gap-1.5">
                                            {(candidate.tags || []).map(tag => (
                                                <Badge key={tag} variant="secondary" className="bg-slate-100 hover:bg-red-50 hover:text-red-500 cursor-pointer gap-1 group transition-colors pr-1 text-[11px]">
                                                    {tag}
                                                    <X className="h-3 w-3 opacity-0 group-hover:opacity-100" onClick={() => handleRemoveTag(tag)} />
                                                </Badge>
                                            ))}
                                        </div>
                                        <div className="flex gap-1.5">
                                            <input className="flex-1 bg-slate-50 border rounded-lg px-2.5 py-1 text-xs outline-none focus:ring-2 focus:ring-blue-100"
                                                placeholder="Таг нэмэх..."
                                                value={tagInput} onChange={e => setTagInput(e.target.value)}
                                                onKeyDown={e => e.key === 'Enter' && handleAddTag()} />
                                            <Button size="sm" variant="outline" onClick={handleAddTag} disabled={!tagInput.trim()} className="h-7 w-7 p-0">
                                                <Check className="h-3 w-3" />
                                            </Button>
                                        </div>
                                    </div>

                                    <div className="text-xs text-slate-400 px-1">
                                        Бүртгэл: {application.appliedAt ? format(new Date(application.appliedAt), 'yyyy.MM.dd') : '-'}
                                    </div>
                                </div>
                            </ScrollArea>
                </aside>

                {/* Center Content: Stage-based */}
                <section className="flex-1 flex flex-col min-w-0 bg-[#F8FAFC]">

                    {/* Stage Stepper */}
                    <div className="shrink-0 bg-white border-b px-6 py-3">
                        <div className="flex items-center gap-1 overflow-x-auto">
                            {displayStages.map((stage, idx) => {
                                const isRejectedStage = stage.id === 'rejected';
                                const isHiredStage = stage.id === 'hired';
                                const isTerminalStage = isRejectedStage || isHiredStage;
                                const isCurrent = application.currentStageId === stage.id;
                                const isPast = currentStageIdx > idx;
                                const isSelected = selectedStageId === stage.id;
                                const isSkipped = (isRejected || isHired) && !isTerminalStage && !isPast && !isCurrent;

                                return (
                                    <React.Fragment key={stage.id}>
                                        {idx > 0 && (
                                            <div className={cn(
                                                "h-[2px] w-6 shrink-0 rounded-full",
                                                isRejectedStage && isCurrent ? "bg-red-300" :
                                                    isHiredStage && isCurrent ? "bg-emerald-400" :
                                                        isPast ? "bg-emerald-400" :
                                                            isCurrent ? "bg-blue-300" :
                                                                isSkipped && isRejected ? "bg-red-200 opacity-50" :
                                                                    isSkipped && isHired ? "bg-emerald-200 opacity-50" :
                                                                        "bg-slate-200"
                                            )} />
                                        )}
                                        <button
                                            onClick={() => setSelectedStageId(stage.id)}
                                            className={cn(
                                                "flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-all shrink-0 border",
                                                isSelected && isRejectedStage
                                                    ? "bg-red-600 text-white border-red-600 shadow-md"
                                                    : isSelected && isHiredStage
                                                        ? "bg-emerald-600 text-white border-emerald-600 shadow-md"
                                                        : isSelected
                                                            ? "bg-slate-900 text-white border-slate-900 shadow-md"
                                                            : isRejectedStage && isCurrent
                                                                ? "bg-red-50 text-red-700 border-red-200"
                                                                : isHiredStage && isCurrent
                                                                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                                                    : isSkipped
                                                                        ? "bg-slate-50 text-slate-300 border-slate-100 line-through"
                                                                        : isCurrent
                                                                            ? "bg-blue-50 text-blue-700 border-blue-200"
                                                                            : isPast
                                                                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                                                                : "bg-white text-slate-400 border-slate-200 hover:bg-slate-50"
                                            )}
                                        >
                                            <div className={cn(
                                                "h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0",
                                                isSelected && isRejectedStage ? "bg-white text-red-600" :
                                                    isSelected && isHiredStage ? "bg-white text-emerald-600" :
                                                        isSelected ? "bg-white text-slate-900" :
                                                            isRejectedStage && isCurrent ? "bg-red-200 text-red-700" :
                                                                isHiredStage && isCurrent ? "bg-emerald-200 text-emerald-700" :
                                                                    isSkipped ? "bg-slate-100 text-slate-300" :
                                                                        isPast ? "bg-emerald-200 text-emerald-700" :
                                                                            isCurrent ? "bg-blue-200 text-blue-700" : "bg-slate-100 text-slate-400"
                                            )}>
                                                {isRejectedStage ? <X className="h-3 w-3" /> :
                                                    isHiredStage ? <CheckCircle2 className="h-3 w-3" /> :
                                                        isSkipped ? <span className="text-[8px]">—</span> :
                                                            isPast ? <Check className="h-3 w-3" /> : idx + 1}
                                            </div>
                                            {stage.title}
                                        </button>
                                    </React.Fragment>
                                );
                            })}
                        </div>
                    </div>

                    {/* Stage Content */}
                    <ScrollArea className="flex-1">
                        <div className="p-6 max-w-4xl mx-auto space-y-4 pb-32">

                            {/* Stage Header */}
                            <div className="flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                    <h2 className={cn(
                                        "text-lg font-bold",
                                        selectedStageId === 'rejected' ? "text-red-600" :
                                            selectedStageId === 'hired' ? "text-emerald-600" : "text-slate-900"
                                    )}>{selectedStage?.title}</h2>
                                    <p className="text-xs text-slate-400 mt-0.5">
                                        {selectedStageId === 'rejected' ? 'Татгалзсан' :
                                            selectedStageId === 'hired' ? 'Ажилд авсан' :
                                                isViewingCurrentStage ? 'Одоогийн шат' : isViewingPastStage ? 'Дууссан шат' : 'Хүлээгдэж буй шат'}
                                        {selectedStage && selectedStageId !== 'rejected' && selectedStageId !== 'hired' && <span> • {selectedStage.type}</span>}
                                    </p>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    {/* Дууссан төлөвт (rejected/hired) товч харуулахгүй */}
                                    {!isRejected && !isHired && (
                                        <>
                                            <ScheduleInterviewDialog applicationId={application.id} candidate={candidate} vacancy={vacancy || undefined} onScheduled={(i) => logEvent('SYSTEM', 'Ярилцлага', i.title)}>
                                                <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8">
                                                    <Calendar className="h-3.5 w-3.5" />
                                                    Ярилцлага товлох
                                                </Button>
                                            </ScheduleInterviewDialog>

                                            {isViewingCurrentStage && (
                                                <>
                                                    <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8 text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700" onClick={() => handleStatusUpdate('REJECTED')}>
                                                        <X className="h-3.5 w-3.5" />
                                                        Татгалзах
                                                    </Button>
                                                    <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8 text-emerald-600 border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700" onClick={() => handleStatusUpdate('HIRED')}>
                                                        <CheckCircle2 className="h-3.5 w-3.5" />
                                                        Ажилд авах
                                                    </Button>
                                                    {currentStageIdx < globalStages.length - 1 && (
                                                        <Button onClick={requestAdvanceStage} size="sm" className="bg-blue-600 hover:bg-blue-700 gap-1.5 text-xs h-8">
                                                            Дараагийн шат
                                                            <ChevronRight className="h-3.5 w-3.5" />
                                                        </Button>
                                                    )}
                                                </>
                                            )}
                                        </>
                                    )}
                                    {isViewingPastStage && !isRejected && !isHired && (
                                        <Badge variant="outline" className="border-emerald-200 text-emerald-600 gap-1">
                                            <Check className="h-3 w-3" /> Дууссан
                                        </Badge>
                                    )}
                                    {isViewingFutureStage && !isRejected && !isHired && (
                                        <Badge variant="outline" className="border-slate-200 text-slate-400">Хүлээгдэж буй</Badge>
                                    )}
                                    {selectedStageId === 'rejected' && (
                                        <Badge variant="outline" className="border-red-200 text-red-600 bg-red-50 gap-1">
                                            <X className="h-3 w-3" /> Татгалзсан
                                        </Badge>
                                    )}
                                    {selectedStageId === 'hired' && (
                                        <Badge variant="outline" className="border-emerald-200 text-emerald-600 bg-emerald-50 gap-1">
                                            <CheckCircle2 className="h-3 w-3" /> Ажилд авсан
                                        </Badge>
                                    )}
                                </div>
                            </div>

                            {/* Hired Info Card */}
                            {selectedStageId === 'hired' && (
                                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                                    <div className="flex items-start gap-3">
                                        <div className="h-8 w-8 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
                                            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                                        </div>
                                        <div>
                                            <p className="text-xs font-semibold text-emerald-700 mb-1">Ажилд авсан</p>
                                            <p className="text-sm text-emerald-800">{candidate.lastName} {candidate.firstName} амжилттай ажилд авагдлаа. Ажилтны бүртгэл системд үүссэн.</p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Rejection Reason Card */}
                            {selectedStageId === 'rejected' && application.rejectionReason && (
                                <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                                    <div className="flex items-start gap-3">
                                        <div className="h-8 w-8 rounded-lg bg-red-100 flex items-center justify-center shrink-0">
                                            <FileText className="h-4 w-4 text-red-500" />
                                        </div>
                                        <div>
                                            <p className="text-xs font-semibold text-red-700 mb-1">Татгалзсан шалтгаан</p>
                                            <p className="text-sm text-red-800 whitespace-pre-wrap">{application.rejectionReason}</p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Messages Section */}
                            <Section title="Харилцаа холбоо" icon={MessageSquare} count={stageEvents.filter(e => e.type === 'MESSAGE').length}>
                                <div className="space-y-4">
                                    {/* Quick template select */}
                                    <div className="flex flex-wrap gap-2">
                                        {messageTemplates.map(tpl => (
                                            <Button key={tpl.id} variant="outline" size="sm" className="text-xs h-7" onClick={() => handleSelectTemplate(tpl)}>
                                                {tpl.title}
                                            </Button>
                                        ))}
                                        <Button variant="outline" size="sm" className="text-xs h-7 gap-1" onClick={() => { setPreviewText(''); setShowPreview(true); }}>
                                            <MessageSquare className="h-3 w-3" /> Шинэ мессеж
                                        </Button>
                                    </div>

                                    {showPreview && (
                                        <div className="space-y-3 bg-slate-50 p-4 rounded-lg border">
                                            <Textarea value={previewText} onChange={e => setPreviewText(e.target.value)} placeholder="Мессежний агуулга..." className="min-h-[100px] bg-white" />
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <Switch checked={sendAsSms} onCheckedChange={setSendAsSms} />
                                                    <Label className="text-xs">SMS-ээр илгээх</Label>
                                                </div>
                                                <div className="flex gap-2">
                                                    <Button variant="outline" size="sm" onClick={() => setShowPreview(false)}>Болих</Button>
                                                    <Button size="sm" onClick={handleSendMessage} disabled={sendingMessage || !previewText.trim()} className="bg-blue-600 gap-1.5">
                                                        {sendingMessage ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />} Илгээх
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Sent messages for this stage */}
                                    {stageEvents.filter(e => e.type === 'MESSAGE').map(evt => (
                                        <div key={evt.id} className="bg-blue-50 border border-blue-100 rounded-lg p-3">
                                            <p className="text-sm text-slate-700 whitespace-pre-wrap">{evt.description}</p>
                                            <p className="text-[10px] text-slate-400 mt-2">{evt.userName} • {evt.createdAt ? format(new Date(evt.createdAt), 'MM/dd HH:mm') : ''}</p>
                                        </div>
                                    ))}
                                </div>
                            </Section>

                            {/* Notes Section */}
                            <Section title="Тэмдэглэл" icon={StickyNote} defaultOpen={isViewingCurrentStage} count={stageNotes.length}>
                                <div className="space-y-3">
                                    {isViewingCurrentStage && (
                                        <div className="flex gap-3">
                                            <Textarea value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="Тэмдэглэл бичих..." className="min-h-[60px]" />
                                            <Button onClick={handleSendNote} disabled={!noteText.trim() || sendingNote} className="h-auto px-4 bg-amber-500 hover:bg-amber-600 text-white shrink-0">
                                                {sendingNote ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                                            </Button>
                                        </div>
                                    )}
                                    {stageNotes.length === 0 && (
                                        <p className="text-sm text-slate-400 italic py-2">Энэ шатанд тэмдэглэл байхгүй</p>
                                    )}
                                    {stageNotes.map(note => (
                                        <div key={note.id} className="bg-amber-50 border border-amber-100 p-4 rounded-lg relative">
                                            <Quote className="absolute top-3 right-3 h-5 w-5 text-amber-200/50" />
                                            <p className="text-sm text-amber-900 whitespace-pre-wrap">{note.text}</p>
                                            <div className="flex items-center gap-2 mt-3 pt-2 border-t border-amber-100/50">
                                                <Avatar className="h-6 w-6 shrink-0">
                                                    <AvatarImage src={note.authorPhotoURL} alt={note.authorName} />
                                                    <AvatarFallback className="text-[9px] font-bold text-amber-700 bg-amber-200">
                                                        {note.authorName?.[0] || '?'}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <span className="text-[10px] font-semibold text-amber-700/70">{note.authorName}</span>
                                                <span className="text-[10px] text-amber-500/50 ml-auto">{format(new Date(note.createdAt), 'MM/dd HH:mm')}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </Section>

                            {/* Evaluation Section */}
                            <Section title="Үнэлгээ" icon={Star} count={stageScorecards.length} actions={
                                isViewingCurrentStage ? (
                                    <div className="flex gap-1.5">
                                        <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setShowSendEvaluation(true)}>
                                            <Send className="h-3 w-3" /> Ажилтанд илгээх
                                        </Button>
                                        <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setShowScorecard(true)}>
                                            <Star className="h-3 w-3" /> Үнэлгээ нэмэх
                                        </Button>
                                    </div>
                                ) : undefined
                            }>
                                <div className="space-y-4">
                                    {stageScorecards.length === 0 && (
                                        <p className="text-sm text-slate-400 italic py-2">Энэ шатанд үнэлгээ байхгүй</p>
                                    )}
                                    {stageScorecards.map(sc => (
                                        <div key={sc.id} className="border rounded-lg overflow-hidden">
                                            <div className="p-3 bg-slate-50 border-b flex justify-between items-center">
                                                <div className="flex items-center gap-2">
                                                    <Avatar className="h-6 w-6"><AvatarFallback className="text-[10px]">{sc.interviewerName?.[0]}</AvatarFallback></Avatar>
                                                    <span className="text-xs font-semibold">{sc.interviewerName}</span>
                                                    <span className="text-[10px] text-slate-400">{format(new Date(sc.createdAt), 'yyyy.MM.dd')}</span>
                                                </div>
                                                <div className="flex items-center gap-1 bg-white px-2 py-0.5 rounded-full border text-xs font-bold">
                                                    <Star className="h-3 w-3 text-amber-400 fill-amber-400" />
                                                    {sc.averageScore.toFixed(1)}
                                                </div>
                                            </div>
                                            <div className="p-3 space-y-2">
                                                {sc.criteria.map((c, idx) => (
                                                    <div key={idx} className="flex justify-between items-center text-xs">
                                                        <span className="text-slate-600">{c.name}</span>
                                                        <div className="flex gap-0.5">
                                                            {[1, 2, 3, 4, 5].map(s => (
                                                                <div key={s} className={cn("h-1.5 w-3 rounded-full", s <= c.score ? "bg-blue-500" : "bg-slate-200")} />
                                                            ))}
                                                        </div>
                                                    </div>
                                                ))}
                                                {sc.notes && <p className="text-xs text-slate-500 italic bg-slate-50 p-2 rounded mt-2">&ldquo;{sc.notes}&rdquo;</p>}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </Section>

                            {/* Files Section */}
                            <Section title="Файлууд" icon={Files} count={(candidate.resumeUrl ? 1 : 0) + (application.files?.length || 0)}>
                                <div className="space-y-3">
                                    {candidate.resumeUrl && (
                                        <a href={candidate.resumeUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-3 border rounded-lg hover:bg-slate-50 hover:border-blue-200 group transition-all">
                                            <div className="h-10 w-10 bg-red-50 rounded-lg flex items-center justify-center text-red-500 group-hover:scale-110 transition-transform">
                                                <FileText className="h-5 w-5" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-semibold text-slate-700">{candidate.resumeName || 'Resume.pdf'}</p>
                                                <p className="text-xs text-slate-400">CV / Resume</p>
                                            </div>
                                            <Download className="h-4 w-4 text-slate-300 group-hover:text-blue-500" />
                                        </a>
                                    )}

                                    {(application.files || []).map((file) => (
                                        <div key={file.id} className="flex items-center gap-3 p-3 border rounded-lg hover:bg-slate-50 group transition-all">
                                            <div className="h-10 w-10 bg-blue-50 rounded-lg flex items-center justify-center text-blue-500 shrink-0">
                                                <FileText className="h-5 w-5" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-semibold text-slate-700 truncate">{file.name}</p>
                                                <p className="text-xs text-slate-400">
                                                    {(file.size / 1024).toFixed(0)} KB
                                                    {file.uploadedBy && <span> • {file.uploadedBy}</span>}
                                                    {file.uploadedAt && <span> • {format(new Date(file.uploadedAt), 'yyyy.MM.dd')}</span>}
                                                </p>
                                            </div>
                                            <a href={file.url} target="_blank" rel="noopener noreferrer" className="shrink-0">
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-300 hover:text-blue-500">
                                                    <Download className="h-4 w-4" />
                                                </Button>
                                            </a>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-slate-300 hover:text-red-500 hover:bg-red-50 shrink-0"
                                                onClick={() => handleDeleteFile(file)}
                                                disabled={deletingFileId === file.id}
                                            >
                                                {deletingFileId === file.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                            </Button>
                                        </div>
                                    ))}

                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        multiple
                                        className="hidden"
                                        onChange={handleFileUpload}
                                        accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.gif,.txt,.csv,.zip"
                                    />
                                    <div
                                        onClick={() => !uploadingFile && fileInputRef.current?.click()}
                                        className={cn(
                                            "border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:bg-slate-50 hover:border-blue-300 transition-all",
                                            uploadingFile && "pointer-events-none opacity-60"
                                        )}
                                    >
                                        {uploadingFile ? (
                                            <>
                                                <Loader2 className="h-8 w-8 mx-auto mb-2 text-blue-400 animate-spin" />
                                                <p className="text-xs text-blue-500 font-medium">Хавсаргаж байна...</p>
                                            </>
                                        ) : (
                                            <>
                                                <Upload className="h-8 w-8 mx-auto mb-2 text-slate-300" />
                                                <p className="text-xs text-slate-500 font-medium">+ Файл хавсаргах</p>
                                                <p className="text-[10px] text-slate-400 mt-1">PDF, Word, Excel, Зураг гэх мэт</p>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </Section>

                            {/* Activity Log Section */}
                            <Section title="Түүх" icon={History} count={stageEvents.length}>
                                <div className="space-y-3">
                                    {stageEvents.length === 0 && (
                                        <p className="text-sm text-slate-400 italic py-2">Энэ шатанд бүртгэл байхгүй</p>
                                    )}
                                    {stageEvents.map(evt => {
                                        const iconMap: Record<string, React.ElementType> = {
                                            STAGE_CHANGE: CheckCircle2, MESSAGE: MessageSquare,
                                            NOTE: FileText, SCORECARD: Star, SYSTEM: Clock,
                                        };
                                        const EvtIcon = iconMap[evt.type] || Clock;

                                        return (
                                            <div key={evt.id} className="flex items-start gap-3 text-xs">
                                                <div className="h-6 w-6 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 shrink-0 mt-0.5">
                                                    <EvtIcon className="h-3 w-3" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-semibold text-slate-700">{evt.title}</p>
                                                    {evt.description && <p className="text-slate-500 mt-0.5 line-clamp-2">{evt.description}</p>}
                                                </div>
                                                <span className="text-[10px] text-slate-400 shrink-0">{evt.createdAt ? format(new Date(evt.createdAt), 'MM/dd HH:mm') : ''}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </Section>

                        </div>
                    </ScrollArea>
                </section>

            </main>

            {/* Scorecard Dialog */}
            <Dialog open={showScorecard} onOpenChange={setShowScorecard}>
                <DialogContent className="max-w-2xl p-0 overflow-hidden rounded-[2rem] border-none shadow-2xl">
                    <DialogTitle className="sr-only">Үнэлгээний хуудас</DialogTitle>
                    <InterviewScorecard
                        candidateName={`${candidate.lastName} ${candidate.firstName}`}
                        onSubmit={handleScorecardSubmit}
                        onCancel={() => setShowScorecard(false)}
                        isLoading={submittingScorecard}
                    />
                </DialogContent>
            </Dialog>

            {/* Send Evaluation to Employee Dialog */}
            {application && candidate && (
                <SendEvaluationDialog
                    open={showSendEvaluation}
                    onOpenChange={setShowSendEvaluation}
                    applicationId={applicationId as string}
                    candidateId={application.candidateId}
                    candidateName={`${candidate.lastName} ${candidate.firstName}`}
                    vacancyTitle={vacancy?.title}
                    stageId={selectedStageId}
                    requestedByUid={user?.uid || ''}
                    requestedByName={user?.displayName || 'HR'}
                />
            )}

            {/* Advance Stage Confirmation */}
            <AlertDialog open={showAdvanceConfirm} onOpenChange={setShowAdvanceConfirm}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Дараагийн шат руу урагшлах уу?</AlertDialogTitle>
                        <AlertDialogDescription>
                            <strong>&ldquo;{currentStage?.title}&rdquo;</strong> шатны тэмдэглэл, үнэлгээ, түүх, файлууд тухайн шатанд хадгалагдаж, <strong>&ldquo;{nextStageName}&rdquo;</strong> шат цэвэр хоосон эхлэнэ. Энэ үйлдлийг буцааж болохгүй.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Болих</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmAdvanceStage} className="bg-blue-600 hover:bg-blue-700 gap-2">
                            <ChevronRight className="h-4 w-4" /> Урагшлах
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Hire Confirmation */}
            <AlertDialog open={showHireConfirm} onOpenChange={setShowHireConfirm}>
                <AlertDialogContent className="max-w-md">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2">
                            <div className="h-8 w-8 rounded-full bg-emerald-100 flex items-center justify-center">
                                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                            </div>
                            Ажилд авах
                        </AlertDialogTitle>
                        <AlertDialogDescription asChild>
                            <div className="space-y-4 pt-2">
                                <p className="text-sm text-slate-600">
                                    Дараах горилогчийг ажилд авах гэж байна. Системд шинэ ажилтан бүртгэгдэж, нэвтрэх эрх үүснэ.
                                </p>
                                <div className="bg-slate-50 rounded-xl p-4 space-y-2 border">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs text-slate-500">Нэр</span>
                                        <span className="text-sm font-semibold text-slate-900">{candidate.lastName} {candidate.firstName}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs text-slate-500">Имэйл</span>
                                        <span className="text-sm text-slate-700">{candidate.email}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs text-slate-500">Утас</span>
                                        <span className="text-sm text-slate-700">{candidate.phone || '—'}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs text-slate-500">Ажлын байр</span>
                                        <span className="text-sm text-slate-700">{vacancy?.title || '—'}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs text-slate-500">Одоогийн шат</span>
                                        <span className="text-sm text-slate-700">{currentStage?.title || '—'}</span>
                                    </div>
                                </div>
                                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
                                    <strong>Анхааруулга:</strong> Шинэ ажилтны нэвтрэх нууц үг нь утасны дугаар ({candidate.phone || '123456'}) байна. Ажилд авсны дараа ажилтанд мэдэгдэнэ үү.
                                </div>
                            </div>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isHiring}>Болих</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmHire} disabled={isHiring} className="bg-emerald-600 hover:bg-emerald-700 gap-2">
                            {isHiring ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                            {isHiring ? 'Бүртгэж байна...' : 'Ажилд авах'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Reject Confirmation */}
            <AlertDialog open={showRejectConfirm} onOpenChange={setShowRejectConfirm}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Горилогчоос татгалзах</AlertDialogTitle>
                        <AlertDialogDescription asChild>
                            <div className="space-y-3">
                                <p>Татгалзсан шалтгааныг тэмдэглэнэ үү.</p>
                                <Textarea
                                    value={rejectReason}
                                    onChange={e => setRejectReason(e.target.value)}
                                    placeholder="Жишээ: Туршлага хангалтгүй, мэргэжлийн шалгалтад тэнцээгүй..."
                                    className="min-h-[80px]"
                                />
                            </div>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Болих</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmReject} className="bg-red-600 hover:bg-red-700 gap-2">
                            <X className="h-4 w-4" /> Татгалзах
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Edit Candidate Dialog */}
            <Dialog open={isEditCandidateOpen} onOpenChange={setIsEditCandidateOpen}>
                <DialogContent className="sm:max-w-[480px]">
                    <DialogHeader>
                        <DialogTitle>Горилогчийн мэдээлэл засах</DialogTitle>
                        <DialogDescription>
                            Горилогчийн үндсэн мэдээлэлд өөрчлөлт оруулах.
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSaveCandidate} className="space-y-4 py-2">
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label htmlFor="edit-lastName">Овог <span className="text-red-500">*</span></Label>
                                <Input id="edit-lastName" value={editCandidate.lastName} onChange={e => setEditCandidate(prev => ({ ...prev, lastName: e.target.value }))} placeholder="Овог" autoFocus />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="edit-firstName">Нэр <span className="text-red-500">*</span></Label>
                                <Input id="edit-firstName" value={editCandidate.firstName} onChange={e => setEditCandidate(prev => ({ ...prev, firstName: e.target.value }))} placeholder="Нэр" />
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="edit-email">Имэйл</Label>
                            <Input id="edit-email" type="email" value={editCandidate.email} onChange={e => setEditCandidate(prev => ({ ...prev, email: e.target.value }))} placeholder="example@mail.com" />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="edit-phone">Утас</Label>
                            <Input id="edit-phone" value={editCandidate.phone} onChange={e => setEditCandidate(prev => ({ ...prev, phone: e.target.value }))} placeholder="99112233" />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="edit-linkedin">LinkedIn</Label>
                            <Input id="edit-linkedin" value={editCandidate.linkedinUrl} onChange={e => setEditCandidate(prev => ({ ...prev, linkedinUrl: e.target.value }))} placeholder="https://linkedin.com/in/..." />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="edit-portfolio">Портфолио / Вэбсайт</Label>
                            <Input id="edit-portfolio" value={editCandidate.portfolioUrl} onChange={e => setEditCandidate(prev => ({ ...prev, portfolioUrl: e.target.value }))} placeholder="https://..." />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="edit-source">Эх сурвалж</Label>
                            <Input id="edit-source" value={editCandidate.source} onChange={e => setEditCandidate(prev => ({ ...prev, source: e.target.value }))} placeholder="LinkedIn, Referral, Job Fair гэх мэт" />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="edit-notes">Тэмдэглэл</Label>
                            <Textarea id="edit-notes" value={editCandidate.notes} onChange={e => setEditCandidate(prev => ({ ...prev, notes: e.target.value }))} placeholder="Горилогчийн талаарх тэмдэглэл..." className="min-h-[80px]" />
                        </div>
                        <DialogFooter className="pt-2">
                            <Button type="button" variant="outline" onClick={() => setIsEditCandidateOpen(false)}>Болих</Button>
                            <Button type="submit" className="bg-blue-600 hover:bg-blue-700 gap-2" disabled={savingCandidate}>
                                {savingCandidate ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                                Хадгалах
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation */}
            <AlertDialog open={isDeleting} onOpenChange={setIsDeleting}>
                <AlertDialogContent><p>Устгаж байна...</p></AlertDialogContent>
            </AlertDialog>
            <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Та итгэлтэй байна уу?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Нэр дэвшигч болон бүх мэдээлэл бүрмөсөн устана.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Болих</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteApplication} className="bg-red-600 hover:bg-red-700">Устгах</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
