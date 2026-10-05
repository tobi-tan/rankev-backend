import { eq } from 'drizzle-orm';
import { randomBytes } from 'node:crypto';
import { db, pool } from './index';
import { users } from './schema';
import { hashPassword } from '../lib/password';
import { createRankie } from '../modules/posts/posts.service';
import { createPath } from '../modules/paths/paths.service';
import { createDeck } from '../modules/decks/decks.service';
import { castVote } from '../modules/rankies/rankies.service';
import { completePath } from '../modules/paths/paths.service';
import { submitDeck } from '../modules/decks/decks.service';
import { createTournament, getTournament, setMatchSchedule } from '../modules/tournaments/tournaments.service';
import { createRankieSchema } from '../modules/posts/posts.schemas';
import { createPathSchema } from '../modules/paths/paths.schemas';
import { createDeckSchema } from '../modules/decks/decks.schemas';
import { createTournamentSchema } from '../modules/tournaments/tournaments.schemas';

/**
 * BỘ BÀI THỬ đủ mọi dạng nội dung, để tự test trên app (kể cả bản thật):
 *   Rankie thường · Rankie không giới hạn · Đối đầu · Giải đấu (8 đội, đã lên sóng vòng 1)
 *   · Path chạm vào ảnh (điểm chạm trên ảnh cảnh) · Path chữ · Exam · Survey
 * Tác giả: tài khoản "Rankev Test" (@rankev_test) + 3 người bình chọn ảo để biểu đồ có số liệu.
 * Các tài khoản này có MẬT KHẨU NGẪU NHIÊN, không in ra — không ai đăng nhập được, chỉ để làm
 * tác giả/người bình chọn. Bạn test bằng tài khoản của chính mình.
 *
 * Idempotent: đã có @rankev_test thì bỏ qua (thêm --force để tạo thêm một bộ mới).
 * Chạy:  npm run db:seed:test            (DB trong .env)
 *        DATABASE_URL=... DATABASE_SSL=true npx tsx src/db/seed-test-content.ts   (DB khác, vd Neon)
 */
const TW = (code: string) => `https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/svg/${code}.svg`;
const PIC = (seed: string, w = 800, h = 500) => `https://picsum.photos/seed/${seed}/${w}/${h}`;

async function ensureUser(email: string, handle: string, name: string, avatarEmoji: string) {
  const [existing] = await db.select().from(users).where(eq(users.email, email));
  if (existing) return existing;
  const [created] = await db
    .insert(users)
    .values({ email, handle, name, avatarEmoji, verified: false, passwordHash: await hashPassword(randomBytes(24).toString('hex')) })
    .returning();
  return created;
}

async function main() {
  const force = process.argv.includes('--force');
  const [already] = await db.select({ id: users.id }).from(users).where(eq(users.email, 'rankev-test@rankev.app'));
  if (already && !force) {
    console.log('Bộ bài thử đã có (tài khoản @rankev_test tồn tại) — bỏ qua. Thêm --force để tạo thêm một bộ.');
    await pool.end();
    return;
  }

  const author = await ensureUser('rankev-test@rankev.app', 'rankev_test', 'Rankev Test', '🧪');
  const voters = await Promise.all([1, 2, 3].map((i) => ensureUser(`rankev-voter${i}@rankev.app`, `rankev_voter${i}`, `Người thử ${i}`, ['🐣', '🦉', '🐙'][i - 1])));
  const tag = force ? ` #${Date.now().toString(36).slice(-4)}` : '';

  // 1) Rankie thường (chọn 1, biểu đồ cột) — lựa chọn có ảnh
  const normal = await createRankie(author.id, createRankieSchema.parse({
    type: 'rankie', title: `Mùa nào đẹp nhất ở Việt Nam?${tag}`, caption: 'Chọn 1 mùa bạn thích nhất nhé #dulich #vietnam',
    votingType: 'single', chartType: 'bar', live: true, sponsored: false, allowGuestPresent: true,
    options: [
      { label: 'Mùa xuân', imageUrl: TW('1f338') }, { label: 'Mùa hè', imageUrl: TW('2600') },
      { label: 'Mùa thu', imageUrl: TW('1f341') }, { label: 'Mùa đông', imageUrl: TW('2744') },
    ],
  }));
  // 2) Rankie không giới hạn (bấm bao nhiêu lần cũng được)
  const unlimited = await createRankie(author.id, createRankieSchema.parse({
    type: 'rankie', title: `Cổ vũ đội bạn thích — bấm thoải mái! 🔥${tag}`, caption: 'Bình chọn KHÔNG GIỚI HẠN: mỗi lần chạm là một lượt cổ vũ #thethao',
    votingType: 'unlimited', chartType: 'bar', live: true, sponsored: false, allowGuestPresent: true,
    options: [{ label: 'Đội Đỏ', imageUrl: TW('1f534') }, { label: 'Đội Xanh', imageUrl: TW('1f535') }, { label: 'Đội Vàng', imageUrl: TW('1f7e1') }],
  }));
  // 3) Đối đầu (1 chọi 1, lá cờ VS)
  const versus = await createRankie(author.id, createRankieSchema.parse({
    type: 'rankie', title: `Mèo hay Chó?${tag}`, caption: 'Cuộc chiến muôn thuở 🐾 #thucung',
    votingType: 'single', chartType: 'head_to_head', live: true, sponsored: false, allowGuestPresent: true,
    options: [{ label: 'Mèo', imageUrl: TW('1f431') }, { label: 'Chó', imageUrl: TW('1f436') }],
  }));

  // 4) Giải đấu 8 đội — vòng 1 LÊN SÓNG ngay (vote được luôn), đóng sau 7 ngày
  const fruits: [string, string][] = [['Táo', '1f34e'], ['Chuối', '1f34c'], ['Dưa hấu', '1f349'], ['Nho', '1f347'], ['Dâu', '1f353'], ['Xoài', '1f96d'], ['Dứa', '1f34d'], ['Đào', '1f351']];
  const tour = await createTournament(author.id, createTournamentSchema.parse({
    title: `Giải Trái Cây Ngon Nhất${tag}`, caption: '8 loại trái cây, 3 vòng đấu loại — trái nào vô địch? #amthuc',
    tags: ['amthuc'], closesInHours: 168, allowGuestPresent: true, advanceMode: 'vote',
    media: { type: 'image', url: PIC('rankev-cover-tournament', 800, 450) },
    contestants: fruits.map(([name, code]) => ({ name, imageUrl: TW(code) })),
  }));
  const now = new Date();
  const week = new Date(Date.now() + 7 * 24 * 3600 * 1000);
  const t0 = await getTournament(tour.id, author.id);
  for (const m of t0.matches.filter((x: { round: number; rankiePostId: string | null }) => x.round === 0 && x.rankiePostId)) {
    await setMatchSchedule(tour.id, author.id, m.round, m.position, { opensAt: now, closesAt: week });
  }

  // 5) Path chạm vào ảnh — mỗi câu là một ẢNH CẢNH, lựa chọn là điểm chạm trên ảnh
  const pathImg = await createPath(author.id, createPathSchema.parse({
    type: 'path', title: `Hành trình leo núi — chạm vào ảnh để chọn đường${tag}`,
    caption: 'Path tương tác bằng hình: chạm thẳng vào chỗ bạn muốn đi #dulich',
    revealMode: 'names', hideEndingCount: false, allowGuestPresent: true,
    questions: [
      { key: 'q1', isEntry: true, text: 'Trước mặt là ngọn núi. Bạn đi đâu?', sceneImageUrl: PIC('rankev-forest'),
        answers: [
          { label: 'Lối mòn lên đỉnh', hotspotX: 76, hotspotY: 42, targetType: 'question', targetKey: 'q2' },
          { label: 'Đồng cỏ bên trái', hotspotX: 18, hotspotY: 58, targetType: 'question', targetKey: 'q3' },
          { label: 'Đường đất phía trước', hotspotX: 44, hotspotY: 86, targetType: 'question', targetKey: 'q3' },
        ] },
      { key: 'q2', text: 'Bạn lạc vào rừng thông. Nắng xuyên qua tán lá…', sceneImageUrl: PIC('rankev-scene-2'),
        answers: [
          { label: 'Đi theo vệt nắng', hotspotX: 56, hotspotY: 74, targetType: 'ending', targetKey: 'Nhà thám hiểm' },
          { label: 'Nghỉ ở gốc cây lớn', hotspotX: 88, hotspotY: 62, targetType: 'ending', targetKey: 'Người ẩn dật' },
        ] },
      { key: 'q3', text: 'Một hồ nước mùa thu hiện ra bên con đường đất.', sceneImageUrl: PIC('rankev-room'),
        answers: [
          { label: 'Ngắm mặt hồ', hotspotX: 44, hotspotY: 70, targetType: 'ending', targetKey: 'Nghệ sĩ' },
          { label: 'Đi tiếp con đường', hotspotX: 80, hotspotY: 76, targetType: 'ending', targetKey: 'Lữ khách' },
        ] },
    ],
    endings: [
      { name: 'Nhà thám hiểm', imageUrl: PIC('rankev-scene-2', 400, 400), comment: 'Bạn luôn muốn biết phía trước có gì.' },
      { name: 'Người ẩn dật', imageUrl: PIC('rankev-city', 400, 400), comment: 'Bạn tìm thấy bình yên trong im lặng.' },
      { name: 'Nghệ sĩ', imageUrl: PIC('rankev-room', 400, 400), comment: 'Bạn nhìn thấy cái đẹp ở mọi nơi.' },
      { name: 'Lữ khách', imageUrl: PIC('rankev-forest', 400, 400), comment: 'Con đường mới là đích đến.' },
    ],
  }));

  // 6) Path chữ — rẽ nhánh nhiều câu, kết cục có emoji
  const pathText = await createPath(author.id, createPathSchema.parse({
    type: 'path', title: `Bạn hợp làm nghề gì?${tag}`, caption: 'Trả lời 2–3 câu để biết nghề hợp với bạn #nghenghiep',
    revealMode: 'hidden', hideEndingCount: false, allowGuestPresent: true,
    questions: [
      { key: 'q1', isEntry: true, text: 'Cuối tuần bạn thích làm gì nhất?',
        answers: [
          { label: 'Tự làm đồ handmade', targetType: 'question', targetKey: 'q2' },
          { label: 'Đọc sách, tìm hiểu', targetType: 'question', targetKey: 'q3' },
          { label: 'Gặp gỡ bạn bè', targetType: 'ending', targetKey: 'Người kết nối' },
        ] },
      { key: 'q2', text: 'Bạn thích làm một mình hay theo nhóm?',
        answers: [
          { label: 'Một mình, tập trung', targetType: 'ending', targetKey: 'Nghệ nhân' },
          { label: 'Theo nhóm, chia việc', targetType: 'ending', targetKey: 'Trưởng nhóm' },
        ] },
      { key: 'q3', text: 'Khi gặp vấn đề khó, bạn sẽ…',
        answers: [
          { label: 'Phân tích từng bước', targetType: 'ending', targetKey: 'Nhà phân tích' },
          { label: 'Thử nhiều cách cho tới khi được', targetType: 'ending', targetKey: 'Nhà sáng chế' },
        ] },
    ],
    endings: [
      { name: 'Nghệ nhân', emoji: '🎨', comment: 'Đôi tay khéo léo, tỉ mỉ.' },
      { name: 'Trưởng nhóm', emoji: '🧭', comment: 'Bạn kéo mọi người về cùng hướng.' },
      { name: 'Nhà phân tích', emoji: '📊', comment: 'Dữ liệu là bạn thân của bạn.' },
      { name: 'Nhà sáng chế', emoji: '💡', comment: 'Bạn không ngại thử sai.' },
      { name: 'Người kết nối', emoji: '🤝', comment: 'Bạn giỏi gắn kết mọi người.' },
    ],
  }));

  // 7) Exam — 5 câu, có câu chọn nhiều đáp án, tính điểm, ngưỡng đạt, giới hạn thời gian
  const exam = await createDeck(author.id, createDeckSchema.parse({
    type: 'deck', deckMode: 'exam', title: `Đố vui Việt Nam — 5 câu${tag}`, caption: 'Đạt từ 6/10 điểm. Có câu chọn NHIỀU đáp án! #dovui',
    passingScore: 6, examDurationMinutes: 5, allowGuestPresent: true,
    questions: [
      { text: 'Thủ đô của Việt Nam?', votingType: 'single', points: 2, options: [{ label: 'Hà Nội', correct: true }, { label: 'TP. Hồ Chí Minh' }, { label: 'Đà Nẵng' }] },
      { text: 'Sông nào chảy qua Hà Nội?', votingType: 'single', points: 2, options: [{ label: 'Sông Hồng', correct: true }, { label: 'Sông Hương' }, { label: 'Sông Sài Gòn' }] },
      { text: 'Những món nào là đặc sản Huế? (chọn nhiều)', votingType: 'multiple', points: 2, options: [{ label: 'Bún bò', correct: true }, { label: 'Cơm hến', correct: true }, { label: 'Phở cuốn' }] },
      { text: 'Vịnh Hạ Long thuộc tỉnh nào?', votingType: 'single', points: 2, options: [{ label: 'Quảng Ninh', correct: true }, { label: 'Hải Phòng' }, { label: 'Thanh Hóa' }] },
      { text: 'Đỉnh núi cao nhất Việt Nam?', votingType: 'single', points: 2, options: [{ label: 'Fansipan', correct: true }, { label: 'Bạch Mã' }, { label: 'Langbiang' }] },
    ],
  }));

  // 8) Survey — khảo sát ngắn
  const survey = await createDeck(author.id, createDeckSchema.parse({
    type: 'deck', deckMode: 'survey', title: `Thói quen dùng điện thoại của bạn${tag}`, caption: 'Khảo sát 3 câu, ẩn danh #khaosat', allowGuestPresent: true,
    questions: [
      { text: 'Mỗi ngày bạn dùng điện thoại bao lâu?', votingType: 'single', options: [{ label: 'Dưới 2 giờ' }, { label: '2–5 giờ' }, { label: 'Trên 5 giờ' }] },
      { text: 'Bạn dùng điện thoại nhiều nhất để làm gì? (chọn nhiều)', votingType: 'multiple', options: [{ label: 'Mạng xã hội' }, { label: 'Học / làm việc' }, { label: 'Chơi game' }, { label: 'Xem phim' }] },
      { text: 'Bạn có muốn giảm thời gian dùng không?', votingType: 'single', options: [{ label: 'Có' }, { label: 'Không' }, { label: 'Chưa nghĩ tới' }] },
    ],
  }));

  // Người thử ảo tham gia → biểu đồ, phân bố, bạn đồng hành có số liệu
  const pick = (post: { options: { id: string }[] }, i: number) => [post.options[i % post.options.length].id];
  for (const [i, v] of voters.entries()) {
    await castVote(v.id, normal.id, { optionIds: pick(normal, i === 2 ? 2 : i) });
    for (let k = 0; k < 3 + i * 2; k++) await castVote(v.id, unlimited.id, { optionIds: pick(unlimited, i) });
    await castVote(v.id, versus.id, { optionIds: pick(versus, i === 1 ? 1 : 0) });
    await completePath(v.id, pathImg.id, { endingName: ['Nhà thám hiểm', 'Nghệ sĩ', 'Nhà thám hiểm'][i] } as never);
    await completePath(v.id, pathText.id, { endingName: ['Trưởng nhóm', 'Nhà phân tích', 'Người kết nối'][i] } as never);
    const ans = Object.fromEntries(exam.questions.map((q, qi) => {
      const right = q.options.filter((o) => (o as { correct?: boolean }).correct !== false).map((o) => o.id);
      return [q.id, qi < 3 + i - 1 ? right : [q.options[q.options.length - 1].id]];
    }));
    await submitDeck(v.id, exam.id, { answers: ans } as never);
    await submitDeck(v.id, survey.id, { answers: Object.fromEntries(survey.questions.map((q, qi) => [q.id, [q.options[(i + qi) % q.options.length].id]])) } as never);
  }
  const t1 = await getTournament(tour.id, author.id);
  for (const [i, v] of voters.entries()) {
    for (const m of t1.matches.filter((x: { round: number; rankiePostId: string | null }) => x.round === 0 && x.rankiePostId)) {
      const r = await import('../modules/posts/posts.service').then((s) => s.getRankieById(m.rankiePostId as string, v.id));
      await castVote(v.id, r.id, { optionIds: [r.options[(m.position + i) % 2 === 0 ? 0 : 1].id] });
    }
  }

  console.log('✅ Đã tạo bộ bài thử (tác giả @rankev_test):');
  for (const [k, p] of Object.entries({ 'Rankie thường': normal, 'Rankie không giới hạn': unlimited, 'Đối đầu': versus, 'Giải đấu (8 đội, vòng 1 đã lên sóng)': tour, 'Path chạm vào ảnh': pathImg, 'Path chữ': pathText, 'Exam': exam, 'Survey': survey })) {
    console.log(`  • ${k}: ${(p as { title: string }).title}  (id ${(p as { id: string }).id})`);
  }
  await pool.end();
}

main().catch(async (e) => {
  console.error(e);
  await pool.end().catch(() => {});
  process.exit(1);
});
