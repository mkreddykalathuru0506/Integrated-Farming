import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { formatPaise, rupeesToPaise } from '@ifm/shared';
import { useAuth } from '../auth/AuthContext';
import { Button, DataRow, Input, PanelHeading, PanelNote, Select } from '../ui';
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
      <PanelHeading>{t('byproducts.title')}</PanelHeading>

      {transfers.length === 0 ? (
        <PanelNote>{t('byproducts.empty')}</PanelNote>
      ) : (
        <ul className="space-y-1 text-sm">
          {transfers.slice(0, 8).map((tr) => (
            <DataRow key={tr.id} className="py-1.5">
              <span className="truncate text-foreground tabular">
                {t(`byproducts.type.${tr.byproductType}`)} · {tr.quantity}
                {tr.unit} · {unitName(tr.fromUnitId)} → {unitName(tr.toUnitId)}
              </span>
              {Number(tr.creditPaise) > 0 && <span className="shrink-0 text-success tabular">{formatPaise(Number(tr.creditPaise))}</span>}
            </DataRow>
          ))}
        </ul>
      )}

      {canWrite && (
        <form onSubmit={onCreate} className="space-y-2 rounded-xl bg-secondary/60 p-3">
          <p className="text-xs text-muted-foreground">{t('byproducts.record')}</p>
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
            <span className="self-center text-muted-foreground">→</span>
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
