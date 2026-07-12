import { useMemo, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { CheckCircle2, Circle, Egg, Plus } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { useSpecies } from '../api/hooks';
import {
  HATCH_STATUSES,
  INCUBATION_EVENTS,
  todayISO,
  useAddIncubationLog,
  useCreateHatchery,
  useHatchery,
  useHatcheryDetail,
  useSpeciesDetail,
  useUpdateHatchery,
  type HatcheryBatch,
  type HatchStatus,
  type IncubationEventType,
} from '../api/health.hooks';
import { fmtDate, fmtDateTime } from '../lib/format';
import type { SpeciesSummary } from './api';
import {
  Badge,
  Button,
  CardSkeleton,
  DataTable,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  Field,
  Input,
  PanelError,
  PanelHeading,
  PanelNote,
  Select,
  SubPanel,
  type DataTableColumn,
} from '../ui';

const STATUS_VARIANT: Record<HatchStatus, 'muted' | 'accent' | 'warning' | 'success'> = {
  SET: 'muted',
  INCUBATING: 'accent',
  CANDLED: 'accent',
  LOCKDOWN: 'warning',
  HATCHED: 'success',
  CLOSED: 'muted',
};

export function HatcheryPanel({ canWrite }: { farmId: string; canWrite: boolean }) {
  const { t } = useTranslation();
  const hatchery = useHatchery();
  const species = useSpecies();

  const [createOpen, setCreateOpen] = useState(false);
  const [resultsFor, setResultsFor] = useState<HatcheryBatch | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);

  const columns: DataTableColumn<HatcheryBatch>[] = [
    { id: 'code', header: 'hatchery.code', accessor: 'code' },
    {
      id: 'setDate',
      header: 'hatchery.setDate',
      accessor: (b) => b.setDate,
      cell: (b) => fmtDate(b.setDate),
    },
    { id: 'eggCount', header: 'hatchery.eggCount', accessor: 'eggCount', align: 'right' },
    {
      id: 'expectedHatch',
      header: 'hatchery.expectedHatch',
      accessor: (b) => b.expectedHatchDate,
      cell: (b) => fmtDate(b.expectedHatchDate),
    },
    {
      id: 'status',
      header: 'hatchery.statusLabel',
      accessor: (b) => t(`hatchery.status.${b.status}`),
      cell: (b) => <Badge variant={STATUS_VARIANT[b.status]}>{t(`hatchery.status.${b.status}`)}</Badge>,
    },
    {
      id: 'hatchRate',
      header: 'hatchery.hatchRate',
      accessor: (b) => (b.hatchedCount === null ? -1 : b.hatchRate),
      align: 'right',
      cell: (b) => (b.hatchedCount === null ? '—' : `${b.hatchRate}%`),
    },
    {
      id: 'fertilityRate',
      header: 'hatchery.fertilityRate',
      accessor: (b) => (b.fertileCount === null ? -1 : b.fertilityRate),
      align: 'right',
      cell: (b) => (b.fertileCount === null ? '—' : `${b.fertilityRate}%`),
    },
    ...(canWrite
      ? [
          {
            id: 'actions',
            header: 'hatchery.actions',
            cell: (b: HatcheryBatch) =>
              b.status !== 'CLOSED' ? (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={(e) => {
                    e.stopPropagation();
                    setResultsFor(b);
                  }}
                >
                  {t('hatchery.results')}
                </Button>
              ) : null,
          } satisfies DataTableColumn<HatcheryBatch>,
        ]
      : []),
  ];

  return (
    <section className="space-y-3">
      <PanelHeading
        action={
          canWrite ? (
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus aria-hidden /> {t('hatchery.add')}
            </Button>
          ) : undefined
        }
      >
        {t('hatchery.title')}
      </PanelHeading>

      {hatchery.isError ? (
        <div className="space-y-2">
          <PanelError>{t('hatchery.loadError')}</PanelError>
          <Button size="sm" variant="secondary" onClick={() => void hatchery.refetch()}>
            {t('hatchery.retry')}
          </Button>
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={hatchery.data}
          isLoading={hatchery.isPending}
          getRowId={(b) => b.id}
          searchable={(hatchery.data?.length ?? 0) > 10}
          onRowClick={(b) => setDetailId(b.id)}
          emptyState={
            <EmptyState
              icon={Egg} illustration="livestock"
              title={t('hatchery.empty')}
              description={t('hatchery.emptyDesc')}
              action={
                canWrite ? (
                  <Button size="sm" onClick={() => setCreateOpen(true)}>
                    {t('hatchery.add')}
                  </Button>
                ) : undefined
              }
            />
          }
        />
      )}

      {createOpen && <CreateHatcheryDialog species={species.data ?? []} onOpenChange={setCreateOpen} />}
      {resultsFor && <ResultsDialog batch={resultsFor} onOpenChange={() => setResultsFor(null)} />}
      {detailId && (
        <DetailDialog id={detailId} canWrite={canWrite} onOpenChange={() => setDetailId(null)} />
      )}
    </section>
  );
}

// ------------------------------------------------------- create dialog

const createSchema = z.object({
  speciesId: z.string().min(1, 'hatchery.form.speciesRequired'),
  breedId: z.string(),
  code: z.string().trim().min(1, 'hatchery.form.codeRequired').max(60, 'hatchery.form.tooLong'),
  setDate: z.string().min(1, 'hatchery.form.dateRequired'),
  eggCount: z.string().regex(/^[1-9]\d*$/, 'hatchery.form.eggsInvalid'),
  incubationDays: z.string().regex(/^$|^[1-9]\d*$/, 'hatchery.form.daysInvalid'),
});
type CreateForm = z.infer<typeof createSchema>;

function CreateHatcheryDialog({
  species,
  onOpenChange,
}: {
  species: SpeciesSummary[];
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const createHatchery = useCreateHatchery();
  const defaultSpecies = species.find((s) => s.code === 'CHICKEN')?.id ?? species[0]?.id ?? '';
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<CreateForm>({
    resolver: zodResolver(createSchema),
    defaultValues: {
      speciesId: defaultSpecies,
      breedId: '',
      code: '',
      setDate: todayISO(),
      eggCount: '',
      incubationDays: '',
    },
  });
  const speciesId = watch('speciesId');
  const speciesDetail = useSpeciesDetail(speciesId || undefined);
  const breeds = speciesDetail.data?.breeds ?? [];

  const onSubmit = handleSubmit((values) => {
    createHatchery.mutate(
      {
        speciesId: values.speciesId,
        breedId: values.breedId || undefined,
        code: values.code,
        setDate: `${values.setDate}T00:00:00.000Z`,
        eggCount: Number(values.eggCount),
        incubationDays: values.incubationDays ? Number(values.incubationDays) : undefined,
      },
      { onSuccess: () => onOpenChange(false) },
    );
  });

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{t('hatchery.add')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={(e) => void onSubmit(e)} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field
              label={t('hatchery.species')}
              required
              error={errors.speciesId && t(errors.speciesId.message ?? '')}
            >
              <Select {...register('speciesId')}>
                {species.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t('hatchery.breed')}>
              <Select {...register('breedId')} disabled={breeds.length === 0}>
                <option value="">{t('hatchery.none')}</option>
                {breeds.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Field
            label={t('hatchery.code')}
            required
            error={errors.code && t(errors.code.message ?? '')}
          >
            <Input {...register('code')} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field
              label={t('hatchery.setDate')}
              required
              error={errors.setDate && t(errors.setDate.message ?? '')}
            >
              <Input type="date" {...register('setDate')} />
            </Field>
            <Field
              label={t('hatchery.eggCount')}
              required
              error={errors.eggCount && t(errors.eggCount.message ?? '')}
            >
              <Input type="number" min={1} inputMode="numeric" {...register('eggCount')} />
            </Field>
          </div>
          <Field
            label={t('hatchery.incubationDays')}
            hint={t('hatchery.daysHint')}
            error={errors.incubationDays && t(errors.incubationDays.message ?? '')}
          >
            <Input type="number" min={1} inputMode="numeric" {...register('incubationDays')} />
          </Field>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" loading={createHatchery.isPending}>
              {t('hatchery.add')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ------------------------------------------------------ results dialog

function ResultsDialog({
  batch,
  onOpenChange,
}: {
  batch: HatcheryBatch;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const updateHatchery = useUpdateHatchery();
  // Counts stay strings in the form: "0" is a legitimate hatched count, so the
  // check is an explicit empty-string/regex test — never `if (!n)` truthiness.
  const resultsSchema = useMemo(
    () =>
      z.object({
        hatchedCount: z
          .string()
          .regex(/^\d+$/, 'hatchery.form.hatchedInvalid')
          .refine((v) => Number(v) <= batch.eggCount, 'hatchery.form.tooMany'),
        fertileCount: z
          .string()
          .regex(/^$|^\d+$/, 'hatchery.form.fertileInvalid')
          .refine((v) => v === '' || Number(v) <= batch.eggCount, 'hatchery.form.tooMany'),
      }),
    [batch.eggCount],
  );
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<z.infer<typeof resultsSchema>>({
    resolver: zodResolver(resultsSchema),
    defaultValues: {
      hatchedCount: batch.hatchedCount === null ? '' : String(batch.hatchedCount),
      fertileCount: batch.fertileCount === null ? '' : String(batch.fertileCount),
    },
  });

  const onSubmit = handleSubmit((values) => {
    updateHatchery.mutate(
      {
        id: batch.id,
        data: {
          status: 'HATCHED',
          hatchedCount: Number(values.hatchedCount),
          ...(values.fertileCount === '' ? {} : { fertileCount: Number(values.fertileCount) }),
        },
      },
      { onSuccess: () => onOpenChange(false) },
    );
  });

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent size="sm" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{t('hatchery.results')}</DialogTitle>
        </DialogHeader>
        <PanelNote className="mb-3 tabular">
          {t('hatchery.resultsBody', { code: batch.code, eggs: batch.eggCount })}
        </PanelNote>
        <form onSubmit={(e) => void onSubmit(e)} className="space-y-3">
          <Field
            label={t('hatchery.hatchedCount')}
            required
            error={errors.hatchedCount && t(errors.hatchedCount.message ?? '')}
          >
            <Input type="number" min={0} inputMode="numeric" {...register('hatchedCount')} />
          </Field>
          <Field
            label={t('hatchery.fertileCount')}
            hint={t('hatchery.fertileHint')}
            error={errors.fertileCount && t(errors.fertileCount.message ?? '')}
          >
            <Input type="number" min={0} inputMode="numeric" {...register('fertileCount')} />
          </Field>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" loading={updateHatchery.isPending}>
              {t('common.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ------------------------------------------------------- detail dialog

function DetailDialog({
  id,
  canWrite,
  onOpenChange,
}: {
  id: string;
  canWrite: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const detail = useHatcheryDetail(id);
  const updateHatchery = useUpdateHatchery();
  const addLog = useAddIncubationLog();

  const [event, setEvent] = useState<IncubationEventType>('TEMP_LOG');
  const [temperature, setTemperature] = useState('');
  const [humidity, setHumidity] = useState('');

  const b = detail.data;
  const now = Date.now();

  const steps = b
    ? ([
        { key: 'set', date: b.setDate },
        ...(b.candlingDate ? [{ key: 'candling', date: b.candlingDate }] : []),
        ...(b.lockdownDate ? [{ key: 'lockdown', date: b.lockdownDate }] : []),
        { key: 'hatch', date: b.expectedHatchDate },
      ] as { key: string; date: string }[])
    : [];

  const stepDone = (step: { key: string; date: string }) =>
    step.key === 'hatch'
      ? b?.status === 'HATCHED'
      : new Date(step.date).getTime() <= now || b?.status === 'HATCHED';

  const numeric = /^-?\d+(\.\d+)?$/;

  function submitLog() {
    if (temperature !== '' && !numeric.test(temperature)) return;
    if (humidity !== '' && !numeric.test(humidity)) return;
    addLog.mutate(
      {
        id,
        data: {
          event,
          ...(temperature === '' ? {} : { temperatureC: Number(temperature) }),
          ...(humidity === '' ? {} : { humidityPct: Number(humidity) }),
        },
      },
      {
        onSuccess: () => {
          setTemperature('');
          setHumidity('');
        },
      },
    );
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{b ? b.code : t('hatchery.detail')}</DialogTitle>
        </DialogHeader>

        {detail.isPending && <CardSkeleton />}
        {detail.isError && (
          <div className="space-y-2">
            <PanelError>{t('hatchery.loadError')}</PanelError>
            <Button size="sm" variant="secondary" onClick={() => void detail.refetch()}>
              {t('hatchery.retry')}
            </Button>
          </div>
        )}

        {b && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Badge variant={STATUS_VARIANT[b.status]}>{t(`hatchery.status.${b.status}`)}</Badge>
              <span className="text-muted-foreground tabular">
                {t('hatchery.eggsMeta', { n: b.eggCount })}
              </span>
              {b.hatchedCount !== null && (
                <span className="text-success tabular">
                  {t('hatchery.hatchedMeta', { n: b.hatchedCount, rate: b.hatchRate })}
                </span>
              )}
              {b.fertileCount !== null && (
                <span className="text-muted-foreground tabular">
                  {t('hatchery.fertileMeta', { n: b.fertileCount, rate: b.fertilityRate })}
                </span>
              )}
            </div>

            {/* Incubation timeline: set → candling → lockdown → expected hatch */}
            <ol className="relative ms-2.5 space-y-4 border-s border-border ps-6">
              {steps.map((step) => (
                <li key={step.key} className="relative">
                  <span
                    className="absolute -start-[35px] top-0.5 grid h-[18px] w-[18px] place-items-center rounded-full bg-card"
                    aria-hidden
                  >
                    {stepDone(step) ? (
                      <CheckCircle2 className="h-[18px] w-[18px] text-success" />
                    ) : (
                      <Circle className="h-4 w-4 text-muted-foreground/60" />
                    )}
                  </span>
                  <p className="text-sm font-medium text-foreground">
                    {t(`hatchery.timeline.${step.key}`)}
                  </p>
                  <p className="text-xs text-muted-foreground tabular">{fmtDate(step.date)}</p>
                </li>
              ))}
            </ol>

            {canWrite && (
              <Field label={t('hatchery.statusLabel')}>
                <Select
                  value={b.status}
                  disabled={updateHatchery.isPending}
                  onChange={(e) =>
                    updateHatchery.mutate({ id, data: { status: e.target.value as HatchStatus } })
                  }
                >
                  {HATCH_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {t(`hatchery.status.${s}`)}
                    </option>
                  ))}
                </Select>
              </Field>
            )}

            <div className="space-y-2">
              <PanelHeading>{t('hatchery.logs')}</PanelHeading>
              {b.incubationLogs.length === 0 ? (
                <PanelNote>{t('hatchery.noLogs')}</PanelNote>
              ) : (
                <ul className="space-y-1.5">
                  {b.incubationLogs.map((log) => (
                    <li
                      key={log.id}
                      className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-card px-3 py-1.5 text-sm"
                    >
                      <Badge variant="muted">{t(`hatchery.events.${log.event}`)}</Badge>
                      <span className="text-xs text-muted-foreground tabular">
                        {fmtDateTime(log.occurredAt)}
                      </span>
                      {log.temperatureC !== null && (
                        <span className="text-xs text-muted-foreground tabular">
                          {log.temperatureC}°C
                        </span>
                      )}
                      {log.humidityPct !== null && (
                        <span className="text-xs text-muted-foreground tabular">
                          {log.humidityPct}% RH
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}

              {canWrite && (
                <SubPanel className="space-y-2">
                  <div className="grid grid-cols-3 gap-2">
                    <Field label={t('hatchery.event')}>
                      <Select
                        value={event}
                        onChange={(e) => setEvent(e.target.value as IncubationEventType)}
                      >
                        {INCUBATION_EVENTS.map((ev) => (
                          <option key={ev} value={ev}>
                            {t(`hatchery.events.${ev}`)}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field label={t('hatchery.temperature')}>
                      <Input
                        type="number"
                        step="0.1"
                        value={temperature}
                        onChange={(e) => setTemperature(e.target.value)}
                      />
                    </Field>
                    <Field label={t('hatchery.humidity')}>
                      <Input
                        type="number"
                        step="0.1"
                        value={humidity}
                        onChange={(e) => setHumidity(e.target.value)}
                      />
                    </Field>
                  </div>
                  <Button size="sm" loading={addLog.isPending} onClick={submitLog}>
                    {t('hatchery.addLog')}
                  </Button>
                </SubPanel>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
