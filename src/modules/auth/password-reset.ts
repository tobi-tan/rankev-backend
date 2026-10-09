import { createHash, randomInt, timingSafeEqual } from 'node:crypto';
import { and, desc, eq, gt, isNull } from 'drizzle-orm';
import { db } from '../../db';
import { passwordResets, refreshTokens, users } from '../../db/schema';
import { badRequest } from '../../lib/errors';
import { hashPassword } from '../../lib/password';
import { sendMail } from '../../lib/mailer';

const CODE_TTL_MIN = 15;
const MAX_ATTEMPTS = 5;
const MAX_REQUESTS_PER_HOUR = 3;

const hashCode = (code: string) => createHash('sha256').update(code).digest('hex');
const sameHash = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

/**
 * Gửi mã 6 số đặt lại mật khẩu. LUÔN trả về im lặng (không cho biết email có tồn tại hay
 * không — tránh dò tài khoản). Giới hạn 3 lần/giờ/tài khoản.
 */
export async function requestPasswordReset(emailRaw: string): Promise<void> {
  const email = emailRaw.toLowerCase();
  const [user] = await db.select({ id: users.id, name: users.name }).from(users).where(eq(users.email, email));
  if (!user) return;
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const recent = await db
    .select({ id: passwordResets.id })
    .from(passwordResets)
    .where(and(eq(passwordResets.userId, user.id), gt(passwordResets.createdAt, hourAgo)));
  if (recent.length >= MAX_REQUESTS_PER_HOUR) return;

  const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
  await db.insert(passwordResets).values({
    userId: user.id,
    codeHash: hashCode(code),
    expiresAt: new Date(Date.now() + CODE_TTL_MIN * 60 * 1000),
  });
  await sendMail({
    to: email,
    subject: `${code} là mã đặt lại mật khẩu Rankev`,
    text: `Chào ${user.name},\n\nMã đặt lại mật khẩu Rankev của bạn: ${code}\nMã có hiệu lực trong ${CODE_TTL_MIN} phút.\n\nNếu bạn không yêu cầu, hãy bỏ qua email này — mật khẩu của bạn vẫn an toàn.`,
    html: `<p>Chào ${escapeHtml(user.name)},</p><p>Mã đặt lại mật khẩu Rankev của bạn:</p><p style="font-size:28px;font-weight:700;letter-spacing:6px">${code}</p><p>Mã có hiệu lực trong ${CODE_TTL_MIN} phút.</p><p style="color:#666">Nếu bạn không yêu cầu, hãy bỏ qua email này — mật khẩu của bạn vẫn an toàn.</p>`,
  });
}

/** Đổi mật khẩu bằng mã. Thành công → đăng xuất MỌI thiết bị (thu hồi refresh token). */
export async function resetPassword(emailRaw: string, code: string, newPassword: string): Promise<void> {
  const invalid = () => badRequest('Mã không đúng hoặc đã hết hạn');
  const email = emailRaw.toLowerCase();
  const [user] = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
  if (!user) throw invalid();
  const [row] = await db
    .select()
    .from(passwordResets)
    .where(and(eq(passwordResets.userId, user.id), isNull(passwordResets.usedAt), gt(passwordResets.expiresAt, new Date())))
    .orderBy(desc(passwordResets.createdAt))
    .limit(1);
  if (!row || row.attempts >= MAX_ATTEMPTS) throw invalid();
  if (!sameHash(hashCode(code), row.codeHash)) {
    await db.update(passwordResets).set({ attempts: row.attempts + 1 }).where(eq(passwordResets.id, row.id));
    throw invalid();
  }
  const passwordHash = await hashPassword(newPassword);
  await db.transaction(async (tx) => {
    await tx.update(users).set({ passwordHash }).where(eq(users.id, user.id));
    await tx.update(passwordResets).set({ usedAt: new Date() }).where(eq(passwordResets.userId, user.id));
    await tx.update(refreshTokens).set({ revokedAt: new Date() }).where(and(eq(refreshTokens.userId, user.id), isNull(refreshTokens.revokedAt)));
  });
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);
}
