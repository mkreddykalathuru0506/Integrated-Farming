import type { Prisma } from '@prisma/client';
import { prisma } from '../prisma';
import { AppError } from '../errors';

export type ActivityFilters = {
  cursor?: string;
  limit: number;
  entity?: string;
  action?: string;
  userId?: string;
  from?: Date;
  to?: Date;
};

export type ActivityItem = {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  ip: string | null;
  createdAt: Date;
  user: { id: string; name: string } | null;
};

export type ActivityPage = { items: ActivityItem[]; nextCursor: string | null };

/**
 * Farm activity feed — reads the AuditLog written by the auditWrite middleware.
 * Newest first, cursor-paginated (cursor = AuditLog.id of the last item seen).
 * AuditLog.userId has no Prisma relation (by design — no migration for a read),
 * so user names are resolved with one batched user.findMany, mapped in JS.
 */
export async function listActivity(farmId: string, f: ActivityFilters): Promise<ActivityPage> {
  const where: Prisma.AuditLogWhereInput = {
    farmId,
    entity: f.entity,
    action: f.action,
    userId: f.userId,
    ...(f.from || f.to ? { createdAt: { gte: f.from, lte: f.to } } : {}),
  };

  // Validate the cursor against this farm's rows: deterministic 400 for an unknown
  // (or other-farm) cursor instead of relying on Prisma's engine behaviour.
  if (f.cursor) {
    const anchor = await prisma.auditLog.findFirst({
      where: { id: f.cursor, farmId },
      select: { id: true },
    });
    if (!anchor) throw new AppError(400, 'BAD_CURSOR', 'Unknown cursor');
  }

  const rows = await prisma.auditLog.findMany({
    where,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: f.limit + 1,
    ...(f.cursor ? { cursor: { id: f.cursor }, skip: 1 } : {}),
    select: {
      id: true,
      action: true,
      entity: true,
      entityId: true,
      ip: true,
      createdAt: true,
      userId: true,
    },
  });

  const hasMore = rows.length > f.limit;
  const page = rows.slice(0, f.limit);

  const userIds = [...new Set(page.map((r) => r.userId).filter((v): v is string => v !== null))];
  const users = userIds.length
    ? await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } })
    : [];
  const byId = new Map(users.map((u) => [u.id, u]));

  return {
    items: page.map((r) => ({
      id: r.id,
      action: r.action,
      entity: r.entity,
      entityId: r.entityId,
      ip: r.ip,
      createdAt: r.createdAt,
      // Deleted/system rows resolve to null.
      user: (r.userId && byId.get(r.userId)) || null,
    })),
    nextCursor: hasMore ? (page[page.length - 1]?.id ?? null) : null,
  };
}
