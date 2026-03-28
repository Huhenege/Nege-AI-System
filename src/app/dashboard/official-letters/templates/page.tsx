'use client';

import React, { useMemo, useState } from 'react';
import { Timestamp, addDoc, deleteDoc, setDoc } from 'firebase/firestore';
import { useFirebase, useFetchCollection, useFetchDoc, useTenantWrite } from '@/firebase';
import { useUser } from '@/firebase';
import { OfficialLetterTemplate, OfficialLetterConfig, DEFAULT_CONFIG } from '../types';
import { PageHeader } from '@/components/patterns/page-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { Plus, Trash2, Loader2, FileText, Settings } from 'lucide-react';

export default function TemplatesPage() {
    const { firestore } = useFirebase();
    const { tCollection, tDoc } = useTenantWrite();
    const { user } = useUser();
    const { toast } = useToast();
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [templateName, setTemplateName] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    const templatesQuery = useMemo(() =>
        firestore ? tCollection('official_letter_templates') : null
        , [firestore, tCollection]);
    const { data: templates, isLoading } = useFetchCollection<OfficialLetterTemplate>(templatesQuery);

    // Numbering config
    const configRef = useMemo(() => firestore ? tDoc('official_letter_config', 'main') : null, [firestore, tDoc]);

    const handleSaveTemplate = async () => {
        if (!templateName.trim() || !user) return;
        setIsSaving(true);
        try {
            await addDoc(tCollection('official_letter_templates'), {
                name: templateName.trim(),
                config: DEFAULT_CONFIG,
                isSystem: false,
                createdBy: user.uid,
                createdAt: Timestamp.now(),
            });
            toast({ title: 'Загвар нэмэгдлээ' });
            setTemplateName('');
            setIsDialogOpen(false);
        } catch (e: any) {
            toast({ title: 'Алдаа', description: e.message, variant: 'destructive' });
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (id: string, isSystem?: boolean) => {
        if (isSystem) { toast({ title: 'Системийн загварыг устгах боломжгүй', variant: 'destructive' }); return; }
        await deleteDoc(tDoc('official_letter_templates', id));
        toast({ title: 'Устгагдлаа' });
    };

    return (
        <div className="p-6 md:p-8 space-y-6">
            <PageHeader
                title="Загварын удирдлага"
                description="Байгууллагын мэдээллийг хадгалж, дахин ашиглах загварууд"
                showBackButton hideBreadcrumbs backButtonPlacement="inline" backBehavior="history"
                fallbackBackHref="/dashboard/official-letters"
                actions={
                    <Button onClick={() => setIsDialogOpen(true)}>
                        <Plus className="h-4 w-4 mr-2" /> Шинэ загвар
                    </Button>
                }
            />

            {/* Numbering config card */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                        <Settings className="h-4 w-4" /> Дугаарлалтын тохиргоо
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <NumberingConfigForm configRef={configRef} />
                </CardContent>
            </Card>

            {/* Templates */}
            <div className="space-y-3">
                {isLoading ? (
                    [1,2,3].map(i => <Skeleton key={i} className="h-16" />)
                ) : !templates?.length ? (
                    <div className="text-center py-12 border-2 border-dashed rounded-2xl">
                        <FileText className="h-10 w-10 mx-auto mb-3 opacity-10" />
                        <p className="text-muted-foreground text-sm">Загвар байхгүй байна</p>
                    </div>
                ) : templates.map(t => (
                    <Card key={t.id}>
                        <CardContent className="p-4 flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                                <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
                                <div>
                                    <p className="font-medium text-sm">{t.name}</p>
                                    <p className="text-xs text-muted-foreground">{t.config?.orgName || '—'}</p>
                                </div>
                                {t.isSystem && <Badge variant="secondary" className="text-[10px]">Системийн</Badge>}
                            </div>
                            {!t.isSystem && (
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-rose-400 hover:text-rose-600"
                                    onClick={() => handleDelete(t.id, t.isSystem)}>
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            )}
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Add dialog */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Шинэ загвар нэмэх</DialogTitle></DialogHeader>
                    <div className="space-y-3 py-2">
                        <div className="space-y-1.5">
                            <Label>Загварын нэр</Label>
                            <Input placeholder="Стандарт загвар" value={templateName} onChange={e => setTemplateName(e.target.value)} />
                        </div>
                        <p className="text-xs text-muted-foreground">Загвар үүссэний дараа шинэ бичиг үүсгэхэд сонгож хэрэглэнэ.</p>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Болих</Button>
                        <Button onClick={handleSaveTemplate} disabled={isSaving || !templateName.trim()}>
                            {isSaving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                            Хадгалах
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

// Numbering config mini form
function NumberingConfigForm({ configRef }: { configRef: any }) {
    const { data: cfg, isLoading } = useFetchDoc<any>(configRef);
    const [prefix, setPrefix] = React.useState('АБ');
    const [digitCount, setDigitCount] = React.useState(4);
    const [isSaving, setIsSaving] = React.useState(false);
    const { toast } = useToast();

    React.useEffect(() => {
        if (cfg) { setPrefix(cfg.prefix || 'АБ'); setDigitCount(cfg.digitCount || 4); }
    }, [cfg]);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await setDoc(configRef, { prefix, digitCount, nextNumber: cfg?.nextNumber || 1, resetPeriod: 'yearly' }, { merge: true });
            toast({ title: 'Тохиргоо хадгалагдлаа' });
        } catch { toast({ title: 'Алдаа', variant: 'destructive' }); }
        finally { setIsSaving(false); }
    };

    if (isLoading) return <Skeleton className="h-10 w-full" />;
    return (
        <div className="flex items-end gap-3">
            <div className="space-y-1">
                <Label className="text-xs">Угтвар</Label>
                <Input value={prefix} onChange={e => setPrefix(e.target.value.toUpperCase())} className="h-8 w-20 text-sm" />
            </div>
            <div className="space-y-1">
                <Label className="text-xs">Оронгийн тоо</Label>
                <Input type="number" min={1} max={8} value={digitCount} onChange={e => setDigitCount(Number(e.target.value))} className="h-8 w-20 text-sm" />
            </div>
            <div className="text-sm text-muted-foreground pb-1">→ Жишээ: <strong>{prefix}-{new Date().getFullYear()}-{'0'.repeat(digitCount - 1)}1</strong></div>
            <Button size="sm" onClick={handleSave} disabled={isSaving} className="h-8">
                {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Хадгалах'}
            </Button>
        </div>
    );
}
