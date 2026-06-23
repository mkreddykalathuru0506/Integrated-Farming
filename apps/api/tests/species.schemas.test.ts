import { describe, it, expect } from 'vitest';
import { CreateSpeciesSchema } from '../src/livestock/schemas';

describe('CreateSpeciesSchema', () => {
  it('accepts a valid species', () => {
    expect(
      CreateSpeciesSchema.safeParse({ code: 'EMU', name: 'Emu', trackingMode: 'BATCH' }).success,
    ).toBe(true);
  });
  it('rejects a code with spaces', () => {
    expect(
      CreateSpeciesSchema.safeParse({ code: 'bad code', name: 'X', trackingMode: 'BATCH' }).success,
    ).toBe(false);
  });
  it('rejects an unknown tracking mode', () => {
    expect(
      CreateSpeciesSchema.safeParse({ code: 'EMU', name: 'Emu', trackingMode: 'HERD' }).success,
    ).toBe(false);
  });
});
