import { and, count, eq, inArray } from 'drizzle-orm';
import { db } from '../../db';
import { messages } from '../../db/schema';

/**
 * Số lượt chia sẻ (gửi qua tin nhắn) của từng bài/giải — nguồn số "chia sẻ" trên thanh
 * tương tác. Mỗi lần gửi = 1 lượt (như Instagram đếm lượt gửi). Dùng index 0030.
 */
export async function countShares(refIds: string[]): Promise<Map<string, number>> {
  if (!refIds.length) return new Map();
  const rows = await db
    .select({ refId: messages.refId, c: count() })
    .from(messages)
    .where(and(eq(messages.kind, 'share'), inArray(messages.refId, refIds)))
    .groupBy(messages.refId);
  return new Map(rows.filter((r) => r.refId).map((r) => [r.refId as string, Number(r.c)]));
}

export async function countSharesOne(refId: string): Promise<number> {
  return (await countShares([refId])).get(refId) ?? 0;
}
