import type { PoolConfig } from 'pg';
import { env } from '../env';

/**
 * Cấu hình pg Pool dùng chung cho cả app và migration runner.
 *
 * Bật SSL khi kết nối tới host CÔNG KHAI (không phải localhost hay
 * `*.railway.internal`) — cần thiết khi dùng Railway public proxy hoặc phần lớn
 * Postgres cloud. Local/dev và mạng nội bộ Railway thì tắt SSL.
 */
export function pgPoolConfig(): PoolConfig {
  return { connectionString: env.DATABASE_URL, ssl: sslFor(env.DATABASE_URL) };
}

function sslFor(url: string): PoolConfig['ssl'] {
  try {
    const host = new URL(url).hostname;
    if (host === 'localhost' || host === '127.0.0.1' || host.endsWith('.railway.internal')) {
      return false;
    }
    // Railway proxy / managed PG dùng chứng chỉ không nằm trong CA mặc định → không verify.
    return { rejectUnauthorized: false };
  } catch {
    return false;
  }
}
