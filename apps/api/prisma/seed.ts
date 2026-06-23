import { PrismaClient, UnitType, type Role } from '@prisma/client';
import { hashPassword } from '../src/auth/password';
import { seedFarmReference } from '../src/livestock/reference';

const prisma = new PrismaClient();

// Shared dev password for all seeded demo accounts (dev only).
const DEMO_PASSWORD = 'Passw0rd!';

const DEMO_USERS: Array<{ id: string; email: string; name: string; role: Role }> = [
  { id: 'demo-owner', email: 'owner@demo.farm', name: 'Demo Owner', role: 'OWNER' },
  { id: 'demo-manager', email: 'manager@demo.farm', name: 'Demo Manager', role: 'MANAGER' },
  { id: 'demo-vet', email: 'vet@demo.farm', name: 'Demo Vet', role: 'VETERINARIAN' },
  { id: 'demo-accountant', email: 'accountant@demo.farm', name: 'Demo Accountant', role: 'ACCOUNTANT' },
  { id: 'demo-labour', email: 'labour@demo.farm', name: 'Demo Labour', role: 'LABOUR' },
  { id: 'demo-buyer', email: 'buyer@demo.farm', name: 'Demo Buyer', role: 'BUYER' },
];

/**
 * Idempotent seed (brief §1.5): fixed IDs + upserts. Seeds a demo farm with one
 * user per role, one unit, and a SECOND farm (with its own owner) to prove
 * cross-farm isolation. Demo accounts share the dev password "Passw0rd!".
 */
async function main() {
  const passwordHash = await hashPassword(DEMO_PASSWORD);

  const farm = await prisma.farm.upsert({
    where: { id: 'demo-farm' },
    update: {},
    create: {
      id: 'demo-farm',
      name: 'Demo Integrated Farm',
      state: 'Telangana',
      district: 'Hyderabad',
      settings: { create: { timezone: 'Asia/Kolkata', currency: 'INR', defaultLocale: 'en' } },
    },
  });

  await prisma.unit.upsert({
    where: { farmId_name: { farmId: farm.id, name: 'Poultry Shed 1' } },
    update: {},
    create: { farmId: farm.id, name: 'Poultry Shed 1', type: UnitType.POULTRY },
  });

  for (const u of DEMO_USERS) {
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: { passwordHash, name: u.name },
      create: { id: u.id, email: u.email, name: u.name, passwordHash },
    });
    await prisma.membership.upsert({
      where: { userId_farmId: { userId: user.id, farmId: farm.id } },
      update: { role: u.role },
      create: { userId: user.id, farmId: farm.id, role: u.role },
    });
  }

  // Second farm + owner — exists to prove no cross-farm access.
  const other = await prisma.farm.upsert({
    where: { id: 'other-farm' },
    update: {},
    create: { id: 'other-farm', name: 'Other Farm', state: 'Karnataka', settings: { create: {} } },
  });
  const otherOwner = await prisma.user.upsert({
    where: { email: 'owner@other.farm' },
    update: { passwordHash, name: 'Other Owner' },
    create: { id: 'other-owner', email: 'owner@other.farm', name: 'Other Owner', passwordHash },
  });
  await prisma.membership.upsert({
    where: { userId_farmId: { userId: otherOwner.id, farmId: other.id } },
    update: { role: 'OWNER' },
    create: { userId: otherOwner.id, farmId: other.id, role: 'OWNER' },
  });

  // Livestock reference catalogue (species/breeds/stages) for both farms.
  await seedFarmReference(prisma, farm.id);
  await seedFarmReference(prisma, other.id);

  // A demo chicken batch on the demo farm — a target for daily logging + e2e.
  const chicken = await prisma.species.findFirst({ where: { farmId: farm.id, code: 'CHICKEN' } });
  if (chicken) {
    const firstStage = await prisma.lifecycleStage.findFirst({
      where: { farmId: farm.id, speciesId: chicken.id },
      orderBy: { sequence: 'asc' },
    });
    await prisma.batch.upsert({
      where: { farmId_code: { farmId: farm.id, code: 'DEMO-BR-1' } },
      update: {},
      create: {
        farmId: farm.id,
        code: 'DEMO-BR-1',
        speciesId: chicken.id,
        currentStageId: firstStage?.id,
        initialCount: 100,
        currentCount: 100,
        qrCode: 'IFM-B-demo-br-1',
      },
    });
  }

  console.log(
    `Seeded "${farm.name}" (6 roles + livestock reference) + "${other.name}" (owner@other.farm). ` +
      `Dev password for all: ${DEMO_PASSWORD} — idempotent.`,
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
