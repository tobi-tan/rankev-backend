import { z } from 'zod';

const contestantSchema = z.object({
  name: z.string().min(1).max(80),
  emoji: z.string().max(16).optional(),
  color: z.string().max(32).optional(),
  imageUrl: z.string().url().optional(),
  refType: z.enum(['post', 'user', 'comment']).optional(),
  refId: z.string().max(64).optional(),
});

export const createTournamentSchema = z.object({
  title: z.string().min(1).max(200),
  category: z.string().max(80).optional(),
  caption: z.string().max(2000).optional(),
  media: z.object({ type: z.string().optional(), color: z.string().optional(), emoji: z.string().optional(), url: z.string().url().optional() }).optional(),
  // Thời gian bình chọn mỗi vòng (giờ kể từ khi ván mở). null/absent = vô hạn.
  closesInHours: z.number().int().min(1).max(8760).nullable().optional(),
  allowGuestPresent: z.boolean().optional(),
  // Bảng đấu đi tiếp theo: 'vote' = theo phiếu bình chọn (mặc định);
  // 'result' = theo KẾT QUẢ THẬT do chủ giải nhập (giải dự đoán kiểu World Cup).
  advanceMode: z.enum(['vote', 'result']).optional(),
  contestants: z.array(contestantSchema).min(2, 'Cần ít nhất 2 đối thủ').max(32),
});

// Chủ giải nhập kết quả thật của một trận (giải dự đoán). winner = 'a' | 'b'.
export const setMatchResultSchema = z.object({
  winner: z.enum(['a', 'b']),
});

// Chủ giải hẹn lịch một trận: giờ mở + giờ đóng bình chọn (ISO) | null. Gửi field nào
// thì cập nhật field đó (undefined = giữ nguyên).
export const setMatchScheduleSchema = z.object({
  opensAt: z.coerce.date().nullable().optional(),
  closesAt: z.coerce.date().nullable().optional(),
});
