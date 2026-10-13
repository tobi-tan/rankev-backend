-- @handle do NGƯỜI DÙNG tự chọn: tài khoản MXH (Google/Facebook/Apple) mới nhận handle tạm ngẫu nhiên
-- (không lấy từ email — lộ thông tin cá nhân) và handle_confirmed = false → app bắt chọn @handle.
ALTER TABLE users ADD COLUMN IF NOT EXISTS handle_confirmed boolean NOT NULL DEFAULT true;
-- Tài khoản MXH cũ có handle sinh từ phần trước @ của email → nhắc chọn lại một lần.
UPDATE users SET handle_confirmed = false
WHERE password_hash IS NULL AND provider IS NOT NULL
  AND length(regexp_replace(lower(split_part(email, '@', 1)), '[^a-z0-9_]', '', 'g')) >= 3
  AND handle LIKE left(regexp_replace(lower(split_part(email, '@', 1)), '[^a-z0-9_]', '', 'g'), 20) || '%';
