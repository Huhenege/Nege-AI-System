'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useFirebase, useDoc, useCollection, useFetchCollection, useTenantWrite, useMemoFirebase, tenantCollection, tenantDoc } from '@/firebase';
import { doc, Timestamp, updateDoc, collection, query, where, getDoc, deleteDoc, getDocs, orderBy, onSnapshot, writeBatch } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { ERDocument, DOCUMENT_STATUSES, DocumentStatus, ProcessActivity } from '../types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/patterns/page-layout';
import {
    Loader2, ArrowLeft, CheckCircle2, Circle, Clock,
    User, Briefcase, Building2, Send, Save, Undo2,
    MessageSquare, Check, X, Upload, Printer, Download,
    Search, Plus, Trash2, FileText, Sparkles, Users, XCircle, AlertCircle, Wand2, Edit3
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useParams, useRouter } from 'next/navigation';
import { formatDateTime, getReplacementMap, generateDocumentContent } from '../utils';
import { format } from 'date-fns';
import { TemplateBuilder } from '../components/template-builder';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from '@/components/ui/dialog';
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';

import Link from 'next/link';
import { cn } from '@/lib/utils';
import { useReactToPrint } from 'react-to-print';
import { PrintLayout } from '../components/print-layout';


// ─── Employee lifecycle helper ─────────────────────────────────────────────────
// Called after a document is SIGNED to update the employee record.
// Runs as a best-effort operation — failure does NOT roll back the document status.

interface LifecycleParams {
    actionId: string;
    employeeId?: string;
    customInputs?: Record<string, unknown>;
    tDoc: (col: string, ...segs: string[]) => import('firebase/firestore').DocumentReference;
    firestore: import('firebase/firestore').Firestore;
}

async function applyEmployeeLifecycle({
    actionId,
    employeeId,
    customInputs,
    tDoc,
    firestore,
}: LifecycleParams): Promise<void> {
    if (!employeeId || !actionId) return;

    if (actionId.startsWith('release_')) {
        const ci = (customInputs || {}) as Record<string, string>;
        const terminationDate =
            (typeof ci.releaseDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(ci.releaseDate)
                ? ci.releaseDate
                : null) ||
            (typeof ci['Ажлаас чөлөөлөх огноо'] === 'string' &&
            /^\d{4}-\d{2}-\d{2}$/.test(ci['Ажлаас чөлөөлөх огноо'])
                ? ci['Ажлаас чөлөөлөх огноо']
                : null);

        if (actionId === 'release_temporary') {
            await updateDoc(tDoc('employees', employeeId), {
                status: 'on_leave',
                lifecycleStage: 'retention',
                updatedAt: Timestamp.now(),
            });
        } else {
            await updateDoc(tDoc('employees', employeeId), {
                status: 'terminated',
                lifecycleStage: 'alumni',
                ...(terminationDate ? { terminationDate } : {}),
                updatedAt: Timestamp.now(),
            });
        }
        return;
    }

    if (actionId.startsWith('appointment_')) {
        const appointmentStatus =
            actionId === 'appointment_probation'
                ? 'active_probation'
                : 'active_permanent';
        await updateDoc(tDoc('employees', employeeId), {
            status: appointmentStatus,
            lifecycleStage: 'active',
            updatedAt: Timestamp.now(),
        });
    }
}

// ──────────────────────────────────────────────────────────────────────────────
export default function DocumentDetailPage() {
    const { firestore, storage, user: currentUser } = useFirebase();
    const { tDoc, tCollection } = useTenantWrite();
    const currentUserId = currentUser?.uid;
    const { toast } = useToast();
    const router = useRouter();
    const params = useParams<{ id?: string | string[] }>();
    const id = Array.isArray(params?.id) ? params.id[0] : params?.id;

    const docRef = useMemo(() => (firestore && id ? tDoc('er_documents', id) : null), [firestore, id, tDoc]);
    const { data: document, isLoading } = useDoc<ERDocument>(docRef as any);

    // Fetch template to check permissions
    const templateRef = useMemo(() => firestore && document?.templateId ? tDoc('er_templates', document.templateId) : null, [firestore, document?.templateId, tDoc]);
    const { data: template } = useDoc<any>(templateRef);

    // Metadata & Entities
    const [editContent, setEditContent] = useState('');
    const [selectedEmployee, setSelectedEmployee] = useState<any>(null);
    const [selectedDept, setSelectedDept] = useState<string>('');
    const [selectedPos, setSelectedPos] = useState<string>('');
    const [reviewers, setReviewers] = useState<string[]>([]);
    const [isReviewRequired, setIsReviewRequired] = useState(true);
    const [customInputValues, setCustomInputValues] = useState<Record<string, any>>({});

    const departmentsQuery = useMemoFirebase(({ firestore, companyPath }) => firestore ? tenantCollection(firestore, companyPath, 'departments') : null, []);
    const { data: departments } = useFetchCollection<any>(departmentsQuery);

    const positionsQuery = useMemoFirebase(({ firestore, companyPath }) =>
        firestore && selectedDept ? query(tenantCollection(firestore, companyPath, 'positions'), where('departmentId', '==', selectedDept)) : null
        , [selectedDept]);
    const { data: positions } = useFetchCollection<any>(positionsQuery);

    const employeesQuery = useMemoFirebase(({ firestore, companyPath }) => firestore ? tenantCollection(firestore, companyPath, 'employees') : null, []);
    const { data: employeesList } = useCollection<any>(employeesQuery);

    const allPositionsListQuery = useMemoFirebase(({ firestore, companyPath }) => firestore ? tenantCollection(firestore, companyPath, 'positions') : null, []);
    const { data: allPositions } = useFetchCollection<any>(allPositionsListQuery);

    const occupiedPositions = useMemo(() => {
        if (!allPositions || !employeesList) return [];
        return allPositions.map(pos => {
            const occupant = employeesList.find((emp: any) =>
                (emp.positionId === pos.id || emp.id === pos.managerId) &&
                ['active', 'active_probation', 'active_permanent', 'appointing'].includes(emp.status || 'active') // Ensure active/onboarding/appointed only
            );
            return occupant ? { ...pos, occupant } : null;
        }).filter(Boolean);
    }, [allPositions, employeesList]);

    const [companyProfile, setCompanyProfile] = useState<any>(null);
    useEffect(() => {
        if (!firestore) return;
        getDocs(tCollection('company_profile')).then(snap => {
            if (!snap.empty) setCompanyProfile(snap.docs[0].data());
        });
    }, [firestore]);

    // UI States
    // UI States
    const [isSaving, setIsSaving] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [isEditorOpen, setIsEditorOpen] = useState(false);
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    // Print Handling
    const printComponentRef = React.useRef<HTMLDivElement>(null);
    const handlePrint = useReactToPrint({
        contentRef: printComponentRef,
        documentTitle: document?.metadata?.templateName || 'Document',
        onAfterPrint: () => toast({ title: "Хэвлэх үйлдэл дууслаа" })
    });
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

    useEffect(() => {
        if (document) {
            // Only set if current state is empty to avoid overwriting user edits
            if (!editContent) setEditContent(document.content || '');
            if (!selectedDept) setSelectedDept(document.departmentId || '');
            if (!selectedPos) setSelectedPos(document.positionId || '');
            if (reviewers.length === 0) setReviewers(document.reviewers || []);

            // Initialize custom inputs if not set
            if (Object.keys(customInputValues).length === 0 && document.customInputs) {
                setCustomInputValues(document.customInputs);
            }

            if (document.employeeId && !selectedEmployee) {
                getDoc(tDoc('employees', document.employeeId)).then(snap => {
                    if (snap.exists()) setSelectedEmployee({ id: snap.id, ...snap.data() });
                });
            }
        }
    }, [document, firestore]);

    // Fetch current user's employee profile for position-based checks
    const currentUserProfileRef = useMemoFirebase(({ firestore, companyPath }) =>
        firestore && currentUser ? tenantDoc(firestore, companyPath, 'employees', currentUser.uid) : null, [currentUser]);
    const { data: currentUserProfile } = useDoc<any>(currentUserProfileRef);

    const isAdmin = useMemo(() => {
        const role = String(currentUserProfile?.role || '').toLowerCase();
        return role === 'company_super_admin' || role === 'admin' || role === 'hr' || role === 'hr_manager' || role === 'director';
    }, [currentUserProfile]);

    const isApprover = useMemo(() => {
        if (!document?.reviewers || !currentUserProfile) return false;
        // Check if user's position matches any reviewer position
        return document.reviewers.some(rid =>
            rid === currentUserProfile.positionId ||
            rid === currentUserProfile.id // Keep support for direct UID if needed
        );
    }, [document?.reviewers, currentUserProfile]);

    const approveKeyForCurrentUser = useMemo(() => {
        // Reviewers can be either Position IDs or User IDs (legacy/support).
        const rid = reviewers.find((r) => r === currentUser?.uid || (currentUserProfile?.positionId && r === currentUserProfile.positionId));
        return rid || currentUser?.uid || null;
    }, [reviewers, currentUser?.uid, currentUserProfile?.positionId]);

    const canApproveFromCommentBox = useMemo(() => {
        const status = document?.status;
        if (status !== 'IN_REVIEW') return false;
        if (!(isApprover || isAdmin)) return false;
        const key = approveKeyForCurrentUser;
        if (!key) return false;
        return document?.approvalStatus?.[key]?.status !== 'APPROVED';
    }, [document?.status, isApprover, isAdmin, approveKeyForCurrentUser, document?.approvalStatus]);

    if (!id) return <div className="p-10 text-center text-muted-foreground">Баримт олдсонгүй</div>;
    if (isLoading) return <div className="flex h-screen items-center justify-center bg-slate-50"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>;
    if (!document) return <div className="p-8 text-center bg-slate-50 h-screen"><p className="text-muted-foreground">Баримт олдсонгүй</p></div>;

    const currentStatus = document.status;
    const isOwner = document.creatorId === currentUser?.uid;



    const steps = [
        { id: 'DRAFT', label: 'Төлөвлөх', icon: Circle, color: 'text-slate-400' },
        { id: 'IN_REVIEW', label: 'Хянах', icon: Clock, color: 'text-amber-500' },
        { id: 'REVIEWED', label: 'Хянагдсан', icon: CheckCircle2, color: 'text-blue-500' },
        { id: 'SIGNED', label: 'Баталгаажсан', icon: FileText, color: 'text-emerald-700' },
        { id: 'SENT_TO_EMPLOYEE', label: 'Танилцуулах', icon: Send, color: 'text-amber-700' },
        { id: 'ACKNOWLEDGED', label: 'Танилцсан', icon: CheckCircle2, color: 'text-teal-700' },
    ];

    const restoreTemplateContent = () => {
        if (!template?.content) {
            toast({ title: "Алдаа", description: "Эх загвар олдсонгүй", variant: "destructive" });
            return;
        }
        setEditContent(template.content);
        toast({ title: "Сэргээгдлээ", description: "Баримтын агуулгыг анхны эх загвараар сольж сэргээлээ." });
    };

    const handleSaveDraft = async () => {
        if (!docRef) return;
        setIsSaving(true);
        try {
            await updateDoc(tDoc('er_documents', id!), {
                content: editContent,
                departmentId: selectedDept,
                positionId: selectedPos,
                reviewers: reviewers,
                customInputs: customInputValues, // Added this
                metadata: {
                    ...document.metadata,
                    departmentName: departments?.find(d => d.id === selectedDept)?.name,
                    positionName: positions?.find(p => p.id === selectedPos)?.title,
                },
                updatedAt: Timestamp.now()
            });
            toast({ title: "Хадгалагдлаа", description: "Өөрчлөлтүүд амжилттай хадгалагдлаа" });
        } catch (e) {
            toast({ title: "Алдаа", description: "Хадгалахад алдаа гарлаа", variant: "destructive" });
        } finally {
            setIsSaving(false);
        }
    };

    const handleSendForReview = async () => {
        if (!docRef) return;

        if (isReviewRequired && reviewers.length === 0) {
            toast({
                title: "Анхааруулга",
                description: "Хянуулах шаардлагатай үед заавал хянагч сонгох ёстой.",
                variant: "destructive"
            });
            return;
        }

        setIsSaving(true);
        try {
            const initialApprovalStatus: Record<string, any> = {};

            if (isReviewRequired && reviewers.length > 0) {
                reviewers.forEach(uid => {
                    initialApprovalStatus[uid] = { status: 'PENDING', updatedAt: Timestamp.now() };
                });
            }

            // If review is not required, jump straight to REVIEWED to allow uploading original document
            const nextStatus = isReviewRequired ? 'IN_REVIEW' : 'REVIEWED';

            const batch1 = writeBatch(firestore!);
            batch1.update(tDoc('er_documents', id!), {
                status: nextStatus,
                reviewers: isReviewRequired ? reviewers : [],
                approvalStatus: initialApprovalStatus,
                updatedAt: Timestamp.now()
            });
            batch1.set(doc(tCollection('er_documents', id!, 'activity')), {
                type: 'STATUS_CHANGE',
                actorId: currentUser?.uid,
                content: nextStatus === 'REVIEWED' ? 'Хянагдсан төлөвт шилжив' : 'Хянахаар илгээв',
                createdAt: Timestamp.now()
            });
            await batch1.commit();

            toast({
                title: nextStatus === 'REVIEWED' ? "Хянагдсан" : "Илгээгдлээ",
                description: nextStatus === 'REVIEWED' ? "Хянах шат алгасан хянагдсан төлөвт шилжлээ. Одоо эх хувийг хавсаргана уу." : "Баримт хянах шат руу шилжлээ"
            });
        } catch (e) {
            toast({ title: "Алдаа", description: "Илгээхэд алдаа гарлаа", variant: "destructive" });
        } finally {
            setIsSaving(false);
        }
    };

    const handleApprove = async (comment?: string) => {
        if (!docRef || !currentUser) return;
        setIsSaving(true);
        try {
            const newApprovalStatus = { ...document.approvalStatus };

            // Find which reviewer record the current user matches (either by PID or UID)
            const matchedReviewerKey = reviewers.find(rid =>
                rid === currentUser.uid || (currentUserProfile && rid === currentUserProfile.positionId)
            );

            if (matchedReviewerKey) {
                newApprovalStatus[matchedReviewerKey] = {
                    status: 'APPROVED',
                    actorId: currentUser.uid,
                    ...(comment?.trim() ? { comment: comment.trim() } : {}),
                    updatedAt: Timestamp.now()
                };
            } else {
                // Fallback for direct UID if not found as PID
                newApprovalStatus[currentUser.uid] = {
                    status: 'APPROVED',
                    ...(comment?.trim() ? { comment: comment.trim() } : {}),
                    updatedAt: Timestamp.now()
                };
            }

            // Check if all approved (using the keys from the reviewers array)
            const allApproved = reviewers.every(id => newApprovalStatus[id]?.status === 'APPROVED');

            const batch2 = writeBatch(firestore!);
            batch2.update(tDoc('er_documents', id!), {
                approvalStatus: newApprovalStatus,
                status: allApproved ? 'REVIEWED' : 'IN_REVIEW',
                updatedAt: Timestamp.now()
            });
            batch2.set(doc(tCollection('er_documents', id!, 'activity')), {
                type: 'APPROVE',
                actorId: currentUser.uid,
                content: comment?.trim() ? `Батлав: ${comment.trim()}` : 'Баримтыг зөвшөөрөв',
                createdAt: Timestamp.now()
            });
            await batch2.commit();

            toast({ title: "Зөвшөөрлөө", description: allApproved ? "Бүх хянагчид зөвшөөрсөн. Эцсийн батлалт хүлээж байна." : "Таны зөвшөөрөл бүртгэгдлээ" });
        } catch (e) {
            toast({ title: "Алдаа", variant: "destructive" });
        } finally {
            setIsSaving(false);
        }
    };

    const handleFinalApprove = async () => {
        if (!docRef) return;

        // Enforce original copy check
        if (!document.signedDocUrl) {
            toast({
                title: "Анхааруулга",
                description: "Баримтыг эцэслэн батлахын тулд эх хувийг (сканнердсан хувилбар) заавал хавсаргасан байх ёстой.",
                variant: "destructive"
            });
            return;
        }

        setIsSaving(true);
        try {
            // ── Атомик batch: document status + activity log ─────────────────
            const batch3 = writeBatch(firestore!);
            batch3.update(tDoc('er_documents', id!), {
                status: 'SIGNED',
                updatedAt: Timestamp.now()
            });
            batch3.set(doc(tCollection('er_documents', id!, 'activity')), {
                type: 'STATUS_CHANGE',
                actorId: currentUser?.uid,
                content: 'Баримт баталгаажлаа (эх хувь хавсаргав)',
                createdAt: Timestamp.now()
            });
            await batch3.commit();

            // ── Employee lifecycle update (best-effort, тусдаа transaction) ──
            // Амжилтгүй болбол document status-д нөлөөлөхгүй — admin дараа засна.
            applyEmployeeLifecycle({
                actionId: String((document as any)?.metadata?.actionId || ''),
                employeeId: document?.employeeId,
                customInputs: document?.customInputs,
                tDoc,
                firestore: firestore!,
            }).catch(e => console.warn('[finalApprove] Employee lifecycle update failed:', e));

            toast({ title: "Баталгаажлаа", description: "Баримт баталгаажлаа" });
        } catch (e) {
            toast({ title: "Алдаа", variant: "destructive" });
        } finally {
            setIsSaving(false);
        }
    };

    const handleSendToEmployeeForAcknowledgement = async () => {
        if (!docRef) return;
        if (!document?.employeeId) {
            toast({ variant: 'destructive', title: 'Алдаа', description: 'Ажилтан сонгогдоогүй байна.' });
            return;
        }
        if (!(currentStatus === 'SIGNED' || currentStatus === 'APPROVED')) return;

        setIsSaving(true);
        try {
            const batch4 = writeBatch(firestore!);
            batch4.update(tDoc('er_documents', id!), {
                status: 'SENT_TO_EMPLOYEE',
                employeeAckRequired: true,
                employeeAckSentAt: Timestamp.now(),
                employeeAckSentBy: currentUser?.uid || null,
                updatedAt: Timestamp.now(),
            });
            batch4.set(doc(tCollection('er_documents', id!, 'activity')), {
                type: 'STATUS_CHANGE',
                actorId: currentUser?.uid,
                content: 'Ажилтанд танилцуулахаар илгээлээ',
                createdAt: Timestamp.now()
            });
            await batch4.commit();

            toast({ title: 'Илгээгдлээ', description: 'Ажилтанд танилцуулахаар илгээлээ.' });
        } catch (e: any) {
            console.error(e);
            toast({ variant: 'destructive', title: 'Алдаа', description: e?.message || 'Танилцуулахад алдаа гарлаа.' });
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!docRef) return;
        setIsSaving(true);
        try {
            await deleteDoc(tDoc('er_documents', id!));
            toast({ title: "Устгагдлаа", description: "Баримт амжилттай устгагдлаа" });
            router.push('/dashboard/employment-relations');
        } catch (e) {
            toast({ title: "Алдаа", description: "Устгахад алдаа гарлаа", variant: "destructive" });
        } finally {
            setIsSaving(false);
            setIsDeleteDialogOpen(false);
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !docRef || !storage) return;

        setIsUploading(true);
        try {
            // Create a reference to 'signed_docs/<docId>/<filename>'
            const storageRef = ref(storage, `signed_docs/${id}/${Date.now()}_${file.name}`);

            // Upload
            await uploadBytes(storageRef, file);
            const downloadURL = await getDownloadURL(storageRef);

            // Update document - Only upload file, status change happens on Final Approve
            await updateDoc(tDoc('er_documents', id!), {
                signedDocUrl: downloadURL,
                updatedAt: Timestamp.now()
            });

            toast({ title: "Амжилттай", description: "Эх хувь хавсрагдлаа" });
        } catch (error) {
            console.error(error);
            toast({ title: "Алдаа", description: "Файл хуулахад алдаа гарлаа", variant: "destructive" });
        } finally {
            setIsUploading(false);
            // Reset input
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    return (
        <div className="flex flex-col h-full bg-slate-50/50 overflow-hidden">
            {/* Sticky Header */}
            <div className="bg-white border-b sticky top-0 z-30">
                <div className="px-6 md:px-8">
                    {/* Top Row: Back + Title + Actions */}
                    <div className="py-4">
                        <PageHeader
                            title={document.metadata?.templateName || 'Баримт'}
                            description={[
                                selectedEmployee
                                    ? `${selectedEmployee.lastName || ''} ${selectedEmployee.firstName || ''}`.trim()
                                    : document.metadata?.employeeName || 'Ажилтан сонгоогүй',
                                document.metadata?.departmentName ? document.metadata.departmentName : null,
                            ].filter(Boolean).join(' • ')}
                            showBackButton
                            hideBreadcrumbs
                            backButtonPlacement="inline"
                            backBehavior="history"
                            fallbackBackHref="/dashboard/employment-relations"
                            actions={
                                <div className="flex items-center gap-2">
                                    <Badge className={cn("shrink-0 text-[10px]", DOCUMENT_STATUSES[currentStatus].color)}>
                                        {DOCUMENT_STATUSES[currentStatus].label}
                                    </Badge>

                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8"
                                        onClick={() => handlePrint && handlePrint()}
                                        title="Хэвлэх"
                                    >
                                        <Printer className="h-4 w-4" />
                                    </Button>

                                    {(currentStatus === 'DRAFT' || currentStatus === 'IN_REVIEW') && (
                                        <>
                                            {((currentStatus === 'DRAFT' && (template?.isDeletable ?? true)) || (currentStatus === 'IN_REVIEW' && (isOwner || isAdmin))) && (
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-rose-600 hover:bg-rose-50" onClick={() => setIsDeleteDialogOpen(true)} disabled={isSaving} title="Устгах">
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            )}
                                            <Button variant="outline" size="sm" className="h-8" onClick={handleSaveDraft} disabled={isSaving}>
                                                {isSaving ? <Loader2 className="animate-spin h-3.5 w-3.5" /> : <Save className="h-3.5 w-3.5 mr-1.5" />}
                                                Хадгалах
                                            </Button>
                                            {currentStatus === 'DRAFT' && (
                                                <Button size="sm" className="h-8" onClick={handleSendForReview} disabled={isSaving}>
                                                    <Send className="h-3.5 w-3.5 mr-1.5" />
                                                    Илгээх
                                                </Button>
                                            )}
                                        </>
                                    )}
                                    {currentStatus === 'IN_REVIEW' && isApprover && !!approveKeyForCurrentUser && document.approvalStatus?.[approveKeyForCurrentUser]?.status !== 'APPROVED' && (
                                        <Button size="sm" className="h-8 bg-emerald-600 hover:bg-emerald-700" onClick={() => handleApprove()} disabled={isSaving}>
                                            <Check className="h-3.5 w-3.5 mr-1.5" />
                                            Батлах
                                        </Button>
                                    )}
                                    {currentStatus === 'REVIEWED' && (isOwner || isAdmin) && (
                                        <>
                                            <input type="file" ref={fileInputRef} className="hidden" accept=".pdf,.jpg,.jpeg,.png" onChange={handleFileUpload} />
                                            <Button variant="outline" size="sm" className="h-8" onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
                                                {isUploading ? <Loader2 className="animate-spin h-3.5 w-3.5 mr-1.5" /> : <Upload className="h-3.5 w-3.5 mr-1.5" />}
                                                Эх хувь
                                            </Button>
                                            <Button size="sm" className="h-8 bg-emerald-600 hover:bg-emerald-700" onClick={handleFinalApprove} disabled={isSaving || isUploading}>
                                                <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                                                Батлах
                                            </Button>
                                        </>
                                    )}
                                    {(currentStatus === 'REVIEWED' || currentStatus === 'APPROVED' || currentStatus === 'SIGNED') && isAdmin && (
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-rose-600 hover:bg-rose-50" onClick={() => setIsDeleteDialogOpen(true)} disabled={isSaving} title="Устгах">
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    )}
                                    {(currentStatus === 'APPROVED' || currentStatus === 'SIGNED') && document.signedDocUrl && (
                                        <Button variant="outline" size="sm" className="h-8 border-emerald-200 bg-emerald-50 text-emerald-700" onClick={() => window.open(document.signedDocUrl, '_blank')}>
                                            <FileText className="h-3.5 w-3.5 mr-1.5" />
                                            Эх хувь
                                        </Button>
                                    )}

                                    {(currentStatus === 'SIGNED' || currentStatus === 'APPROVED') && (isOwner || isAdmin) && (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="h-8 border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100"
                                            onClick={handleSendToEmployeeForAcknowledgement}
                                            disabled={isSaving}
                                            title="Ажилтанд танилцуулахаар илгээх"
                                        >
                                            <Send className="h-3.5 w-3.5 mr-1.5" />
                                            Танилцуулах
                                        </Button>
                                    )}
                                </div>
                            }
                        />
                    </div>
                    
                    {/* Progress Stepper Row */}
                    <div className="flex items-center gap-1 pb-3 overflow-x-auto no-scrollbar">
                        {steps.map((step, idx) => {
                            const currentIdx = steps.findIndex(s => s.id === currentStatus);
                            const isPast = (currentIdx === -1 ? false : currentIdx > idx);
                            const isCurrent = step.id === currentStatus;
                            const isLast = idx === steps.length - 1;

                            return (
                                <React.Fragment key={step.id}>
                                    <div className={cn(
                                        "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap",
                                        isCurrent ? "bg-primary text-white" : isPast ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-400"
                                    )}>
                                        <div className={cn(
                                            "h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold",
                                            isPast ? "bg-emerald-500 text-white" : isCurrent ? "bg-white/20" : "bg-slate-200"
                                        )}>
                                            {isPast ? <Check className="h-3 w-3" /> : idx + 1}
                                        </div>
                                        {step.label}
                                    </div>
                                    {!isLast && <div className="w-6 h-0.5 bg-slate-200 shrink-0" />}
                                </React.Fragment>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 overflow-y-auto">
                <div className="p-6 md:p-8 space-y-6 pb-32">

                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                    {/* Sidebar */}
                    <div className="xl:col-span-1 space-y-4">
                        {/* Entity Info Card */}
                        <div className="bg-white rounded-xl border p-4 space-y-4">
                            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Холбогдох мэдээлэл</h3>
                            
                            <div className="space-y-3">
                                <div className="flex items-center gap-3 p-2.5 rounded-lg bg-slate-50">
                                    <div className="h-9 w-9 rounded-lg bg-blue-100 flex items-center justify-center">
                                        <User className="h-4 w-4 text-blue-600" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-[10px] text-slate-400 uppercase font-medium">Ажилтан</p>
                                        <p className="text-sm font-medium truncate">
                                            {selectedEmployee ? `${selectedEmployee.lastName || ''} ${selectedEmployee.firstName || ''}`.trim() : document.metadata?.employeeName || 'Сонгоогүй'}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3 p-2.5 rounded-lg bg-slate-50">
                                    <div className="h-9 w-9 rounded-lg bg-amber-100 flex items-center justify-center">
                                        <Building2 className="h-4 w-4 text-amber-600" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-[10px] text-slate-400 uppercase font-medium">Албан нэгж</p>
                                        <p className="text-sm font-medium truncate">
                                            {document.metadata?.departmentName || departments?.find(d => d.id === selectedDept)?.name || 'Мэдээлэлгүй'}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3 p-2.5 rounded-lg bg-slate-50">
                                    <div className="h-9 w-9 rounded-lg bg-purple-100 flex items-center justify-center">
                                        <Briefcase className="h-4 w-4 text-purple-600" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-[10px] text-slate-400 uppercase font-medium">Ажлын байр</p>
                                        <p className="text-sm font-medium truncate">
                                            {document.metadata?.positionName || positions?.find(p => p.id === selectedPos)?.title || 'Мэдээлэлгүй'}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Reviewers Card */}
                        <div className="bg-white rounded-xl border overflow-hidden">
                            <div className="px-4 py-3 bg-slate-900 text-white flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Users className="h-4 w-4" />
                                    <span className="text-sm font-medium">Хянагчид</span>
                                </div>
                                {reviewers.length > 0 && (
                                    <Badge variant="secondary" className="bg-white/20 text-white text-[10px]">
                                        {reviewers.length}
                                    </Badge>
                                )}
                            </div>
                            <div className="p-4 space-y-3">
                                {(currentStatus === 'DRAFT' || currentStatus === 'IN_REVIEW') && (
                                    <>
                                        <div className="flex items-center justify-between">
                                            <Label className="text-xs text-slate-600">Хянуулах</Label>
                                            <Switch
                                                checked={isReviewRequired}
                                                onCheckedChange={(checked) => {
                                                    setIsReviewRequired(checked);
                                                    if (!checked) setReviewers([]);
                                                }}
                                            />
                                        </div>

                                        {isReviewRequired && (
                                            <Select onValueChange={(posId) => {
                                                if (posId && !reviewers.includes(posId)) {
                                                    setReviewers([...reviewers, posId]);
                                                }
                                            }}>
                                                <SelectTrigger className="text-xs h-9">
                                                    <SelectValue placeholder="Хянагч нэмэх..." />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {occupiedPositions?.length === 0 ? (
                                                        <div className="p-2 text-xs text-slate-400 text-center">Сонгох боломжтой албан тушаал алга</div>
                                                    ) : (
                                                        occupiedPositions?.map(p => {
                                                            const pos = p as any;
                                                            return (
                                                                <SelectItem key={pos.id} value={pos.id}>
                                                                    <span className="font-medium">{pos.title}</span>
                                                                    <span className="text-slate-400 ml-1">- {pos.occupant?.firstName}</span>
                                                                </SelectItem>
                                                            );
                                                        })
                                                    )}
                                                </SelectContent>
                                            </Select>
                                        )}
                                    </>
                                )}

                                <div className="space-y-2">
                                    {reviewers.map((rid) => {
                                        const pos = allPositions?.find(p => p.id === rid);
                                        const occupant = employeesList?.find(u => u.positionId === rid || u.id === rid);
                                        const status = document.approvalStatus?.[occupant?.id || rid];

                                        return (
                                            <div key={rid} className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 group">
                                                <Avatar className="h-8 w-8 shrink-0">
                                                    <AvatarImage src={occupant?.photoURL} />
                                                    <AvatarFallback className="text-xs bg-slate-200">{pos?.title?.charAt(0) || '?'}</AvatarFallback>
                                                </Avatar>
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-xs font-medium truncate">{occupant ? `${occupant.firstName} ${occupant.lastName}` : 'Сул'}</p>
                                                    <p className="text-[10px] text-slate-400 truncate">{pos?.title}</p>
                                                </div>
                                                {status?.status === 'APPROVED' && <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />}
                                                {status?.status === 'REJECTED' && <XCircle className="h-4 w-4 text-rose-500 shrink-0" />}
                                                {status?.status === 'PENDING' && <Clock className="h-4 w-4 text-amber-500 shrink-0" />}
                                                {(currentStatus === 'DRAFT' || currentStatus === 'IN_REVIEW') && (
                                                    <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 text-slate-400 hover:text-rose-500" onClick={() => setReviewers(reviewers.filter(r => r !== rid))}>
                                                        <X className="h-3 w-3" />
                                                    </Button>
                                                )}
                                            </div>
                                        );
                                    })}
                                    {reviewers.length === 0 && (
                                        <p className="text-xs text-center text-slate-400 py-3">Хянагч байхгүй</p>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Custom Inputs */}
                        {(currentStatus === 'DRAFT' || currentStatus === 'IN_REVIEW') && template?.customInputs && template.customInputs.length > 0 && (
                            <div className="bg-white rounded-xl border overflow-hidden">
                                <div className="px-4 py-3 border-b bg-primary/5 flex items-center gap-2">
                                    <Wand2 className="h-4 w-4 text-primary" />
                                    <span className="text-sm font-medium text-primary">Нэмэлт утгууд</span>
                                </div>
                                <div className="p-4 space-y-3">
                                    {[...(template.customInputs || [])]
                                        .sort((a, b) => (a.order || 0) - (b.order || 0))
                                        .map((input, idx) => (
                                            <div key={`${input.key || 'input'}-${input.order ?? idx}`} className="space-y-1">
                                                <div className="flex items-center justify-between">
                                                    <Label className="text-xs text-slate-600">
                                                        {input.label} {input.required && <span className="text-rose-500">*</span>}
                                                    </Label>
                                                    {input.type === 'boolean' && (
                                                        <Switch
                                                            checked={customInputValues[input.key] === 'Тийм'}
                                                            onCheckedChange={(c) => setCustomInputValues(prev => ({ ...prev, [input.key]: c ? 'Тийм' : 'Үгүй' }))}
                                                        />
                                                    )}
                                                </div>
                                                {input.type !== 'boolean' && (
                                                    <Input
                                                        type={input.type === 'number' ? 'number' : input.type === 'date' ? 'date' : 'text'}
                                                        value={customInputValues[input.key] || ''}
                                                        onChange={(e) => setCustomInputValues(prev => ({ ...prev, [input.key]: e.target.value }))}
                                                        placeholder={input.description || `${input.label}...`}
                                                        className="h-8 text-xs"
                                                    />
                                                )}
                                            </div>
                                        ))
                                    }
                                </div>
                            </div>
                        )}

                        {/* Activity Feed for mobile/tablet */}
                        {currentStatus !== 'DRAFT' && (
                            <div className="xl:hidden bg-white rounded-xl border overflow-hidden">
                                <div className="px-4 py-3 border-b flex items-center gap-2">
                                    <MessageSquare className="h-4 w-4 text-slate-400" />
                                    <span className="text-sm font-medium">Түүх & Коммент</span>
                                </div>
                                <div className="h-[400px]">
                                    <ActivityFeed
                                        documentId={id}
                                        employeesList={employeesList || []}
                                        isApprover={isApprover}
                                        isAdmin={isAdmin}
                                        canApprove={canApproveFromCommentBox}
                                        onApprove={handleApprove}
                                        canFinalApprove={(isOwner || isAdmin) && currentStatus === 'REVIEWED'}
                                        onFinalApprove={handleFinalApprove}
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Main Content */}
                    <div className="xl:col-span-2 space-y-4">
                        {/* Rejection Alert */}
                        {currentStatus === 'DRAFT' && document.approvalStatus && Object.values(document.approvalStatus).some((s: any) => s.status === 'REJECTED') && (
                            <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex gap-3">
                                <AlertCircle className="h-5 w-5 text-rose-500 shrink-0 mt-0.5" />
                                <div className="space-y-2">
                                    <p className="text-sm font-medium text-rose-900">Засварлах шаардлагатай</p>
                                    {Object.entries(document.approvalStatus).filter(([_, s]: [any, any]) => s.status === 'REJECTED').map(([uid, s]: [any, any]) => {
                                        const rUser = employeesList?.find(u => u.id === uid);
                                        return (
                                            <p key={uid} className="text-sm text-rose-700">
                                                <span className="font-medium">{rUser?.firstName}:</span> "{s.comment}"
                                            </p>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Document Preview Card */}
                        <div className="bg-white rounded-xl border overflow-hidden">
                            {/* Preview Header */}
                            <div className="px-4 py-3 border-b flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <FileText className="h-4 w-4 text-slate-400" />
                                    <span className="text-sm font-medium">Баримтын харагдац</span>
                                    <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-600 border-emerald-200">Live</Badge>
                                </div>
                                {(currentStatus === 'DRAFT' || currentStatus === 'IN_REVIEW') && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-7 text-xs"
                                        onClick={() => setIsEditorOpen(true)}
                                    >
                                        <Edit3 className="h-3 w-3 mr-1.5" />
                                        Засах
                                    </Button>
                                )}
                            </div>
                            
                            {/* Document Preview */}
                            <div className="bg-slate-100 p-6 md:p-10">
                                <div className="max-w-3xl mx-auto">
                                    <div
                                        className="bg-white shadow-lg p-8 md:p-12 prose prose-slate max-w-none min-h-[600px] ring-1 ring-slate-200"
                                        dangerouslySetInnerHTML={{
                                            __html: generateDocumentContent(editContent || document.content, {
                                                employee: selectedEmployee,
                                                department: departments?.find(d => d.id === selectedDept),
                                                position: positions?.find(p => p.id === selectedPos),
                                                company: companyProfile,
                                                system: {
                                                    date: format(new Date(), 'yyyy-MM-dd'),
                                                    year: format(new Date(), 'yyyy'),
                                                    month: format(new Date(), 'MM'),
                                                    day: format(new Date(), 'dd'),
                                                    user: currentUser?.displayName || 'Системийн хэрэглэгч'
                                                },
                                                customInputs: customInputValues
                                            }).replace(/\n/g, '<br/>')
                                        }}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Hidden Print Layout */}
                        <div style={{ display: 'none' }}>
                            <PrintLayout
                                ref={printComponentRef}
                                content={editContent || document.content || ''}
                                settings={document?.metadata?.printSettings}
                            />
                        </div>

            {/* Editor Dialog */}
            <Dialog open={isEditorOpen} onOpenChange={setIsEditorOpen}>
                <DialogContent className="max-w-7xl h-[90vh] flex flex-col p-0 overflow-hidden">
                    <DialogHeader className="p-4 border-b bg-slate-50 shrink-0">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="h-9 w-9 rounded-lg bg-primary flex items-center justify-center text-white">
                                    <FileText className="h-4 w-4" />
                                </div>
                                <div>
                                    <DialogTitle className="text-base font-semibold">Агуулга засах</DialogTitle>
                                    <p className="text-xs text-muted-foreground">HTML эх кодыг засах</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <Button variant="outline" size="sm" className="h-8 text-xs" onClick={restoreTemplateContent}>
                                    <Undo2 className="h-3.5 w-3.5 mr-1.5" /> Сэргээх
                                </Button>
                                <Button size="sm" className="h-8 text-xs" onClick={() => setIsEditorOpen(false)}>
                                    <Check className="h-3.5 w-3.5 mr-1.5" /> Дуусгах
                                </Button>
                            </div>
                        </div>
                    </DialogHeader>
                    <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
                        <TemplateBuilder
                            content={editContent}
                            onChange={setEditContent}
                            resolvers={getReplacementMap({
                                employee: selectedEmployee,
                                department: departments?.find(d => d.id === selectedDept),
                                position: positions?.find(p => p.id === selectedPos),
                                company: companyProfile,
                                system: {
                                    date: format(new Date(), 'yyyy-MM-dd'),
                                    year: format(new Date(), 'yyyy'),
                                    month: format(new Date(), 'MM'),
                                    day: format(new Date(), 'dd'),
                                    user: currentUser?.displayName || 'Системийн хэрэглэгч'
                                },
                                customInputs: customInputValues
                            })}
                            printSettings={document.printSettings}
                            customInputs={template?.customInputs || []}
                        />
                    </div>
                </DialogContent>
            </Dialog>

                        {/* Activity Feed for desktop */}
                        {currentStatus !== 'DRAFT' && (
                            <div className="hidden xl:block bg-white rounded-xl border overflow-hidden">
                                <div className="px-4 py-3 border-b flex items-center gap-2">
                                    <MessageSquare className="h-4 w-4 text-slate-400" />
                                    <span className="text-sm font-medium">Түүх & Коммент</span>
                                </div>
                                <div className="h-[450px]">
                                    <ActivityFeed
                                        documentId={id}
                                        employeesList={employeesList || []}
                                        isApprover={isApprover}
                                        isAdmin={isAdmin}
                                        canApprove={canApproveFromCommentBox}
                                        onApprove={handleApprove}
                                        canFinalApprove={(isOwner || isAdmin) && currentStatus === 'REVIEWED'}
                                        onFinalApprove={handleFinalApprove}
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                </div>
                </div>
            </div>

            {/* Delete Dialog */}
            <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Баримт устгах</DialogTitle>
                        <DialogDescription>
                            Та энэ баримтыг устгахдаа итгэлтэй байна уу? Энэ үйлдлийг буцаах боломжгүй.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>Болих</Button>
                        <Button variant="destructive" onClick={handleDelete} disabled={isSaving}>
                            {isSaving ? <Loader2 className="animate-spin h-3.5 w-3.5 mr-2" /> : <Trash2 className="h-3.5 w-3.5 mr-2" />}
                            Устгах
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

function ActivityFeed({
    documentId,
    employeesList,
    isApprover,
    isAdmin,
    canApprove,
    onApprove,
    canFinalApprove,
    onFinalApprove
}: {
    documentId: string,
    employeesList: any[],
    isApprover?: boolean,
    isAdmin?: boolean,
    canApprove?: boolean,
    onApprove?: (comment?: string) => Promise<void>,
    canFinalApprove?: boolean,
    onFinalApprove?: () => Promise<void>
}) {
    const { firestore, user: currentUser } = useFirebase();
    const { tCollection } = useTenantWrite();
    const [activities, setActivities] = useState<ProcessActivity[]>([]);
    const [commentText, setCommentText] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [isApproving, setIsApproving] = useState(false);
    const messagesEndRef = React.useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!firestore) return;
        const q = query(
            tCollection('er_documents', documentId, 'activity'),
            orderBy('createdAt', 'asc')
        );
        const unsubscribe = onSnapshot(q, (snap) => {
            const acts: ProcessActivity[] = [];
            snap.forEach(d => acts.push({ id: d.id, ...d.data() } as ProcessActivity));
            setActivities(acts);
        });
        return () => unsubscribe();
    }, [firestore, documentId]);

    // Scroll to bottom on new message
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [activities]);

    const handleSendComment = async () => {
        if (!commentText.trim() || !firestore || !currentUser) return;
        setIsSending(true);
        try {
            await (await import('firebase/firestore')).addDoc(tCollection('er_documents', documentId, 'activity'), {
                type: 'COMMENT',
                actorId: currentUser.uid,
                content: commentText,
                createdAt: Timestamp.now()
            });
            setCommentText('');
        } catch (e) {
            console.error(e);
        } finally {
            setIsSending(false);
        }
    };

    const handleApproveWithComment = async () => {
        if (!canApprove || !onApprove) return;
        if (isApproving) return;
        setIsApproving(true);
        try {
            const c = commentText.trim();
            await onApprove(c ? c : undefined);
            setCommentText('');
        } finally {
            setIsApproving(false);
        }
    };

    const getUserInfo = (uid: string) => {
        const u = employeesList?.find((e: any) => e.id === uid);
        return {
            name: u ? `${u.firstName} ${u.lastName}` : 'Хэрэглэгч',
            avatar: u?.photoURL,
            initial: u?.firstName?.charAt(0) || '?'
        };
    };

    return (
        <div className="flex flex-col h-full">
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
                {activities.length === 0 && (
                    <div className="text-center py-8 text-slate-400 text-xs">
                        Түүх байхгүй
                    </div>
                )}
                {activities.map((act) => {
                    const user = getUserInfo(act.actorId);
                    const isMe = act.actorId === currentUser?.uid;
                    const isSys = act.type === 'STATUS_CHANGE';
                    const isApprove = act.type === 'APPROVE';
                    const isReject = act.type === 'REJECT';

                    if (isSys) {
                        return (
                            <div key={act.id} className="flex justify-center my-1">
                                <span className="text-[10px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                                    {act.content}
                                </span>
                            </div>
                        );
                    }

                    return (
                        <div key={act.id} className={cn("flex gap-2", isMe ? "flex-row-reverse" : "flex-row")}>
                            <Avatar className="h-7 w-7 shrink-0">
                                <AvatarImage src={user.avatar} />
                                <AvatarFallback className="text-[10px] bg-slate-100">{user.initial}</AvatarFallback>
                            </Avatar>
                            <div className={cn(
                                "max-w-[80%] rounded-xl px-3 py-2 text-xs",
                                isMe ? "bg-primary/10 text-slate-800" : "bg-slate-100 text-slate-700",
                                isApprove && "bg-emerald-50 text-emerald-800",
                                isReject && "bg-rose-50 text-rose-800"
                            )}>
                                <div className="flex items-center gap-1.5 mb-0.5">
                                    <span className="font-medium">{user.name}</span>
                                    <span className="text-[9px] opacity-50">{formatDateTime(act.createdAt)}</span>
                                </div>
                                {isApprove && (
                                    <div className="flex items-center gap-1 font-medium text-[11px] mb-0.5">
                                        <CheckCircle2 className="h-3 w-3" /> Батлав
                                    </div>
                                )}
                                {isReject && (
                                    <div className="flex items-center gap-1 font-medium text-[11px] mb-0.5">
                                        <AlertCircle className="h-3 w-3" /> Буцаав
                                    </div>
                                )}
                                <p className="whitespace-pre-wrap">{act.content}</p>
                            </div>
                        </div>
                    );
                })}
                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-3 border-t shrink-0">
                <div className="flex gap-2">
                    <Input
                        value={commentText}
                        onChange={e => setCommentText(e.target.value)}
                        placeholder="Коммент..."
                        className="flex-1 h-8 text-xs"
                        onKeyDown={e => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSendComment();
                            }
                        }}
                    />
                    {canApprove && (
                        <Button
                            size="sm"
                            className="h-8 bg-emerald-600 hover:bg-emerald-700"
                            onClick={handleApproveWithComment}
                            disabled={isApproving}
                            title="Батлах"
                        >
                            <Check className="h-3.5 w-3.5 mr-1.5" />
                            Батлах
                        </Button>
                    )}
                    {canFinalApprove && (
                        <Button size="icon" className="h-8 w-8 bg-indigo-600 hover:bg-indigo-700" onClick={() => onFinalApprove?.()} title="Эцэслэн батлах">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                        </Button>
                    )}
                    <Button size="icon" className="h-8 w-8" onClick={handleSendComment} disabled={!commentText.trim() || isSending || isApproving}>
                        {isSending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                    </Button>
                </div>
            </div>
        </div>
    );
}
