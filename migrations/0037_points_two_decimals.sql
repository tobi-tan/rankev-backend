-- Điểm bài thi cần 2 chữ số thập phân (đề trắc nghiệm 40 câu × 0,25 điểm). numeric(4,1) làm tròn 0,25 → 0,3.
ALTER TABLE deck_questions ALTER COLUMN points TYPE numeric(6,2);
ALTER TABLE posts ALTER COLUMN passing_score TYPE numeric(6,2);
ALTER TABLE participations ALTER COLUMN score TYPE numeric(6,2);
ALTER TABLE presentation_sessions ALTER COLUMN avg_score TYPE numeric(6,2);
ALTER TABLE live_participants ALTER COLUMN score TYPE numeric(6,2);
