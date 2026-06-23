import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { formatPaise, rupeesToPaise } from '@ifm/shared';
import { useAuth } from '../auth/AuthContext';
import { Badge, Button, Input } from '../ui';
import { createFeedItem, listFeedItems, purchaseFeed, type FeedItem } from './api';

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
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">{t('feed.title')}</h2>

      {load.status === 'loading' && <p className="text-sm text-slate-500">{t('feed.loading')}</p>}
      {load.status === 'error' && (
        <p role="alert" className="text-sm text-red-600">
          {t('feed.error')}
        </p>
      )}
      {load.status === 'ready' && load.items.length === 0 && (
        <p className="text-sm text-slate-500">{t('feed.empty')}</p>
      )}
      {load.status === 'ready' && load.items.length > 0 && (
        <ul className="space-y-2">
          {load.items.map((i) => (
            <li key={i.id} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2">
              <div className="min-w-0">
                <p className="truncate font-medium text-slate-800">{i.name}</p>
                <p className="text-xs text-slate-500">
                  {i.stockQty} {i.unit}
                  {i.lastUnitPricePaise ? ` · ${formatPaise(Number(i.lastUnitPricePaise))}/${i.unit}` : ''}
                </p>
              </div>
              {isLow(i) && <Badge className="bg-amber-100 text-amber-800">{t('feed.low')}</Badge>}
            </li>
          ))}
        </ul>
      )}

      {canWrite && (
        <>
          {load.status === 'ready' && load.items.length > 0 && (
            <form onSubmit={onBuy} className="space-y-2 rounded-lg bg-slate-50 p-3">
              <p className="text-xs text-slate-500">{t('feed.buy')}</p>
              <select value={buyId} onChange={(e) => setBuyId(e.target.value)} className="block min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3">
                {load.items.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name}
                  </option>
                ))}
              </select>
              <div className="flex gap-2">
                <Input type="number" min={0.01} step="0.01" value={qty} onChange={(e) => setQty(e.target.value)} placeholder={t('feed.qty')} required className="flex-1" />
                <Input type="number" min={0} value={price} onChange={(e) => setPrice(e.target.value)} placeholder={t('feed.unitPrice')} required className="flex-1" />
              </div>
              <Button type="submit" full>
                {t('feed.recordPurchase')}
              </Button>
            </form>
          )}
          <form onSubmit={onAddItem} className="space-y-2 rounded-lg bg-slate-50 p-3">
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
