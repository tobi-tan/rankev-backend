-- Per-user up/down on comments (dedup + toggle). comments.rank_up/rank_down
-- are kept in sync as aggregate counters.

CREATE TABLE comment_ranks (
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  comment_id UUID NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  value      SMALLINT NOT NULL CHECK (value IN (-1, 1)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, comment_id)
);
CREATE INDEX comment_ranks_comment_idx ON comment_ranks (comment_id);
