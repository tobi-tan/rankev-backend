import { and, desc, eq, inArray } from 'drizzle-orm';
import { db } from '../../db';
import {
  presentationSessions,
  liveParticipants,
  posts,
  deckQuestions,
  deckOptions,
} from '../../db/schema';
import { badRequest, forbidden, notFound } from '../../lib/errors';
import { getDeckById } from '../decks/decks.service';
import * as hub from '../../realtime/hub';

// Mã join 6 ký tự (bỏ ký tự dễ nhầm: 0/O, 1/I).
function genCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let c = '';
  for (let i = 0; i < 6; i++) c += chars[Math.floor(Math.random() * chars.length)];
  return c;
}
function normalizeAnswer(a: unknown): string[] {
  if (Array.isArray(a)) return a.filter((x): x is string => typeof x === 'string');
  if (typeof a === 'string') return [a];
  return [];
}
function setEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sb = new Set(b);
  return a.every((x) => sb.has(x));
}

/** Presenter mở một phiên trực tiếp cho bài của mình → trả về id + mã join. */
export async function createLiveSession(hostId: string, postId: string, name?: string) {
  const [post] = await db
    .select({ id: posts.id, authorId: posts.authorId, type: posts.type })
    .from(posts)
    .where(eq(posts.id, postId));
  if (!post) throw notFound('Post not found');
  if (post.authorId !== hostId) throw forbidden('Chỉ tác giả mới trình chiếu bài này');
  if (post.type !== 'deck') throw badRequest('Hiện chỉ hỗ trợ trình chiếu trực tiếp cho Survey/Exam');
  const [row] = await db
    .insert(presentationSessions)
    .values({ postId, hostId, name: name ?? null, code: genCode() })
    .returning();
  return { id: row.id, code: row.code, postId };
}

/** Người tham gia tra phiên bằng mã → nhận bài (KHÔNG kèm cờ đáp án đúng). */
export async function getSessionByCode(code: string) {
  const [s] = await db
    .select()
    .from(presentationSessions)
    .where(eq(presentationSessions.code, code.trim().toUpperCase()));
  if (!s) throw notFound('Không tìm thấy phiên với mã này');
  if (s.endedAt) throw badRequest('Phiên đã kết thúc');
  const post = await getDeckById(s.postId); // deck view — serializer đã ẩn `correct`
  return { sessionId: s.id, code: s.code, name: s.name, post };
}

export async function joinSession(sessionId: string, name: string) {
  const [s] = await db
    .select({ id: presentationSessions.id, endedAt: presentationSessions.endedAt })
    .from(presentationSessions)
    .where(eq(presentationSessions.id, sessionId));
  if (!s) throw notFound('Session not found');
  if (s.endedAt) throw badRequest('Phiên đã kết thúc');
  const [row] = await db
    .insert(liveParticipants)
    .values({ sessionId, name: (name || '').trim().slice(0, 60) || 'Ẩn danh' })
    .returning({ id: liveParticipants.id });
  void pushLiveUpdate(sessionId); // báo presenter có người mới vào
  return { participantId: row.id };
}

/** Người tham gia nộp bài → server chấm lại (exam) → lưu điểm. */
export async function submitLiveAnswers(
  sessionId: string,
  participantId: string,
  answers: Record<string, unknown>,
) {
  const [p] = await db
    .select()
    .from(liveParticipants)
    .where(and(eq(liveParticipants.id, participantId), eq(liveParticipants.sessionId, sessionId)));
  if (!p) throw notFound('Không tìm thấy người tham gia');
  const [s] = await db
    .select({ postId: presentationSessions.postId, deckMode: posts.deckMode })
    .from(presentationSessions)
    .innerJoin(posts, eq(posts.id, presentationSessions.postId))
    .where(eq(presentationSessions.id, sessionId));
  if (!s) throw notFound('Session not found');

  const questions = await db.select().from(deckQuestions).where(eq(deckQuestions.postId, s.postId));
  const qIds = questions.map((q) => q.id);
  const opts = qIds.length
    ? await db.select().from(deckOptions).where(inArray(deckOptions.questionId, qIds))
    : [];
  const optsByQ = new Map<string, typeof opts>();
  for (const o of opts) {
    const l = optsByQ.get(o.questionId) ?? [];
    l.push(o);
    optsByQ.set(o.questionId, l);
  }

  let scoreNum = 0;
  let correct = 0;
  let gradable = 0;
  if (s.deckMode === 'exam') {
    for (const q of questions) {
      const pts = Number(q.points);
      if (pts <= 0) continue;
      gradable++;
      const correctIds = (optsByQ.get(q.id) ?? []).filter((o) => o.correct).map((o) => o.id);
      const given = normalizeAnswer(answers[q.id]);
      if (setEqual(given, correctIds)) {
        scoreNum += pts;
        correct++;
      }
    }
  }
  const score = s.deckMode === 'exam' && gradable > 0 ? Math.round(scoreNum * 10) / 10 : null;

  await db
    .update(liveParticipants)
    .set({
      answers,
      score: score === null ? null : score.toString(),
      correctCount: s.deckMode === 'exam' ? correct : null,
      totalGradable: s.deckMode === 'exam' ? gradable : null,
      submittedAt: new Date(),
    })
    .where(eq(liveParticipants.id, participantId));

  void pushLiveUpdate(sessionId); // báo presenter có bài nộp mới
  return { score, correctCount: correct, totalGradable: gradable };
}

/** Presenter xem kết quả trực tiếp (poll). Có kiểm tra quyền chủ phiên. */
export async function getLiveResults(sessionId: string, hostId: string) {
  const [s] = await db
    .select({ hostId: presentationSessions.hostId })
    .from(presentationSessions)
    .where(eq(presentationSessions.id, sessionId));
  if (!s) throw notFound('Session not found');
  if (s.hostId !== hostId) throw forbidden('Chỉ chủ phiên mới xem được kết quả');
  return computeLiveResults(sessionId);
}

/** Chỉ đúng chủ phiên mới được subscribe realtime (kết quả chứa đáp án). */
export async function assertLiveHost(sessionId: string, hostId: string): Promise<boolean> {
  const [s] = await db
    .select({ hostId: presentationSessions.hostId })
    .from(presentationSessions)
    .where(eq(presentationSessions.id, sessionId));
  return Boolean(s && s.hostId === hostId);
}

/** Tính snapshot kết quả (KHÔNG kiểm tra quyền — chỉ gọi từ nội bộ đã xác thực). */
export async function computeLiveResults(sessionId: string) {
  const [s] = await db
    .select()
    .from(presentationSessions)
    .where(eq(presentationSessions.id, sessionId));
  if (!s) throw notFound('Session not found');
  const parts = await db
    .select()
    .from(liveParticipants)
    .where(eq(liveParticipants.sessionId, sessionId))
    .orderBy(desc(liveParticipants.submittedAt), desc(liveParticipants.joinedAt));
  const submitted = parts.filter((p) => p.submittedAt);
  const avgScore = submitted.length
    ? Math.round((submitted.reduce((a, p) => a + Number(p.score ?? 0), 0) / submitted.length) * 10) / 10
    : null;
  return {
    code: s.code,
    name: s.name,
    ended: Boolean(s.endedAt),
    joined: parts.length,
    submitted: submitted.length,
    avgScore,
    participants: parts.map((p) => ({
      id: p.id,
      name: p.name,
      score: p.score == null ? null : Number(p.score),
      correctCount: p.correctCount,
      totalGradable: p.totalGradable,
      submitted: Boolean(p.submittedAt),
      answers: p.answers,
    })),
  };
}

export async function endLiveSession(sessionId: string, hostId: string) {
  const [s] = await db
    .select()
    .from(presentationSessions)
    .where(eq(presentationSessions.id, sessionId));
  if (!s) throw notFound('Session not found');
  if (s.hostId !== hostId) throw forbidden('Chỉ chủ phiên mới kết thúc được');
  const parts = await db
    .select({ score: liveParticipants.score, submittedAt: liveParticipants.submittedAt })
    .from(liveParticipants)
    .where(eq(liveParticipants.sessionId, sessionId));
  const submitted = parts.filter((p) => p.submittedAt);
  const avgScore = submitted.length
    ? Math.round((submitted.reduce((a, p) => a + Number(p.score ?? 0), 0) / submitted.length) * 10) / 10
    : null;
  await db
    .update(presentationSessions)
    .set({ endedAt: new Date(), participants: parts.length, avgScore: avgScore === null ? null : avgScore.toString() })
    .where(eq(presentationSessions.id, sessionId));
  void pushLiveUpdate(sessionId); // báo presenter (và mọi tab) phiên đã kết thúc
  return { ended: true };
}

/** Tính lại snapshot và phát cho mọi presenter đang theo dõi phiên (fire-and-forget). */
export async function pushLiveUpdate(sessionId: string): Promise<void> {
  try {
    const results = await computeLiveResults(sessionId);
    hub.broadcastLiveUpdate(sessionId, results);
  } catch {
    /* phiên có thể vừa bị xoá — bỏ qua, không ảnh hưởng request */
  }
}
