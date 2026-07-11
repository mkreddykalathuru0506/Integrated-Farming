import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Bell, BellOff, Check } from 'lucide-react';
import { useFarmApi } from '../api/FarmContext';
import { useAckRisk } from '../api/intelligence.hooks';
import {
  Badge,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  PanelError,
  Skeleton,
  cn,
} from '../ui';
import {
  groupBell,
  normalizeBell,
  readLastSeen,
  unreadCount,
  writeLastSeen,
  type BellItem,
  type BellSeverity,
} from './bell';
import { useDueRollup, useOpenRisks } from './bellData';
import type { OpenRisk } from './bell';
import type { NavTarget } from './commands';
import { visibleSections, type Role } from './nav';

const MAX_ITEMS = 20;

const SEVERITY_VARIANT: Record<BellSeverity, 'destructive' | 'warning' | 'muted'> = {
  CRITICAL: 'destructive',
  WARNING: 'warning',
  INFO: 'muted',
};

/** Locale-aware "2 hours ago / in 3 days" without a date library. */
function relTime(iso: string, locale: string): string {
  const diffMs = new Date(iso).getTime() - Date.now();
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  const abs = Math.abs(diffMs);
  if (abs < 3_600_000) return rtf.format(Math.round(diffMs / 60_000), 'minute');
  if (abs < 86_400_000) return rtf.format(Math.round(diffMs / 3_600_000), 'hour');
  return rtf.format(Math.round(diffMs / 86_400_000), 'day');
}

type Props = {
  role: Role | undefined;
  /** Deep-link into the app (AppLayout's navigate). */
  onNavigate: (target: NavTarget) => void;
};

/**
 * Topbar notification bell (v1 — client-composed over /api/farm/risk +
 * /api/farm/due; unread = per-farm lastSeen timestamp in localStorage).
 */
export function NotificationBell({ role, onNavigate }: Props) {
  const { t, i18n } = useTranslation();
  const { farmId } = useFarmApi();
  const risksQ = useOpenRisks();
  const dueQ = useDueRollup();
  const [open, setOpen] = useState(false);
  const [lastSeen, setLastSeen] = useState(() => readLastSeen(farmId));

  // Farm switch must not leak unread counts across farms.
  useEffect(() => setLastSeen(readLastSeen(farmId)), [farmId]);

  // Only surface items whose destination section is visible for this role —
  // otherwise the deep-link resolves to Overview and the click looks like a no-op.
  const visibleKeys = useMemo(() => new Set(visibleSections(role).map((s) => s.key)), [role]);

  const now = new Date().toISOString();
  const items = useMemo(
    // Canonical RiskFlag[] widens severity to string; the bell only reads the
    // three known enum values, so narrow to OpenRisk for normalizeBell.
    () =>
      normalizeBell((risksQ.data ?? []) as OpenRisk[], dueQ.data, new Date().toISOString()).filter(
        (i) => visibleKeys.has(i.route.key),
      ),
    [risksQ.data, dueQ.data, visibleKeys],
  );
  const badge = unreadCount(items, lastSeen, now);
  const shown = items.slice(0, MAX_ITEMS);
  const truncated = items.length - shown.length;
  const groups = groupBell(shown, now);

  const canAck = role === 'OWNER' || role === 'MANAGER';
  // Canonical ack — invalidates the shared risk/due/dashboard/alerts caches, so
  // acking here reconciles the dashboard + Weather panel too.
  const ack = useAckRisk('bell.acked');

  function markSeen() {
    const iso = new Date().toISOString();
    writeLastSeen(farmId, iso);
    setLastSeen(iso);
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) markSeen(); // opening reads everything currently due
  }

  function select(item: BellItem) {
    onNavigate(item.route);
  }

  const isLoading = risksQ.isPending || dueQ.isPending;
  const isError = risksQ.isError || dueQ.isError;

  function renderGroup(labelKey: string, groupItems: BellItem[]) {
    if (groupItems.length === 0) return null;
    return (
      <div key={labelKey}>
        <DropdownMenuLabel>{t(labelKey)}</DropdownMenuLabel>
        {groupItems.map((item) => (
          <DropdownMenuItem key={item.id} onSelect={() => select(item)} className="items-start">
            <Badge variant={SEVERITY_VARIANT[item.severity]} className="mt-0.5 shrink-0">
              {t(`bell.severity.${item.severity}`)}
            </Badge>
            <span className="min-w-0 flex-1">
              <span className="block text-sm leading-snug text-foreground">
                {t(item.textKey, item.textParams)}
              </span>
              <span className="block text-xs text-muted-foreground">
                {relTime(item.at, i18n.resolvedLanguage ?? 'en')}
              </span>
            </span>
            {item.kind === 'risk' && canAck && (
              <button
                type="button"
                aria-label={t('bell.ack')}
                disabled={ack.isPending}
                onPointerDown={(e) => e.stopPropagation()}
                onPointerUp={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  ack.mutate(item.id.replace(/^risk:/, ''));
                }}
                className="shrink-0 rounded-md border border-border px-1.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <Check className="h-3.5 w-3.5" aria-hidden />
              </button>
            )}
          </DropdownMenuItem>
        ))}
      </div>
    );
  }

  return (
    <DropdownMenu open={open} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger
        aria-label={badge > 0 ? t('bell.unread', { n: badge }) : t('bell.title')}
        className="relative grid h-11 w-11 place-items-center rounded-lg text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
      >
        <Bell className="h-5 w-5" aria-hidden />
        {badge > 0 && (
          <span
            aria-hidden
            className="absolute right-1.5 top-1.5 grid min-h-4 min-w-4 place-items-center rounded-full bg-destructive px-1 text-[10px] font-bold leading-none text-destructive-foreground"
          >
            {badge > 9 ? '9+' : badge}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent className={cn('w-80 max-w-[calc(100vw-1rem)]', 'max-h-96 overflow-y-auto')}>
        <div className="flex items-center justify-between gap-2 px-2.5 py-1.5">
          <p className="text-sm font-semibold text-foreground">{t('bell.title')}</p>
          {items.length > 0 && (
            <button
              type="button"
              onClick={markSeen}
              className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {t('bell.markSeen')}
            </button>
          )}
        </div>
        <DropdownMenuSeparator />
        {isLoading ? (
          <div className="space-y-2 p-2.5" aria-hidden>
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
          </div>
        ) : isError ? (
          <div className="space-y-2 p-2.5">
            <PanelError>{t('bell.error')}</PanelError>
            <button
              type="button"
              onClick={() => {
                void risksQ.refetch();
                void dueQ.refetch();
              }}
              className="text-xs font-medium text-muted-foreground underline transition-colors hover:text-foreground"
            >
              {t('bell.retry')}
            </button>
          </div>
        ) : items.length === 0 ? (
          <div className="grid place-items-center gap-1.5 px-2.5 py-6 text-center">
            <BellOff className="h-5 w-5 text-muted-foreground" aria-hidden />
            <p className="text-sm text-muted-foreground">{t('bell.empty')}</p>
          </div>
        ) : (
          <>
            {renderGroup('bell.groups.today', groups.today)}
            {renderGroup('bell.groups.earlier', groups.earlier)}
            {renderGroup('bell.groups.upcoming', groups.upcoming)}
            {truncated > 0 && (
              <p className="px-2.5 py-1.5 text-xs text-muted-foreground">
                {t('bell.more', { n: truncated })}
              </p>
            )}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
