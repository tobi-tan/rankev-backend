import { and, eq } from 'drizzle-orm';
import { db } from '../../db';
import { comments, posts, reports, userBlocks, users } from '../../db/schema';
import { badRequest, notFound } from '../../lib/errors';
import type { ReportInput } from './moderation.schemas';

type TargetType = 'post' | 'comment' | 'user';

async function assertTargetExists(type: TargetType, id: string): Promise<void> {
  const table = type === 'post' ? posts : type === 'comment' ? comments : users;
  const [row] = await db.select({ id: table.id }).from(table).where(eq(table.id, id));
  if (!row) throw notFound(`${type} not found`);
}

/** Record a content/user report (idempotent per reporter+target). */
export async function report(
  reporterId: string,
  type: TargetType,
  targetId: string,
  input: ReportInput,
): Promise<void> {
  await assertTargetExists(type, targetId);
  await db
    .insert(reports)
    .values({
      reporterId,
      targetType: type,
      targetId,
      reason: input.reason,
      note: input.note,
    })
    .onConflictDoNothing();
}

export async function blockUser(blockerId: string, blockedId: string): Promise<void> {
  if (blockerId === blockedId) throw badRequest('You cannot block yourself');
  await assertTargetExists('user', blockedId);
  await db.insert(userBlocks).values({ blockerId, blockedId }).onConflictDoNothing();
}

export async function unblockUser(blockerId: string, blockedId: string): Promise<void> {
  await db
    .delete(userBlocks)
    .where(and(eq(userBlocks.blockerId, blockerId), eq(userBlocks.blockedId, blockedId)));
}

/** Ids this viewer has blocked — used to filter them out of feeds. */
export async function getBlockedIds(viewerId: string): Promise<string[]> {
  const rows = await db
    .select({ blockedId: userBlocks.blockedId })
    .from(userBlocks)
    .where(eq(userBlocks.blockerId, viewerId));
  return rows.map((r) => r.blockedId);
}
