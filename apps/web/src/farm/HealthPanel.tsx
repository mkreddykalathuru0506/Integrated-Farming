import { useMemo, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { HeartPulse, NotebookPen, Pill, ShieldCheck } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { useBatches } from '../api/hooks';
import {
  HEALTH_EVENT_TYPES,
  todayISO,
  useActiveWithdrawals,
  useAnimals,
  useCreateHealthRecord,
  useHealthRecords,
  useMarkSaleReady,
  useRecordMedication,
  type ActiveWithdrawal,
} from '../api/health.hooks';
import { pathForSection } from '../components/router';
import { fmtDate } from '../lib/format';
import { SpaLink } from './SpaLink';
import type { Animal, Batch } from './api';
import {
  Badge,
  Button,
  ConfirmDialog,
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
  Select,
  Textarea,
  type DataTableColumn,
} from '../ui';

const batchLabel = (b: Batch) => `${b.name ? `${b.name} (${b.code})` : b.code} · ${b.currentCount}`;

const animalLabel = (a: Animal) =>
  `${a.tagNumber ?? a.name ?? a.qrCode ?? a.id.slice(0, 6)} · ${a.species.name}`;

const daysLeft = (until: string) =>
  Math.max(0, Math.ceil((new Date(until).getTime() - Date.now()) / 86_400_000));

export function HealthPanel({ canWrite }: { farmId: string; canWrite: boolean }) {
  const { t } = useTranslation();
  const batches = useBatches();
  const animals = useAnimals();
  const records = useHealthRecords();

  const activeBatches = useMemo(
    () => (batches.data ?? []).filter((b) => b.status === 'ACTIVE'),
    [batches.data],
  );
  const activeAnimals = useMemo(
    () => (animals.data ?? []).filter((a) => a.status === 'ACTIVE'),
    [animals.data],
  );

  // One farm-wide query (slice 11.8a) — no more one request per active batch.
  const withdrawals = useActiveWithdrawals();
  const withdrawalByBatch = useMemo(() => {
    const map = new Map<string, ActiveWithdrawal>();
    for (const w of withdrawals.data ?? []) map.set(w.batchId, w);
    return map;
  }, [withdrawals.data]);
  const withdrawalsLoading = withdrawals.isPending;

  const saleReady = useMarkSaleReady();
  const [medOpen, setMedOpen] = useState(false);
  const [eventOpen, setEventOpen] = useState(false);
  const [pendingSaleReady, setPendingSaleReady] = useState<Batch | null>(null);

  const batchById = useMemo(
    () => new Map((batches.data ?? []).map((b) => [b.id, b])),
    [batches.data],
  );
  const animalById = useMemo(
    () => new Map((animals.data ?? []).map((a) => [a.id, a])),
    [animals.data],
  );

  // A batch present in the map is under an active withdrawal; absent = clear.
  type Row = { batch: Batch; status?: ActiveWithdrawal };
  const rows: Row[] = activeBatches.map((b) => ({ batch: b, status: withdrawalByBatch.get(b.id) }));

  const withdrawalColumns: DataTableColumn<Row>[] = [
    {
      id: 'batch',
      header: 'health.batch',
      accessor: (r) => `${r.batch.name ?? r.batch.code} ${r.batch.species.name}`,
      cell: (r) => (
        <span className="text-foreground">
          {r.batch.name ?? r.batch.code}
          <span className="text-xs text-muted-foreground"> · {r.batch.species.name}</span>
        </span>
      ),
    },
    {
      id: 'count',
      header: 'health.count',
      accessor: (r) => r.batch.currentCount,
      align: 'right',
    },
    {
      id: 'drug',
      header: 'health.drug',
      accessor: (r) => r.status?.drugName ?? '',
      cell: (r) => r.status?.drugName ?? '—',
    },
    {
      id: 'until',
      header: 'health.until',
      accessor: (r) => (r.status ? r.status.until : ''),
      cell: (r) => (r.status ? fmtDate(r.status.until) : '—'),
    },
    {
      id: 'status',
      header: 'health.status',
      accessor: (r) => (r.status ? 1 : 0),
      cell: (r) =>
        withdrawalsLoading ? (
          <Badge variant="muted">{t('health.checking')}</Badge>
        ) : r.status ? (
          <Badge variant="destructive">{t('health.daysLeft', { count: daysLeft(r.status.until) })}</Badge>
        ) : (
          <Badge variant="success">{t('health.clearBadge')}</Badge>
        ),
    },
    ...(canWrite
      ? [
          {
            id: 'actions',
            header: 'health.actions',
            cell: (r: Row) => (
              <Button
                size="sm"
                variant="secondary"
                onClick={(e) => {
                  e.stopPropagation();
                  setPendingSaleReady(r.batch);
                }}
              >
                {t('health.markSaleReady')}
              </Button>
            ),
          } satisfies DataTableColumn<Row>,
        ]
      : []),
  ];

  const recordRows = useMemo(
    () =>
      (records.data ?? []).map((r) => ({
        ...r,
        target: r.batchId
          ? (batchById.get(r.batchId)?.name ?? batchById.get(r.batchId)?.code ?? '—')
          : r.animalId
            ? (animalById.get(r.animalId)?.tagNumber ?? animalById.get(r.animalId)?.name ?? '—')
            : '—',
      })),
    [records.data, batchById, animalById],
  );
  type RecordRow = (typeof recordRows)[number];

  const recordColumns: DataTableColumn<RecordRow>[] = [
    {
      id: 'date',
      header: 'health.date',
      accessor: (r) => r.occurredAt,
      cell: (r) => fmtDate(r.occurredAt),
    },
    {
      id: 'type',
      header: 'health.type',
      accessor: (r) => t(`health.types.${r.type}`),
      cell: (r) => <Badge variant="muted">{t(`health.types.${r.type}`)}</Badge>,
    },
    { id: 'target', header: 'health.target', accessor: (r) => r.target },
    { id: 'description', header: 'health.description', accessor: (r) => r.description ?? '—' },
    { id: 'vet', header: 'health.vet', accessor: (r) => r.vetName ?? '—' },
  ];

  const goBatches = (
    <SpaLink href={pathForSection('livestock', 'batches')} className="text-sm">
      {t('health.goBatches')}
    </SpaLink>
  );

  return (
    <section className="space-y-6">
      <PanelHeading
        action={
          canWrite && (activeBatches.length > 0 || activeAnimals.length > 0) ? (
            <span className="flex gap-2">
              {activeBatches.length > 0 && (
                <Button size="sm" onClick={() => setMedOpen(true)}>
                  <Pill aria-hidden /> {t('health.recordMed')}
                </Button>
              )}
              <Button size="sm" variant="secondary" onClick={() => setEventOpen(true)}>
                <NotebookPen aria-hidden /> {t('health.recordEvent')}
              </Button>
            </span>
          ) : undefined
        }
      >
        {t('health.title')}
      </PanelHeading>

      {/* Farm-wide withdrawal status, one row per ACTIVE batch */}
      <div className="space-y-3">
        <PanelHeading>{t('health.withdrawals')}</PanelHeading>
        {batches.isError ? (
          <div className="space-y-2">
            <PanelError>{t('health.loadError')}</PanelError>
            <Button size="sm" variant="secondary" onClick={() => void batches.refetch()}>
              {t('health.retry')}
            </Button>
          </div>
        ) : (
          <>
            {withdrawals.isError && (
              <div className="flex items-center gap-2">
                <PanelError>{t('health.loadError')}</PanelError>
                <Button size="sm" variant="secondary" onClick={() => void withdrawals.refetch()}>
                  {t('health.retry')}
                </Button>
              </div>
            )}
            <DataTable
              columns={withdrawalColumns}
              data={rows}
              isLoading={batches.isPending || (activeBatches.length > 0 && withdrawalsLoading)}
              getRowId={(r) => r.batch.id}
              searchable={rows.length > 10}
              emptyState={
                <EmptyState
                  icon={HeartPulse}
                  title={t('health.noBatches')}
                  description={t('health.noBatchesDesc')}
                  action={goBatches}
                  size="compact"
                />
              }
            />
          </>
        )}
      </div>

      {/* Health event history (GET /health/records) */}
      <div className="space-y-3">
        <PanelHeading>{t('health.history')}</PanelHeading>
        {records.isError ? (
          <div className="space-y-2">
            <PanelError>{t('health.historyError')}</PanelError>
            <Button size="sm" variant="secondary" onClick={() => void records.refetch()}>
              {t('health.retry')}
            </Button>
          </div>
        ) : (
          <DataTable
            columns={recordColumns}
            data={recordRows}
            isLoading={records.isPending}
            getRowId={(r) => r.id}
            searchable
            emptyState={
              <EmptyState
                icon={ShieldCheck}
                title={t('health.historyEmpty')}
                description={t('health.historyEmptyDesc')}
                size="compact"
                action={
                  canWrite && (activeBatches.length > 0 || activeAnimals.length > 0) ? (
                    <Button size="sm" onClick={() => setEventOpen(true)}>
                      {t('health.recordEvent')}
                    </Button>
                  ) : undefined
                }
              />
            }
          />
        )}
      </div>

      <ConfirmDialog
        open={pendingSaleReady !== null}
        onOpenChange={(open) => {
          if (!open) setPendingSaleReady(null);
        }}
        title={t('health.saleReadyTitle')}
        description={t('health.saleReadyBody', {
          name: pendingSaleReady ? (pendingSaleReady.name ?? pendingSaleReady.code) : '',
        })}
        confirmLabel={t('health.markSaleReady')}
        loading={saleReady.isPending}
        onConfirm={() => {
          if (!pendingSaleReady) return;
          saleReady.mutate(
            { batchId: pendingSaleReady.id },
            { onSettled: () => setPendingSaleReady(null) },
          );
        }}
      />

      {medOpen && (
        <MedicationDialog batches={activeBatches} onOpenChange={setMedOpen} />
      )}
      {eventOpen && (
        <HealthEventDialog
          batches={activeBatches}
          animals={activeAnimals}
          onOpenChange={setEventOpen}
        />
      )}
    </section>
  );
}

// ------------------------------------------------------------- dialogs

const medSchema = z.object({
  batchId: z.string().min(1, 'health.form.batchRequired'),
  drugName: z.string().trim().min(1, 'health.form.drugRequired').max(120, 'health.form.tooLong'),
  dose: z.string().trim().max(60, 'health.form.tooLong'),
  route: z.string().trim().max(60, 'health.form.tooLong'),
  withdrawalDays: z.string().regex(/^\d+$/, 'health.form.daysInvalid'),
});
type MedForm = z.infer<typeof medSchema>;

function MedicationDialog({
  batches,
  onOpenChange,
}: {
  batches: Batch[];
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const recordMedication = useRecordMedication();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<MedForm>({
    resolver: zodResolver(medSchema),
    defaultValues: {
      batchId: batches[0]?.id ?? '',
      drugName: '',
      dose: '',
      route: '',
      withdrawalDays: '7',
    },
  });

  const onSubmit = handleSubmit((values) => {
    recordMedication.mutate(
      {
        batchId: values.batchId,
        drugName: values.drugName,
        dose: values.dose || undefined,
        route: values.route || undefined,
        withdrawalDays: Number(values.withdrawalDays),
      },
      { onSuccess: () => onOpenChange(false) },
    );
  });

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{t('health.recordMed')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={(e) => void onSubmit(e)} className="space-y-3">
          <Field
            label={t('health.batch')}
            required
            error={errors.batchId && t(errors.batchId.message ?? '')}
          >
            <Select {...register('batchId')}>
              {batches.map((b) => (
                <option key={b.id} value={b.id}>
                  {batchLabel(b)}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label={t('health.drug')}
            required
            error={errors.drugName && t(errors.drugName.message ?? '')}
          >
            <Input {...register('drugName')} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('health.dose')} error={errors.dose && t(errors.dose.message ?? '')}>
              <Input {...register('dose')} />
            </Field>
            <Field label={t('health.route')} error={errors.route && t(errors.route.message ?? '')}>
              <Input {...register('route')} />
            </Field>
          </div>
          <Field
            label={t('health.withdrawalDays')}
            required
            hint={t('health.withdrawalDaysHint')}
            error={errors.withdrawalDays && t(errors.withdrawalDays.message ?? '')}
          >
            <Input type="number" min={0} inputMode="numeric" {...register('withdrawalDays')} />
          </Field>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" loading={recordMedication.isPending}>
              {t('health.record')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const eventSchema = z
  .object({
    targetType: z.enum(['batch', 'animal']),
    batchId: z.string(),
    animalId: z.string(),
    type: z.enum(HEALTH_EVENT_TYPES),
    occurredAt: z.string().min(1, 'health.form.dateRequired'),
    description: z.string().trim().max(500, 'health.form.tooLong'),
    vetName: z.string().trim().max(120, 'health.form.tooLong'),
    diagnosis: z.string().trim().max(300, 'health.form.tooLong'),
  })
  .superRefine((v, ctx) => {
    if (v.targetType === 'batch' && !v.batchId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['batchId'], message: 'health.form.batchRequired' });
    }
    if (v.targetType === 'animal' && !v.animalId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['animalId'], message: 'health.form.animalRequired' });
    }
  });
type EventForm = z.infer<typeof eventSchema>;

function HealthEventDialog({
  batches,
  animals,
  onOpenChange,
}: {
  batches: Batch[];
  animals: Animal[];
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const createRecord = useCreateHealthRecord();
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<EventForm>({
    resolver: zodResolver(eventSchema),
    defaultValues: {
      targetType: batches.length > 0 ? 'batch' : 'animal',
      batchId: batches[0]?.id ?? '',
      animalId: animals[0]?.id ?? '',
      type: 'CHECKUP',
      occurredAt: todayISO(),
      description: '',
      vetName: '',
      diagnosis: '',
    },
  });
  const targetType = watch('targetType');

  const onSubmit = handleSubmit((values) => {
    createRecord.mutate(
      {
        type: values.type,
        occurredAt: `${values.occurredAt}T00:00:00.000Z`,
        description: values.description || undefined,
        vetName: values.vetName || undefined,
        diagnosis: values.diagnosis || undefined,
        ...(values.targetType === 'batch'
          ? { batchId: values.batchId }
          : { animalId: values.animalId }),
      },
      { onSuccess: () => onOpenChange(false) },
    );
  });

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{t('health.recordEvent')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={(e) => void onSubmit(e)} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('health.targetType')}>
              <Select {...register('targetType')}>
                {batches.length > 0 && <option value="batch">{t('health.batch')}</option>}
                {animals.length > 0 && <option value="animal">{t('health.animal')}</option>}
              </Select>
            </Field>
            <Field label={t('health.type')}>
              <Select {...register('type')}>
                {HEALTH_EVENT_TYPES.map((ty) => (
                  <option key={ty} value={ty}>
                    {t(`health.types.${ty}`)}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          {targetType === 'batch' ? (
            <Field
              label={t('health.batch')}
              required
              error={errors.batchId && t(errors.batchId.message ?? '')}
            >
              <Select {...register('batchId')}>
                {batches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {batchLabel(b)}
                  </option>
                ))}
              </Select>
            </Field>
          ) : (
            <Field
              label={t('health.animal')}
              required
              error={errors.animalId && t(errors.animalId.message ?? '')}
            >
              <Select {...register('animalId')}>
                {animals.map((a) => (
                  <option key={a.id} value={a.id}>
                    {animalLabel(a)}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          <Field
            label={t('health.date')}
            required
            error={errors.occurredAt && t(errors.occurredAt.message ?? '')}
          >
            <Input type="date" {...register('occurredAt')} />
          </Field>
          <Field
            label={t('health.description')}
            error={errors.description && t(errors.description.message ?? '')}
          >
            <Textarea rows={2} {...register('description')} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field
              label={t('health.vetName')}
              error={errors.vetName && t(errors.vetName.message ?? '')}
            >
              <Input {...register('vetName')} />
            </Field>
            <Field
              label={t('health.diagnosis')}
              error={errors.diagnosis && t(errors.diagnosis.message ?? '')}
            >
              <Input {...register('diagnosis')} />
            </Field>
          </div>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" loading={createRecord.isPending}>
              {t('health.record')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
