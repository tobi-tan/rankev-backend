import { and, asc, eq, inArray, max } from 'drizzle-orm';
import { db } from '../../db';
import {
  tournaments,
  tournamentMatches,
  posts,
  rankieOptions,
  series,
  seriesPosts,
  type TournamentMatch,
} from '../../db/schema';
import { badRequest, forbidden, notFound } from '../../lib/errors';

// Một đối thủ trong giải: text thuần hoặc tham chiếu thực thể Rankev ("Lưu vào Rankie").
export interface Contestant {
  name: string;
  emoji?: string | null;
  color?: string | null;
  imageUrl?: string | null;
  refType?: string | null;
  refId?: string | null;
}

// Cấu hình dùng lại cho mọi ván (vòng 0 và các vòng sinh khi chốt vòng).
export interface TournamentSettings {
  caption?: string | null;
  closesInHours?: number | null;
  allowGuestPresent?: boolean;
  // Mỗi giải đấu tự là một series: mọi ván (rankie) được gom vào series này làm "chương".
  seriesId?: string | null;
  seriesName?: string | null;
}

export interface CreateTournamentInput extends TournamentSettings {
  title: string;
  category?: string;
  contestants: Contestant[];
}

// Ngữ cảnh áp cho rankie mỗi ván (giống bài rankie thường: danh mục, mô tả, hạn, trình chiếu).
interface MatchMeta extends TournamentSettings {
  category?: string | null;
}

const OPT_COLORS = ['#5FC9A8', '#E2725B', '#E7BC55', '#6FB6E8', '#A594E0', '#E28FB8', '#8CC463', '#E89C4A'];

// Sinh khung đấu loại: pad lên luỹ thừa 2, ghép cặp vòng 0, các vòng sau để trống.
function seedRounds(cs: (Contestant | null)[]): { a: Contestant | null; b: Contestant | null }[][] {
  let n = 1;
  while (n < cs.length) n *= 2;
  const seeds = [...cs];
  while (seeds.length < n) seeds.push(null);
  const r0: { a: Contestant | null; b: Contestant | null }[] = [];
  for (let i = 0; i < n; i += 2) r0.push({ a: seeds[i], b: seeds[i + 1] });
  const rounds: { a: Contestant | null; b: Contestant | null }[][] = [r0];
  let m = n / 4;
  while (m >= 1) {
    const empty: { a: Contestant | null; b: Contestant | null }[] = [];
    for (let i = 0; i < m; i++) empty.push({ a: null, b: null });
    rounds.push(empty);
    m /= 2;
  }
  return rounds;
}

// Tạo một Rankie 1v1 thật cho một cặp đấu (2 lựa chọn = 2 đối thủ). Trả về postId.
async function createMatchRankie(
  tx: typeof db,
  authorId: string,
  a: Contestant,
  b: Contestant,
  meta: MatchMeta = {},
): Promise<string> {
  const closesAt = meta.closesInHours ? new Date(Date.now() + meta.closesInHours * 3600 * 1000) : null;
  const [post] = await tx
    .insert(posts)
    .values({
      type: 'rankie',
      authorId,
      title: `${a.name} vs ${b.name}`,
      subtitle: 'Đối đầu 1v1',
      caption: meta.caption ?? null,
      category: meta.category ?? null,
      votingType: 'single',
      chartType: 'head_to_head',
      live: true,
      closesAt,
      allowGuestPresent: meta.allowGuestPresent ?? false,
    })
    .returning({ id: posts.id });
  const mk = (c: Contestant, i: number) => ({
    rankieId: post.id,
    label: c.name,
    emoji: c.emoji ?? undefined,
    color: c.color ?? OPT_COLORS[i % OPT_COLORS.length],
    imageUrl: c.imageUrl ?? undefined,
    refType: c.refType ?? undefined,
    refId: c.refId ?? undefined,
    position: i,
  });
  await tx.insert(rankieOptions).values([mk(a, 0), mk(b, 1)]);
  return post.id;
}

export async function createTournament(authorId: string, input: CreateTournamentInput) {
  const cs = input.contestants.filter((c) => c && c.name && c.name.trim());
  if (cs.length < 2) throw badRequest('Cần ít nhất 2 đối thủ');
  if (cs.length > 32) throw badRequest('Tối đa 32 đối thủ');

  const rounds = seedRounds(cs);
  const id = await db.transaction(async (tx) => {
    // Mỗi giải đấu tự là một SERIES: các ván (rankie) là "chương". Nhờ vậy giải xuất
    // hiện như một series gọn (không phải N bài rời) — tái dùng hạ tầng series sẵn có.
    const [ser] = await tx.insert(series).values({ name: input.title, authorId }).returning({ id: series.id });

    const settings: TournamentSettings = {
      caption: input.caption ?? null,
      closesInHours: input.closesInHours ?? null,
      allowGuestPresent: input.allowGuestPresent ?? false,
      seriesId: ser.id,
      seriesName: input.title,
    };
    const meta: MatchMeta = { ...settings, category: input.category ?? null };

    const [t] = await tx
      .insert(tournaments)
      .values({ authorId, title: input.title, category: input.category, settings })
      .returning({ id: tournaments.id });

    let seriesPos = 0;
    for (let r = 0; r < rounds.length; r++) {
      for (let p = 0; p < rounds[r].length; p++) {
        const cell = rounds[r][p];
        let rankiePostId: string | null = null;
        let winnerRef: Contestant | null = null;
        if (cell.a && cell.b) {
          rankiePostId = await createMatchRankie(tx, authorId, cell.a, cell.b, meta);
          await tx.insert(seriesPosts).values({ seriesId: ser.id, postId: rankiePostId, position: seriesPos++ });
        } else if (cell.a && !cell.b) {
          winnerRef = cell.a; // bye → tự thắng
        } else if (!cell.a && cell.b) {
          winnerRef = cell.b;
        }
        await tx.insert(tournamentMatches).values({
          tournamentId: t.id,
          round: r,
          position: p,
          aRef: cell.a ?? null,
          bRef: cell.b ?? null,
          rankiePostId,
          winnerRef,
        });
      }
    }
    return t.id;
  });

  return getTournament(id);
}

async function matchVotes(postId: string): Promise<{ a: number; b: number }> {
  const opts = await db
    .select({ position: rankieOptions.position, votes: rankieOptions.votes })
    .from(rankieOptions)
    .where(eq(rankieOptions.rankieId, postId))
    .orderBy(asc(rankieOptions.position));
  const a = Number(opts.find((o) => o.position === 0)?.votes ?? 0);
  const b = Number(opts.find((o) => o.position === 1)?.votes ?? 0);
  return { a, b };
}

export async function getTournament(id: string) {
  const [t] = await db.select().from(tournaments).where(eq(tournaments.id, id));
  if (!t) throw notFound('Tournament not found');
  const rows = await db
    .select()
    .from(tournamentMatches)
    .where(eq(tournamentMatches.tournamentId, id))
    .orderBy(asc(tournamentMatches.round), asc(tournamentMatches.position));

  const postIds = rows.map((r) => r.rankiePostId).filter((x): x is string => !!x);
  const voteMap = new Map<string, { a: number; b: number }>();
  await Promise.all(postIds.map(async (pid) => voteMap.set(pid, await matchVotes(pid))));

  const maxRound = rows.reduce((m, r) => Math.max(m, r.round), 0);
  return {
    id: t.id,
    authorId: t.authorId,
    title: t.title,
    category: t.category,
    status: t.status,
    currentRound: t.currentRound,
    rounds: maxRound + 1,
    championRef: t.championRef,
    createdAt: t.createdAt.toISOString(),
    matches: rows.map((r) => ({
      round: r.round,
      position: r.position,
      aRef: r.aRef,
      bRef: r.bRef,
      rankiePostId: r.rankiePostId,
      winnerRef: r.winnerRef,
      votes: r.rankiePostId ? voteMap.get(r.rankiePostId) ?? { a: 0, b: 0 } : { a: 0, b: 0 },
    })),
  };
}

// Chốt vòng hiện tại: quyết định thắng theo phiếu, sinh cặp đấu (rankie) vòng sau.
export async function advanceRound(id: string, viewerId: string) {
  const [t] = await db.select().from(tournaments).where(eq(tournaments.id, id));
  if (!t) throw notFound('Tournament not found');
  if (t.authorId !== viewerId) throw forbidden('Chỉ chủ giải mới chốt được vòng');
  if (t.status === 'done') return getTournament(id);

  const r = t.currentRound;
  const rows = await db
    .select()
    .from(tournamentMatches)
    .where(eq(tournamentMatches.tournamentId, id))
    .orderBy(asc(tournamentMatches.round), asc(tournamentMatches.position));
  const maxRound = rows.reduce((m, x) => Math.max(m, x.round), 0);
  const cur = rows.filter((x) => x.round === r).sort((x, y) => x.position - y.position);

  await db.transaction(async (tx) => {
    // 1) quyết định thắng cho các ván vòng r (byes đã có winnerRef sẵn)
    for (const m of cur) {
      if (!m.winnerRef && m.rankiePostId) {
        const v = await matchVotes(m.rankiePostId);
        const winner = (v.a >= v.b ? m.aRef : m.bRef) as Contestant | null;
        m.winnerRef = winner;
        await tx.update(tournamentMatches).set({ winnerRef: winner }).where(eq(tournamentMatches.id, m.id));
      }
    }

    if (r >= maxRound) {
      // vòng cuối → nhà vô địch
      await tx
        .update(tournaments)
        .set({ championRef: cur[0]?.winnerRef ?? null, status: 'done' })
        .where(eq(tournaments.id, id));
      return;
    }

    // 2) đẩy đối thủ thắng lên vòng sau
    const next = rows.filter((x) => x.round === r + 1).sort((x, y) => x.position - y.position);
    cur.forEach((m, i) => {
      const nm = next[Math.floor(i / 2)];
      if (!nm) return;
      if (i % 2 === 0) nm.aRef = m.winnerRef as never;
      else nm.bRef = m.winnerRef as never;
    });
    const settings = (t.settings as TournamentSettings) ?? {};
    const meta: MatchMeta = { ...settings, category: t.category };
    // Vị trí kế tiếp trong series của giải (chương mới nối vào cuối).
    let seriesPos = 0;
    if (settings.seriesId) {
      const [row] = await tx.select({ m: max(seriesPosts.position) }).from(seriesPosts).where(eq(seriesPosts.seriesId, settings.seriesId));
      seriesPos = (row?.m ?? -1) + 1;
    }
    for (const nm of next) {
      const a = nm.aRef as Contestant | null;
      const b = nm.bRef as Contestant | null;
      let rankiePostId = nm.rankiePostId;
      let winnerRef = nm.winnerRef as Contestant | null;
      if (a && b && !rankiePostId) {
        rankiePostId = await createMatchRankie(tx, t.authorId, a, b, meta);
        if (settings.seriesId) await tx.insert(seriesPosts).values({ seriesId: settings.seriesId, postId: rankiePostId, position: seriesPos++ });
      } else if (a && !b) winnerRef = a;
      else if (!a && b) winnerRef = b;
      await tx
        .update(tournamentMatches)
        .set({ aRef: a ?? null, bRef: b ?? null, rankiePostId, winnerRef })
        .where(eq(tournamentMatches.id, nm.id));
    }
    await tx.update(tournaments).set({ currentRound: r + 1 }).where(eq(tournaments.id, id));
  });

  return getTournament(id);
}

export async function listMyTournaments(authorId: string) {
  const rows = await db
    .select({ id: tournaments.id, title: tournaments.title, status: tournaments.status, currentRound: tournaments.currentRound, createdAt: tournaments.createdAt })
    .from(tournaments)
    .where(eq(tournaments.authorId, authorId))
    .orderBy(asc(tournaments.createdAt));
  return rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }));
}
