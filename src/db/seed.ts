import { eq } from 'drizzle-orm';
import { db, pool } from './index';
import { users, posts } from './schema';
import { hashPassword } from '../lib/password';
import { createRankie } from '../modules/posts/posts.service';
import { createPath } from '../modules/paths/paths.service';
import { createDeck } from '../modules/decks/decks.service';

/**
 * Idempotent demo seed: a demo user + one of each content type, so a fresh
 * install shows a populated feed. Safe to re-run (skips if demo already has posts).
 *
 * Run with: npm run db:seed
 */
async function main() {
  let [demo] = await db.select().from(users).where(eq(users.handle, 'demo'));
  if (!demo) {
    [demo] = await db
      .insert(users)
      .values({
        email: 'demo@rankev.app',
        handle: 'demo',
        name: 'Rankev Demo',
        passwordHash: await hashPassword('demo1234'),
        avatarEmoji: '🐤',
        verified: true,
      })
      .returning();
    console.log('Created demo user (demo@rankev.app / demo1234)');
  }

  const existing = await db.select({ id: posts.id }).from(posts).where(eq(posts.authorId, demo.id));
  if (existing.length > 0) {
    console.log(`Demo user already has ${existing.length} posts — skipping.`);
    await pool.end();
    return;
  }

  await createRankie(demo.id, {
    type: 'rankie',
    title: 'Cà phê sáng chọn gì? ☕',
    category: 'Đồ uống',
    votingType: 'single',
    chartType: 'bar',
    live: false,
    sponsored: false,
    options: [
      { label: 'Cà phê sữa', emoji: '☕' },
      { label: 'Bạc xỉu', emoji: '🥛' },
      { label: 'Trà đá', emoji: '🧊' },
      { label: 'Nước lọc', emoji: '💧' },
    ],
  });

  await createPath(demo.id, {
    type: 'path',
    title: 'Bạn là kiểu người nào? 🗺️',
    category: 'Tính cách',
    revealMode: 'hidden',
    hideEndingCount: false,
    questions: [
      {
        key: 'q1',
        text: 'Cuối tuần bạn muốn làm gì?',
        isEntry: true,
        answers: [
          { label: 'Ra ngoài gặp bạn bè', emoji: '🎉', targetType: 'question', targetKey: 'q2' },
          { label: 'Ở nhà nghỉ ngơi', emoji: '🛋️', targetType: 'ending', targetKey: 'Người hướng nội' },
        ],
      },
      {
        key: 'q2',
        text: 'Ở buổi tiệc, bạn thường...',
        answers: [
          { label: 'Là trung tâm', emoji: '🎤', targetType: 'ending', targetKey: 'Linh hồn của bữa tiệc' },
          { label: 'Quan sát mọi người', emoji: '👀', targetType: 'ending', targetKey: 'Người hướng nội' },
        ],
      },
    ],
    endings: [
      { name: 'Linh hồn của bữa tiệc', emoji: '🎊', comment: 'Bạn tràn đầy năng lượng!' },
      { name: 'Người hướng nội', emoji: '🌙', comment: 'Bạn tận hưởng sự yên tĩnh.' },
    ],
  });

  await createDeck(demo.id, {
    type: 'deck',
    deckMode: 'survey',
    title: 'Khảo sát thói quen đọc sách 📚',
    category: 'Khảo sát',
    questions: [
      {
        text: 'Bạn đọc bao nhiêu cuốn sách mỗi tháng?',
        votingType: 'single',
        points: 0,
        options: [
          { label: '0-1', correct: false },
          { label: '2-3', correct: false },
          { label: '4+', correct: false },
        ],
      },
      {
        text: 'Bạn thích thể loại nào?',
        votingType: 'multiple',
        points: 0,
        options: [
          { label: 'Tiểu thuyết', correct: false },
          { label: 'Khoa học', correct: false },
          { label: 'Kinh doanh', correct: false },
        ],
      },
    ],
  });

  await createDeck(demo.id, {
    type: 'deck',
    deckMode: 'exam',
    title: 'Kiểm tra kiến thức Địa lý 🌍',
    category: 'Giáo dục',
    examDurationMinutes: 10,
    passingScore: 5,
    questions: [
      {
        text: 'Thủ đô của Việt Nam?',
        votingType: 'single',
        points: 5,
        options: [
          { label: 'Hà Nội', correct: true },
          { label: 'TP.HCM', correct: false },
          { label: 'Đà Nẵng', correct: false },
        ],
      },
      {
        text: 'Sông dài nhất thế giới?',
        votingType: 'single',
        points: 5,
        options: [
          { label: 'Sông Nile', correct: true },
          { label: 'Sông Amazon', correct: false },
          { label: 'Sông Mekong', correct: false },
        ],
      },
    ],
  });

  console.log('Seeded 1 rankie + 1 path + 1 survey + 1 exam for demo user.');
  await pool.end();
}

main().catch(async (err) => {
  console.error('Seed failed:', err);
  await pool.end();
  process.exit(1);
});
