-- Phòng chờ + công bố kết quả trễ cho live exam.
-- live_at: null = đang ở phòng chờ; set khi host bấm "Bắt đầu" → phiên vào giai đoạn thi.
-- ends_at: thời điểm tự hết giờ (live_at + thời lượng exam); null = không giới hạn thời gian.
ALTER TABLE presentation_sessions ADD COLUMN IF NOT EXISTS live_at TIMESTAMPTZ;
ALTER TABLE presentation_sessions ADD COLUMN IF NOT EXISTS ends_at TIMESTAMPTZ;
