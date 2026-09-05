import { and, asc, desc, eq, inArray, ne, sql } from 'drizzle-orm';
import { db } from '../../db';
import {
  conversations,
  conversationMembers,
  messages,
  messagePollVotes,
  users,
} from '../../db/schema';
import { badRequest, forbidden, notFound } from '../../lib/errors';

// ---- Author preview dùng chung cho danh sách hội thoại + tin nhắn ----
function authorView(u: {
  id: string;
  name: string;
  handle: string;
  avatarEmoji: string | null;
  avatarColor: string | null;
  avatarUrl: string | null;
  verified: boolean;
}) {
  return {
    id: u.id,
    name: u.name,
    handle: u.handle.startsWith('@') ? u.handle : `@${u.handle}`,
    avatarEmoji: u.avatarEmoji,
    avatarColor: u.avatarColor,
    avatarUrl: u.avatarUrl,
    verified: u.verified,
  };
}

const USER_COLS = {
  id: users.id,
  name: users.name,
  handle: users.handle,
  avatarEmoji: users.avatarEmoji,
  avatarColor: users.avatarColor,
  avatarUrl: users.avatarUrl,
  verified: users.verified,
};

async function assertMember(conversationId: string, userId: string) {
  const [m] = await db
    .select({ userId: conversationMembers.userId })
    .from(conversationMembers)
    .where(and(eq(conversationMembers.conversationId, conversationId), eq(conversationMembers.userId, userId)));
  if (!m) throw forbidden('Bạn không thuộc cuộc trò chuyện này');
}

// Tìm (hoặc tạo) DM 1-1 giữa hai người. Idempotent: không tạo trùng.
export async function getOrCreateDM(userId: string, otherUserId: string) {
  if (userId === otherUserId) throw badRequest('Không thể nhắn tin cho chính mình');
  const [other] = await db.select({ id: users.id }).from(users).where(eq(users.id, otherUserId));
  if (!other) throw notFound('Không tìm thấy người dùng');

  // DM đã tồn tại? (hội thoại không phải nhóm, chứa đúng cả hai)
  const mine = await db
    .select({ conversationId: conversationMembers.conversationId })
    .from(conversationMembers)
    .where(eq(conversationMembers.userId, userId));
  const myIds = mine.map((r) => r.conversationId);
  if (myIds.length) {
    const shared = await db
      .select({ conversationId: conversationMembers.conversationId })
      .from(conversationMembers)
      .innerJoin(conversations, eq(conversations.id, conversationMembers.conversationId))
      .where(
        and(
          inArray(conversationMembers.conversationId, myIds),
          eq(conversationMembers.userId, otherUserId),
          eq(conversations.isGroup, false),
        ),
      );
    if (shared[0]) return getConversationMeta(shared[0].conversationId, userId);
  }

  const id = await db.transaction(async (tx) => {
    const [c] = await tx
      .insert(conversations)
      .values({ isGroup: false, createdBy: userId })
      .returning({ id: conversations.id });
    await tx.insert(conversationMembers).values([
      { conversationId: c.id, userId },
      { conversationId: c.id, userId: otherUserId },
    ]);
    return c.id;
  });
  return getConversationMeta(id, userId);
}

// Metadata 1 hội thoại (dưới góc nhìn viewer): đối phương, tin cuối, số chưa đọc.
async function getConversationMeta(conversationId: string, viewerId: string) {
  const [c] = await db.select().from(conversations).where(eq(conversations.id, conversationId));
  if (!c) throw notFound('Không tìm thấy cuộc trò chuyện');
  const [me] = await db
    .select({ lastReadAt: conversationMembers.lastReadAt })
    .from(conversationMembers)
    .where(and(eq(conversationMembers.conversationId, conversationId), eq(conversationMembers.userId, viewerId)));

  const others = await db
    .select(USER_COLS)
    .from(conversationMembers)
    .innerJoin(users, eq(users.id, conversationMembers.userId))
    .where(and(eq(conversationMembers.conversationId, conversationId), ne(conversationMembers.userId, viewerId)));

  const [last] = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(desc(messages.createdAt))
    .limit(1);

  const lastReadAt = me?.lastReadAt ?? null;
  const [{ cnt } = { cnt: 0 }] = await db
    .select({ cnt: sql<number>`count(*)::int` })
    .from(messages)
    .where(
      and(
        eq(messages.conversationId, conversationId),
        ne(messages.senderId, viewerId),
        lastReadAt ? sql`${messages.createdAt} > ${lastReadAt}` : sql`true`,
      ),
    );

  const title = c.isGroup ? c.title : others[0]?.name ?? 'Cuộc trò chuyện';
  return {
    id: c.id,
    isGroup: c.isGroup,
    title,
    members: others.map(authorView),
    lastMessage: last ? summarizeMessage(last) : null,
    lastTime: (last?.createdAt ?? c.createdAt).toISOString(),
    unread: Number(cnt) || 0,
  };
}

function summarizeMessage(m: typeof messages.$inferSelect) {
  if (m.kind === 'share') return '📎 Đã chia sẻ một bài';
  if (m.kind === 'poll') return `📊 ${(m.poll as { question?: string })?.question || 'Bình chọn nhanh'}`;
  return m.body || '';
}

export async function listConversations(viewerId: string) {
  const rows = await db
    .select({ conversationId: conversationMembers.conversationId })
    .from(conversationMembers)
    .where(eq(conversationMembers.userId, viewerId));
  const metas = await Promise.all(rows.map((r) => getConversationMeta(r.conversationId, viewerId)));
  // Mới nhất lên đầu.
  return metas.sort((a, b) => (a.lastTime < b.lastTime ? 1 : -1));
}

// Số phiếu poll của một tin (theo optionIdx) + lựa chọn của viewer.
async function pollTally(messageId: string, viewerId: string) {
  const rows = await db
    .select({ optionIdx: messagePollVotes.optionIdx, userId: messagePollVotes.userId })
    .from(messagePollVotes)
    .where(eq(messagePollVotes.messageId, messageId));
  const counts: Record<number, number> = {};
  let myVote: number | null = null;
  for (const r of rows) {
    counts[r.optionIdx] = (counts[r.optionIdx] || 0) + 1;
    if (r.userId === viewerId) myVote = r.optionIdx;
  }
  return { counts, myVote, total: rows.length };
}

async function serializeMessage(m: typeof messages.$inferSelect, viewerId: string) {
  const base = {
    id: m.id,
    conversationId: m.conversationId,
    senderId: m.senderId,
    kind: m.kind,
    body: m.body,
    refType: m.refType,
    refId: m.refId,
    time: m.createdAt.toISOString(),
  };
  if (m.kind === 'poll') {
    const tally = await pollTally(m.id, viewerId);
    return { ...base, poll: m.poll, pollVotes: tally.counts, pollTotal: tally.total, myVote: tally.myVote };
  }
  return base;
}

export async function getMessages(conversationId: string, viewerId: string) {
  await assertMember(conversationId, viewerId);
  const rows = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(asc(messages.createdAt))
    .limit(200);
  // Đánh dấu đã đọc tới hiện tại.
  await db
    .update(conversationMembers)
    .set({ lastReadAt: new Date() })
    .where(and(eq(conversationMembers.conversationId, conversationId), eq(conversationMembers.userId, viewerId)));
  return Promise.all(rows.map((m) => serializeMessage(m, viewerId)));
}

export interface SendMessageInput {
  kind?: 'text' | 'share' | 'poll';
  body?: string;
  refType?: string;
  refId?: string;
  poll?: { question: string; options: { label: string; emoji?: string }[] };
}

export async function sendMessage(conversationId: string, senderId: string, input: SendMessageInput) {
  await assertMember(conversationId, senderId);
  const kind = input.kind || 'text';
  if (kind === 'text' && !input.body?.trim()) throw badRequest('Tin nhắn trống');
  if (kind === 'share' && !input.refId) throw badRequest('Thiếu bài chia sẻ');
  if (kind === 'poll') {
    if (!input.poll?.question?.trim()) throw badRequest('Thiếu câu hỏi bình chọn');
    if (!Array.isArray(input.poll.options) || input.poll.options.length < 2) throw badRequest('Cần ít nhất 2 lựa chọn');
  }
  const [m] = await db
    .insert(messages)
    .values({
      conversationId,
      senderId,
      kind,
      body: input.body ?? null,
      refType: input.refType ?? null,
      refId: input.refId ?? null,
      poll: kind === 'poll' ? input.poll : null,
    })
    .returning();
  // Gửi tin làm hội thoại "mới" cho người gửi → cập nhật lastReadAt của họ.
  await db
    .update(conversationMembers)
    .set({ lastReadAt: new Date() })
    .where(and(eq(conversationMembers.conversationId, conversationId), eq(conversationMembers.userId, senderId)));
  return serializeMessage(m, senderId);
}

// Bình chọn poll trong chat (1 người 1 phiếu, đổi được). Trả về tally mới.
export async function votePoll(messageId: string, viewerId: string, optionIdx: number) {
  const [m] = await db.select().from(messages).where(eq(messages.id, messageId));
  if (!m || m.kind !== 'poll') throw notFound('Không tìm thấy bình chọn');
  await assertMember(m.conversationId, viewerId);
  const opts = (m.poll as { options?: unknown[] })?.options || [];
  if (optionIdx < 0 || optionIdx >= opts.length) throw badRequest('Lựa chọn không hợp lệ');
  await db
    .insert(messagePollVotes)
    .values({ messageId, userId: viewerId, optionIdx })
    .onConflictDoUpdate({
      target: [messagePollVotes.messageId, messagePollVotes.userId],
      set: { optionIdx },
    });
  const tally = await pollTally(messageId, viewerId);
  return { messageId, conversationId: m.conversationId, pollVotes: tally.counts, pollTotal: tally.total, myVote: tally.myVote };
}

// Tally poll dưới góc nhìn 1 người bất kỳ (dùng khi fan-out realtime).
export async function pollTallyFor(messageId: string, viewerId: string) {
  const tally = await pollTally(messageId, viewerId);
  return { pollVotes: tally.counts, pollTotal: tally.total, myVote: tally.myVote };
}

// Danh sách userId của mọi thành viên (để fan-out WS).
export async function conversationMemberIds(conversationId: string): Promise<string[]> {
  const rows = await db
    .select({ userId: conversationMembers.userId })
    .from(conversationMembers)
    .where(eq(conversationMembers.conversationId, conversationId));
  return rows.map((r) => r.userId);
}
