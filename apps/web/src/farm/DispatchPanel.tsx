import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/AuthContext';
import { Button, Input, Select } from '../ui';
import {
  createDispatch,
  listDispatches,
  listLots,
  listOrders,
  type Dispatch,
  type ProductLot,
  type SalesOrder,
} from './api';

export function DispatchPanel({ farmId, canWrite }: { farmId: string; canWrite: boolean }) {
  const { t } = useTranslation();
  const { accessToken } = useAuth();
  const [dispatches, setDispatches] = useState<Dispatch[]>([]);
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [lots, setLots] = useState<ProductLot[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [orderId, setOrderId] = useState('');
  const [lotId, setLotId] = useState('');
  const [qty, setQty] = useState('');
  const [refrigerated, setRefrigerated] = useState(true);
  const [temp, setTemp] = useState('');
  const [vehicle, setVehicle] = useState('');

  const refresh = useCallback(() => {
    if (!accessToken) return;
    listDispatches(accessToken, farmId).then((r) => setDispatches(r.dispatches)).catch(() => undefined);
    listOrders(accessToken, farmId)
      .then((r) => {
        const confirmed = r.orders.filter((o) => o.status === 'CONFIRMED');
        setOrders(confirmed);
        setOrderId((p) => p || confirmed[0]?.id || '');
      })
      .catch(() => undefined);
    listLots(accessToken, farmId)
      .then((r) => {
        const available = r.lots.filter((l) => l.status === 'AVAILABLE' && Number(l.quantityKg) > 0);
        setLots(available);
        setLotId((p) => p || available[0]?.id || '');
      })
      .catch(() => undefined);
  }, [accessToken, farmId]);

  useEffect(refresh, [refresh]);

  async function onDispatch(e: FormEvent) {
    e.preventDefault();
    if (!accessToken || !orderId || !lotId) return;
    setError(null);
    await createDispatch(accessToken, farmId, {
      salesOrderId: orderId,
      refrigeratedTransport: refrigerated,
      dispatchTempC: temp ? Number(temp) : undefined,
      vehicleNumber: vehicle || undefined,
      lines: [{ productLotId: lotId, qtyKg: Number(qty) }],
    })
      .then(() => {
        setQty('');
        setVehicle('');
        setTemp('');
        refresh();
      })
      .catch((err: Error) => setError(err.message === 'COLD_CHAIN_FAIL' ? t('dispatch.coldChainFail') : t('dispatch.error')));
  }

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">{t('dispatch.title')}</h2>

      {dispatches.length === 0 ? (
        <p className="text-sm text-slate-500">{t('dispatch.empty')}</p>
      ) : (
        <ul className="space-y-1 text-sm">
          {dispatches.slice(0, 6).map((d) => (
            <li key={d.id} className="rounded-lg border border-slate-200 px-3 py-2">
              <div className="flex items-center justify-between">
                <span className="font-medium text-slate-700">{d.salesOrder.orderNumber}</span>
                <span className={d.coldChainOk ? 'text-xs font-semibold text-green-700' : 'text-xs font-semibold text-red-600'}>
                  {d.coldChainOk ? `❄ ${t('dispatch.chainOk')}` : t('dispatch.chainBroken')}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-slate-500">
                {d.lines[0]?.productLot
                  ? `${d.lines[0].productLot.productName} → ${t('processing.fromBatch')} ${d.lines[0].productLot.sourceBatch?.code ?? '—'}`
                  : '—'}
                {d.dispatchTempC !== null ? ` · ${d.dispatchTempC}°C` : ''}
                {d.vehicleNumber ? ` · ${d.vehicleNumber}` : ''}
              </p>
            </li>
          ))}
        </ul>
      )}

      {canWrite &&
        (orders.length > 0 && lots.length > 0 ? (
          <form onSubmit={onDispatch} className="space-y-2 rounded-lg bg-slate-50 p-3">
            <p className="text-xs text-slate-500">{t('dispatch.create')}</p>
            <Select value={orderId} onChange={(e) => setOrderId(e.target.value)}>
              {orders.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.orderNumber} · {o.customer.name}
                </option>
              ))}
            </Select>
            <div className="flex gap-2">
              <Select value={lotId} onChange={(e) => setLotId(e.target.value)} className="flex-1">
                {lots.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.productName} ({l.quantityKg}kg, {t(`cold.mode.${l.state}`)})
                  </option>
                ))}
              </Select>
              <Input type="number" min={0.01} step="0.01" value={qty} onChange={(e) => setQty(e.target.value)} placeholder={t('dispatch.qtyKg')} required className="w-24" />
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input type="checkbox" checked={refrigerated} onChange={(e) => setRefrigerated(e.target.checked)} />
              {t('dispatch.refrigerated')}
            </label>
            <div className="flex gap-2">
              <Input type="number" step="0.1" value={temp} onChange={(e) => setTemp(e.target.value)} placeholder={t('dispatch.tempC')} className="flex-1" />
              <Input value={vehicle} onChange={(e) => setVehicle(e.target.value)} placeholder={t('dispatch.vehicle')} className="flex-1" />
            </div>
            {error && (
              <p role="alert" className="text-xs text-red-600">
                {error}
              </p>
            )}
            <Button type="submit" full>
              {t('dispatch.dispatch')}
            </Button>
          </form>
        ) : (
          <p className="text-xs text-slate-500">{t('dispatch.needOrderAndLot')}</p>
        ))}
    </section>
  );
}
