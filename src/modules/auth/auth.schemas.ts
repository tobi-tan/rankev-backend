import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters').max(200),
  handle: z
    .string()
    .regex(/^[a-zA-Z0-9_]{3,20}$/, 'Handle must be 3–20 chars: letters, numbers, underscore'),
  name: z.string().min(1).max(80),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// Quên mật khẩu: gửi mã 6 số · đặt lại bằng mã
export const forgotSchema = z.object({ email: z.string().email() });
export const resetSchema = z.object({
  email: z.string().email(),
  code: z.string().regex(/^\d{6}$/, 'Mã gồm 6 chữ số'),
  password: z.string().min(8, 'Password must be at least 8 characters').max(200),
});

export const socialSchema = z.object({
  provider: z.enum(['google', 'facebook', 'apple']),
  token: z.string().min(1), // ID token (Google/Apple) hoặc access token (Facebook)
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
