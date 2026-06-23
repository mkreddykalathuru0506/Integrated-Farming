import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/AuthContext';
import { Button, Input, Select } from '../ui';
import {
  advanceBatch,
  closeBatch,
  createBatch,
  listBatches,
  listSpecies,
  type Batch,
  type SpeciesSummary,
} from './api';

type Load = { status: 'loading' } | { status: 'error' } | { status: 'ready'; batches: Batch[] };

export function BatchesPanel({ farmId, canWrite }: { farmId: string; canWrite: boolean }) {
  const { t } = useTranslation();
  const { accessToken } = useAuth();
  const [load, setLoad] = useState<Load>({ status: 'loading' });
  const [batchSpecies, setBatchSpecies] = useState<SpeciesSummary[]>([]);
  const [speciesId, setSpeciesId] = useState('');
  const [code, setCode] = useState('');
  const [count, setCount] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    if (!accessToken) return;
    setLoad({ status: 'loading' });
    listBatches(accessToken, farmId)
      .then((r) => setLoad({ status: 'ready', batches: r.batches }))
      .catch(() => setLoad({ status: 'error' }));
  }, [accessToken, farmId]);

  useEffect(refresh, [refresh]);

  useEffect(() => {
    if (!accessToken) return;
    listSpecies(accessToken, farmId)
      .then((r) => {
        const batch = r.species.filter((s) => s.trackingMode === 'BATCH');
        setBatchSpecies(batch);
        setSpeciesId((prev) => prev || batch[0]?.id || '');
      })
      .catch(() => undefined);
  }, [accessToken, farmId]);

  async function onAdd(e: FormEvent) {
    e.preventDefault();
    if (!accessToken) return;
    setFormError(null);
    try {
      await createBatch(accessToken, farmId, { speciesId, code, initialCount: Number(count) });
      setCode('');
      setCount('');
      refresh();
    } catch (err) {
      setFormError(
        err instanceof Error && err.message === 'BATCH_CODE_TAKEN' ? t('batches.duplicate') : t('batches.addError'),
      );
    }
  }

  async function act(fn: Promise<unknown>) {
    await fn.then(refresh).catch(() => undefined);
  }

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">{t('batches.title')}</h2>

      {load.status === 'loading' && <p className="text-sm text-slate-500">{t('batches.loading')}</p>}
      {load.status === 'error' && (
        <p role="alert" className="text-sm text-red-600">
          {t('batches.error')}
        </p>
      )}
      {load.status === 'ready' && load.batches.length === 0 && (
        <p className="text-sm text-slate-500">{t('batches.empty')}</p>
      )}
      {load.status === 'ready' && load.batches.length > 0 && (
        <ul className="space-y-2">
          {load.batches.map((b) => (
            <li key={b.id} className="space-y-1 rounded-lg border border-slate-200 px-3 py-2">
              <div className="flex items-center justify-between">
                <span className="font-medium text-slate-800">
                  {b.code} <span className="text-xs text-slate-400">· {b.species.name}</span>
                </span>
                <span className="text-xs text-slate-500">
                  {b.currentCount}/{b.initialCount}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">
                  {t('batches.stage')}: {b.currentStage?.name ?? '—'} ·{' '}
                  {t(`batches.status.${b.status}`)}
                </span>
                {canWrite && b.status === 'ACTIVE' && (
                  <span className="flex gap-2">
                    <Button size="sm" variant="secondary" onClick={() => void act(advanceBatch(accessToken!, farmId, b.id))}>
                      {t('batches.advance')}
                    </Button>
                    <Button size="sm" variant="danger" onClick={() => void act(closeBatch(accessToken!, farmId, b.id))}>
                      {t('batches.close')}
                    </Button>
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {canWrite && batchSpecies.length > 0 && (
        <form onSubmit={onAdd} className="space-y-2 rounded-lg bg-slate-50 p-3">
          <Select value={speciesId} onChange={(e) => setSpeciesId(e.target.value)}>
            {batchSpecies.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
          <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder={t('batches.code')} required />
          <Input
            value={count}
            onChange={(e) => setCount(e.target.value)}
            type="number"
            min={1}
            placeholder={t('batches.count')}
            required
          />
          {formError && (
            <p role="alert" className="text-sm text-red-600">
              {formError}
            </p>
          )}
          <Button type="submit" full>
            {t('batches.add')}
          </Button>
        </form>
      )}
    </section>
  );
}
