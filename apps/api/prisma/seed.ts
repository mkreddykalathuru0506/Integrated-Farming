import { PrismaClient, UnitType } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Idempotent seed (brief §1.5): fixed IDs + upserts so re-running never duplicates
 * or clobbers data. Phase 0 seeds a demo farm + settings + one unit.
 * (Users/roles are seeded with auth in slice 0.2/0.3.)
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

  console.log(`Seeded farm "${farm.name}" (${farm.id}) — idempotent.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
