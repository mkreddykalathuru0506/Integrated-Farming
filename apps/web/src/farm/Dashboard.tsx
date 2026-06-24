import { useCallback, useEffect, useMemo, useState, type ComponentType, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import {
  TrendingUp,
  AlertTriangle,
  Bird,
  Wheat,
  Thermometer,
  BellRing,
  BadgeCheck,
  Send,
  type LucideIcon,
} from 'lucide-react';
import { formatPaise } from '@ifm/shared';
import { useAuth } from '../auth/AuthContext';
import { Badge, Button, cn } from '../ui';
import {
  acknowledgeRisk,
  dispatchAlerts,
  farmPnl,
  getDashboard,
  listAlerts,
  listBatches,
  listFeedItems,
  listRisks,
  type AlertLog,
  type Dashboard as DashboardData,
  type Pnl,
  type RiskFlag,
} from './api';

/* Data-viz palette (explicit hex is appropriate for chart series; matches the theme tokens). */
const CHART = {
  primary: '#15803D',
  grid: '#DCFCE7',
  axis: '#6B8576',
  severity: { CRITICAL: '#DC2626', WARNING: '#D97706', INFO: '#15803D', DEFAULT: '#64748B' } as Record<string, string>,
};

const inr = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });

type Tone = 'primary' | 'danger' | 'warning' | 'success' | 'neutral';
const TONE: Record<Tone, string> = {
  primary: 'bg-primary/10 text-primary',
  danger: 'bg-destructive/10 text-destructive',
  warning: 'bg-warning/15 text-warning',
  success: 'bg-success/10 text-success',
  neutral: 'bg-muted text-muted-foreground',
};

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  tone = 'neutral',
}: {
  label: string;
  value: ReactNode;
  sub?: string;
  icon: LucideIcon;
  tone?: Tone;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-card">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <span className={cn('grid h-8 w-8 place-items-center rounded-lg', TONE[tone])}>
          <Icon className="h-4 w-4" aria-hidden />
        </span>
      </div>
      <p className="mt-2 font-display text-2xl font-bold tabular text-foreground">{value}</p>
      {sub && <p className="mt-0.5 truncate text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

function ChartCard({ title, children, empty }: { title: string; children: ReactNode; empty?: boolean }) {
  return (
    <section className="rounded-lg border border-border bg-card p-4 shadow-card">
      <h3 className="mb-3 font-display text-sm font-bold text-foreground">{title}</h3>
      {empty ? <EmptyHint>{title}</EmptyHint> : <div className="h-[220px]">{children}</div>}
    </section>
  );
}

function EmptyHint({ children }: { children: ReactNode }) {
  return <p className="grid h-[180px] place-items-center text-center text-sm text-muted-foreground">{children}</p>;
}

const SEV_TONE: Record<string, Tone> = { CRITICAL: 'danger', WARNING: 'warning' };
function sevBadge(sev: string): Tone {
  return SEV_TONE[sev] ?? 'neutral';
}
function toBadgeVariant(tone: Tone): 'destructive' | 'warning' | 'muted' {
  return tone === 'danger' ? 'destructive' : tone === 'warning' ? 'warning' : 'muted';
}

export function Dashboard({ farmId, canWrite }: { farmId: string; canWrite: boolean }) {
  const { t } = useTranslation();
  const { accessToken, user } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [pnl, setPnl] = useState<Pnl | null>(null);
  const [risks, setRisks] = useState<RiskFlag[]>([]);
  const [alerts, setAlerts] = useState<AlertLog[]>([]);
  const [activeBatches, setActiveBatches] = useState<number | null>(null);
  const [lowFeed, setLowFeed] = useState<number | null>(null);

  const refresh = useCallback(() => {
    if (!accessToken) return;
    const ok = <T,>(p: Promise<T>, set: (v: T) => void) => p.then(set).catch(() => undefined);
    ok(getDashboard(accessToken, farmId), setData);
    ok(farmPnl(accessToken, farmId), setPnl);
    ok(listRisks(accessToken, farmId, 'OPEN'), (r) => setRisks(r.risks));
    ok(listAlerts(accessToken, farmId), (r) => setAlerts(r.alerts));
    ok(listBatches(accessToken, farmId), (r) => setActiveBatches(r.batches.filter((b) => b.status === 'ACTIVE').length));
    ok(listFeedItems(accessToken, farmId), (r) =>
      setLowFeed(
        r.items.filter((i) => i.reorderThreshold != null && Number(i.stockQty) <= Number(i.reorderThreshold)).length,
      ),
    );
  }, [accessToken, farmId]);

  useEffect(refresh, [refresh]);

  const severityData = useMemo(
    () =>
      Object.entries(data?.risks.bySeverity ?? {})
        .filter(([, v]) => v > 0)
        .map(([k, v]) => ({ name: k, label: t(`dashboard.${k.toLowerCase()}`, k), value: v })),
    [data, t],
  );
  const marketData = useMemo(
    () => (data?.market ?? []).map((m) => ({ name: m.commodity, value: Math.round(Number(m.pricePaise) / 100) })),
    [data],
  );

  async function onDispatch() {
    if (!accessToken) return;
    await dispatchAlerts(accessToken, farmId).then(refresh).catch(() => undefined);
  }
  async function onAck(id: string) {
    if (!accessToken) return;
    await acknowledgeRisk(accessToken, farmId, id).then(refresh).catch(() => undefined);
  }

  if (!data) return <p className="text-sm text-muted-foreground">{t('dashboard.loading')}</p>;

  const profit = pnl ? formatPaise(Number(pnl.profitPaise)) : '—';
  const revenueSub = pnl ? `${t('dashboard.revenue')}: ${formatPaise(Number(pnl.revenuePaise))}` : undefined;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-extrabold text-foreground sm:text-2xl">
            {t('dashboard.greeting', { name: user?.name ?? '' })}
          </h2>
          <p className="text-sm text-muted-foreground">{t('dashboard.subtitle')}</p>
        </div>
        {canWrite && (
          <Button type="button" variant="secondary" size="sm" onClick={() => void onDispatch()}>
            <Send aria-hidden />
            {t('dashboard.dispatch')}
          </Button>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard label={t('dashboard.profit')} value={profit} sub={revenueSub} icon={TrendingUp} tone={pnl && Number(pnl.profitPaise) >= 0 ? 'success' : 'danger'} />
        <StatCard label={t('dashboard.openRisks')} value={data.risks.open} icon={AlertTriangle} tone={data.risks.open > 0 ? 'danger' : 'success'} />
        <StatCard label={t('dashboard.batches')} value={activeBatches ?? '—'} icon={Bird} tone="primary" />
        <StatCard label={t('dashboard.feedLow')} value={lowFeed ?? '—'} icon={Wheat} tone={lowFeed && lowFeed > 0 ? 'warning' : 'neutral'} />
        <StatCard
          label={t('dashboard.temp')}
          value={data.weather ? `${Math.round(data.weather.tempC)}°C` : '—'}
          sub={data.weather ? data.weather.source : undefined}
          icon={Thermometer}
          tone="primary"
        />
        <StatCard label={t('dashboard.alertsSent')} value={data.alerts.total} icon={BellRing} tone="neutral" />
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title={t('dashboard.riskBreakdown')} empty={severityData.length === 0}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={severityData} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
              <CartesianGrid horizontal={false} stroke={CHART.grid} />
              <XAxis type="number" allowDecimals={false} stroke={CHART.axis} fontSize={12} />
              <YAxis type="category" dataKey="label" width={84} stroke={CHART.axis} fontSize={12} />
              <Tooltip cursor={{ fill: CHART.grid, opacity: 0.4 }} />
              <Bar dataKey="value" radius={[0, 6, 6, 0]} name={t('dashboard.openRisks')}>
                {severityData.map((d) => (
                  <Cell key={d.name} fill={CHART.severity[d.name] ?? CHART.severity.DEFAULT} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title={t('dashboard.marketTitle')} empty={marketData.length === 0}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={marketData} margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
              <CartesianGrid vertical={false} stroke={CHART.grid} />
              <XAxis dataKey="name" stroke={CHART.axis} fontSize={12} />
              <YAxis stroke={CHART.axis} fontSize={12} tickFormatter={(v) => `₹${inr.format(Number(v))}`} width={64} />
              <Tooltip formatter={(value) => [`₹${inr.format(Number(value))}`, '']} cursor={{ fill: CHART.grid, opacity: 0.4 }} />
              <Bar dataKey="value" fill={CHART.primary} radius={[6, 6, 0, 0]} name="₹" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Lists */}
      <div className="grid gap-4 lg:grid-cols-2">
        <ListCard title={t('dashboard.openRisksTitle')} empty={risks.length === 0} emptyIcon={BadgeCheck} emptyText={t('dashboard.noRisks')}>
          <ul className="space-y-2">
            {risks.slice(0, 6).map((r) => {
              const tone = sevBadge(r.severity);
              return (
                <li key={r.id} className="flex items-start justify-between gap-3 rounded-lg border border-border px-3 py-2">
                  <div className="min-w-0">
                    <Badge variant={toBadgeVariant(tone)}>{t(`dashboard.${r.severity.toLowerCase()}`, r.severity)}</Badge>
                    <p className="mt-1 text-sm text-foreground">{r.reason}</p>
                  </div>
                  {canWrite && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => void onAck(r.id)}>
                      {t('dashboard.ack')}
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        </ListCard>

        <ListCard title={t('dashboard.recentAlerts')} empty={alerts.length === 0} emptyIcon={BellRing} emptyText={t('dashboard.noAlerts')}>
          <ul className="space-y-2">
            {alerts.slice(0, 6).map((a) => (
              <li key={a.id} className="rounded-lg border border-border px-3 py-2 text-sm">
                <div className="mb-0.5 flex items-center gap-2">
                  <Badge variant="muted">{a.channel}</Badge>
                  <span className="text-xs text-muted-foreground">{a.status}</span>
                </div>
                <p className="text-foreground">{a.body}</p>
              </li>
            ))}
          </ul>
        </ListCard>
      </div>
    </div>
  );
}

function ListCard({
  title,
  children,
  empty,
  emptyIcon: EmptyIcon,
  emptyText,
}: {
  title: string;
  children: ReactNode;
  empty: boolean;
  emptyIcon: ComponentType<{ className?: string }>;
  emptyText: string;
}) {
  return (
    <section className="rounded-lg border border-border bg-card p-4 shadow-card">
      <h3 className="mb-3 font-display text-sm font-bold text-foreground">{title}</h3>
      {empty ? (
        <div className="grid place-items-center gap-2 py-8 text-center">
          <EmptyIcon className="h-6 w-6 text-success" />
          <p className="text-sm text-muted-foreground">{emptyText}</p>
        </div>
      ) : (
        children
      )}
    </section>
  );
}
