-- Thông báo đẩy (Web Push): mỗi trình duyệt/thiết bị đã bật thông báo = 1 dòng.
-- endpoint là duy nhất; đổi tài khoản trên cùng thiết bị → chuyển dòng sang người mới.
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind         TEXT NOT NULL DEFAULT 'web' CHECK (kind IN ('web', 'fcm')),
  endpoint     TEXT NOT NULL UNIQUE,
  p256dh       TEXT,
  auth         TEXT,
  user_agent   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS push_subscriptions_user_idx ON push_subscriptions (user_id);
