import { prisma } from '../prisma';
import { env } from '../env';
import { AppError } from '../errors';
import { hashPassword, verifyPassword } from './password';
import { signAccessToken, createRefreshToken, sha256 } from './tokens';
import type { LoginInput, RegisterInput } from './schemas';

export type PublicUser = { id: string; email: string; name: string; locale: string };

type UserRow = { id: string; email: string; name: string; locale: string };

function toPublic(u: UserRow): PublicUser {
  return { id: u.id, email: u.email, name: u.name, locale: u.locale };
}

function refreshExpiry(): Date {
  return new Date(Date.now() + env.REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000);
}

async function issueTokens(userId: string) {
  const accessToken = await signAccessToken(userId);
  const { token: refreshToken, tokenHash } = createRefreshToken();
  await prisma.refreshToken.create({ data: { userId, tokenHash, expiresAt: refreshExpiry() } });
  return { accessToken, refreshToken };
}

async function audit(userId: string, action: string, entityId: string, ip?: string) {
  await prisma.auditLog.create({ data: { userId, action, entity: 'User', entityId, ip } });
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

export async function login(input: LoginInput, ip?: string) {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  const ok = user ? await verifyPassword(user.passwordHash, input.password) : false;
  // Identical error for unknown email and bad password — no user enumeration.
  if (!user || !ok || !user.isActive) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
  }
  const tokens = await issueTokens(user.id);
  await audit(user.id, 'user.login', user.id, ip);
  return { ...tokens, user: toPublic(user) };
}

export async function refresh(refreshToken: string) {
  const record = await prisma.refreshToken.findUnique({ where: { tokenHash: sha256(refreshToken) } });
  if (!record || record.revokedAt || record.expiresAt < new Date()) {
    throw new AppError(401, 'INVALID_REFRESH', 'Invalid or expired refresh token');
  }
  // Rotate: revoke the presented token, then issue a fresh pair.
  await prisma.refreshToken.update({ where: { id: record.id }, data: { revokedAt: new Date() } });
  const user = await prisma.user.findUnique({ where: { id: record.userId } });
  if (!user || !user.isActive) throw new AppError(401, 'INVALID_REFRESH', 'Invalid refresh token');
  const tokens = await issueTokens(user.id);
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
