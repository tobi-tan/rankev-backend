-- 0031: dọn EMOJI GIỮ CHỖ đã lỡ lưu. Web tự gán emoji (🎯 🎨 ⚙️ 💚…) khi thêm lựa chọn / đấu thủ /
-- kết quả, và vẫn gửi kèm lên server dù người tạo đã chọn ẢNH → chỗ nào đọc emoji sẽ hiện emoji lạ
-- thay cho ảnh. Quy tắc từ nay: đã có ảnh thì không có emoji (service đã chặn khi ghi mới).

UPDATE rankie_options SET emoji = NULL WHERE emoji IS NOT NULL AND coalesce(image_url, '') <> '';
UPDATE path_endings  SET emoji = NULL WHERE emoji IS NOT NULL AND coalesce(image_url, '') <> '';
UPDATE path_answers  SET emoji = NULL WHERE emoji IS NOT NULL AND coalesce(image_url, '') <> '';
UPDATE deck_options  SET emoji = NULL WHERE emoji IS NOT NULL AND coalesce(image_url, '') <> '';

-- Đấu thủ của giải (lưu dạng JSON trong từng trận + nhà vô địch).
UPDATE tournament_matches SET a_ref = a_ref - 'emoji'
  WHERE a_ref ? 'emoji' AND coalesce(a_ref->>'imageUrl', '') <> '';
UPDATE tournament_matches SET b_ref = b_ref - 'emoji'
  WHERE b_ref ? 'emoji' AND coalesce(b_ref->>'imageUrl', '') <> '';
UPDATE tournament_matches SET winner_ref = winner_ref - 'emoji'
  WHERE winner_ref ? 'emoji' AND coalesce(winner_ref->>'imageUrl', '') <> '';
UPDATE tournaments SET champion_ref = champion_ref - 'emoji'
  WHERE champion_ref ? 'emoji' AND coalesce(champion_ref->>'imageUrl', '') <> '';
