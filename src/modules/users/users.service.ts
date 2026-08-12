import { and, desc, eq, ne } from 'drizzle-orm';
import { db } from '../../db';
import { users, posts, participations } from '../../db/schema';
import { conflict, notFound } from '../../lib/errors';
import { summariesByIds, type FeedSummary } from '../feed/feed.service';
import { toPublicUser, type PublicUser } from './users.serializer';
import type { UpdateProfileInput } from './users.schemas';

export async function updateProfile(userId: string, input: UpdateProfileInput): Promise<PublicUser> {
  if (input.handle) {
    const [taken] = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.handle, input.handle), ne(users.id, userId)));
    if (taken) throw conflict('Handle already taken');
  }

  // Only set provided keys (undefined = leave unchanged).
  const patch: Record<string, unknown> = {};
  for (const k of ['name', 'handle', 'bio', 'avatarEmoji', 'avatarColor', 'avatarUrl'] as const) {
    if (input[k] !== undefined) patch[k] = input[k];
  }

  if (Object.keys(patch).length > 0) {
    await db.update(users).set(patch).where(eq(users.id, userId));
  }

  const [user] = await db.select().from(users).where(eq(users.id, userId));
  if (!user) throw notFound('User not found');
  return toPublicUser(user);
}

/** A user's own posts (any type) as feed summaries, newest first. */
export async function getUserPosts(authorId: string): Promise<FeedSummary[]> {
  const rows = await db
    .select({ id: posts.id })
    .from(posts)
    .where(eq(posts.authorId, authorId))
    .orderBy(desc(posts.createdAt), desc(posts.id))
    .limit(100);
  return summariesByIds(rows.map((r) => r.id));
}

export interface HistoryItem {
  postId: string;
  type: string;
  deckMode: string | null;
  title: string;
  category: string | null;
  endingName: string | null;
  score: number | null;
  correctCount: number | null;
  totalGradable: number | null;
  detail: string | null;
  participatedAt: string;
}

/** Participation history (Path endings + Deck results), newest first. */
export async function getHistory(userId: string): Promise<HistoryItem[]> {
  const rows = await db
    .select({ part: participations, post: posts })
    .from(participations)
    .innerJoin(posts, eq(posts.id, participations.postId))
    .where(eq(participations.userId, userId))
    .orderBy(desc(participations.updatedAt))
    .limit(100);

  return rows.map((r) => ({
    postId: r.part.postId,
    type: r.part.type,
    deckMode: r.part.deckMode,
    title: r.post.title,
    category: r.post.category,
    endingName: r.part.endingName,
    score: r.part.score === null ? null : Number(r.part.score),
    correctCount: r.part.correctCount,
    totalGradable: r.part.totalGradable,
    detail: r.part.detail,
    participatedAt: r.part.updatedAt.toISOString(),
  }));
}
