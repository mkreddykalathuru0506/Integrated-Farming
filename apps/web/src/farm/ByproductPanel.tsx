import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { formatPaise, rupeesToPaise } from '@ifm/shared';
import { useAuth } from '../auth/AuthContext';
import { Button, Input, Select } from '../ui';
import {
  createByproductTransfer,
  listByproducts,
  listUnits,
  type ByproductTransfer,
  type Unit,
} from './api';

const BYPRODUCT_TYPES = ['LITTER', 'MANURE', 'COMPOST', 'SLURRY', 'EGGSHELL', 'SLAUGHTER_WASTE', 'CROP_RESIDUE', 'OTHER'] as const;

export function ByproductPanel({ farmId, canWrite }: { farmId: string; canWrite: boolean }) {
  const { t } = useTranslation();
  const { accessToken } = useAuth();
  const [transfers, setTransfers] = useState<ByproductTransfer[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [type, setType] = useState<string>('LITTER');
  const [fromUnitId, setFromUnitId] = useState('');
  const [toUnitId, setToUnitId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [credit, setCredit] = useState('');

  const unitName = useCallback((id: string | null) => (id ? units.find((u) => u.id === id)?.name ?? '—' : '—'), [units]);

  const refresh = useCallback(() => {
    if (!accessToken) return;
    listByproducts(accessToken, farmId).then((r) => setTransfers(r.transfers)).catch(() => undefined);
    listUnits(accessToken, farmId).then((r) => setUnits(r.units)).catch(() => undefined);
  }, [accessToken, farmId]);

  useEffect(refresh, [refresh]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!accessToken) return;
    await createByproductTransfer(accessToken, farmId, {
      byproductType: type,
      fromUnitId: fromUnitId || undefined,
      toUnitId: toUnitId || undefined,
      quantity: Number(quantity),
      creditPaise: credit ? String(rupeesToPaise(Number(credit))) : undefined,
    })
      .then(() => {
        setQuantity('');
        setCredit('');
        refresh();
      })
      .catch(() => undefined);
  }

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">{t('byproducts.title')}</h2>

      {transfers.length === 0 ? (
        <p className="text-sm text-slate-500">{t('byproducts.empty')}</p>
      ) : (
        <ul className="space-y-1 text-sm">
          {transfers.slice(0, 8).map((tr) => (
            <li key={tr.id} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-1.5">
              <span className="truncate text-slate-700">
                {t(`byproducts.type.${tr.byproductType}`)} · {tr.quantity}
                {tr.unit} · {unitName(tr.fromUnitId)} → {unitName(tr.toUnitId)}
              </span>
              {Number(tr.creditPaise) > 0 && <span className="shrink-0 text-green-700">{formatPaise(Number(tr.creditPaise))}</span>}
            </li>
          ))}
        </ul>
      )}

      {canWrite && (
        <form onSubmit={onCreate} className="space-y-2 rounded-lg bg-slate-50 p-3">
          <p className="text-xs text-slate-500">{t('byproducts.record')}</p>
          <Select value={type} onChange={(e) => setType(e.target.value)}>
            {BYPRODUCT_TYPES.map((bt) => (
              <option key={bt} value={bt}>
                {t(`byproducts.type.${bt}`)}
              </option>
            ))}
          </Select>
          <div className="flex gap-2">
            <Select value={fromUnitId} onChange={(e) => setFromUnitId(e.target.value)} className="flex-1">
              <option value="">{t('byproducts.fromAny')}</option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </Select>
            <span className="self-center text-slate-400">→</span>
            <Select value={toUnitId} onChange={(e) => setToUnitId(e.target.value)} className="flex-1">
              <option value="">{t('byproducts.toAny')}</option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex gap-2">
            <Input type="number" min={0.01} step="0.01" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder={t('byproducts.qtyKg')} required className="flex-1" />
            <Input type="number" min={0} value={credit} onChange={(e) => setCredit(e.target.value)} placeholder={t('byproducts.credit')} className="flex-1" />
          </div>
          <Button type="submit" full>
            {t('byproducts.transfer')}
          </Button>
        </form>
      )}
    </section>
  );
}
