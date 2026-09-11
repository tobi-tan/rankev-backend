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
  ageRange?: string | null;
  gender?: string | null;
  occupation?: string | null;
  demographicsPublic?: Record<string, boolean>;
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
  if (self) {
    base.ageRange = u.ageRange;
    base.gender = u.gender;
    base.occupation = u.occupation;
    base.demographicsPublic = pub;
  } else {
    if (pub.age) base.ageRange = u.ageRange;
    if (pub.gender) base.gender = u.gender;
    if (pub.occupation) base.occupation = u.occupation;
  }
  return base;
}
