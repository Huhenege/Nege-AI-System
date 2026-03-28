import { NextRequest, NextResponse } from 'next/server';
import { requireTenantAuth } from '@/lib/api/auth-middleware';
import { Resend } from 'resend';
import type { OfficialLetterConfig } from '@/app/dashboard/official-letters/types';

const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * POST /api/official-letters/send-email
 * Албан бичгийг имэйлээр илгээнэ
 */
export async function POST(request: NextRequest) {
    const authResult = await requireTenantAuth(request, { module: 'official_letters' });
    if ('response' in authResult && authResult.response) return authResult.response;

    const { toEmail, config, letterId } = await request.json() as {
        toEmail: string;
        config: OfficialLetterConfig;
        letterId: string;
    };

    if (!toEmail || !config) {
        return NextResponse.json({ error: 'toEmail болон config шаардлагатай' }, { status: 400 });
    }

    const formattedDate = config.docDate ? config.docDate.replace(/-/g, '.') : '';
    const subject = `[${config.docIndex || 'АБ'}] ${config.subject || 'Албан бичиг'} — ${config.orgName}`;

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
    <div class="org-name">${config.orgName}</div>
    <div class="tagline">${config.orgTagline}</div>
    <div class="contacts">
      ${config.address}<br/>
      Утас: ${config.phone} | И-мэйл: ${config.email}${config.web ? ` | Вэб: ${config.web}` : ''}
    </div>
  </div>
  <div class="meta">
    <strong>Огноо:</strong> ${formattedDate}&nbsp;&nbsp;&nbsp;
    <strong>№:</strong> ${config.docIndex || '—'}<br/>
    ${config.tanaiRef ? `<strong>Танай:</strong> ${config.tanaiRef}&nbsp;&nbsp;<strong>№:</strong> ${config.tanaiNo || '—'}<br/>` : ''}
    <strong>Хэнд:</strong> ${config.addresseeOrg} — ${config.addresseeName}
  </div>
  <div class="subject">${config.subject}</div>
  <div class="content">
    ${config.content.split('\n').filter(p => p.trim()).map(p => `<p>${p}</p>`).join('')}
  </div>
  <div class="signature">
    <span>${config.signPosition}</span>
    <span>_______________</span>
    <span>${config.signName}</span>
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
