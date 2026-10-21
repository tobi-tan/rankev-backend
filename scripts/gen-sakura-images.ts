/**
 * Vẽ tranh ANIME cho truyện mẫu "Ngày đầu ở trường Sakuragaoka" bằng Gemini (Google AI Studio).
 *
 *   1. Đặt khoá vào .env (máy bạn, KHÔNG commit):  GEMINI_API_KEY=...
 *   2. Chạy:  npx tsx scripts/gen-sakura-images.ts            (vẽ ảnh còn thiếu, ~29 ảnh)
 *             npx tsx scripts/gen-sakura-images.ts --only s1,e2   (vẽ lại vài ảnh)
 *             npx tsx scripts/gen-sakura-images.ts --apply        (gắn ảnh đã vẽ vào showcase.ts)
 *
 * Ảnh lưu ở rankev-web/public/classics/sakura/<key>.webp (Vercel phục vụ miễn phí). Sau --apply,
 * commit cả 2 repo; lúc backend khởi động, ensureClassics tự thay ảnh của bài đã tạo.
 * Mọi nhân vật đều giữ cùng một ngoại hình nhờ tấm "ref" (bảng nhân vật) gửi kèm mỗi lần vẽ.
 */
import 'dotenv/config';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { SHOWCASE_PATH } from '../src/modules/classics/showcase';

const KEY = process.env.GEMINI_API_KEY;
const MODEL = process.env.GEMINI_IMAGE_MODEL || 'gemini-2.5-flash-image';
const WEB_BASE = 'https://rankev-web.vercel.app';
const OUT = join(__dirname, '..', '..', 'rankev-web', 'public', 'classics', 'sakura');
const SHOWCASE_FILE = join(__dirname, '..', 'src', 'modules', 'classics', 'showcase.ts');

const STYLE =
  'Modern Japanese anime visual-novel illustration, clean line art, soft cel shading, warm cinematic lighting, ' +
  'spring at a Japanese high school with cherry blossoms. No text, no letters, no watermark, no speech bubbles. ' +
  'Keep characters consistent with the attached character sheet. Scene: ';
const CAST =
  'Character reference sheet on a plain white background, full body front view, three teenage anime characters ' +
  'in the same navy blazer school uniform with red ribbon/tie: (1) the PROTAGONIST — 16, friendly, short messy black hair, ' +
  'brown eyes, school bag; (2) KAITO — class president, tall, neat dark-blue hair, rectangular glasses, serious; ' +
  '(3) HANA — gentle girl from the next class, long chestnut hair with a pink sakura hair clip. Also a small black cat. ' +
  'Anime visual-novel style, no text.';

type Job = { key: string; prompt: string; oldUrl?: string };

function jobs(): Job[] {
  const P = SHOWCASE_PATH as unknown as {
    media?: { url?: string };
    questions: { key: string; text: string; sceneImageUrl?: string; answers: { label: string; imageUrl?: string }[] }[];
    endings: { name: string; comment?: string; imageUrl?: string }[];
  };
  const out: Job[] = [{ key: 'cover', prompt: 'The school gate covered in falling cherry blossoms on the first morning, the protagonist, Kaito and Hana walking in, wide shot, title-screen composition.', oldUrl: P.media?.url }];
  for (const q of P.questions) {
    out.push({ key: q.key, prompt: `(story text in Vietnamese) ${q.text}`, oldUrl: q.sceneImageUrl });
    q.answers.forEach((a, i) => out.push({ key: `${q.key}-a${i + 1}`, prompt: `Context: ${q.text} — The protagonist chooses: ${a.label}. Show that moment.`, oldUrl: a.imageUrl }));
  }
  P.endings.forEach((e, i) => out.push({ key: `e${i + 1}`, prompt: `Ending illustration "${e.name}": ${e.comment ?? ''} Emotional, memorable key art.`, oldUrl: e.imageUrl }));
  return out;
}

async function gen(prompt: string, ref: Buffer | null, aspect = '4:3'): Promise<Buffer> {
  const parts: unknown[] = [{ text: prompt }];
  if (ref) parts.push({ inline_data: { mime_type: 'image/png', data: ref.toString('base64') } });
  for (let attempt = 1; attempt <= 3; attempt++) {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': KEY! },
      body: JSON.stringify({ contents: [{ parts }], generationConfig: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: aspect } } }),
    });
    const j = (await r.json()) as { error?: { message?: string }; candidates?: { content?: { parts?: { inlineData?: { data?: string } }[] } }[] };
    const data = j.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data)?.inlineData?.data;
    if (r.ok && data) return Buffer.from(data, 'base64');
    console.warn(`  lần ${attempt} lỗi: ${j.error?.message ?? r.status}`);
    if (r.status === 400 || r.status === 401 || r.status === 403) break; // sai khoá / sai model → thử lại vô ích
    await new Promise((res) => setTimeout(res, 4000 * attempt));
  }
  throw new Error('Không vẽ được ảnh');
}

function apply(list: Job[]) {
  let src = readFileSync(SHOWCASE_FILE, 'utf8');
  let n = 0;
  for (const j of list) {
    const file = join(OUT, `${j.key}.webp`);
    if (!existsSync(file) || !j.oldUrl) continue;
    const url = `${WEB_BASE}/classics/sakura/${j.key}.webp`;
    if (src.split(j.oldUrl).length !== 2) { if (!src.includes(url)) console.warn(`  bỏ qua ${j.key}: không tìm thấy ảnh cũ duy nhất`); continue; }
    src = src.replace(j.oldUrl, url);
    n++;
  }
  writeFileSync(SHOWCASE_FILE, src);
  console.log(`Đã gắn ${n} ảnh vào showcase.ts → commit rankev-web (public/classics/sakura) + rankev-backend.`);
}

async function main() {
  const list = jobs();
  if (process.argv.includes('--apply')) return apply(list);
  if (!KEY) { console.error('Thiếu GEMINI_API_KEY trong .env'); process.exit(1); }
  mkdirSync(OUT, { recursive: true });
  const onlyArg = process.argv.find((a) => a.startsWith('--only'));
  const only = onlyArg ? (onlyArg.split('=')[1] ?? process.argv[process.argv.indexOf(onlyArg) + 1] ?? '').split(',') : null;

  const refFile = join(__dirname, '.sakura-ref.png'); // bảng nhân vật — chỉ dùng khi vẽ, không đăng lên web
  let ref: Buffer;
  if (existsSync(refFile)) ref = readFileSync(refFile);
  else {
    console.log('• Vẽ bảng nhân vật (ref)…');
    ref = await gen(CAST, null, '16:9');
    writeFileSync(refFile, ref);
  }
  let done = 0;
  for (const j of list) {
    const file = join(OUT, `${j.key}.webp`);
    if (only ? !only.includes(j.key) : existsSync(file)) continue;
    console.log(`• ${j.key}`);
    try {
      const png = await gen(STYLE + j.prompt, ref);
      await sharp(png).resize({ width: 1080, withoutEnlargement: true }).webp({ quality: 80 }).toFile(file);
      done++;
    } catch (e) {
      console.error(`  ✗ ${j.key}: ${(e as Error).message}`);
    }
  }
  console.log(`Xong: vẽ ${done} ảnh → ${OUT}. Xem thử rồi chạy lại với --apply.`);
}
main().catch((e) => { console.error(e); process.exit(1); });
