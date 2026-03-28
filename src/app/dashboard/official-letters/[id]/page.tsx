'use client';

import React, { useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Timestamp, updateDoc } from 'firebase/firestore';
import { useFirebase, useFetchDoc, useTenantWrite } from '@/firebase';
import { useUser } from '@/firebase';
import { OfficialLetter, STATUS_LABELS, STATUS_COLORS } from '../types';
import { LetterPaper } from '../components/letter-paper';
import '../official-letters.css';
import { PageHeader } from '@/components/patterns/page-layout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Download, Loader2, Send, Archive, Printer, Mail, Save } from 'lucide-react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { format } from 'date-fns';
import { mn } from 'date-fns/locale';

async function waitForImages(root: HTMLElement | null) {
    if (!root) return;
    await Promise.all(Array.from(root.querySelectorAll('img')).map(img => {
        if (img.complete && img.naturalWidth > 0) return;
        return new Promise<void>(res => {
            img.addEventListener('load', () => res(), { once: true });
            img.addEventListener('error', () => res(), { once: true });
        });
    }));
}

export default function OfficialLetterDetailPage() {
    const { id } = useParams<{ id: string }>();
    const { firestore } = useFirebase();
    const { tDoc } = useTenantWrite();
    const { user } = useUser();
    const { toast } = useToast();
    const router = useRouter();
    const paperRef = useRef<HTMLDivElement>(null);
    const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
    const [isSendingEmail, setIsSendingEmail] = useState(false);
    const [emailDialogOpen, setEmailDialogOpen] = useState(false);
    const [emailTo, setEmailTo] = useState('');

    const letterRef = React.useMemo(() => firestore && id ? tDoc('official_letters', id) : null, [firestore, id, tDoc]);
    const { data: letter, isLoading } = useFetchDoc<OfficialLetter>(letterRef as any);

    const handleGeneratePDF = async () => {
        setIsGeneratingPDF(true);
        const el = paperRef.current;
        if (el) el.classList.add('ob-printing');
        try {
            await new Promise(res => requestAnimationFrame(() => requestAnimationFrame(res)));
            await waitForImages(el);
            const pageNodes = Array.from(el?.querySelectorAll('.ob-paper') || []);
            if (!pageNodes.length) throw new Error('Paper element олдсонгүй');
            const cfg = letter!.config;
            const pdf = new jsPDF({ unit: 'mm', format: cfg.paperSize.toLowerCase() as any, orientation: cfg.orientation, compress: true });
            const pw = pdf.internal.pageSize.getWidth();
            const ph = pdf.internal.pageSize.getHeight();
            for (let i = 0; i < pageNodes.length; i++) {
                const canvas = await html2canvas(pageNodes[i] as HTMLElement, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
                if (i > 0) pdf.addPage();
                pdf.addImage(canvas.toDataURL('image/jpeg', 0.98), 'JPEG', 0, 0, pw, ph, undefined, 'FAST');
            }
            pdf.save(`${letter?.letterNumber || 'letter'}.pdf`);
            toast({ title: 'PDF татагдлаа' });
        } catch (e: any) {
            toast({ title: 'PDF алдаа', description: e.message, variant: 'destructive' });
        } finally {
            if (el) el.classList.remove('ob-printing');
            setIsGeneratingPDF(false);
        }
    };

    const handleSendEmail = async () => {
        if (!emailTo || !letter) return;
        setIsSendingEmail(true);
        try {
            const res = await fetch('/api/official-letters/send-email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ letterId: id, toEmail: emailTo, config: letter.config }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Имэйл илгээхэд алдаа');
            await updateDoc(tDoc('official_letters', id), {
                status: 'SENT',
                sentTo: emailTo,
                sentAt: Timestamp.now(),
                updatedAt: Timestamp.now(),
            });
            toast({ title: 'Имэйл илгээгдлээ', description: emailTo });
            setEmailDialogOpen(false);
        } catch (e: any) {
            toast({ title: 'Алдаа', description: e.message, variant: 'destructive' });
        } finally {
            setIsSendingEmail(false);
        }
    };

    const handleArchive = async () => {
        try {
            await updateDoc(tDoc('official_letters', id), { status: 'ARCHIVED', updatedAt: Timestamp.now() });
            toast({ title: 'Архивлагдлаа' });
            router.push('/dashboard/official-letters');
        } catch {
            toast({ title: 'Алдаа гарлаа', variant: 'destructive' });
        }
    };

    if (isLoading) return <div className="flex h-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    if (!letter) return <div className="p-8 text-center text-muted-foreground">Бичиг олдсонгүй</div>;

    return (
        <div className="flex flex-col h-full bg-slate-50/50 p-6 md:p-8 space-y-6 overflow-y-auto pb-20">
            <PageHeader
                title={letter.letterNumber || 'Албан бичиг'}
                description={letter.config?.subject}
                showBackButton hideBreadcrumbs backButtonPlacement="inline" backBehavior="history"
                fallbackBackHref="/dashboard/official-letters"
                actions={
                    <div className="flex items-center gap-2 flex-wrap">
                        <Badge className={STATUS_COLORS[letter.status]} variant="secondary">
                            {STATUS_LABELS[letter.status]}
                        </Badge>
                        <Button variant="outline" size="sm" onClick={() => setEmailDialogOpen(true)}>
                            <Mail className="h-4 w-4 mr-1.5" /> Имэйл
                        </Button>
                        <Button variant="outline" size="sm" onClick={handleGeneratePDF} disabled={isGeneratingPDF}>
                            {isGeneratingPDF ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Download className="h-4 w-4 mr-1.5" />}
                            PDF
                        </Button>
                        {letter.status !== 'ARCHIVED' && (
                            <Button variant="outline" size="sm" onClick={handleArchive}>
                                <Archive className="h-4 w-4 mr-1.5" /> Архивлах
                            </Button>
                        )}
                    </div>
                }
            />

            {/* Meta info */}
            {letter.sentAt && (
                <div className="text-sm text-muted-foreground bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2">
                    ✅ {format(letter.sentAt.toDate(), 'yyyy.MM.dd HH:mm', { locale: mn })}-д <strong>{letter.sentTo}</strong> руу имэйлээр илгээгдсэн
                </div>
            )}

            {/* Paper preview */}
            <div className="bg-slate-400 rounded-2xl p-6 min-h-[900px] flex justify-center overflow-auto">
                <LetterPaper config={letter.config} wrapperRef={paperRef} />
            </div>

            {/* Email dialog */}
            <Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Mail className="h-5 w-5" /> Имэйлээр илгээх
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3 py-2">
                        <div className="space-y-1.5">
                            <Label>Хүлээн авагчийн имэйл</Label>
                            <Input type="email" placeholder="example@company.mn" value={emailTo} onChange={e => setEmailTo(e.target.value)} />
                        </div>
                        <p className="text-xs text-muted-foreground">Бичгийн PDF хавсралт болон агуулга имэйлээр илгээгдэнэ.</p>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEmailDialogOpen(false)}>Цуцлах</Button>
                        <Button onClick={handleSendEmail} disabled={isSendingEmail || !emailTo}>
                            {isSendingEmail ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                            Илгээх
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
