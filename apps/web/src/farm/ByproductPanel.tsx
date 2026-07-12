import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Recycle } from 'lucide-react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { useBatches, useUnits } from '../api/hooks';
import { useByproducts, useCreateByproduct } from '../api/ops.hooks';
import { fmtDate, fmtInr, rupeesToPaise } from '../lib/format';
import { rupeeField } from '../lib/moneyField';
import {
  Badge,
  Button,
  DataTable,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  Field,
  InrInput,
  Input,
  PanelError,
  PanelHeading,
  Select,
  type DataTableColumn,
} from '../ui';
import { SpaLink } from './SpaLink';
import type { ByproductTransfer } from './api';

const BYPRODUCT_TYPES = [
  'LITTER',
  'MANURE',
  'COMPOST',
  'SLURRY',
  'EGGSHELL',
  'SLAUGHTER_WASTE',
  'CROP_RESIDUE',
  'OTHER',
] as const;

/* ---------- record-transfer dialog ---------- */

const transferSchema = z.object({
  byproductType: z.string(),
  fromUnitId: z.string(),
  toUnitId: z.string(),
  sourceBatchId: z.string(),
  quantity: z.string().refine((v) => Number(v) > 0, 'byproducts.invalidQty'),
  unit: z.string().trim().min(1, 'byproducts.unitRequired'),
  credit: rupeeField('byproducts.invalidCredit', true),
});
type TransferValues = z.infer<typeof transferSchema>;

function RecordTransferDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { t } = useTranslation();
  const units = useUnits();
  const batches = useBatches();
  const createTransfer = useCreateByproduct();
  const form = useForm<TransferValues>({
    resolver: zodResolver(transferSchema),
    defaultValues: {
      byproductType: 'LITTER',
      fromUnitId: '',
      toUnitId: '',
      sourceBatchId: '',
      quantity: '',
      unit: 'kg',
      credit: '',
    },
  });
  const err = (m?: string) => (m ? t(m) : undefined);

  const onSubmit = form.handleSubmit((v) => {
    createTransfer.mutate(
      {
        byproductType: v.byproductType,
        fromUnitId: v.fromUnitId || undefined,
        toUnitId: v.toUnitId || undefined,
        // dormant API field now exposed: tie the transfer back to its source batch
        sourceBatchId: v.sourceBatchId || undefined,
        quantity: Number(v.quantity),
        unit: v.unit.trim(),
        creditPaise: v.credit.trim() ? rupeesToPaise(v.credit)! : undefined,
      },
      {
        onSuccess: () => {
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
          <DialogTitle>{t('byproducts.record')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={(e) => void onSubmit(e)} className="space-y-3" noValidate>
          <Field label={t('byproducts.typeLabel')}>
            <Select {...form.register('byproductType')}>
              {BYPRODUCT_TYPES.map((bt) => (
                <option key={bt} value={bt}>
                  {t(`byproducts.type.${bt}`)}
                </option>
              ))}
            </Select>
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t('byproducts.fromUnit')}>
              <Select {...form.register('fromUnitId')}>
                <option value="">{t('byproducts.fromAny')}</option>
                {(units.data ?? []).map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t('byproducts.toUnit')}>
              <Select {...form.register('toUnitId')}>
                <option value="">{t('byproducts.toAny')}</option>
                {(units.data ?? []).map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label={t('byproducts.sourceBatch')}>
            <Select {...form.register('sourceBatchId')}>
              <option value="">{t('byproducts.sourceNone')}</option>
              {(batches.data ?? []).map((b) => (
                <option key={b.id} value={b.id}>
                  {b.code}
                  {b.name ? ` · ${b.name}` : ''}
                </option>
              ))}
            </Select>
          </Field>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label={t('byproducts.qty')} required error={err(form.formState.errors.quantity?.message)}>
              <Input type="number" min={0.01} step="0.01" inputMode="decimal" {...form.register('quantity')} />
            </Field>
            <Field label={t('byproducts.unit')} required error={err(form.formState.errors.unit?.message)}>
              <Input {...form.register('unit')} />
            </Field>
            <Controller
              control={form.control}
              name="credit"
              render={({ field }) => (
                <Field label={t('byproducts.credit')} error={err(form.formState.errors.credit?.message)}>
                  <InrInput value={field.value} onChangePaise={(_p, rupees) => field.onChange(rupees)} />
                </Field>
              )}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" loading={createTransfer.isPending}>
              {t('byproducts.transfer')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- panel ---------- */

export function ByproductPanel({ canWrite }: { farmId: string; canWrite: boolean }) {
  const { t } = useTranslation();
  const transfers = useByproducts();
  const units = useUnits();
  const batches = useBatches();
  const [recordOpen, setRecordOpen] = useState(false);

  const unitName = (id: string | null) =>
    id ? (units.data?.find((u) => u.id === id)?.name ?? '—') : '—';
  const batchCode = (id: string | null) =>
    id ? (batches.data?.find((b) => b.id === id)?.code ?? '—') : '—';

  const columns: DataTableColumn<ByproductTransfer>[] = [
    {
      header: 'byproducts.colDate',
      accessor: 'transferredAt',
      cell: (tr) => fmtDate(tr.transferredAt),
    },
    {
      header: 'byproducts.colType',
      accessor: (tr) => t(`byproducts.type.${tr.byproductType}`),
      cell: (tr) => <Badge variant="success">{t(`byproducts.type.${tr.byproductType}`)}</Badge>,
    },
    {
      header: 'byproducts.colRoute',
      accessor: (tr) => `${unitName(tr.fromUnitId)} → ${unitName(tr.toUnitId)}`,
    },
    {
      header: 'byproducts.colBatch',
      accessor: (tr) => batchCode(tr.sourceBatchId),
    },
    {
      header: 'byproducts.colQty',
      align: 'right',
      accessor: (tr) => Number(tr.quantity),
      cell: (tr) => `${tr.quantity} ${tr.unit}`,
    },
    {
      header: 'byproducts.colCredit',
      align: 'right',
      accessor: (tr) => Number(tr.creditPaise),
      cell: (tr) =>
        Number(tr.creditPaise) > 0 ? (
          <span className="text-success">{fmtInr(tr.creditPaise)}</span>
        ) : (
          '—'
        ),
    },
  ];

  return (
    <section className="space-y-3">
      <PanelHeading
        action={
          canWrite && (
            <Button type="button" size="sm" onClick={() => setRecordOpen(true)}>
              <Plus aria-hidden />
              {t('byproducts.record')}
            </Button>
          )
        }
      >
        {t('byproducts.title')}
      </PanelHeading>

      {transfers.isError ? (
        <div className="space-y-2">
          <PanelError>{t('byproducts.error')}</PanelError>
          <Button type="button" variant="secondary" size="sm" onClick={() => void transfers.refetch()}>
            {t('byproducts.retry')}
          </Button>
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={transfers.data}
          isLoading={transfers.isPending}
          searchable
          pageSize={10}
          getRowId={(tr) => tr.id}
          emptyState={
            <EmptyState
              icon={Recycle}
              title={t('byproducts.empty')}
              description={t('byproducts.emptyDesc')}
              action={
                canWrite && (
                  <Button type="button" onClick={() => setRecordOpen(true)}>
                    <Plus aria-hidden />
                    {t('byproducts.record')}
                  </Button>
                )
              }
            />
          }
        />
      )}

      <p className="text-sm">
        <SpaLink href="/maintenance/circularity">{t('byproducts.seeCircularity')} →</SpaLink>
      </p>

      <RecordTransferDialog open={recordOpen} onOpenChange={setRecordOpen} />
    </section>
  );
}
