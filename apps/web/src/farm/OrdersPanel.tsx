import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { formatPaise, rupeesToPaise } from '@ifm/shared';
import { useAuth } from '../auth/AuthContext';
import { Button, Input, Select } from '../ui';
import {
  createOrder,
  listCustomers,
  listOrders,
  setOrderStatus,
  type Customer,
  type SalesOrder,
} from './api';

export function OrdersPanel({ farmId, canWrite }: { farmId: string; canWrite: boolean }) {
  const { t } = useTranslation();
  const { accessToken } = useAuth();
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerId, setCustomerId] = useState('');
  const [desc, setDesc] = useState('');
  const [qty, setQty] = useState('');
  const [price, setPrice] = useState('');

  const refresh = useCallback(() => {
    if (!accessToken) return;
    listOrders(accessToken, farmId).then((r) => setOrders(r.orders)).catch(() => undefined);
    listCustomers(accessToken, farmId)
      .then((r) => {
        setCustomers(r.customers);
        setCustomerId((p) => p || r.customers[0]?.id || '');
      })
      .catch(() => undefined);
  }, [accessToken, farmId]);

  useEffect(refresh, [refresh]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!accessToken || !customerId) return;
    await createOrder(accessToken, farmId, {
      customerId,
      lines: [{ description: desc, qty: Number(qty), unitPricePaise: String(rupeesToPaise(Number(price))) }],
    })
      .then(() => {
        setDesc('');
        setQty('');
        setPrice('');
        refresh();
      })
      .catch(() => undefined);
  }

  async function onStatus(id: string, status: 'CONFIRMED' | 'CANCELLED') {
    if (!accessToken) return;
    await setOrderStatus(accessToken, farmId, id, status).then(refresh).catch(() => undefined);
  }

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">{t('orders.title')}</h2>

      {orders.length === 0 ? (
        <p className="text-sm text-slate-500">{t('orders.empty')}</p>
      ) : (
        <ul className="space-y-1 text-sm">
          {orders.slice(0, 8).map((o) => (
            <li key={o.id} className="rounded-lg border border-slate-200 px-3 py-2">
              <div className="flex items-center justify-between">
                <span className="font-medium text-slate-700">{o.orderNumber}</span>
                <span className="text-slate-500">{formatPaise(Number(o.totalPaise))}</span>
              </div>
              <div className="mt-1 flex items-center justify-between">
                <span className="text-xs text-slate-500">
                  {o.customer.name} · {t(`orders.status.${o.status}`)}
                </span>
                {canWrite && o.status === 'DRAFT' && (
                  <span className="flex gap-2">
                    <button type="button" onClick={() => void onStatus(o.id, 'CONFIRMED')} className="text-xs font-semibold text-green-700 hover:underline">
                      {t('orders.confirm')}
                    </button>
                    <button type="button" onClick={() => void onStatus(o.id, 'CANCELLED')} className="text-xs font-semibold text-red-600 hover:underline">
                      {t('orders.cancel')}
                    </button>
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {canWrite &&
        (customers.length > 0 ? (
          <form onSubmit={onCreate} className="space-y-2 rounded-lg bg-slate-50 p-3">
            <p className="text-xs text-slate-500">{t('orders.create')}</p>
            <Select value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
            <Input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder={t('orders.desc')} required />
            <div className="flex gap-2">
              <Input type="number" min={0.01} step="0.01" value={qty} onChange={(e) => setQty(e.target.value)} placeholder={t('orders.qty')} required className="flex-1" />
              <Input type="number" min={0} value={price} onChange={(e) => setPrice(e.target.value)} placeholder={t('orders.price')} required className="flex-1" />
            </div>
            <Button type="submit" full>
              {t('orders.take')}
            </Button>
          </form>
        ) : (
          <p className="text-xs text-slate-500">{t('orders.addCustomerFirst')}</p>
        ))}
    </section>
  );
}
