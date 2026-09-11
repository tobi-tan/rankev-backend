import type { User } from '../../db/schema';

export interface PublicUser {
  id: string;
  handle: string;
  name: string;
  avatarEmoji: string | null;
  avatarColor: string | null;
  avatarUrl: string | null;
  bio: string | null;
  verified: boolean;
  rankPoints: number;
  createdAt: string;
  // Nhân khẩu học (tùy chọn). Với người xem khác: chỉ hiện field đã đặt CÔNG KHAI.
  // Với chính chủ (self=true): hiện tất cả + cờ demographicsPublic để chỉnh.
  age?: number | null;        // suy ra từ ngày sinh
  ageRange?: string | null;
  dateOfBirth?: string | null; // chỉ trả cho chính chủ
  gender?: string | null;
  occupation?: string | null;
  demographicsPublic?: Record<string, boolean>;
}

function ageFromDob(dob: string | null | undefined): number | null {
  if (!dob) return null;
  const d = new Date(dob);
  if (isNaN(d.getTime())) return null;
  const now = new Date();
  let a = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) a--;
  return a >= 0 && a <= 120 ? a : null;
}

/**
 * Strip sensitive fields (email, passwordHash) before sending a user to clients.
 * `self=true` (chính chủ) → kèm toàn bộ nhân khẩu học + cờ ẩn/công khai để chỉnh.
 * Người xem khác → chỉ field được đặt công khai; field ẩn coi như không tồn tại.
 */
export function toPublicUser(u: User, self = false): PublicUser {
  const base: PublicUser = {
    id: u.id,
    handle: u.handle,
    name: u.name,
    avatarEmoji: u.avatarEmoji,
    avatarColor: u.avatarColor,
    avatarUrl: u.avatarUrl,
    bio: u.bio,
    verified: u.verified,
    rankPoints: u.rankPoints,
    createdAt: u.createdAt.toISOString(),
  };
  const pub = (u.demographicsPublic || {}) as Record<string, boolean>;
  const age = ageFromDob(u.dateOfBirth);
  if (self) {
    base.age = age;
    base.ageRange = u.ageRange;
    base.dateOfBirth = u.dateOfBirth;
    base.gender = u.gender;
    base.occupation = u.occupation;
    base.demographicsPublic = pub;
  } else {
    if (pub.age) { base.age = age; base.ageRange = u.ageRange; }
    if (pub.gender) base.gender = u.gender;
    if (pub.occupation) base.occupation = u.occupation;
  }
  return base;
}
