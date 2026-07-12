import { Prisma } from '@prisma/client';
import { prisma } from '../prisma';
import { AppError } from '../errors';
import { sha256 } from '../auth/tokens';
import type { PublicUser } from '../auth/service';
import type { UpdateMeInput } from './schemas';

/** Update the caller's own profile. Phone is globally unique → 409 PHONE_TAKEN on conflict. */
export async function updateMe(userId: string, input: UpdateMeInput): Promise<PublicUser> {
  try {
    const user = await prisma.user.update({ where: { id: userId }, data: input });
    return { id: user.id, email: user.email, name: user.name, locale: user.locale };
  } catch (err) {
    // Unique-constraint race: email is not updatable here, so P2002 can only mean phone.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new AppError(409, 'PHONE_TAKEN', 'Phone number already in use');
    }
    throw err;
  }
}

export type SessionView = {
  id: string;
  createdAt: Date;
  lastUsedAt: Date | null;
  ip: string | null;
  userAgent: string | null;
};

/** Active sessions = unrevoked, unexpired refresh tokens; newest first. */
export async function listSessions(userId: string): Promise<SessionView[]> {
  const rows = await prisma.refreshToken.findMany({
    where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
    select: { id: true, createdAt: true, lastUsedAt: true, ip: true, userAgent: true },
  });
  return rows;
}

/** Revoke one of the caller's own sessions. A row that isn't theirs is a plain 404 (no IDOR). */
export async function revokeSession(userId: string, sessionId: string): Promise<void> {
  const row = await prisma.refreshToken.findFirst({ where: { id: sessionId, userId } });
  if (!row) throw new AppError(404, 'NOT_FOUND', 'Session not found');
  if (!row.revokedAt) {
    await prisma.refreshToken.update({ where: { id: row.id }, data: { revokedAt: new Date() } });
  }
}

/** Revoke every active session except the one presenting `refreshToken`. Returns the count. */
export async function revokeOtherSessions(userId: string, refreshToken: string): Promise<number> {
  const result = await prisma.refreshToken.updateMany({
    where: {
      userId,
      revokedAt: null,
      expiresAt: { gt: new Date() },
      tokenHash: { not: sha256(refreshToken) },
    },
    data: { revokedAt: new Date() },
  });
  return result.count;
}
