import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { formatPaise, rupeesToPaise } from '@ifm/shared';
import { useAuth } from '../auth/AuthContext';
import { Badge, Button, DataRow, Input, PanelError, PanelHeading, PanelNote, Select } from '../ui';
import {
  consumeFeed,
  createFeedItem,
  getFcr,
  listBatches,
  listFeedItems,
  purchaseFeed,
  type Batch,
  type FeedItem,
  type Fcr,
} from './api';

type Load = { status: 'loading' } | { status: 'error' } | { status: 'ready'; items: FeedItem[] };
const isLow = (i: FeedItem) => i.reorderThreshold !== null && Number(i.stockQty) < Number(i.reorderThreshold);

export function FeedPanel({ farmId, canWrite }: { farmId: string; canWrite: boolean }) {
  const { t } = useTranslation();
  const { accessToken } = useAuth();
  const [load, setLoad] = useState<Load>({ status: 'loading' });
  const [name, setName] = useState('');
  const [threshold, setThreshold] = useState('');
  const [buyId, setBuyId] = useState('');
  const [qty, setQty] = useState('');
  const [price, setPrice] = useState('');
  const [batches, setBatches] = useState<Batch[]>([]);
  const [consBatch, setConsBatch] = useState('');
  const [consQty, setConsQty] = useState('');
  const [fcr, setFcr] = useState<Fcr | null>(null);
  const [consError, setConsError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    if (!accessToken) return;
    setLoad({ status: 'loading' });
    listFeedItems(accessToken, farmId)
      .then((r) => {
        setLoad({ status: 'ready', items: r.items });
        setBuyId((prev) => prev || r.items[0]?.id || '');
      })
      .catch(() => setLoad({ status: 'error' }));
  }, [accessToken, farmId]);

  useEffect(refresh, [refresh]);

  useEffect(() => {
    if (!accessToken) return;
    listBatches(accessToken, farmId)
      .then((r) => {
        const active = r.batches.filter((b) => b.status === 'ACTIVE');
        setBatches(active);
        setConsBatch((prev) => prev || active[0]?.id || '');
      })
      .catch(() => undefined);
  }, [accessToken, farmId]);

  useEffect(() => {
    if (!accessToken || !consBatch) return;
    getFcr(accessToken, farmId, consBatch)
      .then(setFcr)
      .catch(() => setFcr(null));
  }, [accessToken, farmId, consBatch]);

  async function onConsume(e: FormEvent) {
    e.preventDefault();
    if (!accessToken || !buyId || !consBatch) return;
    setConsError(null);
    try {
      await consumeFeed(accessToken, farmId, { feedItemId: buyId, batchId: consBatch, qty: Number(consQty) });
      setConsQty('');
      refresh();
      getFcr(accessToken, farmId, consBatch).then(setFcr).catch(() => undefined);
    } catch (err) {
      setConsError(err instanceof Error && err.message === 'INSUFFICIENT_STOCK' ? t('feed.insufficient') : t('feed.consumeError'));
    }
  }

  async function onAddItem(e: FormEvent) {
    e.preventDefault();
    if (!accessToken) return;
    await createFeedItem(accessToken, farmId, { name, reorderThreshold: threshold ? Number(threshold) : undefined })
      .then(() => {
        setName('');
        setThreshold('');
        refresh();
      })
      .catch(() => undefined);
  }

  async function onBuy(e: FormEvent) {
    e.preventDefault();
    if (!accessToken || !buyId) return;
    await purchaseFeed(accessToken, farmId, { feedItemId: buyId, qty: Number(qty), unitPricePaise: String(rupeesToPaise(Number(price))) })
      .then(() => {
        setQty('');
        setPrice('');
        refresh();
      })
      .catch(() => undefined);
  }

  return (
    <section className="space-y-3">
      <PanelHeading>{t('feed.title')}</PanelHeading>

      {load.status === 'loading' && <PanelNote>{t('feed.loading')}</PanelNote>}
      {load.status === 'error' && <PanelError>{t('feed.error')}</PanelError>}
      {load.status === 'ready' && load.items.length === 0 && <PanelNote>{t('feed.empty')}</PanelNote>}
      {load.status === 'ready' && load.items.length > 0 && (
        <ul className="space-y-2">
          {load.items.map((i) => (
            <DataRow key={i.id}>
              <div className="min-w-0">
                <p className="truncate font-medium text-foreground">{i.name}</p>
                <p className="text-xs text-muted-foreground tabular">
                  {i.stockQty} {i.unit}
                  {i.lastUnitPricePaise ? ` · ${formatPaise(Number(i.lastUnitPricePaise))}/${i.unit}` : ''}
                </p>
              </div>
              {isLow(i) && <Badge variant="warning">{t('feed.low')}</Badge>}
            </DataRow>
          ))}
        </ul>
      )}

      {canWrite && (
        <>
          {load.status === 'ready' && load.items.length > 0 && (
            <form onSubmit={onBuy} className="space-y-2 rounded-xl bg-secondary/60 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('feed.buy')}</p>
              <Select value={buyId} onChange={(e) => setBuyId(e.target.value)}>
                {load.items.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name}
                  </option>
                ))}
              </Select>
              <div className="flex gap-2">
                <Input type="number" min={0.01} step="0.01" value={qty} onChange={(e) => setQty(e.target.value)} placeholder={t('feed.qty')} required className="flex-1" />
                <Input type="number" min={0} value={price} onChange={(e) => setPrice(e.target.value)} placeholder={t('feed.unitPrice')} required className="flex-1" />
              </div>
              <Button type="submit" full>
                {t('feed.recordPurchase')}
              </Button>
            </form>
          )}
          {load.status === 'ready' && load.items.length > 0 && batches.length > 0 && (
            <form onSubmit={onConsume} className="space-y-2 rounded-xl bg-secondary/60 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('feed.consume')}</p>
              <div className="flex gap-2">
                <Select value={buyId} onChange={(e) => setBuyId(e.target.value)} className="flex-1">
                  {load.items.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name}
                    </option>
                  ))}
                </Select>
                <Select value={consBatch} onChange={(e) => setConsBatch(e.target.value)} className="flex-1">
                  {batches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.code}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Input type="number" min={0.01} step="0.01" value={consQty} onChange={(e) => setConsQty(e.target.value)} placeholder={t('feed.qty')} required className="flex-1" />
                <Button type="submit">{t('feed.recordConsume')}</Button>
              </div>
              {consError && <PanelError>{consError}</PanelError>}
              {fcr && (
                <p className="text-xs text-muted-foreground tabular">
                  {t('feed.fcrLine', { feed: fcr.feedConsumedKg, gain: fcr.weightGainKg, fcr: fcr.fcr ?? '—' })}
                </p>
              )}
            </form>
          )}
          <form onSubmit={onAddItem} className="space-y-2 rounded-xl bg-secondary/60 p-3">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('feed.name')} required />
            <Input type="number" min={0} value={threshold} onChange={(e) => setThreshold(e.target.value)} placeholder={t('feed.reorder')} />
            <Button type="submit" full variant="secondary">
              {t('feed.addItem')}
            </Button>
          </form>
        </>
      )}
    </section>
  );
}
