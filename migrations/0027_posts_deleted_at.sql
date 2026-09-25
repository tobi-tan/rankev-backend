-- 0027: soft-delete cho bài viết (thùng rác). Thêm cột deleted_at (null = còn sống).
-- Xoá bài = set deleted_at = now (giấu khỏi feed/hồ sơ công khai, còn trong "Thùng rác").
-- Khôi phục = set null. Xoá vĩnh viễn = DELETE thật (cascade options/votes/comments).
ALTER TABLE posts ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- Lọc nhanh feed/hồ sơ (chỉ bài còn sống).
CREATE INDEX IF NOT EXISTS posts_deleted_at_idx ON posts (deleted_at);
