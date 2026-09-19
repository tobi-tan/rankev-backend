-- 0025: thêm skin 'hh_classic' (lá cờ VS kiểu cổ điển) vào cột chart_type.
-- Đối đầu nay có 2 kiểu banner: 'head_to_head' (Cờ lửa) và 'hh_classic' (Cờ cổ điển).
-- Constraint hiện chưa nhận 'hh_classic' → INSERT/UPDATE sẽ lỗi. Nới constraint (dò tên thật).
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
  CHECK (chart_type IN ('bar','pie','head_to_head','hh_classic','tug','beam','podium'));
