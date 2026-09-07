-- Cấu hình giải đấu (mô tả, thời gian mỗi vòng, cho phép trình chiếu) dùng lại cho
-- mọi ván, kể cả các vòng sinh ra khi chốt vòng.
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS settings jsonb;
