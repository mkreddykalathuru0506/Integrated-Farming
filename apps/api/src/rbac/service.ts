import { Prisma } from '@prisma/client';
import { prisma } from '../prisma';
import { AppError } from '../errors';
import {
  makeNotificationService,
  MockNotificationService,
} from '../notifications/notification.service';
import type { AddMemberInput, ChangeRoleInput } from './schemas';

export type MyFarm = { farmId: string; farmName: string; role: string };
export type FarmMember = {
  id: string; // membership id (audit middleware picks this up as entityId)
  userId: string;
  name: string;
  email: string;
  role: string;
  status: string;
};

type MembershipWithUser = Prisma.MembershipGetPayload<{
  include: { user: { select: { id: true; name: true; email: true } } };
}>;

const INCLUDE_USER = { user: { select: { id: true, name: true, email: true } } } as const;

function toFarmMember(m: MembershipWithUser): FarmMember {
  return {
    id: m.id,
    userId: m.userId,
    name: m.user.name,
    email: m.user.email,
    role: m.role,
    status: m.status,
  };
}

/** Farms the user is an ACTIVE member of, with their role in each. */
export async function getMyFarms(userId: string): Promise<MyFarm[]> {
  const memberships = await prisma.membership.findMany({
    where: { userId, status: 'ACTIVE' },
    include: { farm: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'asc' },
  });
  return memberships.map((m) => ({ farmId: m.farmId, farmName: m.farm.name, role: m.role }));
}

/** Members of a farm. Caller's farm access is enforced by middleware before this runs. */
export async function listFarmMembers(farmId: string): Promise<FarmMember[]> {
  const memberships = await prisma.membership.findMany({
    where: { farmId },
    include: INCLUDE_USER,
    orderBy: { createdAt: 'asc' },
  });
  return memberships.map(toFarmMember);
}

/**
 * Run `fn` in a SERIALIZABLE transaction, retrying on write-conflict (P2034).
 * The last-owner guard is a read-then-write invariant: under weaker isolation two
 * concurrent demotions could each see "another owner exists" and both commit,
 * leaving the farm ownerless. Serializable forces one of them to conflict; the
 * retry then re-reads the committed state and correctly hits the guard.
 */
async function inSerializableTxn<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await prisma.$transaction(fn, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (err) {
      if (
        attempt < 3 &&
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2034' // write conflict / deadlock — safe to retry
      ) {
        continue;
      }
      throw err;
    }
  }
}

/** Guard: the target OWNER may only lose OWNER if another ACTIVE OWNER remains. */
async function assertNotLastOwner(
  tx: Prisma.TransactionClient,
  farmId: string,
  targetUserId: string,
): Promise<void> {
  const otherOwners = await tx.membership.count({
    where: { farmId, role: 'OWNER', status: 'ACTIVE', userId: { not: targetUserId } },
  });
  if (otherOwners === 0) {
    throw new AppError(422, 'LAST_OWNER', 'A farm must keep at least one active owner');
  }
}

/**
 * Courtesy notification on add/reactivate. Mock channel by default (no spend);
 * best-effort — a failure here never fails the membership write.
 */
async function notifyAdded(
  farmId: string,
  actorUserId: string,
  recipient: string,
  role: string,
): Promise<void> {
  try {
    const farm = await prisma.farm.findUnique({ where: { id: farmId }, select: { name: true } });
    const subject = 'farm-member-added';
    const body = `You have been added to farm "${farm?.name ?? farmId}" as ${role}.`;
    const service = makeNotificationService();
    let result: Awaited<ReturnType<typeof service.send>>;
    try {
      result = await service.send({ channel: 'EMAIL', recipient, subject, body });
    } catch (err) {
      // Real provider not configured → fall back to mock so the send is still recorded.
      result = await new MockNotificationService().send();
      result.error = err instanceof Error ? err.message : 'send failed';
    }
    await prisma.notificationLog.create({
      data: {
        farmId,
        channel: 'EMAIL',
        recipient,
        subject,
        body,
        status: result.status,
        providerRef: result.providerRef,
        error: result.error,
        createdBy: actorUserId,
      },
    });
  } catch {
    /* best-effort only — never block the membership write on a notification failure */
  }
}

/**
 * Add an EXISTING user to the farm by email (v1: no invite flow), or reactivate a
 * previously SUSPENDED/INVITED membership with the new role.
 */
export async function addMember(
  farmId: string,
  actorUserId: string,
  input: AddMemberInput,
): Promise<{ member: FarmMember; created: boolean }> {
  const user = await prisma.user.findFirst({
    where: { email: { equals: input.email, mode: 'insensitive' }, deletedAt: null, isActive: true },
    select: { id: true, name: true, email: true },
  });
  if (!user) {
    throw new AppError(
      404,
      'USER_NOT_FOUND',
      'No account exists with this email. Ask them to register at the app first, then add them.',
    );
  }

  const existing = await prisma.membership.findUnique({
    where: { userId_farmId: { userId: user.id, farmId } },
  });
  if (existing?.status === 'ACTIVE') {
    throw new AppError(409, 'ALREADY_MEMBER', 'This user is already a member of this farm');
  }

  let membership: MembershipWithUser;
  try {
    membership = existing
      ? await prisma.membership.update({
          where: { id: existing.id },
          data: { role: input.role, status: 'ACTIVE' },
          include: INCLUDE_USER,
        })
      : await prisma.membership.create({
          data: { userId: user.id, farmId, role: input.role, status: 'ACTIVE' },
          include: INCLUDE_USER,
        });
  } catch (err) {
    // Two concurrent adds race the @@unique([userId, farmId]) — the loser lands here.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new AppError(409, 'ALREADY_MEMBER', 'This user is already a member of this farm');
    }
    throw err;
  }

  await notifyAdded(farmId, actorUserId, user.email, input.role);
  return { member: toFarmMember(membership), created: !existing };
}

/** Change an ACTIVE member's role. Last-owner guard runs race-safe in the transaction. */
export async function changeRole(
  farmId: string,
  targetUserId: string,
  input: ChangeRoleInput,
): Promise<FarmMember> {
  const membership = await inSerializableTxn(async (tx) => {
    const m = await tx.membership.findUnique({
      where: { userId_farmId: { userId: targetUserId, farmId } },
    });
    if (!m || m.status !== 'ACTIVE') throw new AppError(404, 'NOT_FOUND', 'Member not found');
    if (m.role === 'OWNER' && input.role !== 'OWNER') {
      await assertNotLastOwner(tx, farmId, targetUserId);
    }
    return tx.membership.update({
      where: { id: m.id },
      data: { role: input.role },
      include: INCLUDE_USER,
    });
  });
  return toFarmMember(membership);
}

/**
 * Deactivate a member → status SUSPENDED (there is no INACTIVE enum value; see spec).
 * `requireFarmAccess` rejects non-ACTIVE memberships, so access dies on their next request.
 * Deleting an already-SUSPENDED member → 404 (no longer active). Last-owner guard applies.
 */
export async function deactivateMember(farmId: string, targetUserId: string): Promise<FarmMember> {
  const membership = await inSerializableTxn(async (tx) => {
    const m = await tx.membership.findUnique({
      where: { userId_farmId: { userId: targetUserId, farmId } },
    });
    if (!m || m.status !== 'ACTIVE') throw new AppError(404, 'NOT_FOUND', 'Member not found');
    if (m.role === 'OWNER') {
      await assertNotLastOwner(tx, farmId, targetUserId);
    }
    return tx.membership.update({
      where: { id: m.id },
      data: { status: 'SUSPENDED' },
      include: INCLUDE_USER,
    });
  });
  return toFarmMember(membership);
}
