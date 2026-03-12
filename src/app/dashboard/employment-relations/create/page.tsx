'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useFetchCollection, useFirebase, addDocumentNonBlocking, useDoc, useTenantWrite } from '@/firebase';
import { query, where, Timestamp, getDocs, getDoc, addDoc } from 'firebase/firestore';
import { ERDocumentType, ERTemplate, ERDocument } from '../types';
import { Employee } from '@/types';
import { generateDocumentContent } from '../utils';
import { getNextDocumentNumber, previewNextDocumentNumber } from '../services/document-numbering';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import {
    ArrowLeft, ArrowRight, Check, FileText, User, Search,
    Loader2, ChevronRight, Home, Layout, FilePlus, Users, Wand2, Building2, Briefcase
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { format } from 'date-fns';
import { Switch } from '@/components/ui/switch';
import { PageHeader } from '@/components/patterns/page-layout';

export default function CreateDocumentPage() {
    const { firestore, user: firebaseUser } = useFirebase();
    const { tDoc, tCollection } = useTenantWrite();
    const { toast } = useToast();
    const router = useRouter();

    const [selectedType, setSelectedType] = useState<string>('');
    const [selectedTemplate, setSelectedTemplate] = useState<string>('');
    const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
    const [selectedDepartment, setSelectedDepartment] = useState<string>('');
    const [selectedPosition, setSelectedPosition] = useState<string>('');
    const [employeeSearch, setEmployeeSearch] = useState('');
    const [customInputValues, setCustomInputValues] = useState<Record<string, any>>({});

    const searchParams = useSearchParams();
    const qEmployeeId = searchParams.get('employeeId');
    const qWorkflowId = searchParams.get('workflowId');

    // Pre-fill logic
    useEffect(() => {
        if (!firestore) return;
        const prefill = async () => {
            if (qEmployeeId) {
                const empDoc = await getDoc(tDoc('employees', qEmployeeId));
                if (empDoc.exists()) {
                    setSelectedEmployee({ id: empDoc.id, ...empDoc.data() } as Employee);
                }
            }
            if (qWorkflowId) {
                const typeQuery = query(tCollection('er_process_document_types'), where('workflowId', '==', qWorkflowId));
                const typeSnap = await getDocs(typeQuery);
                if (!typeSnap.empty) setSelectedType(typeSnap.docs[0].id);
            }
        };
        prefill();
    }, [firestore, qEmployeeId, qWorkflowId, tDoc, tCollection]);

    const docTypesQuery = useMemo(() => firestore ? tCollection('er_process_document_types') : null, [firestore, tCollection]);
    const templatesQuery = useMemo(() =>
        firestore && selectedType ? query(tCollection('er_templates'), where('documentTypeId', '==', selectedType), where('isActive', '==', true)) : null
        , [firestore, selectedType, tCollection]);
    const employeesQuery = useMemo(() => firestore ? tCollection('employees') : null, [firestore, tCollection]);
    const departmentsQuery = useMemo(() => firestore ? tCollection('departments') : null, [firestore, tCollection]);
    const positionsQuery = useMemo(() =>
        firestore && selectedDepartment ? query(tCollection('positions'), where('departmentId', '==', selectedDepartment)) : null
        , [firestore, selectedDepartment, tCollection]);

    const { data: docTypes } = useFetchCollection<ERDocumentType>(docTypesQuery);
    const { data: templates } = useFetchCollection<ERTemplate>(templatesQuery);
    const { data: employees } = useFetchCollection<Employee>(employeesQuery);
    const { data: departments } = useFetchCollection<any>(departmentsQuery);
    const { data: positions } = useFetchCollection<any>(positionsQuery);

    const [companyProfile, setCompanyProfile] = useState<any>(null);

    useEffect(() => {
        if (!firestore) return;
        getDocs(tCollection('company_profile')).then(snap => {
            if (!snap.empty) setCompanyProfile(snap.docs[0].data());
        });
    }, [firestore, tCollection]);

    const filteredEmployees = useMemo(() => {
        if (!employees || !employeeSearch) return [];
        const term = employeeSearch.toLowerCase();
        return employees.filter(e =>
            e.firstName.toLowerCase().includes(term) ||
            e.lastName.toLowerCase().includes(term)
        ).slice(0, 5);
    }, [employees, employeeSearch]);

    const selectedTemplateData = useMemo(() => templates?.find(t => t.id === selectedTemplate), [templates, selectedTemplate]);

    // Initialize custom inputs when template takes effect
    useEffect(() => {
        if (selectedTemplateData?.customInputs) {
            const initialValues: Record<string, any> = {};
            selectedTemplateData.customInputs.forEach(input => {
                initialValues[input.key] = '';
            });
            setCustomInputValues(initialValues);
        } else {
            setCustomInputValues({});
        }
    }, [selectedTemplateData]);

    const handleCreate = async () => {
        if (!firestore || !selectedType || !selectedTemplate || !selectedEmployee) {
            toast({ title: "Дутуу мэдээлэл", description: "Бүх талбарыг сонгоно уу", variant: "destructive" });
            return;
        }

        try {
            // Автомат дугаар авах (атомик үйлдэл) — server-side allocator so non-admin creators work too
            let documentNumber: string | undefined;
            const idToken = await firebaseUser?.getIdToken?.();
            if (idToken) {
                const res = await fetch('/api/employment-relations/next-document-number', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${idToken}`,
                    },
                    body: JSON.stringify({ documentTypeId: selectedType }),
                });
                const json = await res.json().catch(() => ({}));
                if (!res.ok) {
                    const msg = String(json?.error || '');
                    // Dev fallback: if Admin SDK env isn't configured, use client-side transaction.
                    if (msg.includes('Firebase Admin env not configured')) {
                        documentNumber = await getNextDocumentNumber(firestore, selectedType);
                    } else {
                        throw new Error(msg || 'Баримтын дугаар олгох үйлдэл амжилтгүй');
                    }
                } else {
                    documentNumber = json?.documentNumber;
                }
            } else {
                // Fallback (dev / unexpected auth state): try client transaction
                documentNumber = await getNextDocumentNumber(firestore, selectedType);
            }

            if (!documentNumber) {
                throw new Error('Баримтын дугаар олгогдсонгүй');
            }

            // Fetch full data for replacement
            const empDoc = await getDoc(tDoc('employees', selectedEmployee.id));
            const deptData = departments?.find(d => d.id === selectedDepartment);
            const posData = positions?.find(p => p.id === selectedPosition);

            // Generate content
            const content = generateDocumentContent(selectedTemplateData?.content || '', {
                employee: { id: empDoc.id, ...empDoc.data() },
                department: deptData,
                position: posData,
                company: companyProfile,
                system: {
                    date: format(new Date(), 'yyyy-MM-dd'),
                    year: format(new Date(), 'yyyy'),
                    month: format(new Date(), 'MM'),
                    day: format(new Date(), 'dd'),
                    user: firebaseUser?.displayName || 'Системийн хэрэглэгч',
                    documentNumber: documentNumber // Баримтын дугаар
                },
                customInputs: customInputValues
            });

            const newDoc: Partial<ERDocument> = {
                documentNumber,
                documentTypeId: selectedType,
                templateId: selectedTemplate,
                employeeId: selectedEmployee.id,
                departmentId: selectedDepartment || undefined,
                positionId: selectedPosition || undefined,
                creatorId: firebaseUser?.uid || 'SYSTEM',
                status: 'DRAFT',
                content: content, // Now populated
                version: 1,
                printSettings: selectedTemplateData?.printSettings,
                customInputs: customInputValues,
                metadata: {
                    employeeName: `${selectedEmployee.firstName} ${selectedEmployee.lastName}`,
                    templateName: selectedTemplateData?.name,
                    departmentName: deptData?.name,
                    positionName: posData?.title,
                    documentNumber
                },
                history: [{
                    stepId: 'CREATE',
                    action: 'CREATE',
                    actorId: firebaseUser?.uid || 'SYSTEM',
                    timestamp: Timestamp.now(),
                    comment: `Баримт үүсгэв: ${documentNumber}`
                }],
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now()
            };

            const docRef = await addDoc(tCollection('er_documents'), newDoc);
            toast({ 
                title: "Амжилттай", 
                description: `Баримт ${documentNumber} үүслээ`
            });
            router.push(`/dashboard/employment-relations/${docRef.id}`);

        } catch (error) {
            console.error(error);
            toast({
                title: "Алдаа",
                description: (error as any)?.message || "Баримт үүсгэхэд алдаа гарлаа",
                variant: "destructive"
            });
        }
    };

    return (
        <div className="flex flex-col h-full bg-slate-50/50 p-6 md:p-8 space-y-8 overflow-y-auto">
            <div className="max-w-4xl mx-auto w-full space-y-8">
                <PageHeader
                    title="Шинэ процесс эхлүүлэх"
                    description={'Баримтын загвар болон ажилтнаа сонгоод "Төлөвлөх" үе шатыг эхлүүлнэ үү.'}
                    showBackButton
                    hideBreadcrumbs
                    backButtonPlacement="inline"
                    backBehavior="history"
                    fallbackBackHref="/dashboard/employment-relations"
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Left Col: Setup */}
                    <div className="space-y-6">
                        <Card className="border-none shadow-md bg-white">
                            <CardContent className="p-6 space-y-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-700">1. Баримтын төрөл</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {docTypes?.map(type => (
                                            <div
                                                key={type.id}
                                                onClick={() => setSelectedType(type.id)}
                                                className={`p-3 rounded-lg border cursor-pointer transition-all ${selectedType === type.id ? 'bg-primary/5 border-primary text-primary' : 'hover:bg-slate-50'}`}
                                            >
                                                <div className="font-medium text-sm">{type.name}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {selectedType && (
                                    <div className="space-y-2 animate-in fade-in">
                                        <label className="text-sm font-medium text-slate-700">2. Загвар сонгох</label>
                                        <div className="space-y-2">
                                            {templates?.length === 0 && <p className="text-xs text-muted-foreground">Энэ төрөлд загвар алга.</p>}
                                            {templates?.map(tpl => (
                                                <div
                                                    key={tpl.id}
                                                    onClick={() => setSelectedTemplate(tpl.id)}
                                                    className={`p-3 rounded-lg border cursor-pointer transition-all flex items-center gap-3 ${selectedTemplate === tpl.id ? 'bg-primary/5 border-primary ring-1 ring-primary/20' : 'hover:bg-slate-50'}`}
                                                >
                                                    <FileText className="h-4 w-4 text-slate-400" />
                                                    <span className="text-sm font-medium">{tpl.name}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-700">3. Ажилтан сонгох</label>
                                    <div className="relative">
                                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            placeholder="Хайх..."
                                            value={employeeSearch}
                                            onChange={(e) => setEmployeeSearch(e.target.value)}
                                            className="pl-9"
                                        />
                                    </div>
                                    {filteredEmployees.length > 0 && (
                                        <div className="border rounded-lg divide-y max-h-40 overflow-y-auto">
                                            {filteredEmployees.map(emp => (
                                                <div
                                                    key={emp.id}
                                                    onClick={() => { setSelectedEmployee(emp); setEmployeeSearch(`${emp.lastName} ${emp.firstName}`) }}
                                                    className="p-2 text-sm hover:bg-slate-50 cursor-pointer flex justify-between items-center"
                                                >
                                                    <span>{emp.lastName} {emp.firstName}</span>
                                                    {selectedEmployee?.id === emp.id && <Check className="h-3 w-3 text-primary" />}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    {selectedEmployee && (
                                        <div className="p-3 bg-slate-50 rounded-lg flex items-center gap-3 border">
                                            <div className="h-8 w-8 rounded-full bg-white border flex items-center justify-center font-bold text-xs">
                                                {selectedEmployee.firstName.charAt(0)}
                                            </div>
                                            <div className="text-sm font-medium">{selectedEmployee.lastName} {selectedEmployee.firstName}</div>
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-700">4. Албан нэгж сонгох</label>
                                    <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
                                        <SelectTrigger className="bg-white">
                                            <Building2 className="h-4 w-4 mr-2 text-slate-400" />
                                            <SelectValue placeholder="Албан нэгж сонгох" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {departments?.map(dept => (
                                                <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-700">5. Ажлын байр сонгох</label>
                                    <Select
                                        value={selectedPosition}
                                        onValueChange={setSelectedPosition}
                                        disabled={!selectedDepartment}
                                    >
                                        <SelectTrigger className="bg-white">
                                            <Briefcase className="h-4 w-4 mr-2 text-slate-400" />
                                            <SelectValue placeholder={selectedDepartment ? "Ажлын байр сонгох" : "Эхлээд албан нэгж сонгоно уу"} />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {positions?.map(pos => (
                                                <SelectItem key={pos.id} value={pos.id}>{pos.title}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                {selectedTemplateData?.customInputs && selectedTemplateData.customInputs.length > 0 && (
                                    <div className="space-y-4 pt-4 border-t animate-in slide-in-from-top-4">
                                        <div className="flex items-center gap-2 text-primary">
                                            <Wand2 className="h-4 w-4" />
                                            <label className="text-sm font-bold uppercase tracking-wider">Шаардлагатай мэдээллүүд</label>
                                        </div>
                                        <div className="grid grid-cols-1 gap-4">
                                            {[...(selectedTemplateData.customInputs || [])]
                                                .sort((a, b) => (a.order || 0) - (b.order || 0))
                                                .map((input, idx) => (
                                                    <div key={`${input.key || 'input'}-${input.order ?? idx}`} className="space-y-1.5">
                                                        <Label className="text-xs font-semibold text-slate-600 flex items-center justify-between">
                                                            <span>{input.label} {input.required && <span className="text-rose-500">*</span>}</span>
                                                            {input.type === 'boolean' && (
                                                                <Switch
                                                                    checked={customInputValues[input.key] === 'Тийм'}
                                                                    onCheckedChange={(c) => setCustomInputValues(prev => ({ ...prev, [input.key]: c ? 'Тийм' : 'Үгүй' }))}
                                                                />
                                                            )}
                                                        </Label>

                                                        {input.type !== 'boolean' && (
                                                            <Input
                                                                type={input.type === 'number' ? 'number' : input.type === 'date' ? 'date' : 'text'}
                                                                value={customInputValues[input.key] || ''}
                                                                onChange={(e) => setCustomInputValues(prev => ({ ...prev, [input.key]: e.target.value }))}
                                                                placeholder={input.description || `${input.label} оруулна уу...`}
                                                                className="h-10 border-slate-200 focus:border-primary focus:ring-primary/10"
                                                            />
                                                        )}
                                                        {input.type === 'boolean' && (
                                                            <p className="text-[10px] text-muted-foreground">{input.description || 'Сонголтыг идэвхжүүлэх эсвэл цуцлах'}</p>
                                                        )}
                                                    </div>
                                                ))}
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    {/* Right Col: Summary & Action */}
                    <div className="space-y-6">
                        <Card className="border-none shadow-xl bg-slate-900 text-white h-full relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-64 h-64 bg-primary/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
                            <CardContent className="p-8 flex flex-col h-full relative z-10">
                                <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                                    <Layout className="h-5 w-5 text-primary" /> Хураангуй
                                </h3>

                                <div className="space-y-6 flex-1">
                                    <div>
                                        <div className="text-slate-400 text-xs uppercase tracking-wider mb-1">Төрөл</div>
                                        <div className="font-medium text-lg">{docTypes?.find(t => t.id === selectedType)?.name || '-'}</div>
                                    </div>
                                    <div>
                                        <div className="text-slate-400 text-xs uppercase tracking-wider mb-1">Загвар</div>
                                        <div className="font-medium text-lg">{selectedTemplateData?.name || '-'}</div>
                                    </div>
                                    <div>
                                        <div className="text-slate-400 text-xs uppercase tracking-wider mb-1">Ажилтан</div>
                                        <div className="font-medium text-lg">{selectedEmployee ? `${selectedEmployee.lastName} ${selectedEmployee.firstName}` : '-'}</div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <div className="text-slate-400 text-xs uppercase tracking-wider mb-1 text-[10px]">Албан нэгж</div>
                                            <div className="font-medium text-sm truncate">{departments?.find(d => d.id === selectedDepartment)?.name || '-'}</div>
                                        </div>
                                        <div>
                                            <div className="text-slate-400 text-xs uppercase tracking-wider mb-1 text-[10px]">Ажлын байр</div>
                                            <div className="font-medium text-sm truncate">{positions?.find(p => p.id === selectedPosition)?.title || '-'}</div>
                                        </div>
                                    </div>
                                </div>

                                <Button
                                    size="lg"
                                    className="w-full bg-primary hover:bg-primary/90 text-white font-bold h-12 rounded-xl mt-8"
                                    disabled={!selectedType || !selectedTemplate || !selectedEmployee || (selectedTemplateData?.customInputs || []).some(i => i.required && !customInputValues[i.key])}
                                    onClick={handleCreate}
                                >
                                    Процесс эхлүүлэх <ArrowRight className="ml-2 h-4 w-4" />
                                </Button>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    );
}
