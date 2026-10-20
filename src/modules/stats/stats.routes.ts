import type { FastifyInstance } from 'fastify';
import { getShowcase } from './stats.service';

export async function statsRoutes(app: FastifyInstance): Promise<void> {
  // GET /stats/showcase — số liệu thật cho slide giới thiệu (công khai, đệm 5 phút)
  app.get('/stats/showcase', async () => getShowcase());
}
