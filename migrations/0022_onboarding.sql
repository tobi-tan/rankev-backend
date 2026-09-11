-- Phiếu onboarding (theme/loại nội dung/đánh giá + độ tuổi/giới tính/nghề) để hiện
-- kết quả cộng đồng ngay trong onboarding. 1 hàng = 1 lựa chọn của 1 user cho 1 khoá.
CREATE TABLE IF NOT EXISTS onboarding_votes (
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  vote_key   text NOT NULL,          -- 'theme' | 'type' | 'rating' | 'age' | 'gender' | 'occupation'
  choice     text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, vote_key, choice)
);
CREATE INDEX IF NOT EXISTS onboarding_votes_key_idx ON onboarding_votes (vote_key, choice);

-- Nhân khẩu học lưu trên hồ sơ (để hiện/ẩn ở trang cá nhân). Ẩn = riêng tư (không hiện
-- công khai) nhưng VẪN lưu & tính vào thống kê chung. demographics_public: {age,gender,occupation}=bool.
ALTER TABLE users ADD COLUMN IF NOT EXISTS age_range text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS gender text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS occupation text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS demographics_public jsonb NOT NULL DEFAULT '{}'::jsonb;
