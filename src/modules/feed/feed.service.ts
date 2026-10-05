import { and, desc, eq, inArray, isNull, lt, or, sql, count } from 'drizzle-orm';
import { db } from '../../db';
import {
  posts,
  users,
  rankieOptions,
  pathEndings,
  pathQuestions,
  deckQuestions,
  participations,
  comments,
  series,
  seriesPosts,
  tournamentMatches,
  tournaments,
  rankUps,
  type Post,
  type User,
} from '../../db/schema';
import { decodeCursor, encodeCursor } from '../../lib/cursor';
import { feedExclusions } from '../moderation/moderation.service';
import { countShares } from '../messaging/shares';
import { toPublicUser, type PublicUser } from '../users/users.serializer';

export interface FeedOption {
  label: string | null;
  emoji: string | null;
  /** ảnh của lựa chọn (ưu tiên hơn emoji khi hiển thị) */
  imageUrl: string | null;
  votes: number;
  color: string | null;
}

/** Kết quả (ending) của Path để xem trước trên thẻ / ô lưới — không lộ nội dung câu hỏi. */
export interface FeedEnding {
  name: string;
  emoji: string | null;
  imageUrl: string | null;
}

export interface FeedSummary {
  id: string;
  type: 'rankie' | 'path' | 'deck';
  deckMode: 'survey' | 'exam' | null;
  title: string;
  subtitle: string | null;
  /** mô tả (caption) của bài — để feed card hiện đủ tiêu đề + mô tả + ảnh như các loại khác */
  caption: string | null;
  category: string | null;
  tags: string[];
  media: unknown;
  voteMarker: unknown;
  createdAt: string;
  deletedAt: string | null; // != null = đang ở thùng rác (chỉ trả về ở danh sách bài của mình)
  opensAt: string | null;
  notYetOpen: boolean; // đã hẹn giờ lên sóng nhưng chưa tới giờ
  closesAt: string | null;
  closed: boolean;
  live: boolean;
  votingType: 'single' | 'multiple' | 'rating' | 'unlimited' | null;
  /** skin biểu đồ người tạo đã chọn (rankie) — feed/chi tiết hiển thị đúng kiểu này. */
  chartType: string | null;
  /** số câu hỏi (deck & path); rankie = 0. Khác `size` vì path.size = số kết thúc. */
  questionCount: number;
  seriesId: string | null;
  seriesName: string | null;
  /** Nếu bài này là 1 TRẬN của giải đấu đang live (hiện trên feed) → id/tên giải để gắn nhãn. */
  tournamentId: string | null;
  tournamentTitle: string | null;
  author: PublicUser | null;
  /** rankie=total votes, path/deck=participants */
  engagement: number;
  /** rankie=options, path=endings, deck=questions */
  size: number;
  commentsCount: number;
  /** số lượt gửi bài này qua tin nhắn (thanh tương tác: chia sẻ) */
  sharesCount: number;
  /** Tổng số người đã RankUp TÁC GIẢ (mọi tầng) — hiện cạnh nút RankUp trên thẻ feed. */
  authorRankUps: number;
  /** top options for rankie cards (sorted desc, up to 4) */
  options?: FeedOption[];
  /** path: tối đa 3 kết quả (để ô lưới hồ sơ có hình khi bài không có ảnh bìa) */
  endings?: FeedEnding[];
}

export interface FeedQuery {
  type?: 'rankie' | 'path' | 'deck';
  tag?: string | null; // lọc theo hashtag (không phân biệt hoa thường)
  cursor?: string | null;
  limit: number;
}

async function buildSummaries(rows: { post: Post; author: User | null }[]): Promise<FeedSummary[]> {
  const rankieIds = rows.filter((r) => r.post.type === 'rankie').map((r) => r.post.id);
  const pathIds = rows.filter((r) => r.post.type === 'path').map((r) => r.post.id);
  const deckIds = rows.filter((r) => r.post.type === 'deck').map((r) => r.post.id);
  const allIds = rows.map((r) => r.post.id);

  const [rankieOptRows, pathEnds, pathQs, deckQs, parts, commentRows, sharesBy] = await Promise.all([
    rankieIds.length
      ? db
          .select({
            rankieId: rankieOptions.rankieId,
            label: rankieOptions.label,
            emoji: rankieOptions.emoji,
            imageUrl: rankieOptions.imageUrl,
            votes: rankieOptions.votes,
            color: rankieOptions.color,
          })
          .from(rankieOptions)
          .where(inArray(rankieOptions.rankieId, rankieIds))
      : Promise.resolve([] as { rankieId: string; label: string | null; emoji: string | null; imageUrl: string | null; votes: number; color: string | null }[]),
    pathIds.length
      ? db
          .select({ id: pathEndings.postId, c: count() })
          .from(pathEndings)
          .where(inArray(pathEndings.postId, pathIds))
          .groupBy(pathEndings.postId)
      : Promise.resolve([] as { id: string; c: number }[]),
    pathIds.length
      ? db
          .select({ id: pathQuestions.postId, c: count() })
          .from(pathQuestions)
          .where(inArray(pathQuestions.postId, pathIds))
          .groupBy(pathQuestions.postId)
      : Promise.resolve([] as { id: string; c: number }[]),
    deckIds.length
      ? db
          .select({ id: deckQuestions.postId, c: count() })
          .from(deckQuestions)
          .where(inArray(deckQuestions.postId, deckIds))
          .groupBy(deckQuestions.postId)
      : Promise.resolve([] as { id: string; c: number }[]),
    allIds.length
      ? db
          .select({ id: participations.postId, c: count() })
          .from(participations)
          .where(inArray(participations.postId, allIds))
          .groupBy(participations.postId)
      : Promise.resolve([] as { id: string; c: number }[]),
    allIds.length
      ? db
          .select({ id: comments.postId, c: count() })
          .from(comments)
          .where(and(inArray(comments.postId, allIds), isNull(comments.deletedAt)))
          .groupBy(comments.postId)
      : Promise.resolve([] as { id: string; c: number }[]),
    countShares(allIds),
  ]);

  // Group rankie options → total votes, count, and top-4 sorted desc.
  const rankieAgg = new Map<string, { total: number; size: number; top: FeedOption[] }>();
  for (const o of rankieOptRows) {
    const a = rankieAgg.get(o.rankieId) ?? { total: 0, size: 0, top: [] };
    a.total += Number(o.votes);
    a.size += 1;
    a.top.push({ label: o.label, emoji: o.emoji, imageUrl: o.imageUrl, votes: Number(o.votes), color: o.color });
    rankieAgg.set(o.rankieId, a);
  }
  for (const a of rankieAgg.values()) {
    a.top.sort((x, y) => y.votes - x.votes);
    a.top = a.top.slice(0, 4);
  }

  const endsBy = new Map(pathEnds.map((r) => [r.id, Number(r.c)]));
  // Xem trước kết quả Path (tên + emoji/ảnh, đông người nhất trước) — tối đa 3 mỗi bài.
  const endingRows = pathIds.length
    ? await db
        .select({ postId: pathEndings.postId, name: pathEndings.name, emoji: pathEndings.emoji, imageUrl: pathEndings.imageUrl, count: pathEndings.count })
        .from(pathEndings)
        .where(inArray(pathEndings.postId, pathIds))
    : [];
  const endingsBy = new Map<string, FeedEnding[]>();
  for (const e of [...endingRows].sort((x, y) => (y.count ?? 0) - (x.count ?? 0))) {
    const list = endingsBy.get(e.postId) ?? [];
    if (list.length < 3) list.push({ name: e.name, emoji: e.emoji, imageUrl: e.imageUrl });
    endingsBy.set(e.postId, list);
  }
  const pathQsBy = new Map(pathQs.map((r) => [r.id, Number(r.c)]));
  const qsBy = new Map(deckQs.map((r) => [r.id, Number(r.c)]));
  const partsBy = new Map(parts.map((r) => [r.id, Number(r.c)]));
  const commentsBy = new Map(commentRows.map((r) => [r.id, Number(r.c)]));

  // Series của mỗi post (qua bảng join series_posts) — để web nhóm chapter.
  const seriesRows = allIds.length
    ? await db
        .select({ postId: seriesPosts.postId, seriesId: seriesPosts.seriesId, name: series.name })
        .from(seriesPosts)
        .innerJoin(series, eq(series.id, seriesPosts.seriesId))
        .where(inArray(seriesPosts.postId, allIds))
    : [];
  const seriesBy = new Map(seriesRows.map((r) => [r.postId, { seriesId: r.seriesId, seriesName: r.name }]));

  // Tổng RankUp của từng tác giả (mọi tầng) — 1 truy vấn gộp cho cả trang feed.
  const authorIds = [...new Set(rows.map((r) => r.author?.id).filter((x): x is string => !!x))];
  const rankRows = authorIds.length
    ? await db.select({ authorId: rankUps.authorId, c: sql<number>`count(*)::int` }).from(rankUps).where(inArray(rankUps.authorId, authorIds)).groupBy(rankUps.authorId)
    : [];
  const rankBy = new Map(rankRows.map((r) => [r.authorId, Number(r.c)]));

  // Bài nào là TRẬN của giải đấu → gắn giải (để feed hiện nhãn "🏆 Giải", và KHÔNG coi là series).
  const matchRows = allIds.length
    ? await db
        .select({ postId: tournamentMatches.rankiePostId, tournamentId: tournaments.id, title: tournaments.title })
        .from(tournamentMatches)
        .innerJoin(tournaments, eq(tournaments.id, tournamentMatches.tournamentId))
        .where(inArray(tournamentMatches.rankiePostId, allIds))
    : [];
  const matchBy = new Map(
    matchRows.filter((r): r is { postId: string; tournamentId: string; title: string } => !!r.postId).map((r) => [r.postId, { tournamentId: r.tournamentId, tournamentTitle: r.title }]),
  );

  return rows.map((r) => {
    const p = r.post;
    const agg = rankieAgg.get(p.id);
    const engagement = p.type === 'rankie' ? agg?.total ?? 0 : partsBy.get(p.id) ?? 0;
    const size =
      p.type === 'rankie'
        ? agg?.size ?? 0
        : p.type === 'path'
          ? endsBy.get(p.id) ?? 0
          : qsBy.get(p.id) ?? 0;
    return {
      id: p.id,
      type: p.type,
      deckMode: p.deckMode,
      title: p.title,
      subtitle: p.subtitle,
      caption: p.caption,
      category: p.category,
      tags: Array.isArray(p.tags) ? p.tags : [],
      media: p.media,
      voteMarker: p.voteMarker,
      createdAt: p.createdAt.toISOString(),
      deletedAt: p.deletedAt ? p.deletedAt.toISOString() : null,
      opensAt: p.opensAt ? p.opensAt.toISOString() : null,
      notYetOpen: p.opensAt ? p.opensAt.getTime() > Date.now() : false,
      closesAt: p.closesAt ? p.closesAt.toISOString() : null,
      closed: p.closesAt ? p.closesAt.getTime() <= Date.now() : false,
      live: p.live,
      votingType: p.votingType,
      chartType: p.chartType ?? null,
      questionCount: p.type === 'deck' ? (qsBy.get(p.id) ?? 0) : p.type === 'path' ? (pathQsBy.get(p.id) ?? 0) : 0,
      // Trận giải đấu: KHÔNG hiện như series (dùng nhãn giải thay thế) để tránh nhầm "Series".
      seriesId: matchBy.has(p.id) ? null : (seriesBy.get(p.id)?.seriesId ?? null),
      seriesName: matchBy.has(p.id) ? null : (seriesBy.get(p.id)?.seriesName ?? null),
      tournamentId: matchBy.get(p.id)?.tournamentId ?? null,
      tournamentTitle: matchBy.get(p.id)?.tournamentTitle ?? null,
      author: r.author ? toPublicUser(r.author) : null,
      engagement,
      size,
      commentsCount: commentsBy.get(p.id) ?? 0,
      sharesCount: sharesBy.get(p.id) ?? 0,
      authorRankUps: r.author ? rankBy.get(r.author.id) ?? 0 : 0,
      options: p.type === 'rankie' ? agg?.top ?? [] : undefined,
      endings: p.type === 'path' ? endingsBy.get(p.id) ?? [] : undefined,
    };
  });
}

export async function listFeed(
  query: FeedQuery,
  viewerId?: string,
): Promise<{ items: FeedSummary[]; nextCursor: string | null }> {
  const conditions = [] as any[];
  conditions.push(isNull(posts.deletedAt)); // ẩn bài đã xoá mềm (thùng rác) khỏi feed
  if (query.type) conditions.push(eq(posts.type, query.type));
  // Lọc theo hashtag: tag khớp không phân biệt hoa thường với một phần tử trong mảng tags.
  if (query.tag) {
    const t = query.tag.trim().replace(/^#+/, '').toLowerCase();
    // Khớp không phân biệt dấu tiếng Việt (#âmnhạc = #amnhac).
    if (t) conditions.push(sql`EXISTS (SELECT 1 FROM jsonb_array_elements_text(COALESCE(${posts.tags}, '[]'::jsonb)) AS tg WHERE unaccent(lower(tg)) = unaccent(${t}))`);
  }
  // Ẩn MỌI bài-ván của giải đấu khỏi feed chính: giải đấu nay hiện dưới dạng MỘT carousel
  // (bảng đấu + các trận live/đã kết thúc), các trận theo dõi ngay trong carousel đó — không
  // để lẻ ra feed nữa (tránh ngập + để "series giải đấu" gom gọn một chỗ).
  conditions.push(sql`NOT EXISTS (SELECT 1 FROM tournament_matches tm WHERE tm.rankie_post_id = ${posts.id})`);
  // Chặn (2 chiều) / ẩn người / "Không quan tâm" → lọc ngay trong truy vấn.
  if (viewerId) conditions.push(...feedExclusions(viewerId, posts.authorId, posts.id));
  const cursor = query.cursor ? decodeCursor(query.cursor) : null;
  if (cursor) {
    const d = new Date(cursor.createdAt);
    conditions.push(
      or(lt(posts.createdAt, d), and(eq(posts.createdAt, d), lt(posts.id, cursor.id)))!,
    );
  }

  const rows = await db
    .select({ post: posts, author: users })
    .from(posts)
    .leftJoin(users, eq(users.id, posts.authorId))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(posts.createdAt), desc(posts.id))
    .limit(query.limit + 1);

  const hasMore = rows.length > query.limit;
  const page = hasMore ? rows.slice(0, query.limit) : rows;
  const items = await buildSummaries(page);

  const last = page[page.length - 1];
  const nextCursor =
    hasMore && last
      ? encodeCursor({ createdAt: last.post.createdAt.toISOString(), id: last.post.id })
      : null;

  return { items, nextCursor };
}

/** Mẫu LIKE an toàn: bỏ dấu + chữ thường ở phía SQL, thoát % _ \ trong từ khoá. */
function likePattern(q: string): string {
  return `%${q.toLowerCase().replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

/**
 * Tìm kiếm toàn hệ thống (không chỉ bài đã tải ở máy): bài (tiêu đề / mô tả / hashtag),
 * người dùng (tên / @handle), giải đấu (tên). Không phân biệt dấu tiếng Việt, tôn trọng
 * chặn/ẩn của người xem. Bài: mới nhất trước.
 */
export async function searchAll(
  qRaw: string,
  viewerId?: string,
  limit = 30,
): Promise<{ posts: FeedSummary[]; users: PublicUser[]; tournamentIds: string[] }> {
  const q = qRaw.trim().replace(/^[#@]+/, '');
  if (!q) return { posts: [], users: [], tournamentIds: [] };
  const pat = likePattern(q);
  const match = (col: unknown) => sql`unaccent(lower(coalesce(${col}, ''))) LIKE unaccent(${pat})`;

  const postConds = [
    isNull(posts.deletedAt),
    sql`NOT EXISTS (SELECT 1 FROM tournament_matches tm WHERE tm.rankie_post_id = ${posts.id})`,
    or(
      match(posts.title),
      match(posts.caption),
      sql`EXISTS (SELECT 1 FROM jsonb_array_elements_text(COALESCE(${posts.tags}, '[]'::jsonb)) AS tg WHERE unaccent(lower(tg)) LIKE unaccent(${pat}))`,
    )!,
    ...(viewerId ? feedExclusions(viewerId, posts.authorId, posts.id).slice(0, 2) : []), // chặn 2 chiều
  ];
  const userConds = [
    or(match(users.name), match(users.handle))!,
    ...(viewerId
      ? [
          sql`${users.id} NOT IN (SELECT blocked_id FROM user_blocks WHERE blocker_id = ${viewerId})`,
          sql`${users.id} NOT IN (SELECT blocker_id FROM user_blocks WHERE blocked_id = ${viewerId})`,
        ]
      : []),
  ];

  const [postRows, userRows, tourRows] = await Promise.all([
    db
      .select({ post: posts, author: users })
      .from(posts)
      .leftJoin(users, eq(users.id, posts.authorId))
      .where(and(...postConds))
      .orderBy(desc(posts.createdAt))
      .limit(limit),
    db.select().from(users).where(and(...userConds)).orderBy(users.name).limit(8),
    db
      .select({ id: tournaments.id })
      .from(tournaments)
      .where(match(tournaments.title))
      .orderBy(desc(tournaments.createdAt))
      .limit(6),
  ]);
  return {
    posts: await buildSummaries(postRows),
    users: userRows.map((u) => toPublicUser(u)),
    tournamentIds: tourRows.map((r) => r.id),
  };
}

/** Tóm tắt kiểu thẻ feed cho một nhóm bài bất kỳ (vd. xem trước bài được chia sẻ trong chat). */
export async function getSummariesByIds(ids: string[]): Promise<Map<string, FeedSummary>> {
  const uuids = [...new Set(ids)].filter((x) => /^[0-9a-f-]{36}$/i.test(x));
  if (!uuids.length) return new Map();
  const rows = await db
    .select({ post: posts, author: users })
    .from(posts)
    .leftJoin(users, eq(users.id, posts.authorId))
    .where(and(inArray(posts.id, uuids), isNull(posts.deletedAt)));
  const items = await buildSummaries(rows);
  return new Map(items.map((s) => [s.id, s]));
}

// Hashtag đang thịnh hành: đếm số bài theo tag (ưu tiên bài gần đây), trả top N.
// Bỏ qua các bài-ván của giải đấu để không nhiễu.
export async function listTrendingTags(limit = 20): Promise<{ tag: string; count: number }[]> {
  // Gộp không phân biệt dấu; hiển thị cách viết phổ biến nhất trong nhóm.
  const rows = await db.execute(sql`
    SELECT mode() WITHIN GROUP (ORDER BY tg) AS tag, count(*)::int AS count
    FROM posts p, jsonb_array_elements_text(COALESCE(p.tags, '[]'::jsonb)) AS tg
    WHERE NOT EXISTS (SELECT 1 FROM tournament_matches tm WHERE tm.rankie_post_id = p.id)
      AND p.created_at > now() - interval '90 days'
    GROUP BY unaccent(lower(tg))
    ORDER BY count DESC, tag ASC
    LIMIT ${limit}
  `);
  const list = (rows as unknown as { rows?: { tag: string; count: number }[] }).rows ?? (rows as unknown as { tag: string; count: number }[]);
  return (Array.isArray(list) ? list : []).map((r) => ({ tag: String(r.tag), count: Number(r.count) }));
}

export async function summariesByIds(ids: string[], _viewerId?: string): Promise<FeedSummary[]> {
  if (ids.length === 0) return [];
  const rows = await db
    .select({ post: posts, author: users })
    .from(posts)
    .leftJoin(users, eq(users.id, posts.authorId))
    .where(inArray(posts.id, ids));
  const summaries = await buildSummaries(rows);
  const byId = new Map(summaries.map((s) => [s.id, s]));
  return ids.map((id) => byId.get(id)).filter((s): s is FeedSummary => Boolean(s));
}
