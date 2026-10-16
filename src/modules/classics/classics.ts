import { and, eq, sql } from 'drizzle-orm';
import { db } from '../../db';
import { posts, rankieOptions, series, users } from '../../db/schema';
import { CLASSIC_IMAGES } from './classics-images';
import { createRankie } from '../posts/posts.service';
import { createRankieSchema } from '../posts/posts.schemas';
import { createPath } from '../paths/paths.service';
import { createPathSchema } from '../paths/paths.schemas';
import { createDeck } from '../decks/decks.service';
import { createDeckSchema } from '../decks/decks.schemas';

/**
 * NỘI DUNG KINH ĐIỂN của tài khoản chính thức @rankev — để lúc còn ít người dùng / ít bài mới,
 * ai vào cũng có thứ để bình chọn, tranh luận. KHÔNG có phiếu giả: mọi con số do người thật bình chọn.
 *  - 16 trận ĐỐI ĐẦU, mỗi trận là MỘT BÀI RIÊNG gắn #kinhdien (không gom series — trận nào hot tự
 *    nổi lên feed / tìm kiếm theo tương tác của chính nó; #kinhdien là nơi gom nhẹ để khám phá)
 *  - Path / Survey / Exam kinh điển
 * Chạy khi máy chủ khởi động (idempotent: bài nào đã có — theo tiêu đề của @rankev — thì bỏ qua),
 * nên muốn thêm trận mới chỉ cần thêm vào danh sách dưới đây rồi deploy.
 * Ảnh: Twemoji (CC-BY 4.0) qua cdnjs.
 */
const TW = (code: string) => `https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/svg/${code}.svg`;
const OFFICIAL = { email: 'official@rankev.local', handle: 'rankev', name: 'Rankev', avatarUrl: 'https://rankev-web.vercel.app/icon-192.png' };
// Tên series cũ (2026-10-14) — đã bỏ, dọn đi khi khởi động (bài/phiếu/bình luận giữ nguyên).
export const LEGACY_CLASSICS_SERIES = 'Đối đầu kinh điển ⚔️';

type Side = [label: string, twemoji: string];
const MATCHUPS: { title: string; caption: string; tags: string[]; a: Side; b: Side }[] = [
  { title: 'Phở hay Bún chả?', caption: 'Cuộc chiến muôn thuở của ẩm thực Hà Nội. Bạn đứng về phía nào?', tags: ['kinhdien', 'amthuc'], a: ['Phở', '1f35c'], b: ['Bún chả', '1f962'] },
  { title: 'Messi hay Ronaldo?', caption: 'Hai thập kỷ, một câu hỏi chưa có hồi kết. Ai là GOAT?', tags: ['kinhdien', 'bongda'], a: ['Messi', '1f410'], b: ['Ronaldo', '1f680'] },
  { title: 'Mèo hay Chó?', caption: 'Hoàng thượng hay boss trung thành?', tags: ['kinhdien', 'thucung'], a: ['Mèo', '1f431'], b: ['Chó', '1f436'] },
  { title: 'Cà phê sữa đá hay Trà sữa?', caption: 'Đồ uống quốc dân của bạn là gì?', tags: ['kinhdien', 'douong'], a: ['Cà phê sữa đá', '2615'], b: ['Trà sữa', '1f9cb'] },
  { title: 'iPhone hay Android?', caption: 'Phe táo khuyết hay phe robot xanh?', tags: ['kinhdien', 'congnghe'], a: ['iPhone', '1f34e'], b: ['Android', '1f916'] },
  { title: 'Hà Nội hay Sài Gòn?', caption: 'Nếu chỉ được sống ở một nơi, bạn chọn đâu?', tags: ['kinhdien', 'dulich'], a: ['Hà Nội', '1f3ef'], b: ['Sài Gòn', '1f306'] },
  { title: 'Biển hay Núi?', caption: 'Kỳ nghỉ hoàn hảo của bạn có sóng hay có mây?', tags: ['kinhdien', 'dulich'], a: ['Biển', '1f3d6'], b: ['Núi', '1f3d4'] },
  { title: 'Dậy sớm hay Thức khuya?', caption: 'Chim sớm hay cú đêm — bạn làm việc hiệu quả nhất lúc nào?', tags: ['kinhdien', 'loisong'], a: ['Dậy sớm', '1f305'], b: ['Thức khuya', '1f319'] },
  { title: 'Bánh mì hay Xôi?', caption: 'Bữa sáng vội vàng trên đường đi làm: chọn món nào?', tags: ['kinhdien', 'amthuc'], a: ['Bánh mì', '1f956'], b: ['Xôi', '1f359'] },
  { title: 'Tom hay Jerry?', caption: 'Tuổi thơ của cả thế hệ — bạn luôn đứng về phe ai?', tags: ['kinhdien', 'hoathinh'], a: ['Tom', '1f63c'], b: ['Jerry', '1f42d'] },
  { title: 'Doraemon hay Conan?', caption: 'Bộ truyện tranh gắn liền với tuổi thơ bạn là…', tags: ['kinhdien', 'truyentranh'], a: ['Doraemon', '1f514'], b: ['Conan', '1f575'] },
  { title: 'Nhắn tin hay Gọi điện?', caption: 'Có chuyện cần nói, bạn sẽ…', tags: ['kinhdien', 'loisong'], a: ['Nhắn tin', '1f4ac'], b: ['Gọi điện', '1f4de'] },
  { title: 'Lên văn phòng hay Làm từ xa?', caption: 'Đi làm kiểu nào hiệu quả hơn?', tags: ['kinhdien', 'congviec'], a: ['Lên văn phòng', '1f3e2'], b: ['Làm từ xa', '1f3e0'] },
  { title: 'Tết về quê hay Tết đi du lịch?', caption: 'Kỳ nghỉ dài nhất năm, bạn dành cho đâu?', tags: ['kinhdien', 'tet'], a: ['Về quê', '1f9e7'], b: ['Đi du lịch', '2708'] },
  { title: 'Mì tôm trứng hay Mì tôm xúc xích?', caption: 'Câu hỏi quan trọng nhất của mọi buổi tối chạy deadline.', tags: ['kinhdien', 'amthuc'], a: ['Thêm trứng', '1f95a'], b: ['Thêm xúc xích', '1f32d'] },
  { title: 'Chơi game hay Xem phim?', caption: 'Tối rảnh rỗi, bạn mở gì đầu tiên?', tags: ['kinhdien', 'giaitri'], a: ['Chơi game', '1f3ae'], b: ['Xem phim', '1f3ac'] },
];

// Email đăng nhập của @rankev = env OFFICIAL_EMAIL (Gmail thương hiệu do chủ app giữ). Đặt env rồi
// khởi động lại → email được gắn vào @rankev; chủ app dùng "Quên mật khẩu" với email đó để đặt
// mật khẩu và đăng nhập đăng bài dưới tên Rankev (như Trang chính thức trên Facebook).
async function ensureOfficial(): Promise<string> {
  const want = (process.env.OFFICIAL_EMAIL || '').trim().toLowerCase();
  const [u] = await db.select({ id: users.id, email: users.email }).from(users).where(eq(users.handle, OFFICIAL.handle));
  if (u) {
    if (want && u.email !== want) {
      const [taken] = await db.select({ id: users.id }).from(users).where(eq(users.email, want));
      if (!taken) await db.update(users).set({ email: want, emailVerified: true }).where(eq(users.id, u.id));
      else if (taken.id !== u.id) console.warn('[classics] OFFICIAL_EMAIL đã thuộc một tài khoản khác — không gắn vào @rankev');
    }
    return u.id;
  }
  const [created] = await db.insert(users).values({
    email: want || OFFICIAL.email, handle: OFFICIAL.handle, name: OFFICIAL.name, avatarUrl: OFFICIAL.avatarUrl,
    bio: 'Tài khoản chính thức của Rankev · Đối đầu kinh điển, đố vui & khảo sát cho mọi người 🏆',
    verified: true, passwordHash: null, handleConfirmed: true, emailVerified: true,
  }).returning({ id: users.id });
  return created.id;
}

// Dòng ghi nguồn ảnh (bắt buộc với CC BY / CC BY-SA) ở cuối mô tả bài.
const CREDIT_MARK = '📷 Ảnh:';
function withCredit(caption: string, la: string, lb: string, img?: (typeof CLASSIC_IMAGES)[string]): string {
  if (!img) return caption;
  const c = (label: string, i: { artist: string; license: string }) => `${label} — ${i.artist || 'không rõ tác giả'} (${i.license})`;
  return `${caption}\n\n${CREDIT_MARK} ${c(la, img.a)}; ${c(lb, img.b)} · Wikimedia Commons`;
}

/** Trận đã có (bản thật): thay ảnh emoji bằng ảnh thật + thêm dòng ghi nguồn — phiếu/bình luận giữ nguyên. */
async function syncImages(authorId: string, title: string, caption: string, la: string, lb: string): Promise<void> {
  const img = CLASSIC_IMAGES[title];
  if (!img) return;
  const [p] = await db.select({ id: posts.id, caption: posts.caption }).from(posts).where(and(eq(posts.authorId, authorId), eq(posts.title, title)));
  if (!p) return;
  for (const [label, url] of [[la, img.a.url], [lb, img.b.url]] as const) {
    await db.update(rankieOptions).set({ imageUrl: url }).where(and(eq(rankieOptions.rankieId, p.id), eq(rankieOptions.label, label), sql`(${rankieOptions.imageUrl} IS NULL OR ${rankieOptions.imageUrl} LIKE '%twemoji%')`)); // chỉ thay ảnh emoji cũ — ảnh chủ app tự đổi thì giữ
  }
  if (!(p.caption || '').includes(CREDIT_MARK)) {
    await db.update(posts).set({ caption: withCredit(p.caption || caption, la, lb, img) }).where(eq(posts.id, p.id));
  }
}

async function existingTitles(authorId: string): Promise<Set<string>> {
  const rows = await db.select({ title: posts.title }).from(posts).where(eq(posts.authorId, authorId));
  return new Set(rows.map((r) => r.title));
}

export async function ensureClassics(log: (m: string) => void = () => {}): Promise<number> {
  const authorId = await ensureOfficial();
  const have = await existingTitles(authorId);
  let created = 0;

  // Bỏ series cũ: mỗi trận đứng riêng (xoá series → chỉ gỡ liên kết chapter, bài giữ nguyên)
  await db.delete(series).where(and(eq(series.authorId, authorId), eq(series.name, LEGACY_CLASSICS_SERIES)));
  for (const m of MATCHUPS) {
    const img = CLASSIC_IMAGES[m.title];
    if (have.has(m.title)) { await syncImages(authorId, m.title, m.caption, m.a[0], m.b[0]); continue; }
    await createRankie(authorId, createRankieSchema.parse({
      type: 'rankie', title: m.title, caption: withCredit(m.caption, m.a[0], m.b[0], img), tags: m.tags, category: 'Kinh điển',
      votingType: 'single', chartType: 'head_to_head', live: true, sponsored: false, allowGuestPresent: true,
      options: [{ label: m.a[0], imageUrl: img?.a.url || TW(m.a[1]) }, { label: m.b[0], imageUrl: img?.b.url || TW(m.b[1]) }],
    }));
    created++;
  }

  const PATH_TITLE = 'Bạn là món ăn Việt nào?';
  if (!have.has(PATH_TITLE)) {
    await createPath(authorId, createPathSchema.parse({
      type: 'path', title: PATH_TITLE, caption: '3 câu hỏi nhỏ để biết bạn là món gì trong mâm cơm Việt 🍲', tags: ['kinhdien', 'amthuc'],
      revealMode: 'names', hideEndingCount: false, allowGuestPresent: true,
      questions: [
        { key: 'q1', isEntry: true, text: 'Sáng thứ Bảy, bạn thường…', answers: [
          { label: 'Ngủ nướng tới trưa', targetType: 'question', targetKey: 'q2' },
          { label: 'Dậy sớm đi chợ, nấu nướng', targetType: 'question', targetKey: 'q3' },
          { label: 'Lên đồ đi cà phê với bạn', targetType: 'question', targetKey: 'q2' },
        ] },
        { key: 'q2', text: 'Bạn bè hay nhờ bạn việc gì nhất?', answers: [
          { label: 'Chọn quán ăn ngon', targetType: 'ending', targetKey: 'Bún chả' },
          { label: 'Lên kế hoạch cho cả nhóm', targetType: 'ending', targetKey: 'Bánh mì' },
          { label: 'Ngồi nghe tâm sự', targetType: 'ending', targetKey: 'Phở' },
        ] },
        { key: 'q3', text: 'Đồ đạc trong phòng bạn…', answers: [
          { label: 'Gọn gàng, mọi thứ có chỗ của nó', targetType: 'ending', targetKey: 'Gỏi cuốn' },
          { label: 'Hơi bừa nhưng ấm cúng', targetType: 'ending', targetKey: 'Cơm tấm' },
          { label: 'Đầy đồ sưu tầm, kỷ niệm', targetType: 'ending', targetKey: 'Phở' },
        ] },
      ],
      endings: [
        { name: 'Phở', emoji: '🍜', comment: 'Ấm áp, chân thành — ai ở cạnh bạn cũng thấy dễ chịu.' },
        { name: 'Bánh mì', emoji: '🥖', comment: 'Năng động, nhanh nhẹn, đi đâu cũng hợp.' },
        { name: 'Bún chả', emoji: '🥢', comment: 'Hào sảng, thích tụ tập, có bạn là có vui.' },
        { name: 'Gỏi cuốn', emoji: '🥬', comment: 'Thanh lịch, chỉn chu, sống lành mạnh.' },
        { name: 'Cơm tấm', emoji: '🍚', comment: 'Bình dị mà cuốn hút, càng biết lâu càng quý.' },
      ],
    }));
    created++;
  }

  const SURVEY_TITLE = 'Giấc ngủ của bạn thế nào?';
  if (!have.has(SURVEY_TITLE)) {
    await createDeck(authorId, createDeckSchema.parse({
      type: 'deck', deckMode: 'survey', title: SURVEY_TITLE, caption: 'Khảo sát ẩn danh 3 câu — xem cả cộng đồng ngủ ra sao 😴', tags: ['kinhdien', 'suckhoe'], allowGuestPresent: true,
      questions: [
        { text: 'Bạn thường đi ngủ lúc mấy giờ?', votingType: 'single', options: [{ label: 'Trước 22h' }, { label: '22h – 0h' }, { label: '0h – 2h' }, { label: 'Sau 2h' }] },
        { text: 'Mỗi đêm bạn ngủ khoảng bao lâu?', votingType: 'single', options: [{ label: 'Dưới 5 tiếng' }, { label: '5 – 7 tiếng' }, { label: '7 – 9 tiếng' }, { label: 'Hơn 9 tiếng' }] },
        { text: 'Điều gì hay làm bạn thức khuya? (chọn nhiều)', votingType: 'multiple', options: [{ label: 'Lướt mạng xã hội' }, { label: 'Công việc / học' }, { label: 'Xem phim, chơi game' }, { label: 'Suy nghĩ linh tinh' }] },
      ],
    }));
    created++;
  }

  const EXAM_TITLE = 'Bạn hiểu Việt Nam đến đâu?';
  if (!have.has(EXAM_TITLE)) {
    await createDeck(authorId, createDeckSchema.parse({
      type: 'deck', deckMode: 'exam', title: EXAM_TITLE, caption: '5 câu về đất nước hình chữ S — đạt từ 6/10 điểm 🇻🇳', tags: ['kinhdien', 'dovui'],
      passingScore: 6, examDurationMinutes: 5, allowGuestPresent: true,
      questions: [
        { text: 'Đỉnh núi cao nhất Việt Nam là?', votingType: 'single', points: 2, options: [{ label: 'Fansipan', correct: true }, { label: 'Pu Si Lung' }, { label: 'Bạch Mã' }] },
        { text: 'Vịnh Hạ Long lần đầu được UNESCO công nhận Di sản thiên nhiên thế giới năm nào?', votingType: 'single', points: 2, options: [{ label: '1994', correct: true }, { label: '2000' }, { label: '2010' }] },
        { text: 'Hang Sơn Đoòng nằm trong vườn quốc gia nào?', votingType: 'single', points: 2, options: [{ label: 'Phong Nha – Kẻ Bàng', correct: true }, { label: 'Cúc Phương' }, { label: 'Cát Tiên' }] },
        { text: 'Con sông nào đổ ra biển qua đồng bằng sông Cửu Long?', votingType: 'single', points: 2, options: [{ label: 'Sông Mê Kông', correct: true }, { label: 'Sông Hồng' }, { label: 'Sông Đà' }] },
        { text: 'Bờ biển Việt Nam dài khoảng bao nhiêu km?', votingType: 'single', points: 2, options: [{ label: 'Khoảng 1.200 km' }, { label: 'Khoảng 3.260 km', correct: true }, { label: 'Khoảng 5.500 km' }] },
      ],
    }));
    created++;
  }
  if (created) log(`[classics] đã tạo ${created} bài kinh điển của @${OFFICIAL.handle}`);
  return created;
}
