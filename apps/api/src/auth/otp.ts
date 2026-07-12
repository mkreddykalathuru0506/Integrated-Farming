import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import type { OtpPurpose, User } from '@prisma/client';
import { prisma } from '../prisma';
import { env } from '../env';
import { AppError } from '../errors';
import { sendOtpEmail } from '../notifications/mailer';

/** One-time-code rules (slice 11.3). */
export const OTP_TTL_MS = 10 * 60 * 1000; // codes live 10 minutes
export const OTP_RESEND_COOLDOWN_SEC = 60; // one issue per (user, purpose) per minute
export const OTP_MAX_ATTEMPTS = 5; // verification attempts per code

/** HMAC-SHA256(code, OTP_PEPPER) hex — what we store; the raw code is never persisted. */
export function hashOtpCode(code: string): string {
  return createHmac('sha256', env.OTP_PEPPER).update(code).digest('hex');
}

/** Cryptographically random 6-digit code, zero-padded ("004217" is valid). */
function generateCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}

/**
 * Issue an OTP for (email, purpose) and deliver it by email.
 *
 * Enumeration-proof by design: the caller ALWAYS returns the same generic 200 — this
 * function does nothing observable when the email is unknown or the account inactive.
 * Within the 60s resend cooldown no new code is created (same generic response).
 * Otherwise any previous active code for (user, purpose) is retired first, so exactly
 * one code is valid at a time.
 */
export async function requestOtp(email: string, purpose: OtpPurpose): Promise<void> {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.isActive) return;

  const newest = await prisma.otpToken.findFirst({
    where: { userId: user.id, purpose },
    orderBy: { createdAt: 'desc' },
  });
  if (newest && Date.now() - newest.createdAt.getTime() < OTP_RESEND_COOLDOWN_SEC * 1000) return;

  await prisma.otpToken.updateMany({
    where: { userId: user.id, purpose, consumedAt: null },
    data: { consumedAt: new Date() },
  });

  const code = generateCode();
  await prisma.otpToken.create({
    data: {
      userId: user.id,
      purpose,
      channel: 'email',
      destination: user.email,
      codeHash: hashOtpCode(code),
      expiresAt: new Date(Date.now() + OTP_TTL_MS),
    },
  });

  // Delivery is best-effort: a mail outage must not reveal anything to the caller
  // (and the row exists, so a resend after the cooldown still works).
  try {
    await sendOtpEmail(user.email, purpose, code);
  } catch (err) {
    console.error('[otp] delivery failed', err);
  }
}

/**
 * Verify + consume an OTP. Every failure — unknown user, no active code, attempt cap,
 * wrong code — throws the SAME 401 OTP_INVALID so responses carry no signal.
 * The attempt counter is incremented atomically BEFORE comparing, so a brute-forcer
 * burns the cap even on parallel guesses; after 5 attempts the code is dead even if
 * the 6th guess is correct.
 */
export async function verifyOtp(email: string, purpose: OtpPurpose, code: string): Promise<User> {
  const fail = () => new AppError(401, 'OTP_INVALID', 'Invalid or expired code');

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.isActive) throw fail();

  const token = await prisma.otpToken.findFirst({
    where: { userId: user.id, purpose, consumedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
  });
  if (!token) throw fail();

  const bumped = await prisma.otpToken.update({
    where: { id: token.id },
    data: { attempts: { increment: 1 } },
  });
  if (bumped.attempts > OTP_MAX_ATTEMPTS) throw fail();

  const expected = Buffer.from(token.codeHash, 'hex');
  const actual = Buffer.from(hashOtpCode(code), 'hex');
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) throw fail();

  await prisma.otpToken.update({ where: { id: token.id }, data: { consumedAt: new Date() } });
  return user;
}
