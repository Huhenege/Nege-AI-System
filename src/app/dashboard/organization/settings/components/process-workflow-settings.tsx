'use client';

import React from 'react';
import { query, orderBy } from 'firebase/firestore';
import { useFetchCollection, useDoc, useFirebase, setDocumentNonBlocking, useTenantWrite, tenantCollection, tenantDoc } from '@/firebase';
import { ERWorkflow } from '../../../employment-relations/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { GitBranch, UserPlus, Loader2, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';

export function ProcessWorkflowSettings() {
    const { firestore } = useFirebase();
    const { tDoc, companyPath } = useTenantWrite();
    const { toast } = useToast();

    // Fetch available workflows
    const workflowsQuery = React.useMemo(() =>
        firestore && companyPath ? query(tenantCollection(firestore, companyPath, 'er_workflows'), orderBy('name')) : null
        , [firestore, companyPath]);
    const { data: workflows, isLoading: workflowsLoading } = useFetchCollection<ERWorkflow>(workflowsQuery);

    // Fetch current settings
    const settingsRef = React.useMemo(() =>
        firestore && companyPath ? tenantDoc(firestore, companyPath, 'organization_settings', 'workflows') : null
        , [firestore, companyPath]);
    const { data: settings, isLoading: settingsLoading } = useDoc<any>(settingsRef);

    const handleUpdateWorkflow = async (processKey: string, workflowId: string) => {
        if (!firestore) return;

        try {
            await setDocumentNonBlocking(tDoc('organization_settings', 'workflows'), {
                [processKey]: workflowId,
                updatedAt: new Date().toISOString()
            }, { merge: true });
            toast({ title: "Тохиргоо хадгалагдлаа" });
        } catch (error) {
            toast({ title: "Алдаа гарлаа", variant: "destructive" });
        }
    };

    if (workflowsLoading || settingsLoading) {
        return (
            <div className="flex items-center justify-center p-12">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
        );
    }

    const processes = [
        {
            key: 'employee_appointment',
            title: 'Ажилтан томилох',
            description: 'Сул ажлын байранд эсвэл шинээр ажилтан томилох үед ашиглах ажлын урсгал.',
            icon: <UserPlus className="w-4 h-4 text-blue-500" />
        }
    ];

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-1">
                <h3 className="text-lg font-semibold text-foreground">Ажлын урсгалын тохиргоо</h3>
                <p className="text-sm text-muted-foreground">Бүтэц, орон тоотой холбоотой хөдөлмөрийн харилцааны процессуудад ашиглагдах ажлын урсгалуудыг энд тохируулна.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {processes.map((proc) => (
                    <Card key={proc.key} className="border-border/50 shadow-sm overflow-hidden group hover:border-primary/30 transition-all">
                        <CardHeader className="bg-muted/30 pb-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-background border border-border group-hover:bg-primary/5 group-hover:border-primary/20 transition-all">
                                    {proc.icon}
                                </div>
                                <div>
                                    <CardTitle className="text-sm font-bold uppercase tracking-wider">{proc.title}</CardTitle>
                                    <CardDescription className="text-xs">{proc.description}</CardDescription>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="pt-6 space-y-4">
                            <div className="space-y-2">
                                <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground pl-1">Сонгосон урсгал</Label>
                                <Select
                                    value={settings?.[proc.key] || 'none'}
                                    onValueChange={(val) => handleUpdateWorkflow(proc.key, val)}
                                >
                                    <SelectTrigger className="h-12 rounded-xl border-border bg-background shadow-sm">
                                        <div className="flex items-center gap-2">
                                            <GitBranch className="w-4 h-4 text-purple-500" />
                                            <SelectValue placeholder="Урсгал сонгох" />
                                        </div>
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl border-border">
                                        <SelectItem value="none" className="rounded-lg text-muted-foreground">Урсгал тохируулаагүй</SelectItem>
                                        {workflows?.map((w) => (
                                            <SelectItem key={w.id} value={w.id} className="rounded-lg">
                                                <div className="flex flex-col gap-0.5">
                                                    <span className="font-bold">{w.name}</span>
                                                    <span className="text-[10px] text-muted-foreground">{w.steps?.length || 0} алхамтай</span>
                                                </div>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <div className="p-6 rounded-2xl bg-amber-50/50 border border-amber-200/50 flex items-start gap-4">
                <div className="p-2 rounded-xl bg-amber-100 text-amber-600">
                    <Save className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                    <h4 className="text-sm font-bold text-amber-900">Мэдэгдэл</h4>
                    <p className="text-xs text-amber-800 leading-relaxed">
                        Энд тохируулсан ажлын урсгалууд нь системд шинээр хөдөлмөрийн харилцааны баримт бичиг үүсгэх үед автоматаар ашиглагдах болно.
                        Цаашид сэлгэн ажиллуулах, чөлөөлөх зэрэг бусад процессуудын тохиргоог энд нэмж оруулахаар төлөвлөж байна.
                    </p>
                </div>
            </div>
        </div>
    );
}
