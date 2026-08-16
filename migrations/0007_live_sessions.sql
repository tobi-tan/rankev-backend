-- Phiên trình chiếu TRỰC TIẾP: người thật join bằng mã, nộp đáp án, kết quả tổng hợp.
ALTER TABLE presentation_sessions ADD COLUMN IF NOT EXISTS code TEXT;
CREATE INDEX IF NOT EXISTS presentation_sessions_code_idx ON presentation_sessions (code);

CREATE TABLE IF NOT EXISTS live_participants (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id     UUID NOT NULL REFERENCES presentation_sessions(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  answers        JSONB,
  score          NUMERIC(4,1),
  correct_count  INTEGER,
  total_gradable INTEGER,
  submitted_at   TIMESTAMPTZ,
  joined_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS live_participants_session_idx ON live_participants (session_id);
