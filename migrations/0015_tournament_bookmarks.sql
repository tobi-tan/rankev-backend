-- Đánh dấu (lưu) giải đấu — bookmarks thường khoá theo post_id nên giải cần bảng riêng.
CREATE TABLE IF NOT EXISTS tournament_bookmarks (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tournament_id uuid NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  bookmarked_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, tournament_id)
);
CREATE INDEX IF NOT EXISTS tournament_bookmarks_user_idx ON tournament_bookmarks(user_id, bookmarked_at DESC);
