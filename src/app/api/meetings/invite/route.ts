import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getFirebaseAdminFirestore } from '@/lib/firebase-admin';
import { requireTenantAuth } from '@/lib/api/auth-middleware';
import { Resend } from 'resend';
import { generateICalEvent, generateInviteEmailHtml } from '@/lib/ical';
import type { Meeting } from '@/types/meeting';

const BodySchema = z.object({
    meetingId: z.string().min(1),
    action: z.enum(['create', 'update', 'cancel']),
});

export async function POST(request: NextRequest) {
    const authResult = await requireTenantAuth(request, { rateLimit: 'standard', module: 'meetings' });
    if (authResult.response) return authResult.response;

    const { auth } = authResult;

    try {
        const body = await request.json();
        const parsed = BodySchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { error: 'Буруу хүсэлт', details: parsed.error.flatten() },
                { status: 400 }
            );
        }

        const { meetingId, action } = parsed.data;
        const db = getFirebaseAdminFirestore();
        const companyId = auth.companyId;

        const meetingSnap = await db
            .collection('companies')
            .doc(companyId)
            .collection('meetings')
            .doc(meetingId)
            .get();

        if (!meetingSnap.exists) {
            return NextResponse.json({ error: 'Уулзалт олдсонгүй' }, { status: 404 });
        }

        const meetingData = { id: meetingSnap.id, ...meetingSnap.data() } as Meeting;

        const allEmployeeIds = [
            meetingData.organizer,
            ...meetingData.attendeeIds,
        ];
        const uniqueIds = [...new Set(allEmployeeIds)];

        const employeesRef = db
            .collection('companies')
            .doc(companyId)
            .collection('employees');

        const emailMap = new Map<string, { email: string; name: string }>();
        let organizerEmail = '';

        const batchSize = 10;
        for (let i = 0; i < uniqueIds.length; i += batchSize) {
            const batch = uniqueIds.slice(i, i + batchSize);
            const snapshots = await employeesRef
                .where('__name__', 'in', batch)
                .get();

            for (const doc of snapshots.docs) {
                const data = doc.data();
                const email = data.email as string | undefined;

                // Only require a valid email address — do NOT gate on emailVerified.
                // emailVerified is a Firebase Auth field and is rarely synced to the
                // employee Firestore doc. Blocking on it silently drops all invites.
                if (!email || !email.includes('@')) continue;

                const name = `${data.lastName || ''} ${data.firstName || ''}`.trim() || email;

                if (doc.id === meetingData.organizer) {
                    organizerEmail = email;
                }

                emailMap.set(doc.id, { email, name });
            }
        }

        if (emailMap.size === 0) {
            return NextResponse.json({
                success: true,
                sent: 0,
                note: 'Баталгаажсан имэйлтэй оролцогч олдсонгүй',
            });
        }

        if (!organizerEmail) {
            organizerEmail = 'noreply@nege.mn';
        }

        const attendeeEmails = new Map<string, { email: string; name: string }>();
        for (const [id, info] of emailMap) {
            if (id !== meetingData.organizer) {
                attendeeEmails.set(id, info);
            }
        }

        const method = action === 'cancel' ? 'CANCEL' : 'REQUEST';
        const icsContent = generateICalEvent({
            meeting: meetingData,
            organizerEmail,
            attendeeEmails: emailMap,
            method,
        });

        const htmlBody = generateInviteEmailHtml(meetingData, action);

        const subjectPrefixes = {
            create: 'Уулзалт',
            update: 'Шинэчлэгдсэн',
            cancel: 'Цуцлагдсан',
        };
        const subject = `${subjectPrefixes[action]}: ${meetingData.title} — ${meetingData.date} ${meetingData.startTime}`;

        const resend = process.env.RESEND_API_KEY
            ? new Resend(process.env.RESEND_API_KEY)
            : null;
        const fromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';

        const recipientEmails = [...emailMap.values()].map(v => v.email);
        let sentCount = 0;

        if (!resend) {
            console.log(`[meetings/invite] SIMULATION: Would send ${method} invite to ${recipientEmails.join(', ')}`);
            console.log(`[meetings/invite] Subject: ${subject}`);
            sentCount = recipientEmails.length;
        } else {
            const sendPromises = recipientEmails.map(async (to) => {
                try {
                    const { error } = await resend.emails.send({
                        from: `Уулзалт <${fromEmail}>`,
                        to: [to],
                        subject,
                        html: htmlBody,
                        attachments: [
                            {
                                filename: 'invite.ics',
                                content: Buffer.from(icsContent, 'utf-8').toString('base64'),
                                content_type: 'text/calendar; method=' + method,
                            },
                        ],
                    } as any);

                    if (error) {
                        console.error(`[meetings/invite] Resend error for ${to}:`, error);
                        return false;
                    }
                    return true;
                } catch (err) {
                    console.error(`[meetings/invite] Exception sending to ${to}:`, err);
                    return false;
                }
            });

            const results = await Promise.all(sendPromises);
            sentCount = results.filter(Boolean).length;
        }

        console.log(`[meetings/invite] Sent ${sentCount}/${recipientEmails.length} invites for meeting ${meetingId} (${action})`);

        return NextResponse.json({
            success: true,
            sent: sentCount,
            total: recipientEmails.length,
        });
    } catch (error: any) {
        console.error('[meetings/invite] Error:', error);
        return NextResponse.json(
            { error: error.message || 'Серверийн алдаа' },
            { status: 500 }
        );
    }
}
