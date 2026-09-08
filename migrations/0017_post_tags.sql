-- Hashtag tự do thay cho danh mục cố định. Mỗi bài mang một mảng tag (jsonb).
ALTER TABLE posts ADD COLUMN IF NOT EXISTS tags jsonb;
-- Backfill: danh mục cũ trở thành hashtag đầu tiên (giữ dữ liệu hiện có).
UPDATE posts SET tags = jsonb_build_array(category) WHERE category IS NOT NULL AND category <> '' AND tags IS NULL;
-- Index GIN để lọc/nhóm theo tag nhanh.
CREATE INDEX IF NOT EXISTS posts_tags_gin ON posts USING gin (tags);
