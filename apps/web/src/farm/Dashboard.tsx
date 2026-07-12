import { Fragment, useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis } from 'recharts';
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Bird,
  Check,
  ClipboardList,
  ListChecks,
  RefreshCw,
  Send,
  Sprout,
  Thermometer,
  Wheat,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useBatches } from '../api/hooks';
import {
  useAcknowledgeRisk,
  useAlerts,
  useColdStorages,
  useDashboard,
  useDispatchAlerts,
  useDueRollup,
  useFarmDetail,
  useFeedItems,
  useFinanceSummary,
  useIntelligenceSweep,
  useOnboarding,
  useOpenRiskFlags,
  useResolveRiskFlag,
  type DueRollup,
  type FinancePeriod,
  type Onboarding,
  type OnboardingStepKey,
} from '../api/dashboard.hooks';
import { useAuth } from '../auth/AuthContext';
import { visibleSections, type Role } from '../components/nav';
import { pathForSection } from '../components/router';
import { useCountUp } from '../lib/motion';
import { fmtDate, fmtInr, fmtInrCompact } from '../lib/format';
import {
  Badge,
  BAR_CURSOR,
  Button,
  Card,
  CHART_SERIES,
  ChartEmpty,
  ChartTooltip,
  chartAnim,
  EmptyState,
  severityColor,
  severityTextClass,
  Skeleton,
  StatSkeleton,
  cn,
} from '../ui';
import type { ColdStorage } from './api';

const inr = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });

type Tone = 'primary' | 'danger' | 'warning' | 'success' | 'gold' | 'neutral';
/** Icon chips only (3:1 graphical) — small TEXT uses the -ink tokens instead. */
const BADGE: Record<Tone, string> = {
  primary: 'bg-primary/10 text-primary',
  danger: 'bg-destructive/10 text-destructive',
  warning: 'bg-warning/12 text-warning',
  success: 'bg-success/12 text-success',
  gold: 'bg-accent/12 text-accent',
  neutral: 'bg-muted text-muted-foreground',
};

/** Alert delivery status → timeline dot color (status map — audit P3-23). */
const ALERT_DOT: Record<string, string> = {
  FAILED: 'hsl(var(--destructive))',
  PENDING: 'hsl(var(--warning))',
};

/** Shared focus treatment for link-cards and inline links (audit P1-6). */
const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background';

/** Stat-tile stagger (motion-standard §3.2) — above-the-fold hero rows only. */
const STAGGER =
  'motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-1 motion-safe:duration-300 motion-safe:fill-mode-backwards';
const staggerDelay = (i: number) => ({ animationDelay: `${Math.min(i, 5) * 40}ms` });

const DISMISS_PREFIX = 'ifm.onboarding.dismissed.';

/* ---------- small building blocks ---------- */

function Panel({
  title,
  sub,
  span,
  children,
}: {
  title: string;
  sub?: ReactNode;
  span: string;
  children: ReactNode;
}) {
  return (
    <Card lined className={span}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="font-display text-base font-semibold text-foreground">{title}</h3>
        {sub != null &&
          (typeof sub === 'string' || typeof sub === 'number' ? (
            <span className="rounded-md bg-secondary/60 px-2 py-1 text-xs font-semibold text-muted-foreground">
              {sub}
            </span>
          ) : (
            sub
          ))}
      </div>
      {children}
    </Card>
  );
}

/** Real error state with Retry — never renders as an empty state. */
function LoadError({ onRetry, compact }: { onRetry: () => void; compact?: boolean }) {
  const { t } = useTranslation();
  return (
    <div role="alert" className={cn('flex items-center justify-center gap-3', compact ? 'py-4' : 'py-8')}>
      <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" aria-hidden />
      <span className="text-sm text-muted-foreground">{t('dashboard.loadError')}</span>
      <Button type="button" variant="secondary" size="sm" onClick={onRetry}>
        {t('dashboard.retry')}
      </Button>
    </div>
  );
}

/** Count-up numeral (motion-standard §5). Display-only — never feeds calculations. */
function CountUpInt({ value }: { value: number }) {
  return <>{inr.format(Math.round(useCountUp(value)))}</>;
}

/** Compact ₹ count-up from integer paise; re-formats a display-only number. */
function CountUpInr({ paise }: { paise: bigint }) {
  return <>{fmtInrCompact(BigInt(Math.round(useCountUp(Number(paise)))))}</>;
}

function Kpi({
  label,
  value,
  sub,
  icon: Icon,
  tone = 'neutral',
  href,
  index = 0,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  icon: LucideIcon;
  tone?: Tone;
  href?: string;
  /** Position in the KPI row (stagger delay). */
  index?: number;
}) {
  const inner = (
    <>
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-semibold text-muted-foreground">{label}</span>
        <span className={cn('grid h-9 w-9 place-items-center rounded-md', BADGE[tone])}>
          <Icon className="h-[18px] w-[18px]" aria-hidden />
        </span>
      </div>
      <p className="mt-3 font-display text-[28px] font-medium leading-none tracking-tight tabular text-foreground">
        {value}
      </p>
      {sub != null && <div className="mt-2 text-xs font-medium text-muted-foreground">{sub}</div>}
    </>
  );
  const frame = cn(
    'relative col-span-6 rounded-lg border border-border bg-card p-4 shadow-card sm:col-span-3 xl:col-span-2',
    STAGGER,
  );
  return href ? (
    <a
      href={href}
      style={staggerDelay(index)}
      className={cn(
        frame,
        'block transition duration-150 hover:shadow-elevated motion-safe:hover:-translate-y-0.5',
        FOCUS_RING,
      )}
    >
      {inner}
    </a>
  ) : (
    <div style={staggerDelay(index)} className={frame}>
      {inner}
    </div>
  );
}

function TrendChip({ up, children }: { up: boolean; children: ReactNode }) {
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold',
        up ? 'bg-success/14 text-success-ink' : 'bg-destructive/12 text-destructive',
      )}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {children}
    </span>
  );
}

/* ---------- onboarding checklist ---------- */

const STEP_META: { key: OnboardingStepKey; labelKey: string; href: string }[] = [
  { key: 'units', labelKey: 'dashboard.stepUnits', href: pathForSection('settings', 'units') },
  { key: 'batches', labelKey: 'dashboard.stepBatches', href: pathForSection('livestock', 'batches') },
  { key: 'workers', labelKey: 'dashboard.stepWorkers', href: pathForSection('daily', 'workers') },
  { key: 'dailyLogs', labelKey: 'dashboard.stepDailyLogs', href: pathForSection('daily', 'logs') },
  { key: 'invoices', labelKey: 'dashboard.stepInvoices', href: pathForSection('finance', 'invoices') },
];

function OnboardingCard({ data, onDismiss }: { data: Onboarding; onDismiss: () => void }) {
  const { t } = useTranslation();
  const pct = data.total > 0 ? Math.round((data.completedCount / data.total) * 100) : 0;
  return (
    <section
      data-block="onboarding"
      className="relative rounded-lg border border-accent/40 bg-card p-5 shadow-card"
    >
      <button
        type="button"
        aria-label={t('dashboard.onboardingDismiss')}
        onClick={onDismiss}
        className={cn(
          'absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-md text-muted-foreground transition duration-150 after:absolute after:-inset-1.5 active:scale-95 hover:bg-muted hover:text-foreground',
          FOCUS_RING,
        )}
      >
        <X className="h-4 w-4" aria-hidden />
      </button>
      <div className="flex items-center gap-2.5">
        <span className="grid h-9 w-9 place-items-center rounded-md bg-accent/12 text-accent">
          <Sprout className="h-[18px] w-[18px]" aria-hidden />
        </span>
        <div>
          <h3 className="font-display text-base font-semibold text-foreground">{t('dashboard.onboardingTitle')}</h3>
          <p className="text-xs text-muted-foreground">{t('dashboard.onboardingSubtitle')}</p>
        </div>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          {/* Meters carry ONE hue — a gradient suggests a value scale that isn't there. */}
          <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(4, pct)}%` }} />
        </div>
        <span className="tabular text-xs font-semibold text-muted-foreground">
          {t('dashboard.onboardingProgress', { done: data.completedCount, total: data.total })}
        </span>
      </div>
      <ul className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
        {STEP_META.map((step) => {
          const done = data.steps[step.key]?.done ?? false;
          return (
            <li
              key={step.key}
              className={cn(
                'flex items-center gap-2.5 rounded-md border px-3 py-2.5',
                done ? 'border-success/30 bg-success/10' : 'border-border bg-card',
              )}
            >
              <span
                className={cn(
                  'grid h-6 w-6 shrink-0 place-items-center rounded-full',
                  done ? 'bg-success text-success-foreground' : 'border border-input text-transparent',
                )}
              >
                <Check className="h-3.5 w-3.5" aria-hidden />
              </span>
              <span className={cn('flex-1 text-sm', done ? 'text-muted-foreground line-through' : 'text-foreground')}>
                {t(step.labelKey)}
              </span>
              {!done && (
                <a
                  href={step.href}
                  className={cn(
                    'whitespace-nowrap rounded text-xs font-semibold text-primary underline-offset-4 hover:underline',
                    FOCUS_RING,
                  )}
                >
                  {t('dashboard.stepGo')}
                </a>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/* ---------- "Today" panel ---------- */

type TodayRow = { id: string; text: string; when?: string; badge: string; badgeVariant: 'warning' | 'muted' };
type TodayGroup = { key: string; section: string; titleKey: string; href: string; rows: TodayRow[] };

function todayGroups(
  due: DueRollup,
  t: (k: string, o?: Record<string, unknown>) => string,
  visibleKeys: Set<string>,
): TodayGroup[] {
  const groups: TodayGroup[] = [
    {
      key: 'tasks',
      section: 'daily',
      titleKey: 'dashboard.groupTasks',
      href: pathForSection('daily', 'tasks'),
      rows: due.tasksToday.map((task) => ({
        id: `task-${task.id}`,
        text: task.title,
        badge: t('dashboard.badgeToday'),
        badgeVariant: 'muted' as const,
      })),
    },
    {
      key: 'vaccinations',
      section: 'health',
      titleKey: 'dashboard.groupVaccinations',
      href: pathForSection('health', 'vaccination'),
      rows: due.vaccinations.map((v) => ({
        id: `vax-${v.batch.id}`,
        text: `${v.batch.code} · ${v.due.map((d) => d.vaccineName).join(', ')}`,
        badge: t('dashboard.vaxDueLine', { n: v.due.length }),
        badgeVariant: 'warning' as const,
      })),
    },
    {
      key: 'maintenance',
      section: 'maintenance',
      titleKey: 'dashboard.groupMaintenance',
      href: pathForSection('maintenance', 'assets'),
      rows: due.maintenance.map((m) => ({
        id: `mnt-${m.id}`,
        text: `${m.asset.name} · ${m.name}`,
        when: m.nextDueDate ? fmtDate(m.nextDueDate) : undefined,
        badge: t('dashboard.badgeDue'),
        badgeVariant: 'warning' as const,
      })),
    },
    {
      key: 'emi',
      section: 'finance',
      titleKey: 'dashboard.groupEmi',
      href: pathForSection('finance', 'emi'),
      rows: due.emiDue.map((l) => ({
        id: `emi-${l.id}`,
        text: l.lender,
        when: l.nextDueDate ? fmtDate(l.nextDueDate) : undefined,
        badge: t('dashboard.badgeDue'),
        badgeVariant: 'warning' as const,
      })),
    },
    {
      key: 'insurance',
      section: 'finance',
      titleKey: 'dashboard.groupInsurance',
      href: pathForSection('finance', 'emi'),
      rows: due.policiesExpiring.map((p) => ({
        id: `ins-${p.id}`,
        text: p.provider,
        when: fmtDate(p.endDate),
        badge: t('dashboard.badgeDue'),
        badgeVariant: 'warning' as const,
      })),
    },
  ];
  // Only groups whose target section is visible for this role — an ACCOUNTANT
  // clicking a health/maintenance link would otherwise full-reload to Overview.
  return groups.filter((g) => g.rows.length > 0 && visibleKeys.has(g.section));
}

const TODAY_ROW_LIMIT = 4;

function TodayPanel({ due, visibleKeys }: { due: DueRollup; visibleKeys: Set<string> }) {
  const { t } = useTranslation();
  const groups = todayGroups(due, t, visibleKeys);
  if (groups.length === 0) {
    return (
      <EmptyState
        icon={Check}
        illustration="allClear"
        title={t('dashboard.todayAllClear')}
        description={t('dashboard.todayAllClearDesc')}
        size="compact"
      />
    );
  }
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {groups.map((group) => (
        <div key={group.key} className="rounded-md border border-border bg-secondary/60 p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <a
              href={group.href}
              className={cn(
                'rounded text-xs font-bold uppercase tracking-wide text-muted-foreground underline-offset-4 hover:text-foreground hover:underline',
                FOCUS_RING,
              )}
            >
              {t(group.titleKey)}
            </a>
            <span className="tabular text-xs font-semibold text-muted-foreground">{group.rows.length}</span>
          </div>
          <ul className="space-y-1.5">
            {group.rows.slice(0, TODAY_ROW_LIMIT).map((row) => (
              <li key={row.id} className="flex items-center gap-2 text-sm">
                <Badge variant={row.badgeVariant}>{row.badge}</Badge>
                <span className="min-w-0 flex-1 truncate text-foreground">{row.text}</span>
                {row.when && <span className="mono shrink-0 text-xs text-muted-foreground">{row.when}</span>}
              </li>
            ))}
          </ul>
          {group.rows.length > TODAY_ROW_LIMIT && (
            <a
              href={group.href}
              className={cn(
                'mt-2 inline-block rounded text-xs font-semibold text-primary underline-offset-4 hover:underline',
                FOCUS_RING,
              )}
            >
              {t('dashboard.moreCount', { count: group.rows.length - TODAY_ROW_LIMIT })}
            </a>
          )}
        </div>
      ))}
    </div>
  );
}

/* ---------- finance trend ---------- */

function monthLabel(month: string, language: string): string {
  const [y, m] = month.split('-').map(Number);
  try {
    return new Intl.DateTimeFormat(language, { month: 'short' }).format(new Date(Date.UTC(y!, (m ?? 1) - 1, 1)));
  } catch {
    return month;
  }
}

function FinanceTrend({ farmCreatedAt, canBill }: { farmCreatedAt: string | undefined; canBill: boolean }) {
  const { t, i18n } = useTranslation();
  const [period, setPeriod] = useState<FinancePeriod>('fy');
  const summaryQ = useFinanceSummary(period, farmCreatedAt);

  const buckets = summaryQ.data?.buckets ?? [];
  const profitPaise = useMemo(() => buckets.reduce((sum, b) => sum + BigInt(b.profitPaise), 0n), [buckets]);
  const revenuePaise = useMemo(() => buckets.reduce((sum, b) => sum + BigInt(b.revenuePaise), 0n), [buckets]);
  const costPaise = useMemo(
    () => buckets.reduce((sum, b) => sum + BigInt(b.expensePaise) + BigInt(b.feedCostPaise), 0n),
    [buckets],
  );
  const hasActivity = revenuePaise !== 0n || costPaise !== 0n;
  const chartData = buckets.map((b) => ({
    month: monthLabel(b.month, i18n.resolvedLanguage ?? 'en'),
    [t('dashboard.financeRevenue')]: Number(b.revenuePaise),
    [t('dashboard.financeCost')]: Number(b.expensePaise) + Number(b.feedCostPaise),
  }));

  const periods: { key: FinancePeriod; label: string }[] = [
    { key: 'month', label: t('dashboard.periodMonth') },
    { key: 'fy', label: t('dashboard.periodFy') },
    { key: 'all', label: t('dashboard.periodAll') },
  ];

  return (
    <Panel
      title={t('dashboard.financeTitle')}
      sub={
        /* Segmented control (audit P3-21 + P1-5): container affordance + ≥36px targets. */
        <span className="flex rounded-full bg-secondary/60 p-0.5" role="group" aria-label={t('dashboard.financeTitle')}>
          {periods.map((p) => (
            <button
              key={p.key}
              type="button"
              aria-pressed={period === p.key}
              onClick={() => setPeriod(p.key)}
              className={cn(
                'relative min-h-9 rounded-full px-3 text-xs font-semibold transition-colors duration-150 after:absolute after:inset-x-0 after:-inset-y-1.5',
                FOCUS_RING,
                period === p.key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted',
              )}
            >
              {p.label}
            </button>
          ))}
        </span>
      }
      span="col-span-12"
    >
      {summaryQ.isError ? (
        <LoadError onRetry={() => void summaryQ.refetch()} />
      ) : summaryQ.isPending ? (
        <Skeleton className="h-48" />
      ) : (
        <div className="grid gap-5 lg:grid-cols-[240px_1fr]">
          <div>
            <span className="text-xs font-semibold text-muted-foreground">{t('dashboard.profit')}</span>
            <p className="mt-2 font-display text-[36px] font-medium leading-none tracking-tight tabular text-foreground">
              <CountUpInr paise={profitPaise} />
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <TrendChip up={profitPaise >= 0n}>
                {profitPaise >= 0n ? t('dashboard.profitable') : t('dashboard.loss')}
              </TrendChip>
              <span className="text-xs text-muted-foreground">
                {t('dashboard.revenue')} {fmtInrCompact(revenuePaise)} · {t('dashboard.costLabel')}{' '}
                {fmtInrCompact(costPaise)}
              </span>
            </div>
            {canBill && (
              <div className="mt-4 flex gap-3 text-sm font-medium">
                <a
                  href={pathForSection('finance', 'invoices')}
                  className={cn('rounded text-primary underline-offset-4 hover:underline', FOCUS_RING)}
                >
                  {t('dashboard.linkInvoices')}
                </a>
                <a
                  href={pathForSection('finance', 'expenses')}
                  className={cn('rounded text-primary underline-offset-4 hover:underline', FOCUS_RING)}
                >
                  {t('dashboard.linkExpenses')}
                </a>
              </div>
            )}
          </div>
          {hasActivity ? (
            <div className="h-48 min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} barGap={4} barCategoryGap="25%" margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
                  <XAxis
                    dataKey="month"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                  />
                  <Tooltip
                    cursor={BAR_CURSOR}
                    content={<ChartTooltip format={(v) => fmtInr(Math.round(v))} />}
                  />
                  {/* Fixed pairings: revenue = chart-1, cost = chart-2 (chart-spec §1). */}
                  <Bar dataKey={t('dashboard.financeRevenue')} fill={CHART_SERIES[0]} radius={[4, 4, 0, 0]} maxBarSize={24} {...chartAnim()} />
                  <Bar dataKey={t('dashboard.financeCost')} fill={CHART_SERIES[1]} radius={[4, 4, 0, 0]} maxBarSize={24} {...chartAnim()} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <ChartEmpty art="finance" text={t('dashboard.noFinance')} className="h-48" />
          )}
        </div>
      )}
    </Panel>
  );
}

/* ---------- main ---------- */

export function Dashboard({ farmId, canWrite, role }: { farmId: string; canWrite: boolean; role?: Role }) {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();

  const showFinance = !role || role === 'OWNER' || role === 'MANAGER' || role === 'ACCOUNTANT';
  const showIntel = role !== 'LABOUR' && role !== 'BUYER';
  const isLabour = role === 'LABOUR';
  const isAccountant = role === 'ACCOUNTANT';
  // Role-visible section keys — gates the "Today" group deep-links (finding 11.8a).
  const visibleKeys = useMemo(() => new Set(visibleSections(role).map((s) => s.key)), [role]);

  const dashQ = useDashboard();
  const risksQ = useOpenRiskFlags();
  const alertsQ = useAlerts();
  const batchesQ = useBatches();
  const feedQ = useFeedItems();
  const coldQ = useColdStorages();
  const dueQ = useDueRollup(7);
  const onboardingQ = useOnboarding();
  const farmQ = useFarmDetail(showFinance);

  const ackMutation = useAcknowledgeRisk();
  const resolveMutation = useResolveRiskFlag();
  const dispatchMutation = useDispatchAlerts();
  const sweepMutation = useIntelligenceSweep();

  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(DISMISS_PREFIX + farmId) === '1';
    } catch {
      return false;
    }
  });
  const dismissOnboarding = () => {
    try {
      localStorage.setItem(DISMISS_PREFIX + farmId, '1');
    } catch {
      /* ignore storage failures (private mode) */
    }
    setDismissed(true);
  };

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    const key = h < 12 ? 'greetMorning' : h < 17 ? 'greetAfternoon' : 'greetEvening';
    return t(`dashboard.${key}`, { name: user?.name ?? '' });
  }, [t, user]);

  const today = useMemo(() => {
    try {
      return new Intl.DateTimeFormat(i18n.resolvedLanguage ?? 'en', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      }).format(new Date());
    } catch {
      return '';
    }
  }, [i18n.resolvedLanguage]);

  const severityData = useMemo(
    () =>
      Object.entries(dashQ.data?.risks.bySeverity ?? {})
        .filter(([, v]) => v > 0)
        .map(([k, v]) => ({ name: k, label: t(`dashboard.${k.toLowerCase()}`, k), value: v })),
    [dashQ.data, t],
  );
  const totalRisks = severityData.reduce((n, d) => n + d.value, 0);

  const activeBatches = useMemo(() => (batchesQ.data ?? []).filter((b) => b.status === 'ACTIVE'), [batchesQ.data]);
  const birds = activeBatches.reduce((n, b) => n + (b.currentCount || 0), 0);
  const lowFeed = (feedQ.data ?? []).filter(
    (i) => i.reorderThreshold != null && Number(i.stockQty) <= Number(i.reorderThreshold),
  ).length;
  const cold: ColdStorage | null = useMemo(() => {
    const stores = coldQ.data ?? [];
    return stores.find((s) => s.isActive && s.latest) ?? stores[0] ?? null;
  }, [coldQ.data]);

  const weather = dashQ.data?.weather ?? null;
  const alerts = alertsQ.data ?? [];
  const risks = risksQ.data ?? [];

  /* ---------- blocks (role-aware ordering) ---------- */

  const onboardingBlock =
    canWrite && !dismissed ? (
      onboardingQ.isError ? (
        <section data-block="onboarding" className="rounded-lg border border-border bg-card shadow-card">
          <LoadError compact onRetry={() => void onboardingQ.refetch()} />
        </section>
      ) : onboardingQ.data && onboardingQ.data.completedCount < onboardingQ.data.total ? (
        <OnboardingCard data={onboardingQ.data} onDismiss={dismissOnboarding} />
      ) : null
    ) : null;

  const kpisBlock = (
    <div data-block="kpis" className="grid grid-cols-12 gap-4">
      {dashQ.isError ? (
        <div className="col-span-12 rounded-lg border border-border bg-card shadow-card">
          <LoadError onRetry={() => void dashQ.refetch()} />
        </div>
      ) : dashQ.isPending ? (
        <>
          <StatSkeleton className="col-span-6 sm:col-span-3 xl:col-span-2" />
          <StatSkeleton className="col-span-6 sm:col-span-3 xl:col-span-2" />
          <StatSkeleton className="col-span-6 sm:col-span-3 xl:col-span-2" />
          <StatSkeleton className="col-span-6 sm:col-span-3 xl:col-span-2" />
        </>
      ) : (
        <>
          <Kpi
            index={0}
            label={t('dashboard.openRisks')}
            value={<CountUpInt value={dashQ.data.risks.open} />}
            sub={t('dashboard.criticalCount', { count: dashQ.data.risks.bySeverity.CRITICAL ?? 0 })}
            icon={AlertTriangle}
            tone={dashQ.data.risks.open > 0 ? 'danger' : 'success'}
            href={showIntel ? pathForSection('intelligence', 'weather') : undefined}
          />
          <Kpi
            index={1}
            label={t('dashboard.batches')}
            value={batchesQ.isPending ? '—' : <CountUpInt value={activeBatches.length} />}
            sub={t('dashboard.birds', { count: birds })}
            icon={Bird}
            tone="primary"
            href={pathForSection('livestock', 'batches')}
          />
          <Kpi
            index={2}
            label={t('dashboard.feedLow')}
            value={feedQ.isPending ? '—' : <CountUpInt value={lowFeed} />}
            sub={lowFeed > 0 ? t('dashboard.belowReorder', { count: lowFeed }) : t('dashboard.allStocked')}
            icon={Wheat}
            tone={lowFeed > 0 ? 'warning' : 'gold'}
            href={showFinance ? pathForSection('finance') : undefined}
          />
          <div
            style={staggerDelay(3)}
            className={cn(
              'relative col-span-6 rounded-lg border border-border bg-card p-4 shadow-card sm:col-span-3 xl:col-span-2',
              STAGGER,
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <span className="text-xs font-semibold text-muted-foreground">{t('dashboard.temp')}</span>
              <span className={cn('grid h-9 w-9 place-items-center rounded-md', BADGE.primary)}>
                <Thermometer className="h-[18px] w-[18px]" aria-hidden />
              </span>
            </div>
            <p className="mt-3 font-display text-[28px] font-medium leading-none tracking-tight tabular text-foreground">
              {weather ? (
                <>
                  <CountUpInt value={weather.tempC} />°
                </>
              ) : (
                '—'
              )}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs font-medium text-muted-foreground">
              {weather ? (
                <>
                  <span>{weather.source}</span>
                  {weather.source === 'mock' && <Badge variant="muted">{t('dashboard.sourceMock')}</Badge>}
                </>
              ) : (
                <span>—</span>
              )}
            </div>
            <div className="mt-2 flex items-center gap-2">
              {showIntel && (
                <a
                  href={pathForSection('intelligence', 'weather')}
                  className={cn('rounded text-xs font-semibold text-primary underline-offset-4 hover:underline', FOCUS_RING)}
                >
                  {t('dashboard.viewWeather')}
                </a>
              )}
              {canWrite && (
                <button
                  type="button"
                  aria-label={t('dashboard.refresh')}
                  disabled={sweepMutation.isPending}
                  onClick={() => sweepMutation.mutate()}
                  className={cn(
                    'relative grid h-9 w-9 place-items-center rounded-md text-muted-foreground transition duration-150 after:absolute after:-inset-1 active:scale-95 hover:bg-muted hover:text-foreground disabled:opacity-50',
                    FOCUS_RING,
                  )}
                >
                  <RefreshCw className={cn('h-3.5 w-3.5', sweepMutation.isPending && 'motion-safe:animate-spin')} aria-hidden />
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );

  const todayBlock = (
    <div data-block="today">
      <Panel title={t('dashboard.todayTitle')} sub={t('dashboard.todaySub')} span="col-span-12">
        {dueQ.isError ? (
          <LoadError onRetry={() => void dueQ.refetch()} />
        ) : dueQ.isPending ? (
          <Skeleton className="h-28" />
        ) : (
          <TodayPanel due={dueQ.data} visibleKeys={visibleKeys} />
        )}
      </Panel>
    </div>
  );

  const financeBlock = showFinance ? (
    <div data-block="finance" className="grid grid-cols-12 gap-4">
      <FinanceTrend farmCreatedAt={farmQ.data?.createdAt} canBill={!isLabour} />
    </div>
  ) : null;

  const chartsBlock = (
    <div data-block="charts" className="grid grid-cols-12 gap-4">
      {/* Risk donut */}
      <Panel title={t('dashboard.riskBreakdown')} sub={t('dashboard.live')} span="col-span-12 sm:col-span-6 lg:col-span-4">
        {dashQ.isError ? (
          <LoadError compact onRetry={() => void dashQ.refetch()} />
        ) : dashQ.isPending ? (
          <Skeleton className="h-[150px]" />
        ) : severityData.length === 0 ? (
          <ChartEmpty art="allClear" text={t('dashboard.noRisks')} className="h-[150px]" />
        ) : (
          <div className="flex items-center gap-4">
            <div className="relative h-[150px] w-[150px] shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  {/* Thin editorial ring (72% inner), rounded segment ends (chart-spec §5). */}
                  <Pie
                    data={severityData}
                    dataKey="value"
                    nameKey="label"
                    innerRadius="72%"
                    outerRadius="100%"
                    paddingAngle={3}
                    cornerRadius={4}
                    stroke="none"
                    {...chartAnim()}
                  >
                    {severityData.map((d) => (
                      <Cell key={d.name} fill={severityColor(d.name)} />
                    ))}
                  </Pie>
                  <Tooltip content={<ChartTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 grid place-content-center text-center">
                <span className="font-display text-3xl font-semibold leading-none text-foreground">{totalRisks}</span>
                <span className="text-[11px] font-semibold text-muted-foreground">{t('dashboard.openRisks').toLowerCase()}</span>
              </div>
            </div>
            <ul className="flex-1 space-y-2">
              {severityData.map((d) => (
                <li key={d.name} className="flex items-center gap-2 text-sm">
                  <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: severityColor(d.name) }} />
                  <span className="flex-1 text-foreground">{d.label}</span>
                  <span className="tabular font-semibold text-muted-foreground">{d.value}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Panel>

      {/* Cold chain gauge */}
      <Panel
        title={t('dashboard.coldChain')}
        sub={cold?.latest ? (cold.latest.isOutOfRange ? t('dashboard.outOfRange') : t('dashboard.inRange')) : undefined}
        span="col-span-12 sm:col-span-6 lg:col-span-4"
      >
        {coldQ.isError ? (
          <LoadError compact onRetry={() => void coldQ.refetch()} />
        ) : coldQ.isPending ? (
          <Skeleton className="h-[88px]" />
        ) : cold?.latest ? (
          <ColdGauge store={cold} />
        ) : (
          <ChartEmpty art="coldChain" text={t('dashboard.noCold')} className="h-[88px] py-0 [&_svg]:h-16 [&_svg]:w-16" />
        )}
      </Panel>

      {/* Market */}
      <Panel
        title={t('dashboard.marketTitle')}
        sub={
          showIntel ? (
            <a
              href={pathForSection('intelligence', 'market')}
              className={cn('rounded text-xs font-semibold text-primary underline-offset-4 hover:underline', FOCUS_RING)}
            >
              {t('dashboard.viewMarket')}
            </a>
          ) : undefined
        }
        span="col-span-12 sm:col-span-6 lg:col-span-4"
      >
        {dashQ.isError ? (
          <LoadError compact onRetry={() => void dashQ.refetch()} />
        ) : dashQ.isPending ? (
          <Skeleton className="h-[88px]" />
        ) : dashQ.data.market.length === 0 ? (
          <ChartEmpty art="generic" text={t('dashboard.noMarket')} className="h-[88px] py-0 [&_svg]:h-16 [&_svg]:w-16" />
        ) : (
          <MarketBars rows={dashQ.data.market.map((m) => ({ name: m.commodity, unit: m.unit, value: Number(m.pricePaise) / 100 }))} />
        )}
      </Panel>

      {/* Activity */}
      <Panel title={t('dashboard.recentAlerts')} sub={alerts.length ? String(alerts.length) : undefined} span="col-span-12">
        {alertsQ.isError ? (
          <LoadError compact onRetry={() => void alertsQ.refetch()} />
        ) : alertsQ.isPending ? (
          <Skeleton className="h-44" />
        ) : alerts.length === 0 ? (
          <ChartEmpty art="allClear" text={t('dashboard.noAlerts')} className="h-44" />
        ) : (
          <ul className="relative space-y-1 pl-4 before:absolute before:bottom-1.5 before:left-[5px] before:top-1.5 before:w-0.5 before:bg-border before:content-['']">
            {alerts.slice(0, 4).map((a) => (
              <li key={a.id} className="relative py-1.5">
                {/* Dot carries the delivery status (status map — audit P3-23). */}
                <span
                  className="absolute -left-[13px] top-3 h-2.5 w-2.5 rounded-full shadow-[0_0_0_4px_hsl(var(--card))]"
                  style={{ background: ALERT_DOT[a.status.toUpperCase()] ?? 'hsl(var(--primary))' }}
                />
                <p className="line-clamp-2 text-sm font-medium text-foreground">{a.body}</p>
                <p className="mono text-xs text-muted-foreground">
                  {a.channel} · {a.status.toLowerCase()}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );

  const risksBlock = risksQ.isError ? (
    <div data-block="risks">
      <Panel title={t('dashboard.openRisksTitle')} span="col-span-12">
        <LoadError compact onRetry={() => void risksQ.refetch()} />
      </Panel>
    </div>
  ) : risks.length > 0 ? (
    <div data-block="risks">
      {(() => (
        <Panel title={t('dashboard.openRisksTitle')} span="col-span-12">
          <ul className="grid gap-2 sm:grid-cols-2">
            {risks.slice(0, 6).map((r) => {
              const row = (
                <>
                  <span
                    className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ background: severityColor(r.severity) }}
                  />
                  <div className="min-w-0 flex-1">
                    <span className={cn('text-[11px] font-bold uppercase tracking-wide', severityTextClass(r.severity))}>
                      {t(`dashboard.${r.severity.toLowerCase()}`, r.severity)}
                    </span>
                    <p className="text-sm text-muted-foreground">{r.reason}</p>
                  </div>
                </>
              );
              return (
                <li key={r.id} className="flex items-start gap-3 rounded-md border border-border bg-card px-3 py-2.5">
                  {showIntel ? (
                    <a
                      href={pathForSection('intelligence', 'weather')}
                      className={cn('flex min-w-0 flex-1 items-start gap-3 rounded', FOCUS_RING)}
                    >
                      {row}
                    </a>
                  ) : (
                    <span className="flex min-w-0 flex-1 items-start gap-3">{row}</span>
                  )}
                  {canWrite && (
                    <span className="inline-flex shrink-0 flex-wrap justify-end gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        loading={ackMutation.isPending && ackMutation.variables === r.id}
                        onClick={() => ackMutation.mutate(r.id)}
                      >
                        {t('dashboard.ack')}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        loading={resolveMutation.isPending && resolveMutation.variables === r.id}
                        onClick={() => resolveMutation.mutate(r.id)}
                      >
                        {t('dashboard.resolve')}
                      </Button>
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </Panel>
      ))()}
    </div>
  ) : null;

  const quickBlock = isLabour ? (
    <div data-block="quick" className="grid grid-cols-12 gap-4">
      <a
        href={pathForSection('daily', 'logs')}
        style={staggerDelay(0)}
        className={cn(
          'col-span-12 flex items-center gap-3 rounded-lg border border-border bg-card p-5 shadow-card transition duration-150 hover:shadow-elevated motion-safe:hover:-translate-y-0.5 sm:col-span-6',
          STAGGER,
          FOCUS_RING,
        )}
      >
        <span className={cn('grid h-11 w-11 place-items-center rounded-md', BADGE.primary)}>
          <ClipboardList className="h-5 w-5" aria-hidden />
        </span>
        <span className="font-display text-base font-semibold text-foreground">{t('dashboard.quickLogs')}</span>
      </a>
      <a
        href={pathForSection('daily', 'tasks')}
        style={staggerDelay(1)}
        className={cn(
          'col-span-12 flex items-center gap-3 rounded-lg border border-border bg-card p-5 shadow-card transition duration-150 hover:shadow-elevated motion-safe:hover:-translate-y-0.5 sm:col-span-6',
          STAGGER,
          FOCUS_RING,
        )}
      >
        <span className={cn('grid h-11 w-11 place-items-center rounded-md', BADGE.gold)}>
          <ListChecks className="h-5 w-5" aria-hidden />
        </span>
        <span className="font-display text-base font-semibold text-foreground">{t('dashboard.quickTasks')}</span>
      </a>
    </div>
  ) : null;

  type BlockKey = 'quick' | 'onboarding' | 'kpis' | 'risks' | 'today' | 'finance' | 'charts';
  const blocks: Record<BlockKey, ReactNode> = {
    quick: quickBlock,
    onboarding: onboardingBlock,
    kpis: kpisBlock,
    risks: risksBlock,
    today: todayBlock,
    finance: financeBlock,
    charts: chartsBlock,
  };
  // Role-aware ordering: OWNER/MANAGER lead with profit + risks; ACCOUNTANT with finance;
  // LABOUR with quick logging + Today (finance hidden entirely — mirrors 11.2 role nav).
  const order: BlockKey[] = isLabour
    ? ['quick', 'today', 'kpis', 'charts', 'risks']
    : isAccountant
      ? ['finance', 'kpis', 'today', 'charts', 'risks']
      : ['onboarding', 'finance', 'kpis', 'risks', 'today', 'charts'];

  return (
    <div className="relative space-y-6">
      {/* Topographic contour texture (farmland) */}
      <svg
        className="pointer-events-none absolute -top-10 right-0 h-72 w-[560px] opacity-50"
        viewBox="0 0 560 300"
        fill="none"
        stroke="hsl(var(--primary))"
        strokeOpacity="0.09"
        strokeWidth="1.3"
        aria-hidden
      >
        {[40, 84, 128, 172, 216, 260].map((y) => (
          <path key={y} d={`M-20 ${y}C120 ${y - 40} 240 ${y + 40} 380 ${y}s180-40 220-60`} />
        ))}
      </svg>

      {/* Hero */}
      <div className="relative flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-[28px] font-semibold tracking-tight text-foreground sm:text-[32px]">
            {greeting.split(',')[0]},{' '}
            <span className="italic text-primary">{(greeting.split(',')[1] ?? '').trim()}</span>
          </h2>
          <p className="mt-1.5 max-w-xl text-sm text-muted-foreground">
            {today ? `${today} · ` : ''}
            {t('dashboard.subtitle')}
          </p>
        </div>
        {canWrite && (
          <Button type="button" loading={dispatchMutation.isPending} onClick={() => dispatchMutation.mutate()}>
            <Send aria-hidden />
            {t('dashboard.dispatch')}
          </Button>
        )}
      </div>

      {order.map((key) => (
        <Fragment key={key}>{blocks[key]}</Fragment>
      ))}
    </div>
  );
}

/* ---------- cold-chain gauge (SVG arc) ---------- */
function ColdGauge({ store }: { store: ColdStorage }) {
  const { t } = useTranslation();
  const temp = store.latest!.temperatureC;
  const lo = store.minTempC;
  const hi = store.maxTempC;
  const pct = Math.min(1, Math.max(0, (temp - lo) / Math.max(0.001, hi - lo)));
  const ok = !store.latest!.isOutOfRange;
  // Semi-circle arc 180°, radius 46, center (58,58)
  const angle = Math.PI * (1 - pct); // pct 0 → left (180°), 1 → right (0°)
  const x = 58 + 46 * Math.cos(angle);
  const y = 58 - 46 * Math.sin(angle);
  const stroke = ok ? 'hsl(var(--success))' : 'hsl(var(--destructive))';
  return (
    <div className="flex items-center gap-4 py-1">
      <svg width="116" height="74" viewBox="0 0 116 74" aria-hidden>
        <path d="M12 58 A46 46 0 0 1 104 58" fill="none" stroke="hsl(var(--muted))" strokeWidth="11" strokeLinecap="round" />
        <path d={`M12 58 A46 46 0 0 1 ${x.toFixed(1)} ${y.toFixed(1)}`} fill="none" stroke={stroke} strokeWidth="11" strokeLinecap="round" />
        <circle cx={x} cy={y} r="6" fill="hsl(var(--card))" stroke={stroke} strokeWidth="3" />
      </svg>
      <div>
        <p className="font-display text-[34px] font-semibold leading-none tabular text-foreground">
          {temp.toFixed(1)}°<span className="text-lg text-muted-foreground">C</span>
        </p>
        <p className="mt-1.5 text-xs font-medium text-muted-foreground">
          {store.name} · {store.mode === 'FROZEN' ? '≤ −18°C' : `${lo}–${hi}°C`}
        </p>
        <span className={cn('mt-1 inline-block text-xs font-bold', ok ? 'text-success-ink' : 'text-destructive')}>
          {ok ? t('dashboard.inRange') : t('dashboard.outOfRange')}
        </span>
      </div>
    </div>
  );
}

/* ---------- market bars ---------- */
function MarketBars({ rows }: { rows: { name: string; unit: string; value: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="space-y-3 py-1">
      {rows.slice(0, 5).map((r) => (
        <div key={r.name} className="flex items-center gap-3">
          <span className="w-20 shrink-0 truncate text-sm font-medium text-foreground">{r.name}</span>
          <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
            {/* Single measure ⇒ solid chart-1; bar length already encodes the value
                (chart-spec §1 — retires the success→accent gradient). The 8% floor is
                a deliberate visibility minimum; the exact value label sits right. */}
            <div
              className="h-full rounded-full"
              style={{ background: 'hsl(var(--chart-1))', width: `${Math.max(8, (r.value / max) * 100)}%` }}
            />
          </div>
          <span className="mono w-16 shrink-0 text-right text-sm font-semibold text-foreground">₹{inr.format(r.value)}</span>
        </div>
      ))}
    </div>
  );
}
