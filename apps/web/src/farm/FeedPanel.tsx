import { useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { Package, ShoppingCart, Soup } from 'lucide-react';
import { useBatches } from '../api/hooks';
import {
  useConsumeFeed,
  useCreateFeedItem,
  useCreateVendor,
  useFcr,
  useFeedItems,
  usePurchaseFeed,
  useVendors,
} from '../api/finance.hooks';
import { fmtInr, rupeesToPaise } from '../lib/format';
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  type DataTableColumn,
} from '../ui';
import type { Batch, FeedItem } from './api';

// Quantities are Prisma Decimals (never money) — Number comparison is fine here.
const isLow = (i: FeedItem) =>
  i.reorderThreshold !== null && Number(i.stockQty) <= Number(i.reorderThreshold);

const dayISO = (s: string) => `${s}T00:00:00.000Z`;

const batchLabel = (b: Batch) =>
  `${b.code}${b.name ? ` — ${b.name}` : ''} (${b.currentCount})`;

// Validation messages are i18n keys, translated at render time.
const qtyString = z
  .string()
  .refine((s) => Number.isFinite(Number(s)) && Number(s) > 0, 'feed.errQty');
/** Rupee text that converts to a non-negative integer-paise string. */
const paiseString = (msg: string) =>
  z.string().refine((s) => {
    const p = rupeesToPaise(s);
    return p !== null && !p.startsWith('-');
  }, msg);

const addItemSchema = z.object({
  name: z.string().min(1, 'feed.errName'),
  unit: z.string(),
  threshold: z
    .string()
    .refine((s) => s === '' || (Number.isFinite(Number(s)) && Number(s) >= 0), 'feed.errThreshold'),
});
type AddItemValues = z.infer<typeof addItemSchema>;

/** Sentinel option value that switches the vendor picker into quick-add mode. */
const NEW_VENDOR = '__new__';

const purchaseSchema = z
  .object({
    feedItemId: z.string().min(1, 'feed.errItem'),
    qty: qtyString,
    price: paiseString('feed.errPrice'),
    /** '' (none) | vendor id | NEW_VENDOR (quick-add name below). */
    vendorId: z.string(),
    newVendorName: z.string().trim().max(160, 'feed.errVendorName'),
    occurredAt: z.string(),
  })
  .superRefine((v, ctx) => {
    if (v.vendorId === NEW_VENDOR && v.newVendorName.trim() === '') {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['newVendorName'], message: 'feed.errVendorName' });
    }
  });
type PurchaseValues = z.infer<typeof purchaseSchema>;

const consumeSchema = z.object({
  feedItemId: z.string().min(1, 'feed.errItem'),
  batchId: z.string().min(1, 'feed.errBatch'),
  qty: qtyString,
  occurredAt: z.string(),
});
type ConsumeValues = z.infer<typeof consumeSchema>;

export function FeedPanel({ canWrite }: { farmId: string; canWrite: boolean }) {
  const { t } = useTranslation();
  const items = useFeedItems();
  const batches = useBatches();
  const activeBatches = useMemo(
    () => (batches.data ?? []).filter((b) => b.status === 'ACTIVE'),
    [batches.data],
  );
  const [dialog, setDialog] = useState<null | 'add' | 'buy' | 'consume'>(null);

  const columns: DataTableColumn<FeedItem>[] = [
    {
      header: 'feed.colName',
      accessor: 'name',
      cell: (i) => <span className="font-medium text-foreground">{i.name}</span>,
    },
    {
      header: 'feed.colStock',
      accessor: (i) => Number(i.stockQty),
      align: 'right',
      cell: (i) => `${i.stockQty} ${i.unit}`,
    },
    {
      header: 'feed.colReorder',
      accessor: (i) => (i.reorderThreshold === null ? -1 : Number(i.reorderThreshold)),
      align: 'right',
      cell: (i) => (i.reorderThreshold === null ? '—' : `${i.reorderThreshold} ${i.unit}`),
    },
    {
      header: 'feed.colLastPrice',
      accessor: (i) => i.lastUnitPricePaise ?? '',
      align: 'right',
      cell: (i) => (i.lastUnitPricePaise === null ? '—' : `${fmtInr(i.lastUnitPricePaise)}/${i.unit}`),
    },
    {
      header: 'feed.colStatus',
      id: 'status',
      cell: (i) => (isLow(i) ? <Badge variant="warning">{t('feed.low')}</Badge> : null),
    },
  ];

  return (
    <section className="space-y-3">
      <PanelHeading
        action={
          canWrite ? (
            <div className="flex flex-wrap justify-end gap-2">
              <Button size="sm" variant="secondary" onClick={() => setDialog('add')}>
                {t('feed.addItem')}
              </Button>
              <Button
                size="sm"
                onClick={() => setDialog('buy')}
                disabled={(items.data?.length ?? 0) === 0}
              >
                <ShoppingCart aria-hidden /> {t('feed.buy')}
              </Button>
              <Button
                size="sm"
                variant="accent"
                onClick={() => setDialog('consume')}
                disabled={(items.data?.length ?? 0) === 0 || activeBatches.length === 0}
              >
                <Soup aria-hidden /> {t('feed.consume')}
              </Button>
            </div>
          ) : undefined
        }
      >
        {t('feed.title')}
      </PanelHeading>

      <Tabs defaultValue="inventory">
        <TabsList>
          <TabsTrigger value="inventory">{t('feed.tabInventory')}</TabsTrigger>
          <TabsTrigger value="fcr">{t('feed.tabFcr')}</TabsTrigger>
        </TabsList>

        <TabsContent value="inventory">
          {items.isError ? (
            <div className="space-y-2">
              <PanelError>{t('feed.error')}</PanelError>
              <Button size="sm" variant="secondary" onClick={() => void items.refetch()}>
                {t('feed.retry')}
              </Button>
            </div>
          ) : (
            <DataTable
              columns={columns}
              data={items.data}
              isLoading={items.isLoading}
              searchable
              searchPlaceholderKey="feed.search"
              pageSize={10}
              getRowId={(i) => i.id}
              emptyState={
                <EmptyState
                  icon={Package}
                  title={t('feed.empty')}
                  description={t('feed.emptyDesc')}
                  action={
                    canWrite ? (
                      <Button size="sm" onClick={() => setDialog('add')}>
                        {t('feed.addItem')}
                      </Button>
                    ) : undefined
                  }
                />
              }
            />
          )}
        </TabsContent>

        <TabsContent value="fcr">
          <FcrCard batches={activeBatches} />
        </TabsContent>
      </Tabs>

      <AddItemDialog open={dialog === 'add'} onOpenChange={(o) => setDialog(o ? 'add' : null)} />
      {/* Purchase and consumption are fully separate forms — each owns its own
          feed-item selection (fixes the legacy shared-buyId state bug). */}
      <PurchaseDialog
        open={dialog === 'buy'}
        onOpenChange={(o) => setDialog(o ? 'buy' : null)}
        items={items.data ?? []}
      />
      <ConsumeDialog
        open={dialog === 'consume'}
        onOpenChange={(o) => setDialog(o ? 'consume' : null)}
        items={items.data ?? []}
        batches={activeBatches}
      />
    </section>
  );
}

/** Headline Phase-4 metric, promoted out of the old form corner into stat tiles. */
function FcrCard({ batches }: { batches: Batch[] }) {
  const { t } = useTranslation();
  const [picked, setPicked] = useState('');
  const batchId = picked || batches[0]?.id || '';
  const fcr = useFcr(batchId || undefined);

  if (batches.length === 0) return <PanelNote>{t('feed.fcrEmpty')}</PanelNote>;

  return (
    <div className="space-y-3">
      <div className="max-w-sm">
        <Field label={t('feed.fcrBatch')}>
          <Select value={batchId} onChange={(e) => setPicked(e.target.value)}>
            {batches.map((b) => (
              <option key={b.id} value={b.id}>
                {batchLabel(b)}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      {fcr.isLoading && <CardSkeleton />}
      {fcr.isError && (
        <div className="space-y-2">
          <PanelError>{t('feed.fcrError')}</PanelError>
          <Button size="sm" variant="secondary" onClick={() => void fcr.refetch()}>
            {t('feed.retry')}
          </Button>
        </div>
      )}
      {fcr.data && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatTile label={t('feed.fcrFeed')} value={`${fcr.data.feedConsumedKg} ${t('feed.kg')}`} />
            <StatTile label={t('feed.fcrGain')} value={`${fcr.data.weightGainKg} ${t('feed.kg')}`} />
            <StatTile label={t('feed.fcrCost')} value={fmtInr(fcr.data.feedCostPaise)} />
            <StatTile label={t('feed.fcrRatio')} value={fcr.data.fcr === null ? '—' : String(fcr.data.fcr)} />
          </div>
          {fcr.data.fcr === null && <PanelNote>{t('feed.fcrHint')}</PanelNote>}
        </>
      )}
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-4">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-2 font-display text-2xl font-semibold tabular text-foreground">{value}</p>
    </Card>
  );
}

function AddItemDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{t('feed.addItemTitle')}</DialogTitle>
        </DialogHeader>
        <AddItemForm onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

function AddItemForm({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation();
  const createItem = useCreateFeedItem();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<AddItemValues>({
    resolver: zodResolver(addItemSchema),
    defaultValues: { name: '', unit: '', threshold: '' },
  });
  const err = (m?: string) => (m ? t(m) : undefined);

  const onSubmit = handleSubmit((v) => {
    createItem.mutate(
      {
        name: v.name,
        unit: v.unit.trim() || undefined,
        reorderThreshold: v.threshold === '' ? undefined : Number(v.threshold),
      },
      { onSuccess: onDone },
    );
  });

  return (
    <form onSubmit={(e) => void onSubmit(e)} className="space-y-3">
      <Field label={t('feed.name')} required error={err(errors.name?.message)}>
        <Input {...register('name')} placeholder={t('feed.namePlaceholder')} />
      </Field>
      <Field label={t('feed.unit')} hint={t('feed.unitHint')}>
        <Input {...register('unit')} />
      </Field>
      <Field label={t('feed.reorder')} hint={t('feed.reorderHint')} error={err(errors.threshold?.message)}>
        <Input type="number" min={0} step="0.01" inputMode="decimal" {...register('threshold')} />
      </Field>
      <DialogFooter>
        <Button type="button" variant="secondary" onClick={onDone}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" loading={createItem.isPending}>
          {t('feed.addItem')}
        </Button>
      </DialogFooter>
    </form>
  );
}

function PurchaseDialog({
  open,
  onOpenChange,
  items,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  items: FeedItem[];
}) {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{t('feed.buyTitle')}</DialogTitle>
        </DialogHeader>
        <PurchaseForm items={items} onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

function PurchaseForm({ items, onDone }: { items: FeedItem[]; onDone: () => void }) {
  const { t } = useTranslation();
  const purchase = usePurchaseFeed();
  const vendors = useVendors();
  const createVendor = useCreateVendor();
  const {
    register,
    control,
    watch,
    handleSubmit,
    formState: { errors },
  } = useForm<PurchaseValues>({
    resolver: zodResolver(purchaseSchema),
    defaultValues: {
      feedItemId: items[0]?.id ?? '',
      qty: '',
      price: '',
      vendorId: '',
      newVendorName: '',
      occurredAt: '',
    },
  });
  const err = (m?: string) => (m ? t(m) : undefined);
  const vendorChoice = watch('vendorId');

  const onSubmit = handleSubmit(async (v) => {
    // Quick-add path: create the vendor first, then purchase against its id.
    let vendorId = v.vendorId && v.vendorId !== NEW_VENDOR ? v.vendorId : undefined;
    if (v.vendorId === NEW_VENDOR) {
      try {
        const created = await createVendor.mutateAsync({ name: v.newVendorName.trim() });
        vendorId = created.vendor.id;
      } catch {
        return; // toast already shown by useApiMutation; keep the dialog open
      }
    }
    purchase.mutate(
      {
        feedItemId: v.feedItemId,
        qty: Number(v.qty),
        unitPricePaise: rupeesToPaise(v.price)!, // integer-paise string passthrough
        vendorId, // dormant API field surfaced (11.6c deferred item)
        occurredAt: v.occurredAt ? dayISO(v.occurredAt) : undefined,
      },
      { onSuccess: onDone },
    );
  });

  return (
    <form onSubmit={(e) => void onSubmit(e)} className="space-y-3">
      <Field label={t('feed.item')} required error={err(errors.feedItemId?.message)}>
        <Select {...register('feedItemId')}>
          {items.map((i) => (
            <option key={i.id} value={i.id}>
              {i.name}
            </option>
          ))}
        </Select>
      </Field>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label={t('feed.qty')} required error={err(errors.qty?.message)}>
          <Input type="number" min={0.01} step="0.01" inputMode="decimal" {...register('qty')} />
        </Field>
        <Controller
          name="price"
          control={control}
          render={({ field }) => (
            <Field label={t('feed.unitPrice')} required error={err(errors.price?.message)}>
              <InrInput
                value={field.value}
                onChangePaise={(_, rupees) => field.onChange(rupees)}
                onBlur={field.onBlur}
              />
            </Field>
          )}
        />
      </div>
      <Field label={t('feed.vendor')} hint={t('feed.vendorHint')}>
        <Select {...register('vendorId')}>
          <option value="">{t('feed.vendorNone')}</option>
          {(vendors.data ?? []).map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
            </option>
          ))}
          <option value={NEW_VENDOR}>{t('feed.vendorNew')}</option>
        </Select>
      </Field>
      {vendorChoice === NEW_VENDOR && (
        <Field label={t('feed.vendorName')} required error={err(errors.newVendorName?.message)}>
          <Input {...register('newVendorName')} />
        </Field>
      )}
      {/* Dormant API field surfaced: purchases are backdatable via occurredAt. */}
      <Field label={t('feed.occurredAt')} hint={t('feed.occurredAtHint')}>
        <Input type="date" {...register('occurredAt')} />
      </Field>
      <DialogFooter>
        <Button type="button" variant="secondary" onClick={onDone}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" loading={purchase.isPending || createVendor.isPending}>
          {t('feed.buy')}
        </Button>
      </DialogFooter>
    </form>
  );
}

function ConsumeDialog({
  open,
  onOpenChange,
  items,
  batches,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  items: FeedItem[];
  batches: Batch[];
}) {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{t('feed.consumeTitle')}</DialogTitle>
        </DialogHeader>
        <ConsumeForm items={items} batches={batches} onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

function ConsumeForm({
  items,
  batches,
  onDone,
}: {
  items: FeedItem[];
  batches: Batch[];
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const consume = useConsumeFeed();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ConsumeValues>({
    resolver: zodResolver(consumeSchema),
    defaultValues: {
      feedItemId: items[0]?.id ?? '',
      batchId: batches[0]?.id ?? '',
      qty: '',
      occurredAt: '',
    },
  });
  const err = (m?: string) => (m ? t(m) : undefined);

  const onSubmit = handleSubmit((v) => {
    consume.mutate(
      {
        feedItemId: v.feedItemId,
        batchId: v.batchId,
        qty: Number(v.qty),
        occurredAt: v.occurredAt ? dayISO(v.occurredAt) : undefined,
      },
      { onSuccess: onDone },
    );
  });

  return (
    <form onSubmit={(e) => void onSubmit(e)} className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label={t('feed.item')} required error={err(errors.feedItemId?.message)}>
          <Select {...register('feedItemId')}>
            {items.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name} · {i.stockQty} {i.unit}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t('feed.batch')} required error={err(errors.batchId?.message)}>
          <Select {...register('batchId')}>
            {batches.map((b) => (
              <option key={b.id} value={b.id}>
                {batchLabel(b)}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label={t('feed.qty')} required error={err(errors.qty?.message)}>
          <Input type="number" min={0.01} step="0.01" inputMode="decimal" {...register('qty')} />
        </Field>
        <Field label={t('feed.consumedAt')} hint={t('feed.occurredAtHint')}>
          <Input type="date" {...register('occurredAt')} />
        </Field>
      </div>
      <DialogFooter>
        <Button type="button" variant="secondary" onClick={onDone}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" loading={consume.isPending}>
          {t('feed.consume')}
        </Button>
      </DialogFooter>
    </form>
  );
}
