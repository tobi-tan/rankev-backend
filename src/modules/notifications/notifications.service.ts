import { and, desc, eq, gte, isNull, sql } from 'drizzle-orm';
import { db } from '../../db';
import { notifications, users, posts, tournaments, rankUps, userBlocks, userMutes } from '../../db/schema';
import { resolveHandles } from '../users/users.service';
import { toPublicUser } from '../users/users.serializer';
import { toNotificationView, type NotificationView } from './notifications.serializer';

const MENTION_RE = /@([a-zA-Z0-9_]{3,20})/g;

/** Rút các @handle xuất hiện trong một đoạn text (không trùng, giữ nguyên chữ gốc). */
export function extractMentions(text: string | null | undefined): string[] {
  if (!text) return [];
  const out = new Set<string>();
  let m: RegExpExecArray | null;
  MENTION_RE.lastIndex = 0;
  while ((m = MENTION_RE.exec(text)) !== null) out.add(m[1]);
  return [...out];
}

/**
 * Tạo thông báo @nhắc tên cho những user được nhắc trong một bình luận.
 * Bỏ qua chính người bình luận. Best-effort: không được làm hỏng việc đăng bình luận.
 */
export async function createMentionNotifications(opts: {
  actorId: string;
  text: string | null | undefined;
  postId?: string | null;
  tournamentId?: string | null;
  commentId?: string | null; // null = @nhắc trong MÔ TẢ bài (không phải bình luận)
}): Promise<string[]> {
  const handles = extractMentions(opts.text);
  if (handles.length === 0) return [];
  const map = await resolveHandles(handles);
  const snippet = (opts.text || '').slice(0, 140);
  const rows = [...map.values()]
    .filter((uid) => uid !== opts.actorId)
    .map((uid) => ({
      userId: uid,
      type: 'mention',
      actorId: opts.actorId,
      postId: opts.postId ?? null,
      tournamentId: opts.tournamentId ?? null,
      commentId: opts.commentId ?? null,
      text: snippet,
    }));
  if (rows.length === 0) return [];
  await db.insert(notifications).values(rows);
  return rows.map((r) => r.userId); // người đã nhận @nhắc (để không báo trùng "bài mới")
}

/**
 * Thông báo BÀI MỚI (rankie/path/survey/exam/giải đấu) tới những người đã RankUp tác giả ở tầng
 * Yêu thích (2) hoặc Fan cuồng (3) — tầng Quan tâm (1) chỉ ưu tiên trên feed, không bị làm phiền
 * (giống "Yêu thích" của Facebook/Instagram). Bỏ qua người đã ẩn (mute) hoặc chặn/bị chặn.
 * Bài hẹn giờ (opensAt tương lai) không báo lúc tạo. Best-effort: không làm hỏng việc đăng bài.
 */
export async function notifyNewPost(authorId: string, target: { postId?: string; tournamentId?: string }, skipUserIds: string[] = []): Promise<void> {
  if (target.postId) {
    const [p] = await db.select({ opensAt: posts.opensAt, deletedAt: posts.deletedAt }).from(posts).where(eq(posts.id, target.postId));
    if (!p || p.deletedAt || (p.opensAt && p.opensAt.getTime() > Date.now())) return;
  }
  const fans = await db
    .select({ userId: rankUps.userId })
    .from(rankUps)
    .where(and(
      eq(rankUps.authorId, authorId),
      gte(rankUps.tier, 2),
      sql`NOT EXISTS (SELECT 1 FROM ${userMutes} m WHERE m.muter_id = ${rankUps.userId} AND m.muted_id = ${authorId})`,
      sql`NOT EXISTS (SELECT 1 FROM ${userBlocks} b WHERE (b.blocker_id = ${rankUps.userId} AND b.blocked_id = ${authorId}) OR (b.blocker_id = ${authorId} AND b.blocked_id = ${rankUps.userId}))`,
    ));
  const rows = fans
    .filter((f) => f.userId !== authorId && !skipUserIds.includes(f.userId)) // đã được @nhắc → 1 thông báo là đủ
    .map((f) => ({ userId: f.userId, type: 'new_post', actorId: authorId, postId: target.postId ?? null, tournamentId: target.tournamentId ?? null }));
  if (rows.length === 0) return;
  await db.insert(notifications).values(rows);
}

export async function listNotifications(userId: string, limit = 40): Promise<NotificationView[]> {
  const rows = await db
    .select({ n: notifications, actor: users, postTitle: posts.title, postType: posts.type, tourTitle: tournaments.title })
    .from(notifications)
    .leftJoin(users, eq(users.id, notifications.actorId))
    .leftJoin(posts, eq(posts.id, notifications.postId))
    .leftJoin(tournaments, eq(tournaments.id, notifications.tournamentId))
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(limit);

  return rows.map((r) =>
    toNotificationView(r.n, r.actor ? toPublicUser(r.actor) : null, r.postTitle ?? r.tourTitle ?? null, r.postType ?? (r.n.tournamentId ? 'tournament' : null)),
  );
}

export async function unreadCount(userId: string): Promise<number> {
  const [row] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
  return row?.c ?? 0;
}

export async function markAllRead(userId: string): Promise<void> {
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
}

export async function markRead(userId: string, id: string): Promise<void> {
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.id, id), eq(notifications.userId, userId)));
}
