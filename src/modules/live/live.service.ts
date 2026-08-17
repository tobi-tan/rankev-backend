import { and, desc, eq, inArray, sql } from 'drizzle-orm';
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

type Phase = 'waiting' | 'live' | 'ended';
type SessionRow = typeof presentationSessions.$inferSelect;

/** Giai đoạn của phiên: chờ (phòng chờ) → thi → đã kết thúc (kể cả hết giờ). */
function phaseOf(s: Pick<SessionRow, 'liveAt' | 'endsAt' | 'endedAt'>): Phase {
  if (s.endedAt) return 'ended';
  if (s.endsAt && Date.now() >= s.endsAt.getTime()) return 'ended';
  if (s.liveAt) return 'live';
  return 'waiting';
}

/** Ghi nhận kết thúc phiên: chốt endedAt + số người + điểm TB (lưu vào lịch sử). */
async function finalizeSession(sessionId: string): Promise<void> {
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
    .set({
      endedAt: new Date(),
      participants: parts.length,
      avgScore: avgScore === null ? null : avgScore.toString(),
    })
    // chỉ chốt 1 lần (tránh đè khi 2 request cùng finalize).
    .where(and(eq(presentationSessions.id, sessionId), sql`${presentationSessions.endedAt} is null`));
}

/**
 * Nếu phiên đã hết giờ (endsAt qua) mà chưa chốt → chốt ngay + báo mọi người.
 * Trả về true nếu phiên coi như đã kết thúc.
 */
async function finalizeIfExpired(s: SessionRow): Promise<boolean> {
  if (s.endedAt) return true;
  if (s.endsAt && Date.now() >= s.endsAt.getTime()) {
    await finalizeSession(s.id);
    void pushLiveUpdate(s.id);
    void pushLiveState(s.id);
    return true;
  }
  return false;
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
    .values({ postId, hostId, name: name ?? null, code: genCode() }) // liveAt null → phòng chờ
    .returning();
  return { id: row.id, code: row.code, postId };
}

/**
 * Host bấm "Bắt đầu" → phiên rời phòng chờ vào giai đoạn thi.
 * durationMinutes (tùy chọn): >0 → tự hết giờ sau ngần ấy phút; else không giới hạn.
 */
export async function startLiveSession(sessionId: string, hostId: string, durationMinutes?: number | null) {
  const [s] = await db.select().from(presentationSessions).where(eq(presentationSessions.id, sessionId));
  if (!s) throw notFound('Session not found');
  if (s.hostId !== hostId) throw forbidden('Chỉ chủ phiên mới bắt đầu được');
  if (s.endedAt) throw badRequest('Phiên đã kết thúc');
  if (!s.liveAt) {
    const now = new Date();
    const mins = durationMinutes && durationMinutes > 0 ? durationMinutes : null;
    const endsAt = mins ? new Date(now.getTime() + mins * 60000) : null;
    await db
      .update(presentationSessions)
      .set({ liveAt: now, endsAt })
      .where(eq(presentationSessions.id, sessionId));
  }
  void pushLiveUpdate(sessionId); // presenter
  void pushLiveState(sessionId); // participant (biết đã bắt đầu)
  return computeLiveResults(sessionId);
}

/** Người tham gia tra phiên bằng mã → nhận bài (KHÔNG kèm cờ đáp án đúng) + trạng thái. */
export async function getSessionByCode(code: string) {
  const [s] = await db
    .select()
    .from(presentationSessions)
    .where(eq(presentationSessions.code, code.trim().toUpperCase()));
  if (!s) throw notFound('Không tìm thấy phiên với mã này');
  await finalizeIfExpired(s);
  const [fresh] = await db.select().from(presentationSessions).where(eq(presentationSessions.id, s.id));
  const post = await getDeckById(fresh.postId); // deck view — serializer đã ẩn `correct`
  return {
    sessionId: fresh.id,
    code: fresh.code,
    name: fresh.name,
    phase: phaseOf(fresh),
    endsAt: fresh.endsAt ? fresh.endsAt.toISOString() : null,
    post,
  };
}

export async function joinSession(sessionId: string, name: string) {
  const [s] = await db
    .select()
    .from(presentationSessions)
    .where(eq(presentationSessions.id, sessionId));
  if (!s) throw notFound('Session not found');
  await finalizeIfExpired(s);
  if (phaseOf(s) === 'ended') throw badRequest('Phiên đã kết thúc');
  const [row] = await db
    .insert(liveParticipants)
    .values({ sessionId, name: (name || '').trim().slice(0, 60) || 'Ẩn danh' })
    .returning({ id: liveParticipants.id });
  void pushLiveUpdate(sessionId); // báo presenter có người mới vào
  return { participantId: row.id };
}

/** Người tham gia nộp bài → server chấm lại (exam) → lưu điểm. KHÔNG trả điểm (chống spoil). */
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
    .select()
    .from(presentationSessions)
    .where(eq(presentationSessions.id, sessionId));
  if (!s) throw notFound('Session not found');
  await finalizeIfExpired(s);
  const phase = phaseOf(s);
  if (phase === 'waiting') throw badRequest('Phiên chưa bắt đầu');
  if (phase === 'ended') throw badRequest('Đã hết thời gian làm bài');

  const [post] = await db
    .select({ deckMode: posts.deckMode })
    .from(posts)
    .where(eq(posts.id, s.postId));
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
  const isExam = post?.deckMode === 'exam';
  if (isExam) {
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
  const score = isExam && gradable > 0 ? Math.round(scoreNum * 10) / 10 : null;

  await db
    .update(liveParticipants)
    .set({
      answers,
      score: score === null ? null : score.toString(),
      correctCount: isExam ? correct : null,
      totalGradable: isExam ? gradable : null,
      submittedAt: new Date(),
    })
    .where(eq(liveParticipants.id, participantId));

  void pushLiveUpdate(sessionId); // báo presenter có bài nộp mới
  // Chỉ xác nhận đã nộp — điểm chưa công bố cho tới khi phiên kết thúc / hết giờ.
  return { submitted: true };
}

/**
 * Người tham gia xem lại kết quả của MÌNH. Điểm chỉ lộ khi phiên đã kết thúc
 * (host bấm kết thúc hoặc hết giờ) — trước đó trả { revealed: false }.
 */
export async function getParticipantResult(sessionId: string, participantId: string) {
  const [p] = await db
    .select()
    .from(liveParticipants)
    .where(and(eq(liveParticipants.id, participantId), eq(liveParticipants.sessionId, sessionId)));
  if (!p) throw notFound('Không tìm thấy người tham gia');
  const [s] = await db
    .select()
    .from(presentationSessions)
    .where(eq(presentationSessions.id, sessionId));
  if (!s) throw notFound('Session not found');
  await finalizeIfExpired(s);
  const [fresh] = await db.select().from(presentationSessions).where(eq(presentationSessions.id, s.id));
  const phase = phaseOf(fresh);
  const base = {
    phase,
    endsAt: fresh.endsAt ? fresh.endsAt.toISOString() : null,
    submitted: Boolean(p.submittedAt),
  };
  if (phase !== 'ended') return { ...base, revealed: false };

  // Đã công bố → kèm đáp án đúng để người tham gia đối chiếu (không còn nguy cơ gian lận).
  const questions = await db.select().from(deckQuestions).where(eq(deckQuestions.postId, fresh.postId));
  const qIds = questions.map((q) => q.id);
  const opts = qIds.length
    ? await db.select().from(deckOptions).where(inArray(deckOptions.questionId, qIds))
    : [];
  const correctByQuestion: Record<string, string[]> = {};
  for (const q of questions) correctByQuestion[q.id] = [];
  for (const o of opts) if (o.correct) (correctByQuestion[o.questionId] ??= []).push(o.id);

  return {
    ...base,
    revealed: true,
    score: p.score == null ? null : Number(p.score),
    correctCount: p.correctCount,
    totalGradable: p.totalGradable,
    answers: p.answers,
    correctByQuestion,
  };
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

/** Trạng thái nhẹ cho participant (KHÔNG lộ kết quả/đáp án ai). Dùng cho kênh công khai. */
export async function computeLiveState(sessionId: string) {
  const [s] = await db.select().from(presentationSessions).where(eq(presentationSessions.id, sessionId));
  if (!s) throw notFound('Session not found');
  return { phase: phaseOf(s), endsAt: s.endsAt ? s.endsAt.toISOString() : null };
}

/** Tính snapshot kết quả (KHÔNG kiểm tra quyền — chỉ gọi từ nội bộ đã xác thực). */
export async function computeLiveResults(sessionId: string) {
  const [s] = await db
    .select()
    .from(presentationSessions)
    .where(eq(presentationSessions.id, sessionId));
  if (!s) throw notFound('Session not found');
  await finalizeIfExpired(s); // hết giờ mà chưa chốt → chốt luôn (persist + công bố)
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
    phase: phaseOf(s),
    endsAt: s.endsAt ? s.endsAt.toISOString() : null,
    ended: phaseOf(s) === 'ended',
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
  if (!s.endedAt) await finalizeSession(sessionId);
  void pushLiveUpdate(sessionId); // presenter (các tab khác)
  void pushLiveState(sessionId); // participant → công bố kết quả
  return computeLiveResults(sessionId); // trả snapshot đã kết thúc cho presenter
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

/** Phát trạng thái nhẹ cho participant đang chờ (phase/endsAt). */
export async function pushLiveState(sessionId: string): Promise<void> {
  try {
    const state = await computeLiveState(sessionId);
    hub.broadcastLiveState(sessionId, state);
  } catch {
    /* bỏ qua */
  }
}
