import { createHash, randomInt, timingSafeEqual } from 'node:crypto';
import { and, desc, eq, gt, isNull } from 'drizzle-orm';
import { db } from '../../db';
import { emailVerifications, users } from '../../db/schema';
import { badRequest, notFound } from '../../lib/errors';
import { sendMail } from '../../lib/mailer';
import { isProd } from '../../env';

/**
 * XÁC MINH EMAIL "MỀM" (kiểu X/Twitter): đăng ký xong dùng app ngay; máy chủ gửi mã 6 số,
 * app chỉ hiện lời nhắc cho tới khi người dùng nhập mã. Không chặn tính năng nào.
 */
const CODE_TTL_MIN = 30;
const MAX_ATTEMPTS = 5;
const MAX_SENDS_PER_HOUR = 3;

const hashCode = (code: string) => createHash('sha256').update(code).digest('hex');
const sameHash = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

/** Gửi mã xác minh. Trả 'sent' | 'already' (đã xác minh) | 'limited' (quá 3 lần/giờ) | 'failed'. */
export async function sendVerificationCode(userId: string): Promise<'sent' | 'already' | 'limited' | 'failed'> {
  const [u] = await db.select({ email: users.email, name: users.name, verified: users.emailVerified }).from(users).where(eq(users.id, userId));
  if (!u) throw notFound('User not found');
  if (u.verified) return 'already';
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const recent = await db.select({ id: emailVerifications.id }).from(emailVerifications)
    .where(and(eq(emailVerifications.userId, userId), gt(emailVerifications.createdAt, hourAgo)));
  if (recent.length >= MAX_SENDS_PER_HOUR) return 'limited';
  const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
  await db.insert(emailVerifications).values({ userId, codeHash: hashCode(code), expiresAt: new Date(Date.now() + CODE_TTL_MIN * 60 * 1000) });
  const r = await sendMail({
    to: u.email,
    subject: `${code} là mã xác minh email Rankev`,
    text: `Chào ${u.name},\n\nMã xác minh email Rankev của bạn: ${code}\nMã có hiệu lực trong ${CODE_TTL_MIN} phút.\n\nXác minh email giúp bạn lấy lại tài khoản khi quên mật khẩu. Nếu bạn không đăng ký Rankev, hãy bỏ qua email này.`,
    html: `<p>Chào ${escapeHtml(u.name)},</p><p>Mã xác minh email Rankev của bạn:</p><p style="font-size:28px;font-weight:700;letter-spacing:6px">${code}</p><p>Mã có hiệu lực trong ${CODE_TTL_MIN} phút.</p><p style="color:#666">Xác minh email giúp bạn lấy lại tài khoản khi quên mật khẩu. Nếu bạn không đăng ký Rankev, hãy bỏ qua email này.</p>`,
  });
  // dev không có khoá gửi thư: mã in ra log máy chủ → coi như đã gửi
  return r.ok || (r.provider === 'log' && !isProd) ? 'sent' : 'failed';
}

/** Nhập mã → đánh dấu email đã xác minh. */
export async function verifyEmailCode(userId: string, code: string): Promise<void> {
  const invalid = () => badRequest('Mã không đúng hoặc đã hết hạn');
  const [row] = await db.select().from(emailVerifications)
    .where(and(eq(emailVerifications.userId, userId), isNull(emailVerifications.usedAt), gt(emailVerifications.expiresAt, new Date())))
    .orderBy(desc(emailVerifications.createdAt)).limit(1);
  if (!row || row.attempts >= MAX_ATTEMPTS) throw invalid();
  if (!sameHash(hashCode(code), row.codeHash)) {
    await db.update(emailVerifications).set({ attempts: row.attempts + 1 }).where(eq(emailVerifications.id, row.id));
    throw invalid();
  }
  await db.transaction(async (tx) => {
    await tx.update(users).set({ emailVerified: true }).where(eq(users.id, userId));
    await tx.update(emailVerifications).set({ usedAt: new Date() }).where(eq(emailVerifications.userId, userId));
  });
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);
}
