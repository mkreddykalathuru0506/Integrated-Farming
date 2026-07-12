import { describe, it, expect } from 'vitest';
// Import both locale bundles DIRECTLY (not via the app's lazy `resources`) so parity
// still compares every key while hi stays code-split out of the production entry.
import { en as enBundle } from './i18n/en';
import { hi as hiBundle } from './i18n/hi';
import { CORE_NS } from './i18n';

/** Recursively collect dot-paths of leaf keys under an object. */
function leafPaths(obj: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) => {
    const path = prefix ? `${prefix}.${k}` : k;
    return v && typeof v === 'object' ? leafPaths(v as Record<string, unknown>, path) : [path];
  });
}

describe('i18n parity — Hindi covers the core namespaces', () => {
  const en = enBundle.translation as Record<string, Record<string, unknown>>;
  const hi = hiBundle.translation as Record<string, Record<string, unknown>>;

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
