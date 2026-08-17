import type { Post, PathQuestion, PathAnswer, PathEnding, Participation } from '../../db/schema';
import { toPublicUser, type PublicUser } from '../users/users.serializer';
import type { User } from '../../db/schema';

export interface PathAnswerView {
  id: string;
  label: string | null;
  emoji: string | null;
  imageUrl: string | null;
  hotspotX: number | null;
  hotspotY: number | null;
  targetType: 'question' | 'ending' | null;
  targetId: string | null;
  position: number;
}

export interface PathQuestionView {
  id: string;
  position: number;
  text: string | null;
  sceneImageUrl: string | null;
  isEntry: boolean;
  answers: PathAnswerView[];
}

export interface PathEndingView {
  id: string;
  name: string;
  emoji: string | null;
  imageUrl: string | null;
  count: number;
  comment: string | null;
}

export interface PathView {
  id: string;
  type: 'path';
  title: string;
  subtitle: string | null;
  caption: string | null;
  category: string | null;
  media: Post['media'];
  createdAt: string;
  revealMode: Post['revealMode'];
  hideEndingCount: boolean;
  author: PublicUser | null;
  questions: PathQuestionView[];
  endings: PathEndingView[];
  entryQuestionId: string | null;
  seriesId?: string | null;
  seriesName?: string | null;
  myEnding?: string | null;
  unlockedEndings?: string[];
}

function num(v: string | null): number | null {
  return v === null ? null : Number(v);
}

export function toPathView(
  post: Post,
  author: User | null,
  questions: PathQuestion[],
  answersByQuestion: Map<string, PathAnswer[]>,
  endings: PathEnding[],
  extras?: { myEnding?: string | null; unlockedEndings?: string[] },
): PathView {
  const qViews = questions
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((q) => ({
      id: q.id,
      position: q.position,
      text: q.text,
      sceneImageUrl: q.sceneImageUrl,
      isEntry: q.isEntry,
      answers: (answersByQuestion.get(q.id) ?? [])
        .slice()
        .sort((a, b) => a.position - b.position)
        .map((a) => ({
          id: a.id,
          label: a.label,
          emoji: a.emoji,
          imageUrl: a.imageUrl,
          hotspotX: num(a.hotspotX),
          hotspotY: num(a.hotspotY),
          targetType: a.targetType,
          targetId: a.targetId,
          position: a.position,
        })),
    }));

  const entry = qViews.find((q) => q.isEntry) ?? qViews[0];

  const view: PathView = {
    id: post.id,
    type: 'path',
    title: post.title,
    subtitle: post.subtitle,
    caption: post.caption,
    category: post.category,
    media: post.media,
    createdAt: post.createdAt.toISOString(),
    revealMode: post.revealMode,
    hideEndingCount: post.hideEndingCount,
    author: author ? toPublicUser(author) : null,
    questions: qViews,
    endings: endings.map((e) => ({
      id: e.id,
      name: e.name,
      emoji: e.emoji,
      imageUrl: e.imageUrl,
      count: post.hideEndingCount ? 0 : e.count,
      comment: e.comment,
    })),
    entryQuestionId: entry?.id ?? null,
  };
  if (extras) {
    if (extras.myEnding !== undefined) view.myEnding = extras.myEnding;
    if (extras.unlockedEndings !== undefined) view.unlockedEndings = extras.unlockedEndings;
  }
  return view;
}

export function participationEnding(p: Participation | undefined): string | null {
  return p?.endingName ?? null;
}
