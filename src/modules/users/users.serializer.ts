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
}

/** Strip sensitive fields (email, passwordHash) before sending a user to clients. */
export function toPublicUser(u: User): PublicUser {
  return {
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
}
