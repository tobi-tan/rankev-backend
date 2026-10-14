import { and, eq, isNull, gt, sql } from 'drizzle-orm';
import { db } from '../../db';
import { users, refreshTokens, type User } from '../../db/schema';
import { hashPassword, verifyPassword } from '../../lib/password';
import {
  signAccessToken,
  generateRefreshToken,
  hashToken,
  refreshExpiryDate,
} from '../../lib/tokens';
import { conflict, forbidden, unauthorized } from '../../lib/errors';
import type { RegisterInput, LoginInput } from './auth.schemas';
import type { SocialProfile } from './social';
import { isReservedHandle } from '../users/users.service';

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string; // raw — set as httpOnly cookie by the route
  refreshExpiresAt: Date;
}

export const SUSPENDED_MSG = 'Tài khoản đã bị khoá do vi phạm Tiêu chuẩn cộng đồng. Nếu cho rằng có nhầm lẫn, hãy gửi kháng nghị qua email hỗ trợ.';

/** Cấp phiên mới cho một user (đăng nhập, MXH, làm mới token, quản trị viên "Chuyển sang Rankev"). */
export async function issueTokens(userId: string): Promise<IssuedTokens> {
  // Tài khoản bị khoá (kiểm duyệt) → không cấp phiên mới (đăng nhập, MXH, làm mới token).
  const [u] = await db.select({ suspendedAt: users.suspendedAt }).from(users).where(eq(users.id, userId));
  if (u?.suspendedAt) throw forbidden(SUSPENDED_MSG);
  const accessToken = signAccessToken(userId);
  const { token, hash } = generateRefreshToken();
  const refreshExpiresAt = refreshExpiryDate();
  await db.insert(refreshTokens).values({
    userId,
    tokenHash: hash,
    expiresAt: refreshExpiresAt,
  });
  return { accessToken, refreshToken: token, refreshExpiresAt };
}

export async function register(input: RegisterInput): Promise<{ user: User; tokens: IssuedTokens }> {
  const [existing] = await db
    .select({ id: users.id, email: users.email, handle: users.handle })
    .from(users)
    .where(eq(users.email, input.email.toLowerCase()));
  if (existing) throw conflict('Email already registered');

  const [handleTaken] = await db
    .select({ id: users.id })
    .from(users)
    .where(sql`lower(${users.handle}) = lower(${input.handle})`); // không phân biệt hoa/thường
  if (handleTaken || isReservedHandle(input.handle)) throw conflict('Handle already taken');

  const passwordHash = await hashPassword(input.password);
  const [user] = await db
    .insert(users)
    .values({
      email: input.email.toLowerCase(),
      handle: input.handle,
      name: input.name,
      passwordHash,
    })
    .returning();

  const tokens = await issueTokens(user.id);
  return { user, tokens };
}

export async function login(input: LoginInput): Promise<{ user: User; tokens: IssuedTokens }> {
  const [user] = await db.select().from(users).where(eq(users.email, input.email.toLowerCase()));
  // Constant-ish failure path: still returns a generic message.
  if (!user) throw unauthorized('Sai email hoặc mật khẩu');
  // Tài khoản mạng xã hội (không có mật khẩu) → hướng dẫn dùng nút MXH.
  if (!user.passwordHash) throw unauthorized('Tài khoản này đăng nhập bằng mạng xã hội');

  const ok = await verifyPassword(input.password, user.passwordHash);
  if (!ok) throw unauthorized('Sai email hoặc mật khẩu');

  const tokens = await issueTokens(user.id);
  return { user, tokens };
}

// Handle TẠM ngẫu nhiên cho tài khoản MXH mới — KHÔNG lấy từ email/tên (lộ thông tin cá nhân);
// người dùng tự chọn @handle thật ngay sau khi đăng nhập (handle_confirmed = false).
async function tempHandle(): Promise<string> {
  for (let i = 0; i < 20; i++) {
    const h = 'user_' + Math.random().toString(36).slice(2, 10).padEnd(8, '0');
    const [taken] = await db.select({ id: users.id }).from(users).where(eq(users.handle, h));
    if (!taken) return h;
  }
  return 'user_' + Date.now().toString(36);
}

/** Đăng nhập/đăng ký bằng mạng xã hội: liên kết theo provider hoặc email, tạo mới nếu chưa có. */
/** isNew = vừa TẠO tài khoản (app cho đi qua phần giới thiệu). */
export async function socialLogin(profile: SocialProfile): Promise<{ user: User; tokens: IssuedTokens; isNew: boolean }> {
  // 1) Đã liên kết provider trước đó.
  const [byProvider] = await db
    .select()
    .from(users)
    .where(and(eq(users.provider, profile.provider), eq(users.providerId, profile.providerId)));
  if (byProvider) {
    const tokens = await issueTokens(byProvider.id);
    return { user: byProvider, tokens, isNew: false };
  }

  // 2) Trùng email → liên kết provider vào tài khoản sẵn có.
  if (profile.email) {
    const [byEmail] = await db.select().from(users).where(eq(users.email, profile.email));
    if (byEmail) {
      const [linked] = await db
        .update(users)
        .set({ provider: profile.provider, providerId: profile.providerId, avatarUrl: byEmail.avatarUrl || profile.avatarUrl })
        .where(eq(users.id, byEmail.id))
        .returning();
      const tokens = await issueTokens(linked.id);
      return { user: linked, tokens, isNew: false };
    }
  }

  // 3) Tạo tài khoản mới (không mật khẩu). Email có thể null (Apple ẩn email) → dùng placeholder.
  const email = profile.email || `${profile.provider}_${profile.providerId}@users.rankev.app`;
  const handle = await tempHandle();
  const [user] = await db
    .insert(users)
    .values({
      email,
      handle,
      name: profile.name || handle,
      passwordHash: null,
      provider: profile.provider,
      providerId: profile.providerId,
      avatarUrl: profile.avatarUrl,
      verified: true,
      handleConfirmed: false,
      emailVerified: true, // nhà cung cấp MXH đã xác minh email
    })
    .returning();
  const tokens = await issueTokens(user.id);
  return { user, tokens, isNew: true };
}

/** Validate a raw refresh token, rotate it, and issue a fresh pair. */
export async function refresh(rawToken: string | undefined): Promise<IssuedTokens> {
  if (!rawToken) throw unauthorized('Missing refresh token');
  const tokenHash = hashToken(rawToken);

  const [row] = await db
    .select()
    .from(refreshTokens)
    .where(
      and(
        eq(refreshTokens.tokenHash, tokenHash),
        isNull(refreshTokens.revokedAt),
        gt(refreshTokens.expiresAt, new Date()),
      ),
    );

  if (!row) throw unauthorized('Invalid or expired refresh token');

  // Rotation: revoke the presented token, mint a new pair.
  await db
    .update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(eq(refreshTokens.id, row.id));

  return issueTokens(row.userId);
}

/** Revoke a refresh token on logout (idempotent). */
export async function logout(rawToken: string | undefined): Promise<void> {
  if (!rawToken) return;
  const tokenHash = hashToken(rawToken);
  await db
    .update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(and(eq(refreshTokens.tokenHash, tokenHash), isNull(refreshTokens.revokedAt)));
}
