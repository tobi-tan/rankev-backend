import { mkdirSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { env } from '../../env';

// Thư mục lưu ảnh khi chạy local/dev (hoặc production không cấu hình R2).
export const UPLOAD_DIR = join(process.cwd(), 'uploads');

/** R2 đã cấu hình đủ 5 biến chưa? Nếu chưa → dùng local disk. */
export function isR2Configured(): boolean {
  return Boolean(
    env.R2_ACCOUNT_ID &&
      env.R2_ACCESS_KEY_ID &&
      env.R2_SECRET_ACCESS_KEY &&
      env.R2_BUCKET_NAME &&
      env.R2_PUBLIC_URL,
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let cachedClient: any = null;
async function getR2Client() {
  if (cachedClient) return cachedClient;
  const { S3Client } = await import('@aws-sdk/client-s3');
  cachedClient = new S3Client({
    region: 'auto',
    endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: env.R2_ACCESS_KEY_ID as string,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY as string,
    },
  });
  return cachedClient;
}

/** Cloudinary đã cấu hình đủ 3 biến chưa? (KHÔNG cần thẻ) */
export function isCloudinaryConfigured(): boolean {
  return Boolean(
    env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET,
  );
}

/** Upload lên Cloudinary bằng signed upload (fetch + crypto, không cần SDK). Trả secure_url. */
async function uploadToCloudinary(
  key: string,
  body: Buffer,
  contentType: string,
): Promise<string> {
  const { createHash } = await import('node:crypto');
  const timestamp = Math.floor(Date.now() / 1000);
  const publicId = key.replace(/\.[^/.]+$/, ''); // bỏ đuôi file (Cloudinary tự thêm)
  // Chữ ký: các param (trừ file/api_key/cloud_name/resource_type) sắp xếp a→z + api_secret.
  const toSign = `public_id=${publicId}&timestamp=${timestamp}`;
  const signature = createHash('sha1')
    .update(toSign + (env.CLOUDINARY_API_SECRET as string))
    .digest('hex');
  const form = new FormData();
  form.append('file', `data:${contentType};base64,${body.toString('base64')}`);
  form.append('api_key', env.CLOUDINARY_API_KEY as string);
  form.append('timestamp', String(timestamp));
  form.append('public_id', publicId);
  form.append('signature', signature);
  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}/auto/upload`,
    { method: 'POST', body: form },
  );
  if (!res.ok) {
    throw new Error('Cloudinary upload failed: ' + (await res.text()).slice(0, 200));
  }
  const data = (await res.json()) as { secure_url?: string };
  if (!data.secure_url) throw new Error('Cloudinary: thiếu secure_url');
  return data.secure_url;
}

/**
 * Lưu một object và trả về URL công khai. Ưu tiên: Cloudinary → R2 → local disk.
 */
export async function putObject(
  key: string,
  body: Buffer,
  contentType: string,
  requestBaseUrl: string,
): Promise<string> {
  if (isCloudinaryConfigured()) {
    return uploadToCloudinary(key, body, contentType);
  }
  if (isR2Configured()) {
    const client = await getR2Client();
    const { PutObjectCommand } = await import('@aws-sdk/client-s3');
    await client.send(
      new PutObjectCommand({
        Bucket: env.R2_BUCKET_NAME,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
    return `${(env.R2_PUBLIC_URL as string).replace(/\/$/, '')}/${key}`;
  }

  const dest = join(UPLOAD_DIR, key);
  mkdirSync(dirname(dest), { recursive: true });
  await writeFile(dest, body);
  const base = (env.PUBLIC_BASE_URL || requestBaseUrl || '').replace(/\/$/, '');
  return `${base}/uploads/${key}`;
}
