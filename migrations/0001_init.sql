-- Rankev — Sprint 1 initial schema
-- Tables: users, posts, rankie_options, votes, comments, bookmarks, refresh_tokens

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2.1 users (+ email / password_hash required by /auth)
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT NOT NULL UNIQUE,
  handle        TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  avatar_emoji  TEXT,
  avatar_color  TEXT,
  avatar_url    TEXT,
  bio           TEXT,
  verified      BOOLEAN NOT NULL DEFAULT false,
  rank_points   INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2.2 posts (shared table across content types; Sprint 1 exercises 'rankie')
CREATE TABLE posts (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type                  TEXT NOT NULL CHECK (type IN ('rankie','path','deck')),
  deck_mode             TEXT CHECK (deck_mode IN ('survey','exam')),
  author_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title                 TEXT NOT NULL,
  subtitle              TEXT,
  caption               TEXT,
  category              TEXT,
  media                 JSONB,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  closes_at             TIMESTAMPTZ,
  live                  BOOLEAN NOT NULL DEFAULT false,
  sponsored             BOOLEAN NOT NULL DEFAULT false,
  allow_guest_present   BOOLEAN NOT NULL DEFAULT false,
  series_id             UUID,
  -- Rankie-specific
  voting_type           TEXT CHECK (voting_type IN ('single','multiple','rating','unlimited')),
  chart_type            TEXT CHECK (chart_type IN ('bar','pie','head_to_head')),
  -- Path-specific
  reveal_mode           TEXT CHECK (reveal_mode IN ('all','names','stats','hidden')) DEFAULT 'hidden',
  hide_ending_count     BOOLEAN NOT NULL DEFAULT false,
  -- Deck-specific
  exam_duration_minutes INTEGER,
  passing_score         NUMERIC(4,1)
);
CREATE INDEX posts_type_created_idx ON posts (type, created_at DESC, id DESC);
CREATE INDEX posts_author_idx ON posts (author_id);

-- 2.3 rankie_options
CREATE TABLE rankie_options (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rankie_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  label     TEXT,
  emoji     TEXT,
  flag      TEXT,
  image_url TEXT,
  color     TEXT,
  position  INTEGER NOT NULL DEFAULT 0,
  votes     BIGINT NOT NULL DEFAULT 0,
  voters    INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX rankie_options_rankie_idx ON rankie_options (rankie_id, position);

-- 2.11 votes (1 user 1 vote per rankie; tap_count for 'unlimited' mode)
CREATE TABLE votes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rankie_id  UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  option_ids TEXT[] NOT NULL DEFAULT '{}',
  tap_count  INTEGER NOT NULL DEFAULT 1,
  voted_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, rankie_id)
);

-- 2.14 comments
CREATE TABLE comments (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id    UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  parent_id  UUID REFERENCES comments(id) ON DELETE CASCADE,
  text       TEXT,
  image_url  TEXT,
  emoji      TEXT,
  supports   TEXT[],
  rank_up    INTEGER NOT NULL DEFAULT 0,
  rank_down  INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);
CREATE INDEX comments_post_idx ON comments (post_id, created_at DESC);

-- 2.16 bookmarks
CREATE TABLE bookmarks (
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id       UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  bookmarked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, post_id)
);

-- refresh_tokens (opaque, hashed) — backs /auth/refresh + /auth/logout
CREATE TABLE refresh_tokens (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX refresh_tokens_user_idx ON refresh_tokens (user_id);
