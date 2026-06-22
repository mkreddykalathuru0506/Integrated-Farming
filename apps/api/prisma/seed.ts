import { PrismaClient, UnitType, Role } from '@prisma/client';
import { hashPassword } from '../src/auth/password';

const prisma = new PrismaClient();

/**
 * Idempotent seed (brief §1.5): fixed IDs + upserts so re-running never duplicates
 * or clobbers data. Phase 0 seeds a demo farm + settings + one unit + a demo Owner user.
 */
async function main() {
  const farm = await prisma.farm.upsert({
    where: { id: 'demo-farm' },
    update: {},
    create: {
      id: 'demo-farm',
      name: 'Demo Integrated Farm',
      state: 'Telangana',
      district: 'Hyderabad',
      settings: {
        create: {
          timezone: 'Asia/Kolkata',
          currency: 'INR',
          defaultLocale: 'en',
          areaUnit: 'acre',
        },
      },
    },
  });

  await prisma.unit.upsert({
    where: { farmId_name: { farmId: farm.id, name: 'Poultry Shed 1' } },
    update: {},
    create: { farmId: farm.id, name: 'Poultry Shed 1', type: UnitType.POULTRY },
  });

  // Demo Owner. update:{} keeps an already-set password (idempotent, non-clobbering).
  const passwordHash = await hashPassword('OwnerPass123!');
  const owner = await prisma.user.upsert({
    where: { email: 'owner@demo.farm' },
    update: {},
    create: { id: 'demo-owner', email: 'owner@demo.farm', name: 'Demo Owner', passwordHash },
  });

  await prisma.membership.upsert({
    where: { userId_farmId: { userId: owner.id, farmId: farm.id } },
    update: {},
    create: { userId: owner.id, farmId: farm.id, role: Role.OWNER },
  });

  console.log(`Seeded farm "${farm.name}" + owner ${owner.email} (login: OwnerPass123!) — idempotent.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
