import { eq } from 'drizzle-orm';
import { db, pool } from './index';
import { users } from './schema';
import { hashPassword } from '../lib/password';
import { createRankie } from '../modules/posts/posts.service';
import { createTournament } from '../modules/tournaments/tournaments.service';

/**
 * Bộ dữ liệu TEST đầy đủ để thử nghiệm UI/UX (khác với db:seed tối giản):
 *  - vài user THẬT (đăng nhập được) để thử NHẮN TIN với nhau
 *  - vài Rankie có HASHTAG để thử feed/lọc theo tag
 *  - một GIẢI ĐẤU 3 VÒNG (8 đấu thủ, có ảnh) để thử bình chọn + bảng nhánh
 *
 * Idempotent: bỏ qua nếu đã seed (dựa trên user 'an@rankev.app').
 * Chạy:  npm run db:seed:demo
 */
const DEMO_USERS = [
  { email: 'an@rankev.app', handle: 'an', name: 'An Nguyễn', avatarEmoji: '🦊', pass: 'demo1234' },
  { email: 'binh@rankev.app', handle: 'binh', name: 'Bình Trần', avatarEmoji: '🐼', pass: 'demo1234' },
  { email: 'cuong@rankev.app', handle: 'cuong', name: 'Cường Lê', avatarEmoji: '🐯', pass: 'demo1234' },
];

async function ensureUser(u: (typeof DEMO_USERS)[number]) {
  const [existing] = await db.select().from(users).where(eq(users.email, u.email));
  if (existing) return existing;
  const [created] = await db
    .insert(users)
    .values({ email: u.email, handle: u.handle, name: u.name, passwordHash: await hashPassword(u.pass), avatarEmoji: u.avatarEmoji, verified: true })
    .returning();
  return created;
}

async function main() {
  const [seeded] = await db.select({ id: users.id }).from(users).where(eq(users.email, 'an@rankev.app'));
  if (seeded) {
    console.log('Đã seed demo trước đó (user an@rankev.app tồn tại) — bỏ qua.');
    await pool.end();
    return;
  }

  const [an, binh, cuong] = await Promise.all(DEMO_USERS.map(ensureUser));
  console.log('Tạo 3 user demo (đăng nhập: an@rankev.app / binh@rankev.app / cuong@rankev.app, mật khẩu demo1234)');

  // Rankie có hashtag — để thử feed + lọc theo tag.
  await createRankie(an.id, {
    type: 'rankie', title: 'Đội nào vô địch mùa này? ⚽', tags: ['thethao', 'bongda'],
    votingType: 'single', chartType: 'bar', live: true, sponsored: false,
    options: [{ label: 'Đội Đỏ', emoji: '🔴' }, { label: 'Đội Xanh', emoji: '🔵' }, { label: 'Đội Vàng', emoji: '🟡' }],
  });
  await createRankie(binh.id, {
    type: 'rankie', title: 'Bài hát hay nhất năm? 🎵', tags: ['amnhac', 'vpop'],
    votingType: 'multiple', chartType: 'bar', live: true, sponsored: false,
    options: [{ label: 'Bài A', emoji: '🎤' }, { label: 'Bài B', emoji: '🎸' }, { label: 'Bài C', emoji: '🎹' }, { label: 'Bài D', emoji: '🥁' }],
  });
  await createRankie(cuong.id, {
    type: 'rankie', title: 'Món ăn sáng quốc dân? 🍜', tags: ['amthuc', 'ansang'],
    votingType: 'single', chartType: 'bar', live: true, sponsored: false,
    options: [{ label: 'Phở', emoji: '🍜' }, { label: 'Bánh mì', emoji: '🥖' }, { label: 'Xôi', emoji: '🍚' }],
  });
  console.log('Tạo 3 Rankie có hashtag (#thethao #amnhac #amthuc …)');

  // Giải đấu 3 VÒNG (8 đấu thủ, 4 người đầu có ảnh) — thử bình chọn + bảng nhánh.
  const img = 'https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/1f3c6.png';
  const names = ['Rồng Vàng', 'Hổ Mang', 'Đại Bàng', 'Sư Tử', 'Cá Mập', 'Báo Đốm', 'Sói Xám', 'Gấu Bắc'];
  const emos = ['🐉', '🐍', '🦅', '🦁', '🦈', '🐆', '🐺', '🐻'];
  const t = await createTournament(an.id, {
    title: 'Giải Muông Thú 2026',
    tags: ['thethao', 'esports'],
    caption: 'Loài nào mạnh nhất? 8 đấu thủ, 3 vòng đấu loại trực tiếp.',
    closesInHours: 72,
    allowGuestPresent: true,
    advanceMode: 'vote',
    contestants: names.map((n, i) => ({ name: n, emoji: emos[i], ...(i < 4 ? { imageUrl: img } : {}) })),
  });
  console.log(`Tạo giải đấu 3 vòng: "${t.title}" (id ${t.id})`);

  console.log('\n✅ Xong. Đăng nhập bất kỳ user demo để thử nhắn tin cho nhau, vote giải đấu, lọc feed theo hashtag.');
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
