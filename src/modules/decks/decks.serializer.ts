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
}

export interface DeckView {
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
  questions: DeckQuestionView[];
  myResult?: DeckResult | null;
}

export function toDeckResult(p: Participation): DeckResult {
  return {
    score: p.score === null ? null : Number(p.score),
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
    questions: qViews,
  };
  if (myResult !== undefined) view.myResult = myResult ? toDeckResult(myResult) : null;
  return view;
}
