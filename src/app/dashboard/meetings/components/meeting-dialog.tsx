'use client';

import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
    AlertTriangle,
    CalendarPlus,
    DoorOpen,
    Link2,
    MapPin,
    Users,
    X,
    Star,
} from 'lucide-react';
import type { MeetingRoom, Meeting, MeetingType, MeetingAttendee } from '@/types/meeting';
import { TIME_SLOTS, MEETING_TYPE_LABELS } from '@/types/meeting';
import type { Employee } from '@/types';

const MEETING_TYPE_OPTIONS: { value: MeetingType; label: string; icon: string }[] = [
    { value: 'one_on_one', label: '1:1 уулзалт', icon: '👤' },
    { value: 'team', label: 'Багийн уулзалт', icon: '👥' },
    { value: 'department', label: 'Алба хорооны', icon: '🏢' },
    { value: 'standup', label: 'Standup', icon: '⚡' },
    { value: 'review', label: 'Тойм уулзалт', icon: '📋' },
    { value: 'external', label: 'Гадны уулзалт', icon: '🌐' },
    { value: 'other', label: 'Бусад', icon: '📌' },
];

export interface MeetingDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    rooms: MeetingRoom[];
    employees: Employee[];
    existingMeetings: Meeting[];
    onSave: (meeting: Omit<Meeting, 'id' | 'createdAt'>) => Promise<void>;
    defaultDate?: string;
    defaultStartTime?: string;
    defaultRoomId?: string;
    defaultTitle?: string;
    defaultDescription?: string;
    defaultOrganizer?: string;
    defaultOrganizerName?: string;
    editMeeting?: Meeting | null;
    onCancel?: (meetingId: string, reason?: string) => Promise<void>;
}

export function MeetingDialog({
    open,
    onOpenChange,
    rooms,
    employees,
    existingMeetings,
    onSave,
    defaultDate,
    defaultStartTime,
    defaultRoomId,
    defaultTitle,
    defaultDescription,
    defaultOrganizer,
    defaultOrganizerName,
    editMeeting,
    onCancel,
}: MeetingDialogProps) {
    const [title, setTitle] = useState('');
    const [meetingType, setMeetingType] = useState<MeetingType>('team');
    const [date, setDate] = useState('');
    const [startTime, setStartTime] = useState('09:00');
    const [endTime, setEndTime] = useState('10:00');
    const [description, setDescription] = useState('');
    const [organizer, setOrganizer] = useState('');
    const [organizerName, setOrganizerName] = useState('');
    const [attendeeSearch, setAttendeeSearch] = useState('');
    const [selectedAttendees, setSelectedAttendees] = useState<MeetingAttendee[]>([]);
    const [useRoom, setUseRoom] = useState(false);
    const [roomId, setRoomId] = useState('');
    const [location, setLocation] = useState('');
    const [meetingLink, setMeetingLink] = useState('');
    const [agenda, setAgenda] = useState('');
    const [priority, setPriority] = useState<'normal' | 'high'>('normal');
    const [isSaving, setIsSaving] = useState(false);

    React.useEffect(() => {
        if (!open) return;
        if (editMeeting) {
            setTitle(editMeeting.title);
            setMeetingType(editMeeting.type);
            setDate(editMeeting.date);
            setStartTime(editMeeting.startTime);
            setEndTime(editMeeting.endTime);
            setDescription(editMeeting.description || '');
            setOrganizer(editMeeting.organizer);
            setOrganizerName(editMeeting.organizerName);
            setSelectedAttendees(editMeeting.attendees || []);
            setUseRoom(!!editMeeting.roomId);
            setRoomId(editMeeting.roomId || '');
            setLocation(editMeeting.location || '');
            setMeetingLink(editMeeting.meetingLink || '');
            setAgenda(editMeeting.agenda || '');
            setPriority(editMeeting.priority || 'normal');
        } else {
            setTitle(defaultTitle || '');
            setMeetingType('team');
            setDate(defaultDate || '');
            setStartTime(defaultStartTime || '09:00');
            setEndTime('10:00');
            setDescription(defaultDescription || '');
            setOrganizer(defaultOrganizer || '');
            setOrganizerName(defaultOrganizerName || '');
            setSelectedAttendees([]);
            setUseRoom(!!defaultRoomId);
            setRoomId(defaultRoomId || '');
            setLocation('');
            setMeetingLink('');
            setAgenda('');
            setPriority('normal');
        }
        setAttendeeSearch('');
        setIsSaving(false);
    }, [open, editMeeting, defaultDate, defaultStartTime, defaultRoomId, defaultTitle, defaultDescription, defaultOrganizer, defaultOrganizerName]);

    const selectedRoom = rooms.find(r => r.id === roomId);

    const overlaps = useMemo(() => {
        if (!useRoom || !roomId || !date || !startTime || !endTime) return [];
        return existingMeetings.filter(m => {
            if (m.roomId !== roomId) return false;
            if (m.date !== date) return false;
            if (m.status === 'cancelled') return false;
            if (editMeeting && m.id === editMeeting.id) return false;
            return startTime < m.endTime && endTime > m.startTime;
        });
    }, [useRoom, roomId, date, startTime, endTime, existingMeetings, editMeeting]);

    const hasOverlap = overlaps.length > 0;
    const endTimeSlots = TIME_SLOTS.filter(t => t > startTime);

    const filteredEmployees = useMemo(() => {
        if (!attendeeSearch) return [];
        const search = attendeeSearch.toLowerCase();
        const selectedIds = new Set(selectedAttendees.map(a => a.employeeId));
        return employees
            .filter(e =>
                (e.firstName?.toLowerCase().includes(search) ||
                    e.lastName?.toLowerCase().includes(search)) &&
                !selectedIds.has(e.id) &&
                e.id !== organizer
            )
            .slice(0, 5);
    }, [attendeeSearch, employees, selectedAttendees, organizer]);

    const handleOrganizerChange = (empId: string) => {
        const emp = employees.find(e => e.id === empId);
        if (emp) {
            setOrganizer(empId);
            setOrganizerName(`${emp.lastName || ''} ${emp.firstName || ''}`.trim());
        }
    };

    const addAttendee = (emp: Employee) => {
        setSelectedAttendees(prev => [...prev, {
            employeeId: emp.id,
            name: `${emp.lastName || ''} ${emp.firstName || ''}`.trim(),
            response: 'pending',
            isRequired: true,
        }]);
        setAttendeeSearch('');
    };

    const removeAttendee = (empId: string) => {
        setSelectedAttendees(prev => prev.filter(a => a.employeeId !== empId));
    };

    const toggleRequired = (empId: string) => {
        setSelectedAttendees(prev =>
            prev.map(a => a.employeeId === empId ? { ...a, isRequired: !a.isRequired } : a)
        );
    };

    const handleSubmit = async () => {
        if (!date || !startTime || !endTime || !title.trim() || hasOverlap) return;
        setIsSaving(true);
        try {
            const meetingData: Omit<Meeting, 'id' | 'createdAt'> = {
                title: title.trim(),
                type: meetingType,
                date,
                startTime,
                endTime,
                organizer,
                organizerName,
                attendees: selectedAttendees,
                attendeeIds: selectedAttendees.map(a => a.employeeId),
                status: 'scheduled',
                priority,
            };
            if (description.trim()) meetingData.description = description.trim();
            if (useRoom && roomId) {
                meetingData.roomId = roomId;
                meetingData.roomName = selectedRoom?.name || '';
            }
            if (location.trim()) meetingData.location = location.trim();
            if (meetingLink.trim()) meetingData.meetingLink = meetingLink.trim();
            if (agenda.trim()) meetingData.agenda = agenda.trim();

            await onSave(meetingData);
            onOpenChange(false);
        } catch {
            // parent re-throws; dialog stays open
        } finally {
            setIsSaving(false);
        }
    };

    const handleCancelMeeting = async () => {
        if (!editMeeting || !onCancel) return;
        setIsSaving(true);
        try {
            await onCancel(editMeeting.id);
            onOpenChange(false);
        } finally {
            setIsSaving(false);
        }
    };

    const isValid = date && startTime && endTime && title.trim() && !hasOverlap && endTime > startTime;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <CalendarPlus className="h-5 w-5" />
                        {editMeeting ? 'Уулзалт засах' : 'Уулзалт товлох'}
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4 py-2">
                    {/* Meeting Type */}
                    <div className="space-y-2">
                        <Label>Уулзалтын төрөл</Label>
                        <div className="flex flex-wrap gap-1.5">
                            {MEETING_TYPE_OPTIONS.map(opt => (
                                <button
                                    key={opt.value}
                                    type="button"
                                    onClick={() => setMeetingType(opt.value)}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                                        meetingType === opt.value
                                            ? 'bg-primary text-primary-foreground border-primary'
                                            : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                                    }`}
                                >
                                    <span>{opt.icon}</span>
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Title */}
                    <div className="space-y-2">
                        <Label>Уулзалтын нэр *</Label>
                        <Input
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            placeholder="Жишээ: Долоо хоногийн тойм уулзалт"
                        />
                    </div>

                    {/* Date + Time */}
                    <div className="grid grid-cols-3 gap-3">
                        <div className="space-y-2">
                            <Label>Огноо *</Label>
                            <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label>Эхлэх *</Label>
                            <Select value={startTime} onValueChange={v => {
                                setStartTime(v);
                                if (v >= endTime) {
                                    const idx = TIME_SLOTS.indexOf(v);
                                    setEndTime(TIME_SLOTS[Math.min(idx + 2, TIME_SLOTS.length - 1)]);
                                }
                            }}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {TIME_SLOTS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Дуусах *</Label>
                            <Select value={endTime} onValueChange={setEndTime}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {endTimeSlots.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Priority */}
                    <div className="flex items-center gap-3">
                        <Label className="flex items-center gap-1.5 cursor-pointer">
                            <Star className={`h-4 w-4 ${priority === 'high' ? 'text-amber-500 fill-amber-500' : 'text-slate-300'}`} />
                            Чухал уулзалт
                        </Label>
                        <Switch checked={priority === 'high'} onCheckedChange={v => setPriority(v ? 'high' : 'normal')} />
                    </div>

                    {/* Room toggle */}
                    <div className="space-y-3 rounded-lg border p-3">
                        <div className="flex items-center justify-between">
                            <Label className="flex items-center gap-2 cursor-pointer">
                                <DoorOpen className="h-4 w-4 text-slate-500" />
                                Хурлын өрөө захиалах
                            </Label>
                            <Switch checked={useRoom} onCheckedChange={v => { setUseRoom(v); if (!v) setRoomId(''); }} />
                        </div>

                        {useRoom && (
                            <div className="space-y-2">
                                <Select value={roomId} onValueChange={setRoomId}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Өрөө сонгох..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {rooms.filter(r => r.isActive).map(r => (
                                            <SelectItem key={r.id} value={r.id}>
                                                <span className="flex items-center gap-2">
                                                    <span className="inline-block h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: r.color }} />
                                                    {r.name}
                                                    <span className="text-muted-foreground text-xs">({r.capacity} хүн)</span>
                                                </span>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>

                                {hasOverlap && (
                                    <div className="flex items-start gap-2 p-2.5 rounded-lg bg-destructive/10 border border-destructive/20">
                                        <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                                        <div className="text-xs text-destructive">
                                            <p className="font-medium">Давхцал байна!</p>
                                            {overlaps.map(o => (
                                                <p key={o.id} className="mt-0.5">{o.title} ({o.startTime}–{o.endTime})</p>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {!useRoom && (
                            <div className="space-y-2">
                                <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                                    <MapPin className="h-3.5 w-3.5" />
                                    Байршил (заавал биш)
                                </Label>
                                <Input
                                    value={location}
                                    onChange={e => setLocation(e.target.value)}
                                    placeholder="Жишээ: 3-р давхрын лобби"
                                    className="h-8 text-sm"
                                />
                            </div>
                        )}
                    </div>

                    {/* Meeting link */}
                    <div className="space-y-2">
                        <Label className="flex items-center gap-1.5">
                            <Link2 className="h-3.5 w-3.5 text-slate-500" />
                            Уулзалтын линк
                        </Label>
                        <Input
                            value={meetingLink}
                            onChange={e => setMeetingLink(e.target.value)}
                            placeholder="https://meet.google.com/... эсвэл Zoom линк"
                            className="h-9"
                        />
                    </div>

                    {/* Organizer */}
                    <div className="space-y-2">
                        <Label>Зохион байгуулагч</Label>
                        <Select value={organizer} onValueChange={handleOrganizerChange}>
                            <SelectTrigger>
                                <SelectValue placeholder="Ажилтан сонгох..." />
                            </SelectTrigger>
                            <SelectContent>
                                {employees.map(e => (
                                    <SelectItem key={e.id} value={e.id}>
                                        {e.lastName} {e.firstName}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Attendees */}
                    <div className="space-y-2">
                        <Label className="flex items-center gap-1.5">
                            <Users className="h-3.5 w-3.5 text-slate-500" />
                            Оролцогчид
                        </Label>
                        {selectedAttendees.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 p-2 rounded-lg border bg-slate-50">
                                {selectedAttendees.map(att => (
                                    <Badge
                                        key={att.employeeId}
                                        variant="secondary"
                                        className="text-xs gap-1 cursor-pointer"
                                        onClick={() => toggleRequired(att.employeeId)}
                                    >
                                        {!att.isRequired && <span className="text-muted-foreground">(сонголттой)</span>}
                                        {att.name}
                                        <button
                                            onClick={e => { e.stopPropagation(); removeAttendee(att.employeeId); }}
                                            className="hover:text-destructive ml-0.5"
                                        >
                                            <X className="h-3 w-3" />
                                        </button>
                                    </Badge>
                                ))}
                            </div>
                        )}
                        <div className="relative">
                            <Input
                                value={attendeeSearch}
                                onChange={e => setAttendeeSearch(e.target.value)}
                                placeholder="Ажилтны нэрээр хайх..."
                                className="h-9"
                            />
                            {filteredEmployees.length > 0 && (
                                <div className="absolute z-50 top-full mt-1 left-0 right-0 bg-white border rounded-lg shadow-lg overflow-hidden py-1">
                                    {filteredEmployees.map(e => (
                                        <button
                                            key={e.id}
                                            className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50"
                                            onClick={() => addAttendee(e)}
                                        >
                                            {e.lastName} {e.firstName}
                                            {e.jobTitle && <span className="text-xs text-muted-foreground ml-2">{e.jobTitle}</span>}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Agenda */}
                    <div className="space-y-2">
                        <Label>Хэлэлцэх асуудал</Label>
                        <Textarea
                            value={agenda}
                            onChange={e => setAgenda(e.target.value)}
                            placeholder="1. Долоо хоногийн үр дүн&#10;2. Ирэх долоо хоногийн зорилт&#10;3. Асуудал, санал"
                            className="min-h-[70px]"
                        />
                    </div>

                    {/* Description */}
                    <div className="space-y-2">
                        <Label>Нэмэлт тайлбар</Label>
                        <Textarea
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            placeholder="Нэмэлт мэдээлэл..."
                            className="min-h-[50px]"
                        />
                    </div>
                </div>

                <DialogFooter className="flex-col sm:flex-row gap-2">
                    {editMeeting && onCancel && (
                        <Button
                            variant="outline"
                            className="text-destructive hover:text-destructive sm:mr-auto"
                            onClick={handleCancelMeeting}
                            disabled={isSaving}
                        >
                            Уулзалт цуцлах
                        </Button>
                    )}
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Болих
                    </Button>
                    <Button onClick={handleSubmit} disabled={!isValid || isSaving}>
                        <CalendarPlus className="h-4 w-4 mr-2" />
                        {editMeeting ? 'Хадгалах' : 'Уулзалт товлох'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
