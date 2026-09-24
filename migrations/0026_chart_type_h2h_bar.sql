-- 0026: thêm skin 'h2h_bar' (thanh đối đầu ngang) vào cột chart_type.
-- Đối đầu cho chọn đầy đủ: head_to_head (Cờ lửa), hh_classic (Cờ cổ điển), h2h_bar
-- (Thanh ngang), tug (Kéo co), beam (Kamehameha). Nới CHECK để nhận 'h2h_bar'.
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
  CHECK (chart_type IN ('bar','pie','head_to_head','hh_classic','h2h_bar','tug','beam','podium'));
