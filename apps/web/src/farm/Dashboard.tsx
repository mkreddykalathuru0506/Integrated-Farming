import { useCallback, useEffect, useMemo, useState, type ComponentType, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Bird,
  Wheat,
  Thermometer,
  Snowflake,
  BadgeCheck,
  BellRing,
  Send,
  ArrowUpRight,
  ArrowDownRight,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { Button, cn } from '../ui';
import {
  acknowledgeRisk,
  dispatchAlerts,
  farmPnl,
  getDashboard,
  listAlerts,
  listBatches,
  listColdStorages,
  listExpenses,
  listFeedItems,
  listRisks,
  type AlertLog,
  type ColdStorage,
  type Dashboard as DashboardData,
  type Pnl,
  type RiskFlag,
} from './api';

/* Data-viz palette (explicit hex appropriate for chart series; mirrors the theme tokens). */
const SEV_HEX: Record<string, string> = { CRITICAL: '#C0392F', WARNING: '#C15A2B', INFO: '#1C6B43', DEFAULT: '#8A8270' };
const inr = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });

/** Compact Indian-currency from paise: ₹1.24L, ₹2.3Cr, ₹4.5k, ₹820. */
function compactInr(paise: number): string {
  const r = paise / 100;
  const a = Math.abs(r);
  const s = r < 0 ? '-' : '';
  if (a >= 1e7) return `${s}₹${(a / 1e7).toFixed(2)}Cr`;
  if (a >= 1e5) return `${s}₹${(a / 1e5).toFixed(2)}L`;
  if (a >= 1e3) return `${s}₹${(a / 1e3).toFixed(1)}k`;
  return `${s}₹${inr.format(a)}`;
}

type Tone = 'primary' | 'danger' | 'warning' | 'success' | 'gold' | 'neutral';
const BADGE: Record<Tone, string> = {
  primary: 'bg-primary/10 text-primary',
  danger: 'bg-destructive/10 text-destructive',
  warning: 'bg-warning/12 text-warning',
  success: 'bg-success/12 text-success',
  gold: 'bg-accent/12 text-accent',
  neutral: 'bg-muted text-muted-foreground',
};

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
    <section
      className={cn(
        'relative rounded-lg border border-border bg-card p-5 shadow-card',
        "before:absolute before:inset-x-5 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-accent/40 before:to-transparent before:content-['']",
        span,
      )}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="font-display text-base font-semibold text-foreground">{title}</h3>
        {sub != null && (
          <span className="rounded-md bg-background px-2 py-1 text-xs font-semibold text-muted-foreground">{sub}</span>
        )}
      </div>
      {children}
    </section>
  );
}

function EmptyState({ icon: Icon, text }: { icon: ComponentType<{ className?: string }>; text: string }) {
  return (
    <div className="grid place-items-center gap-2 py-10 text-center">
      <Icon className="h-6 w-6 text-success" />
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  );
}

function Kpi({
  label,
  value,
  sub,
  icon: Icon,
  tone = 'neutral',
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  icon: LucideIcon;
  tone?: Tone;
}) {
  return (
    <div className="relative col-span-6 rounded-lg border border-border bg-card p-4 shadow-card sm:col-span-3 xl:col-span-2">
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-semibold text-muted-foreground">{label}</span>
        <span className={cn('grid h-9 w-9 place-items-center rounded-xl', BADGE[tone])}>
          <Icon className="h-[18px] w-[18px]" aria-hidden />
        </span>
      </div>
      <p className="mt-3 font-display text-[28px] font-medium leading-none tracking-tight tabular text-foreground">
        {value}
      </p>
      {sub != null && <p className="mt-2 text-xs font-medium text-muted-foreground">{sub}</p>}
    </div>
  );
}

function TrendChip({ up, children }: { up: boolean; children: ReactNode }) {
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold',
        up ? 'bg-success/14 text-success' : 'bg-destructive/12 text-destructive',
      )}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {children}
    </span>
  );
}

/* ---------- main ---------- */

export function Dashboard({ farmId, canWrite }: { farmId: string; canWrite: boolean }) {
  const { t, i18n } = useTranslation();
  const { accessToken, user } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [pnl, setPnl] = useState<Pnl | null>(null);
  const [risks, setRisks] = useState<RiskFlag[]>([]);
  const [alerts, setAlerts] = useState<AlertLog[]>([]);
  const [activeBatches, setActiveBatches] = useState<number | null>(null);
  const [birds, setBirds] = useState<number>(0);
  const [lowFeed, setLowFeed] = useState<number | null>(null);
  const [costByCat, setCostByCat] = useState<{ name: string; value: number }[]>([]);
  const [cold, setCold] = useState<ColdStorage | null>(null);

  const refresh = useCallback(() => {
    if (!accessToken) return;
    const ok = <T,>(p: Promise<T>, set: (v: T) => void) => p.then(set).catch(() => undefined);
    ok(getDashboard(accessToken, farmId), setData);
    ok(farmPnl(accessToken, farmId), setPnl);
    ok(listRisks(accessToken, farmId, 'OPEN'), (r) => setRisks(r.risks));
    ok(listAlerts(accessToken, farmId), (r) => setAlerts(r.alerts));
    ok(listBatches(accessToken, farmId), (r) => {
      const active = r.batches.filter((b) => b.status === 'ACTIVE');
      setActiveBatches(active.length);
      setBirds(active.reduce((n, b) => n + (b.currentCount || 0), 0));
    });
    ok(listFeedItems(accessToken, farmId), (r) =>
      setLowFeed(
        r.items.filter((i) => i.reorderThreshold != null && Number(i.stockQty) <= Number(i.reorderThreshold)).length,
      ),
    );
    ok(listExpenses(accessToken, farmId), (r) => {
      const by = new Map<string, number>();
      for (const e of r.expenses) by.set(e.category, (by.get(e.category) ?? 0) + Number(e.amountPaise));
      setCostByCat([...by.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 5));
    });
    ok(listColdStorages(accessToken, farmId), (r) =>
      setCold(r.stores.find((s) => s.isActive && s.latest) ?? r.stores[0] ?? null),
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

  async function onDispatch() {
    if (!accessToken) return;
    await dispatchAlerts(accessToken, farmId).then(refresh).catch(() => undefined);
  }
  async function onAck(id: string) {
    if (!accessToken) return;
    await acknowledgeRisk(accessToken, farmId, id).then(refresh).catch(() => undefined);
  }

  if (!data) return <p className="text-sm text-muted-foreground">{t('dashboard.loading')}</p>;

  const critical = data.risks.bySeverity.CRITICAL ?? 0;
  const profitPaise = pnl ? Number(pnl.profitPaise) : 0;
  const costMax = Math.max(1, ...costByCat.map((c) => c.value));
  const totalRisks = severityData.reduce((n, d) => n + d.value, 0);

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
          <Button type="button" onClick={() => void onDispatch()}>
            <Send aria-hidden />
            {t('dashboard.dispatch')}
          </Button>
        )}
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-12 gap-4">
        {/* Profit hero */}
        <div className="relative col-span-12 rounded-lg border border-border bg-card p-5 shadow-card sm:col-span-6 xl:col-span-4">
          <div className="flex items-start justify-between">
            <span className="text-xs font-semibold text-muted-foreground">{t('dashboard.profit')}</span>
            <span className={cn('grid h-9 w-9 place-items-center rounded-xl', profitPaise >= 0 ? BADGE.success : BADGE.danger)}>
              {profitPaise >= 0 ? <TrendingUp className="h-[18px] w-[18px]" /> : <TrendingDown className="h-[18px] w-[18px]" />}
            </span>
          </div>
          <p className="mt-3 font-display text-[40px] font-medium leading-none tracking-tight tabular text-foreground">
            {compactInr(profitPaise)}
          </p>
          <div className="mt-3 flex items-center gap-3">
            <TrendChip up={profitPaise >= 0}>{profitPaise >= 0 ? t('dashboard.profitable') : t('dashboard.loss')}</TrendChip>
            {pnl && (
              <span className="text-xs text-muted-foreground">
                {t('dashboard.revenue')} {compactInr(Number(pnl.revenuePaise))} · {t('dashboard.costLabel')}{' '}
                {compactInr(Number(pnl.costPaise))}
              </span>
            )}
          </div>
        </div>

        <Kpi label={t('dashboard.openRisks')} value={data.risks.open} sub={t('dashboard.criticalCount', { count: critical })} icon={AlertTriangle} tone={data.risks.open > 0 ? 'danger' : 'success'} />
        <Kpi label={t('dashboard.batches')} value={activeBatches ?? '—'} sub={t('dashboard.birds', { count: birds })} icon={Bird} tone="primary" />
        <Kpi label={t('dashboard.feedLow')} value={lowFeed ?? '—'} sub={lowFeed && lowFeed > 0 ? t('dashboard.belowReorder', { count: lowFeed }) : t('dashboard.allStocked')} icon={Wheat} tone={lowFeed && lowFeed > 0 ? 'warning' : 'gold'} />
        <Kpi label={t('dashboard.temp')} value={data.weather ? `${Math.round(data.weather.tempC)}°` : '—'} sub={data.weather ? data.weather.source : '—'} icon={Thermometer} tone="primary" />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-12 gap-4">
        {/* Cost by category */}
        <Panel title={t('dashboard.costByCategory')} sub={t('dashboard.thisFarm')} span="col-span-12 lg:col-span-7">
          {costByCat.length === 0 ? (
            <EmptyState icon={Wheat} text={t('dashboard.noCost')} />
          ) : (
            <div className="space-y-3 py-1">
              {costByCat.map((c) => (
                <div key={c.name} className="flex items-center gap-3">
                  <span className="w-28 shrink-0 truncate text-sm font-medium capitalize text-foreground">{c.name.toLowerCase()}</span>
                  <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-primary to-success"
                      style={{ width: `${Math.max(6, (c.value / costMax) * 100)}%` }}
                    />
                  </div>
                  <span className="mono w-20 shrink-0 text-right text-sm font-semibold text-foreground">
                    {compactInr(c.value)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Panel>

        {/* Risk donut */}
        <Panel title={t('dashboard.riskBreakdown')} sub={t('dashboard.live')} span="col-span-12 lg:col-span-5">
          {severityData.length === 0 ? (
            <EmptyState icon={BadgeCheck} text={t('dashboard.noRisks')} />
          ) : (
            <div className="flex items-center gap-4">
              <div className="relative h-[150px] w-[150px] shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={severityData} dataKey="value" nameKey="label" innerRadius={48} outerRadius={70} paddingAngle={3} stroke="none">
                      {severityData.map((d) => (
                        <Cell key={d.name} fill={SEV_HEX[d.name] ?? SEV_HEX.DEFAULT} />
                      ))}
                    </Pie>
                    <Tooltip />
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
                    <span className="h-2.5 w-2.5 rounded-sm" style={{ background: SEV_HEX[d.name] ?? SEV_HEX.DEFAULT }} />
                    <span className="flex-1 text-foreground">{d.label}</span>
                    <span className="mono font-semibold text-muted-foreground">{d.value}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Panel>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-12 gap-4">
        {/* Cold chain gauge */}
        <Panel
          title={t('dashboard.coldChain')}
          sub={cold?.latest ? (cold.latest.isOutOfRange ? t('dashboard.outOfRange') : t('dashboard.inRange')) : undefined}
          span="col-span-12 sm:col-span-6 lg:col-span-4"
        >
          {cold?.latest ? (
            <ColdGauge store={cold} />
          ) : (
            <EmptyState icon={Snowflake} text={t('dashboard.noCold')} />
          )}
        </Panel>

        {/* Market */}
        <Panel title={t('dashboard.marketTitle')} sub={data.market[0]?.commodity ? t('dashboard.live') : undefined} span="col-span-12 sm:col-span-6 lg:col-span-4">
          {data.market.length === 0 ? (
            <EmptyState icon={TrendingUp} text={t('dashboard.noMarket')} />
          ) : (
            <MarketBars rows={data.market.map((m) => ({ name: m.commodity, unit: m.unit, value: Number(m.pricePaise) / 100 }))} />
          )}
        </Panel>

        {/* Activity */}
        <Panel title={t('dashboard.recentAlerts')} sub={alerts.length ? String(alerts.length) : undefined} span="col-span-12 lg:col-span-4">
          {alerts.length === 0 ? (
            <EmptyState icon={BellRing} text={t('dashboard.noAlerts')} />
          ) : (
            <ul className="relative space-y-1 pl-4 before:absolute before:bottom-1.5 before:left-[5px] before:top-1.5 before:w-0.5 before:bg-border before:content-['']">
              {alerts.slice(0, 4).map((a) => (
                <li key={a.id} className="relative py-1.5">
                  <span className="absolute -left-[13px] top-3 h-2.5 w-2.5 rounded-full bg-primary shadow-[0_0_0_4px_hsl(var(--card))]" />
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

      {/* Open risk flags (full width, actionable) */}
      {risks.length > 0 && (
        <Panel title={t('dashboard.openRisksTitle')} span="col-span-12">
          <ul className="grid gap-2 sm:grid-cols-2">
            {risks.slice(0, 6).map((r) => {
              const hex = SEV_HEX[r.severity] ?? SEV_HEX.DEFAULT;
              return (
                <li key={r.id} className="flex items-start gap-3 rounded-xl border border-border bg-card px-3 py-2.5">
                  <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: hex }} />
                  <div className="min-w-0 flex-1">
                    <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: hex }}>
                      {t(`dashboard.${r.severity.toLowerCase()}`, r.severity)}
                    </span>
                    <p className="text-sm text-muted-foreground">{r.reason}</p>
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
        </Panel>
      )}
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
        <span className={cn('mt-1 inline-block text-xs font-bold', ok ? 'text-success' : 'text-destructive')}>
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
            <div className="h-full rounded-full bg-gradient-to-r from-success to-accent" style={{ width: `${Math.max(8, (r.value / max) * 100)}%` }} />
          </div>
          <span className="mono w-16 shrink-0 text-right text-sm font-semibold text-foreground">₹{inr.format(r.value)}</span>
        </div>
      ))}
    </div>
  );
}
