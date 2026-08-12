import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Pool } from 'pg';
import { env } from '../env';

/**
 * Minimal forward-only SQL migration runner.
 * Applies every ./migrations/*.sql file (lexical order) exactly once,
 * tracking applied filenames in the `schema_migrations` table. Each file
 * runs inside its own transaction.
 *
 * Run with: npm run db:migrate
 */
async function main() {
  const dir = join(process.cwd(), 'migrations');
  const files = readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  const pool = new Pool({ connectionString: env.DATABASE_URL });
  const client = await pool.connect();

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name       TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

    const { rows } = await client.query<{ name: string }>('SELECT name FROM schema_migrations');
    const applied = new Set(rows.map((r) => r.name));

    let count = 0;
    for (const file of files) {
      if (applied.has(file)) continue;
      const sql = readFileSync(join(dir, file), 'utf8');
      process.stdout.write(`→ applying ${file} ... `);
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
        await client.query('COMMIT');
        process.stdout.write('done\n');
        count++;
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      }
    }

    console.log(count === 0 ? 'Already up to date.' : `Applied ${count} migration(s).`);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
