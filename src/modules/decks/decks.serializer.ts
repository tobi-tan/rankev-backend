import type { Post, DeckQuestion, DeckOption, Participation, User } from '../../db/schema';
import { toPublicUser, type PublicUser } from '../users/users.serializer';

export interface DeckOptionView {
  id: string;
  label: string | null;
  emoji: string | null;
  imageUrl: string | null;
  position: number;
  // `correct` CHỈ trả cho chủ bài (để sửa Exam). Người khác không bao giờ thấy (anti-cheat).
  correct?: boolean;
}

export interface DeckQuestionView {
  id: string;
  position: number;
  text: string | null;
  votingType: DeckQuestion['votingType'];
  points: number;
  imageUrl: string | null;
  options: DeckOptionView[];
}

export interface DeckResult {
  score: number | null;
  correctCount: number | null;
  totalGradable: number | null;
  detail: string | null;
  answers: unknown;
  participatedAt: string;
  /** Tổng điểm tối đa của bài thi + điểm quy về THANG 10 (app hiển thị "x/10"). */
  maxScore?: number | null;
  score10?: number | null;
  /** Exam: đáp án đúng theo câu — CHỈ trả cho chính người đã nộp (xem lại bài sau khi nộp). */
  correctOptionIds?: Record<string, string[]>;
  /** Exam làm LẠI: chỉ là luyện tập — điểm chính thức vẫn là lần đầu (official). */
  practice?: boolean;
  official?: { score: number | null; score10: number | null; correctCount: number | null };
}

/** questionId → id các đáp án đúng (chỉ câu có đáp án đúng). */
export function correctMapOf(optionsByQuestion: Map<string, DeckOption[]>): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const [qid, opts] of optionsByQuestion) {
    const ids = opts.filter((o) => o.correct).map((o) => o.id);
    if (ids.length) out[qid] = ids;
  }
  return out;
}

export interface DeckView {
  /** số lượt gửi bài qua tin nhắn (thanh tương tác: chia sẻ); chỉ có ở GET chi tiết */
  sharesCount?: number;
  id: string;
  type: 'deck';
  deckMode: Post['deckMode'];
  title: string;
  subtitle: string | null;
  caption: string | null;
  category: string | null;
  media: Post['media'];
  createdAt: string;
  examDurationMinutes: number | null;
  passingScore: number | null;
  author: PublicUser | null;
  mine: boolean;
  allowGuestPresent: boolean;
  seriesId?: string | null;
  seriesName?: string | null;
  questions: DeckQuestionView[];
  myResult?: DeckResult | null;
}

export const toScore10 = (score: number | null, maxScore: number | null | undefined) =>
  score == null || !maxScore ? null : Math.round((score / maxScore) * 100) / 10;

export function toDeckResult(p: Participation, maxScore?: number | null, correctOptionIds?: Record<string, string[]>): DeckResult {
  const score = p.score === null ? null : Number(p.score);
  return {
    ...(correctOptionIds && p.deckMode === 'exam' ? { correctOptionIds } : {}),
    score,
    maxScore: maxScore ?? null,
    score10: toScore10(score, maxScore),
    correctCount: p.correctCount,
    totalGradable: p.totalGradable,
    detail: p.detail,
    answers: p.answers,
    participatedAt: p.participatedAt.toISOString(),
  };
}

export function toDeckView(
  post: Post,
  author: User | null,
  questions: DeckQuestion[],
  optionsByQuestion: Map<string, DeckOption[]>,
  myResult?: Participation | null,
  includeCorrect = false,
): DeckView {
  const qViews = questions
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((q) => ({
      id: q.id,
      position: q.position,
      text: q.text,
      votingType: q.votingType,
      points: Number(q.points),
      imageUrl: q.imageUrl,
      options: (optionsByQuestion.get(q.id) ?? [])
        .slice()
        .sort((a, b) => a.position - b.position)
        .map((o) => ({
          id: o.id,
          label: o.label,
          emoji: o.emoji,
          imageUrl: o.imageUrl,
          position: o.position,
          ...(includeCorrect ? { correct: o.correct } : {}),
        })),
    }));

  const view: DeckView = {
    id: post.id,
    type: 'deck',
    deckMode: post.deckMode,
    title: post.title,
    subtitle: post.subtitle,
    caption: post.caption,
    category: post.category,
    media: post.media,
    createdAt: post.createdAt.toISOString(),
    examDurationMinutes: post.examDurationMinutes,
    passingScore: post.passingScore === null ? null : Number(post.passingScore),
    author: author ? toPublicUser(author) : null,
    // `includeCorrect` chỉ true khi viewerId === authorId → cũng chính là "bài của mình".
    mine: includeCorrect,
    allowGuestPresent: post.allowGuestPresent,
    questions: qViews,
  };
  if (myResult !== undefined) {
    const maxScore = questions.reduce((t, q) => t + (Number(q.points) > 0 ? Number(q.points) : 0), 0);
    view.myResult = myResult ? toDeckResult(myResult, maxScore || null, post.deckMode === 'exam' ? correctMapOf(optionsByQuestion) : undefined) : null;
  }
  return view;
}
