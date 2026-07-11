import { targetFor, type NavTarget } from './commands';

/**
 * Notification-bell domain logic (pure, unit-tested). v1 composes two merged
 * endpoints client-side — GET /api/farm/risk?status=OPEN and GET /api/farm/due
 * — until the unified inbox API lands. Unread state is a per-farm lastSeen
 * timestamp in localStorage; no server round-trip.
 */

export type BellSeverity = 'INFO' | 'WARNING' | 'CRITICAL';
export type BellKind = 'risk' | 'vaccination' | 'maintenance' | 'emi' | 'insurance' | 'task';

export type BellItem = {
  /** Stable across polls: `${kind}:${sourceId}`. */
  id: string;
  kind: BellKind;
  severity: BellSeverity;
  /** i18n template + params — translation happens at render (never raw English here). */
  textKey: string;
  textParams?: Record<string, unknown>;
  /** ISO timestamp the unread/grouping rules run on (due date or created-at). */
  at: string;
  route: NavTarget;
};

/** GET /api/farm/risk?status=OPEN response items (subset the bell uses). */
export type OpenRisk = {
  id: string;
  type: string;
  severity: BellSeverity;
  reason: string;
  createdAt: string;
};

/** GET /api/farm/due?days=7 response (subset the bell uses). */
export type DueRollup = {
  vaccinations: { batch: { id: string; code: string }; due: { id: string }[] }[];
  maintenance: { id: string; name: string; nextDueDate: string | null; asset: { name: string } }[];
  emiDue: { id: string; lender: string; nextDueDate: string | null }[];
  policiesExpiring: { id: string; provider: string; endDate: string }[];
  tasksToday: { id: string }[];
};

const IST_OFFSET_MS = 330 * 60_000;

/** YYYY-MM-DD of an instant in Asia/Kolkata. */
function istDay(iso: string): string {
  return new Date(new Date(iso).getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

/** Midnight (IST) of the day containing `nowIso`, as an ISO instant. */
export function istMidnight(nowIso: string): string {
  return new Date(`${istDay(nowIso)}T00:00:00+05:30`).toISOString();
}

/** Severity for a dated reminder: due/overdue now → WARNING, still upcoming → INFO. */
function reminderSeverity(atIso: string, nowIso: string): BellSeverity {
  return atIso <= nowIso ? 'WARNING' : 'INFO';
}

/**
 * Normalize the two feeds into a single sorted list (severity desc, then newest
 * first). Undated vaccinations/tasks are "due today" → pinned to today's IST
 * midnight so the unread rule stays deterministic within a day.
 */
export function normalizeBell(risks: OpenRisk[], due: DueRollup | undefined, nowIso: string): BellItem[] {
  const items: BellItem[] = [];
  const today = istMidnight(nowIso);

  for (const r of risks) {
    items.push({
      id: `risk:${r.id}`,
      kind: 'risk',
      severity: r.severity,
      textKey: 'bell.kinds.risk',
      textParams: { reason: r.reason },
      at: new Date(r.createdAt).toISOString(),
      route: targetFor('intelligence', 'weather'),
    });
  }
  for (const v of due?.vaccinations ?? []) {
    items.push({
      id: `vaccination:${v.batch.id}`,
      kind: 'vaccination',
      severity: 'WARNING',
      textKey: 'bell.kinds.vaccination',
      // `n` (not `count`) — count is i18next's plural-resolution trigger.
      textParams: { batch: v.batch.code, n: v.due.length },
      at: today,
      route: targetFor('health', 'vaccination'),
    });
  }
  for (const m of due?.maintenance ?? []) {
    const at = m.nextDueDate ? new Date(m.nextDueDate).toISOString() : today;
    items.push({
      id: `maintenance:${m.id}`,
      kind: 'maintenance',
      severity: reminderSeverity(at, nowIso),
      textKey: 'bell.kinds.maintenance',
      textParams: { name: m.name, asset: m.asset.name },
      at,
      route: targetFor('maintenance', 'assets'),
    });
  }
  for (const l of due?.emiDue ?? []) {
    const at = l.nextDueDate ? new Date(l.nextDueDate).toISOString() : today;
    items.push({
      id: `emi:${l.id}`,
      kind: 'emi',
      severity: reminderSeverity(at, nowIso),
      textKey: 'bell.kinds.emi',
      textParams: { lender: l.lender },
      at,
      route: targetFor('finance', 'emi'),
    });
  }
  for (const p of due?.policiesExpiring ?? []) {
    const at = new Date(p.endDate).toISOString();
    items.push({
      id: `insurance:${p.id}`,
      kind: 'insurance',
      severity: reminderSeverity(at, nowIso),
      textKey: 'bell.kinds.insurance',
      textParams: { provider: p.provider },
      at,
      route: targetFor('finance', 'emi'),
    });
  }
  const taskCount = due?.tasksToday.length ?? 0;
  if (taskCount > 0) {
    items.push({
      id: 'task:today',
      kind: 'task',
      severity: 'INFO',
      textKey: 'bell.kinds.tasks',
      textParams: { n: taskCount },
      at: today,
      route: targetFor('daily', 'tasks'),
    });
  }

  const rank: Record<BellSeverity, number> = { CRITICAL: 3, WARNING: 2, INFO: 1 };
  return items.sort((a, b) => rank[b.severity] - rank[a.severity] || b.at.localeCompare(a.at));
}

/**
 * Badge count: items already due (at <= now) and newer than lastSeen.
 * Future-dated reminders are listed under "Upcoming" but never counted —
 * this keeps the badge deterministic with a single stored timestamp.
 */
export function unreadCount(items: BellItem[], lastSeenIso: string, nowIso: string): number {
  return items.filter((i) => i.at <= nowIso && i.at > lastSeenIso).length;
}

export type BellGroups = { today: BellItem[]; earlier: BellItem[]; upcoming: BellItem[] };

/** Split for display: Upcoming (future), Today (same IST day), Earlier (older). */
export function groupBell(items: BellItem[], nowIso: string): BellGroups {
  const day = istDay(nowIso);
  const groups: BellGroups = { today: [], earlier: [], upcoming: [] };
  for (const i of items) {
    if (i.at > nowIso) groups.upcoming.push(i);
    else if (istDay(i.at) === day) groups.today.push(i);
    else groups.earlier.push(i);
  }
  return groups;
}

const LAST_SEEN_PREFIX = 'ifm.bell.lastSeen.';
const EPOCH = new Date(0).toISOString();

/** Per-farm lastSeen read (epoch default; storage failures → epoch). */
export function readLastSeen(farmId: string): string {
  try {
    return localStorage.getItem(LAST_SEEN_PREFIX + farmId) ?? EPOCH;
  } catch {
    return EPOCH;
  }
}

/** Per-farm lastSeen write (storage failures ignored — private mode). */
export function writeLastSeen(farmId: string, iso: string): void {
  try {
    localStorage.setItem(LAST_SEEN_PREFIX + farmId, iso);
  } catch {
    /* ignore storage failures (private mode) */
  }
}
