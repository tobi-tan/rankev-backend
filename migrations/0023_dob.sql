-- Ngày sinh (thay cho chọn khoảng tuổi). Vẫn theo mô hình ẩn/công khai như demographics.
ALTER TABLE users ADD COLUMN IF NOT EXISTS date_of_birth date;
