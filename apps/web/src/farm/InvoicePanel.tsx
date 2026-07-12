// 11.6 follow-up: mark-paid / void actions once PR #60 merges (endpoints not on main yet).
import { useMemo, useState } from 'react';
import { Controller, useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { FilePlus2, FileText, Plus, Trash2, UserPlus } from 'lucide-react';
import { useBatches } from '../api/hooks';
import {
  useCreateCustomer,
  useCreateInvoice,
  useCustomers,
  useFarmInfo,
  useFarmPnl,
  useInvoice,
  useInvoices,
  useOpenInvoicePdf,
  type InvoiceListItem,
} from '../api/finance.hooks';
import { fmtDate, fmtInr, rupeesToPaise } from '../lib/format';
import {
  Badge,
  Button,
  Card,
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
  InrInput,
  PanelError,
  PanelHeading,
  PanelNote,
  Select,
  SubPanel,
  Textarea,
  type DataTableColumn,
} from '../ui';
import { buildTotals, isIntraState } from './gstPreview';
import { LoadMore } from './LoadMore';
import type { Batch } from './api';

const GST_RATES_BPS = [0, 500, 1200, 1800, 2800] as const;

const dayISO = (s: string) => `${s}T00:00:00.000Z`;
const batchLabel = (b: Batch) => `${b.code}${b.name ? ` — ${b.name}` : ''}`;

const statusVariant = (s: string) =>
  s === 'PAID' ? 'success' : s === 'ISSUED' ? 'accent' : s === 'CANCELLED' ? 'destructive' : 'muted';

const lineSchema = z.object({
  description: z.string().min(1, 'invoices.errDesc'),
  qty: z.string().refine((s) => Number.isFinite(Number(s)) && Number(s) > 0, 'invoices.errQty'),
  price: z.string().refine((s) => {
    const p = rupeesToPaise(s);
    return p !== null && !p.startsWith('-');
  }, 'invoices.errPrice'),
  gstRateBps: z.string(),
  batchId: z.string(),
});
const invoiceSchema = z.object({
  customerId: z.string().min(1, 'invoices.errCustomer'),
  issueDate: z.string(),
  notes: z.string(),
  lines: z.array(lineSchema).min(1),
});
type InvoiceValues = z.infer<typeof invoiceSchema>;

const customerSchema = z.object({
  name: z.string().min(1, 'invoices.errName'),
  gstin: z.string(),
  state: z.string(),
  phone: z.string(),
  address: z.string(),
});
type CustomerValues = z.infer<typeof customerSchema>;

export function InvoicePanel({ canWrite }: { farmId: string; canWrite: boolean }) {
  const { t } = useTranslation();
  const invoices = useInvoices();
  const customers = useCustomers();
  const pnl = useFarmPnl();
  const [createOpen, setCreateOpen] = useState(false);
  const [custOpen, setCustOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  const hasCustomers = (customers.data?.length ?? 0) > 0;

  const columns: DataTableColumn<InvoiceListItem>[] = [
    {
      header: 'invoices.colNumber',
      accessor: 'invoiceNumber',
      cell: (i) => <span className="font-medium tabular text-foreground">{i.invoiceNumber}</span>,
    },
    {
      header: 'invoices.colDate',
      accessor: 'issueDate',
      cell: (i) => fmtDate(i.issueDate),
    },
    {
      header: 'invoices.colCustomer',
      accessor: (i) => i.customer.name,
    },
    {
      header: 'invoices.colStatus',
      accessor: 'status',
      cell: (i) => <Badge variant={statusVariant(i.status)}>{t(`invoices.status.${i.status}`)}</Badge>,
    },
    {
      header: 'invoices.colTotal',
      accessor: (i) => i.totalPaise,
      align: 'right',
      cell: (i) => fmtInr(i.totalPaise),
    },
  ];

  return (
    <section className="space-y-3">
      <PanelHeading
        action={
          canWrite ? (
            <div className="flex flex-wrap justify-end gap-2">
              <Button size="sm" variant="secondary" onClick={() => setCustOpen(true)}>
                <UserPlus aria-hidden /> {t('invoices.addCustomer')}
              </Button>
              <Button size="sm" onClick={() => setCreateOpen(true)} disabled={!hasCustomers}>
                <FilePlus2 aria-hidden /> {t('invoices.create')}
              </Button>
            </div>
          ) : undefined
        }
      >
        {t('invoices.title')}
      </PanelHeading>

      {pnl.data && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <PnlTile label={t('invoices.revenue')} paise={pnl.data.revenuePaise} />
          <PnlTile label={t('invoices.cost')} paise={pnl.data.costPaise} />
          <PnlTile label={t('invoices.profit')} paise={pnl.data.profitPaise} signed />
        </div>
      )}

      {canWrite && !hasCustomers && !customers.isLoading && (
        <PanelNote>{t('invoices.addCustomerFirst')}</PanelNote>
      )}

      {invoices.isError ? (
        <div className="space-y-2">
          <PanelError>{t('invoices.error')}</PanelError>
          <Button size="sm" variant="secondary" onClick={() => void invoices.refetch()}>
            {t('invoices.retry')}
          </Button>
        </div>
      ) : (
        <>
          <DataTable
            columns={columns}
            data={invoices.items}
            isLoading={invoices.isPending}
            searchable
            searchPlaceholderKey="invoices.search"
            pageSize={10}
            getRowId={(i) => i.id}
            onRowClick={(i) => setDetailId(i.id)}
            emptyState={
              <EmptyState
                icon={FileText}
                title={t('invoices.empty')}
                description={t('invoices.emptyDesc')}
                action={
                  canWrite && hasCustomers ? (
                    <Button size="sm" onClick={() => setCreateOpen(true)}>
                      {t('invoices.create')}
                    </Button>
                  ) : canWrite ? (
                    <Button size="sm" onClick={() => setCustOpen(true)}>
                      {t('invoices.addCustomer')}
                    </Button>
                  ) : undefined
                }
              />
            }
          />
          <LoadMore
            shown={invoices.items?.length ?? 0}
            total={invoices.total}
            loading={invoices.isFetchingNextPage}
            onLoadMore={() => void invoices.fetchNextPage()}
          />
        </>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent size="lg" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>{t('invoices.createTitle')}</DialogTitle>
          </DialogHeader>
          <InvoiceBuilder onDone={() => setCreateOpen(false)} />
        </DialogContent>
      </Dialog>

      <Dialog open={custOpen} onOpenChange={setCustOpen}>
        <DialogContent aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>{t('invoices.addCustomerTitle')}</DialogTitle>
          </DialogHeader>
          <CustomerForm onDone={() => setCustOpen(false)} />
        </DialogContent>
      </Dialog>

      <InvoiceDetailDialog id={detailId} onOpenChange={(o) => !o && setDetailId(null)} />
    </section>
  );
}

function PnlTile({ label, paise, signed }: { label: string; paise: string; signed?: boolean }) {
  const negative = paise.startsWith('-');
  return (
    <Card className="p-4">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      <p
        className={`mt-2 font-display text-2xl font-semibold tabular ${
          signed ? (negative ? 'text-destructive' : 'text-success') : 'text-foreground'
        }`}
      >
        {fmtInr(paise)}
      </p>
    </Card>
  );
}

/**
 * Multi-line invoice builder with a live GST estimate. The preview replicates
 * the server's rounding exactly (see gstPreview.ts) and the split follows
 * customer state vs farm state; the server stays authoritative on save.
 */
function InvoiceBuilder({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation();
  const customers = useCustomers();
  const farm = useFarmInfo();
  const batches = useBatches();
  const activeBatches = useMemo(
    () => (batches.data ?? []).filter((b) => b.status === 'ACTIVE'),
    [batches.data],
  );
  const createInvoice = useCreateInvoice();

  const emptyLine = { description: '', qty: '1', price: '', gstRateBps: '500', batchId: '' };
  const {
    register,
    control,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<InvoiceValues>({
    resolver: zodResolver(invoiceSchema),
    defaultValues: {
      customerId: customers.data?.[0]?.id ?? '',
      issueDate: '',
      notes: '',
      lines: [emptyLine],
    },
  });
  const { fields, append, remove } = useFieldArray({ control, name: 'lines' });
  const err = (m?: string) => (m ? t(m) : undefined);

  // Live estimate — recomputed on every keystroke from the watched values.
  const values = watch();
  const customer = customers.data?.find((c) => c.id === values.customerId);
  const intra = isIntraState(customer?.state, farm.data?.state);
  const preview = useMemo(() => {
    const parsed = (values.lines ?? [])
      .map((l) => {
        const paise = rupeesToPaise(l.price ?? '');
        const qty = Number(l.qty);
        if (paise === null || paise.startsWith('-') || !Number.isFinite(qty) || qty <= 0) return null;
        return { qty, unitPricePaise: Number(paise), gstRateBps: Number(l.gstRateBps) };
      })
      .filter((l): l is NonNullable<typeof l> => l !== null);
    return buildTotals(parsed, intra);
  }, [values, intra]);

  const onSubmit = handleSubmit((v) => {
    createInvoice.mutate(
      {
        customerId: v.customerId,
        issueDate: v.issueDate ? dayISO(v.issueDate) : undefined, // dormant field surfaced
        notes: v.notes.trim() || undefined, // dormant field surfaced
        lines: v.lines.map((l) => ({
          description: l.description,
          qty: Number(l.qty),
          unitPricePaise: rupeesToPaise(l.price)!, // integer-paise string passthrough
          gstRateBps: Number(l.gstRateBps),
          batchId: l.batchId || undefined, // dormant field surfaced (per-line attribution)
        })),
      },
      { onSuccess: onDone },
    );
  });

  return (
    <form onSubmit={(e) => void onSubmit(e)} className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label={t('invoices.customer')} required error={err(errors.customerId?.message)}>
          <Select {...register('customerId')}>
            {(customers.data ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.state ? ` (${c.state})` : ` (${t('invoices.customerStateless')})`}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t('invoices.issueDate')} hint={t('invoices.issueDateHint')}>
          <Input type="date" {...register('issueDate')} />
        </Field>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium text-foreground">{t('invoices.lines')}</p>
        {fields.map((field, i) => (
          <SubPanel key={field.id} className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t('invoices.line', { n: i + 1 })}
              </p>
              {fields.length > 1 && (
                <Button
                  type="button"
                  variant="danger"
                  size="sm"
                  aria-label={t('invoices.removeLine')}
                  onClick={() => remove(i)}
                >
                  <Trash2 aria-hidden />
                </Button>
              )}
            </div>
            <Field label={t('invoices.desc')} required error={err(errors.lines?.[i]?.description?.message)}>
              <Input {...register(`lines.${i}.description`)} />
            </Field>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Field label={t('invoices.qty')} required error={err(errors.lines?.[i]?.qty?.message)}>
                <Input type="number" min={0.01} step="0.01" inputMode="decimal" {...register(`lines.${i}.qty`)} />
              </Field>
              <Controller
                name={`lines.${i}.price`}
                control={control}
                render={({ field: f }) => (
                  <Field
                    label={t('invoices.price')}
                    required
                    error={err(errors.lines?.[i]?.price?.message)}
                  >
                    <InrInput
                      value={f.value}
                      onChangePaise={(_, rupees) => f.onChange(rupees)}
                      onBlur={f.onBlur}
                    />
                  </Field>
                )}
              />
              <Field label={t('invoices.gstRate')}>
                <Select {...register(`lines.${i}.gstRateBps`)}>
                  {GST_RATES_BPS.map((bps) => (
                    <option key={bps} value={bps}>
                      {t('invoices.gstPct', { pct: bps / 100 })}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            {activeBatches.length > 0 && (
              <Field label={t('invoices.lineBatch')}>
                <Select {...register(`lines.${i}.batchId`)}>
                  <option value="">{t('invoices.noLineBatch')}</option>
                  {activeBatches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {batchLabel(b)}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
          </SubPanel>
        ))}
        <Button type="button" variant="secondary" size="sm" onClick={() => append(emptyLine)}>
          <Plus aria-hidden /> {t('invoices.addLine')}
        </Button>
      </div>

      <Field label={t('invoices.notes')}>
        <Textarea rows={2} {...register('notes')} />
      </Field>

      <SubPanel className="space-y-1.5">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t('invoices.previewTitle')}
          </p>
          <p className="text-xs text-muted-foreground">
            {intra ? t('invoices.intraState') : t('invoices.interState')}
          </p>
        </div>
        <PreviewRow label={t('invoices.subtotal')} paise={preview.subtotalPaise} />
        {intra ? (
          <>
            <PreviewRow label={t('invoices.cgst')} paise={preview.cgstPaise} />
            <PreviewRow label={t('invoices.sgst')} paise={preview.sgstPaise} />
          </>
        ) : (
          <PreviewRow label={t('invoices.igst')} paise={preview.igstPaise} />
        )}
        <div className="border-t border-border pt-1.5">
          <PreviewRow label={t('invoices.total')} paise={preview.totalPaise} strong />
        </div>
        <p className="text-xs text-muted-foreground">{t('invoices.previewNote')}</p>
      </SubPanel>

      <DialogFooter>
        <Button type="button" variant="secondary" onClick={onDone}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" loading={createInvoice.isPending}>
          {t('invoices.raise')}
        </Button>
      </DialogFooter>
    </form>
  );
}

function PreviewRow({ label, paise, strong }: { label: string; paise: number; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className={strong ? 'font-semibold text-foreground' : 'text-muted-foreground'}>{label}</span>
      <span className={`tabular ${strong ? 'font-semibold text-foreground' : 'text-foreground'}`}>
        {fmtInr(paise)}
      </span>
    </div>
  );
}

function CustomerForm({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation();
  const createCustomer = useCreateCustomer();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CustomerValues>({
    resolver: zodResolver(customerSchema),
    defaultValues: { name: '', gstin: '', state: '', phone: '', address: '' },
  });
  const err = (m?: string) => (m ? t(m) : undefined);

  const onSubmit = handleSubmit((v) => {
    createCustomer.mutate(
      {
        name: v.name,
        gstin: v.gstin.trim() || undefined, // dormant field surfaced — printed on the invoice
        state: v.state.trim() || undefined, // drives the CGST/SGST vs IGST split
        phone: v.phone.trim() || undefined, // dormant field surfaced
        address: v.address.trim() || undefined, // dormant field surfaced
      },
      { onSuccess: onDone },
    );
  });

  return (
    <form onSubmit={(e) => void onSubmit(e)} className="space-y-3">
      <Field label={t('invoices.custName')} required error={err(errors.name?.message)}>
        <Input {...register('name')} />
      </Field>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label={t('invoices.custGstin')}>
          <Input {...register('gstin')} />
        </Field>
        <Field label={t('invoices.custState')} hint={t('invoices.custStateHint')}>
          <Input {...register('state')} />
        </Field>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label={t('invoices.custPhone')}>
          <Input {...register('phone')} />
        </Field>
        <Field label={t('invoices.custAddress')}>
          <Input {...register('address')} />
        </Field>
      </div>
      <DialogFooter>
        <Button type="button" variant="secondary" onClick={onDone}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" loading={createCustomer.isPending}>
          {t('invoices.addCustomer')}
        </Button>
      </DialogFooter>
    </form>
  );
}

function InvoiceDetailDialog({ id, onOpenChange }: { id: string | null; onOpenChange: (o: boolean) => void }) {
  const { t } = useTranslation();
  const detail = useInvoice(id);
  const openPdf = useOpenInvoicePdf();
  const inv = detail.data;

  return (
    <Dialog open={id !== null} onOpenChange={onOpenChange}>
      <DialogContent size="lg" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>
            {t('invoices.detailTitle', { number: inv?.invoiceNumber ?? '…' })}
          </DialogTitle>
        </DialogHeader>

        {detail.isLoading && <CardSkeleton />}
        {detail.isError && (
          <div className="space-y-2">
            <PanelError>{t('invoices.detailError')}</PanelError>
            <Button size="sm" variant="secondary" onClick={() => void detail.refetch()}>
              {t('invoices.retry')}
            </Button>
          </div>
        )}

        {inv && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
              <DetailRow label={t('invoices.colCustomer')} value={inv.customer.name} />
              <DetailRow label={t('invoices.colDate')} value={fmtDate(inv.issueDate)} />
              <DetailRow label={t('invoices.gstin')} value={inv.customer.gstin ?? '—'} />
              <DetailRow label={t('invoices.placeOfSupply')} value={inv.placeOfSupplyState ?? '—'} />
              {/* FSSAI licence snapshot frozen on the invoice at raise time (§6). */}
              <DetailRow label={t('invoices.fssai')} value={inv.fssaiLicenseNo ?? '—'} />
              <div className="flex items-center justify-between gap-3 sm:justify-start sm:gap-2">
                <span className="text-muted-foreground">{t('invoices.colStatus')}</span>
                <Badge variant={statusVariant(inv.status)}>{t(`invoices.status.${inv.status}`)}</Badge>
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full min-w-[480px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                    <th className="px-3 py-2 font-medium">{t('invoices.desc')}</th>
                    <th className="px-3 py-2 font-medium">{t('invoices.hsn')}</th>
                    <th className="px-3 py-2 text-right font-medium">{t('invoices.qty')}</th>
                    <th className="px-3 py-2 text-right font-medium">{t('invoices.price')}</th>
                    <th className="px-3 py-2 text-right font-medium">{t('invoices.gstRate')}</th>
                    <th className="px-3 py-2 text-right font-medium">{t('invoices.colLineTotal')}</th>
                  </tr>
                </thead>
                <tbody>
                  {inv.lines.map((l) => (
                    <tr key={l.id} className="border-b border-border/60 last:border-0">
                      <td className="px-3 py-2 text-foreground">{l.description}</td>
                      <td className="px-3 py-2 text-muted-foreground">{l.hsnSac ?? '—'}</td>
                      <td className="px-3 py-2 text-right tabular">{l.qty}</td>
                      <td className="px-3 py-2 text-right tabular">{fmtInr(l.unitPricePaise)}</td>
                      <td className="px-3 py-2 text-right tabular">{l.gstRateBps / 100}%</td>
                      <td className="px-3 py-2 text-right tabular">{fmtInr(l.lineTotalPaise)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <SubPanel className="ml-auto w-full max-w-xs space-y-1.5">
              <PreviewRowStr label={t('invoices.subtotal')} paise={inv.subtotalPaise} />
              {inv.igstPaise !== '0' ? (
                <PreviewRowStr label={t('invoices.igst')} paise={inv.igstPaise} />
              ) : (
                <>
                  <PreviewRowStr label={t('invoices.cgst')} paise={inv.cgstPaise} />
                  <PreviewRowStr label={t('invoices.sgst')} paise={inv.sgstPaise} />
                </>
              )}
              <div className="border-t border-border pt-1.5">
                <PreviewRowStr label={t('invoices.total')} paise={inv.totalPaise} strong />
              </div>
            </SubPanel>

            {inv.notes && <PanelNote>{inv.notes}</PanelNote>}

            <DialogFooter>
              <Button
                type="button"
                variant="secondary"
                loading={openPdf.isPending}
                onClick={() => openPdf.mutate(inv.id)}
              >
                <FileText aria-hidden /> {t('invoices.pdf')}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 sm:justify-start sm:gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
}

function PreviewRowStr({ label, paise, strong }: { label: string; paise: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className={strong ? 'font-semibold text-foreground' : 'text-muted-foreground'}>{label}</span>
      <span className={`tabular ${strong ? 'font-semibold text-foreground' : 'text-foreground'}`}>
        {fmtInr(paise)}
      </span>
    </div>
  );
}
