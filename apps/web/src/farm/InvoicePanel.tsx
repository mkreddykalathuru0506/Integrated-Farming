import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { formatPaise, rupeesToPaise } from '@ifm/shared';
import { useAuth } from '../auth/AuthContext';
import { Button, DataRow, Input, PanelHeading, PanelNote, Select, SubPanel } from '../ui';
import {
  createCustomer,
  createInvoice,
  farmPnl,
  listCustomers,
  listInvoices,
  openInvoicePdf,
  type Customer,
  type Invoice,
  type Pnl,
} from './api';

const GST_RATES = [0, 5, 12, 18, 28] as const;

export function InvoicePanel({ farmId, canWrite }: { farmId: string; canWrite: boolean }) {
  const { t } = useTranslation();
  const { accessToken } = useAuth();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [pnl, setPnl] = useState<Pnl | null>(null);
  const [custName, setCustName] = useState('');
  const [custState, setCustState] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [desc, setDesc] = useState('');
  const [qty, setQty] = useState('');
  const [price, setPrice] = useState('');
  const [gstPct, setGstPct] = useState('5');

  const refresh = useCallback(() => {
    if (!accessToken) return;
    listInvoices(accessToken, farmId).then((r) => setInvoices(r.invoices)).catch(() => undefined);
    listCustomers(accessToken, farmId).then((r) => {
      setCustomers(r.customers);
      setCustomerId((p) => p || r.customers[0]?.id || '');
    }).catch(() => undefined);
    farmPnl(accessToken, farmId).then(setPnl).catch(() => undefined);
  }, [accessToken, farmId]);

  useEffect(refresh, [refresh]);

  async function onAddCustomer(e: FormEvent) {
    e.preventDefault();
    if (!accessToken) return;
    await createCustomer(accessToken, farmId, { name: custName, state: custState || undefined })
      .then(() => {
        setCustName('');
        setCustState('');
        refresh();
      })
      .catch(() => undefined);
  }

  async function onCreateInvoice(e: FormEvent) {
    e.preventDefault();
    if (!accessToken || !customerId) return;
    await createInvoice(accessToken, farmId, {
      customerId,
      lines: [{ description: desc, qty: Number(qty), unitPricePaise: String(rupeesToPaise(Number(price))), gstRateBps: Number(gstPct) * 100 }],
    })
      .then(() => {
        setDesc('');
        setQty('');
        setPrice('');
        refresh();
      })
      .catch(() => undefined);
  }

  return (
    <section className="space-y-3">
      <PanelHeading>{t('invoices.title')}</PanelHeading>

      {pnl && (
        <SubPanel className="text-sm">
          <p className="font-medium text-foreground">{t('invoices.farmPnl')}</p>
          <p className="text-muted-foreground tabular">
            {t('invoices.revenue')} {formatPaise(Number(pnl.revenuePaise))} − {t('invoices.cost')}{' '}
            {formatPaise(Number(pnl.costPaise))} = <span className="font-semibold">{formatPaise(Number(pnl.profitPaise))}</span>
          </p>
        </SubPanel>
      )}

      {invoices.length === 0 ? (
        <PanelNote>{t('invoices.empty')}</PanelNote>
      ) : (
        <ul className="space-y-1 text-sm">
          {invoices.slice(0, 8).map((inv) => (
            <DataRow key={inv.id} className="py-1.5">
              <span className="text-foreground">{inv.invoiceNumber}</span>
              <span className="flex items-center gap-2">
                <span className="text-muted-foreground tabular">{formatPaise(Number(inv.totalPaise))}</span>
                {accessToken && (
                  <button type="button" onClick={() => void openInvoicePdf(accessToken, farmId, inv.id)} className="text-xs font-semibold text-success hover:underline">
                    {t('invoices.pdf')}
                  </button>
                )}
              </span>
            </DataRow>
          ))}
        </ul>
      )}

      {canWrite && (
        <>
          {customers.length > 0 ? (
            <form onSubmit={onCreateInvoice} className="space-y-2 rounded-xl bg-secondary/60 p-3">
              <p className="text-xs text-muted-foreground">{t('invoices.create')}</p>
              <Select value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.state ? ` (${c.state})` : ''}
                  </option>
                ))}
              </Select>
              <Input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder={t('invoices.desc')} required />
              <div className="flex gap-2">
                <Input type="number" min={0.01} step="0.01" value={qty} onChange={(e) => setQty(e.target.value)} placeholder={t('invoices.qty')} required className="flex-1" />
                <Input type="number" min={0} value={price} onChange={(e) => setPrice(e.target.value)} placeholder={t('invoices.price')} required className="flex-1" />
                <Select value={gstPct} onChange={(e) => setGstPct(e.target.value)} className="w-24">
                  {GST_RATES.map((r) => (
                    <option key={r} value={r}>
                      {r}% GST
                    </option>
                  ))}
                </Select>
              </div>
              <Button type="submit" full>
                {t('invoices.raise')}
              </Button>
            </form>
          ) : (
            <p className="text-xs text-muted-foreground">{t('invoices.addCustomerFirst')}</p>
          )}
          <form onSubmit={onAddCustomer} className="space-y-2 rounded-xl bg-secondary/60 p-3">
            <p className="text-xs text-muted-foreground">{t('invoices.addCustomer')}</p>
            <div className="flex gap-2">
              <Input value={custName} onChange={(e) => setCustName(e.target.value)} placeholder={t('invoices.custName')} required className="flex-1" />
              <Input value={custState} onChange={(e) => setCustState(e.target.value)} placeholder={t('invoices.custState')} className="flex-1" />
            </div>
            <Button type="submit" full variant="secondary">
              {t('invoices.addCustomerBtn')}
            </Button>
          </form>
        </>
      )}
    </section>
  );
}
