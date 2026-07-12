import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Activity,
  Bird,
  Boxes,
  ClipboardList,
  FileText,
  HeartPulse,
  History,
  ReceiptIndianRupee,
  Settings as SettingsIcon,
  ShoppingCart,
  Sparkles,
  Users,
  Wallet,
  Wheat,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import { useActivity, type ActivityItem } from '../api/audit.hooks';
import { fmtDate, fmtDateTime } from '../lib/format';
import {
  Button,
  EmptyState,
  PanelError,
  PanelHeading,
  PanelNote,
  Select,
  Skeleton,
} from '../ui';

/**
 * Entity filter options — the audit middleware derives `entity` from the first
 * path segment under /api/farm/* (capitalized), so this list mirrors app.ts.
 */
const ENTITIES = [
  'Farm',
  'Members',
  'Units',
  'Species',
  'Batches',
  'Animals',
  'Mortality',
  'Movements',
  'Workers',
  'Attendance',
  'Schedules',
  'Tasks',
  'Logs',
  'Health',
  'Breeding',
  'Hatchery',
  'Feed',
  'Expenses',
  'Loans',
  'Insurance',
  'Customers',
  'Vendors',
  'Invoices',
  'Orders',
  'Coldstorage',
  'Processing',
  'Dispatches',
  'Assets',
  'Byproducts',
  'Market',
  'Risk',
  'Alerts',
  'Reports',
] as const;

/** Server `action` filter is an exact string — composable only for the CRUD verbs. */
const VERBS = ['create', 'update', 'delete'] as const;

const ENTITY_ICON: Record<string, LucideIcon> = {
  Farm: SettingsIcon,
  Members: Users,
  Units: Boxes,
  Species: Bird,
  Batches: Bird,
  Animals: Bird,
  Mortality: Bird,
  Movements: Bird,
  Workers: Users,
  Attendance: Users,
  Schedules: ClipboardList,
  Tasks: ClipboardList,
  Logs: ClipboardList,
  Health: HeartPulse,
  Breeding: HeartPulse,
  Hatchery: HeartPulse,
  Feed: Wheat,
  Expenses: ReceiptIndianRupee,
  Loans: Wallet,
  Insurance: Wallet,
  Customers: Users,
  Vendors: Users,
  Invoices: FileText,
  Orders: ShoppingCart,
  Coldstorage: ShoppingCart,
  Processing: ShoppingCart,
  Dispatches: ShoppingCart,
  Assets: Wrench,
  Byproducts: Wrench,
  Market: Sparkles,
  Risk: Sparkles,
  Alerts: Sparkles,
  Reports: FileText,
};

/** Locale-aware "2 hours ago" without a date library (same approach as the bell). */
function relTime(iso: string, locale: string): string {
  const diffMs = new Date(iso).getTime() - Date.now();
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  const abs = Math.abs(diffMs);
  if (abs < 3_600_000) return rtf.format(Math.round(diffMs / 60_000), 'minute');
  if (abs < 86_400_000) return rtf.format(Math.round(diffMs / 3_600_000), 'hour');
  return rtf.format(Math.round(diffMs / 86_400_000), 'day');
}

function ActivityRow({ item }: { item: ActivityItem }) {
  const { t, i18n } = useTranslation();
  const Icon = ENTITY_ICON[item.entity] ?? Activity;
  // "expenses.update" → verb "update"; "batches.advance" → verb "advance".
  const verb = item.action.split('.').pop() ?? item.action;
  const label = `${t(`activity.entity.${item.entity}`, item.entity)} · ${t(`activity.verb.${verb}`, verb)}`;
  return (
    <li className="flex items-start gap-3 rounded-md border border-border bg-card px-3 py-2.5">
      <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-secondary text-secondary-foreground">
        <Icon className="h-4 w-4" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground">
          {item.user?.name ?? t('activity.system')}
          <span aria-hidden> · </span>
          <span title={fmtDateTime(item.createdAt)}>
            {relTime(item.createdAt, i18n.resolvedLanguage ?? 'en')}
          </span>
        </p>
      </div>
    </li>
  );
}

/**
 * Activity panel (slice 11.9): reverse-chron audit feed from GET /api/farm/audit,
 * grouped by IST day, with server-side entity/action filters and a cursor-based
 * "Load more". The endpoint is OWNER/MANAGER-gated — `canView` mirrors that.
 */
export function ActivityPanel({ canView }: { farmId: string; canView: boolean }) {
  const { t } = useTranslation();
  const [entity, setEntity] = useState('');
  const [verb, setVerb] = useState('');
  // The action filter is exact-match on the server ("expenses.update"), so it is
  // composable only once an entity is picked; changing entity resets the verb.
  const action = entity && verb ? `${entity.toLowerCase()}.${verb}` : undefined;
  // The endpoint is OWNER/MANAGER-gated — don't fire a doomed request for others.
  const feed = useActivity({ entity: entity || undefined, action }, { enabled: canView });

  // Feed hooks must run before any early return; the guard renders after them.
  const groups = useMemo(() => {
    const byDay = new Map<string, ActivityItem[]>();
    for (const item of feed.items ?? []) {
      const day = fmtDate(item.createdAt);
      const list = byDay.get(day);
      if (list) list.push(item);
      else byDay.set(day, [item]);
    }
    return [...byDay.entries()];
  }, [feed.items]);

  if (!canView) {
    return (
      <section className="space-y-3">
        <PanelHeading>{t('activity.title')}</PanelHeading>
        <PanelNote>{t('activity.forbidden')}</PanelNote>
      </section>
    );
  }

  return (
    <section className="space-y-3">
      <PanelHeading>{t('activity.title')}</PanelHeading>
      <PanelNote>{t('activity.blurb')}</PanelNote>

      <div className="flex flex-wrap gap-2">
        <Select
          value={entity}
          onChange={(e) => {
            setEntity(e.target.value);
            setVerb('');
          }}
          aria-label={t('activity.filterEntity')}
          className="w-auto min-w-40"
        >
          <option value="">{t('activity.allEntities')}</option>
          {ENTITIES.map((en) => (
            <option key={en} value={en}>
              {t(`activity.entity.${en}`, en)}
            </option>
          ))}
        </Select>
        <Select
          value={verb}
          onChange={(e) => setVerb(e.target.value)}
          disabled={!entity}
          aria-label={t('activity.filterAction')}
          className="w-auto min-w-36"
        >
          <option value="">{t('activity.allActions')}</option>
          {VERBS.map((v) => (
            <option key={v} value={v}>
              {t(`activity.verb.${v}`)}
            </option>
          ))}
        </Select>
      </div>

      {feed.isPending && (
        <div className="space-y-2" aria-hidden>
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      )}

      {feed.isError && (
        <div className="space-y-2">
          <PanelError>{t('activity.error')}</PanelError>
          <Button size="sm" variant="secondary" onClick={() => void feed.refetch()}>
            {t('activity.retry')}
          </Button>
        </div>
      )}

      {feed.items && feed.items.length === 0 && (
        <EmptyState icon={History} illustration="generic" title={t('activity.empty')} description={t('activity.emptyDesc')} size="compact" />
      )}

      {groups.length > 0 && (
        <div className="space-y-4">
          {groups.map(([day, items]) => (
            <div key={day} className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground tabular">
                {day}
              </p>
              <ul className="space-y-2">
                {items.map((item) => (
                  <ActivityRow key={item.id} item={item} />
                ))}
              </ul>
            </div>
          ))}
          {feed.hasMore && (
            <div className="flex justify-center py-1" data-testid="activity-load-more">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                loading={feed.isFetchingNextPage}
                onClick={() => void feed.fetchNextPage()}
              >
                {t('table.loadMore')}
              </Button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
