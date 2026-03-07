'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { sendNotification } from '@/lib/notifications';
import { useToast } from '@/hooks/use-toast';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragOverlay,
    defaultDropAnimationSideEffects,
    DropAnimation,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useCollection, useFirebase, useMemoFirebase, tenantCollection, useTenantWrite } from '@/firebase';
import { query, where, updateDoc, orderBy, getDoc } from 'firebase/firestore';
import { JobApplication, Vacancy, RecruitmentStage } from '@/types/recruitment';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, ExternalLink, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { formatDistanceToNow } from 'date-fns';
import { mn } from 'date-fns/locale';
import { AddCandidateDialog } from './add-candidate-dialog';

const DEFAULT_STAGES: RecruitmentStage[] = [
    { id: 'screening', title: 'Анкет шүүлт', type: 'SCREENING', order: 0 },
    { id: 'first-interview', title: 'Анхан шатны ярилцлага', type: 'INTERVIEW', order: 1 },
    { id: 'tech-task', title: 'Даалгавар', type: 'CHALLENGE', order: 2 },
    { id: 'final-interview', title: 'Эцсийн ярилцлага', type: 'INTERVIEW', order: 3 },
    { id: 'offer', title: 'Санал тавих', type: 'OFFER', order: 4 },
];

interface SortableItemProps {
    id: string;
    application: JobApplication;
    onSelect: (app: JobApplication) => void;
    onViewDetails: (app: JobApplication) => void;
}

function SortableItem({ id, application, onSelect, onViewDetails }: SortableItemProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };

    const handleViewDetails = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        onViewDetails(application);
    };

    const handleSelect = (e: React.MouseEvent) => {
        onSelect(application);
    };

    return (
        <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="mb-2 group">
            <Card className="cursor-grab hover:shadow-md transition-shadow relative" onClick={handleSelect}>
                <CardContent className="p-3">
                    <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                            <Avatar className="h-8 w-8">
                                <AvatarImage src={application.candidate?.resumeUrl} />
                                <AvatarFallback>{application.candidate?.firstName?.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <div>
                                <h4 className="text-sm font-semibold leading-none">{application.candidate?.lastName} {application.candidate?.firstName}</h4>
                                <p className="text-xs text-muted-foreground mt-1">
                                    {formatDistanceToNow(new Date(application.appliedAt), { addSuffix: true, locale: mn })}
                                </p>
                            </div>
                        </div>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={handleViewDetails}
                        >
                            <ExternalLink className="h-3.5 w-3.5" />
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

function Column({
    stage,
    applications,
    onSelectApplication,
    onViewDetails,
    variant = 'default',
}: {
    stage: RecruitmentStage,
    applications: JobApplication[],
    onSelectApplication: (app: JobApplication) => void,
    onViewDetails: (app: JobApplication) => void,
    variant?: 'default' | 'rejected' | 'hired',
}) {
    const { setNodeRef } = useSortable({
        id: stage.id,
        data: {
            type: 'Column',
            stage,
        },
    });

    return (
        <div className={cn(
            "flex flex-col h-full w-[280px] shrink-0 rounded-lg p-2 border",
            variant === 'rejected' ? "bg-red-50/50 border-red-200" :
                variant === 'hired' ? "bg-emerald-50/50 border-emerald-200" :
                    "bg-muted/30"
        )}>
            <div className="flex items-center justify-between mb-3 px-1">
                <div className="flex items-center gap-2">
                    {variant === 'rejected' && <X className="h-3.5 w-3.5 text-red-500" />}
                    <h3 className={cn(
                        "font-semibold text-sm",
                        variant === 'rejected' && "text-red-700",
                        variant === 'hired' && "text-emerald-700",
                    )}>{stage.title}</h3>
                    <Badge variant="secondary" className={cn(
                        "text-xs px-1.5 h-5 min-w-[20px] justify-center",
                        variant === 'rejected' && "bg-red-100 text-red-600",
                        variant === 'hired' && "bg-emerald-100 text-emerald-600",
                    )}>
                        {applications.length}
                    </Badge>
                </div>
            </div>

            <SortableContext
                id={stage.id}
                items={applications.map(app => app.id)}
                strategy={verticalListSortingStrategy}
            >
                <div ref={setNodeRef} className="flex-1 overflow-y-auto min-h-[100px]">
                    {applications.map((app) => (
                        <SortableItem
                            key={app.id}
                            id={app.id}
                            application={app}
                            onSelect={onSelectApplication}
                            onViewDetails={onViewDetails}
                        />
                    ))}
                </div>
            </SortableContext>
        </div>
    );
}

export function PipelineBoard({ vacancyId: initialVacancyId }: { vacancyId?: string }) {
    const { firestore } = useFirebase();
    const { tDoc } = useTenantWrite();
    const { toast } = useToast();
    const router = useRouter();
    const [selectedVacancyId, setSelectedVacancyId] = useState<string>(initialVacancyId || '');
    const [activeId, setActiveId] = useState<string | null>(null);
    const [globalStages, setGlobalStages] = useState<RecruitmentStage[]>(DEFAULT_STAGES);
    const [isLoadingStages, setIsLoadingStages] = useState(true);

    useEffect(() => {
        if (initialVacancyId) {
            setSelectedVacancyId(initialVacancyId);
        }
    }, [initialVacancyId]);

    // Fetch global stages
    useEffect(() => {
        const fetchGlobalStages = async () => {
            if (!firestore) return;
            try {
                const docRef = tDoc('recruitment_settings', 'default');
                const docSnap = await getDoc(docRef);
                if (docSnap.exists() && docSnap.data().defaultStages) {
                    setGlobalStages(docSnap.data().defaultStages as RecruitmentStage[]);
                } else {
                    setGlobalStages(DEFAULT_STAGES);
                }
            } catch (error) {
                console.error("Failed to fetch global stages:", error);
                setGlobalStages(DEFAULT_STAGES);
            } finally {
                setIsLoadingStages(false);
            }
        };
        fetchGlobalStages();
    }, [firestore]);

    // Fetch vacancies
    const vacanciesQuery = useMemoFirebase(
        ({ firestore, companyPath }) => (firestore ? query(tenantCollection(firestore, companyPath, 'vacancies'), where('status', '==', 'OPEN')) : null),
        [firestore]
    );
    const { data: vacancies } = useCollection<Vacancy>(vacanciesQuery as any);

    useEffect(() => {
        if (vacancies && vacancies.length > 0 && !selectedVacancyId) {
            setSelectedVacancyId(vacancies[0].id);
        }
    }, [vacancies, selectedVacancyId]);

    const selectedVacancy = vacancies?.find(v => v.id === selectedVacancyId);
    const stages = initialVacancyId ? globalStages : (selectedVacancy?.stages || globalStages);

    // Fetch applications for selected vacancy
    const applicationsQuery = useMemoFirebase(
        ({ firestore, companyPath }) => (firestore && selectedVacancyId ?
            query(tenantCollection(firestore, companyPath, 'applications'), where('vacancyId', '==', selectedVacancyId))
            : null),
        [firestore, selectedVacancyId]
    );
    const { data: applications } = useCollection<JobApplication>(applicationsQuery as any);

    // Mock data for candidates since we don't have real "joins" in Firestore easily
    // In a real app, we would fetch candidates based on IDs or store critical data on the application doc.
    // For now, let's assume application doc has the candidate info denormalized or we rely on what's there.
    // Our type def has `candidate?` but it won't be in Firestore data by default without join.
    // Let's patch it with some fake data if missing for UI demo
    const enrichedApplications = applications?.map(app => ({
        ...app,
        candidate: app.candidate || { firstName: 'Бат', lastName: 'Дорж', id: '123' }
    })) as JobApplication[];

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleDragStart = (event: any) => {
        setActiveId(event.active.id);
    };

    const handleDragEnd = async (event: any) => {
        const { active, over } = event;

        if (!over) {
            setActiveId(null);
            return;
        }

        const activeAppId = active.id;
        const overId = over.id;

        // Find the application
        const activeApp = applications?.find(app => app.id === activeAppId);
        if (!activeApp) return;

        // Find sortable container (column) id
        // In dnd-kit sortable, the over.id might be the item id OR the container id if empty
        let newStageId = overId;

        // If dropping on another item, find its container (stage)
        const overApp = applications?.find(app => app.id === overId);
        if (overApp) {
            newStageId = overApp.currentStageId;
        }

        if (activeApp.currentStageId !== newStageId) {
            // Update local state optimistic
            // (Skipping complex local reorder logic for brevity, just updating stage)

            // Update Firestore
            if (firestore) {
                try {
                    const appRef = tDoc('applications', activeAppId);
                    await updateDoc(appRef, { currentStageId: newStageId });

                    // Send Notification
                    if (activeApp.candidate) {
                        const newStageName = stages?.find(s => s.id === newStageId)?.title || newStageId;

                        sendNotification(
                            activeApp.candidate,
                            'STAGE_CHANGE',
                            {
                                stageId: newStageId,
                                stageName: newStageName,
                                vacancyTitle: selectedVacancy?.title
                            }
                        ).then(() => {
                            toast({
                                title: "Мэдэгдэл илгээгдлээ",
                                description: `${activeApp.candidate?.email} руу статус өөрчлөлтийн имэйл илгээлээ.`,
                            });
                        });
                    }
                } catch (e) {
                    console.error("Failed to move application", e);
                }
            }
        }

        setActiveId(null);
    };

    const REJECTED_STAGE: RecruitmentStage = { id: 'rejected', title: 'Татгалзсан', type: 'REJECTED', order: 998 };
    const HIRED_STAGE: RecruitmentStage = { id: 'hired', title: 'Ажилд авсан', type: 'HIRED', order: 999 };

    // Group applications by stage, plus rejected/hired columns (dedupe by app.id per column)
    const pipelineStages = [...(stages || []), HIRED_STAGE, REJECTED_STAGE];
    const columns = pipelineStages.map(stage => {
        let stageApps: JobApplication[];
        if (stage.id === 'rejected') {
            stageApps = enrichedApplications?.filter(app => app.status === 'REJECTED') || [];
        } else if (stage.id === 'hired') {
            stageApps = enrichedApplications?.filter(app => app.status === 'HIRED') || [];
        } else {
            stageApps = enrichedApplications?.filter(app => app.currentStageId === stage.id && app.status === 'ACTIVE') || [];
        }
        stageApps = stageApps.filter((app, i, arr) => arr.findIndex(a => a.id === app.id) === i);
        return {
            stage,
            applications: stageApps,
            variant: stage.id === 'rejected' ? 'rejected' as const : stage.id === 'hired' ? 'hired' as const : 'default' as const,
        };
    });

    const activeApp = enrichedApplications?.find(app => app.id === activeId);

    const dropAnimation: DropAnimation = {
        sideEffects: defaultDropAnimationSideEffects({
            styles: {
                active: {
                    opacity: '0.5',
                },
            },
        }),
    };

    if (isLoadingStages) {
        return (
            <div className="h-[400px] flex flex-col items-center justify-center gap-4">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground font-medium">Процесс ачаалж байна...</p>
            </div>
        );
    }

    if (!selectedVacancy && !initialVacancyId) {
        return (
            <div className="h-[600px] flex items-center justify-center border rounded-lg border-dashed">
                <div className="text-center space-y-2">
                    <p className="text-muted-foreground">Идэвхтэй ажлын байр олдсонгүй.</p>
                    <p className="text-xs text-muted-foreground">Эхлээд "Ажлын байр" цэснээс шинэ зар үүсгэнэ үү.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full space-y-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    {!initialVacancyId && (
                        <div className="w-[300px]">
                            <Select value={selectedVacancyId} onValueChange={setSelectedVacancyId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Ажлын байр сонгох" />
                                </SelectTrigger>
                                <SelectContent>
                                    {vacancies?.map((v) => (
                                        <SelectItem key={v.id} value={v.id}>
                                            {v.title}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}
                    {selectedVacancy && <AddCandidateDialog vacancy={selectedVacancy} />}
                </div>
                <div className="text-sm text-muted-foreground">
                    Нийт {enrichedApplications?.length || 0} горилогч
                </div>
            </div>

            <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
            >
                <div className="flex flex-1 gap-4 overflow-x-auto pb-4 items-start h-full">
                    {columns?.map((col) => (
                        <Column
                            key={col.stage.id}
                            stage={col.stage}
                            applications={col.applications}
                            variant={col.variant}
                            onSelectApplication={(app) => {
                                router.push(`/dashboard/recruitment/applications/${app.id}`);
                            }}
                            onViewDetails={(app) => {
                                router.push(`/dashboard/recruitment/applications/${app.id}`);
                            }}
                        />
                    ))}
                </div>

                <DragOverlay dropAnimation={dropAnimation}>
                    {activeId && activeApp ? (
                        <Card className="cursor-grabbing shadow-xl w-[250px] rotate-2">
                            <CardContent className="p-3">
                                <div className="flex items-start gap-2">
                                    <Avatar className="h-8 w-8">
                                        <AvatarFallback>{activeApp.candidate?.firstName?.charAt(0)}</AvatarFallback>
                                    </Avatar>
                                    <div>
                                        <h4 className="text-sm font-semibold leading-none">{activeApp.candidate?.lastName} {activeApp.candidate?.firstName}</h4>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ) : null}
                </DragOverlay>
            </DndContext>

        </div>
    );
}
