import { buildApp } from './app';
import { env } from './env';
import { pool } from './db';
import { ensureClassics } from './modules/classics/classics';

async function main() {
  const app = await buildApp();

  const close = async (signal: string) => {
    app.log.info(`Received ${signal}, shutting down...`);
    await app.close();
    await pool.end();
    process.exit(0);
  };
  process.on('SIGINT', () => void close('SIGINT'));
  process.on('SIGTERM', () => void close('SIGTERM'));

  try {
    await app.listen({ port: env.PORT, host: '0.0.0.0' });
    // Nội dung kinh điển của @rankev (idempotent, chạy nền). Tắt: CLASSICS_SEED=off.
    if (process.env.CLASSICS_SEED !== 'off') {
      ensureClassics((m) => app.log.info(m)).catch((e) => app.log.error({ err: e }, '[classics] lỗi tạo nội dung kinh điển'));
    }
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

void main();
