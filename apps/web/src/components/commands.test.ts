import { describe, expect, it } from 'vitest';
import { buildCommands, nextChord, targetFor, CHORD_WINDOW_MS } from './commands';
import { SECTIONS } from './nav';

describe('targetFor', () => {
  it('drops the panel for a section first panel (bare path is canonical)', () => {
    expect(targetFor('finance', 'feed')).toEqual({ key: 'finance' });
    expect(targetFor('livestock')).toEqual({ key: 'livestock' });
  });

  it('keeps a non-first panel', () => {
    expect(targetFor('finance', 'invoices')).toEqual({ key: 'finance', panel: 'invoices' });
  });
});

describe('buildCommands role gating', () => {
  const ids = (role: Parameters<typeof buildCommands>[0]) => buildCommands(role).map((c) => c.id);

  it('OWNER sees every section, panel and action', () => {
    const owner = ids('OWNER');
    for (const s of SECTIONS) expect(owner).toContain(`nav:${s.key}`);
    expect(owner).toContain('nav:finance/invoices');
    expect(owner).toContain('act:new-batch');
    expect(owner).toContain('act:new-invoice');
    expect(owner).toContain('act:log-temp');
  });

  it('LABOUR sees no finance/settings/reports/intelligence and no invoice action', () => {
    const labour = ids('LABOUR');
    expect(labour).not.toContain('nav:finance');
    expect(labour).not.toContain('nav:settings');
    expect(labour).not.toContain('nav:reports');
    expect(labour).not.toContain('nav:intelligence');
    expect(labour).not.toContain('nav:finance/invoices');
    expect(labour).not.toContain('act:new-invoice');
    expect(labour).not.toContain('act:new-expense');
    // operational entries remain
    expect(labour).toContain('nav:daily');
    expect(labour).toContain('act:daily-log');
    expect(labour).toContain('act:log-temp');
  });

  it('ACCOUNTANT loses actions whose destination section is hidden', () => {
    const acct = ids('ACCOUNTANT');
    // role list allows daily-log, but the daily section is hidden for ACCOUNTANT
    expect(acct).not.toContain('act:daily-log');
    expect(acct).not.toContain('act:attendance');
    expect(acct).toContain('act:new-invoice');
    expect(acct).toContain('act:new-expense');
  });

  it('undefined role (pre-selection) shows everything — the server still guards', () => {
    const all = ids(undefined);
    for (const s of SECTIONS) expect(all).toContain(`nav:${s.key}`);
  });
});

describe('nextChord (g-sequence reducer)', () => {
  it('g arms, then a section letter within the window fires', () => {
    const armed = nextChord({ armedAt: null }, 'g', 1000);
    expect(armed.state.armedAt).toBe(1000);
    const fired = nextChord(armed.state, 'f', 1000 + CHORD_WINDOW_MS);
    expect(fired.goto).toBe('finance');
    expect(fired.state.armedAt).toBeNull();
  });

  it('resets after the 1-second window', () => {
    const armed = nextChord({ armedAt: null }, 'g', 1000);
    const late = nextChord(armed.state, 'f', 1000 + CHORD_WINDOW_MS + 1);
    expect(late.goto).toBeUndefined();
    expect(late.state.armedAt).toBeNull();
  });

  it('unknown letters inside the window just disarm', () => {
    const armed = nextChord({ armedAt: null }, 'g', 0);
    const reset = nextChord(armed.state, 'x', 100);
    expect(reset.goto).toBeUndefined();
    expect(reset.state.armedAt).toBeNull();
  });

  it('non-g keys pass through when disarmed', () => {
    const out = nextChord({ armedAt: null }, 'f', 0);
    expect(out.goto).toBeUndefined();
    expect(out.state.armedAt).toBeNull();
  });

  it('g re-arms the window', () => {
    const first = nextChord({ armedAt: null }, 'g', 0);
    const second = nextChord(first.state, 'g', 500);
    expect(second.state.armedAt).toBe(500);
  });
});
