import { and, eq, sql } from 'drizzle-orm';
import { db } from '../../db';
import { rankUps, users } from '../../db/schema';
import { badRequest, notFound } from '../../lib/errors';

/**
 * Tiered "follow" (RankUp): 1=Quan tâm, 2=Yêu thích, 3=Fan cuồng. tier 0 removes it.
 */
export async function setRankUp(userId: string, authorId: string, tier: number): Promise<{ tier: number }> {
  if (userId === authorId) throw badRequest('You cannot RankUp yourself');
  if (![0, 1, 2, 3].includes(tier)) throw badRequest('tier must be 0, 1, 2, or 3');

  const [author] = await db.select({ id: users.id }).from(users).where(eq(users.id, authorId));
  if (!author) throw notFound('User not found');

  if (tier === 0) {
    await db.delete(rankUps).where(and(eq(rankUps.userId, userId), eq(rankUps.authorId, authorId)));
    return { tier: 0 };
  }

  await db
    .insert(rankUps)
    .values({ userId, authorId, tier })
    .onConflictDoUpdate({
      target: [rankUps.userId, rankUps.authorId],
      set: { tier, updatedAt: new Date() },
    });
  return { tier };
}

/** Số người đã RankUp một tác giả ở mỗi tầng (1=Quan tâm, 2=Yêu thích, 3=Fan cuồng). */
export async function getRankUpCounts(authorId: string): Promise<{ tier1: number; tier2: number; tier3: number; total: number }> {
  const rows = await db
    .select({ tier: rankUps.tier, c: sql<number>`count(*)::int` })
    .from(rankUps)
    .where(eq(rankUps.authorId, authorId))
    .groupBy(rankUps.tier);
  const by = new Map(rows.map((r) => [Number(r.tier), Number(r.c)]));
  const tier1 = by.get(1) ?? 0, tier2 = by.get(2) ?? 0, tier3 = by.get(3) ?? 0;
  return { tier1, tier2, tier3, total: tier1 + tier2 + tier3 };
}

/** Map of { authorId: tier } for everyone this user has ranked up. */
export async function getMyRankUps(userId: string): Promise<Record<string, number>> {
  const rows = await db
    .select({ authorId: rankUps.authorId, tier: rankUps.tier })
    .from(rankUps)
    .where(eq(rankUps.userId, userId));
  return Object.fromEntries(rows.map((r) => [r.authorId, r.tier]));
}
