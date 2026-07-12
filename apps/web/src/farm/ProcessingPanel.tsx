import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { zodResolver } from '@hookform/resolvers/zod';
import { useFieldArray, useForm } from 'react-hook-form';
import { z } from 'zod';
import { QRCodeSVG } from 'qrcode.react';
import { Package, Plus, Printer, ShieldAlert, Trash2 } from 'lucide-react';
import { useBatches } from '../api/hooks';
import {
  useColdStores,
  useCreateProcessing,
  useLots,
  useLotTrace,
  type CreateProcessingInput,
} from '../api/sales.hooks';
import { fmtDate, fmtDateTime } from '../lib/format';
import { isApiError } from '../lib/http';
import type { ProductLot } from './api';
import {
  Badge,
  Button,
  DataTable,
  Dialog,
  DialogContent,
  DialogDescription,
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
  Skeleton,
  SubPanel,
  Textarea,
  type BadgeProps,
  type DataTableColumn,
} from '../ui';
import { goToPanel } from './SpaLink';

const STATE_VARIANT: Record<ProductLot['state'], BadgeProps['variant']> = {
  FRESH: 'success',
  FROZEN: 'accent',
};
const STATUS_VARIANT: Record<ProductLot['status'], BadgeProps['variant']> = {
  AVAILABLE: 'success',
  DEPLETED: 'muted',
  DISCARDED: 'destructive',
};

// Zod messages are i18n keys, translated at render time.
const outputSchema = z.object({
  productName: z.string().min(1, 'processing.errRequired'),
  state: z.enum(['FRESH', 'FROZEN']),
  quantityKg: z.string().refine((v) => Number(v) > 0, 'processing.errQty'),
  coldStorageId: z.string(),
  expiryDate: z.string(),
});
const processSchema = z.object({
  batchId: z.string().min(1, 'processing.errRequired'),
  inputCount: z
    .string()
    .refine((v) => v.trim() === '' || (Number.isInteger(Number(v)) && Number(v) > 0), 'processing.errCount'),
  processedAt: z.string(),
  notes: z.string(),
  lots: z.array(outputSchema).min(1),
});
type ProcessForm = z.infer<typeof processSchema>;

const EMPTY_OUTPUT: ProcessForm['lots'][number] = {
  productName: '',
  state: 'FROZEN',
  quantityKg: '',
  coldStorageId: '',
  expiryDate: '',
};

function CreateProcessingDialog({ onOpenChange }: { onOpenChange: (open: boolean) => void }) {
  const { t } = useTranslation();
  const batches = useBatches();
  const stores = useColdStores();
  const createProcessing = useCreateProcessing();
  const [withdrawalBlocked, setWithdrawalBlocked] = useState(false);

  const {
    control,
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ProcessForm>({
    resolver: zodResolver(processSchema),
    defaultValues: { batchId: '', inputCount: '', processedAt: '', notes: '', lots: [EMPTY_OUTPUT] },
  });
  const { fields, append, remove } = useFieldArray({ control, name: 'lots' });

  const activeBatches = (batches.data ?? []).filter((b) => b.status === 'ACTIVE');

  function onSubmit(values: ProcessForm) {
    setWithdrawalBlocked(false);
    const payload: CreateProcessingInput = {
      sourceBatchId: values.batchId,
      inputCount: values.inputCount.trim() === '' ? undefined : Number(values.inputCount),
      processedAt: values.processedAt ? new Date(values.processedAt).toISOString() : undefined,
      notes: values.notes || undefined,
      lots: values.lots.map((l) => ({
        productName: l.productName,
        state: l.state,
        quantityKg: Number(l.quantityKg),
        coldStorageId: l.coldStorageId || undefined,
        expiryDate: l.expiryDate ? new Date(l.expiryDate).toISOString() : undefined,
      })),
    };
    createProcessing.mutate(payload, {
      onSuccess: () => onOpenChange(false),
      onError: (err) => {
        if (isApiError(err) && err.code === 'WITHDRAWAL_ACTIVE') setWithdrawalBlocked(true);
      },
    });
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{t('processing.createTitle')}</DialogTitle>
          <DialogDescription>{t('processing.createDesc')}</DialogDescription>
        </DialogHeader>

        {batches.data && activeBatches.length === 0 ? (
          <div className="space-y-3">
            <PanelNote>{t('processing.noBatches')}</PanelNote>
            <Button type="button" variant="secondary" onClick={() => goToPanel('livestock', 'batches')}>
              {t('processing.goToBatches')}
            </Button>
          </div>
        ) : (
          <form onSubmit={(e) => void handleSubmit(onSubmit)(e)} className="space-y-4" noValidate>
            {/* The §6 withdrawal hard gate, surfaced as a first-class explanation. */}
            {withdrawalBlocked && (
              <div role="alert" className="space-y-1 rounded-md border border-destructive/40 bg-destructive/10 p-3">
                <p className="flex items-center gap-2 text-sm font-semibold text-destructive">
                  <ShieldAlert className="h-4 w-4" aria-hidden />
                  {t('processing.withdrawalTitle')}
                </p>
                <p className="text-sm text-foreground">{t('processing.withdrawalBody')}</p>
              </div>
            )}

            <Field label={t('processing.batch')} required error={errors.batchId && t(errors.batchId.message!)}>
              <Select {...register('batchId')}>
                <option value="" />
                {activeBatches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {t('processing.batchOption', { code: b.code, species: b.species.name, count: b.currentCount })}
                  </option>
                ))}
              </Select>
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t('processing.inputCount')} error={errors.inputCount && t(errors.inputCount.message!)}>
                <Input type="number" min={1} step={1} inputMode="numeric" {...register('inputCount')} />
              </Field>
              <Field label={t('processing.processedAt')}>
                <Input type="date" {...register('processedAt')} />
              </Field>
            </div>

            <Field label={t('processing.notes')}>
              <Textarea rows={2} {...register('notes')} />
            </Field>

            <fieldset className="space-y-3">
              <legend className="text-sm font-medium text-foreground">{t('processing.outputs')}</legend>
              {fields.map((field, i) => (
                <SubPanel key={field.id} className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {t('processing.output', { n: i + 1 })}
                    </p>
                    {fields.length > 1 && (
                      <Button
                        type="button"
                        variant="danger"
                        size="sm"
                        onClick={() => remove(i)}
                        aria-label={t('processing.removeOutput')}
                      >
                        <Trash2 aria-hidden />
                      </Button>
                    )}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field
                      label={t('processing.productName')}
                      required
                      error={errors.lots?.[i]?.productName && t(errors.lots[i]!.productName!.message!)}
                    >
                      <Input {...register(`lots.${i}.productName`)} />
                    </Field>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label={t('processing.stateLabel')}>
                        <Select {...register(`lots.${i}.state`)}>
                          <option value="FROZEN">{t('processing.state.FROZEN')}</option>
                          <option value="FRESH">{t('processing.state.FRESH')}</option>
                        </Select>
                      </Field>
                      <Field
                        label={t('processing.quantityKg')}
                        required
                        error={errors.lots?.[i]?.quantityKg && t(errors.lots[i]!.quantityKg!.message!)}
                      >
                        <Input type="number" min={0.01} step="0.01" inputMode="decimal" {...register(`lots.${i}.quantityKg`)} />
                      </Field>
                    </div>
                    <Field label={t('processing.store')}>
                      <Select {...register(`lots.${i}.coldStorageId`)}>
                        <option value="">{t('processing.noStore')}</option>
                        {(stores.data ?? []).map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field label={t('processing.expiry')}>
                      <Input type="date" {...register(`lots.${i}.expiryDate`)} />
                    </Field>
                  </div>
                </SubPanel>
              ))}
              <Button type="button" variant="secondary" size="sm" onClick={() => append(EMPTY_OUTPUT)}>
                <Plus aria-hidden />
                {t('processing.addOutput')}
              </Button>
            </fieldset>

            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" loading={createProcessing.isPending}>
                {t('processing.submit')}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Vertical provenance timeline: lot → cold store → run → source batch → species/breed. */
function LotTraceTimeline({ lotId }: { lotId: string }) {
  const { t } = useTranslation();
  const trace = useLotTrace(lotId);

  if (trace.isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-4 w-3/5" />
      </div>
    );
  }
  if (trace.isError || !trace.data) return <PanelError>{t('processing.traceError')}</PanelError>;

  const d = trace.data;
  const steps: { key: string; label: string; title: string; meta?: string }[] = [
    {
      key: 'lot',
      label: t('processing.traceLot'),
      title: `${d.lot.productName} · ${d.lot.lotCode}`,
      meta: t('processing.producedOn', { date: fmtDateTime(d.lot.producedAt) }),
    },
  ];
  if (d.coldStorage) {
    steps.push({ key: 'store', label: t('processing.traceStore'), title: d.coldStorage.name });
  }
  if (d.processingRun) {
    steps.push({
      key: 'run',
      label: t('processing.traceRun'),
      title: fmtDateTime(d.processingRun.processedAt),
      ...(d.processingRun.inputCount !== null
        ? { meta: t('processing.traceRunMeta', { count: d.processingRun.inputCount }) }
        : {}),
    });
  }
  if (d.sourceBatch) {
    steps.push({ key: 'batch', label: t('processing.traceBatch'), title: d.sourceBatch.code });
    steps.push({
      key: 'species',
      label: t('processing.traceSpecies'),
      title: d.sourceBatch.breed
        ? `${d.sourceBatch.species.name} / ${d.sourceBatch.breed.name}`
        : d.sourceBatch.species.name,
    });
  }

  return (
    <ol className="relative ml-1.5 space-y-4 border-l border-border pl-5">
      {steps.map((s) => (
        <li key={s.key} className="relative">
          <span
            aria-hidden
            className="absolute -left-[26px] top-1.5 h-2.5 w-2.5 rounded-full bg-primary shadow-[0_0_0_3px_hsl(var(--card))]"
          />
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{s.label}</p>
          <p className="text-sm font-medium text-foreground">{s.title}</p>
          {s.meta && <p className="text-xs text-muted-foreground">{s.meta}</p>}
        </li>
      ))}
    </ol>
  );
}

function LotDetailDialog({ lot, onOpenChange }: { lot: ProductLot; onOpenChange: (open: boolean) => void }) {
  const { t } = useTranslation();
  const qrRef = useRef<HTMLDivElement>(null);
  const qrValue = lot.qrCode ?? lot.lotCode;

  // Print a small label (QR + lot code + product) in a same-origin blank window.
  function onPrint() {
    const svg = qrRef.current?.querySelector('svg')?.outerHTML ?? '';
    const w = window.open('', '_blank', 'width=420,height=520');
    if (!w) return;
    const doc = w.document;
    doc.title = lot.lotCode;
    const wrap = doc.createElement('div');
    wrap.setAttribute('style', 'font-family:sans-serif;text-align:center;padding:24px');
    wrap.innerHTML = svg; // qrcode.react output — trusted markup
    const code = doc.createElement('p');
    code.textContent = lot.lotCode;
    code.setAttribute('style', 'font-size:18px;font-weight:700;margin:12px 0 4px');
    const product = doc.createElement('p');
    product.textContent = lot.productName;
    product.setAttribute('style', 'font-size:14px;margin:0');
    wrap.append(code, product);
    doc.body.appendChild(wrap);
    w.focus();
    w.print();
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{t('processing.detailTitle', { code: lot.lotCode })}</DialogTitle>
          <DialogDescription>
            {lot.productName} ·{' '}
            {t('processing.remainingOfInitial', { qty: lot.quantityKg, initial: lot.initialQuantityKg })}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-5 sm:grid-cols-[auto,1fr]">
          <div className="space-y-3 text-center">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t('processing.qrTitle')}
            </p>
            <div ref={qrRef} className="mx-auto w-fit rounded-md border border-border bg-card p-3">
              <QRCodeSVG value={qrValue} size={160} aria-label={qrValue} />
            </div>
            <p className="tabular text-xs text-muted-foreground">{qrValue}</p>
            <Button type="button" variant="secondary" size="sm" onClick={onPrint}>
              <Printer aria-hidden />
              {t('processing.print')}
            </Button>
          </div>

          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Badge variant={STATE_VARIANT[lot.state]}>{t(`processing.state.${lot.state}`)}</Badge>
              <Badge variant={STATUS_VARIANT[lot.status]}>{t(`processing.status.${lot.status}`)}</Badge>
            </div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t('processing.traceTitle')}
            </p>
            <LotTraceTimeline lotId={lot.id} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function ProcessingPanel({ canWrite }: { farmId: string; canWrite: boolean }) {
  const { t } = useTranslation();
  const lots = useLots();
  const [createOpen, setCreateOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  const detail = detailId === null ? null : ((lots.data ?? []).find((l) => l.id === detailId) ?? null);

  const columns: DataTableColumn<ProductLot>[] = [
    {
      header: 'processing.colLot',
      accessor: 'lotCode',
      cell: (l) => <span className="tabular font-medium">{l.lotCode}</span>,
    },
    { header: 'processing.colProduct', accessor: 'productName' },
    {
      header: 'processing.colState',
      accessor: 'state',
      cell: (l) => <Badge variant={STATE_VARIANT[l.state]}>{t(`processing.state.${l.state}`)}</Badge>,
    },
    {
      header: 'processing.colQty',
      accessor: (l) => Number(l.quantityKg),
      cell: (l) => `${l.quantityKg} / ${l.initialQuantityKg}`,
      align: 'right',
    },
    {
      header: 'processing.colStatus',
      accessor: 'status',
      cell: (l) => <Badge variant={STATUS_VARIANT[l.status]}>{t(`processing.status.${l.status}`)}</Badge>,
    },
    { header: 'processing.colProduced', accessor: (l) => l.producedAt, cell: (l) => fmtDate(l.producedAt) },
    {
      header: 'processing.colExpiry',
      accessor: (l) => l.expiryDate ?? '',
      cell: (l) => (l.expiryDate ? fmtDate(l.expiryDate) : '—'),
    },
  ];

  return (
    <section className="space-y-3">
      <PanelHeading
        action={
          canWrite && (
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus aria-hidden />
              {t('processing.run')}
            </Button>
          )
        }
      >
        {t('processing.title')}
      </PanelHeading>

      {lots.isError ? (
        <div className="space-y-2">
          <PanelError>{t('processing.loadError')}</PanelError>
          <Button type="button" variant="secondary" size="sm" onClick={() => void lots.refetch()}>
            {t('processing.retry')}
          </Button>
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={lots.data}
          isLoading={lots.isLoading}
          searchable
          pageSize={10}
          getRowId={(l) => l.id}
          onRowClick={(l) => setDetailId(l.id)}
          emptyState={
            <EmptyState
              icon={Package} illustration="orders"
              title={t('processing.empty')}
              description={t('processing.emptyDesc')}
              action={
                canWrite ? (
                  <Button onClick={() => setCreateOpen(true)}>
                    <Plus aria-hidden />
                    {t('processing.run')}
                  </Button>
                ) : undefined
              }
            />
          }
        />
      )}

      {createOpen && <CreateProcessingDialog onOpenChange={setCreateOpen} />}
      {detail && <LotDetailDialog lot={detail} onOpenChange={(open) => !open && setDetailId(null)} />}
    </section>
  );
}
