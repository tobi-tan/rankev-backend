// Chuẩn hoá hashtag người dùng nhập: bỏ dấu '#', cắt khoảng trắng, gộp khoảng trắng
// trong tag thành liền, loại rỗng/trùng (không phân biệt hoa thường), tối đa 10 tag.
/** Rút #hashtag gõ trong mô tả (kiểu Instagram): chữ có dấu, số, dấu _. */
export function extractHashtags(text: string | null | undefined): string[] {
  if (!text) return [];
  const out: string[] = [];
  for (const m of text.matchAll(/#([\p{L}\p{N}_]{1,40})/gu)) out.push(m[1]);
  return out;
}

/** Tag của bài = tag chọn ở trình tạo (hoặc danh mục) + #hashtag trong mô tả, đã chuẩn hoá. */
export function tagsFor(tags: unknown, caption?: string | null, category?: string | null): string[] {
  const base = Array.isArray(tags) && tags.length ? tags : category ? [category] : [];
  return normalizeTags([...base, ...extractHashtags(caption)]);
}

export function normalizeTags(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of input) {
    if (typeof raw !== 'string') continue;
    let t = raw.trim().replace(/^#+/, '').trim();
    t = t.replace(/\s+/g, ''); // hashtag là một token liền
    if (!t) continue;
    if (t.length > 40) t = t.slice(0, 40);
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
    if (out.length >= 10) break;
  }
  return out;
}
