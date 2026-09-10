-- Đăng nhập mạng xã hội (Google/Facebook/Apple): user có thể KHÔNG có mật khẩu.
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS provider text;        -- 'google' | 'facebook' | 'apple' | null (email)
ALTER TABLE users ADD COLUMN IF NOT EXISTS provider_id text;     -- id người dùng ở nhà cung cấp
CREATE UNIQUE INDEX IF NOT EXISTS users_provider_uidx ON users(provider, provider_id) WHERE provider IS NOT NULL;
