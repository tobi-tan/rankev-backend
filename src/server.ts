import { buildApp } from './app';
import { env } from './env';
import { pool } from './db';

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
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

void main();
