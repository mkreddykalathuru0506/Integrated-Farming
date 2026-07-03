import { describe, expect, it } from 'vitest';
import { pathForSection, sectionFromPath } from './router';
import { SECTIONS } from './nav';

describe('router path mapping', () => {
  it('maps overview to the root path and others to /key', () => {
    expect(pathForSection('overview')).toBe('/');
    expect(pathForSection('finance')).toBe('/finance');
    expect(pathForSection('settings')).toBe('/settings');
  });

  it('parses the section key from a pathname', () => {
    expect(sectionFromPath('/')).toBe('overview');
    expect(sectionFromPath('')).toBe('overview');
    expect(sectionFromPath('/finance')).toBe('finance');
    expect(sectionFromPath('/livestock')).toBe('livestock');
    // trailing/extra segments and slashes are ignored
    expect(sectionFromPath('/finance/')).toBe('finance');
    expect(sectionFromPath('//finance')).toBe('finance');
    expect(sectionFromPath('/sales/extra/bits')).toBe('sales');
  });

  it('round-trips every real section key', () => {
    for (const s of SECTIONS) {
      expect(sectionFromPath(pathForSection(s.key))).toBe(s.key);
    }
  });
});
