import { and, desc, eq, inArray, lt, notInArray, or, sql } from 'drizzle-orm';
import { db } from '../../db';
import { bookmarks, posts, rankieOptions, users, votes, type RankieOption } from '../../db/schema';
import { forbidden, notFound } from '../../lib/errors';
import { encodeCursor, decodeCursor } from '../../lib/cursor';
import { getBlockedIds } from '../moderation/moderation.service';
import { toPublicUser, type PublicUser } from '../users/users.serializer';
import { toRankieView, type RankieView } from './posts.serializer';
import { getPostSeries } from '../series/series.service';
import type { CreateRankieInput, ListPostsQuery } from './posts.schemas';

async function fetchAuthor(authorId: string): Promise<PublicUser | null> {
  const [author] = await db.select().from(users).where(eq(users.id, authorId));
  return author ? toPublicUser(author) : null;
}

async function fetchMyVote(
  rankieId: string,
  viewerId: string | undefined,
): Promise<{ optionIds: string[]; tapCount: number } | null | undefined> {
  if (!viewerId) return undefined;
  const [row] = await db
    .select({ optionIds: votes.optionIds, tapCount: votes.tapCount })
    .from(votes)
    .where(and(eq(votes.rankieId, rankieId), eq(votes.userId, viewerId)));
  return row ? { optionIds: row.optionIds, tapCount: row.tapCount } : null;
}

export async function createRankie(
  authorId: string,
  input: CreateRankieInput,
): Promise<RankieView> {
  const postId = await db.transaction(async (tx) => {
    const [post] = await tx
      .insert(posts)
      .values({
        type: 'rankie',
        authorId,
        title: input.title,
        subtitle: input.subtitle,
        caption: input.caption,
        category: input.category,
        media: input.media,
        closesAt: input.closesAt,
        live: input.live,
        sponsored: input.sponsored,
        votingType: input.votingType,
        chartType: input.chartType,
        voteMarker: input.voteMarker,
      })
      .returning({ id: posts.id });

    await tx.insert(rankieOptions).values(
      input.options.map((o, i) => ({
        rankieId: post.id,
        label: o.label,
        emoji: o.emoji,
        flag: o.flag,
        imageUrl: o.imageUrl,
        color: o.color,
        position: i,
      })),
    );

    return post.id;
  });

  const view = await getRankieById(postId, authorId);
  return view;
}

/** Return a post's content type (or 404) so routes can dispatch to the right service. */
export async function getPostKind(id: string): Promise<'rankie' | 'path' | 'deck'> {
  const [p] = await db.select({ type: posts.type }).from(posts).where(eq(posts.id, id));
  if (!p) throw notFound('Post not found');
  return p.type;
}

export async function getRankieById(id: string, viewerId?: string): Promise<RankieView> {
  const [post] = await db.select().from(posts).where(eq(posts.id, id));
  if (!post || post.type !== 'rankie') throw notFound('Rankie not found');

  const [author, options, myVote, bookmarked] = await Promise.all([
    fetchAuthor(post.authorId),
    db.select().from(rankieOptions).where(eq(rankieOptions.rankieId, id)),
    fetchMyVote(id, viewerId),
    fetchBookmarked(id, viewerId),
  ]);

  const view = toRankieView(post, author, options, myVote, bookmarked);
  const s = await getPostSeries(id); // đính kèm series (chapter) để web nhóm/chuyển chapter
  return { ...view, seriesId: s?.seriesId ?? null, seriesName: s?.seriesName ?? null };
}

async function fetchBookmarked(
  postId: string,
  viewerId: string | undefined,
): Promise<boolean | undefined> {
  if (!viewerId) return undefined;
  const [row] = await db
    .select({ postId: bookmarks.postId })
    .from(bookmarks)
    .where(and(eq(bookmarks.postId, postId), eq(bookmarks.userId, viewerId)));
  return Boolean(row);
}

export async function listRankies(
  query: ListPostsQuery,
  viewerId?: string,
): Promise<{ items: RankieView[]; nextCursor: string | null }> {
  const conditions = [eq(posts.type, query.type)];
  if (query.category) conditions.push(eq(posts.category, query.category));

  // Hide posts authored by users this viewer has blocked.
  if (viewerId) {
    const blocked = await getBlockedIds(viewerId);
    if (blocked.length) conditions.push(notInArray(posts.authorId, blocked));
  }

  const cursor = query.cursor ? decodeCursor(query.cursor) : null;
  if (cursor) {
    const cursorDate = new Date(cursor.createdAt);
    conditions.push(
      or(
        lt(posts.createdAt, cursorDate),
        and(eq(posts.createdAt, cursorDate), lt(posts.id, cursor.id)),
      )!,
    );
  }

  const rows = await db
    .select({ post: posts, author: users })
    .from(posts)
    .leftJoin(users, eq(users.id, posts.authorId))
    .where(and(...conditions))
    .orderBy(desc(posts.createdAt), desc(posts.id))
    .limit(query.limit + 1);

  const hasMore = rows.length > query.limit;
  const pageRows = hasMore ? rows.slice(0, query.limit) : rows;

  const postIds = pageRows.map((r) => r.post.id);

  // Batch-load options + this viewer's votes for the whole page (avoids N+1).
  const [optionRows, myVoteRows] = await Promise.all([
    postIds.length
      ? db.select().from(rankieOptions).where(inArray(rankieOptions.rankieId, postIds))
      : Promise.resolve([] as RankieOption[]),
    viewerId && postIds.length
      ? db
          .select({
            rankieId: votes.rankieId,
            optionIds: votes.optionIds,
            tapCount: votes.tapCount,
          })
          .from(votes)
          .where(and(eq(votes.userId, viewerId), inArray(votes.rankieId, postIds)))
      : Promise.resolve([] as { rankieId: string; optionIds: string[]; tapCount: number }[]),
  ]);

  const optionsByPost = new Map<string, RankieOption[]>();
  for (const o of optionRows) {
    const list = optionsByPost.get(o.rankieId) ?? [];
    list.push(o);
    optionsByPost.set(o.rankieId, list);
  }
  const voteByPost = new Map(myVoteRows.map((v) => [v.rankieId, v]));

  const items = pageRows.map((r) => {
    const author = r.author ? toPublicUser(r.author) : null;
    const opts = optionsByPost.get(r.post.id) ?? [];
    const myVote = viewerId
      ? (() => {
          const v = voteByPost.get(r.post.id);
          return v ? { optionIds: v.optionIds, tapCount: v.tapCount } : null;
        })()
      : undefined;
    return toRankieView(r.post, author, opts, myVote);
  });

  const last = pageRows[pageRows.length - 1];
  const nextCursor =
    hasMore && last
      ? encodeCursor({ createdAt: last.post.createdAt.toISOString(), id: last.post.id })
      : null;

  return { items, nextCursor };
}

/** Edit a post's metadata + option labels (owner only). Returns its content type. */
export async function updatePost(
  id: string,
  userId: string,
  input: import('./posts.schemas').UpdatePostInput,
): Promise<'rankie' | 'path' | 'deck'> {
  const [post] = await db
    .select({ authorId: posts.authorId, type: posts.type })
    .from(posts)
    .where(eq(posts.id, id));
  if (!post) throw notFound('Post not found');
  if (post.authorId !== userId) throw forbidden('Only the author can edit this post');

  const patch: Record<string, unknown> = {};
  for (const k of [
    'title',
    'subtitle',
    'caption',
    'category',
    'media',
    'voteMarker',
    'closesAt',
    'live',
    'sponsored',
    'chartType',
    'revealMode',
    'hideEndingCount',
  ] as const) {
    if (input[k] !== undefined) patch[k] = input[k];
  }

  await db.transaction(async (tx) => {
    if (Object.keys(patch).length > 0) {
      await tx.update(posts).set(patch).where(eq(posts.id, id));
    }
    if (input.options && post.type === 'rankie') {
      // Reconcile toàn bộ options: giữ phiếu ở option khớp id, thêm option mới (0 phiếu),
      // xoá option cũ không còn trong danh sách (phiếu ở counter của nó biến mất theo).
      const existing = await tx
        .select({ id: rankieOptions.id })
        .from(rankieOptions)
        .where(eq(rankieOptions.rankieId, id));
      const existingIds = new Set(existing.map((e) => e.id));
      const keepIds = new Set(input.options.filter((o) => o.id).map((o) => o.id as string));

      for (const e of existing) {
        if (!keepIds.has(e.id)) {
          await tx.delete(rankieOptions).where(and(eq(rankieOptions.id, e.id), eq(rankieOptions.rankieId, id)));
        }
      }

      let pos = 0;
      for (const o of input.options) {
        if (o.id && existingIds.has(o.id)) {
          const optPatch: Record<string, unknown> = { position: pos };
          for (const key of ['label', 'emoji', 'flag', 'imageUrl', 'color'] as const) {
            if (o[key] !== undefined) optPatch[key] = o[key];
          }
          await tx
            .update(rankieOptions)
            .set(optPatch)
            .where(and(eq(rankieOptions.id, o.id), eq(rankieOptions.rankieId, id)));
        } else {
          await tx.insert(rankieOptions).values({
            rankieId: id,
            label: o.label,
            emoji: o.emoji,
            flag: o.flag,
            imageUrl: o.imageUrl,
            color: o.color,
            position: pos,
          });
        }
        pos++;
      }
    }
  });

  return post.type;
}

export async function deletePost(id: string, userId: string): Promise<void> {
  const [post] = await db.select({ authorId: posts.authorId }).from(posts).where(eq(posts.id, id));
  if (!post) throw notFound('Post not found');
  if (post.authorId !== userId) throw forbidden('Only the author can delete this post');
  // rankie_options / votes / comments / bookmarks cascade via FK ON DELETE CASCADE.
  await db.delete(posts).where(eq(posts.id, id));
}
