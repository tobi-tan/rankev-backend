import jwt from 'jsonwebtoken';
import { desc, eq, inArray } from 'drizzle-orm';
import { db } from '../../db';
import {
  comments, messages, onboardingVotes, participations, posts, rankieOptions, rankUps, reports, saves,
  userBlocks, userMutes, users, votes,
} from '../../db/schema';
import { env } from '../../env';
import { notFound, unauthorized } from '../../lib/errors';

/**
 * "TẢI THÔNG TIN CỦA BẠN" (như Facebook/Instagram/TikTok) — quyền truy cập & mang dữ liệu theo
 * Nghị định 13/2023/NĐ-CP. Trả MỘT file JSON gồm mọi dữ liệu cá nhân của người dùng.
 *
 * App điện thoại không tải file qua fetch được → app xin một LINK TẢI NGẮN HẠN (10 phút) rồi mở
 * bằng trình duyệt. Link ký bằng khoá RIÊNG (JWT_SECRET + ':export') nên KHÔNG dùng làm token
 * đăng nhập được, và chỉ có tác dụng tải file.
 */
const EXPORT_SECRET = () => env.JWT_SECRET + ':export';

export function signExportToken(userId: string): string {
  return jwt.sign({ sub: userId, purpose: 'export' }, EXPORT_SECRET(), { expiresIn: '10m' });
}

export function verifyExportToken(token: string): string {
  try {
    const p = jwt.verify(token, EXPORT_SECRET());
    if (typeof p === 'string' || p.purpose !== 'export' || !p.sub) throw new Error('bad');
    return String(p.sub);
  } catch {
    throw unauthorized('Link tải đã hết hạn — hãy tạo link mới trong app');
  }
}

const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);

export async function buildExport(userId: string): Promise<Record<string, unknown>> {
  const [u] = await db.select().from(users).where(eq(users.id, userId));
  if (!u) throw notFound('User not found');

  const [myPosts, myVotes, myParts, myComments, myMessages, mySaves, myRankUps, myBlocks, myMutes, myReports, myOnboarding] = await Promise.all([
    db.select().from(posts).where(eq(posts.authorId, userId)).orderBy(desc(posts.createdAt)),
    db.select({ v: votes, title: posts.title }).from(votes).innerJoin(posts, eq(posts.id, votes.rankieId)).where(eq(votes.userId, userId)),
    db.select({ p: participations, title: posts.title }).from(participations).innerJoin(posts, eq(posts.id, participations.postId)).where(eq(participations.userId, userId)),
    db.select().from(comments).where(eq(comments.userId, userId)).orderBy(desc(comments.createdAt)),
    db.select().from(messages).where(eq(messages.senderId, userId)).orderBy(desc(messages.createdAt)),
    db.select().from(saves).where(eq(saves.userId, userId)),
    db.select({ r: rankUps, handle: users.handle }).from(rankUps).innerJoin(users, eq(users.id, rankUps.authorId)).where(eq(rankUps.userId, userId)),
    db.select({ handle: users.handle, at: userBlocks.createdAt }).from(userBlocks).innerJoin(users, eq(users.id, userBlocks.blockedId)).where(eq(userBlocks.blockerId, userId)),
    db.select({ handle: users.handle }).from(userMutes).innerJoin(users, eq(users.id, userMutes.mutedId)).where(eq(userMutes.muterId, userId)),
    db.select().from(reports).where(eq(reports.reporterId, userId)),
    db.select().from(onboardingVotes).where(eq(onboardingVotes.userId, userId)),
  ]);

  // Nhãn lựa chọn đã bình chọn (thay vì chỉ mã)
  const optIds = [...new Set(myVotes.flatMap((x) => x.v.optionIds))].filter((x) => /^[0-9a-f-]{36}$/i.test(x));
  const optRows = optIds.length ? await db.select({ id: rankieOptions.id, label: rankieOptions.label, emoji: rankieOptions.emoji }).from(rankieOptions).where(inArray(rankieOptions.id, optIds)) : [];
  const optLabel = new Map(optRows.map((o) => [o.id, [o.emoji, o.label].filter(Boolean).join(' ')]));

  return {
    _about: {
      app: 'Rankev',
      generatedAt: new Date().toISOString(),
      note: 'Bản sao dữ liệu cá nhân của bạn trên Rankev. Kết quả bình chọn của người khác và nội dung người khác gửi bạn không nằm trong file này.',
    },
    profile: {
      id: u.id, email: u.email, handle: u.handle, name: u.name, bio: u.bio,
      avatarUrl: u.avatarUrl, avatarEmoji: u.avatarEmoji, avatarColor: u.avatarColor,
      loginMethod: u.provider || 'email', verified: u.verified, rankPoints: u.rankPoints,
      dateOfBirth: u.dateOfBirth, ageRange: u.ageRange, gender: u.gender, occupation: u.occupation,
      demographicsPublic: u.demographicsPublic, createdAt: iso(u.createdAt),
    },
    posts: myPosts.map((p) => ({
      id: p.id, type: p.type, deckMode: p.deckMode, title: p.title, caption: p.caption, category: p.category,
      tags: p.tags, media: p.media, visibility: p.visibility, hidden: p.hidden,
      createdAt: iso(p.createdAt), deletedAt: iso(p.deletedAt), removedByModeration: iso(p.removedAt),
    })),
    votes: myVotes.map(({ v, title }) => ({
      post: title, postId: v.rankieId, choices: v.optionIds.map((id) => optLabel.get(id) || id), taps: v.tapCount, votedAt: iso(v.votedAt),
    })),
    participations: myParts.map(({ p, title }) => ({
      post: title, postId: p.postId, type: p.type, deckMode: p.deckMode, result: p.endingName, score: p.score,
      correct: p.correctCount, total: p.totalGradable, answers: p.answers, at: iso(p.participatedAt),
    })),
    comments: myComments.map((c) => ({ id: c.id, postId: c.postId, tournamentId: c.tournamentId, text: c.text, imageUrl: c.imageUrl, createdAt: iso(c.createdAt), deletedAt: iso(c.deletedAt) })),
    messagesSent: myMessages.map((m) => ({ conversationId: m.conversationId, kind: m.kind, body: m.body, refType: m.refType, refId: m.refId, poll: m.poll, createdAt: iso(m.createdAt) })),
    saved: mySaves.map((s) => ({ type: s.refType, id: s.refId, label: (s.preview as { label?: string } | null)?.label ?? null, savedAt: iso(s.createdAt) })),
    rankUpsGiven: myRankUps.map(({ r, handle }) => ({ to: '@' + handle, tier: r.tier, at: iso(r.updatedAt) })),
    blocked: myBlocks.map((b) => ({ user: '@' + b.handle, at: iso(b.at) })),
    muted: myMutes.map((m) => '@' + m.handle),
    reportsMade: myReports.map((r) => ({ targetType: r.targetType, targetId: r.targetId, reason: r.reason, note: r.note, status: r.status, at: iso(r.createdAt) })),
    onboardingAnswers: myOnboarding.map((o) => ({ question: o.voteKey, answer: o.choice, at: iso(o.createdAt) })),
  };
}
