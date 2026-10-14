import { z } from 'zod';

/**
 * Ảnh/video đính kèm bài (Rankie · Path · Survey/Exam · Giải đấu) — lưu jsonb `posts.media`.
 * `focus` = điểm lấy nét người tạo chọn (% theo chiều ngang/dọc, 50/50 = giữa): ảnh luôn LẤP ĐẦY
 * khung trên feed (không viền đen), phần thừa bị cắt quanh điểm này. `w`/`h` = kích thước gốc
 * để vẽ khung đúng tỉ lệ ngay từ đầu (không nhảy chiều cao khi ảnh tải xong).
 */
export const mediaSchema = z.object({
  type: z.string().optional(),
  color: z.string().optional(),
  emoji: z.string().optional(),
  url: z.string().url().optional(),
  focus: z.object({ x: z.number().min(0).max(100), y: z.number().min(0).max(100) }).optional(),
  w: z.number().int().positive().max(20000).optional(),
  h: z.number().int().positive().max(20000).optional(),
});
