import { prisma } from '../prisma';

export type MyFarm = { farmId: string; farmName: string; role: string };
export type FarmMember = {
  userId: string;
  name: string;
  email: string;
  role: string;
  status: string;
};

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
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: 'asc' },
  });
  return memberships.map((m) => ({
    userId: m.userId,
    name: m.user.name,
    email: m.user.email,
    role: m.role,
    status: m.status,
  }));
}
