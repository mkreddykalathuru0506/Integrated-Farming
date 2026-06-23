import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatPaise } from '@ifm/shared';
import { useAuth } from '../auth/AuthContext';
import { Button } from '../ui';
import { dispatchAlerts, getDashboard, listAlerts, type AlertLog, type Dashboard } from './api';

export function DashboardPanel({ farmId, canWrite }: { farmId: string; canWrite: boolean }) {
  const { t } = useTranslation();
  const { accessToken } = useAuth();
  const [data, setData] = useState<Dashboard | null>(null);
  const [alerts, setAlerts] = useState<AlertLog[]>([]);

  const refresh = useCallback(() => {
    if (!accessToken) return;
    getDashboard(accessToken, farmId).then(setData).catch(() => undefined);
    listAlerts(accessToken, farmId).then((r) => setAlerts(r.alerts)).catch(() => undefined);
  }, [accessToken, farmId]);

  useEffect(refresh, [refresh]);

  async function onDispatch() {
    if (!accessToken) return;
    await dispatchAlerts(accessToken, farmId).then(refresh).catch(() => undefined);
  }

  if (!data) return <p className="text-sm text-slate-500">{t('dashboard.loading')}</p>;

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">{t('dashboard.title')}</h2>

      <div className="grid grid-cols-3 gap-2 text-center text-sm">
        <div className="rounded-lg bg-red-50 p-2">
          <p className="text-lg font-semibold text-red-700">{data.risks.bySeverity.CRITICAL ?? 0}</p>
          <p className="text-xs text-red-600">{t('dashboard.critical')}</p>
        </div>
        <div className="rounded-lg bg-amber-50 p-2">
          <p className="text-lg font-semibold text-amber-700">{data.risks.bySeverity.WARNING ?? 0}</p>
          <p className="text-xs text-amber-600">{t('dashboard.warning')}</p>
        </div>
        <div className="rounded-lg bg-slate-50 p-2">
          <p className="text-lg font-semibold text-slate-700">{data.alerts.total}</p>
          <p className="text-xs text-slate-500">{t('dashboard.alertsSent')}</p>
        </div>
      </div>

      {data.weather && (
        <p className="text-sm text-slate-600">
          {t('dashboard.weatherLine', { temp: data.weather.tempC, source: data.weather.source })}
        </p>
      )}
      {data.market.length > 0 && (
        <p className="text-sm text-slate-600">
          {data.market.map((m) => `${m.commodity} ${formatPaise(Number(m.pricePaise))}/${m.unit}`).join(' · ')}
        </p>
      )}

      {canWrite && (
        <Button type="button" onClick={() => void onDispatch()} full>
          {t('dashboard.dispatch')}
        </Button>
      )}

      {alerts.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-medium text-slate-500">{t('dashboard.recentAlerts')}</p>
          <ul className="space-y-1 text-xs text-slate-600">
            {alerts.slice(0, 6).map((a) => (
              <li key={a.id} className="rounded-lg border border-slate-200 px-3 py-1.5">
                <span className="font-medium text-slate-700">[{a.status}]</span> {a.body}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
