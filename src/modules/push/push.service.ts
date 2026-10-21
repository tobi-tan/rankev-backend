import webpush from 'web-push';
import { eq, inArray } from 'drizzle-orm';
import { db } from '../../db';
import { pushSubscriptions, users } from '../../db/schema';
import { env } from '../../env';

/**
 * Thông báo đẩy qua Web Push (chuẩn VAPID — không cần Firebase). Chạy khi có đủ
 * VAPID_PUBLIC_KEY + VAPID_PRIVATE_KEY; thiếu = tắt (mọi hàm gửi thành no-op).
 * Tạo cặp khoá: `npx web-push generate-vapid-keys`.
 */
const enabled = !!(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY);
if (enabled) webpush.setVapidDetails(env.VAPID_SUBJECT, env.VAPID_PUBLIC_KEY!, env.VAPID_PRIVATE_KEY!);

export function pushConfig() {
  return { enabled, publicKey: enabled ? env.VAPID_PUBLIC_KEY! : null };
}

export async function subscribe(userId: string, sub: { endpoint: string; keys: { p256dh: string; auth: string } }, userAgent?: string) {
  await db
    .insert(pushSubscriptions)
    .values({ userId, kind: 'web', endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth, userAgent: userAgent?.slice(0, 300) ?? null })
    .onConflictDoUpdate({
      target: pushSubscriptions.endpoint,
      set: { userId, p256dh: sub.keys.p256dh, auth: sub.keys.auth, userAgent: userAgent?.slice(0, 300) ?? null },
    });
}

export async function unsubscribe(userId: string, endpoint: string) {
  const rows = await db.select({ id: pushSubscriptions.id, userId: pushSubscriptions.userId }).from(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint));
  for (const r of rows) if (r.userId === userId) await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, r.id));
}

export interface PushMessage {
  title: string;
  body?: string;
  /** đường dẫn trong app khi bấm vào thông báo, vd /post/<id> */
  url?: string;
  /** cùng tag → thông báo mới thay thế cái cũ (vd cùng một hội thoại) */
  tag?: string;
}

export async function sendPush(userIds: string[], msg: PushMessage): Promise<number> {
  const ids = [...new Set(userIds)].filter(Boolean);
  if (!enabled || ids.length === 0) return 0;
  const subs = await db.select().from(pushSubscriptions).where(inArray(pushSubscriptions.userId, ids));
  const payload = JSON.stringify({ title: msg.title, body: msg.body?.slice(0, 180) ?? '', url: msg.url ?? '/', tag: msg.tag });
  let sent = 0;
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh ?? '', auth: s.auth ?? '' } }, payload, { TTL: 60 * 60 * 24 });
        sent++;
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        // thiết bị đã huỷ đăng ký / hết hạn → xoá
        if (code === 404 || code === 410) await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, s.id));
      }
    }),
  );
  return sent;
}

/** Gửi nền — không bao giờ làm hỏng/chậm request gốc. */
export function pushLater(userIds: string[], msg: PushMessage | ((names: Map<string, string>) => PushMessage), actorId?: string | null): void {
  if (!enabled || userIds.length === 0) return;
  void (async () => {
    let m: PushMessage;
    if (typeof msg === 'function') {
      const names = new Map<string, string>();
      if (actorId) {
        const [u] = await db.select({ id: users.id, name: users.name, handle: users.handle }).from(users).where(eq(users.id, actorId));
        if (u) names.set(u.id, u.name || '@' + u.handle.replace(/^@/, ''));
      }
      m = msg(names);
    } else m = msg;
    await sendPush(userIds, m);
  })().catch(() => {});
}
