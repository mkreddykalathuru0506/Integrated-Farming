import { describe, expect, it } from 'vitest';
import { panelFromPath, pathForSection, resolveRoute, sectionFromPath } from './router';
import { SECTIONS, visibleSections } from './nav';

describe('router path mapping', () => {
  it('maps overview to the root path and others to /key', () => {
    expect(pathForSection('overview')).toBe('/');
    expect(pathForSection('finance')).toBe('/finance');
    expect(pathForSection('settings')).toBe('/settings');
  });

  it('maps a non-first panel to /key/panel and ignores panel for overview', () => {
    expect(pathForSection('finance', 'invoices')).toBe('/finance/invoices');
    expect(pathForSection('overview', 'dashboard')).toBe('/');
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

  it('parses the panel key from the second segment', () => {
    expect(panelFromPath('/finance')).toBeUndefined();
    expect(panelFromPath('/finance/invoices')).toBe('invoices');
    expect(panelFromPath('/finance/invoices/extra')).toBe('invoices');
    expect(panelFromPath('/finance/')).toBeUndefined();
    expect(panelFromPath('/finance/invoices/')).toBe('invoices');
    expect(panelFromPath('//finance')).toBeUndefined();
    expect(panelFromPath('/')).toBeUndefined();
  });

  it('round-trips every real section key', () => {
    for (const s of SECTIONS) {
      expect(sectionFromPath(pathForSection(s.key))).toBe(s.key);
    }
  });
});

describe('resolveRoute canonicalisation', () => {
  const rows: [string, string, string, string][] = [
    // [incoming, sectionKey, panelKey, canonicalPath]
    ['/', 'overview', 'dashboard', '/'],
    ['/finance', 'finance', 'feed', '/finance'],
    ['/finance/feed', 'finance', 'feed', '/finance'], // first panel spelled out → short form
    ['/finance/invoices', 'finance', 'invoices', '/finance/invoices'],
    ['/finance/nope', 'finance', 'feed', '/finance'],
    ['/reports/whatever', 'reports', 'reports', '/reports'],
    ['/nope/anything', 'overview', 'dashboard', '/'],
  ];

  it.each(rows)('%s → %s/%s (canonical %s)', (incoming, sectionKey, panelKey, canonicalPath) => {
    expect(resolveRoute(incoming, SECTIONS)).toEqual({ sectionKey, panelKey, canonicalPath });
  });

  it('canonicalises a section hidden for the role to the first visible section', () => {
    const labour = visibleSections('LABOUR');
    expect(resolveRoute('/finance', labour)).toEqual({
      sectionKey: 'overview',
      panelKey: 'dashboard',
      canonicalPath: '/',
    });
    expect(resolveRoute('/settings/units', labour).canonicalPath).toBe('/');
  });

  it('round-trips every real section+panel combination in canonical form', () => {
    for (const s of SECTIONS) {
      s.panels.forEach((p, i) => {
        const canonical = pathForSection(s.key, i === 0 ? undefined : p.key);
        expect(resolveRoute(canonical, SECTIONS)).toEqual({
          sectionKey: s.key,
          panelKey: p.key,
          canonicalPath: canonical,
        });
      });
    }
  });
});
