import { and, eq, isNull, gt } from 'drizzle-orm';
import { db } from '../../db';
import { users, refreshTokens, type User } from '../../db/schema';
import { hashPassword, verifyPassword } from '../../lib/password';
import {
  signAccessToken,
  generateRefreshToken,
  hashToken,
  refreshExpiryDate,
} from '../../lib/tokens';
import { conflict, unauthorized } from '../../lib/errors';
import type { RegisterInput, LoginInput } from './auth.schemas';
import type { SocialProfile } from './social';

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string; // raw — set as httpOnly cookie by the route
  refreshExpiresAt: Date;
}

async function issueTokens(userId: string): Promise<IssuedTokens> {
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
    .where(eq(users.handle, input.handle));
  if (handleTaken) throw conflict('Handle already taken');

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

// Sinh handle duy nhất từ tên/email.
async function uniqueHandle(seed: string): Promise<string> {
  const base = (seed || 'user').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9_]/g, '').slice(0, 20) || 'user';
  for (let i = 0; i < 50; i++) {
    const h = i === 0 ? base : `${base}${i}`;
    const [taken] = await db.select({ id: users.id }).from(users).where(eq(users.handle, h));
    if (!taken) return h;
  }
  return `${base}${Date.now().toString(36)}`;
}

/** Đăng nhập/đăng ký bằng mạng xã hội: liên kết theo provider hoặc email, tạo mới nếu chưa có. */
export async function socialLogin(profile: SocialProfile): Promise<{ user: User; tokens: IssuedTokens }> {
  // 1) Đã liên kết provider trước đó.
  const [byProvider] = await db
    .select()
    .from(users)
    .where(and(eq(users.provider, profile.provider), eq(users.providerId, profile.providerId)));
  if (byProvider) {
    const tokens = await issueTokens(byProvider.id);
    return { user: byProvider, tokens };
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
      return { user: linked, tokens };
    }
  }

  // 3) Tạo tài khoản mới (không mật khẩu). Email có thể null (Apple ẩn email) → dùng placeholder.
  const email = profile.email || `${profile.provider}_${profile.providerId}@users.rankev.app`;
  const handle = await uniqueHandle(profile.email ? profile.email.split('@')[0] : profile.name);
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
    })
    .returning();
  const tokens = await issueTokens(user.id);
  return { user, tokens };
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
