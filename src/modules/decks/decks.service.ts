import { and, avg, count, eq, inArray } from 'drizzle-orm';
import { tagsFor } from '../../lib/tags';
import { db } from '../../db';
import {
  posts,
  users,
  deckQuestions,
  deckOptions,
  participations,
  type DeckOption,
} from '../../db/schema';
import { badRequest, forbidden, notFound } from '../../lib/errors';
import { getPostSeries } from '../series/series.service';
import { countSharesOne } from '../messaging/shares';
import { correctMapOf, toDeckResult, toDeckView, toScore10, type DeckResult, type DeckView } from './decks.serializer';

/** Tổng điểm tối đa của một bài thi (các câu có điểm > 0). */
async function examMaxScore(postId: string): Promise<number | null> {
  const qs = await db.select({ points: deckQuestions.points }).from(deckQuestions).where(eq(deckQuestions.postId, postId));
  const m = qs.reduce((t, q) => t + (Number(q.points) > 0 ? Number(q.points) : 0), 0);
  return m > 0 ? m : null;
}
import type { CreateDeckInput, SubmitDeckInput } from './decks.schemas';

export async function createDeck(authorId: string, input: CreateDeckInput): Promise<DeckView> {
  const postId = await db.transaction(async (tx) => {
    const [post] = await tx
      .insert(posts)
      .values({
        type: 'deck',
        deckMode: input.deckMode,
        authorId,
        title: input.title,
        subtitle: input.subtitle,
        caption: input.caption,
        category: input.category,
        media: input.media,
        examDurationMinutes: input.examDurationMinutes,
        passingScore: input.passingScore?.toString(),
        allowGuestPresent: input.allowGuestPresent ?? false,
        tags: tagsFor(input.tags, input.caption, input.category),
        visibility: input.visibility ?? 'public',
      })
      .returning({ id: posts.id });

    for (let i = 0; i < input.questions.length; i++) {
      const q = input.questions[i];
      const [qRow] = await tx
        .insert(deckQuestions)
        .values({
          postId: post.id,
          position: i,
          text: q.text,
          votingType: q.votingType,
          points: q.points.toString(),
          imageUrl: q.imageUrl,
        })
        .returning({ id: deckQuestions.id });

      for (let j = 0; j < q.options.length; j++) {
        const o = q.options[j];
        await tx.insert(deckOptions).values({
          questionId: qRow.id,
          label: o.label,
          emoji: o.imageUrl ? null : o.emoji, // có ảnh → bỏ emoji giữ chỗ
          imageUrl: o.imageUrl,
          correct: o.correct ?? false,
          position: j,
        });
      }
    }
    return post.id;
  });

  return getDeckById(postId, authorId);
}

/** Sửa toàn bộ cấu trúc Deck (author only). Thay câu hỏi/phương án; điểm bài đã nộp cũ
 *  giữ nguyên (không tự chấm lại). */
export async function updateDeck(id: string, authorId: string, input: CreateDeckInput): Promise<DeckView> {
  const [post] = await db
    .select({ authorId: posts.authorId, type: posts.type })
    .from(posts)
    .where(eq(posts.id, id));
  if (!post) throw notFound('Deck not found');
  if (post.type !== 'deck') throw badRequest('Post is not a deck');
  if (post.authorId !== authorId) throw forbidden('Only the author can edit this deck');

  await db.transaction(async (tx) => {
    await tx
      .update(posts)
      .set({
        deckMode: input.deckMode,
        title: input.title,
        subtitle: input.subtitle,
        caption: input.caption,
        category: input.category,
        media: input.media,
        examDurationMinutes: input.examDurationMinutes,
        passingScore: input.passingScore?.toString(),
        allowGuestPresent: input.allowGuestPresent ?? false,
        tags: tagsFor(input.tags, input.caption, input.category),
      })
      .where(eq(posts.id, id));

    // Xoá câu hỏi cũ (options cascade), insert cấu trúc mới.
    await tx.delete(deckQuestions).where(eq(deckQuestions.postId, id));
    for (let i = 0; i < input.questions.length; i++) {
      const q = input.questions[i];
      const [qRow] = await tx
        .insert(deckQuestions)
        .values({ postId: id, position: i, text: q.text, votingType: q.votingType, points: q.points.toString(), imageUrl: q.imageUrl })
        .returning({ id: deckQuestions.id });
      for (let j = 0; j < q.options.length; j++) {
        const o = q.options[j];
        await tx.insert(deckOptions).values({
          questionId: qRow.id,
          label: o.label,
          emoji: o.imageUrl ? null : o.emoji, // có ảnh → bỏ emoji giữ chỗ
          imageUrl: o.imageUrl,
          correct: o.correct ?? false,
          position: j,
        });
      }
    }
  });

  return getDeckById(id, authorId);
}

async function loadDeck(id: string) {
  const [post] = await db.select().from(posts).where(eq(posts.id, id));
  if (!post || post.type !== 'deck') throw notFound('Deck not found');
  const questions = await db.select().from(deckQuestions).where(eq(deckQuestions.postId, id));
  const qIds = questions.map((q) => q.id);
  const options = qIds.length
    ? await db.select().from(deckOptions).where(inArray(deckOptions.questionId, qIds))
    : [];
  return { post, questions, options };
}

export async function getDeckById(id: string, viewerId?: string): Promise<DeckView> {
  const { post, questions, options } = await loadDeck(id);
  // Các truy vấn phụ độc lập → 1 lượt song song.
  const [authorRows, partRows, s, sharesCount] = await Promise.all([
    db.select().from(users).where(eq(users.id, post.authorId)),
    viewerId
      ? db.select().from(participations).where(and(eq(participations.userId, viewerId), eq(participations.postId, id)))
      : Promise.resolve([]),
    getPostSeries(id), // đính kèm series (chapter) để web nhóm/chuyển chapter
    countSharesOne(id),
  ]);
  const author = authorRows[0];

  const optionsByQuestion = new Map<string, DeckOption[]>();
  for (const o of options) {
    const list = optionsByQuestion.get(o.questionId) ?? [];
    list.push(o);
    optionsByQuestion.set(o.questionId, list);
  }

  const myResult = viewerId ? (partRows[0] ?? null) : undefined;

  // Chủ bài được thấy cờ `correct` (để sửa Exam); người khác thì không.
  const includeCorrect = Boolean(viewerId && viewerId === post.authorId);
  const view = toDeckView(post, author ?? null, questions, optionsByQuestion, myResult, includeCorrect);
  return { ...view, sharesCount, seriesId: s?.seriesId ?? null, seriesName: s?.seriesName ?? null };
}

function setEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length || a.length === 0) return false;
  const sb = new Set(b);
  return a.every((x) => sb.has(x));
}

function normalizeAnswer(v: string | string[] | null | undefined): string[] {
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
}

export async function submitDeck(
  userId: string,
  postId: string,
  input: SubmitDeckInput,
): Promise<DeckResult> {
  const { post, questions, options } = await loadDeck(postId);

  const optionsByQuestion = new Map<string, DeckOption[]>();
  for (const o of options) {
    const list = optionsByQuestion.get(o.questionId) ?? [];
    list.push(o);
    optionsByQuestion.set(o.questionId, list);
  }

  let score: number | null = null;
  let maxScoreOut: number | null = null;
  let correctCount: number | null = null;
  let totalGradable: number | null = null;
  let detail: string;

  if (post.deckMode === 'exam') {
    // Server re-grades against deck_options.correct — client score is ignored.
    let s = 0;
    let correct = 0;
    let gradable = 0;
    let maxScore = 0;
    for (const q of questions) {
      const pts = Number(q.points);
      if (pts <= 0) continue;
      gradable++;
      maxScore += pts;
      const correctIds = (optionsByQuestion.get(q.id) ?? [])
        .filter((o) => o.correct)
        .map((o) => o.id);
      const given = normalizeAnswer(input.answers[q.id]);
      if (setEqual(given, correctIds)) {
        s += pts;
        correct++;
      }
    }
    score = Math.round(s * 10) / 10;
    maxScoreOut = maxScore > 0 ? maxScore : null;
    correctCount = correct;
    totalGradable = gradable;
    detail = `${score}/${Math.round(maxScore * 10) / 10} · ${correct}/${gradable} câu đúng`;
  } else {
    const answered = questions.filter((q) => normalizeAnswer(input.answers[q.id]).length > 0).length;
    detail = `${answered}/${questions.length} câu`;
  }

  const [row] = await db
    .insert(participations)
    .values({
      userId,
      postId,
      type: 'deck',
      deckMode: post.deckMode,
      score: score === null ? null : score.toString(),
      correctCount,
      totalGradable,
      answers: input.answers,
      detail,
    })
    .onConflictDoUpdate({
      target: [participations.userId, participations.postId],
      set: {
        score: score === null ? null : score.toString(),
        correctCount,
        totalGradable,
        answers: input.answers,
        detail,
        updatedAt: new Date(),
      },
    })
    .returning();

  return toDeckResult(row, maxScoreOut, post.deckMode === 'exam' ? correctMapOf(optionsByQuestion) : undefined);
}

export async function getMyResult(userId: string, postId: string): Promise<DeckResult | null> {
  const [p] = await db
    .select()
    .from(participations)
    .where(and(eq(participations.userId, userId), eq(participations.postId, postId)));
  if (!p) return null;
  if (p.deckMode !== 'exam') return toDeckResult(p, null);
  const qs = await db.select({ id: deckQuestions.id }).from(deckQuestions).where(eq(deckQuestions.postId, postId));
  const os = qs.length ? await db.select().from(deckOptions).where(inArray(deckOptions.questionId, qs.map((q) => q.id))) : [];
  const byQ = new Map<string, typeof os>();
  for (const o of os) byQ.set(o.questionId, [...(byQ.get(o.questionId) ?? []), o]);
  return toDeckResult(p, await examMaxScore(postId), correctMapOf(byQ));
}

/** Phân bố đáp án THẬT theo câu (chỉ số đếm, ẩn danh — không kèm cờ đúng/sai). */
export interface QuestionTally {
  id: string;
  answered: number;
  options: { id: string; count: number }[];
}

/** Đếm số lần chọn từng đáp án + số câu tự luận đã trả lời, theo thứ tự câu/đáp án. */
async function tallyAnswers(postId: string, parts: { answers: unknown }[]): Promise<QuestionTally[]> {
  const questions = await db.select().from(deckQuestions).where(eq(deckQuestions.postId, postId));
  const qIds = questions.map((q) => q.id);
  const opts = qIds.length ? await db.select().from(deckOptions).where(inArray(deckOptions.questionId, qIds)) : [];
  const optionCounts = new Map<string, number>();
  const textCounts = new Map<string, number>();
  for (const p of parts) {
    const answers = (p.answers ?? {}) as Record<string, unknown>;
    for (const q of questions) {
      const given = answers[q.id];
      if (q.votingType === 'text') {
        if (typeof given === 'string' && given.trim()) textCounts.set(q.id, (textCounts.get(q.id) ?? 0) + 1);
      } else {
        for (const oid of toIdArray(given)) optionCounts.set(oid, (optionCounts.get(oid) ?? 0) + 1);
      }
    }
  }
  return questions
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((q) => {
      const qOpts = opts.filter((o) => o.questionId === q.id).sort((a, b) => a.position - b.position);
      const answered = q.votingType === 'text' ? textCounts.get(q.id) ?? 0 : qOpts.reduce((s, o) => s + (optionCounts.get(o.id) ?? 0), 0);
      return { id: q.id, answered, options: qOpts.map((o) => ({ id: o.id, count: optionCounts.get(o.id) ?? 0 })) };
    });
}

export async function getStats(postId: string): Promise<{
  participants: number;
  avgScore: number | null;
  maxScore?: number | null;
  avgScore10?: number | null;
  /** điểm (thang 10) của từng người đã làm — ẩn danh, để vẽ phân bố điểm thật */
  scores10?: number[];
  /** phân bố đáp án thật theo câu — cùng một kiểu hiển thị kết quả ở mọi màn */
  questions?: QuestionTally[];
}> {
  const [post] = await db
    .select({ id: posts.id, type: posts.type, deckMode: posts.deckMode })
    .from(posts)
    .where(eq(posts.id, postId));
  if (!post || post.type !== 'deck') throw notFound('Deck not found');

  const [row] = await db
    .select({ participants: count(), avgScore: avg(participations.score) })
    .from(participations)
    .where(eq(participations.postId, postId));

  const avgRaw = post.deckMode === 'exam' && row?.avgScore != null ? Math.round(Number(row.avgScore) * 10) / 10 : null;
  const all = await db
    .select({ score: participations.score, answers: participations.answers })
    .from(participations)
    .where(eq(participations.postId, postId))
    .limit(2000);
  const questions = await tallyAnswers(postId, all);
  if (post.deckMode !== 'exam') return { participants: Number(row?.participants ?? 0), avgScore: null, questions };
  const maxScore = await examMaxScore(postId);
  const scores10 = all.map((r) => toScore10(r.score === null ? null : Number(r.score), maxScore)).filter((x): x is number => x != null);
  return {
    participants: Number(row?.participants ?? 0),
    avgScore: avgRaw,
    maxScore,
    avgScore10: toScore10(avgRaw, maxScore),
    scores10,
    questions,
  };
}

function toIdArray(a: unknown): string[] {
  if (Array.isArray(a)) return a.filter((x): x is string => typeof x === 'string');
  if (typeof a === 'string') return [a];
  return [];
}

/**
 * Bảng điều khiển kết quả cho CHỦ bài: tổng hợp per-question (số chọn từng đáp án)
 * + phổ điểm. Chỉ chủ bài xem được (kèm cờ `correct`).
 */
export async function getDeckResults(postId: string, viewerId: string) {
  const [post] = await db
    .select({ id: posts.id, type: posts.type, deckMode: posts.deckMode, authorId: posts.authorId, passingScore: posts.passingScore })
    .from(posts)
    .where(eq(posts.id, postId));
  if (!post || post.type !== 'deck') throw notFound('Deck not found');
  if (post.authorId !== viewerId) throw forbidden('Chỉ chủ bài mới xem được bảng kết quả');

  const isExam = post.deckMode === 'exam';
  const questions = await db.select().from(deckQuestions).where(eq(deckQuestions.postId, postId));
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

  const parts = await db
    .select({ answers: participations.answers, score: participations.score })
    .from(participations)
    .where(eq(participations.postId, postId));

  // Đếm lựa chọn từng đáp án + số câu trả lời tự luận.
  const optionCounts = new Map<string, number>();
  const textCounts = new Map<string, number>();
  for (const p of parts) {
    const answers = (p.answers ?? {}) as Record<string, unknown>;
    for (const q of questions) {
      const given = answers[q.id];
      if (q.votingType === 'text') {
        if (typeof given === 'string' && given.trim()) textCounts.set(q.id, (textCounts.get(q.id) ?? 0) + 1);
      } else {
        for (const oid of toIdArray(given)) optionCounts.set(oid, (optionCounts.get(oid) ?? 0) + 1);
      }
    }
  }

  const scores = isExam
    ? parts.filter((p) => p.score != null).map((p) => Number(p.score))
    : [];
  const avgScore = scores.length ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10 : null;

  return {
    deckMode: post.deckMode,
    passingScore: post.passingScore == null ? null : Number(post.passingScore),
    participants: parts.length,
    submitted: parts.length,
    avgScore,
    scores,
    questions: questions
      .slice()
      .sort((a, b) => a.position - b.position)
      .map((q) => {
        const qOpts = (optsByQ.get(q.id) ?? []).slice().sort((a, b) => a.position - b.position);
        const answered =
          q.votingType === 'text'
            ? textCounts.get(q.id) ?? 0
            : qOpts.reduce((s, o) => s + (optionCounts.get(o.id) ?? 0), 0);
        return {
          id: q.id,
          text: q.text,
          votingType: q.votingType,
          points: Number(q.points),
          answered,
          options: qOpts.map((o) => ({
            id: o.id,
            label: o.label,
            emoji: o.emoji,
            correct: isExam ? o.correct : undefined,
            count: optionCounts.get(o.id) ?? 0,
          })),
        };
      }),
  };
}
