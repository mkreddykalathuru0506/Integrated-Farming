import { describe, it, expect } from 'vitest';
import { UpdateSettingsSchema, CreateUnitSchema } from '../src/farms/schemas';

describe('UpdateSettingsSchema — gstThresholdPaise (integer paise)', () => {
  it('accepts a non-negative integer', () => {
    expect(UpdateSettingsSchema.safeParse({ gstThresholdPaise: 400000000 }).success).toBe(true);
  });
  it('accepts a digit string', () => {
    expect(UpdateSettingsSchema.safeParse({ gstThresholdPaise: '400000000' }).success).toBe(true);
  });
  it('accepts null (clearing)', () => {
    expect(UpdateSettingsSchema.safeParse({ gstThresholdPaise: null }).success).toBe(true);
  });
  it('rejects a negative value', () => {
    expect(UpdateSettingsSchema.safeParse({ gstThresholdPaise: -5 }).success).toBe(false);
  });
  it('rejects a float (money must be integer paise)', () => {
    expect(UpdateSettingsSchema.safeParse({ gstThresholdPaise: 1.5 }).success).toBe(false);
  });
});

describe('CreateUnitSchema — type enum', () => {
  it('accepts a valid unit type', () => {
    expect(CreateUnitSchema.safeParse({ name: 'Shed', type: 'POULTRY' }).success).toBe(true);
  });
  it('rejects an unknown unit type', () => {
    expect(CreateUnitSchema.safeParse({ name: 'Shed', type: 'NOPE' }).success).toBe(false);
  });
});
