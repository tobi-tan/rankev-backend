import { and, eq, sql } from 'drizzle-orm';
import { db } from '../../db';
import { posts, rankieOptions, votes } from '../../db/schema';
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
      closesAt: posts.closesAt,
    })
    .from(posts)
    .where(eq(posts.id, rankieId));

  if (!post || post.type !== 'rankie') throw notFound('Rankie not found');
  if (post.closesAt && post.closesAt.getTime() <= Date.now()) {
    throw forbidden('Voting for this Rankie has closed');
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
        await bumpOption(tx, opt, 1, firstTapOnOption ? 1 : 0);
      } else {
        await tx.insert(votes).values({
          userId,
          rankieId,
          optionIds: [opt],
          tapCount: 1,
        });
        await bumpOption(tx, opt, 1, 1);
      }
      return;
    }

    // single / multiple / rating: reconcile old vs new selection.
    const oldSet = new Set(existing?.optionIds ?? []);
    const newSet = new Set(selected);

    const removed = [...oldSet].filter((id) => !newSet.has(id));
    const added = [...newSet].filter((id) => !oldSet.has(id));

    for (const id of removed) await bumpOption(tx, id, -1, -1);
    for (const id of added) await bumpOption(tx, id, 1, 1);

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

async function bumpOption(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
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
