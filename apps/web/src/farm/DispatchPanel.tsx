import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { zodResolver } from '@hookform/resolvers/zod';
import { useFieldArray, useForm } from 'react-hook-form';
import { z } from 'zod';
import { Plus, ShieldAlert, Snowflake, Trash2, Truck } from 'lucide-react';
import {
  useCreateDispatch,
  useDispatches,
  useLots,
  useOrders,
  type CreateDispatchInput,
} from '../api/sales.hooks';
import { fmtDateTime } from '../lib/format';
import { isApiError } from '../lib/http';
import type { Dispatch } from './api';
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
  SubPanel,
  Textarea,
  type DataTableColumn,
} from '../ui';
import { goToPanel } from './SpaLink';

// Zod messages are i18n keys, translated at render time.
const lineSchema = z.object({
  lotId: z.string().min(1, 'dispatch.errRequired'),
  qtyKg: z.string().refine((v) => Number(v) > 0, 'dispatch.errQty'),
});
const dispatchSchema = z.object({
  salesOrderId: z.string().min(1, 'dispatch.errRequired'),
  refrigerated: z.boolean(),
  tempC: z.string(),
  vehicle: z.string(),
  notes: z.string(),
  lines: z.array(lineSchema).min(1),
});
type DispatchForm = z.infer<typeof dispatchSchema>;

const EMPTY_LINE: DispatchForm['lines'][number] = { lotId: '', qtyKg: '' };

function CreateDispatchDialog({ onOpenChange }: { onOpenChange: (open: boolean) => void }) {
  const { t } = useTranslation();
  const orders = useOrders();
  const lots = useLots();
  const createDispatch = useCreateDispatch();
  const [coldChainFail, setColdChainFail] = useState(false);

  const {
    control,
    register,
    watch,
    handleSubmit,
    formState: { errors },
  } = useForm<DispatchForm>({
    resolver: zodResolver(dispatchSchema),
    defaultValues: {
      salesOrderId: '',
      refrigerated: true,
      tempC: '',
      vehicle: '',
      notes: '',
      lines: [EMPTY_LINE],
    },
  });
  const { fields, append, remove } = useFieldArray({ control, name: 'lines' });

  const confirmedOrders = (orders.data ?? []).filter((o) => o.status === 'CONFIRMED');
  const availableLots = (lots.data ?? []).filter((l) => l.status === 'AVAILABLE' && Number(l.quantityKg) > 0);

  // Proactive cold-chain hints from the states of the selected lots.
  const watchedLines = watch('lines');
  const selectedLots = watchedLines
    .map((l) => availableLots.find((x) => x.id === l.lotId))
    .filter((l): l is NonNullable<typeof l> => Boolean(l));
  const hasFrozen = selectedLots.some((l) => l.state === 'FROZEN');
  const hasFresh = selectedLots.some((l) => l.state === 'FRESH');

  function onSubmit(values: DispatchForm) {
    setColdChainFail(false);
    const payload: CreateDispatchInput = {
      salesOrderId: values.salesOrderId,
      refrigeratedTransport: values.refrigerated,
      dispatchTempC: values.tempC.trim() === '' ? undefined : Number(values.tempC),
      vehicleNumber: values.vehicle || undefined,
      notes: values.notes || undefined,
      lines: values.lines.map((l) => ({ productLotId: l.lotId, qtyKg: Number(l.qtyKg) })),
    };
    createDispatch.mutate(payload, {
      onSuccess: () => onOpenChange(false),
      onError: (err) => {
        if (isApiError(err) && err.code === 'COLD_CHAIN_FAIL') setColdChainFail(true);
      },
    });
  }

  const missingPrereq =
    (orders.data && confirmedOrders.length === 0) || (lots.data && availableLots.length === 0);

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{t('dispatch.createTitle')}</DialogTitle>
          <DialogDescription>{t('dispatch.createDesc')}</DialogDescription>
        </DialogHeader>

        {missingPrereq ? (
          <div className="space-y-3">
            {orders.data && confirmedOrders.length === 0 && (
              <div className="space-y-2">
                <PanelNote>{t('dispatch.noOrders')}</PanelNote>
                <Button type="button" variant="secondary" onClick={() => goToPanel('sales')}>
                  {t('dispatch.goToOrders')}
                </Button>
              </div>
            )}
            {lots.data && availableLots.length === 0 && (
              <div className="space-y-2">
                <PanelNote>{t('dispatch.noLots')}</PanelNote>
                <Button type="button" variant="secondary" onClick={() => goToPanel('sales', 'processing')}>
                  {t('dispatch.goToProcessing')}
                </Button>
              </div>
            )}
          </div>
        ) : (
          <form onSubmit={(e) => void handleSubmit(onSubmit)(e)} className="space-y-4" noValidate>
            {/* The cold-chain hard gate, explained when the API blocks the load. */}
            {coldChainFail && (
              <div role="alert" className="space-y-1 rounded-xl border border-destructive/40 bg-destructive/10 p-3">
                <p className="flex items-center gap-2 text-sm font-semibold text-destructive">
                  <ShieldAlert className="h-4 w-4" aria-hidden />
                  {t('dispatch.coldChainFailTitle')}
                </p>
                <p className="text-sm text-foreground">{t('dispatch.coldChainFailBody')}</p>
              </div>
            )}

            <Field
              label={t('dispatch.order')}
              required
              error={errors.salesOrderId && t(errors.salesOrderId.message!)}
            >
              <Select {...register('salesOrderId')}>
                <option value="" />
                {confirmedOrders.map((o) => (
                  <option key={o.id} value={o.id}>
                    {t('dispatch.orderOption', { number: o.orderNumber, customer: o.customer.name })}
                  </option>
                ))}
              </Select>
            </Field>

            <fieldset className="space-y-3">
              <legend className="text-sm font-medium text-foreground">{t('dispatch.lines')}</legend>
              {fields.map((field, i) => (
                <SubPanel key={field.id} className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {t('dispatch.line', { n: i + 1 })}
                    </p>
                    {fields.length > 1 && (
                      <Button
                        type="button"
                        variant="danger"
                        size="sm"
                        onClick={() => remove(i)}
                        aria-label={t('dispatch.removeLine')}
                      >
                        <Trash2 aria-hidden />
                      </Button>
                    )}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-[1fr,8rem]">
                    <Field
                      label={t('dispatch.lot')}
                      required
                      error={errors.lines?.[i]?.lotId && t(errors.lines[i]!.lotId!.message!)}
                    >
                      <Select {...register(`lines.${i}.lotId`)}>
                        <option value="" />
                        {availableLots.map((l) => (
                          <option key={l.id} value={l.id}>
                            {t('dispatch.lotOption', { name: l.productName, code: l.lotCode, qty: l.quantityKg })}
                            {' · '}
                            {t(`processing.state.${l.state}`)}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field
                      label={t('dispatch.qtyKg')}
                      required
                      error={errors.lines?.[i]?.qtyKg && t(errors.lines[i]!.qtyKg!.message!)}
                    >
                      <Input type="number" min={0.01} step="0.01" inputMode="decimal" {...register(`lines.${i}.qtyKg`)} />
                    </Field>
                  </div>
                </SubPanel>
              ))}
              <Button type="button" variant="secondary" size="sm" onClick={() => append(EMPTY_LINE)}>
                <Plus aria-hidden />
                {t('dispatch.addLine')}
              </Button>
            </fieldset>

            {/* Sell the gate up front: state what this load requires before submit. */}
            {(hasFrozen || hasFresh) && (
              <div className="space-y-1 rounded-xl bg-secondary/60 p-3">
                {hasFrozen && (
                  <p className="flex items-start gap-2 text-sm text-foreground">
                    <Snowflake className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden />
                    {t('dispatch.hintFrozen')}
                  </p>
                )}
                {hasFresh && (
                  <p className="flex items-start gap-2 text-sm text-foreground">
                    <Snowflake className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden />
                    {t('dispatch.hintFresh')}
                  </p>
                )}
              </div>
            )}

            <label className="flex min-h-11 items-center gap-3 text-sm font-medium text-foreground">
              <input type="checkbox" className="h-5 w-5 accent-primary" {...register('refrigerated')} />
              {t('dispatch.refrigerated')}
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t('dispatch.tempC')}>
                <Input type="number" step="0.1" inputMode="decimal" {...register('tempC')} />
              </Field>
              <Field label={t('dispatch.vehicle')}>
                <Input {...register('vehicle')} />
              </Field>
            </div>
            <Field label={t('dispatch.notes')}>
              <Textarea rows={2} {...register('notes')} />
            </Field>

            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" loading={createDispatch.isPending}>
                <Truck aria-hidden />
                {t('dispatch.submit')}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function DispatchDetailDialog({
  dispatch,
  onOpenChange,
}: {
  dispatch: Dispatch;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{t('dispatch.detailTitle', { number: dispatch.salesOrder.orderNumber })}</DialogTitle>
          <DialogDescription>
            {t('dispatch.dispatchedAt')}: {fmtDateTime(dispatch.dispatchedAt)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Badge variant={dispatch.coldChainOk ? 'success' : 'destructive'}>
              {dispatch.coldChainOk ? t('dispatch.chainOk') : t('dispatch.chainBroken')}
            </Badge>
            <Badge variant={dispatch.refrigeratedTransport ? 'accent' : 'muted'}>
              {dispatch.refrigeratedTransport ? t('dispatch.refYes') : t('dispatch.refNo')}
            </Badge>
            {dispatch.dispatchTempC !== null && (
              <span className="tabular text-muted-foreground">
                {t('dispatch.loadTemp')}: <span className="text-foreground">{dispatch.dispatchTempC}°C</span>
              </span>
            )}
            {dispatch.vehicleNumber && (
              <span className="text-muted-foreground">
                {t('dispatch.colVehicle')}: <span className="tabular text-foreground">{dispatch.vehicleNumber}</span>
              </span>
            )}
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t('dispatch.linesTitle')}
            </p>
            <ul className="space-y-2">
              {dispatch.lines.map((l) => (
                <li key={l.id} className="rounded-xl border border-border bg-card px-3 py-2 text-sm">
                  {l.productLot ? (
                    <>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-medium text-foreground">
                          {l.productLot.productName}
                          <span className="ml-2 tabular text-xs text-muted-foreground">{l.productLot.lotCode}</span>
                        </span>
                        <span className="flex items-center gap-2">
                          <Badge variant={l.productLot.state === 'FROZEN' ? 'accent' : 'success'}>
                            {t(`processing.state.${l.productLot.state}`)}
                          </Badge>
                          {l.qtyKg && (
                            <span className="tabular text-foreground">{t('dispatch.qtyKgValue', { qty: l.qtyKg })}</span>
                          )}
                        </span>
                      </div>
                      {l.productLot.sourceBatch && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {t('dispatch.fromBatch', { code: l.productLot.sourceBatch.code })}
                          {' · '}
                          {l.productLot.sourceBatch.species.name}
                        </p>
                      )}
                    </>
                  ) : (
                    <span className="tabular text-muted-foreground">{l.batchId ?? '—'}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function DispatchPanel({ canWrite }: { farmId: string; canWrite: boolean }) {
  const { t } = useTranslation();
  const dispatches = useDispatches();
  const [createOpen, setCreateOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  const detail = detailId === null ? null : ((dispatches.data ?? []).find((d) => d.id === detailId) ?? null);

  const columns: DataTableColumn<Dispatch>[] = [
    {
      header: 'dispatch.colDate',
      accessor: (d) => d.dispatchedAt,
      cell: (d) => fmtDateTime(d.dispatchedAt),
    },
    {
      header: 'dispatch.colOrder',
      accessor: (d) => d.salesOrder.orderNumber,
      cell: (d) => <span className="font-medium">{d.salesOrder.orderNumber}</span>,
    },
    {
      header: 'dispatch.colChain',
      accessor: (d) => d.coldChainOk,
      cell: (d) => (
        <Badge variant={d.coldChainOk ? 'success' : 'destructive'}>
          {d.coldChainOk ? t('dispatch.chainOk') : t('dispatch.chainBroken')}
        </Badge>
      ),
    },
    {
      header: 'dispatch.colRefrigerated',
      accessor: (d) => d.refrigeratedTransport,
      cell: (d) => (
        <Badge variant={d.refrigeratedTransport ? 'accent' : 'muted'}>
          {d.refrigeratedTransport ? t('dispatch.refYes') : t('dispatch.refNo')}
        </Badge>
      ),
    },
    {
      header: 'dispatch.colVehicle',
      accessor: (d) => d.vehicleNumber ?? '',
      cell: (d) => (d.vehicleNumber ? <span className="tabular">{d.vehicleNumber}</span> : '—'),
    },
  ];

  return (
    <section className="space-y-3">
      <PanelHeading
        action={
          canWrite && (
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus aria-hidden />
              {t('dispatch.new')}
            </Button>
          )
        }
      >
        {t('dispatch.title')}
      </PanelHeading>

      {dispatches.isError ? (
        <div className="space-y-2">
          <PanelError>{t('dispatch.loadError')}</PanelError>
          <Button type="button" variant="secondary" size="sm" onClick={() => void dispatches.refetch()}>
            {t('dispatch.retry')}
          </Button>
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={dispatches.data}
          isLoading={dispatches.isLoading}
          searchable
          pageSize={10}
          getRowId={(d) => d.id}
          onRowClick={(d) => setDetailId(d.id)}
          emptyState={
            <EmptyState
              icon={Truck}
              title={t('dispatch.empty')}
              description={t('dispatch.emptyDesc')}
              action={
                canWrite ? (
                  <Button onClick={() => setCreateOpen(true)}>
                    <Plus aria-hidden />
                    {t('dispatch.new')}
                  </Button>
                ) : undefined
              }
            />
          }
        />
      )}

      {createOpen && <CreateDispatchDialog onOpenChange={setCreateOpen} />}
      {detail && <DispatchDetailDialog dispatch={detail} onOpenChange={(open) => !open && setDetailId(null)} />}
    </section>
  );
}
