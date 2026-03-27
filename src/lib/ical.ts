import type { Meeting } from '@/types/meeting';

const TIMEZONE = 'Asia/Ulaanbaatar';
const PRODID = '-//Nege//Meeting//MN';

function escapeICalText(text: string): string {
    return text
        .replace(/\\/g, '\\\\')
        .replace(/;/g, '\\;')
        .replace(/,/g, '\\,')
        .replace(/\n/g, '\\n');
}

/**
 * Converts "2026-03-21" + "09:00" into iCal TZID-based datetime: "20260321T090000"
 */
function toICalDateTime(dateStr: string, timeStr: string): string {
    const d = dateStr.replace(/-/g, '');
    const t = timeStr.replace(/:/g, '') + '00';
    return `${d}T${t}`;
}

function generateUid(meetingId: string): string {
    return `meeting-${meetingId}@nege.mn`;
}

interface CalendarInviteOptions {
    meeting: Meeting;
    organizerEmail: string;
    attendeeEmails: Map<string, { email: string; name: string }>;
    method: 'REQUEST' | 'CANCEL';
}

/**
 * Generates an RFC 5545 compliant iCalendar (.ics) string.
 * Works with Google Calendar, Outlook, Apple Calendar, Thunderbird, etc.
 */
export function generateICalEvent({
    meeting,
    organizerEmail,
    attendeeEmails,
    method,
}: CalendarInviteOptions): string {
    const uid = generateUid(meeting.id);
    const sequence = meeting.sequence ?? 0;
    const now = new Date();
    const dtstamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

    const dtStart = toICalDateTime(meeting.date, meeting.startTime);
    const dtEnd = toICalDateTime(meeting.date, meeting.endTime);

    const status = method === 'CANCEL' ? 'CANCELLED' : 'CONFIRMED';

    const lines: string[] = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        `PRODID:${PRODID}`,
        'CALSCALE:GREGORIAN',
        `METHOD:${method}`,
        // VTIMEZONE for Asia/Ulaanbaatar (UTC+8, no DST)
        'BEGIN:VTIMEZONE',
        `TZID:${TIMEZONE}`,
        'BEGIN:STANDARD',
        'DTSTART:19700101T000000',
        'TZOFFSETFROM:+0800',
        'TZOFFSETTO:+0800',
        'END:STANDARD',
        'END:VTIMEZONE',
        'BEGIN:VEVENT',
        `UID:${uid}`,
        `DTSTAMP:${dtstamp}`,
        `DTSTART;TZID=${TIMEZONE}:${dtStart}`,
        `DTEND;TZID=${TIMEZONE}:${dtEnd}`,
        `SEQUENCE:${sequence}`,
        `STATUS:${status}`,
        `SUMMARY:${escapeICalText(meeting.title)}`,
    ];

    if (meeting.description) {
        lines.push(`DESCRIPTION:${escapeICalText(meeting.description)}`);
    }

    const location = meeting.roomName || meeting.location;
    if (location) {
        lines.push(`LOCATION:${escapeICalText(location)}`);
    }

    if (meeting.meetingLink) {
        lines.push(`URL:${meeting.meetingLink}`);
    }

    lines.push(
        `ORGANIZER;CN=${escapeICalText(meeting.organizerName)}:mailto:${organizerEmail}`
    );

    for (const [, { email, name }] of attendeeEmails) {
        lines.push(
            `ATTENDEE;ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE;CN=${escapeICalText(name)}:mailto:${email}`
        );
    }

    if (meeting.agenda) {
        lines.push(`X-ALT-DESC;FMTTYPE=text/plain:${escapeICalText(meeting.agenda)}`);
    }

    if (meeting.priority === 'high') {
        lines.push('PRIORITY:1');
    }

    lines.push('END:VEVENT', 'END:VCALENDAR');

    return lines.join('\r\n');
}

/**
 * Generates an HTML email body for the meeting invite.
 */
export function generateInviteEmailHtml(
    meeting: Meeting,
    action: 'create' | 'update' | 'cancel'
): string {
    const actionLabels = {
        create: 'Шинэ уулзалтын урилга',
        update: 'Уулзалтын мэдээлэл шинэчлэгдлээ',
        cancel: 'Уулзалт цуцлагдлаа',
    };
    const actionTitle = actionLabels[action];

    const location = meeting.roomName || meeting.location || '—';
    const meetingLink = meeting.meetingLink
        ? `<p style="margin:8px 0"><strong>Холбоос:</strong> <a href="${meeting.meetingLink}" style="color:#4f46e5">${meeting.meetingLink}</a></p>`
        : '';
    const agenda = meeting.agenda
        ? `<p style="margin:8px 0"><strong>Хэлэлцэх асуудал:</strong><br/>${meeting.agenda.replace(/\n/g, '<br/>')}</p>`
        : '';
    const cancelNote = action === 'cancel' && meeting.cancelReason
        ? `<p style="margin:8px 0;color:#dc2626"><strong>Шалтгаан:</strong> ${meeting.cancelReason}</p>`
        : '';
    const isCancelled = action === 'cancel';

    return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#1e293b">
  <div style="border:1px solid #e2e8f0;border-radius:12px;overflow:hidden">
    <div style="background:${isCancelled ? '#fef2f2' : '#f0f4ff'};padding:24px;border-bottom:1px solid #e2e8f0">
      <h1 style="margin:0;font-size:18px;color:${isCancelled ? '#dc2626' : '#4f46e5'}">${actionTitle}</h1>
    </div>
    <div style="padding:24px">
      <h2 style="margin:0 0 16px;font-size:20px;${isCancelled ? 'text-decoration:line-through;color:#94a3b8' : ''}">${meeting.title}</h2>
      <div style="background:#f8fafc;border-radius:8px;padding:16px;margin-bottom:16px">
        <p style="margin:4px 0"><strong>Огноо:</strong> ${meeting.date}</p>
        <p style="margin:4px 0"><strong>Цаг:</strong> ${meeting.startTime} – ${meeting.endTime}</p>
        <p style="margin:4px 0"><strong>Байршил:</strong> ${location}</p>
        <p style="margin:4px 0"><strong>Зохион байгуулагч:</strong> ${meeting.organizerName}</p>
      </div>
      ${meeting.description ? `<p style="margin:8px 0"><strong>Тайлбар:</strong> ${meeting.description}</p>` : ''}
      ${meetingLink}
      ${agenda}
      ${cancelNote}
      <p style="margin:16px 0 0;font-size:13px;color:#94a3b8">
        ${isCancelled ? 'Энэ уулзалт цуцлагдсан тул таны календараас автоматаар хасагдана.' : 'Энэ имэйлийн хавсралт (.ics файл) нь таны календарт автоматаар нэмэгдэнэ.'}
      </p>
    </div>
  </div>
</body>
</html>`.trim();
}
