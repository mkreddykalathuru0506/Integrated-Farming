import { describe, it, expect } from 'vitest';
import { resources, CORE_NS } from './i18n';

/** Recursively collect dot-paths of leaf keys under an object. */
function leafPaths(obj: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) => {
    const path = prefix ? `${prefix}.${k}` : k;
    return v && typeof v === 'object' ? leafPaths(v as Record<string, unknown>, path) : [path];
  });
}

describe('i18n parity — Hindi covers the core namespaces', () => {
  const en = resources.en.translation as Record<string, Record<string, unknown>>;
  const hi = resources.hi.translation as Record<string, Record<string, unknown>>;

  for (const ns of CORE_NS) {
    it(`hi.${ns} matches en.${ns} key-for-key`, () => {
      const enNs = en[ns];
      const hiNs = hi[ns];
      expect(enNs, `en missing namespace ${ns}`).toBeTruthy();
      expect(hiNs, `hi missing namespace ${ns}`).toBeTruthy();
      const enKeys = leafPaths(enNs!).sort();
      const hiKeys = leafPaths(hiNs!).sort();
      expect(hiKeys).toEqual(enKeys);
    });
  }
});
