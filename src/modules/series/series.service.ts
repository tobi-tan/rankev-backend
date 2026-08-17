import { and, asc, count, eq, max } from 'drizzle-orm';
import { db } from '../../db';
import { series, seriesPosts, users, posts } from '../../db/schema';
import { forbidden, notFound } from '../../lib/errors';
import { toPublicUser } from '../users/users.serializer';
import { summariesByIds, type FeedSummary } from '../feed/feed.service';

/** Series (chapter) mà một post thuộc về — để đính kèm vào view chi tiết. */
export async function getPostSeries(
  postId: string,
): Promise<{ seriesId: string; seriesName: string } | null> {
  const [row] = await db
    .select({ seriesId: seriesPosts.seriesId, name: series.name })
    .from(seriesPosts)
    .innerJoin(series, eq(series.id, seriesPosts.seriesId))
    .where(eq(seriesPosts.postId, postId))
    .limit(1);
  return row ? { seriesId: row.seriesId, seriesName: row.name } : null;
}

async function assertOwner(seriesId: string, userId: string) {
  const [s] = await db.select().from(series).where(eq(series.id, seriesId));
  if (!s) throw notFound('Series not found');
  if (s.authorId !== userId) throw forbidden('Only the series owner can modify it');
  return s;
}

/** Danh sách series của một tác giả (để chọn khi thêm chapter mới). */
export async function listByAuthor(authorId: string): Promise<{ id: string; name: string; postCount: number }[]> {
  const rows = await db
    .select({ id: series.id, name: series.name })
    .from(series)
    .where(eq(series.authorId, authorId))
    .orderBy(asc(series.createdAt));
  const counts = await db
    .select({ seriesId: seriesPosts.seriesId, c: count() })
    .from(seriesPosts)
    .groupBy(seriesPosts.seriesId);
  const countMap = new Map(counts.map((r) => [r.seriesId, Number(r.c)]));
  return rows.map((r) => ({ id: r.id, name: r.name, postCount: countMap.get(r.id) ?? 0 }));
}

export async function createSeries(authorId: string, name: string) {
  const [row] = await db.insert(series).values({ name, authorId }).returning();
  return { id: row.id, name: row.name, createdAt: row.createdAt.toISOString() };
}

export async function getSeries(id: string): Promise<{
  id: string;
  name: string;
  createdAt: string;
  author: ReturnType<typeof toPublicUser> | null;
  posts: FeedSummary[];
}> {
  const [s] = await db.select().from(series).where(eq(series.id, id));
  if (!s) throw notFound('Series not found');
  const [author] = await db.select().from(users).where(eq(users.id, s.authorId));

  const rows = await db
    .select({ postId: seriesPosts.postId })
    .from(seriesPosts)
    .where(eq(seriesPosts.seriesId, id))
    .orderBy(asc(seriesPosts.position));

  const items = await summariesByIds(rows.map((r) => r.postId));
  return {
    id: s.id,
    name: s.name,
    createdAt: s.createdAt.toISOString(),
    author: author ? toPublicUser(author) : null,
    posts: items,
  };
}

export async function renameSeries(id: string, userId: string, name: string) {
  await assertOwner(id, userId);
  await db.update(series).set({ name }).where(eq(series.id, id));
  return { id, name };
}

export async function addPost(seriesId: string, userId: string, postId: string, position?: number) {
  await assertOwner(seriesId, userId);
  const [post] = await db.select({ id: posts.id }).from(posts).where(eq(posts.id, postId));
  if (!post) throw notFound('Post not found');

  let pos = position;
  if (pos === undefined) {
    const [row] = await db
      .select({ m: max(seriesPosts.position) })
      .from(seriesPosts)
      .where(eq(seriesPosts.seriesId, seriesId));
    pos = (row?.m ?? -1) + 1;
  }

  await db
    .insert(seriesPosts)
    .values({ seriesId, postId, position: pos })
    .onConflictDoUpdate({
      target: [seriesPosts.seriesId, seriesPosts.postId],
      set: { position: pos },
    });
  return { ok: true };
}

export async function removePost(seriesId: string, userId: string, postId: string) {
  await assertOwner(seriesId, userId);
  await db
    .delete(seriesPosts)
    .where(and(eq(seriesPosts.seriesId, seriesId), eq(seriesPosts.postId, postId)));
}

export async function reorder(seriesId: string, userId: string, postIds: string[]) {
  await assertOwner(seriesId, userId);
  await db.transaction(async (tx) => {
    for (let i = 0; i < postIds.length; i++) {
      await tx
        .update(seriesPosts)
        .set({ position: i })
        .where(and(eq(seriesPosts.seriesId, seriesId), eq(seriesPosts.postId, postIds[i])));
    }
  });
  return { ok: true };
}
