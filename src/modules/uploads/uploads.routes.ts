import { randomBytes } from 'node:crypto';
import { extname } from 'node:path';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { badRequest } from '../../lib/errors';
import { authenticate } from '../../plugins/auth';
import { putObject, UPLOAD_DIR } from './storage';

// Giữ export cũ để app.ts vẫn tạo/serve thư mục uploads local như trước.
export { UPLOAD_DIR };

const ALLOWED = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);
const ALLOWED_VIDEO = new Set(['video/mp4', 'video/webm', 'video/quicktime']);
export const IMAGE_MAX = 8 * 1024 * 1024;
export const VIDEO_MAX = 40 * 1024 * 1024; // = giới hạn multipart chung (app.ts)

async function handleUpload(req: FastifyRequest, reply: FastifyReply, subdir: 'image' | 'scene' | 'video') {
  const file = await req.file();
  if (!file) throw badRequest('No file uploaded (expected multipart field "file")');
  const isVideo = subdir === 'video';
  if (isVideo ? !ALLOWED_VIDEO.has(file.mimetype) : !ALLOWED.has(file.mimetype)) {
    throw badRequest(isVideo ? 'Unsupported file type — allowed: mp4, webm, mov' : 'Unsupported file type — allowed: png, jpeg, webp, gif');
  }

  // Đọc toàn bộ vào buffer (multipart giới hạn 40MB; ảnh tự giới hạn 8MB bên dưới).
  const buffer = await file.toBuffer();
  if (file.file.truncated || buffer.length > (isVideo ? VIDEO_MAX : IMAGE_MAX)) {
    throw badRequest(`File too large (max ${isVideo ? 40 : 8}MB)`);
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
  // POST /uploads/video — video ngắn cho ảnh bìa / lựa chọn (mp4, webm, mov ≤ 40MB)
  app.post('/video', { preHandler: authenticate }, (req, reply) => handleUpload(req, reply, 'video'));
}
