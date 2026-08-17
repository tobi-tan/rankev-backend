import { and, eq, inArray, sql } from 'drizzle-orm';
import { db } from '../../db';
import {
  posts,
  users,
  pathQuestions,
  pathAnswers,
  pathEndings,
  participations,
  pathUnlocks,
  type PathAnswer,
} from '../../db/schema';
import { badRequest, forbidden, notFound } from '../../lib/errors';
import { getPostSeries } from '../series/series.service';
import { toPathView, type PathView } from './paths.serializer';
import type { CreatePathInput, CompletePathInput } from './paths.schemas';

export async function createPath(authorId: string, input: CreatePathInput): Promise<PathView> {
  // Validate that every answer target resolves to a known question key / ending name.
  const questionKeys = new Set(input.questions.map((q) => q.key));
  const endingNames = new Set(input.endings.map((e) => e.name));
  for (const q of input.questions) {
    for (const a of q.answers) {
      if (a.targetType === 'question' && !questionKeys.has(a.targetKey)) {
        throw badRequest(`Answer targets unknown question "${a.targetKey}"`);
      }
      if (a.targetType === 'ending' && !endingNames.has(a.targetKey)) {
        throw badRequest(`Answer targets unknown ending "${a.targetKey}"`);
      }
    }
  }

  const postId = await db.transaction(async (tx) => {
    const [post] = await tx
      .insert(posts)
      .values({
        type: 'path',
        authorId,
        title: input.title,
        subtitle: input.subtitle,
        caption: input.caption,
        category: input.category,
        media: input.media,
        revealMode: input.revealMode,
        hideEndingCount: input.hideEndingCount,
      })
      .returning({ id: posts.id });

    // Insert questions, mapping client key -> db uuid.
    const keyToId = new Map<string, string>();
    for (let i = 0; i < input.questions.length; i++) {
      const q = input.questions[i];
      const [row] = await tx
        .insert(pathQuestions)
        .values({
          postId: post.id,
          position: i,
          text: q.text,
          sceneImageUrl: q.sceneImageUrl,
          isEntry: q.isEntry ?? i === 0,
        })
        .returning({ id: pathQuestions.id });
      keyToId.set(q.key, row.id);
    }

    // Endings.
    for (const e of input.endings) {
      await tx.insert(pathEndings).values({
        postId: post.id,
        name: e.name,
        emoji: e.emoji,
        imageUrl: e.imageUrl,
        comment: e.comment,
      });
    }

    // Answers (resolve targets).
    for (const q of input.questions) {
      const questionId = keyToId.get(q.key)!;
      for (let j = 0; j < q.answers.length; j++) {
        const a = q.answers[j];
        const targetId =
          a.targetType === 'question' ? keyToId.get(a.targetKey)! : a.targetKey; // ending name
        await tx.insert(pathAnswers).values({
          questionId,
          label: a.label,
          emoji: a.emoji,
          imageUrl: a.imageUrl,
          hotspotX: a.hotspotX?.toString(),
          hotspotY: a.hotspotY?.toString(),
          targetType: a.targetType,
          targetId,
          position: j,
        });
      }
    }

    return post.id;
  });

  return getPathById(postId, authorId);
}

/** Sửa toàn bộ cấu trúc Path (author only). Giữ số liệu ending theo TÊN (count cũ được
 *  khôi phục cho ending trùng tên; ending mới bắt đầu 0; ending bị bỏ thì mất count). */
export async function updatePath(id: string, authorId: string, input: CreatePathInput): Promise<PathView> {
  const [post] = await db
    .select({ authorId: posts.authorId, type: posts.type })
    .from(posts)
    .where(eq(posts.id, id));
  if (!post) throw notFound('Path not found');
  if (post.type !== 'path') throw badRequest('Post is not a path');
  if (post.authorId !== authorId) throw forbidden('Only the author can edit this path');

  const questionKeys = new Set(input.questions.map((q) => q.key));
  const endingNames = new Set(input.endings.map((e) => e.name));
  for (const q of input.questions) {
    for (const a of q.answers) {
      if (a.targetType === 'question' && !questionKeys.has(a.targetKey)) {
        throw badRequest(`Answer targets unknown question "${a.targetKey}"`);
      }
      if (a.targetType === 'ending' && !endingNames.has(a.targetKey)) {
        throw badRequest(`Answer targets unknown ending "${a.targetKey}"`);
      }
    }
  }

  await db.transaction(async (tx) => {
    await tx
      .update(posts)
      .set({
        title: input.title,
        subtitle: input.subtitle,
        caption: input.caption,
        category: input.category,
        media: input.media,
        revealMode: input.revealMode,
        hideEndingCount: input.hideEndingCount,
      })
      .where(eq(posts.id, id));

    // Giữ count ending cũ theo tên.
    const oldEndings = await tx
      .select({ name: pathEndings.name, count: pathEndings.count })
      .from(pathEndings)
      .where(eq(pathEndings.postId, id));
    const countByName = new Map(oldEndings.map((e) => [e.name, e.count]));

    // Xoá cấu trúc cũ (answers cascade theo question).
    await tx.delete(pathQuestions).where(eq(pathQuestions.postId, id));
    await tx.delete(pathEndings).where(eq(pathEndings.postId, id));

    const keyToId = new Map<string, string>();
    for (let i = 0; i < input.questions.length; i++) {
      const q = input.questions[i];
      const [row] = await tx
        .insert(pathQuestions)
        .values({ postId: id, position: i, text: q.text, sceneImageUrl: q.sceneImageUrl, isEntry: q.isEntry ?? i === 0 })
        .returning({ id: pathQuestions.id });
      keyToId.set(q.key, row.id);
    }
    for (const e of input.endings) {
      await tx.insert(pathEndings).values({
        postId: id,
        name: e.name,
        emoji: e.emoji,
        imageUrl: e.imageUrl,
        comment: e.comment,
        count: countByName.get(e.name) ?? 0,
      });
    }
    for (const q of input.questions) {
      const questionId = keyToId.get(q.key)!;
      for (let j = 0; j < q.answers.length; j++) {
        const a = q.answers[j];
        const targetId = a.targetType === 'question' ? keyToId.get(a.targetKey)! : a.targetKey;
        await tx.insert(pathAnswers).values({
          questionId,
          label: a.label,
          emoji: a.emoji,
          imageUrl: a.imageUrl,
          hotspotX: a.hotspotX?.toString(),
          hotspotY: a.hotspotY?.toString(),
          targetType: a.targetType,
          targetId,
          position: j,
        });
      }
    }
  });

  return getPathById(id, authorId);
}

export async function getPathById(id: string, viewerId?: string): Promise<PathView> {
  const [post] = await db.select().from(posts).where(eq(posts.id, id));
  if (!post || post.type !== 'path') throw notFound('Path not found');

  const [author] = await db.select().from(users).where(eq(users.id, post.authorId));
  const questions = await db.select().from(pathQuestions).where(eq(pathQuestions.postId, id));
  const qIds = questions.map((q) => q.id);
  const answers = qIds.length
    ? await db.select().from(pathAnswers).where(inArray(pathAnswers.questionId, qIds))
    : [];
  const endings = await db.select().from(pathEndings).where(eq(pathEndings.postId, id));

  const answersByQuestion = new Map<string, PathAnswer[]>();
  for (const a of answers) {
    const list = answersByQuestion.get(a.questionId) ?? [];
    list.push(a);
    answersByQuestion.set(a.questionId, list);
  }

  let extras: { myEnding?: string | null; unlockedEndings?: string[] } | undefined;
  if (viewerId) {
    const [part] = await db
      .select({ endingName: participations.endingName })
      .from(participations)
      .where(and(eq(participations.userId, viewerId), eq(participations.postId, id)));
    const unlocks = await db
      .select({ name: pathUnlocks.endingName })
      .from(pathUnlocks)
      .where(and(eq(pathUnlocks.userId, viewerId), eq(pathUnlocks.postId, id)));
    extras = {
      myEnding: part?.endingName ?? null,
      unlockedEndings: unlocks.map((u) => u.name),
    };
  }

  const view = toPathView(post, author ?? null, questions, answersByQuestion, endings, extras);
  const s = await getPostSeries(id); // đính kèm series (chapter) để web nhóm/chuyển chapter
  return { ...view, seriesId: s?.seriesId ?? null, seriesName: s?.seriesName ?? null };
}

export async function completePath(
  userId: string,
  postId: string,
  input: CompletePathInput,
): Promise<{ ending: string; unlockedEndings: string[]; endingCount: number }> {
  const [post] = await db
    .select({ id: posts.id, type: posts.type })
    .from(posts)
    .where(eq(posts.id, postId));
  if (!post || post.type !== 'path') throw notFound('Path not found');

  const [ending] = await db
    .select()
    .from(pathEndings)
    .where(and(eq(pathEndings.postId, postId), eq(pathEndings.name, input.endingName)));
  if (!ending) throw badRequest('Unknown ending');

  await db.transaction(async (tx) => {
    // Upsert participation (keep only the latest ending).
    await tx
      .insert(participations)
      .values({
        userId,
        postId,
        type: 'path',
        endingName: input.endingName,
        detail: input.endingName,
      })
      .onConflictDoUpdate({
        target: [participations.userId, participations.postId],
        set: { endingName: input.endingName, detail: input.endingName, updatedAt: new Date() },
      });

    // First time this user reaches this ending → record unlock + bump count.
    const inserted = await tx
      .insert(pathUnlocks)
      .values({ userId, postId, endingName: input.endingName })
      .onConflictDoNothing()
      .returning({ endingName: pathUnlocks.endingName });
    if (inserted.length > 0) {
      await tx
        .update(pathEndings)
        .set({ count: sql`${pathEndings.count} + 1` })
        .where(eq(pathEndings.id, ending.id));
    }
  });

  const unlocks = await db
    .select({ name: pathUnlocks.endingName })
    .from(pathUnlocks)
    .where(and(eq(pathUnlocks.userId, userId), eq(pathUnlocks.postId, postId)));
  const [fresh] = await db
    .select({ count: pathEndings.count })
    .from(pathEndings)
    .where(eq(pathEndings.id, ending.id));

  return {
    ending: input.endingName,
    unlockedEndings: unlocks.map((u) => u.name),
    endingCount: fresh?.count ?? 0,
  };
}

export async function getUnlocks(userId: string, postId: string): Promise<string[]> {
  const rows = await db
    .select({ name: pathUnlocks.endingName })
    .from(pathUnlocks)
    .where(and(eq(pathUnlocks.userId, userId), eq(pathUnlocks.postId, postId)));
  return rows.map((r) => r.name);
}

/** Everyone who has played this path (any ending), capped — for paths with >5 endings. */
export async function getAllCompanions(
  postId: string,
  limit = 12,
): Promise<{ id: string; handle: string; name: string; avatarEmoji: string | null; endingName: string | null }[]> {
  const rows = await db
    .select({
      id: users.id,
      handle: users.handle,
      name: users.name,
      avatarEmoji: users.avatarEmoji,
      endingName: participations.endingName,
    })
    .from(participations)
    .innerJoin(users, eq(users.id, participations.userId))
    .where(and(eq(participations.postId, postId), eq(participations.type, 'path')))
    .limit(limit);
  return rows;
}

/** Users who have reached a given ending (public profiles, capped). */
export async function getCompanions(
  postId: string,
  endingName: string,
  limit = 5,
): Promise<{ id: string; handle: string; name: string; avatarEmoji: string | null }[]> {
  const rows = await db
    .select({
      id: users.id,
      handle: users.handle,
      name: users.name,
      avatarEmoji: users.avatarEmoji,
    })
    .from(pathUnlocks)
    .innerJoin(users, eq(users.id, pathUnlocks.userId))
    .where(and(eq(pathUnlocks.postId, postId), eq(pathUnlocks.endingName, endingName)))
    .limit(limit);
  return rows;
}
