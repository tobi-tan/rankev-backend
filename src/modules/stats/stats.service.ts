import { sql } from 'drizzle-orm';
import { db } from '../../db';
import { listTrendingTags } from '../feed/feed.service';

/**
 * Số liệu THẬT cho trang giới thiệu (slide mở đầu): tổng hợp trực tiếp từ bài / phiếu / bình luận
 * trong DB — không số giả. Bộ đệm 5 phút (trang giới thiệu ai mở cũng gọi).
 */
export interface ShowcaseDuel {
  id: string;
  title: string;
  total: number;
  options: { label: string; imageUrl: string | null; emoji: string | null; color: string | null; votes: number }[];
}
export interface ShowcaseStats {
  totals: { users: number; posts: number; votes: number; plays: number; comments: number };
  byType: { rankie: number; path: number; survey: number; exam: number; tournament: number };
  duels: ShowcaseDuel[];
  hottest: { id: string; type: string; title: string; participants: number; imageUrl: string | null } | null;
  covers: { rankie: string | null; path: string | null; survey: string | null; exam: string | null };
  tags: { tag: string; count: number }[];
  at: string;
}

const LIVE = sql`p.deleted_at IS NULL AND p.removed_at IS NULL AND p.visibility = 'public'`;
const num = (v: unknown) => Number(v ?? 0) || 0;
const rows = <T>(r: unknown): T[] => ((r as { rows?: T[] }).rows ?? (r as T[]));

let cache: { at: number; data: ShowcaseStats } | null = null;
const TTL = 5 * 60_000;

export async function getShowcase(): Promise<ShowcaseStats> {
  if (cache && Date.now() - cache.at < TTL) return cache.data;

  const [totalsR, typesR, duelsR, hotR, coversR, tags] = await Promise.all([
    db.execute(sql`SELECT
      (SELECT count(*) FROM users) AS users,
      (SELECT count(*) FROM posts p WHERE ${LIVE}) AS posts,
      (SELECT coalesce(sum(o.votes), 0) FROM rankie_options o JOIN posts p ON p.id = o.rankie_id WHERE ${LIVE}) AS votes,
      (SELECT count(*) FROM participations pa JOIN posts p ON p.id = pa.post_id WHERE ${LIVE}) AS plays,
      (SELECT count(*) FROM comments c WHERE c.deleted_at IS NULL) AS comments`),
    db.execute(sql`SELECT CASE WHEN p.type = 'deck' THEN coalesce(p.deck_mode, 'survey') ELSE p.type END AS k, count(*) AS n
      FROM posts p WHERE ${LIVE} GROUP BY 1`),
    // 3 trận đối đầu nhiều phiếu nhất (đủ 2 lựa chọn, KHÔNG phải trận con trong giải; bằng phiếu → có ảnh trước)
    db.execute(sql`SELECT p.id, p.title, sum(o.votes) AS total
      FROM posts p JOIN rankie_options o ON o.rankie_id = p.id
      WHERE ${LIVE} AND p.type = 'rankie' AND p.chart_type = 'head_to_head'
        AND NOT EXISTS (SELECT 1 FROM tournament_matches tm WHERE tm.rankie_post_id = p.id)
      GROUP BY p.id, p.title HAVING count(o.id) = 2
      ORDER BY sum(o.votes) DESC, count(o.image_url) FILTER (WHERE o.image_url NOT LIKE '%twemoji%') DESC, max(p.created_at) DESC LIMIT 3`),
    // bài được tham gia nhiều nhất (phiếu rankie + lượt chơi path/deck)
    db.execute(sql`SELECT p.id, p.type, p.deck_mode, p.title, p.media,
        (SELECT count(*) FROM votes v WHERE v.rankie_id = p.id) + (SELECT count(*) FROM participations pa WHERE pa.post_id = p.id) AS n,
        (SELECT o.image_url FROM rankie_options o WHERE o.rankie_id = p.id AND o.image_url IS NOT NULL AND o.image_url NOT LIKE '%twemoji%' ORDER BY o.votes DESC LIMIT 1) AS opt_img
      FROM posts p WHERE ${LIVE} AND p.type IN ('rankie', 'path', 'deck')
        AND NOT EXISTS (SELECT 1 FROM tournament_matches tm WHERE tm.rankie_post_id = p.id)
      ORDER BY n DESC, (p.media->>'url' IS NOT NULL) DESC, p.created_at DESC LIMIT 1`),
    // ảnh bìa đại diện mỗi loại: bài có ảnh, nhiều người tham gia nhất
    db.execute(sql`SELECT DISTINCT ON (k) k, img FROM (
        SELECT CASE WHEN p.type = 'deck' THEN coalesce(p.deck_mode, 'survey') ELSE p.type END AS k,
          coalesce(p.media->>'url', (SELECT o.image_url FROM rankie_options o WHERE o.rankie_id = p.id AND o.image_url NOT LIKE '%twemoji%' ORDER BY o.position LIMIT 1)) AS img,
          (SELECT count(*) FROM votes v WHERE v.rankie_id = p.id) + (SELECT count(*) FROM participations pa WHERE pa.post_id = p.id) AS n,
          p.created_at
        FROM posts p WHERE ${LIVE} AND p.type IN ('rankie', 'path', 'deck')
      ) x WHERE img IS NOT NULL ORDER BY k, n DESC, created_at DESC`),
    listTrendingTags(6).catch(() => []),
  ]);

  const t = rows<Record<string, unknown>>(totalsR)[0] || {};
  const byType = { rankie: 0, path: 0, survey: 0, exam: 0, tournament: 0 };
  for (const r of rows<{ k: string; n: unknown }>(typesR)) if (r.k in byType) (byType as Record<string, number>)[r.k] = num(r.n);
  const tourR = await db.execute(sql`SELECT count(*) AS n FROM tournaments`).catch(() => ({ rows: [{ n: 0 }] }));
  byType.tournament = num(rows<{ n: unknown }>(tourR)[0]?.n);

  const duelList = rows<{ id: string; title: string; total: unknown }>(duelsR);
  const duels: ShowcaseDuel[] = [];
  for (const d of duelList) {
    const opts = rows<{ label: string; image_url: string | null; emoji: string | null; color: string | null; votes: unknown }>(
      await db.execute(sql`SELECT label, image_url, emoji, color, votes FROM rankie_options WHERE rankie_id = ${d.id} ORDER BY position`),
    );
    duels.push({ id: d.id, title: d.title, total: num(d.total), options: opts.map((o) => ({ label: o.label, imageUrl: o.image_url, emoji: o.emoji, color: o.color, votes: num(o.votes) })) });
  }

  const h = rows<{ id: string; type: string; deck_mode: string | null; title: string; media: { url?: string } | null; n: unknown; opt_img: string | null }>(hotR)[0];
  const covers = { rankie: null as string | null, path: null as string | null, survey: null as string | null, exam: null as string | null };
  for (const r of rows<{ k: string; img: string | null }>(coversR)) if (r.k in covers) (covers as Record<string, string | null>)[r.k] = r.img;

  const data: ShowcaseStats = {
    totals: { users: num(t.users), posts: num(t.posts), votes: num(t.votes), plays: num(t.plays), comments: num(t.comments) },
    byType,
    duels,
    hottest: h ? { id: h.id, type: h.type === 'deck' ? h.deck_mode || 'survey' : h.type, title: h.title, participants: num(h.n), imageUrl: h.media?.url || h.opt_img || null } : null,
    covers,
    tags,
    at: new Date().toISOString(),
  };
  cache = { at: Date.now(), data };
  return data;
}

/** Cho test: xoá bộ đệm. */
export function resetShowcaseCache(): void { cache = null; }
