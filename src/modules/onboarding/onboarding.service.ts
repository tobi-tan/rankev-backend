import { and, desc, eq, sql } from 'drizzle-orm';
import { db } from '../../db';
import {
  onboardingVotes, users, posts, rankieOptions, pathQuestions, pathAnswers, deckQuestions, deckOptions,
} from '../../db/schema';
import { badRequest } from '../../lib/errors';

// Danh mục lựa chọn hợp lệ cho từng khoá (giữ thống kê sạch). type = đa chọn.
export const ONBOARDING_OPTIONS: Record<string, string[]> = {
  theme: ['light', 'dark'],
  type: ['rankie', 'path', 'survey', 'exam'],
  rating: ['1', '2', '3', '4', '5'],
  age: ['<18', '18-24', '25-34', '35-44', '45+'],
  gender: ['Nam', 'Nữ', 'Khác'],
  occupation: ['Học sinh/Sinh viên', 'Văn phòng', 'Kinh doanh', 'Kỹ thuật/IT', 'Sáng tạo/Nghệ thuật', 'Khác'],
};
const MULTI_KEYS = new Set(['type']);

export interface KeyStats {
  key: string;
  counts: Record<string, number>;
  voters: number;
  mine?: string[]; // lựa chọn của chính người gọi (để tô đậm + tính "% giống bạn")
}

/** Khoảng tuổi suy ra từ ngày sinh 'YYYY-MM-DD' (khớp ONBOARDING_OPTIONS.age). */
export function ageBucketFromDob(dob: string): string | null {
  const d = new Date(dob);
  if (isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  if (age < 0 || age > 120) return null;
  if (age < 18) return '<18';
  if (age <= 24) return '18-24';
  if (age <= 34) return '25-34';
  if (age <= 44) return '35-44';
  return '45+';
}

function validate(key: string, choices: string[]): string[] {
  const allowed = ONBOARDING_OPTIONS[key];
  if (!allowed) throw badRequest('Khoá bình chọn không hợp lệ');
  const clean = [...new Set(choices)].filter((c) => allowed.includes(c));
  if (clean.length === 0) throw badRequest('Lựa chọn không hợp lệ');
  if (!MULTI_KEYS.has(key) && clean.length > 1) throw badRequest('Khoá này chỉ chọn một');
  return clean;
}

/** Thay TOÀN BỘ lựa chọn của user cho một khoá (đơn hoặc đa chọn). */
export async function recordVote(userId: string, key: string, choices: string[]): Promise<KeyStats> {
  const clean = validate(key, choices);
  await db.transaction(async (tx) => {
    await tx.delete(onboardingVotes).where(and(eq(onboardingVotes.userId, userId), eq(onboardingVotes.voteKey, key)));
    await tx.insert(onboardingVotes).values(clean.map((choice) => ({ userId, voteKey: key, choice })));
  });
  return { ...(await keyStats(key)), mine: clean };
}

/**
 * Lưu MỘT/ NHIỀU field nhân khẩu học lên hồ sơ (kèm ẩn/công khai) + ghi phiếu.
 * `dob` (YYYY-MM-DD) → suy ra khoảng tuổi cho thống kê + lưu ngày sinh. occupation tự do.
 * Trả về stats cho từng field đã gửi (kèm `mine` để hiện "% giống bạn").
 */
export async function saveDemographics(
  userId: string,
  input: { dob?: string | null; gender?: string | null; occupation?: string | null; visible?: Record<string, boolean> },
): Promise<{ stats: KeyStats[] }> {
  const patch: Record<string, unknown> = {};
  const publicMap: Record<string, boolean> = {};
  const votes: { key: string; choice: string }[] = [];

  // Ngày sinh → khoảng tuổi
  if (input.dob !== undefined) {
    if (!input.dob) { patch.dateOfBirth = null; patch.ageRange = null; }
    else {
      const bucket = ageBucketFromDob(input.dob);
      if (!bucket) throw badRequest('Ngày sinh không hợp lệ');
      patch.dateOfBirth = input.dob;
      patch.ageRange = bucket;
      votes.push({ key: 'age', choice: bucket });
    }
    publicMap.age = !!input.visible?.age;
  }
  // Giới tính (giới hạn danh mục)
  if (input.gender !== undefined) {
    if (!input.gender) { patch.gender = null; }
    else if (ONBOARDING_OPTIONS.gender.includes(input.gender)) { patch.gender = input.gender; votes.push({ key: 'gender', choice: input.gender }); }
    else throw badRequest('Giới tính không hợp lệ');
    publicMap.gender = !!input.visible?.gender;
  }
  // Nghề nghiệp (tự do — search droplist)
  if (input.occupation !== undefined) {
    const occ = (input.occupation || '').trim().slice(0, 60);
    if (!occ) { patch.occupation = null; }
    else { patch.occupation = occ; votes.push({ key: 'occupation', choice: occ }); }
    publicMap.occupation = !!input.visible?.occupation;
  }

  await db.transaction(async (tx) => {
    if (Object.keys(patch).length > 0) {
      patch.demographicsPublic = sql`${users.demographicsPublic} || ${JSON.stringify(publicMap)}::jsonb`;
      await tx.update(users).set(patch).where(eq(users.id, userId));
    }
    for (const v of votes) {
      await tx.delete(onboardingVotes).where(and(eq(onboardingVotes.userId, userId), eq(onboardingVotes.voteKey, v.key)));
      await tx.insert(onboardingVotes).values({ userId, voteKey: v.key, choice: v.choice });
    }
  });

  const stats = await Promise.all(votes.map(async (v) => ({ ...(await keyStats(v.key)), mine: [v.choice] })));
  return { stats };
}

export async function keyStats(key: string): Promise<KeyStats> {
  const rows = await db
    .select({ choice: onboardingVotes.choice, c: sql<number>`count(*)::int` })
    .from(onboardingVotes)
    .where(eq(onboardingVotes.voteKey, key))
    .groupBy(onboardingVotes.choice);
  const counts: Record<string, number> = {};
  let voters = 0;
  for (const r of rows) { counts[r.choice] = r.c; voters += r.c; }
  // Với khoá đa chọn, "voters" là tổng lượt chọn — vẫn đủ để hiện %.
  return { key, counts, voters };
}

export async function getStats(keys?: string[]): Promise<Record<string, KeyStats>> {
  const wanted = keys && keys.length ? keys.filter((k) => ONBOARDING_OPTIONS[k]) : Object.keys(ONBOARDING_OPTIONS);
  const out: Record<string, KeyStats> = {};
  await Promise.all(wanted.map(async (k) => { out[k] = await keyStats(k); }));
  return out;
}

// ---------- Ví dụ THẬT cho onboarding (preview mỗi loại bằng 1 bài post thật) ----------

async function exampleRankie() {
  const [rk] = await db
    .select({ id: posts.id, title: posts.title })
    .from(posts)
    .where(
      and(
        eq(posts.type, 'rankie'),
        sql`NOT EXISTS (SELECT 1 FROM tournament_matches tm WHERE tm.rankie_post_id = ${posts.id})`,
        sql`(${posts.opensAt} IS NULL OR ${posts.opensAt} <= now())`,
      ),
    )
    .orderBy(
      sql`(SELECT COALESCE(SUM(ro.votes),0) FROM rankie_options ro WHERE ro.rankie_id = ${posts.id}) DESC`,
      desc(posts.createdAt),
    )
    .limit(1);
  if (!rk) return null;
  const opts = await db
    .select({ label: rankieOptions.label, emoji: rankieOptions.emoji, votes: rankieOptions.votes })
    .from(rankieOptions)
    .where(eq(rankieOptions.rankieId, rk.id))
    .orderBy(desc(rankieOptions.votes), rankieOptions.position);
  const total = opts.reduce((s, o) => s + (Number(o.votes) || 0), 0);
  return {
    id: rk.id,
    title: rk.title,
    total,
    options: opts.slice(0, 3).map((o) => ({ label: o.label, emoji: o.emoji, votes: Number(o.votes) || 0 })),
  };
}

async function examplePath() {
  const [p] = await db.select({ id: posts.id, title: posts.title }).from(posts)
    .where(eq(posts.type, 'path'))
    .orderBy(sql`(SELECT COUNT(*) FROM path_questions pq WHERE pq.post_id = ${posts.id}) DESC`, desc(posts.createdAt))
    .limit(1);
  if (!p) return null;
  const qs = await db.select({ id: pathQuestions.id, text: pathQuestions.text, isEntry: pathQuestions.isEntry })
    .from(pathQuestions).where(eq(pathQuestions.postId, p.id)).orderBy(desc(pathQuestions.isEntry), pathQuestions.position);
  const q = qs[0];
  const answers = q
    ? await db.select({ label: pathAnswers.label, emoji: pathAnswers.emoji }).from(pathAnswers)
        .where(eq(pathAnswers.questionId, q.id)).orderBy(pathAnswers.position).limit(3)
    : [];
  return { id: p.id, title: p.title, question: q?.text || null, branches: answers.map((a) => ({ label: a.label, emoji: a.emoji })) };
}

async function exampleDeck(mode: 'survey' | 'exam') {
  const [d] = await db.select({ id: posts.id, title: posts.title }).from(posts)
    .where(and(eq(posts.type, 'deck'), eq(posts.deckMode, mode)))
    .orderBy(sql`(SELECT COUNT(*) FROM deck_questions dq WHERE dq.post_id = ${posts.id}) DESC`, desc(posts.createdAt))
    .limit(1);
  if (!d) return null;
  const qs = await db.select({ id: deckQuestions.id, text: deckQuestions.text }).from(deckQuestions)
    .where(eq(deckQuestions.postId, d.id)).orderBy(deckQuestions.position);
  const first = qs[0];
  const options = first
    ? await db.select({ label: deckOptions.label, correct: deckOptions.correct }).from(deckOptions)
        .where(eq(deckOptions.questionId, first.id)).orderBy(deckOptions.position).limit(4)
    : [];
  return { id: d.id, title: d.title, questionCount: qs.length, question: first?.text || null, options };
}

/** Một bài THẬT cho mỗi loại (rankie/path/survey/exam) để preview trong onboarding. */
export async function getExamples() {
  const [rankie, path, survey, exam] = await Promise.all([
    exampleRankie(), examplePath(), exampleDeck('survey'), exampleDeck('exam'),
  ]);
  return { rankie, path, survey, exam };
}
