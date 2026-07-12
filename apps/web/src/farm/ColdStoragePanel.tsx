import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Plus, Snowflake } from 'lucide-react';
import {
  Line,
  LineChart,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useUnits } from '../api/hooks';
import {
  useColdStores,
  useCreateColdStore,
  useRecordTemp,
  useStoreTemps,
  type CreateColdStoreInput,
} from '../api/sales.hooks';
import { fmtDateTime } from '../lib/format';
import type { ColdStorage } from './api';
import {
  Badge,
  Button,
  CardSkeleton,
  ChartTooltipFrame,
  chartAnim,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  Field,
  Input,
  LINE_CURSOR,
  PanelError,
  PanelHeading,
  PanelNote,
  Select,
  Skeleton,
  useToast,
} from '../ui';

const HISTORY_DAYS = 7;

type TempPoint = { at: string; t: number; out: boolean };

function TempTooltip({ active, payload }: { active?: boolean; payload?: { payload: TempPoint }[] }) {
  const { t } = useTranslation();
  if (!active || !payload || payload.length === 0) return null;
  const p = payload[0]!.payload;
  return (
    <ChartTooltipFrame>
      <span className="tabular font-semibold text-foreground">{p.t}°C</span>
      <span className="ml-2 text-muted-foreground">{fmtDateTime(p.at)}</span>
      {p.out && <span className="ml-2 font-semibold text-destructive">{t('cold.outOfRange')}</span>}
    </ChartTooltipFrame>
  );
}

/** 7-day temperature sparkline: line on the primary token, band as a success
 * wash, out-of-range readings marked with destructive dots (status color). */
function TempSparkline({ store }: { store: ColdStorage }) {
  const { t } = useTranslation();
  const temps = useStoreTemps(store.id, HISTORY_DAYS);

  if (temps.isLoading) return <Skeleton className="h-16 w-full" />;
  if (temps.isError) return <PanelError className="text-xs">{t('cold.historyError')}</PanelError>;
  const points: TempPoint[] = (temps.data ?? []).map((l) => ({
    at: l.recordedAt,
    t: l.temperatureC,
    out: l.isOutOfRange,
  }));
  if (points.length === 0) return <PanelNote className="text-xs">{t('cold.noHistory')}</PanelNote>;

  const renderDot = (props: { cx?: number; cy?: number; payload?: TempPoint; index?: number }) => {
    const { cx, cy, payload, index } = props;
    if (!payload?.out || cx === undefined || cy === undefined) {
      return <g key={`dot-${index}`} />;
    }
    return (
      <circle
        key={`dot-${index}`}
        cx={cx}
        cy={cy}
        r={4}
        fill="hsl(var(--destructive))"
        stroke="hsl(var(--card))"
        strokeWidth={1.5}
      />
    );
  };

  return (
    <div>
      <p className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {t('cold.history', { days: HISTORY_DAYS })}
      </p>
      <div className="h-16 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={points} margin={{ top: 6, right: 4, bottom: 2, left: 4 }}>
            <XAxis dataKey="at" hide />
            <YAxis
              hide
              domain={[
                (dataMin: number) => Math.min(dataMin, store.minTempC) - 1,
                (dataMax: number) => Math.max(dataMax, store.maxTempC) + 1,
              ]}
            />
            <ReferenceArea
              y1={store.minTempC}
              y2={store.maxTempC}
              fill="hsl(var(--success))"
              fillOpacity={0.09}
              stroke="none"
            />
            <ChartTooltip content={<TempTooltip />} cursor={LINE_CURSOR} />
            {/* Single series ⇒ chart-1; exception dots stay status-colored (§1/§3). */}
            <Line
              type="monotone"
              dataKey="t"
              stroke="hsl(var(--chart-1))"
              strokeWidth={2}
              dot={renderDot}
              activeDot={{ r: 4, fill: 'hsl(var(--chart-1))', stroke: 'hsl(var(--card))', strokeWidth: 2 }}
              {...chartAnim()}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/** Quick inline temp logging (LABOUR flow): big targets, Enter submits, and an
 * EXPLICIT out-of-range warning toast from the response — never silent. */
function TempLogger({ store }: { store: ColdStorage }) {
  const { t } = useTranslation();
  const toast = useToast();
  const recordTemp = useRecordTemp();
  const [value, setValue] = useState('');
  const invalid = value.trim() === '' || Number.isNaN(Number(value));

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (invalid) return;
    recordTemp.mutate(
      { storeId: store.id, temperatureC: Number(value) },
      {
        onSuccess: (data) => {
          setValue('');
          if (data.temp.isOutOfRange) {
            toast.warning(
              t('cold.loggedOutOfRange', {
                temp: data.temp.temperatureC,
                min: store.minTempC,
                max: store.maxTempC,
              }),
            );
          } else {
            toast.success(t('cold.logged'));
          }
        },
      },
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex gap-2">
      <Input
        type="number"
        step="0.1"
        inputMode="decimal"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={t('cold.tempC')}
        aria-label={t('cold.tempC')}
        className="flex-1"
      />
      <Button type="submit" variant="secondary" disabled={invalid} loading={recordTemp.isPending}>
        {t('cold.logTemp')}
      </Button>
    </form>
  );
}

function StoreCard({ store, canLog }: { store: ColdStorage; canLog: boolean }) {
  const { t } = useTranslation();
  return (
    <div className="space-y-3 rounded-md border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-medium text-foreground">{store.name}</span>
        <Badge variant={store.mode === 'FROZEN' ? 'accent' : 'success'}>
          <Snowflake aria-hidden className="h-3 w-3" />
          {t(`cold.mode.${store.mode}`)} · {t('cold.band', { min: store.minTempC, max: store.maxTempC })}
        </Badge>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {store.latest ? (
          <>
            <span className="font-display text-2xl font-semibold tabular text-foreground">
              {store.latest.temperatureC}°C
            </span>
            <Badge variant={store.latest.isOutOfRange ? 'destructive' : 'success'}>
              {store.latest.isOutOfRange ? t('cold.outOfRange') : t('cold.inRange')}
            </Badge>
            <span className="text-xs text-muted-foreground">{fmtDateTime(store.latest.recordedAt)}</span>
          </>
        ) : (
          <PanelNote>{t('cold.noReading')}</PanelNote>
        )}
        {store.breachCount > 0 && (
          <Badge variant="destructive">{t('cold.breaches', { count: store.breachCount })}</Badge>
        )}
      </div>

      <TempSparkline store={store} />

      {canLog && <TempLogger store={store} />}
    </div>
  );
}

const storeSchema = z.object({
  name: z.string().min(1, 'cold.errRequired'),
  mode: z.enum(['FRESH', 'FROZEN']),
  unitId: z.string(),
  minC: z.string(),
  maxC: z.string(),
});
type StoreForm = z.infer<typeof storeSchema>;

function CreateStoreDialog({ onOpenChange }: { onOpenChange: (open: boolean) => void }) {
  const { t } = useTranslation();
  const units = useUnits();
  const createStore = useCreateColdStore();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<StoreForm>({
    resolver: zodResolver(storeSchema),
    defaultValues: { name: '', mode: 'FROZEN', unitId: '', minC: '', maxC: '' },
  });

  function onSubmit(values: StoreForm) {
    const payload: CreateColdStoreInput = {
      name: values.name,
      mode: values.mode,
      unitId: values.unitId || undefined,
      minTempC: values.minC.trim() === '' ? undefined : Number(values.minC),
      maxTempC: values.maxC.trim() === '' ? undefined : Number(values.maxC),
    };
    createStore.mutate(payload, { onSuccess: () => onOpenChange(false) });
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('cold.createTitle')}</DialogTitle>
          <DialogDescription>{t('cold.createDesc')}</DialogDescription>
        </DialogHeader>
        <form onSubmit={(e) => void handleSubmit(onSubmit)(e)} className="space-y-4" noValidate>
          <Field label={t('cold.name')} required error={errors.name && t(errors.name.message!)}>
            <Input {...register('name')} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('cold.modeLabel')}>
              <Select {...register('mode')}>
                <option value="FROZEN">{t('cold.mode.FROZEN')}</option>
                <option value="FRESH">{t('cold.mode.FRESH')}</option>
              </Select>
            </Field>
            <Field label={t('cold.unitLabel')}>
              <Select {...register('unitId')}>
                <option value="">{t('cold.noUnit')}</option>
                {(units.data ?? []).map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('cold.minC')}>
              <Input type="number" step="0.1" inputMode="decimal" {...register('minC')} />
            </Field>
            <Field label={t('cold.maxC')}>
              <Input type="number" step="0.1" inputMode="decimal" {...register('maxC')} />
            </Field>
          </div>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" loading={createStore.isPending}>
              {t('cold.submit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ColdStoragePanel({
  canWrite,
  canLog,
}: {
  farmId: string;
  canWrite: boolean;
  canLog: boolean;
}) {
  const { t } = useTranslation();
  const stores = useColdStores();
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <section className="space-y-3">
      <PanelHeading
        action={
          canWrite && (
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus aria-hidden />
              {t('cold.add')}
            </Button>
          )
        }
      >
        {t('cold.title')}
      </PanelHeading>

      {stores.isLoading && (
        <div className="grid gap-3 md:grid-cols-2">
          <CardSkeleton />
          <CardSkeleton />
        </div>
      )}
      {stores.isError && (
        <div className="space-y-2">
          <PanelError>{t('cold.loadError')}</PanelError>
          <Button type="button" variant="secondary" size="sm" onClick={() => void stores.refetch()}>
            {t('cold.retry')}
          </Button>
        </div>
      )}
      {stores.data && stores.data.length === 0 && (
        <EmptyState
          icon={Snowflake}
          illustration="coldChain"
          title={t('cold.empty')}
          description={t('cold.emptyDesc')}
          action={
            canWrite ? (
              <Button onClick={() => setCreateOpen(true)}>
                <Plus aria-hidden />
                {t('cold.add')}
              </Button>
            ) : undefined
          }
        />
      )}
      {stores.data && stores.data.length > 0 && (
        <div className="grid gap-3 md:grid-cols-2">
          {stores.data.map((s) => (
            <StoreCard key={s.id} store={s} canLog={canLog} />
          ))}
        </div>
      )}

      {createOpen && <CreateStoreDialog onOpenChange={setCreateOpen} />}
    </section>
  );
}
