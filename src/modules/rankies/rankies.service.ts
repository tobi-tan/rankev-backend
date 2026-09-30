import { and, asc, eq, sql } from 'drizzle-orm';
import { db } from '../../db';
import { posts, rankieOptions, votes, voteEvents, tournamentMatches } from '../../db/schema';
import { badRequest, forbidden, notFound } from '../../lib/errors';
import { toOptionView, type RankieOptionView } from '../posts/posts.serializer';
import type { VoteInput } from './rankies.schemas';

export interface MyVote {
  optionIds: string[];
  tapCount: number;
  votedAt: string;
  updatedAt: string;
}

export interface VoteResult {
  myVote: MyVote;
  options: RankieOptionView[];
}

function uniq(ids: string[]): string[] {
  return [...new Set(ids)];
}

/** Enforce selection count rules per voting type. */
function validateSelection(
  votingType: string | null,
  selected: string[],
  optionCount: number,
): void {
  const n = selected.length;
  switch (votingType) {
    case 'single':
    case 'rating':
    case 'unlimited':
      if (n !== 1) throw badRequest(`This poll accepts exactly one option (got ${n})`);
      break;
    case 'multiple':
      if (n < 1) throw badRequest('Select at least one option');
      if (n > optionCount) throw badRequest('Too many options selected');
      break;
    default:
      // voting_type null shouldn't happen for a rankie, but be safe.
      if (n !== 1) throw badRequest('This poll accepts exactly one option');
  }
}

export async function castVote(
  userId: string,
  rankieId: string,
  input: VoteInput,
): Promise<VoteResult> {
  const [post] = await db
    .select({
      id: posts.id,
      type: posts.type,
      votingType: posts.votingType,
      opensAt: posts.opensAt,
      closesAt: posts.closesAt,
    })
    .from(posts)
    .where(eq(posts.id, rankieId));

  if (!post || post.type !== 'rankie') throw notFound('Rankie not found');
  if (post.opensAt && post.opensAt.getTime() > Date.now()) {
    throw forbidden('Rankie chưa tới giờ lên sóng');
  }
  if (post.closesAt && post.closesAt.getTime() <= Date.now()) {
    throw forbidden('Voting for this Rankie has closed');
  }
  // Trận của giải đấu đã hẹn giờ MỞ nhưng chưa tới giờ → chưa cho bình chọn.
  const [tm] = await db
    .select({ opensAt: tournamentMatches.opensAt })
    .from(tournamentMatches)
    .where(eq(tournamentMatches.rankiePostId, rankieId))
    .limit(1);
  if (tm?.opensAt && tm.opensAt.getTime() > Date.now()) {
    throw forbidden('Trận đấu chưa mở bình chọn');
  }

  // Validate all supplied option ids belong to this rankie.
  const optionRows = await db
    .select({ id: rankieOptions.id })
    .from(rankieOptions)
    .where(eq(rankieOptions.rankieId, rankieId));
  const validIds = new Set(optionRows.map((o) => o.id));

  const isUnlimited = post.votingType === 'unlimited';
  // For unlimited a repeat "tap" keeps a single option; for the rest we dedupe.
  const selected = isUnlimited ? [input.optionIds[0]] : uniq(input.optionIds);

  for (const id of selected) {
    if (!validIds.has(id)) throw badRequest(`Option ${id} does not belong to this Rankie`);
  }
  validateSelection(post.votingType, selected, validIds.size);

  await db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(votes)
      .where(and(eq(votes.userId, userId), eq(votes.rankieId, rankieId)))
      .for('update');

    if (isUnlimited) {
      const opt = selected[0];
      if (existing) {
        const firstTapOnOption = !existing.optionIds.includes(opt);
        await tx
          .update(votes)
          .set({
            optionIds: [opt],
            tapCount: existing.tapCount + 1,
            updatedAt: new Date(),
          })
          .where(eq(votes.id, existing.id));
        await bumpOption(tx, rankieId, opt, 1, firstTapOnOption ? 1 : 0);
      } else {
        await tx.insert(votes).values({
          userId,
          rankieId,
          optionIds: [opt],
          tapCount: 1,
        });
        await bumpOption(tx, rankieId, opt, 1, 1);
      }
      return;
    }

    // single / multiple / rating: reconcile old vs new selection.
    const oldSet = new Set(existing?.optionIds ?? []);
    const newSet = new Set(selected);

    const removed = [...oldSet].filter((id) => !newSet.has(id));
    const added = [...newSet].filter((id) => !oldSet.has(id));

    for (const id of removed) await bumpOption(tx, rankieId, id, -1, -1);
    for (const id of added) await bumpOption(tx, rankieId, id, 1, 1);

    if (existing) {
      await tx
        .update(votes)
        .set({ optionIds: selected, updatedAt: new Date() })
        .where(eq(votes.id, existing.id));
    } else {
      await tx.insert(votes).values({ userId, rankieId, optionIds: selected });
    }
  });

  const [myVote, options] = await Promise.all([getMyVote(userId, rankieId), fetchOptions(rankieId)]);
  if (!myVote) throw new Error('Vote persisted but could not be read back');
  return { myVote, options };
}

/**
 * Huỷ phiếu ("bấm lại để huỷ"): xoá phiếu của người dùng, trừ số phiếu/người vote của các
 * lựa chọn đã chọn (ghi nhật ký cho dòng thời gian). Không có phiếu → không làm gì.
 * Bình chọn không giới hạn (gõ nhiều lần) không huỷ được.
 */
export async function removeVote(userId: string, rankieId: string): Promise<{ myVote: null; options: RankieOptionView[] }> {
  const [post] = await db
    .select({ type: posts.type, votingType: posts.votingType, closesAt: posts.closesAt })
    .from(posts)
    .where(eq(posts.id, rankieId));
  if (!post || post.type !== 'rankie') throw notFound('Rankie not found');
  if (post.votingType === 'unlimited') throw badRequest('Không thể huỷ phiếu ở bình chọn không giới hạn');
  if (post.closesAt && post.closesAt.getTime() <= Date.now()) throw forbidden('Voting for this Rankie has closed');

  await db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(votes)
      .where(and(eq(votes.userId, userId), eq(votes.rankieId, rankieId)))
      .for('update');
    if (!existing) return;
    for (const id of existing.optionIds) await bumpOption(tx, rankieId, id, -1, -1);
    await tx.delete(votes).where(eq(votes.id, existing.id));
  });
  return { myVote: null, options: await fetchOptions(rankieId) };
}

async function bumpOption(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  rankieId: string,
  optionId: string,
  dVotes: number,
  dVoters: number,
): Promise<void> {
  await tx
    .update(rankieOptions)
    .set({
      votes: sql`GREATEST(${rankieOptions.votes} + ${dVotes}, 0)`,
      voters: sql`GREATEST(${rankieOptions.voters} + ${dVoters}, 0)`,
    })
    .where(eq(rankieOptions.id, optionId));
  // Nhật ký ẩn danh cho "Dòng thời gian cạnh tranh".
  if (dVotes !== 0) await tx.insert(voteEvents).values({ rankieId, optionId, delta: dVotes });
}

async function fetchOptions(rankieId: string): Promise<RankieOptionView[]> {
  const rows = await db.select().from(rankieOptions).where(eq(rankieOptions.rankieId, rankieId));
  return rows.map(toOptionView).sort((a, b) => a.position - b.position);
}

/** Public vote distribution for a rankie. */
export async function getResults(
  rankieId: string,
): Promise<{ options: RankieOptionView[]; totalVotes: number; totalVoters: number }> {
  const [post] = await db
    .select({ id: posts.id, type: posts.type })
    .from(posts)
    .where(eq(posts.id, rankieId));
  if (!post || post.type !== 'rankie') throw notFound('Rankie not found');
  const options = await fetchOptions(rankieId);
  return {
    options,
    totalVotes: options.reduce((s, o) => s + o.votes, 0),
    totalVoters: options.reduce((s, o) => s + o.voters, 0),
  };
}

export interface TimelineEvent {
  type: 'first_vote' | 'lead' | 'milestone' | 'hold' | 'closed';
  optionId: string | null;
  label: string | null;
  /** milestone: mốc phiếu · hold: số ms giữ ngôi đầu · closed: số phiếu của bên thắng. */
  value: number | null;
  at: string;
}

const MILESTONES = [10, 50, 100, 500, 1000, 5000, 10000, 50000, 100000, 500000, 1000000];
const HOLD_MIN_MS = 3600e3;

/**
 * "Dòng thời gian cạnh tranh" dựng từ SỐ LIỆU THẬT: phát lại nhật ký `vote_events`
 * (gộp theo phút). Phần phiếu có trước khi có nhật ký được suy ra từ bảng `votes`
 * (thời điểm vote của từng người); phần còn lệch coi như có từ lúc đăng bài và không
 * sinh sự kiện. Trả tối đa `limit` sự kiện, mới nhất trước.
 */
export async function getTimeline(rankieId: string, limit = 5): Promise<{ events: TimelineEvent[] }> {
  const [post] = await db
    .select({
      type: posts.type,
      votingType: posts.votingType,
      createdAt: posts.createdAt,
      closesAt: posts.closesAt,
    })
    .from(posts)
    .where(eq(posts.id, rankieId));
  if (!post || post.type !== 'rankie') throw notFound('Rankie not found');

  const [opts, logged, legacyRows] = await Promise.all([
    db
      .select({ id: rankieOptions.id, label: rankieOptions.label, votes: rankieOptions.votes })
      .from(rankieOptions)
      .where(eq(rankieOptions.rankieId, rankieId)),
    db
      .select({
        optionId: voteEvents.optionId,
        at: sql<Date>`max(${voteEvents.createdAt})`.mapWith((v) => new Date(v)),
        from: sql<Date>`min(${voteEvents.createdAt})`.mapWith((v) => new Date(v)),
        delta: sql<number>`sum(${voteEvents.delta})`.mapWith(Number),
      })
      .from(voteEvents)
      .where(eq(voteEvents.rankieId, rankieId))
      // Gộp theo phút để bài "hot" không phải phát lại hàng triệu dòng; giữ thứ tự thật trong phút.
      .groupBy(voteEvents.optionId, sql`date_trunc('minute', ${voteEvents.createdAt})`)
      .orderBy(asc(sql`date_trunc('minute', ${voteEvents.createdAt})`), asc(sql`min(${voteEvents.id})`)),
    db
      .select({ optionIds: votes.optionIds, tapCount: votes.tapCount, votedAt: votes.votedAt })
      .from(votes)
      .where(eq(votes.rankieId, rankieId))
      .orderBy(asc(votes.votedAt)),
  ]);
  if (!opts.length) return { events: [] };
  const labelOf = new Map(opts.map((o) => [o.id, o.label ?? '']));

  // Phiếu có trước nhật ký = hiện tại − tổng delta đã ghi.
  const firstLoggedAt = logged.length ? Math.min(...logged.slice(0, 50).map((e) => e.from.getTime())) : Infinity;
  const loggedSum = new Map<string, number>();
  for (const e of logged) loggedSum.set(e.optionId, (loggedSum.get(e.optionId) ?? 0) + e.delta);
  const baseline = new Map(opts.map((o) => [o.id, Math.max(0, o.votes - (loggedSum.get(o.id) ?? 0))]));

  type Step = { optionId: string; delta: number; at: number; silent?: boolean };
  const steps: Step[] = [];
  const legacyUsed = new Map<string, number>();
  const legacy: Step[] = [];
  const isUnlimited = post.votingType === 'unlimited';
  for (const r of legacyRows) {
    const at = r.votedAt.getTime();
    if (at >= firstLoggedAt) continue;
    for (const id of r.optionIds) {
      const room = (baseline.get(id) ?? 0) - (legacyUsed.get(id) ?? 0);
      const n = Math.min(room, isUnlimited ? r.tapCount : 1);
      if (n <= 0) continue;
      legacyUsed.set(id, (legacyUsed.get(id) ?? 0) + n);
      legacy.push({ optionId: id, delta: n, at });
    }
  }
  const created = post.createdAt.getTime();
  for (const [id, base] of baseline) {
    const rest = base - (legacyUsed.get(id) ?? 0);
    if (rest > 0) steps.push({ optionId: id, delta: rest, at: created, silent: true });
  }
  steps.push(...legacy);
  for (const e of logged) {
    if (labelOf.has(e.optionId) && e.delta !== 0) steps.push({ optionId: e.optionId, delta: e.delta, at: e.at.getTime() });
  }

  const closedAt = post.closesAt && post.closesAt.getTime() <= Date.now() ? post.closesAt.getTime() : null;
  const counts = new Map(opts.map((o) => [o.id, 0]));
  const hit = new Map<string, number>(); // mốc cao nhất đã đạt của từng lựa chọn
  const out: (TimelineEvent & { ms: number })[] = [];
  const push = (type: TimelineEvent['type'], optionId: string | null, value: number | null, t: number) => {
    const ms = closedAt ? Math.min(t, closedAt) : t; // lệch đồng hồ vài ms quanh giờ đóng
    out.push({ type, optionId, label: optionId ? labelOf.get(optionId) ?? null : null, value, at: new Date(ms).toISOString(), ms });
  };
  const leaderNow = (): string | null => {
    let best: string | null = null;
    let max = 0;
    let tie = false;
    for (const [id, c] of counts) {
      if (c > max) { max = c; best = id; tie = false; } else if (c === max && c > 0) tie = true;
    }
    return tie ? null : best;
  };

  let total = 0;
  let lastLeader: string | null = null;
  let leaderSince = created;
  for (const s of steps) {
    const before = counts.get(s.optionId) ?? 0;
    const after = Math.max(0, before + s.delta);
    counts.set(s.optionId, after);
    const wasEmpty = total === 0;
    total += after - before;
    const leader = leaderNow();
    if (s.silent) {
      if (leader) { lastLeader = leader; leaderSince = s.at; }
      for (const m of MILESTONES) if (after >= m) hit.set(s.optionId, m);
      continue;
    }
    if (wasEmpty && total > 0) {
      push('first_vote', s.optionId, null, s.at);
    } else if (leader && leader !== lastLeader) {
      push('lead', leader, null, s.at);
    }
    if (leader && leader !== lastLeader) { lastLeader = leader; leaderSince = s.at; }
    for (const m of MILESTONES) {
      if (after >= m && (hit.get(s.optionId) ?? 0) < m) {
        hit.set(s.optionId, m);
        if (m === MILESTONES.filter((x) => x <= after).pop()) push('milestone', s.optionId, m, s.at);
      }
    }
  }

  const end = closedAt ?? Date.now();
  const leader = leaderNow();
  if (leader && leader === lastLeader && end - leaderSince >= HOLD_MIN_MS) {
    push('hold', leader, end - leaderSince, end);
  }
  if (closedAt && total > 0) {
    push('closed', leader, leader ? counts.get(leader) ?? 0 : null, closedAt);
  }

  // Mới nhất trước; cùng thời điểm thì sự kiện sinh sau (vd. "kết thúc") đứng trên.
  const events = out
    .map((e, i) => ({ e, i }))
    .sort((a, b) => b.e.ms - a.e.ms || b.i - a.i)
    .slice(0, limit)
    .map(({ e: { ms: _ms, ...rest } }) => rest);
  return { events };
}

export async function getMyVote(userId: string, rankieId: string): Promise<MyVote | null> {
  const [row] = await db
    .select()
    .from(votes)
    .where(and(eq(votes.userId, userId), eq(votes.rankieId, rankieId)));
  if (!row) return null;
  return {
    optionIds: row.optionIds,
    tapCount: row.tapCount,
    votedAt: row.votedAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
