'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useFirebase, useCollection, useMemoFirebase, tenantCollection, useTenantWrite } from '@/firebase';
import { getDoc, updateDoc, query, where, getDocs, deleteDoc } from 'firebase/firestore';
import { Vacancy, JobApplication, RecruitmentStage } from '@/types/recruitment';
import { format } from 'date-fns';
import { mn } from 'date-fns/locale';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { VerticalTabMenu } from '@/components/ui/vertical-tab-menu';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Link as LinkIcon, Users, UserPlus, CheckCircle2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/patterns/page-layout';
import { OpenVacancyCard } from '@/components/recruitment/open-vacancy-card';
import type { Department, Employee } from '@/types';
import { PipelineBoard } from '../../components/pipeline-board';
import { EditVacancyDialog } from '@/components/recruitment/edit-vacancy-dialog';
import { EmployeeCard, EmployeeCardEmployee } from '@/components/employees/employee-card';
import { AddCandidateDialog } from '../../components/add-candidate-dialog';
import { AddActionButton } from '@/components/ui/add-action-button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

const DEFAULT_STAGES: RecruitmentStage[] = [
    { id: 'screening', title: 'Анкет шүүлт', type: 'SCREENING', order: 0 },
    { id: 'first-interview', title: 'Анхан шатны ярилцлага', type: 'INTERVIEW', order: 1 },
    { id: 'tech-task', title: 'Даалгавар', type: 'CHALLENGE', order: 2 },
    { id: 'final-interview', title: 'Эцсийн ярилцлага', type: 'INTERVIEW', order: 3 },
    { id: 'offer', title: 'Санал тавих', type: 'OFFER', order: 4 },
];

export default function VacancyDetailPage() {
    const { vacancyId } = useParams();
    const router = useRouter();
    const { firestore, storage } = useFirebase();
    const { tDoc, tCollection } = useTenantWrite();
    const { toast } = useToast();

    const [vacancy, setVacancy] = useState<Vacancy | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [department, setDepartment] = useState<Department | null>(null);
    const [employmentTypeName, setEmploymentTypeName] = useState<string | undefined>(undefined);
    const [editOpen, setEditOpen] = useState(false);
    const [addCandidateOpen, setAddCandidateOpen] = useState(false);

    // Candidates Data
    const [candidates, setCandidates] = useState<any[]>([]);
    const [loadingCandidates, setLoadingCandidates] = useState(false);
    const [globalStages, setGlobalStages] = useState<RecruitmentStage[]>(DEFAULT_STAGES);
    const [savingParticipants, setSavingParticipants] = useState(false);

    const employeesQuery = useMemoFirebase(({ firestore, companyPath }) => (firestore ? tenantCollection(firestore, companyPath, 'employees') : null), [firestore]);
    const { data: employees } = useCollection<Employee>(employeesQuery);

    useEffect(() => {
        const fetchData = async () => {
            if (!firestore || !vacancyId) return;
            setLoading(true);
            try {
                // 1. Fetch global stages first
                let currentStages = DEFAULT_STAGES;
                const settingsRef = tDoc('recruitment_settings', 'default');
                const settingsSnap = await getDoc(settingsRef);
                if (settingsSnap.exists() && settingsSnap.data().defaultStages) {
                    currentStages = settingsSnap.data().defaultStages as RecruitmentStage[];
                    setGlobalStages(currentStages);
                } else {
                    setGlobalStages(DEFAULT_STAGES);
                }

                // 2. Fetch vacancy
                const docRef = tDoc('vacancies', vacancyId as string);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    const vacancyData = {
                        ...data,
                        id: docSnap.id,
                        stages: currentStages
                    } as Vacancy;

                    setVacancy(vacancyData);

                    // 3. Fetch department (for name/color in OpenVacancyCard)
                    try {
                        if (vacancyData.departmentId) {
                            const deptSnap = await getDoc(tDoc('departments', vacancyData.departmentId));
                            if (deptSnap.exists()) {
                                setDepartment({ id: deptSnap.id, ...(deptSnap.data() as any) } as Department);
                            } else {
                                setDepartment(null);
                            }
                        }
                    } catch {
                        setDepartment(null);
                    }

                    // 4. Fetch employment type name
                    try {
                        if (vacancyData.employmentTypeId) {
                            const etSnap = await getDoc(tDoc('employmentTypes', vacancyData.employmentTypeId));
                            if (etSnap.exists()) {
                                setEmploymentTypeName(etSnap.data().name);
                            }
                        }
                    } catch {
                        // ignore
                    }
                } else {
                    toast({ title: 'Ажлын байр олдсонгүй', variant: 'destructive' });
                    router.push('/dashboard/recruitment');
                }
            } catch (error) {
                console.error("Error fetching vacancy data:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [firestore, vacancyId, router, toast]);

    const fetchCandidates = async () => {
        if (!firestore || !vacancyId) return;
        setLoadingCandidates(true);
        try {
            const q = query(tCollection('applications'), where('vacancyId', '==', vacancyId));
            const appSnaps = await getDocs(q);
            const apps = appSnaps.docs.map(d => ({ id: d.id, ...d.data() } as JobApplication));
            const candidatePromises = apps.map(async (app) => {
                const candidateRef = tDoc('candidates', app.candidateId);
                const candidateSnap = await getDoc(candidateRef);
                const stageName = globalStages.find(s => s.id === app.currentStageId)?.title || app.currentStageId;

                // Employee мэдээлэл татах (employeeId байгаа бол)
                let employee: EmployeeCardEmployee | null = null;
                if (app.employeeId) {
                    try {
                        const empSnap = await getDoc(tDoc('employees', app.employeeId));
                        if (empSnap.exists()) {
                            employee = { id: empSnap.id, ...empSnap.data() } as EmployeeCardEmployee;
                        }
                    } catch { /* ignore */ }
                }

                return {
                    appId: app.id,
                    ...app,
                    stageName,
                    candidate: candidateSnap.exists() ? { id: candidateSnap.id, ...candidateSnap.data() } : null,
                    employee,
                };
            });
            setCandidates(await Promise.all(candidatePromises));
        } catch (error) {
            console.error(error);
        } finally {
            setLoadingCandidates(false);
        }
    };

    useEffect(() => {
        if (firestore && vacancyId) {
            fetchCandidates();
        }
    }, [firestore, vacancyId, globalStages]);

    const handleSaveVacancy = async (draft: { title: string; status: Vacancy['status']; deadline: Date | undefined; description: string }) => {
        if (!firestore || !vacancyId) return;
        setSaving(true);
        try {
            const docRef = tDoc('vacancies', vacancyId as string);
            await updateDoc(docRef, {
                title: draft.title,
                description: draft.description,
                status: draft.status,
                deadline: draft.deadline ? draft.deadline.toISOString() : null,
                updatedAt: new Date().toISOString()
            });
            toast({ title: 'Амжилттай хадгалагдлаа' });
            setVacancy(prev =>
                prev
                    ? {
                        ...prev,
                        title: draft.title,
                        description: draft.description,
                        status: draft.status,
                        deadline: draft.deadline ? draft.deadline.toISOString() : undefined,
                    }
                    : prev
            );
            setEditOpen(false);
        } catch (error) {
            console.error(error);
            toast({ title: 'Алдаа гарлаа', variant: 'destructive' });
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteVacancy = async () => {
        if (!firestore || !vacancyId) return;
        setSaving(true);
        try {
            const applicationsRef = tCollection('applications');
            const q = query(applicationsRef, where('vacancyId', '==', vacancyId));
            const snap = await getDocs(q);
            await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
            await deleteDoc(tDoc('vacancies', vacancyId as string));
            toast({ title: 'Ажлын байр устгагдлаа' });
            router.push('/dashboard/recruitment');
        } catch (error) {
            console.error(error);
            toast({ title: 'Устгаж чадсангүй', variant: 'destructive' });
        } finally {
            setSaving(false);
        }
    };

    const copyPublicLink = () => {
        const url = `${window.location.origin}/apply/${vacancyId}`;
        navigator.clipboard.writeText(url);
        toast({ title: 'Линк хуулагдлаа', description: url });
    };

    const participantIds = vacancy?.participantIds ?? [];
    const addParticipant = async (employeeId: string) => {
        if (!firestore || !vacancyId || participantIds.includes(employeeId)) return;
        setSavingParticipants(true);
        try {
            const next = [...participantIds, employeeId];
            await updateDoc(tDoc('vacancies', vacancyId as string), {
                participantIds: next,
                updatedAt: new Date().toISOString(),
            });
            setVacancy(prev => (prev ? { ...prev, participantIds: next } : prev));
            toast({ title: 'Оролцогч нэмэгдлээ' });
        } catch {
            toast({ title: 'Нэмж чадсангүй', variant: 'destructive' });
        } finally {
            setSavingParticipants(false);
        }
    };
    const removeParticipant = async (employeeId: string) => {
        if (!firestore || !vacancyId) return;
        setSavingParticipants(true);
        try {
            const next = participantIds.filter(id => id !== employeeId);
            await updateDoc(tDoc('vacancies', vacancyId as string), {
                participantIds: next,
                updatedAt: new Date().toISOString(),
            });
            setVacancy(prev => (prev ? { ...prev, participantIds: next } : prev));
            toast({ title: 'Оролцогч хасагдлаа' });
        } catch {
            toast({ title: 'Хасж чадсангүй', variant: 'destructive' });
        } finally {
            setSavingParticipants(false);
        }
    };
    const employeeMap = React.useMemo(() => {
        const m = new Map<string, Employee>();
        (employees ?? []).forEach(e => m.set(e.id, e));
        return m;
    }, [employees]);
    const availableToAdd = (employees ?? []).filter(e => !participantIds.includes(e.id));

    if (loading) return <div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    if (!vacancy) return <div>Not found</div>;

    return (
        <div className="flex flex-col h-full bg-slate-50/50">
            <div className="border-b bg-white px-page py-4 sticky top-0 z-10">
                <PageHeader
                    title={vacancy.title}
                    description="Нээлтэй ажлын байр"
                    showBackButton={true}
                    hideBreadcrumbs={true}
                    backButtonPlacement="inline"
                    backBehavior="history"
                    fallbackBackHref="/dashboard/recruitment"
                    actions={
                        <>
                            <AddActionButton
                                label="Горилогч нэмэх"
                                description="Шинэ горилогч бүртгэх"
                                onClick={() => setAddCandidateOpen(true)}
                            />
                            <AddCandidateDialog
                                vacancy={{ ...vacancy, stages: globalStages }}
                                open={addCandidateOpen}
                                onOpenChange={setAddCandidateOpen}
                                onSuccess={fetchCandidates}
                            />
                        </>
                    }
                />
            </div>

            <div className="flex-1 w-full p-6 md:p-8 space-y-6 pb-32">
                <Tabs defaultValue="pipeline" className="w-full">
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                        {/* Left column: vacancy card */}
                        <div className="lg:col-span-3 space-y-4">
                            <div className="flex justify-center">
                                <OpenVacancyCard
                                    vacancy={vacancy}
                                    departmentName={department?.name || vacancy.departmentId}
                                    departmentColor={department?.color}
                                    employmentTypeName={employmentTypeName}
                                    actionsVisibility="always"
                                    showViewAction={false}
                                    showEditAction={true}
                                    onEdit={() => setEditOpen(true)}
                                    sections={[
                                        {
                                            content: (
                                                <div className="space-y-3">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-xs text-muted-foreground">Бүртгэлийн төлөв</span>
                                                        <Badge variant="secondary" className="text-[10px] px-2 py-0.5 font-medium bg-indigo-50 text-indigo-700 border-indigo-100">
                                                            {vacancy.status === 'OPEN' ? 'Идэвхтэй' : 'Хаалттай'}
                                                        </Badge>
                                                    </div>
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-xs text-muted-foreground">Горилогчид</span>
                                                        <span className="text-xs font-semibold">{candidates.length} хүн</span>
                                                    </div>
                                                    <div className="space-y-1 pt-1">
                                                        <div className="flex items-center justify-between text-sm">
                                                            <span className="text-muted-foreground">Нийтийн линк</span>
                                                            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={copyPublicLink}>
                                                                <LinkIcon className="h-3.5 w-3.5 mr-1.5" />
                                                                Хуулах
                                                            </Button>
                                                        </div>
                                                        <div className="text-[10px] text-blue-700 font-mono truncate">
                                                            {typeof window !== 'undefined' ? `${window.location.origin}/apply/${vacancyId}` : ''}
                                                        </div>
                                                    </div>
                                                </div>
                                            ),
                                        },
                                    ]}
                                    detailsTitle="Агуулга, чиг үүрэг"
                                    detailsDescription={
                                        vacancy.description
                                            ? vacancy.description.replace(/\s+/g, ' ').replace(/^#+\s*/gm, '').slice(0, 80) + (vacancy.description.length > 80 ? '…' : '')
                                            : (vacancy.requirements?.length ? `${vacancy.requirements.length} чиг үүрэг` : 'Дарж дэлгэнэ үзнэ үү')
                                    }
                                    detailsContent={
                                        <div className="space-y-4 text-sm">
                                            <div>
                                                <div className="font-semibold text-slate-700 mb-2">Агуулга</div>
                                                {vacancy.description ? (
                                                    <div className="prose prose-sm max-w-none text-slate-700 [&_ul]:list-disc [&_ol]:list-decimal">
                                                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{vacancy.description}</ReactMarkdown>
                                                    </div>
                                                ) : (
                                                    <p className="text-muted-foreground">Тайлбар оруулаагүй байна.</p>
                                                )}
                                            </div>
                                            {vacancy.requirements?.length ? (
                                                <div>
                                                    <div className="font-semibold text-slate-700 mb-2">Чиг үүрэг</div>
                                                    <ul className="list-disc pl-5 space-y-1 text-slate-700">
                                                        {vacancy.requirements.map((r, i) => (
                                                            <li key={i}>{r}</li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            ) : null}
                                        </div>
                                    }
                                />
                            </div>

                            <Card className="shadow-sm">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                                        <Users className="h-4 w-4" />
                                        Сонгон шалгаруулалтад оролцогчид
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    <div className="space-y-2 max-h-[200px] overflow-y-auto">
                                        {participantIds.length === 0 ? (
                                            <p className="text-xs text-muted-foreground py-2">Оролцогч нэмээгүй байна.</p>
                                        ) : (
                                            participantIds.map((empId) => {
                                                const emp = employeeMap.get(empId);
                                                const name = emp ? `${emp.lastName || ''} ${emp.firstName || ''}`.trim() || emp.email || empId : empId;
                                                return (
                                                    <div
                                                        key={empId}
                                                        className="flex items-center justify-between gap-2 rounded-lg border bg-slate-50/50 px-2 py-1.5"
                                                    >
                                                        <div className="flex items-center gap-2 min-w-0">
                                                            <Avatar className="h-6 w-6 shrink-0">
                                                                <AvatarImage src={emp?.photoURL} />
                                                                <AvatarFallback className="text-[10px] bg-indigo-100 text-indigo-700">
                                                                    {(emp?.firstName?.[0] || emp?.lastName?.[0] || '?')}
                                                                </AvatarFallback>
                                                            </Avatar>
                                                            <span className="text-xs font-medium truncate">{name}</span>
                                                        </div>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-6 w-6 shrink-0 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                                                            onClick={() => removeParticipant(empId)}
                                                            disabled={savingParticipants}
                                                            title="Хасах"
                                                        >
                                                            <X className="h-3.5 w-3.5" />
                                                        </Button>
                                                    </div>
                                                );
                                            })
                                        )}
                                    </div>
                                    {availableToAdd.length > 0 && (
                                        <Select
                                            value=""
                                            onValueChange={(id) => { if (id) addParticipant(id); }}
                                            disabled={savingParticipants}
                                        >
                                            <SelectTrigger className="h-9 text-xs">
                                                <SelectValue placeholder="Ажилтан нэмэх" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {availableToAdd.map((emp) => (
                                                    <SelectItem key={emp.id} value={emp.id} className="text-xs">
                                                        {`${emp.lastName || ''} ${emp.firstName || ''}`.trim() || emp.email || emp.id}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    )}
                                </CardContent>
                            </Card>
                        </div>

                        {/* Right column: selected tab content */}
                        <div className="lg:col-span-9">
                            <div className="mb-4">
                                <VerticalTabMenu
                                    orientation="horizontal"
                                    items={[
                                        { value: 'pipeline', label: 'Үе шат' },
                                        { value: 'candidates', label: 'Горилогчид' },
                                    ]}
                                />
                            </div>

                            <div className="bg-transparent border-0 rounded-none">
                                <div className="p-0 min-h-[400px]">
                                    <TabsContent value="candidates" className="mt-0">
                                        {loadingCandidates ? (
                                            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-4">
                                                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                                <p className="text-sm font-medium">Мэдээлэл ачаалж байна...</p>
                                            </div>
                                        ) : candidates.length === 0 ? (
                                            <div className="flex flex-col items-center justify-center py-24 text-muted-foreground gap-3">
                                                <div className="p-4 rounded-full bg-slate-50 border border-slate-100">
                                                    <Users className="h-8 w-8 text-slate-300" />
                                                </div>
                                                <div className="text-center">
                                                    <p className="font-semibold text-slate-600">Одоогоор горилогч бүртгүүлээгүй байна</p>
                                                    <p className="text-sm text-slate-400">Дээрх "Горилогч нэмэх" товч дарж нэмнэ үү.</p>
                                                </div>
                                            </div>
                                        ) : (() => {
                                            const activeCandidates = candidates.filter(c => c.status === 'ACTIVE');
                                            const hiredCandidates = candidates.filter(c => c.status === 'HIRED');
                                            const rejectedCandidates = candidates.filter(c => c.status === 'REJECTED');

                                            const renderCandidateCard = (app: any) => {
                                                const isAppRejected = app.status === 'REJECTED';
                                                const isAppHired = app.status === 'HIRED';
                                                const emp: EmployeeCardEmployee = app.employee || {
                                                    id: app.employeeId || app.id,
                                                    firstName: app.candidate?.firstName || '',
                                                    lastName: app.candidate?.lastName || '',
                                                    email: app.candidate?.email || '',
                                                    phoneNumber: app.candidate?.phone || '',
                                                    status: 'candidate' as const,
                                                    lifecycleStage: 'recruitment' as const,
                                                    hireDate: app.appliedAt,
                                                };

                                                return (
                                                    <div
                                                        key={app.id}
                                                        className={cn(
                                                            "cursor-pointer rounded-2xl transition-all",
                                                            isAppRejected && "ring-2 ring-red-200 opacity-75 hover:opacity-100",
                                                            isAppHired && "ring-2 ring-emerald-200",
                                                        )}
                                                        onClick={() => router.push(`/dashboard/recruitment/applications/${app.id}`)}
                                                    >
                                                        <EmployeeCard
                                                            employee={emp}
                                                            variant="detailed"
                                                            asLink={false}
                                                            showQuestionnaireAction={false}
                                                            showProgressRing={false}
                                                            footer={
                                                                <div className="flex items-center justify-between w-full">
                                                                    {isAppRejected ? (
                                                                        <Badge variant="outline" className="bg-red-50 font-medium text-red-600 border-red-200 text-[10px] gap-1">
                                                                            <X className="h-2.5 w-2.5" /> Татгалзсан
                                                                        </Badge>
                                                                    ) : isAppHired ? (
                                                                        <Badge variant="outline" className="bg-emerald-50 font-medium text-emerald-600 border-emerald-200 text-[10px] gap-1">
                                                                            <CheckCircle2 className="h-2.5 w-2.5" /> Ажилд авсан
                                                                        </Badge>
                                                                    ) : (
                                                                        <Badge variant="outline" className="bg-white font-medium text-slate-600 text-[10px]">
                                                                            {app.stageName}
                                                                        </Badge>
                                                                    )}
                                                                    <span className="text-[10px] text-muted-foreground">
                                                                        {format(new Date(app.appliedAt), 'yyyy-MM-dd')}
                                                                    </span>
                                                                </div>
                                                            }
                                                        />
                                                    </div>
                                                );
                                            };

                                            return (
                                                <div className="space-y-6">
                                                    {activeCandidates.length > 0 && (
                                                        <div>
                                                            <div className="flex items-center gap-2 mb-3">
                                                                <h3 className="text-sm font-semibold text-slate-700">Идэвхтэй</h3>
                                                                <Badge variant="secondary" className="text-[10px] h-5">{activeCandidates.length}</Badge>
                                                            </div>
                                                            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                                                                {activeCandidates.map(renderCandidateCard)}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {hiredCandidates.length > 0 && (
                                                        <div>
                                                            <div className="flex items-center gap-2 mb-3">
                                                                <div className="h-2 w-2 rounded-full bg-emerald-500" />
                                                                <h3 className="text-sm font-semibold text-emerald-700">Ажилд авсан</h3>
                                                                <Badge variant="secondary" className="text-[10px] h-5 bg-emerald-50 text-emerald-700">{hiredCandidates.length}</Badge>
                                                            </div>
                                                            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                                                                {hiredCandidates.map(renderCandidateCard)}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {rejectedCandidates.length > 0 && (
                                                        <div>
                                                            <div className="flex items-center gap-2 mb-3">
                                                                <div className="h-2 w-2 rounded-full bg-red-500" />
                                                                <h3 className="text-sm font-semibold text-red-600">Татгалзсан</h3>
                                                                <Badge variant="secondary" className="text-[10px] h-5 bg-red-50 text-red-600">{rejectedCandidates.length}</Badge>
                                                            </div>
                                                            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                                                                {rejectedCandidates.map(renderCandidateCard)}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })()}
                                    </TabsContent>

                                    <TabsContent value="pipeline" className="mt-0">
                                        <PipelineBoard vacancyId={vacancyId as string} />
                                    </TabsContent>
                                </div>
                            </div>
                        </div>
                    </div>
                </Tabs>
            </div>

            <EditVacancyDialog
                open={editOpen}
                onOpenChange={setEditOpen}
                vacancy={vacancy}
                vacancyId={vacancyId as string}
                storage={storage}
                saving={saving}
                onSave={handleSaveVacancy}
                    onDelete={handleDeleteVacancy}
            />
        </div>
    );
}
