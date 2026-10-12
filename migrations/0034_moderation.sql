-- Kiểm duyệt (App Store 1.2 / Google Play UGC): quản trị viên xử lý báo cáo.
--  · users.suspended_at  — tài khoản bị khoá do vi phạm (không đăng nhập được, nội dung bị ẩn)
--  · posts.removed_at    — bài bị GỠ do vi phạm (chủ bài không tự khôi phục được)
--  · reports.resolved_*  — ai xử lý, lúc nào, kết quả gì (minh bạch + thông báo người báo cáo)
ALTER TABLE users ADD COLUMN IF NOT EXISTS suspended_at timestamptz;
ALTER TABLE users ADD COLUMN IF NOT EXISTS suspend_reason text;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS removed_at timestamptz;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS resolved_at timestamptz;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS resolved_by uuid REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS resolution text;
