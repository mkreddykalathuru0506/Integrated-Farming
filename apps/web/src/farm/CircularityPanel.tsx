import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatPaise } from '@ifm/shared';
import { useAuth } from '../auth/AuthContext';
import { getCircularity, type Circularity } from './api';

export function CircularityPanel({ farmId }: { farmId: string }) {
  const { t } = useTranslation();
  const { accessToken } = useAuth();
  const [c, setC] = useState<Circularity | null>(null);

  const refresh = useCallback(() => {
    if (!accessToken) return;
    getCircularity(accessToken, farmId).then(setC).catch(() => undefined);
  }, [accessToken, farmId]);

  useEffect(refresh, [refresh]);

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">{t('circularity.title')}</h2>

      {!c || c.transferCount === 0 ? (
        <p className="text-sm text-slate-500">{t('circularity.empty')}</p>
      ) : (
        <>
          <div className="rounded-lg bg-green-50 p-3">
            <p className="text-xs text-green-700">{t('circularity.totalSaved')}</p>
            <p className="text-xl font-semibold text-green-800">{formatPaise(Number(c.totalCreditPaise))}</p>
            <p className="text-xs text-green-700">
              {t('circularity.summary', { count: c.transferCount, qty: c.totalQuantity })}
            </p>
          </div>

          {c.byType.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-medium text-slate-500">{t('circularity.byType')}</p>
              <ul className="space-y-1 text-sm">
                {c.byType.map((b) => (
                  <li key={b.type} className="flex items-center justify-between">
                    <span className="text-slate-600">
                      {t(`byproducts.type.${b.type}`)} · {b.quantity}kg
                    </span>
                    <span className="text-green-700">{formatPaise(Number(b.creditPaise))}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </section>
  );
}
