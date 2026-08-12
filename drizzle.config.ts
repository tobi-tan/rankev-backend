import { defineConfig } from 'drizzle-kit';
import 'dotenv/config';

// Optional: used only if you later adopt drizzle-kit to auto-generate migrations
// from src/db/schema.ts. Sprint 1 ships a hand-written SQL migration under
// ./migrations that is applied by `npm run db:migrate`.
export default defineConfig({
  schema: './src/db/schema.ts',
  out: './migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? '',
  },
});
