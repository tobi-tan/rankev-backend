import { env, isProd } from '../env';

/**
 * Gửi email giao dịch (mã đặt lại mật khẩu, báo cáo mới…). Thứ tự nhà cung cấp:
 *  1. Brevo (BREVO_API_KEY) — miễn phí 300 thư/ngày, chỉ cần xác minh MỘT địa chỉ gửi (vd Gmail
 *     của chủ app), gửi được tới MỌI người, không cần tên miền.
 *  2. Resend (RESEND_API_KEY) — khi chưa xác minh tên miền chỉ gửi được tới chủ tài khoản Resend.
 *  3. Không có gì → in ra log (dev). Trong test, thư được giữ ở `outbox`.
 * Đều gửi qua HTTPS (Render gói miễn phí CHẶN cổng SMTP 25/465/587 từ 26/09/2025).
 * Trả về kết quả gửi (nút "Gửi email thử" ở bàn kiểm duyệt dùng để chẩn đoán cấu hình).
 */
export interface Mail {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export interface MailResult {
  ok: boolean;
  provider: 'brevo' | 'resend' | 'log' | 'test';
  status?: number;
  error?: string;
}

export const outbox: Mail[] = [];

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);

async function post(provider: 'brevo' | 'resend', url: string, headers: Record<string, string>, body: unknown): Promise<MailResult> {
  try {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', accept: 'application/json', ...headers }, body: JSON.stringify(body) });
    if (!res.ok) {
      const raw = await res.text().catch(() => '');
      let message = raw.slice(0, 300);
      try { message = (JSON.parse(raw) as { message?: string }).message || message; } catch { /* giữ nguyên */ }
      console.error(`[mailer] ${provider} gửi thất bại`, res.status, message);
      return { ok: false, provider, status: res.status, error: message };
    }
    return { ok: true, provider, status: res.status };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    console.error(`[mailer] ${provider} lỗi mạng`, error);
    return { ok: false, provider, error };
  }
}

export async function sendMail(mail: Mail): Promise<MailResult> {
  if (env.NODE_ENV === 'test') {
    outbox.push(mail);
    return { ok: true, provider: 'test' };
  }
  if (env.BREVO_API_KEY) {
    const sender = (env.BREVO_SENDER || env.SUPPORT_EMAIL).trim();
    return post('brevo', 'https://api.brevo.com/v3/smtp/email', { 'api-key': env.BREVO_API_KEY.trim() }, {
      sender: { name: 'Rankev', email: sender },
      to: [{ email: mail.to }],
      subject: mail.subject,
      textContent: mail.text,
      htmlContent: mail.html || `<p>${escapeHtml(mail.text).replace(/\n/g, '<br>')}</p>`,
    });
  }
  if (env.RESEND_API_KEY) {
    return post('resend', 'https://api.resend.com/emails', { Authorization: `Bearer ${env.RESEND_API_KEY.trim()}` }, {
      from: env.MAIL_FROM, to: [mail.to], subject: mail.subject, text: mail.text, html: mail.html,
    });
  }
  if (isProd) console.warn('[mailer] chưa cấu hình BREVO_API_KEY / RESEND_API_KEY — không gửi được email tới', mail.to);
  else console.log(`[mailer] (dev) tới ${mail.to}: ${mail.subject}\n${mail.text}`);
  return { ok: false, provider: 'log', error: 'Chưa đặt BREVO_API_KEY hoặc RESEND_API_KEY trên máy chủ' };
}
