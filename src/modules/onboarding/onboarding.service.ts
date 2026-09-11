import { and, eq, sql } from 'drizzle-orm';
import { db } from '../../db';
import { onboardingVotes, users } from '../../db/schema';
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
const DEMO_KEYS = { age: 'ageRange', gender: 'gender', occupation: 'occupation' } as const;

export interface KeyStats {
  key: string;
  counts: Record<string, number>;
  voters: number;
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
  return keyStats(key);
}

/** Lưu nhân khẩu học lên hồ sơ (kèm ẩn/công khai) + ghi phiếu để tính thống kê chung. */
export async function saveDemographics(
  userId: string,
  input: { age?: string | null; gender?: string | null; occupation?: string | null; visible?: Record<string, boolean> },
): Promise<{ stats: KeyStats[] }> {
  const patch: Record<string, unknown> = {};
  const publicMap: Record<string, boolean> = {};
  const votes: { key: string; choice: string }[] = [];

  for (const [key, col] of Object.entries(DEMO_KEYS)) {
    const val = (input as Record<string, string | null | undefined>)[key];
    if (val === undefined) continue; // không đụng tới field không gửi
    const allowed = ONBOARDING_OPTIONS[key];
    if (val === null || val === '') {
      patch[col] = null;
    } else if (allowed.includes(val)) {
      patch[col] = val;
      votes.push({ key, choice: val });
    } else {
      throw badRequest(`Giá trị ${key} không hợp lệ`);
    }
    publicMap[key] = !!input.visible?.[key];
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

  const keys = votes.map((v) => v.key);
  const stats = await Promise.all(keys.map((k) => keyStats(k)));
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
