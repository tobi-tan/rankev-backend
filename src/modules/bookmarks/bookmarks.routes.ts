import type { FastifyInstance } from 'fastify';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '../../db';
import { bookmarks, posts } from '../../db/schema';
import { notFound } from '../../lib/errors';
import { authenticate, requireUserId } from '../../plugins/auth';
import { summariesByIds } from '../feed/feed.service';

export default async function bookmarksRoutes(app: FastifyInstance): Promise<void> {
  // GET /users/me/bookmarks — summaries of all bookmarked content (any type)
  app.get('/users/me/bookmarks', { preHandler: authenticate }, async (req) => {
    const userId = requireUserId(req);
    const rows = await db
      .select({ postId: bookmarks.postId })
      .from(bookmarks)
      .where(eq(bookmarks.userId, userId))
      .orderBy(desc(bookmarks.bookmarkedAt))
      .limit(50);

    const items = await summariesByIds(rows.map((r) => r.postId), userId);
    return { items };
  });

  // POST /posts/:id/bookmark
  app.post<{ Params: { id: string } }>(
    '/posts/:id/bookmark',
    { preHandler: authenticate },
    async (req, reply) => {
      const [p] = await db.select({ id: posts.id }).from(posts).where(eq(posts.id, req.params.id));
      if (!p) throw notFound('Post not found');
      await db
        .insert(bookmarks)
        .values({ userId: requireUserId(req), postId: req.params.id })
        .onConflictDoNothing();
      return reply.code(204).send();
    },
  );

  // DELETE /posts/:id/bookmark
  app.delete<{ Params: { id: string } }>(
    '/posts/:id/bookmark',
    { preHandler: authenticate },
    async (req, reply) => {
      await db
        .delete(bookmarks)
        .where(and(eq(bookmarks.userId, requireUserId(req)), eq(bookmarks.postId, req.params.id)));
      return reply.code(204).send();
    },
  );
}
