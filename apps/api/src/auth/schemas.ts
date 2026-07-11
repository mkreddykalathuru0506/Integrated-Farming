import { z } from 'zod';

export const RegisterSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(120),
  password: z.string().min(8).max(200),
  phone: z.string().min(5).max(20).optional(),
});

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const RefreshSchema = z.object({ refreshToken: z.string().min(1) });
export const LogoutSchema = z.object({ refreshToken: z.string().min(1) });

// --- OTP + password lifecycle (slice 11.3) ---

const OtpCode = z.string().regex(/^[0-9]{6}$/, 'Code must be 6 digits');

export const OtpRequestSchema = z.object({
  email: z.string().email(),
  purpose: z.enum(['LOGIN', 'RESET_PASSWORD']),
});

export const OtpVerifySchema = z.object({
  email: z.string().email(),
  purpose: z.literal('LOGIN'), // RESET_PASSWORD codes are consumed by POST /api/auth/reset
  code: OtpCode,
});

export const ForgotSchema = z.object({ email: z.string().email() });

export const ResetSchema = z.object({
  email: z.string().email(),
  code: OtpCode,
  newPassword: z.string().min(8).max(200),
});

export const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(200),
  refreshToken: z.string().min(1),
});

export type RegisterInput = z.infer<typeof RegisterSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;
export type ChangePasswordInput = z.infer<typeof ChangePasswordSchema>;
