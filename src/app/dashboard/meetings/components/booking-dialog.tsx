'use client';

import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import { AlertTriangle, Clock, DoorOpen, X } from 'lucide-react';
import type { MeetingRoom, RoomBooking } from '@/types/meeting';
import { TIME_SLOTS } from '@/types/meeting';
import type { Employee } from '@/types';

interface BookingDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    rooms: MeetingRoom[];
    employees: Employee[];
    existingBookings: RoomBooking[];
    onSave: (booking: Omit<RoomBooking, 'id' | 'createdAt'>) => Promise<void>;
    defaultDate?: string;
    defaultStartTime?: string;
    defaultRoomId?: string;
    defaultTitle?: string;
    defaultDescription?: string;
    defaultOrganizer?: string;
    defaultOrganizerName?: string;
    editBooking?: RoomBooking | null;
    onDelete?: (bookingId: string) => Promise<void>;
}

export function BookingDialog({
    open,
    onOpenChange,
    rooms,
    employees,
    existingBookings,
    onSave,
    defaultDate,
    defaultStartTime,
    defaultRoomId,
    defaultTitle,
    defaultDescription,
    defaultOrganizer,
    defaultOrganizerName,
    editBooking,
    onDelete,
}: BookingDialogProps) {
    const [roomId, setRoomId] = useState(editBooking?.roomId || defaultRoomId || '');
    const [date, setDate] = useState(editBooking?.date || defaultDate || '');
    const [startTime, setStartTime] = useState(editBooking?.startTime || defaultStartTime || '09:00');
    const [endTime, setEndTime] = useState(editBooking?.endTime || '10:00');
    const [title, setTitle] = useState(editBooking?.title || '');
    const [description, setDescription] = useState(editBooking?.description || '');
    const [organizer, setOrganizer] = useState(editBooking?.organizer || '');
    const [organizerName, setOrganizerName] = useState(editBooking?.organizerName || '');
    const [attendeeSearch, setAttendeeSearch] = useState('');
    const [selectedAttendees, setSelectedAttendees] = useState<string[]>(editBooking?.attendees || []);
    const [isSaving, setIsSaving] = useState(false);

    React.useEffect(() => {
        if (open) {
            setRoomId(editBooking?.roomId || defaultRoomId || '');
            setDate(editBooking?.date || defaultDate || '');
            setStartTime(editBooking?.startTime || defaultStartTime || '09:00');
            setEndTime(editBooking?.endTime || '10:00');
            setTitle(editBooking?.title || defaultTitle || '');
            setDescription(editBooking?.description || defaultDescription || '');
            setOrganizer(editBooking?.organizer || defaultOrganizer || '');
            setOrganizerName(editBooking?.organizerName || defaultOrganizerName || '');
            setSelectedAttendees(editBooking?.attendees || []);
            setIsSaving(false);
        }
    }, [open, editBooking, defaultDate, defaultStartTime, defaultRoomId, defaultTitle, defaultDescription, defaultOrganizer, defaultOrganizerName]);

    const selectedRoom = rooms.find(r => r.id === roomId);

    // Find overlapping bookings
    const overlaps = useMemo(() => {
        if (!roomId || !date || !startTime || !endTime) return [];
        return existingBookings.filter(b => {
            if (b.roomId !== roomId) return false;
            if (b.date !== date) return false;
            if (b.status === 'cancelled') return false;
            if (editBooking && b.id === editBooking.id) return false;
            return startTime < b.endTime && endTime > b.startTime;
        });
    }, [roomId, date, startTime, endTime, existingBookings, editBooking]);

    const hasOverlap = overlaps.length > 0;

    // Filtered end time slots (must be after start time)
    const endTimeSlots = TIME_SLOTS.filter(t => t > startTime);

    // Employee search
    const filteredEmployees = useMemo(() => {
        if (!attendeeSearch) return [];
        const search = attendeeSearch.toLowerCase();
        return employees
            .filter(e =>
                (e.firstName?.toLowerCase().includes(search) ||
                    e.lastName?.toLowerCase().includes(search)) &&
                !selectedAttendees.includes(e.id) &&
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

    const addAttendee = (empId: string) => {
        setSelectedAttendees(prev => [...prev, empId]);
        setAttendeeSearch('');
    };

    const removeAttendee = (empId: string) => {
        setSelectedAttendees(prev => prev.filter(id => id !== empId));
    };

    const getEmployeeName = (empId: string) => {
        const emp = employees.find(e => e.id === empId);
        return emp ? `${emp.lastName || ''} ${emp.firstName || ''}`.trim() : empId;
    };

    const handleSubmit = async () => {
        if (!roomId || !date || !startTime || !endTime || !title.trim() || hasOverlap) return;
        setIsSaving(true);
        try {
            const bookingData: Omit<RoomBooking, 'id' | 'createdAt'> = {
                roomId,
                roomName: selectedRoom?.name || '',
                title: title.trim(),
                date,
                startTime,
                endTime,
                organizer,
                organizerName,
                status: 'active',
            };
            if (description.trim()) bookingData.description = description.trim();
            if (selectedAttendees.length > 0) bookingData.attendees = selectedAttendees;
            await onSave(bookingData);
            onOpenChange(false);
        } catch {
            // error re-thrown by parent; dialog stays open for retry
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteBooking = async () => {
        if (!editBooking || !onDelete) return;
        setIsSaving(true);
        try {
            await onDelete(editBooking.id);
            onOpenChange(false);
        } finally {
            setIsSaving(false);
        }
    };

    const isValid = roomId && date && startTime && endTime && title.trim() && !hasOverlap && endTime > startTime;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <DoorOpen className="h-5 w-5" />
                        {editBooking ? 'Захиалга засах' : 'Шинэ захиалга'}
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4 py-2">
                    {/* Title */}
                    <div className="space-y-2">
                        <Label>Хурлын нэр *</Label>
                        <Input
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            placeholder="Жишээ: Багийн уулзалт"
                        />
                    </div>

                    {/* Room select */}
                    <div className="space-y-2">
                        <Label>Өрөө *</Label>
                        <Select value={roomId} onValueChange={setRoomId}>
                            <SelectTrigger>
                                <SelectValue placeholder="Өрөө сонгох..." />
                            </SelectTrigger>
                            <SelectContent>
                                {rooms.filter(r => r.isActive).map(r => (
                                    <SelectItem key={r.id} value={r.id}>
                                        <span className="flex items-center gap-2">
                                            <span
                                                className="inline-block h-2.5 w-2.5 rounded-full shrink-0"
                                                style={{ backgroundColor: r.color }}
                                            />
                                            {r.name}
                                            <span className="text-muted-foreground text-xs">({r.capacity} хүн)</span>
                                        </span>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Date */}
                    <div className="space-y-2">
                        <Label>Огноо *</Label>
                        <Input
                            type="date"
                            value={date}
                            onChange={e => setDate(e.target.value)}
                        />
                    </div>

                    {/* Time */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Эхлэх цаг *</Label>
                            <Select value={startTime} onValueChange={v => { setStartTime(v); if (v >= endTime) { const idx = TIME_SLOTS.indexOf(v); setEndTime(TIME_SLOTS[Math.min(idx + 2, TIME_SLOTS.length - 1)]); } }}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {TIME_SLOTS.map(t => (
                                        <SelectItem key={t} value={t}>{t}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Дуусах цаг *</Label>
                            <Select value={endTime} onValueChange={setEndTime}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {endTimeSlots.map(t => (
                                        <SelectItem key={t} value={t}>{t}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Overlap warning */}
                    {hasOverlap && (
                        <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                            <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                            <div className="text-sm text-destructive">
                                <p className="font-medium">Давхцал байна!</p>
                                {overlaps.map(o => (
                                    <p key={o.id} className="text-xs mt-1">
                                        {o.title} ({o.startTime}–{o.endTime})
                                    </p>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Description */}
                    <div className="space-y-2">
                        <Label>Тайлбар</Label>
                        <Textarea
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            placeholder="Хурлын зорилго, хэлэлцэх асуудал..."
                            className="min-h-[60px]"
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
                        <Label>Оролцогчид</Label>
                        {selectedAttendees.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 p-2 rounded-lg border bg-slate-50">
                                {selectedAttendees.map(id => (
                                    <Badge key={id} variant="secondary" className="text-xs gap-1">
                                        {getEmployeeName(id)}
                                        <button onClick={() => removeAttendee(id)} className="hover:text-destructive">
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
                                            onClick={() => addAttendee(e.id)}
                                        >
                                            {e.lastName} {e.firstName}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <DialogFooter className="flex-col sm:flex-row gap-2">
                    {editBooking && onDelete && (
                        <Button
                            variant="outline"
                            className="text-destructive hover:text-destructive sm:mr-auto"
                            onClick={handleDeleteBooking}
                            disabled={isSaving}
                        >
                            Цуцлах
                        </Button>
                    )}
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Болих
                    </Button>
                    <Button onClick={handleSubmit} disabled={!isValid || isSaving}>
                        <Clock className="h-4 w-4 mr-2" />
                        {editBooking ? 'Хадгалах' : 'Захиалах'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
