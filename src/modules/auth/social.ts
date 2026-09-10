import { createPublicKey, type KeyObject } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { env } from '../../env';
import { badRequest, unauthorized } from '../../lib/errors';

export type SocialProvider = 'google' | 'facebook' | 'apple';

export interface SocialProfile {
  provider: SocialProvider;
  providerId: string;
  email: string | null;
  name: string;
  avatarUrl: string | null;
}

/** Nhà cung cấp có được bật (đã cấu hình client id) không. */
export function isProviderEnabled(p: SocialProvider): boolean {
  if (p === 'google') return !!env.GOOGLE_CLIENT_ID;
  if (p === 'facebook') return !!env.FACEBOOK_APP_ID;
  if (p === 'apple') return !!env.APPLE_CLIENT_ID;
  return false;
}

// ---- Google: xác minh ID token qua endpoint tokeninfo (không cần secret) ----
async function verifyGoogle(idToken: string): Promise<SocialProfile> {
  const res = await fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(idToken));
  if (!res.ok) throw unauthorized('Google token không hợp lệ');
  const c = (await res.json()) as Record<string, string>;
  if (c.aud !== env.GOOGLE_CLIENT_ID) throw unauthorized('Google token sai ứng dụng');
  return {
    provider: 'google',
    providerId: String(c.sub),
    email: c.email ? c.email.toLowerCase() : null,
    name: c.name || (c.email ? c.email.split('@')[0] : 'Người dùng Google'),
    avatarUrl: c.picture || null,
  };
}

// ---- Facebook: xác minh access token qua Graph API ----
async function verifyFacebook(accessToken: string): Promise<SocialProfile> {
  const url = 'https://graph.facebook.com/me?fields=id,name,email,picture.width(256)&access_token=' + encodeURIComponent(accessToken);
  const res = await fetch(url);
  if (!res.ok) throw unauthorized('Facebook token không hợp lệ');
  const u = (await res.json()) as { id: string; name?: string; email?: string; picture?: { data?: { url?: string } } };
  if (!u.id) throw unauthorized('Facebook token không hợp lệ');
  return {
    provider: 'facebook',
    providerId: String(u.id),
    email: u.email ? u.email.toLowerCase() : null,
    name: u.name || 'Người dùng Facebook',
    avatarUrl: u.picture?.data?.url || null,
  };
}

// ---- Apple: xác minh identity token (JWT RS256) qua JWKS công khai của Apple ----
let appleKeysCache: { keys: Record<string, KeyObject>; at: number } | null = null;
async function appleKey(kid: string): Promise<KeyObject> {
  if (!appleKeysCache || Date.now() - appleKeysCache.at > 6 * 3600_000) {
    const res = await fetch('https://appleid.apple.com/auth/keys');
    if (!res.ok) throw unauthorized('Không lấy được khoá Apple');
    const { keys } = (await res.json()) as { keys: Array<Record<string, string>> };
    const map: Record<string, KeyObject> = {};
    for (const jwk of keys) map[jwk.kid] = createPublicKey({ key: jwk as unknown as jwt.Secret, format: 'jwk' } as never);
    appleKeysCache = { keys: map, at: Date.now() };
  }
  const key = appleKeysCache.keys[kid];
  if (!key) throw unauthorized('Khoá Apple không khớp');
  return key;
}
async function verifyApple(identityToken: string): Promise<SocialProfile> {
  const decoded = jwt.decode(identityToken, { complete: true }) as { header?: { kid?: string } } | null;
  const kid = decoded?.header?.kid;
  if (!kid) throw unauthorized('Apple token không hợp lệ');
  const key = await appleKey(kid);
  let payload: jwt.JwtPayload;
  try {
    payload = jwt.verify(identityToken, key, { algorithms: ['RS256'], issuer: 'https://appleid.apple.com', audience: env.APPLE_CLIENT_ID }) as jwt.JwtPayload;
  } catch {
    throw unauthorized('Apple token không hợp lệ');
  }
  const email = typeof payload.email === 'string' ? payload.email.toLowerCase() : null;
  return {
    provider: 'apple',
    providerId: String(payload.sub),
    email,
    name: email ? email.split('@')[0] : 'Người dùng Apple',
    avatarUrl: null,
  };
}

/** Xác minh token của một provider và trả hồ sơ đã chuẩn hoá. */
export async function verifySocialToken(provider: SocialProvider, token: string): Promise<SocialProfile> {
  if (!token) throw badRequest('Thiếu token');
  if (!isProviderEnabled(provider)) throw badRequest(`Đăng nhập ${provider} chưa được cấu hình trên máy chủ`);
  if (provider === 'google') return verifyGoogle(token);
  if (provider === 'facebook') return verifyFacebook(token);
  if (provider === 'apple') return verifyApple(token);
  throw badRequest('Provider không hỗ trợ');
}
