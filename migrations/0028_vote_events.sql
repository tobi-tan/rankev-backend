-- 0028: nhật ký phiếu (ẩn danh) để dựng "Dòng thời gian cạnh tranh" bằng SỐ LIỆU THẬT.
-- Mỗi lần số phiếu của 1 lựa chọn đổi (vote / đổi lựa chọn / bỏ vote / gõ thêm ở rankie
-- không giới hạn) ghi 1 dòng: bài, lựa chọn, delta phiếu, thời điểm. Không lưu người vote.
CREATE TABLE IF NOT EXISTS vote_events (
  id bigserial PRIMARY KEY,
  rankie_id uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  option_id uuid NOT NULL,
  delta integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS vote_events_rankie_idx ON vote_events (rankie_id, created_at);
