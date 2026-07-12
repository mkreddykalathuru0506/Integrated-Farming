import type { LucideIcon } from 'lucide-react';
import { SECTIONS, visibleSections, type Role } from './nav';

/**
 * Command-palette + keyboard-shortcut registry (pure, unit-tested).
 * One source of truth shared by CommandPalette, ShortcutHelp and useHotkeys.
 */

export type NavTarget = { key: string; panel?: string };

export type CommandItem = {
  /** Stable id: 'nav:finance', 'nav:finance/invoices', 'act:new-invoice'. */
  id: string;
  group: 'navigate' | 'actions';
  /** i18n key — resolve with t() at render time. */
  labelKey: string;
  icon?: LucideIcon;
  /** Display-only shortcut hint, e.g. ['G', 'F']. */
  shortcut?: string[];
  /** Where the item navigates (all v1 commands are navigation). */
  target: NavTarget;
};

/** `g` + letter → section key (1-second chord window). */
export const GOTO: Readonly<Record<string, string>> = {
  d: 'overview',
  l: 'livestock',
  o: 'daily',
  h: 'health',
  f: 'finance',
  s: 'sales',
  m: 'maintenance',
  i: 'intelligence',
  r: 'reports',
  t: 'settings',
};

export type Shortcut = { keys: string[]; labelKey: string; group: 'general' | 'goto' };

/** Rendered by ShortcutHelp (grouped) and as palette hints. */
export const SHORTCUTS: Shortcut[] = [
  { keys: ['Ctrl', 'K'], labelKey: 'shortcuts.openPalette', group: 'general' },
  { keys: ['/'], labelKey: 'shortcuts.search', group: 'general' },
  { keys: ['?'], labelKey: 'shortcuts.help', group: 'general' },
  { keys: ['Esc'], labelKey: 'shortcuts.close', group: 'general' },
  ...Object.entries(GOTO).map(
    ([letter, section]): Shortcut => ({
      keys: ['G', letter.toUpperCase()],
      labelKey: `nav.${section}`,
      group: 'goto',
    }),
  ),
];

/** Reverse lookup: section key → its g-sequence hint (['G','F']), if any. */
function gotoHint(sectionKey: string): string[] | undefined {
  const entry = Object.entries(GOTO).find(([, s]) => s === sectionKey);
  return entry ? ['G', entry[0].toUpperCase()] : undefined;
}

/** Palette action rows (v1 = navigate to the flow; create-dialogs arrive with the panel sweep). */
const ACTIONS: { id: string; labelKey: string; target: Required<NavTarget>; roles: Role[] }[] = [
  {
    id: 'act:new-batch',
    labelKey: 'palette.actions.newBatch',
    target: { key: 'livestock', panel: 'batches' },
    roles: ['OWNER', 'MANAGER'],
  },
  {
    id: 'act:new-expense',
    labelKey: 'palette.actions.newExpense',
    target: { key: 'finance', panel: 'expenses' },
    roles: ['OWNER', 'MANAGER', 'ACCOUNTANT'],
  },
  {
    id: 'act:daily-log',
    labelKey: 'palette.actions.dailyLog',
    target: { key: 'daily', panel: 'logs' },
    roles: ['OWNER', 'MANAGER', 'VETERINARIAN', 'ACCOUNTANT', 'LABOUR'],
  },
  {
    id: 'act:attendance',
    labelKey: 'palette.actions.attendance',
    target: { key: 'daily', panel: 'workers' },
    roles: ['OWNER', 'MANAGER'],
  },
  {
    id: 'act:new-invoice',
    labelKey: 'palette.actions.newInvoice',
    target: { key: 'finance', panel: 'invoices' },
    roles: ['OWNER', 'ACCOUNTANT'],
  },
  {
    id: 'act:log-temp',
    labelKey: 'palette.actions.logTemp',
    target: { key: 'sales', panel: 'coldstorage' },
    roles: ['OWNER', 'MANAGER', 'LABOUR'],
  },
];

/**
 * Canonical navigate() arguments for a section/panel pair: the first panel of a
 * section lives at the bare section path, so it gets no panel argument.
 */
export function targetFor(sectionKey: string, panelKey?: string): NavTarget {
  const section = SECTIONS.find((s) => s.key === sectionKey);
  if (!section || !panelKey || section.panels[0]?.key === panelKey) return { key: sectionKey };
  return { key: sectionKey, panel: panelKey };
}

/**
 * Build the role-filtered palette items: section rows, panel rows (multi-panel
 * sections only), then action rows. Actions are double-gated: the role must be
 * allowed AND the destination section must be visible for that role.
 */
export function buildCommands(role: Role | undefined): CommandItem[] {
  const sections = visibleSections(role);
  const items: CommandItem[] = [];

  for (const s of sections) {
    items.push({
      id: `nav:${s.key}`,
      group: 'navigate',
      labelKey: `nav.${s.key}`,
      icon: s.icon,
      shortcut: gotoHint(s.key),
      target: { key: s.key },
    });
  }
  for (const s of sections) {
    if (s.panels.length < 2) continue;
    for (const p of s.panels) {
      items.push({
        id: `nav:${s.key}/${p.key}`,
        group: 'navigate',
        labelKey: `nav.panels.${p.key}`,
        icon: s.icon,
        target: targetFor(s.key, p.key),
      });
    }
  }
  const visibleKeys = new Set(sections.map((s) => s.key));
  for (const a of ACTIONS) {
    if (role && !a.roles.includes(role)) continue;
    if (!visibleKeys.has(a.target.key)) continue;
    items.push({
      id: a.id,
      group: 'actions',
      labelKey: a.labelKey,
      target: targetFor(a.target.key, a.target.panel),
    });
  }
  return items;
}

/** g-chord state: timestamp when `g` was pressed, or null when disarmed. */
export type ChordState = { armedAt: number | null };

export const CHORD_WINDOW_MS = 1000;

/**
 * Pure g-sequence reducer: `g` arms a 1-second window; the next key inside the
 * window resolves to a section jump (unknown letters just reset). Exported for
 * unit tests (armed → timeout → reset transitions).
 */
export function nextChord(
  state: ChordState,
  key: string,
  now: number,
): { state: ChordState; goto?: string } {
  if (key === 'g') return { state: { armedAt: now } };
  if (state.armedAt !== null && now - state.armedAt <= CHORD_WINDOW_MS) {
    const section = GOTO[key];
    return { state: { armedAt: null }, ...(section ? { goto: section } : {}) };
  }
  return { state: { armedAt: null } };
}
