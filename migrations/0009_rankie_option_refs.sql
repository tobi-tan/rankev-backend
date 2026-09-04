-- Rankie option có thể tham chiếu một thực thể Rankev (bài viết / user / comment)
-- thay vì chỉ là text. Polymorphic (ref_type + ref_id), không FK vì trỏ nhiều bảng.
ALTER TABLE rankie_options
  ADD COLUMN IF NOT EXISTS ref_type text,
  ADD COLUMN IF NOT EXISTS ref_id   text;
