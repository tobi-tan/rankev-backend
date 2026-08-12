import type { PoolConfig } from 'pg';
import { env } from '../env';

/**
 * Cấu hình pg Pool dùng chung cho cả app và migration runner.
 *
 * SSL mặc định TẮT — chạy đúng cho local, mạng nội bộ Railway, và Railway public
 * proxy (proxy nối plain TCP). Chỉ bật khi đặt biến `DATABASE_SSL=true` (dùng cho
 * các Postgres cloud bắt buộc TLS, vd Supabase/Neon/RDS).
 */
export function pgPoolConfig(): PoolConfig {
  const ssl = env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false;
  return { connectionString: env.DATABASE_URL, ssl };
}
