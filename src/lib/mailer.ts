import { env, isProd } from '../env';

/**
 * Gửi email giao dịch (mã đặt lại mật khẩu…). Dùng Resend (miễn phí 3.000 mail/tháng) khi có
 * RESEND_API_KEY; chưa cấu hình → in ra log (dev/test). Trong test, thư được giữ ở `outbox`.
 */
export interface Mail {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export const outbox: Mail[] = [];

export async function sendMail(mail: Mail): Promise<void> {
  if (env.NODE_ENV === 'test') {
    outbox.push(mail);
    return;
  }
  if (!env.RESEND_API_KEY) {
    if (isProd) console.warn('[mailer] RESEND_API_KEY chưa đặt — không gửi được email tới', mail.to);
    else console.log(`[mailer] (dev) tới ${mail.to}: ${mail.subject}\n${mail.text}`);
    return;
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: env.MAIL_FROM, to: [mail.to], subject: mail.subject, text: mail.text, html: mail.html }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    console.error('[mailer] gửi thất bại', res.status, body.slice(0, 200));
  }
}
