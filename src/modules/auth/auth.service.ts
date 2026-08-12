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
  if (!user) throw unauthorized('Invalid email or password');

  const ok = await verifyPassword(input.password, user.passwordHash);
  if (!ok) throw unauthorized('Invalid email or password');

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
