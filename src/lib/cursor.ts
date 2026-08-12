/**
 * Opaque keyset cursor for feed pagination, ordered by (created_at DESC, id DESC).
 * Encodes the last-seen row's createdAt + id as base64url so the client treats it
 * as an opaque string.
 */
export interface Cursor {
  createdAt: string; // ISO timestamp
  id: string;
}

export function encodeCursor(c: Cursor): string {
  return Buffer.from(`${c.createdAt}|${c.id}`, 'utf8').toString('base64url');
}

export function decodeCursor(raw: string): Cursor | null {
  try {
    const decoded = Buffer.from(raw, 'base64url').toString('utf8');
    const idx = decoded.indexOf('|');
    if (idx === -1) return null;
    const createdAt = decoded.slice(0, idx);
    const id = decoded.slice(idx + 1);
    if (!createdAt || !id || Number.isNaN(Date.parse(createdAt))) return null;
    return { createdAt, id };
  } catch {
    return null;
  }
}
