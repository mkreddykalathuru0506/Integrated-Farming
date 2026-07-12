import nodemailer, { type Transporter } from 'nodemailer';
import { env } from '../env';

/**
 * Minimal transactional mailer (slice 11.3) — OTP codes for login / password reset.
 *
 * - SMTP_HOST set → real SMTP transport (free-tier friendly: any provider, or a self-hosted relay).
 * - SMTP_HOST unset → nodemailer `jsonTransport` (message is serialized, nothing leaves the box);
 *   outside production the code is additionally logged so local devs can sign in.
 *
 * The transport is created per send (cheap for our OTP volume) so tests can `vi.mock` this
 * module without fighting a cached connection created at import time.
 */

export type OtpMailPurpose = 'LOGIN' | 'RESET_PASSWORD' | 'VERIFY_EMAIL';

const SUBJECTS: Record<OtpMailPurpose, string> = {
  LOGIN: 'Your IFM sign-in code',
  RESET_PASSWORD: 'Your IFM password reset code',
  VERIFY_EMAIL: 'Your IFM email verification code',
};

/** Pure content builder — unit-testable without any transport. */
export function otpMailContent(purpose: OtpMailPurpose, code: string): { subject: string; text: string } {
  return {
    subject: SUBJECTS[purpose],
    text:
      `Your one-time code is: ${code}\n\n` +
      `It is valid for 10 minutes and can be used once.\n` +
      `If you did not request this code, you can safely ignore this email.`,
  };
}

function makeTransport(): Transporter {
  if (env.SMTP_HOST) {
    return nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE === 'true',
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
    });
  }
  // No SMTP configured — serialize the message instead of sending (safe for dev/CI).
  return nodemailer.createTransport({ jsonTransport: true });
}

/** Send an OTP email. Callers treat delivery as best-effort (they catch and keep going). */
export async function sendOtpEmail(to: string, purpose: OtpMailPurpose, code: string): Promise<void> {
  const { subject, text } = otpMailContent(purpose, code);
  await makeTransport().sendMail({
    from: env.SMTP_FROM ?? 'IFM <no-reply@ifm.local>',
    to,
    subject,
    text,
  });
  if (!env.SMTP_HOST && env.NODE_ENV !== 'production') {
    console.log(`[otp] to=${to} purpose=${purpose} code=${code}`);
  }
}
