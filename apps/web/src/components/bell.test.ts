import { describe, expect, it } from 'vitest';
import { groupBell, istMidnight, normalizeBell, unreadCount, type BellItem, type DueRollup } from './bell';

const NOW = '2026-07-11T09:00:00.000Z'; // 14:30 IST

function item(at: string, severity: BellItem['severity'] = 'INFO'): BellItem {
  return { id: `x:${at}`, kind: 'risk', severity, textKey: 'bell.kinds.risk', at, route: { key: 'intelligence' } };
}

const EMPTY_DUE: DueRollup = {
  vaccinations: [],
  maintenance: [],
  emiDue: [],
  policiesExpiring: [],
  tasksToday: [],
};

describe('unreadCount', () => {
  it('counts past items newer than lastSeen, excludes future-dated reminders', () => {
    const items = [
      item('2026-07-11T08:00:00.000Z'), // past, after lastSeen → counted
      item('2026-07-13T00:00:00.000Z'), // future (upcoming) → never counted
      item('2026-07-01T00:00:00.000Z'), // before lastSeen → read
    ];
    expect(unreadCount(items, '2026-07-05T00:00:00.000Z', NOW)).toBe(1);
  });

  it('does not count an item exactly at lastSeen', () => {
    const at = '2026-07-10T10:00:00.000Z';
    expect(unreadCount([item(at)], at, NOW)).toBe(0);
  });

  it('lastSeen = epoch counts every past item', () => {
    const items = [item('2026-07-11T08:00:00.000Z'), item('2020-01-01T00:00:00.000Z')];
    expect(unreadCount(items, new Date(0).toISOString(), NOW)).toBe(2);
  });
});

describe('normalizeBell', () => {
  it('maps risks and pins undated vaccinations/tasks to IST midnight of today', () => {
    const items = normalizeBell(
      [{ id: 'r1', type: 'HEAT_STRESS', severity: 'CRITICAL', reason: 'Too hot', createdAt: '2026-07-11T05:00:00.000Z' }],
      {
        ...EMPTY_DUE,
        vaccinations: [{ batch: { id: 'b1', code: 'BR-01' }, due: [{ id: 'v1' }, { id: 'v2' }] }],
        tasksToday: [{ id: 't1' }, { id: 't2' }, { id: 't3' }],
      },
      NOW,
    );
    expect(items.map((i) => i.id)).toEqual(['risk:r1', 'vaccination:b1', 'task:today']);
    const midnight = istMidnight(NOW);
    expect(midnight).toBe('2026-07-10T18:30:00.000Z');
    expect(items[1]!.at).toBe(midnight);
    expect(items[1]!.textParams).toEqual({ batch: 'BR-01', n: 2 });
    expect(items[2]!.textParams).toEqual({ n: 3 });
  });

  it('sorts severity desc then newest first, and grades reminders by overdue-ness', () => {
    const items = normalizeBell(
      [],
      {
        ...EMPTY_DUE,
        emiDue: [{ id: 'l1', lender: 'NABARD', nextDueDate: '2026-07-10T00:00:00.000Z' }], // overdue → WARNING
        policiesExpiring: [{ id: 'p1', provider: 'LIC', endDate: '2026-07-15T00:00:00.000Z' }], // upcoming → INFO
        maintenance: [
          { id: 'm1', name: 'Oil change', nextDueDate: '2026-07-09T00:00:00.000Z', asset: { name: 'Genset' } },
        ],
      },
      NOW,
    );
    expect(items.map((i) => [i.id, i.severity])).toEqual([
      ['emi:l1', 'WARNING'],
      ['maintenance:m1', 'WARNING'],
      ['insurance:p1', 'INFO'],
    ]);
    expect(items[0]!.route).toEqual({ key: 'finance', panel: 'emi' });
    expect(items[1]!.route).toEqual({ key: 'maintenance' }); // assets = first panel → bare
  });
});

describe('groupBell', () => {
  it('splits into today / earlier / upcoming by IST day', () => {
    const groups = groupBell(
      [
        item('2026-07-11T08:00:00.000Z'), // today (13:30 IST)
        item('2026-07-10T17:00:00.000Z'), // 22:30 IST on the 10th → earlier
        item('2026-07-10T19:00:00.000Z'), // 00:30 IST on the 11th → today
        item('2026-07-14T00:00:00.000Z'), // future → upcoming
      ],
      NOW,
    );
    expect(groups.today.map((i) => i.at)).toEqual([
      '2026-07-11T08:00:00.000Z',
      '2026-07-10T19:00:00.000Z',
    ]);
    expect(groups.earlier.map((i) => i.at)).toEqual(['2026-07-10T17:00:00.000Z']);
    expect(groups.upcoming.map((i) => i.at)).toEqual(['2026-07-14T00:00:00.000Z']);
  });
});
