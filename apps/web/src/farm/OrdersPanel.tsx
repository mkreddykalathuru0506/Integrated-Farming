import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useFieldArray, useForm } from 'react-hook-form';
import { z } from 'zod';
import { Plus, ShoppingCart, Trash2, Truck } from 'lucide-react';
import { useBatches } from '../api/hooks';
import {
  useCancelOrder,
  useConfirmOrder,
  useCreateOrder,
  useCustomers,
  useLots,
  useOrders,
  type CreateOrderInput,
} from '../api/sales.hooks';
import { fmtDate, fmtInr, rupeesToPaise } from '../lib/format';
import type { SalesOrder } from './api';
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
  EmptyState,
  Field,
  InrInput,
  Input,
  PanelError,
  PanelHeading,
  PanelNote,
  Select,
  SubPanel,
  Table,
  TBody,
  Td,
  Textarea,
  Th,
  THead,
  Tr,
  type BadgeProps,
  type DataTableColumn,
} from '../ui';
import { goToPanel } from './panelNav';

const STATUS_VARIANT: Record<SalesOrder['status'], BadgeProps['variant']> = {
  DRAFT: 'muted',
  CONFIRMED: 'accent',
  DISPATCHED: 'success',
  DELIVERED: 'success',
  CANCELLED: 'destructive',
};

// Zod messages are i18n keys, translated at render time.
const lineSchema = z.object({
  description: z.string().min(1, 'orders.errRequired'),
  qty: z.string().refine((v) => Number(v) > 0, 'orders.errQty'),
  unit: z.string(),
  price: z.string().refine((v) => {
    const p = rupeesToPaise(v);
    return p !== null && !p.startsWith('-');
  }, 'orders.errPrice'),
  /** '' | 'lot:<id>' | 'batch:<id>' — optional product-lot OR batch linkage. */
  link: z.string(),
});
const orderSchema = z.object({
  customerId: z.string().min(1, 'orders.errRequired'),
  expectedDate: z.string(),
  notes: z.string(),
  lines: z.array(lineSchema).min(1),
});
type OrderForm = z.infer<typeof orderSchema>;

const EMPTY_LINE: OrderForm['lines'][number] = { description: '', qty: '', unit: 'kg', price: '', link: '' };

function CreateOrderDialog({
  onOpenChange,
  canAddCustomer,
}: {
  onOpenChange: (open: boolean) => void;
  canAddCustomer: boolean;
}) {
  const { t } = useTranslation();
  const customers = useCustomers();
  const lots = useLots();
  const batches = useBatches();
  const createOrder = useCreateOrder();

  const {
    control,
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<OrderForm>({
    resolver: zodResolver(orderSchema),
    defaultValues: { customerId: '', expectedDate: '', notes: '', lines: [EMPTY_LINE] },
  });
  const { fields, append, remove } = useFieldArray({ control, name: 'lines' });

  const availableLots = (lots.data ?? []).filter((l) => l.status === 'AVAILABLE');
  const activeBatches = (batches.data ?? []).filter((b) => b.status === 'ACTIVE');

  function onSubmit(values: OrderForm) {
    const payload: CreateOrderInput = {
      customerId: values.customerId,
      expectedDate: values.expectedDate ? new Date(values.expectedDate).toISOString() : undefined,
      notes: values.notes || undefined,
      lines: values.lines.map((l) => ({
        description: l.description,
        qty: Number(l.qty),
        unit: l.unit || undefined,
        unitPricePaise: rupeesToPaise(l.price)!,
        productLotId: l.link.startsWith('lot:') ? l.link.slice(4) : undefined,
        batchId: l.link.startsWith('batch:') ? l.link.slice(6) : undefined,
      })),
    };
    createOrder.mutate(payload, { onSuccess: () => onOpenChange(false) });
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{t('orders.createTitle')}</DialogTitle>
          <DialogDescription>{t('orders.createDesc')}</DialogDescription>
        </DialogHeader>

        {customers.data && customers.data.length === 0 ? (
          <div className="space-y-3">
            <PanelNote>{t('orders.addCustomerFirst')}</PanelNote>
            {/* The customers screen (Invoices panel) only lets OWNER/ACCOUNTANT add a
                customer — for a MANAGER the CTA would dead-end, so show guidance instead. */}
            {canAddCustomer ? (
              <Button type="button" variant="secondary" onClick={() => goToPanel('finance', 'invoices')}>
                {t('orders.goToCustomers')}
              </Button>
            ) : (
              <PanelNote>{t('orders.customersAskOwner')}</PanelNote>
            )}
          </div>
        ) : (
          <form onSubmit={(e) => void handleSubmit(onSubmit)(e)} className="space-y-4" noValidate>
            <Field label={t('orders.customer')} required error={errors.customerId && t(errors.customerId.message!)}>
              <Select {...register('customerId')}>
                <option value="" />
                {(customers.data ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t('orders.expectedDate')}>
                <Input type="date" {...register('expectedDate')} />
              </Field>
              <Field label={t('orders.notes')}>
                <Textarea rows={1} {...register('notes')} />
              </Field>
            </div>

            <fieldset className="space-y-3">
              <legend className="text-sm font-medium text-foreground">{t('orders.lines')}</legend>
              {fields.map((field, i) => (
                <SubPanel key={field.id} className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {t('orders.line', { n: i + 1 })}
                    </p>
                    {fields.length > 1 && (
                      <Button type="button" variant="danger" size="sm" onClick={() => remove(i)} aria-label={t('orders.removeLine')}>
                        <Trash2 aria-hidden />
                      </Button>
                    )}
                  </div>
                  <Field
                    label={t('orders.description')}
                    required
                    error={errors.lines?.[i]?.description && t(errors.lines[i]!.description!.message!)}
                  >
                    <Input {...register(`lines.${i}.description`)} />
                  </Field>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    <Field label={t('orders.qty')} required error={errors.lines?.[i]?.qty && t(errors.lines[i]!.qty!.message!)}>
                      <Input type="number" min={0.01} step="0.01" inputMode="decimal" {...register(`lines.${i}.qty`)} />
                    </Field>
                    <Field label={t('orders.unit')}>
                      <Input {...register(`lines.${i}.unit`)} />
                    </Field>
                    {/* Field must wrap the input itself (not the Controller) so the
                        label's htmlFor lands on the rendered InrInput. */}
                    <Controller
                      control={control}
                      name={`lines.${i}.price`}
                      render={({ field: f }) => (
                        <Field
                          label={t('orders.unitPrice')}
                          required
                          error={errors.lines?.[i]?.price && t(errors.lines[i]!.price!.message!)}
                          className="col-span-2 sm:col-span-1"
                        >
                          <InrInput value={f.value} onChangePaise={(_p, rupees) => f.onChange(rupees)} />
                        </Field>
                      )}
                    />
                  </div>
                  <Field label={t('orders.link')}>
                    <Select {...register(`lines.${i}.link`)}>
                      <option value="">{t('orders.linkNone')}</option>
                      {availableLots.length > 0 && (
                        <optgroup label={t('orders.linkLots')}>
                          {availableLots.map((l) => (
                            <option key={l.id} value={`lot:${l.id}`}>
                              {l.productName} · {l.lotCode}
                            </option>
                          ))}
                        </optgroup>
                      )}
                      {activeBatches.length > 0 && (
                        <optgroup label={t('orders.linkBatches')}>
                          {activeBatches.map((b) => (
                            <option key={b.id} value={`batch:${b.id}`}>
                              {b.code} · {b.species.name}
                            </option>
                          ))}
                        </optgroup>
                      )}
                    </Select>
                  </Field>
                </SubPanel>
              ))}
              <Button type="button" variant="secondary" size="sm" onClick={() => append(EMPTY_LINE)}>
                <Plus aria-hidden />
                {t('orders.addLine')}
              </Button>
            </fieldset>

            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" loading={createOrder.isPending}>
                {t('orders.submit')}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function OrdersPanel({
  canWrite,
  canAddCustomer,
}: {
  farmId: string;
  canWrite: boolean;
  canAddCustomer: boolean;
}) {
  const { t } = useTranslation();
  const orders = useOrders();
  const confirmOrder = useConfirmOrder();
  const cancelOrder = useCancelOrder();
  const [createOpen, setCreateOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<SalesOrder | null>(null);

  // Derive the detail record from the live list so mutations refresh it too.
  const detail = detailId === null ? null : (orders.data ?? []).find((o) => o.id === detailId) ?? null;

  const columns: DataTableColumn<SalesOrder>[] = [
    {
      header: 'orders.colNumber',
      accessor: 'orderNumber',
      cell: (o) => <span className="font-medium">{o.orderNumber}</span>,
    },
    { header: 'orders.colDate', accessor: (o) => o.orderDate, cell: (o) => fmtDate(o.orderDate) },
    { header: 'orders.colCustomer', accessor: (o) => o.customer.name },
    {
      header: 'orders.colStatus',
      accessor: 'status',
      cell: (o) => <Badge variant={STATUS_VARIANT[o.status]}>{t(`orders.status.${o.status}`)}</Badge>,
    },
    {
      header: 'orders.colTotal',
      accessor: (o) => Number(o.totalPaise),
      cell: (o) => fmtInr(o.totalPaise),
      align: 'right',
    },
  ];

  return (
    <section className="space-y-3">
      <PanelHeading
        action={
          canWrite && (
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus aria-hidden />
              {t('orders.new')}
            </Button>
          )
        }
      >
        {t('orders.title')}
      </PanelHeading>

      {orders.isError ? (
        <div className="space-y-2">
          <PanelError>{t('orders.loadError')}</PanelError>
          <Button type="button" variant="secondary" size="sm" onClick={() => void orders.refetch()}>
            {t('orders.retry')}
          </Button>
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={orders.data}
          isLoading={orders.isLoading}
          searchable
          pageSize={10}
          getRowId={(o) => o.id}
          onRowClick={(o) => setDetailId(o.id)}
          emptyState={
            <EmptyState
              icon={ShoppingCart}
              title={t('orders.empty')}
              description={t('orders.emptyDesc')}
              action={
                canWrite ? (
                  <Button onClick={() => setCreateOpen(true)}>
                    <Plus aria-hidden />
                    {t('orders.new')}
                  </Button>
                ) : undefined
              }
            />
          }
        />
      )}

      {createOpen && <CreateOrderDialog onOpenChange={setCreateOpen} canAddCustomer={canAddCustomer} />}

      {detail && (
        <Dialog open onOpenChange={(open) => !open && setDetailId(null)}>
          <DialogContent size="lg">
            <DialogHeader>
              <DialogTitle>{t('orders.detailTitle', { number: detail.orderNumber })}</DialogTitle>
              <DialogDescription>
                {detail.customer.name} · {fmtDate(detail.orderDate)}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                <Badge variant={STATUS_VARIANT[detail.status]}>{t(`orders.status.${detail.status}`)}</Badge>
                {detail.expectedDate && (
                  <span className="text-muted-foreground">
                    {t('orders.expected')}: <span className="text-foreground">{fmtDate(detail.expectedDate)}</span>
                  </span>
                )}
                {detail.notes && <span className="text-muted-foreground">{detail.notes}</span>}
              </div>

              <div className="overflow-x-auto rounded-xl border border-border">
                <Table>
                  <THead>
                    <Tr>
                      <Th>{t('orders.description')}</Th>
                      <Th className="text-right">{t('orders.lineQty')}</Th>
                      <Th className="text-right">{t('orders.linePrice')}</Th>
                      <Th className="text-right">{t('orders.lineTotal')}</Th>
                    </Tr>
                  </THead>
                  <TBody>
                    {detail.lines.map((l) => (
                      <Tr key={l.id}>
                        <Td>
                          {l.description}
                          {l.productLotId && (
                            <Badge variant="accent" className="ml-2">
                              {t('orders.linkedLot')}
                            </Badge>
                          )}
                          {l.batchId && (
                            <Badge variant="accent" className="ml-2">
                              {t('orders.linkedBatch')}
                            </Badge>
                          )}
                        </Td>
                        <Td className="tabular text-right">
                          {l.qty} {l.unit}
                        </Td>
                        <Td className="tabular text-right">{fmtInr(l.unitPricePaise)}</Td>
                        <Td className="tabular text-right">{fmtInr(l.lineTotalPaise)}</Td>
                      </Tr>
                    ))}
                    <Tr>
                      <Td colSpan={3} className="text-right font-semibold">
                        {t('orders.total')}
                      </Td>
                      <Td className="tabular text-right font-semibold">{fmtInr(detail.totalPaise)}</Td>
                    </Tr>
                  </TBody>
                </Table>
              </div>

              {detail.status === 'CONFIRMED' && (
                <SubPanel className="space-y-2">
                  <PanelNote>{t('orders.dispatchHint')}</PanelNote>
                  <Button type="button" full onClick={() => goToPanel('sales', 'dispatch')}>
                    <Truck aria-hidden />
                    {t('orders.dispatchThis')}
                  </Button>
                </SubPanel>
              )}
            </div>

            {canWrite && detail.status === 'DRAFT' && (
              <DialogFooter>
                <Button type="button" variant="danger" onClick={() => setCancelTarget(detail)}>
                  {t('orders.cancelOrder')}
                </Button>
                <Button
                  type="button"
                  loading={confirmOrder.isPending}
                  onClick={() => confirmOrder.mutate(detail.id)}
                >
                  {t('orders.confirm')}
                </Button>
              </DialogFooter>
            )}
          </DialogContent>
        </Dialog>
      )}

      <ConfirmDialog
        open={cancelTarget !== null}
        onOpenChange={(open) => {
          if (!open) setCancelTarget(null);
        }}
        title={t('orders.cancelConfirmTitle')}
        description={t('orders.cancelConfirmBody', {
          number: cancelTarget?.orderNumber ?? '',
          customer: cancelTarget?.customer.name ?? '',
        })}
        confirmLabel={t('orders.cancelOrder')}
        variant="danger"
        loading={cancelOrder.isPending}
        onConfirm={() => {
          if (!cancelTarget) return;
          cancelOrder.mutate(cancelTarget.id, { onSettled: () => setCancelTarget(null) });
        }}
      />
    </section>
  );
}
