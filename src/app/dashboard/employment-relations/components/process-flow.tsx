'use client';

import React, { useState, useMemo } from 'react';
import { useFirebase, updateDocumentNonBlocking, useTenantWrite } from '@/firebase';
import { Timestamp } from 'firebase/firestore';
import { ERDocument, ERDocumentHistory, DocumentStatus, ActionType } from '../types';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Check, X, FileText, Send, UserCheck, ShieldCheck, Printer, Upload, Download, CircleUser } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';

interface ProcessFlowProps {
    document: ERDocument;
    onUpdate?: () => void;
}

const STEPS = [
    { id: 'PLAN', status: 'DRAFT', label: 'Төлөвлөх', icon: FileText, color: 'bg-slate-100 text-slate-600' },
    { id: 'REVIEW', status: 'IN_REVIEW', label: 'Хянах', icon: UserCheck, color: 'bg-indigo-100 text-indigo-600' },
    { id: 'APPROVE', status: 'APPROVED', label: 'Батлах', icon: ShieldCheck, color: 'bg-green-100 text-green-600' },
];

export function ProcessFlow({ document: docData, onUpdate }: ProcessFlowProps) {
    const { firestore, user } = useFirebase();
    const { tDoc } = useTenantWrite();
    const { toast } = useToast();
    const [comment, setComment] = useState('');
    const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
    const [rejectReason, setRejectReason] = useState('');
    const [uploadUrl, setUploadUrl] = useState('');

    const currentStepIndex = useMemo(() => {
        if (docData.status === 'DRAFT') return 0;
        if (docData.status === 'IN_REVIEW') return 1;
        if (docData.status === 'APPROVED' || docData.status === 'REJECTED') return 2;
        return 0;
    }, [docData.status]);

    const isReviewer = useMemo(() => {
        if (!user || !docData.reviewers) return false;
        return docData.reviewers.includes(user.uid);
    }, [user, docData.reviewers]);

    const hasApproved = useMemo(() => {
        if (!user || !docData.approvals) return false;
        return !!docData.approvals[user.uid];
    }, [user, docData.approvals]);

    const handleAction = async (action: ActionType, nextStatus?: DocumentStatus) => {
        if (!firestore || !user) return;

        try {
            const updates: Partial<ERDocument> = {
                updatedAt: Timestamp.now()
            };

            const historyItem: ERDocumentHistory = {
                stepId: docData.status,
                action: action,
                actorId: user.uid,
                timestamp: Timestamp.now(),
                comment: comment || undefined
            };

            if (action === 'REVIEW') {
                // Submit for Review
                updates.status = 'IN_REVIEW';
                historyItem.comment = 'Хянуулахаар илгээв';
            } else if (action === 'APPROVE') {
                // Approve
                const newApprovals = { ...(docData.approvals || {}), [user.uid]: true };
                updates.approvals = newApprovals;

                // Check if all reviewers approved
                const allApproved = docData.reviewers?.every((rid: string) => newApprovals[rid]);
                if (allApproved) {
                    // All approved, ready for final sign/upload (Conceptually move to next phase logic if needed)
                    // For now, it stays 'IN_REVIEW' until explicitly moved to 'APPROVED' by final action or auto?
                    // Let's assume after all reviews, it's ready for Printing/Signing.
                    // The "Approve" step in UI is for final signature upload.
                }
                historyItem.comment = 'Зөвшөөрөв';
            } else if (action === 'REJECT') {
                updates.status = 'REJECTED'; // Or back to DRAFT? Let's say REJECTED for now, or DRAFT to Re-plan
                updates.rejectionReason = rejectReason;
                // updates.status = 'DRAFT'; // Often better to go back to draft to fix
                historyItem.comment = `Татгалзсан: ${rejectReason}`;
            } else if (action === 'SIGN') {
                // Final approval with upload
                updates.status = 'APPROVED';
                updates.signedDocUrl = uploadUrl;
                updates.approverId = user.uid;
                historyItem.comment = 'Эцэслэн батлав (Гарын үсэг зурсан)';
            }

            // Append history
            updates.history = [...(docData.history || []), historyItem];

            await updateDocumentNonBlocking(tDoc('er_documents', docData.id), updates);
            toast({ title: "Амжилттай", description: "Үйлдэл амжилттай хийгдлээ" });
            if (onUpdate) onUpdate();
        } catch (error) {
            console.error(error);
            toast({ title: "Алдаа", description: "Үйлдэл хийхэд алдаа гарлаа", variant: "destructive" });
        }
    };

    return (
        <div className="space-y-8">
            {/* Stepper */}
            <div className="relative">
                <div className="absolute top-1/2 left-0 w-full h-1 bg-slate-100 -translate-y-1/2 rounded-full" />
                <div className="relative flex justify-between z-10 px-6">
                    {STEPS.map((step, index) => {
                        const Icon = step.icon;
                        const isActive = index === currentStepIndex;
                        const isCompleted = index < currentStepIndex || (index === 2 && docData.status === 'APPROVED');

                        return (
                            <div key={step.id} className="flex flex-col items-center gap-3 bg-white px-2">
                                <div className={`
                                    w-12 h-12 rounded-full flex items-center justify-center border-4 transition-all
                                    ${isActive ? 'border-indigo-100 bg-indigo-600 text-white shadow-lg shadow-indigo-200' :
                                        isCompleted ? 'border-emerald-100 bg-emerald-500 text-white' : 'border-slate-100 bg-white text-slate-300'}
                                `}>
                                    {isCompleted ? <Check className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                                </div>
                                <span className={`text-sm font-bold ${isActive ? 'text-indigo-900' : isCompleted ? 'text-emerald-700' : 'text-slate-400'}`}>
                                    {step.label}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Current Step Action Area */}
            <Card className="border-none shadow-xl bg-white/80 backdrop-blur ring-1 ring-slate-200 overflow-hidden">
                <CardContent className="p-8">
                    {docData.status === 'DRAFT' && (
                        <div className="text-center space-y-6 max-w-lg mx-auto py-4">
                            <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                <FileText className="h-8 w-8" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-slate-900">Баримт төлөвлөх</h3>
                                <p className="text-muted-foreground mt-2">
                                    Баримтын агуулгыг хянаж, шаардлагатай засваруудыг хийнэ үү. Бэлэн болсон үед хянуулахаар илгээнэ.
                                </p>
                            </div>
                            <Button size="lg" className="w-full font-bold shadow-lg shadow-blue-200 rounded-xl" onClick={() => handleAction('REVIEW')}>
                                <Send className="mr-2 h-4 w-4" /> Хянуулахаар илгээх
                            </Button>
                        </div>
                    )}

                    {docData.status === 'IN_REVIEW' && (
                        <div className="space-y-6">
                            <div className="flex items-center gap-4 p-4 bg-indigo-50 border border-indigo-100 rounded-xl text-indigo-900">
                                <div className="p-2 bg-indigo-100 rounded-lg">
                                    <UserCheck className="h-5 w-5" />
                                </div>
                                <div>
                                    <h4 className="font-bold">Хяналтын шат</h4>
                                    <p className="text-sm opacity-80">Томилогдсон хянагч нар баримттай танилцаж зөвшөөрөл өгнө.</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {docData.reviewers?.map(reviewerId => {
                                    const isApproved = docData.approvals?.[reviewerId];
                                    return (
                                        <div key={reviewerId} className="flex items-center gap-3 p-3 border rounded-xl bg-white">
                                            <CircleUser className="h-8 w-8 text-slate-300" />
                                            <div className="flex-1">
                                                <div className="font-medium text-sm">Хянагч (ID: {reviewerId})</div>
                                                <div className="text-xs text-muted-foreground">Эрх бүхий албан тушаалтан</div>
                                            </div>
                                            {isApproved ? (
                                                <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-none">Зөвшөөрсөн</Badge>
                                            ) : (
                                                <Badge variant="outline" className="text-slate-400 border-slate-200">Хүлээгдэж буй</Badge>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>

                            {isReviewer && !hasApproved && (
                                <div className="flex gap-3 pt-4 border-t">
                                    <Button
                                        variant="outline"
                                        className="flex-1 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                                        onClick={() => setIsRejectDialogOpen(true)}
                                    >
                                        Татгалзах
                                    </Button>
                                    <Button
                                        className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-200 shadow-md"
                                        onClick={() => handleAction('APPROVE')}
                                    >
                                        <Check className="mr-2 h-4 w-4" /> Зөвшөөрөх
                                    </Button>
                                </div>
                            )}
                            {isReviewer && hasApproved && (
                                <div className="text-center p-4 text-emerald-600 font-medium bg-emerald-50 rounded-xl border border-emerald-100">
                                    Та энэ баримтыг зөвшөөрсөн байна.
                                </div>
                            )}
                        </div>
                    )}

                    {docData.status === 'APPROVED' && (
                        <div className="text-center space-y-6 max-w-lg mx-auto py-4">
                            <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-4 border-4 border-emerald-100">
                                <ShieldCheck className="h-8 w-8" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-slate-900">Батлагдсан баримт</h3>
                                <p className="text-muted-foreground mt-2">
                                    Энэхүү баримт бүрэн батлагдаж, хүчин төгөлдөр болсон байна.
                                </p>
                            </div>
                            <div className="flex gap-4 justify-center">
                                <Button variant="outline" className="gap-2">
                                    <Download className="h-4 w-4" /> Татах
                                </Button>
                                <Button variant="outline" className="gap-2">
                                    <Printer className="h-4 w-4" /> Хэвлэх
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* Final Sign/Upload Stage for Creator/Approver if needed when all approved but not yet FINAL */}
                    {docData.status === 'IN_REVIEW' && docData.reviewers && docData.reviewers.every((r: string) => docData.approvals?.[r]) && (
                        <div className="mt-8 pt-8 border-t space-y-4 animate-in fade-in slide-in-from-bottom-4">
                            <div className="p-4 bg-orange-50 border border-orange-100 rounded-xl">
                                <h4 className="font-bold text-orange-800 flex items-center gap-2 mb-2">
                                    <Printer className="h-4 w-4" /> Эцэслэн батлах
                                </h4>
                                <p className="text-sm text-orange-700/80 mb-4">
                                    Бүх хянагч нар зөвшөөрсөн байна. Баримтыг хэвлэж, гарын үсэг зуруулан сканердаж оруулна уу.
                                </p>
                                <div className="space-y-4">
                                    <div className="bg-white p-3 rounded-lg border flex gap-2">
                                        <Input
                                            placeholder="Файлын URL (Жишээ нь: https://...)"
                                            value={uploadUrl}
                                            onChange={(e) => setUploadUrl(e.target.value)}
                                            className="border-0 shadow-none focus-visible:ring-0 px-0"
                                        />
                                        <Button size="icon" variant="ghost" className="text-slate-400">
                                            <Upload className="h-4 w-4" />
                                        </Button>
                                    </div>
                                    <Button
                                        className="w-full font-bold"
                                        disabled={!uploadUrl}
                                        onClick={() => handleAction('SIGN')}
                                    >
                                        <ShieldCheck className="mr-2 h-4 w-4" /> Баталгаажуулж дуусгах
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Reject Dialog */}
            <Dialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Татгалзах шалтгаан</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <p className="text-sm text-muted-foreground">Татгалзаж буй шалтгаанаа тодорхой бичнэ үү.</p>
                        <Textarea
                            placeholder="Шалтгаан бичих..."
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                            className="min-h-[100px]"
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsRejectDialogOpen(false)}>Болих</Button>
                        <Button
                            variant="destructive"
                            disabled={!rejectReason}
                            onClick={() => {
                                handleAction('REJECT');
                                setIsRejectDialogOpen(false);
                            }}
                        >
                            Татгалзах
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
