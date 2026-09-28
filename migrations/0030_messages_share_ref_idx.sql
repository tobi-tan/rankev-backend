-- 0030: đếm lượt chia sẻ qua tin nhắn cho thanh tương tác (count theo ref_id) — index riêng
-- cho tin kiểu 'share' để feed không phải quét toàn bảng messages.
CREATE INDEX IF NOT EXISTS messages_share_ref_idx ON messages (ref_id) WHERE kind = 'share';
