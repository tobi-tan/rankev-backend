import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import { db } from '../../db';
import { comments, notifications, posts, refreshTokens, reports, users } from '../../db/schema';
import { adminEmails } from '../../env';
import { badRequest, forbidden, notFound } from '../../lib/errors';
import { sendMail } from '../../lib/mailer';

/**
 * KIỂM DUYỆT (App Store 1.2 · Google Play nội dung do người dùng tạo):
 * quản trị viên (email nằm trong ADMIN_EMAILS) xem báo cáo — GỘP theo nội dung bị báo cáo —
 * và xử lý: bỏ qua · gỡ nội dung · khoá tài khoản. Người báo cáo nhận thông báo kết quả.
 */

export async function isAdmin(userId: string): Promise<boolean> {
  if (!adminEmails.length) return false;
  const [u] = await db.select({ email: users.email }).from(users).where(eq(users.id, userId));
  return !!u && adminEmails.includes(u.email.toLowerCase());
}

export async function assertAdmin(userId: string): Promise<void> {
  if (!(await isAdmin(userId))) throw forbidden('Chỉ quản trị viên');
}

type TargetType = 'post' | 'comment' | 'user';

export interface ReportGroup {
  targetType: TargetType;
  targetId: string;
  count: number;
  reasons: Record<string, number>;
  notes: string[];
  firstAt: string;
  lastAt: string;
  status: string;
  resolution: string | null;
  resolvedAt: string | null;
  target: {
    exists: boolean;
    title?: string | null;
    text?: string | null;
    postType?: string | null;
    postId?: string | null;
    removed?: boolean;
    suspended?: boolean;
    author?: { id: string; handle: string; name: string; suspended: boolean } | null;
  };
}

/** Báo cáo gộp theo nội dung. `open` = chưa xử lý (cũ nhất trước — để kịp hạn 24 giờ). */
export async function listReports(status: 'open' | 'done', limit = 100, targetId?: string): Promise<ReportGroup[]> {
  const open = status === 'open';
  const rows = await db
    .select({
      targetType: reports.targetType,
      targetId: reports.targetId,
      count: sql<number>`count(*)::int`,
      reasons: sql<string[]>`array_agg(${reports.reason})`,
      notes: sql<(string | null)[]>`array_agg(${reports.note})`,
      firstAt: sql<Date>`min(${reports.createdAt})`.mapWith((v) => new Date(v)),
      lastAt: sql<Date>`max(${reports.createdAt})`.mapWith((v) => new Date(v)),
      status: sql<string>`max(${reports.status})`,
      resolution: sql<string | null>`max(${reports.resolution})`,
      resolvedAt: sql<Date | null>`max(${reports.resolvedAt})`.mapWith((v) => (v ? new Date(v) : null)),
    })
    .from(reports)
    .where(and(open ? eq(reports.status, 'open') : sql`${reports.status} <> 'open'`, targetId ? eq(reports.targetId, targetId) : undefined))
    .groupBy(reports.targetType, reports.targetId)
    .orderBy(open ? sql`min(${reports.createdAt}) asc` : sql`max(${reports.resolvedAt}) desc nulls last`)
    .limit(limit);

  const ids = (t: TargetType) => rows.filter((r) => r.targetType === t).map((r) => r.targetId);
  const postIds = ids('post'), commentIds = ids('comment'), userIds = ids('user');
  const [postRows, commentRows] = await Promise.all([
    postIds.length
      ? db.select({ id: posts.id, title: posts.title, type: posts.type, caption: posts.caption, removedAt: posts.removedAt, deletedAt: posts.deletedAt, authorId: posts.authorId })
          .from(posts).where(inArray(posts.id, postIds))
      : Promise.resolve([]),
    commentIds.length
      ? db.select({ id: comments.id, text: comments.text, postId: comments.postId, deletedAt: comments.deletedAt, authorId: comments.userId })
          .from(comments).where(inArray(comments.id, commentIds))
      : Promise.resolve([]),
  ]);
  const authorIds = [...new Set([...postRows.map((p) => p.authorId), ...commentRows.map((c) => c.authorId), ...userIds])];
  const people = authorIds.length
    ? await db.select({ id: users.id, handle: users.handle, name: users.name, suspendedAt: users.suspendedAt }).from(users).where(inArray(users.id, authorIds))
    : [];
  const personBy = new Map(people.map((u) => [u.id, { id: u.id, handle: u.handle, name: u.name, suspended: !!u.suspendedAt }]));
  const postBy = new Map(postRows.map((p) => [p.id, p]));
  const commentBy = new Map(commentRows.map((c) => [c.id, c]));

  return rows.map((r) => {
    const reasons: Record<string, number> = {};
    for (const x of r.reasons || []) reasons[x] = (reasons[x] || 0) + 1;
    let target: ReportGroup['target'] = { exists: false };
    if (r.targetType === 'post') {
      const p = postBy.get(r.targetId);
      if (p) target = { exists: true, title: p.title, text: p.caption, postType: p.type, postId: p.id, removed: !!p.removedAt || !!p.deletedAt, author: personBy.get(p.authorId) || null };
    } else if (r.targetType === 'comment') {
      const c = commentBy.get(r.targetId);
      if (c) target = { exists: true, text: c.text, postId: c.postId, removed: !!c.deletedAt, author: personBy.get(c.authorId) || null };
    } else {
      const u = personBy.get(r.targetId);
      if (u) target = { exists: true, title: u.name, text: '@' + u.handle, suspended: u.suspended, author: u };
    }
    return {
      targetType: r.targetType as TargetType,
      targetId: r.targetId,
      count: r.count,
      reasons,
      notes: (r.notes || []).filter((n): n is string => !!n && !!n.trim()),
      firstAt: r.firstAt.toISOString(),
      lastAt: r.lastAt.toISOString(),
      status: r.status,
      resolution: r.resolution,
      resolvedAt: r.resolvedAt ? r.resolvedAt.toISOString() : null,
      target,
    };
  });
}

export type ResolveAction = 'dismiss' | 'remove' | 'suspend' | 'remove_suspend';

const RESOLUTION_TEXT: Record<ResolveAction, string> = {
  dismiss: 'Chúng tôi đã xem xét báo cáo của bạn và không thấy nội dung vi phạm Tiêu chuẩn cộng đồng. Bạn vẫn có thể chặn hoặc ẩn người/nội dung này.',
  remove: 'Cảm ơn bạn đã báo cáo. Nội dung vi phạm Tiêu chuẩn cộng đồng đã bị gỡ.',
  suspend: 'Cảm ơn bạn đã báo cáo. Tài khoản vi phạm Tiêu chuẩn cộng đồng đã bị khoá.',
  remove_suspend: 'Cảm ơn bạn đã báo cáo. Nội dung vi phạm đã bị gỡ và tài khoản liên quan đã bị khoá.',
};

/** Khoá tài khoản: chặn đăng nhập + thu hồi mọi phiên (token truy cập hết hạn trong ≤15 phút). */
async function suspendUser(userId: string, reason: string): Promise<void> {
  if (await isAdmin(userId)) throw badRequest('Không thể khoá tài khoản quản trị viên');
  await db.update(users).set({ suspendedAt: new Date(), suspendReason: reason }).where(eq(users.id, userId));
  await db.update(refreshTokens).set({ revokedAt: new Date() }).where(and(eq(refreshTokens.userId, userId), isNull(refreshTokens.revokedAt)));
}

export async function resolveReport(adminId: string, targetType: TargetType, targetId: string, action: ResolveAction, note?: string): Promise<void> {
  const open = await db
    .select({ id: reports.id, reporterId: reports.reporterId, reason: reports.reason })
    .from(reports)
    .where(and(eq(reports.targetType, targetType), eq(reports.targetId, targetId), eq(reports.status, 'open')));
  if (!open.length) throw notFound('Không có báo cáo đang chờ cho nội dung này');

  // Chủ nội dung (để gỡ / khoá)
  let ownerId: string | null = null;
  if (targetType === 'post') {
    const [p] = await db.select({ authorId: posts.authorId }).from(posts).where(eq(posts.id, targetId));
    ownerId = p?.authorId ?? null;
  } else if (targetType === 'comment') {
    const [c] = await db.select({ authorId: comments.userId }).from(comments).where(eq(comments.id, targetId));
    ownerId = c?.authorId ?? null;
  } else ownerId = targetId;

  const reason = note?.trim() || open.map((o) => o.reason).join(', ');
  if (action === 'remove' || action === 'remove_suspend') {
    if (targetType === 'post') await db.update(posts).set({ removedAt: new Date(), deletedAt: new Date() }).where(eq(posts.id, targetId));
    else if (targetType === 'comment') await db.update(comments).set({ deletedAt: new Date() }).where(eq(comments.id, targetId));
    else if (action === 'remove') throw badRequest('Báo cáo người dùng: dùng "Khoá tài khoản"');
  }
  if ((action === 'suspend' || action === 'remove_suspend') && ownerId) await suspendUser(ownerId, reason);

  const status = action === 'dismiss' ? 'dismissed' : 'actioned';
  await db
    .update(reports)
    .set({ status, resolvedAt: new Date(), resolvedBy: adminId, resolution: action })
    .where(inArray(reports.id, open.map((o) => o.id)));

  // Thông báo kết quả cho từng người báo cáo (như "Hộp thư hỗ trợ" của các mạng xã hội).
  const reporters = [...new Set(open.map((o) => o.reporterId))];
  if (reporters.length) {
    await db.insert(notifications).values(reporters.map((uid) => ({ userId: uid, type: 'report_resolved', text: RESOLUTION_TEXT[action] })));
  }
}

/** Báo cáo mới → email cho quản trị viên (để kịp xử lý trong 24 giờ). Không chặn luồng báo cáo. */
export async function alertAdminsOfReport(targetType: TargetType, targetId: string, reason: string, note?: string | null): Promise<void> {
  if (!adminEmails.length) return;
  const [{ c } = { c: 0 }] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(reports)
    .where(and(eq(reports.status, 'open')));
  const label = targetType === 'post' ? 'bài viết' : targetType === 'comment' ? 'bình luận' : 'tài khoản';
  const text = `Có báo cáo mới về một ${label} (lý do: ${reason}).${note ? `\nGhi chú: ${note}` : ''}\nMã nội dung: ${targetId}\n\nĐang chờ xử lý: ${c} báo cáo. Mở Rankev → Hồ sơ → ⚙ Cài đặt → Kiểm duyệt để xử lý (cam kết trong 24 giờ).`;
  await Promise.all(adminEmails.map((to) => sendMail({ to, subject: `[Rankev] Báo cáo mới: ${label} — ${reason}`, text }).catch(() => {})));
}

/** Thống kê nhanh cho bàn kiểm duyệt. */
export async function reportStats(): Promise<{ open: number; overdue: number }> {
  const [r] = await db
    .select({
      open: sql<number>`count(*) filter (where ${reports.status} = 'open')::int`,
      overdue: sql<number>`count(*) filter (where ${reports.status} = 'open' and ${reports.createdAt} < now() - interval '24 hours')::int`,
    })
    .from(reports);
  return { open: r?.open ?? 0, overdue: r?.overdue ?? 0 };
}

