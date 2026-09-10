-- Kho "Đã lưu" chung: lưu bài viết / người dùng / bình luận về một chỗ (gộp bookmark + giỏ Rankie).
-- preview = ảnh chụp hiển thị lúc lưu (để render nhanh, không cần hydrate lại).
CREATE TABLE IF NOT EXISTS saves (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ref_type text NOT NULL,          -- 'post' | 'user' | 'comment'
  ref_id text NOT NULL,
  preview jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, ref_type, ref_id)
);
CREATE INDEX IF NOT EXISTS saves_user_idx ON saves(user_id, created_at DESC);
