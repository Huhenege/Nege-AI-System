import { JobApplication, RecruitmentStage, Candidate } from '@/types/recruitment';
import { getJsonAuthHeaders } from '@/lib/api/client-auth';

type NotificationType = 'STAGE_CHANGE' | 'INTERVIEW_SCHEDULED' | 'REJECTION' | 'OFFER';

interface EmailTemplate {
    subject: string;
    body: (candidateName: string, context: any) => string;
}

const EMAIL_TEMPLATES: Record<string, EmailTemplate> = {
    'screening': {
        subject: 'Таны анкет ирсэн: [Vacancy]',
        body: (name, { vacancyTitle }) => `Сайн байна уу, ${name}.\n\nБид таны ${vacancyTitle} ажлын байранд илгээсэн анкетыг хүлээн авлаа. Бид удахгүй холбогдох болно.\n\nХүндэтгэсэн,\nHR баг`
    },
    'interview': {
        subject: 'Ярилцлагын урилга: [Vacancy]',
        body: (name, { vacancyTitle }) => `Сайн байна уу, ${name}.\n\nТаны ${vacancyTitle} ажлын байрны дараагийн шатны ярилцлагад урьж байна.\n\nХүндэтгэсэн,\nHR баг`
    },
    'rejected': {
        subject: 'Сонгон шалгаруулалтын хариу',
        body: (name, { vacancyTitle }) => `Сайн байна уу, ${name}.\n\nСонгон шалгаруулалтад оролцсонд баярлалаа. Харамсалтай нь бид энэ удаад өөр горилогчийг сонголоо.\n\nХүндэтгэсэн,\nHR баг`
    },
    'default': {
        subject: 'Анкетын статус шинэчлэгдлээ',
        body: (name, { stageName }) => `Сайн байна уу, ${name}.\n\nТаны анкетын статус "${stageName}" болж өөрчлөгдлөө.`
    }
};

/**
 * Mocks sending an email notification
 */
export async function sendNotification(
    candidate: Candidate,
    type: NotificationType,
    context: any
): Promise<boolean> {
    console.log(`[Notification Service] Preparing to send ${type} to ${candidate.email}`);

    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 800));

    // Select template
    let template = EMAIL_TEMPLATES['default'];

    if (type === 'STAGE_CHANGE') {
        const stageId = context.stageId?.toLowerCase();
        if (stageId?.includes('screen')) template = EMAIL_TEMPLATES['screening'];
        else if (stageId?.includes('interview')) template = EMAIL_TEMPLATES['interview'];
        else if (stageId?.includes('reject')) template = EMAIL_TEMPLATES['rejected'];
    }

    const subject = template.subject.replace('[Vacancy]', context.vacancyTitle || 'Position');
    const body = template.body(candidate.firstName, context);

    console.log(`
    ----------------------------------------------------
    TO: ${candidate.email} (${candidate.firstName} ${candidate.lastName})
    SUBJECT: ${subject}
    BODY:
    ${body}
    ----------------------------------------------------
    `);

    return true;
}

/**
 * Монгол утасны дугаарт 976 улсын код нэмэх.
 * Жишээ: "88104099" -> "97688104099", "97688104099" -> "97688104099"
 */
function formatMongolianPhone(phone: string): string {
    const cleaned = phone.replace(/[\s\-\(\)\+]/g, '');
    if (cleaned.startsWith('976')) return cleaned;
    return `976${cleaned}`;
}

/**
 * Имэйл илгээх
 */
export async function sendEmail(
    toEmail: string,
    subject: string,
    text: string
): Promise<boolean> {
    console.log(`[Notification Service] Sending email to ${toEmail}`);

    try {
        const response = await fetch('/api/email', {
            method: 'POST',
            headers: await getJsonAuthHeaders(),
            body: JSON.stringify({ to: toEmail, subject, text }),
        });

        const data = await response.json();

        if (!response.ok || (!data.success && data.error)) {
            const detail = data.details || data.error || 'Имэйл илгээж чадсангүй';
            throw new Error(detail);
        }

        console.log('[Notification Service] Email sent successfully:', data);
        return true;
    } catch (error) {
        console.error('[Notification Service] Failed to send email:', error);
        throw error;
    }
}

/**
 * SMS мессеж илгээх
 */
export async function sendSMS(
    phoneNumber: string,
    text: string
): Promise<boolean> {
    const formattedPhone = formatMongolianPhone(phoneNumber);
    console.log(`[Notification Service] Sending SMS to ${formattedPhone} via API`);

    try {
        const response = await fetch('/api/sms', {
            method: 'POST',
            headers: await getJsonAuthHeaders(),
            body: JSON.stringify({
                to: formattedPhone,
                text: text,
            }),
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
            const detail = data.details || data.error || 'SMS илгээж чадсангүй';
            throw new Error(detail);
        }

        console.log('[Notification Service] SMS sent successfully:', data);
        return true;
    } catch (error) {
        console.error('[Notification Service] Failed to send SMS:', error);
        throw error;
    }
}
