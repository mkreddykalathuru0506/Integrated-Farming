import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { formatPaise, rupeesToPaise } from '@ifm/shared';
import { useAuth } from '../auth/AuthContext';
import { Button, Input } from '../ui';
import { listMarketRates, recordMarketRate, type MarketRate } from './api';

function fmtTs(iso: string) {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
}

export function MarketPanel({ farmId, canWrite }: { farmId: string; canWrite: boolean }) {
  const { t } = useTranslation();
  const { accessToken } = useAuth();
  const [rates, setRates] = useState<MarketRate[]>([]);
  const [commodity, setCommodity] = useState('');
  const [price, setPrice] = useState('');
  const [unit, setUnit] = useState('kg');

  const refresh = useCallback(() => {
    if (!accessToken) return;
    listMarketRates(accessToken, farmId).then((r) => setRates(r.rates)).catch(() => undefined);
  }, [accessToken, farmId]);

  useEffect(refresh, [refresh]);

  async function onRecord(e: FormEvent) {
    e.preventDefault();
    if (!accessToken) return;
    await recordMarketRate(accessToken, farmId, {
      commodity,
      pricePaise: String(rupeesToPaise(Number(price))),
      unit,
    })
      .then(() => {
        setCommodity('');
        setPrice('');
        refresh();
      })
      .catch(() => undefined);
  }

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">{t('market.title')}</h2>

      {rates.length === 0 ? (
        <p className="text-sm text-slate-500">{t('market.empty')}</p>
      ) : (
        <ul className="space-y-1 text-sm">
          {rates.map((r) => (
            <li key={r.id} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-1.5">
              <span className="text-slate-700">
                {r.commodity}
                <span className="block text-xs text-slate-400">{t('market.asOf', { ts: fmtTs(r.fetchedAt), source: r.source })}</span>
              </span>
              <span className="text-slate-600">
                {formatPaise(Number(r.pricePaise))}/{r.unit}
              </span>
            </li>
          ))}
        </ul>
      )}

      {canWrite && (
        <form onSubmit={onRecord} className="space-y-2 rounded-lg bg-slate-50 p-3">
          <p className="text-xs text-slate-500">{t('market.record')}</p>
          <Input value={commodity} onChange={(e) => setCommodity(e.target.value)} placeholder={t('market.commodity')} required />
          <div className="flex gap-2">
            <Input type="number" min={0} value={price} onChange={(e) => setPrice(e.target.value)} placeholder={t('market.price')} required className="flex-1" />
            <Input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder={t('market.unit')} required className="w-24" />
          </div>
          <Button type="submit" full>
            {t('market.save')}
          </Button>
        </form>
      )}
    </section>
  );
}
