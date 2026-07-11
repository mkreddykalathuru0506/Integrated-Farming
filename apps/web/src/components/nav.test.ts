import { describe, expect, it } from 'vitest';
import { SECTIONS, visibleSections, type Role } from './nav';

/** Spec 11.2 §D1 visibility matrix. */
const MATRIX: Record<Role, string[]> = {
  OWNER: [
    'overview', 'livestock', 'daily', 'health', 'finance',
    'sales', 'maintenance', 'intelligence', 'reports', 'settings',
  ],
  MANAGER: [
    'overview', 'livestock', 'daily', 'health', 'finance',
    'sales', 'maintenance', 'intelligence', 'reports', 'settings',
  ],
  VETERINARIAN: ['overview', 'livestock', 'daily', 'health', 'intelligence', 'reports'],
  ACCOUNTANT: ['overview', 'livestock', 'finance', 'sales', 'intelligence', 'reports'],
  LABOUR: ['overview', 'livestock', 'daily', 'health', 'sales', 'maintenance'],
  BUYER: ['overview'],
};

describe('visibleSections', () => {
  for (const [role, expected] of Object.entries(MATRIX) as [Role, string[]][]) {
    it(`${role} sees exactly [${expected.join(', ')}]`, () => {
      expect(visibleSections(role).map((s) => s.key)).toEqual(expected);
    });
  }

  it('undefined role (pre-selection edge) sees every section', () => {
    expect(visibleSections(undefined)).toEqual(SECTIONS);
  });

  it('overview is first for every role (route fallback target)', () => {
    for (const role of Object.keys(MATRIX) as Role[]) {
      expect(visibleSections(role)[0]!.key).toBe('overview');
    }
  });
});
