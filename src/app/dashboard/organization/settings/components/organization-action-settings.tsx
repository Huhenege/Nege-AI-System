import { collection, doc, query, where, Timestamp } from 'firebase/firestore';
import { useCollection, useFirebase, useMemoFirebase, setDocumentNonBlocking, tenantCollection, useTenantWrite } from '@/firebase';
import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, FileText, Pencil, X, Check, Zap } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ERTemplate } from '../../../employment-relations/types';
import { ensureSystemTemplates } from '../../../employment-relations/seed';

export function OrganizationActionSettings() {
    const { firestore, user } = useFirebase();
    const { tDoc } = useTenantWrite();
    const { toast } = useToast();
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editItemData, setEditItemData] = useState({
        templateId: '',
        dateMappings: {} as Record<string, string>
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Ensure system templates exist on first render (idempotent — skips if already created)
    const didInitRef = useRef(false);
    useEffect(() => {
        if (didInitRef.current || !firestore) return;
        didInitRef.current = true;
        ensureSystemTemplates().catch(e => console.warn('System template init:', e));
    }, [firestore]);

    // Fixed System Actions
    const SYSTEM_ACTIONS = [
        { id: 'appointment_permanent', name: 'Үндсэн ажилтнаар томилох', description: 'Үндсэн ажилтны томилгооны баримтын загвар' },
        { id: 'appointment_probation', name: 'Туршилтын хугацаатай томилох', description: 'Туршилтын хугацаатай томилгооны баримтын загвар' },
        { id: 'appointment_reappoint', name: 'Эргүүлэн томилох', description: 'Ажилтныг эргүүлэн томилох баримтын загвар' },
        { id: 'release_company', name: 'Компанийн санаачилгаар бүрэн чөлөөлөх', description: 'Ажил олгогчийн санаачилгаар хөдөлмөрийн гэрээ цуцлах баримтын загвар' },
        { id: 'release_employee', name: 'Ажилтны санаачилгаар бүрэн чөлөөлөх', description: 'Ажилтны хүсэлтээр хөдөлмөрийн гэрээ цуцлах баримтын загвар' },
        { id: 'release_temporary', name: 'Түр чөлөөлөх', description: 'Ажилтныг ажлаас түр чөлөөлөх (түдгэлзүүлэх) баримтын загвар' },
    ];

    const ACTION_REQUIREMENTS: Record<string, { label: string, key: string }[]> = {
        'appointment_permanent': [
            { label: 'Томилогдсон огноо', key: 'appointmentDate' }
        ],
        'appointment_probation': [
            { label: 'Туршилтын эхлэх огноо', key: 'probationStartDate' },
            { label: 'Туршилтын дуусах огноо', key: 'probationEndDate' }
        ],
        'appointment_reappoint': [
            { label: 'Эргүүлэн томилсон огноо', key: 'reappointmentDate' }
        ],
        'release_company': [
            { label: 'Ажлаас чөлөөлөх огноо', key: 'releaseDate' }
        ],
        'release_employee': [
            { label: 'Ажлаас чөлөөлөх огноо', key: 'releaseDate' }
        ],
        'release_temporary': [
            { label: 'Түр чөлөөлөх огноо', key: 'releaseDate' }
        ]
    };

    // Fetch Actions from Firestore to get the configured templateId
    const actionsRef = useMemoFirebase(
        ({ firestore, companyPath }) => (firestore ? tenantCollection(firestore, companyPath, 'organization_actions') : null),
        [firestore]
    );
    const { data: configuredActions, isLoading: isLoadingActions } = useCollection<any>(actionsRef);

    // Fetch only system templates (isSystem === true) for action configuration
    const templatesRef = useMemoFirebase(
        ({ firestore, companyPath }) => (firestore ? query(tenantCollection(firestore, companyPath, 'er_templates'), where('isActive', '==', true), where('isSystem', '==', true)) : null),
        [firestore]
    );
    const { data: templates } = useCollection<ERTemplate>(templatesRef as any);

    const handleUpdateAction = async (id: string) => {
        if (!firestore) return;

        if (!user) {
            toast({ title: 'Хандах эрхгүй', description: 'Та нэвтэрсэн байх шаардлагатай.', variant: 'destructive' });
            return;
        }

        // Validation for appointment types
        const requirements = ACTION_REQUIREMENTS[id];
        if (requirements) {
            if (!editItemData.templateId) {
                toast({
                    title: 'Загвар сонгоогүй байна',
                    description: 'Энэ үйлдлийн хувьд баримтын загвар заавал сонгох шаардлагатай.',
                    variant: 'destructive'
                });
                return;
            }

            const missing = requirements.some(req => !editItemData.dateMappings[req.key]);
            if (missing) {
                toast({
                    title: 'Мэдээлэл дутуу',
                    description: 'Шаардлагатай огнооны талбаруудыг холбоно уу.',
                    variant: 'destructive'
                });
                return;
            }
        }

        setIsSubmitting(true);
        try {
            // Use setDocumentNonBlocking with merge: true to handle both create and update
            const actionDocRef = tDoc('organization_actions', id);
            setDocumentNonBlocking(actionDocRef, {
                templateId: editItemData.templateId,
                dateMappings: editItemData.dateMappings,
                updatedAt: Timestamp.now(),
                name: SYSTEM_ACTIONS.find(a => a.id === id)?.name || id
            }, { merge: true });

            setEditingId(null);
            toast({ title: 'Тохиргоо хадгалагдлаа' });
        } catch (e: any) {
            console.error("Update action error:", e);
            toast({ title: 'Алдаа гарлаа', description: e.message, variant: 'destructive' });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Card className="border-none shadow-none bg-transparent">
            <CardContent className="px-0 pt-0">
                <div className="rounded-xl border bg-card text-card-foreground shadow-sm overflow-hidden">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-muted/50 hover:bg-muted/50">
                                <TableHead className="w-[30%]">Үйлдлийн нэр</TableHead>
                                <TableHead className="w-[60%]">Тохиргоо</TableHead>
                                <TableHead className="w-[100px] text-right">Үйлдэл</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoadingActions ? (
                                <TableRow>
                                    <TableCell colSpan={3} className="h-24 text-center">
                                        <div className="flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                SYSTEM_ACTIONS.map(action => {
                                    const config = configuredActions?.find(a => a.id === action.id);
                                    const isEditing = editingId === action.id;
                                    const requirements = ACTION_REQUIREMENTS[action.id];
                                    const selectedTemplate = templates?.find(t => t.id === (isEditing ? editItemData.templateId : config?.templateId));
                                    const dateInputs = selectedTemplate?.customInputs?.filter(i => i.type === 'date') || [];

                                    return (
                                        <TableRow key={action.id} className="group transition-colors">
                                            <TableCell className="align-top py-4">
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-slate-700 flex items-center gap-2">
                                                        <Zap className="w-4 h-4 text-amber-500" />
                                                        {action.name}
                                                    </span>
                                                    <span className="text-[10px] text-slate-400 font-medium leading-tight mt-1">{action.description}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="align-top py-4">
                                                <div className="space-y-4">
                                                    {isEditing ? (
                                                        <div className="space-y-3">
                                                            <div className="flex flex-col gap-1.5">
                                                                <span className="text-[10px] font-bold uppercase text-slate-400">Ашиглах загвар</span>
                                                                <Select
                                                                    value={editItemData.templateId}
                                                                    onValueChange={(val) => setEditItemData(prev => ({ ...prev, templateId: val, dateMappings: {} }))}
                                                                >
                                                                    <SelectTrigger className="h-9 bg-white">
                                                                        <SelectValue placeholder="Загвар сонгох" />
                                                                    </SelectTrigger>
                                                                    <SelectContent>
                                                                        {templates?.map(tpl => (
                                                                            <SelectItem key={tpl.id} value={tpl.id}>
                                                                                {tpl.name}
                                                                            </SelectItem>
                                                                        ))}
                                                                    </SelectContent>
                                                                </Select>
                                                            </div>

                                                            {requirements && editItemData.templateId && (
                                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3 bg-slate-50 rounded-lg border border-slate-100">
                                                                    {requirements.map(req => (
                                                                        <div key={req.key} className="flex flex-col gap-1.5">
                                                                            <span className="text-[10px] font-bold text-slate-500">{req.label}</span>
                                                                            <Select
                                                                                value={editItemData.dateMappings[req.key] || ''}
                                                                                onValueChange={(val) => setEditItemData(prev => ({
                                                                                    ...prev,
                                                                                    dateMappings: { ...prev.dateMappings, [req.key]: val }
                                                                                }))}
                                                                            >
                                                                                <SelectTrigger className="h-8 bg-white text-xs">
                                                                                    <SelectValue placeholder="Талбар сонгох" />
                                                                                </SelectTrigger>
                                                                                <SelectContent>
                                                                                    {dateInputs.map((input, idx) => (
                                                                                        <SelectItem key={`${input.key}-${input.order ?? idx}`} value={input.key}>
                                                                                            {input.label}
                                                                                        </SelectItem>
                                                                                    ))}
                                                                                </SelectContent>
                                                                            </Select>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <div className="flex flex-col gap-2">
                                                            <div className="flex items-center gap-2 text-sm text-slate-600 font-medium">
                                                                <FileText className="w-4 h-4 text-slate-400" />
                                                                {selectedTemplate?.name || (
                                                                    <span className="text-amber-500 italic">Тохируулаагүй байна</span>
                                                                )}
                                                            </div>

                                                            {requirements && config?.dateMappings && (
                                                                <div className="flex flex-wrap gap-2">
                                                                    {requirements.map(req => {
                                                                        const mappedKey = config.dateMappings[req.key];
                                                                        const inputLabel = selectedTemplate?.customInputs?.find(i => i.key === mappedKey)?.label;
                                                                        return (
                                                                            <div key={req.key} className="flex items-center gap-1.5 px-2 py-1 bg-indigo-50 text-indigo-700 rounded text-[10px] font-bold border border-indigo-100">
                                                                                <span>{req.label}:</span>
                                                                                <span className="text-slate-600">{inputLabel || mappedKey || 'Тохируулаагүй'}</span>
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right align-top py-4">
                                                {isEditing ? (
                                                    <div className="flex justify-end gap-1">
                                                        <Button size="sm" onClick={() => handleUpdateAction(action.id)} disabled={isSubmitting} className="h-8 w-8 p-0 bg-emerald-600 hover:bg-emerald-700">
                                                            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                                                        </Button>
                                                        <Button size="sm" variant="ghost" onClick={() => setEditingId(null)} className="h-8 w-8 p-0">
                                                            <X className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                ) : (
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => {
                                                            setEditingId(action.id);
                                                            setEditItemData({
                                                                templateId: config?.templateId || '',
                                                                dateMappings: config?.dateMappings || {}
                                                            });
                                                        }}
                                                        className="h-8 px-3 text-xs font-bold border-slate-200 hover:bg-slate-50 hover:text-primary transition-all rounded-lg"
                                                    >
                                                        <Pencil className="h-3 w-3 mr-2" />
                                                        Засах
                                                    </Button>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    );
                                })
                            )}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    );
}
