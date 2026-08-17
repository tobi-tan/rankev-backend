import { and, avg, count, eq, inArray } from 'drizzle-orm';
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
import { toDeckResult, toDeckView, type DeckResult, type DeckView } from './decks.serializer';
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
          emoji: o.emoji,
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
          emoji: o.emoji,
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
  const [author] = await db.select().from(users).where(eq(users.id, post.authorId));

  const optionsByQuestion = new Map<string, DeckOption[]>();
  for (const o of options) {
    const list = optionsByQuestion.get(o.questionId) ?? [];
    list.push(o);
    optionsByQuestion.set(o.questionId, list);
  }

  let myResult;
  if (viewerId) {
    const [p] = await db
      .select()
      .from(participations)
      .where(and(eq(participations.userId, viewerId), eq(participations.postId, id)));
    myResult = p ?? null;
  }

  // Chủ bài được thấy cờ `correct` (để sửa Exam); người khác thì không.
  const includeCorrect = Boolean(viewerId && viewerId === post.authorId);
  return toDeckView(post, author ?? null, questions, optionsByQuestion, myResult, includeCorrect);
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

  return toDeckResult(row);
}

export async function getMyResult(userId: string, postId: string): Promise<DeckResult | null> {
  const [p] = await db
    .select()
    .from(participations)
    .where(and(eq(participations.userId, userId), eq(participations.postId, postId)));
  return p ? toDeckResult(p) : null;
}

export async function getStats(postId: string): Promise<{
  participants: number;
  avgScore: number | null;
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

  return {
    participants: Number(row?.participants ?? 0),
    avgScore:
      post.deckMode === 'exam' && row?.avgScore != null
        ? Math.round(Number(row.avgScore) * 10) / 10
        : null,
  };
}
