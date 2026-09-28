import { and, desc, eq, or, sql, type SQL, type AnyColumn } from 'drizzle-orm';
import { db } from '../../db';
import { comments, hiddenPosts, posts, reports, userBlocks, userMutes, users } from '../../db/schema';
import { badRequest, notFound } from '../../lib/errors';
import type { ReportInput } from './moderation.schemas';

type TargetType = 'post' | 'comment' | 'user';

async function assertTargetExists(type: TargetType, id: string): Promise<void> {
  const table = type === 'post' ? posts : type === 'comment' ? comments : users;
  const [row] = await db.select({ id: table.id }).from(table).where(eq(table.id, id));
  if (!row) throw notFound(`${type} not found`);
}

/** Record a content/user report (idempotent per reporter+target). */
export async function report(
  reporterId: string,
  type: TargetType,
  targetId: string,
  input: ReportInput,
): Promise<void> {
  await assertTargetExists(type, targetId);
  await db
    .insert(reports)
    .values({
      reporterId,
      targetType: type,
      targetId,
      reason: input.reason,
      note: input.note,
    })
    .onConflictDoNothing();
}

export async function blockUser(blockerId: string, blockedId: string): Promise<void> {
  if (blockerId === blockedId) throw badRequest('You cannot block yourself');
  await assertTargetExists('user', blockedId);
  await db.insert(userBlocks).values({ blockerId, blockedId }).onConflictDoNothing();
}

export async function unblockUser(blockerId: string, blockedId: string): Promise<void> {
  await db
    .delete(userBlocks)
    .where(and(eq(userBlocks.blockerId, blockerId), eq(userBlocks.blockedId, blockedId)));
}

/** Ids this viewer has blocked — used to filter them out of feeds. */
export async function getBlockedIds(viewerId: string): Promise<string[]> {
  const rows = await db
    .select({ blockedId: userBlocks.blockedId })
    .from(userBlocks)
    .where(eq(userBlocks.blockerId, viewerId));
  return rows.map((r) => r.blockedId);
}

/** Hai người có chặn nhau (bất kỳ chiều nào) không — dùng cho tin nhắn. */
export async function isBlockedBetween(a: string, b: string): Promise<boolean> {
  const [row] = await db
    .select({ x: userBlocks.blockerId })
    .from(userBlocks)
    .where(
      or(
        and(eq(userBlocks.blockerId, a), eq(userBlocks.blockedId, b)),
        and(eq(userBlocks.blockerId, b), eq(userBlocks.blockedId, a)),
      ),
    )
    .limit(1);
  return Boolean(row);
}

// ---- "Ẩn bài của @x" (mute) ----
export async function muteUser(muterId: string, mutedId: string): Promise<void> {
  if (muterId === mutedId) throw badRequest('Không thể ẩn chính mình');
  await assertTargetExists('user', mutedId);
  await db.insert(userMutes).values({ muterId, mutedId }).onConflictDoNothing();
}

export async function unmuteUser(muterId: string, mutedId: string): Promise<void> {
  await db.delete(userMutes).where(and(eq(userMutes.muterId, muterId), eq(userMutes.mutedId, mutedId)));
}

// ---- "Không quan tâm" (ẩn 1 bài) ----
export async function hidePost(userId: string, postId: string): Promise<void> {
  await assertTargetExists('post', postId);
  await db.insert(hiddenPosts).values({ userId, postId }).onConflictDoNothing();
}

export async function unhidePost(userId: string, postId: string): Promise<void> {
  await db.delete(hiddenPosts).where(and(eq(hiddenPosts.userId, userId), eq(hiddenPosts.postId, postId)));
}

/** Xoá mọi bài đã "Không quan tâm" (khôi phục feed). */
export async function clearHiddenPosts(userId: string): Promise<void> {
  await db.delete(hiddenPosts).where(eq(hiddenPosts.userId, userId));
}

const USER_COLS = {
  id: users.id,
  name: users.name,
  handle: users.handle,
  avatarEmoji: users.avatarEmoji,
  avatarColor: users.avatarColor,
  avatarUrl: users.avatarUrl,
};

/** Toàn bộ thiết lập kiểm soát feed của người xem (cho trang Quyền riêng tư + lọc phía web). */
export async function getModeration(viewerId: string) {
  const [blocked, muted, hidden] = await Promise.all([
    db
      .select(USER_COLS)
      .from(userBlocks)
      .innerJoin(users, eq(users.id, userBlocks.blockedId))
      .where(eq(userBlocks.blockerId, viewerId))
      .orderBy(desc(userBlocks.createdAt)),
    db
      .select(USER_COLS)
      .from(userMutes)
      .innerJoin(users, eq(users.id, userMutes.mutedId))
      .where(eq(userMutes.muterId, viewerId))
      .orderBy(desc(userMutes.createdAt)),
    db.select({ postId: hiddenPosts.postId }).from(hiddenPosts).where(eq(hiddenPosts.userId, viewerId)),
  ]);
  return { blocked, muted, hiddenPostIds: hidden.map((h) => h.postId) };
}

/**
 * Điều kiện SQL lọc feed cho người xem (1 lượt truy vấn, dạng subquery): bỏ bài của người
 * mình chặn, người chặn mình, người mình đã ẩn, và các bài mình đã "Không quan tâm".
 */
export function feedExclusions(viewerId: string, authorCol: AnyColumn, postIdCol: AnyColumn): SQL[] {
  return [
    sql`${authorCol} NOT IN (SELECT blocked_id FROM user_blocks WHERE blocker_id = ${viewerId})`,
    sql`${authorCol} NOT IN (SELECT blocker_id FROM user_blocks WHERE blocked_id = ${viewerId})`,
    sql`${authorCol} NOT IN (SELECT muted_id FROM user_mutes WHERE muter_id = ${viewerId})`,
    sql`${postIdCol} NOT IN (SELECT post_id FROM hidden_posts WHERE user_id = ${viewerId})`,
  ];
}
