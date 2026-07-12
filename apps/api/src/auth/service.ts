import { prisma } from '../prisma';
import { env } from '../env';
import { AppError } from '../errors';
import { hashPassword, verifyPassword } from './password';
import { signAccessToken, createRefreshToken, sha256 } from './tokens';
import { verifyOtp } from './otp';
import type { ChangePasswordInput, LoginInput, RegisterInput } from './schemas';

export type PublicUser = { id: string; email: string; name: string; locale: string };

/** Request-derived metadata recorded on RefreshToken rows (slice 11.3 session list). */
export type SessionMeta = { ip?: string; userAgent?: string };

type UserRow = { id: string; email: string; name: string; locale: string };

function toPublic(u: UserRow): PublicUser {
  return { id: u.id, email: u.email, name: u.name, locale: u.locale };
}

function refreshExpiry(): Date {
  return new Date(Date.now() + env.REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000);
}

async function issueTokens(userId: string, meta: SessionMeta = {}, lastUsedAt?: Date) {
  const accessToken = await signAccessToken(userId);
  const { token: refreshToken, tokenHash } = createRefreshToken();
  const row = await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash,
      expiresAt: refreshExpiry(),
      ip: meta.ip,
      userAgent: meta.userAgent,
      lastUsedAt,
    },
  });
  // sessionId = the RefreshToken row id — what GET /api/me/sessions lists and DELETE revokes.
  return { accessToken, refreshToken, sessionId: row.id };
}

async function audit(userId: string, action: string, entityId: string, ip?: string) {
  await prisma.auditLog.create({ data: { userId, action, entity: 'User', entityId, ip } });
}

/**
 * Best-effort audit — /api/auth and /api/me are outside the auditWrite middleware, so
 * security-sensitive account actions write their row directly; a logging failure must
 * never fail the (already committed) action itself.
 */
export async function auditSafe(
  userId: string,
  action: string,
  entityId: string,
  ip?: string,
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: { farmId: null, userId, action, entity: 'User', entityId, ip },
    });
  } catch (err) {
    console.error('[audit] write failed', err);
  }
}

export async function register(input: RegisterInput): Promise<PublicUser> {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw new AppError(409, 'EMAIL_TAKEN', 'Email already registered');
  const passwordHash = await hashPassword(input.password);
  const user = await prisma.user.create({
    data: { email: input.email, name: input.name, passwordHash, phone: input.phone },
  });
  await audit(user.id, 'user.register', user.id);
  return toPublic(user);
}

export async function login(input: LoginInput, meta: SessionMeta = {}) {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  const ok = user ? await verifyPassword(user.passwordHash, input.password) : false;
  // Identical error for unknown email and bad password — no user enumeration.
  if (!user || !ok || !user.isActive) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
  }
  const tokens = await issueTokens(user.id, meta);
  await audit(user.id, 'user.login', user.id, meta.ip);
  return { ...tokens, user: toPublic(user) };
}

/** OTP login: verify + consume the code, then issue the exact same token pair as login(). */
export async function otpLogin(email: string, code: string, meta: SessionMeta = {}) {
  const user = await verifyOtp(email, 'LOGIN', code);
  const tokens = await issueTokens(user.id, meta);
  await auditSafe(user.id, 'user.login', user.id, meta.ip);
  return { ...tokens, user: toPublic(user) };
}

export async function refresh(refreshToken: string, meta: SessionMeta = {}) {
  const record = await prisma.refreshToken.findUnique({ where: { tokenHash: sha256(refreshToken) } });
  if (!record || record.revokedAt || record.expiresAt < new Date()) {
    throw new AppError(401, 'INVALID_REFRESH', 'Invalid or expired refresh token');
  }
  const now = new Date();
  // Rotate: revoke the presented token (stamping its last use), then issue a fresh pair.
  await prisma.refreshToken.update({
    where: { id: record.id },
    data: { revokedAt: now, lastUsedAt: now },
  });
  const user = await prisma.user.findUnique({ where: { id: record.userId } });
  if (!user || !user.isActive) throw new AppError(401, 'INVALID_REFRESH', 'Invalid refresh token');
  // The replacement row carries lastUsedAt = now so the session reads as freshly active.
  const tokens = await issueTokens(user.id, meta, now);
  return { ...tokens, user: toPublic(user) };
}

export async function logout(refreshToken: string): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { tokenHash: sha256(refreshToken), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function getMe(userId: string): Promise<PublicUser> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.isActive) throw new AppError(401, 'UNAUTHORIZED', 'Not authenticated');
  return toPublic(user);
}

/**
 * Password reset via RESET_PASSWORD OTP. On success every refresh token the user holds
 * is revoked — a reset means the credential may have been compromised, so all sessions die.
 */
export async function resetPassword(
  email: string,
  code: string,
  newPassword: string,
  ip?: string,
): Promise<void> {
  const user = await verifyOtp(email, 'RESET_PASSWORD', code);
  const passwordHash = await hashPassword(newPassword);
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
  await prisma.refreshToken.updateMany({
    where: { userId: user.id, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  await auditSafe(user.id, 'user.password.reset', user.id, ip);
}

/**
 * Authenticated password change. Requires the current password, then revokes every OTHER
 * session (the caller keeps the refresh token they presented).
 */
export async function changePassword(
  userId: string,
  input: ChangePasswordInput,
  ip?: string,
): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.isActive) throw new AppError(401, 'UNAUTHORIZED', 'Not authenticated');
  const ok = await verifyPassword(user.passwordHash, input.currentPassword);
  if (!ok) throw new AppError(401, 'INVALID_CREDENTIALS', 'Current password is incorrect');
  const passwordHash = await hashPassword(input.newPassword);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } });
  await prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null, tokenHash: { not: sha256(input.refreshToken) } },
    data: { revokedAt: new Date() },
  });
  await auditSafe(userId, 'user.password.change', userId, ip);
}
