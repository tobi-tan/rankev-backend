import { and, eq, or, type SQL } from 'drizzle-orm';
import { db } from '../../db';
import { posts } from '../../db/schema';
import { notFound } from '../../lib/errors';
import { isBlockedBetween } from '../moderation/moderation.service';

/**
 * Điều kiện SQL: bài được HIỆN trong danh sách chung (feed, hồ sơ người khác, tìm kiếm).
 * Chủ bài luôn thấy bài của mình; người khác chỉ thấy bài công khai và không bị chủ ẩn.
 * ("Theo link" = không xuất hiện trong danh sách, chỉ mở được bằng link trực tiếp.)
 */
export function listablePostCond(viewerId?: string | null): SQL {
  const pub = and(eq(posts.visibility, 'public'), eq(posts.hidden, false))!;
  return viewerId ? or(eq(posts.authorId, viewerId), pub)! : pub;
}

/**
 * Kiểm tra người xem có được MỞ / TƯƠNG TÁC (vote, bình luận, nộp bài, lưu…) với một bài.
 * Người không phải chủ: bài đã xoá, "chỉ mình tôi", đã ẩn, hoặc hai bên chặn nhau → 404
 * (không tiết lộ là bài có tồn tại). Trả về thông tin cơ bản của bài.
 */
export async function assertPostAccess(postId: string, viewerId?: string | null) {
  if (!/^[0-9a-f-]{36}$/i.test(postId)) throw notFound('Post not found');
  const [p] = await db
    .select({ id: posts.id, authorId: posts.authorId, deletedAt: posts.deletedAt, visibility: posts.visibility, hidden: posts.hidden })
    .from(posts)
    .where(eq(posts.id, postId));
  if (!p) throw notFound('Post not found');
  const owner = !!viewerId && viewerId === p.authorId;
  if (!owner) {
    if (p.deletedAt || p.visibility === 'private' || p.hidden) throw notFound('Post not found');
    if (viewerId && (await isBlockedBetween(viewerId, p.authorId))) throw notFound('Post not found');
  }
  return { ...p, owner };
}

