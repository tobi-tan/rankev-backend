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

/**
 * Lưu một object và trả về URL công khai.
 * - R2 cấu hình sẵn → PUT lên bucket, trả `${R2_PUBLIC_URL}/${key}`.
 * - Ngược lại → ghi xuống local disk, trả URL tuyệt đối (ưu tiên PUBLIC_BASE_URL,
 *   nếu không có thì dùng base suy ra từ request).
 */
export async function putObject(
  key: string,
  body: Buffer,
  contentType: string,
  requestBaseUrl: string,
): Promise<string> {
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
