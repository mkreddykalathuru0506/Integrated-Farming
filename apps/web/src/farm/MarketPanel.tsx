import { useMemo, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, RefreshCw, TrendingUp } from 'lucide-react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { z } from 'zod';
import { useMarketHistory, useMarketRates, useRecordRate, useRefreshRate } from '../api/ops.hooks';
import { fmtDate, fmtDateTime, fmtInr, fmtInrCompact, rupeesToPaise } from '../lib/format';
import {
  Badge,
  Button,
  ChartEmpty,
  ChartTooltipFrame,
  chartAnim,
  DataTable,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  Field,
  GRID_PROPS,
  InrInput,
  Input,
  LINE_CURSOR,
  PanelError,
  PanelHeading,
  Select,
  Skeleton,
  useToast,
  type DataTableColumn,
} from '../ui';
import { LoadMore } from './LoadMore';
import type { MarketRate } from './api';

function SourceBadge({ source }: { source: string }) {
  const { t } = useTranslation();
  if (source === 'mock') return <Badge variant="warning">{t('market.mockBadge')}</Badge>;
  if (source === 'manual') return <Badge variant="muted">{source}</Badge>;
  return <Badge variant="accent">{source}</Badge>;
}

/* ---------- record-rate dialog (manual entry is the primary path) ---------- */

const rateSchema = z.object({
  commodity: z.string().trim().min(1, 'market.commodityRequired'),
  market: z.string(),
  price: z.string().refine((v) => {
    const p = rupeesToPaise(v);
    return p !== null && p !== '0' && !p.startsWith('-');
  }, 'market.invalidPrice'),
  unit: z.string().trim().min(1, 'market.unitRequired'),
});
type RateValues = z.infer<typeof rateSchema>;

function RecordRateDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { t } = useTranslation();
  const toast = useToast();
  const recordRate = useRecordRate();
  const form = useForm<RateValues>({
    resolver: zodResolver(rateSchema),
    defaultValues: { commodity: '', market: '', price: '', unit: 'kg' },
  });
  const err = (m?: string) => (m ? t(m) : undefined);

  const onSubmit = form.handleSubmit((v) => {
    recordRate.mutate(
      {
        commodity: v.commodity.trim(),
        market: v.market.trim() || undefined,
        pricePaise: rupeesToPaise(v.price)!,
        unit: v.unit.trim(),
      },
      {
        onSuccess: (res) => {
          if (res.risk?.atRisk) toast.warning(`${t('market.priceDropWarn')}: ${res.risk.reason}`);
          form.reset();
          onOpenChange(false);
        },
      },
    );
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{t('market.record')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={(e) => void onSubmit(e)} className="space-y-3" noValidate>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t('market.commodity')} required error={err(form.formState.errors.commodity?.message)}>
              <Input placeholder={t('market.commodityPlaceholder')} {...form.register('commodity')} />
            </Field>
            <Field label={t('market.marketLabel')}>
              <Input {...form.register('market')} />
            </Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Controller
              control={form.control}
              name="price"
              render={({ field }) => (
                <Field label={t('market.price')} required error={err(form.formState.errors.price?.message)}>
                  <InrInput value={field.value} onChangePaise={(_p, rupees) => field.onChange(rupees)} />
                </Field>
              )}
            />
            <Field label={t('market.unit')} required error={err(form.formState.errors.unit?.message)}>
              <Input {...form.register('unit')} />
            </Field>
          </div>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" loading={recordRate.isPending}>
              {t('market.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- price-history line chart (single series → no legend) ---------- */

function HistoryChart({ commodity }: { commodity: string }) {
  const { t } = useTranslation();
  const history = useMarketHistory(commodity);

  if (history.isPending) return <Skeleton className="h-48 w-full" />;
  if (history.isError) return <PanelError>{t('market.historyError')}</PanelError>;

  const points = (history.data ?? []).map((r) => ({
    ts: r.observedAt,
    rupees: Number(r.pricePaise) / 100, // display-only position; money stays integer paise
    paise: r.pricePaise,
    unit: r.unit,
  }));
  if (points.length === 0) return <ChartEmpty art="generic" text={t('market.historyEmpty')} className="h-48" />;

  return (
    <div className="h-48 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={points} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          {/* The only sanctioned chart gradient: series token fading to transparent (§3). */}
          <defs>
            <linearGradient id="fillChart1" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--chart-1))" stopOpacity={0.28} />
              <stop offset="100%" stopColor="hsl(var(--chart-1))" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid {...GRID_PROPS} />
          <XAxis
            dataKey="ts"
            tickFormatter={(v: string) => fmtDate(v).slice(0, 5)}
            tickLine={false}
            axisLine={false}
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
            minTickGap={24}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={44}
            tick={{
              fill: 'hsl(var(--muted-foreground))',
              fontSize: 11,
              style: { fontVariantNumeric: 'tabular-nums' },
            }}
            tickFormatter={(v) => fmtInrCompact(Math.round(Number(v) * 100))}
            domain={['auto', 'auto']}
          />
          <Tooltip cursor={LINE_CURSOR} content={<PriceTip />} />
          <Area
            type="monotone"
            dataKey="rupees"
            stroke="hsl(var(--chart-1))"
            strokeWidth={2}
            fill="url(#fillChart1)"
            dot={false}
            activeDot={{ r: 4, stroke: 'hsl(var(--card))', strokeWidth: 2 }}
            {...chartAnim()}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Bespoke tooltip body on the shared popover frame — money exact (fmtInr), never compact. */
function PriceTip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { payload: { paise: string; unit: string } }[];
  label?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const p = payload[0]!.payload;
  return (
    <ChartTooltipFrame>
      <p className="mb-0.5 font-semibold text-foreground">{fmtDateTime(String(label))}</p>
      <p className="flex items-center gap-1.5 text-muted-foreground">
        <span className="h-2 w-2 shrink-0 rounded-[3px]" style={{ background: 'hsl(var(--chart-1))' }} />
        <span className="tabular font-semibold text-foreground">
          {fmtInr(p.paise)}/{p.unit}
        </span>
      </p>
    </ChartTooltipFrame>
  );
}

/* ---------- panel ---------- */

export function MarketPanel({ canWrite }: { farmId: string; canWrite: boolean }) {
  const { t } = useTranslation();
  const toast = useToast();
  const rates = useMarketRates();
  const refreshRate = useRefreshRate();
  const [recordOpen, setRecordOpen] = useState(false);
  const [historyCommodity, setHistoryCommodity] = useState('');

  const commodities = useMemo(
    () => [...new Set((rates.items ?? []).map((r) => r.commodity))],
    [rates.items],
  );
  const selectedCommodity = historyCommodity || commodities[0] || '';

  function onRefresh(rate: MarketRate) {
    refreshRate.mutate(
      { commodity: rate.commodity, market: rate.market ?? undefined },
      {
        onSuccess: (res) => {
          toast.success(t('market.refreshed', { source: res.rate.source }));
          if (res.risk?.atRisk) toast.warning(`${t('market.priceDropWarn')}: ${res.risk.reason}`);
        },
      },
    );
  }

  const columns: DataTableColumn<MarketRate>[] = [
    {
      header: 'market.colCommodity',
      accessor: 'commodity',
      cell: (r) => <span className="font-medium text-foreground">{r.commodity}</span>,
    },
    { header: 'market.colMarket', accessor: (r) => r.market ?? '', cell: (r) => r.market ?? '—' },
    {
      header: 'market.colPrice',
      align: 'right',
      accessor: (r) => Number(r.pricePaise),
      cell: (r) => `${fmtInr(r.pricePaise)}/${r.unit}`,
    },
    {
      header: 'market.colSource',
      accessor: 'source',
      cell: (r) => <SourceBadge source={r.source} />,
    },
    {
      header: 'market.colObserved',
      accessor: 'observedAt',
      cell: (r) => fmtDateTime(r.observedAt),
    },
    ...(canWrite
      ? [
          {
            // Wires the Phase-7 live adapter (POST /api/farm/market/refresh) into the UI.
            header: 'market.refreshSource',
            cell: (r: MarketRate) => (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                loading={refreshRate.isPending && refreshRate.variables?.commodity === r.commodity}
                onClick={() => onRefresh(r)}
              >
                <RefreshCw aria-hidden />
                {t('market.refreshSource')}
              </Button>
            ),
          } satisfies DataTableColumn<MarketRate>,
        ]
      : []),
  ];

  return (
    <section className="space-y-3">
      <PanelHeading
        action={
          canWrite && (
            <Button type="button" size="sm" onClick={() => setRecordOpen(true)}>
              <Plus aria-hidden />
              {t('market.record')}
            </Button>
          )
        }
      >
        {t('market.title')}
      </PanelHeading>

      {rates.isError ? (
        <div className="space-y-2">
          <PanelError>{t('market.error')}</PanelError>
          <Button type="button" variant="secondary" size="sm" onClick={() => void rates.refetch()}>
            {t('market.retry')}
          </Button>
        </div>
      ) : (
        <>
          <DataTable
            columns={columns}
            data={rates.items}
            isLoading={rates.isPending}
            searchable
            pageSize={10}
            getRowId={(r) => r.id}
            emptyState={
              <EmptyState
                icon={TrendingUp}
                illustration="generic"
                title={t('market.empty')}
                description={t('market.emptyDesc')}
                action={
                  canWrite && (
                    <Button type="button" onClick={() => setRecordOpen(true)}>
                      <Plus aria-hidden />
                      {t('market.record')}
                    </Button>
                  )
                }
              />
            }
          />
          <LoadMore
            shown={rates.items?.length ?? 0}
            total={rates.total}
            loading={rates.isFetchingNextPage}
            onLoadMore={() => void rates.fetchNextPage()}
          />
        </>
      )}

      {commodities.length > 0 && (
        <div className="space-y-2 rounded-md border border-border bg-card p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {t('market.history')}
            </p>
            <Select
              aria-label={t('market.colCommodity')}
              value={selectedCommodity}
              onChange={(e) => setHistoryCommodity(e.target.value)}
              className="w-auto min-w-40"
            >
              {commodities.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </div>
          {selectedCommodity && <HistoryChart commodity={selectedCommodity} />}
        </div>
      )}

      <RecordRateDialog open={recordOpen} onOpenChange={setRecordOpen} />
    </section>
  );
}
