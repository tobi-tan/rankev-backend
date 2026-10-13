-- Xác minh email "mềm": không chặn dùng app, chỉ nhắc. Tài khoản MXH (Google/Facebook/Apple) coi
-- như đã xác minh (nhà cung cấp đã xác minh email). Mã 6 số chỉ lưu HASH, hết hạn 30 phút.
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified boolean NOT NULL DEFAULT false;
UPDATE users SET email_verified = true WHERE provider IS NOT NULL;

CREATE TABLE IF NOT EXISTS email_verifications (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_hash   text NOT NULL,
  expires_at  timestamptz NOT NULL,
  used_at     timestamptz,
  attempts    integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS email_verifications_user_idx ON email_verifications (user_id, created_at);
