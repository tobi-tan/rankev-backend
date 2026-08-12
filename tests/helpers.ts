import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app';

export { buildApp };

/** Short unique handle (matches ^[a-zA-Z0-9_]{3,20}$). */
export function uniqHandle(): string {
  return 'u' + Math.random().toString(36).slice(2, 12);
}

export function bearer(token: string): Record<string, string> {
  return { authorization: `Bearer ${token}` };
}

export interface RegisteredUser {
  user: { id: string; handle: string; name: string };
  accessToken: string;
  refreshToken: string;
}

export async function registerUser(
  app: FastifyInstance,
  over: Partial<{ email: string; password: string; handle: string; name: string }> = {},
): Promise<RegisteredUser> {
  const handle = over.handle ?? uniqHandle();
  const payload = {
    email: over.email ?? `${handle}_${Date.now()}@test.local`,
    password: over.password ?? 'supersecret',
    handle,
    name: over.name ?? 'Test User',
  };
  const res = await app.inject({ method: 'POST', url: '/auth/register', payload });
  if (res.statusCode !== 201) throw new Error(`register failed: ${res.statusCode} ${res.body}`);
  return res.json();
}

export async function createRankie(
  app: FastifyInstance,
  token: string,
  over: Record<string, unknown> = {},
) {
  const res = await app.inject({
    method: 'POST',
    url: '/posts',
    headers: bearer(token),
    payload: {
      type: 'rankie',
      title: 'Test Rankie',
      votingType: 'single',
      chartType: 'bar',
      options: [{ label: 'A' }, { label: 'B' }, { label: 'C' }],
      ...over,
    },
  });
  if (res.statusCode !== 201) throw new Error(`createRankie failed: ${res.statusCode} ${res.body}`);
  return res.json();
}

export async function createPath(app: FastifyInstance, token: string, over: Record<string, unknown> = {}) {
  const res = await app.inject({
    method: 'POST',
    url: '/posts',
    headers: bearer(token),
    payload: {
      type: 'path',
      title: 'Test Path',
      questions: [
        {
          key: 'q1',
          text: 'Bắt đầu?',
          isEntry: true,
          answers: [
            { label: 'Trái', targetType: 'question', targetKey: 'q2' },
            { label: 'Phải', targetType: 'ending', targetKey: 'Kết A' },
          ],
        },
        {
          key: 'q2',
          text: 'Tiếp?',
          answers: [
            { label: 'Lên', targetType: 'ending', targetKey: 'Kết B' },
            { label: 'Xuống', targetType: 'ending', targetKey: 'Kết A' },
          ],
        },
      ],
      endings: [{ name: 'Kết A', emoji: '🏆' }, { name: 'Kết B', emoji: '💀' }],
      ...over,
    },
  });
  if (res.statusCode !== 201) throw new Error(`createPath failed: ${res.statusCode} ${res.body}`);
  return res.json();
}

export async function createExam(app: FastifyInstance, token: string, over: Record<string, unknown> = {}) {
  const res = await app.inject({
    method: 'POST',
    url: '/posts',
    headers: bearer(token),
    payload: {
      type: 'deck',
      deckMode: 'exam',
      title: 'Test Exam',
      passingScore: 5,
      questions: [
        { text: '2+2?', votingType: 'single', points: 5, options: [{ label: '3' }, { label: '4', correct: true }] },
        { text: 'Thủ đô VN?', votingType: 'single', points: 5, options: [{ label: 'Hà Nội', correct: true }, { label: 'HCM' }] },
      ],
      ...over,
    },
  });
  if (res.statusCode !== 201) throw new Error(`createExam failed: ${res.statusCode} ${res.body}`);
  return res.json();
}

