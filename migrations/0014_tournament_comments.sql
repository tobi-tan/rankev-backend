-- Cho phép bình luận trên GIẢI ĐẤU (không chỉ post). Một comment thuộc post HOẶC tournament.
ALTER TABLE comments ALTER COLUMN post_id DROP NOT NULL;
ALTER TABLE comments ADD COLUMN IF NOT EXISTS tournament_id uuid REFERENCES tournaments(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS comments_tournament_idx ON comments(tournament_id, created_at);
