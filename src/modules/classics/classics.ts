import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import { db } from '../../db';
import { deckQuestions, posts, rankieOptions, series, users } from '../../db/schema';
import { CLASSIC_IMAGES } from './classics-images';
import { SHOWCASE_EXAM, SHOWCASE_PATH, SHOWCASE_SURVEY } from './showcase';
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
// Trận đã BỎ (user 2026-10-21: "không có gì là kinh điển") → gỡ (xoá mềm) bài cũ của @rankev khi khởi động.
// Path/Survey/Exam bản đầu (chỉ có chữ, user chê "không có gì thu hút") → gỡ, thay bản có ảnh.
export const RETIRED_SPECIALS = ['Bạn là món ăn Việt nào?', 'Giấc ngủ của bạn thế nào?', 'Bạn hiểu Việt Nam đến đâu?'];
export const RETIRED_MATCHUPS = ['Biển hay Núi?', 'Dậy sớm hay Thức khuya?', 'Mì tôm trứng hay Mì tôm xúc xích?', 'Chơi game hay Xem phim?'];

type Side = [label: string, twemoji: string];
const MATCHUPS: { title: string; caption: string; tags: string[]; a: Side; b: Side }[] = [
  { title: 'Phở hay Bún chả?', caption: 'Cuộc chiến muôn thuở của ẩm thực Hà Nội. Bạn đứng về phía nào?', tags: ['kinhdien', 'amthuc'], a: ['Phở', '1f35c'], b: ['Bún chả', '1f962'] },
  { title: 'Messi hay Ronaldo?', caption: 'Hai thập kỷ, một câu hỏi chưa có hồi kết. Ai là GOAT?', tags: ['kinhdien', 'bongda'], a: ['Messi', '1f410'], b: ['Ronaldo', '1f680'] },
  { title: 'Mèo hay Chó?', caption: 'Hoàng thượng hay boss trung thành?', tags: ['kinhdien', 'thucung'], a: ['Mèo', '1f431'], b: ['Chó', '1f436'] },
  { title: 'Cà phê sữa đá hay Trà sữa?', caption: 'Đồ uống quốc dân của bạn là gì?', tags: ['kinhdien', 'douong'], a: ['Cà phê sữa đá', '2615'], b: ['Trà sữa', '1f9cb'] },
  { title: 'iPhone hay Android?', caption: 'Phe táo khuyết hay phe robot xanh?', tags: ['kinhdien', 'congnghe'], a: ['iPhone', '1f34e'], b: ['Android', '1f916'] },
  { title: 'Hà Nội hay Sài Gòn?', caption: 'Nếu chỉ được sống ở một nơi, bạn chọn đâu?', tags: ['kinhdien', 'dulich'], a: ['Hà Nội', '1f3ef'], b: ['Sài Gòn', '1f306'] },
  { title: 'Bánh mì hay Xôi?', caption: 'Bữa sáng vội vàng trên đường đi làm: chọn món nào?', tags: ['kinhdien', 'amthuc'], a: ['Bánh mì', '1f956'], b: ['Xôi', '1f359'] },
  { title: 'Tom hay Jerry?', caption: 'Tuổi thơ của cả thế hệ — bạn luôn đứng về phe ai?', tags: ['kinhdien', 'hoathinh'], a: ['Tom', '1f63c'], b: ['Jerry', '1f42d'] },
  { title: 'Doraemon hay Conan?', caption: 'Bộ truyện tranh gắn liền với tuổi thơ bạn là…', tags: ['kinhdien', 'truyentranh'], a: ['Doraemon', '1f514'], b: ['Conan', '1f575'] },
  { title: 'Nhắn tin hay Gọi điện?', caption: 'Có chuyện cần nói, bạn sẽ…', tags: ['kinhdien', 'loisong'], a: ['Nhắn tin', '1f4ac'], b: ['Gọi điện', '1f4de'] },
  { title: 'Lên văn phòng hay Làm từ xa?', caption: 'Đi làm kiểu nào hiệu quả hơn?', tags: ['kinhdien', 'congviec'], a: ['Lên văn phòng', '1f3e2'], b: ['Làm từ xa', '1f3e0'] },
  { title: 'Tết về quê hay Tết đi du lịch?', caption: 'Kỳ nghỉ dài nhất năm, bạn dành cho đâu?', tags: ['kinhdien', 'tet'], a: ['Về quê', '1f9e7'], b: ['Đi du lịch', '2708'] },
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
  // Chỉ ảnh Wikimedia (CC) mới cần ghi nguồn; Unsplash thì không.
  const parts = ([[la, img.a], [lb, img.b]] as const).filter(([, i]) => i.license !== 'Unsplash')
    .map(([label, i]) => `${label} — ${i.artist || 'không rõ tác giả'} (${i.license})`);
  return parts.length ? `${caption}\n\n${CREDIT_MARK} ${parts.join('; ')} · Wikimedia Commons` : caption;
}

/** Trận đã có (bản thật): thay ảnh emoji bằng ảnh thật + thêm dòng ghi nguồn — phiếu/bình luận giữ nguyên. */
async function syncImages(authorId: string, title: string, caption: string, la: string, lb: string): Promise<void> {
  const img = CLASSIC_IMAGES[title];
  if (!img) return;
  const [p] = await db.select({ id: posts.id, caption: posts.caption }).from(posts).where(and(eq(posts.authorId, authorId), eq(posts.title, title)));
  if (!p) return;
  for (const [label, url] of [[la, img.a.url], [lb, img.b.url]] as const) {
    // chỉ thay ảnh DO HỆ THỐNG đặt (emoji / Wikimedia / Unsplash cũ) — ảnh chủ app tự tải lên thì giữ
    await db.update(rankieOptions).set({ imageUrl: url }).where(and(eq(rankieOptions.rankieId, p.id), eq(rankieOptions.label, label),
      sql`(${rankieOptions.imageUrl} IS NULL OR ${rankieOptions.imageUrl} LIKE '%twemoji%' OR ${rankieOptions.imageUrl} LIKE '%wikimedia.org%' OR ${rankieOptions.imageUrl} LIKE '%images.unsplash.com%')`,
      sql`${rankieOptions.imageUrl} IS DISTINCT FROM ${url}`));
  }
  const base = (p.caption || caption).split(`\n\n${CREDIT_MARK}`)[0];
  const next = withCredit(base, la, lb, img);
  if (next !== p.caption) await db.update(posts).set({ caption: next }).where(eq(posts.id, p.id));
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
  await db.update(posts).set({ deletedAt: new Date() })
    .where(and(eq(posts.authorId, authorId), eq(posts.chartType, 'head_to_head'), inArray(posts.title, RETIRED_MATCHUPS), isNull(posts.deletedAt)));
  await db.update(posts).set({ deletedAt: new Date() })
    .where(and(eq(posts.authorId, authorId), inArray(posts.type, ['path', 'deck']), inArray(posts.title, RETIRED_SPECIALS), isNull(posts.deletedAt)));
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

  // ===== PATH kiểu "light novel": mỗi cảnh 1 ảnh, chạm ẢNH để chọn đường đi tiếp =====
  const PATH_TITLE = 'Nếu là một món ăn Việt, bạn sẽ là món gì?';
  if (!have.has(PATH_TITLE)) {
    await createPath(authorId, createPathSchema.parse({
      type: 'path', title: PATH_TITLE,
      caption: '3 cảnh trong một ngày cuối tuần. Ở mỗi cảnh, chạm vào bức ảnh bạn thấy giống mình nhất — cuối hành trình sẽ biết bạn là món nào trong mâm cơm Việt 🍜',
      tags: ['kinhdien', 'amthuc'], media: { url: "https://images.unsplash.com/photo-1641440615059-42c8ed3af8c8?w=1080&q=80&auto=format&fit=crop", type: 'image' },
      revealMode: 'names', hideEndingCount: false, allowGuestPresent: true,
      questions: [
        { key: 'q1', isEntry: true, text: 'Sáng thứ Bảy, Hà Nội vừa thức giấc. Bạn sẽ…', sceneImageUrl: "https://images.unsplash.com/photo-1679562078540-09ae866ef4bf?w=1080&q=80&auto=format&fit=crop", answers: [
          { label: 'Ngủ nướng tới trưa', imageUrl: "https://images.unsplash.com/photo-1541781774459-bb2af2f05b55?w=1080&q=80&auto=format&fit=crop", targetType: 'question', targetKey: 'q2' },
          { label: 'Ra chợ sớm, tự nấu một bữa', imageUrl: "https://images.unsplash.com/photo-1558722141-dc9be8718862?w=1080&q=80&auto=format&fit=crop", targetType: 'question', targetKey: 'q3' },
          { label: 'Hẹn bạn đi cà phê phin', imageUrl: "https://images.unsplash.com/photo-1607469256300-96fa04e6e08b?w=1080&q=80&auto=format&fit=crop", targetType: 'question', targetKey: 'q2' },
        ] },
        { key: 'q2', text: 'Tối đó cả nhóm bạn tụ tập. Bạn là người…', sceneImageUrl: "https://images.unsplash.com/photo-1581954548122-4dff8989c0f7?w=1080&q=80&auto=format&fit=crop", answers: [
          { label: 'Chọn quán ngon nhất phố', imageUrl: "https://images.unsplash.com/photo-1743485754079-d7fde0e9283f?w=1080&q=80&auto=format&fit=crop", targetType: 'ending', targetKey: 'Bún chả' },
          { label: 'Lên kế hoạch cho cả nhóm', imageUrl: "https://images.unsplash.com/photo-1578894381163-e72c17f2d45f?w=1080&q=80&auto=format&fit=crop", targetType: 'ending', targetKey: 'Bánh mì' },
          { label: 'Ngồi nghe mọi người tâm sự', imageUrl: "https://images.unsplash.com/photo-1760623681430-9224e69d9683?w=1080&q=80&auto=format&fit=crop", targetType: 'ending', targetKey: 'Phở' },
        ] },
        { key: 'q3', text: 'Nấu xong, bạn dọn về phòng. Căn phòng của bạn trông thế nào?', sceneImageUrl: "https://images.unsplash.com/photo-1660322098031-4824cddb8631?w=1080&q=80&auto=format&fit=crop", answers: [
          { label: 'Gọn gàng, mọi thứ có chỗ của nó', imageUrl: "https://images.unsplash.com/photo-1617325247661-675ab4b64ae2?w=1080&q=80&auto=format&fit=crop", targetType: 'ending', targetKey: 'Gỏi cuốn' },
          { label: 'Hơi bừa nhưng ấm cúng', imageUrl: "https://images.unsplash.com/photo-1611234688667-76b6d8fadd75?w=1080&q=80&auto=format&fit=crop", targetType: 'ending', targetKey: 'Cơm tấm' },
          { label: 'Đầy đồ sưu tầm, kỷ niệm', imageUrl: "https://images.unsplash.com/photo-1790270692089-61be23bab82e?w=1080&q=80&auto=format&fit=crop", targetType: 'ending', targetKey: 'Phở' },
        ] },
      ],
      endings: [
        { name: 'Phở', imageUrl: "https://images.unsplash.com/photo-1582878826629-29b7ad1cdc43?w=1080&q=80&auto=format&fit=crop", comment: 'Ấm áp, chân thành — ai ở cạnh bạn cũng thấy dễ chịu.' },
        { name: 'Bánh mì', imageUrl: "https://images.unsplash.com/photo-1600454309261-3dc9b7597637?w=1080&q=80&auto=format&fit=crop", comment: 'Năng động, nhanh nhẹn, đi đâu cũng hợp.' },
        { name: 'Bún chả', imageUrl: "https://images.unsplash.com/photo-1742893368398-128bded9c656?w=1080&q=80&auto=format&fit=crop", comment: 'Hào sảng, thích tụ tập, có bạn là có vui.' },
        { name: 'Gỏi cuốn', imageUrl: "https://images.unsplash.com/photo-1594020293008-5f99f60bd4d7?w=1080&q=80&auto=format&fit=crop", comment: 'Thanh lịch, chỉn chu, sống lành mạnh.' },
        { name: 'Cơm tấm', imageUrl: "https://images.unsplash.com/photo-1597311280719-b6bb2ca37f62?w=1080&q=80&auto=format&fit=crop", comment: 'Bình dị mà cuốn hút, càng biết lâu càng quý.' },
      ],
    }));
    created++;
  }

  // ===== SURVEY: ảnh bìa + ảnh từng câu =====
  const SURVEY_TITLE = 'Bạn có đang ngủ đủ giấc?';
  if (!have.has(SURVEY_TITLE)) {
    await createDeck(authorId, createDeckSchema.parse({
      type: 'deck', deckMode: 'survey', title: SURVEY_TITLE,
      caption: 'Khảo sát ẩn danh, 3 câu, chưa tới 30 giây. Trả lời xong bạn sẽ thấy cả cộng đồng Rankev đang ngủ thế nào 😴',
      tags: ['kinhdien', 'suckhoe'], allowGuestPresent: true, media: { url: "https://images.unsplash.com/photo-1675510183225-76c920848c29?w=1080&q=80&auto=format&fit=crop", type: 'image' },
      questions: [
        { text: 'Bạn thường đi ngủ lúc mấy giờ?', imageUrl: "https://images.unsplash.com/photo-1549675584-c22bde15df72?w=1080&q=80&auto=format&fit=crop", votingType: 'single', options: [{ label: 'Trước 22h' }, { label: '22h – 0h' }, { label: '0h – 2h' }, { label: 'Sau 2h' }] },
        { text: 'Mỗi đêm bạn ngủ khoảng bao lâu?', imageUrl: "https://images.unsplash.com/photo-1688382575775-9aaa5025524e?w=1080&q=80&auto=format&fit=crop", votingType: 'single', options: [{ label: 'Dưới 5 tiếng' }, { label: '5 – 7 tiếng' }, { label: '7 – 9 tiếng' }, { label: 'Hơn 9 tiếng' }] },
        { text: 'Điều gì hay làm bạn thức khuya? (chọn nhiều)', imageUrl: "https://images.unsplash.com/photo-1585577517704-f3d6f8023665?w=1080&q=80&auto=format&fit=crop", votingType: 'multiple', options: [{ label: 'Lướt mạng xã hội' }, { label: 'Công việc / học' }, { label: 'Xem phim, chơi game' }, { label: 'Suy nghĩ linh tinh' }] },
      ],
    }));
    created++;
  }

  // ===== EXAM: nhìn ẢNH đoán địa danh =====
  const EXAM_TITLE = 'Nhìn ảnh, đoán địa danh Việt Nam';
  if (!have.has(EXAM_TITLE)) {
    await createDeck(authorId, createDeckSchema.parse({
      type: 'deck', deckMode: 'exam', title: EXAM_TITLE,
      caption: '5 bức ảnh, 5 địa danh nổi tiếng. Mỗi câu đúng được 2 điểm — đạt 6/10 điểm trở lên là bạn "sành" Việt Nam 🇻🇳',
      tags: ['kinhdien', 'dovui', 'dulich'], media: { url: "https://images.unsplash.com/photo-1675111066042-9baa4c343157?w=1080&q=80&auto=format&fit=crop", type: 'image' },
      passingScore: 6, examDurationMinutes: 3, allowGuestPresent: true,
      questions: [
        { text: 'Đây là đâu?', imageUrl: "https://images.unsplash.com/photo-1764645859246-8c6db98330a7?w=1080&q=80&auto=format&fit=crop", votingType: 'single', points: 2, options: [{ label: 'Vịnh Hạ Long', correct: true }, { label: 'Tràng An' }, { label: 'Phong Nha' }] },
        { text: 'Phố đèn lồng này ở đâu?', imageUrl: "https://images.unsplash.com/photo-1652731011413-93d4c5aa5c7c?w=1080&q=80&auto=format&fit=crop", votingType: 'single', points: 2, options: [{ label: 'Phố cổ Hà Nội' }, { label: 'Phố cổ Hội An', correct: true }, { label: 'Cố đô Huế' }] },
        { text: 'Đây là đâu?', imageUrl: "https://images.unsplash.com/photo-1702885967055-879bff3d8eba?w=1080&q=80&auto=format&fit=crop", votingType: 'single', points: 2, options: [{ label: 'Cát Bà' }, { label: 'Vịnh Hạ Long' }, { label: 'Tràng An – Ninh Bình', correct: true }] },
        { text: 'Cây cầu "bàn tay khổng lồ" này nằm ở đâu?', imageUrl: "https://images.unsplash.com/photo-1790134773057-af82e32e68fd?w=1080&q=80&auto=format&fit=crop", votingType: 'single', points: 2, options: [{ label: 'Bà Nà Hills – Đà Nẵng', correct: true }, { label: 'Đà Lạt' }, { label: 'Phú Quốc' }] },
        { text: 'Ruộng bậc thang này ở đâu?', imageUrl: "https://images.unsplash.com/photo-1694152363060-cc26bde73872?w=1080&q=80&auto=format&fit=crop", votingType: 'single', points: 2, options: [{ label: 'Đà Lạt' }, { label: 'Sa Pa – Lào Cai', correct: true }, { label: 'Mộc Châu' }] },
      ],
    }));
    created++;
  }
  // ===== Nội dung mẫu: truyện học đường nhiều nhánh · đề thi thử Toán 40 câu · khảo sát WHO-5 =====
  if (!have.has(SHOWCASE_PATH.title)) { await createPath(authorId, createPathSchema.parse(SHOWCASE_PATH)); created++; }
  if (!have.has(SHOWCASE_EXAM.title)) { await createDeck(authorId, createDeckSchema.parse(SHOWCASE_EXAM)); created++; }
  else {
    // đề tạo trước migration 0037 bị làm tròn 0,25 → 0,3: sửa lại cho đúng thang 10
    const [ex] = await db.select({ id: posts.id }).from(posts).where(and(eq(posts.authorId, authorId), eq(posts.title, SHOWCASE_EXAM.title)));
    if (ex) await db.update(deckQuestions).set({ points: '0.25' }).where(and(eq(deckQuestions.postId, ex.id), sql`${deckQuestions.points} <> 0.25`));
  }
  if (!have.has(SHOWCASE_SURVEY.title)) { await createDeck(authorId, createDeckSchema.parse(SHOWCASE_SURVEY)); created++; }
  if (created) log(`[classics] đã tạo ${created} bài kinh điển của @${OFFICIAL.handle}`);
  return created;
}
