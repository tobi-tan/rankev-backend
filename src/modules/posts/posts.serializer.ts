import type { Post, RankieOption } from '../../db/schema';
import type { PublicUser } from '../users/users.serializer';

export interface RankieOptionView {
  id: string;
  label: string | null;
  emoji: string | null;
  flag: string | null;
  imageUrl: string | null;
  color: string | null;
  position: number;
  votes: number;
  voters: number;
}

export interface RankieView {
  id: string;
  type: Post['type'];
  title: string;
  subtitle: string | null;
  caption: string | null;
  category: string | null;
  media: Post['media'];
  voteMarker: Post['voteMarker'];
  createdAt: string;
  closesAt: string | null;
  closed: boolean;
  live: boolean;
  sponsored: boolean;
  votingType: Post['votingType'];
  chartType: Post['chartType'];
  seriesId?: string | null;
  seriesName?: string | null;
  author: PublicUser | null;
  options: RankieOptionView[];
  totalVotes: number;
  myVote?: { optionIds: string[]; tapCount: number } | null;
  bookmarked?: boolean;
}

export function toOptionView(o: RankieOption): RankieOptionView {
  return {
    id: o.id,
    label: o.label,
    emoji: o.emoji,
    flag: o.flag,
    imageUrl: o.imageUrl,
    color: o.color,
    position: o.position,
    votes: Number(o.votes),
    voters: o.voters,
  };
}

export function toRankieView(
  post: Post,
  author: PublicUser | null,
  options: RankieOption[],
  myVote?: { optionIds: string[]; tapCount: number } | null,
  bookmarked?: boolean,
): RankieView {
  const optionViews = options
    .map(toOptionView)
    .sort((a, b) => a.position - b.position);
  const view: RankieView = {
    id: post.id,
    type: post.type,
    title: post.title,
    subtitle: post.subtitle,
    caption: post.caption,
    category: post.category,
    media: post.media,
    voteMarker: post.voteMarker,
    createdAt: post.createdAt.toISOString(),
    closesAt: post.closesAt ? post.closesAt.toISOString() : null,
    closed: post.closesAt ? post.closesAt.getTime() <= Date.now() : false,
    live: post.live,
    sponsored: post.sponsored,
    votingType: post.votingType,
    chartType: post.chartType,
    author,
    options: optionViews,
    totalVotes: optionViews.reduce((sum, o) => sum + o.votes, 0),
  };
  if (myVote !== undefined) view.myVote = myVote;
  if (bookmarked !== undefined) view.bookmarked = bookmarked;
  return view;
}
