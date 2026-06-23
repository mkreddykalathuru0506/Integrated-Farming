import type { PrismaClient, TrackingMode } from '@prisma/client';

/** System-default species + breeds + lifecycle-stage templates (owner decision #1). */
export const DEFAULT_SPECIES = [
  { code: 'CHICKEN', name: 'Chicken', trackingMode: 'BATCH', breeds: ['Broiler', 'Layer (BV-300)', 'Country (Desi)'], stages: ['Chick', 'Grower', 'Finisher'] },
  { code: 'QUAIL', name: 'Quail', trackingMode: 'BATCH', breeds: ['Japanese'], stages: ['Chick', 'Grower', 'Adult'] },
  { code: 'DUCK', name: 'Duck', trackingMode: 'BATCH', breeds: ['Khaki Campbell'], stages: ['Duckling', 'Grower', 'Adult'] },
  { code: 'TURKEY', name: 'Turkey', trackingMode: 'BATCH', breeds: ['Broad Breasted'], stages: ['Poult', 'Grower', 'Adult'] },
  { code: 'RABBIT', name: 'Rabbit', trackingMode: 'BATCH', breeds: ['New Zealand White'], stages: ['Kit', 'Grower', 'Adult'] },
  { code: 'GOAT', name: 'Goat', trackingMode: 'BATCH', breeds: ['Boer', 'Osmanabadi'], stages: ['Kid', 'Grower', 'Adult'] },
  { code: 'SHEEP', name: 'Sheep', trackingMode: 'BATCH', breeds: ['Nellore'], stages: ['Lamb', 'Grower', 'Adult'] },
  { code: 'CATTLE', name: 'Cattle', trackingMode: 'INDIVIDUAL', breeds: ['Holstein Friesian', 'Gir', 'Sahiwal'], stages: ['Calf', 'Heifer', 'Adult'] },
  { code: 'BUFFALO', name: 'Buffalo', trackingMode: 'INDIVIDUAL', breeds: ['Murrah'], stages: ['Calf', 'Heifer', 'Adult'] },
  { code: 'MUSHROOM', name: 'Mushroom', trackingMode: 'BATCH', breeds: ['Oyster', 'Button', 'Milky'], stages: ['Spawn', 'Pinning', 'Harvest'] },
] as const satisfies ReadonlyArray<{
  code: string;
  name: string;
  trackingMode: TrackingMode;
  breeds: readonly string[];
  stages: readonly string[];
}>;

/**
 * Idempotently seed the system-default species/breeds/stages into a farm.
 * Uses `update: {}` so re-runs never clobber user edits (Brief §1.5/§6).
 */
export async function seedFarmReference(db: PrismaClient, farmId: string): Promise<void> {
  for (const s of DEFAULT_SPECIES) {
    const species = await db.species.upsert({
      where: { farmId_code: { farmId, code: s.code } },
      update: {},
      create: { farmId, code: s.code, name: s.name, trackingMode: s.trackingMode, isSystemDefault: true },
    });

    for (const breed of s.breeds) {
      await db.breed.upsert({
        where: { farmId_speciesId_name: { farmId, speciesId: species.id, name: breed } },
        update: {},
        create: { farmId, speciesId: species.id, name: breed, isSystemDefault: true },
      });
    }

    for (const [i, name] of s.stages.entries()) {
      await db.lifecycleStage.upsert({
        where: { farmId_speciesId_name: { farmId, speciesId: species.id, name } },
        update: {},
        create: {
          farmId,
          speciesId: species.id,
          name,
          sequence: i + 1,
          isTerminal: i === s.stages.length - 1,
          isSystemDefault: true,
        },
      });
    }
  }
}
