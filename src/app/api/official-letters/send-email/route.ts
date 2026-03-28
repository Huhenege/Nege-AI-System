import { NextRequest, NextResponse } from 'next/server';
import { requireTenantAuth } from '@/lib/api/auth-middleware';
import { Resend } from 'resend';
import { getFirebaseAdminFirestore } from '@/lib/firebase-admin';
import type { OfficialLetterConfig } from '@/app/dashboard/official-letters/types';

const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * HTML injection хамгаалалт — бүх user input-г escape хийнэ
 */
function escapeHtml(str: string): string {
    return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/**
 * POST /api/official-letters/send-email
 * Албан бичгийг имэйлээр илгээнэ
 * Config-г client-с авахгүй, letterId ашиглан Firestore-с verify хийнэ
 */
export async function POST(request: NextRequest) {
    const authResult = await requireTenantAuth(request, { module: 'official_letters' });
    if ('response' in authResult && authResult.response) return authResult.response;

    const { toEmail, letterId } = await request.json() as {
        toEmail: string;
        letterId: string;
    };

    // Email format validation (server-side)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!toEmail || !emailRegex.test(toEmail)) {
        return NextResponse.json({ error: 'Имэйл хаяг буруу байна' }, { status: 400 });
    }
    if (!letterId) {
        return NextResponse.json({ error: 'letterId шаардлагатай' }, { status: 400 });
    }

    // Firestore-с config авах — client-с авахгүй (injection хамгаалалт)
    const { companyId } = authResult.auth;
    const db = getFirebaseAdminFirestore();
    const letterRef = db.doc(`companies/${companyId}/official_letters/${letterId}`);
    const letterSnap = await letterRef.get();

    if (!letterSnap.exists) {
        return NextResponse.json({ error: 'Баримт олдсонгүй' }, { status: 404 });
    }

    const letterData = letterSnap.data()!;
    const config = letterData.config as OfficialLetterConfig;

    if (!config) {
        return NextResponse.json({ error: 'Баримтын тохиргоо алдаатай байна' }, { status: 400 });
    }

    const formattedDate = config.docDate ? config.docDate.replace(/-/g, '.') : '';
    const subject = `[${escapeHtml(config.docIndex || 'АБ')}] ${escapeHtml(config.subject || 'Албан бичиг')} — ${escapeHtml(config.orgName)}`;

    const htmlBody = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><style>
  body { font-family: 'Times New Roman', serif; font-size: 12pt; line-height: 1.5; color: #000; padding: 2rem; }
  .header { text-align: center; margin-bottom: 1.5rem; border-bottom: 2px solid #000; padding-bottom: 1rem; }
  .org-name { font-size: 1.3rem; font-weight: 800; text-transform: uppercase; }
  .tagline { font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.05em; }
  .contacts { font-size: 0.8rem; margin-top: 0.5rem; }
  .meta { margin: 1rem 0; font-size: 0.85rem; }
  .subject { font-weight: 700; text-transform: uppercase; margin: 1.5rem 0; text-align: center; }
  .content { text-align: justify; }
  .content p { text-indent: 1.25cm; margin-bottom: 0.75rem; }
  .signature { margin-top: 3rem; display: flex; justify-content: space-between; font-weight: 700; }
  .footer { margin-top: 2rem; font-size: 0.75rem; color: #666; border-top: 1px solid #ccc; padding-top: 0.5rem; }
</style></head>
<body>
  <div class="header">
    <div class="org-name">${escapeHtml(config.orgName)}</div>
    <div class="tagline">${escapeHtml(config.orgTagline)}</div>
    <div class="contacts">
      ${escapeHtml(config.address)}<br/>
      Утас: ${escapeHtml(config.phone)} | И-мэйл: ${escapeHtml(config.email)}${config.web ? ` | Вэб: ${escapeHtml(config.web)}` : ''}
    </div>
  </div>
  <div class="meta">
    <strong>Огноо:</strong> ${escapeHtml(formattedDate)}&nbsp;&nbsp;&nbsp;
    <strong>№:</strong> ${escapeHtml(config.docIndex || '—')}<br/>
    ${config.tanaiRef ? `<strong>Танай:</strong> ${escapeHtml(config.tanaiRef)}&nbsp;&nbsp;<strong>№:</strong> ${escapeHtml(config.tanaiNo || '—')}<br/>` : ''}
    <strong>Хэнд:</strong> ${escapeHtml(config.addresseeOrg)} — ${escapeHtml(config.addresseeName)}
  </div>
  <div class="subject">${escapeHtml(config.subject)}</div>
  <div class="content">
    ${config.content.split('\n').filter(p => p.trim()).map(p => `<p>${escapeHtml(p)}</p>`).join('')}
  </div>
  <div class="signature">
    <span>${escapeHtml(config.signPosition)}</span>
    <span>_______________</span>
    <span>${escapeHtml(config.signName)}</span>
  </div>
  <div class="footer">Энэ имэйл Nege Management System-ээс автоматаар илгээгдсэн.</div>
</body>
</html>`;

    try {
        await resend.emails.send({
            from: process.env.RESEND_FROM_EMAIL || 'noreply@nege.mn',
            to: [toEmail],
            subject,
            html: htmlBody,
        });
        return NextResponse.json({ success: true });
    } catch (e: any) {
        console.error('[official-letters/send-email]', e);
        return NextResponse.json({ error: e.message || 'Имэйл илгээхэд алдаа гарлаа' }, { status: 500 });
    }
}
