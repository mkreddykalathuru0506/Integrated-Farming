import { Recycle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useCircularity } from '../api/ops.hooks';
import { fmtInr, fmtInrCompact } from '../lib/format';
import { Button, EmptyState, PanelError, PanelHeading, StatSkeleton, SubPanel } from '../ui';
import { SpaLink, spaNavigate } from './SpaLink';

type BarDatum = { name: string; rupees: number; paise: string };

/**
 * Horizontal single-hue bar list (magnitude job → sequential colour, one token hue).
 * Values are integer paise end-to-end; the numeric axis is display-only rupees.
 */
function SavingsBars({ data, hue }: { data: BarDatum[]; hue: string }) {
  const height = data.length * 36 + 8;
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 56, bottom: 0, left: 0 }}>
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="name"
            width={110}
            tickLine={false}
            axisLine={false}
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
          />
          <Tooltip
            cursor={{ fill: 'hsl(var(--muted) / 0.5)' }}
            contentStyle={{
              background: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: 8,
              fontSize: 12,
              color: 'hsl(var(--foreground))',
            }}
            formatter={(_v, _n, item) => [fmtInr((item.payload as BarDatum).paise), null]}
          />
          <Bar
            dataKey="rupees"
            fill={hue}
            radius={[0, 4, 4, 0]}
            barSize={14}
            label={{
              position: 'right',
              fill: 'hsl(var(--muted-foreground))',
              fontSize: 11,
              formatter: (v) => fmtInrCompact(Math.round(Number(v ?? 0) * 100)),
            }}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function StatTile({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`rounded-xl border border-border p-3 ${accent ? 'bg-success/10' : 'bg-card'}`}>
      <p className={`text-xs font-medium ${accent ? 'text-success' : 'text-muted-foreground'}`}>{label}</p>
      <p className={`mt-1 font-display text-xl font-semibold tabular ${accent ? 'text-success' : 'text-foreground'}`}>
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
              <SavingsBars data={byType} hue="hsl(var(--success))" />
            </SubPanel>
          )}

          {byDestination.length > 0 && (
            <SubPanel>
              <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {t('circularity.byDestination')}
              </p>
              <SavingsBars data={byDestination} hue="hsl(var(--primary))" />
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
