-- 0029: kiểm soát feed kiểu Instagram/TikTok.
--  • user_mutes: "Ẩn bài của @x" — không thấy bài của họ trong feed, họ không biết,
--    vẫn xem được hồ sơ và nhắn tin như thường (khác với chặn).
--  • hidden_posts: "Không quan tâm" — ẩn một bài cụ thể khỏi feed của mình.
CREATE TABLE IF NOT EXISTS user_mutes (
  muter_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  muted_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (muter_id, muted_id)
);

CREATE TABLE IF NOT EXISTS hidden_posts (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, post_id)
);
