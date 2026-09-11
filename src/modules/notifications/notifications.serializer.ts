import type { PublicUser } from '../users/users.serializer';

export interface NotificationView {
  id: string;
  type: string;
  actor: PublicUser | null;
  postId: string | null;
  tournamentId: string | null;
  commentId: string | null;
  targetTitle: string | null; // tiêu đề bài/giải để hiển thị
  text: string | null;
  read: boolean;
  createdAt: string;
}

type NotificationRow = {
  id: string;
  type: string;
  postId: string | null;
  tournamentId: string | null;
  commentId: string | null;
  text: string | null;
  readAt: Date | null;
  createdAt: Date;
};

export function toNotificationView(
  n: NotificationRow,
  actor: PublicUser | null,
  targetTitle: string | null,
): NotificationView {
  return {
    id: n.id,
    type: n.type,
    actor,
    postId: n.postId,
    tournamentId: n.tournamentId,
    commentId: n.commentId,
    targetTitle,
    text: n.text,
    read: n.readAt !== null,
    createdAt: n.createdAt.toISOString(),
  };
}
