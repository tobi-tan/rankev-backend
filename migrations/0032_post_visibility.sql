-- Quyền riêng tư / ghim / ẩn bài — trước chỉ lưu trên máy người dùng (server không biết) nên
-- bài "Chỉ mình tôi" vẫn hiện với người khác. Nay lưu thật + áp dụng ở feed/hồ sơ/tìm kiếm/link.
--   visibility: public (mọi nơi) | unlisted (chỉ ai có link) | private (chỉ chủ bài)
--   hidden: chủ bài "Ẩn bài đăng" (như private — chỉ chủ thấy)
--   pinned: ghim lên đầu hồ sơ
ALTER TABLE posts ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'public';
ALTER TABLE posts ADD COLUMN IF NOT EXISTS pinned boolean NOT NULL DEFAULT false;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS hidden boolean NOT NULL DEFAULT false;
DO $$ BEGIN
  ALTER TABLE posts ADD CONSTRAINT posts_visibility_check CHECK (visibility IN ('public', 'unlisted', 'private'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
