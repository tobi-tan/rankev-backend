import { randomBytes } from 'node:crypto';
import { extname } from 'node:path';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { badRequest } from '../../lib/errors';
import { authenticate } from '../../plugins/auth';
import { putObject, UPLOAD_DIR } from './storage';

// Giữ export cũ để app.ts vẫn tạo/serve thư mục uploads local như trước.
export { UPLOAD_DIR };

const ALLOWED = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);

async function handleUpload(req: FastifyRequest, reply: FastifyReply, subdir: 'image' | 'scene') {
  const file = await req.file();
  if (!file) throw badRequest('No file uploaded (expected multipart field "file")');
  if (!ALLOWED.has(file.mimetype)) {
    throw badRequest('Unsupported file type — allowed: png, jpeg, webp, gif');
  }

  // Đọc toàn bộ vào buffer (giới hạn 8MB đã đặt ở @fastify/multipart).
  const buffer = await file.toBuffer();
  if (file.file.truncated) {
    throw badRequest('File too large (max 8MB)');
  }

  const ext = extname(file.filename || '') || `.${file.mimetype.split('/')[1] || 'png'}`;
  const key = `${subdir}/${randomBytes(16).toString('hex')}${ext}`;

  const url = await putObject(key, buffer, file.mimetype, `${req.protocol}://${req.hostname}`);
  return reply.code(201).send({ url });
}

export default async function uploadsRoutes(app: FastifyInstance): Promise<void> {
  // POST /uploads/image
  app.post('/image', { preHandler: authenticate }, (req, reply) => handleUpload(req, reply, 'image'));
  // POST /uploads/scene — scene images for Visual Scene Builder (Path)
  app.post('/scene', { preHandler: authenticate }, (req, reply) => handleUpload(req, reply, 'scene'));
}
