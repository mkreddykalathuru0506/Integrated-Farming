import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/AuthContext';
import { Button, Input, Select } from '../ui';
import { createLog, listBatches, listLogs, type Batch, type DailyLog } from './api';

type Load = { status: 'loading' } | { status: 'error' } | { status: 'ready'; logs: DailyLog[] };
const LOG_TYPES = ['FEED', 'EGGS', 'WEIGHT'] as const;
const UNIT_FOR: Record<string, string> = { FEED: 'kg', EGGS: 'units', WEIGHT: 'kg' };

/** A client id for idempotent logging (offline-sync key). Works without a secure context. */
function genId(): string {
  try {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  } catch {
    /* fall through */
  }
  return `log-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function DailyLogPanel({ farmId }: { farmId: string }) {
  const { t } = useTranslation();
  const { accessToken } = useAuth();
  const [load, setLoad] = useState<Load>({ status: 'loading' });
  const [batches, setBatches] = useState<Batch[]>([]);
  const [type, setType] = useState<string>('FEED');
  const [batchId, setBatchId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    if (!accessToken) return;
    setLoad({ status: 'loading' });
    listLogs(accessToken, farmId)
      .then((r) => setLoad({ status: 'ready', logs: r.logs }))
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

  async function onLog(e: FormEvent) {
    e.preventDefault();
    if (!accessToken || !batchId) return;
    setFormError(null);
    try {
      await createLog(accessToken, farmId, {
        type,
        batchId,
        quantity: Number(quantity),
        unit: UNIT_FOR[type] ?? 'units',
        clientLogId: genId(),
      });
      setQuantity('');
      refresh();
    } catch {
      setFormError(t('logs.addError'));
    }
  }

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">{t('logs.title')}</h2>

      {batches.length > 0 && (
        <form onSubmit={onLog} className="space-y-2 rounded-lg bg-slate-50 p-3">
          <div className="flex gap-2">
            <Select value={type} onChange={(e) => setType(e.target.value)} className="flex-1">
              {LOG_TYPES.map((lt) => (
                <option key={lt} value={lt}>
                  {t(`logs.type.${lt}`)}
                </option>
              ))}
            </Select>
            <Select value={batchId} onChange={(e) => setBatchId(e.target.value)} className="flex-1">
              {batches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.code}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={1}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder={`${t('logs.quantity')} (${UNIT_FOR[type]})`}
              required
              className="flex-1"
            />
            <Button type="submit">{t('logs.log')}</Button>
          </div>
          {formError && (
            <p role="alert" className="text-sm text-red-600">
              {formError}
            </p>
          )}
        </form>
      )}

      {load.status === 'loading' && <p className="text-sm text-slate-500">{t('logs.loading')}</p>}
      {load.status === 'error' && (
        <p role="alert" className="text-sm text-red-600">
          {t('logs.error')}
        </p>
      )}
      {load.status === 'ready' && load.logs.length === 0 && (
        <p className="text-sm text-slate-500">{t('logs.empty')}</p>
      )}
      {load.status === 'ready' && load.logs.length > 0 && (
        <ul className="space-y-1 text-sm">
          {load.logs.slice(0, 8).map((l) => (
            <li key={l.id} className="flex justify-between rounded-lg border border-slate-200 px-3 py-1.5">
              <span className="text-slate-700">{t(`logs.type.${l.type}`)}</span>
              <span className="text-slate-500">
                {l.quantity} {l.unit}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
