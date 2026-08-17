import { and, desc, eq, inArray, isNull, lt, notInArray, or, sql, count } from 'drizzle-orm';
import { db } from '../../db';
import {
  posts,
  users,
  rankieOptions,
  pathEndings,
  deckQuestions,
  participations,
  comments,
  series,
  seriesPosts,
  type Post,
  type User,
} from '../../db/schema';
import { decodeCursor, encodeCursor } from '../../lib/cursor';
import { getBlockedIds } from '../moderation/moderation.service';
import { toPublicUser, type PublicUser } from '../users/users.serializer';

export interface FeedOption {
  label: string | null;
  emoji: string | null;
  votes: number;
  color: string | null;
}

export interface FeedSummary {
  id: string;
  type: 'rankie' | 'path' | 'deck';
  deckMode: 'survey' | 'exam' | null;
  title: string;
  subtitle: string | null;
  category: string | null;
  media: unknown;
  voteMarker: unknown;
  createdAt: string;
  closesAt: string | null;
  closed: boolean;
  live: boolean;
  votingType: 'single' | 'multiple' | 'rating' | 'unlimited' | null;
  seriesId: string | null;
  seriesName: string | null;
  author: PublicUser | null;
  /** rankie=total votes, path/deck=participants */
  engagement: number;
  /** rankie=options, path=endings, deck=questions */
  size: number;
  commentsCount: number;
  /** top options for rankie cards (sorted desc, up to 4) */
  options?: FeedOption[];
}

export interface FeedQuery {
  type?: 'rankie' | 'path' | 'deck';
  cursor?: string | null;
  limit: number;
}

async function buildSummaries(rows: { post: Post; author: User | null }[]): Promise<FeedSummary[]> {
  const rankieIds = rows.filter((r) => r.post.type === 'rankie').map((r) => r.post.id);
  const pathIds = rows.filter((r) => r.post.type === 'path').map((r) => r.post.id);
  const deckIds = rows.filter((r) => r.post.type === 'deck').map((r) => r.post.id);
  const allIds = rows.map((r) => r.post.id);

  const [rankieOptRows, pathEnds, deckQs, parts, commentRows] = await Promise.all([
    rankieIds.length
      ? db
          .select({
            rankieId: rankieOptions.rankieId,
            label: rankieOptions.label,
            emoji: rankieOptions.emoji,
            votes: rankieOptions.votes,
            color: rankieOptions.color,
          })
          .from(rankieOptions)
          .where(inArray(rankieOptions.rankieId, rankieIds))
      : Promise.resolve([] as { rankieId: string; label: string | null; emoji: string | null; votes: number; color: string | null }[]),
    pathIds.length
      ? db
          .select({ id: pathEndings.postId, c: count() })
          .from(pathEndings)
          .where(inArray(pathEndings.postId, pathIds))
          .groupBy(pathEndings.postId)
      : Promise.resolve([] as { id: string; c: number }[]),
    deckIds.length
      ? db
          .select({ id: deckQuestions.postId, c: count() })
          .from(deckQuestions)
          .where(inArray(deckQuestions.postId, deckIds))
          .groupBy(deckQuestions.postId)
      : Promise.resolve([] as { id: string; c: number }[]),
    allIds.length
      ? db
          .select({ id: participations.postId, c: count() })
          .from(participations)
          .where(inArray(participations.postId, allIds))
          .groupBy(participations.postId)
      : Promise.resolve([] as { id: string; c: number }[]),
    allIds.length
      ? db
          .select({ id: comments.postId, c: count() })
          .from(comments)
          .where(and(inArray(comments.postId, allIds), isNull(comments.deletedAt)))
          .groupBy(comments.postId)
      : Promise.resolve([] as { id: string; c: number }[]),
  ]);

  // Group rankie options → total votes, count, and top-4 sorted desc.
  const rankieAgg = new Map<string, { total: number; size: number; top: FeedOption[] }>();
  for (const o of rankieOptRows) {
    const a = rankieAgg.get(o.rankieId) ?? { total: 0, size: 0, top: [] };
    a.total += Number(o.votes);
    a.size += 1;
    a.top.push({ label: o.label, emoji: o.emoji, votes: Number(o.votes), color: o.color });
    rankieAgg.set(o.rankieId, a);
  }
  for (const a of rankieAgg.values()) {
    a.top.sort((x, y) => y.votes - x.votes);
    a.top = a.top.slice(0, 4);
  }

  const endsBy = new Map(pathEnds.map((r) => [r.id, Number(r.c)]));
  const qsBy = new Map(deckQs.map((r) => [r.id, Number(r.c)]));
  const partsBy = new Map(parts.map((r) => [r.id, Number(r.c)]));
  const commentsBy = new Map(commentRows.map((r) => [r.id, Number(r.c)]));

  // Series của mỗi post (qua bảng join series_posts) — để web nhóm chapter.
  const seriesRows = allIds.length
    ? await db
        .select({ postId: seriesPosts.postId, seriesId: seriesPosts.seriesId, name: series.name })
        .from(seriesPosts)
        .innerJoin(series, eq(series.id, seriesPosts.seriesId))
        .where(inArray(seriesPosts.postId, allIds))
    : [];
  const seriesBy = new Map(seriesRows.map((r) => [r.postId, { seriesId: r.seriesId, seriesName: r.name }]));

  return rows.map((r) => {
    const p = r.post;
    const agg = rankieAgg.get(p.id);
    const engagement = p.type === 'rankie' ? agg?.total ?? 0 : partsBy.get(p.id) ?? 0;
    const size =
      p.type === 'rankie'
        ? agg?.size ?? 0
        : p.type === 'path'
          ? endsBy.get(p.id) ?? 0
          : qsBy.get(p.id) ?? 0;
    return {
      id: p.id,
      type: p.type,
      deckMode: p.deckMode,
      title: p.title,
      subtitle: p.subtitle,
      category: p.category,
      media: p.media,
      voteMarker: p.voteMarker,
      createdAt: p.createdAt.toISOString(),
      closesAt: p.closesAt ? p.closesAt.toISOString() : null,
      closed: p.closesAt ? p.closesAt.getTime() <= Date.now() : false,
      live: p.live,
      votingType: p.votingType,
      seriesId: seriesBy.get(p.id)?.seriesId ?? null,
      seriesName: seriesBy.get(p.id)?.seriesName ?? null,
      author: r.author ? toPublicUser(r.author) : null,
      engagement,
      size,
      commentsCount: commentsBy.get(p.id) ?? 0,
      options: p.type === 'rankie' ? agg?.top ?? [] : undefined,
    };
  });
}

export async function listFeed(
  query: FeedQuery,
  viewerId?: string,
): Promise<{ items: FeedSummary[]; nextCursor: string | null }> {
  const conditions = [] as any[];
  if (query.type) conditions.push(eq(posts.type, query.type));
  if (viewerId) {
    const blocked = await getBlockedIds(viewerId);
    if (blocked.length) conditions.push(notInArray(posts.authorId, blocked));
  }
  const cursor = query.cursor ? decodeCursor(query.cursor) : null;
  if (cursor) {
    const d = new Date(cursor.createdAt);
    conditions.push(
      or(lt(posts.createdAt, d), and(eq(posts.createdAt, d), lt(posts.id, cursor.id)))!,
    );
  }

  const rows = await db
    .select({ post: posts, author: users })
    .from(posts)
    .leftJoin(users, eq(users.id, posts.authorId))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(posts.createdAt), desc(posts.id))
    .limit(query.limit + 1);

  const hasMore = rows.length > query.limit;
  const page = hasMore ? rows.slice(0, query.limit) : rows;
  const items = await buildSummaries(page);

  const last = page[page.length - 1];
  const nextCursor =
    hasMore && last
      ? encodeCursor({ createdAt: last.post.createdAt.toISOString(), id: last.post.id })
      : null;

  return { items, nextCursor };
}

export async function summariesByIds(ids: string[], _viewerId?: string): Promise<FeedSummary[]> {
  if (ids.length === 0) return [];
  const rows = await db
    .select({ post: posts, author: users })
    .from(posts)
    .leftJoin(users, eq(users.id, posts.authorId))
    .where(inArray(posts.id, ids));
  const summaries = await buildSummaries(rows);
  const byId = new Map(summaries.map((s) => [s.id, s]));
  return ids.map((id) => byId.get(id)).filter((s): s is FeedSummary => Boolean(s));
}
