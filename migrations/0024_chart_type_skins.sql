-- 0024: cho phép các skin biểu đồ mới cho Rankie — tug (Kéo co), beam (Kamehameha), podium (Bục).
-- Constraint CHECK cũ trong 0001_init chỉ nhận ('bar','pie','head_to_head'). Commit 21df82f mới chỉ
-- nới enum ở tầng Zod (ứng dụng) nên POST /posts qua validate, nhưng INSERT vào DB vi phạm CHECK
-- → lỗi 500, tạo bài dùng skin Kéo co/Kamehameha/Bục thất bại (bài không lưu, F5 là mất).
-- Xoá constraint cũ (dò tên thật để chắc chắn) rồi thêm lại với đủ 6 giá trị.
DO $$
DECLARE
  cname text;
BEGIN
  SELECT conname INTO cname
  FROM pg_constraint
  WHERE conrelid = 'posts'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%chart_type%';
  IF cname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE posts DROP CONSTRAINT %I', cname);
  END IF;
END $$;

ALTER TABLE posts
  ADD CONSTRAINT posts_chart_type_check
  CHECK (chart_type IN ('bar','pie','head_to_head','tug','beam','podium'));
