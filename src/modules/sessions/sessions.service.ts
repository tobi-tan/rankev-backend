import { desc, eq } from 'drizzle-orm';
import { db } from '../../db';
import { presentationSessions, posts, type PresentationSession } from '../../db/schema';
import { notFound } from '../../lib/errors';
import type { CreateSessionInput } from './sessions.schemas';

export interface SessionView {
  id: string;
  postId: string;
  postTitle: string | null;
  name: string | null;
  startedAt: string;
  endedAt: string | null;
  participants: number;
  avgScore: number | null;
  totalVotes: number | null;
}

function toView(s: PresentationSession, postTitle: string | null): SessionView {
  return {
    id: s.id,
    postId: s.postId,
    postTitle,
    name: s.name,
    startedAt: s.startedAt.toISOString(),
    endedAt: s.endedAt ? s.endedAt.toISOString() : null,
    participants: s.participants,
    avgScore: s.avgScore === null ? null : Number(s.avgScore),
    totalVotes: s.totalVotes,
  };
}

export async function createSession(
  hostId: string,
  postId: string,
  input: CreateSessionInput,
): Promise<SessionView> {
  const [post] = await db.select({ id: posts.id, title: posts.title }).from(posts).where(eq(posts.id, postId));
  if (!post) throw notFound('Post not found');

  const [row] = await db
    .insert(presentationSessions)
    .values({
      postId,
      hostId,
      name: input.name,
      participants: input.participants ?? 0,
      avgScore: input.avgScore?.toString(),
      totalVotes: input.totalVotes,
      endedAt: input.endedAt,
    })
    .returning();

  return toView(row, post.title);
}

export async function getMySessions(hostId: string): Promise<SessionView[]> {
  const rows = await db
    .select({ s: presentationSessions, title: posts.title })
    .from(presentationSessions)
    .leftJoin(posts, eq(posts.id, presentationSessions.postId))
    .where(eq(presentationSessions.hostId, hostId))
    .orderBy(desc(presentationSessions.startedAt))
    .limit(100);
  return rows.map((r) => toView(r.s, r.title));
}

export async function getPostSessions(postId: string): Promise<SessionView[]> {
  const rows = await db
    .select({ s: presentationSessions, title: posts.title })
    .from(presentationSessions)
    .leftJoin(posts, eq(posts.id, presentationSessions.postId))
    .where(eq(presentationSessions.postId, postId))
    .orderBy(desc(presentationSessions.startedAt))
    .limit(100);
  return rows.map((r) => toView(r.s, r.title));
}
