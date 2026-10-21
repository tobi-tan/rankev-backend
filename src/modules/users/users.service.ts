import { and, desc, eq, inArray, isNull, ne, sql } from 'drizzle-orm';
import { listablePostCond } from '../posts/access';
import { db } from '../../db';
import { users, posts, participations, deckQuestions, deckOptions } from '../../db/schema';
import { conflict, notFound } from '../../lib/errors';
import { summariesByIds, type FeedSummary } from '../feed/feed.service';
import { toPublicUser, type PublicUser } from './users.serializer';
import type { UpdateProfileInput } from './users.schemas';

export async function updateProfile(userId: string, input: UpdateProfileInput): Promise<PublicUser> {
  if (input.handle) {
    const [taken] = await db
      .select({ id: users.id })
      .from(users)
      .where(and(sql`lower(${users.handle}) = lower(${input.handle})`, ne(users.id, userId)));
    if (taken) throw conflict('Tên người dùng này đã có người dùng');
    if (isReservedHandle(input.handle)) throw conflict('Tên người dùng này không được dùng');
  }

  // Only set provided keys (undefined = leave unchanged).
  const patch: Record<string, unknown> = {};
  for (const k of ['name', 'handle', 'bio', 'avatarEmoji', 'avatarColor', 'avatarUrl'] as const) {
    if (input[k] !== undefined) patch[k] = input[k];
  }
  if (input.handle) patch.handleConfirmed = true; // người dùng đã TỰ chọn @handle

  if (Object.keys(patch).length > 0) {
    await db.update(users).set(patch).where(eq(users.id, userId));
  }

  const [user] = await db.select().from(users).where(eq(users.id, userId));
  if (!user) throw notFound('User not found');
  return toPublicUser(user, true);
}

const RESERVED = new Set(['admin', 'administrator', 'rankev', 'support', 'hotro', 'moderator', 'mod', 'system', 'root', 'official', 'help', 'security', 'staff', 'team', 'null', 'undefined', 'me', 'user']);
export const isReservedHandle = (h: string) => RESERVED.has(h.toLowerCase()) || /^user_[a-z0-9]{6,}$/i.test(h) || h.toLowerCase().startsWith('rankev');

/** Kiểm tra @handle khi người dùng gõ: hợp lệ + còn trống (không phân biệt hoa/thường). */
export async function checkHandle(handleRaw: string, userId: string): Promise<{ handle: string; valid: boolean; available: boolean; reason?: string }> {
  const handle = handleRaw.replace(/^@/, '').trim();
  if (!/^[a-zA-Z0-9_]{3,20}$/.test(handle)) return { handle, valid: false, available: false, reason: '3–20 ký tự: chữ không dấu, số hoặc _' };
  if (isReservedHandle(handle)) return { handle, valid: true, available: false, reason: 'Tên này không được dùng' };
  const [taken] = await db.select({ id: users.id }).from(users).where(and(sql`lower(${users.handle}) = lower(${handle})`, ne(users.id, userId)));
  return taken ? { handle, valid: true, available: false, reason: 'Đã có người dùng' } : { handle, valid: true, available: true };
}

/** Tra hồ sơ theo @handle (không phân biệt hoa/thường, bỏ @ đầu). */
export async function getByHandle(handleRaw: string): Promise<PublicUser> {
  const handle = handleRaw.replace(/^@/, '').trim();
  const [user] = await db
    .select()
    .from(users)
    .where(sql`lower(${users.handle}) = lower(${handle})`);
  if (!user) throw notFound('User not found');
  return toPublicUser(user);
}

/** Id thật của user theo handle, hoặc null (dùng cho @nhắc tên). */
export async function resolveHandles(handles: string[]): Promise<Map<string, string>> {
  const cleaned = [...new Set(handles.map((h) => h.replace(/^@/, '').toLowerCase()).filter(Boolean))];
  if (cleaned.length === 0) return new Map();
  const rows = await db
    .select({ id: users.id, handle: users.handle })
    .from(users)
    .where(inArray(sql`lower(${users.handle})`, cleaned));
  const map = new Map<string, string>();
  for (const r of rows) map.set(r.handle.toLowerCase(), r.id);
  return map;
}

/** A user's own posts (any type) as feed summaries, newest first. */
// includeDeleted: chỉ bật cho CHỦ tài khoản (/users/me/posts) để có bài trong "Thùng rác";
// hồ sơ công khai (/users/:id/posts) luôn ẩn bài đã xoá mềm.
export async function getUserPosts(authorId: string, includeDeleted = false, viewerId?: string | null): Promise<FeedSummary[]> {
  const conds = [
    eq(posts.authorId, authorId),
    // Ẩn các bài-ván của giải đấu — giải hiện dưới dạng series/thẻ giải, không phải
    // từng ván lẻ trong lưới hồ sơ (đồng bộ với feed).
    sql`NOT EXISTS (SELECT 1 FROM tournament_matches tm WHERE tm.rankie_post_id = ${posts.id})`,
  ];
  if (!includeDeleted) conds.push(isNull(posts.deletedAt));
  // Người khác xem hồ sơ: chỉ bài công khai, không bị ẩn (chủ xem /users/me/posts thấy hết).
  if (!includeDeleted && viewerId !== authorId) conds.push(listablePostCond(viewerId));
  const rows = await db
    .select({ id: posts.id })
    .from(posts)
    .where(and(...conds))
    .orderBy(desc(posts.pinned), desc(posts.createdAt), desc(posts.id)) // bài ghim lên đầu
    .limit(100);
  return summariesByIds(rows.map((r) => r.id));
}

export interface HistoryItem {
  postId: string;
  type: string;
  deckMode: string | null;
  title: string;
  category: string | null;
  endingName: string | null;
  score: number | null;
  correctCount: number | null;
  totalGradable: number | null;
  detail: string | null;
  /** câu trả lời từng câu (Survey/Exam) — thẻ kết quả trên feed hiện "câu hỏi → bạn chọn" */
  answers: unknown;
  /** Exam: tổng điểm tối đa + điểm đạt (để hiện thang điểm, Đạt/Chưa đạt) */
  maxScore: number | null;
  passingScore: number | null;
  /** Exam: đáp án đúng từng câu { questionId: optionId[] } — người làm đã nộp nên được xem (như kết quả nộp bài) */
  correct: Record<string, string[]> | null;
  participatedAt: string;
}

/** Participation history (Path endings + Deck results), newest first. */
export async function getHistory(userId: string): Promise<HistoryItem[]> {
  const rows = await db
    .select({ part: participations, post: posts })
    .from(participations)
    .innerJoin(posts, eq(posts.id, participations.postId))
    .where(eq(participations.userId, userId))
    .orderBy(desc(participations.updatedAt))
    .limit(100);
  const deckIds = rows.filter((r) => r.part.type === 'deck').map((r) => r.part.postId);
  const maxBy = new Map<string, number>();
  if (deckIds.length) {
    const ms = await db
      .select({ postId: deckQuestions.postId, max: sql<string>`coalesce(sum(${deckQuestions.points}) FILTER (WHERE ${deckQuestions.points} > 0), 0)` })
      .from(deckQuestions)
      .where(inArray(deckQuestions.postId, deckIds))
      .groupBy(deckQuestions.postId);
    for (const m of ms) maxBy.set(m.postId, Number(m.max) || 0);
  }
  const examIds = rows.filter((r) => r.part.type === 'deck' && r.post.deckMode === 'exam').map((r) => r.part.postId);
  const correctBy = new Map<string, Record<string, string[]>>();
  if (examIds.length) {
    const cs = await db
      .select({ postId: deckQuestions.postId, qid: deckOptions.questionId, oid: deckOptions.id })
      .from(deckOptions)
      .innerJoin(deckQuestions, eq(deckQuestions.id, deckOptions.questionId))
      .where(and(inArray(deckQuestions.postId, examIds), eq(deckOptions.correct, true)));
    for (const c of cs) {
      const m = correctBy.get(c.postId) ?? {};
      (m[c.qid] ??= []).push(c.oid);
      correctBy.set(c.postId, m);
    }
  }

  return rows.map((r) => ({
    postId: r.part.postId,
    type: r.part.type,
    deckMode: r.part.deckMode,
    title: r.post.title,
    category: r.post.category,
    endingName: r.part.endingName,
    score: r.part.score === null ? null : Number(r.part.score),
    correctCount: r.part.correctCount,
    totalGradable: r.part.totalGradable,
    detail: r.part.detail,
    answers: r.part.answers ?? null,
    maxScore: maxBy.get(r.part.postId) || null,
    passingScore: r.post.passingScore === null || r.post.passingScore === undefined ? null : Number(r.post.passingScore),
    correct: correctBy.get(r.part.postId) ?? null,
    participatedAt: r.part.updatedAt.toISOString(),
  }));
}

/**
 * Xoá tài khoản vĩnh viễn (App Store 5.1.1(v) / Google Play). Các bảng tham chiếu user đều
 * xoá dây chuyền (FK cascade), nhưng SỐ ĐẾM gộp (phiếu từng lựa chọn, lượt về kết quả Path)
 * là cột đếm riêng → phải trừ phần của người này TRƯỚC khi xoá, nếu không phiếu của tài khoản
 * đã xoá vẫn nằm trong kết quả. Bình chọn "không giới hạn" giữ nguyên lượt chạm (ẩn danh,
 * không truy được từng lượt thuộc lựa chọn nào) — chỉ bớt 1 người bình chọn.
 */
export async function deleteAccount(userId: string): Promise<void> {
  await db.transaction(async (tx) => {
    const mine = sql`
      SELECT o.id AS option_id, v.rankie_id, p.voting_type
      FROM votes v
      JOIN posts p ON p.id = v.rankie_id
      JOIN rankie_options o ON o.rankie_id = v.rankie_id AND o.id::text = ANY (v.option_ids)
      WHERE v.user_id = ${userId} AND p.author_id <> ${userId}`;
    // nhật ký ẩn danh cho "Dòng thời gian cạnh tranh" khớp với số phiếu sau khi trừ
    await tx.execute(sql`
      INSERT INTO vote_events (rankie_id, option_id, delta)
      SELECT m.rankie_id, m.option_id, -1 FROM (${mine}) m WHERE m.voting_type <> 'unlimited'`);
    await tx.execute(sql`
      UPDATE rankie_options o SET
        votes = CASE WHEN m.voting_type = 'unlimited' THEN o.votes ELSE GREATEST(o.votes - 1, 0) END,
        voters = GREATEST(o.voters - 1, 0)
      FROM (${mine}) m
      WHERE o.id = m.option_id`);
    // Path: bớt 1 lượt ở kết quả người này đã nhận
    await tx.execute(sql`
      UPDATE path_endings e SET count = GREATEST(e.count - 1, 0)
      FROM participations pa
      WHERE pa.user_id = ${userId} AND pa.type = 'path' AND pa.post_id = e.post_id AND pa.ending_name = e.name`);
    await tx.delete(users).where(eq(users.id, userId));
  });
}
