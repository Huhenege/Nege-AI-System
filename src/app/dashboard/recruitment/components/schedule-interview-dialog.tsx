'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
    AppDialog,
    AppDialogContent,
    AppDialogDescription,
    AppDialogFooter,
    AppDialogHeader,
    AppDialogTitle,
    AppDialogTrigger,
} from '@/components/patterns';
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Loader2, CalendarIcon, Plus, DoorOpen, AlertTriangle } from 'lucide-react';
import { useFirebase, addDocumentNonBlocking, useCollection, useFetchCollection, useMemoFirebase, tenantCollection, useTenantWrite } from '@/firebase';
import { query, where, getDocs, addDoc, updateDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Interview, Vacancy, Candidate, JobApplication } from '@/types/recruitment';
import { MeetingRoom, RoomBooking } from '@/types/meeting';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Check, Search, X } from 'lucide-react';
import { Employee } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

const interviewSchema = z.object({
    title: z.string().min(2, 'Гарчиг оруулна уу'),
    vacancyId: z.string().min(1, 'Ажлын байр сонгоно уу'),
    applicationId: z.string().optional(),
    candidateId: z.string().optional(),
    candidateName: z.string().min(2, 'Горилогчийн нэр'),
    date: z.date({ required_error: "Огноо сонгоно уу" }),
    startTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Цаг (HH:mm) форматтай оруулна уу"),
    endTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Цаг (HH:mm) форматтай оруулна уу"),
    roomId: z.string().optional(),
    location: z.string().optional(),
    interviewers: z.array(z.string()).optional(),
});

type InterviewFormValues = z.infer<typeof interviewSchema>;

export function ScheduleInterviewDialog({
    children,
    preselectedDate,
    vacancyId: initialVacancyId,
    applicationId,
    candidate,
    vacancy,
    onScheduled,
    interview: initialInterview,
    open: controlledOpen,
    onOpenChange: controlledOnOpenChange,
    onUpdated,
}: {
    children?: React.ReactNode,
    preselectedDate?: Date,
    vacancyId?: string,
    applicationId?: string,
    candidate?: Candidate,
    vacancy?: Vacancy,
    onScheduled?: (interview: Interview) => void,
    /** Засах горим: өмнөх ярилцлагын өгөгдөл */
    interview?: Interview | null,
    /** Контроллогдсон: цонхыг гаднаас нээх/хаах */
    open?: boolean,
    onOpenChange?: (open: boolean) => void,
    onUpdated?: (interview: Interview) => void,
}) {
    const [internalOpen, setInternalOpen] = useState(false);
    const isControlled = controlledOpen !== undefined;
    const open = isControlled ? controlledOpen : internalOpen;
    const setOpen = isControlled ? (controlledOnOpenChange ?? (() => {})) : setInternalOpen;
    const isEditMode = !!initialInterview;
    const { firestore, user } = useFirebase();
    const { tDoc, tCollection } = useTenantWrite();
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(false);
    const [selectedInterviewerIds, setSelectedInterviewerIds] = useState<string[]>([]);
    const [searchTerm, setSearchTerm] = useState('');

    // Fetch vacancies to select from
    const vacanciesQuery = useMemoFirebase(
        ({ firestore, companyPath }) => (firestore ? query(tenantCollection(firestore, companyPath, 'vacancies'), where('status', '==', 'OPEN')) : null),
        [firestore]
    );
    const { data: vacancies } = useFetchCollection<Vacancy>(vacanciesQuery as any);

    // Legacy: all candidates (used when candidate is preselected from application page)
    const candidatesQuery = useMemoFirebase(
        ({ firestore, companyPath }) => (firestore ? tenantCollection(firestore, companyPath, 'candidates') : null),
        [firestore]
    );
    const { data: candidates } = useFetchCollection<Candidate>(candidatesQuery as any);

    // Fetch active employees for interviewers
    const employeesQuery = useMemoFirebase(
        ({ firestore, companyPath }) => (firestore ? query(tenantCollection(firestore, companyPath, 'employees'), where('status', 'in', ['active', 'active_probation', 'active_permanent'])) : null),
        [firestore]
    );
    const { data: employees } = useFetchCollection<Employee>(employeesQuery as any);

    // Fetch meeting rooms
    const roomsQuery = useMemoFirebase(
        ({ firestore, companyPath }) => (firestore ? tenantCollection(firestore, companyPath, 'meeting_rooms') : null),
        [firestore]
    );
    const { data: meetingRooms } = useFetchCollection<MeetingRoom>(roomsQuery as any);
    const activeRooms = useMemo(() => meetingRooms?.filter(r => r.isActive) || [], [meetingRooms]);

    const filteredEmployees = employees?.filter(emp =>
        `${emp.lastName} ${emp.firstName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (emp.employeeCode || '').toLowerCase().includes(searchTerm.toLowerCase())
    ).slice(0, 5);

    const form = useForm<InterviewFormValues>({
        resolver: zodResolver(interviewSchema),
        defaultValues: {
            title: 'Ярилцлага',
            vacancyId: vacancy?.id || initialVacancyId || '',
            applicationId: applicationId || '',
            candidateId: candidate?.id || '',
            candidateName: candidate ? `${candidate.lastName}. ${candidate.firstName}` : '',
            date: preselectedDate || new Date(),
            startTime: '10:00',
            endTime: '11:00',
            roomId: '',
            location: '',
        },
    });

    const watchedVacancyId = form.watch('vacancyId');

    // Fetch applications for selected vacancy (бүртгэлтэй горилогчид)
    const applicationsQuery = useMemoFirebase(
        ({ firestore, companyPath }) => (firestore && watchedVacancyId
            ? query(tenantCollection(firestore, companyPath, 'applications'), where('vacancyId', '==', watchedVacancyId))
            : null),
        [firestore, watchedVacancyId]
    );
    const { data: applicationsForVacancy } = useFetchCollection<JobApplication>(applicationsQuery as any);

    const candidatesForVacancy = useMemo(() => {
        if (!applicationsForVacancy) return [];
        return applicationsForVacancy
            .filter(app => app.status === 'ACTIVE' || app.status === 'HIRED')
            .map(app => ({
                applicationId: app.id,
                candidateId: app.candidateId,
                candidateName: app.candidate
                    ? `${app.candidate.lastName || ''} ${app.candidate.firstName || ''}`.trim() || app.candidateId
                    : app.candidateId,
            }))
            .filter(c => c.candidateId);
    }, [applicationsForVacancy]);

    // Watch form fields for room overlap checking
    const watchedDate = form.watch('date');
    const selectedDateStr = watchedDate ? format(watchedDate, 'yyyy-MM-dd') : '';
    const watchedRoomId = form.watch('roomId');
    const watchedStartTime = form.watch('startTime');
    const watchedEndTime = form.watch('endTime');

    // Fetch bookings for selected date to check overlaps
    const bookingsQuery = useMemoFirebase(
        ({ firestore, companyPath }) => (firestore && selectedDateStr ? query(tenantCollection(firestore, companyPath, 'room_bookings'), where('date', '==', selectedDateStr), where('status', '==', 'active')) : null),
        [firestore, selectedDateStr]
    );
    const { data: existingBookings } = useCollection<RoomBooking>(bookingsQuery as any);

    // Check for room overlap
    const roomOverlaps = useMemo(() => {
        if (!watchedRoomId || watchedRoomId === 'none' || !selectedDateStr || !watchedStartTime || !watchedEndTime || !existingBookings) return [];
        return existingBookings.filter(b => {
            if (b.roomId !== watchedRoomId) return false;
            return watchedStartTime < b.endTime && watchedEndTime > b.startTime;
        });
    }, [watchedRoomId, selectedDateStr, watchedStartTime, watchedEndTime, existingBookings]);

    // Update form when candidate/vacancy changes
    useEffect(() => {
        if (candidate) {
            form.setValue('candidateId', candidate.id);
            form.setValue('candidateName', `${candidate.lastName}. ${candidate.firstName}`);
        }
        if (vacancy) {
            form.setValue('vacancyId', vacancy.id);
        }
        if (applicationId) {
            form.setValue('applicationId', applicationId);
        }
    }, [candidate, vacancy, applicationId, form]);

    // Засах горим: ярилцлагын өгөгдлөөр form бөглөх
    useEffect(() => {
        if (!open || !initialInterview) return;
        const i = initialInterview;
        const start = new Date(i.startTime);
        const end = new Date(i.endTime);
        form.reset({
            title: i.title,
            vacancyId: i.vacancyId,
            applicationId: i.applicationId || '',
            candidateId: i.candidateId || '',
            candidateName: i.candidateName || '',
            date: start,
            startTime: format(start, 'HH:mm'),
            endTime: format(end, 'HH:mm'),
            roomId: '',
            location: i.location || '',
        });
        setSelectedInterviewerIds(i.interviewerIds?.length ? [...i.interviewerIds] : []);
    }, [open, initialInterview, form]);

    // When vacancy changes, clear candidate selection so user picks from new list
    const vacancyField = form.watch('vacancyId');
    useEffect(() => {
        if (!candidate && !applicationId) {
            form.setValue('applicationId', '');
            form.setValue('candidateId', '');
            form.setValue('candidateName', '');
        }
    }, [vacancyField]);

    const onSubmit = async (data: InterviewFormValues) => {
        if (!firestore) return;
        if (roomOverlaps.length > 0) {
            toast({ title: 'Өрөөний давхцал байна', description: 'Өөр цаг эсвэл өрөө сонгоно уу.', variant: 'destructive' });
            return;
        }
        if (data.roomId === 'none') data.roomId = '';
        setIsLoading(true);

        try {
            // Combine date and time
            const startDateTime = new Date(data.date);
            const [startHour, startMinute] = data.startTime.split(':').map(Number);
            startDateTime.setHours(startHour, startMinute);

            const endDateTime = new Date(data.date);
            const [endHour, endMinute] = data.endTime.split(':').map(Number);
            endDateTime.setHours(endHour, endMinute);

            const selectedVacancy = vacancy || vacancies?.find(v => v.id === data.vacancyId);

            const selectedRoom = data.roomId ? activeRooms.find(r => r.id === data.roomId) : null;
            const locationText = selectedRoom ? selectedRoom.name : (data.location || 'Online');

            const interviewPayload = {
                title: data.title,
                vacancyId: data.vacancyId,
                vacancyTitle: selectedVacancy?.title || 'Unknown',
                candidateId: data.candidateId || (initialInterview?.candidateId ?? ''),
                candidateName: data.candidateName,
                startTime: startDateTime.toISOString(),
                endTime: endDateTime.toISOString(),
                location: locationText,
                status: 'SCHEDULED' as const,
                interviewerIds: selectedInterviewerIds.length > 0 ? selectedInterviewerIds : (user ? [user.uid] : []),
                applicationId: data.applicationId || applicationId || initialInterview?.applicationId || '',
            };

            if (isEditMode && initialInterview?.id) {
                await updateDoc(tDoc('interviews', initialInterview.id), interviewPayload);
                if (onUpdated) {
                    onUpdated({ id: initialInterview.id, ...interviewPayload } as Interview);
                }
                toast({
                    title: 'Ярилцлага шинэчлэгдлээ',
                    description: `${format(startDateTime, 'yyyy-MM-dd HH:mm')} цагт.`,
                });
            } else {
                const newInterviewData: Omit<Interview, 'id'> = interviewPayload;
                const docRef = await addDoc(tCollection('interviews'), newInterviewData);

                if (selectedRoom) {
                    await addDoc(tCollection('room_bookings'), {
                        roomId: selectedRoom.id,
                        roomName: selectedRoom.name,
                        title: `Ярилцлага: ${data.candidateName}`,
                        description: `${selectedVacancy?.title || ''} - ${data.title}`,
                        date: format(data.date, 'yyyy-MM-dd'),
                        startTime: data.startTime,
                        endTime: data.endTime,
                        organizer: user?.uid || '',
                        organizerName: user?.displayName || '',
                        attendees: selectedInterviewerIds,
                        status: 'active',
                        createdAt: new Date().toISOString(),
                    });
                }

                if (onScheduled) {
                    onScheduled({ id: docRef.id, ...newInterviewData } as Interview);
                }

                toast({
                    title: 'Ярилцлага товлогдлоо',
                    description: `${format(startDateTime, 'yyyy-MM-dd HH:mm')} цагт.`,
                });
            }

            setOpen(false);
            form.reset();
        } catch (error) {
            console.error(error);
            toast({
                title: 'Алдаа гарлаа',
                description: 'Хадгалж чадсангүй.',
                variant: 'destructive',
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleCandidateSelect = (candidateId: string) => {
        const c = candidates?.find(item => item.id === candidateId);
        if (c) {
            form.setValue('candidateId', c.id);
            form.setValue('candidateName', `${c.lastName.charAt(0)}.${c.firstName}`);
        }
    };

    return (
        <AppDialog open={open} onOpenChange={setOpen}>
            {!isControlled && (
                <AppDialogTrigger asChild>
                    {children || (
                        <Button className="gap-2">
                            <Plus className="h-4 w-4" />
                            Ярилцлага товлох
                        </Button>
                    )}
                </AppDialogTrigger>
            )}
            <AppDialogContent size="md" className="p-0 overflow-hidden">
                <AppDialogHeader className="px-6 pt-6">
                    <AppDialogTitle>{isEditMode ? 'Ярилцлага засах' : 'Ярилцлага товлох'}</AppDialogTitle>
                    <AppDialogDescription>
                        {isEditMode ? 'Ярилцлагын цаг, байршил зэргийг засна.' : 'Горилогчтой уулзах цагийг календарь дээр тэмдэглэх.'}
                    </AppDialogDescription>
                </AppDialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 px-6 py-4">
                        <FormField
                            control={form.control}
                            name="title"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Гарчиг</FormLabel>
                                    <FormControl>
                                        <Input {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="vacancyId"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Ажлын байр</FormLabel>
                                        {!(vacancy?.id || initialVacancyId) ? (
                                            <Select value={field.value} onValueChange={(v) => { field.onChange(v); form.setValue('applicationId', ''); form.setValue('candidateId', ''); form.setValue('candidateName', ''); }}>
                                                <FormControl>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Ажлын байр сонгох" />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    {vacancies?.map((v) => (
                                                        <SelectItem key={v.id} value={v.id}>
                                                            {v.title}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        ) : (
                                            <Input value={vacancy?.title || vacancies?.find(v => v.id === initialVacancyId)?.title || '...'} disabled className="bg-slate-50" />
                                        )}
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="candidateName"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Горилогч</FormLabel>
                                        {candidate ? (
                                            <FormControl>
                                                <Input value={field.value} disabled className="bg-slate-50" />
                                            </FormControl>
                                        ) : watchedVacancyId ? (
                                            <Select
                                                value={form.watch('applicationId') || ''}
                                                onValueChange={(applicationIdVal) => {
                                                    const item = candidatesForVacancy.find(c => c.applicationId === applicationIdVal);
                                                    if (item) {
                                                        form.setValue('applicationId', item.applicationId);
                                                        form.setValue('candidateId', item.candidateId);
                                                        form.setValue('candidateName', item.candidateName);
                                                    }
                                                }}
                                            >
                                                <FormControl>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder={candidatesForVacancy.length === 0 ? 'Горилогч олдсонгүй' : 'Горилогч сонгох'} />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    {candidatesForVacancy.map((c) => (
                                                        <SelectItem key={c.applicationId} value={c.applicationId}>
                                                            {c.candidateName}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        ) : (
                                            <Input placeholder="Эхлээд ажлын байр сонгоно уу" disabled className="bg-slate-50" />
                                        )}
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="date"
                                render={({ field }) => (
                                    <FormItem className="flex flex-col">
                                        <FormLabel>Огноо</FormLabel>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <FormControl>
                                                    <Button
                                                        variant={"outline"}
                                                        className={cn(
                                                            "w-full pl-3 text-left font-normal",
                                                            !field.value && "text-muted-foreground"
                                                        )}
                                                    >
                                                        {field.value ? (
                                                            format(field.value, "PPP")
                                                        ) : (
                                                            <span>Огноо сонгох</span>
                                                        )}
                                                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                                    </Button>
                                                </FormControl>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0" align="start">
                                                <Calendar
                                                    mode="single"
                                                    selected={field.value}
                                                    onSelect={field.onChange}
                                                    disabled={(date) =>
                                                        date < new Date(new Date().setHours(0, 0, 0, 0))
                                                    }
                                                    initialFocus
                                                />
                                            </PopoverContent>
                                        </Popover>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <div className="flex gap-2">
                                <FormField
                                    control={form.control}
                                    name="startTime"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Эхлэх</FormLabel>
                                            <FormControl>
                                                <Input type="time" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="endTime"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Дуусах</FormLabel>
                                            <FormControl>
                                                <Input type="time" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                        </div>

                        {/* Room Booking */}
                        {activeRooms.length > 0 && (
                            <FormField
                                control={form.control}
                                name="roomId"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="flex items-center gap-1.5">
                                            <DoorOpen className="h-3.5 w-3.5" />
                                            Уулзалтын өрөө (Заавал биш)
                                        </FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Өрөө сонгох..." />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="none">Өрөө сонгохгүй</SelectItem>
                                                {activeRooms.map((room) => (
                                                    <SelectItem key={room.id} value={room.id}>
                                                        <span className="flex items-center gap-2">
                                                            <span className="inline-block h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: room.color }} />
                                                            {room.name}
                                                            <span className="text-muted-foreground text-xs">({room.capacity} хүн)</span>
                                                        </span>
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        )}

                        {/* Room overlap warning */}
                        {roomOverlaps.length > 0 && (
                            <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                                <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                                <div className="text-sm text-destructive">
                                    <p className="font-medium">Өрөөний давхцал байна!</p>
                                    {roomOverlaps.map(o => (
                                        <p key={o.id} className="text-xs mt-1">
                                            {o.title} ({o.startTime}–{o.endTime})
                                        </p>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="space-y-3">
                            <FormLabel>Ярилцагчид сонгох</FormLabel>
                            <div className="flex flex-wrap gap-2 mb-2">
                                {selectedInterviewerIds.map(id => {
                                    const emp = employees?.find(e => e.id === id);
                                    if (!emp) return null;
                                    return (
                                        <Badge key={id} variant="secondary" className="gap-1 pr-1 py-1">
                                            {emp.lastName.charAt(0)}.{emp.firstName}
                                            <button
                                                type="button"
                                                onClick={() => setSelectedInterviewerIds(prev => prev.filter(i => i !== id))}
                                                className="hover:text-red-500"
                                            >
                                                <X className="h-3 w-3" />
                                            </button>
                                        </Badge>
                                    );
                                })}
                                {selectedInterviewerIds.length === 0 && (
                                    <span className="text-xs text-muted-foreground italic">Одоогоор сонгоогүй байна (Та өөрөө орно)</span>
                                )}
                            </div>

                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" size="sm" className="w-full justify-start gap-2 h-9 text-slate-500 font-normal">
                                        <Search className="h-4 w-4" />
                                        Ажилтан хайх...
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[450px] p-0" align="start">
                                    <div className="p-2 border-b">
                                        <Input
                                            placeholder="Нэр эсвэл кодоор хайх..."
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            className="h-8 text-sm"
                                        />
                                    </div>
                                    <div className="max-h-[200px] overflow-y-auto p-1">
                                        {filteredEmployees?.length === 0 ? (
                                            <div className="p-4 text-center text-xs text-muted-foreground">Ажилтан олдсонгүй</div>
                                        ) : (
                                            filteredEmployees?.map(emp => (
                                                <div
                                                    key={emp.id}
                                                    className={cn(
                                                        "flex items-center justify-between p-2 hover:bg-slate-50 rounded-md cursor-pointer transition-colors",
                                                        selectedInterviewerIds.includes(emp.id) && "bg-blue-50/50"
                                                    )}
                                                    onClick={() => {
                                                        if (selectedInterviewerIds.includes(emp.id)) {
                                                            setSelectedInterviewerIds(prev => prev.filter(i => i !== emp.id));
                                                        } else {
                                                            setSelectedInterviewerIds(prev => [...prev, emp.id]);
                                                        }
                                                    }}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <Avatar className="h-7 w-7">
                                                            <AvatarFallback className="text-[10px]">{emp.firstName.charAt(0)}</AvatarFallback>
                                                        </Avatar>
                                                        <div className="flex flex-col">
                                                            <span className="text-xs font-medium">{emp.lastName} {emp.firstName}</span>
                                                            <span className="text-[10px] text-muted-foreground">{emp.jobTitle}</span>
                                                        </div>
                                                    </div>
                                                    {selectedInterviewerIds.includes(emp.id) && <Check className="h-4 w-4 text-blue-500" />}
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </PopoverContent>
                            </Popover>
                        </div>

                        <AppDialogFooter className="px-0 py-0 border-t-0 bg-transparent">
                            <Button type="submit" disabled={isLoading}>
                                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                {isEditMode ? 'Хадгалах' : 'Товлох'}
                            </Button>
                        </AppDialogFooter>
                    </form>
                </Form>
            </AppDialogContent>
        </AppDialog>
    );
}
