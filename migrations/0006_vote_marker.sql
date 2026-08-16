-- Sticker "đã bình chọn" tuỳ chỉnh cho Rankie (thay nhãn "VOTED" mặc định).
-- { emoji?: string, image?: string }
ALTER TABLE posts ADD COLUMN IF NOT EXISTS vote_marker JSONB;
