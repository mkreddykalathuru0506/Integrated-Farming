import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/AuthContext';
import { Button, DataRow, Input, PanelError, PanelHeading, PanelNote, Select, SubPanel } from '../ui';
import {
  createProcessing,
  listBatches,
  listColdStorages,
  listLots,
  traceLot,
  type Batch,
  type ColdStorage,
  type LotTrace,
  type ProductLot,
} from './api';

export function ProcessingPanel({ farmId, canWrite }: { farmId: string; canWrite: boolean }) {
  const { t } = useTranslation();
  const { accessToken } = useAuth();
  const [lots, setLots] = useState<ProductLot[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [stores, setStores] = useState<ColdStorage[]>([]);
  const [trace, setTrace] = useState<LotTrace | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [batchId, setBatchId] = useState('');
  const [inputCount, setInputCount] = useState('');
  const [productName, setProductName] = useState('');
  const [state, setState] = useState<'FRESH' | 'FROZEN'>('FROZEN');
  const [qty, setQty] = useState('');
  const [coldStorageId, setColdStorageId] = useState('');

  const refresh = useCallback(() => {
    if (!accessToken) return;
    listLots(accessToken, farmId).then((r) => setLots(r.lots)).catch(() => undefined);
    listBatches(accessToken, farmId)
      .then((r) => {
        const active = r.batches.filter((b) => b.status === 'ACTIVE');
        setBatches(active);
        setBatchId((p) => p || active[0]?.id || '');
      })
      .catch(() => undefined);
    listColdStorages(accessToken, farmId).then((r) => setStores(r.stores)).catch(() => undefined);
  }, [accessToken, farmId]);

  useEffect(refresh, [refresh]);

  async function onProcess(e: FormEvent) {
    e.preventDefault();
    if (!accessToken || !batchId) return;
    setError(null);
    await createProcessing(accessToken, farmId, {
      sourceBatchId: batchId,
      inputCount: inputCount ? Number(inputCount) : undefined,
      lots: [{ productName, state, quantityKg: Number(qty), coldStorageId: coldStorageId || undefined }],
    })
      .then(() => {
        setProductName('');
        setQty('');
        setInputCount('');
        refresh();
      })
      .catch((err: Error) =>
        setError(err.message === 'WITHDRAWAL_ACTIVE' ? t('processing.withdrawalBlocked') : t('processing.error')),
      );
  }

  async function onTrace(id: string) {
    if (!accessToken) return;
    await traceLot(accessToken, farmId, id).then(setTrace).catch(() => undefined);
  }

  return (
    <section className="space-y-3">
      <PanelHeading>{t('processing.title')}</PanelHeading>

      {lots.length === 0 ? (
        <PanelNote>{t('processing.empty')}</PanelNote>
      ) : (
        <ul className="space-y-1 text-sm">
          {lots.slice(0, 8).map((l) => (
            <DataRow key={l.id} className="py-1.5">
              <span className="truncate text-foreground tabular">
                {l.productName} · {l.quantityKg}kg · {t(`cold.mode.${l.state}`)}
              </span>
              <button type="button" onClick={() => void onTrace(l.id)} className="shrink-0 text-xs font-semibold text-success hover:underline">
                {t('processing.trace')}
              </button>
            </DataRow>
          ))}
        </ul>
      )}

      {trace && (
        <SubPanel className="text-xs text-muted-foreground">
          <p className="font-medium text-foreground">{trace.lot.lotCode}</p>
          <p>
            {trace.lot.productName} ← {t('processing.fromBatch')}{' '}
            <span className="font-medium">{trace.sourceBatch?.code ?? '—'}</span>
            {trace.sourceBatch?.species ? ` (${trace.sourceBatch.species.name})` : ''}
          </p>
          {trace.coldStorage && <p>{t('processing.storedIn', { name: trace.coldStorage.name })}</p>}
        </SubPanel>
      )}

      {canWrite &&
        (batches.length > 0 ? (
          <form onSubmit={onProcess} className="space-y-2 rounded-xl bg-secondary/60 p-3">
            <p className="text-xs text-muted-foreground">{t('processing.run')}</p>
            <div className="flex gap-2">
              <Select value={batchId} onChange={(e) => setBatchId(e.target.value)} className="flex-1">
                {batches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.code} ({b.currentCount})
                  </option>
                ))}
              </Select>
              <Input
                type="number"
                min={1}
                value={inputCount}
                onChange={(e) => setInputCount(e.target.value)}
                placeholder={t('processing.inputCount')}
                className="w-28"
              />
            </div>
            <Input value={productName} onChange={(e) => setProductName(e.target.value)} placeholder={t('processing.product')} required />
            <div className="flex gap-2">
              <Input type="number" min={0.01} step="0.01" value={qty} onChange={(e) => setQty(e.target.value)} placeholder={t('processing.kg')} required className="flex-1" />
              <Select value={state} onChange={(e) => setState(e.target.value as 'FRESH' | 'FROZEN')} className="w-28">
                <option value="FROZEN">{t('cold.mode.FROZEN')}</option>
                <option value="FRESH">{t('cold.mode.FRESH')}</option>
              </Select>
            </div>
            <Select value={coldStorageId} onChange={(e) => setColdStorageId(e.target.value)}>
              <option value="">{t('processing.noStore')}</option>
              {stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
            {error && <PanelError className="text-xs">{error}</PanelError>}
            <Button type="submit" full>
              {t('processing.process')}
            </Button>
          </form>
        ) : (
          <p className="text-xs text-muted-foreground">{t('processing.noBatches')}</p>
        ))}
    </section>
  );
}
