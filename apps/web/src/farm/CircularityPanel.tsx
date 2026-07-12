import { Recycle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useCircularity } from '../api/ops.hooks';
import { fmtInr, fmtInrCompact } from '../lib/format';
import {
  BAR_CURSOR,
  Button,
  ChartTooltipFrame,
  chartAnim,
  EmptyState,
  PanelError,
  PanelHeading,
  StatSkeleton,
  SubPanel,
} from '../ui';
import { SpaLink, spaNavigate } from './SpaLink';

type BarDatum = { name: string; rupees: number; paise: string };

/** Money exact in the tooltip (chart-spec §6) — reads paise from the raw datum. */
function SavingsTip({ active, payload }: { active?: boolean; payload?: { payload: BarDatum }[] }) {
  if (!active || !payload || payload.length === 0) return null;
  const p = payload[0]!.payload;
  return (
    <ChartTooltipFrame>
      <p className="flex items-center gap-1.5 text-muted-foreground">
        <span className="h-2 w-2 shrink-0 rounded-[3px]" style={{ background: 'hsl(var(--chart-1))' }} />
        <span>{p.name}</span>
        <span className="tabular ml-auto pl-2 font-semibold text-foreground">{fmtInr(p.paise)}</span>
      </p>
    </ChartTooltipFrame>
  );
}

/**
 * Horizontal single-series bar list — every mark is chart-1 (magnitude is encoded by
 * length, never by color; chart-spec §1). Values are integer paise end-to-end; the
 * numeric axis is display-only rupees.
 */
function SavingsBars({ data }: { data: BarDatum[] }) {
  const height = data.length * 36 + 8;
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" barCategoryGap="25%" margin={{ top: 0, right: 56, bottom: 0, left: 0 }}>
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="name"
            width={110}
            tickLine={false}
            axisLine={false}
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
          />
          <Tooltip cursor={BAR_CURSOR} content={<SavingsTip />} />
          <Bar
            dataKey="rupees"
            fill="hsl(var(--chart-1))"
            radius={[0, 4, 4, 0]}
            barSize={14}
            label={{
              position: 'right',
              fill: 'hsl(var(--muted-foreground))',
              fontSize: 11,
              formatter: (v) => fmtInrCompact(Math.round(Number(v ?? 0) * 100)),
            }}
            {...chartAnim()}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function StatTile({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`rounded-md border border-border p-3 ${accent ? 'bg-success/10' : 'bg-card'}`}>
      <p className={`text-xs font-medium ${accent ? 'text-success-ink' : 'text-muted-foreground'}`}>{label}</p>
      <p className={`mt-1 font-display text-xl font-semibold tabular ${accent ? 'text-success-ink' : 'text-foreground'}`}>
        {value}
      </p>
    </div>
  );
}

export function CircularityPanel(_props: { farmId: string }) {
  const { t } = useTranslation();
  const circularity = useCircularity();

  const byType: BarDatum[] = (circularity.data?.byType ?? []).map((b) => ({
    name: t(`byproducts.type.${b.type}`),
    rupees: Number(b.creditPaise) / 100,
    paise: b.creditPaise,
  }));
  const byDestination: BarDatum[] = (circularity.data?.byDestination ?? []).map((d) => ({
    name: d.unitName ?? t('circularity.unassigned'),
    rupees: Number(d.creditPaise) / 100,
    paise: d.creditPaise,
  }));

  return (
    <section className="space-y-3">
      <PanelHeading>{t('circularity.title')}</PanelHeading>

      {circularity.isPending && (
        <div className="grid gap-3 sm:grid-cols-3">
          <StatSkeleton />
          <StatSkeleton />
          <StatSkeleton />
        </div>
      )}

      {circularity.isError && (
        <div className="space-y-2">
          <PanelError>{t('circularity.error')}</PanelError>
          <Button type="button" variant="secondary" size="sm" onClick={() => void circularity.refetch()}>
            {t('circularity.retry')}
          </Button>
        </div>
      )}

      {circularity.data && circularity.data.transferCount === 0 && (
        <EmptyState
          icon={Recycle}
          illustration="generic"
          title={t('circularity.emptyTitle')}
          description={t('circularity.empty')}
          action={
            <Button type="button" onClick={() => spaNavigate('/maintenance/byproducts')}>
              {t('circularity.cta')}
            </Button>
          }
        />
      )}

      {circularity.data && circularity.data.transferCount > 0 && (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <StatTile accent label={t('circularity.totalSaved')} value={fmtInr(circularity.data.totalCreditPaise)} />
            <StatTile label={t('circularity.transfers')} value={String(circularity.data.transferCount)} />
            <StatTile label={t('circularity.quantity')} value={String(circularity.data.totalQuantity)} />
          </div>

          {byType.length > 0 && (
            <SubPanel>
              <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {t('circularity.byType')}
              </p>
              <SavingsBars data={byType} />
            </SubPanel>
          )}

          {byDestination.length > 0 && (
            <SubPanel>
              <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {t('circularity.byDestination')}
              </p>
              <SavingsBars data={byDestination} />
            </SubPanel>
          )}

          <p className="text-sm">
            <SpaLink href="/maintenance/byproducts">{t('circularity.cta')} →</SpaLink>
          </p>
        </>
      )}
    </section>
  );
}
