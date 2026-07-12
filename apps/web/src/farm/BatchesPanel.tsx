import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Bird, MoreVertical, Plus } from 'lucide-react';
import {
  Area,
  AreaChart,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useBatches, useSpecies, useUnits } from '../api/hooks';
import {
  useAdvanceBatch,
  useBatchPerformance,
  useCloseBatch,
  useCreateBatch,
  useMortalityEvents,
  useMovements,
  useRecordMortality,
  useRecordMovement,
  useSpeciesDetail,
  type MortalityRow,
  type MovementRow,
} from '../api/livestock.hooks';
import { fmtDate, fmtInr } from '../lib/format';
import type { Batch, Unit } from './api';
import {
  Badge,
  Button,
  ConfirmDialog,
  DataTable,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  EmptyState,
  Field,
  Input,
  PanelHeading,
  PanelNote,
  Select,
  Skeleton,
  type DataTableColumn,
} from '../ui';
import { LoadErrorNote } from './LoadErrorNote';

type LossType = 'MORTALITY' | 'CULL';
type LossDraft = { batch: Batch; type: LossType };
type LossConfirm = { batch: Batch; type: LossType; count: number; cause?: string };

const createSchema = z.object({
  speciesId: z.string().min(1, 'batches.form.speciesRequired'),
  code: z.string().min(1, 'batches.form.codeRequired').max(60, 'batches.form.codeTooLong'),
  count: z.string().regex(/^[1-9]\d*$/, 'batches.form.countInvalid'),
  name: z.string().max(120, 'batches.form.nameTooLong'),
  breedId: z.string(),
  unitId: z.string(),
});
type CreateForm = z.infer<typeof createSchema>;

/**
 * Batches panel (slice 11.6a rewrite): DataTable list, RHF create dialog with
 * the dormant breed/unit/name fields, and a per-batch detail dialog with
 * performance charts (feed + mortality series), cost roll-up tiles and the
 * mortality/movement history. Destructive actions gate behind ConfirmDialog.
 */
export function BatchesPanel({ canWrite }: { farmId: string; canWrite: boolean }) {
  const { t } = useTranslation();
  const batches = useBatches();
  const species = useSpecies();
  const units = useUnits();

  const recordMortality = useRecordMortality();
  const recordMovement = useRecordMovement();
  const advanceBatch = useAdvanceBatch();
  const closeBatch = useCloseBatch();

  const [createOpen, setCreateOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [lossDraft, setLossDraft] = useState<LossDraft | null>(null);
  const [lossConfirm, setLossConfirm] = useState<LossConfirm | null>(null);
  const [moveTarget, setMoveTarget] = useState<Batch | null>(null);
  const [advanceTarget, setAdvanceTarget] = useState<Batch | null>(null);
  const [closeTarget, setCloseTarget] = useState<Batch | null>(null);

  const detailBatch = useMemo(
    () => batches.data?.find((b) => b.id === detailId) ?? null,
    [batches.data, detailId],
  );
  const batchSpecies = useMemo(
    () => (species.data ?? []).filter((s) => s.trackingMode === 'BATCH'),
    [species.data],
  );

  const rowActions = (batch: Batch) => {
    const writable = canWrite && batch.status === 'ACTIVE';
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label={t('batches.rowMenu', { code: batch.code })}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <MoreVertical aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent onClick={(e) => e.stopPropagation()}>
          <DropdownMenuItem onSelect={() => setDetailId(batch.id)}>
            {t('batches.viewDetail')}
          </DropdownMenuItem>
          {writable && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => setAdvanceTarget(batch)}>
                {t('batches.advance')}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setMoveTarget(batch)}>
                {t('events.move')}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setLossDraft({ batch, type: 'MORTALITY' })}>
                {t('events.mortality')}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setLossDraft({ batch, type: 'CULL' })}>
                {t('events.cull')}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onSelect={() => setCloseTarget(batch)}
              >
                {t('batches.close')}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };

  const columns: DataTableColumn<Batch>[] = [
    {
      header: 'batches.cols.code',
      accessor: 'code',
      cell: (b) => (
        <span className="font-medium text-foreground">
          {b.code}
          {b.name && <span className="ml-1.5 text-xs text-muted-foreground">{b.name}</span>}
        </span>
      ),
    },
    { header: 'batches.cols.species', accessor: (b) => b.species.name },
    { header: 'batches.cols.stage', accessor: (b) => b.currentStage?.name ?? '—' },
    { header: 'batches.cols.unit', accessor: (b) => b.unit?.name ?? '—' },
    {
      header: 'batches.cols.count',
      accessor: (b) => b.currentCount,
      align: 'right',
      cell: (b) => (
        <span>
          {b.currentCount}
          <span className="text-muted-foreground">/{b.initialCount}</span>
        </span>
      ),
    },
    {
      header: 'batches.cols.status',
      accessor: 'status',
      cell: (b) => (
        <Badge variant={b.status === 'ACTIVE' ? 'success' : 'muted'}>
          {t(`batches.status.${b.status}`)}
        </Badge>
      ),
    },
    { id: 'actions', header: 'batches.cols.actions', cell: rowActions, enableSorting: false },
  ];

  return (
    <section className="space-y-3">
      <PanelHeading
        action={
          canWrite ? (
            <Button type="button" size="sm" onClick={() => setCreateOpen(true)}>
              <Plus aria-hidden />
              {t('batches.add')}
            </Button>
          ) : undefined
        }
      >
        {t('batches.title')}
      </PanelHeading>

      {batches.isError && !batches.data ? (
        <LoadErrorNote
          text={t('batches.error')}
          retryLabel={t('batches.retry')}
          onRetry={() => void batches.refetch()}
        />
      ) : (
        <DataTable
          columns={columns}
          data={batches.data}
          isLoading={batches.isPending}
          searchable
          pageSize={10}
          onRowClick={(b) => setDetailId(b.id)}
          getRowId={(b) => b.id}
          emptyState={
            <EmptyState
              icon={Bird}
              title={t('batches.empty')}
              description={t('batches.emptyHint')}
              action={
                canWrite ? (
                  <Button type="button" size="sm" onClick={() => setCreateOpen(true)}>
                    <Plus aria-hidden />
                    {t('batches.add')}
                  </Button>
                ) : undefined
              }
            />
          }
        />
      )}

      {canWrite && (
        <CreateBatchDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          batchSpecies={batchSpecies}
          units={units.data ?? []}
        />
      )}

      <BatchDetailDialog
        batch={detailBatch}
        onOpenChange={(open) => {
          if (!open) setDetailId(null);
        }}
        units={units.data ?? []}
        canWrite={canWrite}
        onAdvance={setAdvanceTarget}
        onLoss={(batch, type) => setLossDraft({ batch, type })}
        onMove={setMoveTarget}
        onClose={setCloseTarget}
      />

      <RecordLossDialog
        draft={lossDraft}
        onOpenChange={(open) => {
          if (!open) setLossDraft(null);
        }}
        onContinue={(confirm) => {
          setLossDraft(null);
          setLossConfirm(confirm);
        }}
      />

      <ConfirmDialog
        open={lossConfirm !== null}
        onOpenChange={(open) => {
          if (!open) setLossConfirm(null);
        }}
        title={lossConfirm ? t(`events.recordLossTitle.${lossConfirm.type}`) : ''}
        description={
          lossConfirm
            ? t(`events.confirmLossBody.${lossConfirm.type}`, {
                count: lossConfirm.count,
                target: lossConfirm.batch.code,
              })
            : undefined
        }
        confirmLabel={t('events.confirmLoss')}
        variant="danger"
        loading={recordMortality.isPending}
        onConfirm={() => {
          if (!lossConfirm) return;
          recordMortality.mutate(
            {
              batchId: lossConfirm.batch.id,
              type: lossConfirm.type,
              count: lossConfirm.count,
              cause: lossConfirm.cause,
            },
            { onSuccess: () => setLossConfirm(null) },
          );
        }}
      />

      <MoveDialog
        target={moveTarget ? { label: moveTarget.code } : null}
        units={units.data ?? []}
        loading={recordMovement.isPending}
        onOpenChange={(open) => {
          if (!open) setMoveTarget(null);
        }}
        onMove={(toUnitId) => {
          if (!moveTarget) return;
          recordMovement.mutate(
            { batchId: moveTarget.id, toUnitId },
            { onSuccess: () => setMoveTarget(null) },
          );
        }}
      />

      <ConfirmDialog
        open={advanceTarget !== null}
        onOpenChange={(open) => {
          if (!open) setAdvanceTarget(null);
        }}
        title={t('batches.confirmAdvanceTitle')}
        description={
          advanceTarget
            ? t('batches.confirmAdvanceBody', {
                code: advanceTarget.code,
                stage: advanceTarget.currentStage?.name ?? '—',
              })
            : undefined
        }
        confirmLabel={t('batches.advance')}
        loading={advanceBatch.isPending}
        onConfirm={() => {
          if (!advanceTarget) return;
          advanceBatch.mutate(advanceTarget.id, { onSuccess: () => setAdvanceTarget(null) });
        }}
      />

      <ConfirmDialog
        open={closeTarget !== null}
        onOpenChange={(open) => {
          if (!open) setCloseTarget(null);
        }}
        title={t('batches.confirmCloseTitle')}
        description={
          closeTarget
            ? t('batches.confirmCloseBody', {
                code: closeTarget.code,
                count: closeTarget.currentCount,
              })
            : undefined
        }
        confirmLabel={t('batches.close')}
        variant="danger"
        loading={closeBatch.isPending}
        onConfirm={() => {
          if (!closeTarget) return;
          closeBatch.mutate(closeTarget.id, {
            onSuccess: () => {
              setCloseTarget(null);
              setDetailId(null);
            },
          });
        }}
      />
    </section>
  );
}

// ---------- create dialog ----------

function CreateBatchDialog({
  open,
  onOpenChange,
  batchSpecies,
  units,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  batchSpecies: { id: string; name: string }[];
  units: Unit[];
}) {
  const { t } = useTranslation();
  const createBatch = useCreateBatch();
  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<CreateForm>({
    resolver: zodResolver(createSchema),
    defaultValues: { speciesId: '', code: '', count: '', name: '', breedId: '', unitId: '' },
  });

  const speciesId = watch('speciesId');
  const speciesDetail = useSpeciesDetail(open && speciesId ? speciesId : null);
  const breeds = speciesDetail.data?.breeds ?? [];

  const err = (key: keyof CreateForm) => {
    const message = errors[key]?.message;
    return message ? t(message) : undefined;
  };

  const onSubmit = handleSubmit((v) => {
    createBatch.mutate(
      {
        speciesId: v.speciesId,
        code: v.code.trim(),
        initialCount: Number(v.count),
        name: v.name.trim() || undefined,
        breedId: v.breedId || undefined,
        unitId: v.unitId || undefined,
      },
      {
        onSuccess: () => {
          reset();
          onOpenChange(false);
        },
      },
    );
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{t('batches.add')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={(e) => void onSubmit(e)} className="space-y-3" noValidate>
          <Field label={t('batches.form.species')} required error={err('speciesId')}>
            <Select {...register('speciesId')}>
              <option value="">{t('batches.form.choose')}</option>
              {batchSpecies.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t('batches.form.code')} required error={err('code')}>
              <Input {...register('code')} placeholder={t('batches.form.codePlaceholder')} />
            </Field>
            <Field label={t('batches.form.count')} required error={err('count')}>
              <Input {...register('count')} type="number" min={1} inputMode="numeric" />
            </Field>
          </div>
          <Field label={t('batches.form.name')} error={err('name')}>
            <Input {...register('name')} placeholder={t('batches.form.namePlaceholder')} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t('batches.form.breed')} hint={t('batches.form.optional')}>
              <Select {...register('breedId')} disabled={!speciesId || breeds.length === 0}>
                <option value="">
                  {speciesId && breeds.length === 0
                    ? t('batches.form.noBreeds')
                    : t('batches.form.none')}
                </option>
                {breeds.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t('batches.form.unit')} hint={t('batches.form.optional')}>
              <Select {...register('unitId')}>
                <option value="">{t('batches.form.none')}</option>
                {units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" loading={createBatch.isPending}>
              {t('batches.add')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------- loss + move dialogs (MoveDialog reused by AnimalsPanel) ----------

function RecordLossDialog({
  draft,
  onOpenChange,
  onContinue,
}: {
  draft: LossDraft | null;
  onOpenChange: (open: boolean) => void;
  onContinue: (confirm: LossConfirm) => void;
}) {
  const { t } = useTranslation();
  const [count, setCount] = useState('1');
  const [cause, setCause] = useState('');
  const [error, setError] = useState<string | null>(null);

  const max = draft?.batch.currentCount ?? 1;

  function submit() {
    const n = Number(count);
    if (!Number.isInteger(n) || n < 1 || n > max) {
      setError(t('events.countInvalid', { max }));
      return;
    }
    if (!draft) return;
    onContinue({ batch: draft.batch, type: draft.type, count: n, cause: cause.trim() || undefined });
    setCount('1');
    setCause('');
    setError(null);
  }

  return (
    <Dialog
      open={draft !== null}
      onOpenChange={(open) => {
        if (!open) {
          setCount('1');
          setCause('');
          setError(null);
        }
        onOpenChange(open);
      }}
    >
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>{draft ? t(`events.recordLossTitle.${draft.type}`) : ''}</DialogTitle>
          <DialogDescription>{draft?.batch.code}</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          className="space-y-3"
          noValidate
        >
          <Field label={t('events.lossCount')} required error={error ?? undefined}>
            <Input
              type="number"
              min={1}
              max={max}
              inputMode="numeric"
              value={count}
              onChange={(e) => {
                setCount(e.target.value);
                setError(null);
              }}
            />
          </Field>
          <Field label={t('events.cause')}>
            <Input value={cause} onChange={(e) => setCause(e.target.value)} />
          </Field>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" variant="destructive">
              {t('events.continue')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function MoveDialog({
  target,
  units,
  loading,
  onOpenChange,
  onMove,
}: {
  target: { label: string } | null;
  units: Unit[];
  loading: boolean;
  onOpenChange: (open: boolean) => void;
  onMove: (toUnitId: string) => void;
}) {
  const { t } = useTranslation();
  const [unitId, setUnitId] = useState('');
  const [error, setError] = useState<string | null>(null);

  return (
    <Dialog
      open={target !== null}
      onOpenChange={(open) => {
        if (!open) {
          setUnitId('');
          setError(null);
        }
        onOpenChange(open);
      }}
    >
      <DialogContent size="sm" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{target ? t('events.moveTitle', { target: target.label }) : ''}</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!unitId) {
              setError(t('events.unitRequired'));
              return;
            }
            onMove(unitId);
          }}
          className="space-y-3"
          noValidate
        >
          <Field label={t('events.unit')} required error={error ?? undefined}>
            <Select
              value={unitId}
              onChange={(e) => {
                setUnitId(e.target.value);
                setError(null);
              }}
            >
              <option value="">{t('events.moveTo')}</option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </Select>
          </Field>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" loading={loading}>
              {t('events.move')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------- detail dialog ----------

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-secondary/40 p-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="tabular mt-0.5 text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}

const chartTooltipStyle = {
  background: 'hsl(var(--card))',
  border: '1px solid hsl(var(--border))',
  borderRadius: 8,
  fontSize: 12,
} as const;

function BatchDetailDialog({
  batch,
  onOpenChange,
  units,
  canWrite,
  onAdvance,
  onLoss,
  onMove,
  onClose,
}: {
  batch: Batch | null;
  onOpenChange: (open: boolean) => void;
  units: Unit[];
  canWrite: boolean;
  onAdvance: (batch: Batch) => void;
  onLoss: (batch: Batch, type: LossType) => void;
  onMove: (batch: Batch) => void;
  onClose: (batch: Batch) => void;
}) {
  const { t } = useTranslation();
  const perf = useBatchPerformance(batch?.id ?? null);
  const mortality = useMortalityEvents({ batchId: batch?.id ?? '' }, batch !== null);
  const movements = useMovements({ batchId: batch?.id ?? '' }, batch !== null);

  const unitName = (id: string | null) => units.find((u) => u.id === id)?.name ?? '—';

  const feedData = useMemo(
    () =>
      (perf.data?.feedSeries ?? []).map((p) => ({
        date: fmtDate(p.occurredAt),
        kg: Number(p.cumulativeKg),
      })),
    [perf.data],
  );
  const mortalityData = useMemo(
    () =>
      (perf.data?.mortality.series ?? []).map((p) => ({
        date: fmtDate(p.occurredAt),
        lost: p.cumulative,
      })),
    [perf.data],
  );

  const mortalityCols: DataTableColumn<MortalityRow>[] = [
    { header: 'batches.detail.date', accessor: (m) => fmtDate(m.occurredAt) },
    {
      header: 'batches.detail.type',
      accessor: 'type',
      cell: (m) => (
        <Badge variant={m.type === 'CULL' ? 'warning' : 'destructive'}>
          {t(m.type === 'CULL' ? 'events.cull' : 'events.mortality')}
        </Badge>
      ),
    },
    { header: 'batches.detail.count', accessor: 'count', align: 'right' },
    { header: 'batches.detail.cause', accessor: (m) => m.cause ?? '—' },
  ];

  const movementCols: DataTableColumn<MovementRow>[] = [
    { header: 'batches.detail.date', accessor: (m) => fmtDate(m.movedAt) },
    { header: 'batches.detail.from', accessor: (m) => unitName(m.fromUnitId) },
    { header: 'batches.detail.to', accessor: (m) => unitName(m.toUnitId) },
    { header: 'batches.detail.count', accessor: (m) => m.count ?? '—', align: 'right' },
  ];

  return (
    <Dialog open={batch !== null} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        {batch && (
          <>
            <DialogHeader>
              <DialogTitle className="flex flex-wrap items-center gap-2">
                {batch.code}
                <Badge variant={batch.status === 'ACTIVE' ? 'success' : 'muted'}>
                  {t(`batches.status.${batch.status}`)}
                </Badge>
              </DialogTitle>
              <DialogDescription>
                {batch.species.name}
                {batch.breed ? ` · ${batch.breed.name}` : ''} · {batch.currentStage?.name ?? '—'} ·{' '}
                <span className="tabular">
                  {batch.currentCount}/{batch.initialCount}
                </span>
              </DialogDescription>
            </DialogHeader>

            {canWrite && batch.status === 'ACTIVE' && (
              <div className="mb-4 flex flex-wrap gap-2">
                <Button type="button" size="sm" variant="secondary" onClick={() => onAdvance(batch)}>
                  {t('batches.advance')}
                </Button>
                <Button type="button" size="sm" variant="secondary" onClick={() => onMove(batch)}>
                  {t('events.move')}
                </Button>
                <Button type="button" size="sm" variant="danger" onClick={() => onLoss(batch, 'MORTALITY')}>
                  {t('events.mortality')}
                </Button>
                <Button type="button" size="sm" variant="danger" onClick={() => onLoss(batch, 'CULL')}>
                  {t('events.cull')}
                </Button>
                <Button type="button" size="sm" variant="danger" onClick={() => onClose(batch)}>
                  {t('batches.close')}
                </Button>
              </div>
            )}

            {perf.isPending && (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-hidden>
                {Array.from({ length: 4 }, (_, i) => (
                  <Skeleton key={i} className="h-14" />
                ))}
              </div>
            )}
            {perf.isError && (
              <LoadErrorNote
                text={t('batches.detail.perfError')}
                retryLabel={t('batches.retry')}
                onRetry={() => void perf.refetch()}
              />
            )}
            {perf.data && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  <StatTile
                    label={t('batches.detail.fcr')}
                    value={perf.data.fcr.fcr === null ? '—' : perf.data.fcr.fcr.toFixed(2)}
                  />
                  <StatTile
                    label={t('batches.detail.feedConsumed')}
                    value={t('batches.detail.kg', { qty: perf.data.fcr.feedConsumedKg })}
                  />
                  <StatTile
                    label={t('batches.detail.mortalityRate')}
                    value={`${perf.data.mortality.ratePct}%`}
                  />
                  <StatTile
                    label={t('batches.detail.totalCost')}
                    value={fmtInr(perf.data.cost.totalPaise)}
                  />
                  <StatTile
                    label={t('batches.detail.costPerBird')}
                    value={fmtInr(perf.data.cost.costPerBirdPaise)}
                  />
                  <StatTile
                    label={t('batches.detail.feedCost')}
                    value={fmtInr(perf.data.fcr.feedCostPaise)}
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {t('batches.detail.feedChart')}
                    </h3>
                    {feedData.length === 0 ? (
                      <PanelNote>{t('batches.detail.noSeries')}</PanelNote>
                    ) : (
                      <div className="h-40">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={feedData} margin={{ top: 4, right: 4, bottom: 0, left: -18 }}>
                            <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                            <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                            <ChartTooltip contentStyle={chartTooltipStyle} />
                            <Area
                              type="monotone"
                              dataKey="kg"
                              name={t('batches.detail.feedChart')}
                              stroke="hsl(var(--primary))"
                              fill="hsl(var(--primary) / 0.15)"
                              strokeWidth={2}
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </div>
                  <div>
                    <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {t('batches.detail.mortalityChart')}
                    </h3>
                    {mortalityData.length === 0 ? (
                      <PanelNote>{t('batches.detail.noSeries')}</PanelNote>
                    ) : (
                      <div className="h-40">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={mortalityData} margin={{ top: 4, right: 4, bottom: 0, left: -18 }}>
                            <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                            <YAxis tick={{ fontSize: 10 }} allowDecimals={false} stroke="hsl(var(--muted-foreground))" />
                            <ChartTooltip contentStyle={chartTooltipStyle} />
                            <Line
                              type="stepAfter"
                              dataKey="lost"
                              name={t('batches.detail.mortalityChart')}
                              stroke="hsl(var(--destructive))"
                              strokeWidth={2}
                              dot={false}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </div>
                </div>

                {Object.keys(perf.data.cost.byCategory).length > 0 && (
                  <div>
                    <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {t('batches.detail.costByCategory')}
                    </h3>
                    <ul className="space-y-1 text-sm">
                      {Object.entries(perf.data.cost.byCategory).map(([category, paise]) => (
                        <li key={category} className="flex items-center justify-between gap-3">
                          <span className="text-muted-foreground">{category}</span>
                          <span className="tabular text-foreground">{fmtInr(paise)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            <div className="mt-4 space-y-4">
              <div>
                <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {t('batches.detail.mortalityHistory')}
                </h3>
                <DataTable
                  columns={mortalityCols}
                  data={mortality.data}
                  isLoading={mortality.isPending}
                  pageSize={5}
                  getRowId={(m) => m.id}
                  emptyState={<PanelNote>{t('batches.detail.noMortality')}</PanelNote>}
                />
              </div>
              <div>
                <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {t('batches.detail.movementHistory')}
                </h3>
                <DataTable
                  columns={movementCols}
                  data={movements.data}
                  isLoading={movements.isPending}
                  pageSize={5}
                  getRowId={(m) => m.id}
                  emptyState={<PanelNote>{t('batches.detail.noMovements')}</PanelNote>}
                />
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
