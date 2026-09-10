import { and, desc, eq } from 'drizzle-orm';
import { db } from '../../db';
import { saves } from '../../db/schema';

export type SaveRefType = 'post' | 'user' | 'comment';

export interface SaveItem {
  refType: SaveRefType;
  refId: string;
  preview: unknown;
  createdAt: string;
}

/** Thêm một mục vào kho "Đã lưu" (idempotent — cập nhật preview nếu đã có). */
export async function addSave(userId: string, refType: SaveRefType, refId: string, preview?: unknown): Promise<{ saved: true }> {
  await db
    .insert(saves)
    .values({ userId, refType, refId, preview: preview ?? null })
    .onConflictDoUpdate({ target: [saves.userId, saves.refType, saves.refId], set: { preview: preview ?? null } });
  return { saved: true };
}

/** Bỏ một mục khỏi kho. */
export async function removeSave(userId: string, refType: SaveRefType, refId: string): Promise<{ saved: false }> {
  await db.delete(saves).where(and(eq(saves.userId, userId), eq(saves.refType, refType), eq(saves.refId, refId)));
  return { saved: false };
}

/** Toàn bộ mục đã lưu của người dùng (mới nhất trước). Client tự nhóm theo loại + lọc. */
export async function listSaves(userId: string): Promise<SaveItem[]> {
  const rows = await db
    .select({ refType: saves.refType, refId: saves.refId, preview: saves.preview, createdAt: saves.createdAt })
    .from(saves)
    .where(eq(saves.userId, userId))
    .orderBy(desc(saves.createdAt));
  return rows.map((r) => ({ refType: r.refType as SaveRefType, refId: r.refId, preview: r.preview, createdAt: r.createdAt.toISOString() }));
}
