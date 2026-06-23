import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/AuthContext';
import { Button } from '../ui';
import { acknowledgeRisk, getWeather, listRisks, type RiskFlag, type Weather } from './api';

const SEVERITY_CLASS: Record<string, string> = {
  CRITICAL: 'text-red-600',
  WARNING: 'text-amber-600',
  INFO: 'text-slate-500',
};

function fmtTs(iso: string) {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function WeatherPanel({ farmId, canWrite }: { farmId: string; canWrite: boolean }) {
  const { t } = useTranslation();
  const { accessToken } = useAuth();
  const [weather, setWeather] = useState<Weather | null>(null);
  const [risks, setRisks] = useState<RiskFlag[]>([]);
  const [needsLocation, setNeedsLocation] = useState(false);

  const loadRisks = useCallback(() => {
    if (!accessToken) return;
    listRisks(accessToken, farmId).then((r) => setRisks(r.risks)).catch(() => undefined);
  }, [accessToken, farmId]);

  const loadWeather = useCallback(
    (refresh = false) => {
      if (!accessToken) return;
      getWeather(accessToken, farmId, refresh)
        .then((w) => {
          setWeather(w);
          setNeedsLocation(false);
          loadRisks();
        })
        .catch((err: Error) => {
          if (err.message === 'LOCATION_REQUIRED') setNeedsLocation(true);
        });
    },
    [accessToken, farmId, loadRisks],
  );

  useEffect(() => {
    loadWeather(false);
    loadRisks();
  }, [loadWeather, loadRisks]);

  async function onAck(id: string) {
    if (!accessToken) return;
    await acknowledgeRisk(accessToken, farmId, id).then(loadRisks).catch(() => undefined);
  }

  const openRisks = risks.filter((r) => r.status === 'OPEN');

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">{t('weather.title')}</h2>

      {needsLocation ? (
        <p className="text-sm text-slate-500">{t('weather.needLocation')}</p>
      ) : weather ? (
        <div className="rounded-lg bg-sky-50 p-3 text-sm">
          <p className="text-lg font-semibold text-sky-800">
            {weather.weather.tempC}°C
            {weather.weather.humidityPct !== null ? ` · ${weather.weather.humidityPct}% RH` : ''}
          </p>
          <p className="text-xs text-sky-700">
            {t('weather.asOf', { ts: fmtTs(weather.weather.fetchedAt), source: weather.weather.source })}
          </p>
          {canWrite && (
            <Button type="button" variant="secondary" onClick={() => loadWeather(true)} className="mt-2">
              {t('weather.refresh')}
            </Button>
          )}
        </div>
      ) : (
        <p className="text-sm text-slate-500">{t('weather.loading')}</p>
      )}

      <div>
        <p className="mb-1 text-xs font-medium text-slate-500">{t('weather.alerts')}</p>
        {openRisks.length === 0 ? (
          <p className="text-sm text-slate-500">{t('weather.noAlerts')}</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {openRisks.map((r) => (
              <li key={r.id} className="flex items-start justify-between gap-2 rounded-lg border border-slate-200 px-3 py-1.5">
                <span>
                  <span className={`font-semibold ${SEVERITY_CLASS[r.severity] ?? ''}`}>{t(`risk.type.${r.type}`)}</span>
                  <span className="block text-xs text-slate-500">{r.reason}</span>
                </span>
                {canWrite && (
                  <button type="button" onClick={() => void onAck(r.id)} className="shrink-0 text-xs font-semibold text-green-700 hover:underline">
                    {t('weather.ack')}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
