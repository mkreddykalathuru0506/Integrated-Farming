import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const migrationsDir = fileURLToPath(new URL('../prisma/migrations', import.meta.url));

/**
 * Reversibility guard (Brief DoD: "reversible migration — up AND down"). Every migration
 * directory must ship a non-empty hand-written down.sql alongside Prisma's forward migration.sql.
 */
describe('migration reversibility', () => {
  const dirs = readdirSync(migrationsDir).filter((d) => statSync(`${migrationsDir}/${d}`).isDirectory());

  it('has at least one migration', () => {
    expect(dirs.length).toBeGreaterThan(0);
  });

  for (const dir of dirs) {
    it(`${dir} has up + non-empty down.sql`, () => {
      const up = readFileSync(`${migrationsDir}/${dir}/migration.sql`, 'utf8');
      expect(up.trim().length, `${dir}/migration.sql empty`).toBeGreaterThan(0);
      const down = readFileSync(`${migrationsDir}/${dir}/down.sql`, 'utf8');
      expect(down.trim().length, `${dir}/down.sql empty`).toBeGreaterThan(0);
    });
  }
});
