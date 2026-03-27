'use client';

import React from 'react';
import { format } from 'date-fns';
import { mn } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import {
    CalendarDays,
    Check,
    Clock,
    Copy,
    DoorOpen,
    Edit,
    ExternalLink,
    HelpCircle,
    Link2,
    ListChecks,
    MapPin,
    Star,
    Trash2,
    User,
    Users,
    Video,
    X,
} from 'lucide-react';
import type { Meeting, MeetingType } from '@/types/meeting';
import { MEETING_TYPE_LABELS } from '@/types/meeting';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

const RESPONSE_CONFIG = {
    accepted: { label: 'Зөвшөөрсөн', className: 'text-emerald-700 bg-emerald-50', icon: Check, iconClass: 'text-emerald-600' },
    declined: { label: 'Татгалзсан', className: 'text-rose-600 bg-rose-50', icon: X, iconClass: 'text-rose-500' },
    tentative: { label: 'Магадгүй', className: 'text-amber-700 bg-amber-50', icon: HelpCircle, iconClass: 'text-amber-500' },
    pending: { label: 'Хүлээгдэж буй', className: 'text-slate-600 bg-slate-50', icon: Clock, iconClass: 'text-slate-400' },
};

const TYPE_ICONS: Record<MeetingType, string> = {
    one_on_one: '👤',
    team: '👥',
    department: '🏢',
    standup: '⚡',
    review: '📋',
    external: '🌐',
    other: '📌',
};

interface MeetingDetailDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    meeting: Meeting | null;
    currentUserId: string;
    onEdit: (meeting: Meeting) => void;
    onCancel: (meetingId: string) => Promise<void>;
    onRsvp: (meetingId: string, response: 'accepted' | 'declined' | 'tentative') => void;
}

export function MeetingDetailDialog({
    open,
    onOpenChange,
    meeting,
    currentUserId,
    onEdit,
    onCancel,
    onRsvp,
}: MeetingDetailDialogProps) {
    const { toast } = useToast();
    if (!meeting) return null;

    const isOrganizer = meeting.organizer === currentUserId;
    const myAttendee = meeting.attendees.find(a => a.employeeId === currentUserId);
    const myResponse = isOrganizer ? 'accepted' : myAttendee?.response || 'pending';
    const isCancelled = meeting.status === 'cancelled';

    let dateLabel: string;
    try {
        const d = new Date(meeting.date + 'T00:00:00');
        dateLabel = format(d, 'yyyy оны M сарын d (EEEE)', { locale: mn });
    } catch {
        dateLabel = meeting.date;
    }

    const acceptedCount = meeting.attendees.filter(a => a.response === 'accepted').length;
    const declinedCount = meeting.attendees.filter(a => a.response === 'declined').length;
    const pendingCount = meeting.attendees.filter(a => a.response === 'pending').length;

    const handleCopyLink = () => {
        if (!meeting.meetingLink) return;
        navigator.clipboard.writeText(meeting.meetingLink);
        toast({ title: 'Линк хуулагдлаа' });
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <span className="text-lg">{TYPE_ICONS[meeting.type]}</span>
                        <span className="truncate">{meeting.title}</span>
                        {meeting.priority === 'high' && (
                            <Star className="h-4 w-4 text-amber-500 fill-amber-500 shrink-0" />
                        )}
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-5 py-2">
                    {isCancelled && (
                        <div className="bg-rose-50 border border-rose-200 rounded-lg px-3 py-2 text-sm text-rose-700 font-medium">
                            Энэ уулзалт цуцлагдсан
                            {meeting.cancelReason && <span className="font-normal"> — {meeting.cancelReason}</span>}
                        </div>
                    )}

                    {/* Date/Time + Type */}
                    <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm">
                            <CalendarDays className="h-4 w-4 text-slate-400" />
                            <span className="font-medium">{dateLabel}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                            <Clock className="h-4 w-4 text-slate-400" />
                            <span>{meeting.startTime} – {meeting.endTime}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                            <span className="text-slate-400 w-4 text-center">{TYPE_ICONS[meeting.type]}</span>
                            <Badge variant="outline" className="text-[10px]">{MEETING_TYPE_LABELS[meeting.type]}</Badge>
                        </div>
                    </div>

                    {/* Location / Room */}
                    {(meeting.roomName || meeting.location) && (
                        <div className="flex items-center gap-2 text-sm">
                            {meeting.roomId ? (
                                <>
                                    <DoorOpen className="h-4 w-4 text-slate-400" />
                                    <span>{meeting.roomName}</span>
                                </>
                            ) : (
                                <>
                                    <MapPin className="h-4 w-4 text-slate-400" />
                                    <span>{meeting.location}</span>
                                </>
                            )}
                        </div>
                    )}

                    {/* Meeting Link */}
                    {meeting.meetingLink && (
                        <div className="flex items-center gap-2">
                            <Video className="h-4 w-4 text-blue-500" />
                            <a
                                href={meeting.meetingLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm text-blue-600 hover:underline truncate flex items-center gap-1"
                                onClick={e => e.stopPropagation()}
                            >
                                Уулзалтын линк нээх
                                <ExternalLink className="h-3 w-3" />
                            </a>
                            <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={handleCopyLink}>
                                <Copy className="h-3 w-3" />
                            </Button>
                        </div>
                    )}

                    {/* Organizer */}
                    <div className="flex items-center gap-2 text-sm">
                        <User className="h-4 w-4 text-slate-400" />
                        <span className="text-muted-foreground">Зохион байгуулагч:</span>
                        <span className="font-medium">{meeting.organizerName}</span>
                    </div>

                    {/* Agenda */}
                    {meeting.agenda && (
                        <div className="space-y-1.5">
                            <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                <ListChecks className="h-3.5 w-3.5" />
                                Хэлэлцэх асуудал
                            </div>
                            <div className="text-sm whitespace-pre-wrap bg-slate-50 rounded-lg p-3 border">
                                {meeting.agenda}
                            </div>
                        </div>
                    )}

                    {/* Description */}
                    {meeting.description && (
                        <div className="space-y-1.5">
                            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                Тайлбар
                            </div>
                            <p className="text-sm text-slate-600 whitespace-pre-wrap">{meeting.description}</p>
                        </div>
                    )}

                    {/* Attendees */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                <Users className="h-3.5 w-3.5" />
                                Оролцогчид ({meeting.attendees.length})
                            </div>
                            <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                                <span className="text-emerald-600">{acceptedCount} зөвшөөрсөн</span>
                                {declinedCount > 0 && <span className="text-rose-500">{declinedCount} татгалзсан</span>}
                                {pendingCount > 0 && <span>{pendingCount} хүлээгдэж буй</span>}
                            </div>
                        </div>
                        <div className="space-y-1 max-h-[200px] overflow-y-auto">
                            {meeting.attendees.map(att => {
                                const config = RESPONSE_CONFIG[att.response];
                                const Icon = config.icon;
                                const initials = att.name.split(' ').map(n => n[0]).join('').slice(0, 2);
                                return (
                                    <div key={att.employeeId} className="flex items-center gap-2.5 py-1.5 px-2 rounded-lg hover:bg-slate-50">
                                        <Avatar className="h-7 w-7">
                                            <AvatarFallback className="text-[10px] bg-slate-100">{initials}</AvatarFallback>
                                        </Avatar>
                                        <div className="flex-1 min-w-0">
                                            <span className="text-sm truncate">{att.name}</span>
                                            {!att.isRequired && (
                                                <span className="text-[10px] text-muted-foreground ml-1">(сонголттой)</span>
                                            )}
                                        </div>
                                        <div className={cn('flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium', config.className)}>
                                            <Icon className={cn('h-3 w-3', config.iconClass)} />
                                            {config.label}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* RSVP actions for attendees */}
                    {!isOrganizer && !isCancelled && myAttendee && (
                        <div className="border-t pt-3 space-y-2">
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                Таны хариу
                            </p>
                            <div className="flex items-center gap-2">
                                <Button
                                    size="sm"
                                    variant={myResponse === 'accepted' ? 'default' : 'outline'}
                                    className={cn('h-8 text-xs', myResponse === 'accepted' && 'bg-emerald-600 hover:bg-emerald-700')}
                                    onClick={() => onRsvp(meeting.id, 'accepted')}
                                >
                                    <Check className="h-3 w-3 mr-1" />
                                    Зөвшөөрөх
                                </Button>
                                <Button
                                    size="sm"
                                    variant={myResponse === 'tentative' ? 'default' : 'outline'}
                                    className={cn('h-8 text-xs', myResponse === 'tentative' && 'bg-amber-500 hover:bg-amber-600')}
                                    onClick={() => onRsvp(meeting.id, 'tentative')}
                                >
                                    <HelpCircle className="h-3 w-3 mr-1" />
                                    Магадгүй
                                </Button>
                                <Button
                                    size="sm"
                                    variant={myResponse === 'declined' ? 'default' : 'outline'}
                                    className={cn('h-8 text-xs', myResponse === 'declined' && 'bg-rose-600 hover:bg-rose-700')}
                                    onClick={() => onRsvp(meeting.id, 'declined')}
                                >
                                    <X className="h-3 w-3 mr-1" />
                                    Татгалзах
                                </Button>
                            </div>
                        </div>
                    )}
                </div>

                {isOrganizer && !isCancelled && (
                    <DialogFooter className="gap-2">
                        <Button
                            variant="outline"
                            className="text-destructive hover:text-destructive sm:mr-auto"
                            onClick={() => onCancel(meeting.id)}
                        >
                            <Trash2 className="h-4 w-4 mr-1.5" />
                            Цуцлах
                        </Button>
                        <Button
                            variant="outline"
                            onClick={() => {
                                onOpenChange(false);
                                onEdit(meeting);
                            }}
                        >
                            <Edit className="h-4 w-4 mr-1.5" />
                            Засах
                        </Button>
                    </DialogFooter>
                )}
            </DialogContent>
        </Dialog>
    );
}
