-- Sprint 5: RankUp (replaces follow), Series/Chapter, presentation sessions.

-- 2.15 rank_ups — tiered "follow": 1=Quan tâm, 2=Yêu thích, 3=Fan cuồng
CREATE TABLE rank_ups (
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  author_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tier       INTEGER NOT NULL CHECK (tier BETWEEN 1 AND 3),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, author_id),
  CHECK (user_id <> author_id)
);
CREATE INDEX rank_ups_author_idx ON rank_ups (author_id);

-- 2.9 series (Chapter/Series)
CREATE TABLE series (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  author_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX series_author_idx ON series (author_id);

-- 2.10 series_posts
CREATE TABLE series_posts (
  series_id UUID NOT NULL REFERENCES series(id) ON DELETE CASCADE,
  post_id   UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  position  INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (series_id, post_id)
);
CREATE INDEX series_posts_post_idx ON series_posts (post_id);

-- 2.17 presentation_sessions (Trình chiếu Survey/Exam/Rankie)
CREATE TABLE presentation_sessions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id      UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  host_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name         TEXT,
  started_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at     TIMESTAMPTZ,
  participants INTEGER NOT NULL DEFAULT 0,
  avg_score    NUMERIC(4,1),
  total_votes  INTEGER
);
CREATE INDEX presentation_sessions_host_idx ON presentation_sessions (host_id, started_at DESC);
CREATE INDEX presentation_sessions_post_idx ON presentation_sessions (post_id);
