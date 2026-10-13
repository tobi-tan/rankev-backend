import { env, isProd } from '../env';

/**
 * Gửi email giao dịch (mã đặt lại mật khẩu…). Dùng Resend (miễn phí 3.000 mail/tháng) khi có
 * RESEND_API_KEY; chưa cấu hình → in ra log (dev/test). Trong test, thư được giữ ở `outbox`.
 * Trả về kết quả gửi (để bàn kiểm duyệt có nút "Gửi email thử" chẩn đoán cấu hình).
 */
export interface Mail {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export interface MailResult {
  ok: boolean;
  provider: 'resend' | 'log' | 'test';
  status?: number;
  error?: string;
}

export const outbox: Mail[] = [];

export async function sendMail(mail: Mail): Promise<MailResult> {
  if (env.NODE_ENV === 'test') {
    outbox.push(mail);
    return { ok: true, provider: 'test' };
  }
  if (!env.RESEND_API_KEY) {
    if (isProd) console.warn('[mailer] RESEND_API_KEY chưa đặt — không gửi được email tới', mail.to);
    else console.log(`[mailer] (dev) tới ${mail.to}: ${mail.subject}\n${mail.text}`);
    return { ok: false, provider: 'log', error: 'RESEND_API_KEY chưa được đặt trên máy chủ' };
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY.trim()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: env.MAIL_FROM, to: [mail.to], subject: mail.subject, text: mail.text, html: mail.html }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      let message = body.slice(0, 300);
      try { message = (JSON.parse(body) as { message?: string }).message || message; } catch { /* giữ nguyên */ }
      console.error('[mailer] gửi thất bại', res.status, message);
      return { ok: false, provider: 'resend', status: res.status, error: message };
    }
    return { ok: true, provider: 'resend', status: res.status };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    console.error('[mailer] lỗi mạng', error);
    return { ok: false, provider: 'resend', error };
  }
}
