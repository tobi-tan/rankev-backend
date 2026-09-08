// Chuẩn hoá hashtag người dùng nhập: bỏ dấu '#', cắt khoảng trắng, gộp khoảng trắng
// trong tag thành liền, loại rỗng/trùng (không phân biệt hoa thường), tối đa 10 tag.
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
