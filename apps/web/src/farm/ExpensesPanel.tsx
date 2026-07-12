// 11.6 follow-up: edit/soft-delete once PR #60 merges (endpoints not on main yet).
import { useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { ReceiptIndianRupee } from 'lucide-react';
import { useBatches } from '../api/hooks';
import { useBatchCost, useCreateExpense, useExpenses } from '../api/finance.hooks';
import { fmtDate, fmtInr, rupeesToPaise } from '../lib/format';
import { pathForSection } from '../components/router';
import { LoadMore } from './LoadMore';
import { SpaLink } from './SpaLink';
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
  Textarea,
  type DataTableColumn,
} from '../ui';
import type { Batch, Expense } from './api';

const CATEGORIES = ['FEED', 'LABOUR', 'MEDICINE', 'UTILITIES', 'MAINTENANCE', 'CAPITAL', 'OTHER'] as const;

const dayISO = (s: string) => `${s}T00:00:00.000Z`;
const batchLabel = (b: Batch) => `${b.code}${b.name ? ` — ${b.name}` : ''} (${b.currentCount})`;

const expenseSchema = z.object({
  category: z.string().min(1),
  amount: z.string().refine((s) => {
    const p = rupeesToPaise(s);
    return p !== null && !p.startsWith('-');
  }, 'expenses.errAmount'),
  batchId: z.string(),
  description: z.string(),
  occurredAt: z.string(),
});
type ExpenseValues = z.infer<typeof expenseSchema>;

export function ExpensesPanel({ canWrite }: { farmId: string; canWrite: boolean }) {
  const { t } = useTranslation();
  const [batchFilter, setBatchFilter] = useState(''); // server-side ?batchId filter
  const [catFilter, setCatFilter] = useState(''); // client-side category filter
  const [createOpen, setCreateOpen] = useState(false);

  const expenses = useExpenses(batchFilter || undefined);
  const batches = useBatches();
  const activeBatches = useMemo(
    () => (batches.data ?? []).filter((b) => b.status === 'ACTIVE'),
    [batches.data],
  );
  const batchById = useMemo(
    () => new Map((batches.data ?? []).map((b) => [b.id, b])),
    [batches.data],
  );

  const shown = useMemo(
    () => (catFilter ? (expenses.items ?? []).filter((e) => e.category === catFilter) : expenses.items),
    [expenses.items, catFilter],
  );

  const columns: DataTableColumn<Expense>[] = [
    {
      header: 'expenses.colDate',
      accessor: 'occurredAt',
      cell: (e) => fmtDate(e.occurredAt),
    },
    {
      header: 'expenses.colCategory',
      accessor: 'category',
      cell: (e) => <Badge variant="muted">{t(`expenses.category.${e.category}`)}</Badge>,
    },
    {
      header: 'expenses.colDescription',
      accessor: (e) => e.description ?? '',
      cell: (e) => e.description ?? '—',
    },
    {
      header: 'expenses.colBatch',
      accessor: (e) => (e.batchId ? batchById.get(e.batchId)?.code ?? e.batchId : ''),
      cell: (e) => {
        if (!e.batchId) return t('expenses.farmLevel');
        const code = batchById.get(e.batchId)?.code ?? e.batchId;
        return <SpaLink href={pathForSection('livestock', 'batches')}>{code}</SpaLink>;
      },
    },
    {
      header: 'expenses.colAmount',
      accessor: (e) => e.amountPaise,
      align: 'right',
      cell: (e) => fmtInr(e.amountPaise),
    },
  ];

  return (
    <section className="space-y-3">
      <PanelHeading
        action={
          canWrite ? (
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              {t('expenses.add')}
            </Button>
          ) : undefined
        }
      >
        {t('expenses.title')}
      </PanelHeading>

      <BatchCostCard batches={activeBatches} />

      <div className="flex flex-wrap gap-2">
        <Select
          value={catFilter}
          onChange={(e) => setCatFilter(e.target.value)}
          aria-label={t('expenses.filterCategory')}
          className="w-auto min-w-40"
        >
          <option value="">{t('expenses.allCategories')}</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {t(`expenses.category.${c}`)}
            </option>
          ))}
        </Select>
        <Select
          value={batchFilter}
          onChange={(e) => setBatchFilter(e.target.value)}
          aria-label={t('expenses.filterBatch')}
          className="w-auto min-w-40"
        >
          <option value="">{t('expenses.allBatches')}</option>
          {(batches.data ?? []).map((b) => (
            <option key={b.id} value={b.id}>
              {b.code}
            </option>
          ))}
        </Select>
      </div>

      {expenses.isError ? (
        <div className="space-y-2">
          <PanelError>{t('expenses.error')}</PanelError>
          <Button size="sm" variant="secondary" onClick={() => void expenses.refetch()}>
            {t('expenses.retry')}
          </Button>
        </div>
      ) : (
        <>
          <DataTable
            columns={columns}
            data={shown}
            isLoading={expenses.isPending}
            searchable
            searchPlaceholderKey="expenses.search"
            pageSize={10}
            getRowId={(e) => e.id}
            emptyState={
              <EmptyState
                icon={ReceiptIndianRupee}
                title={t('expenses.empty')}
                description={t('expenses.emptyDesc')}
                action={
                  canWrite ? (
                    <Button size="sm" onClick={() => setCreateOpen(true)}>
                      {t('expenses.add')}
                    </Button>
                  ) : undefined
                }
              />
            }
          />
          <LoadMore
            shown={expenses.items?.length ?? 0}
            total={expenses.total}
            loading={expenses.isFetchingNextPage}
            onLoadMore={() => void expenses.fetchNextPage()}
          />
        </>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>{t('expenses.addTitle')}</DialogTitle>
          </DialogHeader>
          <ExpenseForm batches={activeBatches} onDone={() => setCreateOpen(false)} />
        </DialogContent>
      </Dialog>
    </section>
  );
}

/** Batch cost rollup — per-category bars follow the Dashboard's token bar pattern. */
function BatchCostCard({ batches }: { batches: Batch[] }) {
  const { t } = useTranslation();
  const [picked, setPicked] = useState('');
  const batchId = picked || batches[0]?.id || '';
  const cost = useBatchCost(batchId || undefined);

  const bars = useMemo(() => {
    if (!cost.data) return [];
    return Object.entries(cost.data.byCategory)
      .map(([category, paise]) => ({ category, paise, value: Number(paise) / 100 })) // display-only scaling
      .filter((b) => b.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [cost.data]);
  const max = bars[0]?.value ?? 0;

  if (batches.length === 0) {
    return <PanelNote>{t('expenses.batchCostEmpty')}</PanelNote>;
  }

  return (
    <Card className="space-y-3 p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {t('expenses.batchCost')}
        </p>
        <div className="w-full max-w-60">
          <Field label={t('expenses.batchCostBatch')}>
            <Select value={batchId} onChange={(e) => setPicked(e.target.value)}>
              {batches.map((b) => (
                <option key={b.id} value={b.id}>
                  {batchLabel(b)}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </div>

      {cost.isLoading && <CardSkeleton />}
      {cost.isError && (
        <div className="space-y-2">
          <PanelError>{t('expenses.batchCostError')}</PanelError>
          <Button size="sm" variant="secondary" onClick={() => void cost.refetch()}>
            {t('expenses.retry')}
          </Button>
        </div>
      )}
      {cost.data && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div>
              <p className="text-xs text-muted-foreground">{t('expenses.total')}</p>
              <p className="font-display text-xl font-semibold tabular text-foreground">
                {fmtInr(cost.data.totalPaise)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t('expenses.perBird')}</p>
              <p className="font-display text-xl font-semibold tabular text-foreground">
                {fmtInr(cost.data.costPerBirdPaise)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t('expenses.currentCount')}</p>
              <p className="font-display text-xl font-semibold tabular text-foreground">
                {cost.data.currentCount}
              </p>
            </div>
          </div>

          {bars.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">{t('expenses.byCategory')}</p>
              {bars.map((b) => (
                <div key={b.category} className="flex items-center gap-3">
                  <span className="w-28 shrink-0 truncate text-sm font-medium text-foreground">
                    {t(`expenses.category.${b.category}`)}
                  </span>
                  <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-primary to-success motion-safe:transition-[width]"
                      style={{ width: `${Math.max(6, (b.value / max) * 100)}%` }}
                    />
                  </div>
                  <span className="w-24 shrink-0 text-right text-sm font-semibold tabular text-foreground">
                    {fmtInr(b.paise)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </Card>
  );
}

function ExpenseForm({ batches, onDone }: { batches: Batch[]; onDone: () => void }) {
  const { t } = useTranslation();
  const createExpense = useCreateExpense();
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<ExpenseValues>({
    resolver: zodResolver(expenseSchema),
    defaultValues: { category: 'FEED', amount: '', batchId: '', description: '', occurredAt: '' },
  });
  const err = (m?: string) => (m ? t(m) : undefined);

  const onSubmit = handleSubmit((v) => {
    createExpense.mutate(
      {
        category: v.category,
        amountPaise: rupeesToPaise(v.amount)!, // integer-paise string passthrough
        batchId: v.batchId || undefined,
        description: v.description.trim() || undefined,
        occurredAt: v.occurredAt ? dayISO(v.occurredAt) : undefined,
      },
      { onSuccess: onDone },
    );
  });

  return (
    <form onSubmit={(e) => void onSubmit(e)} className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label={t('expenses.categoryField')} required>
          <Select {...register('category')}>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {t(`expenses.category.${c}`)}
              </option>
            ))}
          </Select>
        </Field>
        <Controller
          name="amount"
          control={control}
          render={({ field }) => (
            <Field label={t('expenses.amount')} required error={err(errors.amount?.message)}>
              <InrInput
                value={field.value}
                onChangePaise={(_, rupees) => field.onChange(rupees)}
                onBlur={field.onBlur}
              />
            </Field>
          )}
        />
      </div>
      <Field label={t('expenses.batchField')}>
        <Select {...register('batchId')}>
          <option value="">{t('expenses.noBatch')}</option>
          {batches.map((b) => (
            <option key={b.id} value={b.id}>
              {batchLabel(b)}
            </option>
          ))}
        </Select>
      </Field>
      <Field label={t('expenses.descriptionField')}>
        <Textarea rows={2} {...register('description')} />
      </Field>
      {/* Dormant API field surfaced: expenses are backdatable via occurredAt. */}
      <Field label={t('expenses.occurredAt')} hint={t('expenses.occurredAtHint')}>
        <Input type="date" {...register('occurredAt')} />
      </Field>
      <DialogFooter>
        <Button type="button" variant="secondary" onClick={onDone}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" loading={createExpense.isPending}>
          {t('expenses.add')}
        </Button>
      </DialogFooter>
    </form>
  );
}
