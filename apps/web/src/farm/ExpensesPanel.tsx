import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { formatPaise, rupeesToPaise } from '@ifm/shared';
import { useAuth } from '../auth/AuthContext';
import { Button, DataRow, Input, PanelError, PanelHeading, PanelNote, Select, SubPanel } from '../ui';
import {
  createExpense,
  getBatchCost,
  listBatches,
  listExpenses,
  type BatchCost,
  type Batch,
  type Expense,
} from './api';

const CATEGORIES = ['FEED', 'LABOUR', 'MEDICINE', 'UTILITIES', 'MAINTENANCE', 'CAPITAL', 'OTHER'] as const;
type Load = { status: 'loading' } | { status: 'error' } | { status: 'ready'; expenses: Expense[] };

export function ExpensesPanel({ farmId, canWrite }: { farmId: string; canWrite: boolean }) {
  const { t } = useTranslation();
  const { accessToken } = useAuth();
  const [load, setLoad] = useState<Load>({ status: 'loading' });
  const [batches, setBatches] = useState<Batch[]>([]);
  const [category, setCategory] = useState<string>('MEDICINE');
  const [amount, setAmount] = useState('');
  const [batchId, setBatchId] = useState('');
  const [cost, setCost] = useState<BatchCost | null>(null);

  const refresh = useCallback(() => {
    if (!accessToken) return;
    setLoad({ status: 'loading' });
    listExpenses(accessToken, farmId)
      .then((r) => setLoad({ status: 'ready', expenses: r.expenses }))
      .catch(() => setLoad({ status: 'error' }));
  }, [accessToken, farmId]);

  useEffect(refresh, [refresh]);

  useEffect(() => {
    if (!accessToken) return;
    listBatches(accessToken, farmId)
      .then((r) => {
        const active = r.batches.filter((b) => b.status === 'ACTIVE');
        setBatches(active);
        setBatchId((prev) => prev || active[0]?.id || '');
      })
      .catch(() => undefined);
  }, [accessToken, farmId]);

  const loadCost = useCallback(() => {
    if (!accessToken || !batchId) return;
    getBatchCost(accessToken, farmId, batchId)
      .then(setCost)
      .catch(() => setCost(null));
  }, [accessToken, farmId, batchId]);

  useEffect(loadCost, [loadCost]);

  async function onAdd(e: FormEvent) {
    e.preventDefault();
    if (!accessToken) return;
    await createExpense(accessToken, farmId, {
      category,
      amountPaise: String(rupeesToPaise(Number(amount))),
      batchId: batchId || undefined,
    })
      .then(() => {
        setAmount('');
        refresh();
        loadCost();
      })
      .catch(() => undefined);
  }

  return (
    <section className="space-y-3">
      <PanelHeading>{t('expenses.title')}</PanelHeading>

      {cost && (
        <SubPanel className="text-sm">
          <p className="font-medium text-foreground">{t('expenses.batchCost')}</p>
          <p className="text-muted-foreground tabular">
            {t('expenses.total')}: {formatPaise(Number(cost.totalPaise))} · {t('expenses.perBird')}:{' '}
            {formatPaise(Number(cost.costPerBirdPaise))}
          </p>
        </SubPanel>
      )}

      {load.status === 'loading' && <PanelNote>{t('expenses.loading')}</PanelNote>}
      {load.status === 'error' && <PanelError>{t('expenses.error')}</PanelError>}
      {load.status === 'ready' && load.expenses.length === 0 && <PanelNote>{t('expenses.empty')}</PanelNote>}
      {load.status === 'ready' && load.expenses.length > 0 && (
        <ul className="space-y-1.5 text-sm">
          {load.expenses.slice(0, 8).map((e) => (
            <DataRow key={e.id} className="py-1.5">
              <span className="text-foreground">{t(`expenses.category.${e.category}`)}</span>
              <span className="text-muted-foreground tabular">{formatPaise(Number(e.amountPaise))}</span>
            </DataRow>
          ))}
        </ul>
      )}

      {canWrite && (
        <form onSubmit={onAdd} className="space-y-2 rounded-xl bg-secondary/60 p-3">
          <div className="flex gap-2">
            <Select value={category} onChange={(e) => setCategory(e.target.value)} className="flex-1">
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {t(`expenses.category.${c}`)}
                </option>
              ))}
            </Select>
            <Input type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={t('expenses.amount')} required className="flex-1" />
          </div>
          {batches.length > 0 && (
            <Select value={batchId} onChange={(e) => setBatchId(e.target.value)}>
              <option value="">{t('expenses.noBatch')}</option>
              {batches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.code}
                </option>
              ))}
            </Select>
          )}
          <Button type="submit" full>
            {t('expenses.add')}
          </Button>
        </form>
      )}
    </section>
  );
}
