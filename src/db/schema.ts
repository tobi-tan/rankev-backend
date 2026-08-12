import {
  pgTable,
  uuid,
  text,
  boolean,
  integer,
  bigint,
  smallint,
  timestamp,
  jsonb,
  numeric,
  primaryKey,
  unique,
  index,
} from 'drizzle-orm/pg-core';

/**
 * Drizzle schema — source of truth for query typing.
 * The runnable DDL lives in ./migrations/0001_init.sql (applied by `npm run db:migrate`).
 * Keep both in sync when the schema changes.
 */

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  handle: text('handle').notNull().unique(),
  name: text('name').notNull(),
  passwordHash: text('password_hash').notNull(),
  avatarEmoji: text('avatar_emoji'),
  avatarColor: text('avatar_color'),
  avatarUrl: text('avatar_url'),
  bio: text('bio'),
  verified: boolean('verified').notNull().default(false),
  rankPoints: integer('rank_points').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const posts = pgTable(
  'posts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    type: text('type', { enum: ['rankie', 'path', 'deck'] }).notNull(),
    deckMode: text('deck_mode', { enum: ['survey', 'exam'] }),
    authorId: uuid('author_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    subtitle: text('subtitle'),
    caption: text('caption'),
    category: text('category'),
    media: jsonb('media').$type<{ type?: string; color?: string; emoji?: string; url?: string }>(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    closesAt: timestamp('closes_at', { withTimezone: true }),
    live: boolean('live').notNull().default(false),
    sponsored: boolean('sponsored').notNull().default(false),
    allowGuestPresent: boolean('allow_guest_present').notNull().default(false),
    seriesId: uuid('series_id'),
    votingType: text('voting_type', {
      enum: ['single', 'multiple', 'rating', 'unlimited'],
    }),
    chartType: text('chart_type', { enum: ['bar', 'pie', 'head_to_head'] }),
    revealMode: text('reveal_mode', {
      enum: ['all', 'names', 'stats', 'hidden'],
    }).default('hidden'),
    hideEndingCount: boolean('hide_ending_count').notNull().default(false),
    examDurationMinutes: integer('exam_duration_minutes'),
    passingScore: numeric('passing_score', { precision: 4, scale: 1 }),
  },
  (t) => ({
    typeCreatedIdx: index('posts_type_created_idx').on(t.type, t.createdAt, t.id),
    authorIdx: index('posts_author_idx').on(t.authorId),
  }),
);

export const rankieOptions = pgTable(
  'rankie_options',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    rankieId: uuid('rankie_id')
      .notNull()
      .references(() => posts.id, { onDelete: 'cascade' }),
    label: text('label'),
    emoji: text('emoji'),
    flag: text('flag'),
    imageUrl: text('image_url'),
    color: text('color'),
    position: integer('position').notNull().default(0),
    votes: bigint('votes', { mode: 'number' }).notNull().default(0),
    voters: integer('voters').notNull().default(0),
  },
  (t) => ({
    rankieIdx: index('rankie_options_rankie_idx').on(t.rankieId, t.position),
  }),
);

export const votes = pgTable(
  'votes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    rankieId: uuid('rankie_id')
      .notNull()
      .references(() => posts.id, { onDelete: 'cascade' }),
    optionIds: text('option_ids').array().notNull().default([]),
    tapCount: integer('tap_count').notNull().default(1),
    votedAt: timestamp('voted_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userRankieUnique: unique('votes_user_rankie_unique').on(t.userId, t.rankieId),
  }),
);

export const comments = pgTable(
  'comments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    postId: uuid('post_id')
      .notNull()
      .references(() => posts.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    parentId: uuid('parent_id'),
    text: text('text'),
    imageUrl: text('image_url'),
    emoji: text('emoji'),
    supports: text('supports').array(),
    rankUp: integer('rank_up').notNull().default(0),
    rankDown: integer('rank_down').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => ({
    postIdx: index('comments_post_idx').on(t.postId, t.createdAt),
  }),
);

export const bookmarks = pgTable(
  'bookmarks',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    postId: uuid('post_id')
      .notNull()
      .references(() => posts.id, { onDelete: 'cascade' }),
    bookmarkedAt: timestamp('bookmarked_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.userId, t.postId] }),
  }),
);

export const refreshTokens = pgTable(
  'refresh_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull().unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userIdx: index('refresh_tokens_user_idx').on(t.userId),
  }),
);

export const reports = pgTable(
  'reports',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    reporterId: uuid('reporter_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    targetType: text('target_type', { enum: ['post', 'comment', 'user'] }).notNull(),
    targetId: uuid('target_id').notNull(),
    reason: text('reason').notNull(),
    note: text('note'),
    status: text('status', { enum: ['open', 'reviewed', 'actioned', 'dismissed'] })
      .notNull()
      .default('open'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    targetIdx: index('reports_target_idx').on(t.targetType, t.targetId),
    statusIdx: index('reports_status_idx').on(t.status, t.createdAt),
    uniqueReport: unique('reports_unique_idx').on(t.reporterId, t.targetType, t.targetId),
  }),
);

export const userBlocks = pgTable(
  'user_blocks',
  {
    blockerId: uuid('blocker_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    blockedId: uuid('blocked_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.blockerId, t.blockedId] }),
    blockedIdx: index('user_blocks_blocked_idx').on(t.blockedId),
  }),
);

export const commentRanks = pgTable(
  'comment_ranks',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    commentId: uuid('comment_id')
      .notNull()
      .references(() => comments.id, { onDelete: 'cascade' }),
    value: smallint('value').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.userId, t.commentId] }),
    commentIdx: index('comment_ranks_comment_idx').on(t.commentId),
  }),
);

export const pathQuestions = pgTable(
  'path_questions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    postId: uuid('post_id')
      .notNull()
      .references(() => posts.id, { onDelete: 'cascade' }),
    position: integer('position').notNull().default(0),
    text: text('text'),
    sceneImageUrl: text('scene_image_url'),
    isEntry: boolean('is_entry').notNull().default(false),
  },
  (t) => ({ postIdx: index('path_questions_post_idx').on(t.postId, t.position) }),
);

export const pathAnswers = pgTable(
  'path_answers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    questionId: uuid('question_id')
      .notNull()
      .references(() => pathQuestions.id, { onDelete: 'cascade' }),
    label: text('label'),
    emoji: text('emoji'),
    imageUrl: text('image_url'),
    hotspotX: numeric('hotspot_x', { precision: 5, scale: 2 }),
    hotspotY: numeric('hotspot_y', { precision: 5, scale: 2 }),
    targetType: text('target_type', { enum: ['question', 'ending'] }),
    targetId: text('target_id'),
    position: integer('position').notNull().default(0),
  },
  (t) => ({ questionIdx: index('path_answers_question_idx').on(t.questionId, t.position) }),
);

export const pathEndings = pgTable(
  'path_endings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    postId: uuid('post_id')
      .notNull()
      .references(() => posts.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    emoji: text('emoji'),
    imageUrl: text('image_url'),
    count: integer('count').notNull().default(0),
    comment: text('comment'),
  },
  (t) => ({ postNameUnique: unique('path_endings_post_name_unique').on(t.postId, t.name) }),
);

export const deckQuestions = pgTable(
  'deck_questions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    postId: uuid('post_id')
      .notNull()
      .references(() => posts.id, { onDelete: 'cascade' }),
    position: integer('position').notNull().default(0),
    text: text('text'),
    votingType: text('voting_type', { enum: ['single', 'multiple', 'rating', 'text'] }),
    points: numeric('points', { precision: 4, scale: 1 }).notNull().default('0'),
    imageUrl: text('image_url'),
  },
  (t) => ({ postIdx: index('deck_questions_post_idx').on(t.postId, t.position) }),
);

export const deckOptions = pgTable(
  'deck_options',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    questionId: uuid('question_id')
      .notNull()
      .references(() => deckQuestions.id, { onDelete: 'cascade' }),
    label: text('label'),
    emoji: text('emoji'),
    imageUrl: text('image_url'),
    correct: boolean('correct').notNull().default(false),
    position: integer('position').notNull().default(0),
  },
  (t) => ({ questionIdx: index('deck_options_question_idx').on(t.questionId, t.position) }),
);

export const participations = pgTable(
  'participations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    postId: uuid('post_id')
      .notNull()
      .references(() => posts.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    deckMode: text('deck_mode'),
    endingName: text('ending_name'),
    score: numeric('score', { precision: 4, scale: 1 }),
    correctCount: integer('correct_count'),
    totalGradable: integer('total_gradable'),
    answers: jsonb('answers'),
    detail: text('detail'),
    participatedAt: timestamp('participated_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userPostUnique: unique('participations_user_post_unique').on(t.userId, t.postId),
    postIdx: index('participations_post_idx').on(t.postId),
  }),
);

export const pathUnlocks = pgTable(
  'path_unlocks',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    postId: uuid('post_id')
      .notNull()
      .references(() => posts.id, { onDelete: 'cascade' }),
    endingName: text('ending_name').notNull(),
    unlockedAt: timestamp('unlocked_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ pk: primaryKey({ columns: [t.userId, t.postId, t.endingName] }) }),
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Comment = typeof comments.$inferSelect;
export type PathQuestion = typeof pathQuestions.$inferSelect;
export type PathAnswer = typeof pathAnswers.$inferSelect;
export type PathEnding = typeof pathEndings.$inferSelect;
export const rankUps = pgTable(
  'rank_ups',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    authorId: uuid('author_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tier: integer('tier').notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.userId, t.authorId] }),
    authorIdx: index('rank_ups_author_idx').on(t.authorId),
  }),
);

export const series = pgTable(
  'series',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    authorId: uuid('author_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ authorIdx: index('series_author_idx').on(t.authorId) }),
);

export const seriesPosts = pgTable(
  'series_posts',
  {
    seriesId: uuid('series_id')
      .notNull()
      .references(() => series.id, { onDelete: 'cascade' }),
    postId: uuid('post_id')
      .notNull()
      .references(() => posts.id, { onDelete: 'cascade' }),
    position: integer('position').notNull().default(0),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.seriesId, t.postId] }),
    postIdx: index('series_posts_post_idx').on(t.postId),
  }),
);

export const presentationSessions = pgTable(
  'presentation_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    postId: uuid('post_id')
      .notNull()
      .references(() => posts.id, { onDelete: 'cascade' }),
    hostId: uuid('host_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name'),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    endedAt: timestamp('ended_at', { withTimezone: true }),
    participants: integer('participants').notNull().default(0),
    avgScore: numeric('avg_score', { precision: 4, scale: 1 }),
    totalVotes: integer('total_votes'),
  },
  (t) => ({
    hostIdx: index('presentation_sessions_host_idx').on(t.hostId, t.startedAt),
    postIdx: index('presentation_sessions_post_idx').on(t.postId),
  }),
);

export type DeckQuestion = typeof deckQuestions.$inferSelect;
export type DeckOption = typeof deckOptions.$inferSelect;
export type Participation = typeof participations.$inferSelect;
export type Series = typeof series.$inferSelect;
export type PresentationSession = typeof presentationSessions.$inferSelect;
export type Post = typeof posts.$inferSelect;
export type RankieOption = typeof rankieOptions.$inferSelect;
export type Vote = typeof votes.$inferSelect;
