import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { db } from '../../db';
import { users } from '../../db/schema';
import { notFound } from '../../lib/errors';
import { parse } from '../../lib/validate';
import { authenticate, requireUserId } from '../../plugins/auth';
import { getMyRankUps, getRankUpCounts } from '../rankups/rankups.service';
import { toPublicUser } from './users.serializer';
import { updateProfileSchema } from './users.schemas';
import * as usersService from './users.service';

export default async function usersRoutes(app: FastifyInstance): Promise<void> {
  // GET /users/me — current user + their RankUps map
  app.get('/me', { preHandler: authenticate }, async (req) => {
    const userId = requireUserId(req);
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (!user) throw notFound('User not found');
    const rankUps = await getMyRankUps(userId);
    return { user: toPublicUser(user), rankUps };
  });

  // PATCH /users/me — update profile
  app.patch('/me', { preHandler: authenticate }, async (req) => {
    const body = parse(updateProfileSchema, req.body);
    const user = await usersService.updateProfile(requireUserId(req), body);
    return { user };
  });

  // DELETE /users/me — permanently delete the account (App Store 5.1.1(v)).
  app.delete('/me', { preHandler: authenticate }, async (req, reply) => {
    await db.delete(users).where(eq(users.id, requireUserId(req)));
    return reply.code(204).send();
  });

  // GET /users/me/posts — own posts
  app.get('/me/posts', { preHandler: authenticate }, async (req) => {
    const items = await usersService.getUserPosts(requireUserId(req));
    return { items };
  });

  // GET /users/me/history — participation history
  app.get('/me/history', { preHandler: authenticate }, async (req) => {
    const items = await usersService.getHistory(requireUserId(req));
    return { items };
  });

  // GET /users/handle/:handle — hồ sơ công khai theo @handle (cho link ngắn + @nhắc tên)
  app.get<{ Params: { handle: string } }>('/handle/:handle', async (req) => {
    const user = await usersService.getByHandle(req.params.handle);
    const rankCounts = await getRankUpCounts(user.id);
    return { user, rankCounts };
  });

  // GET /users/handle/:handle/posts — bài công khai của user theo @handle
  app.get<{ Params: { handle: string } }>('/handle/:handle/posts', async (req) => {
    const user = await usersService.getByHandle(req.params.handle);
    const items = await usersService.getUserPosts(user.id);
    return { items };
  });

  // GET /users/:id — public profile (kèm số RankUp mỗi tầng: quan tâm/yêu thích/fan cuồng)
  app.get<{ Params: { id: string } }>('/:id', async (req) => {
    const [user] = await db.select().from(users).where(eq(users.id, req.params.id));
    if (!user) throw notFound('User not found');
    const rankCounts = await getRankUpCounts(user.id);
    return { user: toPublicUser(user), rankCounts };
  });

  // GET /users/:id/posts — a user's public posts
  app.get<{ Params: { id: string } }>('/:id/posts', async (req) => {
    const items = await usersService.getUserPosts(req.params.id);
    return { items };
  });
}
