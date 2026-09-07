-- Giờ MỞ bình chọn của mỗi trận (lịch từng trận). null = mở ngay.
ALTER TABLE tournament_matches ADD COLUMN IF NOT EXISTS opens_at timestamptz;
