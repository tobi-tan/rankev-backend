import { and, eq } from 'drizzle-orm';
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

/** Map of { authorId: tier } for everyone this user has ranked up. */
export async function getMyRankUps(userId: string): Promise<Record<string, number>> {
  const rows = await db
    .select({ authorId: rankUps.authorId, tier: rankUps.tier })
    .from(rankUps)
    .where(eq(rankUps.userId, userId));
  return Object.fromEntries(rows.map((r) => [r.authorId, r.tier]));
}
