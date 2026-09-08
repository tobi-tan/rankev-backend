-- Hẹn giờ lên sóng cho rankie cơ bản: trước opens_at không ai bình chọn được.
ALTER TABLE posts ADD COLUMN IF NOT EXISTS opens_at timestamptz;
