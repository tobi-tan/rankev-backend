import { and, arrayContains, desc, eq, inArray, isNull, lt, or, sql, count } from 'drizzle-orm';
import { db } from '../../db';
import { comments, commentRanks, pathUnlocks, posts, users, type Comment } from '../../db/schema';
import { badRequest, forbidden, notFound } from '../../lib/errors';
import { decodeCursor, encodeCursor } from '../../lib/cursor';
import { toPublicUser, type PublicUser } from '../users/users.serializer';
import { toCommentView, type CommentView } from './comments.serializer';
import type { CreateCommentInput, ListCommentsQuery } from './comments.schemas';

async function assertPost(postId: string): Promise<void> {
  const [p] = await db.select({ id: posts.id }).from(posts).where(eq(posts.id, postId));
  if (!p) throw notFound('Post not found');
}

export async function listComments(
  postId: string,
  query: ListCommentsQuery,
  viewerId?: string,
): Promise<{ items: CommentView[]; nextCursor: string | null }> {
  const conditions = [eq(comments.postId, postId)];
  conditions.push(query.parentId ? eq(comments.parentId, query.parentId) : isNull(comments.parentId));

  // Per-ending comment threads (Path): only visible to viewers who have unlocked
  // that ending — enforced server-side so a tampered client can't reveal them (spec §6.5).
  if (query.ending) {
    if (!viewerId) throw forbidden('Sign in to view ending comments');
    const [unlocked] = await db
      .select({ endingName: pathUnlocks.endingName })
      .from(pathUnlocks)
      .where(
        and(
          eq(pathUnlocks.userId, viewerId),
          eq(pathUnlocks.postId, postId),
          eq(pathUnlocks.endingName, query.ending),
        ),
      );
    if (!unlocked) throw forbidden('Unlock this ending to view its comments');
    conditions.push(arrayContains(comments.supports, [query.ending]));
  }

  const cursor = query.cursor ? decodeCursor(query.cursor) : null;
  if (cursor) {
    const d = new Date(cursor.createdAt);
    conditions.push(
      or(lt(comments.createdAt, d), and(eq(comments.createdAt, d), lt(comments.id, cursor.id)))!,
    );
  }

  const rows = await db
    .select({ comment: comments, author: users })
    .from(comments)
    .leftJoin(users, eq(users.id, comments.userId))
    .where(and(...conditions))
    .orderBy(desc(comments.createdAt), desc(comments.id))
    .limit(query.limit + 1);

  const hasMore = rows.length > query.limit;
  const page = hasMore ? rows.slice(0, query.limit) : rows;
  const ids = page.map((r) => r.comment.id);

  const [replyRows, myRankRows] = await Promise.all([
    ids.length
      ? db
          .select({ parentId: comments.parentId, c: count() })
          .from(comments)
          .where(inArray(comments.parentId, ids))
          .groupBy(comments.parentId)
      : Promise.resolve([] as { parentId: string | null; c: number }[]),
    viewerId && ids.length
      ? db
          .select({ commentId: commentRanks.commentId, value: commentRanks.value })
          .from(commentRanks)
          .where(and(eq(commentRanks.userId, viewerId), inArray(commentRanks.commentId, ids)))
      : Promise.resolve([] as { commentId: string; value: number }[]),
  ]);

  const replyCountBy = new Map(replyRows.map((r) => [r.parentId as string, Number(r.c)]));
  const myRankBy = new Map(myRankRows.map((r) => [r.commentId, r.value]));

  const items = page.map((r) => {
    const author: PublicUser | null = r.author ? toPublicUser(r.author) : null;
    return toCommentView(
      r.comment,
      author,
      myRankBy.get(r.comment.id) ?? 0,
      replyCountBy.get(r.comment.id) ?? 0,
    );
  });

  const last = page[page.length - 1];
  const nextCursor =
    hasMore && last
      ? encodeCursor({ createdAt: last.comment.createdAt.toISOString(), id: last.comment.id })
      : null;

  return { items, nextCursor };
}

export async function createComment(
  userId: string,
  postId: string,
  input: CreateCommentInput,
): Promise<CommentView> {
  await assertPost(postId);

  if (input.parentId) {
    const [parent] = await db
      .select({ id: comments.id, postId: comments.postId })
      .from(comments)
      .where(eq(comments.id, input.parentId));
    if (!parent || parent.postId !== postId) throw badRequest('Invalid parent comment');
  }

  const [row] = await db
    .insert(comments)
    .values({
      postId,
      userId,
      parentId: input.parentId,
      text: input.text?.trim() || null,
      imageUrl: input.imageUrl,
      emoji: input.emoji,
      supports: input.supports,
    })
    .returning();

  const [author] = await db.select().from(users).where(eq(users.id, userId));
  return toCommentView(row, author ? toPublicUser(author) : null, 0, 0);
}

export async function rankComment(
  userId: string,
  commentId: string,
  vote: 'up' | 'down',
): Promise<{ rankUp: number; rankDown: number; myRank: -1 | 0 | 1 }> {
  const newVal = vote === 'up' ? 1 : -1;

  const result = await db.transaction(async (tx) => {
    const [target] = await tx
      .select({ id: comments.id })
      .from(comments)
      .where(eq(comments.id, commentId));
    if (!target) throw notFound('Comment not found');

    const [existing] = await tx
      .select()
      .from(commentRanks)
      .where(and(eq(commentRanks.userId, userId), eq(commentRanks.commentId, commentId)))
      .for('update');

    let upDelta = 0;
    let downDelta = 0;
    let myRank: -1 | 0 | 1 = newVal as 1 | -1;

    if (!existing) {
      await tx.insert(commentRanks).values({ userId, commentId, value: newVal });
      if (newVal === 1) upDelta = 1;
      else downDelta = 1;
    } else if (existing.value === newVal) {
      // Toggle off.
      await tx
        .delete(commentRanks)
        .where(and(eq(commentRanks.userId, userId), eq(commentRanks.commentId, commentId)));
      if (newVal === 1) upDelta = -1;
      else downDelta = -1;
      myRank = 0;
    } else {
      // Switch direction.
      await tx
        .update(commentRanks)
        .set({ value: newVal })
        .where(and(eq(commentRanks.userId, userId), eq(commentRanks.commentId, commentId)));
      if (newVal === 1) {
        upDelta = 1;
        downDelta = -1;
      } else {
        upDelta = -1;
        downDelta = 1;
      }
    }

    const [updated] = await tx
      .update(comments)
      .set({
        rankUp: sql`GREATEST(${comments.rankUp} + ${upDelta}, 0)`,
        rankDown: sql`GREATEST(${comments.rankDown} + ${downDelta}, 0)`,
      })
      .where(eq(comments.id, commentId))
      .returning({ rankUp: comments.rankUp, rankDown: comments.rankDown });

    return { rankUp: updated.rankUp, rankDown: updated.rankDown, myRank };
  });

  return result;
}

export async function deleteComment(userId: string, commentId: string): Promise<void> {
  const [c] = await db
    .select({ userId: comments.userId })
    .from(comments)
    .where(eq(comments.id, commentId));
  if (!c) throw notFound('Comment not found');
  if (c.userId !== userId) throw forbidden('Only the author can delete this comment');
  await db.update(comments).set({ deletedAt: new Date() }).where(eq(comments.id, commentId));
}
