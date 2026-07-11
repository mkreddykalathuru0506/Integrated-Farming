import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/AuthContext';
import { isApiError } from '../lib/http';
import { Button, Input, PanelError, PanelHeading, PanelNote, Select } from '../ui';
import {
  advanceBatch,
  closeBatch,
  createBatch,
  listBatches,
  listSpecies,
  listUnits,
  recordMortality,
  recordMovement,
  type Batch,
  type SpeciesSummary,
  type Unit,
} from './api';

type Load = { status: 'loading' } | { status: 'error' } | { status: 'ready'; batches: Batch[] };

export function BatchesPanel({ farmId, canWrite }: { farmId: string; canWrite: boolean }) {
  const { t } = useTranslation();
  const { accessToken } = useAuth();
  const [load, setLoad] = useState<Load>({ status: 'loading' });
  const [batchSpecies, setBatchSpecies] = useState<SpeciesSummary[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [speciesId, setSpeciesId] = useState('');
  const [code, setCode] = useState('');
  const [count, setCount] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [loss, setLoss] = useState<Record<string, string>>({});
  const [moveTo, setMoveTo] = useState<Record<string, string>>({});

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
        const b = r.species.filter((s) => s.trackingMode === 'BATCH');
        setBatchSpecies(b);
        setSpeciesId((prev) => prev || b[0]?.id || '');
      })
      .catch(() => undefined);
    listUnits(accessToken, farmId)
      .then((r) => setUnits(r.units))
      .catch(() => undefined);
  }, [accessToken, farmId]);

  const act = (p: Promise<unknown>) => void p.then(refresh).catch(() => undefined);

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
        isApiError(err) && err.code === 'BATCH_CODE_TAKEN' ? t('batches.duplicate') : t('batches.addError'),
      );
    }
  }

  return (
    <section className="space-y-3">
      <PanelHeading>{t('batches.title')}</PanelHeading>

      {load.status === 'loading' && <PanelNote>{t('batches.loading')}</PanelNote>}
      {load.status === 'error' && <PanelError>{t('batches.error')}</PanelError>}
      {load.status === 'ready' && load.batches.length === 0 && <PanelNote>{t('batches.empty')}</PanelNote>}
      {load.status === 'ready' && load.batches.length > 0 && (
        <ul className="space-y-2">
          {load.batches.map((b) => (
            <li key={b.id} className="space-y-2 rounded-xl border border-border bg-card px-3 py-2">
              <div className="flex items-center justify-between">
                <span className="font-medium text-foreground">
                  {b.code} <span className="text-xs text-muted-foreground">· {b.species.name}</span>
                </span>
                <span className="text-xs text-muted-foreground tabular">
                  {b.currentCount}/{b.initialCount} · {b.currentStage?.name ?? '—'} · {t(`batches.status.${b.status}`)}
                </span>
              </div>

              {canWrite && b.status === 'ACTIVE' && accessToken && (
                <div className="space-y-2 border-t border-border pt-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Input
                      type="number"
                      min={1}
                      value={loss[b.id] ?? '1'}
                      onChange={(e) => setLoss({ ...loss, [b.id]: e.target.value })}
                      className="w-20"
                      aria-label={t('events.lossCount')}
                    />
                    <Button size="sm" variant="danger" onClick={() => act(recordMortality(accessToken, farmId, { batchId: b.id, type: 'MORTALITY', count: Number(loss[b.id] ?? '1') }))}>
                      {t('events.mortality')}
                    </Button>
                    <Button size="sm" variant="danger" onClick={() => act(recordMortality(accessToken, farmId, { batchId: b.id, type: 'CULL', count: Number(loss[b.id] ?? '1') }))}>
                      {t('events.cull')}
                    </Button>
                  </div>
                  <div className="flex items-center gap-2">
                    <Select value={moveTo[b.id] ?? ''} onChange={(e) => setMoveTo({ ...moveTo, [b.id]: e.target.value })} className="flex-1">
                      <option value="">{t('events.moveTo')}</option>
                      {units.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name}
                        </option>
                      ))}
                    </Select>
                    <Button size="sm" variant="secondary" disabled={!moveTo[b.id]} onClick={() => act(recordMovement(accessToken, farmId, { batchId: b.id, toUnitId: moveTo[b.id]! }))}>
                      {t('events.move')}
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => act(advanceBatch(accessToken, farmId, b.id))}>
                      {t('batches.advance')}
                    </Button>
                    <Button size="sm" variant="danger" onClick={() => act(closeBatch(accessToken, farmId, b.id))}>
                      {t('batches.close')}
                    </Button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {canWrite && batchSpecies.length > 0 && (
        <form onSubmit={onAdd} className="space-y-2 rounded-xl bg-secondary/60 p-3">
          <Select value={speciesId} onChange={(e) => setSpeciesId(e.target.value)}>
            {batchSpecies.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
          <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder={t('batches.code')} required />
          <Input value={count} onChange={(e) => setCount(e.target.value)} type="number" min={1} placeholder={t('batches.count')} required />
          {formError && <PanelError>{formError}</PanelError>}
          <Button type="submit" full>
            {t('batches.add')}
          </Button>
        </form>
      )}
    </section>
  );
}
