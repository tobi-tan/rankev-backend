import type { Comment } from '../../db/schema';
import type { PublicUser } from '../users/users.serializer';

export interface CommentView {
  id: string;
  postId: string;
  parentId: string | null;
  author: PublicUser | null;
  text: string | null;
  imageUrl: string | null;
  emoji: string | null;
  supports: string[] | null;
  rankUp: number;
  rankDown: number;
  myRank: -1 | 0 | 1;
  replyCount: number;
  deleted: boolean;
  createdAt: string;
}

export function toCommentView(
  c: Comment,
  author: PublicUser | null,
  myRank: number,
  replyCount: number,
): CommentView {
  const deleted = Boolean(c.deletedAt);
  return {
    id: c.id,
    postId: c.postId,
    parentId: c.parentId,
    author,
    text: deleted ? null : c.text,
    imageUrl: deleted ? null : c.imageUrl,
    emoji: deleted ? null : c.emoji,
    supports: c.supports,
    rankUp: c.rankUp,
    rankDown: c.rankDown,
    myRank: (myRank === 1 ? 1 : myRank === -1 ? -1 : 0) as -1 | 0 | 1,
    replyCount,
    deleted,
    createdAt: c.createdAt.toISOString(),
  };
}
