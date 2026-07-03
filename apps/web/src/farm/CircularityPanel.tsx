import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatPaise } from '@ifm/shared';
import { useAuth } from '../auth/AuthContext';
import { PanelHeading, PanelNote } from '../ui';
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
      <PanelHeading>{t('circularity.title')}</PanelHeading>

      {!c || c.transferCount === 0 ? (
        <PanelNote>{t('circularity.empty')}</PanelNote>
      ) : (
        <>
          <div className="rounded-xl bg-success/10 p-3">
            <p className="text-xs text-success">{t('circularity.totalSaved')}</p>
            <p className="text-xl font-semibold text-success tabular">{formatPaise(Number(c.totalCreditPaise))}</p>
            <p className="text-xs text-success tabular">
              {t('circularity.summary', { count: c.transferCount, qty: c.totalQuantity })}
            </p>
          </div>

          {c.byType.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-medium text-muted-foreground">{t('circularity.byType')}</p>
              <ul className="space-y-1 text-sm">
                {c.byType.map((b) => (
                  <li key={b.type} className="flex items-center justify-between">
                    <span className="text-muted-foreground tabular">
                      {t(`byproducts.type.${b.type}`)} · {b.quantity}kg
                    </span>
                    <span className="text-success tabular">{formatPaise(Number(b.creditPaise))}</span>
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
